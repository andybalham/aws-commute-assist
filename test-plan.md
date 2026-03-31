# Commute Dashboard — Test Plan

> **Companion documents:** `requirements.md`, `build-plan.md`

This document describes how to test the application at each layer — backend unit/integration tests, frontend manual/E2E tests, and full-stack smoke tests. It is intended as a living guide: update it as new features land.

---

## Prerequisites

| Dependency | Purpose | Install |
|------------|---------|---------|
| Node.js 20+ | Backend & frontend | — |
| Docker | DynamoDB Local | — |
| AWS CLI v2 | Table creation, deployment verification | — |
| A modern browser | Frontend manual testing / Playwright | — |

---

## 1. Backend Unit Tests

Backend unit tests live in `backend/src/__tests__/` and use Jest with mocked dependencies. They require no Docker or network access.

```bash
cd backend
npm test
```

### Test files

| File | Covers |
|------|--------|
| `profilesRepository.test.ts` | DynamoDB CRUD operations (mocked SDK) |
| `profilesController.test.ts` | Profile endpoints — validation, auth scoping, responses |
| `dashboardController.test.ts` | Dashboard assembly — parallel fan-out, per-service error isolation |
| `railService.test.ts` | Darwin SOAP parsing, time-window filtering |
| `weatherService.test.ts` | Open-Meteo response mapping, CRS → lat/lon resolution |
| `tflService.test.ts` | TfL Unified API response mapping |
| `validation.test.ts` | Profile body validation — required fields, CRS checks, time format, TfL line IDs |
| `stations.test.ts` | Station search, CRS validation, TfL line validation |

### Pass criteria

- `npm test` exits 0
- All assertions pass with no skipped tests (except integration when `DYNAMODB_ENDPOINT` is unset)

---

## 2. Backend Integration Tests (DynamoDB Local)

The integration test in `src/__tests__/integration.test.ts` exercises the full CRUD cycle against a real DynamoDB instance. It is auto-skipped when `DYNAMODB_ENDPOINT` is not set.

### Setup

```bash
# Start DynamoDB Local
docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local

# Run all tests including integration
cd backend
DYNAMODB_ENDPOINT=http://localhost:8000 npm test

# Teardown
docker stop dynamodb-local && docker rm dynamodb-local
```

### What it tests

- Table creation and teardown (unique table name per run)
- `putProfile` → `listProfiles` → `getProfile` round-trip
- `deleteProfile` removes the item
- User scoping: profiles created by user A are not visible to user B

### Pass criteria

- All CRUD operations return expected data shapes
- Cross-user isolation is enforced
- Table is cleaned up after the run

---

## 3. Frontend E2E Tests (Playwright)

Automated Playwright tests in `frontend/e2e/` cover the full profile CRUD lifecycle, form validation, station autocomplete, TfL line selection, dashboard display, and navigation. A global setup script (`e2e/global-setup.ts`) deletes any leftover profiles via the backend API before each run, ensuring tests always start from a clean state.

### Local dev stack setup

**Windows (PowerShell):**

```powershell
# Start everything (DynamoDB Local, backend, frontend) in one command:
.\Start-DevStack.ps1

# Stop everything afterwards:
.\Stop-DevStack.ps1
```

The `Start-DevStack.ps1` script:
1. Starts DynamoDB Local in Docker (idempotent — reuses existing container)
2. Waits for DynamoDB Local readiness and creates the `commute-profiles` table
3. Verifies `backend/.env` points at local DynamoDB
4. Writes `frontend/.env.local` with auth bypass + local API URL (backs up any existing file)
5. Opens backend and frontend dev servers in separate PowerShell windows

The `Stop-DevStack.ps1` script stops/removes the Docker container and restores `frontend/.env.local` from backup.

**Bash (macOS / Linux / WSL):**

```bash
# 1. Start DynamoDB Local
docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local

# 2. Create the profiles table
AWS_ACCESS_KEY_ID=fakekey AWS_SECRET_ACCESS_KEY=fakesecret \
  aws dynamodb create-table \
    --table-name commute-profiles \
    --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=profileId,AttributeType=S \
    --key-schema AttributeName=userId,KeyType=HASH AttributeName=profileId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url http://localhost:8000 \
    --region eu-west-2

# 3. Start backend (ensure backend/.env has DYNAMODB_ENDPOINT=http://localhost:8000)
cd backend
npm run dev

# 4. Start frontend with auth bypass
#    In frontend/.env.local set:
#      VITE_API_URL=http://localhost:3001
#      VITE_DEV_BYPASS_AUTH=true
cd frontend
npm run dev
```

### Running E2E tests

```bash
cd frontend
npm run test:e2e              # headed (visible browser, default)
npm run test:e2e -- --headed=false  # headless
```

### Test script

The automated tests in `frontend/e2e/commute-dashboard.spec.ts` cover the following scenarios:

#### 3.1 — Empty state

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to `http://localhost:5173/profiles` | Page loads without Cognito redirect (auth bypassed) |
| 2 | Observe profile list | Shows "No commute profiles yet. Create a profile to get started." |

#### 3.2 — Form validation

| # | Action | Expected |
|---|--------|----------|
| 1 | Click **New Profile** | Create Profile form opens with empty fields |
| 2 | Click **Create Profile** without filling anything | Inline errors appear for all 7 required fields: profile name, outbound origin, outbound destination, outbound time, return origin, return destination, return time |
| 3 | Click **Cancel** | Form closes, no profile created |

#### 3.3 — Create profile with station autocomplete

| # | Action | Expected |
|---|--------|----------|
| 1 | Click **New Profile** | Form opens |
| 2 | Type "Brighton" in outbound Origin | After ~300 ms debounce, dropdown shows "Brighton (BTN)" |
| 3 | Click "Brighton (BTN)" | Field shows "Brighton (BTN)", dropdown closes |
| 4 | Type "Victoria" in outbound Destination | Dropdown shows matches including "London Victoria (VIC)" |
| 5 | Click "London Victoria (VIC)" | Field shows "London Victoria (VIC)" |
| 6 | Observe Return Journey fields | Return origin auto-filled to "London Victoria", return destination auto-filled to "Brighton" |

#### 3.4 — TfL line selector (conditional)

| # | Action | Expected |
|---|--------|----------|
| 1 | (Continuing from 3.3) Observe form | "TfL Lines to Monitor" section is visible because destination (VIC) is a London terminus |
| 2 | Click "Victoria" and "Northern" line labels | Both checkboxes become checked, labels highlighted |
| 3 | Change outbound destination to a non-London station (e.g. Brighton) | TfL line selector disappears |
| 4 | Change outbound destination back to a London terminus | TfL line selector reappears (previously selected lines may be cleared) |

#### 3.5 — Submit profile

| # | Action | Expected |
|---|--------|----------|
| 1 | Fill profile name: "Weekday Commute" | — |
| 2 | Set outbound time: 07:30, return time: 17:45 | — |
| 3 | Select TfL lines: Victoria, Northern | — |
| 4 | Click **Create Profile** | Form closes. Profile card appears showing: name, "Outbound: BTN → VIC at 07:30", "Return: VIC → BTN at 17:45", "TfL: victoria, northern" |
| 5 | Verify via API: `curl http://localhost:3001/api/profiles` | Returns JSON array with one profile matching the submitted data |

#### 3.6 — Activate profile

| # | Action | Expected |
|---|--------|----------|
| 1 | Click **Set Active** on the profile card | "Active" badge appears next to profile name. "Set Active" button disappears. |
| 2 | Verify via API: `curl http://localhost:3001/api/profiles` | Profile has `"isActive": true` |

#### 3.7 — Edit profile

| # | Action | Expected |
|---|--------|----------|
| 1 | Click **Edit** on the profile card | "Edit Profile" form opens pre-populated with: name, station CRS codes, departure times, TfL line checkboxes (Victoria and Northern checked) |
| 2 | Change name to "Brighton to Victoria" | — |
| 3 | Click **Update Profile** | Form closes. Card now shows updated name "Brighton to Victoria". Active badge persists. |
| 4 | Verify via API | Profile name updated in DynamoDB |

#### 3.8 — Delete profile (confirmation flow)

| # | Action | Expected |
|---|--------|----------|
| 1 | Click **Delete** on the profile card | Confirmation text appears: "Click Delete again to confirm, or cancel" |
| 2 | Click **cancel** link | Confirmation text disappears, profile remains |
| 3 | Click **Delete** again | Confirmation text reappears |
| 4 | Click **Delete** a second time | Profile is removed. Page returns to empty state. |
| 5 | Verify via API: `curl http://localhost:3001/api/profiles` | Returns `[]` |

#### 3.9 — Dashboard empty state

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to `http://localhost:5173/` | Dashboard page loads with heading, three section cards (Rail, Weather, TfL) showing "No data yet" |
| 2 | Observe header | Shows "No active profile — go to Profiles to set one up." No Refresh button or profile selector visible |

#### 3.10 — Navigation and layout

| # | Action | Expected |
|---|--------|----------|
| 1 | Click "Profiles" in nav | Navigates to `/profiles` |
| 2 | Click "Dashboard" in nav | Navigates to `/` |
| 3 | Navigate to a non-existent route (e.g. `/foo`) | Redirects to `/` |

#### 3.11 — Create and activate profile for dashboard testing

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to Profiles, create a profile (Brighton → London Victoria, 07:30/17:45, Victoria + Northern TfL lines) | Profile card appears |
| 2 | Click **Set Active** | Active badge shown |

#### 3.12 — Dashboard header and controls

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to `http://localhost:5173/` | Dashboard loads with active profile data |
| 2 | Observe header | Profile name "Dashboard Test" visible, "Updated HH:MM:SS" timestamp shown, Refresh button visible |
| 3 | Click **Refresh** | Dashboard data re-fetches, timestamp updates |

#### 3.13 — Weather section with live data

| # | Action | Expected |
|---|--------|----------|
| 1 | Observe Weather section | Three forecast cards visible: "Outbound Origin", "Destination", "Return Destination" |
| 2 | Each card | Shows temperature (N°C), condition icon, precipitation probability (💧 N%), wind speed (💨 N km/h) |

#### 3.14 — Rail section structure

| # | Action | Expected |
|---|--------|----------|
| 1 | Observe Rail Departures section | "Outbound" and "Return" sub-headings visible |
| 2 | Each sub-section | Shows either train service rows (with times, platform, operator) or "No services found" depending on time of day |

#### 3.15 — TfL section with configured lines

| # | Action | Expected |
|---|--------|----------|
| 1 | Observe TfL Status section | Section heading visible |
| 2 | Line rows | "Northern" and "Victoria" lines displayed with colour pills and status text (e.g. "Good Service") |

### Teardown

**Windows (PowerShell):**

```powershell
.\Stop-DevStack.ps1
# Close the backend and frontend PowerShell windows manually (Ctrl+C)
```

**Bash:**

```bash
# Restore frontend/.env.local:
#   VITE_API_URL=https://<api-gateway-url>
#   # VITE_DEV_BYPASS_AUTH=true   (commented out)

# Stop services
docker stop dynamodb-local && docker rm dynamodb-local
# Ctrl+C the backend and frontend dev servers
```

---

## 4. Deployed Smoke Tests

Run these against the live AWS environment after each deployment. These require a real Cognito user.

### Authentication

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to the CloudFront URL | Redirected to Cognito Hosted UI |
| 2 | Sign in with test user credentials | Redirected back to app, Dashboard page loads |
| 3 | Click **Sign out** | Redirected to Cognito Hosted UI |
| 4 | `curl` the API Gateway URL without a token | Returns 401 Unauthorized |

### Profile CRUD (via UI)

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to Profiles page | Page loads (empty or with existing profiles) |
| 2 | Create a new profile | Profile persists and appears in the list |
| 3 | Activate the profile | Active badge shown |
| 4 | Edit the profile | Changes persist |
| 5 | Delete the profile | Profile removed |

### Dashboard (via UI)

| # | Action | Expected |
|---|--------|----------|
| 1 | Create and activate a profile with valid stations | — |
| 2 | Navigate to Dashboard | Rail, Weather, and (if TfL lines configured) TfL sections show live data |
| 3 | Wait 5 minutes or click refresh | Data refreshes |

### Security

| # | Check | Expected |
|---|-------|----------|
| 1 | Direct S3 bucket URL | Returns 403 |
| 2 | API request with expired/tampered JWT | Returns 401 |
| 3 | Browser devtools → Network tab | No API keys or secrets in responses |

---

## 5. Test Coverage Summary

| Area | Unit | Integration | E2E (Playwright) | Smoke (deployed) |
|------|------|-------------|------------------|-------------------|
| Profile CRUD (backend) | Yes | Yes | Yes | Yes |
| Input validation | Yes | — | Yes | — |
| Station search | Yes | — | Yes | — |
| Rail service | Yes (mocked) | — | Yes (live) | Yes |
| Weather service | Yes (mocked) | — | Yes (live) | Yes |
| TfL service | Yes (mocked) | — | Yes (live) | Yes |
| Dashboard assembly | Yes (mocked) | — | Yes (live) | Yes |
| Dashboard header & refresh | — | — | Yes | Yes |
| Dashboard empty state | — | — | Yes | — |
| Auth (Cognito) | — | — | Bypassed | Yes |
| Profile list UI | — | — | Yes | Yes |
| Profile form UI | — | — | Yes | Yes |
| Station autocomplete UI | — | — | Yes | Yes |
| TfL line selector UI | — | — | Yes | — |
| Form validation UI | — | — | Yes | — |
| Delete confirmation UI | — | — | Yes | — |
| Navigation & routing | — | — | Yes | Yes |

---

## 6. Known Gaps

- **E2E tests are not yet in CI.** Playwright tests exist in `frontend/e2e/` but require a running local dev stack (DynamoDB Local + backend + frontend). Consider adding a CI job that spins up the stack and runs `npm run test:e2e -- --headed=false`.
- **No load/performance testing.** NFR targets (< 3 s dashboard load, < 2 s Lambda cold start) are verified by manual observation only.
- **No cross-browser testing.** Manual tests run in a single Chromium instance. iOS Safari and Android Chrome are untested.
- **External API failure modes** (bad Darwin key, invalid TfL key, invalid CRS) are covered by backend unit tests with mocks but not by E2E tests against real failing APIs.

---

_End of document_
