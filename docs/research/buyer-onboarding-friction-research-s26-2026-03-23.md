# Buyer Onboarding Friction Research — Sign-up to First Job
**Document:** End-to-End Onboarding UX Validation
**Research Goal:** Identify and eliminate friction points in buyer signup → first job completion flow
**Owner:** UX Researcher
**Date:** 2026-03-23
**Target Sample:** 5-8 buyers (new to GPU rental)
**Duration:** 30-45 min per session
**Format:** Moderated remote usability testing (Zoom/Teams with screen sharing)

---

## Research Objectives

✓ Measure end-to-end task completion (signup → wallet setup → job submission → execution)
✓ Identify blockers preventing first job completion
✓ Validate authentication/signup UX (email, wallet, payment method)
✓ Test template selection mental model (how do users choose between Instant/Cached/On-demand?)
✓ Confirm job submission flow clarity (what inputs are required?)
✓ Measure time-to-first-job completion
✓ Identify copy/terminology that confuses users
✓ Success metric: 100% completion without external help

---

## Participant Recruitment

**Profile:**
- Age 18-55
- Interested in AI/ML but NEW to GPU rental marketplaces (no Vast.ai/RunPod experience)
- Technical comfort: moderate (comfortable with cloud platforms, API keys)
- Use case: LLM inference, image generation, or research
- Can allocate 45 min for session + screen sharing
- English-speaking (primary)

**Recruitment Strategy:**
- Discord AI communities (LLM, image generation channels)
- Reddit r/StableDiffusion, r/LocalLLaMA, r/MachineLearning
- Twitter/LinkedIn AI practitioners (new to compute rental)
- DCP early access waitlist (if exists)
- Referral from current users

**Incentive:**
- $20-25 Amazon gift card or USDC
- Free $50 credit on DCP for first job

---

## Session Structure (45 min)

### 1. Welcome & Context (5 min)

```
"Thank you for participating. Today we're testing a new GPU marketplace called DCP.
Your job is to go through the signup process and run your first job — thinking aloud
as you go. There are no right or wrong answers. If you get stuck, tell me rather than
giving up. I'm here to observe, not help (unless you're truly blocked)."

Recording: Video + screen + audio
Informed consent: Confirmed
Incentive: Mentioned ($20 gc + $50 credit)
```

### 2. Background (3 min)

- What GPU workloads are you interested in? (inference, training, image generation, etc.)
- Have you used any cloud compute services before? (AWS, Google Cloud, etc.)
- Any concerns about using a new GPU marketplace?

### 3. Signup Flow (10 min)

**Observation focus:** Where do users hesitate? What do they assume? What confuses them?

**Prompt:**
```
"Here's the DCP website. Your task is to sign up for an account and get ready
to submit your first job. Go at your own pace. Tell me what you're thinking as
you click through."
```

**Success metrics:**
- Account created within 5 min (or note where they got stuck)
- Email verified
- Wallet connected (if required)
- Payment method added (if required)
- Understand what they've accomplished

**Observation points:**
- Do they find the signup button?
- Do they understand required vs optional fields?
- Do they understand why they need to connect a wallet?
- Do they know what to do after email verification?
- Any confusion about terminology (escrow, deposit, credits, etc.)?

### 4. Template/Model Selection (8 min)

**Prompt:**
```
"Now you need to pick a model/template to run your first job. You want to do [their stated goal:
e.g., 'run Llama 3 for text completion']. Show me how you'd find and select that model."
```

**Success metrics:**
- Find relevant model within 2 min
- Understand VRAM requirement
- Understand tier (Instant vs Cached vs On-demand)
- Understand estimated cold-start time
- Make a selection

**Observation points:**
- Where do they look first for models?
- Do they read template descriptions?
- Do they understand the tier system?
- Do they compare templates side-by-side?
- Any confusion about VRAM, load time, pricing?

### 5. Job Configuration & Submission (12 min)

**Prompt:**
```
"Now set up your first job with that model. You'll provide a prompt/input,
select parameters if needed, and submit it. Take your time and tell me what
you're thinking."
```

**Success metrics:**
- Job configuration completed (model, input/prompt, parameters)
- Job submitted without errors
- Understand what happens next (queuing, execution, results)
- Time to submission: <3 min (ideal), <5 min (acceptable)

**Observation points:**
- Do they understand what inputs are required?
- Do they understand parameters (temperature, max tokens, etc.)?
- Do they know where to add their prompt/input?
- Do they understand job status/queuing?
- Do they know where to find results when job completes?
- Any confusion about pricing/cost display?

### 6. Post-Submission & Results (5 min)

**Prompt:**
```
"Your job has been submitted. Show me where you'd check on job status and
where you'd view the results when it completes."
```

**Success metrics:**
- Navigate to job history/status page
- Understand job status indicators
- Know where results appear
- Can repeat the flow for a second job

**Observation points:**
- Do they find the job results location?
- Do they understand status (running, completed, failed)?
- Do they know how to download/export results?
- Do they understand how pricing appears?

### 7. Free Exploration (3 min)

```
"Take a few minutes to explore. Are there any other areas of the platform
you'd expect to see or want to explore?"
```

**Note:** What features do they seek but can't find?

### 8. Wrap-Up (4 min)

**Quantitative:**
1. On a scale of 1-10, how easy was it to get your first job running? Why?
2. What was most confusing, if anything?
3. Would you use DCP again? (yes/no/maybe)
4. What would make the onboarding even smoother?

**Qualitative:**
5. Which step was hardest? (signup / template selection / job submission / other)
6. Was there any point where you almost gave up?
7. Compare to Vast.ai/RunPod if you've heard of them — how does DCP feel?

---

## Observation & Metrics

### Task Completion

| Task | Success Criteria | Ideal Time | Acceptable Time |
|------|-----------------|-----------|-----------------|
| Signup | Account created, verified, wallet/payment ready | <3 min | <5 min |
| Template selection | Model chosen, understood VRAM & tier | <2 min | <3 min |
| Job configuration | Job submitted, understood inputs & params | <3 min | <5 min |
| Results discovery | Found job status & results location | <1 min | <2 min |
| **Total first job** | Signup through results | <9 min | <15 min |

### Completion Rate & Blocker Analysis

**Ideal: 100% of users complete first job unassisted**

- If <80% complete: critical UX issue
- If 80-90% complete: high-priority friction
- If >90% complete with <15 min: launch-ready

### Friction Point Inventory

For each blockers observed:
- **Point:** Where user got stuck (e.g., "Couldn't find job results")
- **Severity:** Critical (blocks completion) / High (causes 2+ min delay) / Medium (<2 min delay)
- **Frequency:** How many users hit this? (1 of 8, 2 of 8, etc.)
- **Root cause:** Why did they get stuck? (unclear label, missing feature, confusing flow)
- **Recommended fix:** What would unblock this?

### Copy/UX Issues

Track language/terminology that confuses users:
- "Escrow" — do they understand it?
- "Tier" (Instant/Cached/On-demand) — clear concept?
- "Cold start" — do they understand the impact?
- "Deposit" vs "Credits" — are these clear?
- Other confusing terms?

---

## Analysis & Synthesis

### Success Criteria for Launch

**MUST HAVE before launch:**
- ✓ >90% of new users complete first job unassisted
- ✓ No critical blockers (stopping users)
- ✓ Average time-to-first-job <15 min
- ✓ Copy/terminology clarity >80% comprehension

**SHOULD HAVE before launch:**
- ✓ >80% complete within 10 min (ideal experience)
- ✓ All high-priority friction points have fixes
- ✓ Signup + template selection <5 min combined

**CAN IMPROVE POST-LAUNCH:**
- ✓ Advanced job parameters/options
- ✓ Saved job templates
- ✓ Batch job submission
- ✓ Mobile UX refinements

### Report Output

**Executive Summary:**
1. Overall completion rate
2. Average time to first job
3. Top 3 friction points
4. Go/no-go recommendation for launch

**Detailed Findings:**
1. Completion rates by stage (signup / template / submission / results)
2. Friction point inventory (severity, frequency, root cause)
3. Copy/terminology issues
4. Participant quotes/memorable moments

**Recommendations:**
1. Critical fixes required for launch
2. High-priority improvements (fix before/after launch)
3. Medium-priority enhancements (post-launch backlog)

---

## Research Timeline

**Phase 1: Setup** (2026-03-24 — 1 day)
- [ ] Recruit 5-8 participants
- [ ] Confirm session times (aim for 3-4 per day)
- [ ] Prepare test environment (staging/live)
- [ ] Create screening questions
- [ ] Consent form & recording setup

**Phase 2: Testing** (2026-03-25 to 2026-03-26 — 2 days)
- [ ] Run 5-8 moderated testing sessions
- [ ] Capture video + screen + notes
- [ ] Flag critical blockers immediately
- [ ] Track task completion in real-time

**Phase 3: Analysis** (2026-03-27 — 1 day)
- [ ] Synthesize completion rates
- [ ] Inventory all friction points
- [ ] Categorize by severity
- [ ] Generate issue list for engineering

**Phase 4: Delivery** (2026-03-28)
- [ ] Report findings to engineering
- [ ] Critical fixes prioritized
- [ ] Go/no-go assessment for launch

**Target Launch:** 2026-03-29 (pending critical fixes if needed)

---

## Contingencies

**If recruitment is slow:**
- Expand to broader AI community
- Run sessions with team members (bias warning)
- Conduct with fewer participants (minimum 3)

**If critical blocker is found:**
- Escalate immediately with recommended fix
- Can often be fixed within 1-2 hours
- Re-test with 1-2 participants post-fix

**If most users struggle with same step:**
- Design may need significant revision
- Consider alternate flow options
- May impact launch timeline

---

## Success Criteria for Research

✅ Test with diverse buyer personas (students, researchers, practitioners)
✅ Achieve >85% first-job completion unassisted
✅ Identify all critical blockers before launch
✅ Clear recommendations for UX improvements
✅ Go/no-go assessment by 2026-03-28
✅ Time-to-first-job baseline established

---

**Prepared by:** UX Researcher
**For:** Sprint 26 Phase 1 Launch
**Status:** Ready to Execute
**Next Step:** Recruit participants, schedule sessions for 2026-03-25+
