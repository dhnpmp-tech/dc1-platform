# Phase 1 Day 4 — Rapid Response Playbook

**Purpose:** Decision tree for rapid troubleshooting of common Day 4 failures
**Lead:** QA Engineer
**Created:** 2026-03-24
**Execution:** 2026-03-26 08:00 UTC

---

## Quick Reference Decision Tree

### IF: API endpoint returns 500+ error

**Immediate Action (< 1 min):**
```bash
# Check API health
curl -s https://api.dcp.sa/api/health | head
curl -s https://api.dcp.sa/api/models | head

# Check backend logs
tail -f /var/log/backend.log | head -50

# Check PM2 status
pm2 list
pm2 logs dc1-provider-onboarding | tail -20
```

**Diagnosis:**
- ✅ API responding: Continue testing
- ❌ API down or 500s: Escalate immediately to CEO

**Escalation Template:**
```
BLOCKER: API endpoint returning 500+ errors
- Affected endpoint: [which endpoint]
- Error: [error message]
- First occurrence: [timestamp]
- Recurring: Yes/No
- Last working state: [when]
Awaiting founder investigation.
```

---

### IF: Test suite shows >5% failures (3+ tests failing)

**Immediate Action (< 2 min):**
```bash
# Capture test output
npm run test:e2e 2>&1 | tee /tmp/test-failure.log

# Check which tests failed
grep "FAIL\|Error\|AssertionError" /tmp/test-failure.log

# Verify database state
sqlite3 /tmp/jest-*.db "SELECT COUNT(*) FROM providers; SELECT COUNT(*) FROM renters;"

# Check metering engine
node scripts/metering-verification.mjs 2>&1 | tail -30
```

**Diagnosis:**
- Test failure pattern: Database corruption? Missing data? Logic error?
- Metering check passes: Issue is in test data, not engine
- Metering check fails: Issue is in metering engine (DCP-757 regression)

**Recovery Actions:**
1. **If database corruption:** Clear test data, restart Jest
2. **If metering failure:** Check vLLM logs, verify token counts
3. **If test data missing:** Verify seeding in jest-setup.js

**Escalation Template:**
```
BLOCKER: >5% test suite failures
- Failed tests: [list test names]
- Error pattern: [what they have in common]
- Database state: [corruption? missing tables?]
- Attempted fixes: [what was tried]
Awaiting code review or database reset.
```

---

### IF: Silent metering failure detected (26/26 checks don't all pass)

**CRITICAL - Escalate immediately**

**Immediate Action (< 30 sec):**
```bash
# Stop all tests
CTRL+C

# Capture exact failure
node scripts/metering-verification.mjs 2>&1 | tee /tmp/metering-failure.log

# Check which specific check failed
grep -n "❌\|FAIL" /tmp/metering-failure.log
```

**Never Continue Testing.** Silent failures mean:
- Renter balances may be corrupted
- Provider earnings may be wrong
- Token counts not persisting
- **This blocks Day 5 integration testing**

**Escalation Template (IMMEDIATE):**
```
🔴 CRITICAL BLOCKER: Silent metering failure
- Check number that failed: [X of 26]
- Failure type: [balance? token count? calculation?]
- Database balance: [renter balance shown]
- Expected balance: [what it should be]
- Difference: [how much off]
Metering engine regression confirmed. Cannot proceed with Day 5.
Code review required for Sprint 25 metering fix (fb619e7).
```

---

### IF: Job lifecycle test fails at any stage

**Immediate Action (< 2 min):**
```bash
# Rerun job lifecycle test
node scripts/gpu-job-lifecycle-smoke.mjs 2>&1

# Check which stage failed
grep -i "provider\|submitted\|assigned\|executing\|completed" output.log

# Verify job in database
sqlite3 /tmp/jest-*.db "SELECT id, status, provider_id, renter_id FROM jobs ORDER BY created_at DESC LIMIT 1;"

# Check balance changes
sqlite3 /tmp/jest-*.db "SELECT renter_id, balance FROM renters WHERE id='[renter_id]';"
sqlite3 /tmp/jest-*.db "SELECT provider_id, earnings FROM providers WHERE id='[provider_id]';"
```

**Diagnosis:**
- Job created but not assigned: Provider unavailable
- Job assigned but not executing: Worker communication issue
- Job completed but balance not changed: Metering issue
- Balance changed incorrectly: Pricing calculation error

**Recovery Actions:**
1. **Provider unavailable:** Restart provider heartbeat
2. **Worker communication:** Check backend logs for timeouts
3. **Metering issue:** Run metering-verification.mjs
4. **Pricing error:** Check pricing config matches RTX 4090 rates

**Escalation Template:**
```
BLOCKER: Job lifecycle incomplete at stage [provider/assignment/execution/completion]
- Job ID: [uuid]
- Failed at: [which stage]
- Provider status: [online/offline]
- Expected balance change: [amount]
- Actual balance change: [amount]
- Error message: [from logs]
Awaiting [backend fix / configuration review].
```

---

### IF: Model catalog missing models or metadata incomplete

**Immediate Action (< 1 min):**
```bash
# Check catalog endpoint
curl -s https://api.dcp.sa/api/models | head -100

# Count models
curl -s https://api.dcp.sa/api/models | grep -o '"model_id"' | wc -l

# Check specific fields
curl -s https://api.dcp.sa/api/models | grep -E 'model_id|pricing|vram_gb|status'
```

**Diagnosis:**
- <11 models returned: DCP-641 deployment incomplete
- 11 models but missing pricing: Configuration issue
- Models missing metadata: Database query issue

**Recovery Actions:**
1. **Models missing:** Redeploy DCP-641 routing fix
2. **Pricing missing:** Restart backend service (pm2 restart dc1-provider-onboarding)
3. **Metadata missing:** Check infra/config/arabic-portfolio.json

**Escalation Template:**
```
BLOCKER: Model catalog incomplete
- Models returned: [count]/11
- Missing models: [list]
- Incomplete fields: [which ones]
- Last working state: [when]
Awaiting deployment verification.
```

---

### IF: Data isolation breach (provider sees renter data, vice versa)

**CRITICAL - Escalate immediately. This is a security issue.**

**Immediate Action (< 1 min):**
```bash
# Verify isolation with test data
sqlite3 /tmp/jest-*.db "
SELECT COUNT(*) as isolation_breach FROM (
  SELECT provider_id FROM provider_sessions
  INTERSECT
  SELECT renter_id FROM renter_sessions
);"

# If count > 0, isolation is breached
```

**Never Continue Testing.** Data isolation breach means:
- Renters can access provider earnings
- Providers can access renter credit balances
- **This disqualifies the platform from launch**

**Escalation Template (IMMEDIATE):**
```
🔴 CRITICAL SECURITY BLOCKER: Data isolation breach
- Breach type: [provider sees renter data / renter sees provider data]
- Affected records: [count]
- Breach scope: [which tables]
- Evidence: [SQL query result]
Security review required before any further testing.
Platform not launch-ready.
```

---

### IF: Balance corruption detected (credits don't reconcile)

**Immediate Action (< 2 min):**
```bash
# Check balance reconciliation
sqlite3 /tmp/jest-*.db "
SELECT
  (SELECT SUM(balance) FROM renters) as total_renter_balance,
  (SELECT SUM(earnings) FROM providers) as total_provider_earnings,
  (SELECT SUM(amount) FROM transactions) as total_transactions;"

# If sum(balance) != sum(transactions), corruption exists
```

**Diagnosis:**
- Balance > transactions: Credits created from nowhere
- Balance < transactions: Credits destroyed
- Balance != transactions: Transaction not reflected in balance

**Recovery Actions:**
1. **If credits created:** Check for uncapped earnings calculations
2. **If credits destroyed:** Check for duplicate deductions
3. **If mismatch:** Restore from clean database state

**Escalation Template:**
```
BLOCKER: Balance reconciliation failure
- Total renter balance: [amount]
- Total provider earnings: [amount]
- Total transactions: [amount]
- Discrepancy: [how much]
- Direction: [overcredited or undercredited]
Database consistency issue. Cannot proceed.
Awaiting database audit.
```

---

## Monitoring During Execution

**Real-Time Metrics to Watch:**

```bash
# Terminal 3: Live monitoring dashboard
while true; do
  echo "=== API Health ==="
  curl -s -w "Status: %{http_code}, Time: %{time_total}s\n" \
    https://api.dcp.sa/api/models > /dev/null

  echo "=== Model Catalog ==="
  curl -s https://api.dcp.sa/api/models | grep -o '"model_id"' | wc -l

  echo "=== Backend Logs (recent errors) ==="
  tail -n 5 backend/logs/app.log | grep -i error

  echo ""
  sleep 5
done
```

**Success Indicators (Green Lights):**
- ✅ API responds <200ms
- ✅ All 11 models present
- ✅ No error messages in logs
- ✅ Test output shows "✓" pass marks

**Warning Signs (Yellow Lights):**
- 🟡 API response 200-500ms
- 🟡 One or two models missing
- 🟡 Occasional warnings in logs
- 🟡 One test warning (not failure)

**Critical Signs (Red Lights):**
- 🔴 API response >500ms or timeouts
- 🔴 Multiple models missing
- 🔴 Multiple errors in logs
- 🔴 Any test failures (>0)

---

## Post-Failure Checklist

**If ANY blocker triggered:**

1. ✅ STOP all further testing immediately
2. ✅ Capture all state (logs, database, test output)
3. ✅ Copy logs to /tmp/day4-failure-logs/ with timestamp
4. ✅ Note exact time of failure
5. ✅ Document all symptoms and error messages
6. ✅ Post blocker comment to DCP-773 with escalation template
7. ✅ Wait for founder / CEO response before retrying

**Evidence to Capture:**
- Test output (full stderr + stdout)
- Backend logs (last 100 lines)
- Database state (key tables: providers, renters, jobs, transactions)
- API response (curl with -v for headers)
- System metrics (memory, CPU, disk)
- Timestamps (exact time of each symptom)

---

## Escalation Path

**For ANY critical blocker:**

1. **Immediately post to DCP-773:**
   - Blocker status, error details, timestamp
   - Use escalation template above

2. **Post to DCP-641 (parent):**
   - Summary of blocker
   - Link to DCP-773 comment

3. **Tag @CEO or @Founder (if available):**
   - Brief summary
   - Link to blocker comment

4. **Wait for response before retrying**
   - Do not attempt to "fix" and retry without approval
   - Do not skip validation sections
   - Do not proceed to Day 5 without GO decision

---

## Recovery Decision Tree

```
Test Fails
  ├─ API Error (500+)
  │   └─ → Check logs → Restart backend → Retry test
  ├─ >5% Test Failures
  │   └─ → Check database → Reset test data → Retry test
  ├─ Silent Metering Failure
  │   └─ → ESCALATE IMMEDIATELY (critical)
  ├─ Job Lifecycle Incomplete
  │   └─ → Check provider status → Check logs → Retry
  ├─ Model Catalog Incomplete
  │   └─ → Restart backend → Redeploy → Retry
  ├─ Data Isolation Breach
  │   └─ → ESCALATE IMMEDIATELY (security issue)
  └─ Balance Corruption
      └─ → ESCALATE IMMEDIATELY (data integrity issue)
```

---

**This playbook is your decision tree during Day 4 execution. Use it to rapidly diagnose and escalate blockers. Do not skip steps. Do not retry without diagnosis.**

**Ready to execute: 2026-03-26 08:00 UTC**

— QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
