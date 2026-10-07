# Infra — AWS configuration

Artifacts used to configure the S3 bucket backing image attachments. They are
**applied** (verified) — see `docs/phase4-verification.log`.

## Files

- `iam-policy.json` — two statements:
  1. object data plane scoped to `arn:aws:s3:::bugtrackerelovient/uploads/*`
     (`s3:PutObject`, `GetObject`, `DeleteObject`) — the minimum the app needs;
  2. bucket configuration grants (CORS, public-access-block, lifecycle) so the
     deployer can run the apply script once.
- `s3-cors.json` — CORS rules. Currently allows `http://localhost:5173` and
  `http://127.0.0.1:5173` for the pre-signed PUT/GET calls. **For production,
  replace these origins with your real origin** (ports 80/443 only) and re-apply.
- `s3-lifecycle.json` — 30d → STANDARD_IA, expire 365d, prefix `uploads/`.

## Apply (done for this project's bucket; re-run only to update)

```bash
cd backend
cp ../infra/s3-cors.json ./cors.json
cp ../infra/s3-lifecycle.json ./lifecycle.json
node aws-bucket-config.tmp.mjs   # throwaway script (gitignored)
```

The script: enables Block Public Access (all four), applies CORS, puts the
lifecycle config, then prints the live bucket settings for confirmation.

## Verify (curl-level proof, also in the phase-4 log)

- 6 MB upload → HTTP 400 (server-side `<5 MB` guard, no S3 call made)
- pre-signed PUT of a real PNG → 204; signed GET returns the identical bytes
- GET without a signature → 403; GET after bug deletion → 403 (object gone)
- bucket policy/Block Public Access confirmed via AWS CLI (`aws s3api get-public-access-block`)