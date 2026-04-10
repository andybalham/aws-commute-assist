# Commute Dashboard — Claude Code Guide

## Project Overview

A personal commute dashboard web app that surfaces UK National Rail departures, weather forecasts, and TfL line statuses for a configured commute. Deployed entirely on AWS; access restricted via Amazon Cognito.

See `requirements.md` for full functional/non-functional requirements and `build-plan.md` for the phased delivery plan.

## Repository Structure

```
commute-dashboard/
├── infra/          # AWS CDK app (TypeScript) — all AWS resources
├── backend/        # Lambda container (Node.js / TypeScript)
│   ├── src/
│   │   ├── handler.ts      # Lambda entry point
│   │   ├── server.ts       # Local Express runner (dev only)
│   │   ├── router.ts       # Shared route mapping
│   │   ├── config.ts       # All env-var config in one place
│   │   ├── controllers/
│   │   ├── services/       # rail.ts, weather.ts, tfl.ts
│   │   ├── db/             # DynamoDB client + profilesRepository
│   │   ├── data/           # stations.ts (static CRS lookup)
│   │   └── types/
│   ├── deploy.mjs           # Backend deploy script (npm run deploy)
│   └── Dockerfile
├── Deploy.ps1          # PowerShell: full build & deploy (infra → backend → frontend)
├── Start-DevStack.ps1  # PowerShell: start local dev stack for E2E testing
├── Stop-DevStack.ps1   # PowerShell: tear down local dev stack
└── frontend/       # React + Vite + TypeScript SPA
    ├── deploy.mjs           # Frontend deploy script (npm run deploy)
    ├── e2e/                # Playwright E2E tests
    │   ├── commute-dashboard.spec.ts  # Full test suite (sections 3.1–3.10)
    │   └── global-setup.ts            # Cleans profiles before each run
    ├── playwright.config.ts
    └── src/
        ├── api/            # apiClient.ts, dashboardApi.ts, profilesApi.ts, types.ts
        ├── components/     # Layout.tsx, ProtectedRoute.tsx, ProfileCard.tsx, ProfileForm.tsx, StationAutocomplete.tsx, TflLineSelector.tsx
        ├── hooks/          # useAuth.ts
        ├── pages/          # DashboardPage.tsx, ProfilesPage.tsx
        └── amplify-config.ts
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React (latest stable), TypeScript, Vite, Tailwind CSS |
| Auth (frontend) | AWS Amplify JS — Cognito Hosted UI |
| State / data fetching | React Query (server state), Zustand or Context (local) |
| Backend | Node.js, TypeScript, single Lambda container image |
| API | Amazon API Gateway (HTTP API) + JWT authorizer |
| Database | Amazon DynamoDB |
| Infrastructure | AWS CDK (TypeScript) in `infra/` |
| Container registry | Amazon ECR |

## Key Conventions

### Backend

- All configuration is read from environment variables via `src/config.ts`. No hardcoded values elsewhere.
- The Lambda handler (`handler.ts`) and the local Express runner (`server.ts`) share the same router — business logic is never duplicated.
- DynamoDB operations are isolated in `src/db/profilesRepository.ts`; controllers never import the AWS SDK directly.
- All DynamoDB queries are scoped to the authenticated `userId` — a user must never be able to read or modify another user's data.
- External API calls (rail, weather, TfL) each live in their own service module under `src/services/`. Each service is independently error-handled; a failure in one must not fail the whole dashboard response.
- Secrets (Darwin API key, TfL keys) are stored in SSM Parameter Store and read at Lambda startup. They must never appear in logs, source code, or build artefacts.
- **darwin-ldb-node bug:** The `darwin-ldb-node` library crashes with "Cannot read properties of undefined (reading 'service')" when the Darwin API returns no train services for a query (e.g., no services between those stations at that time). The library tries to access `result.trainServices.service` without a null check. `railService.ts` catches this specific error and returns an empty services array instead of propagating the crash.
- **Outbound HTTP timeouts:** All outbound calls have a 5 s timeout. Open-Meteo and TfL use axios `timeout: 5000`. Darwin SOAP via `darwin-ldb-node` exposes no abort hook, so `railService.ts` wraps calls in a `withTimeout()` Promise.race helper. Note: the underlying SOAP call cannot be cancelled — the helper only unblocks the caller, the request may still complete in the background. This is acceptable in Lambda since the container is reused.
- **Structured logging in `handler.ts`:** The Lambda handler emits a single-line JSON log per request via `logEvent()` — fields are `timestamp`, `level`, `userId` (Cognito `sub`), `method`, `path`, `statusCode`, `durationMs`, and on error `errorType` / `errorMessage` / `upstreamStatus`. Never add request bodies, query strings, headers, or anything beyond the Cognito `sub` to these logs — the `sub` is opaque and not PII, but other fields can be. CloudWatch Logs Insights can `parse @message` directly.
- **dotenv log noise:** `dotenv@17.x` prints a different "tip" message (with an emoji) on every Lambda init. These are harmless but pollute the log group, and the emoji can break naive log scanners. When grepping for secrets, exclude lines containing `[dotenv@`.

### Frontend

- All `VITE_*` environment variables are defined in `.env.local` (gitignored); `.env.local.example` documents them.
- The shared Axios instance in `src/api/apiClient.ts` attaches the Cognito `idToken` as a `Bearer` header on every request via a request interceptor that calls `fetchAuthSession()` from Amplify.
- Unauthenticated users are always redirected to the Cognito Hosted UI — no custom login page. The `ProtectedRoute` component checks auth state and calls `signInWithRedirect()` in a `useEffect` (not during render — React StrictMode double-renders break inline side effects).
- Amplify is configured in `src/amplify-config.ts` and called in `main.tsx` before the React tree renders.
- React Query (`@tanstack/react-query`) is the data-fetching layer; the `QueryClientProvider` wraps the app in `main.tsx`.
- Routing uses `react-router-dom` with a `Layout` component (nav + `<Outlet />`) nested under `ProtectedRoute`.
- Tailwind CSS v4 is used via the `@tailwindcss/vite` plugin — no `tailwind.config.js` or `postcss.config.js` needed; `index.css` uses `@import "tailwindcss"`.
- The `StationAutocomplete` component uses a 300 ms debounce on the search query before calling the backend `/api/stations?q=` endpoint. It closes the dropdown on outside clicks via a `mousedown` event listener.
- The `TflLineSelector` component and `isLondonTerminus()` helper live in `TflLineSelector.tsx`. London terminus CRS codes are hardcoded in the frontend — if new termini are added, update the `LONDON_TERMINI` set there.
- The `ProfileForm` auto-mirrors outbound origin/destination to return destination/origin via explicit setter functions (not `useEffect`) to avoid stale state and unnecessary re-renders.
- Profile CRUD mutations in `ProfilesPage` invalidate both `['profiles']` and `['dashboard']` query keys where appropriate so the UI stays consistent after activating a profile.
- The `profilesApi` create/update functions expect `isActive` in the payload (`Omit<CommuteProfile, 'userId' | 'profileId' | 'createdAt' | 'updatedAt'>`). The form always sends `isActive: false`; activation is handled separately via the activate endpoint.
- **Playwright selectors:** Form labels (`<label>`) in `ProfileForm`, `StationAutocomplete`, and `TflLineSelector` do not use `htmlFor` — Playwright's `getByLabel()` will not find the associated inputs. Use `getByPlaceholder()`, `locator('input[type="time"]')`, or `getByRole('checkbox', { name })` instead. TfL checkboxes are `sr-only` (visually hidden) and require `{ force: true }` for direct interaction.
- The `DashboardPage` fetches data via React Query with `staleTime` and `refetchInterval` both set to 5 minutes for auto-refresh. It also fetches the profiles list to power the inline profile-switcher dropdown in the header.
- The dashboard empty state (no active profile) preserves "No data yet" text in three section cards — the E2E test in `3.9` asserts this text appears at least 3 times, so it must not be removed.
- TfL line colours are duplicated in `DashboardPage.tsx` (for the colour pills) and `TflLineSelector.tsx` (for the checkboxes). If new lines are added, update both.
- WMO weather condition strings from the backend are mapped to emoji icons via substring matching in `weatherIcon()`. This is intentionally loose — the backend's human-readable condition strings may vary, so the mapping checks for keywords like "rain", "clear", "snow" rather than exact matches.
- The dashboard layout uses a `lg:grid-cols-3` grid where Rail spans 2 columns (`lg:col-span-2`) and Weather + TfL stack in the right column. On mobile/tablet it collapses to a single column. The TfL section is conditionally rendered only when the profile has TfL lines configured.
- The backend returns HTTP 404 when no active profile exists. The dashboard detects "no active profile" by checking the profiles list rather than relying on the 404, so the empty state renders without a failed network request flash.
- **Global keyboard focus ring:** `index.css` defines a single `:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }` rule. Tailwind v4 strips the default browser outline, so this restores a consistent indicator across all interactive elements without spamming `focus:` utilities on every component. It only fires on keyboard focus, not mouse clicks.

### Infrastructure

- The CDK stack is named `CommuteDashboard-<env>` (e.g., `CommuteDashboard-dev`, `CommuteDashboard-prod`). This is the CloudFormation stack name used in all `aws cloudformation` commands and deploy scripts.
- All AWS resources are defined as CDK constructs in `infra/`; no manual console provisioning (Cognito user creation excepted).
- CDK stacks are parameterised for `dev` and `prod` environments.
- S3 bucket has public access blocked; CloudFront is the only public entry point.
- Lambda execution role follows least-privilege (DynamoDB on the profiles table only, SSM read for secrets, CloudWatch Logs write).

## External APIs

| Service | API | Auth |
|---------|-----|------|
| UK rail live departures | National Rail Darwin OpenLDBWS (SOAP) | Darwin API key — SSM |
| Weather forecast | Open-Meteo (`api.open-meteo.com`) | None |
| TfL line status | TfL Unified API (`api.tfl.gov.uk`) | App ID + key — SSM |

Station CRS codes are resolved to lat/lon via a static lookup table in `src/data/stations.ts`.

## Local Development

```bash
# Backend (with DynamoDB Local)
cd backend
cp .env.example .env        # fill in local values
npm install
npm run dev                 # starts Express on configured PORT

# Frontend
cd frontend
cp .env.local.example .env.local   # fill in VITE_* values (see below)
npm install
npm run dev                 # starts Vite dev server on http://localhost:5173

# Run backend tests (unit tests only — no Docker required)
cd backend
npm test

# Run backend tests including DynamoDB Local integration tests
docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local
DYNAMODB_ENDPOINT=http://localhost:8000 npm test
docker stop dynamodb-local && docker rm dynamodb-local

# Run frontend E2E tests (requires local dev stack running — see below)
cd frontend
npm run test:e2e              # headed (visible browser)
npm run test:e2e -- --headed=false  # headless
```

### Local Dev Stack for E2E Tests

The Playwright E2E tests require the full local stack: DynamoDB Local, backend, and frontend (with auth bypass).

**Windows (PowerShell) — one command:**

```powershell
.\Start-DevStack.ps1          # starts everything, opens servers in new windows
# run tests...
.\Stop-DevStack.ps1           # stops DynamoDB, restores .env.local
```

**Bash — manual steps:** see `test-plan.md` section 3 for the full setup.

The Playwright global setup (`e2e/global-setup.ts`) automatically deletes any leftover profiles before each run, ensuring tests always start from a clean state.

### Stale Node Processes on Windows

On Windows, stopping `nodemon` or closing a terminal window does not always kill the underlying `node` process. A stale process can hold a port (e.g., 3001) so that a new server start **silently fails to bind** — `curl` then hits the zombie process running old code, producing confusing errors with no log output from your latest changes.

To check and fix:

```powershell
# Find what owns the port
Get-NetTCPConnection -LocalPort 3001 | Select-Object OwningProcess
# See the command line
Get-CimInstance Win32_Process -Filter 'ProcessId=<PID>' | Select-Object CommandLine
# Kill it
Stop-Process -Id <PID> -Force
```

`Stop-DevStack.ps1` should handle this, but if you started the backend manually outside the script, check for orphaned processes when behaviour seems stale.

### Frontend Environment Variables

The frontend requires these `VITE_*` variables in `frontend/.env.local`:

| Variable | Source | Example |
|----------|--------|---------|
| `VITE_COGNITO_USER_POOL_ID` | CDK output `UserPoolId` | `eu-west-2_AbCdEfG` |
| `VITE_COGNITO_APP_CLIENT_ID` | CDK output `UserPoolClientId` | `7aha5grp...` |
| `VITE_COGNITO_DOMAIN` | CDK output `CognitoDomain` | `commute-dev-auth.auth.eu-west-2.amazoncognito.com` |
| `VITE_API_URL` | CDK output `ApiUrl` | `https://abc123.execute-api.eu-west-2.amazonaws.com` |
| `VITE_REDIRECT_URL` | Cognito callback URL | `http://localhost:5173/callback` (dev) or `https://<cloudfront>/callback` (prod) |

To retrieve CDK outputs:

```bash
aws cloudformation describe-stacks --stack-name CommuteDashboard-dev --query "Stacks[0].Outputs" --output table
```

### Cognito OAuth Callback URLs

The CDK stack configures the Cognito App Client with both production and local dev callback/logout URLs. The `VITE_REDIRECT_URL` must exactly match one of the allowed callback URLs in Cognito — including the `/callback` path. The CDK already allows:

- **Callback:** `https://<cloudfront>/callback` and `http://localhost:5173/callback`
- **Logout:** `https://<cloudfront>` and `http://localhost:5173`

If you change the dev server port or add a new deployment URL, update both the CDK (`infra/lib/infra-stack.ts` → `oAuth.callbackUrls` / `logoutUrls`) and redeploy.

## Build & Deploy

### One-command deploy (recommended)

`Deploy.ps1` runs all three phases sequentially, stopping on the first failure:

```powershell
.\Deploy.ps1                              # deploy all (dev)
.\Deploy.ps1 -Env prod                    # deploy all (prod)
.\Deploy.ps1 -Only backend               # infra + backend only
.\Deploy.ps1 -Only frontend              # infra + frontend only
.\Deploy.ps1 -Only backend -SkipInfra    # backend only (skip CDK)
.\Deploy.ps1 -Only frontend -SkipInfra   # frontend only (skip CDK)
```

| Parameter | Description |
|-----------|-------------|
| `-Env` | Target environment: `dev` (default) or `prod` |
| `-Only` | Deploy a single layer: `backend` or `frontend`. Infra still runs first unless `-SkipInfra` is set |
| `-SkipInfra` | Skip the CDK infrastructure phase. Useful when only code has changed |

The script automatically resolves `CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION` from the AWS CLI before running CDK. Colour-coded output shows progress (cyan), successes (green), and step details (yellow).

### Manual deploy (individual steps)

```bash
# Infrastructure
cd infra
npm run build
cdk deploy --all            # defaults to dev; use -c env=prod for production

# Backend (after CDK deploy)
cd backend
npm run deploy              # docker build → ECR push → lambda update-function-code
npm run deploy:prod         # same, targeting prod environment

# Frontend (after CDK deploy — injects CDK outputs as VITE_* vars)
cd frontend
npm run deploy              # vite build → s3 sync → cloudfront invalidation
npm run deploy:prod         # same, targeting prod environment
```

### How the deploy scripts work

Both `backend/deploy.mjs` and `frontend/deploy.mjs` are Node.js scripts (no bash/shell dependency) that follow the same pattern:

1. Read CDK stack outputs from CloudFormation (stack name derived from env: `CommuteDashboard-dev` / `CommuteDashboard-prod`)
2. Parse the JSON outputs natively in Node.js
3. Perform the deployment steps (build, push, update) via `child_process.execSync`

The scripts are invoked via npm scripts (`npm run deploy` / `npm run deploy:prod`) which call `node deploy.mjs <env>`. A root `package.json` provides convenience scripts to deploy both backend and frontend together.

### AWS credentials and CDK account resolution

CDK resolves the AWS account and region from `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` environment variables, which it normally populates from the AWS CLI's default profile. If these aren't set, CDK fails with "Unable to resolve AWS account to use."

`Deploy.ps1` handles this automatically. For manual deploys, ensure `aws sts get-caller-identity` succeeds before running `cdk deploy`.

**AWS CLI on Windows / Git Bash gotchas:** Two unrelated issues bite when running `aws` commands from Git Bash on Windows:

1. **Path conversion mangles log group names.** Git Bash's MSYS path translation rewrites arguments that look like Unix paths — so `--log-group-name /aws/lambda/commute-dev-backend` becomes `C:/Program Files/Git/aws/lambda/commute-dev-backend`, and the AWS CLI rejects it with `InvalidParameterException`. Prefix the command with `MSYS_NO_PATHCONV=1` to disable conversion for that one call.

2. **`charmap` codec errors on emoji output.** AWS CLI v2 on Windows defaults to the legacy `cp1252` console encoding, so any output containing emoji (e.g. the `🔐` characters in dotenv tip messages from CloudWatch Logs) crashes with `'charmap' codec can't encode character '\U0001f510'`. The CLI fails to write *anything*, even though the data itself is fine. Set `PYTHONUTF8=1` (or `PYTHONIOENCODING=utf-8`) to force UTF-8 output.

Combined example for CloudWatch log scanning:

```bash
PYTHONUTF8=1 MSYS_NO_PATHCONV=1 aws logs filter-log-events \
  --log-group-name /aws/lambda/commute-dev-backend \
  --max-items 200 --query "events[].message" --output json
```

**Stale credentials after `aws login`:** If `aws login` fails with "Profile 'default' is already configured with Access Key credentials", the default profile has leftover access keys that conflict with the browser-based login flow. Fix by clearing them:

```powershell
aws configure set aws_access_key_id "" --profile default
aws configure set aws_secret_access_key "" --profile default
```

Or edit `~\.aws\credentials` directly and remove the `[default]` section's access key lines. Then retry `aws login`.

### CDK resource tags and log retention

All CDK resources are tagged with `Project: commute-dashboard` and `Environment: <env>`. Lambda log groups are configured with 1-month retention (previously defaulted to infinite). Deletion policies for DynamoDB, S3, ECR, and Cognito are all set to `RETAIN`.

### Docker Image Requirements

When building Docker images for the Lambda container (backend), you **must** use `--provenance=false` to force Docker V2 Schema 2 manifests. Newer Docker Desktop versions default to OCI manifests, which AWS Lambda does not support. Without this flag, `cdk deploy` will fail with:

> "The image manifest, config or layer media type for the source image ... is not supported."

Example:

```bash
docker build --platform linux/amd64 --provenance=false -t commute-dev-backend .
```

### Testing the Lambda Container Locally (RIE)

The AWS Lambda base image (`public.ecr.aws/lambda/nodejs:20`) bundles the **Lambda Runtime Interface Emulator (RIE)**. When you `docker run` the container outside of AWS, the RIE starts automatically and simulates the Lambda invocation API on port 8080.

This is different from `npm run dev` (Express): instead of normal HTTP requests, you POST a JSON event matching the `APIGatewayProxyEventV2WithJWTAuthorizer` shape to the RIE endpoint. The RIE feeds this to your handler and returns the handler's response. JWT validation does **not** happen here — that's an API Gateway concern in AWS. The RIE simply passes through whatever claims you include in the event.

Use this to validate the built container works before pushing to ECR.

```bash
# Build
docker build --platform linux/amd64 --provenance=false -t commute-dev-backend .

# Run (maps container port 8080 → host port 9000)
docker run -d --name commute-test -p 9000:8080 commute-dev-backend

# Invoke the handler with a mock API Gateway event
curl -s -X POST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d '{
    "rawPath": "/health",
    "requestContext": {
      "http": { "method": "GET" },
      "authorizer": { "jwt": { "claims": { "sub": "test-user" } } }
    }
  }'
# → {"statusCode":200,"headers":{"Content-Type":"application/json"},"body":"{\"status\":\"ok\"}"}

# Cleanup
docker stop commute-test && docker rm commute-test
```

### First-Time ECR Bootstrap

The Lambda function references an ECR image, but the ECR repository is created by CDK. On the very first deploy:

1. Comment out the Lambda + API Gateway resources in `infra/lib/infra-stack.ts`
2. `cdk deploy` to create ECR (and all other resources)
3. Push a placeholder image to ECR (with `--provenance=false`)
4. Uncomment Lambda + API Gateway resources
5. `cdk deploy` again to create the remaining resources

### AWS SDK v3 + Jest on Node 22+

AWS SDK v3 uses dynamic imports internally, which requires the `--experimental-vm-modules` Node flag when running under Jest. Without it, tests that actually call the SDK (e.g., integration tests against DynamoDB Local) fail with:

> `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`

The `npm test` script uses `cross-env` to set `NODE_OPTIONS=--experimental-vm-modules` cross-platform (Windows does not support inline env vars in npm scripts). This flag is harmless for unit tests that mock the SDK — it only matters when the SDK executes real calls.

### DynamoDB Local Integration Tests

The integration test in `src/__tests__/integration.test.ts` uses `describe.skip` when `DYNAMODB_ENDPOINT` is not set, so `npm test` always passes even without Docker. To run the full suite including integration:

```bash
docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local
DYNAMODB_ENDPOINT=http://localhost:8000 npm test
docker stop dynamodb-local && docker rm dynamodb-local
```

The test creates a uniquely-named table per run and tears it down afterwards, so it is safe to run repeatedly.

### Input Validation

Profile input validation (`src/validation.ts`) checks:
- Required fields: `name`, `outbound`, `return` (each with `originCRS`, `destinationCRS`, `departureTime`)
- CRS codes must exist in the static station lookup (`src/data/stations.ts`)
- Departure times must be valid `HH:MM` strings (00:00–23:59)
- `tflLines` (if provided) must be an array of known TfL line IDs

Invalid requests return `400` with a `{ errors: [{ field, message }] }` body.

## Non-Functional Targets

- Dashboard data load: < 3 s on standard broadband
- Lambda cold start: < 2 s including container init
- Responsive: 375 px (mobile) → 1440 px+ (desktop)
- Cost: within AWS free tier or low single-digit £/month for personal use
