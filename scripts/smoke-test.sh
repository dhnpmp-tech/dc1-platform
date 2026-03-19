#!/bin/bash

# DCP post-deploy smoke test suite.
# Usage: ./scripts/smoke-test.sh
# Runs 12 frontend/backend/security checks with color-coded PASS/FAIL output.

set -u

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

FRONTEND_BASE="https://dcp.sa"
API_BASE="http://76.13.179.86:8083/api"
CURL_TIMEOUT=20

pass_count=0
fail_count=0
total_count=0

pass() {
  local message="$1"
  echo -e "${GREEN}[PASS]${NC} ${message}"
  pass_count=$((pass_count + 1))
  total_count=$((total_count + 1))
}

fail() {
  local message="$1"
  echo -e "${RED}[FAIL]${NC} ${message}"
  fail_count=$((fail_count + 1))
  total_count=$((total_count + 1))
}

info() {
  local message="$1"
  echo -e "${YELLOW}[INFO]${NC} ${message}"
}

http_code_check() {
  local label="$1"
  local expected_desc="$2"
  local allowed_codes="$3"
  shift 3

  local code
  code=$(curl -sS -m "$CURL_TIMEOUT" -o /dev/null -w "%{http_code}" "$@" 2>/dev/null || echo "000")

  if [[ " ${allowed_codes} " == *" ${code} "* ]]; then
    pass "${label} (HTTP ${code})"
  else
    fail "${label}: expected ${expected_desc}, got HTTP ${code}"
  fi
}

contains_check() {
  local label="$1"
  local needle="$2"
  shift 2

  local body
  body=$(curl -sS -m "$CURL_TIMEOUT" "$@" 2>/dev/null || true)

  if echo "$body" | grep -q "$needle"; then
    pass "${label}"
  else
    fail "${label}: expected to find '${needle}'"
  fi
}

health_payload_check() {
  local body
  body=$(curl -sS -m "$CURL_TIMEOUT" "$API_BASE/health" 2>/dev/null || true)

  if echo "$body" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' \
    && echo "$body" | grep -q '"db"' \
    && echo "$body" | grep -q '"providers"' \
    && echo "$body" | grep -q '"jobs"'; then
    pass "API Health: status ok with db/providers/jobs fields"
  else
    local snippet
    snippet=$(echo "$body" | tr '\n' ' ' | cut -c1-180)
    fail "API Health: expected status ok + db/providers/jobs, got ${snippet}"
  fi
}

info "Running DCP smoke tests against ${FRONTEND_BASE} and ${API_BASE}"

# Frontend (Vercel)
http_code_check "Frontend: dcp.sa returns 200" "HTTP 200" "200" "$FRONTEND_BASE"
contains_check "Frontend: DCP brand found in HTML" "DCP" "$FRONTEND_BASE"
http_code_check "Frontend: /terms returns 200" "HTTP 200" "200" "$FRONTEND_BASE/terms"
http_code_check "Frontend: /privacy returns 200" "HTTP 200" "200" "$FRONTEND_BASE/privacy"
http_code_check "Frontend: /renter/marketplace returns 200" "HTTP 200" "200" "$FRONTEND_BASE/renter/marketplace"

# Backend API (VPS)
health_payload_check
http_code_check "API: /providers/available returns 200" "HTTP 200" "200" "$API_BASE/providers/available"
http_code_check "API: /providers/register invalid payload rejected" "HTTP 400 or 422" "400 422" -X POST -H "Content-Type: application/json" -d '{}' "$API_BASE/providers/register"
http_code_check "API: /renters/me without key is unauthorized" "HTTP 401" "401" "$API_BASE/renters/me"
http_code_check "Admin: /admin/providers without auth is unauthorized" "HTTP 401" "401" "$API_BASE/admin/providers"

# Security checks
http_code_check "Security: free top-up endpoint rejects unsigned request" "HTTP 400/401/403/422" "400 401 403 422" -X POST -H "Content-Type: application/json" -d '{}' "$API_BASE/renters/topup"
http_code_check "Security: admin dashboard without x-admin-token is unauthorized" "HTTP 401" "401" "$API_BASE/admin/dashboard"

echo ""
echo "Summary: ${pass_count}/${total_count} passed, ${fail_count} failed"

if [ "$fail_count" -gt 0 ]; then
  exit 1
fi

exit 0
