# Phase 1 User Testing Protocol — Ready-to-Execute

**Document:** `docs/ux/phase1-user-testing-protocol.md`
**Author:** UX Researcher (DCP-653)
**Date:** 2026-03-23 16:00 UTC
**Status:** DRAFT — Ready to execute upon Phase 1 deployment signal
**Trigger:** Once DCP-669 resolved and Phase 1 goes live

---

## Executive Summary

This protocol defines a **5-8 participant user testing session** to validate Phase 1 renter journey with live marketplace. Tests will run **Day 1-3 post-launch** (parallel to Phase 1 monitoring).

**Success Criteria:**
- ✅ Browse-to-deploy CTR ≥ 15% (baseline; target 20% with fixes)
- ✅ Deploy completion rate ≥ 50%
- ✅ Arabic model discovery ≥ 3/5 users find ALLaM 7B in <60 seconds
- ✅ Zero critical UX blockers identified
- ✅ NPS ≥ 7/10

---

## Testing Scope

### In-Scope (Phase 1 Validation)
- ✅ Template catalog discovery (browse, filter, search)
- ✅ Renter journey: landing → signup → browse → deploy
- ✅ Arabic model visibility and discoverability
- ✅ One-click deploy flow (2-3 steps)
- ✅ Job monitoring (status, logs, cost tracking)
- ✅ Pricing transparency perception
- ✅ Trust/credibility signals
- ✅ Error handling and recovery

### Out-of-Scope (Phase 2+)
- ❌ Advanced features (scheduling, templates, comparison mode)
- ❌ Escrow/payment flows (not yet live)
- ❌ P2P network testing (Phase 4)
- ❌ Performance optimization (Phase 2)

---

## Participant Recruitment

### Target: 5-8 Participants Across 3 Personas

#### Persona A: Saudi Enterprise Buyer (2-3 participants)
**Profile:** Legal firm, government agency, or enterprise with Arabic compute needs
- **Recruitment:** LinkedIn, partner referrals, sales pipeline
- **Incentive:** $100 USDC + free $50 credit (if qualified for Phase 1 early access)
- **Screener:** "Do you work in legal, government, or financial services in KSA/MENA?"
- **Desired traits:** Familiar with AWS/cloud, interested in Arabic AI
- **Session prep:** Show DCP as "Arabic RAG marketplace" positioning

#### Persona B: Arabic NLP Startup Developer (2-3 participants)
**Profile:** Developer at AI startup, familiar with LLMs, Arabic-focused
- **Recruitment:** AI communities, Twitter/X, Telegram groups
- **Incentive:** $75 USDC + free $25 credit
- **Screener:** "Do you work with Arabic NLP or LLMs?"
- **Desired traits:** Technical depth, price-conscious, speed-focused
- **Session prep:** Show as "developer-friendly compute marketplace"

#### Persona C: Western ML Engineer (1-2 participants, for comparison)
**Profile:** ML engineer unfamiliar with Arabic market, price-conscious
- **Recruitment:** HackerNews, ML communities, Discord
- **Incentive:** $75 USDC + free $25 credit
- **Screener:** "Have you used Vast.ai or RunPod before?"
- **Desired traits:** Unbiased feedback on UX (not Arabic-focused)
- **Session prep:** Show as "cheaper alternative to Vast.ai"

**Recruitment Timeline:**
- Day 0 (Today): Create screener form (Typeform/Google Forms)
- Day 1: Email + social outreach
- Day 2: Confirm 5-8 participants, schedule sessions
- Day 3-4: Run testing sessions

---

## Testing Sessions (90 minutes each)

### Session Structure

**Part 1: Context & Warmup (10 minutes)**
- Brief intro to DCP + context
- Explain we're testing the UX, not the user
- Permission to think out loud, ask questions
- No judgment on decisions made

**Part 2: Cold-Start Discovery (15 minutes)**
- **Task:** "You're looking for a cheap way to run Arabic language models. Find a template on DCP and prepare to deploy it."
- **Unmoderated:** Let them explore without guidance
- **Observe:** Where do they click? Do they find Arabic models? Do they see pricing?
- **Notes:** Time to first template click, time to Arabic model discovery, filter usage

**Part 3: Template Evaluation (15 minutes)**
- **Task:** "Compare ALLaM 7B vs Falcon H1. Which would you deploy and why?"
- **Observe:** Do they see pricing comparison? Do they understand cold-start latency? GPU tier clarity?
- **Notes:** Decision time, confidence level, questions asked

**Part 4: Deploy Flow (20 minutes)**
- **Task:** "Deploy ALLaM 7B on an RTX 4090. Review the pricing and confirm deployment."
- **Observe:** Do they understand GPU tier selection? Pricing confirmation? Next steps?
- **Notes:** Completion time, errors encountered, success/failure rate
- **If blocked:** Ask clarifying questions ("What confused you here?")

**Part 5: Job Monitoring (10 minutes)**
- **Task:** "Your job is deploying. Check its status and explain what you see."
- **Observe:** Do they find status page? Understand job states? Find logs?
- **Notes:** Information clarity, confidence in job health

**Part 6: Follow-Up & Sentiment (10 minutes)**
- **Questions:**
  1. "How confident were you in the deployment?"
  2. "Did the pricing seem fair compared to Vast.ai/RunPod?"
  3. "Would you use DCP again?"
  4. "What would make this better?"
- **NPS:** "On a scale of 0-10, how likely are you to recommend DCP?"
- **Notes:** Verbatim feedback, suggestions

**Part 7: Debrief (10 minutes)**
- Ask about other platforms used (Vast.ai, RunPod, Lambda)
- Competitive context
- Thank participant, confirm payment/credit

---

## Success Metrics to Track

### Primary Metrics (Go/No-Go)

| Metric | Target | Method | Go Threshold |
|--------|--------|--------|--------------|
| **Browse-to-deploy CTR** | ≥15% | # deployed / # template clicks | ≥50% of users deploy |
| **Deploy completion rate** | ≥50% | # successful deploys / # started | ≥3/5 users complete |
| **Arabic discoverability** | <60s | Time to find ALLaM 7B | ≥60% (3/5 users) |
| **Pricing clarity** | 7+/10 | Post-session rating | ≥4/5 positive |
| **NPS** | ≥7/10 | "Recommend?" rating | ≥5/8 avg score |
| **Critical blockers** | 0 | UX-blocking errors | 0 identified |

### Secondary Metrics (Diagnostic)

| Metric | Target | Method |
|--------|--------|--------|
| **GPU tier clarity** | ≥7/10 | "Did you understand which GPU?" |
| **Cold-start transparency** | ≥6/10 | "Did you see how long first result takes?" |
| **Trust signals** | ≥7/10 | "Do you trust DCP with your compute?" |
| **Competitive positioning** | ≥7/10 | "Is DCP cheaper than Vast.ai?" |
| **Signup friction** | Time to signup | Minutes from landing to first browse |
| **Error recovery** | ≥80% | Did user recover from errors themselves? |

---

## Test Scenarios (Detailed)

### Scenario 1: Arabic Model Discovery (15 min)
**Goal:** Validate Arabic model visibility + discoverability target (<60 seconds)

**Setup:**
- Fresh signup (clean session)
- Land on `/marketplace/templates`
- No hints provided

**Success Criteria:**
- User finds ALLaM 7B or Falcon H1
- Time to discovery: <60 seconds
- User can articulate why it's Arabic-capable
- At least one filter used (Arabic, category, or search)

**If Fails:**
- Ask: "How would you find an Arabic model?"
- Observe: What's missing in UI?
- Note: Is filter unclear? Are badges not visible? Is search needed?

---

### Scenario 2: Pricing Comparison (10 min)
**Goal:** Validate pricing transparency impact on trust + conversion

**Setup:**
- Show ALLaM 7B card with pricing visible
- "How does DCP compare to Vast.ai?"

**Success Criteria:**
- User sees DCP price ($X/hr)
- User sees competitor price ($Y/hr)
- User calculates savings mentally or sees % displayed
- User confidence ≥7/10 that DCP is cheaper

**If Fails:**
- Ask: "Is this fair pricing?"
- Observe: Did they check elsewhere? Do they trust the comparison?
- Note: Does this affect deploy decision?

---

### Scenario 3: Deploy Flow Simplicity (20 min)
**Goal:** Validate 2-step deploy flow reduces friction from 4 steps

**Setup:**
- User clicks "Deploy" on ALLaM 7B
- No guidance provided

**Success Criteria:**
- User completes deploy in <3 steps
- User confirms price before deploying
- Deploy button is clear and high-confidence click
- Time to deployment: <5 minutes
- No questions about "what happens next"

**If Fails:**
- Ask: "What confused you?"
- Observe: Which step was unclear?
- Note: Button label? Step sequence? Default values?

---

### Scenario 4: Enterprise Persona - Trust Signals (10 min)
**Goal:** Validate Fatima (legal firm CTO) personas trust DCP with sensitive workloads

**Setup (Saudi enterprise buyer only):**
- Show homepage + key trust signals
- "You're processing confidential legal documents. Would you trust DCP?"

**Success Criteria:**
- User sees PDPL compliance messaging
- User understands data stays in-kingdom
- User confidence ≥7/10
- User would recommend to legal team

**If Fails:**
- Ask: "What would make you trust DCP?"
- Note: Is compliance messaging clear? Is data sovereignty obvious?

---

## Data Collection Template

For each participant, fill out:

```markdown
## Participant [#]: [Name / Alias]
**Persona:** [A / B / C]
**Date:** [Date]
**Session Duration:** [mins]

### Metrics
- Browse-to-deploy: ✅ / ❌
- Deploy completion: ✅ / ❌
- Arabic discovery: [Time in seconds] / ✅ <60s or ❌
- Pricing clarity: [1-10] / [Feedback]
- NPS: [0-10]
- Critical blockers: [List or "None"]

### Key Quotes
- "..." — [Context]
- "..." — [Context]

### Observations
- [Key behaviors observed]
- [Unexpected actions]
- [Emotions/confidence levels]

### Recommendations
- [What should be fixed]
- [What's working well]
```

---

## Analysis & Reporting (Day 4)

### Report Structure

**1. Executive Summary (1 page)**
- Key findings: 3-5 bullet points
- Go/No-Go recommendation
- Top 3 fixes

**2. Metrics Dashboard (1 page)**
- Table: All metrics vs targets
- Green/yellow/red indicators
- Notes on threshold hits/misses

**3. Detailed Findings (2-3 pages)**
- Section per scenario
- Success rates
- Common friction points
- Quotes from participants

**4. Recommendations by Priority**
- **Critical (fix before scaling):** Issues blocking >20% of users
- **High (fix in Sprint 28):** Issues blocking 10-20% of users
- **Medium (Phase 2):** Nice-to-haves, non-blocking improvements

**5. Appendix**
- Raw session notes
- Video/recording links (if consent given)
- Full participant quotes

---

## Contingency Plans

### If Phase 1 Deployment is Delayed (DCP-669 Pending)
- **Workaround:** Test on staging environment with simulated pricing
- **Trade-off:** Won't validate live renter decisions, but can test UX flow
- **Timeline:** Run after Phase 1 goes live regardless

### If Fewer Than 5 Participants Recruit
- **Minimum viable:** 3 participants (1 per persona)
- **Trade-off:** Lower confidence, less statistical power
- **Plan:** Extend to 8 participants in Phase 2 validation

### If Critical Blocker Found
- **Escalation:** Flag to Product Lead immediately (within 1 hour)
- **Decision:** Pause recruiting new renters OR hotfix immediately
- **Recommendation:** Hotfix if <2 hour estimate; otherwise pause scaling

---

## Execution Checklist

### Pre-Testing (Day 0-2)
- [ ] Create screener form (Typeform)
- [ ] Post recruitment (LinkedIn, communities, email)
- [ ] Confirm 5-8 participants
- [ ] Schedule sessions (back-to-back if possible)
- [ ] Prepare testing environment (staging or live with VPN)
- [ ] Test participant login flow
- [ ] Prepare incentive payments (USDC)
- [ ] Send pre-session brief to participants

### During Testing (Day 3-4)
- [ ] Run session per protocol (90 min each)
- [ ] Fill out data collection template after each session
- [ ] Note blockers in real-time
- [ ] Record video/audio (with consent)
- [ ] Take screenshots of key moments

### Post-Testing (Day 5)
- [ ] Compile session notes
- [ ] Score metrics for all participants
- [ ] Identify patterns (what % failed scenario X?)
- [ ] Create report (executive summary + findings)
- [ ] Present to Product Lead + QA Lead
- [ ] Create follow-up issues for fixes

---

## Participant Compensation

| Tier | Profile | USDC | DCP Credit | Notes |
|------|---------|------|-----------|-------|
| A | Enterprise | $100 | $50 | High-value feedback |
| B | Developer | $75 | $25 | Technical depth |
| C | ML Engineer | $75 | $25 | Baseline comparison |

**Payment:** Via Stripe/Coinbase same day or next business day

---

## References & Dependencies

- **Trigger:** DCP-669 resolution + Phase 1 deployment signal
- **Depends on:** Pricing correction (DCP-668/DCP-669)
- **Parent:** Phase 1 Launch Readiness Assessment
- **Related:** DCP-653 (my research), phase1-launch-readiness-assessment.md

---

## Next Steps

**Immediate (Upon Phase 1 Deployment):**
1. Launch screener form
2. Recruit participants
3. Schedule 5-8 sessions over 2 days
4. Run sessions per protocol

**Day 5:**
1. Compile findings
2. Create report
3. Present to Product Lead
4. Create follow-up issues for fixes

**Day 6+:**
1. Hotfix critical blockers
2. Monitor Phase 1 success metrics
3. Plan Phase 2 research

---

**Status:** Ready to execute upon Phase 1 deployment
**Awaiting:** DCP-669 resolution + Phase 1 go-live signal
**Owner:** UX Researcher (ready to run sessions)
**Support needed:** Product Lead (participant screening), QA (environment setup), Finance (incentive payments)
