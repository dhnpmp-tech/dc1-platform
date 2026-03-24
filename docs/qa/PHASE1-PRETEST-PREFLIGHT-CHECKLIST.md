# Phase 1 Pre-Test Preflight Checklist — Day 4 Ready

**Date:** 2026-03-24
**QA Coordinator:** QA Engineer (agent 891b2856)
**Status:** ✅ READY — Awaiting Phase 1 Deployment (Blocked on DCP-641)

---

## Executive Summary

**QA Test Framework:** Complete and ready for immediate execution upon Phase 1 deployment live.

**Test Timeline:**
- **Day 4 (2026-03-26 08:00-12:00 UTC):** Infrastructure validation (12 checks)
- **Day 5 (2026-03-27 09:00-11:30 UTC):** Integration testing (30+ tests)
- **Day 6 (2026-03-28 08:00-12:00 UTC):** Load & security testing (23 tests) + go/no-go decision

**Current Blocker:** DCP-641 routing fix (GitHub PR not yet created)
**Blocker Timeline:** ~2 hours to unblock from PR creation

---

## Critical Dependency: Routing Fix Deployment

### What's Needed
✅ **Code ready:** Commit 5d59273 (fix: Support HuggingFace model IDs with slashes in routing)
❌ **PR status:** GitHub PR not created (waiting for Founder/DevOps)
⏳ **Critical path:** PR (0 min) → Review (15 min) → Merge (5 min) → Founder approval (60 min) → Deploy (30 min) = ~2 hours

### Why This Matters
- Model detail endpoints (`GET /api/models/{id}`, `POST /api/models/{id}/deploy`) currently HTTP 404
- QA test suites depend on these endpoints (6 of 30+ tests blocked)
- Phase 1 testing cannot proceed without these endpoints working

### Timeline Risk
- 🔴 **CRITICAL if** PR not created by 2026-03-25 00:00 UTC (19 hours)
- ⚠️ **HIGH RISK if** not deployed by 2026-03-25 16:00 UTC (40 hours)
- ✅ **Adequate if** deployed by 2026-03-26 06:00 UTC (62 hours)

---

## Day 4 Preflight Checklist (2026-03-26 08:00 UTC)

### Infrastructure Validation

#### **[1] Phase 1 Deployment Live**
- [ ] VPS 76.13.179.86 running latest code (pulls all Sprint 25/26 commits)
- [ ] api.dcp.sa HTTPS active and responding (health check: curl https://api.dcp.sa/health)
- [ ] PM2 services: dc1-provider-onboarding, dc1-webhook operational
- [ ] Database: Phase 1 schema intact, no migrations pending
- [ ] **Critical:** Model detail endpoints HTTP 200 (routing fix deployed)

**Owner:** DevOps team
**Dependencies:** DCP-641 merged and deployed

---

#### **[2] API Contract Validation**
- [ ] GET /api/models → Returns all 6 GPU tiers
- [ ] GET /api/models/{id} → Returns model detail (HF models with slashes work)
- [ ] POST /api/models/{id}/deploy → Returns estimate (no 404 errors)
- [ ] GET /api/pricing → Returns competitive DCP pricing
- [ ] POST /admin/tokens → Generates valid admin tokens

**Owner:** QA Engineer
**Dependencies:** Phase 1 deployment live
**Script:** `docs/SPRINT-26-DAY4-PRETEST-VALIDATION.md` (Section 1)

---

#### **[3] Database State Verification**
- [ ] Provider table: 43+ registered, 0+ active online
- [ ] Pricing table: RTX 4090 at 26,700 halala/hr (23.7% below Vast.ai)
- [ ] Job table: Clean (no stuck jobs from previous testing)
- [ ] Admin_tokens table: Valid long-lived token for tests
- [ ] Metering: Silent failure detection system active

**Owner:** QA Engineer
**Dependencies:** Phase 1 deployment live
**Script:** `docs/SPRINT-26-DAY4-PRETEST-VALIDATION.md` (Section 3)

---

#### **[4] Test Credentials & Access**
- [ ] DCP_RENTER_KEY: Valid test renter with $100 mock balance
- [ ] DC1_ADMIN_TOKEN: Valid admin token (48-hour expiry, signed)
- [ ] SSH access to VPS: QA can deploy monitoring and run scripts
- [ ] Docker: QA can run container tests on local machine
- [ ] Database: Direct SQL access for validation queries

**Owner:** DevOps / QA
**Status:** ✅ Prepared locally, awaiting VPS confirmation
**Setup:** `docs/SPRINT-26-TEST-EXECUTION-HANDBOOK.md` (Appendix A)

---

#### **[5] Metering System Validation**
- [ ] vLLM metering API: Responding with token counts
- [ ] Admin serve_sessions endpoint: Queryable, returns accurate records
- [ ] Database persistence: Token counts survive restart
- [ ] Silent failure detection: System reports when metering fails
- [ ] Smoke test: `scripts/phase1-e2e-smoke.mjs` runs 12/12 checks

**Owner:** QA Engineer
**Dependencies:** Phase 1 deployment live + routing fix
**Reference:** `docs/DCP-619-METERING-VERIFICATION-COMPLETE.md` (194 lines)

---

#### **[6] Pricing Engine Validation**
- [ ] All 6 GPU tiers seeded: RTX 4090, 4080, H100, H200, A100, L40S
- [ ] RTX 4090 pricing: 26,700 halala/hr (verified from strategic brief)
- [ ] Public API: No auth required, returns all prices
- [ ] Integration: Metering → Pricing → Billing chain works
- [ ] Test suite: `backend/tests/integration/pricing-api.test.js` passes (11 tests)

**Owner:** QA Engineer
**Dependencies:** Phase 1 deployment live
**Reference:** `docs/SP26-006-PRICING-ENGINE-QA.md` (211 lines)

---

#### **[7] Provider Connectivity Validation**
- [ ] Provider dashboard: 43 registrations visible
- [ ] Heartbeat system: Detects providers coming online (mock provider simulation)
- [ ] Job assignment: Provider can receive job assignment
- [ ] Earning accrual: Provider earnings tracked correctly
- [ ] Economics display: Provider sees accurate monthly projections

**Owner:** QA Engineer
**Dependencies:** Phase 1 deployment live + routing fix
**Script:** `docs/SPRINT-26-INTEGRATION-TEST-PLAN.md` (Suite P1-P3)

---

#### **[8] Renter Onboarding Validation**
- [ ] Registration: Renter can create account via web UI
- [ ] KYC: Registration flow complete without errors
- [ ] Wallet: Renter has valid Sepolia test balance
- [ ] Model selection: Renter can see and select models (routing fix critical)
- [ ] Pricing transparency: Renter sees competitive pricing vs hyperscalers

**Owner:** QA Engineer
**Dependencies:** Phase 1 deployment live + routing fix
**Script:** `docs/SPRINT-26-INTEGRATION-TEST-PLAN.md` (Suite R1-R3)

---

#### **[9] Admin Endpoints Security**
- [ ] Admin auth: Token validation works (48-hr expiry)
- [ ] Authorization: Non-admin tokens cannot access admin endpoints
- [ ] Endpoints live: GET /admin/serve_sessions, POST /admin/tokens respond
- [ ] Rate limiting: In place and working (no DDoS bypass)
- [ ] Logging: All admin actions logged and auditable

**Owner:** QA Engineer
**Dependencies:** Phase 1 deployment live
**Reference:** `docs/SPRINT-26-SECURITY-TESTING-PLAN.md` (Section 2)

---

#### **[10] Security Posture Check**
- [ ] HTTPS: Valid Let's Encrypt certificate (expires 2026-06-21)
- [ ] Headers: Security headers present (CSP, X-Frame-Options, etc.)
- [ ] SQL injection: No injectable parameters in API
- [ ] CORS: Correct origin restrictions in place
- [ ] Rate limits: DDoS protection active

**Owner:** QA Engineer
**Dependencies:** Phase 1 deployment live
**Reference:** `docs/SPRINT-26-SECURITY-TESTING-PLAN.md` (Sections 1, 3-6)

---

#### **[11] Deployment Artifacts**
- [ ] Git: Latest code on main branch
- [ ] Docker: Container images pushed to registry
- [ ] PM2: Configuration files present and syntactically correct
- [ ] Nginx: Reverse proxy configuration verified
- [ ] TLS: Certificate files present and valid

**Owner:** DevOps
**Status:** ✅ Sprint 26 complete, awaiting final deployment
**Reference:** `docs/DEVOPS-SPRINT-26-COMPLETION.md`

---

#### **[12] Monitoring & Observability**
- [ ] Logging: Application logs accessible (stdout/file)
- [ ] Health checks: `/health` endpoint responds and is accurate
- [ ] Metrics: Performance metrics exportable (response time, error rate)
- [ ] Alerting: Critical failures trigger notifications (if configured)
- [ ] Dashboard: Real-time monitoring dashboard operational

**Owner:** DevOps / QA
**Reference:** `docs/SPRINT-26-REALTIME-MONITORING.md`

---

## Post-Deployment Ready Actions

### **Immediately After Phase 1 Deployment (Day 4)**

```
14:00 UTC: Confirm all 12 preflight checks pass
14:30 UTC: Generate Day 4 pretest validation report
15:00 UTC: Brief Engineering team on readiness
15:30 UTC: Stand by for Day 5 integration testing (next morning)
```

### **Day 5 Integration Testing (2026-03-27 09:00 UTC)**

Execute 6 test suites (30+ test cases):
- P1-P3: Provider onboarding flows
- R1-R3: Renter job submission flows
- J1-J3: Job execution lifecycle
- M1-M3: Metering accuracy
- B1-B3: Billing & pricing accuracy
- E1-E2: E2E smoke tests

**Success Criteria:** 30+ tests pass, 0 critical failures
**Execution Time:** 2.5 hours (09:00-11:30 UTC)

### **Day 6 Load & Security Testing (2026-03-28 08:00 UTC)**

Execute load and security test suites:
- Load: 5 scenarios (ramp-up, sustained, spike, stress, soak)
- Security: 18+ tests (OWASP Top 10, billing integrity, auth)
- **Decision Point:** 12:00 UTC go/no-go for production launch

**Success Criteria:** Performance baselines met, 0 critical security issues
**Execution Time:** 4 hours (08:00-12:00 UTC)

---

## Known Risks & Mitigations

| Risk | Severity | Mitigation | Owner |
|------|----------|-----------|-------|
| Routing fix not deployed in time | CRITICAL | Monitoring active, escalation path clear | DevOps |
| Provider registration cleanup between tests | HIGH | SQL reset script prepared | QA |
| Silent metering failures | CRITICAL | Smoke test includes failure detection | QA |
| Load test cascading failures | HIGH | Gradual ramp-up, rollback plan | QA/DevOps |
| Security test false positives | MEDIUM | Test against known-safe baseline | QA |
| Timezone coordination across teams | MEDIUM | All times in UTC, calendar invites sent | QA |

---

## Test Documentation References

| Document | Purpose | Status |
|----------|---------|--------|
| SPRINT-26-DAY4-PRETEST-VALIDATION.md | 12-section infrastructure check | ✅ Ready |
| SPRINT-26-INTEGRATION-TEST-PLAN.md | 6 test suites, 30+ test cases | ✅ Ready |
| SPRINT-26-LOAD-TESTING-PLAN.md | 5 load scenarios, baselines | ✅ Ready |
| SPRINT-26-SECURITY-TESTING-PLAN.md | 6 categories, 18+ tests | ✅ Ready |
| SPRINT-26-TEST-EXECUTION-HANDBOOK.md | Step-by-step procedures | ✅ Ready |
| SPRINT-26-REALTIME-MONITORING.md | Monitoring checklist | ✅ Ready |
| DCP-619-METERING-VERIFICATION | Metering validation complete | ✅ Complete |
| SP26-006-PRICING-ENGINE-QA | Pricing validation complete | ✅ Complete |

---

## Approval & Readiness Sign-Off

**QA Coordinator:** QA Engineer (891b2856)
**Status:** ✅ **QA READY FOR PHASE 1 TESTING**
**Condition:** Awaiting Phase 1 deployment (blocked on DCP-641 routing fix PR creation)

**Approval Chain:**
- [ ] QA: Infrastructure preflight complete ✅ (pending deployment)
- [ ] DevOps: Phase 1 deployment live (awaiting DCP-641 merge)
- [ ] Founder: Go/no-go decision after Day 6 (pending test execution)

---

## Next Actions

1. **DevOps:** Merge DCP-641 routing fix and deploy to VPS
2. **QA:** Execute Day 4 preflight (2026-03-26 08:00 UTC)
3. **QA:** Execute Day 5 integration testing (2026-03-27 09:00 UTC)
4. **QA:** Execute Day 6 load & security testing (2026-03-28 08:00 UTC)
5. **Founder:** Review go/no-go decision (2026-03-28 12:00 UTC)

---

**Document Version:** 1.0
**Last Updated:** 2026-03-24 22:40 UTC
**Next Review:** 2026-03-26 07:00 UTC (Day 4, 1 hour before preflight)
