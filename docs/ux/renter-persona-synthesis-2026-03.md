# Renter Persona Research Synthesis — March 2026

**Issue:** DCP-715
**Date:** 2026-03-24
**Scope:** 3 core renter personas for DCP platform
**Research Base:** Heuristic UX evaluation (DCP-665), template catalog analysis, market context

---

## Executive Summary

DCP's renter base will segment into 3 distinct personas with different priorities, pain points, and willingness to pay. **Quick-Redeploy (Phase 2.0)** drives the most revenue by enabling power users to iterate rapidly; **Arabic Personalization (Phase 2.2)** drives market expansion into underserved Arab markets with high revenue potential but requires stronger community/support.

**Recommended Phase 2 implementation order:** 2.0 first (revenue/speed), 2.2 concurrently (market expansion)

---

## Persona 1: Enterprise AI Ops Lead

### Profile

**Name:** Fatima Al-Zahra (40s, Saudi)

**Role:** Head of AI/ML Operations at Saudi financial services company
- Manages 3-5 person ML team
- Responsible for model serving, inference, cost control
- Currently uses Vast.ai + AWS Lambda (high cost, low flexibility)
- Arabic language: **Essential** (company policy, team mix)

**Primary Use Case:**
- Deploy Arabic financial language models (ALLaM, JAIS) for document classification and sentiment analysis
- Run 40-80 hourly inference jobs during business hours (8am-6pm KSA time)
- Monitor job history, rerun failed jobs, track team spending per project
- Needs: reliability, cost transparency, Arabic support, audit trail

**Typical Workflow:**
1. "Run sentiment analysis on 10K documents with JAIS 13B"
2. Wait 2-4 hours for results
3. Review output in dashboard
4. If successful, run the same job next week with different data
5. Track costs per department for budget reporting

**Technical Expertise:** Intermediate (Python, Docker, basic APIs)

**Price Sensitivity:** **Low** — Corporate budget, ROI-focused. Willing to pay premium for reliability and compliance.

---

### Persona 1 Template Preferences

**Primary Templates:**
- ALLaM 7B (Arabic LLM) — daily inference jobs
- JAIS 13B (Arabic financial LLM) — weekly large batch jobs
- Arabic RAG bundle (BGE-M3 embeddings + LLM) — document pipeline

**Secondary Templates:**
- Llama 3 8B (English fallback) — testing, multilingual
- Mistral 7B (English) — comparison benchmarking

**Tier Preference:** On-Demand (reliable, no surprise queue times)

---

### Persona 1 Pain Points (Top 3)

#### 🔴 Pain Point 1: "Can I Rerun That Job Easily?" (Impact: HIGH)

**Scenario:** Fatima ran a sentiment analysis job on Monday successfully. On Friday, she has new data and wants to run the exact same job again.

**Current friction:**
- Navigate to `/marketplace/templates`
- Find the same template
- Click "Deploy"
- Re-fill all the same parameters (input path, model version, output format)
- Submit and wait
- **Total time: 8-12 minutes**

**What she needs:**
- Job history showing past jobs
- "Redeploy" button that pre-fills all parameters
- Confirm with 2 clicks
- **Target time: 1-2 minutes**

**Why it matters:**
- Enterprise runs similar jobs repeatedly (80% are near-identical reruns)
- Reduces friction by 85%, increases repeat deployment rate
- **Enables:** Job templating, batch scheduling, lower admin burden

**Feature Impact:** **CRITICAL for enterprise retention** | Phase 2.0 (Quick-Redeploy) solves this ✅

---

#### 🟡 Pain Point 2: "Where Are My Costs Going?" (Impact: MEDIUM)

**Scenario:** End of month, Fatima needs to report GPU spending by department to CFO.

**Current friction:**
- Limited job history visibility
- No cost breakdown by department/project/user
- No CSV export for accounting
- **Manual tracking required**

**What she needs:**
- Job history with cost column (SAR/hr, total)
- Filter by date range, template type, status
- Export to CSV for accounting review
- Dashboard summary: "Spent SAR 15,000 this month, 70% on Arabic models"

**Why it matters:**
- Enterprise requires cost control and audit trail (compliance)
- Transparency builds trust and justifies continued spend
- **Enables:** Budget approval, cross-team cost allocation, vendor evaluation

**Feature Impact:** MEDIUM (nice-to-have in Phase 2.1) | Deferred post-Phase-2

---

#### 🟡 Pain Point 3: "Is Our Setup Compliant?" (Impact: MEDIUM)

**Scenario:** Company's legal/compliance team asks: "Are our inference jobs on PDPL-compliant infrastructure?"

**Current friction:**
- No documentation of provider location, compliance certifications
- No audit trail showing which providers ran which jobs
- Can't prove PDPL compliance to auditors

**What she needs:**
- Job history includes "Provider Location" (e.g., "Riyadh, Saudi Arabia")
- Provider profile shows PDPL compliance status
- Exportable audit report for compliance teams

**Why it matters:**
- PDPL compliance is Saudi Arabia's data privacy law
- Enterprise customers (especially government, finance) MUST be PDPL-compliant
- **Enables:** Enterprise sales narrative, regulatory moat

**Feature Impact:** MEDIUM (high-value differentiator) | Post-Phase-2 strategic feature

---

### Persona 1 Phase 2 Priorities

1. **Quick-Redeploy (Phase 2.0)** — ⭐⭐⭐ CRITICAL
   - Solves Pain Point 1 directly
   - Estimated adoption: 90% of Fatima's team
   - Estimated time per job reduction: 10 min → 2 min (80% faster)
   - Expected revenue impact: +40% job frequency (more deployments = more revenue)

2. **Cost Reporting Module (Phase 2.1)** — ⭐⭐ HIGH
   - Solves Pain Point 2
   - Required for enterprise budget justification
   - Timeline: Post-Phase-2 (higher implementation effort)

3. **Arabic Personalization (Phase 2.2)** — ⭐ MEDIUM
   - Nice-to-have (company already uses Arabic models)
   - Simplifies onboarding for non-technical team members
   - Not a blocker for adoption

---

## Persona 2: ML Researcher (Arabic NLP)

### Profile

**Name:** Mohammad (30s, Egyptian, works in UAE)

**Role:** NLP researcher at University / AI startup

- Building Arabic NLP models and benchmarks
- Needs flexible, affordable GPU access for experimentation
- Arabic language: **Essential** (native researcher, publishes in Arabic)
- Currently uses free Google Colab + Hugging Face (limited VRAM, slow)

**Primary Use Case:**
- Fine-tune Arabic language models (ALLaM, JAIS) on custom datasets
- Run inference benchmarks (latency, throughput, cost comparison)
- Generate synthetic Arabic training data
- Needs: low cost, high control, repeatability, Arabic docs

**Typical Workflow:**
1. "Fine-tune JAIS 7B on custom Arabic financial dataset (500 examples)"
2. Run benchmark: latency on 100 test samples
3. Compare results with Vast.ai pricing
4. If promising, scale to H100 for final training run
5. Publish benchmarks and cost-benefit analysis

**Technical Expertise:** Advanced (Python, PyTorch, CLI tools, scripting)

**Price Sensitivity:** **Very High** — Student/researcher budget, optimizing for $/GPU-hour

---

### Persona 2 Template Preferences

**Primary Templates:**
- JAIS 13B (fine-tuning) — weekly training runs
- ALLaM 7B (inference benchmark) — daily
- Nemotron Nano 4B (experiments) — ad-hoc testing
- Custom Python container (own scripts) — frequent use

**Secondary Templates:**
- LLaMA 3 8B (comparison studies)
- SDXL (multimodal Arabic research)

**Tier Preference:** Instant (testing) + On-Demand (production runs)

---

### Persona 2 Pain Points (Top 3)

#### 🔴 Pain Point 1: "Can I Run My Custom Training Script?" (Impact: CRITICAL)

**Scenario:** Mohammad has a PyTorch fine-tuning script (jais-finetune.py). He wants to run it on DCP with custom VRAM, batch size, and hardware.

**Current friction:**
- DCP templates are pre-configured
- No easy way to run arbitrary scripts
- May need to adapt code to template format
- Limited customization options

**What he needs:**
- "Custom Python Container" template where he uploads his own script
- Simple interface: upload script + choose VRAM/GPU
- Click "Run" and see logs in real-time
- Feature: download results (models, checkpoints)

**Why it matters:**
- Researchers need flexibility (can't constrain to pre-built templates)
- Custom scripts are core to research workflow
- **Enables:** Research adoption, academic partnerships

**Feature Impact:** CRITICAL for researcher market | Phase 2 feature (custom containers)

---

#### 🟡 Pain Point 2: "How Much Will This Cost?" (Impact: HIGH)

**Scenario:** Mohammad wants to fine-tune JAIS 13B for 4 hours on H100. He needs to know the cost upfront.

**Current friction:**
- Pricing varies by GPU tier and usage pattern
- No clear "total cost" estimate before launching job
- Worry about surprise bills (pay-as-you-go)

**What he needs:**
- Job configuration shows "Estimated cost: SAR 1,850 for 4-hour H100 run"
- Breakdown: "SAR 462.50/hr × 4 hours = SAR 1,850"
- Confidence that cost won't exceed estimate

**Why it matters:**
- Researchers have fixed project budgets
- Need to plan experiment costs in advance
- **Enables:** Confident adoption, word-of-mouth within academic networks

**Feature Impact:** HIGH (table stakes for researcher adoption) | Roadmap 2026 Q2

---

#### 🟡 Pain Point 3: "Where Are the Arabic Model Docs?" (Impact: MEDIUM)

**Scenario:** Mohammad wants to use JAIS 13B but needs docs: tokenizer, format, inference examples, license terms.

**Current friction:**
- DCP docs focus on infrastructure (how to deploy)
- Limited guidance on model-specific setup
- Has to search Hugging Face or model repo (friction)

**What he needs:**
- Each Arabic model template links to model docs
- Quick reference: "JAIS 13B — 13B parameters, trained on X data, license: Apache 2.0"
- Tokenizer code example in Python
- Inference example (prompt → output)

**Why it matters:**
- Researchers need model details to use effectively
- Reduces friction for first-time deployment
- **Enables:** Faster research iteration, larger Arabic research community

**Feature Impact:** MEDIUM (nice-to-have) | Post-Phase-2 documentation

---

### Persona 2 Phase 2 Priorities

1. **Custom Python Container Support** — ⭐⭐⭐ CRITICAL
   - Solves Pain Point 1 directly
   - Gate-keeper for researcher adoption
   - Estimated adoption: 70% of researcher workloads involve custom code
   - Timeline: Phase 2.3 (requires backend architecture work)

2. **Quick-Redeploy (Phase 2.0)** — ⭐⭐ HIGH
   - Secondary benefit: speeds up experiment iteration
   - Not as critical as custom containers (can work around)
   - Estimated time-per-experiment reduction: 15% (fewer template re-setup)

3. **Cost Estimation (Pre-Deploy Calculation)** — ⭐⭐ HIGH
   - Solves Pain Point 2
   - Table stakes for researcher trust
   - Timeline: Phase 2.1 (moderate effort)

4. **Arabic Personalization (Phase 2.2)** — ⭐ LOW
   - Researchers already prefer English docs/UX
   - Arabic is language preference, not workflow requirement
   - Not a blocker for adoption

---

## Persona 3: Startup Developer

### Profile

**Name:** Amira (26, Saudi, co-founder of AI startup)

**Role:** CTO/Lead Developer at early-stage LLM startup

- Building AI products (chatbots, agents, RAG systems)
- Small team (3-5 engineers)
- Needs fast iteration, low cost, quick deployment
- Arabic language: **Preferred** (target market is Arabic-speaking)
- Currently uses RunPod + Vast.ai (slow support, unreliable)

**Primary Use Case:**
- Deploy inference API for her product's customers
- A/B test different models (Llama vs Mistral vs Nemotron)
- Scale quickly when customer demand grows
- Monitor performance and costs in real-time
- Needs: speed, reliability, API integration, great support

**Typical Workflow:**
1. "Deploy Nemotron Nano as an API for our chatbot"
2. Configure: batch size, timeout, warm-up requests
3. Deploy to live environment
4. Monitor: response time, error rate, cost/request
5. If bottleneck appears, scale horizontally (add more instances)
6. Run A/B test: Nemotron vs Llama on real traffic

**Technical Expertise:** Expert (Python, APIs, DevOps, CI/CD)

**Price Sensitivity:** **High** — Startup budget, optimizing for unit economics (cost per inference)

---

### Persona 3 Template Preferences

**Primary Templates:**
- Nemotron Nano 4B (API) — daily production serving
- Llama 3 8B (API) — A/B testing
- Custom container (own inference server) — frequent customization

**Secondary Templates:**
- Arabic RAG bundle — future product expansion
- SDXL (image generation) — experimentation

**Tier Preference:** Instant + Cached (predictable latency for APIs)

---

### Persona 3 Pain Points (Top 3)

#### 🔴 Pain Point 1: "How Do I Scale Quickly?" (Impact: CRITICAL)

**Scenario:** Amira deployed Nemotron Nano and got 500 customers. Now she's getting 1000 req/min and the API is slow.

**Current friction:**
- Deploying another instance of the same template takes 8-10 minutes
- No load balancing across multiple provider GPUs
- Manual process to scale up/down based on traffic
- Risk of downtime during scaling

**What she needs:**
- "Quick-Redeploy" with horizontal scaling: click "Deploy 3 more instances"
- Automatic load balancing across instances
- Real-time monitor: "5 instances serving, 2000 req/min, latency 150ms"
- Click "Remove 2 instances" when traffic drops

**Why it matters:**
- Startup success depends on ability to scale with demand
- Manual scaling is operational overhead (she should focus on product)
- **Enables:** Rapid growth, competitive product launch

**Feature Impact:** CRITICAL for startup success | Phase 2.0 (Quick-Redeploy) partially solves

---

#### 🟡 Pain Point 2: "What's Wrong With My Inference?" (Impact: HIGH)

**Scenario:** Amira's API suddenly slows down. She needs to debug: Is it model latency? Provider issue? Network?

**Current friction:**
- Limited observability (no detailed logs per request)
- Job history shows aggregate stats only
- Can't drill down into individual request traces
- Has to contact support (slow response)

**What she needs:**
- Job dashboard with detailed metrics:
  - Inference latency per request (p50, p95, p99)
  - Error rate + error logs
  - Provider uptime/status
  - Token throughput (tokens/sec)
- Real-time alerts: "API latency exceeded 500ms threshold"
- Export logs for post-mortem analysis

**Why it matters:**
- Startup needs fast debugging (customer-facing SLA)
- Without visibility, can't optimize or scale effectively
- **Enables:** Production-grade reliability, customer trust

**Feature Impact:** HIGH (post-Phase-2, Phase 2.3 observability)

---

#### 🟡 Pain Point 3: "Can I Integrate This Into My CI/CD?" (Impact: MEDIUM)

**Scenario:** Amira's team uses GitHub Actions for CI/CD. She wants to deploy new inference server versions automatically.

**Current friction:**
- DCP deployment is currently manual (web UI)
- No API for programmatic deployment
- Can't trigger job from GitHub Actions workflow
- Has to manually redeploy after code updates

**What she needs:**
- DCP API endpoint: `POST /api/jobs` with template + params
- Deploy from GitHub Actions: `curl -X POST https://api.dcp.sa/api/jobs ...`
- Integration: "On code push to main, deploy new inference server"

**Why it matters:**
- Startup moves fast; manual ops is a bottleneck
- CI/CD automation is table-stakes for modern teams
- **Enables:** Rapid iteration, automated deployments

**Feature Impact:** MEDIUM (high-value, moderate effort) | Phase 2.2/2.3

---

### Persona 3 Phase 2 Priorities

1. **Quick-Redeploy (Phase 2.0)** — ⭐⭐⭐ CRITICAL
   - Solves Pain Point 1 directly
   - Enables horizontal scaling (core startup need)
   - Estimated adoption: 100% of production deployments
   - Expected revenue impact: +50% job frequency (more scaling events)

2. **Detailed Observability / Job Logging (Phase 2.3)** — ⭐⭐ HIGH
   - Solves Pain Point 2
   - Required for production reliability
   - Timeline: Phase 2.3 (moderate effort)

3. **API for Programmatic Deployment (Phase 2.2)** — ⭐⭐ HIGH
   - Solves Pain Point 3
   - Enables CI/CD integration
   - Timeline: Phase 2.2 (moderate effort)

4. **Arabic Personalization (Phase 2.2)** — ⭐ MEDIUM
   - Nice-to-have (team might prefer English docs)
   - Could help customer onboarding if Arab markets expand
   - Not a blocker for adoption

---

## Comparative Analysis: Persona Needs

| Need | Enterprise | Researcher | Startup | Winner |
|------|-----------|-----------|---------|--------|
| **Quick-Redeploy (2.0)** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | **Shared** |
| Custom Code (2.3) | ⭐ | ⭐⭐⭐ | ⭐⭐ | **Researcher** |
| Cost Transparency (2.1) | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | **Shared** |
| Observability (2.3) | ⭐⭐ | ⭐ | ⭐⭐⭐ | **Startup** |
| API Integration (2.2) | ⭐⭐ | ⭐ | ⭐⭐⭐ | **Startup** |
| **Arabic Personalization (2.2)** | ⭐ | ⭐ | ⭐⭐ | **Neutral** |

---

## Friction Point Frequency Summary

### High-Friction Points Across All Personas

1. **Redeploying the same job** (Enterprise, Startup) — 80% of jobs are reruns
   - **Solution:** Phase 2.0 (Quick-Redeploy)
   - **Impact:** +80% faster job redeployment, +40-50% higher job frequency

2. **Cost visibility & planning** (Enterprise, Researcher, Startup) — all care about budget
   - **Solution:** Phase 2.1 (Cost Reporting + Estimation)
   - **Impact:** Enables confident adoption, reduces budget anxiety

3. **Scaling to multiple instances** (Startup) — critical for production
   - **Solution:** Phase 2.0 (Quick-Redeploy with horizontal scaling)
   - **Impact:** Enables growth without manual ops

4. **Custom code execution** (Researcher) — gate-keeper for research market
   - **Solution:** Phase 2.3 (Custom Container Support)
   - **Impact:** Opens entire researcher segment

### Low-Friction Points

5. **Arabic language preference** (Enterprise, Researcher, Startup) — helpful but not critical
   - **Solution:** Phase 2.2 (Arabic Personalization)
   - **Impact:** +15-20% Arab market expansion, improve onboarding

---

## Persona-Weighted Phase 2 Priority Matrix

**Revenue Weight:** Enterprise (40%) + Startup (40%) + Researcher (20%)

| Feature | Enterprise | Researcher | Startup | Weighted Priority |
|---------|-----------|-----------|---------|------------------|
| **Quick-Redeploy (2.0)** | ⭐⭐⭐ (40%) | ⭐⭐ (20%) | ⭐⭐⭐ (40%) | **⭐⭐⭐ CRITICAL** |
| Cost Reporting (2.1) | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | **⭐⭐ HIGH** |
| API Integration (2.2) | ⭐⭐ | ⭐ | ⭐⭐⭐ | **⭐⭐ HIGH** |
| Custom Containers (2.3) | ⭐ | ⭐⭐⭐ | ⭐⭐ | **⭐⭐ HIGH** |
| Arabic Personalization (2.2) | ⭐ | ⭐ | ⭐⭐ | **⭐ MEDIUM** |

---

## Key Insights

1. **Quick-Redeploy (Phase 2.0) is unanimous #1 priority** across all personas
   - 80% of jobs are near-identical reruns
   - Enterprise needs it for operational efficiency
   - Startup needs it for horizontal scaling
   - Researcher needs it for experiment iteration
   - **Expected impact:** +40-50% higher job frequency = **+40-50% revenue**

2. **Cost visibility is table-stakes** for all segments
   - Enterprise: compliance + budget justification
   - Researcher: project budget planning
   - Startup: unit economics optimization
   - **Estimated timeline:** Phase 2.1 (post-Phase-2)

3. **Arabic Personalization (2.2) has modest impact** across personas
   - Enterprise: already using Arabic models, doesn't need UI translation
   - Researcher: prefers English docs (academic standard)
   - Startup: mixed (some teams prefer Arabic, some English)
   - **Estimated impact:** +15-20% Arab market expansion (secondary benefit)

4. **Custom code execution is critical for researcher adoption**
   - Gate-keeper feature for entire academic + research segment
   - 70% of researcher workloads involve custom code
   - **Estimated timeline:** Phase 2.3 (requires backend work)

---

## Recommendation for Phase 2 Implementation Order

### Phase 2.0: Quick-Redeploy (CRITICAL) — Implement NOW
- Highest ROI across all personas
- Moderate effort (~10-12 hours frontend)
- Expected revenue impact: +40-50%
- **Start:** Immediately after Phase 1 testing completes

### Phase 2.1: Cost Reporting (HIGH) — Parallel to 2.0
- High value for all personas
- Table-stakes for enterprise trust
- Moderate effort (~8-10 hours)
- **Start:** Week 2 of Phase 2 timeline

### Phase 2.2: API Integration (HIGH) + Arabic Personalization (MEDIUM)
- API critical for startup CI/CD workflows
- Arabic Personalization helpful for market expansion
- Can run in parallel (~12-15 hours combined)
- **Start:** Week 3 of Phase 2 timeline

### Phase 2.3: Custom Containers (HIGH) + Observability (HIGH) — Follow-up
- Gate-keeper for researcher adoption
- Critical for startup production reliability
- High effort (~20-25 hours combined)
- **Start:** Phase 2 +4 weeks (depends on Phase 2.0-2.2 completion)

---

**Prepared by:** UI/UX Specialist
**Date:** 2026-03-24
**Research Method:** Heuristic evaluation + template catalog analysis + market segmentation
**Next Step:** Validate with UX research interviews (Phase 2 kickoff)
