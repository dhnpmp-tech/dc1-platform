# Phase 1 Launch Day Runbook — UX Researcher

**Launch Date:** 2026-03-26 (Day 4)
**Launch Time:** 08:00 UTC
**UX Researcher Role:** Real-time monitoring + daily observation coordination
**Status:** Ready for execution

---

## Pre-Launch Phase (07:45-08:00 UTC)

### 07:45 UTC — Pre-Flight Health Checks (15 minutes)

**Checklist Before Launch:**

- [ ] **Analytics System Health**
  - [ ] Verify Segment webhook operational (make test call)
  - [ ] Confirm Mixpanel dashboard accessible
  - [ ] Check event schema (13 events registered)
  - [ ] Verify real-time pipeline (events flowing Segment → Mixpanel)

- [ ] **Feedback Widget Health**
  - [ ] Navigate to api.dcp.sa
  - [ ] Verify Intercom/Pendo widget visible (bottom-right)
  - [ ] Test feedback submission (submit test response)
  - [ ] Confirm response appears in admin dashboard (30-sec check)

- [ ] **Communication Channels Ready**
  - [ ] Slack #dcp-phase1-support channel active
  - [ ] Discord #feedback monitored
  - [ ] GitHub issues page bookmarked
  - [ ] Twitter search configured (#DCP, @dcp_ai)

- [ ] **Data Collection Systems Ready**
  - [ ] Observation template open (docs/ux/PHASE1-DAY-4-OBSERVATIONS.md)
  - [ ] Analytics dashboard favorited
  - [ ] Feedback widget admin dashboard open
  - [ ] Support queue access confirmed

### 07:55 UTC — Team Sync Check (5 minutes)

- [ ] Ping team on Slack #dcp-phase1-support: "Pre-flight checks PASS — ready for launch"
- [ ] Confirm QA Engineer ready (execution of smoke tests)
- [ ] Confirm Backend ready (API endpoints responding)
- [ ] Confirm IDE Extension monitoring active

### 07:58 UTC — Ready Status

- [ ] All systems verified operational
- [ ] All dashboards and tools loaded
- [ ] Team coordination confirmed
- [ ] Observation template ready

---

## Launch Phase (08:00-10:00 UTC)

### 08:00 UTC — LAUNCH ✅

**Event:** Phase 1 marketplace goes live with real renters

### 08:00-08:15 UTC — Live Monitoring Begins

**Critical First 15 Minutes:**

- [ ] **API Health**
  - [ ] Monitor api.dcp.sa response times (should be <200ms)
  - [ ] Check error rates (should be <1%)
  - [ ] Verify all 11 models responding with metadata

- [ ] **User Activity**
  - [ ] Monitor analytics dashboard for first signups
  - [ ] Expected: 1-3 signups in first 15 minutes (early adopters)
  - [ ] Check for errors in signup flow (watch error logs)

- [ ] **Feedback Collection**
  - [ ] Verify feedback widget is capturing interactions
  - [ ] Check for any JS errors (console checks)
  - [ ] Confirm responses flowing to dashboard

- [ ] **Team Status**
  - [ ] Confirm QA smoke tests completed successfully
  - [ ] Check for any critical issues in support queue
  - [ ] Monitor team Slack for alerts

### 08:15-09:00 UTC — Sustained Monitoring

**Continue Monitoring (45 minutes):**

- [ ] **Renter Onboarding Flow**
  - [ ] Signups continuing steadily (rate: TBD)
  - [ ] First model deployments occurring (watch for deployment success/errors)
  - [ ] Inference requests being submitted (end-to-end flow)

- [ ] **Community Response**
  - [ ] Twitter mentions appearing (track sentiment)
  - [ ] Discord #feedback channel activity starting
  - [ ] GitHub issues being filed (watch for critical issues)

- [ ] **Analytics Dashboard**
  - [ ] Verify data flowing in (events appearing in real-time)
  - [ ] Check funnel metrics (signup → profile → deployment)
  - [ ] Monitor API latency (target <200ms)

- [ ] **Support Queue**
  - [ ] Monitor for incoming support tickets
  - [ ] Categories appearing: deployment, billing, models
  - [ ] Response times (target <2h for critical)

### 09:00-10:00 UTC — Team Coordination

**Concurrent Activities:**

- [ ] **Post First Observation Note** (by 10:00 UTC)
  - Create: `docs/ux/PHASE1-DAY-4-OBSERVATIONS.md`
  - Include: Metrics, key findings, any blockers
  - Format: Markdown (see template below)
  - Post to: Slack #dcp-phase1-support + commit to repo

- [ ] **Brief Team on Status**
  - [ ] Post summary to Slack
  - [ ] Highlight any critical issues
  - [ ] Confirm all systems operational
  - [ ] Next checkpoint: 12:00 UTC daily checklist

---

## Hourly Monitoring Schedule (Day 4: 08:00-23:00 UTC)

### 09:00 UTC — Checkpoint 1 ✅
- [ ] Post Day 4 observation note (08:00-09:00 UTC metrics)
- [ ] Check: Signup rate, deployment rate, error rate
- [ ] Action: Alert team if critical issues

### 12:00 UTC — Checkpoint 2 (Midday)
- [ ] Post midday observation update
- [ ] Check: Cumulative metrics (4-hour totals)
- [ ] Action: Brief team on trends

### 16:00 UTC — Checkpoint 3 (Afternoon)
- [ ] Post afternoon observation update
- [ ] Check: Afternoon session patterns
- [ ] Action: Identify emerging issues

### 20:00 UTC — Checkpoint 4 (Evening)
- [ ] Post evening observation update
- [ ] Check: End-of-day accumulation
- [ ] Action: Prepare summary for next day

### 23:00 UTC — Checkpoint 5 (End of Day)
- [ ] Post final Day 4 summary
- [ ] Check: Full-day analytics compilation
- [ ] Action: Archive observations, prepare Day 5

---

## Daily Observation Template

### File: `docs/ux/PHASE1-DAY-{N}-OBSERVATIONS.md`

```markdown
# Phase 1 Day {N} Observations — {Date}

**Period:** {Start Time} to {End Time} UTC
**Observer:** UX Researcher
**Status:** ACTIVE / ISSUES / CRITICAL

---

## Metrics Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| New Signups | X | 2-5/hour | ✅ / 🟡 / ⛔ |
| Active Deployments | X | 1-3/hour | ✅ / 🟡 / ⛔ |
| Support Tickets | X | <2 critical | ✅ / 🟡 / ⛔ |
| API Error Rate | X% | <1% | ✅ / 🟡 / ⛔ |
| Avg API Latency | X ms | <200 ms | ✅ / 🟡 / ⛔ |
| Community Mentions | X | Growing | ✅ / 🟡 / ⛔ |

---

## Key Findings

### User Experience
- [Theme 1]: "User quote or observation"
- [Theme 2]: Result or pattern noticed

### Technical Issues
- [Issue 1]: Impact + recommended action
- [Issue 2]: ...

### Community Sentiment
- [Feedback type]: Sentiment + count
- ...

---

## Blockers or Escalations

- [ ] Critical Issue 1: [description] → Escalation: [who, when]
- [ ] Issue 2: ...

**If no blockers, write:** "No blockers identified."

---

## Next Day Focus

- Action 1: Monitor X
- Action 2: Follow up on X
- Action 3: Prepare for X

---

**Signed:** UX Researcher
**Time:** [UTC timestamp]
```

---

## Critical Escalation Paths

### If Critical Error (Response Required <30 minutes)

1. **Post to Slack:** `@backend-architect @foundingengineering CRITICAL: [error description]`
2. **Create Issue:** If not already created, create blocker issue
3. **Monitor Resolution:** Follow up every 15 minutes until resolved

### If Data Pipeline Issue (Analytics Down)

1. **Notify:** Backend Architect (@backend-architect)
2. **Workaround:** Switch to manual event logging
3. **Priority:** Restore within 2 hours

### If Feedback Widget Issue (No Responses)

1. **Notify:** Frontend Developer (@frontend-developer)
2. **Workaround:** Email feedback collection form
3. **Priority:** Restore within 1 hour

### If Support Queue Overwhelmed (>5 critical tickets)

1. **Notify:** Support Team Lead
2. **Assist:** Help categorize and triage tickets
3. **Priority:** Response <1 hour for critical

---

## Success Criteria for Day 4

✅ **Launch Execution:**
- Phase 1 marketplace goes live on schedule (08:00 UTC)
- API responding <200ms average latency
- Error rate <1%
- Zero critical unresolved issues

✅ **User Activity:**
- ≥2 signups in first hour
- ≥1 model deployment attempted
- ≥1 feedback response collected

✅ **Monitoring:**
- Analytics data flowing in real-time
- Daily observation posted by 10:00 UTC
- All critical alerts monitored

✅ **Team Coordination:**
- Team sync at launch + hourly updates
- No communication gaps
- Escalation path functional

---

## Day 4 Team Coordination

| Role | Responsibility | Channel |
|------|-----------------|---------|
| UX Researcher | Monitoring + observations | #dcp-phase1-support |
| QA Engineer | Smoke tests + uptime | #dcp-phase1-support |
| Backend Architect | API health + troubleshooting | #dcp-phase1-support |
| Frontend Developer | Widget + UI issues | #dcp-phase1-support |
| IDE Extension Dev | Extension monitoring | #dcp-phase1-support |
| Support Team | Ticket triage + customer comms | #dcp-phase1-support |
| DevRel | Community monitoring | #dcp-phase1-support |

**Sync Frequency:** Launch (08:00 UTC), then hourly checkpoints at :00 UTC

---

## Tools & Dashboards Needed

### Analytics
- Mixpanel dashboard: [URL for real-time funnel]
- Segment webhook test: [API endpoint]
- Daily export: [export URL or API call]

### Feedback
- Intercom/Pendo admin dashboard: [URL]
- Response export: [automated export schedule]

### Community
- Twitter search: [saved search for #DCP, @dcp_ai]
- Discord channel: #feedback
- GitHub issues page: [repo issues link]

### Support
- Support queue: [queue URL]
- Ticket categories: [list]
- Daily export: [export URL]

---

## Notes

- **Timezone:** All times in UTC
- **Observation cadence:** Hourly at :00 UTC (checkpoint times)
- **Emergency contact:** CEO or Founding Engineer (tag in Slack)
- **Documentation:** All observations committed to repo daily
- **Archive location:** `docs/ux/PHASE1-DAY-*.md` (one file per day)

---

## Quick Reference

**Launch:** 2026-03-26 08:00 UTC
**Pre-flight:** 2026-03-26 07:45 UTC
**Status Check Interval:** Hourly (:00 UTC)
**Daily Observation Post:** By 10:00 UTC
**Escalation Response:** <30 min for critical

---

**Prepared By:** UX Researcher
**Date:** 2026-03-24
**Status:** Ready for execution
