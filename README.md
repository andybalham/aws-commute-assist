# Commute Dashboard

A personal commute dashboard that surfaces UK National Rail departures, weather forecasts, and TfL line statuses for a configured commute. Deployed end-to-end on AWS; access is restricted via Amazon Cognito.

## Features

- Configure one or more commute profiles (origin / destination / departure times, optional TfL lines)
- Live rail departures from National Rail Darwin OpenLDBWS, filtered to ±30 minutes of the target time
- Hourly weather forecast (Open-Meteo) at the outbound origin, destination, and return destination
- TfL line status for any selected London Underground / Overground / DLR lines
- Auto-refresh every 5 minutes; per-section graceful degradation if any upstream API fails

## Architecture

```
┌──────────┐    ┌──────────────┐    ┌────────────────┐    ┌──────────────┐
│ Browser  │───▶│  CloudFront  │───▶│       S3       │    │   Cognito    │
│  (SPA)   │    │              │    │  (static SPA)  │    │   Hosted UI  │
└──────────┘    └──────────────┘    └────────────────┘    └──────────────┘
     │                                                           ▲
     │ JWT (Bearer)                                              │
     ▼                                                           │
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐    │
│ API Gateway  │───▶│  Lambda          │───▶│  DynamoDB    │    │
│ (HTTP API +  │    │  (container      │    │  (profiles)  │    │
│  JWT auth)   │    │  image from ECR) │    └──────────────┘    │
└──────────────┘    └──────────────────┘                        │
                          │                                     │
                          ├─▶ Darwin OpenLDBWS (rail)           │
                          ├─▶ Open-Meteo (weather)              │
                          ├─▶ TfL Unified API                   │
                          └─▶ SSM Parameter Store ──────────────┘
                              (Darwin/TfL secrets)
```

All AWS resources are provisioned via CDK in `infra/`.

## Repository structure

```
.
├── infra/              # AWS CDK app (TypeScript) — all AWS resources
├── backend/            # Lambda container (Node.js / TypeScript)
├── frontend/           # React + Vite SPA (TypeScript + Tailwind)
├── Deploy.ps1          # PowerShell: full build & deploy (infra → backend → frontend)
├── Start-DevStack.ps1  # PowerShell: start local dev stack for E2E testing
├── Stop-DevStack.ps1   # PowerShell: tear down local dev stack
├── requirements.md     # Functional & non-functional requirements
├── build-plan.md       # Phased delivery plan
├── test-plan.md        # E2E test scenarios
└── CLAUDE.md           # Detailed conventions and operational notes
```

## Prerequisites

- **Node.js** 20 or later (Lambda base image is Node 20)
- **npm** 10+
- **Docker Desktop** — required to build the Lambda container image and to run DynamoDB Local for integration tests
- **AWS CLI** v2, configured with credentials that have permission to deploy CDK stacks (CloudFormation, IAM, S3, CloudFront, Cognito, DynamoDB, ECR, Lambda, API Gateway, SSM)
- **AWS CDK** v2 (`npm install -g aws-cdk`)
- **PowerShell** 7+ (Windows-friendly deploy and dev-stack scripts)

## Local development

### Backend (with DynamoDB Local)

```bash
cd backend
cp .env.example .env        # fill in local values
npm install
npm run dev                 # starts Express on the configured PORT
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # fill in VITE_* values (see below)
npm install
npm run dev                 # starts Vite on http://localhost:5173
```

### Frontend environment variables

Required `VITE_*` variables in `frontend/.env.local`:

| Variable | Source | Example |
|---|---|---|
| `VITE_COGNITO_USER_POOL_ID` | CDK output `UserPoolId` | `eu-west-2_AbCdEfG` |
| `VITE_COGNITO_APP_CLIENT_ID` | CDK output `UserPoolClientId` | `7aha5grp...` |
| `VITE_COGNITO_DOMAIN` | CDK output `CognitoDomain` | `commute-dev-auth.auth.eu-west-2.amazoncognito.com` |
| `VITE_API_URL` | CDK output `ApiUrl` | `https://abc123.execute-api.eu-west-2.amazonaws.com` |
| `VITE_REDIRECT_URL` | OAuth callback URL | `http://localhost:5173/callback` (dev) or `https://<cloudfront>/callback` (prod) |

Pull CDK outputs after deploying infra:

```bash
aws cloudformation describe-stacks \
  --stack-name CommuteDashboard-dev \
  --query "Stacks[0].Outputs" --output table
```

### Backend environment variables

Required values in `backend/.env` for local dev (see `.env.example`):

| Variable | Description |
|---|---|
| `PORT` | Port for the local Express runner (e.g. `3001`) |
| `AWS_REGION` | AWS region (defaults to `eu-west-2`) |
| `DYNAMODB_ENDPOINT` | `http://localhost:8000` when using DynamoDB Local |
| `DYNAMODB_TABLE_NAME` | Table name (defaults to `commute-profiles`) |
| `DARWIN_API_KEY` | National Rail OpenLDBWS access token |
| `TFL_APP_ID` | TfL Unified API app ID |
| `TFL_APP_KEY` | TfL Unified API app key |

In production these secrets are loaded from SSM Parameter Store at Lambda startup; the env vars are only used for local dev.

### Tests

```bash
# Backend unit tests
cd backend && npm test

# Backend including DynamoDB Local integration test
docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local
DYNAMODB_ENDPOINT=http://localhost:8000 npm test
docker stop dynamodb-local && docker rm dynamodb-local

# Frontend E2E tests (Playwright) — requires the local dev stack to be running
cd frontend
npm run test:e2e
```

### Local dev stack for E2E tests

The Playwright tests require DynamoDB Local, the backend, and the frontend running together with auth bypassed. On Windows there is a one-command helper:

```powershell
.\Start-DevStack.ps1     # starts everything
# run tests...
.\Stop-DevStack.ps1      # tears it back down
```

## Deployment

The fastest path is the unified PowerShell script:

```powershell
.\Deploy.ps1                              # deploy everything to dev
.\Deploy.ps1 -Env prod                    # deploy everything to prod
.\Deploy.ps1 -Only backend                # infra + backend only
.\Deploy.ps1 -Only frontend -SkipInfra    # frontend only (skip CDK)
```

| Parameter | Description |
|---|---|
| `-Env` | Target environment: `dev` (default) or `prod` |
| `-Only` | Deploy a single layer: `backend` or `frontend`. Infra still runs first unless `-SkipInfra` is set |
| `-SkipInfra` | Skip the CDK infrastructure phase |

### Manual deploy steps

```bash
# 1. Infrastructure
cd infra
npm run build
cdk deploy --all                   # dev; use -c env=prod for production

# 2. Backend (after CDK deploy)
cd ../backend
npm run deploy                     # docker build → ECR push → lambda update
npm run deploy:prod                # same, prod target

# 3. Frontend (after CDK deploy)
cd ../frontend
npm run deploy                     # vite build → s3 sync → CF invalidation
npm run deploy:prod                # same, prod target
```

The deploy scripts (`backend/deploy.mjs` / `frontend/deploy.mjs`) read CDK stack outputs from CloudFormation, so the CDK stack must exist before running them.

### First-time bootstrap

The Lambda function references an ECR image, but the ECR repository is created by CDK. On the very first deploy:

1. Comment out the Lambda + API Gateway resources in `infra/lib/infra-stack.ts`
2. `cdk deploy` to create ECR (and all other resources)
3. Push a placeholder image to ECR (with `--provenance=false`)
4. Uncomment Lambda + API Gateway resources
5. `cdk deploy` again to create the remaining resources

See `CLAUDE.md` → "Docker Image Requirements" for the `--provenance=false` flag rationale.

## Documentation

- **`requirements.md`** — full functional and non-functional requirements
- **`build-plan.md`** — phased delivery plan and current progress
- **`test-plan.md`** — manual and Playwright E2E test scenarios
- **`CLAUDE.md`** — operational guide, conventions, and gotchas (must-read for contributors)

## External APIs

| Service | API | Auth |
|---|---|---|
| UK rail live departures | National Rail Darwin OpenLDBWS (SOAP) | Darwin API key — SSM |
| Weather forecast | Open-Meteo (`api.open-meteo.com`) | None |
| TfL line status | TfL Unified API (`api.tfl.gov.uk`) | App ID + key — SSM |

## Non-functional targets

- Dashboard data load: < 3 s on standard broadband
- Lambda cold start: < 2 s including container init
- Responsive: 375 px (mobile) → 1440 px+ (desktop)
- Cost: within AWS free tier or low single-digit £/month for personal use
