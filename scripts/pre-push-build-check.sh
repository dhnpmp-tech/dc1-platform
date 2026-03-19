#!/usr/bin/env bash
# DC1 Pre-push Build Guard
#
# Runs `npm run build` before every push to catch broken builds locally
# before they reach Vercel.
#
# INSTALL (one-time, from repo root):
#   cp scripts/pre-push-build-check.sh .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push
#
# Or use a symlink so it stays in sync with the repo:
#   ln -sf ../../scripts/pre-push-build-check.sh .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push
#
# To SKIP for a single push (not recommended):
#   git push --no-verify

set -euo pipefail

echo "▶ DC1 pre-push: running Next.js build check..."

export BACKEND_URL="${BACKEND_URL:-http://76.13.179.86:8083}"

if ! npm run build; then
  echo ""
  echo "✗ Next.js build FAILED. Push aborted."
  echo "  Fix the build errors above, then push again."
  echo "  (Use 'git push --no-verify' only in emergencies.)"
  exit 1
fi

echo "✓ Build passed — pushing."
exit 0
