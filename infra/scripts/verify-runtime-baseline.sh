#!/usr/bin/env bash
set -euo pipefail

LOCAL_API_HEALTH_URL="${LOCAL_API_HEALTH_URL:-http://127.0.0.1:8083/api/health}"
PUBLIC_API_HEALTH_CANDIDATES="${PUBLIC_API_HEALTH_CANDIDATES:-https://api.dcp.sa/health,https://api.dcp.sa/api/health}"
REQUIRED_PM2_SERVICES="${REQUIRED_PM2_SERVICES:-dc1-provider-onboarding,dcp-vps-health-cron,dcp-job-volume-cleanup-cron,dcp-stale-provider-sweep-cron}"
RUN_JOB_SCRIPT="${RUN_JOB_SCRIPT:-infra/docker/run-job.sh}"

log() {
  printf '[RUNTIME BASELINE] %s\n' "$1"
}

pass() {
  printf '✓ %s\n' "$1"
}

fail() {
  printf '[RUNTIME BASELINE] FAIL - %s\n' "$1"
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "$cmd is not installed or not in PATH"
}

check_health_json() {
  local body="$1"
  HEALTH_BODY="$body" node -e '
try {
  const payload = JSON.parse(process.env.HEALTH_BODY || "{}");
  if (payload.status !== "ok") process.exit(1);
} catch {
  process.exit(1);
}
'
}

check_url_health() {
  local url="$1"
  local response
  local code
  local body

  response="$(curl -sS -L --max-time 10 -w '\n%{http_code}' "$url")" || return 2
  code="$(printf '%s' "$response" | tail -n1)"
  body="$(printf '%s' "$response" | sed '$d')"

  if [ "$code" != "200" ]; then
    return 3
  fi
  check_health_json "$body" || return 4
  return 0
}

assert_script_contains() {
  local needle="$1"
  if ! grep -Fq -- "$needle" "$RUN_JOB_SCRIPT"; then
    fail "${RUN_JOB_SCRIPT} missing hardening control: ${needle}"
  fi
}

log "$(date -u '+%Y-%m-%d %H:%M UTC')"
require_cmd curl
require_cmd node
require_cmd pm2
require_cmd docker

if [[ ! -f "$RUN_JOB_SCRIPT" ]]; then
  fail "run-job script not found at ${RUN_JOB_SCRIPT}"
fi

if ! docker info >/dev/null 2>&1; then
  fail 'docker daemon is not reachable'
fi
pass 'Docker daemon reachable'

if ! pm2_json="$(pm2 jlist 2>/dev/null)"; then
  fail 'unable to read PM2 process list'
fi

if ! pm2_result="$(PM2_JSON="$pm2_json" REQUIRED_PM2_SERVICES="$REQUIRED_PM2_SERVICES" node -e '
const required = (process.env.REQUIRED_PM2_SERVICES || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
let list;
try {
  list = JSON.parse(process.env.PM2_JSON || "[]");
} catch {
  console.log("invalid pm2 jlist JSON");
  process.exit(1);
}
const statusByName = new Map();
for (const proc of list) {
  const name = proc && proc.name;
  const status = proc && proc.pm2_env ? proc.pm2_env.status : undefined;
  if (name) statusByName.set(name, status || "unknown");
}
const failures = [];
for (const svc of required) {
  const status = statusByName.get(svc);
  if (!status) failures.push(`${svc} missing`);
  else if (status !== "online") failures.push(`${svc} is ${status}`);
}
if (failures.length) {
  console.log(failures.join(", "));
  process.exit(1);
}
console.log(`${required.length}/${required.length}`);
')"; then
  fail "PM2 service check failed: ${pm2_result}"
fi
pass "PM2: ${pm2_result} required services online"

if ! check_url_health "$LOCAL_API_HEALTH_URL"; then
  fail "Local API health failed at ${LOCAL_API_HEALTH_URL}"
fi
pass 'Local API health: 200 + status=ok'

IFS=',' read -r -a public_candidates <<<"$PUBLIC_API_HEALTH_CANDIDATES"
public_ok=""
for candidate in "${public_candidates[@]}"; do
  candidate="$(printf '%s' "$candidate" | xargs)"
  [ -n "$candidate" ] || continue
  if check_url_health "$candidate"; then
    public_ok="$candidate"
    break
  fi
done
if [ -z "$public_ok" ]; then
  fail "Public API health failed for all candidates: ${PUBLIC_API_HEALTH_CANDIDATES}"
fi
pass "Public API health: ${public_ok}"

assert_script_contains '--network none'
assert_script_contains '--memory-swap "$memory"'
assert_script_contains '--security-opt no-new-privileges:true'
assert_script_contains '--cap-drop ALL'
assert_script_contains '--read-only'
assert_script_contains '--pids-limit "$pids_limit"'
pass "Runtime launcher controls present in ${RUN_JOB_SCRIPT}"

log 'PASS'
