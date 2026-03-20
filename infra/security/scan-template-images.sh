#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCAN_SCRIPT="$SCRIPT_DIR/scan-image.sh"

if [[ ! -x "$SCAN_SCRIPT" ]]; then
  echo "Missing helper script: $SCAN_SCRIPT" >&2
  exit 1
fi

IMAGES=(
  "dcp/pytorch-cuda:latest"
  "dcp/vllm-serve:latest"
  "dcp/training:latest"
  "dcp/rendering:latest"
)

if [[ "$#" -gt 0 ]]; then
  IMAGES=("$@")
fi

FAILED=0
for image in "${IMAGES[@]}"; do
  echo "Scanning $image"
  if ! "$SCAN_SCRIPT" "$image" --fail-on-critical; then
    FAILED=1
  fi
done

if [[ "$FAILED" -ne 0 ]]; then
  echo "One or more template images failed CRITICAL scan gate" >&2
  exit 1
fi

echo "All template images passed CRITICAL scan gate"
