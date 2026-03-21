#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-https://dcp.sa}"
LOCAL_API_HEALTH_URL="${LOCAL_API_HEALTH_URL:-http://127.0.0.1:8083/api/health}"
PUBLIC_API_HEALTH_CANDIDATES="${PUBLIC_API_HEALTH_CANDIDATES:-https://api.dcp.sa/health,https://api.dcp.sa/api/health}"
PM2_APP_NAME="${PM2_APP_NAME:-dc1-provider-onboarding}"
REQUIRED_PM2_SERVICES="${REQUIRED_PM2_SERVICES:-dc1-provider-onboarding,dcp-vps-health-cron,dcp-job-volume-cleanup-cron,dcp-stale-provider-sweep-cron}"
REQUIRED_ENV_VARS="${REQUIRED_ENV_VARS:-DC1_ADMIN_TOKEN,DC1_HMAC_SECRET,FRONTEND_URL,BACKEND_URL}"

timestamp="$(date -u '+%Y-%m-%d %H:%M UTC')"
printf '[DEPLOY CHECK] %s\n' "$timestamp"

fail() {
  printf '[DEPLOY CHECK] FAIL - %s\n' "$1"
  exit 1
}

pass() {
  printf '✓ %s\n' "$1"
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

require_cmd pm2
require_cmd curl
require_cmd node

if ! pm2_json="$(pm2 jlist 2>/dev/null)"; then
  fail "unable to read PM2 process list"
fi

if ! pm2_result="$(PM2_JSON="$pm2_json" REQUIRED_PM2_SERVICES="$REQUIRED_PM2_SERVICES" node -e '
const required = (process.env.REQUIRED_PM2_SERVICES || "")
  .split(",")
  .map((value) => value.trim())
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

if ! env_check_result="$(PM2_JSON="$pm2_json" PM2_APP_NAME="$PM2_APP_NAME" REQUIRED_ENV_VARS="$REQUIRED_ENV_VARS" node -e '
let list;
try {
  list = JSON.parse(process.env.PM2_JSON || "[]");
} catch {
  console.log("invalid pm2 jlist JSON");
  process.exit(1);
}
const appName = process.env.PM2_APP_NAME;
const requiredVars = (process.env.REQUIRED_ENV_VARS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const proc = list.find((item) => item && item.name === appName);
if (!proc) {
  console.log(`${appName} missing`);
  process.exit(1);
}
const env = (proc.pm2_env && (proc.pm2_env.env || proc.pm2_env)) || {};
const missing = [];
for (const key of requiredVars) {
  const raw = env[key];
  const value = typeof raw === "string" ? raw.trim() : String(raw || "").trim();
  if (!value || value === "undefined" || value === "null" || value.startsWith("CHANGE_ME")) {
    missing.push(`${key} invalid`);
  }
}
if (missing.length) {
  console.log(missing.join(", "));
  process.exit(1);
}
console.log(`${requiredVars.length}/${requiredVars.length}`);
')"; then
  fail "PM2 env check failed for ${PM2_APP_NAME}: ${env_check_result}"
fi
pass "PM2 env: ${env_check_result} required vars present"

if ! check_url_health "$LOCAL_API_HEALTH_URL"; then
  fail "Local API health failed at ${LOCAL_API_HEALTH_URL}"
fi
pass "Local API health: 200 + status=ok"

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

frontend_code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$FRONTEND_URL")" || fail "Frontend unreachable (${FRONTEND_URL})"
if [ "$frontend_code" != "200" ]; then
  fail "Frontend returned HTTP ${frontend_code} (${FRONTEND_URL})"
fi
pass "Frontend reachable: ${FRONTEND_URL}"

if ! db_check_output="$(node -e "const db=require('./backend/src/db'); db.prepare('SELECT 1').get(); console.log('DB OK');" 2>&1)"; then
  fail "DB check failed (${db_check_output})"
fi
pass "SQLite connectivity via backend db module"

if ! pm2_log_chunk="$(pm2 logs "$PM2_APP_NAME" --nostream --lines 80 2>&1)"; then
  fail "unable to read PM2 logs for ${PM2_APP_NAME}"
fi
if printf '%s' "$pm2_log_chunk" | grep -Eiq 'FATAL|UnhandledPromiseRejection|EADDRINUSE|SQLITE_'; then
  fail "PM2 logs for ${PM2_APP_NAME} contain fatal signatures in last 80 lines"
fi
pass "PM2 logs: no fatal signatures for ${PM2_APP_NAME}"

printf '[DEPLOY CHECK] PASS\n'
