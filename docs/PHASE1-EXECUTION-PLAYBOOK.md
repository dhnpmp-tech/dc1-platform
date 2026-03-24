# Phase 1 Execution Playbook — IDE Extension Developer

**Document:** Phase 1 Real-Time Execution Guide
**Date Created:** 2026-03-24 01:50 UTC
**Agent:** IDE Extension Developer (53f02e7e-66f9-4cb5-9ed7-a1da440eb797)
**Issue:** DCP-682 (PHASE 1 EXECUTION MONITORING — Extension support + escalation)

## Overview

This playbook provides the exact step-by-step execution guide for Phase 1 testing monitoring (2026-03-25 00:00 UTC to 2026-03-26 08:00 UTC). Use this document to ensure smooth, consistent execution throughout the 48-hour monitoring window.

---

## Phase 1 Timeline & Checkpoints

```
2026-03-25
├─ 00:00 UTC ← PHASE 1 BEGINS (this playbook activates)
├─ Hour 0-1: Pre-Testing Validation
├─ Hour 1-4: Initial monitoring + First status update (04:00)
├─ Hour 4-8: Continued monitoring + Second status update (08:00)
├─ Hour 8-12: Continued monitoring + Third status update (12:00)
├─ Hour 12-16: Continued monitoring + Fourth status update (16:00)
├─ Hour 16-20: Continued monitoring + Fifth status update (20:00)
└─ Hour 20-24: Final monitoring + Sixth status update (00:00 next day)

2026-03-26
├─ Hour 24-28: Continued monitoring + Seventh status update (04:00)
├─ Hour 28-32: Continued monitoring + Eighth status update (08:00)
├─ Hour 32-36: Final monitoring window
├─ Hour 36-40: Final monitoring + critical escalation handling
├─ Hour 40-44: Wrap-up + data consolidation
├─ Hour 44-48: Final report + go/no-go decision
└─ 08:00 UTC ← PHASE 1 ENDS (deliver final report)
```

---

## Pre-Phase-1 Checklist (Today: 2026-03-24)

Before 2026-03-25 00:00 UTC, complete:

- [ ] Read PHASE1-MONITORING-RUNBOOK.md (entire document)
- [ ] Review Pre-Testing Checklist section
- [ ] Review Escalation Procedures (6 categories)
- [ ] Review Status Update Template
- [ ] Verify DCP-682 issue is assigned to you
- [ ] Verify you have Paperclip API credentials (PAPERCLIP_API_KEY, etc.)
- [ ] Test Paperclip comment posting (curl test to /api/issues/:id/comments)
- [ ] Verify you can access git and npm commands
- [ ] Create a local working directory for Phase 1 logs/notes
- [ ] Set a calendar reminder for Phase 1 start (2026-03-25 00:00 UTC)

---

## Hour 0: Pre-Testing Validation (2026-03-25 00:00-01:00 UTC)

### Step 1: Activate Phase 1 (00:00-00:05)

1. **Post Phase 1 Launch Status to DCP-682**
   ```bash
   curl -X POST "${PAPERCLIP_API_URL}/api/issues/6e68fdda-9a49-446f-a2ef-9a47d73362a9/comments" \
     -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
     -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
     -H "Content-Type: application/json" \
     -d '{"body": "## PHASE 1 TESTING EXECUTION BEGINS ✅\n\n**Status:** Phase 1 testing monitoring now active\n**Time:** 2026-03-25 00:00 UTC\n**Duration:** 48 hours\n**Expected Completion:** 2026-03-26 08:00 UTC\n\nBeginning pre-testing validation checklist. Will post 4-hourly status updates.\n\nMonitoring active."}'
   ```

2. **Note the current time and start monitoring**
   - Phase 1 Start: 2026-03-25 00:00:00 UTC
   - Next checkpoint: 2026-03-25 04:00:00 UTC (4 hours)

### Step 2: Execute Pre-Testing Validation Checklist (00:05-00:45)

**Extension Deployment Validation**
- [ ] SSH to VPS and verify IDE extension is deployed to production
- [ ] Check: `ps aux | grep -i extension` or equivalent process check
- [ ] Verify extension version matches main branch commit
- [ ] Check: npm package version in package.json matches deployed version

**API Connectivity Verification**
- [ ] Test all required endpoints:
  ```bash
  curl https://api.dcp.sa/api/models -H "Authorization: Bearer $TOKEN"
  curl https://api.dcp.sa/api/providers/public
  curl https://api.dcp.sa/api/templates
  curl https://api.dcp.sa/api/jobs -X POST -d '{}' # test method
  ```
- [ ] All endpoints respond with 200-500 range (not 503/timeout)
- [ ] Response times < 5 seconds

**Database Health Check**
- [ ] Verify database connectivity: `SELECT 1` query
- [ ] Check: No locked tables or slow queries
- [ ] Verify: Recent schema migrations completed

**Memory & Performance Baseline**
- [ ] Record extension memory usage: `ps aux | grep extension | awk '{print $6}'`
- [ ] Record API response time for /api/models (5 samples, average)
- [ ] Record error rate from logs (last 1 hour)
- [ ] Create baseline metrics file: `baseline-metrics-2026-03-25-00-00.json`

**Extension Health Check**
- [ ] Tree views load without errors
- [ ] Model catalog displays all 24 models
- [ ] Template catalog displays all 20 templates
- [ ] Pricing displays correctly (SAR currency)
- [ ] No TypeScript errors in console
- [ ] No memory leaks observed (check memory trend over 5 minutes)

### Step 3: Record Baseline & Prepare for 4-Hourly Monitoring (00:45-01:00)

Create baseline metrics file:
```json
{
  "phase1_start": "2026-03-25T00:00:00Z",
  "baseline_memory_mb": 145,
  "baseline_api_response_time_ms": 320,
  "baseline_error_rate_percent": 0.2,
  "extension_version": "1.0.0",
  "models_count": 24,
  "templates_count": 20,
  "qe_session_status": "recruiting",
  "api_endpoints_status": "all_operational"
}
```

---

## Hours 1-48: Real-Time Monitoring & 4-Hourly Status Updates

### Hourly Monitoring (Every Hour)

**Check Every Hour:**

1. **API Health** (2-minute check)
   - Test /api/models endpoint (check response time < 2s)
   - Test /api/jobs endpoint (check response time < 2s)
   - Check for any 5xx errors in API logs

2. **QA Integration Tests** (5-minute check)
   - Count templates passing tests (target: 20/20)
   - Count models passing tests (target: 24/24)
   - Note any failures and time of failure

3. **Extension Memory** (2-minute check)
   - Check current memory usage: should not exceed 300 MB
   - Alert if memory usage > 250 MB (potential leak)

4. **Error Log Review** (3-minute check)
   - Check extension error logs for crashes
   - Check API error logs for new issues
   - Note any patterns

**Hourly Pattern:**
- Hour X:00 — API health check
- Hour X:15 — QA test progress check
- Hour X:30 — Extension memory/stability
- Hour X:45 — Error log review

### Every 4 Hours: Status Update to DCP-682

**Checkpoint Times:**
- 2026-03-25 04:00 UTC (Hour 4)
- 2026-03-25 08:00 UTC (Hour 8)
- 2026-03-25 12:00 UTC (Hour 12)
- 2026-03-25 16:00 UTC (Hour 16)
- 2026-03-25 20:00 UTC (Hour 20)
- 2026-03-26 00:00 UTC (Hour 24)
- 2026-03-26 04:00 UTC (Hour 28)
- 2026-03-26 08:00 UTC (Hour 32) ← FINAL REPORT

**4-Hourly Status Update Template**

```markdown
## Phase 1 Status Update — Hour [N]/48

**Time:** [Timestamp]
**Checkpoint:** [4-hourly status summary]

### Metrics Dashboard

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API Response Time | <2s | [X]ms | ✅/⚠️/🔴 |
| Extension Memory | <300MB | [X]MB | ✅/⚠️/🔴 |
| QA Templates Passing | 20/20 | [X]/20 | ✅/⚠️/🔴 |
| QA Models Passing | 24/24 | [X]/24 | ✅/⚠️/🔴 |
| Error Rate | <1% | [X]% | ✅/⚠️/🔴 |
| UX Sessions Active | 5-8 | [X] | ✅/⚠️/🔴 |

### QA Integration Test Progress

**Templates:** [Status of each template category]
- Arabic AI: [✅/⚠️/🔴]
- LLMs: [✅/⚠️/🔴]
- Image Gen: [✅/⚠️/🔴]
- Dev/Research: [✅/⚠️/🔴]

**Models:** [Model test pass rate]
- [X]/24 models passing tests

### Critical Issues

[List any critical issues, escalations, or blockers encountered in the past 4 hours]

### Next Actions

[Describe what will be monitored in the next 4-hour window]

### Overall Status

**Green / Yellow / Red** — [Brief summary]
```

### Escalation Procedure

**If any metric goes RED:**

1. **Extension Crashes (15-min SLA)**
   - Post escalation comment to DCP-682 immediately
   - Tag: @Frontend-Developer, @UI-UX-Specialist
   - Include: error message, stack trace, time of crash
   - Action: Attempt restart/reload if safe; document impact

2. **API Timeouts >5s (30-min SLA)**
   - Post escalation comment to DCP-682
   - Tag: @Backend-Architect
   - Include: endpoint, response time, timestamp
   - Action: Check API logs for errors

3. **Pricing Incorrect (1-hour SLA)**
   - Post escalation comment to DCP-682
   - Tag: @Backend-Architect
   - Include: expected vs actual pricing, screenshot
   - Action: Verify pricing formula

4. **Test Failures >5% (30-min SLA)**
   - Post escalation comment to DCP-682
   - Tag: @QA-Engineer
   - Include: failing tests, error messages
   - Action: Coordinate with QA on root cause

5. **Memory Leak Detected (1-hour SLA)**
   - Post escalation comment to DCP-682
   - Tag: @Frontend-Developer
   - Include: memory trend graph, suspected component
   - Action: Profile extension to identify leak

6. **Job Submission Fails (15-min SLA)**
   - Post escalation comment to DCP-682
   - Tag: @Backend-Architect, @Frontend-Developer
   - Include: job submission request, error response
   - Action: Check API endpoint, form validation

---

## Hour 48: Final Report & Go/No-Go Decision (2026-03-26 08:00 UTC)

### Step 1: Consolidate Final Metrics (07:00-07:30)

Collect final data:
- Final API response time average
- Final memory usage pattern
- Final test pass rates (templates, models)
- Final error rate
- UX session completion status
- Any unresolved critical issues

### Step 2: Analyze Phase 1 Success

**Success Criteria:**
1. ✅ 20/20 template tests passing
2. ✅ 24/24 model tests passing
3. ✅ 5+ job submissions completed
4. ✅ UX sessions completed with positive feedback
5. ✅ No critical extension crashes (or resolved)
6. ✅ API response times <2s average
7. ✅ Extension memory <300MB stable
8. ✅ Error rate <1%

**Go/No-Go Decision Logic:**

- **GO** if: Criteria 1-4 met AND no unresolved critical issues
- **YELLOW** if: Criteria 1-4 met BUT minor unresolved issues exist
- **NO-GO** if: Any of criteria 1-4 not met OR critical unresolved issues

### Step 3: Deliver Final Report to DCP-682

```markdown
## PHASE 1 FINAL REPORT — Testing Complete ✅

**Time:** 2026-03-26 08:00 UTC
**Duration:** 48 hours (full monitoring window)
**Go/No-Go Decision:** [GO / YELLOW / NO-GO]

### Final Metrics Summary

**Test Completion:**
- ✅ Templates: 20/20 passing
- ✅ Models: 24/24 passing
- ✅ Job Submissions: [N] completed
- ✅ UX Sessions: [N]/[N] completed

**Performance Metrics:**
- API Response Time: [X]ms average
- Extension Memory: [X]MB peak
- Error Rate: [X]%
- Uptime: [X]%

**Critical Issues Encountered:**
[List any issues and their resolution]

### Phase 2 Status

**Go Decision:** Phase 2 development approved for 2026-03-27 start
- Feature branch: ide-extension/phase2-provider-panel ready
- Development timeline: 12 hours (2026-03-27 to 2026-03-29)
- Expected deployment: 2026-03-30

**No-Go Decision:** Phase 2 deferred pending critical issue resolution
- Blocker: [issue description]
- Timeline: New Phase 1 round scheduled for [date]

### Team Coordination

- ✅ QA Engineer: Testing complete
- ✅ UX Researcher: Sessions complete
- ✅ Backend Team: APIs performed as expected
- ✅ Frontend Team: Ready for Phase 2 integration

### Final Status

Phase 1 testing execution COMPLETE.

[Decision on Phase 2 start]

---

**Phase 1 Monitoring: CLOSED**
**Next Phase: [Phase 2 Development / Phase 1 Retry]**
```

### Step 4: Update DCP-682 to 'In Review' (if Phase 1 complete)

If all success criteria met:
```bash
curl -X PATCH "${PAPERCLIP_API_URL}/api/issues/6e68fdda-9a49-446f-a2ef-9a47d73362a9" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_review",
    "comment": "Phase 1 testing execution complete. Final report posted. Awaiting code reviewer approval for Phase 2 transition."
  }'
```

### Step 5: Unblock DCP-683 (Phase 2 Development)

If Go decision:
```bash
curl -X POST "${PAPERCLIP_API_URL}/api/issues/a19b0795-cfd1-487f-af9e-773a5e8a1bcb/comments" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "## Phase 1 Complete — Go Decision Issued ✅\n\nPhase 1 testing completed successfully at 2026-03-26 08:00 UTC.\n\n**Go Decision:** APPROVED\n\nPhase 2 development begins immediately:\n\n1. Checkout: `git checkout ide-extension/phase2-provider-panel`\n2. Install: `npm install --include=dev`\n3. Build: `npm run compile`\n4. Watch: `npm run watch`\n5. Follow: PHASE2-DEVELOPMENT-CHECKLIST.md\n\nProvider Status Panel implementation starts now (4-hour window).\n\nReady to proceed."
  }'
```

---

## Contingency Scenarios

### Scenario 1: Extension Crashes During Phase 1

**If:** Extension crashes occur frequently (>3 in 12-hour window)

**Action:**
1. Post immediate escalation to DCP-682
2. Attempt to identify root cause (memory leak, API failure, UI bug)
3. Check error logs for pattern
4. Contact Frontend Developer for hot-fix
5. Document crash frequency and impact on metrics

**Decision Impact:** Yellow or No-Go if crash blocks testing

### Scenario 2: API Endpoint Down

**If:** /api/models, /api/jobs, or /api/providers endpoint is down

**Action:**
1. Post immediate escalation to DCP-682
2. Notify Backend Architect
3. Check API logs for errors
4. Verify database connectivity
5. Document outage duration

**Decision Impact:** No-Go if outage >1 hour and blocks testing

### Scenario 3: QA Tests Failing

**If:** >10% of tests failing after Hour 6

**Action:**
1. Post escalation to DCP-682 and QA Engineer
2. Request immediate test failure investigation
3. Check if failures are environment issues or code issues
4. Document failure patterns

**Decision Impact:** No-Go if root cause unresolved by Hour 40

### Scenario 4: Memory Leak in Extension

**If:** Memory usage climbs from 145MB baseline to >300MB and doesn't stabilize

**Action:**
1. Post escalation to DCP-682
2. Request Frontend Developer profile the extension
3. Check for uncontrolled event listeners, intervals, or DOM growth
4. Document memory trend

**Decision Impact:** Yellow if leak found and fix is in progress; No-Go if leak unresolved

---

## Tools & Commands

### Monitor API Endpoints
```bash
# Test all required endpoints
for endpoint in /api/models /api/templates /api/providers/public /api/jobs; do
  echo "Testing $endpoint"
  curl -s -w "\nResponse Time: %{time_total}s\n" https://api.dcp.sa${endpoint}
done
```

### Check Extension Memory
```bash
ps aux | grep -i extension | grep -v grep | awk '{print $6 " MB (PID: " $2 ")"}'
```

### Post Status Update to Paperclip
```bash
curl -X POST "${PAPERCLIP_API_URL}/api/issues/6e68fdda-9a49-446f-a2ef-9a47d73362a9/comments" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
  -H "Content-Type: application/json" \
  -d "{\"body\": \"$(cat status-update.md | jq -Rs .)\"}"
```

---

## Key Contacts

| Role | Responsibility | Contact |
|------|-----------------|---------|
| **QA Engineer** | Integration test execution & reporting | @QA-Engineer |
| **UX Researcher** | Recruiter session execution | @UX-Researcher |
| **Frontend Developer** | Extension debugging/fixes | @Frontend-Developer |
| **Backend Architect** | API debugging/fixes | @Backend-Architect |
| **Code Reviewer 1/2** | PR review & merge (Phase 2) | @Code-Reviewer-1, @Code-Reviewer-2 |

---

## Success = Ready for Phase 2

Upon Phase 1 completion with Go decision:
- ✅ DCP-682 → in_review status
- ✅ DCP-683 → unblocked and ready for checkout
- ✅ ide-extension/phase2-provider-panel branch ready
- ✅ Phase 2 development begins 2026-03-27 00:00 UTC

---

**Document Version:** 1.0
**Last Updated:** 2026-03-24 01:50 UTC
**Next Update:** Post-Phase-1 (2026-03-26 08:00 UTC)
