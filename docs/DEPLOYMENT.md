# Production deployment runbook

Deploys a single-tenant instance from source (or the Docker image). The local
stack is: **Nginx** (SPA + proxy) → **Node/Express** (API, :4000) → Postgres →
**S3** (images). Frontend assets can be moved to CloudFront + S3 instead; the
API is stateless and can be scaled horizontally behind a load balancer.

## 1. Provision

- VM (e.g. EC2 t3.small), Ubuntu 24.04, security group open: `22`, `80`,
  `443` (do **not** expose `4000`).
- Install Node 24, PM2 (`npm i -g pm2`), Nginx.

## 2. Database

```sql
CREATE USER bugtracker WITH PASSWORD '<strong>';
CREATE DATABASE bugtracker OWNER bugtracker;
-- also create a second DB for tests if you run CI on this host
```

## 3. App + AWS

```bash
git clone <repo> /var/www/bugtracker-lite && cd /var/www/bugtracker-lite
cd backend
cp .env.example .env
#  - DATABASE_URL=postgres://bugtracker:<strong>@<host>:5432/bugtracker
#  - JWT_SECRET=<openssl rand -base64 48>
#  - CORS_ORIGIN=https://bugs.example.com     <-- MUST MATCH real origin
#  - AWS_REGION / S3_BUCKET=the bucket
```

AWS credentials: attach an IAM **instance role** carrying
`infra/iam-policy.json` (EC2) or set `~/.aws/credentials` (bare metal). Never
put keys in the repo or pm2 config.

On the S3 bucket:

- Apply `infra/s3-cors.json`, replacing the two `http://localhost:5173` origins
  with your production origin (port 80/443 only).
- Apply `infra/s3-lifecycle.json` (30d → STANDARD_IA, expire 365d) if desired.
- Confirm Block Public Access is ON and the bucket policy still only grants
  `s3:PutObject` to the app role.

## 4. Deploy

```bash
cd /var/www/bugtracker-lite
./deploy/deploy.sh          # installs deps, builds SPA, reloads pm2
pm2 startup && pm2 save     # survive reboots
sudo cp deploy/nginx.conf /etc/nginx/conf.d/bugtracker.conf
sudo systemctl reload nginx
```

Edit `deploy/nginx.conf`: `server_name`, `root` to the SPA build dir, and the
`try_files`/`location` blocks so `/api/*` proxies to :4000 while every other
path returns `index.html`.

## 5. Verify

```bash
curl http://127.0.0.1:4000/api/health        # {"status":"ok","db":"up"}
curl -I https://bugs.example.com             # 200, security headers present
curl -i https://bugs.example.com/api/bugs    # 401 (no token)
```

Register → upload a screenshot → reload the bug page (image served via signed
GET). Check `pm2 logs bugtracker-api` for request logs with request IDs.

## Kubernetes (note)

The Docker image is K8s-ready (non-root, healthcheck). In K8s:
`ClusterIP` → `api:4000`, migrate the SQL on boot or via a Job, replace the
in-memory rate limiter with a Redis-backed store before running more than one
replica, and give the pod an IAM-irsa role instead of a static key.

## Backup & rotation

- `pg_dump` nightly to S3 (or use RDS automated backups).
- Rotate `JWT_SECRET` and DB password regularly; existing sessions invalidate
  immediately (stateless JWTs).
- If images must be auditable, replace the current scan gap with a quarantine
  bucket and an S3-triggered ClamAV Lambda (see `docs/NOTES.md`).