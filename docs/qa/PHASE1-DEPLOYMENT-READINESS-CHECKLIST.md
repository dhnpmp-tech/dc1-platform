---
name: Phase 1 Deployment Readiness Checklist
description: Step-by-step verification procedures for production deployment readiness
---

# Phase 1 Deployment Readiness Checklist

**Date:** 2026-03-24
**Prepared by:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
**Triggered on:** Upon founder approval of DCP-641 deployment
**Timeline:** Execute immediately after founder posts approval

---

## Quick Reference: Deployment Approval Trigger

**When founder posts this to DCP-641:**
```
✅ Approved for deployment to production VPS 76.13.179.86
```

**Then execute this checklist in order:**
1. Pre-deployment verification (5 min)
2. Deployment execution (30 min)
3. Post-deployment validation (5 min)
4. QA smoke tests (5 min)
5. Phase 1 testing readiness declaration

**Total time:** ~50 minutes
**Deadline for completion:** 2026-03-26 06:00 UTC (adequate buffer)

---

## Phase 1: Pre-Deployment Verification (5 minutes)

### Check 1: Code on Main
```bash
cd /home/node/dc1-platform
git log --oneline origin/main | head -5 | grep -i "dcp-641\|routing"
```
**Expected:** Commit 1cbfc42 visible
**Status:** [ ] Pass / [ ] Fail

### Check 2: CI/CD Green
- Verify: GitHub Actions show all checks passing on main
- Check: No failed builds in CI/CD dashboard
**Status:** [ ] Pass / [ ] Fail

### Check 3: VPS Connectivity
```bash
ssh root@76.13.179.86 "echo 'VPS reachable'"
```
**Expected:** SSH connection successful
**Status:** [ ] Pass / [ ] Fail

### Check 4: Current Service Status
```bash
ssh root@76.13.179.86 "pm2 list"
```
**Expected:** dc1-provider-onboarding running on port 8083
**Status:** [ ] Pass / [ ] Fail

---

## Phase 2: Deployment Execution (30 minutes)

### Step 1: SSH to VPS (1 min)
```bash
ssh root@76.13.179.86
cd /home/node/dc1-platform
```

### Step 2: Fetch Latest Code (3 min)
```bash
git fetch origin
git checkout main
git pull origin main
```

### Step 3: Verify Routing Fix Present (2 min)
```bash
git log -1 --oneline | grep -i routing
# Should show: "merge(review): CR1 approved DCP-641"
```
**Expected output:** Commit with "DCP-641" or "routing" in message
**Status:** [ ] Pass / [ ] Fail

### Step 4: Backup Current State (3 min)
```bash
# Create backup of current running version
cp -r /home/node/dc1-platform /home/node/dc1-platform.backup.$(date +%s)
echo "Backup created at /home/node/dc1-platform.backup.*"
```

### Step 5: Restart Backend Service (2 min)
```bash
pm2 restart dc1-provider-onboarding
sleep 3
pm2 list | grep dc1-provider-onboarding
```
**Expected:** Status shows "online" (green)
**Status:** [ ] Pass / [ ] Fail

### Step 6: Wait for Service Stabilization (3 min)
```bash
sleep 5
pm2 logs dc1-provider-onboarding --lines 20 | tail -10
```
**Expected:** No error messages in logs
**Status:** [ ] Pass / [ ] Fail

---

## Phase 3: Post-Deployment Validation (5 minutes)

### Validation 1: Model Detail Endpoint
```bash
curl -s "https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview" \
  -w "\n\nHTTP Status: %{http_code}\n" | head -20
```
**Expected:**
- HTTP Status: 200 (not 404)
- JSON response with model details
**Status:** [ ] Pass / [ ] Fail

### Validation 2: Deploy Estimate Endpoint
```bash
curl -s "https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview/deploy/estimate" \
  -w "\n\nHTTP Status: %{http_code}\n"
```
**Expected:**
- HTTP Status: 200
- Response includes estimated_cost and estimated_duration
**Status:** [ ] Pass / [ ] Fail

### Validation 3: Model List Endpoint
```bash
curl -s "https://api.dcp.sa/api/models" \
  -w "\n\nHTTP Status: %{http_code}\n" | grep "model_id" | wc -l
```
**Expected:**
- HTTP Status: 200
- Count shows 6+ models listed
**Status:** [ ] Pass / [ ] Fail

### Validation 4: Service Health
```bash
curl -s "https://api.dcp.sa/api/health" -w "\n\nHTTP Status: %{http_code}\n"
```
**Expected:**
- HTTP Status: 200
- Response shows "status":"ok"
**Status:** [ ] Pass / [ ] Fail

---

## Phase 4: QA Smoke Tests (5 minutes)

### Test 1: All Models Route Correctly
```bash
# Test that all 11 models return HTTP 200 (not 404)
curl -s "https://api.dcp.sa/api/models" | grep -o '"model_id":"[^"]*"' | head -3 | while read line; do
  MODEL=$(echo $line | cut -d'"' -f4)
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://api.dcp.sa/api/models/$MODEL")
  echo "$MODEL: $STATUS"
done
```
**Expected:** All return 200
**Status:** [ ] Pass / [ ] Fail

### Test 2: Pricing Data Includes Competitor Rates
```bash
curl -s "https://api.dcp.sa/api/models" | grep -o "savings_pct\|competitor_prices" | wc -l
```
**Expected:** Both fields present in response
**Status:** [ ] Pass / [ ] Fail

### Test 3: No 502/503 Errors in Logs
```bash
ssh root@76.13.179.86 "pm2 logs dc1-provider-onboarding --lines 50 | grep -i 'error\|502\|503'"
```
**Expected:** No error output (empty result)
**Status:** [ ] Pass / [ ] Fail

---

## Phase 5: Rollback Procedure (If Needed)

**If any validation fails, execute immediately:**

```bash
ssh root@76.13.179.86
cd /home/node/dc1-platform

# Revert to previous commit
git revert HEAD --no-edit

# Restart service
pm2 restart dc1-provider-onboarding

# Verify rollback
curl -s "https://api.dcp.sa/api/health" -w "\n\nHTTP Status: %{http_code}\n"
```

**Rollback time:** < 5 minutes
**Documentation:** Post rollback notification to DCP-641 with details

---

## Success Criteria: Deployment Complete

All of the following must be true:

- [ ] Code on main includes commit 1cbfc42
- [ ] VPS deployment executed without errors
- [ ] Service online and responding
- [ ] Model detail endpoints return HTTP 200 (not 404)
- [ ] All 11 models route correctly
- [ ] Pricing/competitor data present
- [ ] Service health check passes
- [ ] No error logs in PM2

---

## Phase 1 Testing Readiness Declaration

**Upon successful completion of all validations:**

Post to DCP-641:
```
✅ DEPLOYMENT SUCCESSFUL - Phase 1 testing can begin

All validations passed:
- Model routing fix verified (HTTP 200)
- All 11 models accessible
- Service health check: OK
- Pricing data: OK

Phase 1 testing timeline:
- Day 4 (2026-03-26 08:00 UTC): Pre-test validation
- Day 5 (2026-03-27 09:00 UTC): Integration testing
- Day 6 (2026-03-28 08:00 UTC): Load & security testing

Ready to proceed.
```

---

## Timeline & Dependencies

| Phase | Duration | Owner | Dependency |
|-------|----------|-------|-----------|
| Pre-deployment | 5 min | QA/DevOps | Code on main |
| Deployment | 30 min | DevOps | Pre-deployment OK |
| Validation | 5 min | QA | Deployment complete |
| Smoke tests | 5 min | QA | Validation OK |
| Phase 1 testing | 10.5 hrs | QA | All above complete |
| **Total** | **~1 hour** | **QA/DevOps** | **Upon approval** |

**Time to Phase 1 testing start:** ~1 hour from approval
**Time until Phase 1 deadline:** 40+ hours
**Buffer:** 39+ hours ✅

---

## Escalation Path

**If deployment fails:**
1. Execute rollback immediately (< 5 minutes)
2. Post failure notice to DCP-641
3. Notify: DevOps, Backend Architect, QA Engineer
4. Investigate root cause
5. Plan retry with fixes

**If validation fails (HTTP 404 persists):**
1. Check Git log to confirm deployment pulled correct commit
2. Verify PM2 service restarted
3. Check backend logs: `pm2 logs dc1-provider-onboarding`
4. Rollback and investigate

**If Phase 1 testing can't start on 2026-03-26 08:00 UTC:**
- Impact: May need to defer Phase 1 decision to 2026-03-29
- Buffer still adequate but shrinking

---

## Contact & Support

- **QA Lead:** agent 891b2856-c2eb-4162-9ce4-9f903abd315f
- **DevOps:** (Assigned deployer)
- **Backend Architect:** (Escalation point)

---

**Status:** READY FOR DEPLOYMENT
**Trigger:** Upon founder approval comment on DCP-641
**Estimated completion:** Within 1 hour of trigger
