# SPRINT 27 — Template Catalog & Model Browsing UX Specs

> **Owner:** UI/UX Specialist
> **Status:** Ready for Frontend Implementation
> **Date:** 2026-03-25
> **Deadline:** Sprint 27 close

---

## EXECUTIVE SUMMARY

This document provides **implementation-ready UX specifications** for the template catalog and model browsing experience. Frontend Developer can implement with **zero ambiguity**.

### What We're Building
1. **Template Catalog Page** (`/marketplace/templates` or `/deploy`) — Browse 20+ templates with smart filtering
2. **Model Browsing Page** (`/models`) — Discover Arabic & multilingual models with competitive pricing
3. **Deployment Flow** — 3-4 step flow from template → first job in <2 minutes
4. **Mobile Experience** — Optimized for Saudi Arabia (mobile-first market)

### Success Metrics
- **Template page load:** <2s (Lighthouse)
- **Renter flow completion:** 60%+ (from template click → deploy)
- **Arabic model discoverability:** 70%+ of renters see Arabic models on first visit
- **Mobile usability:** Tap-friendly (48px minimum), <3 clicks to deploy

---

## 1. TEMPLATE CATALOG PAGE

### 1.1 Page Layout

**URL:** `/marketplace/templates` or `/deploy`

**Desktop Layout (1440px):**
```
┌─────────────────────────────────────────────────────────────┐
│ Header: "Template Catalog" | Search | Account | Balance     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌─────────────────────────────────────┐ │
│  │   Filters    │  │  Template Grid (4 columns)          │ │
│  │              │  │                                     │ │
│  │ [Search box] │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │              │  │  │Card 1│ │Card 2│ │Card 3│ │Card 4│ │
│  │ Category ▼   │  │  └──────┘ └──────┘ └──────┘ └──────┘ │
│  │ GPU VRAM ▼   │  │                                     │ │
│  │ Arabic ▼     │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │ Speed ▼      │  │  │Card 5│ │Card 6│ │Card 7│ │Card 8│ │
│  │              │  │  └──────┘ └──────┘ └──────┘ └──────┘ │
│  │ [Reset]      │  │                                     │ │
│  └──────────────┘  │  [Load More...] or pagination       │ │
│                    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Sidebar Width:** 260px
**Grid Columns:**
- Desktop (≥1440px): 4 columns
- Tablet (768-1440px): 3 columns
- Mobile (<768px): 1 column (full width)

---

### 1.2 Template Card Design

Each template card shows:

```
┌──────────────────────────────────────────┐
│ [🔤 Arabic Model] [⚡ Instant Tier]      │ ← Capability badges
├──────────────────────────────────────────┤
│                                          │
│ Nemotron Nano 4B                        │ ← Template name
│ Lightweight LLM for chat & text gen.     │ ← Description
│                                          │
│ 🏷 8GB VRAM | ⏱ Cold-start: 5s         │ ← Specs
│                                          │
├──────────────────────────────────────────┤
│ DCP Price                                │
│ 5.0 SAR/hr                               │ ← Primary pricing
│                                          │
│ vs Vast.ai: 7.5 SAR/hr (-33%)           │ ← Competitive pricing
│ Save ~22K SAR/year                       │ ← Value prop
│                                          │
├──────────────────────────────────────────┤
│ [→ Configure & Deploy]                   │ ← CTA button
└──────────────────────────────────────────┘
```

**Card Sections (Top to Bottom):**

1. **Badges** (top-right)
   - `[🔤 Arabic Model]` — if template includes Arabic models
   - `[⚡ Instant]` / `[🚀 Cached]` / `[⏱ On-Demand]` — deployment speed tier
   - Colors: `bg-accent-primary/10`, `text-accent-primary`

2. **Template Info**
   - **Name:** `font-bold text-lg text-primary`
   - **Description:** `text-sm text-secondary` (1-2 lines max)
   - **Icon/Image:** Optional hero icon (40×40px, top-left of card)

3. **Specs Row**
   - Format: `[icon] Value | [icon] Value`
   - Examples: `🏷 8GB | ⏱ 5s cold-start | 💰 5.0 SAR/hr`
   - Typography: `text-xs text-tertiary`

4. **Pricing Box**
   - Background: `gradient(135deg, primary/5, primary/10)`
   - Border: `1px solid primary/20`
   - Padding: `16px 12px`
   - **DCP Price:** `text-2xl font-bold text-primary`
   - **Competitor prices:** `text-sm text-secondary`, savings in `text-success-green`
   - **Annual value:** `text-xs italic text-tertiary`
   - Show competitor prices **only if** DCP is 10%+ cheaper

5. **CTA Button**
   - Style: `btn-primary-lg`
   - Text: `→ Configure & Deploy`
   - Width: Full width
   - Hover: Slight scale, shadow increase
   - Disabled state: Gray, cursor-not-allowed (if no providers available)

**Card Hover State:**
- Shadow increase: `box-shadow: 0 8px 24px rgba(0,0,0,0.12)`
- Slight scale: `transform: scale(1.02)`
- Transition: 200ms ease

---

### 1.3 Filter Panel

**Location:** Left sidebar (desktop) or modal (mobile)

**Filter Groups:**

#### Search Box
- Fuzzy match on: template name, description, model name, tags
- Placeholder: "Search templates..."
- Debounce: 300ms
- Results: Case-insensitive, typo-tolerant
- Examples:
  - "qwen" → Qwen 2.5 7B
  - "embedding" → Arabic Embeddings API
  - "instant" → All instant-tier templates

#### Category (Collapsible)
```
☑ All Templates (20)
☐ LLM / Inference (8)
☐ Embeddings & RAG (3)
☐ Image Generation (2)
☐ Training & Fine-tune (4)
☐ Notebooks & Dev (3)
```
- Checkbox style
- Show count per category
- "All Templates" selected by default

#### GPU VRAM (Collapsible)
```
☐ 8 GB (RTX 4090/4080)
☐ 16 GB (RTX 4090)
☐ 24 GB (RTX 4090)
☐ 40+ GB (A100/H100)
```
- Multiple selection allowed
- Hint: "What GPU do you have?"

#### Arabic Capability (Collapsible)
```
☐ Arabic-native (5)
☐ Arabic-capable (4)
☐ All languages (20)
```
- Radio buttons (single select, or allow multi)
- Default: "All languages"

#### Deployment Speed (Collapsible)
```
☐ Instant (⚡, 0-2s)
☐ Cached (🚀, 2-10s)
☐ On-Demand (⏱, 10s+)
```
- Checkboxes
- Show icon + time range

**Filter State:**
- URL params: `?category=llm&vram=8&arabic=native&speed=instant`
- Browser back button restores state
- Shareable links preserve filters

**Empty State:**
```
No templates match your filters.

[Clear filters] to see all available templates.
```

---

### 1.4 Template Grid & Pagination

**Desktop:**
- 4 columns by default
- 24px gap between cards
- Responsive: Reduce to 3 cols at 1200px, 2 cols at 900px
- Total templates visible: 8 cards per page (2 rows × 4 cols)

**Pagination:**
- Show 8 cards per page
- Options: "Load More" button or numbered pagination
- Recommended: "Load More" for mobile (easier)

**Loading State:**
- Skeleton cards (8 count) with shimmer animation
- Fade-in when loaded
- Max 500ms skeleton duration

**Result Counter:**
```
Showing 8 of 20 templates
Showing all 20 templates (when no filters)
```
- Position: Above grid, left-aligned

---

## 2. MODEL BROWSING PAGE

### 2.1 Page Layout

**URL:** `/models`

**Desktop Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Header: "Model Marketplace" | Search | Account | Balance    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Tabs: [All Models] [Arabic Models] [Multilingual]          │
│                                                             │
│ ┌──────────────┐  ┌─────────────────────────────────────┐ │
│  │   Filters   │  │  Model Table / Cards (3 columns)    │ │
│  │             │  │                                     │ │
│  │ [Search]    │  │  ┌──────┐ ┌──────┐ ┌──────┐        │ │
│  │             │  │  │Model1│ │Model2│ │Model3│        │ │
│  │ Provider ▼  │  │  └──────┘ └──────┘ └──────┘        │ │
│  │ VRAM ▼      │  │                                     │ │
│  │ Speed ▼     │  │  ┌──────┐ ┌──────┐ ┌──────┐        │ │
│  │ Language ▼  │  │  │Model4│ │Model5│ │Model6│        │ │
│  │             │  │  └──────┘ └──────┘ └──────┘        │ │
│  │ [Reset]     │  │                                     │ │
│  └──────────────┘  └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Model Card Design

```
┌──────────────────────────────────────┐
│ ALLaM 7B                            │ ← Model name
│ [🇸🇦 Arabic] [📊 Foundation Model] │ ← Badges
├──────────────────────────────────────┤
│                                      │
│ Arabic LLM optimized for legal docs  │ ← Description
│ VRAM: 16GB | Context: 4K             │ ← Specs
│                                      │
├──────────────────────────────────────┤
│ DCP: 6.5 SAR/hr                      │
│ Vast.ai: 8.2 SAR/hr (-21%)          │ ← Savings highlight
│ Save ~13K SAR/year                   │
│                                      │
├──────────────────────────────────────┤
│ [→ Deploy on DCP]                    │ ← CTA
└──────────────────────────────────────┘
```

**Sections:**

1. **Header**
   - Model name (bold, primary color)
   - Region badge: `[🇸🇦 Arabic]` / `[🌍 Multilingual]` / `[🇬🇧 English]`
   - Model type badge: `[🗣 LLM]` / `[🔍 Embedding]` / `[🎨 Image Gen]` / `[📊 Foundation]`

2. **Description & Specs**
   - 1-2 line description
   - Inline specs: `VRAM: 16GB | Context: 4K | License: MIT`

3. **Pricing Section**
   - Same design as template cards
   - Show DCP price prominent, competitor prices below
   - Green highlight for savings %

4. **CTA Button**
   - Text: `→ Deploy on DCP`
   - Links to template list filtered by this model (or direct deploy flow if template exists)

### 2.3 Model Tabs

**Tabs (Desktop):**
```
[All Models] [Arabic Models] [Multilingual] [Popular This Week]
```

- **All Models:** All 11+ models
- **Arabic Models:** Filter by `region: 'arabic'` (ALLaM, JAIS, Qwen Arabic, Falcon H1)
- **Multilingual:** Filter by supports 3+ languages
- **Popular This Week:** Sort by recent deployments (future)

**Default Tab:** "Arabic Models" (for Saudi market positioning)

### 2.4 Model Filters

Similar to template filters, but tuned for models:

- **Language:** Arabic, Multilingual, English-only
- **VRAM:** 8GB, 16GB, 24GB, 40GB+
- **Model Type:** LLM, Embedding, Image Gen, Training
- **License:** Open-source, Commercial, Academic

---

## 3. DEPLOYMENT FLOW

### 3.1 Flow Overview

```
Template Card Click
    ↓
┌─ Step 1: GPU Tier Selector ─────────┐ ← CONDITIONAL
│ "Which GPU?"                         │
│ ☐ 8GB RTX 4090  (5.0 SAR/hr)        │
│ ☐ 24GB RTX 4090 (9.0 SAR/hr)       │
│ [Cancel] [Next]                      │
└─────────────────────┬────────────────┘
                      ↓ (or skip if single GPU)
┌─ Step 2: Configure Parameters ──────┐ ← OPTIONAL
│ Model: Nemotron Mini 4B              │
│ Duration: [30 minutes ▼]             │
│ Batch Size: [32 ▼] (optional)       │
│ Temperature: [0.7 ▼] (optional)     │
│ [Back] [Review & Deploy]             │
└─────────────────────┬────────────────┘
                      ↓ (or skip if no params)
┌─ Step 3: Confirm & Deploy ──────────┐ ← REQUIRED
│ "Ready to deploy?"                   │
│                                      │
│ Template: Nemotron Nano 4B          │
│ GPU: 8GB RTX 4090 (5.0 SAR/hr)      │
│ Duration: 30 min                    │
│ Cost: 2.5 SAR                       │ ← Clear pricing
│ Balance: 15.0 SAR ✓                 │
│                                      │
│ [Back] [✓ Deploy Now]                │
└─────────────────────┬────────────────┘
                      ↓
┌─ Step 4: Status Page ───────────────┐ ← CONFIRMATION
│ "✅ Job submitted!"                  │
│                                      │
│ Job ID: dcp-xyz-123                 │
│ Status: Allocating GPU...           │
│ Est. Ready: 30 seconds              │
│                                      │
│ [View Job] [Deploy Another]          │
└──────────────────────────────────────┘
```

### 3.2 Step Details

#### Step 1: GPU Tier Selection (Conditional)

**When to show:**
- Template supports multiple GPU tiers
- Examples: Llama 3, vLLM, training templates

**When to skip:**
- Template is GPU-specific (Nemotron Nano → 8GB only)

**UI:**
- Radio buttons (show all options at once, not dropdown)
- Price/hour for each option
- Cold-start latency estimate
- Provider availability badge

**Default Selection:**
- Pre-select cheapest tier meeting min_vram_gb
- Show performance tradeoff (speed vs cost)

**Example:**
```
Select GPU for Llama 3 8B:

○ 8GB RTX 4080
  5.0 SAR/hr | Cold-start: 8s | 12 providers online

● 24GB RTX 4090 (Recommended)
  8.5 SAR/hr | Cold-start: 3s | 28 providers online

○ 40GB A100
  18.0 SAR/hr | Cold-start: 1s | 3 providers online
```

#### Step 2: Configure Parameters (Optional)

**When to show:**
- LLM inference: max_tokens, temperature, top_p
- Training: batch_size, learning_rate, epochs
- Image gen: num_steps, guidance_scale

**When to skip:**
- Notebooks, embeddings, Ollama (no meaningful params)

**UI:**
- Sliders for numeric params (not text input)
- Dropdowns for categorical params
- Tooltips on hover ("What's temperature?")
- "Reset to defaults" link
- Descriptions of each param

**Example:**
```
Deployment Parameters

Model: Nemotron Mini 4B

Duration: [30 ▼] minutes
  "How long should the job run?"

Max Tokens: [●────────────────] 2048
  "Maximum output length"

Temperature: [────●───────────] 0.7
  "Randomness (0=deterministic, 1=creative)"

Top-P: [────────────●────────] 0.9
  "Diversity (lower = more focused)"

[Reset to defaults] [Review & Deploy]
```

#### Step 3: Review & Confirm (Required)

**Show:**
- Template name + icon
- Selected GPU + price/hr
- Duration (minutes)
- **Estimated total cost:** `price_per_hour * duration_minutes / 60`
- Renter balance + insufficient funds warning (if applicable)
- Terms checkbox (if required): "I agree to the terms"

**UI:**
```
Ready to deploy?

┌──────────────────────────────────────┐
│ Nemotron Nano 4B                     │
│ 8GB RTX 4090 | 30 minutes            │
│                                      │
│ Estimated Cost: 2.5 SAR              │
│ Your Balance: 15.0 SAR ✓             │
│                                      │
│ ☐ I agree to the terms & conditions │
│                                      │
│ [Back] [✓ Deploy Now]                │
└──────────────────────────────────────┘
```

#### Step 4: Status Page (Post-Deploy)

**Show immediately after deploy:**
- Job ID (copyable)
- Status: "Allocating GPU..."
- Estimated time to ready: "Usually <30s..."
- Progress timeline:
  - Allocating GPU → Building Image → Running → Complete
- Indeterminate progress bar (until job starts)
- Links: View detailed logs, Download results, Stop job

**UI:**
```
✅ Deployment submitted!

Job ID: dcp-xyz-123 [Copy]
Template: Nemotron Nano 4B
Status: Allocating GPU...
Est. Ready: 30 seconds

Progress: [████░░░░░░░░░░░░░░░░] Allocating...

When ready, you'll get:
- Live endpoint (REST API)
- Logs for debugging
- Result files (if applicable)

[View Job] [Deploy Another] [× Close]
```

### 3.3 Error States

#### Insufficient Balance
```
❌ Insufficient Balance

Your account: 1.0 SAR
This job costs: 2.5 SAR
Shortfall: 1.5 SAR

[→ Add Funds] [Cancel]
```

#### GPU Unavailable
```
❌ GPU Temporarily Unavailable

8GB RTX 4090 is fully booked.

Options:
[Try 24GB RTX 4090] [Try 16GB RTX 4080] [Wait 5 min]
```

#### Network Error
```
⚠ Deployment Failed

Connection error: unable to reach provider.

[Retry] [Cancel]
```

### 3.4 Loading States

**While Allocating GPU:**
```
Allocating GPU from provider pool...

[spinner]

Usually takes <30 seconds...

[Cancel Job]
```

**While Building Image:**
```
Building Docker container...

[████░░░░░░░░░░░░░░] 30%
Pulling model weights... 25%
```

### 3.5 Mobile Deployment Flow

**Adjustments for small screens:**
- Full-screen modal instead of new page
- Each step in a tab-based interface (swipe between)
- Number input with +/- buttons for duration (larger touch targets)
- Buttons: full-width, 48px minimum height
- Back button: Always visible (top-left)
- Disable body scroll while modal open

---

## 4. MOBILE RESPONSIVENESS

### 4.1 Breakpoints & Layout Shifts

| Device | Width | Layout | Key Changes |
|--------|-------|--------|-------------|
| Mobile | <768px | Single column | 1 card/row, full-width filter modal, stacked layout |
| Tablet | 768-1200px | 2-3 column | 2-3 cards/row, sidebar filter panel |
| Desktop | ≥1200px | 4-column | Full layout |

### 4.2 Mobile Template Catalog

**Header:**
- Sticky, compact
- Logo + title (small)
- Search icon (expands to full-width search)
- Account icon (right)

**Filter Button:**
- Top-right, sticky
- Badge showing active filter count (e.g., "Filters (2)")
- Tap to open full-screen modal

**Template Grid:**
- Single column, full-width cards
- 16px padding left/right
- 12px gap between cards

**Pagination:**
- "Load More" button (easier than pagination for mobile)
- Positioned below grid

### 4.3 Mobile Model Browsing

Same layout as template catalog, but with model cards.

### 4.4 Mobile Deploy Flow

- **Step 1-3:** Tab-based interface (can swipe between steps)
- **Duration input:** Number spinner with +/- buttons (not text input)
- **Buttons:** Full-width, 48px tall minimum (easy tap targets)
- **Back button:** Top-left, always visible
- **Keyboard:** Dismiss keyboard after input (auto-hide)

### 4.5 Touch Targets & Spacing

- **Minimum touch target:** 48px × 48px
- **Button padding:** 16px horizontal, 12px vertical
- **Checkbox size:** 24px × 24px
- **Slider track:** 6px height, 32px tap area (larger)

### 4.6 Orientation Handling

- Landscape mode: Adjust grid to 3 columns
- Prevent layout jank on orientation change
- Maintain scroll position on rotate (if possible)

---

## 5. INTERNATIONALIZATION & LOCALIZATION

### 5.1 Arabic (RTL) Support

**Languages supported:**
- English (default)
- Arabic (RTL)

**Layout Mirroring:**
- All flexbox layouts auto-flip for RTL (CSS: `direction: rtl`)
- Left sidebar becomes right sidebar
- Text alignment auto-mirrors
- Icons with directional meaning (arrows) get flipped

**Testing:**
- Test all filters, cards, buttons in both LTR and RTL
- Ensure badge positioning is correct (top-left for LTR, top-right for RTL)
- Test at 320px, 768px, 1440px widths in both directions

### 5.2 Arabic Content

**Model names & descriptions:** Show in Arabic and English
- Header: Arabic name | English name
- Description: Provide both (Arabic preferred, English fallback)

**Currency:** SAR (Saudi Riyal)
- Format: "5.0 SAR" or "٥٫٠ ر.س"
- Symbol placement: Follow Arabic number format standards

---

## 6. DESIGN TOKENS & COMPONENT LIBRARY

### 6.1 Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#0066CC` | Primary CTAs, pricing highlight, active states |
| `secondary` | `#666666` | Secondary text, disabled states |
| `success` | `#00AA33` | Savings %, success badges, checkmarks |
| `warning` | `#FF9900` | Warnings, insufficient balance |
| `error` | `#CC0000` | Errors, unavailable states |
| `background` | `#FFFFFF` | Card, page background |
| `border` | `#E0E0E0` | Borders, separators |

### 6.2 Typography

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| H1 | System | 32px | Bold | 1.2 |
| H2 | System | 24px | Bold | 1.3 |
| Card Title | System | 18px | Bold | 1.4 |
| Body | System | 14px | Regular | 1.5 |
| Small | System | 12px | Regular | 1.4 |
| Micro | System | 11px | Regular | 1.3 |

### 6.3 Spacing

- **Grid:** 8px base unit
- **Card padding:** 16px
- **Gap between cards:** 24px (desktop), 16px (mobile)
- **Section margin:** 32px (desktop), 24px (mobile)

### 6.4 Border Radius

- **Cards:** 8px
- **Buttons:** 6px
- **Inputs:** 6px
- **Pills (badges):** 16px

### 6.5 Shadows

- **Card default:** `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`
- **Card hover:** `box-shadow: 0 8px 24px rgba(0,0,0,0.12)`
- **Modal:** `box-shadow: 0 20px 60px rgba(0,0,0,0.3)`

---

## 7. COMPONENT SPEC SUMMARY

### 7.1 Template Card Component

**Props:**
```tsx
interface TemplateCard {
  id: string
  name: string
  description: string
  icon?: ReactNode
  vram_gb: number
  cold_start_seconds: number
  deployment_tier: 'instant' | 'cached' | 'on_demand'
  is_arabic: boolean
  dcp_price_sar: number
  competitor_prices?: {
    vast_ai?: number
    runpod?: number
    aws?: number
  }
  provider_count: number
  on_deploy: () => void
}
```

**Sub-components:**
- `CardBadges` — Arabic, speed tier badges
- `CardSpecs` — VRAM, cold-start, price row
- `PricingBox` — DCP + competitor pricing
- `CTAButton` — Deploy button

### 7.2 FilterPanel Component

**Props:**
```tsx
interface FilterPanel {
  filters: {
    search: string
    categories: string[]
    vrams: number[]
    arabic_capability: 'all' | 'native' | 'capable'
    speed_tiers: ('instant' | 'cached' | 'on_demand')[]
  }
  on_change: (filters) => void
  result_count: number
}
```

### 7.3 DeployFlow Component

**Props:**
```tsx
interface DeployFlow {
  template_id: string
  onComplete: (job_id: string) => void
  onCancel: () => void
}
```

**State:**
- Current step (1-4)
- Selected GPU tier
- Configured parameters
- Job ID (on success)

---

## 8. SUCCESS METRICS & ANALYTICS

### 8.1 Template Catalog Analytics

Track:
- **Page views:** Total catalog visits
- **Filter usage:** Which filters most common
- **Search queries:** Top searches, no-result searches
- **Card CTR:** Which templates get clicks
- **Deploy flow completion:** % who reach final confirmation

### 8.2 Model Browsing Analytics

Track:
- **Tab usage:** Which tabs (All, Arabic, Multilingual) most popular
- **Arabic model views:** % of renters who view Arabic models
- **Model detail depth:** Do renters click model details or straight to deploy?

### 8.3 Deploy Flow Analytics

Track:
- **Flow entry:** % of card clicks that enter flow
- **Step drop-off:** % who abandon at each step
- **Completion rate:** % who complete (goal: 60%+)
- **Time-to-deploy:** Median time from card click to job submit
- **Error frequency:** Which errors most common

### 8.4 Mobile Analytics

Track:
- **Mobile vs desktop conversion:** Are mobile users converting at same rate?
- **Filter modal usage:** Do mobile users open/use filters?
- **Scroll depth:** Do mobile users scroll to load more, or bounce?

---

## 9. IMPLEMENTATION CHECKLIST

For Frontend Developer:

- [ ] Create TemplateCard component (props, styles, responsive)
- [ ] Create FilterPanel component (search, checkboxes, collapsibles)
- [ ] Create TemplateGrid component (4-col layout, load more, responsive)
- [ ] Integrate template catalog page (`/marketplace/templates`)
  - [ ] Load templates from `/api/models`
  - [ ] Implement filter logic (AND combination)
  - [ ] URL state management (filters in query params)
- [ ] Create ModelCard component
- [ ] Create ModelBrowsing page (`/models`) with tabs
- [ ] Create DeployFlow component (4 steps, state management)
- [ ] Integrate deploy flow (launch modal on CTA click)
- [ ] Mobile responsiveness (test at 320px, 768px, 1440px)
- [ ] Arabic (RTL) support (test all flows in Arabic)
- [ ] Analytics integration (track all events from section 8)
- [ ] Accessibility (keyboard nav, ARIA labels, color contrast)
- [ ] Performance (Lighthouse >90)

---

## 10. REVISION HISTORY

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-25 | 1.0 | Initial comprehensive spec (consolidated from 3 prior specs) |

---

## Questions for Frontend Developer?

Post in this issue if:
- Any spec section is ambiguous
- Component prop types need clarification
- API endpoints are different than expected (`/api/models`, `/api/deploy`)
- Mobile breakpoints don't match your design system
- Color tokens don't match existing brand guidelines

**This spec is ready for implementation. No designer ambiguity should block coding.**
