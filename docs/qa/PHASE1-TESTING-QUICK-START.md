---
name: Phase 1 Testing Quick Start Guide
description: One-page command reference for executing Phase 1 testing days 4-6
---

# Phase 1 Testing Quick Start — Days 4-6

**Execution window:** 2026-03-26 08:00 UTC to 2026-03-28 12:00 UTC
**Prerequisites:** DCP-641 deployment completed and validated
**Duration:** ~10.5 hours total (spread across 3 days)
**Owner:** QA Engineer

---

## Day 4 (2026-03-26 08:00-12:00 UTC) — Pre-Test Infrastructure Validation

**Purpose:** Verify Phase 1 deployment is complete and all systems operational

### Quick Command: Run Day 4 Validation Suite
```bash
cd /home/node/dc1-platform
DCP_API_BASE=https://api.dcp.sa/api \
DCP_ADMIN_TOKEN=$(cat ~/.dcp/admin_token.txt) \
node scripts/phase1-day4-validation.mjs
```

### Expected Output
```
✅ Day 4 Validation Suite
  ✓ [1] Phase 1 deployment live
  ✓ [2] API contract validation
  ✓ [3] Database state verification
  ✓ [4] Infrastructure readiness
  ✓ [5] Auth credentials active
  ✓ [6] Metering system online
  ✓ [7] Pricing data correct
  ✓ [8] Provider connectivity
  ✓ [9] Renter onboarding paths
  ✓ [10] Admin endpoints active
  ✓ [11] Security posture
  ✓ [12] Deployment artifacts

Result: READY ✅ (12/12 checks pass)
```

### If Any Check Fails
```bash
# Review detailed logs
node scripts/phase1-day4-validation.mjs --verbose > day4-results.log
cat day4-results.log | grep "✗"  # Find failures
```

### Timeline
- **Start:** 2026-03-26 08:00 UTC
- **Duration:** 4 hours (includes setup, troubleshooting)
- **Go/No-Go:** By 12:00 UTC

---

## Day 5 (2026-03-27 09:00-11:30 UTC) — Integration Testing

**Purpose:** Execute full test suite covering provider onboarding, job submission, metering, pricing

### Quick Command: Run Day 5 Integration Tests
```bash
cd /home/node/dc1-platform

# Set credentials
export DCP_API_BASE=https://api.dcp.sa/api
export DCP_RENTER_KEY=$(cat ~/.dcp/renter_key.txt)
export DCP_PROVIDER_KEY=$(cat ~/.dcp/provider_key.txt)
export DCP_ADMIN_TOKEN=$(cat ~/.dcp/admin_token.txt)

# Run integration test suite (5 suites, 30+ tests)
npm test -- --suite integration 2>&1 | tee day5-results.log
```

### Expected Output
```
INTEGRATION TEST SUITE
  ✓ Provider Onboarding (6/6 tests)
  ✓ Job Submission & Metering (8/8 tests)
  ✓ Pricing & Billing (7/7 tests)
  ✓ Renter Workflows (5/5 tests)
  ✓ Provider Earnings (4/4 tests)

Result: 30/30 PASS ✅
Duration: 2.5 hours
```

### If Tests Fail
```bash
# Identify failures
grep "✗\|FAIL" day5-results.log | head -10

# Run single test for debugging
npm test -- --test "Provider Onboarding" --verbose
```

### Timeline
- **Start:** 2026-03-27 09:00 UTC
- **Duration:** 2.5 hours
- **Result required:** By 11:30 UTC

---

## Day 6 (2026-03-28 08:00-12:00 UTC) — Load & Security Testing + Go/No-Go

**Purpose:** Verify production readiness under load and security conditions; make launch decision

### Phase 6A: Load Testing (08:00-10:00 UTC)

```bash
cd /home/node/dc1-platform

# Configure load test parameters
export LOAD_RPS=100          # Requests per second
export LOAD_DURATION=1800    # 30 minutes
export LOAD_SCENARIO=ramp    # ramp-up scenario

# Execute load test
npm test -- --suite load --config load-test.env 2>&1 | tee day6-load.log
```

**Expected metrics:**
- Response time: < 500ms (p95)
- Error rate: < 1%
- Throughput: Sustained at configured RPS
- No cascading failures

### Phase 6B: Security Testing (10:00-11:00 UTC)

```bash
cd /home/node/dc1-platform

# Run security test suite (6 categories, 18+ tests)
npm test -- --suite security --verbose 2>&1 | tee day6-security.log
```

**Test categories:**
- [ ] Auth token validation
- [ ] SQL injection prevention
- [ ] CORS policy enforcement
- [ ] Rate limiting
- [ ] Data encryption
- [ ] API key scoping

### Phase 6C: Go/No-Go Decision (11:00-12:00 UTC)

**Post to DCP-641:**

**If all tests pass:**
```
✅ PHASE 1 TESTING COMPLETE — GO DECISION

Day 4: Pre-test validation ✅ (12/12 checks)
Day 5: Integration testing ✅ (30/30 tests)
Day 6: Load testing ✅ (metrics within bounds)
Day 6: Security testing ✅ (18/18 tests)

**Decision: GO** — Ready for Phase 1 launch

Next: Phase 1 production rollout begins [date TBD by founder]
```

**If any test fails:**
```
❌ PHASE 1 TESTING BLOCKED — NO-GO DECISION

Failed test: [test name and details]
Impact: [what this failure means for launch]
Remediation: [required fixes]

**Decision: NO-GO** — Not ready for launch

Next: [action to fix blocker and retry]
```

---

## Credential Setup (Before Day 4)

Run these once, before Day 4 starts:

```bash
# Create credentials directory
mkdir -p ~/.dcp

# Generate/retrieve credentials from environment
echo "$DCP_ADMIN_TOKEN" > ~/.dcp/admin_token.txt
echo "$DCP_RENTER_KEY" > ~/.dcp/renter_key.txt
echo "$DCP_PROVIDER_KEY" > ~/.dcp/provider_key.txt

# Verify credentials work
curl -s "https://api.dcp.sa/api/health" -H "Authorization: Bearer $(cat ~/.dcp/admin_token.txt)"
# Should return HTTP 200 with health status
```

---

## Real-Time Monitoring (Optional)

Keep these running in separate terminal windows during testing:

**Window 1: Backend logs**
```bash
ssh root@76.13.179.86 "pm2 logs dc1-provider-onboarding --follow"
```

**Window 2: API response times**
```bash
while true; do
  curl -s -w "Response time: %{time_total}s\n" "https://api.dcp.sa/api/health" -o /dev/null
  sleep 5
done
```

**Window 3: Database connection count**
```bash
ssh root@76.13.179.86 "watch 'psql -U dcp -d dcp_platform -c \"SELECT count(*) FROM pg_stat_activity;\"'"
```

---

## Troubleshooting Quick Reference

| Issue | Command | Fix |
|-------|---------|-----|
| Day 4: HTTP 404 on model endpoints | `curl -w "%{http_code}" https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview` | Verify DCP-641 deployment completed |
| Day 5: Tests fail with auth errors | `echo $DCP_ADMIN_TOKEN` | Re-validate credential setup |
| Day 5: Database connection refused | `pg_isready -h [db-host] -p 5432` | Check DB connectivity |
| Day 6: Load test crashes | `pm2 logs dc1-provider-onboarding` | Review backend errors |
| Day 6: Security test fails | `grep "✗" day6-security.log` | Review specific failure |

---

## Timeline Reference

| Day | Time | Activity | Duration | Pass/Fail |
|-----|------|----------|----------|-----------|
| 4 | 08:00-12:00 | Pre-test validation | 4 hrs | [ ]✓/[ ]✗ |
| 5 | 09:00-11:30 | Integration testing | 2.5 hrs | [ ]✓/[ ]✗ |
| 6 | 08:00-10:00 | Load testing | 2 hrs | [ ]✓/[ ]✗ |
| 6 | 10:00-11:00 | Security testing | 1 hr | [ ]✓/[ ]✗ |
| 6 | 11:00-12:00 | Go/No-Go decision | 1 hr | [ ]✓/[ ]✗ |

**Total: 10.5 hours across 3 days**

---

## Success Criteria for Phase 1

**Phase 1 is READY for launch when:**
- ✅ All Day 4 checks pass (12/12)
- ✅ All Day 5 tests pass (30/30)
- ✅ Day 6 load tests within bounds (p95 < 500ms, errors < 1%)
- ✅ Day 6 security tests pass (18/18)
- ✅ No critical issues found in any phase

**Phase 1 is BLOCKED if:**
- ❌ Any Day 4 check fails
- ❌ Day 5 tests < 25/30 pass (>16% failure rate)
- ❌ Day 6 load test shows cascading failures or errors > 5%
- ❌ Day 6 security test fails
- ❌ Critical bugs found blocking launch

---

## Document References

- **Day 4 details:** `docs/qa/PHASE1-PRETEST-PREFLIGHT-CHECKLIST.md`
- **Day 5 details:** `docs/qa/PHASE1-INTEGRATION-TEST-PLAN.md`
- **Day 6 details:** `docs/qa/PHASE1-LOAD-SECURITY-TEST-PLAN.md`
- **Deployment procedure:** `docs/qa/PHASE1-DEPLOYMENT-READINESS-CHECKLIST.md`

---

**Ready for execution upon:** DCP-641 deployment approval and completion
**Expected start:** 2026-03-26 08:00 UTC
**Expected completion:** 2026-03-28 12:00 UTC
**Decision point:** 2026-03-28 12:00 UTC (Go/No-Go)
