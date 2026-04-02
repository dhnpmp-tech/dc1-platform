# Phase 1 Monitoring Environment Setup

**Agent:** UX Researcher (8d518919-fbce-4ff2-9d29-606e49609f02)
**Purpose:** Configure local environment for Phase 1 real-time monitoring (Days 4-6: 2026-03-26 to 2026-03-28)
**Duration:** 3 days of continuous monitoring (08:00-23:00 UTC daily)

---

## Environment Overview

### Monitoring Tools Required
1. **Mixpanel** — Analytics dashboard (signups, deployments, jobs, tokens, revenue)
2. **Intercom/Pendo** — Feedback widget responses collection
3. **Twitter/X** — Community sentiment monitoring
4. **Discord** — User feedback channel monitoring
5. **GitHub** — Issue tracking for user-reported bugs
6. **Slack** — Real-time alerts and team communication
7. **Observation Docs** — Daily markdown files for recording findings

### Monitoring Schedule
- **Daily standup:** 09:00 UTC (after community monitoring)
- **Observation posts:** 08:00, 12:00, 16:00, 20:00 UTC
- **Continuous monitoring:** Throughout 08:00-23:00 UTC window
- **Critical escalation:** Any time (15-min SLA)

---

## Local Setup Checklist

### 1. Browser Configuration

**Dashboards Tab**
- [ ] Open Mixpanel dashboard in Browser Tab 1 (analytics)
- [ ] Open Intercom/Pendo dashboard in Browser Tab 2 (feedback)
- [ ] Open Twitter Search in Browser Tab 3 (sentiment)
- [ ] Keep Discord app/web open in separate window
- [ ] Keep GitHub issues open in Browser Tab 4

**Notification Settings**
- [ ] Enable browser notifications for Slack
- [ ] Enable desktop notifications for Discord DMs
- [ ] Enable email notifications for GitHub issues with labels

### 2. File System Setup

**Create monitoring directory structure:**
```bash
mkdir -p ~/.phase1-monitoring/
cd ~/.phase1-monitoring/

# Daily observation logs (will be filled during monitoring)
touch day-4-observations.md
touch day-5-observations.md
touch day-6-observations.md

# Community monitoring logs
touch twitter-daily-log.txt
touch discord-daily-log.txt
touch github-daily-log.txt

# Critical issues log
touch critical-issues.md
```

### 3. Credential Storage

**Create secure credentials file (DO NOT COMMIT):**
```
~/.phase1-monitoring/credentials.env (local only, not in git)

MIXPANEL_API_KEY=<from Backend Architect>
MIXPANEL_SECRET=<from Backend Architect>
INTERCOM_API_TOKEN=<from Frontend Developer>
GITHUB_TOKEN=<your GitHub token>
```

**Load credentials before monitoring:**
```bash
source ~/.phase1-monitoring/credentials.env
```

---

## Daily Monitoring Workflow

### Morning Setup (Before 08:00 UTC)

1. **Load environment:**
   ```bash
   cd ~/.phase1-monitoring/
   source credentials.env
   ```

2. **Open all dashboards:**
   - [ ] Mixpanel analytics (verify events flowing)
   - [ ] Intercom/Pendo feedback (check for overnight submissions)
   - [ ] Twitter/X search (look for new #DCP mentions)
   - [ ] Discord #feedback channel (any user questions?)
   - [ ] GitHub issues search (`label:phase1` `label:user-report`)

3. **Reset daily observation file:**
   ```bash
   cp docs/ux/PHASE1-DAY-{n}-OBSERVATIONS.md ~/.phase1-monitoring/day-{n}-observations.md
   ```

4. **Prepare alerting:**
   - [ ] Slack notification sounds enabled
   - [ ] Critical issue escalation contact available
   - [ ] Calendar set (block 08:00-23:00 UTC)

### Hourly Monitoring (08:00-23:00 UTC)

**Every hour (on the hour):**
1. Check Mixpanel for metric changes
2. Check Intercom for new feedback submissions
3. Scan Twitter/X mentions (last 60 min)
4. Review Discord #feedback messages (last 60 min)
5. Check GitHub issues (any new phase1 or user-report issues?)
6. Log findings in day-N-observations.md
7. If critical issue found → escalate immediately (15-min SLA)

### Observation Post Times (Daily)

**08:00 UTC Morning Post (Kickoff):**
- Metrics from overnight (if Day 4) or previous day
- Infrastructure status check
- Day plan and focus areas

**12:00 UTC Midday Post (Progress):**
- Morning metrics review
- Any issues or friction observed so far
- Forecast for afternoon/evening

**16:00 UTC Afternoon Post (Checkpoint):**
- Mid-day metrics review
- Emerging patterns or issues
- Adjustment to approach if needed

**20:00 UTC Evening Post (Day Summary):**
- Full-day metrics summary
- Key findings and blockers
- Recommendations for next day (if not final day)

### Daily Standup (09:00 UTC)

**Attendees:** UX Researcher, QA Engineer, Backend Architect, ML Infrastructure
**Duration:** 15 minutes
**Topics:**
- Overnight metrics (signups, deployments, errors)
- Community sentiment summary
- Any critical blockers
- Today's focus and priorities
- Next checkpoint (12:00 UTC or as needed)

---

## Monitoring Templates

### Daily Observation Post Template

```markdown
# Day [N] Observation Post — [Time] UTC

**Time:** [HH:MM UTC]
**Date:** 2026-03-2[6-8]
**Observation Period:** [Start Time] - [Current Time] UTC

## Metrics Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Signups | [N] | ≥5 (by Day 4) | [✓/⚠] |
| Deployments | [N] | ≥3 (by Day 5) | [✓/⚠] |
| Job Completion | [N]% | >95% (Day 5) | [✓/⚠] |
| Token Accuracy | [N]% | 100% (Day 6) | [✓/⚠] |
| Community Feedback | [N] | ≥10 (by Day 6) | [✓/⚠] |

## Key Findings

### What's Working
- [List positive observations or successful flows]

### What Needs Attention
- [List issues, friction points, or concerns]

### User Sentiment
- Twitter/X: [Summary of mentions - positive/negative/neutral]
- Discord: [Summary of feedback channel activity]
- Feedback Widget: [Summary of submitted feedback themes]

## Critical Issues

[If any: list issue, severity, who's working on it, ETA to patch]

## Next Focus (If Not Final Day)

- [Items to monitor more closely tomorrow]
- [Tests to run]
- [Coordination with teams needed]

---

**Posted by:** UX Researcher
**Next Observation Post:** [Time] UTC
**Critical Contact:** [On-call engineering contact]
```

### Community Monitoring Daily Summary

```markdown
## Twitter/X Daily Summary (2026-03-2[6-8])

**Mentions:** [N] new mentions in 24h
- Positive: [N]
- Neutral: [N]
- Negative: [N]
- Competitor references: [N]

**Key Quotes:** [Copy direct quotes from mentions]
**Feature Requests:** [Any new features requested?]
**Issues Reported:** [Any bugs or problems mentioned?]

## Discord #feedback Summary (2026-03-2[6-8])

**New Messages:** [N]
**Responders:** [N] unique users
**By Category:**
- Feature requests: [N]
- Bug reports: [N]
- Praise/positive: [N]
- Questions: [N]

**Action Items:** [Anything that needs escalation?]

## GitHub Issues (phase1 + user-report labels)

**New Issues:** [N]
**By Category:**
- Critical: [N]
- High: [N]
- Medium: [N]
- Low: [N]

**Patterns:** [Any recurring issues across multiple reports?]
```

---

## Alert Configuration

### Critical Alert Triggers (15-min SLA)

Immediately escalate if you observe:
1. **Downtime/Outage:** API returning 5xx errors, model serving unavailable
2. **Security Issue:** Unexpected data exposure, unauthorized access attempt
3. **Regression:** Feature that was working stops working
4. **Data Loss:** Submissions not persisting, metrics not recording
5. **Performance Degradation:** Response times >10s, timeouts increasing

### Urgent Alert Triggers (1-hour SLA)

Report within 1 hour if:
1. Multiple users report same bug (>3 mentions)
2. High-volume feature request (>5 requests for same feature)
3. Potential UX blocker (users confused, high drop-off rate)
4. Integration failure (external API down, webhook not firing)

### Standard Alerts (Daily standup)

Report in daily standup if:
1. Minor UI issues (alignment, typo, non-blocking)
2. Enhancement requests (nice-to-have features)
3. Documentation gaps
4. Performance improvements (optimization suggestions)

---

## Daily Close-Out (Before 23:00 UTC)

**Steps:**
1. [ ] Complete final observation post for the day
2. [ ] Consolidate all monitoring logs
3. [ ] Backup daily observations to Paperclip/git
4. [ ] Identify any overnight items that need team attention
5. [ ] Prepare summary for next day or final report (if Day 6)

**File backups:**
```bash
# Backup daily logs to git repo
cp ~/.phase1-monitoring/day-[N]-observations.md \
   docs/ux/PHASE1-DAY-[N]-OBSERVATIONS.md

# Commit if Day 6 (final day)
git add docs/ux/PHASE1-DAY-*-OBSERVATIONS.md
git commit -m "docs(Phase1 Day [N]): Daily observation logs"
```

---

## Tools & Resources

### Required Credentials/Access

| Tool | Provided By | When | Notes |
|------|-------------|------|-------|
| Mixpanel API Key | Backend Architect (DCP-935) | 2026-03-25 22:00 UTC | For event export |
| Intercom API Token | Frontend Developer (DCP-936) | 2026-03-25 22:00 UTC | For feedback export |
| GitHub Token | Your account | Now | For issue tracking |
| Slack Channel | Backend/QA | Now | #phase1-critical |

### Useful Commands

**Check API health:**
```bash
curl https://api.dcp.sa/api/health | jq '.'
```

**List models:**
```bash
curl https://api.dcp.sa/api/models | jq '.models[] | {name, pricing}'
```

**Export daily events (requires Mixpanel API key):**
```bash
# See scripts/phase1-preflight-smoke.mjs for example
node scripts/phase1-continuous-monitoring.mjs
```

---

## Session Notes

**Created:** 2026-03-24 22:50 UTC
**Status:** Ready for Phase 1 launch
**Next Step:** Complete remaining setup tasks by 2026-03-25 22:00 UTC

This environment will be active for Days 4-6 (2026-03-26 to 2026-03-28). Keep all tabs/windows open and monitoring throughout the window.
