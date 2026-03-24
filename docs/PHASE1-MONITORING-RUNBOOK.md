# Phase 1 Monitoring Runbook

**Duration:** 2026-03-25 to 2026-03-26 08:00 UTC (48 hours)
**Owner:** IDE Extension Developer (DCP-682)
**Purpose:** Real-time support during Phase 1 testing execution

---

## Overview

Phase 1 testing validates:
1. **QA Integration Tests** — Template catalog, model catalog, deployment flows
2. **UX Recruiter Sessions** — 5-8 participants, template discovery → deployment workflow
3. **Extension Health** — Job submission, tree views, pricing display

This runbook provides real-time operational procedures for monitoring and escalation.

---

## Pre-Testing Checklist (2026-03-25 00:00 UTC)

**Before Testing Begins:**

- [ ] Verify IDE extension is deployed and accessible
- [ ] Check `/api/models` endpoint returns data (>10 models)
- [ ] Check `/api/templates` endpoint returns data (>20 templates)
- [ ] Verify `/api/jobs` endpoint is ready
- [ ] Confirm all 3 tree views load in VS Code extension
- [ ] Extension bundle <50 MiB in memory
- [ ] No console errors on extension activation
- [ ] Backend API responding on http://localhost:8083
- [ ] Database connections stable
- [ ] All critical blockers from Sprint 25 resolved

**Command to Validate:**
```bash
# In VS Code Extension Development Host
1. Open Extension Development Host (F5)
2. Check Output panel: "DCP Provider extension activated"
3. Check Activity Bar: See 3 tree views (Node, GPU, Earnings)
4. No red errors in Problems panel
```

---

## Phase 1 Testing Window (2026-03-25 to 2026-03-26)

### Hour-by-Hour Monitoring

#### Day 1: 2026-03-25 (24 hours)

**00:00-04:00 UTC — QA Integration Testing (Initial)**
- [ ] Monitor QA team execution of template catalog tests
- [ ] Watch for: API timeouts, 404 errors, loading states
- [ ] Check: Model list displays correctly
- [ ] Check: Pricing display accuracy vs strategic brief
- [ ] Expected Status: QA running template catalog 20-test suite

**04:00-08:00 UTC — UX Recruiter Sessions (Start)**
- [ ] Monitor first batch of recruiter sessions (2-3 participants)
- [ ] Watch for: Extension crashes, UI freezes, latency
- [ ] Check: Model browsing works smoothly
- [ ] Check: Pricing comparison visible and understandable
- [ ] Expected Status: UX sessions in progress (watch for blockers)

**08:00-12:00 UTC — QA Model Catalog Tests**
- [ ] Monitor model catalog test execution (24 tests)
- [ ] Expected: 18/24 passing from earlier (75%)
- [ ] Watch for: Model routing fixes working (DCP-641)
- [ ] Check: HuggingFace slash-style IDs resolve correctly
- [ ] Check: Model detail endpoints responding (200 OK)
- [ ] Escalate if: > 5 failures in model routing

**12:00-16:00 UTC — UX Sessions (Mid-day)**
- [ ] Continue monitoring UX recruiter sessions (3-4 more participants)
- [ ] Check: Users can browse templates without errors
- [ ] Check: One-click deploy flow works
- [ ] Watch for: Performance issues (slow loads)
- [ ] Record: User feedback on pricing, model names, UX

**16:00-20:00 UTC — QA Deployment Flow Tests**
- [ ] Monitor end-to-end deployment flow validation
- [ ] Check: Jobs can be submitted and tracked
- [ ] Check: Job status updates in real-time
- [ ] Watch for: Cost estimation accuracy
- [ ] Expected: Job submission 5-10 end-to-end flows

**20:00-24:00 UTC — Evening Checkpoint**
- [ ] Aggregate results from Day 1
- [ ] Check error rates and failure patterns
- [ ] Post status update to DCP-682
- [ ] Identify any critical blockers for Day 2
- [ ] Expected: 80%+ tests passing by end of Day 1

#### Day 2: 2026-03-26 (8 hours until deadline)

**00:00-04:00 UTC — Final UX Sessions**
- [ ] Monitor final batch of recruiter sessions (1-2 participants)
- [ ] Check: All feedback captured
- [ ] Verify: No new blockers introduced

**04:00-08:00 UTC — Final Validation & Wrap-up**
- [ ] Run final smoke tests on all critical paths
- [ ] Template catalog: Verify all 20 templates load
- [ ] Model catalog: Verify all 11 models display
- [ ] Job submission: Verify end-to-end flow works
- [ ] Pricing: Verify accuracy vs strategic brief
- [ ] Post final status at 08:00 UTC (Phase 1 deadline)

---

## Real-Time Monitoring Metrics

### Critical Metrics to Track

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| **API Response Time** | <500ms | 500-2000ms | >2000ms |
| **Extension Memory** | <50 MiB | 50-100 MiB | >100 MiB |
| **Test Pass Rate** | >90% | 80-90% | <80% |
| **Error Rate** | <1% | 1-5% | >5% |
| **Model Load Time** | <2s | 2-5s | >5s |
| **Job Submission Time** | <5s | 5-10s | >10s |
| **CPU Usage** | <20% | 20-50% | >50% |

### Monitoring Commands

```bash
# Check API health
curl -s http://localhost:8083/api/models | head -20

# Check model catalog
curl -s http://localhost:8083/api/templates | wc -l

# Monitor extension in VS Code
# → Output panel shows real-time logs
# → Check Memory usage: ~40-50 MiB normal
# → Check CPU: <15% during polling
```

---

## Escalation Procedures

### Issue Detected → Escalation Path

#### 1. Extension Crashes or Won't Load
**Severity:** CRITICAL
**Action:**
- [ ] Check Output panel for error message
- [ ] Verify no TypeScript compilation errors
- [ ] Run `npm run lint` to check for issues
- [ ] If unfixable: Post comment in DCP-682 with:
  - Exact error message
  - Stack trace
  - Steps to reproduce
- [ ] Escalate to: Backend Architect (if API-related) or Frontend Dev (if UI-related)
- [ ] SLA: Resolution within 15 minutes

#### 2. API Timeouts or 500 Errors
**Severity:** HIGH
**Action:**
- [ ] Check which endpoint is failing (models, templates, jobs)
- [ ] Check database connection status
- [ ] Check backend logs for errors
- [ ] If pattern: Post in DCP-682 with affected endpoint
- [ ] Escalate to: Backend Architect
- [ ] SLA: Investigation within 10 minutes, fix within 30 minutes

#### 3. Incorrect Pricing Display
**Severity:** MEDIUM
**Action:**
- [ ] Compare displayed price vs strategic brief data
- [ ] Note the model name and displayed price
- [ ] Post in DCP-682 with specific examples
- [ ] Escalate to: Backend Architect (pricing logic)
- [ ] SLA: Fix within 1 hour

#### 4. Slow Performance (<2s model load)
**Severity:** MEDIUM
**Action:**
- [ ] Measure actual load time
- [ ] Check API response time
- [ ] Check extension memory usage
- [ ] Post in DCP-682 with metrics
- [ ] Escalate to: Backend Architect (API optimization)
- [ ] SLA: Investigation within 30 minutes

#### 5. Extension Tree View Not Updating
**Severity:** LOW-MEDIUM
**Action:**
- [ ] Check console for errors
- [ ] Verify polling is active (DCP-682 monitoring)
- [ ] Test manual refresh
- [ ] Post in DCP-682 with reproduction steps
- [ ] Escalate to: Frontend Developer
- [ ] SLA: Fix within 1 hour

#### 6. Job Submission Fails
**Severity:** CRITICAL (blocks renter testing)
**Action:**
- [ ] Note exact error message
- [ ] Check if issue is client-side or server-side
- [ ] Verify job endpoint is responding
- [ ] Post in DCP-682 with full error details
- [ ] Escalate to: Backend Architect
- [ ] SLA: Resolution within 15 minutes

---

## Status Update Protocol

### Every 4 Hours (DCP-682 Comment)

**Format:**
```
## Phase 1 Monitoring Update — [HH:00 UTC]

**Status:** ✅ GREEN / ⚠️ YELLOW / 🔴 RED

### QA Progress
- Template catalog: X/20 passing
- Model catalog: Y/24 passing
- Deployment flow: Z tests executed

### UX Progress
- Recruiter sessions: N participants completed
- Feedback collected: [brief summary]
- Blockers: [if any]

### Extension Health
- Memory: XX MiB
- CPU: Y%
- Errors: [count or "none"]

### Escalations
- [List any escalated issues]

### Next 4 Hours
- [What's expected next]
```

### Final Status (2026-03-26 08:00 UTC)

**Must Include:**
- [ ] Overall pass/fail for Phase 1
- [ ] Test pass rates (QA + UX)
- [ ] Critical blockers (if any)
- [ ] Recommendation for Phase 2 go/no-go
- [ ] Any follow-up work needed post-Phase 1

---

## Checklist: Critical Paths to Validate

### Template Catalog Path
- [ ] User browses templates (20 available)
- [ ] Filters work (by category, VRAM, Arabic)
- [ ] Template details display (name, description, pricing)
- [ ] Model selector works
- [ ] Pricing display matches strategic brief
- [ ] One-click deploy button visible

### Model Catalog Path
- [ ] User browses models (11 available)
- [ ] Model details load (name, VRAM, cost)
- [ ] Arabic model filtering works
- [ ] Competitive pricing shows vs Vast.ai/RunPod
- [ ] Model routing works (HuggingFace IDs)

### Job Submission Path
- [ ] User can submit a job from template
- [ ] Provider selection works
- [ ] Script upload works
- [ ] Cost estimate calculates correctly
- [ ] Job submits successfully
- [ ] Job ID returned and displayed
- [ ] Job status tracks in real-time

### Pricing Accuracy Path
- [ ] Model prices match strategic brief
- [ ] Provider costs match strategic brief
- [ ] Competitive savings calculated correctly
- [ ] SAR currency displayed
- [ ] No rounding errors

---

## Success Criteria for Phase 1

**Must Have (Blocker for Phase 2):**
- ✅ Template catalog fully functional (20/20 tests passing)
- ✅ Model catalog fully functional (24/24 tests passing)
- ✅ Job submission end-to-end works (5+ successful submissions)
- ✅ Pricing display accurate vs strategic brief
- ✅ Zero extension crashes during 48-hour window
- ✅ Extension memory <50 MiB sustained

**Should Have (High Priority):**
- ✅ UX recruiter sessions complete without blockers
- ✅ All 5-8 participants complete full workflow
- ✅ User feedback collected and positive
- ✅ Performance acceptable (<2s load times)

**Nice to Have (Can be Phase 2):**
- Real-time WebSocket updates (vs polling)
- Advanced filtering options
- Batch job submission

---

## Emergency Contacts

**If Critical Issue Occurs (Can't Resolve):**

| Role | Contact | Escalation |
|------|---------|-----------|
| Backend Architect | [assigned] | API, pricing, job submission |
| Frontend Developer | [assigned] | UI, tree views, responsiveness |
| QA Lead | [assigned] | Test execution, coordination |
| CEO | Peter / setup@oida.ae | Phase 1 go/no-go decision |

---

## Post-Phase 1 Activities

**2026-03-26 08:00-12:00 UTC:**

- [ ] Compile all test results
- [ ] Document any issues found
- [ ] Post final status in DCP-682
- [ ] Decision: Phase 2 GO or HOLD?
- [ ] If GO: Activate Phase 2 branch (ide-extension/phase2-provider-panel)

**2026-03-27 00:00 UTC (Phase 2 Start):**
- [ ] Checkout Phase 2 branch
- [ ] Run `npm install --include=dev && npm run watch`
- [ ] Begin Provider Status Panel implementation (4 hours)

---

## Notes Section

**Day 1 Notes:**
```
[To be filled in during Phase 1 testing]
- 00:00 UTC: [notes]
- 04:00 UTC: [notes]
- 08:00 UTC: [notes]
...
```

**Day 2 Notes:**
```
[To be filled in during Phase 1 testing]
- 00:00 UTC: [notes]
- 04:00 UTC: [notes]
- 08:00 UTC: [FINAL STATUS - Phase 1 deadline]
```

---

**This runbook is your operational guide for Phase 1 monitoring (2026-03-25 to 2026-03-26 08:00 UTC).**

**Print this out. Keep it open. Use it as your checklist.**

**Phase 1 Success = Phase 2 Ready**
