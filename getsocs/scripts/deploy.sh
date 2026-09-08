#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
git pull --ff-only
(cd server && npm ci && npm test && npm audit --omit=dev --audit-level=high)
(cd client && npm ci && CI=true npm test -- --watchAll=false && npm run build && npm audit --omit=dev --audit-level=high)
pm2 reload server/ecosystem.config.js --update-env
sleep 2
curl --fail --silent http://127.0.0.1:${PORT:-3001}/api/health >/dev/null
