# Phase 2 UX Roadmap — Advanced Features & Optimization

**Date:** 2026-03-23  
**Owner:** UI/UX Specialist  
**Status:** Planning (Pre-Phase 1 Launch)  
**Dependencies:** Phase 1 launch (DCP-524) + initial analytics data

---

## Overview

Phase 1 (Sprint 27) activates the template catalog and model marketplace. Phase 2 focuses on **deepening user engagement, reducing friction for power users, and optimizing for Arabic market.**

### Phase 1 → Phase 2 Transition
```
Phase 1: Template discovery + basic deployment
         ↓ (launch, gather analytics) ↓
Phase 2: Advanced scheduling, quick-redeploy, Arab personalization
         + Analytics-driven optimization
```

---

## Priority 1: Quick-Redeploy Feature (HIGH IMPACT)

**Problem:** Renters who complete jobs must manually reconfigure to redeploy. Low friction for repeat usage.

**Solution:** Add "Rerun with same settings" button on completed jobs.

**UX Spec:**
```
Completed Job Page
├─ Job Summary (existing)
├─ Results View (existing)
└─ [NEW] Quick Actions Bar
    ├─ [📋 View Logs]
    ├─ [💾 Save Config as Template]
    ├─ [⚡ Rerun Same Config]  ← AUTO-FILLS ALL PARAMS
    └─ [📊 View Cost Analysis]
```

**Flow:**
1. User completes job (LLM inference, training, etc.)
2. Click "⚡ Rerun Same Config"
3. Pre-fills: template, GPU tier, duration, all parameters
4. Takes to deploy confirmation (skip browse/config steps)
5. One-click submit → job starts

**Expected Impact:**
- Repeat job rate: +25-30% (typical for GPU marketplaces)
- Shortened time-to-redeploy: <30 seconds (vs 3-5 min manual)
- Higher utilization for providers
- Better customer LTV

**Effort:** Medium (1-2 days Frontend Developer)

---

## Priority 2: Advanced Job Scheduling (HIGH IMPACT)

**Problem:** Renters can't schedule jobs for later or set up recurring workloads. Loses batch processing revenue.

**Solution:** Job scheduler UI with cron-like scheduling.

**UX Spec:**
```
Deploy Flow - New Step: "Schedule Job"
├─ Run Now (existing)
├─ Schedule for Later
│  ├─ Date/Time Picker
│  ├─ Timezone selector
│  └─ [Schedule]
└─ Recurring Job
   ├─ Frequency: Daily / Weekly / Monthly
   ├─ Time picker
   ├─ End date (optional)
   └─ [Create Recurring Job]
```

**Use Cases:**
- Scheduled training runs (nightly fine-tuning)
- Batch inference (daily batch processing)
- Recurring reports (weekly analytics)
- Cost optimization (run during off-peak hours)

**Expected Impact:**
- Batch processing jobs: +40% (new revenue stream)
- Provider utilization: +20% (filling off-peak hours)
- Recurring revenue: New segment (monthly/yearly reserved capacity)

**Effort:** High (3-4 days Frontend + Backend API)

---

## Priority 3: Arabic Market Personalization (HIGH IMPACT)

**Problem:** Renters don't know about Arabic-native models. Non-Arab users see irrelevant templates.

**Solution:** Smart filtering & personalization based on Arabic capability preference.

**UX Changes:**

### 3a: Onboarding Flow (First-Time Users)
```
Marketplace Landing
├─ "What type of workload?"
│  ├─ [🌍 Arabic Models] ← NEW
│  ├─ [🤖 General AI]
│  ├─ [🎨 Image Generation]
│  └─ [📊 Data Processing]
└─ [Continue] → Pre-filters marketplace
```

### 3b: Quick-Switch Toggle
```
Marketplace Header
├─ [Search]
├─ [Filters]
└─ [🌍 Arabic Only] ← NEW TOGGLE
   └─ Shows only: ALLaM, JAIS, Falcon-H1, Qwen, etc.
```

### 3c: Arabic RAG Bundle (Enterprise)
```
Featured Tier: "Arabic RAG Complete"
├─ One-click deploy: BGE-M3 embeddings + reranker + ALLaM LLM
├─ Pricing: 2.09 SAR/1M ops (94% cheaper than OpenAI)
├─ Use case: Document processing, customer support
├─ Compliance: PDPL-compliant, in-kingdom
└─ [Deploy Now]
```

**Expected Impact:**
- Arab renter acquisition: +40% (from marketing + discovery)
- Arabic model CTR: +2-3x vs non-Arabic
- Enterprise deals: Arabic RAG bundle drives government/legal clients
- PDPL compliance positioning: Regulatory advantage

**Effort:** Medium (2-3 days Frontend)

---

## Priority 4: Post-Launch Analytics Dashboard (MEDIUM)

**Problem:** No visibility into user behavior, funnel drops, pricing sensitivity.

**Solution:** Renter analytics dashboard (internal use, informs optimization).

**Metrics Tracked:**

### Conversion Funnel
- Browse → Click Template (target: >25% of visitors)
- Template → GPU Selection (target: >80% proceed)
- GPU Selection → Deploy Confirmation (target: >60% confirm)
- Deploy Confirmation → Job Submitted (target: >90% submit)

### User Segments
- First-time users vs repeat
- Arabic vs non-Arabic renters
- Provider size (startup vs enterprise)
- Geography (Saudi, MENA, global)

### Revenue Metrics
- Average job cost (SAR)
- Repeat job rate (%)
- Customer LTV (lifetime value per renter)
- Provider utilization (%)

**UX:** Internal dashboard (not customer-facing)
- Graphs: Funnel charts, cohort analysis, segment breakdown
- Alerts: "Arabic model CTR dropped 15%" or "Deploy completion down"

**Data Sources:** Existing API events + new tracking events

**Expected Impact:**
- Identify optimization opportunities
- Detect pricing friction early
- Validate Phase 2 feature effectiveness
- Investor-ready metrics for seed round

**Effort:** Medium (2 days Frontend/Analytics setup)

---

## Priority 5: Performance Optimization (MEDIUM)

**Problem:** Template loading slow on 2G mobile, competitive benchmark page sluggish.

**Solution:** Caching, code splitting, image optimization.

**UX Changes:**
- Faster template card rendering (< 1s first paint)
- Instant filter responses (< 100ms)
- Lazy-load pricing comparisons (load-on-scroll)
- Mobile-optimized pricing charts (lightweight SVG)

**Metrics:**
- Lighthouse Performance: Target 90+ (current: ~75)
- First Contentful Paint (FCP): Target < 1.5s (current: ~2s)
- Time to Interactive (TTI): Target < 3s (current: ~4-5s)

**Expected Impact:**
- Mobile renter conversion: +15% (faster pages → less bounce)
- Provider satisfaction: Snappier provider dashboard
- SEO: Better ranking from Lighthouse score

**Effort:** Low-Medium (1-2 days Frontend optimization)

---

## Phase 2 Implementation Roadmap (Sprint 28-29)

### Sprint 28 (Weeks 1-2)
1. **Quick-Redeploy Feature** (HIGH priority, medium effort) — 1-2 days
2. **Arabic Personalization** (onboarding + toggle) — 2-3 days
3. **Analytics Dashboard** (tracking + basic metrics) — 2 days
4. **Total Sprint 28:** ~7-9 days (1-2 week sprint)

### Sprint 29 (Weeks 3-4)
1. **Advanced Job Scheduling** (HIGH priority, high effort) — 3-4 days
2. **Performance Optimization** — 1-2 days
3. **Post-launch A/B testing prep** — 1 day
4. **Total Sprint 29:** ~5-7 days

---

## A/B Testing Opportunities (Post-Launch)

Once Phase 1 is live and we have initial analytics, test these hypotheses:

### Test 1: Pricing Message Variants
- **Variant A:** "9.0 SAR/hr" (price only)
- **Variant B:** "9.0 SAR/hr (50% vs Vast.ai)" (price + competitor)
- **Variant C:** "Save 2,500 SAR/year" (annual savings, anchoring bias)
- **Metric:** Template card CTR → deploy flow

### Test 2: Arabic Discovery Prominence
- **Variant A:** Arabic toggle (current)
- **Variant B:** Arabic as default filter (only show Arabic first)
- **Variant C:** Arabic featured section at top (carousel)
- **Metric:** Arab renter conversion rate + Arabic model CTR

### Test 3: Quick-Redeploy Visibility
- **Variant A:** Button in card (primary position)
- **Variant B:** Button in modal (secondary)
- **Metric:** Repeat job rate, time-to-redeploy

---

## Success Metrics (Phase 2)

**By end of Phase 2 (Month 2 of launch):**

| Metric | Phase 1 Target | Phase 2 Target | Method |
|--------|---|---|---|
| Template card CTR | >25% | >30% | GA4 event tracking |
| Deploy flow completion | >60% | >70% | Funnel analysis |
| Repeat job rate | — | >25% | Job history tracking |
| Arab renter % | >7% | >12% | Signup source tracking |
| Avg job cost (SAR) | ~50 | ~65 | Billing database |
| Provider utilization | ~50% | >60% | Job duration analysis |
| Mobile conversion | — | >15% improvement | Device-based cohort |

---

## Coordination Points

**UI/UX ↔ Frontend Developer:**
- Spec refinement for quick-redeploy, scheduling, analytics
- Mobile optimization collaboration

**UI/UX ↔ Backend Architect:**
- Scheduling API design (cron-like parameters)
- Analytics event schema

**UI/UX ↔ QA Engineer:**
- E2E tests for new features
- A/B test framework validation

**UI/UX ↔ Analytics:**
- Dashboard design + metric definitions
- A/B test power calculation

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Scheduling complexity | Implementation delay | Use simple first (daily/weekly), add cron later |
| Performance regression on mobile | Lower conversion | Measure Lighthouse before/after each feature |
| A/B test false positives | Wrong optimization direction | Use statistical significance (p<0.05, minimum N) |
| Arabic personalization alienates non-Arab users | Churn | Make Arabic toggle optional, default to all |

---

## References

- Phase 1 launch gate: DCP-524 (founder approval)
- Marketing assets: `/docs/BLOG-ARABIC-RAG-COMPETITIVE-ADVANTAGE.md`, etc.
- Financial projections: `/docs/finance/template-catalog-revenue-projection.md`
- Provider economics: `/docs/FOUNDER-STRATEGIC-BRIEF.md`

---

**Status:** Ready for CEO review and Sprint 28 planning  
**Next Step:** Await Phase 1 launch signal (DCP-524), then prioritize Phase 2 work
