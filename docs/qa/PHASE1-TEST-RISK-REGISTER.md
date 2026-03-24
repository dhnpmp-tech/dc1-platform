# Phase 1 Testing — Risk Register & Contingency Plans

**Date:** 2026-03-24
**QA Coordinator:** QA Engineer (agent 891b2856)
**Status:** Active — For reference during Days 4-6 testing

---

## Risk Matrix Overview

| Risk ID | Risk | Severity | Probability | Mitigation | Contingency |
|---------|------|----------|-------------|-----------|-------------|
| R1 | Routing fix not deployed in time | CRITICAL | MEDIUM | Monitoring active | Defer Day 5 to allow deployment window |
| R2 | Silent metering failures under load | CRITICAL | MEDIUM | Smoke test includes detection | Investigate database persistence |
| R3 | Provider registration state pollution | HIGH | HIGH | Reset script prepared | Manual cleanup via SQL |
| R4 | Load test cascading failures | HIGH | MEDIUM | Gradual ramp-up approach | Reduce load scenario intensity |
| R5 | Security test false positives | MEDIUM | LOW | Test against known baseline | Manual verification by security team |
| R6 | Database deadlocks under concurrency | HIGH | MEDIUM | Connection pooling tuned | Reduce concurrent request count |
| R7 | Container image not available | CRITICAL | LOW | Build verified pre-Day 4 | Use fallback image or manual build |
| R8 | TLS certificate expired | CRITICAL | VERY LOW | Cert valid through 2026-06-21 | Emergency renewal (certbot) |
| R9 | Provider not coming online | HIGH | MEDIUM | Mock provider tool available | Manual provider simulation |
| R10 | Admin token expiry during tests | MEDIUM | MEDIUM | Generate 48-hr token | Token refresh procedure documented |

---

## Critical Risk Scenarios & Mitigations

### **R1: Routing Fix Not Deployed (CRITICAL)**

**Scenario:** GitHub PR creation delayed, routing fix not deployed by Day 4 start.

**Impact:**
- Model detail endpoints still HTTP 404
- 6 of 30+ QA tests blocked
- Phase 1 launch delayed

**Mitigation (Primary):**
- Monitoring active with 5-minute check (Job f0c77c1b)
- Escalation path clear (CEO chain of command)
- Timeline adequate if deployed by 2026-03-26 06:00 UTC (62 hours away)

**Contingency (If Risk Occurs):**
1. **Option A (Preferred):** Defer Day 5 testing by 24 hours
   - Allows more deployment window
   - No impact to Day 6 go/no-go decision (still 2026-03-28)
   - Gives 86 hours for deployment from now

2. **Option B (If Must Test):** Run Day 4 preflight only, skip blocked tests
   - Execute 1-6 of 12 preflight checks (those not dependent on routing fix)
   - Skip metering, provider, renter tests
   - Restart full test suite once routing fix deployed

3. **Option C (Escalation):** Founder manually creates PR on GitHub.com
   - Takes 2 minutes
   - Unblocks code review immediately
   - Founder approval chain then proceeds (~2 hours total to deployment)

**Decision Point:** 2026-03-25 12:00 UTC — if PR not created by then, choose Contingency Option A or C

---

### **R2: Silent Metering Failures Under Load (CRITICAL)**

**Scenario:** Metering system drops tokens during load test without raising errors (silent failure).

**Impact:**
- Provider earnings incorrect
- Customer charges wrong
- Financial integrity compromised
- Launch becomes high risk

**Mitigation (Primary):**
- Smoke test includes explicit failure detection (phase1-e2e-smoke.mjs step 7)
- Query admin serve_sessions endpoint before and after load
- Verify token count consistency
- Test runs with monitoring dashboard active

**Contingency (If Risk Occurs):**
1. **Immediately (During Day 6 load test):**
   - Stop load test (reduce from spike/stress levels)
   - Query serve_sessions endpoint directly: `curl -H "Admin-Token: ..." https://api.dcp.sa/admin/serve_sessions`
   - Verify token counts match expected values
   - If counts diverge, escalate to Backend/ML Infra engineer

2. **Root Cause Investigation:**
   - Check database connection pool limits (may be dropping records under high concurrency)
   - Review vLLM metering API logs for timeout/error responses
   - Validate database query performance under load
   - Check for race conditions in token persistence logic

3. **Recovery Path:**
   - If fixable in <1 hour: Rerun load test at reduced intensity
   - If requires code changes: Escalate for hot fix, retest
   - If cannot be resolved: NO-GO decision (metering is critical path)

---

### **R3: Provider Registration State Pollution (HIGH)**

**Scenario:** Provider registration cleanup between test runs fails; tests see stale provider data.

**Impact:**
- False test failures (provider appears offline when it should be online)
- Inconsistent test results
- Harder to diagnose real issues vs test pollution

**Mitigation (Primary):**
- Reset script prepared: `DELETE FROM providers WHERE email LIKE '%test%'`
- Test data uses unique identifiers (timestamp-based provider emails)
- Database snapshots before/after each test suite

**Contingency (If Risk Occurs):**
1. **Quick Fix (5 min):**
   ```sql
   DELETE FROM providers WHERE created_at > (now() - interval '24 hours') AND email LIKE '%test%';
   ```
   - Clears test providers from current session

2. **Full Reset (10 min):**
   - Execute SQL cleanup script
   - Verify provider count returns to baseline
   - Reseed expected providers for tests

3. **If SQL Access Not Available:**
   - Use web UI to manually deregister test providers
   - Confirm via GET /api/providers that only baseline providers remain

---

### **R4: Load Test Cascading Failures (HIGH)**

**Scenario:** Load ramp-up causes cascading failure (one component fails, triggers others to fail).

**Impact:**
- Tests appear to fail when root cause is unrelated
- Hard to diagnose which component actually failed
- May block go/no-go decision

**Mitigation (Primary):**
- Gradual ramp-up approach (not sudden spike)
- Load test scenarios ordered by intensity: ramp-up → sustained → spike → stress → soak
- Real-time monitoring with dashboard showing per-component metrics
- Rollback triggers defined for each scenario

**Contingency (If Risk Occurs):**
1. **During test:**
   - Immediately reduce load to last known good level
   - Allow 5 minutes for system to recover
   - Identify which component first showed errors (check logs)

2. **Diagnostic Steps:**
   - Query monitoring dashboard: response times per endpoint
   - Check database connection pool utilization
   - Review vLLM queue depth (may be bottleneck)
   - Verify no OOM or CPU throttling on VPS

3. **Recovery:**
   - If issue is resource-related: Reduce concurrent requests by 50%
   - If issue is queue-related: Increase queue size or worker count
   - If issue is code bug: Escalate for hot fix
   - Retest at lower intensity

4. **Decision Impact:**
   - If tests pass at 70% of target load: Acceptable (still strong perf)
   - If tests pass at 50% of target load: Acceptable with caveat
   - If tests fail at <50% target load: NO-GO (investigate further before launch)

---

### **R5: Security Test False Positives (MEDIUM)**

**Scenario:** Security test flags potential vulnerability that turns out to be test artifact or false positive.

**Impact:**
- Blocks go/no-go decision unnecessarily
- Creates false concern about security posture
- May delay launch for investigation

**Mitigation (Primary):**
- All security tests validated against known-safe baseline
- Tests written to be strict but not overly paranoid
- False positive known issues documented in test comments

**Contingency (If Risk Occurs):**
1. **During security testing:**
   - Note the specific test and failure details
   - Immediately review test code to understand what it's checking
   - Run test against baseline (known-safe code) to see if it's environment-specific

2. **Investigation:**
   - Compare production system to test setup (may be test-only behavior)
   - Check if issue is real vulnerability vs test misconfig
   - Consult with Security engineer for assessment

3. **Resolution:**
   - If false positive: Update test expectations or add exception
   - If real issue: Escalate for security review
   - Document decision in test report

---

### **R6: Database Deadlocks Under Concurrency (HIGH)**

**Scenario:** Load test causes database deadlock (multiple transactions waiting for locks).

**Impact:**
- Requests timeout or fail
- System appears to hang under moderate load
- Launch becomes risky

**Mitigation (Primary):**
- Database connection pooling tuned for expected load (see config)
- Query timeouts set to 5 seconds (prevents indefinite waits)
- Transaction isolation level set appropriately
- Load test uses realistic think-time between requests

**Contingency (If Risk Occurs):**
1. **Immediate:**
   - Reduce concurrent requests by 50%
   - Wait 30 seconds for system to recover
   - Attempt test again

2. **Investigation:**
   - Check database slow query log
   - Look for long-running transactions or locks
   - Review connection pool utilization
   - Verify no table scans without indexes

3. **Resolution:**
   - Increase connection pool size (if undersized)
   - Reduce concurrent requests to sustainable level
   - Add database indexes if missing
   - If structural issue: Escalate for code review

---

### **R7: Container Image Not Available (CRITICAL)**

**Scenario:** Docker image (dc1/llm-worker:latest) not built or not pushed to registry.

**Impact:**
- Provider cannot pull and run model container
- Test cannot verify provider can execute jobs
- Launch blocked

**Mitigation (Primary):**
- Container build verified before Day 4 (DCP-642 dependency)
- Build workflow: `.github/workflows/docker-instant-tier.yml` committed and triggers on push
- Docker image pushed to public registry

**Contingency (If Risk Occurs):**
1. **Verification (Day 4 preflight):**
   ```bash
   docker pull dc1/llm-worker:latest
   docker images | grep dc1/llm-worker
   ```

2. **If Image Not Available:**
   - Check GitHub Actions for build failures (workflow logs)
   - Manually trigger build: `gh workflow run docker-instant-tier.yml`
   - Monitor build completion (typically 15-20 min)
   - Verify image pushed to registry

3. **If Build Still Fails:**
   - Check Dockerfile syntax (`.github/workflows/docker-instant-tier.yml`)
   - Verify Docker Hub credentials configured in GitHub Actions
   - Manual build on local machine as fallback
   - Contact DevOps for emergency build

---

### **R8: TLS Certificate Expired (CRITICAL)**

**Scenario:** HTTPS certificate expired or invalid.

**Impact:**
- api.dcp.sa returns certificate errors
- All HTTPS requests fail
- Launch blocked

**Mitigation (Primary):**
- Current certificate valid through 2026-06-21 (90+ days)
- Let's Encrypt auto-renewal configured
- Certificate verified in Day 4 preflight (#10)

**Contingency (If Risk Occurs):**
1. **Check certificate:**
   ```bash
   openssl s_client -connect api.dcp.sa:443 -showcerts | grep -A2 "Validity"
   ```

2. **If Expired:**
   - SSH to VPS: `ssh root@76.13.179.86`
   - Trigger certbot renewal: `certbot renew --force-renewal`
   - Restart nginx: `systemctl restart nginx`
   - Verify: `curl -I https://api.dcp.sa/health`

---

### **R9: Provider Not Coming Online (HIGH)**

**Scenario:** Provider registration works but provider never actually comes online (no heartbeat received).

**Impact:**
- Cannot test provider job execution
- Blocks Days 5-6 testing
- Launch decision at risk

**Mitigation (Primary):**
- Provider onboarding flow includes heartbeat simulation
- Mock provider tool available for testing
- Provider economics display can be tested without actual provider

**Contingency (If Risk Occurs):**
1. **Check provider status:**
   - Query database: `SELECT email, status, last_heartbeat FROM providers WHERE email = 'test-provider@dc1.test'`
   - Check for heartbeat timestamp (should be recent)

2. **If No Heartbeat:**
   - Verify provider application is running on provider machine
   - Check network connectivity to api.dcp.sa
   - Verify provider credentials/API key is correct
   - Check provider application logs for errors

3. **Fallback (Mock Provider):**
   - Use mock provider tool: `scripts/mock-provider-heartbeat.sh`
   - Simulates provider heartbeat and job execution
   - Allows testing without actual provider hardware
   - Sufficient for Days 5-6 validation

---

### **R10: Admin Token Expiry During Tests (MEDIUM)**

**Scenario:** Admin token expires mid-test-run (tokens valid 48 hours).

**Impact:**
- Admin-only endpoints return 401 Unauthorized
- Tests that depend on admin auth fail
- Requires token refresh and test restart

**Mitigation (Primary):**
- Admin token generated fresh on Day 4 morning
- Token has 48-hour validity (expires 2 days later)
- Test execution spans only 4 hours (well within validity)
- Token expiry checked as first step of Day 5 & Day 6 test runs

**Contingency (If Risk Occurs):**
1. **During test:**
   - If you see `401 Unauthorized` from admin endpoints
   - Check token expiry: `echo $DC1_ADMIN_TOKEN | jq '.exp'` (if JWT)
   - If expired, generate new token: `curl -X POST https://api.dcp.sa/admin/tokens -d '...'`
   - Update environment variable: `export DC1_ADMIN_TOKEN="...new token..."`
   - Restart test suite

---

## Test Data Requirements Checklist

### Day 4 (Before 08:00 UTC)
- [ ] Test renter account: `test-renter@dc1.test` with $100 mock balance
- [ ] Test admin token: Valid, 48-hour expiry
- [ ] Test provider registration: 1 pre-registered test provider
- [ ] Database clean: No stuck jobs from previous runs
- [ ] SSH access ready: Can SSH to VPS for monitoring

### Day 5 (Before 09:00 UTC)
- [ ] Previous Day 4 data still present
- [ ] Provider heartbeat system active
- [ ] Job queue empty (no leftover jobs)
- [ ] Monitoring dashboard accessible
- [ ] Real-time logs accessible

### Day 6 (Before 08:00 UTC)
- [ ] All Day 5 data still present (for load test validation)
- [ ] Load testing tools ready (Apache Bench, wrk, or similar)
- [ ] Monitoring dashboard accessible
- [ ] Alert system armed (if configured)

---

## Go/No-Go Decision Criteria

**GO DECISION CRITERIA (all must be true):**
- ✅ Metering: Silent failure detection works, 100% token accuracy
- ✅ Pricing: All 6 tiers, RTX 4090 competitive
- ✅ Provider: At least 1 provider online, can execute jobs
- ✅ Renter: Full onboarding flow works end-to-end
- ✅ Performance: Pricing API >450 RPS, <200ms p99, error rate <1% under load
- ✅ Security: All CRITICAL tests pass, no SQL injection, auth working
- ✅ Load: System handles spike test (2x sustained load) without cascading failures

**NO-GO DECISION CRITERIA (any true):**
- ❌ Metering: Silent failures detected or token counts inaccurate
- ❌ Pricing: Missing tiers or pricing logic broken
- ❌ Performance: Cannot sustain target load (<300 RPS or >400ms p99)
- ❌ Security: CRITICAL security test fails (auth bypass, injection, etc.)
- ❌ Stability: Cascading failures under load, not recoverable
- ❌ Provider: Cannot onboard provider or receive heartbeat
- ❌ Data Integrity: Job state corruption or lost metering data

---

## Escalation Path During Testing

**If CRITICAL issue found:**
1. **Immediately:** Stop test run and document exactly what failed
2. **Alert:** Message CEO and Engineering Lead via Paperclip
3. **Analysis:** Determine if fixable in <1 hour
4. **Decision:**
   - **If fixable:** Pause testing, apply fix, retest
   - **If not fixable:** Mark as NO-GO issue, continue with remaining tests
   - **If high-risk issue:** Escalate to Founder for decision

---

## Testing Success Tracking

**Track these metrics during Days 4-6:**
- Test suite pass rate (per day)
- Performance metrics (response time p50/p95/p99, RPS)
- Error rate and error types
- Database query performance
- Resource utilization (CPU, memory, disk I/O)
- Provider availability
- Renter conversion funnel

---

**Document Version:** 1.0
**Last Updated:** 2026-03-24 22:45 UTC
**Review Schedule:** Before each test day (Day 4, 5, 6 at 07:00 UTC)
