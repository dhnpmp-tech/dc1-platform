#!/bin/bash

##
## DC1 P2P Network Health Check
##
## Monitors P2P network health for Phase 1 support:
## - Backend API availability (HTTP provider discovery fallback)
## - Provider count and registration status
## - Recent provider activity
##
## Usage:
##   ./scripts/p2p-health-check.sh
##   ./scripts/p2p-health-check.sh --format json
##   ./scripts/p2p-health-check.sh --backend http://localhost:8083
##

set -u

# Configuration
BACKEND_URL="${1:-http://localhost:8083}"
FORMAT="${FORMAT:-human}"
VERBOSE="${VERBOSE:-0}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend)
      BACKEND_URL="$2"
      shift 2
      ;;
    --format)
      FORMAT="$2"
      shift 2
      ;;
    --verbose|-v)
      VERBOSE=1
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Results object
BOOT_STATUS="unknown"
BOOT_LATENCY=0
PROVIDER_COUNT=0
PROVIDER_STATUS="unknown"
HTTP_STATUS=0
ERRORS=()

# Colors (disable if JSON output)
if [ "$FORMAT" = "json" ]; then
  GREEN=""
  RED=""
  YELLOW=""
  RESET=""
else
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[1;33m'
  RESET='\033[0m'
fi

log_verbose() {
  if [ "$VERBOSE" = "1" ] && [ "$FORMAT" != "json" ]; then
    echo "  [verbose] $1"
  fi
}

log_error() {
  ERRORS+=("$1")
  log_verbose "ERROR: $1"
}

# ── Check Backend Health ───────────────────────────────────────────────────

check_backend_health() {
  if [ "$FORMAT" != "json" ]; then
    echo ""
    echo "[Backend Health Check]"
  fi

  local start_time=$(date +%s%N)
  local http_code=$(curl -sS -o /dev/null -m 5 -w "%{http_code}" "$BACKEND_URL/health" 2>/dev/null || echo "000")
  local end_time=$(date +%s%N)
  local latency_ms=$(( (end_time - start_time) / 1000000 ))

  HTTP_STATUS=$http_code

  if [ "$http_code" = "200" ]; then
    BOOT_STATUS="healthy"
    BOOT_LATENCY=$latency_ms
    if [ "$FORMAT" != "json" ]; then
      echo -e "${GREEN}✓ Backend API responding${RESET} (${latency_ms}ms)"
    fi
  else
    BOOT_STATUS="unhealthy"
    BOOT_LATENCY=$latency_ms
    log_error "Backend returned HTTP $http_code"
    if [ "$FORMAT" != "json" ]; then
      echo -e "${RED}✗ Backend API unhealthy${RESET} (HTTP $http_code)"
    fi
  fi
}

# ── Check Provider Discovery ───────────────────────────────────────────────

check_provider_discovery() {
  if [ "$FORMAT" != "json" ]; then
    echo ""
    echo "[Provider Discovery]"
  fi

  local response=$(curl -sS -m 5 "$BACKEND_URL/api/network/providers?limit=500" 2>/dev/null || echo "")

  if [ -z "$response" ]; then
    log_error "Provider discovery API not responding"
    PROVIDER_STATUS="unavailable"
    if [ "$FORMAT" != "json" ]; then
      echo -e "${RED}✗ Provider discovery unavailable${RESET}"
    fi
    return
  fi

  # Count providers in response (simple JSON array length check)
  local count=$(echo "$response" | grep -o '"id"' | wc -l)
  PROVIDER_COUNT=$count
  PROVIDER_STATUS="available"

  if [ "$count" -gt 0 ]; then
    if [ "$FORMAT" != "json" ]; then
      echo -e "${GREEN}✓ ${count} providers registered${RESET}"
    fi
  else
    if [ "$FORMAT" != "json" ]; then
      echo -e "${YELLOW}⚠ No providers currently available${RESET}"
    fi
  fi

  # Check for recently active providers (last_heartbeat < 90 seconds)
  local active=$(curl -sS -m 5 "$BACKEND_URL/api/network/providers?available=true&limit=500" 2>/dev/null | grep -o '"id"' | wc -l)

  if [ "$FORMAT" != "json" ]; then
    if [ "$active" -gt 0 ]; then
      echo -e "${GREEN}✓ ${active} providers active (< 90s ago)${RESET}"
    else
      echo -e "${YELLOW}⚠ No recently active providers${RESET}"
    fi
  fi
}

# ── Summary ────────────────────────────────────────────────────────────────

print_summary() {
  if [ "$FORMAT" = "json" ]; then
    # JSON output
    cat <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backend": {
    "status": "$BOOT_STATUS",
    "httpCode": $HTTP_STATUS,
    "latencyMs": $BOOT_LATENCY,
    "url": "$BACKEND_URL"
  },
  "providers": {
    "count": $PROVIDER_COUNT,
    "status": "$PROVIDER_STATUS"
  },
  "errors": [$(printf '"%s"' "${ERRORS[@]}" | paste -sd ',' -)]
}
EOF
  else
    # Human-readable output
    echo ""
    echo "[Summary]"

    if [ ${#ERRORS[@]} -eq 0 ]; then
      echo -e "${GREEN}Status: ✓ All systems nominal${RESET}"
    else
      echo -e "${RED}Status: ✗ ${#ERRORS[@]} issue(s) detected${RESET}"
      for error in "${ERRORS[@]}"; do
        echo "  - $error"
      done
    fi

    echo ""
    echo "═══════════════════════════════════════════════════════════"
  fi
}

# ── Main ───────────────────────────────────────────────────────────────────

if [ "$FORMAT" != "json" ]; then
  echo ""
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║  DC1 P2P Network Health Check                             ║"
  echo "║  $(date -u +%Y-%m-%dT%H:%M:%SZ)                               ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
fi

check_backend_health
check_provider_discovery
print_summary

# Exit code
if [ ${#ERRORS[@]} -eq 0 ]; then
  exit 0
else
  exit 1
fi
