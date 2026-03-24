# Phase 1 Test Failure Analysis Form

**Purpose:** Document and escalate test failures systematically
**Created:** 2026-03-24 (for use during Days 4-6)
**QA Engineer:** 891b2856-c2eb-4162-9ce4-9f903abd315f

---

## Failure Report Template

**Report ID:** Phase1-Day-X-Failure-### (e.g., Phase1-Day4-Failure-001)
**Reported by:** QA Engineer
**Date/Time:** 2026-03-26 HH:MM UTC
**Severity:** ☐ CRITICAL (blocks testing) ☐ HIGH (blocks feature) ☐ MEDIUM (degraded) ☐ LOW (cosmetic)

---

## 1. Failure Identification

### What Failed?
**Test Name:** ________________
**Endpoint/Component:** ________________
**Description:** [1-2 sentence summary]

### When Did It Fail?
**Test Day:** ☐ Day 4 ☐ Day 5 ☐ Day 6
**Test Phase:** ☐ Validation ☐ Integration ☐ Load Testing ☐ Security Testing
**Timestamp:** ________ UTC
**Reproducibility:** ☐ Always ☐ Intermittent ☐ First occurrence only

---

## 2. Exact Reproduction Steps

**Step-by-step instructions to reproduce:**

```bash
# Example:
curl -X POST https://api.dcp.sa/api/models/deploy \
  -H "Authorization: Bearer $DCP_RENTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"template_id": "llama3-8b", "provider_id": "test-provider"}'

# Response: 500 Internal Server Error
```

**Prerequisites:**
- [ ] Test credentials provisioned
- [ ] Provider(s) online
- [ ] Database initialized
- [ ] [Other prerequisites]

---

## 3. Expected vs Actual

**Expected Behavior:**
[What should happen according to spec/docs]

**Actual Behavior:**
[What actually happened]

**HTTP Status Code:**
- Expected: ________
- Actual: ________

**Response Body:**
```json
{
  "error": "[actual error response]"
}
```

**Response Headers (if relevant):**
```
[Paste relevant headers]
```

---

## 4. Error Analysis

### Error Message
```
[Exact error message from response or logs]
```

### Root Cause Assessment

**Initial Assessment:** ☐ Code bug ☐ Config issue ☐ Data issue ☐ Infrastructure ☐ Test error

**Most Likely Cause:**
[What do you think caused this?]

**Evidence:**
- [ ] Backend logs show: ________________
- [ ] Database logs show: ________________
- [ ] Network trace shows: ________________
- [ ] Other evidence: ________________

---

## 5. Scope & Impact

### Which Features Affected?
☐ Model browsing/deployment
☐ Provider onboarding
☐ Job submission/execution
☐ Metering/pricing
☐ Authentication
☐ Admin dashboard
☐ Other: ________________

### How Many Users Affected?
☐ Single user ☐ Single provider ☐ Subset ☐ All users ☐ All providers

### User Impact
```
[Describe what users experience when hitting this failure]
```

---

## 6. Logs & Evidence

### Backend Logs
```
[Paste relevant backend error logs]
```

### Database Logs (if applicable)
```
[Paste relevant DB logs]
```

### API Response (full)
```json
{
  "error": "[Full response]"
}
```

### Screenshots (if applicable)
[Links to screenshots or description]

---

## 7. Related Issues & Context

**Is this related to known issues?**
- [ ] No previous occurrence
- [ ] Similar to issue: ________________
- [ ] Related to feature: ________________

**Was this introduced by recent changes?**
- [ ] Likely related to commit: ________________
- [ ] Likely related to feature: ________________
- [ ] Likely environmental/config

**Previous status (if retesting):**
- [ ] This test was passing on ________ (last run date)
- [ ] This is a new failure

---

## 8. Severity Classification

**Assign Severity Level:**

| Severity | Criteria | Examples |
|----------|----------|----------|
| **CRITICAL** | Blocks Phase 1 testing completely | API down, auth broken, database corrupted |
| **HIGH** | Blocks a major feature path | Job deployment fails, pricing broken |
| **MEDIUM** | Feature degraded but workaround exists | Single endpoint slow, error message unclear |
| **LOW** | Minor issue, no functional impact | UI typo, non-critical log spam |

**Selected Severity:** ☐ CRITICAL ☐ HIGH ☐ MEDIUM ☐ LOW

**Justification:**
```
[Why you assigned this severity]
```

---

## 9. Escalation

### Who Should Fix This?
☐ Backend Architect
☐ ML Infra Engineer
☐ DevOps
☐ Security Engineer
☐ [Other: ________________]

### Escalation Actions Taken
- [ ] Posted comment on DCP-641
- [ ] @-mentioned relevant engineer
- [ ] Paused testing until resolved
- [ ] Created subtask for tracking
- [ ] Notified founder

### Escalation Comment (Draft)

```markdown
🔴 **Phase 1 Test Failure - [Severity]**

**Test:** [Test name]
**Endpoint:** /api/...
**Error:** [Error message]

**Reproduction:**
[Reproduction steps]

**Expected:** [Expected result]
**Actual:** [Actual result]

**Impact:** [User/business impact]

@[Engineer] — needs investigation

Testing paused on this component until resolved.
```

---

## 10. Workarounds & Mitigation

### Temporary Workaround (if any)
```
[Document if there's a way to work around this failure temporarily]
```

### Can Testing Continue?
- ☐ Yes, this failure doesn't block other tests
- ☐ No, this failure blocks further testing
- ☐ Partial, some tests can continue

### Alternate Test Path
```
[If applicable, document alternate tests that can run while this is being resolved]
```

---

## 11. Resolution Tracking

### Proposed Fix (by relevant engineer)
```
[Engineer will fill this in after investigation]
```

### Resolution Status
- ☐ INVESTIGATING
- ☐ FIX IDENTIFIED
- ☐ FIX APPLIED
- ☐ VERIFIED RESOLVED
- ☐ CLOSED

### Resolution Timeline
- **Identified:** ________
- **Fix applied:** ________
- **Re-tested:** ________
- **Verified:** ________

### Re-Test Results
- [ ] Failure still occurs
- [ ] Failure resolved
- [ ] Partial fix (some scenarios still fail)

---

## 12. Post-Mortem (After Resolution)

### Root Cause (Confirmed)
```
[What was the actual root cause?]
```

### Why It Happened
```
[Why did the code/config/infra get into this state?]
```

### Prevention
```
[How can we prevent this in the future?]
```

### Lessons Learned
```
[What did we learn from this failure?]
```

---

## Sign-Off

**QA Engineer (Reported):**
_____________________ Date: _______ Time: _______

**Engineer (Investigated):**
_____________________ Date: _______ Time: _______

**QA Engineer (Verified Resolved):**
_____________________ Date: _______ Time: _______

---

## Attachments

- [ ] Full backend log file: [link]
- [ ] Database dump: [link]
- [ ] Network trace: [link]
- [ ] Screenshot(s): [link]
- [ ] Related GitHub issue: [link]

---

## Quick Reference: When to File This Form

**File immediately if:**
- Test returns unexpected error (any 5xx status)
- Database queries fail
- Authentication/authorization broken
- Security vulnerability found
- Infrastructure unavailable

**File at end of day if:**
- Performance issue (latency, throughput)
- Data inconsistency
- UI/UX issue (if testing UI)
- Non-critical endpoint failure

**Do not file if:**
- Test error (wrong input, incorrect assertion)
- Expected behavior (per spec)
- Already documented in known issues

---

**Template Version:** 1.0
**Last Updated:** 2026-03-24
**For Questions:** See Phase 1 Troubleshooting Guide
