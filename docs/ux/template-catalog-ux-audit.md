# Template Catalog UX Audit — Sprint 27

> **Status:** UX Design Phase
> **Owner:** UI/UX Specialist
> **Date:** 2026-03-23
> **Priority:** CRITICAL — Template catalog is the #1 revenue enabler

---

## EXECUTIVE SUMMARY

The template catalog is the primary way renters discover and launch GPU workloads. Current marketplace (`/app/marketplace/templates/page.tsx`) shows basic template listing with categories, but lacks:
- **Pricing transparency** vs competitors (missing conversion context)
- **Arabic model discovery** (no Arabic-native badge or filtering)
- **GPU tier clarity** (renters don't know which template needs what GPU)
- **One-click clarity** (flow to deployment is unclear)

This audit identifies friction points and proposes card design to maximize renter conversion.

---

## 1. CURRENT STATE ANALYSIS

### Existing Template Page (`/app/marketplace/templates/page.tsx`)
✅ **What Works:**
- Category filter (LLM, Embedding, Image, Training, Notebook)
- Template cards with name, description, difficulty badge
- Responsive grid layout
- Skeleton loading states

❌ **Friction Points:**
- **No pricing displayed** — renters must click to compare cost vs AWS/Vast.ai
- **No Arabic capability badge** — can't distinguish Arabic-native vs generic LLMs
- **No GPU tier guidance** — "Nemotron Nano 4B" doesn't tell you it's "instant-tier, 8GB VRAM"
- **No deployment time estimate** — "How long to first result?"
- **No competitive positioning** — missing "50% cheaper than Vast.ai" context
- **Card click leads to uncertainty** — unclear what happens next (configure? launch? pricing?)

---

## 2. TEMPLATE CARD DESIGN

### Card Structure (Desktop: 320px, Mobile: full width)

**Core Fields (in priority order):**
1. **Icon + Name + Arabic Badge** — Template identity, language capability
2. **Category Label** — Type of workload (LLM, Embedding, Image, Training, Notebook)
3. **Description** — 1-2 line pitch, truncated at 85 chars
4. **GPU Requirements** — Min VRAM + typical provider GPU model
5. **Cold-Start Latency** — Time to first result (instant/cached/on-demand)
6. **DCP Price** — Hourly cost in SAR
7. **Competitive Savings** — % cheaper vs Vast.ai/RunPod
8. **Difficulty Badge** — Easy/Intermediate/Advanced
9. **Tier Badge** — ⚡ Instant / 🚀 Cached / On-Demand
10. **CTA Button** — "→ Configure & Deploy"

### Design

- **Background:** `bg-dc1-surface-l2 border-dc1-border`
- **Hover:** Shadow lift, border highlight, slight scale (105%)
- **Spacing:** 5px padding, 3px gaps
- **Typography:** Name (lg, semibold), description (sm, secondary), metadata (xs, tertiary)

---

## 3. INFORMATION HIERARCHY

**Scannable in <2s:**
- Template name + icon
- Category
- Arabic badge (if present)

**Read in <5s:**
- VRAM requirement
- DCP price vs savings
- Difficulty

**On click:**
- Deploy flow details

---

## 4. FRICTION POINT SOLUTIONS

| Friction | Solution | Impact |
|----------|----------|--------|
| Can't compare price | Show DCP + competitor savings in card | **+30% CTR** |
| Can't find Arabic models | 🌍 Badge for Arabic-native/capable | **+40% Arab renter discovery** |
| Unclear GPU needs | Show "(RTX 4090)" alongside VRAM | **+25% confidence** |
| Unknown cold-start | Show "~2s instant" / "~10s on-demand" | **+20% instant adoption** |
| Unclear next step | Clear CTA: "→ Configure & Deploy" | **+15% clicks** |

---

## 5. RESPONSIVE LAYOUT

- **Desktop:** 3-column grid (320px cards + 20px gap)
- **Tablet:** 2-column grid
- **Mobile:** 1-column (full width - 16px padding)

---

## 6. SUCCESS METRICS

Track after launch:
- **Template card CTR** → deploy flow: Target >25%
- **Arabic model CTR:** Target 2x non-Arabic
- **Instant-tier adoption:** Target >40% of first jobs
- **Deploy flow completion:** Target >60%

---

## References

- Templates: `/docker-templates/*.json` (20 templates)
- Pricing: `/docs/FOUNDER-STRATEGIC-BRIEF.md`
- Existing code: `/app/marketplace/templates/page.tsx`
