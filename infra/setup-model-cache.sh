#!/bin/sh
set -eu

CACHE_ROOT="${DCP_MODEL_CACHE_ROOT:-/opt/dcp/model-cache}"
CACHE_OWNER="${DCP_MODEL_CACHE_OWNER:-node:node}"
VOLUME_NAME="${DCP_MODEL_CACHE_VOLUME:-dcp-model-cache}"

log() {
  printf '%s\n' "$1"
}

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return
  fi
  log "error: root privileges are required for $*"
  exit 1
}

ensure_dir() {
  if [ -d "$1" ]; then
    return
  fi
  run_as_root mkdir -p "$1"
}

ensure_dir "$(dirname "$CACHE_ROOT")"
ensure_dir "$CACHE_ROOT"
ensure_dir "$CACHE_ROOT/hf"
ensure_dir "$CACHE_ROOT/vllm"
ensure_dir "$CACHE_ROOT/tmp"

run_as_root chmod 775 "$CACHE_ROOT" "$CACHE_ROOT/hf" "$CACHE_ROOT/vllm" "$CACHE_ROOT/tmp"
run_as_root chown "$CACHE_OWNER" "$CACHE_ROOT" "$CACHE_ROOT/hf" "$CACHE_ROOT/vllm" "$CACHE_ROOT/tmp"

if ! command -v docker >/dev/null 2>&1; then
  log "warning: docker is not installed; skipped volume creation"
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  log "warning: docker daemon is not reachable; skipped volume creation"
  exit 0
fi

if docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  log "volume exists: $VOLUME_NAME"
  exit 0
fi

docker volume create \
  --driver local \
  --opt type=none \
  --opt o=bind \
  --opt device="$CACHE_ROOT" \
  "$VOLUME_NAME" >/dev/null

log "created docker volume $VOLUME_NAME -> $CACHE_ROOT"
