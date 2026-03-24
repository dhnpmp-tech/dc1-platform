# Phase 1 Post-Launch User Research Plan

**Decision:** Plan D2 — Defer Phase 1 pre-launch testing, activate post-launch research
**Activation Time:** 2026-03-24 13:00 UTC
**Phase 1 Launch:** 2026-03-26 08:00 UTC
**Research Duration:** 2026-03-26 to 2026-04-02 (~1 week)
**Report Delivery:** 2026-04-02 (end of Week 1)

---

## Rationale

Recruitment for pre-launch testing yielded **0/5-8 confirmations** despite three contingency plans (A, B, C). Post-launch user research offers:

- ✅ **Guaranteed real user feedback** — authentic renter behavior in production
- ✅ **Superior signal quality** — actual usage patterns vs. scripted testing
- ✅ **Faster iteration** — production data enables quicker refinement
- ✅ **Infrastructure ready** — Phase 1 marketplace deployment ready for launch
- ✅ **Cost-effective** — focuses resources on high-value interviews post-launch

---

## Research Methods & Timeline

### Week 1: Analytics Instrumentation & In-App Feedback (2026-03-26 to 2026-04-02)

#### 1. Analytics Instrumentation (Segment/Mixpanel)

**Owner:** Backend Architect + DevOps
**Timeline:** 2026-03-25 (pre-launch setup) + 2026-03-26 08:00 UTC (activation)
**Effort:** 2-4 hours

**Events to Track:**

| Event Category | Specific Events | Purpose |
|---|---|---|
| **Renter Onboarding** | Sign-up, email verify, profile complete, payment method added, KYC submit | Flow completion rate, drop-off points |
| **Model Discovery** | Model catalog view, model detail view, filter/search, comparison, save favorite | Discovery patterns, interest areas |
| **Deployment** | Deploy model, select GPU, configure resources, submit job, job queued | Deployment friction, common errors |
| **Usage** | Job start, token generation, job complete, usage metrics (TFLOP/s, latency, uptime) | Performance satisfaction, utilization |
| **Pricing** | Price comparison view, cost estimation view, invoice view | Price sensitivity, transparency needs |
| **Support** | Help center view, FAQ search, support ticket submit, chat initiate | Support gaps, pain points |

**Required Fields Per Event:**
- `user_id` (renter identifier)
- `session_id` (tracking session continuity)
- `timestamp` (UTC)
- `properties` (event-specific context)

**Implementation Checklist:**
- [ ] Segment integration deployed to frontend (2026-03-25)
- [ ] Event schema finalized & documented (2026-03-25)
- [ ] Mixpanel dashboard configured (2026-03-25)
- [ ] Data validation test run (2026-03-25 16:00 UTC)
- [ ] Live analytics activation at Phase 1 launch (2026-03-26 08:00 UTC)

---

#### 2. In-App Feedback Widget (Intercom/Pendo)

**Owner:** Frontend Developer + UX
**Timeline:** 2026-03-25 (pre-launch setup) + 2026-03-26 08:00 UTC (activation)
**Effort:** 1-2 hours

**Feedback Prompts:**

| Trigger | Prompt | Timing |
|---|---|---|
| **Post-Deployment** | "How was your deployment experience?" | After job success (5 min later) |
| **Model Selection** | "Was the model selection process clear?" | After selecting a model |
| **Pricing** | "Were the prices transparent & competitive?" | After viewing invoice |
| **Support Contact** | "What brought you here?" | If accessing help center |
| **Exit Survey** | "Why are you leaving?" | If leaving without action (optional) |

**Implementation Checklist:**
- [ ] Intercom/Pendo account set up (2026-03-25)
- [ ] Widget code integrated to frontend (2026-03-25)
- [ ] Feedback forms configured (2026-03-25)
- [ ] Test submission flow (2026-03-25 17:00 UTC)
- [ ] Widget live at Phase 1 launch (2026-03-26 08:00 UTC)

**Expected Response Rate:** 5-15% (depending on conversion funnel depth)

---

#### 3. Community Channel Monitoring (Discord/Twitter/GitHub)

**Owner:** DevRel + Copywriter
**Timeline:** 2026-03-26 08:00 UTC → 2026-04-02
**Effort:** 10-15 min daily check-in

**Channels to Monitor:**

| Channel | Purpose | Check Frequency |
|---|---|---|
| **Discord #feedback** | Renter feedback, feature requests, bugs | Daily (08:00, 16:00 UTC) |
| **Twitter @dcplatform** | Public sentiment, competitive mentions | Daily (12:00 UTC) |
| **GitHub discussions** | Technical issues, integration questions | Every 2 days |
| **Support tickets** | Issues, escalations, sentiment | Real-time alerts |

**Monitoring Template:**
- [ ] Sentiment: positive/neutral/negative
- [ ] Topic: onboarding / pricing / performance / models / support
- [ ] Action needed: Y/N
- [ ] Log entry in research notes

---

### Week 2: Targeted User Interviews (2026-03-31+)

**Owner:** UX Researcher + Product Manager
**Timeline:** 2026-03-31 (recruitment) → 2026-04-02 (synthesis)
**Target:** 3-5 renter interviews
**Duration:** 20-30 min per interview

**Interview Focus:**

1. **Onboarding Experience**
   - How did you discover DCP?
   - What was your sign-up experience like?
   - Any blockers during payment/KYC?

2. **Model Discovery**
   - How did you choose which model to deploy?
   - Was pricing transparent?
   - Did you compare to competitors?

3. **Deployment & Usage**
   - Walk me through your first deployment.
   - What worked well? What was frustrating?
   - How is the model performing vs. your expectations?

4. **Value & ROI**
   - Are you seeing the cost savings you expected?
   - Would you recommend to other teams?
   - What would make you more likely to scale up?

5. **Support & Friction**
   - Did you encounter any errors or issues?
   - How easy was it to get help?
   - What would improve your experience?

**Interview Recruitment:**
- [ ] Identify 5-8 active renters from analytics (2026-03-29)
- [ ] Send recruitment email with incentive (Starbucks gift card, 10% credit) (2026-03-30)
- [ ] Schedule confirmed interviews (2026-03-31)
- [ ] Conduct interviews (2026-04-01 to 2026-04-02)

---

## Data Analysis & Synthesis (2026-04-02)

**Owner:** UX Researcher
**Deliverable:** Post-Launch Research Report

### Quantitative Analysis
- **Funnel metrics:** Sign-up → payment → KYC → first deployment (conversion %)
- **Time-to-value:** Days from sign-up to first successful deployment
- **Feature usage:** % of renters using each GPU tier, model type, pricing tier
- **Error rate:** % of deployments with errors, most common error types
- **Support volume:** # of support tickets, response time, resolution time

### Qualitative Synthesis
- **Top 3 pain points:** (from analytics + interviews)
- **Top 3 opportunities:** (from interviews + feedback widget)
- **Renter segments:** Different user archetypes & their needs
- **Competitive positioning:** How renters perceive DCP vs. Vast.ai, RunPod, Akash

### Output Format
- **Executive Summary** (1 page): Key findings + 3-5 recommendations
- **Detailed Findings** (3-5 pages): Organized by theme (onboarding, pricing, performance, support)
- **Appendix:** Interview notes, analytics dashboard link, feedback widget export

---

## Success Criteria

| Criterion | Target | Status |
|---|---|---|
| Analytics events tracked | ≥80% of target events | TBD (post-launch) |
| In-app feedback responses | ≥20 responses | TBD (post-launch) |
| Interview completions | 3-5 interviews | TBD (Week 2) |
| Community feedback collected | ≥5 distinct insights | TBD (Week 1) |
| Report delivered | 2026-04-02 | TBD |

---

## Team Responsibilities

| Team | Task | Owner | Deadline |
|---|---|---|---|
| **Backend/DevOps** | Analytics instrumentation (Segment/Mixpanel setup) | Backend Architect | 2026-03-25 16:00 UTC |
| **Frontend** | In-app feedback widget (Intercom/Pendo deploy) | Frontend Developer | 2026-03-25 17:00 UTC |
| **DevRel/Copywriter** | Community monitoring + interview recruitment | DevRel | Daily + 2026-03-30 |
| **UX Researcher** | Research coordination + data synthesis | UX Researcher | 2026-04-02 |
| **QA/Testing** | Phase 1 launch validation (DCP-773) | QA Engineer | 2026-03-26 08:00 UTC |

---

## Coordination Notes

### Pre-Launch (2026-03-25)
- [ ] Backend/DevOps: Confirm analytics setup with UX Researcher
- [ ] Frontend: Confirm feedback widget deployment timeline
- [ ] QA: Verify analytics data flow test (2026-03-25 16:00 UTC)
- [ ] All: Final Phase 1 launch readiness (2026-03-25 23:00 UTC)

### At Launch (2026-03-26 08:00 UTC)
- [ ] Activate analytics tracking
- [ ] Activate feedback widget
- [ ] Begin community monitoring
- [ ] QA: Execute launch validation (DCP-773)

### Week 1 (2026-03-26 to 2026-04-02)
- [ ] Daily: Community monitoring check-in (08:00, 16:00 UTC)
- [ ] Daily: Analytics dashboard review (12:00 UTC)
- [ ] End of Week: Data export & synthesis (2026-04-02)

### Week 2 (2026-03-31+)
- [ ] Interview recruitment & scheduling
- [ ] Conduct user interviews (3-5 renters)
- [ ] Analyze findings
- [ ] Synthesize report

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| **Low feedback response rate** | Use in-app widget + email follow-up + Discord incentives |
| **Interview no-shows** | 2x recruitment (over-book by 50%), incentives ($10-20 gift card) |
| **Analytics data loss** | Segment + Mixpanel redundancy, data validation checks |
| **Launch delays** | Fallback: Start post-launch research with available data (≥70% online renters) |

---

## Deliverables

### 2026-03-25 (Pre-Launch)
- [ ] Analytics event schema & implementation plan
- [ ] Feedback widget configuration
- [ ] Interview recruitment template
- [ ] Community monitoring checklist

### 2026-03-26 (Launch Day)
- [ ] Analytics dashboard live
- [ ] Feedback widget active
- [ ] Community monitoring begin
- [ ] Phase 1 launch validation pass (DCP-773)

### 2026-04-02 (Report)
- [ ] **Post-Launch User Research Report** (5-8 pages)
  - Quantitative findings (funnel, usage, errors)
  - Qualitative findings (interviews, feedback themes)
  - Top 3 pain points + Top 3 opportunities
  - 5-7 actionable recommendations
  - Renter segmentation insights

---

## Related Issues

- **DCP-828:** Phase 1 recruitment decision (CLOSED — Plan D2 activated)
- **DCP-676:** Contingency plan (DEFERRED — Plan D2 activated)
- **DCP-773:** Phase 1 Day 4 testing (integration with post-launch research)
- **DCP-641:** Phase 1 deployment (marketplace launch)

---

**Document Owner:** UX Researcher
**Last Updated:** 2026-03-24 13:12 UTC
**Status:** ✅ READY FOR COORDINATION
