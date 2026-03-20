#!/usr/bin/env bash
set -euo pipefail

PAYLOAD_PATH="${DCP_JOB_PAYLOAD_PATH:-/opt/dcp/input/job_payload.json}"
OUTPUT_DIR="${DCP_OUTPUT_DIR:-/opt/dcp/output}"
MODEL_PATH="${DCP_MODEL_PATH:-/opt/dcp/model}"
CONTAINER_TYPE="${DCP_CONTAINER_TYPE:-unknown}"

if [[ ! -f "$PAYLOAD_PATH" ]]; then
  echo "Payload file not found: $PAYLOAD_PATH" >&2
  exit 2
fi

mkdir -p "$OUTPUT_DIR"

exec python3 /opt/dcp/bin/run_payload.py \
  --container-type "$CONTAINER_TYPE" \
  --payload "$PAYLOAD_PATH" \
  --model-path "$MODEL_PATH" \
  --output-dir "$OUTPUT_DIR"
