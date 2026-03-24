# DCP-641 Deployment Readiness & QA Verification Plan

**Document Status:** ACTIVE COORDINATION
**Last Updated:** 2026-03-23 20:50 UTC
**Critical Timeline:** Code Review → Merge → Deployment must complete by **2026-03-26 08:00 UTC**
**Agent Lead:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
**Coordinating Issue:** [DCP-641](/DCP/issues/DCP-641)

---

## Executive Summary

Routing fix commit **5d59273** is ready for code review. This fix unblocks:
- ✅ QA Phase 1 integration testing (DCP-641) — my responsibility
- ✅ Model detail pricing display (DCP-669)
- ✅ IDE Extension model queries (DCP-655)
- ✅ Marketplace product catalog

**Critical Path Timeline:**
1. Code Review (NOW) — estimated 1-2 hours
2. Merge to main (after approval) — immediate
3. Founder deployment approval (CLAUDE.md requirement)
4. Production deployment
5. QA verification & test execution (2026-03-26)

**Status:** 🔴 **URGENT** — Testing window closes 2026-03-26 08:00 UTC

---

## Current State: Code Review Ready

### Commit Details
- **Hash:** `5d59273`
- **Title:** `fix(api): Support HuggingFace model IDs with slashes in routing`
- **Branch:** `ml-infra/phase1-model-detail-routing` (pushed to remote)
- **Files Changed:** `backend/src/routes/models.js` (6 lines modified)
- **Effort:** Minimal code change
- **Risk Level:** LOW

### The Fix
Updated three Express routes to support HuggingFace model IDs (format: `OWNER/MODEL-NAME`):

```javascript
// Before (breaks on /)
router.get('/:model_id', ...)

// After (regex allows /)
router.get(/^\/([a-zA-Z0-9._\/-]+)$/, ...)
```

**Fixed Endpoints:**
1. `GET /api/models/{model_id}` — model detail endpoint
2. `GET /api/models/{model_id}/deploy/estimate` — cost/duration projection
3. `POST /api/models/{model_id}/deploy` — deployment submission

**Affected Models (all now route correctly):**
- ALLaM-AI/ALLaM-7B-Instruct-preview
- BAAI/bge-m3
- BAAI/bge-reranker-v2-m3
- meta-llama/Meta-Llama-3-8B-Instruct
- mistralai/Mistral-7B-Instruct-v0.2
- (+ 6 more HuggingFace models)

---

## Critical Path: Code Review → Deployment → QA Testing

### Phase 1: Code Review (ACTIVE NOW)

**Who:** Code Reviewer 1 or Code Reviewer 2 (per CLAUDE.md)
**What to Check:**
- ✅ Regex pattern correctly captures HuggingFace IDs with slashes
- ✅ Parameter extraction updated to `req.params[0]`
- ✅ No breaking changes to other routes
- ✅ Backward compatible with single-segment model names
- ✅ Security: whitelist regex prevents injection

**Expected Duration:** 1-2 hours
**Exit Criteria:** ✅ Code approved, ready to merge

### Phase 2: Merge to Main

**Who:** Code Reviewer (authorized to merge)
**What:** Merge `ml-infra/phase1-model-detail-routing` to `main`
**Requirements (per CLAUDE.md):**
- Branch protection enforced on GitHub
- Requires 1 approving review (from Phase 1)
- Requires CI/CD to pass (Frontend Build Check + Backend Integration Tests)
- No force pushes

**Exit Criteria:**
- ✅ Branch merged to main
- ✅ All CI checks passing
- ✅ Commit visible on main branch

### Phase 3: Founder Deployment Approval

**Who:** Founder (setup@oida.ae)
**What:** Approve production deployment per CLAUDE.md deployment rule:

> "NO AGENT may deploy, push, restart, or modify ANYTHING on the production VPS (76.13.179.86) without EXPLICIT written approval from the founder."

**Process (per CLAUDE.md):**
1. DevOps Engineer creates issue titled "DEPLOY REQUEST: Model routing fix (DCP-641)"
2. Lists exact commands to be executed on VPS
3. Tags as priority: critical
4. **Founder reviews and approves in issue comments**
5. Only after founder approval → proceed with deployment

**Expected Duration:** 1-2 hours (founder review)

**Exit Criteria:**
- ✅ Founder approval posted to issue
- ✅ Deployment commands documented and approved

### Phase 4: Production Deployment

**Who:** DevOps Engineer (with founder approval)
**What:** Deploy to VPS 76.13.179.86

**Deployment Steps:**
```bash
# SSH to production VPS
ssh root@76.13.179.86

# Pull latest main
cd /home/node/dc1-platform
git fetch origin
git checkout main
git pull origin main

# Restart backend service
pm2 restart dc1-provider-onboarding

# Verify deployment
curl -s https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview -w "\nHTTP %{http_code}\n" | head -5
```

**Expected Response After Deployment:**
```json
{
  "model_id": "ALLaM-AI/ALLaM-7B-Instruct-preview",
  "display_name": "ALLaM 7B Instruct",
  "family": "allam",
  ...
}
HTTP 200
```

**Expected Duration:** 15-30 minutes

**Exit Criteria:**
- ✅ Model detail endpoint returns HTTP 200 (not 404)
- ✅ Response includes full model data
- ✅ PM2 services healthy

---

## QA Verification Plan (Post-Deployment)

### Immediate Verification (within 30 min of deployment)

**Test Command:**
```bash
curl -s https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview | jq '.' | head -20
curl -s https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview/deploy/estimate | jq '.'
```

**Success Criteria:**
- ✅ Both endpoints return HTTP 200 (not 404)
- ✅ Response includes model details, pricing, capabilities
- ✅ Estimate endpoint returns cost and duration

### Full Test Suite Execution (Day 4 per plan)

**When:** 2026-03-26 08:00 UTC (Day 4 of Phase 1 testing)
**Script:** `docs/qa/dcp641-test-execution-plan.md`

**Model Catalog Tests (previously 18/24, will be 24/24):**
```bash
DCP_API_BASE=https://api.dcp.sa/api node scripts/model-catalog-smoke.mjs
```

**Expected Result:** ✅ **24/24 PASS** (previously blocked on detail endpoints)

**Impact:**
- ✅ Unblocks Phase 1 integration testing
- ✅ Template catalog → READY for marketplace
- ✅ Model catalog → READY for marketplace
- ✅ Can proceed to Day 5 full testing + Day 6 load testing

---

## Timeline: Hours Remaining Until Testing Starts

| Phase | Task | Duration | Deadline | Hours Left |
|-------|------|----------|----------|-----------|
| 1 | Code Review | 1-2h | 2026-03-23 21:50 | ~1-2h |
| 2 | Merge to main | 30min | 2026-03-23 22:30 | ~2.5h |
| 3 | Founder approval | 1-2h | 2026-03-24 00:30 | ~4h |
| 4 | Deployment to prod | 30min | 2026-03-24 01:00 | ~4.5h |
| — | **Buffer time** | — | 2026-03-26 08:00 | **~30h** |

**Status:** ✅ **ADEQUATE TIME** — All phases can complete well before Phase 1 testing window (2026-03-26 to 2026-03-28)

---

## Deployment Rollback Plan

If deployment fails or introduces errors:

1. **Immediate:** Revert to previous working commit on VPS
   ```bash
   cd /home/node/dc1-platform
   git revert 5d59273
   pm2 restart dc1-provider-onboarding
   ```

2. **Verification:** Confirm routes still work (HTTP 200)

3. **Investigation:** Review PM2 logs for errors
   ```bash
   pm2 logs dc1-provider-onboarding | head -100
   ```

4. **Timeline:** Rollback takes < 5 minutes; leaves time for retry

---

## Coordination & Communication

### Code Reviewers
**Action Required:**
1. Review commit `5d59273` on branch `ml-infra/phase1-model-detail-routing`
2. Check code review document: `docs/code-reviews/dcp-641-model-routing-fix.md`
3. Approve and merge (or request changes)
4. **Target:** Complete within 1-2 hours

### DevOps Engineer
**Action Required (after merge):**
1. Wait for founder approval in [DCP-641](/DCP/issues/DCP-641)
2. Execute deployment with exact commands listed above
3. Verify endpoints return HTTP 200
4. Post deployment success to issue

### Founder
**Action Required (after merge):**
1. Review deployment request issue
2. Approve deployment or request changes
3. Post approval to issue thread
4. **Timeline:** Critical — needed within ~4 hours

### QA Engineer (Me)
**Action Required:**
1. Monitor code review progress (every 30 min)
2. Upon deployment → immediate verification curl test
3. 2026-03-26 08:00 UTC → execute full test suite per plan
4. Post test results to [DCP-641](/DCP/issues/DCP-641)

---

## Success Criteria for Completion

### Phase 1 Complete When:
- ✅ Commit `5d59273` approved and merged to main
- ✅ Founder approval documented in issue
- ✅ Deployed to production VPS
- ✅ Model detail endpoints return HTTP 200
- ✅ QA verification tests pass

### Phase 1 Testing Can Begin When:
- ✅ All above complete
- ✅ All 24 model catalog checks passing
- ✅ Template catalog still at 20/20 PASS
- ✅ Ready for Day 4 pre-test validation (2026-03-26 08:00 UTC)

---

## Escalation Path

**If code review stalls (> 2 hours):**
- Escalate to Code Reviewer 1 manager
- Highlight critical timeline (Phase 1 testing depends on this)

**If deployment doesn't happen (> 4 hours after merge):**
- Create issue "DEPLOY REQUEST: Model routing fix (DCP-641)" if not done
- Tag as `priority: critical`
- Mention founder directly with timeline urgency

**If deployment fails:**
- Immediate rollback (< 5 minutes)
- Debug and retry
- Timeline: still adequate for Day 4 testing (30+ hours remaining)

---

## Monitoring & Checkpoints

### Checkpoint 1: Code Review Complete
**When:** Expected by 2026-03-23 22:30 UTC
**Check:** Branch `ml-infra/phase1-model-detail-routing` approved for merge
**Action if delayed:** Escalate to Code Reviewers

### Checkpoint 2: Merged to Main
**When:** Expected by 2026-03-23 23:00 UTC
**Check:** Commit visible on main branch
**Action if delayed:** Confirm CI checks passing

### Checkpoint 3: Founder Approval
**When:** Expected by 2026-03-24 00:30 UTC
**Check:** Approval posted to [DCP-641](/DCP/issues/DCP-641)
**Action if delayed:** Escalate to founder with timeline

### Checkpoint 4: Deployed to Production
**When:** Expected by 2026-03-24 01:00 UTC
**Check:** `curl https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview` returns HTTP 200
**Action if fails:** Rollback and retry

### Checkpoint 5: QA Verification Ready
**When:** 2026-03-26 08:00 UTC (Phase 1 testing begins)
**Check:** Full test suite passes (24/24 model checks)
**Action:** Proceed to Day 4-6 testing per plan

---

## References

- **Routing Fix Commit:** `5d59273` (ml-infra/phase1-model-detail-routing)
- **Code Review Document:** `docs/code-reviews/dcp-641-model-routing-fix.md`
- **QA Test Execution Plan:** `docs/qa/dcp641-test-execution-plan.md`
- **Deployment Rule:** CLAUDE.md (Founder approval required)
- **Related Issues:**
  - [DCP-641](/DCP/issues/DCP-641) — Phase 1 integration testing
  - [DCP-669](/DCP/issues/DCP-669) — UI pricing display
  - [DCP-655](/DCP/issues/DCP-655) — IDE Extension
  - [DCP-652](/DCP/issues/DCP-652) — Sprint 27 QA (completed)

---

**Document Owner:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
**Status:** ACTIVE MONITORING
**Next Update:** When code review begins or after each checkpoint
