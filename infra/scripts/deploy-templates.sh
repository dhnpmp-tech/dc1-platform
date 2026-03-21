#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

VALIDATOR_SCRIPT="$REPO_ROOT/backend/src/scripts/validate-deploy-templates.js"
CACHE_SETUP_SCRIPT="$REPO_ROOT/infra/setup-model-cache.sh"
PREWARM_SCRIPT="$REPO_ROOT/infra/docker/prewarm-template-models.sh"
SCAN_SCRIPT="$REPO_ROOT/infra/security/scan-template-images.sh"

RUN_PREWARM=1
RUN_SCAN=1
RUN_SMOKE=1
API_BASE="${DCP_API_BASE:-http://127.0.0.1:8083/api}"

usage() {
  cat <<'USAGE'
Usage:
  ./infra/scripts/deploy-templates.sh [options]

Options:
  --api-base URL        API base for smoke checks (default: http://127.0.0.1:8083/api)
  --skip-prewarm        Skip template model prewarm stage
  --skip-scan           Skip template image security scan stage
  --skip-smoke          Skip API smoke checks stage
  --help                Show this help

Environment:
  DCP_API_BASE                API base URL (same as --api-base)
  DCP_PREWARM_TEMPLATE_IDS    Template IDs for prewarm CSV
  DCP_TEMPLATE_PREWARM_POLICY hot-only|hot-warm|all
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base)
      API_BASE="${2:-}"
      shift 2
      ;;
    --skip-prewarm)
      RUN_PREWARM=0
      shift
      ;;
    --skip-scan)
      RUN_SCAN=0
      shift
      ;;
    --skip-smoke)
      RUN_SMOKE=0
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

log() {
  printf '[deploy-templates] %s\n' "$1"
}

require_file() {
  local file_path="$1"
  if [[ ! -f "$file_path" ]]; then
    echo "Missing required file: $file_path" >&2
    exit 1
  fi
}

require_exec() {
  local executable="$1"
  if [[ ! -x "$executable" ]]; then
    echo "Missing executable script: $executable" >&2
    exit 1
  fi
}

require_file "$VALIDATOR_SCRIPT"
require_exec "$CACHE_SETUP_SCRIPT"
require_exec "$PREWARM_SCRIPT"
require_exec "$SCAN_SCRIPT"

log "validate docker template JSON schema + required IDs"
node "$VALIDATOR_SCRIPT"

log "ensure model cache + docker volume"
"$CACHE_SETUP_SCRIPT"

if [[ "$RUN_PREWARM" -eq 1 ]]; then
  log "prewarm launch-critical template models"
  "$PREWARM_SCRIPT"
else
  log "skip prewarm stage"
fi

if [[ "$RUN_SCAN" -eq 1 ]]; then
  if command -v trivy >/dev/null 2>&1; then
    log "scan template runtime images for CRITICAL vulnerabilities"
    "$SCAN_SCRIPT"
  else
    log "trivy not installed; skipping image vulnerability scan"
  fi
else
  log "skip image scan stage"
fi

if [[ "$RUN_SMOKE" -eq 1 ]]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required for smoke checks" >&2
    exit 1
  fi

  log "smoke check GET $API_BASE/templates"
  templates_response="$(curl -fsS "$API_BASE/templates")"

  log "smoke check GET $API_BASE/templates/whitelist"
  whitelist_response="$(curl -fsS "$API_BASE/templates/whitelist")"

  TEMPLATES_RESPONSE="$templates_response" WHITELIST_RESPONSE="$whitelist_response" node - <<'NODE'
const templatesResponse = JSON.parse(process.env.TEMPLATES_RESPONSE || '{}');
const whitelistResponse = JSON.parse(process.env.WHITELIST_RESPONSE || '{}');

if (!Array.isArray(templatesResponse.templates)) {
  throw new Error('templates endpoint returned invalid payload');
}
if (typeof templatesResponse.count !== 'number') {
  throw new Error('templates endpoint missing count');
}
if (!Array.isArray(whitelistResponse.approved_images)) {
  throw new Error('whitelist endpoint returned invalid payload');
}
console.log(`smoke_ok templates=${templatesResponse.count} whitelist=${whitelistResponse.approved_images.length}`);
NODE
else
  log "skip API smoke checks"
fi

log "PASS"
