#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root/server"
node scripts/collect-infrastructure-baseline.js ../docs/performance/infrastructure.local.json
node scripts/benchmark.js --runs="${PERF_RUNS:-3}" --output=../docs/performance/baseline.local.json "$@"
node scripts/performance-report-markdown.js ../docs/performance/baseline.local.json ../docs/performance/baseline.local.md 'Getsocs baseline benchmark'
echo 'Baseline artifacts written under docs/performance/*.local.* (gitignored).'
