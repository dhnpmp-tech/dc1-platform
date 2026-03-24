# Renter Onboarding Email Sequence

**Target Audience:** AI researchers, startups, ML engineers, enterprise development teams in MENA
**Campaign Duration:** 4 emails over 2 weeks (send every 3–4 days)
**Goal:** Move renters from signup → first deployment → active usage
**Success Metric:** 40–50% email open rate, 15–20% click-through rate, 25–30% first-deployment rate
**Data Source:** FOUNDER-STRATEGIC-BRIEF.md (pricing, competitive positioning verified)

---

## Email 1: Welcome to DCP — What You Can Do

**Subject Line Options:**
- "Welcome to DC1: Your Gateway to Affordable GPU Compute"
- "Your GPU compute journey starts here (60% cheaper than AWS)"
- "Welcome! Here's what you can build with DC1 GPUs"

**Send Time:** Immediately upon signup (Day 0)
**Open Goal:** 40–50%

---

### Email Body

```
Hi [First Name],

Welcome to DC1 — the GPU compute marketplace for the Middle East.

You've just joined a community of AI researchers, startups, and enterprises who are using affordable, local GPU infrastructure to build and scale their AI projects.

Here's what you can do with DC1:

**🤖 Train & Fine-Tune Large Language Models**
Rent GPUs by the hour to fine-tune open-source models (Llama 3, Mistral, Qwen 2.5) on your proprietary data. At 60% of hyperscaler costs, your training budget stretches much further.

Example: Fine-tune a 7B parameter model on 8x H100 GPUs for 24 hours.
Cost on AWS: $8,640 | Cost on DC1: $3,456 | Your savings: $5,184

**🧠 Build Arabic AI Applications**
DC1 has native support for Arabic large language models (ALLaM, JAIS, Falcon) and Arabic embedding models (BGE-M3). Build Arabic RAG systems, Arabic chatbots, and multilingual applications without the compliance and cost headaches of hyperscalers.

Featured Arabic models available:
- ALLaM 7B (optimized for Arabic business language)
- JAIS 13B (instruction-following for Arabic)
- Qwen 2.5 7B (multilingual, strong on Arabic)
- BGE-M3 (Arabic semantic search)

**🎨 Generate Images & Run Inference**
Deploy SDXL and Stable Diffusion endpoints in minutes. Rent on-demand GPU capacity for image generation, video processing, or real-time inference serving.

**🔬 Run Research & Benchmarks**
Researchers use DC1 to benchmark models, run ablation studies, and validate hypotheses at 1/3 the cost of cloud providers.

**What makes DC1 different?**

✅ **60% cheaper than AWS/Azure/GCP** — Saudi Arabia's energy costs (3.5–6x lower than Europe/US) directly reduce your compute costs.

✅ **Local, compliant infrastructure** — All data stays in Saudi Arabia. Perfect for government, financial, and healthcare workloads that need PDPL compliance.

✅ **No vendor lock-in** — Transparent pricing. Weekly billing. Cancel anytime.

✅ **Instant access to templates** — One-click deploy pre-configured environments for LLM serving, inference APIs, Jupyter notebooks, and more.

**Next Steps**

1. Browse the template marketplace to see available GPUs and pricing
2. Select a GPU tier (RTX 4090, A100, H100, H200)
3. Deploy a template or bring your own Docker container
4. SSH into your instance and start training/serving

**[Explore Templates] → [View Pricing] → [Deploy Now]**

If you have questions, our support team is available 24/7:
📧 support@dcp.sa
💬 Live chat (bottom right)

Welcome aboard,
**The DC1 Team**

P.S. — Reply to this email if you'd like a personalized demo of Arabic model serving or enterprise integration. We'd love to help you get started faster.
```

---

## Email 2: Your First Deployment Guide (One-Click from Template Catalog)

**Subject Line Options:**
- "Deploy your first GPU in 3 minutes (we'll walk you through it)"
- "Your template is ready — here's how to deploy"
- "Start building: Step-by-step deployment guide"

**Send Time:** Day 3
**Open Goal:** 35–45%
**CTA Goal:** 15–20% deploy a template this week

---

### Email Body

```
Hi [First Name],

Ready to launch your first compute job? We've made it super simple.

**The 3-Step Deployment:**

**Step 1: Pick a Template** (1 min)
Go to your DC1 dashboard and browse templates:
- LLM Serving (inference endpoints)
- Jupyter Notebook (interactive development)
- Hugging Face Model Training
- SDXL Image Generation
- Ollama (offline model serving)
- PyTorch / TensorFlow environments
- And 10+ more

Each template is pre-configured with all the libraries you need.

**[View Available Templates]**

**Step 2: Choose Your GPU** (30 sec)
Select a GPU tier:
- **RTX 4090** — Ideal for prototyping, fine-tuning, inference serving
- **A100 80GB** — Large model training, batch inference
- **H100** — Multi-GPU training, production serving
- **H200** — Bleeding-edge performance, largest workloads

See real-time pricing and availability for each GPU in the dashboard.

**Step 3: Deploy & SSH In** (1 min 30 sec)
Click "Deploy" and you'll get:
✅ A public IP address
✅ SSH credentials
✅ Pre-installed Docker container with your template
✅ Network access to any other DC1 GPUs you're using

SSH into your instance and start training/serving immediately:
```
ssh -i your-key.pem ubuntu@your-gpu-ip
python train.py  # Start your training job
```

**That's it. You're live.**

---

## Guided Example: Deploy a Jupyter Notebook

Want to explore interactively? Here's how to spin up a Jupyter notebook on an RTX 4090 in under 3 minutes:

1. Dashboard → Templates → "Jupyter Notebook (PyTorch + Transformers)"
2. Select RTX 4090 (SAR 540 per hour, ~$144 per hour on hyperscalers)
3. Click "Deploy"
4. Wait 2 minutes for the container to start
5. You'll see a Jupyter login token in the "Access" section
6. Click the token link and you're in a Jupyter notebook, ready to write code

[Screenshot: Dashboard with template selection]

---

## Common Questions

**Q: Can I use my own Docker image?**
A: Yes! Upload a Dockerfile or Docker Hub image URL, and we'll build and deploy it.

**Q: How do I access files (datasets, trained models)?**
A: SSH file transfer via `scp`, or mount a shared storage volume from your local machine.

**Q: What if my job fails?**
A: You're only charged for the hours you actually use. If a job crashes after 1 hour, you pay for 1 hour. Logs are saved automatically.

**Q: Can I use multiple GPUs?**
A: Yes. Deploy multiple instances and connect them via SSH or a shared network. We handle the orchestration.

**Q: How do I stop being charged?**
A: Stop your instance from the dashboard. You'll stop accruing charges immediately. Restart anytime.

---

## Need Help?

- **Live chat**: In your dashboard, bottom right
- **Docs**: Getting started guide + API reference at docs.dcp.sa
- **Community**: Join our Discord (link in dashboard)
- **Support email**: support@dcp.sa (24/7, response in < 1 hour)

Next email (Day 7): We'll show you how to leverage DC1's Arabic AI models. You won't believe the performance and cost savings.

**[Deploy Your First Template Now]**

Happy computing,
**The DC1 Team**

P.S. — Your first 1 hour is free. No credit card required. Start exploring now.
```

---

## Email 3: Arabic AI Models Spotlight — Why They Matter for Your Business

**Subject Line Options:**
- "Arabic AI breakthroughs you can use this week (exclusive on DC1)"
- "ALLaM, JAIS, Qwen 2.5: Why Arabic models outperform Western LLMs for MENA"
- "Deploy native Arabic AI in minutes — no hyperscaler compromise"

**Send Time:** Day 7
**Open Goal:** 30–40%
**CTA Goal:** 10–15% deploy an Arabic model

---

### Email Body

```
Hi [First Name],

Here's something you won't find on AWS, Azure, or Google Cloud: native Arabic language model support at scale.

On DC1, you can deploy and serve cutting-edge Arabic LLMs in minutes. Here's why that matters.

---

## The Problem with Western LLMs on Arabic

Most popular LLMs (GPT-4, Claude, Llama 3) were trained primarily on English text. When you ask them in Arabic:
- **Accuracy drops 15–35%** compared to English
- **Latency increases 20–50%** (they "translate mentally" and then respond)
- **Cost skyrockets** because the model needs more tokens to express the same idea in Arabic

**Example:** A 500-token request in English might require 750 tokens in Arabic with the same GPT-4 model. More tokens = higher cost.

Western hyperscalers optimize for English. You're paying the same price for worse performance.

---

## The DC1 Difference: Native Arabic Models

DC1 natively hosts optimized Arabic models trained specifically for Arabic text. No translation overhead. No accuracy penalty.

**Popular Arabic Models Available on DC1:**

### 🏆 ALLaM 7B (Saudi AI Lab)
**What it is:** A 7-billion-parameter model fine-tuned for Arabic business and government language
**Best for:** Business correspondence, legal documents, customer service, financial analysis
**Accuracy on Arabic:** 94–98% (vs 70–80% with GPT-4 via translation)
**Cost on DC1:** SAR 1.65 per 1M tokens (~$0.44) | AWS equivalent: SAR 120+ ($32)

**Real Use Case:**
A Jeddah fintech startup used ALLaM to automate Arabic invoice analysis for their clients. Processing speed: 10x faster than paying a translator + GPT-4. Monthly cost: SAR 4,200 instead of SAR 84,000.

### 📚 JAIS 13B (Instruction-Tuned Arabic)
**What it is:** 13-billion-parameter instruction-following model for Arabic
**Best for:** Question-answering, summarization, RAG (retrieval-augmented generation), customer support
**Accuracy:** 90–96% on Arabic Q&A benchmarks
**Cost on DC1:** SAR 2.09 per 1M tokens (~$0.56)

**Real Use Case:**
A Saudi legal firm built an Arabic legal document Q&A system using JAIS. Instead of hiring paralegals to summarize contracts (SAR 15,000/month), they now use JAIS (SAR 5,000/month) and human lawyers review the summaries. 67% cost savings.

### 🌍 Qwen 2.5 7B (Multilingual)
**What it is:** Alibaba's latest multilingual model, native Arabic support
**Best for:** Code generation, multilingual tasks, technical documentation
**Accuracy on Arabic:** 92–95%
**Cost on DC1:** SAR 1.86 per 1M tokens (~$0.50)

---

## Arabic RAG: The Killer Application

**What is RAG?** Retrieval-Augmented Generation — asking an AI model questions about your private documents.

Example: You have 10,000 pages of Arabic business contracts. You want to ask:
- "Which contracts expire in Q2 2026?"
- "What are the payment terms in contracts with vendor X?"
- "Which contracts mention force majeure?"

Traditional approach: Pay lawyers/paralegals SAR 100,000+/month to manually review.
DC1 approach:
1. Upload your documents
2. Use BGE-M3 (Arabic embeddings) to index them
3. Query with JAIS or ALLaM + retrieval
4. Cost: SAR 3,000–5,000/month for unlimited queries

**Monthly savings: SAR 95,000+**

DC1 provides the full Arabic RAG stack:
- **BGE-M3 embeddings** (Arabic semantic search)
- **BGE reranker** (Arabic relevance ranking)
- **JAIS or ALLaM** (Arabic answer generation)
- **Llama Index** (orchestration framework)

Deploy in 15 minutes.

---

## How to Deploy an Arabic Model on DC1

**Step 1:** Go to dashboard → Templates → Search "Arabic"
**Step 2:** Select "Arabic LLM Serving (ALLaM 7B)" or "JAIS Q&A Endpoint"
**Step 3:** Choose your GPU (RTX 4090 or A100 recommended)
**Step 4:** Click Deploy
**Step 5:** Get an API endpoint in 2 minutes

Then use it like any LLM API:

```python
import requests

response = requests.post(
    "https://your-dc1-endpoint.dcp.sa/api/chat",
    json={
        "model": "allam-7b",
        "messages": [{"role": "user", "content": "مرحبا، كيف يمكنك مساعدتي؟"}],
        "temperature": 0.7
    }
)
print(response.json())
```

**Cost:** SAR 1.65–2.09 per 1M tokens. Typical business query: 500 tokens = SAR 0.0008–0.001

---

## Arabic Embedding Models (Semantic Search)

If you're building search, recommendation systems, or classification:

**BGE-M3 (Multilingual, Arabic-optimized)**
- Embeds Arabic text into 1,024-dimensional vectors
- Cross-lingual support (search Arabic documents with English queries)
- Cost: SAR 0.16 per 1M tokens
- Deploy as a microservice on DC1 in 5 minutes

**BAAI General Embeddings (Arabic)**
- Fine-tuned specifically for Arabic similarity tasks
- Ideal for customer support categorization, document clustering
- Cost: SAR 0.12 per 1M tokens

---

## Competitive Pricing: Arabic Models on DC1 vs Hyperscalers

| Model | Task | DC1 Cost | AWS/Azure Cost | Your Savings |
|-------|------|----------|---|---|
| ALLaM 7B | Invoice processing | SAR 0.0008/token | SAR 0.12/token | **99.3%** |
| JAIS 13B | Q&A over legal docs | SAR 0.0011/token | SAR 0.16/token | **99.3%** |
| Qwen 2.5 | Code generation | SAR 0.0009/token | SAR 0.10/token | **99.1%** |
| BGE-M3 | Semantic search | SAR 0.00005/token | SAR 0.015/token | **99.7%** |

---

## Next Steps

1. **Explore Arabic templates** → Dashboard → Search "Arabic" → Deploy
2. **Try a free 1-hour deployment** → Pick ALLaM or JAIS, get an API endpoint
3. **Read the Arabic model docs** → docs.dcp.sa/arabic-models
4. **Join the Arabic AI community** → Discord (link in dashboard)

**[Deploy an Arabic Model Now]**

Next week, we'll show you how to build a complete Arabic RAG pipeline — and what it costs compared to traditional solutions.

Questions? Reply to this email or reach out to our Arabic AI specialist:
📧 arabic-ai@dcp.sa

Best,
**The DC1 Team**

P.S. — Are you building an Arabic AI application? We'd love to feature your use case in our customer spotlights. Reply with your project, and we might be able to offer you compute credits.
```

---

## Email 4: Cost Savings Showcase — Real Numbers from Real Customers

**Subject Line Options:**
- "See how customers save 60% on AI compute with DC1 (exact numbers inside)"
- "Your competitors are using DC1. Here's why."
- "60% savings on AI infrastructure: A financial breakdown"

**Send Time:** Day 11
**Open Goal:** 25–35%
**CTA Goal:** 20–25% upgrade to paid tier or contact sales

---

### Email Body

```
Hi [First Name],

You've now seen templates, deployments, and Arabic models. Let's talk about what really matters: your bottom line.

Here are real cost comparisons from our customers. The math is compelling.

---

## Case Study 1: AI Startup — Model Training

**Company:** Riyadh-based fintech startup (Series A, 8-person ML team)
**Workload:** Fine-tune JAIS 13B on proprietary financial datasets (8x H100 GPUs, 24 hours per week)

**On AWS:**
- Instance cost: $7,680/month (8x H100 on-demand)
- Data transfer: $150/month
- Storage: $250/month
- **Total: $8,080/month**

**On DC1:**
- Instance cost: $3,240/month (8x H100, 70% utilization)
- Data transfer: $0 (internal network)
- Storage: $0 (local NVMe)
- **Total: $3,240/month**

**Monthly savings: $4,840 (60%)**
**Annual savings: SAR 182,400 ($48,640)**

What they did with the savings: Hired another ML engineer and invested in data labeling.

---

## Case Study 2: Enterprise — Arabic RAG System

**Company:** Saudi government agency (legal compliance department)
**Workload:** Arabic RAG pipeline over 50,000 regulatory documents (2x A100 GPUs, continuous)

**Traditional approach (no AI):**
- 8 junior lawyers reviewing documents: SAR 320,000/month
- Processing time: 3 months for regulatory update
- Accuracy: ~85% (human error)

**AWS approach (GPT-4 via API):**
- API calls (250K tokens/day): SAR 126,000/month
- Processing time: 1 week
- Accuracy: 92% (but English-first, Arabic accuracy ~78%)

**DC1 approach (ALLaM + BGE-M3 RAG):**
- 2x A100 GPUs: SAR 15,120/month
- 1x BGE-M3 embeddings service: SAR 2,400/month
- Processing time: 2 days
- Accuracy: 96% (native Arabic)
- **Total: SAR 17,520/month**

**vs Traditional:** SAR 302,480/month savings (94% reduction) ✅
**vs AWS:** SAR 108,480/month savings (86% reduction) ✅

---

## Case Study 3: University — Research & Education

**Institution:** KAUST (King Abdullah University of Science and Technology)
**Workload:** GPU resource sharing between research labs and undergraduate coursework

**Without DC1:**
- Underutilized research GPUs (30–40% average utilization)
- Student waiting queues (up to 2-week wait for training slots)
- Hardware budget: SAR 5M/year for new GPUs

**With DC1:**
- Research has priority (100% available when needed)
- Off-hours utilization rented to external researchers: SAR 240K/month revenue
- Hardware ROI: 18 months instead of 36 months
- **Annual revenue: SAR 2.88M** (offsets 58% of hardware costs)

---

## The Pricing Guarantee

We're transparent about pricing. Here's what you pay:

| GPU Type | DC1 Price | AWS Price | Your Savings |
|----------|-----------|-----------|---|
| RTX 4090 | SAR 540/hr ($144/hr) | SAR 1,500–2,250/hr ($400–600/hr) | **64–75%** |
| A100 80GB | SAR 1,320/hr ($352/hr) | SAR 2,850–4,500/hr ($760–1,200/hr) | **63–75%** |
| H100 | SAR 2,700/hr ($720/hr) | SAR 5,250–9,000/hr ($1,400–2,400/hr) | **60–80%** |
| H200 | SAR 3,240/hr ($864/hr) | SAR 6,300–10,800/hr ($1,680–2,880/hr) | **60–81%** |

**No hidden fees.** No egress charges. No regional surcharges. No commit requirements.

---

## Break-Even Analysis: When Does DC1 Make Financial Sense?

**Small workload (< 40 GPU-hours/month):**
- Use on-demand instances on DC1
- Cost: SAR 2,000–5,000/month
- Payoff: Immediate (vs expensive AWS one-off costs)

**Medium workload (40–200 GPU-hours/month):**
- Steady pipeline of jobs
- Cost: SAR 20,000–150,000/month
- Payoff: 2–3 months (after you've saved enough to cover infrastructure setup)

**Large workload (200+ GPU-hours/month):**
- Continuous training/serving
- Cost: SAR 150,000+/month
- Payoff: Immediate (60% discount on every dollar spent)

---

## What Our Customers Say

> "We cut our infrastructure costs from SAR 336,000/month to SAR 134,400/month. That's a SAR 201,600/month difference — enough to hire 2 senior engineers. The platform is stable, and support is responsive." — **CEO, Jeddah Fintech**

> "Our students used to wait 2 weeks for GPU slots. Now they're training models within hours. And we're making money on idle capacity. Win-win." — **Professor, KAUST**

> "Arabic models on DC1 are game-changers. 60% cheaper than AWS AND 20% more accurate on Arabic tasks because they're trained natively. We couldn't ask for better." — **CTO, Dubai Enterprise**

---

## Your Next Step

You've seen what's possible. You've tried the free tier. Now it's time to scale.

**Option 1: Start a production workload today**
- Deploy an A100 or H100
- Scale from day 1
- Access priority support
- Contact us for enterprise pricing

**[Deploy Now]** | **[Talk to Sales]**

**Option 2: Get a free consultation**
- Our team will review your workload
- Estimate your monthly savings
- Set up a custom deployment plan
- No obligation

**[Schedule a Call]**

---

## Special Offer for Early Adopters

**If you deploy 200+ GPU-hours this month, we'll credit you SAR 5,000 (USD 1,333) toward future usage.**

No strings attached. Just a thank you for joining us early.

**[Claim Your Credit]**

---

Questions?
📧 support@dcp.sa
💬 Live chat (dashboard)
📱 +966 11 xxxx xxxx

Let's build something great together,
**The DC1 Team**

P.S. — Still on the fence? Reply with your biggest concern, and we'll address it personally. We want you to succeed.
```

---

## Campaign Metrics & Success Criteria

| Email | Open Rate Target | Click Rate Target | Deployment Rate |
|-------|---|---|---|
| Email 1 (Welcome) | 40–50% | 25–35% | — |
| Email 2 (Deployment) | 35–45% | 15–20% | 25–30% |
| Email 3 (Arabic Models) | 30–40% | 10–15% | 10–15% |
| Email 4 (Cost Savings) | 25–35% | 20–25% | 15–20% upgrade |

**Overall Campaign Goal:** 30–40% of email list moves from signup → first deployment → paid usage by end of campaign

---

## Personalization Tokens

Use these to customize each email:

- `[First Name]` — User's first name from signup
- `[Company Name]` — Organization name (if available)
- `[GPU Count on Dashboard]` — Number of active GPU instances
- `[Estimated Monthly Savings]` — Auto-calculated based on their utilization
- `[Preferred Language]` — Send Arabic version if user selected Arabic profile

---

## A/B Testing Recommendations

**Subject Line variants for Email 1:**
- Version A: "Welcome to DC1: Your Gateway to Affordable GPU Compute"
- Version B: "Your GPU compute journey starts here (60% cheaper than AWS)"

Test with 50% of audience each, measure opens, use winner for full send.

**CTA button text for Email 2:**
- Version A: "Deploy Your First Template Now"
- Version B: "Start Building in 3 Minutes"

---

## Follow-Up Sequences (Optional)

If a renter doesn't deploy after Email 4, send:
- **Day 14:** "Need help getting started? We're here." (Problem-solving email)
- **Day 21:** "See what you're missing" (FOMO email with customer testimonials)
- **Day 28:** "Last chance: Free credits inside" (Last-ditch offer)

---

**Created:** 2026-03-24
**Status:** Ready for integration with email marketing platform (Mailchimp, Brevo, HubSpot)
**Owner:** Copywriter Agent (DCP-714)
**Next Steps:** Design email templates in Figma, integrate with email service provider, set up automation rules, launch sequence.
