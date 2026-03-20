#!/usr/bin/env bash
set -u

SERVICES=(
  "dc1-mission-control"
  "mission-control-api"
  "dc1-provider-onboarding"
  "dc1-webhook"
)

timestamp="$(date -u '+%Y-%m-%d %H:%M UTC')"
printf '[DEPLOY CHECK] %s\n' "$timestamp"

fail() {
  printf '[DEPLOY CHECK] FAIL — %s\n' "$1"
  exit 1
}

# 1) PM2 process health
if ! command -v pm2 >/dev/null 2>&1; then
  fail "pm2 is not installed or not in PATH"
fi

if ! pm2_json="$(pm2 jlist 2>/dev/null)"; then
  fail "unable to read PM2 process list"
fi

if ! pm2_result="$(PM2_JSON="$pm2_json" node -e '
const required = ["dc1-mission-control", "mission-control-api", "dc1-provider-onboarding", "dc1-webhook"];
let list;
try {
  list = JSON.parse(process.env.PM2_JSON || "[]");
} catch (err) {
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
  fail "PM2 ${pm2_result}"
fi
printf '✓ PM2: %s services online\n' "$pm2_result"

# 2) API health endpoint
api_response="$(curl -sS -w '\n%{http_code}' http://localhost:8083/api/health)" || fail "API health endpoint unreachable"
api_code="$(printf '%s' "$api_response" | tail -n1)"
api_body="$(printf '%s' "$api_response" | sed '$d')"

if [ "$api_code" != "200" ]; then
  fail "API health HTTP ${api_code}"
fi

if ! API_BODY="$api_body" node -e '
try {
  const body = JSON.parse(process.env.API_BODY || "{}");
  if (body.status !== "ok") process.exit(1);
} catch (_) {
  process.exit(1);
}
'; then
  fail "API health response missing {\"status\":\"ok\"}"
fi
printf '✓ API health: 200 OK\n'

# 3) Frontend reachable
frontend_code="$(curl -sS -o /dev/null -w '%{http_code}' https://dcp.sa)" || fail "Frontend unreachable"
if [ "$frontend_code" != "200" ]; then
  fail "Frontend HTTP ${frontend_code}"
fi
printf '✓ Frontend: 200 OK\n'

# 4) SQLite connectivity through backend db module
if ! db_check_output="$(node -e "const db=require('./backend/src/db'); db.prepare('SELECT 1').get(); console.log('DB OK');" 2>&1)"; then
  fail "DB check failed (${db_check_output})"
fi
printf '✓ DB: connected\n'

# 5) PM2 recent logs clean
if ! pm2_log_chunk="$(pm2 logs --nostream --lines 50 2>&1)"; then
  fail "unable to read PM2 logs"
fi

if printf '%s' "$pm2_log_chunk" | grep -Eiq 'ERROR|FATAL'; then
  fail "PM2 logs contain ERROR/FATAL in last 50 lines"
fi
printf '✓ Logs: clean\n'

printf '[DEPLOY CHECK] PASS\n'
exit 0
