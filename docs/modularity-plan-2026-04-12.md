# Modularity Refactor Plan — 2026-04-12

Addresses smells **1, 2, 3, 5, 7, 8, 9** from `modularity-review-2026-04-12.md`.
Smells 4 (multi-leg) and 6 (static station lookup) are intentionally deferred.

## Guiding order

Several smells are tightly coupled and cheapest to tackle together:

- **5 + 1 + 7** are one refactor: define a data-source interface, rebuild the controller as a registry-driven aggregator, and ship a generic response shape. Splitting them would mean shipping the controller twice.
- **3** (TfL colour map), **2** (DashboardPage split), **8** (Zod), and **9** (caching) are independent and can land in any order.

Proposed sequence: **3 → 5+1+7 → 2 → 8 → 9**. Each step is independently shippable.

---

## Step 1 — Smell 3: Shared TfL colour map

**Scope (frontend only):**
- New file: `frontend/src/data/tflLines.ts` exporting `TFL_LINE_COLOURS: Record<string, { bg: string; text: string }>` and `TFL_LINE_NAMES: Record<string, string>`.
- Replace the duplicated maps in `DashboardPage.tsx` and `TflLineSelector.tsx` with imports.
- Update CLAUDE.md note that flagged the duplication (remove the "update both" warning).

**Risk:** none. Pure extraction.

---

## Step 2 — Smells 5 + 1 + 7: Data-source registry & generic response

**Backend changes:**

1. New file `backend/src/services/dataSource.ts`:
   ```ts
   export interface CommuteDataSource<TOutput> {
     key: string;                       // e.g. "rail.outbound", "weather.origin"
     timeoutMs: number;
     fetch(profile: CommuteProfile): Promise<TOutput>;
   }
   export interface SourceResult<T = unknown> {
     status: 'ok' | 'error';
     data?: T;
     error?: string;
   }
   ```
2. New file `backend/src/services/sourceRegistry.ts`:
   - Builds the list of sources from the profile (rail outbound/return, rail messages, weather×3, tfl when configured).
   - Exposes `runAll(profile): Promise<Record<string, SourceResult>>` using `Promise.allSettled` + per-source try/catch.
3. Rewrite `dashboardController.ts` as ~20 lines: load profile → `runAll` → return `{ profile, sources, lastRefreshed }`.
4. Update `DashboardResponse` type:
   ```ts
   interface DashboardResponse {
     profile: { name: string; profileId: string };
     sources: Record<string, SourceResult>;
     lastRefreshed: string;
   }
   ```

**Frontend changes:**
- `frontend/src/api/types.ts` mirrors the new shape.
- `DashboardPage.tsx` reads `data.sources['rail.outbound']` etc. Keep section components reading by key.

**Risk:** the dashboard E2E test (`3.9` empty-state, "No data yet" ×3) must still pass — the section components, not the shape, produce that copy.

**Contract:** document the key-naming convention (`<domain>.<role>`) and required `SourceResult` envelope in a short README under `backend/src/services/`.

---

## Step 3 — Smell 2: Split DashboardPage.tsx

**Scope (frontend only):** Extract from `DashboardPage.tsx` into `frontend/src/components/dashboard/`:
- `DashboardHeader.tsx` — title, profile switcher, last-refreshed.
- `RailSection.tsx` — one instance per rail source key (outbound/return).
- `WeatherSection.tsx` — renders the three weather slots.
- `TflSection.tsx` — pills and statuses.
- `EmptyState.tsx` — the "No active profile" view (preserve three "No data yet" strings).
- `sectionHelpers.ts` — `weatherIcon()`, time maths, status colour helpers.

Target: `DashboardPage.tsx` < 150 LOC, each section < 200 LOC.

**Risk:** Playwright selectors in `commute-dashboard.spec.ts` — keep text and roles identical. No selector refactor in this step.

---

## Step 4 — Smell 8: Zod validation

- Add `zod` to `backend/package.json`.
- Replace `backend/src/validation.ts` internals with a single `ProfileSchema` (Zod). Export inferred `CommuteProfile` type from the schema so `types/index.ts` re-exports rather than defining.
- Keep the `{ errors: [{ field, message }] }` response shape — write a small `zodToFieldErrors()` adapter so the API contract is unchanged.
- Reuse `isValidCrs` / `isValidTflLine` via `.refine()`.

---

## Step 5 — Smell 9: Caching layer

- New file `backend/src/services/cache.ts`: trivial in-memory `Map`-based TTL cache scoped to the Lambda container.
- Wrap `getWeatherForecast` (5-min TTL, key = `lat,lon,hour`) and `getLineStatuses` (60-sec TTL, key = sorted line IDs).
- Do **not** cache rail departures — live data, users want freshness.
- No external cache (no Redis/ElastiCache) — not worth the cost at single-user scale. Container reuse gives us most of the benefit.

---

## Out of scope (this plan)

- Smell 4 (multi-leg profile) — product scope stays single outbound + single return.
- Smell 6 (dynamic station data source).
- `JourneyPlannerService` and new API integrations from the review's "ideas" list — those are feature work, not modularity.
- Replacing React Query, Amplify, or the shared router.

---

## Review checkpoints

Please confirm before I proceed:

1. Sequencing OK? Yes.
2. Source-key naming `<domain>.<role>` acceptable (e.g. `rail.outbound`, `weather.origin`), or prefer structured objects over string keys? String keys OK.
3. Any smell you'd rather defer, or one I've scoped too narrowly? All good.
