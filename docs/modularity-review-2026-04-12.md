# Modularity Review — Commute Dashboard

**Date:** 2026-04-12
**Scope:** `backend/`, `frontend/`, `infra/` (analysis only, no code changes)

## Overall Assessment

The codebase is well-modularised for its current scope. Clear layering (controllers → services → repository), a shared router between Lambda and Express, centralised config, and per-service error isolation via `Promise.allSettled` all hold up well. Strain points appear when imagining growth: new data sources, multi-leg journeys, and the growing `DashboardPage.tsx`.

## Strengths

- **Shared router** (`backend/src/router.ts`) — Lambda handler and Express dev server dispatch identically; no duplicated wiring.
- **Config centralisation** — `backend/src/config.ts` is the single env-var surface; secrets come from SSM.
- **Service isolation** — `railService`, `weatherService`, `tflService` each own their transport, timeout, and error shape; a failure in one does not poison the response.
- **Repository pattern** — AWS SDK confined to `backend/src/db/profilesRepository.ts`; controllers stay pure.
- **Auth scoping** — every DB query is `userId`-scoped by convention.
- **Deploy scripts** — Node-based `deploy.mjs` + `Deploy.ps1` orchestrator give a clean one-command path.

## Weaknesses / Smells

1. **`dashboardController.ts` is a hardcoded fan-out.** Each new data source adds another `Promise.allSettled` slot, another destructured result, and another block in the response shape. Will not scale past ~10 sources without becoming unreadable.
2. **`DashboardPage.tsx` at 680 lines** mixes rendering, colour maps, time maths, and section layouts. Adding sections compounds this.
3. **Duplicated TfL colour map** across `DashboardPage.tsx` and `TflLineSelector.tsx` (already flagged in `CLAUDE.md`).
4. **Profile model assumes a single outbound + single return leg.** `outbound`/`return` are scalar objects, not a list. Multi-leg journeys would require reshaping the type across DB, validation, backend services, and every frontend form/card.
5. **No service-layer abstraction.** Each service exports bespoke functions. No common `CommuteDataSource` interface, so the dashboard controller must know every source by name.
6. **Static station lookup** (`backend/src/data/stations.ts`) — fine today, but coordinates, operator info, and accessibility data will eventually want a proper reference source.
7. **Response shape is flat and named.** `rail`, `weather`, `tfl` as top-level keys means the frontend knows every source statically. New sources require coordinated FE/BE changes.
8. **Validation is hand-rolled** (`backend/src/validation.ts`). Fine today; a schema library (Zod) would pay off once profiles grow (multi-leg, per-day variations).
9. **No caching layer.** Per-container memoisation of weather (5-min TTL) and TfL (1-min TTL) would cut upstream calls.

## Recommendations

### Near-term, low cost

- **Extract dashboard sections** (`RailSection`, `WeatherSection`, `TflSection`, header, switcher) from `DashboardPage.tsx` into `frontend/src/components/dashboard/*`. Aim for <200 LOC per file.
- **Move TfL colour map** to a shared `frontend/src/data/tflLines.ts`.
- **Introduce Zod schemas** in `backend/src/validation.ts` and reuse inferred types.

### Medium-term, enables new APIs cleanly

- **Define a `CommuteDataSource` interface** on the backend:
  ```ts
  interface CommuteDataSource<TInput, TOutput> {
    key: string;              // e.g. "rail.outbound", "weather.origin"
    fetch(input: TInput, profile: CommuteProfile): Promise<TOutput>;
    timeoutMs: number;
  }
  ```
  The dashboard controller becomes a generic aggregator that iterates registered sources and returns `{ [key]: { status, data?, error? } }`. Adding "traffic", "air quality", "strike calendar" = register a new source.
- **Generic dashboard response shape**: `{ sources: Record<string, { status, data, error }>, profile, lastRefreshed }`. Frontend renders via a section registry keyed by source id.
- **SSM + config conventions** for new APIs — document a pattern (param name prefix, timeout default, cache TTL) so new sources fit predictably.

### For multi-leg journeys

- Reshape `CommuteProfile.outbound` / `.return` into `legs: Leg[]` where `Leg = { mode: 'rail'|'bus'|'tube'|'walk', origin, destination, departureTime, ... }`.
- The dashboard fans out per leg rather than per fixed slot.
- `ProfileForm` becomes a dynamic leg list (add/remove). `ProfileCard` renders a chain. Validation walks the array.
- Consider a `JourneyPlannerService` that *suggests* legs (e.g. TfL Journey Planner) rather than only reporting on fixed ones.

### Ideas for new information APIs

- **National Rail Knowledgebase / RDG disruptions** — engineering works forecast.
- **TfL Journey Planner** — end-to-end routing for complex legs.
- **Strikes / industrial action feed** (RMT / ASLEF calendars).
- **Air quality** (DEFRA UK-AIR, London Air) — relevant for cyclists/walkers.
- **Traffic** (TomTom / HERE) if a driving leg is added.
- **Calendar integration** — skip the outbound if today is a WFH day.

## Summary

Good bones, clear layering. Two concrete refactors unlock everything else:

1. **A pluggable data-source registry on the backend**, replacing the hardcoded fan-out in `dashboardController`.
2. **Modelling the profile as a list of legs** instead of fixed outbound/return.

With those in place, both "more APIs" and "multi-leg commutes" become additive rather than invasive changes.
