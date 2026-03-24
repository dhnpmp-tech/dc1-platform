# Phase 1 Day 4 — Quick Reference Runbook

**Created:** 2026-03-24 03:10 UTC
**Execution Date:** 2026-03-26 08:00 UTC
**Estimated Duration:** 4 hours (08:00-12:00 UTC)
**Lead:** QA Engineer (Agent 891b2856-c2eb-4162-9ce4-9f903abd315f)

---

## Quick Start Checklist

### Pre-Execution (2026-03-26 07:45 UTC — 15 min before start)

```bash
# Terminal 1: Open test execution window
cd /home/node/dc1-platform

# Terminal 2: Open smoke test window
cd /home/node/dc1-platform

# Terminal 3: Open log monitoring window
cd /home/node/dc1-platform
```

### Environment Setup (08:00 UTC sharp)

```bash
# Set environment variables in all terminals
export DCP_API_BASE="https://api.dcp.sa"
export DC1_ADMIN_TOKEN="test-admin-token-jest"  # Or actual token from env
export DCP_PROVIDER_KEY="test-provider-key"      # Set if needed
export DCP_RENTER_KEY="test-renter-jwt"          # Set if needed

# Verify connectivity
curl -s https://api.dcp.sa/api/models | jq '.' | head -20
# Expected: 200 OK, 11 models in response
```

---

## Execution Phases

### Phase 0: Pre-Test Validation (08:00-09:00 UTC) — 12 Sections

**Checklist Format:**
```
1. Environment Setup
   ✅ or ❌ — Description of what checked
2. Database Health
   ✅ or ❌ — Description
[etc...]
```

**Complete all 12 sections, document results.**

### Phase 1: E2E Marketplace Test Suite (09:00 UTC)

**Terminal 1 — Execute Jest Suite:**
```bash
npm run test:e2e

# Expected output:
# PASS backend/tests/e2e-marketplace.test.js
# ✓ Provider registration flow (1234ms)
# ✓ Renter credit flow (567ms)
# ✓ Job dispatch flow (890ms)
# ✓ Provider earnings flow (456ms)
# ✓ Pricing verification (234ms)
#
# Test Suites: 1 passed, 1 total
# Tests: X passed, X total
# Time: ~30 seconds
```

**Success Criteria:**
- ✅ All tests passing
- ✅ No timeouts or hangs
- ✅ All assertions passing

**If any test fails:**
1. Note exact test name and error
2. Review error message
3. Check backend logs (Terminal 3)
4. Attempt 1 retry (sometimes timing)
5. If fails again, document and escalate

### Phase 2: Metering Smoke Test (09:35 UTC)

**Terminal 2 — Execute Metering Verification:**
```bash
node scripts/metering-verification.mjs

# Expected output:
# ✓ Serve session creation
# ✓ Token counting per-request
# ✓ Cost calculation accuracy
# ✓ Balance deduction
# ✓ Provider earnings tracking
# ✓ Silent failure detection (all pass)
#
# Summary: 26/26 checks PASSED
# Duration: ~120 seconds
```

**Success Criteria:**
- ✅ All 26 checks passing
- ✅ Zero silent failures
- ✅ Cost calculations within ±0.1%
- ✅ Balance changes accurate

**If any check fails:**
1. Verify database is clean
2. Check provider/renter balance records
3. Review metering logs
4. Note exact check number and error
5. Escalate if not recoverable

### Phase 3: GPU Job Lifecycle Smoke Test (10:00 UTC)

**Terminal 2 — Execute Job Lifecycle:**
```bash
node scripts/gpu-job-lifecycle-smoke.mjs

# Expected output:
# ✓ Provider goes online
# ✓ Renter submits job
# ✓ Job assigned to provider
# ✓ Provider executes job
# ✓ Result stored
# ✓ Billing calculated
# ✓ Payment deducted
#
# Complete job lifecycle: 45 seconds
# Status: SUCCESS
```

**Success Criteria:**
- ✅ Job transitions: submitted → assigned → executing → completed
- ✅ Provider received job
- ✅ Renter balance decremented
- ✅ Provider earnings incremented
- ✅ All data consistent

**If any stage fails:**
1. Check job status in database
2. Verify provider/renter records
3. Review API responses
4. Note exact stage where failure occurred
5. Escalate with full error context

### Phase 4: Model Catalog Smoke Test (10:20 UTC)

**Terminal 2 — Execute Model Catalog:**
```bash
node scripts/model-catalog-smoke.mjs

# Expected output:
# ✓ Model catalog accessible (GET /api/models)
# ✓ 11 models present in response
# ✓ Each model has pricing data
# ✓ SAR conversion accurate
# ✓ Metadata complete (VRAM, context, use cases)
# ✓ Status field set correctly
#
# Model Catalog: PASS
# Duration: ~15 seconds
```

**Success Criteria:**
- ✅ 11 models returned
- ✅ All pricing fields populated
- ✅ SAR conversion correct
- ✅ Model metadata complete
- ✅ No 404 or missing data

**If any check fails:**
1. Verify DCP-641 deployment still active
2. Check model catalog endpoint manually
3. Review response structure
4. Note which models missing or incomplete
5. Escalate if API issue

---

## Decision Matrix: Go/No-Go

### PASS Criteria (PROCEED to Day 5)

| Check | Target | Result | ✅/❌ |
|-------|--------|--------|-------|
| Pre-test validation | 12/12 sections | __/12 | |
| e2e-marketplace.test.js | 100% pass | __% | |
| Metering smoke test | 26/26 checks | __/26 | |
| Job lifecycle smoke test | All stages | __/7 | |
| Model catalog smoke test | 11 models | __/11 | |
| No critical errors | None | ____ | |
| No data corruption | Clean | ____ | |

**Decision: PASS ✅** if ALL rows have ✅

### NO-GO Triggers (STOP and ESCALATE)

- ❌ Any pre-test section fails
- ❌ Any critical test fails (>5% failure rate)
- ❌ Silent metering failure detected
- ❌ Job lifecycle incomplete
- ❌ Model catalog missing models
- ❌ Data integrity issues
- ❌ API returns 500+ errors
- ❌ Provider/renter balance corruption

**If ANY trigger hit: STOP → Document → Escalate to CEO + post to DCP-773**

---

## Day 4 Report Template

**Post this to DCP-773 by 12:30 UTC:**

```markdown
## Phase 1 Day 4 — Execution Report (2026-03-26)

**Status: ✅ PASS** or **🔴 NO-GO**

### Pre-Test Validation (12 sections)
- ✓ Section 1: Environment Setup
- ✓ Section 2: Database Health
- ✓ Section 3: API Health Checks
- ✓ Section 4: Provider Flow Validation
- ✓ Section 5: Renter Flow Validation
- ✓ Section 6: Job Lifecycle Validation
- ✓ Section 7: Metering Validation
- ✓ Section 8: Pricing Verification
- ✓ Section 9: Earnings Validation
- ✓ Section 10: Data Isolation Check
- ✓ Section 11: Audit Trail Verification
- ✓ Section 12: Error Handling Validation

**Result: 12/12 PASS**

### Test Suite Results

**Round 1: e2e-marketplace.test.js (Jest)**
- Status: ✅ PASS (5/5 tests)
- Duration: ~30 seconds
- Pass Rate: 100%

**Round 2: Metering Smoke Test**
- Status: ✅ PASS (26/26 checks)
- Duration: ~120 seconds
- Key Finding: All metering calculations accurate (±0.1%)

**Round 3: GPU Job Lifecycle**
- Status: ✅ PASS (7/7 stages)
- Duration: ~45 seconds
- Key Finding: Complete job lifecycle functional

**Round 4: Model Catalog**
- Status: ✅ PASS (11/11 models)
- Duration: ~15 seconds
- Key Finding: All model metadata complete

### Summary
- Total Tests Run: 49 (5 + 26 + 7 + 11)
- Tests Passed: 49/49 (100%)
- Critical Failures: 0
- Data Integrity: CONFIRMED
- Silent Failures: NONE DETECTED

### Go/No-Go Decision
**✅ PASS — PROCEED TO DAY 5**

All success criteria met. No blockers identified. Ready to proceed with Phase 1 Day 5 integration testing on 2026-03-27 09:00 UTC.

**Signed:** QA Engineer (2026-03-26 12:30 UTC)
```

---

## Emergency Contact

**If BLOCKER occurs during execution:**

1. **Immediate Action:** Stop current test, document exact error
2. **Post Comment:** Add to DCP-773 with:
   - Exact failure point
   - Error message/logs
   - Steps taken so far
3. **Escalate:** @CEO (triggers urgent review)
4. **Wait:** For investigation direction before retrying

---

## File Locations (Quick Reference)

| Item | Path |
|------|------|
| E2E Test Suite | `backend/tests/e2e-marketplace.test.js` |
| Metering Verification | `scripts/metering-verification.mjs` |
| Job Lifecycle Test | `scripts/gpu-job-lifecycle-smoke.mjs` |
| Model Catalog Test | `scripts/model-catalog-smoke.mjs` |
| Phase 1 E2E Master Test | `scripts/phase1-e2e-smoke.mjs` |
| Backend Logs | `backend/logs/app.log` |
| Database (in-memory) | `:memory:` (jest-setup.js) |

---

## Time Box Management

**STRICT TIMING (cannot exceed):**
- Pre-test validation: 08:00-09:00 UTC (60 min)
- Test suite round 1-2: 09:00-10:30 UTC (90 min)
- Test suite round 3-4: 10:30-11:30 UTC (60 min)
- Decision + reporting: 11:30-12:30 UTC (60 min)

**If running behind:** Skip lowest-priority tests, focus on critical path (metering + job lifecycle)

---

## Success Indicators (During Execution)

**Green Lights ✅:**
- All pre-test sections pass
- Test suites run without timeouts
- All assertions pass
- No errors in backend logs
- API response times <200ms
- Database transactions commit cleanly

**Red Lights 🔴:**
- Test hangs (>30 sec per test)
- Assertion failures
- API errors (500+)
- Database locks
- Silent metering failures
- Balance corruption

---

## Post-Day 4 (If PASS)

1. ✅ Update DCP-773 with PASS decision
2. ✅ Archive Day 4 report and logs
3. ✅ Prepare Day 5 execution plan (standby)
4. ✅ Notify CEO + team of GO decision
5. ✅ Get rest (Day 5 starts next morning)

---

**Print or bookmark this page before 2026-03-26 08:00 UTC**

**Runbook Ready: 🟢 YES**
**Last Updated:** 2026-03-24 03:10 UTC
