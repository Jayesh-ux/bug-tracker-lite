#!/usr/bin/env bash
# Bug Tracker Lite - one-shot deploy script (run on the server).
#
# Assumes:
#   - app lives in /var/www/bugtracker-lite, current user owns it
#   - Node 24 + npm available
#   - PostgreSQL reachable at $DATABASE_URL (exported in backend/.env)
#   - AWS credentials available via IAM instance role or ~/.aws
#
# Usage:  ./deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[1/4] Installing backend dependencies"
(cd backend && npm ci --omit=dev)

echo "[2/4] Building frontend"
(cd frontend && npm ci && npm run build)

echo "[3/4] Installing SPA build to web root"
rm -rf /var/www/bugtracker-lite/*
cp -r frontend/dist/* /var/www/bugtracker-lite/

echo "[4/4] (Re)starting API with PM2"
pm2 startOrReload deploy/ecosystem.config.cjs --env production
pm2 save

echo "Done. Paste `npm ci --omit=dev`  ->  SPA at /var/www/bugtracker-lite, API on :4000"
echo "Then verify:  curl http://127.0.0.1:4000/api/health"