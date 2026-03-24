---
title: Phase 1 Design Notes for Testing Support
description: Critical design patterns, metrics, and observation frameworks for UX Researcher Phase 1 testing
date: 2026-03-24
author: UI/UX Specialist
status: ready_for_testing
---

# Phase 1 Design Notes for Testing Support

**Purpose:** Guide UX Researcher on what to observe, measure, and validate during Phase 1 testing (2026-03-25 to 2026-03-26)

---

## Section 1: Current Design State — What We Built

### Phase 1 Live Interfaces (April 2025 renter + provider flows)

1. **Renter Dashboard (Existing)**
   - Template catalog with search + VRAM filtering
   - Model catalog with Arabic detection + pricing
   - Cost tracking (job history, wallet balance, pricing breakdown)
   - One-click deployment flow (2-3 steps)

2. **Provider Onboarding (New in Sprint 27)**
   - Activation flow: Dashboard → 3-Step Wizard → Connected State
   - Key input validation with copy feedback
   - Success state with monitoring hints

3. **Pricing & Economics Display (New)**
   - DCP floor prices vs hyperscaler comparison (Vast.ai, RunPod, AWS)
   - Arabic model discovery + pricing anchors
   - Provider earnings calculator (6 GPU tiers)

### Design Principles Applied
- **Mobile-first:** All components < 640px responsive (Saudi user base 40% mobile)
- **RTL-ready:** CSS logical properties, Arabic text, SAR currency
- **WCAG AA compliant:** Contrast (4.5:1), touch targets (44x44px), focus visible
- **Fast:** < 2 sec load time target, model list lazy-loads on scroll

---

## Section 2: Critical Design Patterns to Validate

### Pattern 1: One-Click Deployment (Minimal Friction)
**What we designed:** 2-3 step flow (GPU pick → Config confirm → Launch)
**Why it matters:** Our biggest conversion blocker is abandonment at GPU selection
**What to watch:**
- [ ] Do renters understand the GPU options?
- [ ] Do they find the pricing comparison helpful?
- [ ] How long do they spend on GPU picker? (target: < 30 sec)
- [ ] What % complete the flow end-to-end? (target: > 75%)
- [ ] Do error messages (out of credits, quota exceeded) make sense?

**Observation cues:**
- Hesitation when GPU list loads (too many options?)
- Scrolling back to read pricing comparison multiple times
- Abandonment at "confirm" step (did they understand the cost?)
- Questions about why a GPU isn't available

---

### Pattern 2: Arabic Model Discovery (Differentiator)
**What we designed:** Featured Arabic models carousel + filtering by language
**Why it matters:** This is our 33% cost savings + PDPL compliance story
**What to watch:**
- [ ] Do renters notice the "Arabic" filter?
- [ ] Do they click through to Arabic model details?
- [ ] Do they understand the cost savings vs hyperscalers?
- [ ] Do non-Arabic-speaking renters try it? (expansion TAM)
- [ ] Arabic numerals vs English — which do they prefer?

**Observation cues:**
- "Why is this model cheaper?" (indicates they see the price)
- Scrolling through carousel but not selecting anything
- Confusion between "Arabic AI" and "Arabic language" labels
- Renters asking if they need Arabic knowledge to use Arabic models

---

### Pattern 3: Pricing Transparency (Trust)
**What we designed:** Side-by-side DCP vs Vast.ai/RunPod pricing
**Why it matters:** Renters need proof we're not arbitraging them
**What to watch:**
- [ ] Do they read the competitive pricing table?
- [ ] Do they trust the DCP price? (Or is it "too good to be true"?)
- [ ] Do they calculate ROI? ("If I save 40%, that's X months of free compute")
- [ ] Does the pricing breakdown (GPU cost + platform fee) make sense?

**Observation cues:**
- "Where do you get your prices from?" (trust signal missing)
- Renters comparing prices on their phones (switching to Vast.ai)
- "What's the catch?" questions
- Requests for annual discounts or volume pricing

---

### Pattern 4: Provider Onboarding Flow (Activation)
**What we designed:** 5-minute one-command setup (Dashboard → Wizard → Connected)
**Why it matters:** We have 43 registered providers but 0 active — flow must be effortless
**What to watch:**
- [ ] Do providers understand what each wizard step does?
- [ ] Do they successfully input their provider key?
- [ ] Do they understand the benchmark step?
- [ ] Do they complete the flow? (target: > 80%)
- [ ] What % call back for support? (target: < 10%)
- [ ] Time to activation: baseline for Sprint 27 measurement

**Observation cues:**
- Providers asking "Is this safe?" (security concern about keys)
- Confusion about which GPU types to benchmark
- Requests for documentation or tutorial videos
- Errors during registration (invalid keys, network timeouts)

---

## Section 3: Key UX Metrics to Measure

### Conversion Metrics (Primary)
| Metric | Target | How to Measure |
|--------|--------|---|
| **Renter Deployment Completion Rate** | > 75% | Sessions that reach "deploy success" / total sessions |
| **Provider Activation Rate** | > 80% | Providers completing wizard / total recruits |
| **Template Catalog CTR** | > 40% | Template clicks / total impressions |
| **Arabic Model Discovery** | > 30% | Renters filtering by "Arabic" / total renter sessions |

### Engagement Metrics (Secondary)
| Metric | Target | How to Measure |
|--------|--------|---|
| **Avg Time on GPU Picker** | < 30 sec | Time from modal open to selection |
| **Pricing Table Engagement** | > 50% | Users scrolling to see Vast.ai comparison |
| **Model Detail View Rate** | > 40% | Model clicks / total model impressions |
| **Provider Onboarding Time** | < 10 min | Time from wizard start to success screen |

### Satisfaction Metrics (Qualitative)
| Question | Target | Collection Method |
|----------|--------|---|
| "How likely are you to recommend DCP?" (NPS) | > 6/10 | Post-session survey |
| "Was the pricing clear?" | > 80% agree | Survey question |
| "Did you understand why this GPU?" | > 75% agree | Survey question |
| "Would you use this again?" | > 70% agree | Survey question |

---

## Section 4: Known Design Risks & Validation Targets

### Risk 1: Arabic Text Accuracy ⚠️ CRITICAL
**Issue:** Native Arabic speakers may spot grammar/translation errors
**Mitigation in Place:**
- Modern Standard Arabic (Fusha) used for universal clarity
- Translations verified against FOUNDER-STRATEGIC-BRIEF.md terminology
- RTL layout tested in Chrome + Safari

**What to Watch During Testing:**
- [ ] Any Arabic speaker feedback on language quality?
- [ ] Do Arabic numerals display correctly? (٠-٩ vs 0-9)
- [ ] Are prices in SAR format readable?
- [ ] Any pronunciation/transliteration feedback?

**Action if Issue Found:**
- Collect specific text + recommend fix
- May require iteration with Arabic language consultant

---

### Risk 2: RTL Layout Bugs on Mobile 🟡 MEDIUM
**Issue:** RTL + responsive can break on certain devices/browsers
**Mitigation in Place:**
- Tested on iOS Safari + Chrome + Samsung Galaxy
- CSS logical properties used (no hard right/left)
- Touch targets verified (44px minimum)

**What to Watch:**
- [ ] Do buttons align properly on Saudi user devices?
- [ ] Is the GPU picker readable on < 375px width?
- [ ] Any text overflow or clipping?
- [ ] Is the carousel usable on mobile?

**Action if Issue Found:**
- Screenshot + device info
- May require responsive breakpoint adjustment

---

### Risk 3: Cold Start Latency (Model Prefetch Dependency) 🟡 MEDIUM
**Issue:** First model deploy may be slow without prefetch
**Current State:** DCP-617 (prefetch) is NOT yet deployed to providers
**Testing Expectation:** First deploy ~15-30 sec (slower than ideal)

**What to Watch:**
- [ ] Do renters understand the initial wait?
- [ ] Do they abandon if it takes > 30 sec?
- [ ] Do they retry if initial deploy fails?
- [ ] Any timeout errors?

**Expected Outcome:** Baseline latency data for Phase 2 optimization

---

### Risk 4: Provider Key Input Validation 🟡 MEDIUM
**Issue:** Invalid/expired keys may confuse provider onboarding
**Mitigation:** Clear error messages + copy guidance

**What to Watch:**
- [ ] Do providers understand what a "valid key" looks like?
- [ ] Do error messages help them fix the problem?
- [ ] Do providers retry after error? (vs abandon)
- [ ] Any security questions about key submission?

---

### Risk 5: Pricing Trust (Too Good to Be True) 🔴 HIGH
**Issue:** 33-40% savings vs hyperscalers may trigger skepticism
**Mitigation:** Competitive pricing table + source attribution
**Critical Question:** Do renters believe the savings are real?

**What to Watch:**
- [ ] Questions about pricing sources?
- [ ] Any "This can't be real" feedback?
- [ ] Do they verify on Vast.ai site themselves?
- [ ] Do they ask for contracts/guarantees?
- [ ] Conversion impact: Do they deploy despite skepticism?

**This is a trust validation — success = they deploy anyway**

---

## Section 5: Session Facilitation Notes for UX Researcher

### Before Session
- [ ] Remind participant they're testing the product, NOT their ability
- [ ] Frame as "early version" so Arabic text/pricing is authentic but may evolve
- [ ] Show provider onboarding only to provider recruits (not renters)
- [ ] Show renter dashboard only to renter recruits

### During Session — Observation Framework

**Quiet Observations (Don't interrupt)**
- Note hesitations (where do they pause?)
- Note questions (what's unclear?)
- Note scrolling patterns (what's off-screen?)
- Note facial expressions (confusion, delight, frustration?)
- Time each major flow step

**Prompting (Only if stuck)**
- "What would you do next?" (gauge UX clarity)
- "How much would you pay for this GPU?" (pricing perception)
- "Would you feel safe connecting your provider key?" (trust)
- "In Arabic, would you say that differently?" (language feedback)

**Post-Task Questions**
- "What was the biggest friction point?"
- "What did you like most?"
- "Would you recommend this to [peer type]?"
- "What's missing for you to feel confident deploying?"

### After Session
- [ ] Categorize issues: Critical (blocks use) vs. Nice-to-have (polish)
- [ ] Note which personas had which problems (renter vs provider, Arabic vs English, mobile vs desktop)
- [ ] Prioritize by impact to conversion rate

---

## Section 6: Design Feedback Integration (Post-Testing)

### How Testing Insights Flow Back to Design

1. **Critical Issues** (during testing)
   - Reported immediately to me + Frontend Dev + CEO
   - May require hotfix before Phase 2 launch (low barrier)

2. **Medium Issues** (end of testing day)
   - Collected in GitHub issue with screenshots
   - Prioritized for Phase 2.1 iteration (post-launch sprint)

3. **Polish Issues** (end of Phase 1)
   - Compiled into design refinement doc
   - Scheduled for Phase 2.2 or Phase 3 roadmap

### I Will Provide Real-Time Support
- **2026-03-25 morning:** Design notes + observation templates
- **2026-03-25/26:** Available for live testing questions
- **2026-03-27:** Analyze findings + recommend design iterations
- **2026-03-28:** Prioritize fixes + document learning for Phase 2.2

---

## Section 7: Success Criteria for Phase 1

### Design Validation SUCCESS = All These Conditions Met
- [ ] > 70% of renters complete deployment (indicates flow clarity)
- [ ] > 60% interact with Arabic models (indicates discoverability)
- [ ] > 80% of providers complete activation (indicates simplicity)
- [ ] Positive feedback on pricing (indicates trust)
- [ ] Zero critical bugs block further testing (indicates quality)
- [ ] Insights for 3+ Phase 2.1 design iterations (indicates learning)

### Design Validation FAILURE = Any of These Conditions Found
- [ ] < 50% deployment completion (indicates core flow is broken)
- [ ] Repeated Arabic text complaints (indicates language issue)
- [ ] Providers unable to input keys (indicates security/UX mismatch)
- [ ] Skepticism about pricing = no deployments (indicates trust failure)
- [ ] Critical bugs prevent testing continuation

---

## Section 8: Phase 2 Design Ready & Waiting

### What's Ready to Build (Pending Phase 1 Validation)

**Phase 2.0: Quick-Redeploy Modal** (DCP-720)
- Status: Frontend Dev has implementation branch (9e4ccfa)
- Spec ready: `/docs/ux/phase2-quick-redeploy-ux-spec.md`
- Expected KPI: +25-30% repeat job rate

**Phase 2.2: Arabic Personalization** (DCP-707)
- Status: Spec merged to main
- Spec ready: `/docs/ux/phase2-arabic-personalization-ux-spec.md`
- Expected KPI: +40% Arab market acquisition

**Phase 2.1 Iterations** (pending Phase 1 insights)
- Improvements based on testing feedback
- Fast-track fixes for critical issues
- Polish for med-priority UX friction

---

## Summary for UX Researcher

**Your mission:** Validate that our design reduces friction and builds trust

**Key things to watch:**
1. Can renters complete deployment in < 5 min? (Yes = design works)
2. Do they discover Arabic models? (Yes = differentiation lands)
3. Do they believe the pricing? (Yes = trust is built)
4. Can providers activate in < 10 min? (Yes = onboarding is effortless)
5. What breaks or confuses them? (Insights for Phase 2)

**I'm here to support:**
- Real-time design clarifications during testing
- Analysis of findings + design implications
- Prioritization of iteration opportunities
- Integration of learnings into Phase 2 development

**Success metric:** We learn enough to improve Phase 2 designs + we validate the core flows work

---

**Prepared by:** UI/UX Specialist
**Date:** 2026-03-24 03:00 UTC
**Status:** READY FOR PHASE 1 EXECUTION
**Next Update:** Post-testing analysis (2026-03-27)
