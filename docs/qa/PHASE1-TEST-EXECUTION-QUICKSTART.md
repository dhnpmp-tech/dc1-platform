# Phase 1 Test Execution Quick-Start (Days 4-6)

## ⚡ QUICK REFERENCE FOR QA ENGINEER

**Current Status:** Routing fix merged ✅ | Awaiting founder deployment approval ⏳
**Testing Starts:** 2026-03-26 08:00 UTC (Day 4)
**Full Reference:** See docs/SPRINT-26-DAY4-PRETEST-VALIDATION.md (400 lines)

---

## 📋 PRE-TEST CHECKLIST (Execute 2026-03-26 07:45 UTC)

### 1. Environment Verification (10 min)
```bash
# Verify API is responding
curl -s https://api.dcp.sa/api/health | jq .
# Expected: {"status":"healthy","timestamp":"..."}

# Verify model endpoints are working
curl -s https://api.dcp.sa/api/models | jq '.length'
# Expected: 20+ models listed

# Verify test credentials are set
echo "DCP_RENTER_KEY: $DCP_RENTER_KEY"
echo "DCP_ADMIN_TOKEN: $DCP_ADMIN_TOKEN"
# Both should be non-empty
```

### 2. Monitoring Setup (15 min)
Open 3 terminal windows for real-time monitoring:

**Window 1: API Logs**
```bash
ssh dc1@76.13.179.86 "tail -f /var/log/dcp-backend.log"
```

**Window 2: Metrics Dashboard**
```bash
# In-browser: https://api.dcp.sa/admin/metrics
# Refresh every 30s
```

**Window 3: QA Command Prompt**
```bash
# Where you'll run test commands
cd /home/node/dc1-platform
```

### 3. Test Data Verification (5 min)
```bash
# Check if template catalog is loaded
curl -s https://api.dcp.sa/api/models/catalog | jq '.templates | length'
# Expected: 20 templates

# Check if Arabic portfolio is loaded
curl -s https://api.dcp.sa/api/models/portfolio-readiness | jq '.tiers_available'
# Expected: ["tier_a", "tier_b", "tier_c"]
```

---

## 🧪 DAY 4 TEST EXECUTION (2026-03-26 08:00-12:00 UTC)

### Validation Sections (12 total, ~20 min each)

**Execute in this order:**

1. **System Readiness** (8:00-8:20 UTC) — Check infrastructure, services, databases
2. **API Contract** (8:20-8:40 UTC) — Verify 50+ endpoints respond correctly
3. **Database State** (8:40-9:00 UTC) — Validate data integrity, schema
4. **Infrastructure** (9:00-9:20 UTC) — Verify VPS health, DNS, SSL cert
5. **Authentication** (9:20-9:40 UTC) — Test JWT, API keys, session tokens
6. **Metering** (9:40-10:00 UTC) — Verify token counting, usage tracking
7. **Pricing** (10:00-10:20 UTC) — Validate DCP vs competitor prices
8. **Provider Connectivity** (10:20-10:40 UTC) — Test provider registration, heartbeat
9. **Renter Onboarding** (10:40-11:00 UTC) — Full signup → job deployment flow
10. **Admin Endpoints** (11:00-11:20 UTC) — Verify admin dashboard, KPIs
11. **Security Posture** (11:20-11:40 UTC) — OWASP top 10, rate limiting, CORS
12. **Deployment Artifacts** (11:40-12:00 UTC) — Verify commit tags, release notes

### Day 4 Result Format
```markdown
# Phase 1 Day 4 Test Results (2026-03-26)

| Section | Status | Evidence | Notes |
|---------|--------|----------|-------|
| System Readiness | ✅ PASS | All services healthy | - |
| API Contract | ✅ PASS | 50+ endpoints verified | - |
| ... | | | |

## Summary
- Total: 12/12 PASS
- Duration: 4 hours
- Blockers: None
- Recommended: Proceed to Day 5
```

---

## 🧪 DAY 5 TEST EXECUTION (2026-03-27 09:00-11:30 UTC)

### Test Suites (5 total)

**Test Suite 1: Provider Onboarding** (30 min)
- Register new provider
- Verify heartbeat mechanism
- Check provider status in admin dashboard

**Test Suite 2: Job Submission** (30 min)
- Renter creates job (template deploy)
- Job queued and assigned to provider
- Provider pulls job metadata

**Test Suite 3: Metering** (20 min)
- Monitor token counts during inference
- Verify counts persist post-job
- Check billing calculation

**Test Suite 4: Pricing** (15 min)
- Verify DCP pricing vs strategic brief rates
- Check competitive savings badges
- Test premium tier surcharges

**Test Suite 5: Renter Flows** (25 min)
- Job history display
- Cost dashboard accuracy
- Wallet balance tracking

### Day 5 Result Format
```markdown
# Phase 1 Day 5 Test Results (2026-03-27)

| Suite | Tests | Pass | Fail | Notes |
|-------|-------|------|------|-------|
| Provider Onboarding | 5 | 5 | 0 | - |
| Job Submission | 6 | 6 | 0 | - |
| ... | | | | |

## Summary
- Total: 30+ test cases
- Pass Rate: 100%
- Failures: None
- Recommended: Proceed to Day 6
```

---

## 🧪 DAY 6 EXECUTION (2026-03-28 08:00-12:00 UTC)

### Part 1: Load Testing (60 min)
**5 load scenarios:**
1. Ramp-up (0-100 RPS over 10 min)
2. Sustained (100 RPS for 20 min)
3. Spike (100→500 RPS instantaneous)
4. Stress (increase until failure)
5. Soak (100 RPS for 60 min)

**Pass Criteria:**
- No 5xx errors during ramp-up, sustained
- Response time p99 < 2s during sustained
- Graceful degradation on spike (queuing, not errors)
- MTBF > 2 hours during soak

### Part 2: Security Testing (60 min)
**6 categories, 18+ test cases:**
1. Authentication (JWT, API keys, session hijacking)
2. Authorization (RBAC, data isolation)
3. Injection (SQL, command, XSS, CSRF)
4. Data Protection (encryption in transit/at rest)
5. Rate Limiting (per IP, per user, per endpoint)
6. Compliance (OWASP Top 10, PDPL)

**Pass Criteria:** All 18 tests pass, no HIGH/CRITICAL findings

### Day 6 Result Format
```markdown
# Phase 1 Day 6 Test Results (2026-03-28)

## Load Testing
| Scenario | RPS | Errors | Latency p99 | Status |
|----------|-----|--------|------------|--------|
| Ramp-up | 100 | 0 | 1.2s | ✅ PASS |
| ... | | | | |

## Security Testing
| Category | Cases | Pass | Fail | Status |
|----------|-------|------|------|--------|
| Authentication | 3 | 3 | 0 | ✅ PASS |
| ... | | | | |

## GO/NO-GO DECISION
**Recommendation:** GO / NO-GO
**Justification:** [See analysis below]
**Sign-Off:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
**Timestamp:** 2026-03-28 12:00 UTC
```

---

## 🚨 ESCALATION PROCEDURES

### If Test Fails During Execution

**Immediate:**
1. Stop current test section
2. Document exact failure (curl command, response, timestamp)
3. Post comment on DCP-641 with failure details
4. @Mention relevant engineer (Backend Architect, ML Infra, DevOps)

**Example Escalation Comment:**
```
🔴 **Day 4 Test Blocker:** API Contract validation failed
- Endpoint: `GET /api/models/:id`
- Error: 404 Not Found
- Model ID: ALLaM-AI/ALLaM-7B-Instruct-preview
- Expected: 200 with model details
- Timestamp: 2026-03-26 08:30 UTC
@Backend Architect — investigate routing regression
```

### If Timeline Slips
- Notify founder immediately via Paperclip comment
- Identify root cause (infrastructure, code, data)
- Adjust timeline or defer non-critical tests

---

## 📞 CONTACTS

- **QA Engineer:** 891b2856-c2eb-4162-9ce4-9f903abd315f
- **Backend Architect:** [See CLAUDE.md]
- **DevOps:** [See CLAUDE.md]
- **Founder:** setup@oida.ae (escalation only)

---

## 📊 Success Criteria (Full Phase 1 Pass)

✅ All 12 Day 4 validations pass
✅ 100% of Day 5 test cases pass
✅ Load testing targets met
✅ Zero HIGH/CRITICAL security findings
✅ Go/No-Go decision: **GO** for Phase 1 launch

If all 4 criteria met → Phase 1 launch approved ✅
If any criterion failed → Blocker resolution required before launch

---

**Last Updated:** 2026-03-24 00:18 UTC
**QA Engineer:** DCP-641 in_progress
**Status:** Ready to execute upon founder deployment approval
