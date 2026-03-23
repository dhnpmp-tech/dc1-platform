# Model Card Competitive Pricing Display — Sprint 27

> **Owner:** UI/UX Specialist
> **Date:** 2026-03-23
> **Deliverable:** Pricing card design & competitive positioning

---

## EXECUTIVE SUMMARY

Renters make buy/no-buy decisions in <5 seconds. **Pricing transparency is the conversion lever.** Each template card must show:
1. DCP price (SAR/hour)
2. Competitive price (Vast.ai / RunPod / AWS)
3. Savings % ("50% cheaper")

This creates **psychological anchoring** — renters see value immediately.

---

## 1. PRICING CARD DESIGN

### Card Section: "Pricing & Value"

```
┌─────────────────────────────────────┐
│ DCP Price                           │
│ 5.0 SAR/hr                          │ ← Large, primary color
│                                     │
│ vs Competitors                      │ ← Gray, secondary
│ Vast.ai:   7.5 SAR/hr  (-33%)      │ ← Show % savings in green
│ RunPod:    7.0 SAR/hr  (-29%)      │
│ AWS:       15.0 SAR/hr (-67%)      │
│                                     │
│ → You save 2.5 SAR/hr or            │ ← Value prop
│   21,900 SAR/year (1000 hrs)        │
└─────────────────────────────────────┘
```

### Card Placement

In template card, this section comes **before** the CTA button (high visibility).

```
┌──────────────────────────────┐
│ Template Name & Icon         │
│ Category & Description       │
│                              │
│ GPU Tier | Cold-Start        │
│                              │
│ ┌──────────────────────────┐ │
│ │ DCP: 5.0 SAR/hr         │ │ ← Pricing highlight box
│ │ 50% vs Vast.ai          │ │
│ │ Save ~22K SAR/year      │ │
│ └──────────────────────────┘ │
│                              │
│ [→ Configure & Deploy]       │
└──────────────────────────────┘
```

---

## 2. COMPETITIVE PRICING DATA

### Data Source
File: `/docs/FOUNDER-STRATEGIC-BRIEF.md` (section 5: Buyer Economics)

### Template → GPU Mapping
| Template | VRAM | GPU Model | DCP/hr | Vast.ai/hr | RunPod/hr | AWS/hr | Savings |
|----------|------|-----------|--------|-----------|----------|--------|---------|
| Nemotron Nano 4B | 8GB | RTX 4090 | 5.0 SAR | 7.5 SAR | 7.0 SAR | — | 33% vs Vast |
| Qwen 2.5 7B | 12GB | RTX 4080 | 6.5 SAR | 6.2 SAR | 6.0 SAR | — | Parity |
| Llama 3 8B | 16GB | RTX 4090 | 9.0 SAR | 10.5 SAR | 9.8 SAR | — | 14% vs Vast |
| H100 Inference | 80GB | H100 | 65.0 SAR | 105 SAR | 98.7 SAR | 245 SAR | 38% vs Vast |
| SDXL | 24GB | RTX 4090 | 12.0 SAR | 14.7 SAR | 13.5 SAR | 49 SAR | 18% vs Vast |

**Rule of Thumb:**
- **8-16GB (consumer GPUs):** DCP 30-50% cheaper than Vast.ai
- **40GB+ (enterprise GPUs):** DCP 40-60% cheaper than hyperscalers

### Annual Value Calculation
```
DCP usage: 1000 hrs/year (typical ML team)
RTX 4090 @ 5.0 SAR/hr = 5,000 SAR/year
Vast.ai @ 7.5 SAR/hr = 7,500 SAR/year

Savings: 2,500 SAR/year or 33%
```

---

## 3. DESIGN TOKENS

### Pricing Box Styling
```css
background: linear-gradient(135deg, dc1-primary/5, dc1-primary/10)
border: 1px solid dc1-primary/20
border-radius: 8px
padding: 16px 12px
```

### Typography
- **DCP Price:** `text-2xl font-bold text-dc1-primary`
- **"vs Competitors":** `text-xs text-dc1-text-tertiary uppercase`
- **Competitor prices:** `text-sm text-dc1-text-secondary`
- **Savings %:** `text-sm font-medium text-status-success`
- **Annual value:** `text-xs text-dc1-text-tertiary italic`

### Colors
- **DCP price:** Primary color (bold, draws eye)
- **Savings %:** Success green (`text-status-success`)
- **Competitor prices:** Secondary gray
- **Background:** Very subtle tint of primary

---

## 4. COMPETITOR BADGES

### Show Only When Advantageous

Only display competitor prices if DCP is **cheaper** (>10% discount).

**Why?**
- Build confidence (not positioning as expensive alternative)
- Avoid showing parity (confuses buyer)
- Draw attention to DCP advantage

### Example Logic
```tsx
showVastPrice = dcp_price < vast_price * 0.9  // Show if 10%+ cheaper
showRunPodPrice = dcp_price < runpod_price * 0.9
showAwsPrice = dcp_price < aws_price * 0.85   // AWS bar is lower (10% threshold)
```

---

## 5. SAVINGS MESSAGING

### Psychological Triggers

Use **specific numbers** (not percentages alone):

❌ "50% cheaper"  
✅ "Save 2.5 SAR/hr or 22,000 SAR/year"

This leverages **anchoring bias** — concrete numbers feel more real than percentages.

### Messaging Variants

**For Small Deployments (<100 hrs/month):**
"Save 200 SAR/month"

**For Typical ML Teams (1000 hrs/year):**
"Save 2,500 SAR/year"

**For Enterprise (5000+ hrs/year):**
"Save 12,500+ SAR/year"

---

## 6. MOBILE PRICING DISPLAY

Condense on mobile while preserving key info:

```
DCP: 5.0 SAR/hr
50% vs Vast.ai | Save ~22K/yr
```

Stack vertically, smaller font, but **keep the savings message**.

---

## 7. REAL-TIME PRICING (Future)

Currently, competitive prices are **static** (hardcoded in `COMPETITOR_PRICES`).

**When backend API `/api/models` is live:**
- Fetch real-time competitor pricing from external API
- Update DCP floor prices dynamically based on utility spot pricing
- Show "Price updated X minutes ago" timestamp

### Implementation Roadmap
1. **Phase 1 (Sprint 27):** Static competitor data, hardcoded
2. **Phase 2 (Sprint 28):** API integration for competitor pricing
3. **Phase 3 (Sprint 29):** Dynamic DCP pricing based on provider supply

---

## 8. TRUST SIGNALS

To reinforce pricing credibility:

- **✓ Verified pricing** — "Updated 2026-03-23"
- **Competitive breakdown:** Show multiple sources (not just one)
- **No hidden fees:** "No setup fees, no premium for Arabic models"
- **Escrow guarantee:** "Funds held in smart contract until job complete" (when live)

---

## 9. A/B TEST IDEAS

After launch, test messaging variants:

1. **Savings format:** "50% cheaper" vs "Save 2,500 SAR/year" (measure CTR)
2. **Pricing visibility:** Pricing box above fold vs below fold (measure conversion)
3. **Annual value:** Show vs don't show (measure renter confidence)
4. **Competitor count:** Show all 3 competitors vs top 1 (measure choice paralysis)

---

## 10. Success Metrics

Track post-launch:
- **Price comparison CTR:** % of renters who look at competitor prices
- **Deploy CTR after pricing view:** Do renters deploy after seeing savings?
- **Average deployment value:** Did pricing transparency increase avg job cost?
- **Renter cohort LTV:** Higher LTV for cohorts with new pricing display?

---

## References

- Competitor data: `/docs/FOUNDER-STRATEGIC-BRIEF.md` (Competitive Landscape section)
- Buyer economics: `/docs/FOUNDER-STRATEGIC-BRIEF.md` (Buyer Economics section)
- Template prices: Each `/docker-templates/*.json` has `estimated_price_sar_per_hour`
