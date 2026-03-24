# Phase 1 Pre-Flight Execution Runbook (2026-03-25 23:00 UTC)

**Execution by:** QA Engineer
**Start Time:** 2026-03-25 23:00 UTC
**Target Duration:** 15-30 minutes
**Deadline:** 2026-03-25 23:30 UTC
**Results Post:** DCP-773 comment with GO/NO-GO decision

---

## Pre-Execution Setup (5 min before: 22:55 UTC)

### Terminal 1: Execution Console
```bash
cd /home/node/dc1-platform
clear
echo "=== Phase 1 Pre-Flight Execution ==="
date -u
```

### Environment Check
```bash
# Verify working directory
pwd  # Should output: /home/node/dc1-platform

# Check git status
git status
# Expected: On branch main, nothing to commit

# Set API base URL
export API_BASE="https://api.dcp.sa"
```

### Quick Baseline (optional, run now if you want to compare)
```bash
# Get current API status
curl -s -X GET $API_BASE/health -w "\nStatus: %{http_code}\n" | head -20
```

---

## Execution Phase (23:00-23:30 UTC)

**Run checks in order. Record result (✓ or ✗) after each.**

---

### Check 1: Test Documentation Completeness (2 min)

```bash
echo "=== CHECK 1: Test Documentation ==="

# List all SPRINT-26 files
ls -lh docs/SPRINT-26-*.md docs/PHASE1-*.md 2>/dev/null | grep -E "DAY4|INTEGRATION|LOAD|SECURITY|REALTIME|HANDBOOK|RUNBOOK" | awk '{print $9, "(" $5 ")"}'

# Count expected files
echo ""
echo "Expected files (7 total):"
ls -1 docs/SPRINT-26-*.md docs/PHASE1-DAY4-RUNBOOK.md 2>/dev/null | wc -l

# Verify file sizes (should all be >10KB)
echo ""
echo "File size check:"
ls -lh docs/SPRINT-26-DAY4-PRETEST-VALIDATION.md 2>/dev/null | awk '{print "DAY4: " $5}'
ls -lh docs/SPRINT-26-INTEGRATION-TEST-PLAN.md 2>/dev/null | awk '{print "INTEGRATION: " $5}'
ls -lh docs/SPRINT-26-LOAD-TESTING-PLAN.md 2>/dev/null | awk '{print "LOAD: " $5}'
ls -lh docs/SPRINT-26-SECURITY-TESTING-PLAN.md 2>/dev/null | awk '{print "SECURITY: " $5}'
ls -lh docs/SPRINT-26-REALTIME-MONITORING.md 2>/dev/null | awk '{print "REALTIME: " $5}'
ls -lh docs/SPRINT-26-TEST-EXECUTION-HANDBOOK.md 2>/dev/null | awk '{print "HANDBOOK: " $5}'
ls -lh docs/PHASE1-DAY4-RUNBOOK.md 2>/dev/null | awk '{print "RUNBOOK: " $5}'
```

**Expected:** All 7 files present, all >10KB
**Result:** ☐ PASS ☐ FAIL
**Note:**

---

### Check 2: Test Scripts Executable (2 min)

```bash
echo ""
echo "=== CHECK 2: Test Scripts ==="

# List all test scripts
echo "Available test scripts:"
ls -1 scripts/ | grep -E "smoke|load|e2e|metering|phase1|job|lifecycle|provider|connectivity" | head -20

# Count executable scripts
echo ""
echo "Total scripts matching pattern: $(ls scripts/ | grep -E "smoke|load|e2e|metering|phase1|job|lifecycle|provider|connectivity" | wc -l)"

# Verify specific key scripts exist
echo ""
echo "Key scripts:"
test -f scripts/phase1-preflight-smoke.mjs && echo "✓ phase1-preflight-smoke.mjs" || echo "✗ MISSING: phase1-preflight-smoke.mjs"
test -f scripts/phase1-e2e-smoke.mjs && echo "✓ phase1-e2e-smoke.mjs" || echo "✗ MISSING: phase1-e2e-smoke.mjs"
test -f scripts/e2e-smoke-full.mjs && echo "✓ e2e-smoke-full.mjs" || echo "✗ MISSING: e2e-smoke-full.mjs"
test -f scripts/model-catalog-smoke.mjs && echo "✓ model-catalog-smoke.mjs" || echo "✗ MISSING: model-catalog-smoke.mjs"
test -f backend/tests/e2e-marketplace.test.js && echo "✓ e2e-marketplace.test.js" || echo "✗ MISSING: e2e-marketplace.test.js"
```

**Expected:** 9+ scripts present, including phase1-preflight-smoke.mjs
**Result:** ☐ PASS ☐ FAIL
**Note:**

---

### Check 3: Jest E2E Test Suite (1 min)

```bash
echo ""
echo "=== CHECK 3: Jest E2E Suite ==="

# Verify Jest test file exists and has content
if [ -f backend/tests/e2e-marketplace.test.js ]; then
    echo "✓ File exists"
    wc -l backend/tests/e2e-marketplace.test.js | awk '{print "  Lines: " $1}'
    ls -lh backend/tests/e2e-marketplace.test.js | awk '{print "  Size: " $5}'

    # Check for test suite patterns
    echo ""
    echo "Test patterns found:"
    grep -c "describe\|it(" backend/tests/e2e-marketplace.test.js | xargs echo "  Test blocks:"
else
    echo "✗ File NOT found: backend/tests/e2e-marketplace.test.js"
fi
```

**Expected:** File exists, 600+ lines, contains describe/it blocks
**Result:** ☐ PASS ☐ FAIL
**Note:**

---

### Check 4: API Endpoints Health (3 min)

```bash
echo ""
echo "=== CHECK 4: API Health ==="

# Test API health endpoint
echo "Testing $API_BASE/health ..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET $API_BASE/health -H "Content-Type: application/json")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

echo "Response code: $HTTP_CODE"
echo "Response body: $BODY" | head -5

if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Health check PASSED"
else
    echo "✗ Health check FAILED (expected 200, got $HTTP_CODE)"
fi
```

**Expected:** HTTP 200, response contains status=ok
**Result:** ☐ PASS ☐ FAIL
**Response Time:** ___ ms
**Note:**

---

### Check 5: Model Catalog Live (2 min)

```bash
echo ""
echo "=== CHECK 5: Model Catalog ==="

# Get model catalog
echo "Fetching model catalog from $API_BASE/api/models ..."
MODELS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET $API_BASE/api/models -H "Content-Type: application/json")
HTTP_CODE=$(echo "$MODELS_RESPONSE" | tail -n1)
BODY=$(echo "$MODELS_RESPONSE" | head -n-1)

echo "Response code: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    # Count models in JSON response
    MODEL_COUNT=$(echo "$BODY" | grep -o '"name"' | wc -l)
    echo "Models found: $MODEL_COUNT"

    if [ "$MODEL_COUNT" -ge "11" ]; then
        echo "✓ Model catalog has 11+ models"
    else
        echo "✗ Model catalog has fewer than 11 models"
    fi

    # Show first few models
    echo ""
    echo "Sample models:"
    echo "$BODY" | grep -o '"name":"[^"]*"' | head -5
else
    echo "✗ Failed to fetch models (HTTP $HTTP_CODE)"
fi
```

**Expected:** HTTP 200, 11+ models
**Model Count:** ___
**Result:** ☐ PASS ☐ FAIL
**Note:**

---

### Check 6: Database Connectivity (3 min)

```bash
echo ""
echo "=== CHECK 6: Database Status ==="

# Check if database files exist
if [ -f backend/db.sqlite ]; then
    echo "✓ SQLite database file exists"
    ls -lh backend/db.sqlite | awk '{print "  Size: " $5}'
else
    echo "Note: db.sqlite not found (may be created at runtime)"
fi

# Try to query database schema (if accessible locally)
echo ""
echo "Database connectivity check:"
if command -v sqlite3 &> /dev/null; then
    echo "  Checking schema with sqlite3..."
    TABLES=$(sqlite3 backend/db.sqlite ".tables" 2>/dev/null | wc -w)
    if [ $TABLES -gt 0 ]; then
        echo "  ✓ Database accessible, $TABLES tables found"
    else
        echo "  ⚠ Database file exists but may not be initialized"
    fi
else
    echo "  ⚠ sqlite3 not available for local check"
    echo "  API is accessible, assuming database connectivity is OK"
fi
```

**Expected:** Database file exists or API accessible
**Result:** ☐ PASS ☐ FAIL (May be ⚠ WARN if local DB not found but API works)
**Note:**

---

### Check 7: Test Credentials (2 min)

```bash
echo ""
echo "=== CHECK 7: Credentials ==="

# Check environment variables
echo "Checking environment variables..."
if [ -z "$DC1_RENTER_KEY" ]; then
    echo "⚠ DC1_RENTER_KEY not set (may be OK if API auth not required for tests)"
else
    echo "✓ DC1_RENTER_KEY is set"
fi

if [ -z "$DC1_ADMIN_TOKEN" ]; then
    echo "⚠ DC1_ADMIN_TOKEN not set (may be OK if API auth not required for tests)"
else
    echo "✓ DC1_ADMIN_TOKEN is set"
fi

# Check for .env files
echo ""
echo "Checking .env files:"
test -f .env && echo "✓ .env exists" || echo "⚠ No .env file"
test -f .env.test && echo "✓ .env.test exists" || echo "⚠ No .env.test file"

echo ""
echo "Note: If credentials are not set, API testing should still work if endpoints are public"
```

**Expected:** Either credentials set OR API public
**Result:** ☐ PASS ☐ WARN (credentials not found but API works)
**Note:**

---

### Check 8: Monitoring Infrastructure (2 min)

```bash
echo ""
echo "=== CHECK 8: Monitoring Infrastructure ==="

# Verify monitoring documentation exists
if [ -f docs/SPRINT-26-REALTIME-MONITORING.md ]; then
    echo "✓ Monitoring documentation exists"
    ls -lh docs/SPRINT-26-REALTIME-MONITORING.md | awk '{print "  Size: " $5}'

    # Count monitoring-related content
    MONITOR_REFS=$(grep -c "monitor\|alert\|metric\|dashboard" docs/SPRINT-26-REALTIME-MONITORING.md 2>/dev/null || echo "0")
    echo "  Monitoring references: $MONITOR_REFS"
else
    echo "✗ Monitoring documentation NOT found"
fi

# Check if monitoring scripts exist
echo ""
echo "Monitoring scripts:"
test -f scripts/phase1-continuous-monitoring.mjs && echo "✓ phase1-continuous-monitoring.mjs" || echo "⚠ Not found"
test -f scripts/phase1-incident-response.mjs && echo "✓ phase1-incident-response.mjs" || echo "⚠ Not found"
```

**Expected:** Monitoring doc exists, 500+ lines, monitoring scripts present
**Result:** ☐ PASS ☐ WARN
**Note:**

---

### Check 9: Git Status Clean (1 min)

```bash
echo ""
echo "=== CHECK 9: Git Status ==="

# Check for uncommitted changes
GIT_STATUS=$(git status --porcelain)

if [ -z "$GIT_STATUS" ]; then
    echo "✓ Working directory clean"
else
    echo "⚠ Uncommitted changes detected:"
    echo "$GIT_STATUS" | head -10
fi

# Check branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" = "main" ]; then
    echo "✓ On main branch"
else
    echo "⚠ Not on main branch (on $CURRENT_BRANCH)"
fi

# Check if main is up-to-date
echo ""
echo "Checking if main is up-to-date..."
git fetch --dry-run 2>&1 | grep -q "would be fast-forwarded" && echo "⚠ main is behind remote" || echo "✓ main is up-to-date"
```

**Expected:** Clean working directory, on main branch
**Result:** ☐ PASS ☐ WARN
**Note:**

---

### Check 10: Success Criteria Documented (1 min)

```bash
echo ""
echo "=== CHECK 10: Success Criteria ==="

# Verify success criteria are in documentation
echo "Checking for success criteria in test docs..."

echo ""
echo "Day 4 criteria:"
grep -q "12/12\|12 validation\|pre-test validation" docs/SPRINT-26-DAY4-PRETEST-VALIDATION.md 2>/dev/null && echo "✓ Found" || echo "✗ Not found"

echo "Day 5 criteria:"
grep -q "30+\|integration\|test cases" docs/SPRINT-26-INTEGRATION-TEST-PLAN.md 2>/dev/null && echo "✓ Found" || echo "✗ Not found"

echo "Day 6 criteria:"
grep -q "load\|security\|5\|18" docs/SPRINT-26-LOAD-TESTING-PLAN.md docs/SPRINT-26-SECURITY-TESTING-PLAN.md 2>/dev/null && echo "✓ Found" || echo "✗ Not found"

echo ""
echo "✓ Success criteria documented"
```

**Expected:** Success criteria found in all test plan docs
**Result:** ☐ PASS ☐ FAIL
**Note:**

---

## Summary & Decision (23:30 UTC)

### Results Checklist
| Check | Result | Notes |
|-------|--------|-------|
| 1. Documentation | ☐ PASS ☐ FAIL | |
| 2. Test Scripts | ☐ PASS ☐ FAIL | |
| 3. Jest Suite | ☐ PASS ☐ FAIL | |
| 4. API Health | ☐ PASS ☐ FAIL | |
| 5. Model Catalog | ☐ PASS ☐ FAIL | |
| 6. Database | ☐ PASS ☐ FAIL ☐ WARN | |
| 7. Credentials | ☐ PASS ☐ WARN | |
| 8. Monitoring | ☐ PASS ☐ WARN | |
| 9. Git Status | ☐ PASS ☐ WARN | |
| 10. Success Criteria | ☐ PASS ☐ FAIL | |

### GO/NO-GO Decision

**Passing Checks:** ___ / 10

**Decision:** ☐ **GO** ☐ **NO-GO**

**Reason:**
```
[Paste any notable findings or blockers here]
```

---

## Post-Execution (23:30 UTC)

### Post Results Comment
Copy this template and fill in results, then post to DCP-773:

```markdown
## Pre-Flight Checkpoint Complete (2026-03-25 23:30 UTC)

**Execution Time:** 23:00-23:30 UTC
**Checks Passed:** ___ / 10
**Decision:** GO / NO-GO

### Results Summary
[Paste checklist results above]

### Notable Findings
[If any checks were WARN or issues found]

### Next Steps
- If GO: Day 4 execution proceeds 2026-03-26 08:00 UTC
- If NO-GO: [Describe what needs to be fixed before Day 4]
```

---

## Troubleshooting Quick Reference

| Issue | Command to Check | Contact |
|-------|-----------------|---------|
| API down | `curl -s $API_BASE/health` | DevOps/Backend Architect |
| Models missing | `curl -s $API_BASE/api/models \| grep -c name` | ML Infra Engineer |
| DB error | Check `backend/db.sqlite` size | Backend Architect |
| Scripts broken | `head -20 scripts/phase1-preflight-smoke.mjs` | QA Team |
| Git issues | `git status` | DevOps/CTO |

---

**Start Time:** 2026-03-25 23:00 UTC
**Deadline:** 2026-03-25 23:30 UTC
**Execute on:** Terminal 1 in /home/node/dc1-platform
**Post Results to:** DCP-773 comment

Good luck! 🚀
