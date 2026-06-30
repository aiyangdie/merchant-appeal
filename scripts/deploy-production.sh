#!/usr/bin/env bash
# Deploy merchant-appeal dev → appeal.aikex.ink production
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROD="/www/wwwroot/appeal.aikex.ink"
PM2_NAME="merchant-appeal"

echo "==> Build frontend"
cd "$ROOT"
npm run build:appeal-site

echo "==> Sync dist/"
rsync -a --delete "$ROOT/dist/" "$PROD/dist/"

echo "==> Sync server/ (exclude uploads)"
rsync -a \
  --exclude 'node_modules' \
  --exclude 'uploads' \
  "$ROOT/server/" "$PROD/server/"

echo "==> Sync package manifests"
rsync -a "$ROOT/package.json" "$ROOT/package-lock.json" "$PROD/"

echo "==> Install production deps"
cd "$PROD"
npm ci --omit=dev

echo "==> Restart PM2"
pm2 restart "$PM2_NAME"

echo "==> Done. Production: https://appeal.aikex.ink/chat/"
