# Renter Onboarding Email Sequence

**Purpose:** Convert sign-ups into active paying customers. Renters who deploy a job in their first session have 3x higher retention.

**Timing:** 5 emails over 5+ days, plus triggered email after first deployment.

---

## Email 1: Welcome 🚀 (Immediate - Day 0)

**Subject:** You're in. Here's what you can do with DCP.

**Preview:** Deploy AI models on the fastest, cheapest infrastructure in the region.

**Body:**

Welcome to DC1.

We've built a marketplace where you can deploy AI models—any model—on real GPUs in the region. No hyperscaler markups. No waiting lists. Just connect, deploy, run.

Here's what you get:
- **Instant GPU access:** RTX 4090, H100, H200 — available now
- **Real savings:** 33-51% cheaper than AWS, RunPod, or Lambda
- **No lock-in:** Pay per job, move anytime
- **Local execution:** Data stays in Saudi Arabia (PDPL compliant)

Whether you're prototyping, training, or serving production models, we've got the GPUs and the economics.

Your first job is waiting. Let's go.

**CTA:** Browse Templates

---

## Email 2: Getting Started ⚡ (Day 1)

**Subject:** Deploy your first model in 5 minutes (no credit card tricks)

**Preview:** Here's the fastest path from zero to running inference.

**Body:**

Deployment shouldn't be hard. It isn't on DC1.

We've pre-built templates for the models engineers actually use: Arabic LLMs (ALLaM, JAIS), open-source LLMs (Llama, Mistral, Qwen), embeddings, image generation, and custom containers. Pick a template, add your GPU, hit deploy.

The full flow:
1. Pick a template (2 minutes)
2. Select GPU tier (1 minute)
3. Deploy (instant)
4. Start making API calls

Your model runs exactly where you want it, with zero infrastructure overhead.

If you get stuck, our developer quickstart walks you through the whole process with code examples (Python, bash, JavaScript) and real cost tables so you know exactly what you'll pay.

**CTA:** See the Developer Quickstart

---

## Email 3: Arabic AI & PDPL Compliance 🇸🇦 (Day 3)

**Subject:** Native Arabic models are now live (and PDPL compliant)

**Preview:** Deploy ALLaM, JAIS, and the full Arabic RAG stack on Kingdom hardware.

**Body:**

If you're building for Arabic-speaking users or processing Arabic documents, this is what you've been waiting for.

DC1 hosts a complete Arabic AI stack:
- **Arabic LLMs:** ALLaM 7B, JAIS 13B, Falcon H1, Qwen2.5 Arabic
- **Retrieval & Embedding:** BGE-M3 (multilingual with Arabic excellence), Arabic rerankers
- **PDPL Compliant:** Everything runs on GPUs in Saudi Arabia. Your data never leaves the Kingdom.

This is critical for government agencies, legal firms, financial services, and enterprises that need to process sensitive documents locally and compliantly.

And here's the kicker: the total cost of an Arabic RAG pipeline (embeddings + reranker + LLM) on DC1 is 60% less than spinning it up on AWS or Azure.

You can now build RAG applications for Arabic text at hyperscaler scale with 10x better unit economics. That's the energy arbitrage advantage—same hardware, Saudi electricity rates.

**CTA:** Explore Arabic Models

---

## Email 4: The Math 💰 (Day 5)

**Subject:** Here's exactly how much you'll save

**Preview:** Real numbers on what DC1 costs vs AWS, RunPod, and Lambda.

**Body:**

Let's talk money.

If you're running a single A100 GPU for AI development:
- AWS: ~$2,160/year
- RunPod: ~$1,920/year
- DC1: ~$1,292/year

**You save $868-$868/year. (33% cut.)**

Scale that up:
- 8x H100 for ML teams? **Save $16,512/year (39% less).**
- 32x H100 for enterprises? **Save $77,512/year (46% less).**
- Render farm (16x RTX 4090)? **Save $14,208/year (51% less).**

The source is straightforward: Saudi industrial electricity costs 3.5-6x less than EU rates. Same GPUs, same performance, just lower electricity bills and no hyperscaler margin tax.

That's not a discount. That's economics.

**CTA:** Calculate Your Savings

---

## Email 5: First Job Delivered ✅ (Triggered after first successful deployment)

**Subject:** Your first job ran. Here's what's possible next.

**Preview:** Congrats on shipping. Now let's talk about scaling.

**Body:**

Your model is live on DC1. You just went from zero to inference in one session.

That's what separates hobby projects from real products.

Now that you've felt how fast deployment is here, here's what most engineers do next:
- **Add GPU resources.** Multi-GPU inference, distributed training, batch jobs—all available now.
- **Integrate Arabic models.** If you haven't tried ALLaM or JAIS yet, they're worth an experiment. Arabic LLMs are rapidly improving and DC1 has the full stack.
- **Go production.** Once you're confident, move your real workloads here. The savings compound fast.

One more thing: if you're GPU-rich and want to monetize idle capacity, we have a provider program. You can earn $145-$3,250/month per GPU depending on tier. That's how some of our best customers started—they ran their own jobs, then started renting spare capacity and covered their own costs.

Keep shipping.

**CTA:** Explore Provider Program (or: Run Another Job)

---

## Implementation Notes

### Email Metadata

| Email | Trigger | Delay | Send Channel |
|-------|---------|-------|--------------|
| Email 1 | Account signup complete | Immediate (< 5 min) | Email |
| Email 2 | Email 1 sent, no deployment | Day 1, 08:00 UTC | Email |
| Email 3 | Email 2 sent, no deployment | Day 3, 09:00 UTC | Email |
| Email 4 | Email 3 sent, no deployment | Day 5, 10:00 UTC | Email |
| Email 5 | First job deployment success | Immediate (< 30 sec) | Email |

### Personalization Fields

- `{user_first_name}` — available from signup form
- `{gpu_tier_interest}` — captured during template selection, if available
- `{estimated_monthly_cost}` — calculated based on template + GPU selection
- `{savings_vs_competitor}` — 33-51% or specific calculation if known

### A/B Testing Recommendations

**Subject Line Variants (Email 1):**
- Control: "You're in. Here's what you can do with DCP."
- Variant A: "One-click AI model deployment. No hyperscaler markups."
- Variant B: "Deploy models 50% cheaper than AWS. Starting now."

**CTA Text Variants (Email 2):**
- Control: "See the Developer Quickstart"
- Variant A: "Deploy Your First Model (5 min)"
- Variant B: "Get Started Now"

### Analytics & Tracking

Track for each email:
- **Open rate** — baseline engagement
- **Click-through rate** — CTA effectiveness
- **Conversion to deployment** — activation metric (primary KPI)
- **Time-to-first-job** — urgency signal
- **Retention 7d/30d** — customer lifetime value indicator

### Voice Guidelines

- Direct, confident tone (no corporate jargon)
- Lead with outcomes, not features
- Use concrete numbers from FOUNDER-STRATEGIC-BRIEF.md
- Short sentences, active voice
- Arabic/localization: Email 3 should reference Arabic models prominently for local market penetration
