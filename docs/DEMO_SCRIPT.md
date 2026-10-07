# Demo script — live walkthrough

Roughly 8 minutes. Pre-stage everything (DB up, backend running, dev server
running, bucket configured). Do not reload the browser midway unless noted.

## Setup (before the call)

```bash
docker compose up -d postgres
cd backend && npm run migrate && npm run dev
cd frontend && npm run dev
# optionally: open http://localhost:5173 in one window, Swagger in another
```

## 1. Auth (90s)

1. Show `GET /api/health` → `{"status":"ok","db":"up"}`.
2. Open `/register`; register `Demo <demo@example.com>` → lands on the empty
   dashboard. Refresh → still logged in (JWT in `sessionStorage`).
3. Log out, go to `/login`, wrong password → “Invalid email or password”.
   Correct password → back in.

## 2. Create + attach (2 min)

1. “Report bug”: title “Login button handled 404 on hash sites”, severity High.
2. Add a screenshot (drag the `docs/demo` image). Preview appears.
3. Submit → detail view with the image. Open the lightbox (click image).
4. Mention: the image lived *only* in S3 via a 60-second pre-signed PUT — the
   server never buffered the file bytes.

## 3. Edit + statuses (60s)

1. Back to dashboard → filters show High / Open counts.
2. Reopen the bug, switch status to In progress, replace the image, save —
   badge and image update.

## 4. Delete (30s)

1. Delete the bug (confirm dialog). Dashboard returns to “No bugs yet”.
2. Optional: `curl -X DELETE <signed-url>` → 403 — the object is gone from S3.

## 5. Security callouts (2 min)

1. `/api/docs` (Swagger) — show the schemas.
2. `curl -i http://localhost:4000/api/bugs` → 401 without token.
3. Try 6 requests to `/api/auth/login` quickly → 5th is 429 (rate limited).
4. In `~/.aws`, show the IAM policy in `infra/iam-policy.json` — the bucket is
   private, Block Public Access ON, images readable only via signed URLs.

## 6. Wrap-up (60s)

1. Show `docs/phase4-verification.log` + the 16 screenshots.
2. `cd backend && npm test` → 36 passing (if the DB is reachable).
3. Point at `docs/NOTES.md` for the trade-offs and honest test coverage.