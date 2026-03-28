# Commute Dashboard — Build Plan

> **Status:** v0.1
> **Companion document:** `requirements.md` v0.3

Each phase produces a working, testable increment. No phase requires the next to be started before it can be verified. Requirements IDs from `requirements.md` are referenced throughout.

---

## Phase 0 — Project Scaffolding

**Goal:** An empty but correctly structured repository that all three workstreams (infra, backend, frontend) can build into from day one.

### Tasks

- [x] Initialise git repository with a root `README.md`
- [x] Create the monorepo directory structure:
  ```
  commute-dashboard/
  ├── infra/
  ├── backend/
  ├── frontend/
  └── README.md
  ```
- [x] Initialise the CDK app in `infra/` (`cdk init app --language typescript`)
- [x] Initialise the backend Node.js project in `backend/` (`npm init`, install TypeScript, `ts-node`, `@types/node`)
- [x] Initialise the frontend Vite + React + TypeScript project in `frontend/` (`npm create vite@latest`)
- [x] Add root `.gitignore` covering `node_modules`, `cdk.out`, `.env`, `dist`, build artefacts
- [x] Add a root `.env.example` documenting all required environment variables (values empty)
- [x] Confirm all three subdirectories build/compile cleanly with no errors


### Verification

Running `npm install && npm run build` (or equivalent) in each of `infra/`, `backend/`, and `frontend/` produces no errors.

---

## Phase 1 — AWS Infrastructure Skeleton (CDK)

**Goal:** All AWS resources provisioned via CDK with no application logic yet. A `cdk deploy` produces a working skeleton that subsequent phases deploy into.

### Tasks

#### Cognito

- [x] Define a Cognito User Pool in CDK with email-based sign-in, no self-registration (admin-only user creation)
- [x] Define a User Pool App Client configured for the Hosted UI OAuth flow
- [x] Define a Cognito Domain for the Hosted UI
- [ ] Manually create at least one test user in the AWS Console to validate the pool _(one-off, not CDK)_

#### Storage & Database

- [x] Define an S3 bucket for frontend static assets (versioning on, public access blocked, HTTPS-only policy)
- [x] Define a CloudFront distribution fronting the S3 bucket (OAC, HTTPS only, default root object `index.html`, SPA 404→200 error response)
- [x] Define a DynamoDB table with PK `userId` (String) and SK `profileId` (String)

#### Backend Compute

- [x] Define an ECR repository for the Lambda container image
- [x] Define a Lambda function resource (container image source pointing at ECR) with a placeholder/stub image — _function will be updated in Phase 3_
- [x] Define an IAM execution role for the Lambda with least-privilege permissions: DynamoDB read/write on the profiles table, SSM Parameter Store read for secrets, CloudWatch Logs write
- [x] Define SSM Parameter Store entries (type `SecureString`) as placeholders for: Darwin API key, TfL App ID, TfL App Key

#### API Gateway

- [x] Define an HTTP API Gateway with a `/{proxy+}` route pointing to the Lambda
- [x] Define a JWT authorizer on the API Gateway referencing the Cognito User Pool
- [x] Configure CORS on the API Gateway to allow the CloudFront domain as origin

#### CDK Stack Organisation

- [x] Parameterise the CDK stack for `dev` and `prod` environments (separate stack instances, separate resource names/prefixes)
- [x] Output from CDK: CloudFront URL, API Gateway URL, Cognito User Pool ID, Cognito App Client ID, Cognito Hosted UI domain — these will be consumed by the frontend build

### Verification

- `cdk deploy` completes without errors
- CloudFront distribution is reachable (returns a 403 or blank response — no content yet, that is expected)
- API Gateway returns 401 for an unauthenticated request to any route
- Cognito Hosted UI is reachable at the configured domain
- Test user can sign in via the Hosted UI and receive a JWT

---

## Phase 2 — Backend: Project Structure & Local Dev Harness

**Goal:** A runnable backend that can be developed and tested entirely locally, with no AWS dependency. No real data yet — just the structural foundations, routing, and local dev tooling.

### Tasks

#### Project setup

- [x] Configure TypeScript (`tsconfig.json`) with strict mode, `esModuleInterop`, output to `dist/`
- [x] Install runtime dependencies: `express`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `axios`, `dotenv`
- [x] Install dev dependencies: `typescript`, `ts-node`, `nodemon`, `jest`, `ts-jest`, `@types/*`
- [x] Add npm scripts: `build`, `start` (production Lambda), `dev` (local Express runner), `test`

#### Handler & local runner

- [x] Create `src/handler.ts` — the Lambda entry point; receives `APIGatewayProxyEventV2`, extracts `userId` from the JWT claims, delegates to the router, returns a well-formed proxy response
- [x] Create `src/server.ts` — a thin Express wrapper that listens on a configurable port, injects a mock `userId` header for local dev, and calls the same router as the Lambda handler
- [x] Create `src/router.ts` — maps HTTP method + path to controller functions; shared between handler and server

#### Stub routes (no real data yet)

- [x] `GET  /health` — returns `{ status: "ok" }` (unauthenticated; useful for container health checks)
- [x] `GET  /api/profiles` — returns an empty array `[]`
- [x] `POST /api/profiles` — accepts a profile body, returns it echoed with a generated `profileId`
- [x] `PUT  /api/profiles/:profileId` — stub 200
- [x] `DELETE /api/profiles/:profileId` — stub 204
- [x] `GET  /api/dashboard` — returns a hardcoded stub payload shaped like the final dashboard response (rail, weather, TfL sections all present with placeholder data)

#### Configuration

- [x] Create `.env.example` in `backend/` documenting: `PORT`, `DYNAMODB_ENDPOINT`, `DYNAMODB_TABLE_NAME`, `DARWIN_API_KEY`, `TFL_APP_ID`, `TFL_APP_KEY`, `AWS_REGION`
- [x] Read all config from environment variables via a `src/config.ts` module; no hardcoded values anywhere else

#### Docker

- [x] Write a multi-stage `Dockerfile`: stage 1 installs all deps and compiles TypeScript; stage 2 is a lean production image using the AWS Lambda Node.js base image (`public.ecr.aws/lambda/nodejs`), copying only compiled output and production `node_modules`
- [x] Confirm `docker build` succeeds locally
- [x] Confirm the container starts and `GET /health` responds when run with `docker run` and appropriate env vars

### Verification

- `npm run dev` starts the local Express server; all stub routes return expected responses when called with a REST client
- `docker build` and `docker run` produce a working container responding on the health endpoint
- `npm test` runs (with an empty test suite) without errors — test infrastructure is confirmed working

---

## Phase 3 — Backend: Data Persistence (Profiles CRUD)

**Goal:** Commute profiles are fully persisted in DynamoDB. Works locally against DynamoDB Local and in AWS against the real table.

### Tasks

#### DynamoDB client

- [x] Create `src/db/dynamoClient.ts` — instantiates the DynamoDB Document Client; uses `DYNAMODB_ENDPOINT` env var to point at DynamoDB Local when running locally, and uses the default SDK endpoint resolution when deployed to Lambda
- [x] Create `src/db/profilesRepository.ts` — encapsulates all DynamoDB operations: `listProfiles(userId)`, `getProfile(userId, profileId)`, `putProfile(profile)`, `deleteProfile(userId, profileId)`

#### Profile controller

- [x] Implement `src/controllers/profilesController.ts` replacing the stubs from Phase 2:
  - `GET  /api/profiles` — fetch all profiles for the authenticated user
  - `POST /api/profiles` — validate body, generate UUID `profileId`, write to DynamoDB, return created profile
  - `PUT  /api/profiles/:profileId` — validate body, update item, return updated profile
  - `DELETE /api/profiles/:profileId` — delete item, return 204
- [x] Enforce that a user can only read/write their own profiles (always scope DynamoDB queries to the JWT `userId`)
- [x] Implement `PATCH /api/profiles/:profileId/activate` — sets `isActive: true` on the target profile and `isActive: false` on all others for that user (atomic via DynamoDB transactions or sequential writes)

#### Station lookup

- [x] Create `src/data/stations.ts` — a static map of CRS code → `{ name, lat, lon }` covering all National Rail stations (sourced from a community-maintained dataset, e.g., the RDG open data station list)
- [x] Expose a `GET /api/stations?q=<query>` endpoint that searches the static list by name or CRS prefix and returns up to 10 matches — used by the frontend station autocomplete (CFG-04)

#### Input validation

- [x] Validate all incoming profile bodies (required fields, CRS codes exist in the station lookup, departure times are valid HH:MM strings, `tflLines` is an array of known TfL line IDs)
- [x] Return structured `400` responses with field-level error details for invalid input

#### Tests

- [x] Unit tests for `profilesRepository.ts` using a mocked DynamoDB Document Client
- [x] Unit tests for `profilesController.ts` using a mocked repository
- [x] Integration test: spin up DynamoDB Local in Docker as part of the test run, exercise the full CRUD cycle end-to-end

### Verification

- `npm run dev` + DynamoDB Local: full CRUD cycle works against a real local database
- All profiles endpoints return appropriate responses for valid and invalid inputs
- `npm test` passes including the DynamoDB Local integration test
- Profiles are correctly scoped to `userId`; a request with a different mock `userId` cannot read or modify another user's data

---

## Phase 4 — Backend: External Data Services

**Goal:** The three external data services (rail, weather, TfL) are implemented as isolated, testable modules behind a clean interface. The `/api/dashboard` endpoint returns real data.

### Tasks

#### Weather service (Open-Meteo)

- [x] Create `src/services/weatherService.ts`
- [x] Implement `getWeatherForecast(crs: string, isoDateTime: string): Promise<WeatherSummary>` which: resolves CRS to coordinates via the stations lookup, calls the Open-Meteo hourly forecast API for the target date/time, extracts temperature, precipitation probability, wind speed, and WMO weather code mapped to a human-readable condition string
- [x] Define the `WeatherSummary` response type in `src/types/`
- [x] Unit tests with mocked HTTP responses for known Open-Meteo payloads

#### Rail service (Darwin OpenLDBWS)

- [x] Create `src/services/railService.ts`
- [x] Darwin OpenLDBWS is a SOAP API — install `soap` npm package (or use `axios` with raw XML and a lightweight SOAP envelope helper)
- [x] Implement `getDepartures(originCRS: string, destinationCRS: string, targetTime: string): Promise<DepartureSummary>` which: calls `GetDepartureBoardWithDetails`, filters results to a ±30-minute window around `targetTime`, maps each service to the `TrainService` type (scheduled time, expected time, platform, operator, calling points, status flag)
- [x] Implement `getServiceMessages(crs: string): Promise<string[]>` which calls `GetStationMessages` for the origin station
- [x] Define `DepartureSummary` and `TrainService` types in `src/types/`
- [x] Darwin API key is read from `config.ts` (which reads from env / SSM); never hardcoded
- [x] Unit tests with mocked SOAP responses

#### TfL service

- [x] Create `src/services/tflService.ts`
- [x] Implement `getLineStatuses(lineIds: string[]): Promise<TflLineSummary[]>` which calls `GET /Line/{ids}/Status` on the TfL Unified API and maps each line to `{ lineId, lineName, status, reason }`
- [x] Define `TflLineSummary` type in `src/types/`
- [x] TfL App ID and key read from `config.ts`
- [x] Unit tests with mocked HTTP responses

#### Dashboard controller

- [x] Create `src/controllers/dashboardController.ts`
- [x] Implement `GET /api/dashboard`: fetch the user's active profile from DynamoDB; fan out in parallel (`Promise.all`) to rail (outbound), rail (return), weather (3 calls), and TfL (if lines configured); assemble and return a single `DashboardResponse` payload
- [x] Each service call shall be independently error-handled: a failure in one service populates that section's `error` field in the response rather than failing the whole request (NFR-05)
- [x] Define `DashboardResponse` type covering all sections with optional `error` strings per section
- [x] Unit tests for the dashboard controller with all services mocked

### Verification

- `GET /api/dashboard` with a real active profile and live API credentials returns a fully populated response
- If one service is deliberately broken (e.g., bad API key), only that section returns an error; the rest of the response is populated normally
- All service modules pass their unit tests with mocked data
- `npm test` passes in full

---

## Phase 5 — Frontend: Shell, Auth & Routing

**Goal:** A deployable React app with Cognito authentication wired up, protected routing, and the page skeleton in place. No real data displayed yet.

### Tasks

#### Project configuration

- [ ] Install and configure Tailwind CSS (`tailwind.config.js`, `postcss.config.js`, import in `index.css`)
- [ ] Install AWS Amplify JS: `aws-amplify`
- [ ] Create `src/amplify-config.ts` — reads Cognito User Pool ID, App Client ID, Hosted UI domain, and API Gateway URL from Vite environment variables (`import.meta.env.VITE_*`)
- [ ] Create `.env.local` (gitignored) and `.env.local.example` documenting all required `VITE_*` variables
- [ ] Call `Amplify.configure()` in `main.tsx` before rendering the app

#### Authentication

- [ ] Wrap the app in an Amplify Authenticator component configured to use the Cognito Hosted UI redirect flow
- [ ] Implement sign-out: a button available from any page that calls `Auth.signOut()` and redirects to the login page
- [ ] Handle the OAuth callback redirect from the Hosted UI (`/callback` route or Amplify's built-in handler)
- [ ] Ensure all React Query API calls automatically attach the Cognito `idToken` as a `Bearer` token in the `Authorization` header via a shared Axios instance or React Query default options
- [ ] Confirm unauthenticated users are redirected to the Hosted UI login (AUTH-04)

#### Routing

- [ ] Install `react-router-dom`
- [ ] Define routes:
  - `/` → Dashboard page (protected)
  - `/profiles` → Profile management page (protected)
  - `/callback` → Auth callback handler
  - `*` → redirect to `/`
- [ ] Create a `ProtectedRoute` component that checks Amplify auth state and redirects to login if unauthenticated

#### Page shells (no data yet)

- [ ] `DashboardPage` — renders a header, a profile selector placeholder, and three empty section cards: Rail, Weather, TfL
- [ ] `ProfilesPage` — renders a header and an empty profile list placeholder
- [ ] Shared `Layout` component with top navigation (app title, active page indicator, sign-out button)

#### API client

- [ ] Create `src/api/apiClient.ts` — an Axios instance with the API Gateway base URL and a request interceptor that fetches the current Amplify session token and injects it as a `Bearer` auth header
- [ ] Create `src/api/dashboardApi.ts` — `fetchDashboard(): Promise<DashboardResponse>`
- [ ] Create `src/api/profilesApi.ts` — `fetchProfiles()`, `createProfile()`, `updateProfile()`, `deleteProfile()`, `activateProfile()`, `searchStations()`

### Verification

- `npm run dev` starts the Vite dev server
- Navigating to `/` redirects unauthenticated users to the Cognito Hosted UI
- After sign-in, the user is redirected back to the app and sees the page shells
- Sign-out works and returns the user to the Hosted UI login
- API calls include a valid `Authorization` header (visible in browser devtools network tab)
- Direct navigation to `/profiles` is protected; unauthenticated access redirects to login

---

## Phase 6 — Frontend: Profile Management UI

**Goal:** Users can create, edit, delete, and activate commute profiles through the UI. Station autocomplete works. TfL line selection appears conditionally. Data is persisted to DynamoDB via the backend.

### Tasks

#### Profile list

- [ ] Fetch profiles via React Query (`useQuery`) on page load
- [ ] Display each profile as a card showing name, outbound leg summary, return leg summary, and active status badge
- [ ] "Set active" button calls `PATCH /api/profiles/:id/activate` and invalidates the profiles query
- [ ] "Edit" button opens the profile form pre-populated with the profile's data
- [ ] "Delete" button shows a confirmation prompt then calls `DELETE /api/profiles/:id`

#### Profile form (create & edit)

- [ ] Form fields: profile name, outbound origin station, outbound destination station, outbound departure time (HH:MM picker), return departure time (HH:MM picker)
- [ ] Station inputs use a debounced autocomplete component that calls `GET /api/stations?q=` and renders a dropdown of matches (CFG-04)
- [ ] TfL line multi-select: rendered only when the destination station is a London terminus (CFG-08); displays all available TfL line options (hardcoded list of line IDs + display names) as a checkbox group
- [ ] Client-side validation mirrors backend validation rules; inline error messages per field
- [ ] On submit, calls `POST /api/profiles` (create) or `PUT /api/profiles/:id` (edit); invalidates the profiles query on success
- [ ] Loading and error states handled for all async operations

### Verification

- Full CRUD cycle works end-to-end through the UI against the live backend
- Station autocomplete returns results and populates the field correctly
- TfL line selector appears only for London terminus destinations
- Activating a profile marks it active and deactivates others
- Form validation prevents submission of incomplete or invalid profiles
- All operations reflect correctly in the UI without a full page reload

---

## Phase 7 — Frontend: Dashboard UI

**Goal:** The dashboard displays real rail, weather, and TfL data for the active profile. Error states, loading states, and auto-refresh are all implemented.

### Tasks

#### Data fetching

- [ ] Fetch dashboard data via React Query (`useQuery`) with a 5-minute `staleTime` and `refetchInterval` (DASH-03)
- [ ] Show a loading skeleton for each section card while data is in flight
- [ ] Show a per-section error state if the API response includes an `error` field for that section (DASH-04, NFR-05)

#### Rail section

- [ ] Display outbound and return departure boards as separate sub-sections
- [ ] Each service row shows: scheduled time, expected time (highlighted if delayed/cancelled), platform, operator, and calling points summary (RAIL-03)
- [ ] Status badge: green "On Time", amber "Delayed", red "Cancelled" (RAIL-04)
- [ ] Disruption/service messages rendered prominently above the departure list if present (RAIL-05)

#### Weather section

- [ ] Three weather cards: outbound origin, destination at arrival, return origin (WX-01, WX-02, WX-03)
- [ ] Each card shows condition icon (mapped from WMO code), temperature, precipitation probability, wind speed (WX-04)

#### TfL section

- [ ] Rendered only when the active profile has TfL lines configured (TFL-01)
- [ ] One status row per configured line: line colour pill, line name, status text, reason text if present (TFL-02, TFL-03)

#### Dashboard header

- [ ] Profile name and active profile selector (dropdown to switch active profile inline without navigating to the profiles page)
- [ ] "Last refreshed" timestamp (DASH-02)
- [ ] Manual refresh button that triggers a React Query refetch (DASH-02)

#### Responsive layout

- [ ] Desktop (≥1024px): Rail, Weather, TfL sections displayed in a multi-column grid
- [ ] Tablet (768px–1023px): two-column layout, TfL below
- [ ] Mobile (<768px): single column, sections stacked; departure board rows condensed (NFR-07, DASH-05)

### Verification

- Dashboard displays real data for the active profile end-to-end
- Each section degrades gracefully to an error card if its service fails
- Auto-refresh fires every 5 minutes (observable via network tab)
- Manual refresh button triggers an immediate refetch
- Layout is correct and usable at 375px, 768px, 1024px, and 1440px viewports
- Switching active profile from the dashboard header reloads dashboard data for the new profile

---

## Phase 8 — Deployment Pipeline

**Goal:** A single command (or triggered CI step) builds the container, pushes to ECR, deploys the Lambda, builds the frontend, and syncs to S3/invalidates CloudFront. The live application is fully functional end-to-end.

### Tasks

#### Backend deployment

- [ ] Write a `deploy-backend.sh` script (or npm script) that: runs `docker build`, tags the image with the ECR repository URI + a version tag (e.g., git SHA), runs `docker push` to ECR, and calls `aws lambda update-function-code` to point the Lambda at the new image
- [ ] Confirm the Lambda cold-start time is within the NFR-02 target (<2 s) — test by invoking immediately after an update
- [ ] Store all secrets (Darwin key, TfL keys) in SSM Parameter Store (`SecureString`); confirm the Lambda reads them correctly at startup via `config.ts`

#### Frontend deployment

- [ ] Write a `deploy-frontend.sh` script (or npm script) that: injects the CDK stack outputs (`VITE_*` env vars) into the Vite build environment, runs `npm run build`, syncs `dist/` to the S3 bucket (`aws s3 sync`), and creates a CloudFront invalidation for `/*`
- [ ] Confirm the deployed frontend loads, authenticates via the Hosted UI, and displays live dashboard data

#### CDK finalisation

- [ ] Review all CDK constructs for production readiness: deletion policies on DynamoDB (retain), S3 (retain), log retention on Lambda
- [ ] Confirm `cdk diff` shows no unexpected drift between local definition and deployed stack
- [ ] Tag all CDK resources with project and environment tags

#### Smoke test checklist

- [ ] Sign in via Hosted UI ✓
- [ ] Create a commute profile ✓
- [ ] Activate the profile ✓
- [ ] Dashboard loads with real rail, weather, and (if applicable) TfL data ✓
- [ ] Sign out ✓
- [ ] Unauthenticated access to `/` redirects to login ✓
- [ ] Unauthenticated API call returns 401 ✓

### Verification

Full smoke test checklist passes against the deployed production environment.

---

## Phase 9 — Hardening & Polish

**Goal:** Production-quality resilience, error handling, and UX polish. No new features — consolidation only.

### Tasks

#### Resilience

- [ ] Add request timeouts to all outbound HTTP calls in the backend services (default: 5 s)
- [ ] Add structured error logging in the Lambda handler (log `userId`, route, error type, and upstream status code — no PII, no API keys)
- [ ] Test each external API failure mode manually (kill the Darwin key, use an invalid TfL key, pass an invalid CRS) and confirm the dashboard degrades gracefully per NFR-05

#### Security review

- [ ] Confirm no secrets appear in CloudWatch logs, S3 objects, CloudFront responses, or browser network responses
- [ ] Confirm S3 bucket is not publicly accessible (direct S3 URL returns 403)
- [ ] Confirm API Gateway rejects a request with an expired or tampered JWT
- [ ] Confirm CORS rejects requests from origins other than the CloudFront domain

#### UX polish

- [ ] Favicon and page `<title>` set appropriately
- [ ] Loading states are smooth (skeleton loaders rather than spinners where possible)
- [ ] Empty states: "No active profile — go to Profiles to set one up" shown on dashboard if no active profile exists
- [ ] All interactive elements are keyboard accessible and have appropriate focus styles
- [ ] Test on iOS Safari and Android Chrome in addition to desktop browsers

#### Documentation

- [ ] Complete `README.md` at the repo root covering: project overview, prerequisites, local dev setup instructions, environment variable reference, deployment steps
- [ ] Add inline JSDoc comments to all backend service public functions
- [ ] Document the CRS-to-coordinates station lookup data source and how to update it

### Verification

- All resilience failure modes produce correct partial-data responses
- Security review checklist passes
- Application is fully usable via keyboard on desktop
- README instructions produce a working local dev environment when followed from scratch on a clean machine

---

## Phase Summary

| Phase | Focus                  | Key Deliverable                                              |
| ----- | ---------------------- | ------------------------------------------------------------ |
| 0     | Scaffolding            | Repo structure, all three projects initialised and compiling |
| 1     | Infra skeleton         | All AWS resources provisioned via CDK; auth flow reachable   |
| 2     | Backend foundations    | Local dev harness, stub routes, Docker build working         |
| 3     | Profiles persistence   | Full CRUD against DynamoDB; station autocomplete data        |
| 4     | External data services | Rail, weather, TfL services; real dashboard endpoint         |
| 5     | Frontend shell & auth  | React app, Cognito Hosted UI sign-in, protected routing      |
| 6     | Profile management UI  | Create/edit/delete/activate profiles; station autocomplete   |
| 7     | Dashboard UI           | Live data displayed; responsive layout; error/loading states |
| 8     | Deployment pipeline    | Build + push + deploy scripts; live end-to-end smoke test    |
| 9     | Hardening & polish     | Resilience, security review, UX polish, documentation        |

---

## Suggested Build Order Notes

Phases 0–2 can be worked largely in parallel once Phase 0 is done — the CDK skeleton (Phase 1) and the backend local dev harness (Phase 2) have no dependency on each other. Phase 3 depends on Phase 2. Phase 4 depends on Phase 3. Phase 5 can begin as soon as Phase 1 is complete (it only needs Cognito to exist). Phases 6 and 7 depend on their respective backend phases (3 and 4) being reachable but do not need the backend to be fully deployed — the frontend can point at the local Express runner during development.

---

_End of document — v0.1_
