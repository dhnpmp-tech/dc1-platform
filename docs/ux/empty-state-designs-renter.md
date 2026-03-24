# UX Spec: Renter Empty States
## Designed for Retention & Re-engagement

**Issue:** DCP-809
**Component:** Renter marketplace empty states
**Status:** Design-ready for implementation
**Last Updated:** 2026-03-24

---

## 1. Overview

Empty states are critical moments for user retention. A renter lands in one of three scenarios:
1. **No Jobs Yet** — First time on platform, or just created account
2. **Wallet Empty** — Ran out of credit, can't deploy models
3. **No Arabic Models** — Filtered for Arabic, no results match

**Design Principle:** Don't leave them confused. **Educate → Guide → Convert.**

Each empty state should:
- Explain **what happened** (clear, non-blaming)
- Suggest **next steps** (action-oriented, easy)
- Maintain **delight** (tone is helpful, not condescending)

---

## 2. Empty State 1: No Jobs Yet (First Experience)

### 2.1 Scenario

**User:** New renter, signed up yesterday, never deployed a model yet
**Location:** `/renter/dashboard` or `/renter/jobs`
**Trigger:** `GET /api/renter/jobs → empty array`

### 2.2 Visual Design

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                       🚀                                     │
│                   (Illustration: rocket                      │
│                    on launch pad)                            │
│                                                              │
│               Ready to Launch?                              │
│                                                              │
│   You haven't deployed a model yet.                         │
│   Let's get started!                                        │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ [📚 How DCP Works] [🚀 Deploy Your First Model]     │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                              │
│   ────────────────────────────────────────────────────────  │
│                                                              │
│   Popular Models to Get Started:                            │
│                                                              │
│   ┌──────────────────────┬──────────────────────────────┐  │
│   │ Llama 3 8B (Chat)    │ Perfect for: Chatbots,       │  │
│   │                      │ Q&A, prototypes              │  │
│   │ SAR 1.00/hour        │ [Deploy] [Learn More]        │  │
│   │ ⭐⭐⭐⭐⭐ 4.8/5      │                              │  │
│   │ (1,247 jobs)         │                              │  │
│   └──────────────────────┴──────────────────────────────┘  │
│                                                              │
│   ┌──────────────────────┬──────────────────────────────┐  │
│   │ SDXL 1.0 (Image Gen) │ Perfect for: Image gen,      │  │
│   │                      │ art, design prototypes       │  │
│   │ SAR 0.45/hour        │ [Deploy] [Learn More]        │  │
│   │ ⭐⭐⭐⭐⭐ 4.9/5      │                              │  │
│   │ (3,842 jobs)         │                              │  │
│   └──────────────────────┴──────────────────────────────┘  │
│                                                              │
│   ┌──────────────────────┬──────────────────────────────┐  │
│   │ ALLaM 7B (Arabic)    │ Perfect for: Arabic chat,    │  │
│   │                      │ document QA, RAG             │  │
│   │ SAR 0.35/hour        │ [Deploy] [Learn More]        │  │
│   │ ⭐⭐⭐⭐ 4.6/5       │                              │  │
│   │ (342 jobs)           │                              │  │
│   └──────────────────────┴──────────────────────────────┘  │
│                                                              │
│                    [View All 20+ Models]                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 Component Breakdown

#### 2.3.1 Illustration

**Asset:** Rocket on launch pad (simple SVG)
- **Size:** 80px × 80px
- **Colors:** Gradient blue (#2563EB → #60A5FA) + white accents
- **Animation:** Subtle pulse (0.5s loop) on page load
- **Alt Text:** "Rocket on a launch pad, ready to take off"

#### 2.3.2 Heading

```
"Ready to Launch?"
```

- **Font:** Poppins 700, 28px
- **Color:** #1F2937 (dark)
- **Spacing:** 24px below illustration

**Rationale:** Friendly, action-oriented question. "Ready to..." is aspirational, not intimidating.

#### 2.3.3 Subheading

```
"You haven't deployed a model yet. Let's get started!"
```

- **Font:** Poppins 400, 16px
- **Color:** #6B7280 (gray)
- **Spacing:** 12px below heading
- **Max-width:** 500px

**Rationale:** Acknowledges state (no jobs), frames next step as easy ("Let's").

#### 2.3.4 Primary CTA Row

```
┌─────────────────────────────────────────┐
│ [📚 How DCP Works] [🚀 Deploy Your First]│
└─────────────────────────────────────────┘
```

**Two-button layout:**
1. **Left button:** "📚 How DCP Works" (secondary style)
   - Links to `/docs/renter-getting-started.md`
   - For first-time users who want context before diving in
   - Style: Light blue background (#EFF6FF), blue text (#2563EB), border #2563EB
   - Size: 48px height, flexible width

2. **Right button:** "🚀 Deploy Your First Model" (primary style)
   - Links to `/marketplace/models`
   - For action-oriented users who prefer to explore
   - Style: Solid blue (#2563EB), white text
   - Size: 48px height, flexible width

**Mobile:** Stacks vertically on < 640px

#### 2.3.5 Divider

```
────────────────────────────────────────────────
```

- Simple horizontal line (1px #E5E7EB)
- Spacing: 24px above/below
- Separates CTAs from popular models section

#### 2.3.6 Popular Models (3-card carousel)

**Purpose:** Reduce blank slate by showing recommended models renter could deploy right now

```
Popular Models to Get Started:

┌──────────────────────┬──────────────────────┐
│ Llama 3 8B (Chat)    │ Perfect for: Chat,   │
│ SAR 1.00/hour        │ Q&A, prototypes      │
│ ⭐⭐⭐⭐⭐ 4.8/5    │                      │
│ 1,247 jobs           │ [Deploy] [Learn More]│
└──────────────────────┴──────────────────────┘
```

**Card Styling:**
- **Container:** 3-column grid on desktop, horizontal scroll on mobile
- **Card Size:** 320px × 180px
- **Background:** #FFFFFF (white), border 1px #E5E7EB
- **Padding:** 16px
- **Border Radius:** 8px
- **Hover:** Background #F9FAFB, shadow elevation

**Card Content:**
- **Model Name + Type:** Poppins 600, 16px, #1F2937
- **Price:** Poppins 600, 14px, #2563EB (highlighted)
- **Rating:** Stars (⭐) + score (4.8/5), Poppins 400, 12px
- **Use Case:** Poppins 400, 13px, #6B7280
- **Job Count:** Poppins 400, 12px, #9CA3AF (lighter)
- **CTAs:** Two small buttons per card: [Deploy] [Learn More]

**Model Selection Logic (hardcoded, updated monthly):**
1. **Top slot:** Best value + high popularity (usually Llama 3 8B or Mistral 7B)
2. **Middle slot:** Highest engagement by job count (usually SDXL for image gen)
3. **Right slot:** Arabic model or most popular (ALLaM 7B or Qwen 2.5 7B)

**Expected Impact:**
- Reduce "I don't know what to do" confusion
- Suggest obvious next step without forcing
- Show real job counts (social proof)

#### 2.3.7 View All Models Link

```
[View All 20+ Models]
```

- **Font:** Poppins 600, 14px, blue (#2563EB)
- **Placement:** Below carousel
- **Action:** Links to `/marketplace/models`
- **Spacing:** 24px above

### 2.4 Behavior

**Load State:**
1. Illustration fades in + pulses
2. Heading + subheading fade in
3. CTA buttons fade in
4. Carousel models fade in (with slight stagger for visual interest)

**No Loading Skeleton:** If the page loads fast enough, show the full empty state without skeleton. If API is slow (>1s), show skeleton + spinner.

---

## 3. Empty State 2: Wallet Empty (No Credit)

### 3.1 Scenario

**User:** Existing renter who ran out of credits
**Location:** `/renter/dashboard` or when attempting to deploy a model
**Trigger:** `renter_wallet.balance_sar < 0.10` (minimum for any job)

### 3.2 Visual Design

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                        💸                                    │
│                 (Empty wallet illustration)                  │
│                                                              │
│            Your Wallet is Empty                             │
│                                                              │
│   You've used up your credit.                               │
│   Top up to start running models again.                     │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Current Balance:  SAR 0.00                          │  │
│   │ Required to Deploy: SAR 2.50 minimum                │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                              │
│              [💳 Top Up Your Wallet]                        │
│              [📊 View Usage History]                        │
│                                                              │
│   ────────────────────────────────────────────────────────  │
│                                                              │
│   💡 Tips to Reduce Costs:                                  │
│                                                              │
│   • Use RTX 4090 (SAR 1.00/hr) instead of H100             │
│     (SAR 9.37/hr) — 10x cheaper for general ML              │
│                                                              │
│   • Deploy Arabic models on DCP vs AWS Bedrock              │
│     Save 38% on Arabic LLM inference                        │
│                                                              │
│   • Set job timeout to 30 min vs infinite                   │
│     Prevents accidental long-running jobs                   │
│                                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Component Breakdown

#### 3.3.1 Illustration

**Asset:** Empty wallet (simple SVG or emoji)
- **Size:** 80px × 80px
- **Colors:** Gray (#9CA3AF) → lighter gray gradient
- **Animation:** Slow shake (1s loop) to indicate problem
- **Alt Text:** "Empty wallet illustration"

#### 3.3.2 Heading

```
"Your Wallet is Empty"
```

- **Font:** Poppins 700, 28px
- **Color:** #EF4444 (red, indicates problem)

#### 3.3.3 Subheading

```
"You've used up your credit. Top up to start running models again."
```

- **Font:** Poppins 400, 16px
- **Color:** #6B7280

#### 3.3.4 Balance Card

```
┌─────────────────────────────────────────┐
│ Current Balance: SAR 0.00                │
│ Required to Deploy: SAR 2.50 minimum    │
│                                          │
│ [Top Up Wallet →]                      │
└─────────────────────────────────────────┘
```

**Styling:**
- **Background:** #FEF2F2 (light red)
- **Border:** 1px #FCA5A5 (red border)
- **Padding:** 16px
- **Border Radius:** 8px
- **Content:**
  - Current balance: Poppins 600, #EF4444 (red, prominent)
  - Minimum required: Poppins 500, #9CA3AF
  - Inline CTA button: Links to `/renter/wallet/topup`

#### 3.3.5 Cost Reduction Tips

**Purpose:** Help user understand they CAN recover by making smarter choices

```
💡 Tips to Reduce Costs:

• Use RTX 4090 (SAR 1.00/hr) instead of H100 (SAR 9.37/hr)
  — 10x cheaper for general ML

• Deploy Arabic models on DCP vs AWS Bedrock
  Save 38% on Arabic LLM inference

• Set job timeout to 30 min vs infinite
  Prevents accidental long-running jobs
```

**Styling:**
- **Title:** Poppins 600, 14px, #1F2937
- **Bullets:** Poppins 400, 13px, #6B7280
- **Accent (bold):** Key metrics (SAR amounts, percentages)
- **Background:** None (plain text, not in card)

**Rationale:**
- Reframes empty wallet as an opportunity to optimize
- Shows specific savings (not generic "use cheaper models")
- Empowers user ("you can fix this")
- Increases likelihood of top-up + retry

#### 3.3.6 Primary CTAs

```
[💳 Top Up Your Wallet]  [📊 View Usage History]
```

1. **Primary (Blue):** "💳 Top Up Your Wallet"
   - Links to `/renter/wallet/topup`
   - Quick payment via card/bank transfer/crypto
   - Default action

2. **Secondary (Light):** "📊 View Usage History"
   - Links to `/renter/usage`
   - Shows job breakdown + costs
   - For users who want to understand where money went

### 3.4 Behavior

**When User Tops Up:**
1. User completes payment on `/renter/wallet/topup`
2. Wallet balance updates (real-time or ~5s refresh)
3. Empty state disappears
4. Dashboard shows new balance
5. Toast notification: "✅ SAR 50 added to wallet. Ready to deploy!"
6. Optional: Suggest "continue with your last model" or link to `/marketplace/models`

---

## 4. Empty State 3: No Arabic Models (Filtered, No Results)

### 4.1 Scenario

**User:** Arabic-speaking renter looking for Arabic LLMs
**Location:** `/marketplace/models?language=arabic`
**Trigger:** Model filter results in 0 models

### 4.2 Visual Design

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                        🔍                                    │
│                  (Magnifying glass)                          │
│                                                              │
│          No Arabic Models Found                             │
│                                                              │
│   We couldn't find any models matching:                     │
│   Language: Arabic • GPU: Any • Price: Any                  │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ [📝 Modify Filters]  [🇸🇦 Browse All Arabic Models]  │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                              │
│   ────────────────────────────────────────────────────────  │
│                                                              │
│   💡 Try These Approaches:                                  │
│                                                              │
│   ✓ Widen GPU filter to include more tiers                 │
│     (Only Tier A models available right now)               │
│                                                              │
│   ✓ Check availability in your region                      │
│     Current region: 🇸🇦 Saudi Arabia (6 models online)     │
│                                                              │
│   ✓ Use English models as alternative                      │
│     Llama 3, Mistral, Qwen work great for general ML        │
│                                                              │
│   ────────────────────────────────────────────────────────  │
│                                                              │
│   📬 Want more Arabic models?                               │
│   [Tell us](mailto:requests@dcp.sa)                        │
│   (We're actively adding ALLaM, JAIS, and Arabic embeddings)│
│                                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Component Breakdown

#### 4.3.1 Illustration

**Asset:** Magnifying glass or search icon
- **Size:** 80px × 80px
- **Colors:** Blue (#2563EB) with subtle gradient
- **Animation:** Rotate 360° (1.5s loop)
- **Alt Text:** "Magnifying glass searching"

#### 4.3.2 Heading

```
"No Arabic Models Found"
```

- **Font:** Poppins 700, 28px
- **Color:** #1F2937

#### 4.3.3 Subheading

```
"We couldn't find any models matching: Language: Arabic • GPU: Any • Price: Any"
```

- **Font:** Poppins 400, 16px
- **Color:** #6B7280
- **Dynamic:** Shows actual applied filters

#### 4.3.4 Filter Card

```
┌──────────────────────────────────────────────────────────┐
│ Applied Filters:                                         │
│ [✕ Language: Arabic] [✕ GPU: Any] [✕ Price: Any]     │
│                                                          │
│ [Modify Filters]  [Clear All]                           │
└──────────────────────────────────────────────────────────┘
```

**Styling:**
- **Background:** #F9FAFB (light gray)
- **Chips:** Blue background (#2563EB), white text, ✕ (remove icon)
- **Buttons:** Secondary style links

**Behavior:**
- Click [✕] to remove single filter
- Click [Clear All] to reset all filters and show full catalog
- Click [Modify Filters] to go back to filter panel

#### 4.3.5 Troubleshooting Tips

```
💡 Try These Approaches:

✓ Widen GPU filter to include more tiers
  (Only Tier A models available right now in your region)

✓ Check availability in your region
  Current region: 🇸🇦 Saudi Arabia (6 models online)

✓ Use English models as alternative
  Llama 3, Mistral, Qwen work great for general ML
```

**Styling:**
- **Checkmark Icon:** Green (#10B981), Poppins 600, 14px
- **Suggestion:** Poppins 400, 13px, #6B7280
- **Subtext:** Poppins 400, 12px, #9CA3AF (lighter)

**Dynamic Content:** Tips vary based on what filters are applied:
- If `vram=24-40` (large VRAM), suggest: "Not many Tier B models available. Try Tier A (8-24GB VRAM)."
- If `price=<1` (cheap), suggest: "Premium Arabic models cost SAR 0.35-0.50/hr. Increase budget or try Llama 3 (SAR 1.00)."
- If `region=other`, suggest: "Arabic model availability is best in Saudi Arabia + UAE. Select those regions for more options."

#### 4.3.6 Feature Request Link

```
📬 Want more Arabic models?
[Tell us](mailto:requests@dcp.sa)
(We're actively adding ALLaM, JAIS, and Arabic embeddings)
```

- **Font:** Poppins 500, 13px, #2563EB (link)
- **Icon:** Mail emoji (📬)
- **Action:** Opens email to `requests@dcp.sa` with pre-filled subject: "Model Request: [Language/Task]"
- **Purpose:** Turn disappointment into feedback loop

### 4.4 Behavior

**After User Modifies Filters:**
1. Clear old results
2. Show loading spinner in place of empty state
3. Fetch new results
4. If results > 0: Show model list
5. If results = 0: Show updated empty state with new filter combinations

---

## 5. Cross-Empty-State Patterns

### 5.1 Tone & Voice

**All empty states share:**
- **Friendly:** "Let's get started!" not "Error"
- **Actionable:** Always offer 1-2 obvious next steps
- **Empowering:** Show how to move forward, not what's wrong

### 5.2 Illustration Consistency

| State | Illustration | Color | Animation |
|-------|-------------|-------|-----------|
| No Jobs | 🚀 Rocket | Blue gradient | Pulse |
| No Wallet | 💸 Empty Wallet | Gray gradient | Shake |
| No Models | 🔍 Magnifying Glass | Blue gradient | Rotate |

**All Illustrations:**
- SVG format (crisp on all screens)
- 80px × 80px minimum
- Accessible alt text
- Subtle animation (engage without distract)

### 5.3 CTA Patterns

**Primary Action (Blue, 48px height):**
- Deploy a model: "🚀 Deploy Your First Model"
- Top up wallet: "💳 Top Up Your Wallet"
- Browse models: "🇸🇦 Browse All Arabic Models"

**Secondary Action (Light blue, text link):**
- Learn more: "📚 How DCP Works"
- View history: "📊 View Usage History"
- Modify filters: "[📝 Modify Filters]"

**Call-to-Action Copy:**
- Always start with **verb** (Deploy, Top Up, Browse, View)
- Always include **emoji** for visual reinforcement
- Always indicate **outcome** (next state, what they'll see)

---

## 6. Mobile Responsiveness

### 6.1 Layout Changes

| Breakpoint | Changes |
|-----------|---------|
| < 480px | Single-column stack, full-width buttons, smaller illustration (60px) |
| 480-640px | Still single column, buttons full-width, illustration 80px |
| > 640px | Multi-column (2-3 cols), buttons sized to content, illustration 100px |

### 6.2 Carousel (Popular Models)

- **Desktop:** 3 visible cards, horizontal scroll
- **Mobile < 640px:** 1 visible card, horizontal swipe, card takes 90% width + 16px margin

---

## 7. Localization (Arabic RTL)

**All empty states support Arabic with RTL layout:**
- Illustration placement: Same (center)
- Text direction: RTL
- Button layout: Right-to-left order
- Icons: Mirrored where appropriate (arrows, etc.)

**Example (Arabic):**
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                       🚀                                     │
│                                                              │
│                  آپ کے لیے تیار؟                             │
│          ("Ready to Launch?" in Urdu, example)              │
│                                                              │
│     ابھی تک کوئی ماڈل تیار نہیں کیا گیا۔                    │
│         ("You haven't deployed a model yet")                │
│       شروع کرتے ہیں!                                        │
│         ("Let's get started!")                              │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ [🚀 اپنا پہلا ماڈل تیار کریں] [📚 DCP کی تفہیم]     │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Analytics & KPIs

| Event | Trigger | Purpose |
|-------|---------|---------|
| `empty_state_viewed` | Page loads with empty state | Measure frequency |
| `first_cta_clicked` | "Deploy Your First Model" clicked | Measure intent |
| `learn_more_clicked` | "How DCP Works" link clicked | Measure info-seeking |
| `topup_initiated` | Wallet empty state → "Top Up" clicked | Measure wallet funnel |
| `filter_modified` | "Modify Filters" clicked | Measure search refinement |

**Target KPIs:**
- **No Jobs → First Deploy:** < 5 min from landing on empty state to deploy completion
- **No Wallet → Top Up:** < 3 min from wallet empty state to successful top-up
- **No Models → Browse All:** < 30s from empty state to seeing full catalog

---

## 9. Implementation Checklist

### Components to Create:
- [ ] `components/empty-states/NoJobsEmpty.tsx` — First experience
- [ ] `components/empty-states/WalletEmptyState.tsx` — No credit
- [ ] `components/empty-states/NoModelsEmpty.tsx` — Filtered results empty
- [ ] `components/cards/PopularModelCard.tsx` — Card component for carousel
- [ ] `components/cards/FilterChip.tsx` — Removable filter chip

### Pages to Update:
- [ ] `/renter/dashboard` — Show NoJobsEmpty when `jobs.length === 0`
- [ ] `/renter/jobs` — Same as above
- [ ] `/marketplace/models` — Show NoModelsEmpty when filtered results empty
- [ ] Deploy flow — Show WalletEmptyState if balance < minimum

### Backend:
- [ ] Ensure `/api/renter/jobs` returns empty array (not error) when no jobs
- [ ] Ensure `/api/renter/wallet` returns current balance
- [ ] Ensure `/api/models?language=arabic` filters correctly (or returns empty array)

### Assets:
- [ ] SVG illustration: Rocket on launch pad (80x80px, animated pulse)
- [ ] SVG illustration: Empty wallet (80x80px, animated shake)
- [ ] SVG illustration: Magnifying glass (80x80px, animated rotate)

### Testing:
- [ ] Mobile layout < 640px (portrait + landscape)
- [ ] Arabic RTL rendering
- [ ] Empty state transitions (when jobs appear, wallet topped up, etc.)
- [ ] Analytics events fire

---

## 10. Success Criteria

✅ **Complete when:**
1. All three empty states display correctly on their respective pages
2. Illustrations render and animate without performance issues
3. CTAs are clickable and navigate to correct destinations
4. Popular model cards load with real data (API integration)
5. Filter chips display correctly and are removable
6. Mobile layout stacks properly on < 640px
7. Arabic RTL layout is correct (text direction, button order, icon mirroring)
8. All color contrast ≥ 4.5:1 WCAG AA
9. Analytics events fire on all CTA clicks
10. Empty states gracefully disappear when data loads (no skeleton required)
11. Tips/suggestions are relevant to the filter state
12. User can quickly recover from empty state (1-2 clicks to action)

---

**Author:** UI/UX Specialist
**Target Sprint:** Sprint 28
**Related Issues:** DCP-766 (provider onboarding), DCP-676 (Phase 1 renter testing), DCP-792 (model catalog)
**Status:** ✅ Design-ready for implementation
