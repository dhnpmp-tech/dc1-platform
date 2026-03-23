# Phase 1 Dashboard Usability Testing Protocol
**Document:** Dashboard UX Validation for Renter Billing (SP25-004) & Provider Earnings (SP25-005)
**Research Goal:** Validate dashboard usability before launch, identify friction points, optimize information hierarchy
**Owner:** UX Researcher
**Date:** 2026-03-23
**Status:** READY FOR EXECUTION

---

## Research Objectives

✓ Verify card labels are clear and unambiguous to target users
✓ Validate earnings visualization comprehension (renters: costs; providers: income)
✓ Confirm action discoverability (withdraw earnings, view history, download reports)
✓ Test empty states, error handling, and loading states
✓ Measure task completion rates and time-to-task
✓ Identify accessibility issues (WCAG AA compliance check)
✓ Validate copy tone matches audience (provider vs renter voice)

---

## Participant Recruitment

### Renter Billing Dashboard (SP25-004) — 5-8 Participants
**Screener Criteria:**
- Current Vast.ai or RunPod user (existing rental experience)
- Age 18-50
- Comfortable with technical interfaces
- English-speaking
- 30-45 min availability for session
- Can share screen (Zoom/Teams)

**Recruitment Strategy:**
- Outreach via Vast.ai/RunPod communities (Reddit r/StableDiffusion, Discord servers)
- Twitter mention (if account exists)
- Email to DCP early waitlist
- Incentive: $15-25 Amazon gift card or USDC stablecoin

### Provider Earnings Dashboard (SP25-005) — 5-8 Participants
**Screener Criteria:**
- Active GPU provider on any marketplace (Vast.ai, RunPod, Akash)
- OR cafe/server farm operator with GPU experience
- Age 20-60
- Technical competency: can troubleshoot basic infrastructure
- English or Arabic speaking
- 45-60 min availability
- Can share screen

**Recruitment Strategy:**
- Email to DCP's 43 registered providers
- Outreach to university IT leads (KAUST, KFUPM)
- Server farm operators via LinkedIn
- Incentive: 10% discount on rental rates for first 3 months

---

## Session Structure (45 min for renters, 60 min for providers)

### 1. Welcome & Consent (5 min)
```
"Thank you for participating. We're testing a new dashboard before launch. There are no right or wrong answers — we're trying to learn from how you naturally use the interface. May I record this session for analysis?"

Recording: Video + audio (transcribed)
Notes: Consent form (confirm sharing preferences)
```

### 2. Background (5 min)
**For Renters:**
- How long have you been renting GPUs?
- What do you use GPUs for? (inference, training, fine-tuning, etc.)
- Which platforms do you currently use?
- How often do you check your billing/usage?

**For Providers:**
- How long have you been a provider?
- What GPUs do you operate?
- Are you currently active on a marketplace?
- How often do you check your earnings?

### 3. Dashboard Demo & Orientation (3 min)
```
"Here's the dashboard you'll be using. It shows [renter billing / provider earnings].
Take 2 minutes to look around. I won't ask you to do anything yet — just get familiar with it.
Think aloud as you explore."

Observation Focus:
- What elements does the participant notice first?
- Where do they look for specific information?
- Any confusion about icons, colors, or labels?
```

### 4. Guided Tasks (25 min)
**Renter Dashboard (SP25-004) Tasks:**

**Task 1: Find your monthly costs** (3 min)
```
"You want to know how much you've spent this month on GPU rental.
Show me where you'd look and tell me what you find."

Success Criteria:
- Finds "Total Spent" or "Billing This Month" card within 20 seconds
- Correctly understands the value shown
- Can identify MoM comparison
```

**Task 2: View job history** (5 min)
```
"You want to see what jobs you've run in the past week.
Where would you look? Show me the steps to find this information."

Success Criteria:
- Clicks/navigates to job history/activity section
- Can identify job details (model, start time, cost)
- Finds filters (if available) within 1 minute
- Can explain what each column means
```

**Task 3: Check current usage** (3 min)
```
"You're concerned you might be running low on GPU hours or credits.
Show me how you'd check your current usage/balance."

Success Criteria:
- Locates usage indicator within 15 seconds
- Understands the metric (hours, tokens, credits, etc.)
- Can identify how much is remaining/available
```

**Task 4: Download a cost report** (4 min)
```
"Your accountant needs a detailed CSV of your spending for tax purposes.
How would you get that?"

Success Criteria:
- Finds export/download button
- Understands file format options
- Can complete download without errors
- If unavailable: understands where this feature should be
```

**Task 5: Manage API keys or settings** (3 min)
```
"You want to rotate your API key or update billing email.
Where would you go to do this?"

Success Criteria:
- Locates settings/account area
- Can navigate settings hierarchy
- Understands which settings apply to billing
```

---

**Provider Dashboard (SP25-005) Tasks:**

**Task 1: Check current earnings** (3 min)
```
"You want to see how much you've earned this month.
Show me where you'd look and what you find."

Success Criteria:
- Finds "Earned This Month" or similar card within 20 seconds
- Understands the value is in SAR/USD
- Can identify MoM comparison and trend
```

**Task 2: View active jobs** (4 min)
```
"You're concerned about GPU stability during a job.
How would you check what jobs are currently running and their status?"

Success Criteria:
- Locates "Active Jobs" or "Jobs in Progress" section
- Can identify job details (model, runtime, status)
- Understands status indicators (running, failed, completed)
```

**Task 3: Monitor GPU utilization** (3 min)
```
"You want to optimize your earnings by understanding GPU usage.
Show me how you'd check your GPU utilization percentage."

Success Criteria:
- Finds GPU utilization card/metric
- Understands the percentage value
- Can identify "optimal range" guidance
- Understands what low utilization means for earnings
```

**Task 4: Withdraw earnings** (5 min)
```
"You want to cash out $100 from your earnings this month.
How would you do that? Walk me through the steps."

Success Criteria:
- Finds withdraw/payout button
- Understands payment method options (bank, crypto, SAR, USD)
- Can initiate withdrawal
- Understands processing time / fees (if applicable)
- Clear confirmation before submission
```

**Task 5: Check uptime/status** (3 min)
```
"You're trying to understand why your earnings dropped last week.
Where would you look to check your daemon uptime or any downtime events?"

Success Criteria:
- Locates uptime card/metric
- Understands the percentage
- Can see historical uptime or downtime events
- Understands cause of downtime (if shown)
```

**Task 6: View detailed job history** (4 min)
```
"You want to see a complete list of all jobs completed last week with token counts.
How would you access that information?"

Success Criteria:
- Locates job history table
- Can sort/filter by date
- Can identify relevant columns (start time, model, tokens, earnings)
- Can export if option exists
```

---

### 5. Free Exploration (5 min)
```
"Now take 5 minutes to explore the dashboard freely.
Show me where else you might look if you needed something.
Tell me if anything is confusing or missing."

Observation Focus:
- Any features they sought but couldn't find?
- Natural navigation patterns?
- UI elements they didn't understand?
```

### 6. Wrap-Up Questions (5-7 min)

**For Both:**
1. On a scale of 1-10, how easy was it to find what you needed? Why?
2. What was most confusing, if anything?
3. What feature or information would you most want to add?
4. How would you compare this to [Vast.ai / RunPod / current platform]?
5. Is there anything else you'd want to see on this dashboard?

**For Renters only:**
6. Does the copy/language feel right to you (cost tracking, billing language)?
7. Are there any terms you didn't understand?

**For Providers only:**
6. Does the copy/language feel right to you (earnings, job metrics, uptime)?
7. What would make you trust this platform with your GPU operations?

---

## Observation & Data Collection

### Metrics to Track

**Task Performance:**
- Task completion rate (%)
- Time to task (seconds)
- Number of clicks/navigation steps
- Error rate (wrong destination, misunderstanding)
- Abandoned tasks (gave up)

**Usability:**
- SUS-style rating (1-10) per task
- Confidence level (high / medium / low) per task
- Copy clarity (did they understand the terminology?)
- Icon/color comprehension (did they understand visual signals?)

**Emotional Signals:**
- Hesitation (pause before action)
- Frustration (tone, repeat attempts)
- Confusion (questions, re-reading)
- Confidence (quick actions, clear intent)

**Observations:**
- What element did they look at first?
- Did they expect to find information in a different location?
- Did tooltips / help text get noticed?
- Were empty states clear?

### Note-Taking Template

```
Session: [Renter/Provider] #[1-8]
Participant: [ID]
Date: [Date]
Duration: [minutes]

Task 1: [Task Name]
- Completion: [ ] Yes [ ] No [ ] Partial
- Time: ___ seconds
- Path: [Where they clicked/navigated]
- Quote: "[What participant said]"
- Issue: [Any friction observed]
- Confidence: [1-10]

[Repeat for each task]

Participant Quote (most memorable):
"[Quote]"

Summary Issue (if 1):
[Top friction point to address]
```

---

## Analysis & Synthesis

### Success Criteria (Launch Readiness)

**MUST HAVE (>90% success rate):**
- Find earnings/costs card
- View job history
- Understand status indicators
- Withdraw earnings (if action needed)

**SHOULD HAVE (>75% success rate):**
- Check current usage/utilization
- Navigate to settings
- Understand historical data
- Find export/download options

**NICE TO HAVE (>60% success rate):**
- Advanced filtering
- Custom date ranges
- API integrations
- Predictive analytics

### Issue Severity Classification

**Critical (blocks launch):**
- Task cannot be completed by 70%+ of users
- Safety issue (e.g., wrong payment recipient)
- Data accuracy issue

**High (fix before launch):**
- Task takes >2x expected time
- Copy is misleading
- Icon/label is unclear to majority

**Medium (can fix post-launch):**
- Edge case edge case
- Minor usability friction
- Enhancement request

**Low (backlog):**
- Nice-to-have feature
- Advanced user workflow
- Accessibility improvement

### Analysis Output

**Report Structure:**
1. Executive Summary (1 page)
   - Research objective
   - Sample size & dates
   - Key findings (top 3 issues)
   - Recommendation

2. Findings (2-3 pages)
   - Task performance by card/section
   - Copy/language issues
   - Icon/color issues
   - Accessibility gaps

3. Issue Inventory (detailed list)
   - Each issue with: description, severity, affected users, suggested fix

4. Appendix
   - Raw data (completion rates, times, SUS scores)
   - Quote library
   - Video timestamps (if permission given)

---

## Research Delivery Timeline

**Phase 1: Setup** (2026-03-24 — 1 day)
- [ ] Finalize screener questions
- [ ] Recruit participants (aim for 6-8 each dashboard)
- [ ] Confirm session times
- [ ] Prepare test environment (staging / mockups)
- [ ] Create consent form & recording setup

**Phase 2: Testing** (2026-03-25 — 2-3 days)
- [ ] Run 5-8 renter dashboard sessions
- [ ] Run 5-8 provider dashboard sessions
- [ ] Collect notes & recordings
- [ ] Flag critical issues during sessions

**Phase 3: Analysis** (2026-03-27 — 1 day)
- [ ] Synthesize findings
- [ ] Categorize issues (critical/high/medium/low)
- [ ] Generate issue inventory
- [ ] Create executive summary

**Phase 4: Delivery** (2026-03-28)
- [ ] Share findings with engineering
- [ ] Create Paperclip subtasks for fixes (if needed)
- [ ] Confirm launch readiness

**Target Launch:** 2026-03-29 (post-testing fixes if needed)

---

## Notes & Contingencies

**If recruitment is slow:**
- Expand to internal team + friends (bias warning)
- Test with 3-4 participants per dashboard (minimum viable)
- Conduct unmoderated remote tests (less rich data)

**If critical issue is found:**
- Escalate immediately with recommended fix
- Can often be fixed within 1-2 hours
- Re-test with 1-2 participants post-fix

**If testing reveals design conflict:**
- Document both options with trade-offs
- Present to engineering lead for decision
- Move forward with chosen direction

**If permission issues arise:**
- Can test without recording (notes only)
- Can test with lower-sensitivity data (mock currency)
- Can use clickthrough prototypes instead of live app

---

## Success Criteria for Research

✅ Test both dashboards with realistic user population
✅ Identify any blockers to launch (critical issues)
✅ Provide actionable feedback with specific recommendations
✅ Validate copy/UX alignment with tone guidelines
✅ Clear go/no-go assessment by 2026-03-28
✅ Issue inventory ready for engineering prioritization

---

**Prepared by:** UX Researcher
**For:** Sprint 26 Phase 1 Launch
**Status:** Ready to Execute
**Next Step:** Finalize participant recruitment and schedule sessions
