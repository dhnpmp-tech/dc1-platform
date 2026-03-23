#!/bin/bash
#
# P2P Network Setup Validation Script
# Validates DCP P2P infrastructure readiness for Phase 1 launch
#
# Usage: bash scripts/validate-p2p-setup.sh [--bootstrap-addr <addr>] [--api-base <url>]
#
# Features:
# - Verify bootstrap node connectivity
# - Check provider heartbeat endpoint
# - Validate database P2P configuration
# - Test DHT peer ID storage
# - Verify backend P2P service status
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${API_BASE:-https://api.dcp.sa}"
BOOTSTRAP_ADDR="${BOOTSTRAP_ADDR:-/ip4/76.13.179.86/tcp/4001}"
DB_PATH="${DB_PATH:-}"
PROVIDER_KEY="${PROVIDER_KEY:-}"

# Counters
PASS=0
FAIL=0
WARN=0

# Helper functions
print_header() {
  echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASS++))
}

print_fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAIL++))
}

print_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARN++))
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --bootstrap-addr)
      BOOTSTRAP_ADDR="$2"
      shift 2
      ;;
    --api-base)
      API_BASE="$2"
      shift 2
      ;;
    --db-path)
      DB_PATH="$2"
      shift 2
      ;;
    --provider-key)
      PROVIDER_KEY="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Header
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     DCP P2P Network Setup Validation — Phase 1 Launch     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Test 1: Bootstrap Node Connectivity
print_header "1. Bootstrap Node Connectivity"

BOOTSTRAP_IP=$(echo "$BOOTSTRAP_ADDR" | grep -oP '(?<=/ip4/)[^/]+' || true)
BOOTSTRAP_PORT=$(echo "$BOOTSTRAP_ADDR" | grep -oP '(?<=/tcp/)\d+' || true)

if [ -z "$BOOTSTRAP_IP" ] || [ -z "$BOOTSTRAP_PORT" ]; then
  print_warn "Could not parse bootstrap address: $BOOTSTRAP_ADDR"
else
  if timeout 5 bash -c "echo > /dev/tcp/$BOOTSTRAP_IP/$BOOTSTRAP_PORT" 2>/dev/null; then
    print_pass "Bootstrap node reachable at $BOOTSTRAP_IP:$BOOTSTRAP_PORT"
  else
    print_fail "Cannot reach bootstrap node at $BOOTSTRAP_IP:$BOOTSTRAP_PORT"
    print_warn "  - Check firewall allows TCP $BOOTSTRAP_PORT"
    print_warn "  - Check bootstrap node is running: pm2 logs dc1-p2p-bootstrap"
  fi
fi

# Test 2: API Health Check
print_header "2. Backend API Health"

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/health" 2>/dev/null || echo "")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
  print_pass "Backend API responding at $API_BASE"
else
  print_fail "Backend API not responding (HTTP $HTTP_CODE)"
fi

# Test 3: Heartbeat Endpoint
print_header "3. Provider Heartbeat Endpoint"

HEARTBEAT_RESPONSE=$(curl -s -X POST "$API_BASE/api/providers/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{"api_key":"test-validation-key"}' 2>/dev/null || echo "")

if echo "$HEARTBEAT_RESPONSE" | grep -q "api_key required\|Invalid API key"; then
  print_pass "Heartbeat endpoint is operational"
else
  print_fail "Heartbeat endpoint not responding properly"
  print_warn "  Response: $HEARTBEAT_RESPONSE"
fi

# Test 4: Database Configuration (if DB_PATH provided)
if [ -n "$DB_PATH" ] && [ -f "$DB_PATH" ]; then
  print_header "4. Database P2P Configuration"

  # Check if p2p_peer_id column exists
  if sqlite3 "$DB_PATH" ".schema providers" | grep -q "p2p_peer_id"; then
    print_pass "Database has p2p_peer_id column"
  else
    print_fail "Database missing p2p_peer_id column"
  fi

  # Count providers with peer IDs
  PROVIDER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM providers WHERE p2p_peer_id IS NOT NULL;" 2>/dev/null || echo "0")
  if [ "$PROVIDER_COUNT" -gt 0 ]; then
    print_pass "Found $PROVIDER_COUNT providers with P2P peer IDs"
  else
    print_warn "No providers with peer IDs yet (expected on first run)"
  fi

  # Count online providers
  ONLINE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM providers WHERE status='online' AND last_heartbeat > datetime('now', '-5 minutes');" 2>/dev/null || echo "0")
  if [ "$ONLINE_COUNT" -gt 0 ]; then
    print_pass "Found $ONLINE_COUNT online providers (heartbeat < 5 min old)"
  else
    print_warn "No online providers found (may be normal on first run)"
  fi
else
  print_header "4. Database P2P Configuration"
  print_warn "Database path not provided (use --db-path)"
fi

# Test 5: Provider Daemon Configuration (if PROVIDER_KEY provided)
if [ -n "$PROVIDER_KEY" ]; then
  print_header "5. Provider Profile & Heartbeat"

  PROFILE_RESPONSE=$(curl -s -H "X-Provider-Key: $PROVIDER_KEY" \
    "$API_BASE/api/providers/me" 2>/dev/null || echo "")

  if echo "$PROFILE_RESPONSE" | grep -q '"provider"'; then
    print_pass "Provider profile accessible"

    LAST_HEARTBEAT=$(echo "$PROFILE_RESPONSE" | grep -o '"last_heartbeat":"[^"]*"' | head -1 || echo "")
    if [ -n "$LAST_HEARTBEAT" ]; then
      print_pass "Provider has heartbeat record: $LAST_HEARTBEAT"
    else
      print_warn "Provider heartbeat not yet recorded"
    fi
  else
    print_fail "Cannot access provider profile"
    print_warn "  - Check PROVIDER_KEY: $PROVIDER_KEY"
    print_warn "  - Check provider is approved"
  fi
else
  print_header "5. Provider Profile & Heartbeat"
  print_warn "Provider key not provided (use --provider-key)"
fi

# Test 6: Environment Variables
print_header "6. P2P Environment Variables"

if [ -n "$P2P_DISCOVERY_ENABLED" ]; then
  if [ "$P2P_DISCOVERY_ENABLED" = "true" ]; then
    print_pass "P2P_DISCOVERY_ENABLED = true"
  else
    print_warn "P2P_DISCOVERY_ENABLED = $P2P_DISCOVERY_ENABLED (should be true)"
  fi
else
  print_warn "P2P_DISCOVERY_ENABLED not set"
fi

if [ -n "$DCP_P2P_BOOTSTRAP" ]; then
  print_pass "DCP_P2P_BOOTSTRAP = $DCP_P2P_BOOTSTRAP"
else
  print_warn "DCP_P2P_BOOTSTRAP not set (will use default)"
fi

if [ -n "$DEFAULT_HEARTBEAT_INTERVAL_MS" ]; then
  print_pass "DEFAULT_HEARTBEAT_INTERVAL_MS = $DEFAULT_HEARTBEAT_INTERVAL_MS"
else
  print_warn "DEFAULT_HEARTBEAT_INTERVAL_MS not set (default: 30000)"
fi

# Test 7: File System Checks
print_header "7. P2P Module Files"

required_files=(
  "p2p/heartbeat-protocol.js"
  "p2p/dcp-discovery-scaffold.js"
  "p2p/dc1-node.js"
  "p2p/bootstrap.js"
  "backend/src/services/p2p-discovery.js"
  "backend/src/routes/providers.js"
)

for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    print_pass "Found $file"
  else
    print_fail "Missing $file"
  fi
done

# Test 8: Dependencies
print_header "8. P2P Dependencies"

if [ -d "p2p/node_modules" ]; then
  print_pass "P2P node_modules installed"

  if grep -q "@libp2p/kad-dht" "p2p/package.json"; then
    print_pass "libp2p kad-dht dependency declared"
  else
    print_fail "libp2p kad-dht not in package.json"
  fi

  if grep -q "@libp2p/circuit-relay-v2" "p2p/package.json"; then
    print_pass "libp2p circuit-relay-v2 dependency declared"
  else
    print_warn "libp2p circuit-relay-v2 not declared (optional for Phase 1)"
  fi
else
  print_fail "P2P node_modules not installed"
  print_warn "  Run: cd p2p && npm install"
fi

# Test 9: Documentation
print_header "9. P2P Documentation"

docs=(
  "docs/P2P-STATUS-PHASE-1.md"
  "docs/P2P-BOOTSTRAP-DEPLOYMENT.md"
  "docs/P2P-E2E-SMOKE-TEST-GUIDE.md"
  "docs/P2P-OPERATOR-CONFIG-GUIDE.md"
)

for doc in "${docs[@]}"; do
  if [ -f "$doc" ]; then
    print_pass "Found $doc"
  else
    print_fail "Missing $doc"
  fi
done

# Summary
print_header "Summary"

TOTAL=$((PASS + FAIL + WARN))
echo "Tests run: $TOTAL"
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo -e "  ${YELLOW}Warnings: $WARN${NC}"

if [ $FAIL -eq 0 ]; then
  if [ $WARN -eq 0 ]; then
    echo -e "\n${GREEN}✓ All P2P checks passed! Ready for Phase 1 launch.${NC}\n"
    exit 0
  else
    echo -e "\n${YELLOW}⚠ All critical checks passed, but review warnings above.${NC}\n"
    exit 0
  fi
else
  echo -e "\n${RED}✗ P2P setup validation failed. See errors above.${NC}\n"
  exit 1
fi
