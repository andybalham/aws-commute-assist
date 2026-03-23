# Commute Dashboard — Project Requirements

> **Status:** Draft v0.3 — for review and iteration

---

## 1. Project Overview

A personal commute dashboard web application that provides a quick-glance summary of expected weather conditions and rail travel information for a configured commute. If the destination is London, Transport for London (TfL) data is also surfaced. Access is restricted to registered users managed via AWS Cognito.

---

## 2. Goals and Non-Goals

### Goals

- Provide a fast, at-a-glance commute summary on demand
- Support configurable outbound and return journeys (origin, destination, departure times)
- Surface UK National Rail data (scheduled services, disruptions, delays)
- Surface weather forecasts relevant to each leg of the journey
- Surface TfL data when the destination is a London terminus or TfL zone
- Secure access via Cognito-authenticated login; no self-registration
- Deploy entirely on AWS using modern, low-operational-overhead services
- Support responsive use on desktop and mobile browsers

### Non-Goals

- Public user registration or self-service account management
- Real-time push notifications or alerts
- Mobile native apps (web only)
- Ticket purchasing or booking integration
- Support for non-UK rail networks (international, Eurostar, etc.)
- Journey planning / route calculation (users configure known routes)

---

## 3. Users

There is a single user class: **authenticated commuter**. User accounts are created directly in the AWS Cognito User Pool by an administrator via the AWS Console. There is no in-app registration flow.

---

## 4. Functional Requirements

### 4.1 Authentication

| ID | Requirement |
|----|-------------|
| AUTH-01 | The application shall require users to authenticate before accessing any content. |
| AUTH-02 | Authentication shall be provided by Amazon Cognito (User Pool with hosted UI or Amplify-managed flow). |
| AUTH-03 | User accounts shall only be created by an administrator via the AWS Console; there is no in-app sign-up. |
| AUTH-04 | Unauthenticated requests to the frontend shall redirect to the login page. |
| AUTH-05 | Unauthenticated requests to the backend API shall return HTTP 401. |
| AUTH-06 | Sessions shall expire after a configurable period of inactivity (default: 1 hour). |
| AUTH-07 | Users shall be able to sign out, invalidating their session. |

### 4.2 Commute Configuration

| ID | Requirement |
|----|-------------|
| CFG-01 | A user shall be able to configure one or more named commute profiles. |
| CFG-02 | Each profile shall include an outbound leg: origin station, destination station, and preferred departure time. |
| CFG-03 | Each profile shall include a return leg: origin station (same as outbound destination), destination station (same as outbound origin), and preferred departure time. |
| CFG-04 | Station selection shall support search/autocomplete using station names and/or CRS codes. |
| CFG-05 | Configuration shall be persisted per user. |
| CFG-06 | A user shall be able to create, edit, and delete commute profiles. |
| CFG-07 | A user shall be able to select which profile is currently active. |
| CFG-08 | When a profile's destination is a London terminus, the user shall be able to manually select one or more TfL lines to monitor within that profile. |

### 4.3 Dashboard — Rail Information

| ID | Requirement |
|----|-------------|
| RAIL-01 | The dashboard shall display live departures for the outbound leg around the configured departure time (e.g., ±30 minutes). |
| RAIL-02 | The dashboard shall display live departures for the return leg around the configured departure time. |
| RAIL-03 | For each displayed service the following shall be shown: scheduled departure time, expected/actual departure time, calling points (at minimum the destination), platform number (where available), and operator. |
| RAIL-04 | Services shall be visually flagged as On Time, Delayed, or Cancelled. |
| RAIL-05 | Any active disruptions or service messages affecting the configured route shall be prominently displayed. |
| RAIL-06 | Rail data shall be sourced from the National Rail Darwin OpenLDBWS feed using the project's Darwin API key. |

### 4.4 Dashboard — Weather Information

| ID | Requirement |
|----|-------------|
| WX-01 | The dashboard shall display a weather summary for the origin location at the configured outbound departure time. |
| WX-02 | The dashboard shall display a weather summary for the destination location at the estimated arrival time. |
| WX-03 | The dashboard shall display a weather summary for the origin location at the configured return departure time. |
| WX-04 | Each weather summary shall include: condition description, temperature (°C), precipitation probability, and wind speed. |
| WX-05 | Weather data shall be sourced from **Open-Meteo** (free, no API key required). Station CRS codes shall be resolved to latitude/longitude coordinates via a static lookup table in the backend before querying the Open-Meteo forecast API. |

### 4.5 Dashboard — TfL Information (Conditional)

| ID | Requirement |
|----|-------------|
| TFL-01 | When the active commute profile has one or more TfL lines configured, a TfL section shall be shown on the dashboard. |
| TFL-02 | The TfL section shall display the current status of each line selected in the active profile. |
| TFL-03 | TfL line statuses shall include: line name, status (e.g., Good Service, Minor Delays, Severe Delays, Part Suspended), and any associated reason text. |
| TFL-04 | TfL data shall be sourced from the TfL Unified API (`api.tfl.gov.uk`). |
| TFL-05 | The set of TfL lines displayed is determined solely by the user's manual selection within the commute profile; there is no automatic line lookup. |

### 4.6 Dashboard — General

| ID | Requirement |
|----|-------------|
| DASH-01 | The dashboard shall be the default landing page after login. |
| DASH-02 | The dashboard shall display a "last refreshed" timestamp and provide a manual refresh control. |
| DASH-03 | Data shall auto-refresh at a configurable interval (default: 5 minutes) while the page is active. |
| DASH-04 | The dashboard shall clearly indicate when any data source is unavailable or returning errors. |
| DASH-05 | The dashboard shall be responsive and usable on both desktop and mobile browsers. |

---

## 5. Architecture

### 5.1 Overview

```
Browser (React SPA)
    │
    │  HTTPS
    ▼
Amazon CloudFront
    │
    ├──► S3 (static assets)
    │
    └──► API Gateway (HTTP API)
              │
              │  JWT auth (Cognito)
              ▼
         AWS Lambda
         (Node.js — container image)
              │
              ├──► DynamoDB (user config / profiles)
              ├──► National Rail API
              ├──► Weather API
              └──► TfL Unified API
```

### 5.2 Frontend

| Concern | Decision |
|---------|----------|
| Framework | React (latest stable) with TypeScript |
| Build tooling | Vite |
| Auth integration | AWS Amplify JS (Auth module) — Cognito Hosted UI |
| State management | React Query for server state; Context or Zustand for local state |
| Hosting | S3 + CloudFront |
| Styling | **Tailwind CSS** |
| Responsive design | Required; mobile-first approach recommended |

### 5.3 Backend

| Concern | Decision |
|---------|----------|
| Runtime | **Node.js (TypeScript)** |
| Deployment unit | AWS Lambda — **single monolithic container image** (ECR) |
| API layer | Amazon API Gateway (HTTP API) |
| Auth enforcement | API Gateway JWT authorizer using Cognito User Pool |
| Data persistence | Amazon DynamoDB (user commute profiles) |
| Container registry | Amazon ECR |
| Build pipeline | Docker multi-stage build |
| Local development | Lambda handler shall be runnable in isolation locally without AWS dependencies (e.g., via a thin Express wrapper or `aws-lambda-ric` with local env vars and a DynamoDB local instance) |
| Caching | None; the Lambda fans out directly to upstream APIs on each request |

### 5.4 Local Development & Testability

The backend Lambda shall be structured to support isolated local execution without deploying to AWS:

- Business logic (rail, weather, TfL API calls; data transformation) shall be separated from the Lambda handler entry point.
- A local runner script (e.g., a lightweight Express HTTP server) shall wrap the handler, enabling `curl` or REST client testing against `localhost`.
- Environment variables (API keys, DynamoDB endpoint, etc.) shall be injectable via a local `.env` file.
- DynamoDB access shall be compatible with [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) for fully offline profile persistence during development.
- Unit and integration tests shall be runnable with `npm test` without requiring live AWS or external API credentials (external APIs to be mocked/stubbed in tests).

### 5.5 Authentication

- Amazon Cognito User Pool with **Hosted UI** (via AWS Amplify JS Auth module)
- JWT tokens validated at API Gateway layer
- No self-registration; admin creates users in Console

### 5.6 Infrastructure as Code

- **AWS CDK (TypeScript)**
- All AWS resources defined as CDK constructs; no manual console provisioning (except initial Cognito user creation)
- CDK app shall live in a dedicated `infra/` directory within the repository
- Environments (e.g., `dev`, `prod`) shall be parameterised within the CDK app

---

## 6. External API Dependencies

| Service | Provider / API | Auth |
|---------|---------------|------|
| UK National Rail live departures & disruptions | **National Rail Darwin OpenLDBWS** | Darwin API key (held in SSM Parameter Store) |
| Weather forecast | **Open-Meteo** (`api.open-meteo.com`) | None — no API key required |
| TfL line status | TfL Unified API (`api.tfl.gov.uk`) | App ID + key recommended; stored in SSM |

---

## 7. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | Dashboard data shall load within 3 seconds on a standard broadband connection under normal conditions. |
| NFR-02 | The backend Lambda shall have a cold-start time acceptable for interactive use (target: <2 s including container init). |
| NFR-03 | All data in transit shall be encrypted (HTTPS/TLS). |
| NFR-04 | AWS credentials and API keys shall not be embedded in client-side code; secrets shall be managed via AWS Secrets Manager or SSM Parameter Store. |
| NFR-05 | The system shall handle external API unavailability gracefully, displaying partial data with a clear error indicator per section rather than a full-page error. |
| NFR-06 | Infrastructure costs shall be minimised; Lambda + S3 + CloudFront should remain within AWS free tier or low single-digit £/month for personal use. |
| NFR-07 | The application shall be responsive across viewport sizes from 375px (mobile) to 1440px+ (desktop). |

---

## 8. Data Model (Draft)

### CommuteProfile

| Field | Type | Notes |
|-------|------|-------|
| `userId` | String (PK) | Cognito `sub` |
| `profileId` | String (SK) | UUID |
| `name` | String | User-defined label |
| `outbound.originCRS` | String | 3-letter CRS code |
| `outbound.destinationCRS` | String | |
| `outbound.departureTime` | String | HH:MM local time |
| `return.originCRS` | String | |
| `return.destinationCRS` | String | |
| `return.departureTime` | String | HH:MM local time |
| `tflLines` | String[] | TfL line IDs manually selected by user; empty array if not applicable |
| `isActive` | Boolean | Whether this is the selected profile |
| `createdAt` | ISO8601 | |
| `updatedAt` | ISO8601 | |

---

## 10. Open Questions

All questions resolved. No open items.

---

## 11. Repository Structure (Proposed)

```
commute-dashboard/
├── infra/                  # AWS CDK app (TypeScript)
│   ├── bin/
│   └── lib/
├── backend/                # Lambda container (Node.js / TypeScript)
│   ├── src/
│   │   ├── handler.ts      # Lambda entry point
│   │   ├── server.ts       # Local Express runner (dev only)
│   │   ├── routes/
│   │   └── services/
│   │       ├── rail.ts
│   │       ├── weather.ts
│   │       └── tfl.ts
│   ├── Dockerfile
│   └── package.json
├── frontend/               # React / Vite app (TypeScript)
│   ├── src/
│   ├── index.html
│   └── package.json
└── README.md
```

---

## 12. Security Considerations

- All Lambda environment variables containing secrets shall reference SSM/Secrets Manager, not plaintext values.
- CloudFront shall be the only public entry point; the S3 bucket shall not have public access.
- API Gateway shall reject requests without a valid Cognito JWT.
- Lambda execution role shall follow least-privilege principle.
- CORS policy on API Gateway shall restrict origins to the CloudFront domain.
- The Darwin API key shall never appear in frontend code, build artefacts, or version control.

---

## 13. Out of Scope (Explicit Exclusions)

- Push notifications or email alerts
- Ticket booking or pricing information
- Saving/exporting journey history
- Multi-user administration UI
- Support for bus, coach, or non-TfL services
- Offline / PWA support (not in v1)
- Automatic TfL line lookup based on station (lines are manually configured per profile)
- Server-side caching layer

---

*End of document — v0.3*
