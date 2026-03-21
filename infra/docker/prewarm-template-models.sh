#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATES_DIR="${DCP_TEMPLATES_DIR:-$REPO_ROOT/docker-templates}"

DEFAULT_TEMPLATE_IDS="vllm-serve,stable-diffusion,lora-finetune,qlora-finetune"
TEMPLATE_IDS_CSV="${DCP_PREWARM_TEMPLATE_IDS:-$DEFAULT_TEMPLATE_IDS}"
POLICY="${DCP_TEMPLATE_PREWARM_POLICY:-hot-warm}" # hot-only | hot-warm | all
STRICT_MODE="${DCP_TEMPLATE_PREWARM_STRICT:-0}"

CACHE_ROOT="${DCP_MODEL_CACHE_ROOT:-/opt/dcp/model-cache}"
VOLUME_NAME="${DCP_MODEL_CACHE_VOLUME:-dcp-model-cache}"
PYTHON_IMAGE="${DCP_PREFETCH_IMAGE:-python:3.11-slim}"
HF_TOKEN="${HF_TOKEN:-}"
DISK_HIGH_WATERMARK_PCT="${DCP_CACHE_HIGH_WATERMARK_PCT:-90}"

log() {
  printf '%s\n' "$1"
}

usage() {
  cat <<'USAGE'
Usage:
  prewarm-template-models.sh [--templates id1,id2,...] [--policy hot-only|hot-warm|all] [--strict]

Defaults:
  --templates vllm-serve,stable-diffusion,lora-finetune,qlora-finetune
  --policy hot-warm

Environment:
  DCP_MODEL_CACHE_ROOT          Host model cache root (default: /opt/dcp/model-cache)
  DCP_MODEL_CACHE_VOLUME        Docker volume name (default: dcp-model-cache)
  DCP_PREFETCH_IMAGE            Python image for downloads (default: python:3.11-slim)
  DCP_PREWARM_TEMPLATE_IDS      CSV template IDs override
  DCP_TEMPLATE_PREWARM_POLICY   hot-only|hot-warm|all
  DCP_TEMPLATE_PREWARM_STRICT   1 to fail on first model prewarm error
  DCP_CACHE_HIGH_WATERMARK_PCT  Skip non-hot model pulls above this disk usage (default: 90)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --templates)
      TEMPLATE_IDS_CSV="${2:-}"
      shift 2
      ;;
    --policy)
      POLICY="${2:-}"
      shift 2
      ;;
    --strict)
      STRICT_MODE="1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$TEMPLATES_DIR" ]]; then
  echo "Templates directory not found: $TEMPLATES_DIR" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "docker daemon is not reachable" >&2
  exit 1
fi

if ! docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  echo "docker volume not found: $VOLUME_NAME" >&2
  exit 1
fi

is_policy_enabled() {
  local cache_policy="$1"
  case "$POLICY" in
    hot-only) [[ "$cache_policy" == "hot" ]] ;;
    hot-warm) [[ "$cache_policy" == "hot" || "$cache_policy" == "warm" ]] ;;
    all) [[ "$cache_policy" == "hot" || "$cache_policy" == "warm" || "$cache_policy" == "cold" ]] ;;
    *)
      echo "Unsupported policy: $POLICY" >&2
      exit 1
      ;;
  esac
}

cache_usage_pct() {
  local usage
  usage="$(df -P "$CACHE_ROOT" 2>/dev/null | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
  case "${usage:-}" in
    ''|*[!0-9]*) echo 0 ;;
    *) echo "$usage" ;;
  esac
}

model_rows="$(
  node - "$TEMPLATES_DIR" "$TEMPLATE_IDS_CSV" <<'NODE'
const fs = require('fs');
const path = require('path');

const templatesDir = process.argv[2];
const csv = process.argv[3] || '';
const ids = csv
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const files = fs.readdirSync(templatesDir).filter((file) => file.endsWith('.json'));
const templates = files.map((file) => {
  const fullPath = path.join(templatesDir, file);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
});

const byId = new Map(templates.map((template) => [template.id, template]));
for (const id of ids) {
  const template = byId.get(id);
  if (!template) {
    console.error(`missing template id: ${id}`);
    process.exitCode = 1;
    continue;
  }
  const policy = (
    template &&
    template.model_cache &&
    typeof template.model_cache.default_policy === 'string' &&
    template.model_cache.default_policy.trim()
  ) || 'warm';

  let model = '';
  if (Array.isArray(template.env_vars)) {
    const modelVar = template.env_vars.find((entry) => entry && entry.key === 'MODEL_ID');
    const baseVar = template.env_vars.find((entry) => entry && entry.key === 'BASE_MODEL');
    model = (modelVar && modelVar.default) || (baseVar && baseVar.default) || '';
  }
  if (!model && template.params && typeof template.params.model === 'string') {
    model = template.params.model;
  }

  if (!model) {
    console.error(`template has no prewarm model: ${id}`);
    process.exitCode = 1;
    continue;
  }

  console.log(`${id}|${policy}|${model}`);
}
NODE
)"

if [[ -z "$model_rows" ]]; then
  echo "No prewarm models resolved from templates: $TEMPLATE_IDS_CSV" >&2
  exit 1
fi

errors=0
prefetched=0
skipped=0

while IFS='|' read -r template_id cache_policy model_repo; do
  [[ -n "$template_id" ]] || continue
  [[ -n "$model_repo" ]] || continue

  if ! is_policy_enabled "$cache_policy"; then
    log "skip $template_id ($model_repo): policy $cache_policy not enabled by $POLICY"
    skipped=$((skipped + 1))
    continue
  fi

  usage_pct="$(cache_usage_pct)"
  if [[ "$usage_pct" -ge "$DISK_HIGH_WATERMARK_PCT" && "$cache_policy" != "hot" ]]; then
    log "skip $template_id ($model_repo): cache usage ${usage_pct}% >= ${DISK_HIGH_WATERMARK_PCT}%"
    skipped=$((skipped + 1))
    continue
  fi

  log "prefetch start: template=$template_id policy=$cache_policy model=$model_repo"
  if docker run --rm \
    -e HF_HOME=/cache/hf \
    -e TRANSFORMERS_CACHE=/cache/hf \
    -e HUGGINGFACE_HUB_CACHE=/cache/hf \
    -e HF_TOKEN="$HF_TOKEN" \
    -e DCP_MODEL_REPO="$model_repo" \
    -v "$VOLUME_NAME:/cache" \
    "$PYTHON_IMAGE" \
    sh -c "pip install --quiet --no-cache-dir huggingface_hub >/dev/null && python -c \"import os; from huggingface_hub import snapshot_download; token=os.environ.get('HF_TOKEN') or None; repo=os.environ['DCP_MODEL_REPO']; snapshot_download(repo_id=repo, cache_dir='/cache/hf', local_dir_use_symlinks=False, token=token, resume_download=True); print('cached: ' + repo)\""; then
    prefetched=$((prefetched + 1))
    log "prefetch done: template=$template_id model=$model_repo"
  else
    errors=$((errors + 1))
    log "prefetch failed: template=$template_id model=$model_repo"
    if [[ "$STRICT_MODE" == "1" ]]; then
      exit 1
    fi
  fi
done <<< "$model_rows"

log "template prewarm complete (prefetched=$prefetched, skipped=$skipped, errors=$errors, policy=$POLICY)"
if [[ "$errors" -gt 0 ]]; then
  exit 1
fi
