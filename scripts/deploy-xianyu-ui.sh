#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "[deploy] npm run build..."
npm run build 2>&1 | tee /tmp/merchant-appeal-build.log
if rg -q "数据看板" dist/ 2>/dev/null; then
  echo "[deploy] OK: dist contains 数据看板"
else
  echo "[deploy] WARN: 数据看板 not found in dist — check build log"
  exit 1
fi
if pm2 describe merchant-appeal >/dev/null 2>&1; then
  echo "[deploy] pm2 restart merchant-appeal..."
  pm2 restart merchant-appeal
  sleep 2
  curl -sf "http://127.0.0.1:3003/api/health" && echo "" || echo "[deploy] health check failed"
else
  echo "[deploy] pm2 merchant-appeal not found, skip restart"
fi
echo "[deploy] done. Hard-refresh browser (Ctrl+Shift+R)."
