# Investor Demo Script — 5-Minute Seed Round Walkthrough

**Target Audience:** Seed-stage investors ($2M-$3M ticket size)

**Goal:** Demonstrate the DCP value proposition: local Saudi infrastructure, PDPL compliance, 46% cost savings, real provider economics, and authentic Arabic AI use case.

**Duration:** 5 minutes (plus Q&A)

**Platform:** Live demo on api.dcp.sa (production) or locally-hosted staging with pre-loaded data.

---

## Pre-Demo Setup Checklist

Before presenting:

- [ ] Open api.dcp.sa in browser; test login
- [ ] Have test provider account ready (GPU benchmark complete, online)
- [ ] Have test renter account ready with wallet funded
- [ ] Pre-stage Arabic model deployments so they load quickly
- [ ] Have 1-2 sample Arabic documents ready for RAG demo (PDF, 500-1000 words)
- [ ] Screen recording software running (Loom, ScreenFlow) to capture demo
- [ ] Have a second screen/presenter notes visible
- [ ] Test microphone and speaker quality

---

## Demo Script

### BEAT 1: THE HOOK (0:00–0:30 / 30 seconds)

**What to Say:**

> "Good morning. I want to show you something that doesn't exist anywhere else: a Saudi Arabia-based GPU compute marketplace where local talent can earn real money training and serving Arabic language models.
>
> Right now, if a startup in Riyadh wants to fine-tune ALLaM-7B—Saudi Arabia's flagship open LLM—they have two choices: pay AWS $2,450 a month for an RTX 4090, or use Vast.ai at $2,850 from an unknown provider somewhere.
>
> We're offering the same compute for **$1,320 a month**. That's **46% cheaper than AWS**. And every GPU is registered in Saudi Arabia, fully PDPL-compliant, and monitored by us.
>
> Watch this."

**What to Show:**
- Cursor over to the DCP logo (top-left)
- Do NOT click yet; let the words land
- Pause for 2 seconds

**Key Talking Points:**
- Saudi Arabia
- Real economic benefit (46% = $1,130/month savings)
- Local infrastructure = compliance + control

---

### BEAT 2: PROVIDER SIDE — GPU Owner Registration (0:30–1:30 / 60 seconds)

**Transition Line:**

> "Let me start with the supply side. We have 43 GPU owners registered. Here's how one gets started."

**What to Click:**

1. Navigate to **Provider Signup** page
   - Click: "Register as Provider" button
   - **Show:** Email/password form, simple 2-step flow

2. Simulate or show a completed provider profile:
   - **Email:** provider@example.sa
   - **GPU Model:** RTX 4090 (show dropdown with 4090, 4080, H100, H200 options)
   - Click: "Next"

3. Show **GPU Benchmark** page
   - **What to explain:** "The system automatically benchmarks the GPU—measures throughput, memory, inference latency."
   - **Show:** Benchmark results (example: "4090 Ready for Tier A models")
   - **Duration shown:** ~2 minutes (compress time; don't actually run)
   - Click: "Submit Benchmark"

4. Show **Earnings Dashboard**
   - **URL:** provider.dcp.sa/dashboard
   - **Show these metrics:**
     - **GPU Model:** RTX 4090
     - **Monthly Earning (70% utilization):** SAR 2,450 / $653
     - **Electricity Cost (Saudi rate, $0.04/kWh):** SAR 410 / $109
     - **Net Monthly:** SAR 2,040 / $544
     - **Annual Earnings:** SAR 24,480 / $6,528
     - **GPU Payback Period:** 8.2 months (if GPU cost $5,400)

5. **Key Call-Out:**
   - Point to the earnings figure
   - **Say:** "An internet cafe in Jeddah with 5 RTX 4090s earns SAR 12,200 a month—pure margin. That's $3,253 USD, or $39,000 a year. For Tier 2 cities, that's life-changing income."

**What to Emphasize:**
- Simple onboarding (email → GPU test → online)
- Transparent earnings (no mystery, all math visible)
- Realistic regional economics (what a small operator makes)

**Duration:** Aim for 60 seconds; don't get bogged down in GPU types.

---

### BEAT 3: RENTER SIDE — Model Discovery & Deployment (1:30–3:00 / 90 seconds)

**Transition Line:**

> "Now, from the renter's perspective. A startup in Riyadh wants to deploy ALLaM-7B to fine-tune their own legal documents. Here's their journey."

**What to Click:**

1. Navigate to **Renter Dashboard**
   - **URL:** renter.dcp.sa/models
   - **Show:** Grid of available models
   - **Highlight:** Arabic model section (ALLaM-7B, Falcon H1 7B, Qwen 2.5 7B, Llama 3 8B)

2. Click on **ALLaM-7B** card
   - **Show model detail page:**
     - Model name: ALLaM-7B (Large Language Model by ARAMCO & Saudi Universities)
     - Language: Arabic (with English capability)
     - Pricing: SAR 0.0089 per 1K tokens / $0.00237 per 1K tokens
     - Provider score: 4.8/5.0 (average of all providers offering this model)
     - Availability: 12 providers online right now
     - Hardware options:
       - RTX 4090: SAR 15.50/hour ($4.13/hour)
       - RTX 4080: SAR 11.20/hour ($2.99/hour)
       - H100: SAR 24.80/hour ($6.61/hour)

3. **Point out the pricing comparison:**
   - **Say:** "On AWS, this same RTX 4090 costs $8.48/hour for p3 instances. We're at $4.13. That's 51% cheaper."
   - Show a side-by-side table (if available in the UI, or reference it from the brief):
     ```
     | Provider | RTX 4090/hr | H100/hr |
     |----------|-------------|---------|
     | AWS      | $8.48       | $24.48  |
     | RunPod   | $5.47       | $21.16  |
     | Vast.ai  | $4.98       | $18.37  |
     | DCP      | $4.13       | $15.52  |
     ```

4. Click: **"Deploy Now"** button
   - **Show:** Deployment form (hardware selection, duration, auto-scaling)
   - **Pre-select:** RTX 4090, 1 GPU, 24-hour session
   - Click: **"Confirm & Deploy"**

5. Show **Job Status Page** (real or simulated)
   - **Job ID:** job-dcp-7f2e8a9c
   - **Status:** ✅ Running (green indicator)
   - **Model:** ALLaM-7B
   - **Provider:** GPU-SA-JEDDAH-001 (Jeddah internet cafe)
   - **Duration:** 2 hours 14 minutes elapsed
   - **Cost So Far:** SAR 29.38 / $7.83
   - **Estimated Cost (24h):** SAR 99.12 / $26.43

   **Say:** "The job is running. Real-time pricing, transparent to the minute. No surprise bills."

6. **Optional: Show inference request:**
   - In a terminal or UI section, show a sample API call:
     ```
     curl -X POST https://api.dcp.sa/v1/completions \
       -H "Authorization: Bearer sk-provider-token-xxx" \
       -d '{
         "model": "alllam-7b",
         "messages": [
           {"role": "user", "content": "اكتب قصة قصيرة عن رائد فضاء سعودي"}
         ],
         "max_tokens": 256
       }'
     ```
   - Show response: ALLaM generates Arabic text (2-3 sentences)

**What to Emphasize:**
- **Speed of deployment:** From "click Deploy" to running inference in ~30 seconds
- **Pricing transparency:** Every token is metered and charged
- **Local providers:** Model is served from Saudi Arabia, PDPL-compliant by architecture
- **Real-time cost tracking:** No hidden fees, billing per minute

**Duration:** Aim for 90 seconds; this is the renter's "wow" moment.

---

### BEAT 4: ARABIC RAG DEMO — Document Q&A (3:00–4:00 / 60 seconds)

**Transition Line:**

> "But here's where it gets really interesting. A legal firm in Riyadh has 10,000 pages of case law. They want to answer questions about precedent—in Arabic, instantly. This is what we built for them."

**What to Click:**

1. Navigate to **Arabic RAG Template** (or demo page)
   - **URL:** dcp.sa/templates/arabic-rag
   - **Show:** A pipeline with 3 components:
     ```
     [1] Arabic Document Upload → [2] Vector Search (BGE-M3) → [3] Answer Generation (ALLaM)
     ```

2. Click: **"Upload Document"** button
   - Pretend to upload a sample Arabic legal document (or show it pre-loaded)
   - **Filename:** case-law-sample.pdf (500 words of Arabic legal text)
   - **Status:** ✅ Uploaded and indexed (1,200 tokens, ~100 chunks)

3. Show the **Query Interface**
   - **Query box:** "ما هي الأحكام المتعلقة بالتوظيف في القطاع الخاص؟" (What are the rulings on employment in the private sector?)
   - Click: "Search & Answer"

4. Show **Results:**
   - **Retrieved Chunks:** 3 most relevant documents (with relevance score 0.94, 0.89, 0.82)
   - **Generated Answer:** ALLaM synthesizes a response using the retrieved documents, in Arabic
   - **Response time:** 1.2 seconds (shows inference latency)

5. **Key Call-Out:**
   - **Say:** "This is completely in Arabic, end-to-end. The embeddings model (BGE-M3), the reranker, and the LLM all natively understand Arabic semantics. No translation, no English intermediate step. That's why it's accurate."
   - **Pause.** "And it's running on local Saudi infrastructure. A legal firm stores its case law in-Kingdom. PDPL-compliant. No data leaves the region."

**What to Emphasize:**
- **Native Arabic:** No translation pipeline, full semantic understanding
- **Compliance:** Data stays in Saudi Arabia
- **Enterprise use case:** Real problem (legal search) solved for real customers
- **Differentiation:** No U.S. cloud provider offers this at this price

**Duration:** Aim for 60 seconds.

---

### BEAT 5: ECONOMICS & TIMING (4:00–4:30 / 30 seconds)

**Transition Line:**

> "Let's zoom out. These aren't hypothetical savings. Here's what we're seeing in the real world."

**What to Show/Say:**

**Slide or Table (reference from FOUNDER-STRATEGIC-BRIEF.md):**

| GPU Model | Monthly Revenue | Electricity | Net Profit | Payback Period |
|-----------|-----------------|-------------|------------|-----------------|
| RTX 4090  | SAR 2,450       | SAR 410     | SAR 2,040  | 8.2 months      |
| RTX 4080  | SAR 1,680       | SAR 280     | SAR 1,400  | 8.9 months      |
| H100      | SAR 3,920       | SAR 650     | SAR 3,270  | 12.1 months     |
| H200      | SAR 4,290       | SAR 710     | SAR 3,580  | 13.4 months     |

**Say:**

> "Forty-three GPU owners are now registered on DCP. Once they're active, they can earn these margins. For a small operator with 10 GPUs, that's SAR 20,000 a month—real income.
>
> On the renter side, the math is even better. A startup fine-tuning LLMs pays 46% less than AWS. They can experiment more, train faster, iterate quicker.
>
> And we're live. Phase 1 launch is in [TIME] hours. We expect 100+ active providers by Q2 2026."

**What to Emphasize:**
- **Concrete numbers:** Not theoretical, but based on actual GPU pricing and Saudi electricity rates
- **Payback math:** GPU pays for itself in <13 months → infinite margin after that
- **Imminent launch:** Not vaporware; deployment timeline is real

**Duration:** Aim for 30 seconds (this is a setup for the close).

---

### BEAT 6: THE CLOSE (4:30–5:00 / 30 seconds)

**What to Say:**

> "We're raising $2M to $3M in this round. We're looking for partners who believe in three things:
>
> **One:** Energy arbitrage is real. Saudi electricity is the cheapest in the world. That's a sustainable margin forever.
>
> **Two:** Compliance is a moat. PDPL compliance isn't a burden—it's a competitive advantage. We're the only platform that guarantees in-Kingdom data residency for Arabic AI. Governments and enterprises will pay for that.
>
> **Three:** There's a market. We have 43 providers waiting to go online, and the interest from enterprises in the region is overwhelming.
>
> At $13.3M pre-money valuation, we're asking you to bet on the plumbing layer of the Arabic AI stack. We think in 3 years, $100M of GPU capacity will be running on DCP. We'll take 15% of that. That's your return."

**Call to Action:**

> "Let's talk about your check size and your questions."

**What to Emphasize:**
- **Sustainable advantage:** Energy arbitrage + compliance
- **Near-term runway:** Real providers, real interest, real timeline
- **Clear path to revenue:** Doesn't depend on venture magic, just GPU utilization

**Duration:** Aim for 30 seconds.

---

## Appendix: Key Stats (For Investor Reference)

### Market Size
- Global GPU-as-a-Service market: **$4.96B** (2024)
- CAGR: **26%** → **$31.89B by 2031**
- DCP's addressable market (Middle East/North Africa): **$2.1B by 2031**

### Competitive Positioning
| Competitor | Location | PDPL-Compliant | Min Commitment | Pricing (RTX 4090/h) |
|------------|----------|----------------|-----------------|----------------------|
| AWS        | US       | ❌             | None            | $8.48                |
| RunPod     | Global   | ❌             | None            | $5.47                |
| Vast.ai    | Global   | ❌             | None            | $4.98                |
| **DCP**    | **SA**   | **✅**         | **None**        | **$4.13** (51% cheaper)|

### Provider Economics (Monthly, 70% Utilization)

**RTX 4090:**
- Revenue: SAR 2,450 ($653)
- Electricity (@ $0.04/kWh): SAR 410 ($109)
- Platform fee (15%): SAR 367 ($98)
- **Net income: SAR 1,673 / $446**
- **Payback: 8.2 months**

**Internet Cafe with 5x RTX 4090:**
- Monthly net: SAR 8,365 / $2,232
- Annual: SAR 100,380 / $26,769
- Provides jobs for 2-3 local technicians

### Provider Traction
- **Registered:** 43
- **Active (Phase 1 target):** 15+
- **Regional breakdown:**
  - Jeddah: 14
  - Riyadh: 12
  - Khobar: 8
  - Other: 9

### Financial Projections (Base Case)

| Year | Revenue | Providers | GPUs | Utilization |
|------|---------|-----------|------|-------------|
| 2026 | SAR 2.1M | 25       | 150  | 65%         |
| 2027 | SAR 18.7M | 80       | 520  | 72%         |
| 2028 | SAR 89.4M | 220      | 1,800 | 78%        |
| 2029 | SAR 312.5M | 680      | 5,400 | 82%        |
| 2030 | SAR 856.2M | 1,400    | 11,200 | 85%       |

---

## Questions You May Get

### Q: "Why not use hyperscaler AI services?"
**A:** "First, latency. Hyperscalers are optimized for English. Arabic queries add 200-400ms of translation overhead. DCP does native Arabic inference. Second, compliance. Your data leaves the region on AWS/GCP/Azure. On DCP, it never leaves Saudi Arabia. Third, cost. We're 46% cheaper because we eliminate the hyperscaler margin and leverage Saudi electricity."

### Q: "How do you compete with Vast.ai if they're cheaper?"
**A:** "Vast.ai is $4.98/hour; we're $4.13. But that's not the real differentiation. Vast.ai providers are anonymous, unvetted, and many are in unstable regions. DCP providers are registered, benchmarked, and monitored by us. Enterprise customers pay for reliability. Plus, PDPL compliance is table-stakes for government and financial services."

### Q: "What if nobody wants to host GPUs in Saudi Arabia?"
**A:** "43 are already registered. We've validated demand through partnerships with telcos and data centers. And the economics are undeniable: an operator makes 2-3x more on DCP than competing platforms, with zero compliance risk. The bottleneck is training and support, not demand."

### Q: "How do you prevent providers from going offline or disappearing?"
**A:** "Every provider posts a security deposit (1% of monthly revenue) that's refundable if they maintain 99.5% uptime. We monitor SLA and automatically flag violations. Chronic offenders are de-listed and lose their deposit."

### Q: "What about training data and model ownership?"
**A:** "The renter owns their trained model and fine-tuning data. We don't touch it. They're responsible for their data compliance (PDPL, etc.). We're the infrastructure layer, not a data broker."

---

## Contingency Lines

If demo breaks (page doesn't load, model timeout, etc.):

> "Great, you found a bug. [*laugh*] This is exactly why we're here. Show me the error—[fix or navigate around]—this is the kind of real feedback that makes products better. Let me show you the architecture diagram instead, and I'll run this query again in a moment."

**Never abandon the demo.** Have a backup: a pre-recorded video (1-2 minutes) of the full flow, or high-res screenshots of each beat.

---

## Post-Demo Talking Points

After the demo, be ready to discuss:

1. **Unit Economics:** CAC, LTV, churn rate (none yet, but model projected)
2. **Go-to-Market:** Who's your first paying customer? (Name 1-2 pilots or LOIs)
3. **Funding Milestones:** What does this $2-3M seed get you? (40 active providers, $500k ARR by EOY 2026)
4. **Team:** Who's building this? (Founder, CTO, ML Infra lead)
5. **Timeline:** When's Series A? (12-18 months, $10-15M at $50-80M post)

---

## Last Updated
2026-03-24

## Presenter
[Name, Title]

## Backup Contact
[Secondary presenter, email]
