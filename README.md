# Bug Tracker Lite

A secure, full-stack bug tracker with image attachments uploaded to AWS S3 via
pre-signed URLs. Built for a security-focused take-home task.

## Features

- **Auth**: register / login with bcrypt-hashed passwords, JWT bearer tokens,
  per-route input validation (Zod), rate limiting on auth endpoints, and
  constant-time error responses.
- **Bugs**: create, list (with status filter + counts), view, edit
  (status/severity/description), delete. Images are optional.
- **Attachments**: the browser uploads directly to S3 using a server-issued
  short-lived pre-signed URL — the server never stores file bytes or passes
  secrets to the client.
- **Frontend**: React + Vite + Tailwind v4 SPA, responsive (375px–desktop),
  light/dark mode, image lightbox, optimistic UI with toasts.
- **API docs**: Swagger UI at `/api/docs`.
- **Observability**: request IDs, structured request logging, /api/health.

## Security design

| Concern | Control |
| --- | --- |
| Password storage | `bcrypt` (cost 12), never returned in responses |
| Session | JWT `HS256` signed with `JWT_SECRET` (random, gitignored) |
| Input validation | Zod schemas on every route; `express.json` 50 kb body limit |
| Brute force | Rate limiters: auth endpoints 5 req/min/IP (signup & login separate) |
| Account enum | Uniform error messages + uniform auth limiter behaviour |
| SQLi / XSS | Parameterized `pg` queries; React escaping; `helmet` headers |
| Upload abuse | Pre-signed URLs: 60s expiry, PUT-only, key pinned under `uploads/`, `<5 MB` size check in the app too |
| S3 origin access | Bucket Block Public Access = ON; bucket policy denies everything except the IAM user's `s3:PutObject`; images readable only via short-lived signed GET URLs |
| Secrets | `.env`, `~/.aws` never committed; CORS only allows the app origin |
| Rate limits API | General 60 req/min/IP limiter (see `routes/auth.js`/`middleware.js` build note) |

## Stack

- **Backend**: Node 24, Express, `pg`, `bcrypt`, `jsonwebtoken`, `zod`,
  `@aws-sdk/client-s3`, Vitest, Docker.
- **Database**: PostgreSQL 16 (local dev via `docker compose`, test DB kept
  separate: `bugtracker_test`).
- **Frontend**: React 19, Vite 7, Tailwind v4, React Router 7, Playwright (e2e).
- **Infra**: AWS S3 (attachments), optional Nginx + PM2 deploy.

## Quick start (local)

Prerequisites: Node 24, Docker Desktop, an AWS CLI profile with the permissions
in `infra/iam-policy.json`.

```bash
# 1. Database
docker compose up -d postgres

# 2. Backend
cd backend
cp .env.example .env          # then fill in JWT_SECRET / AWS values (see below)
npm ci
npm run migrate               # applies src/schema.sql
npm run dev                   # API on http://localhost:4000

# 3. Frontend (separate terminal)
cd frontend
npm ci
npm run dev                   # SPA on http://localhost:5173 (proxies /api)
```

### Required `.env` (backend)

```dotenv
DATABASE_URL=postgres://bugtracker:bugtracker@localhost:5432/bugtracker
JWT_SECRET=<random, long>
CORS_ORIGIN=http://localhost:5173
AWS_REGION=ap-southeast-2
S3_BUCKET=<your-bucket>
```

`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` come from your `~/.aws` profile.
The bucket must be configured with the CORS + lifecycle rules in
`infra/s3-cors.json` / `infra/s3-lifecycle.json` (see `infra/README.md`).

## Verification

- **Backend unit/integration tests** (Vitest, use a dedicated `bugtracker_test`
  DB, S3 mocked): `cd backend && npm test` → 36 passing.
- **Live API verification** (real PostgreSQL + real S3, includes the
  6 MB rejection, signed-URL round trip, and deletion proof):
  `docs/phase4-verification.log`, driven by the script at
  `%TEMP%\opencode\verify-phase4.ps1`.
- **E2E + screenshots** (Playwright against the running app, real S3
  uploads): `cd frontend/e2e && node smoke.mjs`. Every step passed; 16
  screenshots in `docs/screenshots/`.
- **Container**: `docker compose build api` → image builds; running it against
  the local DB reports `{"status":"ok","db":"up"}` and a `healthy` healthcheck.

## Tests

```bash
cd backend && npm test        # 36 tests
cd frontend && npm run build  # production build check
cd frontend/e2e && node smoke.mjs   # full browser E2E + screenshots
```

## Docker

```bash
docker compose build api      # production image (Node 24 slim, non-root user)
docker compose up -d          # postgres + api
```

## CI

`.github/workflows/ci.yml` runs backend tests against a real PostgreSQL 16
service container and a frontend production build on every push/PR to `main`.

## Deployment

Bare-metal/Nginx reference in `deploy/` (`nginx.conf`, `ecosystem.config.cjs`,
`deploy.sh`). Step-by-step production runbook in `docs/DEPLOYMENT.md`.

## Documentation

- `docs/NOTES.md` — the security write-up / answers to the task questions.
- `docs/DEMO_SCRIPT.md` — step-by-step live/interview demo.
- `docs/DEPLOYMENT.md` — production deployment runbook.
- `docs/phase4-verification.log` — dated evidence of the live phase-4 checks.
- `docs/SUBMISSION_CHECKLIST.md` — what to include in the submission.

## Repository map

```
backend/            Express API (src/{app,index,middleware,db}.js, routes/, openapi.js)
backend/tests/      Vitest suites (auth, bugs, upload) + setup
frontend/           React SPA (src/pages, src/components, src/api, src/hooks)
frontend/e2e/       Playwright smoke + screenshot script
infra/              IAM policy, S3 CORS + lifecycle, cloud docs
deploy/             Nginx / PM2 / deploy script
docs/               verification evidence + write-ups
.github/workflows/  CI (backend tests + frontend build)
```