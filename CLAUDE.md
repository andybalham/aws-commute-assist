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
│   └── Dockerfile
└── frontend/       # React + Vite + TypeScript SPA
    └── src/
        ├── api/            # apiClient.ts, dashboardApi.ts, profilesApi.ts, types.ts
        ├── components/     # Layout.tsx, ProtectedRoute.tsx
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

### Frontend

- All `VITE_*` environment variables are defined in `.env.local` (gitignored); `.env.local.example` documents them.
- The shared Axios instance in `src/api/apiClient.ts` attaches the Cognito `idToken` as a `Bearer` header on every request via a request interceptor that calls `fetchAuthSession()` from Amplify.
- Unauthenticated users are always redirected to the Cognito Hosted UI — no custom login page. The `ProtectedRoute` component checks auth state and calls `signInWithRedirect()` in a `useEffect` (not during render — React StrictMode double-renders break inline side effects).
- Amplify is configured in `src/amplify-config.ts` and called in `main.tsx` before the React tree renders.
- React Query (`@tanstack/react-query`) is the data-fetching layer; the `QueryClientProvider` wraps the app in `main.tsx`.
- Routing uses `react-router-dom` with a `Layout` component (nav + `<Outlet />`) nested under `ProtectedRoute`.
- Tailwind CSS v4 is used via the `@tailwindcss/vite` plugin — no `tailwind.config.js` or `postcss.config.js` needed; `index.css` uses `@import "tailwindcss"`.

### Infrastructure

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
```

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
aws cloudformation describe-stacks --stack-name commute-dev --query "Stacks[0].Outputs" --output table
```

### Cognito OAuth Callback URLs

The CDK stack configures the Cognito App Client with both production and local dev callback/logout URLs. The `VITE_REDIRECT_URL` must exactly match one of the allowed callback URLs in Cognito — including the `/callback` path. The CDK already allows:

- **Callback:** `https://<cloudfront>/callback` and `http://localhost:5173/callback`
- **Logout:** `https://<cloudfront>` and `http://localhost:5173`

If you change the dev server port or add a new deployment URL, update both the CDK (`infra/lib/infra-stack.ts` → `oAuth.callbackUrls` / `logoutUrls`) and redeploy.

## Build & Deploy

```bash
# Infrastructure
cd infra
npm run build
cdk deploy --all            # defaults to dev; use -c env=prod for production

# Backend (after CDK deploy)
./deploy-backend.sh         # docker build → ECR push → lambda update-function-code

# Frontend (after CDK deploy — injects CDK outputs as VITE_* vars)
./deploy-frontend.sh        # vite build → s3 sync → cloudfront invalidation
```

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
