# Template Catalog UX Audit — Sprint 28 Implementation Review

**Issue:** DCP-791
**Date:** 2026-03-24
**Reviewer:** UI/UX Specialist
**Status:** Implementation Gaps Identified

---

## Executive Summary

The template catalog UI (`/app/marketplace/templates/page.tsx`) is **80% complete** and implements the DCP-665 design spec correctly. However, **3 critical UX gaps** remain that impact conversion:

1. **Missing cold-start latency indicators** — Users don't know deployment speed
2. **No "Get Started" checklist onboarding** — New renters don't know what to do next
3. **Missing provider capacity warnings** — "Out of stock" states not handled

These are high-impact fixes for Sprint 28. Estimated effort: **6-8 hours total**.

---

## Section 1: Current Implementation Strengths ✅

### What's Working Well

| Feature | Status | Example |
|---------|--------|---------|
| Competitive pricing display | ✅ Complete | "↓ 28% cheaper vs Vast.ai" |
| Arabic badge detection | ✅ Complete | "🌙 Arabic" badge on qualified templates |
| VRAM requirement display | ✅ Complete | "VRAM: 24 GB" with GPU tier estimation |
| Tier badge (Instant/Cached/On-Demand) | ✅ Complete | "⚡ Instant" / "🚀 Cached" labels |
| Difficulty badges | ✅ Complete | Easy / Intermediate / Advanced |
| Category filtering | ✅ Complete | LLM / Embedding / Image / Training / Notebook |
| Arabic model filtering | ✅ Complete | Toggle "🌙 Arabic only" |
| VRAM tier filtering | ✅ Complete | Filter by min VRAM (8GB, 16GB, 24GB, 40GB, 80GB) |
| Search functionality | ✅ Complete | Full-text search across name, description, tags |
| Mobile responsiveness | ✅ Complete | 3-col desktop → 2-col tablet → 1-col mobile |
| Hover effects & animations | ✅ Complete | Smooth border/shadow transitions on hover |
| Skeleton loading states | ✅ Complete | Pulse animation while fetching |

---

## Section 2: Critical UX Gaps (Ranked by Impact)

### 🔴 GAP 1: Missing Cold-Start Latency Indicators

**Impact:** HIGH | Affect: Instant-tier adoption (target: 40% of first jobs)
**Current:** None
**Ideal:** Show expected time-to-first-result for each template

**Problem:**
- Users see "⚡ Instant" tier badge but don't understand what "instant" means
- Renter thinks: "Does Instant mean 1 second? 10 seconds? 1 minute?"
- Without clarity, many default to cheaper On-Demand tier (worst UX)

**Solution:**
Add a latency display to each template card:

```
┌─────────────────────────────────────┐
│ Nemotron Nano 4B                    │
│ Tier badge: ⚡ Instant              │  ← Existing
│ Description: Small Arabic LLM...    │  ← Existing
│                                     │
│ SPECS:                              │  ← Existing
│ VRAM: 4GB | Type: inference         │  ← Existing
│                                     │
│ ↻ ~2s cold-start (pre-warmed)       │  ← NEW: Latency indicator
│                                     │
│ [Deploy Now]                        │  ← Existing
└─────────────────────────────────────┘
```

**Implementation:**
```typescript
// Add to DockerTemplate interface
interface DockerTemplate {
  // ... existing fields
  coldStartLatencyMs?: number;      // NEW: time to first token in ms
  warmedLatencyMs?: number;         // NEW: latency when cache hit
  preWarmed?: boolean;              // NEW: is pre-warmed on active provider
}

// In TemplateCard, add after specs row:
{template.coldStartLatencyMs && (
  <div className="flex items-center gap-2 text-xs text-dc1-text-secondary">
    <span>↻</span>
    <span>
      ~{template.coldStartLatencyMs / 1000}s
      {template.preWarmed ? 'cold-start (pre-warmed)' : 'cold-start'}
    </span>
  </div>
)}
```

**Acceptance Criteria:**
- [ ] Latency display visible on cards where `coldStartLatencyMs` exists
- [ ] Format: "~2s cold-start (pre-warmed)" or "~45s cold-start"
- [ ] Color: gray text (secondary), no badge needed
- [ ] Mobile: wraps naturally, doesn't break layout
- [ ] Data: `/api/dc1/templates` includes `coldStartLatencyMs` for each template

**Effort:** 2-3 hours (API schema update + frontend display)

---

### 🔴 GAP 2: No Post-Deploy Onboarding Checklist

**Impact:** MEDIUM | Affect: Renter success rate and retention
**Current:** "Deploy Now" button links directly to renter register → no next steps shown
**Ideal:** Brief 3-step checklist appears after deploy or in renter dashboard

**Problem:**
- Renter deploys template successfully
- Renter doesn't know what to do next (configure? monitor? scale?)
- Renter opens the job history page confused (no deployed jobs shown if UI isn't synced)
- High abandonment rate on first deployment

**Solution:**
Add a post-deploy onboarding modal or checklist sidebar:

```
┌──────────────────────────────────────┐
│ 🎉 Template Deployed                 │
│ ─────────────────────────────────────│
│                                      │
│ Your job is running. Here's what     │
│ to do next:                          │
│                                      │
│ ☐ 1. Monitor job status              │ ← Link to /renter/jobs
│ ☐ 2. Configure input (if needed)     │ ← Link to job details
│ ☐ 3. Scale to more GPUs              │ ← Link to dashboard
│ ☐ 4. Join our community              │ ← Link to Discord/Slack
│                                      │
│ [Explore Dashboard] [Close]          │
└──────────────────────────────────────┘
```

**Implementation:**
This requires integration with the renter registration flow. Two options:

**Option A (Quick):** Add success message to `/renter/register` after template deploy
- Show a 3-step checklist in toast or modal
- Effort: 1-2 hours
- Location: Triggered after API confirms deployment

**Option B (Comprehensive):** Add "Getting Started" sidebar to renter dashboard
- Show when renter has 0 completed jobs
- Effort: 3-4 hours
- Location: `/renter` dashboard

**Recommended:** Start with Option A, plan Option B for Sprint 29

**Acceptance Criteria:**
- [ ] After successful deploy, display modal/toast with 3 next steps
- [ ] Each step is clickable (links to relevant page or action)
- [ ] Modal dismissible with [X] or [Close] button
- [ ] Text is clear and action-oriented ("Monitor your job", not "View job")
- [ ] Works on mobile (doesn't overflow, touch targets ≥ 44px)

**Effort:** 1-2 hours (Option A) / 3-4 hours (Option B)

---

### 🔴 GAP 3: No "Out of Stock" / Capacity Warnings

**Impact:** MEDIUM-LOW | Affect: Trust & provider scalability messaging
**Current:** None
**Ideal:** Show when instant-tier capacity is exhausted or heavily loaded

**Problem:**
- Renter clicks "Deploy Now" on Instant-tier template
- Backend returns error: "No providers available for instant-tier H100"
- Renter thinks deployment failed (not that providers are full)
- Renter may try on-demand instead or abandon

**Solution:**
Add capacity indicator to each template card:

```
┌────────────────────────────────────────┐
│ Nemotron Nano 4B      ⚡ Instant        │
│ Description...                         │
│                                        │
│ VRAM: 4GB                              │
│ ↻ ~2s cold-start (pre-warmed)         │
│                                        │
│ 💚 2/3 providers online (66% capacity) │ ← NEW: Capacity indicator
│                                        │
│ [Deploy Now]                           │
└────────────────────────────────────────┘
```

**Color coding:**
- 🟢 Green: >50% capacity (normal)
- 🟡 Yellow: 20-50% capacity (getting busy)
- 🔴 Red: <20% capacity (nearly full, long wait)
- ⚪ Gray: 0% capacity (out of stock)

**Implementation:**
```typescript
// Add to DockerTemplate
interface DockerTemplate {
  // ... existing
  activeProvidersCount?: number;    // NEW: providers running this template
  totalProvidersForTemplate?: number; // NEW: total providers capable of running
}

// In TemplateCard:
const capacityPct = template.activeProvidersCount && template.totalProvidersForTemplate
  ? (template.activeProvidersCount / template.totalProvidersForTemplate) * 100
  : 100

const capacityColor =
  capacityPct === 0 ? 'text-dc1-text-muted' :
  capacityPct < 20 ? 'text-status-error' :
  capacityPct < 50 ? 'text-dc1-amber' :
  'text-status-success'

{template.activeProvidersCount !== undefined && (
  <div className={`flex items-center gap-1 text-xs ${capacityColor}`}>
    {capacityPct === 0 ? '⚪' : capacityPct < 20 ? '🔴' : capacityPct < 50 ? '🟡' : '💚'}
    <span>
      {template.activeProvidersCount}/{template.totalProvidersForTemplate}
      providers online ({capacityPct.toFixed(0)}% capacity)
    </span>
  </div>
)}
```

**Acceptance Criteria:**
- [ ] Capacity indicator displays on all cards with provider data
- [ ] Color updates based on capacity percentage
- [ ] Text is clear: "X/Y providers online (Z% capacity)"
- [ ] Out-of-stock state shows grayed-out deploy button or "Retry Later" message
- [ ] Tooltip on hover explains what capacity means
- [ ] Refreshes every 30-60 seconds to reflect real-time availability

**Effort:** 2-3 hours (API integration + display logic)

---

## Section 3: Medium-Priority Improvements

### 📋 Enhancement: Card Footer Actions (Deferred to Sprint 29)

**Current:** Only "Deploy Now" button
**Ideal:** Additional quick actions

```
┌────────────────────────────────┐
│ [Deploy Now]  [View Docs] [♥] │  ← Actions row
└────────────────────────────────┘
```

- "View Docs": Link to template documentation
- "♥" (Favorite): Add to saved templates (if dashboard supports it)

**Effort:** 3-4 hours | **Priority:** Low | **Sprint:** 29

---

### 📋 Enhancement: Template Comparison Mode (Deferred to Sprint 29)

**Current:** Can't compare two templates side-by-side
**Ideal:** Multi-select mode to compare specs

- Checkbox on each card to select
- "Compare X templates" button at bottom
- Side-by-side spec table (VRAM, price, latency, difficulty)

**Effort:** 4-5 hours | **Priority:** Low | **Sprint:** 29

---

## Section 4: Implementation Priority for Sprint 28

### 🎯 Must-Have (Critical Path)

| Gap | Effort | Owner | Timeline |
|-----|--------|-------|----------|
| **Gap 1: Latency Indicators** | 2-3h | Frontend Dev | Days 1-2 |
| **Gap 3: Capacity Warnings** | 2-3h | Frontend Dev + Backend | Days 2-3 |

**Total: 4-6 hours** — Can complete in 1 day if backend provides data

### 🔶 Should-Have (High Value)

| Gap | Effort | Owner | Timeline |
|-----|--------|-------|----------|
| **Gap 2: Post-Deploy Checklist (Option A)** | 1-2h | Frontend Dev | Day 2 (quick) |

**Total: 1-2 hours** — Quick win for renter onboarding

### 📋 Nice-to-Have (Defer to Sprint 29)

- Template comparison mode (4-5h)
- Favorite/saved templates (2-3h)
- View docs links (0.5h)

---

## Section 5: Backend Dependencies

### Data Required from API

**Update `GET /api/dc1/templates` response:**

```typescript
interface DockerTemplate {
  // Existing fields
  id: string
  name: string
  description: string
  // ... etc

  // NEW FIELDS FOR GAP 1 (Latency)
  coldStartLatencyMs?: number;      // e.g., 2000 for "~2s"
  warmedLatencyMs?: number;
  preWarmed?: boolean;

  // NEW FIELDS FOR GAP 3 (Capacity)
  activeProvidersCount?: number;    // providers serving this template online
  totalProvidersForTemplate?: number; // total capable providers
  lastCapacityUpdate?: string;      // ISO timestamp
}
```

**Effort:** 1-2 hours (backend engineer)

---

## Section 6: Testing Checklist

### Functional Testing
- [ ] Latency displays for instant-tier templates
- [ ] Latency does NOT display for templates without data (no errors)
- [ ] Capacity indicator updates every 30-60s
- [ ] Out-of-stock state prevents deploy (error message shown)
- [ ] Post-deploy checklist appears after successful registration
- [ ] All links in checklist work (navigate to correct pages)

### Responsive Testing
- [ ] Desktop (>1024px): 3-column grid, spacing correct
- [ ] Tablet (640-1024px): 2-column grid, readable
- [ ] Mobile (<640px): 1-column, buttons ≥ 44px tall
- [ ] Latency text doesn't overflow on mobile
- [ ] Capacity text doesn't overflow on mobile

### Accessibility Testing
- [ ] Focus visible on all buttons
- [ ] Tab navigation works (cycle through cards)
- [ ] Alt text on icons (aria-label)
- [ ] Color contrast ≥ 4.5:1 (WCAG AA)
- [ ] Tooltips on hover for capacity explanation

### Browser Testing
- [ ] Chrome latest
- [ ] Safari latest
- [ ] Firefox latest
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Section 7: Success Metrics

Track post-launch:

| Metric | Current | Target | Owner |
|--------|---------|--------|-------|
| Template card CTR (to deploy) | ? | >25% | Analytics |
| Instant-tier adoption rate | <20% | >40% | Backend metrics |
| Post-deploy checklist completion | N/A | >60% | Segment/Mixpanel |
| Out-of-stock bounce rate | N/A | <5% | Analytics |

---

## Section 8: Summary & Recommendation

### What's Perfect
The UI correctly implements 80% of the DCP-665 spec: pricing, Arabic detection, VRAM display, filters, all polished and responsive.

### What's Missing (3 Critical Gaps)
1. **Cold-start latency** — Users don't know deployment speed → confusion on tier choice
2. **Post-deploy guidance** — Users don't know next steps → abandonment
3. **Capacity visibility** — Users don't know provider availability → error surprises

### Recommended Action
**Implement Gaps 1 & 3 in Sprint 28** (4-6 hours) — high conversion impact
**Implement Gap 2 quick version** (1-2 hours) — high user success impact

**Total effort:** 5-8 hours | **Timeline:** 1-2 days
**Owners:** Frontend Developer (lead) + Backend Engineer (data)

**Estimated impact:**
- Latency indicators: +15-20% instant-tier adoption
- Capacity warnings: +10% trust / -5% error bounces
- Post-deploy checklist: +20% retention / +15% repeat jobs

---

**Prepared by:** UI/UX Specialist
**Date:** 2026-03-24
**Next Review:** After implementation (testing checklist validation)
