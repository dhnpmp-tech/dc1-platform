# Copywriter Sprint 27 Plan: Arabic RAG-as-a-Service Positioning

**Date:** 2026-03-23
**Agent:** Copywriter (a49f298c-b33a-4eab-821f-8e777e13c04a)
**Focus:** Activate Arabic model advantage via enterprise positioning and buyer messaging

---

## Executive Summary

Sprint 27 is about **ACTIVATION** — making the Arabic model portfolio visible and valuable to customers. The copywriter's role is to position DCP's Arabic RAG-as-a-service as an unmatched enterprise solution: PDPL-compliant, in-kingdom document processing for Saudi government, legal, and financial services. Nobody else offers this locally.

**Deliverables (Estimated 3-4 days work):**
1. **Arabic RAG Enterprise Positioning Doc** — Case studies + ROI
2. **Template Catalog Buyer Messaging** — How to position templates in marketplace UI
3. **One-Click Arabic RAG Guide** — Technical + marketing guide for enterprises
4. **Provider Recruitment Messaging (Arabic)** — Urdu/Arabic outreach for regional expansion
5. **Competitive Positioning Brief** — Why DCP vs hyperscalers for Arabic LLM workloads

---

## Priority 1: Arabic RAG Enterprise Positioning (CRITICAL)

### What
Create a high-value positioning document that frames Arabic RAG-as-a-service as the enterprise differentiator. Target: Saudi government, legal, financial services, healthcare.

### Why
- **PDPL Compliance:** Data stays in-kingdom (Vast.ai/RunPod cannot match this)
- **Cost Advantage:** 50-70% cheaper than Azure/AWS for equivalent compute
- **Market Size:** Saudi Vision 2030 allocates $100B+ to AI/tech; legal/gov sector needs secure document processing
- **Competitive Mote:** Arabic-language RAG pipeline (ALLaM + JAIS + BGE-M3) is unique locally

### Artifacts
1. **ARABIC-RAG-ENTERPRISE-POSITIONING.md** (800-1000 words)
   - 3 customer segments: Government, Legal, Finance
   - ROI case studies: $X saved vs hyperscaler, compliance gain
   - Technical messaging: PDPL-compliant in-kingdom processing
   - Acquisition messaging: How to reach decision-makers

2. **Email templates (3 versions)**
   - Government outreach: Emphasize PDPL compliance + Vision 2030 alignment
   - Legal/corporate: Emphasize confidentiality + cost savings
   - Financial services: Emphasize regulatory advantage + cost + speed

### Data to Reference
- Strategic brief: PDPL advantage, Saudi Vision 2030, MENA AI spending ($20B by 2030)
- Provider economics: RTX 4090 $145-$315/mo profit = pass 50% savings to buyers
- Buyer economics: 46-51% savings vs hyperscalers for large compute (section 5 of brief)
- Arabic models: ALLaM (7B), JAIS (13B), Qwen 2.5 (7B), Llama 3 (8B), Mistral (7B), Nemotron Nano (4B)

---

## Priority 2: Template Catalog Buyer Messaging (CRITICAL)

### What
Create the messaging framework and copy for how buyers will discover, understand, and deploy templates. This is the UI copy that makes the marketplace come alive for renters.

### Why
From founder: "Renters cannot buy what they cannot see." The template catalog (20 templates) is built but invisible. Copywriter makes it visible by:
- Naming each template in buyer language (not engineer language)
- Explaining the ROI / use case for each
- Creating browse/filter language for the UI
- Writing sample workload descriptions

### Artifacts
1. **TEMPLATE-CATALOG-BUYER-COPY.md** (1200 words)
   - Category structure: Arabic NLP, Vision, Inference, Training, Utility
   - Per-template copy: Name, description, use case, pricing positioning
   - Example: "Arabic Embeddings (BGE-M3)" → "Arabic document search. Legal contracts, government records, medical data. $X/hr. PDPL-compliant."
   - Filter/browse messaging: "Search by language," "Search by task," "Search by price tier"

2. **UI Wireframe Copy** (250 words)
   - Filter labels: "Arabic-capable," "PDPL-compliant," "Sub-$0.50/hr," "GPU tier"
   - Tooltip copy: Brief explanation of what each template does
   - CTA copy: "Deploy," "Learn more," "Contact sales"

### Templates to Cover (20 total)
**Arabic NLP:** arabic-embeddings, arabic-reranker
**Arabic LLM:** nemotron-nano, nemotron-super, qwen25-7b, llama3-8b, mistral-7b (3 copies of foundation models for different workloads)
**Vision:** sdxl, stable-diffusion
**Inference:** vllm-serve, ollama
**Training:** pytorch-gpu, pytorch-cuda, lora-finetune, qlora-finetune
**Dev:** jupyter-gpu, custom-container
**Utility:** python-scientific-compute

---

## Priority 3: One-Click Arabic RAG Marketing Guide (HIGH)

### What
Create an end-to-end guide for how enterprises deploy Arabic RAG on DCP. This is part technical reference, part sales collateral. Shows the business case and how easy it is to get started.

### Why
- Enterprises need to understand feasibility before committing
- This is a new category of product (Arabic RAG-as-a-service) that has no existing playbook
- Guide reduces friction: shows total cost, timeline, compliance, performance

### Artifacts
**ARABIC-RAG-DEPLOYMENT-GUIDE.md** (1500 words)
- **The Business Case:** ROI math, PDPL advantage, timeline (days to production)
- **Architecture:** BGE-M3 embeddings → Qwen 2.5 LLM → PDPL-compliant provider network
- **Use Cases:** Government document search, legal contract discovery, financial compliance scanning, healthcare records processing
- **Pricing:** Total cost for 1-month POC, 6-month production, 12-month contract
- **Compliance:** PDPL certification, data residency guarantee, audit trail
- **Deployment Steps:** 1. Prepare documents 2. Start RAG template 3. Ingest data 4. Run queries 5. Monitor costs
- **FAQ:** Security, performance, alternatives, support

---

## Priority 4: Provider Recruitment Messaging — Arabic (HIGH)

### What
Extend the existing provider recruitment campaign (DCP-607, completed) to reach Arabic-speaking providers in Saudi Arabia and broader MENA. New markets: Egypt, UAE, Kuwait, etc.

### Why
- 43 registered providers, 0 active = strong need to scale provider supply
- Arabic-speaking providers are a natural next market (cheaper electricity in Egypt, UAE, etc.)
- Strategic brief mentions "multi-segment recruitment" as a risk mitigation strategy

### Artifacts
1. **PROVIDER-RECRUITMENT-MENA-EXPANSION.md** (800 words)
   - Regional economics: Compare profit margins across KSA, UAE, Egypt
   - Segment strategies: Internet cafes (Cairo, Dubai), datacenters (UAE/Egypt), universities (Gulf)
   - Email sequence (7 emails): Translated into Arabic, culturally adapted
   - Success metrics: Target provider onboarding rate

2. **Sample Arabic Email** (250 words)
   - Hook: "اكسب $X شهريا من GPU الخاص بك" (Earn $X monthly from your GPU)
   - Proof: Provider earnings (profit margins for RTX 4090)
   - CTA: "تسجيل مجاني في دقيقة واحدة" (Free signup in 1 minute)

---

## Priority 5: Competitive Positioning Brief (MEDIUM)

### What
Create a battle card / competitive brief for DCP vs hyperscalers when selling to Arabic AI workload buyers. Sales tool to explain why DCP is the right choice.

### Why
- Sales team needs to articulate the DCP advantage in conversations
- Three differentiators: cost (50-70% cheaper), compliance (PDPL), Arabic-native (models + support)
- This is a technical buyer conversation, so messaging needs to be precise

### Artifacts
**DCP-VS-HYPERSCALERS-ARABIC.md** (600 words)
- **Cost:** Breakdown of why DCP is cheaper (energy arbitrage + no hyperscaler margin)
- **PDPL:** What it is, why it matters, how DCP is natively compliant
- **Arabic Models:** Why off-the-shelf foundation models aren't enough; DCP stacks Arabic-optimized models
- **Performance:** Latency, throughput, reliability claims backed by data
- **Risk:** What to ask hyperscalers to verify they match DCP on PDPL + compliance

---

## Effort Breakdown

| Priority | Task | Effort | Owner |
|----------|------|--------|-------|
| 1 | Arabic RAG positioning + emails | 1 day | Copywriter |
| 2 | Template catalog copy + UI copy | 1 day | Copywriter |
| 3 | One-click RAG deployment guide | 1 day | Copywriter |
| 4 | Provider recruitment MENA expansion | 0.5 days | Copywriter |
| 5 | Competitive positioning brief | 0.5 days | Copywriter |
| — | **Total** | **4 days** | — |

---

## Success Criteria

✅ **All 5 artifacts completed and committed**
✅ **Data consistency:** All ROI figures, pricing, GPU models verified against strategic brief
✅ **Audience clarity:** Copy speaks directly to decision-makers (gov/legal/finance buyers, provider recruiters)
✅ **Competitive differentiation:** Every doc explicitly states what makes DCP unique (PDPL + Arabic + cost)
✅ **Sales readiness:** Sales team can use artifacts to close Arabic workload deals

---

## Stakeholder Coordination

- **Template Catalog UI/UX Team:** Give them the template copy + category structure by Day 2 so they can wire the marketplace
- **Backend/Model APIs:** They need the template catalog buyer copy to understand what each endpoint should expose
- **Sales/BD Team:** They need competitive brief + Arabic RAG positioning by Day 3 to start enterprise outreach
- **Growth/Recruitment Team:** They need provider MENA expansion messaging by Day 3 to launch regional recruitment

---

## Notes

- This plan assumes templates are built but not yet exposed (per founder directive)
- All messaging must reference FOUNDER-STRATEGIC-BRIEF.md for data accuracy
- Arabic RAG positioning is the marquee differentiator — every doc should reinforce this
- This is **activation** work, not building — we're making visible what already exists

---

**Status:** Ready to Execute
**Target Completion:** 2026-03-26 (3-4 days)
**Next Step:** Create Paperclip issue SP27-013 (Copywriter Sprint 27 assignment)
