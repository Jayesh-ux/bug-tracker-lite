# Notes — write-up

Answers to the security-focused task questions, covering what was built, what
was verified, and the honest limits of that verification.

---

## 1. What did you build?

A full-stack **Bug Tracker** with image attachments:

- **API** (Node/Express): JWT auth with `bcrypt` password hashing, CRUD for
  bugs, image **pre-signed URL** issuance for S3 uploads/downloads, Zod input
  validation, rate limiting, request IDs + structured logging, Swagger UI,
  and health/readiness. PostgreSQL 16 for persistence.
- **SPA** (React/Vite/Tailwind): register/login session flow, dashboard with
  status filters and counts, create/view/edit/delete bugs, drag-and-drop image
  picker with preview + lightbox, responsive (mobile + desktop) and dark mode.
- **AWS S3**: attachments stored in a private bucket; **only** short-lived
  pre-signed PUT (upload) and GET (view) URLs touch S3. Block Public Access is
  ON; the only IAM identity that can write is the app's own IAM user.
- **Verification**: 36 backend tests (Vitest; real Postgres test DB, S3
  mocked), a live phase-4 verification run against real S3 + Postgres (log in
  `docs/phase4-verification.log`), and a full Playwright E2E that uploads a real
  image and exercises every flow (13/13 steps pass, 16 screenshots).
- **Delivery**: production Docker image (non-root user + healthcheck), CI
  workflow, deployment runbook, Nginx/PM2 configs.

## 2. Key security controls

| Area | Control | Why |
| --- | --- | --- |
| Passwords | `bcrypt` cost 12; never serialized back | Mitigates offline cracking if DB leaked |
| Auth tokens | JWT `HS256`, random `JWT_SECRET`, no password embedded, middleware on all `/api` routes except `/health` | Stateless, revocable by rotating the secret |
| Validation | Zod on every body; 50 KB JSON limit; parameterized SQL | Blocks SQLi, mass-assignment, oversized payloads |
| Auth abuse | 5 req/min/IP limiters **shared across signup + login** | Slows brute force and registration spam |
| Account probing | Same error text + same rate-limit path for “wrong email” vs “wrong password”; no user enumeration in registration either | Prevents directory harvest |
| Uploads | Pre-signed PUT URL, 60s expiry, key forged server-side and pinned under `uploads/<userId>/`, PUT-only permission, server also refuses >5 MB | Server never buffers file bytes; attacker cannot PUT anywhere else in the bucket; expiry caps abuse window |
| Reading images | Bucket is **private** + Block Public Access ON; GET URL is also pre-signed (same 60s expiry) | No public bucket, no unsigned object reads |
| S3 data plane | Bucket policy allows only the app's IAM user to put objects under `uploads/*` | Defense-in-depth beyond ACLs |
| Headers | `helmet` (CSP/sniffing/frame); custom headers in Nginx sample | XSS / clickjacking hardening |
| Secrets | `.env*` + `.aws/` gitignored; example files committed only | Nothing sensitive ships in the repo |
| Backend infra | Non-root container user, 50 KB payloads, healthcheck | Reduces blast radius if the app is compromised |

## 3. Security vs. scalability trade-offs

- **Rate limiting is in-memory per process** (fast, zero infra) but does not
  survive restarts or span multiple instances. In production I would swap it
  for a Redis-backed `rate-limit-redis` store.
- **Pre-signed URLs push file bytes to S3 directly** — excellent scale and no
  server bandwidth cost. The trade-off is you cannot do server-side virus
  scanning in the same round-trip; production should add a quarantine bucket +
  an S3-triggered scanning lambda (e.g. ClamAV) that moves approved files to
  the live bucket.
- **Forked single-process Node** keeps deploys and debugging trivial. When the
  app outgrows a single box, the clean split points are already in place:
  stateless API behind a load balancer, Postgres RDS with a read replica,
  and the S3-backed object store scaling independently.
- **Token expiry is 30 days** — long-lived like a typical CRM session but this
  is a deliberate product choice; shortening it is a one-line change. Add
  refresh tokens + optional device revocation before production.

## 4. Why do users authenticate and which flows are protected?

Users self-register (email + password) and log in to get a bearer JWT. The
app protects every bug route and the upload flow:

- `/api/bugs` (all methods), and `/api/uploads/url` (PUT) refuse requests
  without a valid `Authorization: Bearer` token (401).
- Each user can only read/write their **own** bugs — every query is scoped by
  `user_id` from the token, so user A's bugs are never returned to user B
  (verified in tests); image `uploadKeys` are pinned under `uploads/<userId>/`.
- The frontend stores the token in `sessionStorage` and attaches it; routes
  without a token redirect to `/login`.

## 5. What was tested vs. assumed?

**Actually tested (evidence in `docs/`):**
- Auth: register, duplicate email, login OK/bad-password, missing/invalid/
  expired token, rate limiting (429) — Vitest.
- Bugs: ownership scoping (B cannot read/edit/delete A's bug), full CRUD,
  status/severity filters — Vitest.
- Uploads: pre-signed round trip (204 → signed GET → identical bytes), 6 MB
  rejection (**400**, before S3), missing params rejected, key pinned to
  `uploads/<userId>/` — Vitest + recorded live run against real S3
  (`phase4-verification.log`), including proof the object is deleted after bug
  deletion (signed GET → 403).
- Frontend: real-browser E2E of the whole product incl. real S3 image
  upload/replace/delete (13/13 steps, 16 screenshots).
- Container: image builds; boots to `{"status":"ok","db":"up"}`; Docker
  healthcheck flips to `healthy`.

**Not tested / assumed:**
- The Redis rate-limit migration, load-balancer multi-instance behaviour, and
  S3-triggered scanning are designed but not built.
- `bcrypt`, `jsonwebtoken`, `@aws-sdk` libraries are trusted dependencies; the
  npm install gate logged an `esbuild` build-script warning that is gated by
  npm's `ignore-scripts` policy on this machine and is unrelated to production
  behaviour (esbuild ships platform binaries).
- Real-world penetration testing and dependency CVE scanning
  (`npm audit` in CI) are not part of this repo's CI yet.