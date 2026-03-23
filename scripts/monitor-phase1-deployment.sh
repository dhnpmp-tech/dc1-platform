#!/bin/bash

###############################################################################
# Phase 1 Deployment Monitor & Test Execution Script
#
# Purpose: Monitor for DCP-524 deployment completion and execute Phase 1 tests
# Usage: ./scripts/monitor-phase1-deployment.sh [--api-base <url>]
#
# This script:
# 1. Monitors api.dcp.sa for /api/templates and /api/models endpoints
# 2. Upon successful response, executes both Phase 1 test suites
# 3. Generates comprehensive test report
# 4. Posts results to Paperclip
###############################################################################

set -e

# Configuration
API_BASE="${1:-https://api.dcp.sa}"
RENTER_KEY="${DCP_RENTER_KEY:-.}"
POLL_INTERVAL=10  # seconds
MAX_WAIT=3600     # 1 hour max wait
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $(date -u +"%H:%M:%S") $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $(date -u +"%H:%M:%S") $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date -u +"%H:%M:%S") $1"
}

check_api_ready() {
  local templates_status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $RENTER_KEY" \
    "$API_BASE/api/templates" 2>/dev/null || echo "000")

  local models_status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $RENTER_KEY" \
    "$API_BASE/api/models" 2>/dev/null || echo "000")

  if [ "$templates_status" = "200" ] && [ "$models_status" = "200" ]; then
    return 0  # API is ready
  else
    return 1  # API not ready
  fi
}

run_phase1_tests() {
  log_info "Starting Phase 1 test execution..."

  # Set environment
  export DCP_API_BASE="$API_BASE"
  export DCP_RENTER_KEY="$RENTER_KEY"

  # Create test results directory
  RESULTS_DIR="docs/qa/phase1-results/$(date -u +%Y%m%d-%H%M%S)"
  mkdir -p "$RESULTS_DIR"

  log_info "Running Template Catalog E2E test..."
  if node scripts/template-catalog-e2e.mjs > "$RESULTS_DIR/template-catalog-output.txt" 2>&1; then
    log_info "✓ Template Catalog test PASSED"
    TEMPLATE_RESULT="PASS"
  else
    log_error "✗ Template Catalog test FAILED"
    TEMPLATE_RESULT="FAIL"
  fi

  log_info "Running Model Catalog smoke test..."
  if node scripts/model-catalog-smoke.mjs > "$RESULTS_DIR/model-catalog-output.txt" 2>&1; then
    log_info "✓ Model Catalog test PASSED"
    MODEL_RESULT="PASS"
  else
    log_error "✗ Model Catalog test FAILED"
    MODEL_RESULT="FAIL"
  fi

  # Generate summary report
  cat > "$RESULTS_DIR/PHASE1-TEST-RESULTS.md" <<EOF
# Phase 1 Test Execution Results
**Timestamp:** $TIMESTAMP
**API Base:** $API_BASE

## Test Results

### Template Catalog E2E Test
**Status:** $TEMPLATE_RESULT
**Output:** See template-catalog-output.txt

### Model Catalog Smoke Test
**Status:** $MODEL_RESULT
**Output:** See model-catalog-output.txt

## Overall Phase 1 Decision
EOF

  if [ "$TEMPLATE_RESULT" = "PASS" ] && [ "$MODEL_RESULT" = "PASS" ]; then
    echo "**GO for Phase 1 template and model catalog activation** ✅" >> "$RESULTS_DIR/PHASE1-TEST-RESULTS.md"
    log_info "✓ Phase 1 GO DECISION: ALL TESTS PASSED"
    return 0
  else
    echo "**NO-GO for Phase 1 — tests failed, escalation required** ❌" >> "$RESULTS_DIR/PHASE1-TEST-RESULTS.md"
    log_error "✗ Phase 1 NO-GO DECISION: TESTS FAILED"
    return 1
  fi
}

post_results_to_paperclip() {
  log_info "Posting Phase 1 results to Paperclip..."

  # This would require Paperclip API access and task ID
  # For now, log that results are ready
  log_info "Results available at: $RESULTS_DIR/"
  log_info "Review and post manually: docs/qa/phase1-results/<timestamp>/PHASE1-TEST-RESULTS.md"
}

# Main execution
main() {
  log_info "Phase 1 Deployment Monitor Started"
  log_info "Monitoring API: $API_BASE"
  log_info "Poll interval: ${POLL_INTERVAL}s, Max wait: ${MAX_WAIT}s"

  local elapsed=0
  local found=false

  while [ $elapsed -lt $MAX_WAIT ]; do
    if check_api_ready; then
      log_info "✓ API endpoints are responding!"
      found=true
      break
    else
      log_warn "API not ready yet... (elapsed: ${elapsed}s)"
      sleep $POLL_INTERVAL
      elapsed=$((elapsed + POLL_INTERVAL))
    fi
  done

  if [ "$found" = true ]; then
    log_info "DCP-524 deployment detected! Beginning Phase 1 test execution..."
    if run_phase1_tests; then
      log_info "Phase 1 tests completed successfully"
      post_results_to_paperclip
      exit 0
    else
      log_error "Phase 1 tests failed"
      post_results_to_paperclip
      exit 1
    fi
  else
    log_error "Timeout waiting for API deployment (>${MAX_WAIT}s)"
    exit 2
  fi
}

# Run main function
main "$@"
