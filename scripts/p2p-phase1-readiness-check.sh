#!/bin/bash
# P2P Phase 1 Readiness Check — Validates bootstrap deployment and provider discovery
# Run this immediately after Phase 1 bootstrap deployment to verify network is ready
# P2P Network Engineer (DCP-612 Phase 4 Validation)

set -e

RESET='\033[0m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'

passed=0
failed=0

echo -e "${BLUE}========================================${RESET}"
echo -e "${BLUE}P2P Phase 1 Readiness Check${RESET}"
echo -e "${BLUE}========================================${RESET}"
echo ""

# Check 1: Bootstrap peer ID is injected
echo -e "${BLUE}[1/8]${RESET} Checking bootstrap peer ID injection..."
if grep -q "REPLACE_WITH_BOOTSTRAP_PEER_ID" p2p/dc1-node.js; then
    echo -e "${RED}✗ FAILED${RESET}: Bootstrap peer ID NOT injected (placeholder still present)"
    failed=$((failed + 1))
else
    peer_id=$(grep "p2p/" p2p/dc1-node.js | grep -oE "12D3Koo[A-Za-z0-9]{44}" | head -1)
    if [ -n "$peer_id" ]; then
        echo -e "${GREEN}✓ PASSED${RESET}: Peer ID injected: $peer_id"
        passed=$((passed + 1))
    else
        echo -e "${RED}✗ FAILED${RESET}: Could not extract valid peer ID from config"
        failed=$((failed + 1))
    fi
fi
echo ""

# Check 2: Backend config has been updated
echo -e "${BLUE}[2/8]${RESET} Checking backend service configuration..."
if pm2 list | grep -q "dc1-provider-onboarding.*online"; then
    echo -e "${GREEN}✓ PASSED${RESET}: Backend service (dc1-provider-onboarding) is online"
    passed=$((passed + 1))
else
    echo -e "${YELLOW}⚠ WARNING${RESET}: Backend service status not found or offline"
    failed=$((failed + 1))
fi
echo ""

# Check 3: Bootstrap node is running (on VPS)
echo -e "${BLUE}[3/8]${RESET} Checking bootstrap node status..."
if ssh -o ConnectTimeout=5 root@76.13.179.86 "pm2 list | grep -q dc1-p2p-bootstrap" 2>/dev/null; then
    echo -e "${GREEN}✓ PASSED${RESET}: Bootstrap node (dc1-p2p-bootstrap) running on VPS"
    passed=$((passed + 1))
else
    echo -e "${RED}✗ FAILED${RESET}: Cannot verify bootstrap running on VPS (may need SSH)"
    failed=$((failed + 1))
fi
echo ""

# Check 4: P2P DHT is initialized
echo -e "${BLUE}[4/8]${RESET}: Checking P2P DHT initialization..."
if [ -f "p2p/package.json" ] && grep -q "@libp2p/kad-dht" p2p/package.json; then
    echo -e "${GREEN}✓ PASSED${RESET}: P2P DHT dependencies installed"
    passed=$((passed + 1))
else
    echo -e "${RED}✗ FAILED${RESET}: P2P DHT dependencies not found"
    failed=$((failed + 1))
fi
echo ""

# Check 5: Provider heartbeat endpoint is operational
echo -e "${BLUE}[5/8]${RESET} Checking provider heartbeat endpoint..."
if curl -s -f http://localhost:8083/api/providers/heartbeat >/dev/null 2>&1 || \
   curl -s -f https://api.dcp.sa/api/providers/heartbeat >/dev/null 2>&1; then
    echo -e "${GREEN}✓ PASSED${RESET}: Provider heartbeat endpoint responding"
    passed=$((passed + 1))
else
    echo -e "${YELLOW}⚠ WARNING${RESET}: Cannot reach heartbeat endpoint (may be due to auth)"
    failed=$((failed + 1))
fi
echo ""

# Check 6: Provider database schema is ready
echo -e "${BLUE}[6/8]${RESET} Checking provider database schema..."
if [ -f "backend/data/dc1.db" ]; then
    echo -e "${GREEN}✓ PASSED${RESET}: Provider database exists"
    passed=$((passed + 1))
else
    echo -e "${RED}✗ FAILED${RESET}: Provider database not found"
    failed=$((failed + 1))
fi
echo ""

# Check 7: Validation scripts are available
echo -e "${BLUE}[7/8]${RESET} Checking validation scripts..."
if [ -f "scripts/validate-p2p-setup.sh" ] && [ -x "scripts/validate-p2p-setup.sh" ]; then
    echo -e "${GREEN}✓ PASSED${RESET}: P2P validation script available"
    passed=$((passed + 1))
else
    echo -e "${RED}✗ FAILED${RESET}: P2P validation script not found or not executable"
    failed=$((failed + 1))
fi
echo ""

# Check 8: Documentation is current
echo -e "${BLUE}[8/8]${RESET} Checking Phase 1 documentation..."
if [ -f "docs/P2P-STATUS-PHASE-1.md" ] && grep -q "Phase 1 Launch Status: ✅ GO" docs/P2P-STATUS-PHASE-1.md; then
    echo -e "${GREEN}✓ PASSED${RESET}: Phase 1 documentation is current"
    passed=$((passed + 1))
else
    echo -e "${YELLOW}⚠ WARNING${RESET}: Phase 1 documentation may be outdated"
    failed=$((failed + 1))
fi
echo ""

# Summary
echo -e "${BLUE}========================================${RESET}"
echo -e "${BLUE}Summary${RESET}"
echo -e "${BLUE}========================================${RESET}"
echo -e "Tests Passed: ${GREEN}$passed/8${RESET}"
echo -e "Tests Failed: ${RED}$failed/8${RESET}"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✓ Phase 1 READY FOR LAUNCH${RESET}"
    echo ""
    echo "Next steps:"
    echo "1. Monitor provider registrations (DCP-751, DCP-764)"
    echo "2. Watch for first provider heartbeats on DHT"
    echo "3. Run provider activation campaign"
    echo "4. Monitor Phase 1 testing window (2026-03-25 to 2026-03-28)"
    exit 0
else
    echo -e "${RED}✗ Phase 1 BLOCKERS DETECTED${RESET}"
    echo ""
    echo "Blockers to resolve before launch:"
    [ $failed -gt 0 ] && echo "- See failed checks above"
    echo ""
    echo "Reference: docs/URGENT-DCP-612-BLOCKER-ESCALATION.md"
    exit 1
fi
