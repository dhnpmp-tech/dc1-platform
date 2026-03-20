#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <image-ref> [--fail-on-critical]" >&2
  exit 1
fi

IMAGE_REF="$1"
FAIL_ON_CRITICAL="0"
if [[ "${2:-}" == "--fail-on-critical" ]]; then
  FAIL_ON_CRITICAL="1"
fi

if ! command -v trivy >/dev/null 2>&1; then
  echo "trivy is required but not installed" >&2
  exit 2
fi

mkdir -p .tmp
REPORT_PATH=".tmp/trivy-$(echo "$IMAGE_REF" | tr '/:@' '_').json"

set +e
trivy image --quiet --format json --severity CRITICAL "$IMAGE_REF" > "$REPORT_PATH"
SCAN_EXIT=$?
set -e

if [[ "$SCAN_EXIT" -ne 0 && "$SCAN_EXIT" -ne 1 ]]; then
  echo "Trivy scan failed for $IMAGE_REF" >&2
  exit "$SCAN_EXIT"
fi

CRITICAL_COUNT=$(grep -o '"Severity":"CRITICAL"' "$REPORT_PATH" | wc -l | tr -d ' ')
echo "image_ref=$IMAGE_REF critical_count=$CRITICAL_COUNT report=$REPORT_PATH"

if [[ "$FAIL_ON_CRITICAL" == "1" && "$CRITICAL_COUNT" -gt 0 ]]; then
  echo "Blocking image due to CRITICAL vulnerabilities: $IMAGE_REF" >&2
  exit 1
fi

exit 0
