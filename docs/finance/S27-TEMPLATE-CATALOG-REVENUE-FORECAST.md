# Sprint 27: Template Catalog Revenue Forecast (6-Month)

**Date:** 2026-03-23 | **Prepared by:** Budget Analyst | **Status:** DRAFT

---

## Executive Summary

DCP has **19 production-ready docker-templates** awaiting activation in the marketplace. Once exposed to renters, these templates will enable one-click model/application deployment across three use-case categories:

1. **Model Serving** (LLMs, embeddings, diffusion)
2. **ML Development** (fine-tuning, PyTorch training)
3. **Scientific Computing** (Jupyter, Python-SciPy)

This forecast models demand across a 6-month window (Apr–Sep 2026) under three scenarios (Conservative / Base / Optimistic) and identifies the **top 5 revenue-generating templates** to prioritize in go-to-market.

**Key Finding:** Template catalog revenue is **highly dependent on provider activation rate**. With 43 registered providers at 0% active status, demand is capped by supply. Once 10–15 providers become active, template demand inflates 3–5x.

---

## 1. Template Portfolio & Demand Sizing

### Template Categories & Per-Template Demand Estimates

#### Category A: Model Serving (6 templates)

These templates pre-load Arabic LLMs + embedding models on boot. Primary use: inference APIs, RAG pipelines, embedding services.

| Template | Model | GPU Tier | Demand (hrs/mo, Base) | Est. ARR (SAR) | Rank |
|----------|-------|----------|----------------------|---|---|
| **nemotron-nano** | Nemotron Mini 4B | 1x RTX 4090 | 180 hrs | 2,520 SAR | **#1** |
| **llama3-8b** | Llama 3 8B Instruct | 1x RTX 4090 | 160 hrs | 2,240 SAR | **#2** |
| **qwen25-7b** | Qwen 2.5 7B | 1x RTX 4090 | 150 hrs | 2,100 SAR | **#3** |
| **mistral-7b** | Mistral 7B | 1x RTX 4090 | 120 hrs | 1,680 SAR | #4 |
| **arabic-embeddings** | BGE-M3 (Arabic) | 1x RTX 4090 | 100 hrs | 1,400 SAR | #5 |
| **nemotron-super** | Nemotron Super 70B | 2x H100 | 40 hrs | 6,400 SAR | #6 |

**Category A Totals (Base Case):** 750 hrs/mo → **11,340 SAR/mo ARR**

---

#### Category B: Fine-Tuning & Training (4 templates)

These templates support model fine-tuning and training workflows. Use cases: customer LLM adaptation, LoRA training, QLoRA on consumer GPUs.

| Template | Use Case | GPU Tier | Demand (hrs/mo, Base) | Est. ARR (SAR) | Rank |
|----------|----------|----------|----------------------|---|---|
| **lora-finetune** | LoRA training on 7B models | 1x RTX 4090 | 80 hrs | 1,120 SAR | #7 |
| **qlora-finetune** | QLoRA on smaller GPUs | 1x RTX 4090 | 70 hrs | 980 SAR | #8 |
| **pytorch-training** | Distributed training (2–4 GPU) | 2x A100 40GB | 50 hrs | 2,800 SAR | #9 |
| **pytorch-multi-gpu** | Large-scale training (8+ GPU) | 4x A100 80GB | 20 hrs | 3,600 SAR | #10 |

**Category B Totals (Base Case):** 220 hrs/mo → **8,500 SAR/mo ARR**

---

#### Category C: Scientific & Development (6 templates)

Jupyter notebooks, PyTorch research environments, general compute. Use cases: university research, data science, prototyping.

| Template | Use Case | GPU Tier | Demand (hrs/mo, Base) | Est. ARR (SAR) | Rank |
|----------|----------|----------|----------------------|---|---|
| **jupyter-gpu** | Interactive notebooks | 1x RTX 4090 | 120 hrs | 1,680 SAR | #11 |
| **python-scientific-compute** | NumPy/SciPy/Pandas workloads | 1x RTX 4090 | 100 hrs | 1,400 SAR | #12 |
| **vllm-serve** | Custom vLLM inference server | 1x A100 40GB | 60 hrs | 1,680 SAR | #13 |
| **sdxl** | SDXL image generation | 1x RTX 4090 | 90 hrs | 1,260 SAR | #14 |
| **stable-diffusion** | Stable Diffusion inference | 1x RTX 4090 | 80 hrs | 1,120 SAR | #15 |
| **ollama** | Ollama multi-model server | 1x RTX 4090 | 70 hrs | 980 SAR | #16 |
| **arabic-reranker** | BGE-Reranker (Arabic) | 1x RTX 4090 | 50 hrs | 700 SAR | #17 |

**Category C Totals (Base Case):** 570 hrs/mo → **10,820 SAR/mo ARR**

---

#### Category D: Catch-All (1 template)

| Template | Use Case | GPU Tier | Demand (hrs/mo, Base) | Est. ARR (SAR) | Rank |
|----------|----------|----------|----------------------|---|---|
| **custom-container** | User-provided Docker images | Flexible | 50 hrs | 1,050 SAR | #18 |

---

### **TOTAL CATALOG (Base Case): 1,590 hrs/mo → 31,710 SAR/mo ARR**

---

## 2. 6-Month Demand Forecast (Conservative / Base / Optimistic)

### Assumptions

1. **Adoption curve:** Linear growth Apr–Jun, acceleration Jul–Sep as word-of-mouth spreads
2. **Provider activation constraint:** Limited by active provider supply (currently 0/43)
   - Conservative: 3 providers active by Jun, 5 by Sep
   - Base: 8 providers active by Jun, 15 by Sep
   - Optimistic: 12 providers active by Jun, 25 by Sep

3. **Seasonality:** Q2 driven by academic year-end projects; Q3 driven by enterprise summer spend

4. **Pricing:** Fixed at DCP floor rates (14–100 SAR/hr depending on GPU)

---

### Conservative Scenario (3→5 providers)

| Month | Active Providers | Template Hrs/mo | Revenue (SAR) | Cumulative (SAR) |
|-------|------------------|-----------------|---|---|
| Apr 2026 | 2 | 200 | 3,200 | 3,200 |
| May 2026 | 3 | 350 | 5,600 | 8,800 |
| Jun 2026 | 3 | 450 | 7,200 | 16,000 |
| Jul 2026 | 4 | 600 | 9,600 | 25,600 |
| Aug 2026 | 5 | 750 | 12,000 | 37,600 |
| Sep 2026 | 5 | 800 | 12,800 | 50,400 |

**Conservative Total ARR (Sep):** **51,200 SAR (~$13,653 USD)**

---

### Base Scenario (8→15 providers)

| Month | Active Providers | Template Hrs/mo | Revenue (SAR) | Cumulative (SAR) |
|-------|------------------|-----------------|---|---|
| Apr 2026 | 4 | 600 | 10,000 | 10,000 |
| May 2026 | 8 | 1,200 | 20,000 | 30,000 |
| Jun 2026 | 8 | 1,300 | 21,600 | 51,600 |
| Jul 2026 | 12 | 1,800 | 30,000 | 81,600 |
| Aug 2026 | 15 | 2,100 | 35,000 | 116,600 |
| Sep 2026 | 15 | 2,200 | 36,600 | 153,200 |

**Base Total ARR (Sep):** **219,600 SAR (~$58,560 USD)**

---

### Optimistic Scenario (12→25 providers)

| Month | Active Providers | Template Hrs/mo | Revenue (SAR) | Cumulative (SAR) |
|-------|------------------|-----------------|---|---|
| Apr 2026 | 8 | 1,200 | 20,000 | 20,000 |
| May 2026 | 12 | 1,900 | 31,500 | 51,500 |
| Jun 2026 | 15 | 2,400 | 40,000 | 91,500 |
| Jul 2026 | 20 | 3,300 | 55,000 | 146,500 |
| Aug 2026 | 25 | 4,000 | 66,600 | 213,100 |
| Sep 2026 | 25 | 4,200 | 70,000 | 283,100 |

**Optimistic Total ARR (Sep):** **420,700 SAR (~$112,187 USD)**

---

## 3. Top 5 Revenue-Generating Templates (Go-To-Market Prioritization)

### Rank 1: nemotron-nano

| Metric | Value |
|--------|-------|
| **Monthly Demand (Base)** | 180 hrs |
| **Annual Potential (Base)** | 2,160 hrs |
| **Annual Revenue (DCP 15% take)** | 2,520 SAR |
| **Why #1** | Smallest model footprint (4B) enables 1-click deployment; highest adoption for SME inference |
| **Go-To-Market** | "Deploy your first AI API in 2 minutes" — position as entry-level LLM serving |

---

### Rank 2: llama3-8b

| Metric | Value |
|--------|-------|
| **Monthly Demand (Base)** | 160 hrs |
| **Annual Potential (Base)** | 1,920 hrs |
| **Annual Revenue (DCP 15% take)** | 2,240 SAR |
| **Why #2** | Proven multilingual LLM; strong community adoption; aligned with academic use cases |
| **Go-To-Market** | "Open-source Llama, Arabic-ready, locally hosted" — academic + startup pitch |

---

### Rank 3: qwen25-7b

| Metric | Value |
|--------|-------|
| **Monthly Demand (Base)** | 150 hrs |
| **Annual Potential (Base)** | 1,800 hrs |
| **Annual Revenue (DCP 15% take)** | 2,100 SAR |
| **Why #3** | Qwen 2.5 optimized for multilingual tasks; strong Arabic support; Chinese tech adoption (expands MENA) |
| **Go-To-Market** | "Arabic-optimized Qwen on Saudi infrastructure" — regional tech differentiation |

---

### Rank 4: nemotron-super (70B)

| Metric | Value |
|--------|-------|
| **Monthly Demand (Base)** | 40 hrs |
| **Annual Potential (Base)** | 480 hrs |
| **Annual Revenue (DCP 15% take)** | 6,400 SAR |
| **Why #4** | Highest revenue-per-hour despite low adoption; enterprise customers + reasoning-heavy tasks; NVIDIA backing |
| **Go-To-Market** | "Enterprise LLM inference without hyperscaler lock-in" — B2B high-value sales |

---

### Rank 5: arabic-embeddings (BGE-M3)

| Metric | Value |
|--------|-------|
| **Monthly Demand (Base)** | 100 hrs |
| **Annual Potential (Base)** | 1,200 hrs |
| **Annual Revenue (DCP 15% take)** | 1,400 SAR |
| **Why #5** | Core component of Arabic RAG bundle; enables search/recommendation systems; recurring/high-stickiness workloads |
| **Go-To-Market** | "Embed Arabic documents, search in Arabic. One-click." — Arabic-first positioning |

---

## 4. Template Catalog Activation Roadmap

### Phase 1: Launch (Apr 2026)
- Activate all 19 templates in marketplace
- Prioritize top-5 in landing page carousel
- Create 5 one-click quickstart guides (nemotron, llama3, qwen, embeddings, jupyter)

### Phase 2: Growth (May–Jun 2026)
- Onboard first 8 active providers via template-first pitch
- Track per-template adoption metrics in admin dashboard
- Beta test "template bundles" (e.g., Arabic RAG = embedding + reranker + LLM)

### Phase 3: Optimization (Jul–Sep 2026)
- Sunset low-adoption templates (< 20 hrs/mo)
- Upgrade high-adoption templates with pre-built benchmarks
- Launch template marketplace ratings/reviews (renter feedback)

---

## 5. Sensitivity: Impact of Provider Activation Rate

### If only 2 providers activate (worst case)

| Month | Revenue (SAR) | Impact vs. Base |
|-------|---|---|
| Apr–Jun 2026 | ~8,000 | **−80%** |
| Jul–Sep 2026 | ~14,000 | **−70%** |
| **6-Month Total** | **~30,000** | **−87%** |

**Mitigation:** Proactive provider onboarding via DCP-to-provider direct outreach; highlight template demand as proving-ground for provider revenue.

---

### If 25+ providers activate (best case)

| Month | Revenue (SAR) | Impact vs. Base |
|-------|---|---|
| Apr–Jun 2026 | ~70,000 | **+220%** |
| Jul–Sep 2026 | ~90,000 | **+150%** |
| **6-Month Total** | **~350,000** | **+158%** |

**Opportunity:** At 25+ providers, templates become a self-sustaining revenue stream. Reinvest 50% of take rate into provider loyalty rewards.

---

## 6. Financial Impact on DCP P&L

### Template Catalog Revenue Contribution (Base Case, Sep 2026)

| Line | Amount (SAR) | Notes |
|------|---|---|
| Total template spend | 36,600 | 2,200 hrs @ blended 16.6 SAR/hr avg |
| DCP take (15%) | 5,490 | Primary revenue from marketplace |
| Provider payout (85%) | 31,110 | Cost of revenue |
| **Gross margin** | **15%** | Marketplace-standard |

**6-Month Cumulative (Apr–Sep 2026, Base):**
- Total spend: 153,200 SAR
- DCP revenue: 22,980 SAR
- Provider payout: 130,220 SAR

**DCP EBITDA Impact:** +22,980 SAR (6-month), no material COGS (templates are pre-built code).

---

## 7. Go-To-Market Messaging

### Primary: Speed & Simplicity
> "Deploy state-of-the-art AI models in seconds, not weeks. No Docker knowledge required."

### Secondary: Cost
> "Nemotron, Llama, Qwen, Qwn models 70% cheaper than AWS/Azure."

### Tertiary: Arabic-First
> "The only marketplace with Arabic embeddings, rerankers, and LLMs pre-configured."

---

## 8. Success Metrics (6-Month)

| Metric | Conservative | Base | Optimistic |
|--------|---|---|---|
| **Active providers** | 5 | 15 | 25 |
| **Template activations (unique renters)** | 15 | 50 | 120 |
| **Monthly template hours (Sep)** | 800 | 2,200 | 4,200 |
| **ARR (Sep)** | 51,200 SAR | 219,600 SAR | 420,700 SAR |
| **Market traction signal** | Niche adoption | Mainstream adoption | Category leader |

---

## Next Steps

1. **Week 1 (Apr):** Activate all 19 templates in production marketplace UI
2. **Week 2–3:** Create 5 one-click quickstart tutorials (Arabic)
3. **Week 3–4:** Outreach campaign to 20 target providers with template revenue pitch
4. **Ongoing:** Monthly dashboard tracking of per-template adoption, provider churn, renter feedback

---

_Budget Analyst | Sprint 27 Financial Planning | DCP-645_
