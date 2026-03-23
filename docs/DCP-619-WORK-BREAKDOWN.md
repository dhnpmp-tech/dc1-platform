# DCP-619 Metering Verification — Formal Work Breakdown

**Issue:** DCP-619 (Metering Verification)
**Owner:** QA Engineer (agent 891b2856-c2eb-4162-9ce4-9f903abd315f)
**Status:** BLOCKED (awaiting credentials)
**Priority:** CRITICAL
**Created:** 2026-03-23 15:45 UTC

---

## Executive Summary

DCP-619 is the critical path blocker for Phase 1 launch. The metering fix (per-token tracking for serve_sessions) must be verified before Phase 1 can go live. This document breaks down DCP-619 into 6 sequential subtasks with clear dependencies and timeline.

**Critical Blocker:** Test credentials (DCP_RENTER_KEY, DC1_ADMIN_TOKEN)
**Once Unblocked:** ST-1 through ST-3 complete in 20 minutes
**Phase 1 Impact:** Results inform go/no-go launch decision on 2026-03-28

---

## Subtask 1: Credential Setup & Environment Validation

**Code:** ST-1
**Duration:** 5 minutes
**Blocked By:** DevOps/Backend (credential provisioning)
**Blocks:** ST-2

**Requirements:**
- `DCP_RENTER_KEY` — Test renter API key (64+ chars)
- `DC1_ADMIN_TOKEN` — Admin authentication token
- API endpoint confirmation (https://api.dcp.sa or staging server)

**Success Criteria:**
- Credentials received and documented
- API endpoint confirmed accessible
- Ready to proceed to ST-2

**Owner:** QA Engineer (with DevOps/Backend support)

---

## Subtask 2: Execute vllm-metering-smoke.mjs

**Code:** ST-2
**Duration:** 10 minutes
**Blocked By:** ST-1 (credentials)
**Blocks:** ST-3

**What:** Run comprehensive metering smoke test against live environment

**Test Script:** `/home/node/dc1-platform/scripts/vllm-metering-smoke.mjs` (310 lines)

**Validates (7 steps):**
1. Provider registration & onboarding
2. Renter creation & funding (100,000 halala)
3. Pricing API verification (RTX 4090 = 26,700 halala critical)
4. vLLM job submission
5. Metering verification (tokens persisted in DB)
6. Billing verification (balance deducted correctly)
7. Summary & diagnostics

**Execution:**
```bash
DCP_API_BASE=https://api.dcp.sa \
DCP_RENTER_KEY=$DCP_RENTER_KEY \
DC1_ADMIN_TOKEN=$DC1_ADMIN_TOKEN \
node scripts/vllm-metering-smoke.mjs
```

**Success Criteria:**
- All 12+ checks PASS
- Silent failure detection works (CRITICAL)
- Token counts > 0 in database
- Cost calculations match token counts
- Complete pipeline validates end-to-end

**Failure Criteria:**
- Any check FAILS → escalate immediately to Backend Engineer
- Silent metering failure detected → CRITICAL blocker
- Timeout → investigate infrastructure

**Owner:** QA Engineer

---

## Subtask 3: Analyze Results & Report

**Code:** ST-3
**Duration:** 5 minutes
**Blocked By:** ST-2 (test execution)
**Blocks:** Launch decision

**If PASS:**
- Document: "✅ Metering fix verified — Phase 1 ready"
- Unblock: Phase 1 launch path
- Proceed: To Day 4 pre-test validation (ST-4)

**If FAIL:**
- Document: All error details, logs, database state
- Escalate: Backend Engineer immediately
- Impact: Phase 1 launch delayed until fix verified
- Next: Retest after fix applied

**Owner:** QA Engineer

---

## Subtask 4: Day 4 Pre-Test Validation (2026-03-26)

**Code:** ST-4
**Date:** 2026-03-26
**Time:** 08:00-12:00 UTC
**Duration:** 4 hours
**Blocked By:** ST-3 (metering verified)
**Blocks:** ST-5

**Checklist:** `docs/SPRINT-26-DAY4-PRETEST-VALIDATION.md` (400 lines, complete)

**12 Validation Sections:**
1. VPS connectivity & SSH access
2. Disk space & memory check
3. PM2 services status (dc1-provider-onboarding, dc1-webhook)
4. Port accessibility (8083, HTTPS on api.dcp.sa)
5. Database file exists & accessible
6. GPU pricing table seeded (6 tiers, RTX 4090 = 26,700)
7. Provider/renter/jobs/serve_sessions tables present
8. Serve_sessions schema correct
9. Test scripts present & executable
10. Admin token validation
11. Test renter key validation
12. Network latency & DNS resolution

**Success Criteria:** All 12 sections ✅ PASS

**Owner:** QA Engineer

---

## Subtask 5: Day 5 Integration Testing (2026-03-27)

**Code:** ST-5
**Date:** 2026-03-27
**Time:** 09:00-11:30 UTC
**Duration:** 2.5 hours
**Blocked By:** ST-4 (infrastructure validated)
**Blocks:** ST-6

**Handbook:** `docs/SPRINT-26-TEST-EXECUTION-HANDBOOK.md` (450 lines, complete)
**Monitoring:** `docs/SPRINT-26-REALTIME-MONITORING.md` (500 lines, complete)

**5 Test Suites:**

1. **Metering Validation (DCP-619)** — 5 min
   - Tests: vllm-metering-smoke.mjs (12 checks)
   - Critical: Silent failure detection

2. **Pricing API Tests (SP26-006)** — 2 min
   - Tests: 11 comprehensive validation tests
   - Critical: RTX 4090 = 26,700 halala

3. **VPS & Container Health (SP26-004)** — 5 min
   - Tests: 4 health checks (PM2, HTTPS, ports, services)

4. **Provider Onboarding (SP25-005)** — 10 min
   - Tests: 5 onboarding flow tests (5+ providers required)

5. **E2E Master Smoke Test** — 10 min
   - Tests: 12-check complete pipeline (Provider→Job→Metering→Billing)

**Go Criteria (ALL must pass):**
- ✅ Metering: 11/11 checks
- ✅ Pricing: 11/11 tests
- ✅ VPS: 4/4 health checks
- ✅ Providers: 5+ online
- ✅ E2E: 12/12 checks
- ✅ Zero silent metering failures

**Owner:** QA Engineer

---

## Subtask 6: Day 6 Load & Security Testing + Go/No-Go (2026-03-28)

**Code:** ST-6
**Date:** 2026-03-28
**Time:** 08:00-12:00 UTC
**Duration:** 4 hours
**Blocked By:** ST-5 (integration tests passed)
**Blocks:** Phase 1 launch decision

**Load Testing Plan:** `docs/SPRINT-26-LOAD-TESTING-PLAN.md` (350 lines, complete)
**Security Testing Plan:** `docs/SPRINT-26-SECURITY-TESTING-PLAN.md` (370 lines, complete)

**Load Tests (08:00-10:00):** 5 scenarios
- Pricing API spike (100 concurrent)
- Job submission burst (50 renters, 10 min)
- Provider heartbeat (100 providers)
- Admin API queries (10 concurrent)
- Mixed realistic load (50 renters, 100 providers, 15 min)

**Security Tests (10:00-11:00):** 6 categories, 18+ tests
- Authentication & authorization
- Billing integrity
- API security
- Data protection
- Business logic security
- Admin security

**Go/No-Go Decision (11:00-12:00 UTC):**

**GO if:**
- ✅ All load tests meet baselines
- ✅ All security tests PASS (critical items)
- ✅ Error rate <1%
- ✅ No silent metering failures
- ✅ Database integrity verified
- **Decision:** Launch Phase 1 immediately

**NO-GO if:**
- ❌ Any critical test fails
- ❌ Performance baselines not met
- ❌ Security vulnerability detected
- ❌ Silent metering failure under load
- **Decision:** Fix issues, retest, delay launch

**Owner:** QA Engineer + CEO (final decision authority)

---

## Dependency Chain

```
ST-1: Get Credentials (5 min)
  ↓ [CRITICAL BLOCKER — external dependency]
ST-2: Run Metering Test (10 min)
  ↓ [if PASS]
ST-3: Report Results (5 min)
  ↓ [unblock Day 4]
ST-4: Day 4 Pre-Test Validation (4 hours, 2026-03-26)
  ↓
ST-5: Day 5 Integration Testing (2.5 hours, 2026-03-27)
  ↓
ST-6: Day 6 Load & Security + Go/No-Go (4 hours, 2026-03-28)
  ↓
Phase 1 Launch Decision (noon 2026-03-28)
```

---

## What's Ready

✅ **DCP-619 test script:** Complete, 310 lines, fully implemented
✅ **Admin endpoint:** Ready (GET /api/admin/serve-sessions/{job_id})
✅ **Integration tests:** 5 metering validation tests, ready
✅ **Day 4 checklist:** 400 lines, complete, ready
✅ **Day 5 handbook:** 450 lines, complete, ready
✅ **Monitoring guide:** 500 lines, complete, ready
✅ **Load testing plan:** 350 lines, complete, ready
✅ **Security testing plan:** 370 lines, complete, ready

**Total QA Framework:** 4,245 lines of documentation + 310 lines of test scripts + 28+ automated tests

---

## What's Blocking

🔴 **ST-1 Blocker:** Test credentials
- DCP_RENTER_KEY (needed from DevOps/Backend)
- DC1_ADMIN_TOKEN (needed from Backend)
- API endpoint confirmation

**Once credentials available:** ST-1→ST-3 complete in 20 minutes, then proceed to Day 4

---

## Timeline Summary

| Subtask | Date | Time | Duration | Status | Blocker |
|---------|------|------|----------|--------|---------|
| ST-1 | Now | ASAP | 5 min | READY | Credentials |
| ST-2 | Now | ASAP | 10 min | READY | ST-1 |
| ST-3 | Now | ASAP | 5 min | READY | ST-2 |
| ST-4 | 2026-03-26 | 08:00-12:00 | 4 hours | READY | ST-3 |
| ST-5 | 2026-03-27 | 09:00-11:30 | 2.5 hours | READY | ST-4 |
| ST-6 | 2026-03-28 | 08:00-12:00 | 4 hours | READY | ST-5 |

---

## Owner: QA Engineer

Agent ID: 891b2856-c2eb-4162-9ce4-9f903abd315f
Role: Phase 1 QA Coordinator & Critical Path Validator
Status: ACTIVELY EXECUTING (blocked on ST-1 credentials)
Heartbeat Mode: ACTIVE & MONITORING

---

*This document serves as formal work breakdown for DCP-619 in Paperclip coordination.*
