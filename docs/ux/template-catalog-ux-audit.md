# Template Catalog UX Audit: Design Recommendations

**Document:** `docs/ux/template-catalog-ux-audit.md`
**Author:** UX Researcher
**Date:** 2026-03-23
**Project:** DCP Template Catalog Activation (Sprint 27)
**Status:** UX Audit & Design Recommendations for DCP-653

---

## Executive Summary

This audit evaluates the DCP template catalog UI (DCP-646) against usability best practices and three enterprise personas: (a) Saudi government IT manager, (b) Arabic NLP startup developer, (c) Western ML engineer.

**Recommendation:** Implement a **two-tier information architecture** with featured Arabic models + advanced filters. This balances discoverability for first-time users with power-user filtering.

---

## 1. Template Catalog Information Architecture

### Recommended Layout

```
┌─────────────────────────────────────────────────┐
│  DCP Marketplace > Templates                    │
├─────────────────────────────────────────────────┤
│  Hero: "Deploy 20+ Pre-Built GPU Workloads"    │
│  Subheader: "Select a template, pick GPU       │
│            tier, deploy in 30 seconds"          │
├─────────────────────────────────────────────────┤
│ [Arabic Models] [All Templates] [Training]     │
│ [Image]        [Notebooks]     [Embedding]     │
├─────────────────────────────────────────────────┤
│  Featured Section                               │
│  ┌─────────────────────────────────────────┐   │
│  │ 🌍 Arabic RAG Complete [Arabic]         │   │
│  │ All-in-one: embedding + rerank + gen   │   │
│  │ RTX 4090+: $0.80/hr | $2.10 (AWS)      │   │
│  │         [Deploy Now]  [Learn More]     │   │
│  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────┐   │
│  │ ALLaM 7B Inference [Arabic] [New]       │   │
│  │ Arabic LLM via vLLM                     │   │
│  │ H100: $1.20/hr | $3.80 (AWS)           │   │
│  │         [Deploy Now]  [Learn More]     │   │
│  └─────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│ All Templates (Grid View)                       │
│ ┌──────┬──────┬──────┬──────┐                  │
│ │SDXL  │Llama3│PyTorch│Jupyter│ ...           │
│ │Image │Chat  │Train  │Interactive             │
│ │$0.50 │$0.80 │$0.90  │$0.60                  │
│ │[>]   │[>]   │[>]    │[>]                     │
│ └──────┴──────┴──────┴──────┘                  │
└─────────────────────────────────────────────────┘

[Sidebar Filters]
├─ Category
│  ☑ LLM Inference
│  ☑ Embedding
│  ☑ Image Generation
│  ☐ Training
│  ☐ Notebook
│
├─ Arabic Capability
│  ☐ Arabic Models Only
│
├─ VRAM Requirement
│  ☐ 8GB  ☑ 16GB  ☑ 24GB  ☑ 80GB+
│
├─ Price Range
│  ☐ $ (<$0.50)  ☐ $$ ($0.50-$1.50)  ☑ $$$ (>$1.50)
```

---

## 2. Template Card Design Specifications

### Card Anatomy (Recommended)

```
┌─────────────────────────────────────┐
│  [Template Icon/Logo]               │
│                                     │
│  ALLaM 7B Inference  🌍 [Arabic]   │
│                                     │
│  Arabic LLM powered by vLLM         │
│  for Arabic chat applications.      │
│  Great for: customer service,       │
│  content generation.                │
│                                     │
│  ⚙️  H100 (min) | 24GB VRAM       │
│  💰 $1.20/hr (DCP) | $3.80 (AWS)   │
│     33% cheaper              ↗      │
│                                     │
│  [Deploy Now ►]  [Details]         │
│                                     │
└─────────────────────────────────────┘
```

### Card Specifications

| Element | Spec | Rationale |
|---------|------|-----------|
| **Card Height** | 280px | Consistent grid layout, prevents overflow |
| **Title Font** | Semibold, 16px, dark gray | Clear hierarchy, scannable |
| **Description** | 14px, line-height 1.5, max 2 lines | Summarizes template value, no truncation |
| **GPU Requirement** | ⚙️ Icon + "RTX 4090" or "H100" | Visual affordance (icon), clear GPU name |
| **VRAM** | "16GB VRAM" or "24GB min" | Explicit requirement, no guessing |
| **Pricing** | "$0.42/hr (DCP) \| $1.28 (AWS)" | DCP first (primary), competitor for context |
| **Savings Badge** | "33% cheaper ↗" | Highlights competitive advantage |
| **Arabic Badge** | 🌍 Icon + "Arabic" | Signals capability for target market |
| **CTA Button** | "Deploy Now" (high contrast, primary blue) | Clear action, high affordance |
| **Secondary Link** | "Learn More" or "Details" | Directs to template-specific docs |

---

## 3. Filter UX & Taxonomy

### Sidebar Filters (Recommended Order)

**Tier 1 — Most Important (Always Visible)**
1. **Category** (radio or chips)
   - [ ] LLM Inference
   - [ ] Embedding
   - [ ] Image Generation
   - [ ] Training
   - [ ] Notebook
   - [ ] Other

2. **Arabic Capability** (toggle)
   - [ ] Arabic Models Only

**Tier 2 — Secondary (Collapsible)**
3. **VRAM Requirement** (multi-select checkboxes)
   - [ ] 8GB (Nemotron Nano, embeddings)
   - [ ] 16GB (7B models)
   - [ ] 24GB (larger models, H100 min)
   - [ ] 80GB+ (70B+ models)

4. **Price Range** (button group)
   - [ ] $ (< $0.50/hr)
   - [ ] $$ ($0.50–$1.50/hr)
   - [ ] $$$ (> $1.50/hr)

5. **Provider Tier** (optional, for future)
   - [ ] Tier A (Pre-warmed, instant-start)
   - [ ] Tier B (Warm, 5-10s cold-start)
   - [ ] Tier C (Cold, 10-30s cold-start)

---

### Filter Interaction Patterns

**Pattern 1: Search + Filters**
- Text input at top: "Search templates..."
- Search matches: template name, description, tags (e.g., "Arabic", "LLM")
- Filters narrow results in real-time

**Pattern 2: Category-First Navigation**
- Click category chip → pre-filters results
- Then apply secondary filters (VRAM, price)
- Breadcrumb: "Templates > LLM Inference > Arabic Models" (3 results)

**Pattern 3: Reset Filters**
- "Clear all filters" link if any filter active
- Shows current filter summary above results

---

## 4. Persona-Specific UX Flows

### Persona 1: Saudi Government IT Manager
**Profile:** Non-technical, budget-conscious, PDPL compliance critical, Arabic-only interface preferred

**Flow:**
1. Lands on DCP homepage
2. Sees "PDPL-Compliant Arabic AI" hero (in English, for now)
3. Clicks "Browse Arabic Templates"
4. Sees "Arabic RAG Complete" featured (no category filtering needed)
5. Reads: "All data stays in Saudi Arabia" + "Legal-grade encryption"
6. Clicks "Deploy Now" → GPU tier selection (pre-filled with H100, max VRAM)
7. Confirms → Job starts

**UX Recommendations:**
- Add **PDPL badge** to Arabic templates: "✓ PDPL Compliant"
- Highlight **data sovereignty:** "Your data never leaves the Kingdom"
- Show **compliance certifications** in template details (ISO 27001, etc.)
- Provide **Arabic translation roadmap** on homepage (signals commitment)

---

### Persona 2: Arabic NLP Startup Developer
**Profile:** Technical, wants to experiment, needs cost-effective compute, Arabic model expertise

**Flow:**
1. Lands on `/marketplace/templates`
2. Filters: Category = "LLM Inference", Arabic Capability = "Yes"
3. Sees ALLaM 7B, Falcon H1, Qwen 2.5 options
4. Clicks "Learn More" on ALLaM 7B
5. Reads benchmark: "P95 latency: 1.3s, cold-start: 9.5s"
6. Compares: "DCP: $1.20/hr vs Vast.ai: $2.50/hr"
7. Deploys on RTX 4090 (cost-optimized)
8. Receives API key + sample Python code

**UX Recommendations:**
- Show **benchmark metrics** in "Learn More" details page
- Provide **sample code** (Python, cURL) for immediate API testing
- Link to **Arabic NLP benchmarks:** How does ALLaM vs GPT-4 perform on Arabic tasks?
- Add **cost calculator:** "Deploy 10 jobs for 1 hour = $X total cost"

---

### Persona 3: Western ML Engineer (International)
**Profile:** Experienced, needs high-performance GPUs, indifferent to Arabic, cost-conscious

**Flow:**
1. Lands on template catalog
2. Filters: VRAM = "80GB+", Category = "Training"
3. Sees Nemotron 70B, Qwen 72B, Llama 70B options
4. Clicks on Nemotron 70B Training template
5. Sees: "H100 $1.85/hr, 8x parallelization, NCCL optimized"
6. Compares vs Lambda Labs ($4.70/hr) → saves $2.85/hr
7. Deploys multi-GPU training job

**UX Recommendations:**
- Show **multi-GPU scaling info:** "8x H100 for distributed training: $14.80/hr"
- Highlight **advanced features:** NCCL, PyTorch distributed, gradient checkpointing
- Provide **performance graphs:** vLLM throughput (tokens/sec) vs batch size
- Add **pre-configured training templates:** Full DDP setup included

---

## 5. Arabic/English Localization in UI

### Bilingual Card Layout (Phase 2 Roadmap)

```
┌─────────────────────────────────────────────────┐
│  ALLaM 7B Inference      | نموذج ALLaM 7B     │
│  🌍 Arabic LLM           |  🌍 نموذج عربي       │
│  Powered by vLLM         |  مدعوم من vLLM      │
│                                                 │
│  ⚙️  H100 (min)          │  24GB VRAM         │
│  💰 $1.20/hr (DCP)       │  $3.80 (AWS)       │
│     33% cheaper          │  33% أرخص          │
│  [Deploy Now]            │  [نشر الآن]         │
└─────────────────────────────────────────────────┘
```

**Bilingual Strategy:**
- **Phase 1 (Now):** English UI, Arabic model names tagged (e.g., "ALLaM" = "Arabic LLaM")
- **Phase 2 (Q2 2026):** Add Arabic labels + descriptions for top 5 templates
- **Phase 3 (Q3 2026):** Full Arabic localization of UI + docs

---

## 6. Template Grouping Strategy

### Recommended Tab/Card Organization

#### Tab 1: Featured (Home Tab)
- Arabic RAG Complete
- ALLaM 7B Inference
- Falcon H1 Chat
- SDXL Image Generation
(Curated, 4-6 templates max for decision clarity)

#### Tab 2: By Category
- **LLM Inference:** ALLaM, Falcon, Qwen, Llama, Mistral, Nemotron
- **Embedding:** BGE-M3, Arabic Embeddings
- **Reranking:** BGE Reranker, Arabic Reranker
- **Image Generation:** SDXL, Stable Diffusion
- **Notebooks:** Jupyter-GPU
- **Training:** PyTorch, LoRA, QLoRA
- **Other:** Custom Container, Ollama, Python Scientific

#### Tab 3: Arabic-Optimized
- Arabic RAG Complete (embeddings + reranker + LLM)
- ALLaM 7B Inference
- Falcon H1 Chat
- BGE-M3 Embedding
- BGE Reranker
(Filtered view, easy discovery for Arabic-focused users)

---

## 7. One-Click Deploy Button Affordance

### Deploy Button States

| State | Appearance | Action |
|-------|-----------|--------|
| **Idle** | Blue button, white text: "Deploy Now" | Click → Modal opens |
| **Hover** | Darker blue, cursor pointer | Visual feedback |
| **Clicked** | Button disables, spinner appears | Redirects to GPU tier selection |
| **GPU Selected** | Modal shows: "Review Deployment" | Button: "Confirm Deploy" |
| **Deploying** | Button shows: "Deploying..." spinner | Disable interaction |
| **Success** | Green banner: "Job #xyz deployed!" Link to job status | Redirect to job details |
| **Error** | Red banner: "Deployment failed: [reason]" | "Retry" button visible |

---

## 8. Pricing Comparison Display

### Recommended Pricing Card Format

```
Pricing Breakdown:

DCP (Our Platform)
├─ Compute: $0.42/hr ✓
├─ Data Transfer: Included
├─ Setup: Free
└─ Total: $0.42/hr

AWS (EC2 GPU)
├─ Compute: $1.28/hr
├─ Data Transfer: $0.09/hr
├─ Setup: 15 min manual
└─ Total: $1.37/hr

RunPod
├─ Compute: $0.85/hr
├─ Data Transfer: Included
└─ Total: $0.85/hr

💰 DCP savings: 33% vs AWS, 50% vs Lambda Labs
```

**Where to Display:**
- **Card-level:** Quick comparison (DCP vs AWS pricing)
- **Details page:** Full competitive breakdown
- **Pricing table:** `/marketplace/pricing` with all models + competitors

---

## 9. Cold-Start Latency Transparency

### Recommended Latency Display

For each template, show:

```
Performance Metrics:

⏱️  Cold-Start: 9.5s (model download & load)
⏱️  P95 Latency: 1.3s (after warm-up)
⏱️  Throughput: 45 tokens/sec (batch=1)

When You'll See This:
1st request → ~9.5s wait (model loading)
2nd+ requests → <1.5s response time
Batch requests → Proportional increase
```

**Where to Show:**
- Template "Learn More" details page
- Job status page (shows timeline after deployment)
- API docs (sample code with expected latency)

---

## 10. Success Criteria & Testing Checklist

### UI Implementation Testing

- [ ] All 20 templates visible on catalog page
- [ ] Filter sidebar loads without lag (<200ms)
- [ ] Category filter reduces templates (e.g., "LLM Inference" shows 6 models)
- [ ] Arabic Capability toggle shows 5-6 models
- [ ] VRAM filter works (e.g., "16GB" excludes 80GB+ models)
- [ ] Search finds templates by name + description
- [ ] "Deploy Now" button triggers GPU tier modal
- [ ] Pricing comparison displays correctly (DCP vs AWS/RunPod)
- [ ] Arabic badges (🌍) visible on ALLaM, Falcon, Qwen, etc.
- [ ] Mobile responsive: cards stack vertically, filters collapse
- [ ] Accessibility: Tab navigation works, color contrast >4.5:1
- [ ] Performance: Page load <3 seconds, filter results <500ms

### Usability Testing

- [ ] Test with Saudi government IT manager persona (PDPL focus)
- [ ] Test with Arabic NLP startup developer (filter + benchmark focus)
- [ ] Test with Western ML engineer (GPU specs + pricing focus)
- [ ] Success metric: >90% can find ALLaM 7B in <30 seconds
- [ ] Post-deploy: User receives API key + sample code

---

## 11. Competitive Benchmarking: Card Comparison

### How DCP Compares to Vast.ai UI

| Feature | DCP (Planned) | Vast.ai | Winner |
|---------|---------|---------|--------|
| **Template Pre-Configuration** | Included (vLLM, PyTorch, Jupyter all ready) | None (DIY setup) | **DCP** |
| **Arabic Model Highlight** | Featured section + badge | Not available | **DCP** |
| **Price Comparison** | Competitor pricing on card | Self-only | **DCP** |
| **Card Information Density** | 5 key fields (GPU, VRAM, price, rating, CTA) | 8+ fields (instance ID, specs, uptime) | **DCP** |
| **Filter Simplicity** | 5 filters (category, Arabic, VRAM, price, provider tier) | 20+ filters (CPU, memory, disk, ping, provider) | **DCP** |
| **One-Click Deploy** | 3-step flow (select template → GPU tier → confirm) | 6+ steps (choose instance → configure → deploy) | **DCP** |

---

## 12. Recommended Implementation Priorities

### Must-Have (Sprint 27)
1. Template grid view with all 20 templates
2. Basic category filter
3. "Deploy Now" button → GPU tier selection
4. DCP pricing on cards
5. Arabic badges on relevant models

### Nice-to-Have (Sprint 27)
6. Competitor pricing comparison (Vast.ai, RunPod)
7. Featured Arabic models section
8. VRAM requirement filter
9. Cold-start latency tooltip

### Consider for Phase 2 (Post-Launch)
10. Arabic localization (UI + descriptions)
11. User ratings/reviews on templates
12. Cost calculator (multi-job pricing)
13. Performance benchmarks (throughput, latency)
14. Provider reputation scores

---

## References

- [Template Definitions](docker-templates/)
- [Arabic Portfolio](infra/config/arabic-portfolio.json)
- [Founder Strategic Brief](docs/FOUNDER-STRATEGIC-BRIEF.md) (buyer personas, pricing)
- [Frontend Implementation](https://paperclip.ing/DCP/issues/DCP-646)

---

**Document Status:** UX Audit Complete ✓
**Next Step:** Review with DCP-646 (Frontend Developer) before implementation
