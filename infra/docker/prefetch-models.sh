#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

CACHE_ROOT="${DCP_MODEL_CACHE_ROOT:-/opt/dcp/model-cache}"
VOLUME_NAME="${DCP_MODEL_CACHE_VOLUME:-dcp-model-cache}"
PYTHON_IMAGE="${DCP_PREFETCH_IMAGE:-python:3.11-slim}"
HF_TOKEN="${HF_TOKEN:-}"

LLAMA3_REPO="${DCP_LLAMA3_REPO:-NousResearch/Meta-Llama-3-8B}"
MISTRAL_REPO="${DCP_MISTRAL_REPO:-mistralai/Mistral-7B-Instruct-v0.2}"

log() {
  printf '%s\n' "$1"
}

if [ ! -x "$REPO_ROOT/infra/setup-model-cache.sh" ]; then
  log "error: missing setup script at $REPO_ROOT/infra/setup-model-cache.sh"
  exit 1
fi

"$REPO_ROOT/infra/setup-model-cache.sh"

if ! command -v docker >/dev/null 2>&1; then
  log "error: docker is required"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  log "error: docker daemon is not reachable"
  exit 1
fi

docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1 || {
  log "error: docker volume not found: $VOLUME_NAME"
  exit 1
}

pull_one() {
  model_name="$1"
  model_repo="$2"

  log "prefetch start: $model_name ($model_repo)"

  docker run --rm \
    -e HF_HOME=/cache/hf \
    -e TRANSFORMERS_CACHE=/cache/hf \
    -e HUGGINGFACE_HUB_CACHE=/cache/hf \
    -e HF_TOKEN="$HF_TOKEN" \
    -e DCP_MODEL_REPO="$model_repo" \
    -v "$VOLUME_NAME:/cache" \
    "$PYTHON_IMAGE" \
    sh -c "pip install --quiet --no-cache-dir huggingface_hub >/dev/null && python -c \"import os; from huggingface_hub import snapshot_download; token = os.environ.get('HF_TOKEN') or None; repo = os.environ['DCP_MODEL_REPO']; snapshot_download(repo_id=repo, cache_dir='/cache/hf', local_dir_use_symlinks=False, token=token, resume_download=True); print('cached: ' + repo)\""

  log "prefetch done: $model_name"
}

pull_one "llama3-8b" "$LLAMA3_REPO"
pull_one "mistral-7b" "$MISTRAL_REPO"

if command -v df >/dev/null 2>&1; then
  log "cache disk usage:"
  df -h "$CACHE_ROOT" || true
fi

log "model prefetch complete"
