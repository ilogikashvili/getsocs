#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root/server"
node scripts/collect-infrastructure-baseline.js ../docs/performance/infrastructure.final.local.json
node scripts/benchmark.js --runs="${PERF_RUNS:-3}" --output=../docs/performance/final.local.json "$@"
node scripts/performance-report-markdown.js ../docs/performance/final.local.json ../docs/performance/final.local.md 'Getsocs final benchmark'
echo 'Final performance artifacts written under docs/performance/*.local.* (gitignored).'
