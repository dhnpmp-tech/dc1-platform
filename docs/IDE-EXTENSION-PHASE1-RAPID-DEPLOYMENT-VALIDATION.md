# ✅ IDE Extension — Phase 1 Rapid Deployment & Validation (DCP-641)

**Purpose:** Rapid execution checklist for when DCP-641 routing fix is approved and deployed
**Status:** Ready to execute
**Timeline:** ~30 minutes total (validation + coordination)

---

## 🚀 Upon Code Review Approval (TRIGGER POINT)

**What triggers this:** Code review approval for commit `5d59273` on branch `ml-infra/phase1-model-detail-routing`

### Immediate Actions (Next 5 min)
- [ ] Monitor GitHub for merge completion (should auto-merge once approved)
- [ ] Notify DevOps/Founder that code review is approved
- [ ] Prepare founder approval request if not already posted

---

## 📋 Upon Merge to Main

**Trigger:** PR merged to main, commit visible in main branch history

### Validation #1: Code on Main (2 min)
```bash
# SSH to VPS or local
git fetch origin
git log origin/main --oneline -5 | grep -i routing
# Should see: 5d59273 fix(api): Support HuggingFace model IDs...
```

### Status Update (Slack/Issue)
```
✅ Code Review Approved
✅ Merged to main
⏳ Waiting for DevOps deployment to VPS 76.13.179.86
Timeline: ~30 min deployment + verification
```

---

## 🔄 Upon DevOps Deployment Started

**Trigger:** DevOps announces deployment begun (git pull + pm2 restart)

### Validation #2: Deployment Health Check (3 min)

**Check 1: Service is running**
```bash
curl -s -I https://api.dcp.sa/api/health | head -3
# Expected: HTTP 200
```

**Check 2: Model list still responds**
```bash
curl -s https://api.dcp.sa/api/models | head -20
# Expected: JSON array with 11 models, no errors
```

---

## ✨ Post-Deployment: Critical Validation (DCP-641 Success Criteria)

**Trigger:** Deployment reported complete, services restarted

### Validation #3: Model Detail Endpoints LIVE (5 min) ⭐ CRITICAL

**Test 1: Model detail endpoint**
```bash
curl -s https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview \
  -w "\n\nHTTP Status: %{http_code}\n"

# EXPECTED RESULT:
# ✅ HTTP 200 (currently: 404 before fix)
# ✅ JSON response includes model_id, display_name, pricing info
# ❌ NOT HTTP 404
```

**Test 2: Deploy estimate endpoint**
```bash
curl -s https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview/deploy/estimate \
  -w "\n\nHTTP Status: %{http_code}\n"

# EXPECTED RESULT:
# ✅ HTTP 200
# ✅ JSON with estimated_cost, estimated_duration
# ❌ NOT HTTP 404
```

**Test 3: Deploy endpoint ready**
```bash
curl -s -X POST https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview/deploy \
  -H "Content-Type: application/json" \
  -d '{"duration_minutes": 60}' \
  -w "\n\nHTTP Status: %{http_code}\n"

# EXPECTED RESULT:
# ✅ HTTP 200 or 201 (success)
# ✅ JSON with job_id
# ❌ NOT HTTP 404
```

**Test 4: All 11 models route correctly**
```bash
# List all models and verify detail endpoint works for each
curl -s https://api.dcp.sa/api/models | \
  grep -o '"model_id":"[^"]*"' | \
  head -11 | \
  while read line; do
    MODEL=$(echo $line | cut -d'"' -f4)
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://api.dcp.sa/api/models/$MODEL")
    echo "$MODEL: $STATUS"
  done

# EXPECTED: All should be 200, none 404
```

### Validation #4: IDE Extension Can Access Data (2 min)

**Check pricing data is available**
```bash
curl -s https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview | \
  grep -E 'competitor_prices|savings_pct'

# EXPECTED: Fields present (extension needs these for pricing display)
# If missing: pricing display gracefully degrades (not critical)
```

---

## 📊 Validation Results Summary

### Success Criteria (DCP-641 = FIXED)

| Check | Status | Result |
|-------|--------|--------|
| Model detail endpoint | ✅ | HTTP 200 (not 404) |
| Deploy estimate endpoint | ✅ | HTTP 200 (not 404) |
| Deploy endpoint responds | ✅ | HTTP 200 or 201 |
| All 11 models route | ✅ | All return HTTP 200 |
| Pricing data available | ✅ | competitor_prices present |

### If Any Validation Fails

- **Model detail returns 404:** Rollback, recheck code, re-deploy
- **Pricing data missing:** Not critical (IDE Extension degrades gracefully)
- **Some models 404, others 200:** Regex routing issue, check backend logs

---

## 🎯 Coordination Update Upon Success

**Post to DCP-641 issue / Slack:**

```markdown
## ✅ DCP-641 Model Routing Fix — DEPLOYED AND VERIFIED

**Status:** COMPLETE - All validation tests passing

### Deployment Summary
- Commit: 5d59273
- Merged: <timestamp>
- Deployed: <timestamp>
- Verification: PASSED

### Validation Results
- ✅ Model detail endpoints: HTTP 200 (was 404)
- ✅ Deploy estimate endpoint: HTTP 200 (was 404)
- ✅ All 11 models route correctly
- ✅ Pricing data available
- ✅ IDE Extension can access pricing

### Impact
- QA Phase 1 integration testing: UNBLOCKED (can begin 2026-03-26 08:00 UTC)
- UX Phase 1 user testing: UNBLOCKED (can begin 2026-03-25)
- Phase 1 launch: ON SCHEDULE

### Next Steps
1. QA Engineer: Begin Phase 1 Days 4-6 testing
2. UX Researcher: Begin user testing sessions
3. IDE Extension: Available for support during testing
```

---

## 📞 Escalation if Deployment Fails

**If validation shows HTTP 404 still:**

1. Check backend logs on VPS:
```bash
ssh root@76.13.179.86
pm2 logs dc1-provider-onboarding | tail -50
```

2. Verify code on main:
```bash
git log origin/main -1 --oneline | grep routing
```

3. Check if pm2 restart completed:
```bash
pm2 list | grep dc1-provider-onboarding
```

4. If services not restarted:
```bash
pm2 restart dc1-provider-onboarding
pm2 save
```

5. Retry validation after 10 seconds and report results

**Escalation contacts:**
- DevOps: [DevOps contact]
- ML Infrastructure Engineer: [ML Infra contact]
- Founder: setup@oida.ae

---

## 💡 IDE Extension Readiness Upon Success

Once DCP-641 is deployed and validated:

### Phase 1 Testing Support READY
- ✅ Template catalog fully functional (20 templates visible)
- ✅ Model catalog shows all 11 models with pricing
- ✅ Pricing comparison displays (DCP vs Vast.ai/RunPod/AWS)
- ✅ Job submission and monitoring works
- ✅ Arabic RAG quick-start ready

### QA Testing Support
- Extension can help QA validate model detail flow
- Job monitoring captures real latency metrics
- Template deployment E2E scenarios fully testable

### UX Testing Support
- Users can discover models and see pricing
- Deploy templates and monitor execution
- Test Arabic RAG end-to-end scenario
- Rate experience (NPS feedback)

---

## ⏱️ Timeline Once Approved

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Code Review Approval | 0 min | NOW | NOW |
| Merge to Main | 15 min | 00:00 | 00:15 |
| Founder Approval | 60 min | 00:15 | 01:15 |
| DevOps Deployment | 30 min | 01:15 | 01:45 |
| Validation | 5 min | 01:45 | 01:50 |
| **TOTAL** | **~2 hours** | | |

**Buffer to Phase 1 Testing:** 54 hours ✅ ADEQUATE

---

## 📝 Checklist for IDE Extension Developer

- [ ] Monitor for code review approval notification
- [ ] Verify merge to main (check git log)
- [ ] Upon deployment: Run all 4 validation tests
- [ ] Document results (success or failure)
- [ ] Post coordination update to team
- [ ] If successful: Stand by for Phase 1 testing
- [ ] If failed: Escalate and re-attempt validation

---

**Prepared by:** IDE Extension Developer
**Date:** 2026-03-24 09:47 UTC
**Status:** Ready to execute upon code review approval
**Critical:** This is the blocker for Phase 1 testing to begin on schedule
