#!/usr/bin/env bash
set -euo pipefail

branch="${1:-feature/performance-upgrade}"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo 'Run this inside the real Getsocs Git repository.' >&2; exit 2; }
cd "$repo_root"

if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Refusing to create performance branch from a dirty working tree.' >&2
  git status --short >&2
  exit 3
fi

commit="$(git rev-parse HEAD)"
current="$(git branch --show-current)"
mkdir -p docs/performance
cat > docs/performance/source-baseline.txt <<META
recorded_at_utc=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
source_branch=$current
source_commit=$commit
performance_branch=$branch
META

git switch -c "$branch"
echo "Created $branch from $current @ $commit"
echo 'Commit docs/performance/source-baseline.txt with the first performance-upgrade change.'
