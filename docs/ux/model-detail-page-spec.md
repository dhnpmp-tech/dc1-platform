# Model Detail Page Spec

**DCP-865 Deliverable 2**
**Status:** Implementation-ready UX spec
**Audience:** Frontend developer building the model detail view
**Last Updated:** 2026-03-24

---

## Overview

A **full-page detail view** that appears when a renter clicks a model card in the marketplace. The page answers three buyer questions in priority order:

1. **Is this the right model for my task?** (benchmarks, use cases, comparisons)
2. **How much will it cost?** (pricing, cost-per-task estimates)
3. **Can I use it now?** (provider availability, deploy button)

**Key Principle:** Renters should make a deploy decision within 90 seconds of landing on this page. No scrolling, no jargon, no "read the docs."

---

## Success Criteria

- [ ] Renter understands model use case within 15 seconds of landing
- [ ] Renter can compare price vs. AWS Bedrock / RunPod in <30 sec
- [ ] Renter can click "Deploy" and open deploy modal in <45 sec
- [ ] Model is deployed within 2 min of deploy button click
- [ ] Arabic badge is visible & clear for non-English models
- [ ] Provider count is live (updates every 30 sec)
- [ ] Page works on mobile (responsive, <3 second load)

---

## Page Structure & Sections

### Section 1: Hero (Above the fold, no scroll)

**Desktop Layout:**
```
[Back/Breadcrumb]

[Model Image/Icon]  |  Model Name (bold, h1)
(128px × 128px)    |  "Arabic Language Model"
                   |  VRAM: 8 GB | Quantized
                   |
                   |  SAR 0.12 / hour
                   |  (≈$0.032 USD)
                   |
                   |  [Deploy]  [Share]
```

**Mobile Layout (stack vertically):**
```
[Back/Breadcrumb]
[Model Image, centered]
Model Name
Metadata (VRAM, Arabic badge)
Price (large, bold)
[Deploy]
```

**Content:**
- **Model name:** "ALLaM 7B" or "Qwen 2.5 7B Instruct"
- **Arabic badge:** (if applicable)
  ```
  🇸🇦 Arabic
  ```
  Small, prominent badge below name
- **Quantization info:** "4-bit quantized" (if applicable, helps set expectations for latency)
- **VRAM requirement:** "8 GB" or "24 GB"
- **Pricing:**
  - Primary: SAR/hour (e.g., "SAR 0.12/hour")
  - Secondary: USD/hour (e.g., "≈$0.032 USD")
  - Show monthly equivalent: "≈SAR 8,467/month at 50% utilization"
- **Action buttons:** [Deploy] [Share]
  - Deploy: Opens DCP-857 deploy modal
  - Share: Copy shareable link to clipboard

**Visual Design:**
- Hero background: model category color (LLM = blue, embeddings = green, image = purple)
- Model icon: 128×128px, rounded corners
- Badge for Arabic: green background, white text, 12px padding

---

### Section 2: Benchmarks (No scroll required on desktop)

**Desktop Layout (2-column):**
```
Left Column:              Right Column:
Inference Speed           Cold-start Time
████████░░ 45.2 TPS      ██████░░░░ 2.3 sec
(Tokens Per Sec)         vs. Competitors: -45%
on RTX 4090

Context Window            Max Batch Size
┌─────────────────┐      ┌──────────────┐
│ 8K tokens       │      │ 32            │
│ (enough for     │      │ (parallel     │
│  5K words)      │      │  requests)    │
└─────────────────┘      └──────────────┘
```

**Mobile Layout (stack vertically):**
```
Inference Speed
████████░░ 45.2 TPS on RTX 4090

Cold-start Time
██████░░░░ 2.3 sec
vs. Competitors: -45%

Context Window
8K tokens (enough for 5K words)

Max Batch Size
32 parallel requests
```

**Content & Calculation:**
- **Inference Speed (TPS):** Tokens per second on RTX 4090 (baseline GPU)
  - Source: `benchmark-arabic-models.mjs` (DCP-832)
  - Show metric visually: progress bar 0–100 TPS
  - Include comparison tag: "45% faster than Vast.ai" (if true)
- **Cold-start latency:** Time to first token on empty GPU
  - Source: TTFT benchmarks from `benchmark-arabic-models.mjs`
  - Format: "2.3 sec (vs 4.2 sec on RunPod)"
  - Show "-45%" badge if favorable
- **Context window:** Max input token length
  - Format: "8K tokens" with expansion "(enough for ~5,000 words)"
  - Help renters understand what they can input
- **Max batch size:** How many requests this model can handle in parallel
  - Shows provider earning potential (ability to serve multiple jobs)

**Visual Design:**
- Progress bars: DCP brand blue, 6px height
- Comparison tags: green badge if favorable, neutral if not
- Icons for each metric (lightning for speed, clock for latency, etc.)

---

### Section 3: Renter Cost Estimator (Interactive)

**Layout (below benchmarks, same width):**
```
"How much will this cost me?"

[Slider: Monthly utilization ◄────────►]
         10%              70%

Estimated monthly cost (at 70% utilization):
SAR 8,467 / month
(≈$2,257 USD)

Cost per task estimate:
If you run 100 inference tasks/day:
SAR 0.12 per task (~3 min @ RTX 4090)
```

**Content:**
- **Utilization slider:** 10% to 100%, snap to 10% increments
  - Default: 70% (realistic for active providers per strategic brief)
  - Updates cost in real-time
- **Monthly estimate:** Calculate based on price/hour × hours/month × utilization
  - Formula: (price_sar_per_hour) × 730 hours × (utilization / 100)
- **Per-task estimate:** Help renters understand cost per inference
  - Ask: "How many requests per day?"
  - Input field (default: 100)
  - Calculate: (monthly_cost) / (requests_per_day × 30)

**Visual Design:**
- Large, bold number for monthly SAR cost
- Smaller gray number for USD equivalent
- Task cost in smaller font, highlighted in light blue box
- Slider is full width on mobile, 400px on desktop

---

### Section 4: Competitor Price Comparison

**Layout (table, horizontally scrollable on mobile):**
```
                    DCP        AWS Bedrock  RunPod     Vast.ai
ALLaM 7B/hour       SAR 0.12   SAR 0.28     SAR 0.34   SAR 0.31
                    (Cheapest) -57% cheaper -65%       -61%
Inference Speed     45 TPS     28 TPS       38 TPS     42 TPS
Cold-start          2.3 sec    4.1 sec      3.8 sec    3.2 sec
Region              Saudi KSA  AWS US-East  Global     Global
```

**Content:**
- **Provider:** DCP, AWS Bedrock, RunPod, Vast.ai
- **Price/hour:** Show in SAR, with savings badge
- **Speed:** TPS (from our benchmarks, from competitor public docs)
- **Cold-start:** Seconds (from benchmarks)
- **Region:** Where you're running (affects pricing & compliance)
- **Savings badge:** Green badge, "57% cheaper" prominently placed

**Data Sources:**
- DCP prices: Backend pricing engine (DCP-770)
- Competitor prices: Updated monthly from strategic brief (docs/FOUNDER-STRATEGIC-BRIEF.md)
- Speed metrics: Public benchmarks + our measurements

**Visual Design:**
- Table with sticky header (desktop)
- Mobile: Card layout, horizontal scroll on overflow
- DCP column: light blue background to highlight
- Savings badges: green, bold percentage

---

### Section 5: Use Case Cards (3–4 cards, vertical stack)

**Layout:**
```
"Perfect for:"

[Card 1]                    [Card 2]
Arabic Q&A                  Arabic RAG
[Icon]                      [Icon]
"Ask questions about        "Build a document search
 Arabic documents,          system for legal/medical
 policies, regulations."    files."

Example prompt:             Example prompt:
"في جدول المفاهيم الأساسية  "ابحث عن جميع البيانات
 للهندسة المدنية..."        الشخصية في العقد..."

Fast response time          Perfect accuracy
[TPS badge]                 [Batch processing]


[Card 3]                    [Card 4]
Chat Completions            Translation
[Icon]                      [Icon]
"Interactive conversations  "Translate between Arabic
 in Arabic."                and English with context."
```

**Content per card:**
- **Use case title:** "Arabic Q&A", "Arabic RAG", "Chat Completions", "Translation"
- **Description:** 1 sentence, plain language
- **Example prompt:** Real Arabic text (copied from eval datasets or user feedback)
  - Shows the model can handle script, diacritics, etc.
- **Performance badge:** TPS, accuracy, or latency metric
  - Matches the model's strengths for that use case

**Visual Design:**
- Card: 1 column on mobile, 2 columns on tablet, grid on desktop
- Card background: light gray, rounded 8px, padding 16px
- Icon: 24×24, colored by use case (Q&A = blue, RAG = purple, etc.)
- Example text: monospace, smaller font, light gray background

**Use Case Selection (based on model tag):**
- If model has `arabic_llm` tag: Q&A, RAG, Chat, Translation
- If model has `embeddings` tag: RAG, Similarity, Clustering
- If model has `image` tag: Image generation, classification, detection
- Always show 3–4 most relevant use cases (don't show all 10)

---

### Section 6: Provider Availability (Always visible, updates live)

**Layout (sticky at bottom of page on desktop):**
```
Providers serving this model right now:

🟢 7 providers online
└─ RTX 4090: 3
└─ RTX 4080: 2
└─ H100: 2

Average response time: 1.2 sec
Availability: 99.8% (last 7 days)

[Deploy Now]
```

**Mobile Layout:**
```
🟢 7 online
🟢 Request will be served in <1 sec
[Deploy Now]
```

**Content:**
- **Live provider count:** Fetch from DB, update every 30 sec
- **Breakdown by GPU:** Show how many providers have this model on which GPUs
- **Response time:** Weighted average of all providers' recent response times
- **Uptime SLA:** 7-day uptime % (if >99%, show badge ✅)
- **Deploy CTA:** Sticky, always reachable on mobile

**API Requirements:**
- `GET /api/models/:id/provider-availability`
  - Returns: `{ online_count, by_gpu: {...}, avg_response_ms, uptime_pct }`
  - Update interval: 30 sec (client-side polling)

**Visual Design:**
- 🟢 green dot + bold number for "online providers"
- GPU breakdown in indented list
- Response time in large, bold font
- Deploy button: primary color, always visible

---

## Deploy Modal (DCP-857 Reference)

**When renter clicks [Deploy]:**
1. Modal opens (don't navigate away from model detail page)
2. Modal shows deployment options:
   - Pre-configured container (VLLM) for LLMs
   - Container selection for other model types
   - API endpoint preview
3. Renter confirms, deployment starts
4. Modal shows deployment progress (building container, starting, warming up)
5. Modal shows "Ready" with API endpoint, curl example, SDK docs link
6. Renter can close modal and return to model detail page, or navigate to deployment dashboard

This spec assumes DCP-857 is complete. Link to it from [Deploy] button.

---

## Share Modal / Copy Link

**When renter clicks [Share]:**
1. Modal opens with shareable link:
   ```
   https://app.dcp.sa/models/allam-7b?ref=sharelink

   [Copy to clipboard] [Share on X] [Share on LinkedIn]
   ```
2. Link pre-populates renter's message:
   ```
   "Check out ALLaM 7B on DCP—57% cheaper than AWS Bedrock,
    45% faster inference speed, PDPL-compliant Arabic NLP.
    [link]"
   ```
3. User can copy or share directly to social

---

## Responsive Design

| Breakpoint | Layout | Behavior |
|------------|--------|----------|
| **Mobile** (<640px) | Single column, full-width cards, sticky Deploy button at bottom, benchmark bars shorter | No fixed sidebar, scroll to Deploy |
| **Tablet** (640–1024px) | Hero + pricing in 2 col, benchmarks stacked, competitor table horizontal scroll | 50% wider cards, spacing adjusted |
| **Desktop** (>1024px) | Hero left, pricing/metrics right, benchmarks in grid, table full-width, sticky availability box | Optimized whitespace, max-width 1200px |

---

## Accessibility & Internationalization

### Accessibility
- All headings use proper hierarchy (h1 > h2 > h3)
- Price comparison table: proper `<table>` with `<thead>/<tbody>`, screen reader friendly
- Badges and icons: have text labels in addition to color (e.g., "57% cheaper" + green badge)
- Slider: keyboard accessible (arrow keys)
- Deploy button: large touch target (48×48px minimum on mobile)
- Alt text for model icons: "ALLaM 7B model icon"

### Arabic Support
- All text is RTL-aware (use `dir="rtl"` wrapper for Arabic sections)
- Example prompts in Arabic: use proper script rendering, diacritics support
- Price display: SAR ₪ symbol, right-aligned on RTL
- Comparison table: flip column order on RTL (DCP on right, competitors on left)
- Use cases: show Arabic + English examples side-by-side

### Internationalization
- Prices: Convert SAR to renter's local currency (detect from IP or user preference)
- TPS/latency: Use locale-aware number formatting (10,567 vs 10.567)
- Date/time: Show uptime stats in renter's timezone

---

## Technical Implementation Notes

### API Endpoints Required
1. **GET /api/models/:id** — Full model details (name, description, tags, VRAM, etc.)
2. **GET /api/models/:id/benchmarks** — Speed, cold-start, context window, batch size
3. **GET /api/models/:id/pricing** — Price per hour, SAR + USD
4. **GET /api/models/:id/use-cases** — Array of { title, description, example_prompt, icon_id }
5. **GET /api/models/:id/provider-availability** — Live provider count, GPU breakdown, uptime
6. **GET /api/models/:id/competitors** — Comparison data (AWS, RunPod, Vast.ai)

### State Management
- Model detail: fetch once on mount, cache for 5 min
- Provider availability: poll every 30 sec (keep renter count live)
- Utilization slider: client-side calculation, no API call needed

### Performance
- Page load: <2 sec (lazy-load comparison table + use case images)
- Images: Serve model icons at 2x for retina (256×256px max)
- Benchmark bars: CSS-based (no heavy SVG), GPU acceleration for smooth animations

### Error Handling
- Model not found: 404, show "This model is no longer available" + link to marketplace
- Provider availability failed: Show cached count + "data may be outdated" note
- Benchmark data missing: Show placeholder text "Benchmarks pending" (don't break layout)

---

## Related Issues & Documents

- **DCP-857:** Deploy Modal (referenced from [Deploy] button)
- **DCP-832:** Arabic Model Benchmarks (TPS, cold-start data source)
- **DCP-770:** Provider Earnings Calculator (pricing engine)
- **DCP-831:** Template Catalog (model browsing, filtering)
- **docs/FOUNDER-STRATEGIC-BRIEF.md** (competitor pricing, market data)

---

## Success Metrics (Post-Launch)

- **Page load time:** <2 sec on 4G
- **Renter engagement:** Time on page before [Deploy] click
- **Deploy rate:** % of model detail page visits that result in deployment
- **Price comparison views:** % of renters who scroll to competitor table
- **Provider availability tracking:** Accuracy of "online" count vs actual
- **Mobile vs desktop:** Bounce rate comparison

---

## Future Enhancements (Not in Sprint 28)

- [ ] User reviews & ratings (after Day 6 phase completes)
- [ ] Model fine-tuning option ("Deploy this model + upload training data")
- [ ] Cost breakdown by region (SAR pricing, AWS US-East equivalent)
- [ ] API throughput calculator ("How many requests/sec can this handle?")
- [ ] Community benchmarks (crowdsourced latency from real deployments)
