#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
pm2 restart merchant-appeal || true
echo "BUILD_OK $(date -Iseconds)"
