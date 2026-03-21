#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

CACHE_ROOT="${DCP_MODEL_CACHE_ROOT:-/opt/dcp/model-cache}"
VOLUME_NAME="${DCP_MODEL_CACHE_VOLUME:-dcp-model-cache}"
PYTHON_IMAGE="${DCP_PREFETCH_IMAGE:-python:3.11-slim}"
HF_TOKEN="${HF_TOKEN:-}"
PORTFOLIO_FILE="${DCP_ARABIC_PORTFOLIO_FILE:-$REPO_ROOT/infra/config/arabic-portfolio.json}"
PORTFOLIO_TIER="${DCP_PREWARM_TIER:-tier_a}"
PREWARM_POLICY="${DCP_PREWARM_POLICY:-hot-warm}" # hot-only | hot-warm | all
DISK_HIGH_WATERMARK_PCT="${DCP_CACHE_HIGH_WATERMARK_PCT:-90}"

LLAMA3_REPO="${DCP_LLAMA3_REPO:-meta-llama/Meta-Llama-3-8B-Instruct}"
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

cache_usage_pct() {
  if ! command -v df >/dev/null 2>&1; then
    echo 0
    return
  fi
  usage="$(df -P "$CACHE_ROOT" 2>/dev/null | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
  case "${usage:-}" in
    ''|*[!0-9]*) echo 0 ;;
    *) echo "$usage" ;;
  esac
}

is_class_enabled() {
  model_class="$1"
  case "$PREWARM_POLICY" in
    hot-only) [ "$model_class" = "hot" ] ;;
    hot-warm) [ "$model_class" = "hot" ] || [ "$model_class" = "warm" ] ;;
    all) [ "$model_class" = "hot" ] || [ "$model_class" = "warm" ] || [ "$model_class" = "cold" ] ;;
    *)
      log "warning: unknown DCP_PREWARM_POLICY='$PREWARM_POLICY', defaulting to hot-warm"
      [ "$model_class" = "hot" ] || [ "$model_class" = "warm" ]
      ;;
  esac
}

emit_portfolio_models() {
  if [ ! -f "$PORTFOLIO_FILE" ]; then
    return 1
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$PORTFOLIO_FILE" "$PORTFOLIO_TIER" <<'PY'
import json
import sys

portfolio_file = sys.argv[1]
tier = sys.argv[2].strip().lower()

with open(portfolio_file, "r", encoding="utf-8") as f:
    data = json.load(f)

tiers = data.get("tiers", {})
if tier in ("all", "*"):
    keys = sorted(tiers.keys())
else:
    keys = [tier]

for key in keys:
    for model in tiers.get(key, []):
        model_id = str(model.get("id", "")).strip()
        repo = str(model.get("repo", "")).strip()
        klass = str(model.get("prewarm_class", "warm")).strip().lower()
        if model_id and repo:
            print(f"{model_id}|{repo}|{klass}")
PY
    return $?
  fi

  docker run --rm \
    -v "$PORTFOLIO_FILE:/tmp/portfolio.json:ro" \
    "$PYTHON_IMAGE" \
    python - "/tmp/portfolio.json" "$PORTFOLIO_TIER" <<'PY'
import json
import sys

portfolio_file = sys.argv[1]
tier = sys.argv[2].strip().lower()

with open(portfolio_file, "r", encoding="utf-8") as f:
    data = json.load(f)

tiers = data.get("tiers", {})
if tier in ("all", "*"):
    keys = sorted(tiers.keys())
else:
    keys = [tier]

for key in keys:
    for model in tiers.get(key, []):
        model_id = str(model.get("id", "")).strip()
        repo = str(model.get("repo", "")).strip()
        klass = str(model.get("prewarm_class", "warm")).strip().lower()
        if model_id and repo:
            print(f"{model_id}|{repo}|{klass}")
PY
  return $?
}

prefetched_count=0
skipped_count=0

if emit_portfolio_models >/tmp/dcp_prefetch_models.$$ 2>/tmp/dcp_prefetch_models_err.$$; then
  if [ ! -s /tmp/dcp_prefetch_models.$$ ]; then
    log "warning: no models found for tier '$PORTFOLIO_TIER' in $PORTFOLIO_FILE"
  fi

  while IFS='|' read -r model_id model_repo model_class; do
    [ -n "$model_id" ] || continue
    [ -n "$model_repo" ] || continue
    [ -n "$model_class" ] || model_class="warm"

    if ! is_class_enabled "$model_class"; then
      skipped_count=$((skipped_count + 1))
      continue
    fi

    usage_pct="$(cache_usage_pct)"
    if [ "$usage_pct" -ge "$DISK_HIGH_WATERMARK_PCT" ] && [ "$model_class" != "hot" ]; then
      log "skip $model_id (class=$model_class): cache usage ${usage_pct}% >= ${DISK_HIGH_WATERMARK_PCT}%"
      skipped_count=$((skipped_count + 1))
      continue
    fi

    pull_one "$model_id" "$model_repo"
    prefetched_count=$((prefetched_count + 1))
  done < /tmp/dcp_prefetch_models.$$
else
  log "warning: falling back to legacy two-model prefetch"
  if [ -s /tmp/dcp_prefetch_models_err.$$ ]; then
    cat /tmp/dcp_prefetch_models_err.$$ >&2 || true
  fi
  pull_one "llama3-8b" "$LLAMA3_REPO"
  pull_one "mistral-7b" "$MISTRAL_REPO"
  prefetched_count=2
fi

rm -f /tmp/dcp_prefetch_models.$$ /tmp/dcp_prefetch_models_err.$$ || true

if command -v df >/dev/null 2>&1; then
  log "cache disk usage:"
  df -h "$CACHE_ROOT" || true
fi

log "model prefetch complete (prefetched=$prefetched_count, skipped=$skipped_count, tier=$PORTFOLIO_TIER, policy=$PREWARM_POLICY)"
