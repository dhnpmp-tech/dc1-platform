#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

VERIFY_DEPLOY_SCRIPT="${VERIFY_DEPLOY_SCRIPT:-$REPO_ROOT/infra/scripts/verify-deploy.sh}"
VERIFY_RUNTIME_SCRIPT="${VERIFY_RUNTIME_SCRIPT:-$REPO_ROOT/infra/scripts/verify-runtime-baseline.sh}"
DEPLOY_TEMPLATES_SCRIPT="${DEPLOY_TEMPLATES_SCRIPT:-$REPO_ROOT/infra/scripts/deploy-templates.sh}"
PLATFORM_SMOKE_SCRIPT="${PLATFORM_SMOKE_SCRIPT:-$REPO_ROOT/scripts/smoke-test.sh}"

API_BASE="${DCP_API_BASE:-http://127.0.0.1:8083/api}"
ARTIFACT_ROOT="${POST_DEPLOY_ARTIFACT_ROOT:-$REPO_ROOT/infra/artifacts/post-deploy}"
BATCH_LABEL="${BATCH_LABEL:-manual}"

RUN_RUNTIME_BASELINE=1
RUN_TEMPLATE_SMOKE=1
RUN_PLATFORM_SMOKE=1

usage() {
  cat <<'USAGE'
Usage:
  ./infra/scripts/post-deploy-verify.sh [options]

Options:
  --batch LABEL            Label for this deploy run (default: manual)
  --api-base URL           API base used for template smoke checks
  --artifact-root PATH     Root directory for verification artifacts
  --skip-runtime-baseline  Skip infra/scripts/verify-runtime-baseline.sh
  --skip-template-smoke    Skip infra/scripts/deploy-templates.sh --skip-scan
  --skip-platform-smoke    Skip scripts/smoke-test.sh
  --help                   Show this help

Exit codes:
  0  all enabled stages passed
  1  one or more stages failed
  2  invalid usage or missing executable dependency
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --batch)
      BATCH_LABEL="${2:-}"
      shift 2
      ;;
    --api-base)
      API_BASE="${2:-}"
      shift 2
      ;;
    --artifact-root)
      ARTIFACT_ROOT="${2:-}"
      shift 2
      ;;
    --skip-runtime-baseline)
      RUN_RUNTIME_BASELINE=0
      shift
      ;;
    --skip-template-smoke)
      RUN_TEMPLATE_SMOKE=0
      shift
      ;;
    --skip-platform-smoke)
      RUN_PLATFORM_SMOKE=0
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[post-deploy-verify] Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$BATCH_LABEL" ]]; then
  echo "[post-deploy-verify] --batch cannot be empty" >&2
  exit 2
fi

if [[ ! -x "$VERIFY_DEPLOY_SCRIPT" ]]; then
  echo "[post-deploy-verify] Missing executable: $VERIFY_DEPLOY_SCRIPT" >&2
  exit 2
fi
if [[ $RUN_RUNTIME_BASELINE -eq 1 && ! -x "$VERIFY_RUNTIME_SCRIPT" ]]; then
  echo "[post-deploy-verify] Missing executable: $VERIFY_RUNTIME_SCRIPT" >&2
  exit 2
fi
if [[ $RUN_TEMPLATE_SMOKE -eq 1 && ! -x "$DEPLOY_TEMPLATES_SCRIPT" ]]; then
  echo "[post-deploy-verify] Missing executable: $DEPLOY_TEMPLATES_SCRIPT" >&2
  exit 2
fi
if [[ $RUN_PLATFORM_SMOKE -eq 1 && ! -x "$PLATFORM_SMOKE_SCRIPT" ]]; then
  echo "[post-deploy-verify] Missing executable: $PLATFORM_SMOKE_SCRIPT" >&2
  exit 2
fi

run_id="$(date -u +'%Y%m%dT%H%M%SZ')"
run_dir="$ARTIFACT_ROOT/$run_id-$BATCH_LABEL"
mkdir -p "$run_dir"

summary_file="$run_dir/summary.txt"
json_file="$run_dir/summary.json"

declare -A STAGE_STATUS

echo "[post-deploy-verify] run_id=$run_id batch=$BATCH_LABEL"
echo "[post-deploy-verify] artifacts=$run_dir"

write_summary_header() {
  {
    echo "Post-deploy verification"
    echo "run_id: $run_id"
    echo "batch: $BATCH_LABEL"
    echo "started_at_utc: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
    echo "api_base: $API_BASE"
    echo "artifacts_dir: $run_dir"
    echo
    echo "Stages"
  } >"$summary_file"
}

run_stage() {
  local stage_key="$1"
  local stage_name="$2"
  shift 2

  local log_file="$run_dir/${stage_key}.log"
  local started_at ended_at exit_code
  started_at="$(date -u +'%Y-%m-%d %H:%M:%S UTC')"

  echo "[post-deploy-verify] START $stage_name"
  {
    echo "[$started_at] START $stage_name"
    echo "[$started_at] CMD   $*"
  } >>"$summary_file"

  "$@" >"$log_file" 2>&1
  exit_code=$?
  ended_at="$(date -u +'%Y-%m-%d %H:%M:%S UTC')"

  if [[ $exit_code -eq 0 ]]; then
    STAGE_STATUS["$stage_key"]="PASS"
    echo "[post-deploy-verify] PASS  $stage_name"
    echo "[$ended_at] PASS  $stage_name (log: $log_file)" >>"$summary_file"
  else
    STAGE_STATUS["$stage_key"]="FAIL"
    echo "[post-deploy-verify] FAIL  $stage_name (see $log_file)"
    echo "[$ended_at] FAIL  $stage_name (log: $log_file)" >>"$summary_file"
  fi
  echo >>"$summary_file"
}

write_summary_header

run_stage "verify_deploy" "infra verify-deploy" "$VERIFY_DEPLOY_SCRIPT"

if [[ $RUN_RUNTIME_BASELINE -eq 1 ]]; then
  run_stage "verify_runtime" "infra verify-runtime-baseline" "$VERIFY_RUNTIME_SCRIPT"
else
  STAGE_STATUS["verify_runtime"]="SKIP"
  echo "[post-deploy-verify] SKIP  infra verify-runtime-baseline"
  echo "[skip] infra verify-runtime-baseline" >>"$summary_file"
  echo >>"$summary_file"
fi

if [[ $RUN_TEMPLATE_SMOKE -eq 1 ]]; then
  run_stage "template_smoke" "infra deploy-templates smoke" "$DEPLOY_TEMPLATES_SCRIPT" --api-base "$API_BASE" --skip-scan
else
  STAGE_STATUS["template_smoke"]="SKIP"
  echo "[post-deploy-verify] SKIP  infra deploy-templates smoke"
  echo "[skip] infra deploy-templates smoke" >>"$summary_file"
  echo >>"$summary_file"
fi

if [[ $RUN_PLATFORM_SMOKE -eq 1 ]]; then
  run_stage "platform_smoke" "platform smoke-test" "$PLATFORM_SMOKE_SCRIPT"
else
  STAGE_STATUS["platform_smoke"]="SKIP"
  echo "[post-deploy-verify] SKIP  platform smoke-test"
  echo "[skip] platform smoke-test" >>"$summary_file"
  echo >>"$summary_file"
fi

overall="PASS"
for key in verify_deploy verify_runtime template_smoke platform_smoke; do
  status="${STAGE_STATUS[$key]:-SKIP}"
  if [[ "$status" == "FAIL" ]]; then
    overall="FAIL"
  fi
done

{
  echo "Result"
  echo "overall: $overall"
  echo "finished_at_utc: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
} >>"$summary_file"

cat >"$json_file" <<JSON
{
  "run_id": "$run_id",
  "batch": "$BATCH_LABEL",
  "api_base": "$API_BASE",
  "artifacts_dir": "$run_dir",
  "overall": "$overall",
  "stages": {
    "verify_deploy": "${STAGE_STATUS[verify_deploy]:-SKIP}",
    "verify_runtime": "${STAGE_STATUS[verify_runtime]:-SKIP}",
    "template_smoke": "${STAGE_STATUS[template_smoke]:-SKIP}",
    "platform_smoke": "${STAGE_STATUS[platform_smoke]:-SKIP}"
  },
  "summary_file": "$summary_file"
}
JSON

echo "[post-deploy-verify] overall=$overall"
echo "[post-deploy-verify] summary=$summary_file"
echo "[post-deploy-verify] summary_json=$json_file"

if [[ "$overall" == "PASS" ]]; then
  exit 0
fi
exit 1
