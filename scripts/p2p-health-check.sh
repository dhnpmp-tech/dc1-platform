#!/bin/bash
# P2P Network Health Check Script
# Purpose: Monitor P2P bootstrap and provider discovery health
# Used by: Phase 1 pre-flight checklist, continuous monitoring
# Owner: P2P Network Engineer

set -euo pipefail

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8083}"
DB_PATH="${DB_PATH:-}"
FORMAT="${1:---text}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Color codes for text output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Initialize health status
HEALTH_OK=true
CHECKS_PASSED=0
CHECKS_FAILED=0

# Helper functions
log_check() {
  local name="$1"
  local status="$2"
  local detail="$3"

  if [[ "$FORMAT" == "--format" && "$2" == "json" ]]; then
    echo "json" > /dev/null  # Placeholder for JSON output
  else
    if [[ "$status" == "✅" ]]; then
      echo -e "${GREEN}$status${NC} $name: $detail"
      ((CHECKS_PASSED++))
    else
      echo -e "${RED}$status${NC} $name: $detail"
      ((CHECKS_FAILED++))
      HEALTH_OK=false
    fi
  fi
}

fail_check() {
  log_check "$1" "❌" "$2"
}

pass_check() {
  log_check "$1" "✅" "$2"
}

# Check 1: Backend API health
check_backend_health() {
  local response
  response=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/health" 2>/dev/null || echo "error\n000")
  local http_code=$(echo "$response" | tail -n1)

  if [[ "$http_code" == "200" ]]; then
    pass_check "Backend Health" "API responding (HTTP $http_code)"
  else
    fail_check "Backend Health" "API not responding (HTTP $http_code)"
  fi
}

# Check 2: Provider registration status
check_provider_registration() {
  if [[ -z "$DB_PATH" ]]; then
    echo "⚠️  Skipping provider registration check (DB_PATH not set)"
    return
  fi

  if [[ ! -f "$DB_PATH" ]]; then
    fail_check "Provider Registration" "Database not found at $DB_PATH"
    return
  fi

  local count=0
  if command -v sqlite3 &> /dev/null; then
    count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM providers WHERE created_at IS NOT NULL;" 2>/dev/null || echo "0")
  else
    fail_check "Provider Registration" "sqlite3 not available"
    return
  fi

  if [[ $count -gt 0 ]]; then
    pass_check "Provider Registration" "$count providers registered"
  else
    fail_check "Provider Registration" "0 providers registered"
  fi
}

# Check 3: Bootstrap connectivity
check_bootstrap_connectivity() {
  local bootstrap_port="${BOOTSTRAP_PORT:-30333}"
  local bootstrap_host="${BOOTSTRAP_HOST:-localhost}"

  if timeout 5 bash -c "echo > /dev/tcp/$bootstrap_host/$bootstrap_port" 2>/dev/null; then
    pass_check "Bootstrap Connectivity" "Bootstrap node reachable at $bootstrap_host:$bootstrap_port"
  else
    fail_check "Bootstrap Connectivity" "Cannot reach bootstrap node at $bootstrap_host:$bootstrap_port"
  fi
}

# Check 4: Provider discovery endpoints
check_discovery_endpoints() {
  local endpoint="$BACKEND_URL/api/providers/discover"
  local response
  response=$(curl -s "$endpoint" 2>/dev/null | head -c 100)

  if [[ -n "$response" ]]; then
    pass_check "Discovery Endpoints" "Provider discovery working"
  else
    fail_check "Discovery Endpoints" "Provider discovery not responding"
  fi
}

# Check 5: P2P service status (via PM2 if available)
check_p2p_service() {
  if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "dc1-provider-onboarding"; then
      local status=$(pm2 list | grep "dc1-provider-onboarding" | awk '{print $10}')
      if [[ "$status" == "online" ]]; then
        pass_check "P2P Service" "dc1-provider-onboarding service running"
      else
        fail_check "P2P Service" "dc1-provider-onboarding service status: $status"
      fi
    else
      fail_check "P2P Service" "dc1-provider-onboarding service not found in PM2"
    fi
  else
    echo "⚠️  PM2 not available, skipping service check"
  fi
}

# Check 6: Network connectivity metrics
check_network_metrics() {
  # Simple connectivity check via ping
  local test_host="8.8.8.8"

  if timeout 3 ping -c 1 "$test_host" &> /dev/null; then
    pass_check "Network Connectivity" "Outbound connectivity verified"
  else
    fail_check "Network Connectivity" "Cannot reach external network (ping test failed)"
  fi
}

# Check 7: Log health (recent errors)
check_log_health() {
  local log_file="${LOG_FILE:-/var/log/dc1-provider-onboarding.log}"

  if [[ ! -f "$log_file" ]]; then
    echo "⚠️  Log file not found at $log_file"
    return
  fi

  local recent_errors=$(tail -100 "$log_file" 2>/dev/null | grep -i "error\|critical" | wc -l)

  if [[ $recent_errors -lt 5 ]]; then
    pass_check "Log Health" "$recent_errors errors in recent logs"
  else
    fail_check "Log Health" "$recent_errors recent errors detected"
  fi
}

# Output formatting
output_text() {
  echo ""
  echo "================================"
  echo "P2P Network Health Check Report"
  echo "Time: $TIMESTAMP"
  echo "================================"
  echo ""
}

output_json() {
  local overall_status="healthy"
  if [[ "$HEALTH_OK" == false ]]; then
    overall_status="unhealthy"
  fi

  cat <<EOF
{
  "timestamp": "$TIMESTAMP",
  "status": "$overall_status",
  "checks_passed": $CHECKS_PASSED,
  "checks_failed": $CHECKS_FAILED,
  "health_ok": $HEALTH_OK
}
EOF
}

# Main execution
main() {
  if [[ "$FORMAT" == "--format" && "$2" == "json" ]]; then
    FORMAT="json"
  fi

  if [[ "$FORMAT" != "json" ]]; then
    output_text
  fi

  # Run all health checks
  check_backend_health
  check_provider_registration
  check_bootstrap_connectivity
  check_discovery_endpoints
  check_p2p_service
  check_network_metrics
  check_log_health

  echo ""

  if [[ "$FORMAT" == "json" ]]; then
    output_json
  else
    if [[ "$HEALTH_OK" == true ]]; then
      echo -e "${GREEN}Overall Status: HEALTHY${NC}"
    else
      echo -e "${RED}Overall Status: UNHEALTHY${NC}"
      echo "Passed: $CHECKS_PASSED | Failed: $CHECKS_FAILED"
    fi
    echo ""
  fi

  # Exit with appropriate code
  if [[ "$HEALTH_OK" == true ]]; then
    exit 0
  else
    exit 1
  fi
}

# Execute
main "$@"
