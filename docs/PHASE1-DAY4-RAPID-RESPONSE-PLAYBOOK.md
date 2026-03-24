# Phase 1 Day 4 — Rapid Response Playbook

**Purpose:** Quick decision tree and remediation steps for common failures during Day 4 execution (2026-03-26 08:00-12:00 UTC)

**Status:** Ready for execution
**Created:** 2026-03-24 06:21 UTC
**QA Engineer:** 891b2856-c2eb-4162-9ce4-9f903abd315f

---

## Quick Reference: Decision Tree

```
IF test fails → Check type below → Follow remediation steps → Escalate if needed
```

---

## Section 1: API Health Check Failures

### Symptom: `/api/health` returns 500 or timeout

**Immediate Actions (< 2 min):**
```bash
# 1. Verify API is running
curl -v https://api.dcp.sa/api/health

# 2. Check backend service status
ssh admin@76.13.179.86 "pm2 status"

# 3. Check PM2 logs for errors
ssh admin@76.13.179.86 "pm2 logs dc1-provider-onboarding --lines 50"

# 4. Check disk/memory on VPS
ssh admin@76.13.179.86 "free -h && df -h"
```

**If API is down:**
- ❌ **BLOCKER FOUND** — Cannot proceed with Day 4
- **Escalate:** Post to DCP-641 immediately: "API health check failing. Cannot proceed to test execution."
- **Tag:** @CEO (urgent)
- **Expected Action:** Restart PM2 services or investigate backend logs

**If API responds but health endpoint broken:**
- ✅ **WORKAROUND:** Continue with Day 4. Skip health check section. Document in report.
- **Action:** Re-run at section 3 (API Health Checks), record status as "PARTIAL PASS"

---

## Section 2: Database Connection Failures

### Symptom: "Database connection refused" or "constraint violation"

**Immediate Actions:**
```bash
# 1. Verify SQLite database exists and is not corrupted
ls -lh backend/database/dc1.db

# 2. Check database integrity
sqlite3 backend/database/dc1.db "PRAGMA integrity_check;"
# Expected: "ok"

# 3. Verify tables exist
sqlite3 backend/database/dc1.db ".tables"
# Expected: 20+ tables listed

# 4. Check for table locks
sqlite3 backend/database/dc1.db "PRAGMA database_list;"
```

**If database is corrupted:**
- ❌ **BLOCKER FOUND** — Cannot proceed with metering/pricing tests
- **Recovery:** Restore from backup (if available)
- **Escalate:** Post to DCP-641: "Database corrupted. Requires backup restore."
- **Tag:** @CEO + @Backend-Architect

**If tables are missing:**
- ❌ **BLOCKER FOUND** — Database schema incomplete
- **Recovery:** Re-run migrations: `npm run db:migrate`
- **Escalate:** Post to DCP-641: "Database schema missing. Re-ran migrations."

---

## Section 3: Model Catalog Not Responding

### Symptom: `/api/models` returns empty array or 404

**Immediate Actions:**
```bash
# 1. Verify model catalog endpoint
curl -s https://api.dcp.sa/api/models | wc -l
# Expected: ~200+ lines (11 models + metadata)

# 2. Check if model data is in database
sqlite3 backend/database/dc1.db "SELECT COUNT(*) FROM models;"
# Expected: 11

# 3. Verify infra/config/arabic-portfolio.json exists
ls -lh infra/config/arabic-portfolio.json

# 4. Check if API is reading config correctly
curl -s https://api.dcp.sa/api/admin/debug/models | head -c 500
```

**If models exist but API not returning them:**
- ⚠️ **DEGRADED MODE** — Data exists, API route issue
- **Remediation:** Restart backend service
  ```bash
  ssh admin@76.13.179.86 "pm2 restart dc1-provider-onboarding"
  sleep 5
  curl -s https://api.dcp.sa/api/models | wc -l
  ```
- **If still fails:** Escalate to Backend Architect

**If models missing from database:**
- ❌ **BLOCKER FOUND** — Model catalog data not deployed
- **Escalate:** "DCP-641 deployment incomplete. Model catalog missing from database."
- **Recovery:** Re-deploy DCP-641 changes

---

## Section 4: Metering Calculation Errors

### Symptom: Token counts mismatch or cost calculations off by >0.1%

**Immediate Actions:**
```bash
# 1. Verify vLLM integration endpoint
curl -s https://api.dcp.sa/api/vllm/status

# 2. Test metering with simple request
curl -X POST https://api.dcp.sa/api/metering/test \
  -H "Authorization: Bearer $DCP_RENTER_KEY" \
  -d '{"tokens": 100, "model": "RTX 4090"}'

# 3. Check metering table for recent entries
sqlite3 backend/database/dc1.db \
  "SELECT * FROM metering_records ORDER BY created_at DESC LIMIT 5;"

# 4. Verify pricing rates in database
sqlite3 backend/database/dc1.db \
  "SELECT model, rate_usd_per_hour FROM gpu_rates WHERE model='RTX 4090';"
# Expected: 0.267 (or close)
```

**If token counting is off:**
- ⚠️ **DEGRADED MODE** — Metering exists but inaccurate
- **Impact:** Affects pricing/earnings calculations
- **Document:** "Token counting off by X%. Documented. Continuing with Day 5."
- **Follow-up:** Escalate to ML Infra Engineer post-Day-4

**If rates are wrong:**
- 🔴 **CRITICAL** — Pricing engine broken
- **Remediation:** Update rates table
  ```bash
  sqlite3 backend/database/dc1.db \
    "UPDATE gpu_rates SET rate_usd_per_hour=0.267 WHERE model='RTX 4090';"
  ```
- **Verify:** Re-run metering test
- **Escalate if persists:** "Pricing rates corrupted or missing"

---

## Section 5: Provider Onboarding Flow Blocked

### Symptom: Provider registration endpoint returns 500 or rejects requests

**Immediate Actions:**
```bash
# 1. Test provider registration
curl -X POST https://api.dcp.sa/api/providers/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Provider","wallet":"0xtest","gpu_model":"RTX 4090"}'

# 2. Check if provider table has data
sqlite3 backend/database/dc1.db "SELECT COUNT(*) FROM providers;"

# 3. Verify API key generation is working
curl -X POST https://api.dcp.sa/api/providers/generate-key \
  -H "Authorization: Bearer $DC1_ADMIN_TOKEN" \
  -d '{"provider_id":"test"}'
```

**If registration is failing:**
- ⚠️ **DEGRADED MODE** — Use existing test provider
- **Workaround:** Skip provider onboarding validation (section 4)
- **Document:** "Provider registration blocked. Skipped. Continuing with renter flow."

**If API key generation broken:**
- 🔴 **CRITICAL** — Cannot assign work to providers
- **Remediation:** Restart auth service
- **Escalate:** "Provider authentication service down"

---

## Section 6: Renter Credit/Balance Issues

### Symptom: Credit topup returns 402 or balance queries fail

**Immediate Actions:**
```bash
# 1. Test renter balance endpoint
curl -s https://api.dcp.sa/api/renters/balance \
  -H "Authorization: Bearer $DCP_RENTER_KEY"

# 2. Check renter account in database
sqlite3 backend/database/dc1.db \
  "SELECT id, balance, credits FROM renters LIMIT 1;"

# 3. Test topup endpoint
curl -X POST https://api.dcp.sa/api/renters/topup \
  -H "Authorization: Bearer $DCP_RENTER_KEY" \
  -d '{"amount": 10}'

# 4. Verify wallet escrow is accessible
curl -s https://api.dcp.sa/api/escrow/status
```

**If balance queries fail but topup works:**
- ⚠️ **DEGRADED MODE** — Read/write operations misaligned
- **Document:** "Balance query unreliable. Using topup as source of truth."

**If topup is failing:**
- 🔴 **CRITICAL** — Renters cannot fund their accounts
- **Remediation:** Verify escrow wallet connection
  - Check if wallet is funded: `curl https://api.dcp.sa/api/escrow/balance`
  - If unfunded: Escalate to Founding Engineer for wallet funding
- **Escalate:** "Renter credit system down. Escrow wallet issue?"

---

## Section 7: Job Submission/Lifecycle Blocked

### Symptom: Job submission returns 500, jobs never transition through stages

**Immediate Actions:**
```bash
# 1. Test job submission
curl -X POST https://api.dcp.sa/api/jobs/submit \
  -H "Authorization: Bearer $DCP_RENTER_KEY" \
  -d '{"model":"RTX 4090","duration_minutes":5}'

# 2. Check if job was created
sqlite3 backend/database/dc1.db \
  "SELECT id, status, created_at FROM jobs ORDER BY created_at DESC LIMIT 5;"

# 3. Verify job assignment works
curl -X POST https://api.dcp.sa/api/jobs/{job_id}/assign \
  -H "Authorization: Bearer $DCP_PROVIDER_KEY"

# 4. Check event log
sqlite3 backend/database/dc1.db \
  "SELECT * FROM job_events ORDER BY created_at DESC LIMIT 10;"
```

**If job submission fails:**
- 🔴 **CRITICAL** — Cannot test core workflow
- **Remediation:** Check backend logs for detailed error
  ```bash
  ssh admin@76.13.179.86 "pm2 logs dc1-provider-onboarding --err | tail -20"
  ```
- **Escalate:** "Job submission broken. Backend error details in logs."

**If jobs are created but not transitioning:**
- ⚠️ **DEGRADED MODE** — Data exists, state machine broken
- **Document:** "Job state transitions failing. Manual recovery needed."
- **Escalate:** "Job state machine broken. Affects end-to-end flow."

---

## Section 8: Data Isolation Breach

### Symptom: Provider A can see Provider B's data, or Renter A sees Renter B's balance

**Immediate Actions:**
```bash
# 1. Create test data for Provider A
curl -X POST https://api.dcp.sa/api/providers/register \
  -d '{"name":"Provider A","wallet":"0xa"}'

# 2. Get Provider A API key
PROVIDER_A_KEY="[from previous call]"

# 3. Create test data for Provider B
curl -X POST https://api.dcp.sa/api/providers/register \
  -d '{"name":"Provider B","wallet":"0xb"}'
PROVIDER_B_KEY="[from previous call]"

# 4. Try to access Provider B data as Provider A
curl -s https://api.dcp.sa/api/providers/profile/b \
  -H "Authorization: Bearer $PROVIDER_A_KEY"
# Expected: 403 Forbidden or empty/own data
```

**If isolation is breached:**
- 🔴 **CRITICAL SECURITY ISSUE** — Cannot launch with data isolation breach
- **Action:** STOP Day 4 execution immediately
- **Escalate:** "SECURITY: Data isolation breach detected. Cannot proceed to Day 5."
- **Tag:** @CEO + @Security
- **Decision:** Day 4 = NO-GO. Requires security fix before Day 5.

**If isolation is intact:**
- ✅ **PASS** — Proceed normally

---

## Section 9: Escalation Template

**Use this when reporting blockers to CEO:**

```markdown
## Day 4 Blocker Report

**Issue:** [What failed]
**Section:** [Which section failed]
**Severity:** 🔴 CRITICAL / ⚠️ DEGRADED / ✅ PARTIAL-PASS
**Time Detected:** [HH:MM UTC]
**Impact:** [What can't be tested]

**Root Cause:** [If known]

**Remediation Attempted:**
- [ ] Step 1
- [ ] Step 2

**Current Status:** [Working/Failed]

**Decision:** Day 4 [PASS/NO-GO/PARTIAL-PASS]

**Next Steps:** [What happens next]

**Requested Action:** [What CEO needs to do]

**Contact:** QA Engineer (available for clarification)
```

---

## Section 10: Real-Time Metrics During Execution

**Monitor these metrics continuously (Terminal 3):**

```bash
# Terminal 3: Real-time metrics
watch -n 5 'echo "=== API Latency ===" && \
  curl -s -w "%{time_total}\n" -o /dev/null https://api.dcp.sa/api/health && \
  echo "=== Error Log Tail ===" && \
  tail -5 backend/logs/app.log && \
  echo "=== Database Queries ===" && \
  sqlite3 backend/database/dc1.db "SELECT COUNT(*) as job_count FROM jobs;" && \
  echo "=== Memory Usage ===" && \
  free -h | grep Mem'
```

**Target Metrics:**
- API latency: < 200ms
- Error log: No 500 errors
- Job count: Increasing as tests run
- Memory: > 1GB available

**Red Flags:**
- API latency > 500ms → Possible resource exhaustion
- 500 errors appearing → Backend crash
- Memory < 500MB → OOM risk
- Disk < 5% free → Disk full risk

---

## Section 11: Post-Failure Recovery Checklist

**If Day 4 fails, before moving to resolution, execute:**

1. **Capture State**
   ```bash
   # Backup database
   cp backend/database/dc1.db backend/database/dc1.db.backup.day4-failure

   # Export logs
   tail -1000 backend/logs/app.log > day4-failure-logs.txt

   # Export error details
   curl -s https://api.dcp.sa/api/admin/debug/status > day4-failure-debug.json
   ```

2. **Document Failure**
   - Screenshot of error
   - Timestamp
   - Exact error message
   - What was being tested
   - What section failed

3. **Notify Team**
   - Post to DCP-641
   - Include all captured state
   - Tag CEO for decision on next steps

4. **Await Instructions**
   - Do not restart services without approval
   - Do not retry without understanding root cause
   - Wait for CEO/Backend Architect guidance

---

## Section 12: Success Criteria Refresh

**Day 4 PASS requires:**
- ✅ All 12 sections completed
- ✅ Zero critical blockers
- ✅ No data isolation breaches
- ✅ Metering accuracy ±0.1%
- ✅ All smoke tests passing

**Day 4 NO-GO if:**
- ❌ Any critical blocker found
- ❌ Data isolation breach
- ❌ Metering accuracy > 0.5% off
- ❌ >5% of tests failing
- ❌ Silent failures detected

---

## Quick Command Reference

**Emergency restart (if needed):**
```bash
ssh admin@76.13.179.86 "pm2 stop dc1-provider-onboarding && sleep 2 && pm2 start dc1-provider-onboarding"
```

**Database backup:**
```bash
cp backend/database/dc1.db backend/database/dc1.db.backup.$(date +%s)
```

**Check all services:**
```bash
ssh admin@76.13.179.86 "pm2 list"
```

**View live logs:**
```bash
ssh admin@76.13.179.86 "pm2 logs dc1-provider-onboarding"
```

---

**Created by:** QA Engineer
**Ready for Day 4 execution:** 2026-03-26 08:00 UTC
**Last Updated:** 2026-03-24 06:21 UTC
