#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

API_BASE="${DCP_API_BASE:-https://api.dcp.sa/api}"
RENTER_KEY="${DCP_RENTER_KEY:-}"
TARGET_SECONDS="${DCP_TOP3_STARTUP_SLA_SECONDS:-60}"
POLL_INTERVAL_SECONDS="${DCP_TOP3_POLL_INTERVAL_SECONDS:-5}"
POLL_TIMEOUT_SECONDS="${DCP_TOP3_POLL_TIMEOUT_SECONDS:-900}"
OUTPUT_DIR="${DCP_TOP3_ARTIFACT_DIR:-$REPO_ROOT/docs/reports/reliability}"
TEMPLATES_CSV="${DCP_TOP3_TEMPLATES:-allam-7b-instruct,falcon-h1-arabic-7b,jais-13b-chat}"

usage() {
  cat <<'USAGE'
Usage:
  ./infra/scripts/publish-prefetch-top3.sh [options]

Description:
  Deploys the top-3 Arabic templates, polls each job until startup, and emits
  SLA evidence artifacts with explicit pass/fail against deploy->startup target.

Required authentication:
  DCP_RENTER_KEY (or --renter-key)

Options:
  --api-base URL            API base URL (default: https://api.dcp.sa/api)
  --renter-key KEY          Renter API key used for deploy + job polling
  --templates CSV           Template IDs CSV (default top-3 set)
  --target-seconds N        SLA threshold in seconds (default: 60)
  --poll-interval N         Poll interval seconds (default: 5)
  --poll-timeout N          Per-template poll timeout seconds (default: 900)
  --output-dir PATH         Artifact output directory
  --help                    Show this help

Artifacts:
  <output-dir>/prefetch-top3-sla-<timestamp>.json
  <output-dir>/prefetch-top3-sla-<timestamp>.md
  <output-dir>/prefetch-top3-sla-latest.json
  <output-dir>/prefetch-top3-sla-latest.md
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base)
      API_BASE="${2:-}"
      shift 2
      ;;
    --renter-key)
      RENTER_KEY="${2:-}"
      shift 2
      ;;
    --templates)
      TEMPLATES_CSV="${2:-}"
      shift 2
      ;;
    --target-seconds)
      TARGET_SECONDS="${2:-}"
      shift 2
      ;;
    --poll-interval)
      POLL_INTERVAL_SECONDS="${2:-}"
      shift 2
      ;;
    --poll-timeout)
      POLL_TIMEOUT_SECONDS="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[prefetch-top3] Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$RENTER_KEY" ]]; then
  echo "[prefetch-top3] DCP_RENTER_KEY is required (or pass --renter-key)" >&2
  exit 2
fi

if ! [[ "$TARGET_SECONDS" =~ ^[0-9]+$ ]] || [[ "$TARGET_SECONDS" -le 0 ]]; then
  echo "[prefetch-top3] --target-seconds must be a positive integer" >&2
  exit 2
fi

if ! [[ "$POLL_INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || [[ "$POLL_INTERVAL_SECONDS" -le 0 ]]; then
  echo "[prefetch-top3] --poll-interval must be a positive integer" >&2
  exit 2
fi

if ! [[ "$POLL_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || [[ "$POLL_TIMEOUT_SECONDS" -le 0 ]]; then
  echo "[prefetch-top3] --poll-timeout must be a positive integer" >&2
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[prefetch-top3] curl is required" >&2
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  echo "[prefetch-top3] node is required" >&2
  exit 2
fi

API_BASE="${API_BASE%/}"
mkdir -p "$OUTPUT_DIR"

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
json_artifact="$OUTPUT_DIR/prefetch-top3-sla-${timestamp}.json"
md_artifact="$OUTPUT_DIR/prefetch-top3-sla-${timestamp}.md"
latest_json="$OUTPUT_DIR/prefetch-top3-sla-latest.json"
latest_md="$OUTPUT_DIR/prefetch-top3-sla-latest.md"

results_ndjson="$(mktemp)"
cleanup() {
  rm -f "$results_ndjson"
}
trap cleanup EXIT

IFS=',' read -r -a templates <<<"$TEMPLATES_CSV"
if [[ "${#templates[@]}" -eq 0 ]]; then
  echo "[prefetch-top3] no templates provided" >&2
  exit 2
fi

echo "[prefetch-top3] api_base=$API_BASE"
echo "[prefetch-top3] templates=$TEMPLATES_CSV"
echo "[prefetch-top3] target_seconds=$TARGET_SECONDS poll_interval=$POLL_INTERVAL_SECONDS poll_timeout=$POLL_TIMEOUT_SECONDS"

poll_for_startup() {
  local template_id="$1"
  local job_id="$2"
  local started_epoch="$(date +%s)"

  while true; do
    local now_epoch elapsed
    now_epoch="$(date +%s)"
    elapsed="$((now_epoch - started_epoch))"
    if [[ "$elapsed" -gt "$POLL_TIMEOUT_SECONDS" ]]; then
      node -e "
const templateId = process.argv[1];
const jobId = process.argv[2];
const timeoutSec = Number(process.argv[3]);
process.stdout.write(JSON.stringify({
  template_id: templateId,
  job_id: jobId,
  verdict: 'fail',
  status: 'timeout',
  startup_seconds: null,
  target_seconds: Number(process.argv[4]),
  error: 'Timed out waiting for job start',
  timed_out_after_seconds: timeoutSec,
}) + '\\n');
" "$template_id" "$job_id" "$POLL_TIMEOUT_SECONDS" "$TARGET_SECONDS"
      return 1
    fi

    local response http_code body
    response="$(curl -sS -L -H "x-renter-key: $RENTER_KEY" -w $'\n%{http_code}' "$API_BASE/renters/me/jobs/$job_id")" || {
      node -e "
const templateId = process.argv[1];
const jobId = process.argv[2];
process.stdout.write(JSON.stringify({
  template_id: templateId,
  job_id: jobId,
  verdict: 'fail',
  status: 'poll_error',
  startup_seconds: null,
  target_seconds: Number(process.argv[3]),
  error: 'Failed to query renter job endpoint',
}) + '\\n');
" "$template_id" "$job_id" "$TARGET_SECONDS"
      return 1
    }

    http_code="$(printf '%s' "$response" | tail -n1)"
    body="$(printf '%s' "$response" | sed '$d')"

    if [[ "$http_code" != "200" ]]; then
      node -e "
const templateId = process.argv[1];
const jobId = process.argv[2];
const statusCode = Number(process.argv[3]);
const body = process.argv[4];
process.stdout.write(JSON.stringify({
  template_id: templateId,
  job_id: jobId,
  verdict: 'fail',
  status: 'poll_http_error',
  startup_seconds: null,
  target_seconds: Number(process.argv[5]),
  error: 'Polling endpoint returned non-200',
  http_status: statusCode,
  response_body: body,
}) + '\\n');
" "$template_id" "$job_id" "$http_code" "$body" "$TARGET_SECONDS"
      return 1
    fi

    local poll_json
    poll_json="$(node -e "
const payload = JSON.parse(process.argv[1]);
const targetSeconds = Number(process.argv[2]);
const templateId = process.argv[3];
const jobId = process.argv[4];
const job = payload && payload.job ? payload.job : null;
if (!job) {
  process.stdout.write(JSON.stringify({
    template_id: templateId,
    job_id: jobId,
    verdict: 'fail',
    status: 'invalid_payload',
    startup_seconds: null,
    target_seconds: targetSeconds,
    error: 'Missing job object in response',
  }));
  process.exit(0);
}
const status = String(job.status || '').toLowerCase();
const submittedAt = job.submitted_at || job.created_at || null;
const startedAt = job.started_at || job.first_token_at || null;
if (startedAt && submittedAt) {
  const submittedMs = Date.parse(submittedAt);
  const startedMs = Date.parse(startedAt);
  if (Number.isFinite(submittedMs) && Number.isFinite(startedMs) && startedMs >= submittedMs) {
    const startupSeconds = Math.round((startedMs - submittedMs) / 10) / 100;
    const verdict = startupSeconds < targetSeconds ? 'pass' : 'fail';
    process.stdout.write(JSON.stringify({
      template_id: templateId,
      job_id: jobId,
      verdict,
      status,
      startup_seconds: startupSeconds,
      target_seconds: targetSeconds,
      submitted_at: submittedAt,
      started_at: startedAt,
      completed_at: job.completed_at || null,
      provider_id: job.provider_id || null,
      job_type: job.job_type || null,
      poll_state: 'started',
    }));
    process.exit(0);
  }
}
if (['failed', 'cancelled', 'permanently_failed'].includes(status)) {
  process.stdout.write(JSON.stringify({
    template_id: templateId,
    job_id: jobId,
    verdict: 'fail',
    status,
    startup_seconds: null,
    target_seconds: targetSeconds,
    submitted_at: submittedAt,
    started_at: startedAt,
    completed_at: job.completed_at || null,
    provider_id: job.provider_id || null,
    job_type: job.job_type || null,
    poll_state: 'terminal_before_start',
    error: 'Job reached terminal state before startup timestamp',
  }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({
  template_id: templateId,
  job_id: jobId,
  verdict: 'pending',
  status,
  startup_seconds: null,
  target_seconds: targetSeconds,
  submitted_at: submittedAt,
  started_at: startedAt,
  completed_at: job.completed_at || null,
  provider_id: job.provider_id || null,
  job_type: job.job_type || null,
  poll_state: 'waiting',
}));
" "$body" "$TARGET_SECONDS" "$template_id" "$job_id")"

    local verdict
    verdict="$(node -e "const r = JSON.parse(process.argv[1]); process.stdout.write(String(r.verdict || 'fail'));" "$poll_json")"

    if [[ "$verdict" == "pending" ]]; then
      sleep "$POLL_INTERVAL_SECONDS"
      continue
    fi

    printf '%s\n' "$poll_json"
    if [[ "$verdict" == "pass" ]]; then
      return 0
    fi
    return 1
  done
}

overall="pass"

for template_id in "${templates[@]}"; do
  template_id="$(printf '%s' "$template_id" | xargs)"
  if [[ -z "$template_id" ]]; then
    continue
  fi

  echo "[prefetch-top3] deploy template=$template_id"
  deploy_payload='{"duration_minutes":60,"pricing_class":"standard"}'
  deploy_response="$(curl -sS -L -H "Content-Type: application/json" -H "x-renter-key: $RENTER_KEY" -w $'\n%{http_code}' -X POST "$API_BASE/templates/$template_id/deploy" -d "$deploy_payload")" || {
    echo "[prefetch-top3] deploy request failed template=$template_id"
    node -e "
const templateId = process.argv[1];
const target = Number(process.argv[2]);
process.stdout.write(JSON.stringify({
  template_id: templateId,
  job_id: null,
  verdict: 'fail',
  status: 'deploy_request_error',
  startup_seconds: null,
  target_seconds: target,
  error: 'Deploy request failed to execute',
}) + '\\n');
" "$template_id" "$TARGET_SECONDS" >> "$results_ndjson"
    overall="fail"
    continue
  }

  deploy_http_code="$(printf '%s' "$deploy_response" | tail -n1)"
  deploy_body="$(printf '%s' "$deploy_response" | sed '$d')"

  if [[ "$deploy_http_code" != "200" && "$deploy_http_code" != "201" ]]; then
    echo "[prefetch-top3] deploy rejected template=$template_id http=$deploy_http_code"
    node -e "
const templateId = process.argv[1];
const target = Number(process.argv[2]);
const code = Number(process.argv[3]);
const body = process.argv[4];
process.stdout.write(JSON.stringify({
  template_id: templateId,
  job_id: null,
  verdict: 'fail',
  status: 'deploy_http_error',
  startup_seconds: null,
  target_seconds: target,
  http_status: code,
  error: 'Deploy endpoint returned non-success status',
  response_body: body,
}) + '\\n');
" "$template_id" "$TARGET_SECONDS" "$deploy_http_code" "$deploy_body" >> "$results_ndjson"
    overall="fail"
    continue
  fi

  job_id="$(node -e "
const payload = JSON.parse(process.argv[1]);
const id = payload.jobId || payload.job_id || null;
if (!id) process.exit(1);
process.stdout.write(String(id));
" "$deploy_body" 2>/dev/null || true)"

  if [[ -z "$job_id" ]]; then
    echo "[prefetch-top3] deploy response missing job id template=$template_id"
    node -e "
const templateId = process.argv[1];
const target = Number(process.argv[2]);
const body = process.argv[3];
process.stdout.write(JSON.stringify({
  template_id: templateId,
  job_id: null,
  verdict: 'fail',
  status: 'deploy_invalid_payload',
  startup_seconds: null,
  target_seconds: target,
  error: 'Deploy response missing job id',
  response_body: body,
}) + '\\n');
" "$template_id" "$TARGET_SECONDS" "$deploy_body" >> "$results_ndjson"
    overall="fail"
    continue
  fi

  echo "[prefetch-top3] poll template=$template_id job_id=$job_id"
  if poll_result="$(poll_for_startup "$template_id" "$job_id")"; then
    printf '%s\n' "$poll_result" >> "$results_ndjson"
  else
    printf '%s\n' "$poll_result" >> "$results_ndjson"
    overall="fail"
  fi

done

NDJSON_PATH="$results_ndjson" \
JSON_OUT="$json_artifact" \
MD_OUT="$md_artifact" \
LATEST_JSON="$latest_json" \
LATEST_MD="$latest_md" \
API_BASE_ENV="$API_BASE" \
TARGET_SECONDS_ENV="$TARGET_SECONDS" \
TEMPLATES_CSV_ENV="$TEMPLATES_CSV" \
OVERALL_STATUS_ENV="$overall" \
node <<'NODE'
const fs = require('fs');
const path = require('path');

const ndjsonPath = process.env.NDJSON_PATH;
const jsonOut = process.env.JSON_OUT;
const mdOut = process.env.MD_OUT;
const latestJson = process.env.LATEST_JSON;
const latestMd = process.env.LATEST_MD;
const apiBase = process.env.API_BASE_ENV;
const targetSeconds = Number(process.env.TARGET_SECONDS_ENV || '60');
const templatesCsv = process.env.TEMPLATES_CSV_ENV || '';
const overallStatus = process.env.OVERALL_STATUS_ENV || 'fail';

const lines = fs.readFileSync(ndjsonPath, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
const results = lines.map((line) => {
  try {
    return JSON.parse(line);
  } catch {
    return {
      template_id: 'unknown',
      verdict: 'fail',
      status: 'invalid_result_line',
      startup_seconds: null,
      target_seconds: targetSeconds,
      error: `Invalid result JSON line: ${line}`,
    };
  }
});

const passCount = results.filter((r) => r.verdict === 'pass').length;
const failCount = results.filter((r) => r.verdict !== 'pass').length;
const readiness = overallStatus === 'pass' && failCount === 0 ? 'pass' : 'fail';

const artifact = {
  contract: 'dcp.prefetch_top3_sla.v1',
  generated_at: new Date().toISOString(),
  command: './infra/scripts/publish-prefetch-top3.sh',
  api_base: apiBase,
  target_seconds: targetSeconds,
  templates: templatesCsv.split(',').map((value) => value.trim()).filter(Boolean),
  summary: {
    readiness,
    pass_count: passCount,
    fail_count: failCount,
    total: results.length,
  },
  results,
};

fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
fs.writeFileSync(jsonOut, JSON.stringify(artifact, null, 2));
fs.copyFileSync(jsonOut, latestJson);

const linesMd = [];
linesMd.push('# Prefetch Top-3 Startup SLA Evidence');
linesMd.push('');
linesMd.push(`- Generated at: ${artifact.generated_at}`);
linesMd.push(`- Command: \`${artifact.command}\``);
linesMd.push(`- API base: \`${apiBase}\``);
linesMd.push(`- Target startup SLA: \`<${targetSeconds}s\``);
linesMd.push(`- Readiness: **${readiness.toUpperCase()}**`);
linesMd.push('');
linesMd.push('| Template | Job ID | Status | Startup (s) | SLA | Verdict |');
linesMd.push('|---|---|---|---:|---:|---|');
for (const result of results) {
  const startup = Number.isFinite(result.startup_seconds) ? result.startup_seconds.toFixed(2) : '-';
  const verdict = String(result.verdict || 'fail').toUpperCase();
  linesMd.push(`| ${result.template_id || '-'} | ${result.job_id || '-'} | ${result.status || '-'} | ${startup} | <${targetSeconds} | ${verdict} |`);
}
if (results.some((result) => result.error)) {
  linesMd.push('');
  linesMd.push('## Failure Details');
  linesMd.push('');
  for (const result of results) {
    if (!result.error) continue;
    linesMd.push(`- **${result.template_id || 'unknown'}**: ${result.error}`);
  }
}

fs.writeFileSync(mdOut, `${linesMd.join('\n')}\n`);
fs.copyFileSync(mdOut, latestMd);
NODE

echo "[prefetch-top3] artifact_json=$json_artifact"
echo "[prefetch-top3] artifact_md=$md_artifact"
echo "[prefetch-top3] latest_json=$latest_json"
echo "[prefetch-top3] latest_md=$latest_md"

if [[ "$overall" == "pass" ]]; then
  echo "[prefetch-top3] PASS"
  exit 0
fi

echo "[prefetch-top3] FAIL"
exit 1
