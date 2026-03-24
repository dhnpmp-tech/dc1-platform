# Phase 1 Post-Launch User Research Plan

**Decision Date:** 2026-03-24 13:00 UTC
**Status:** ACTIVE — Plan D2 (Real-User Monitoring)
**Phase 1 Launch:** 2026-03-26 08:00 UTC
**Report Due:** 2026-04-02

---

## Executive Summary

**Decision:** Deferred pre-launch scripted testing in favor of post-launch real-user monitoring.

**Rationale:**
- Pre-launch recruitment: 0/5-8 confirmations by checkpoint (12:00 UTC)
- Plan A executor not assigned; Plans B/C execution not visible
- **Plan D2 advantages:** Guaranteed authentic feedback, authentic usage patterns, faster iteration, superior signal quality post-launch

**Budget Impact:** $350-500 analytics + interview tools (net savings vs. Plans B/C)

---

## Research Timeline

### Phase 1 Launch (2026-03-26 08:00 UTC)
- Deploy marketplace with real renters
- Begin analytics instrumentation (Segment/Mixpanel)
- Activate in-app feedback widget (Intercom/Pendo)
- Monitor community channels (Discord/Twitter/GitHub)

### Week 1: Real-Time Monitoring (2026-03-26 to 2026-04-02)
- Track renter onboarding flow metrics
- Collect organic user feedback via in-app widget
- Monitor support tickets and error patterns
- Analyze community sentiment

### Week 2: User Interviews (2026-03-31+)
- Conduct 3-5 targeted user interviews (post-launch)
- Analyze feedback patterns across all channels
- Identify top 5-7 product improvement priorities

### Delivery (2026-04-02)
- Post-launch research report complete
- Actionable insights for product iteration
- Prioritized improvements for Sprint 28+

---

## Data Collection Infrastructure

### 1. Analytics Instrumentation (Segment/Mixpanel)

**Responsible:** Backend/DevOps + UX Researcher
**Timeline:** Setup by 2026-03-25 23:00 UTC (pre-flight)

**Events to Track:**

#### Renter Onboarding
- `renter_signup_start` — User begins signup
- `renter_signup_complete` — Account created
- `renter_login` — User logs in
- `renter_profile_setup` — User completes profile
- `renter_first_model_view` — User browses model catalog
- `renter_model_detail_view` — User views specific model
- `renter_deployment_start` — User initiates model deployment
- `renter_deployment_complete` — Model deployed successfully
- `renter_deployment_error` — Deployment failed
- `renter_inference_request` — User submits inference request
- `renter_invoice_view` — User views billing/invoices

#### Provider Onboarding
- `provider_signup_start`
- `provider_signup_complete`
- `provider_profile_setup`
- `provider_hardware_registration`
- `provider_model_deployment` (which models)
- `provider_earnings_view`

#### Session Metrics
- `session_duration`
- `page_load_time` (template catalog, model detail, deployment dashboard)
- `api_latency` (model queries, deployment requests)
- `error_rate` (5xx, 4xx by endpoint)

**Data Pipeline:**
- Events flow: Frontend/Backend → Segment → Mixpanel dashboard
- Real-time dashboards: renter funnel, provider activation, API health
- Daily snapshots: conversion rates, churn, feature adoption

---

### 2. In-App Feedback Widget (Intercom/Pendo)

**Responsible:** Frontend Developer + UX Researcher
**Timeline:** Deployed by Phase 1 Day 1 (2026-03-26 08:00 UTC)

**Feedback Flows:**

#### Contextual Surveys
- **After model deployment:** "How was your deployment experience?" (1-5 scale + open-ended)
- **After inference request:** "Was the output what you expected?" (yes/no/other)
- **On error pages:** "What were you trying to do?" (context capture)

#### Feedback Widget Menu
- "Report a bug" → Direct to GitHub Issues
- "Feature request" → Collect idea + context
- "How can we improve?" → Open-ended feedback
- "Chat with support" → Route to support queue

#### Response Prompts
- Trigger: After 3+ API calls (user is actively using)
- Message: "Help us improve — share feedback in 30 seconds"
- Opt-out: User can dismiss without impact

---

### 3. Community Monitoring

**Responsible:** DevRel + UX Researcher
**Timeline:** Automated + daily manual review starting 2026-03-26

**Channels:**
- **Twitter/X:** Search #DCP, @dcp_ai, monitor mentions
- **Discord:** Monitor #feedback, #bugs, #feature-requests channels
- **GitHub:** Track issues, PRs, discussions
- **Hacker News / Product Hunt:** Monitor discussions if posted

**Frequency:**
- Real-time alerts: Critical errors, major user complaints
- Daily summary: 09:00 UTC sentiment analysis, key themes
- Weekly synthesis: Trends, top requests, sentiment shift

**Tools:**
- Twitter monitoring: TweetDeck or native search
- GitHub: Watch issues/discussions
- Discord: Configured role mentions for critical topics
- Manual daily log: Slack channel #dcp-user-feedback

---

### 4. Support Ticket Analysis

**Responsible:** Support team + UX Researcher
**Timeline:** Daily review starting 2026-03-26

**Metrics:**
- Ticket volume by category (deployment, billing, models, other)
- Response time (target: <2h for critical, <8h for standard)
- Resolution rate (1st contact vs. escalation)
- User satisfaction (post-resolution survey)

**Trends to Watch:**
- Deployment cold-start latency complaints
- Model accuracy or output quality issues
- Billing/payment confusion
- Template catalog discoverability
- Provider earnings clarity

---

## Week 1: Real-Time Monitoring Protocol

### Day 4 (2026-03-26 08:00 UTC) — Launch
**Pre-flight (07:45 UTC):**
- ✅ Verify analytics collection (Segment webhook test)
- ✅ Verify feedback widget loads (Intercom/Pendo)
- ✅ Health check: api.dcp.sa, model endpoints, provider services
- ✅ Capture baseline metrics (API latency, error rates, uptime)

**Live Monitoring (08:00 UTC):**
- Real-time dashboard: renter signup flow, first deployments
- Support queue: Monitor for critical issues
- Community channels: Monitor Twitter, Discord for early feedback
- Team standby: 2h continuous monitoring (08:00-10:00 UTC)

**Daily Standby (Days 4-6, 09:00-11:00 UTC):**
- Review overnight analytics: signup trends, error logs, session durations
- Check support tickets: new categories, error patterns
- Read community feedback: sentiment, feature requests
- Document findings: daily observation notes

---

## Week 2: User Interview Protocol (Starting 2026-03-31)

### Interview Recruitment

**Target:** 3-5 users who have deployed a model (active renters)

**Recruitment Method:**
- In-app feedback widget: "Would you participate in a 30-min research call?"
- Support tickets: Follow up with engaged users
- Community: Reach out to active Discord members
- Incentive: $25 gift card or platform credit

**Scheduling:**
- Offer 3-4 time slots: 2x Europe-friendly, 1-2x Asia-friendly
- Duration: 30 minutes (screenshare + interview)
- Tool: Zoom with automatic recording

---

### Interview Guide (30 minutes)

**Opening (5 min):**
- Welcome, confidentiality, thank you for time
- Explain: We're learning how to improve the product
- Ask permission to record

**Current Usage (5 min):**
- What model(s) did you deploy?
- How many times have you used it?
- What is your use case?

**Onboarding Experience (5 min):**
- Walk me through your first deployment. What was easy?
- What was confusing or frustrating?
- Did you need help? Where did you look?

**Feature Feedback (8 min):**
- Model catalog: Easy to find what you need?
- Pricing: Clear? Fair compared to alternatives?
- Deployment process: Smooth? Any errors?
- Results/output: Met expectations?

**Closing (2 min):**
- One thing we should fix first?
- Would you recommend us to a colleague?

---

### Analysis Method

**Themes:**
- Code responses into 5-7 themes (e.g., "Cold-start latency," "Model selection clarity")
- Count frequency (e.g., 4/5 mentioned latency)
- Identify pain points vs. delights

**Prioritization:**
- **Impact:** How many users affected?
- **Effort:** Time to fix?
- **Satisfaction:** How important to users?

**Output:** Ranked list of 5-7 improvements for Sprint 28+

---

## Daily Observation Notes Template

Create daily file: `docs/ux/PHASE1-DAY-{N}-OBSERVATIONS.md`

```markdown
# Day {N} Observations — {Date}

## Metrics Summary
- Signups: X (target: X/day)
- Active deployments: X
- Support tickets: X (categories: ...)
- API error rate: X%
- Community mentions: X

## Key Findings
- [Theme 1]: "User feedback quote"
- [Theme 2]: Result or pattern

## Blockers or Issues
- [Issue 1]: Impact + recommended action
- [Issue 2]: ...

## Next Day Focus
- Monitor X
- Follow up on X
```

---

## Final Report (2026-04-02)

**Responsible:** UX Researcher
**Format:** Markdown document + presentation

**Contents:**
1. **Executive Summary** (1 page)
   - Top 5-7 improvements identified
   - User satisfaction snapshot (NPS or sentiment)
   - Recommendation for next phase

2. **Data Summary** (2 pages)
   - Analytics: Signup funnel, deployment success rate, API performance
   - Feedback: Top themes, quotes, volume by source
   - Interview findings: Key patterns, consensus issues

3. **Detailed Findings** (3-5 pages)
   - Each of 5-7 improvements:
     - What is the issue?
     - How many users affected? (frequency)
     - User quotes / evidence
     - Recommended fix (1-2 sentences)
     - Estimated effort (1 day / 1 week / 2+ weeks)

4. **Appendix**
   - Day 4-6 observation notes
   - Interview transcripts (anonymized)
   - Analytics dashboard snapshots
   - Community feedback summary

---

## Success Criteria

✅ **Week 1 (Real-time monitoring):**
- Analytics instrumentation operational by Day 4 09:00 UTC
- Feedback widget collecting responses by Day 4 10:00 UTC
- Daily observation notes posted by 10:00 UTC each day
- 0 critical unaddressed issues (support + community escalations handled <2h)

✅ **Week 2 (Interviews):**
- 3-5 interviews scheduled by 2026-03-29
- Interviews completed by 2026-04-01
- Themes coded and prioritized

✅ **Final Report (2026-04-02):**
- Report complete with 5-7 prioritized improvements
- Findings presented to CEO + team
- Recommendations inform Sprint 28 priorities

---

## Team Contacts

| Role | Person | Slack | Availability |
|------|--------|-------|--------------|
| UX Researcher (Lead) | UX Researcher | @ux-researcher | Daily 08:00-18:00 UTC |
| Analytics Setup | Backend Architect | @backend | 2026-03-25 16:00 UTC |
| Feedback Widget | Frontend Developer | @frontend | 2026-03-25 18:00 UTC |
| Support Escalations | Support Team Lead | @support | Daily on-call |
| Community Monitoring | DevRel | @devrel | Daily 09:00 UTC |

---

## Key Documents

- [Phase 1 Execution Runbook](/docs/PHASE1-DAY4-EXECUTION-RUNBOOK.md) — Day 4 launch procedures
- [DCP-676: Recruitment Status](/DCP/issues/DCP-676) — Task tracking
- [Post-Launch Analytics Dashboard](http://localhost:3100) — Real-time metrics
- [Community Feedback Channel](#) — Slack #dcp-user-feedback

---

**Next Action:** Coordinate with Backend/DevOps on analytics setup (2026-03-24 16:30 UTC)
**Status:** 🟢 READY FOR PHASE 1 EXECUTION
