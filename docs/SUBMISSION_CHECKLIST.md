# Submission checklist

Use this to assemble the submission. Everything below exists in the repo
unless marked (manual).

## Deliverables

- [x] `/` — README.md (features, security controls table, quick start, verification)
- [x] `/docs/NOTES.md` — answers to the 5 task questions (incl. “tested vs assumed”)
- [x] `/docs/DEMO_SCRIPT.md` — live walkthrough with time boxes
- [x] `/docs/DEPLOYMENT.md` — production runbook (Nginx/PM2/ECS-K8s notes)
- [x] `/docs/SUBMISSION_CHECKLIST.md` — this file
- [x] `/docs/phase4-verification.log` — dated live evidence (S3 round trip,
      6 MB rejection, deletion proof)
- [x] `/docs/screenshots/` — 16 named PNGs (desktop + mobile + dark mode,
      created by the E2E run)

## Code

- [x] Backend: Express API with auth, CRUD, uploads, validation, rate limits,
      request IDs, logging, health, Swagger —
      `backend/src/{app,index,middleware,db}.js`, `routes/`, `openapi.js`
- [x] `backend/src/schema.sql` + `scripts/init-databases.sql`
- [x] Frontend SPA — `frontend/src/**` (pages/components/hooks/lib/api),
      Vite + Tailwind v4 + React Router
- [x] Tests — `backend/tests/*` (36 passing, Vitest against real Postgres)
- [x] E2E — `frontend/e2e/smoke.mjs` (13/13 pass) + `frontend/e2e/package.json`
- [x] Docker — `backend/Dockerfile` (build proven, healthcheck healthy)
- [x] Docker Compose — `docker-compose.yml` (postgres + api)
- [x] CI — `.github/workflows/ci.yml`
- [x] Infra — `infra/iam-policy.json`, `infra/s3-cors.json`, `infra/s3-lifecycle.json`
- [x] Deploy — `deploy/{nginx.conf,ecosystem.config.cjs,deploy.sh}`
- [x] `backend/.env.example`, `frontend/.env.example`, root `.gitignore`

## Secrets hygiene (verify before zipping)

- [ ] No `.env` files tracked (only `.env.example`) — `git ls-files | grep .env`
- [ ] No `~/.aws` contents or credentials in the repo
- [ ] `backend/server.pid`, `*.tmp.mjs`, vite logs all gitignored

## Manual steps the reviewer may want to reproduce

- [x] Live pre-signed S3 upload round trip — reproduce with
      `%TEMP%\opencode\verify-phase4.ps1` (or the steps in `docs/NOTES.md`)
- [ ] Production deployment — I did not deploy to a live server; follow
      `docs/DEPLOYMENT.md` (requires your AWS account / instance + adding your
      prod origin to `infra/s3-cors.json`)

## Final structure

```text
bug-tracker-lite/
  backend/  frontend/  infra/  deploy/  docs/
  docker-compose.yml  README.md
  .github/workflows/ci.yml  .gitignore
```