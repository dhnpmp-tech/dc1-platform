# DCP Renter Engagement & Retention Communications

## Renter Acquisition Email (Broad reach)

**Subject:** Run AI at 35–50% Cheaper (Get 50 SAR Free)

**From:** launch@dcp.sa

**Body:**

Hi builder,

DCP launches today—the GPU compute marketplace built for Arabic AI.

**What you get:**
- 50 SAR free credit (no payment card needed)
- API that works like RunPod/OpenAI
- Models from Mistral (8 SAR/hr) to Nemotron Super (45 SAR/hr)
- Results in 30 seconds
- 35–50% cheaper than alternatives

**3-minute setup:**

```bash
# Get API key + 50 SAR credit
curl -X POST https://dcp.sa/api/dc1/renters/register \
  -d '{"name": "Your Team", "email": "you@company.com"}' | jq -r '.renter_api_key'

# Run your first inference
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: YOUR_KEY" \
  -d '{
    "model": "mistralai/Mistral-7B",
    "prompt": "Explain Vision 2030",
    "max_tokens": 128
  }'

# Check results
curl https://dcp.sa/api/dc1/jobs/JOB_ID \
  -H "x-renter-key: YOUR_KEY"
```

**Why DCP is 35–50% cheaper:**
- Saudi energy arbitrage (lower hosting costs)
- Decentralized provider competition (no middleman)
- Pay only for actual compute (no reserved capacity)

**Models:**
| Model | VRAM | Price | Speed |
|-------|------|-------|-------|
| Nemotron Nano | 8 GB | 5 SAR/hr | ⚡⚡⚡ |
| Mistral 7B | 16 GB | 8 SAR/hr | ⚡⚡ |
| Qwen 2.5 (Arabic) | 16 GB | 9 SAR/hr | ⚡⚡ |
| Llama 3 8B | 16 GB | 9 SAR/hr | ⚡ |
| Nemotron Super 70B | 80 GB | 45 SAR/hr | 🧠 |
| SDXL | 8 GB | 12 SAR/hr | 🖼️ |

**Get started:**
https://dcp.sa/renter/register

**FAQ:**
Q: How much will my first job cost?
A: ~0.01 SAR (~$0.003). That's 67% cheaper than RunPod for the same job.

Q: Do I need to change my code?
A: Minimal. API is OpenAI-compatible. Usually just swap the endpoint and add `x-renter-key` header.

Q: What if a job fails?
A: Auto-failover to another provider. You only pay for time it actually runs.

Q: Is my data safe?
A: Yes. All jobs run in Saudi Arabia with PDPL compliance. No data leaves the region.

**Migration guides:**
- From RunPod: https://dcp.sa/docs/guides/migrate-runpod-to-dcp
- From Vast.ai: https://dcp.sa/docs/guides/migrate-vast-to-dcp

**First 50 renters get a bonus:**
Register today → Get 50 SAR free
Use the credit within 7 days → Get +25 SAR bonus (total 75 SAR)

Launch your first job: https://dcp.sa/renter/register

Questions? Reply or visit https://dcp.sa/docs

Cheers,
The DCP Team

P.S. — We're building for Arabic-first AI. Qwen 2.5 on DCP is 35% cheaper than anywhere else. If you're serving MENA markets, this is your edge.

---

## Renter Success Email (After first job)

**Trigger:** 24–48 hours after first successful job

**Subject:** You saved 65% on that inference (vs RunPod)

**From:** launch@dcp.sa

**Body:**

Hi [Renter Name],

Congrats on your first DCP job! 🎉

Here's the breakdown:

**Your job:**
- Model: [MODEL]
- Runtime: [SECONDS] seconds
- Tokens: [TOKENS]
- DCP cost: [COST] SAR
- Same job on RunPod: [RUNPOD_COST] SAR
- **Your savings: [SAVINGS] SAR ([PERCENT]% cheaper)**

Over 1M tokens/month, that adds up to **[MONTHLY_SAVINGS] SAR saved**.

**What's next?**

### 1. Run More Jobs (Use that 50 SAR credit)
You have [REMAINING] SAR remaining. That's enough for:
- ~50 more Mistral inferences
- ~10 hours of Llama 3 batch processing
- ~5 SDXL image generations

### 2. Scoped API Keys (For teams)
Create keys per app to track costs separately:
```bash
curl -X POST https://dcp.sa/api/dc1/renters/api-keys \
  -H "x-renter-key: YOUR_KEY" \
  -d '{
    "name": "my-app",
    "scopes": ["inference"],
    "monthly_limit_sar": 5000
  }'
```

### 3. Streaming Responses (Real-time output)
Get token-by-token instead of waiting:
```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: YOUR_KEY" \
  -d '{..., "stream": true}'
```

### 4. Batch Jobs (Process 1000s overnight)
Submit jobs in bulk, run them async, collect results in the morning:
```bash
# Submit 1000 jobs at once
cat inputs.jsonl | while read line; do
  curl -X POST https://dcp.sa/api/dc1/jobs/submit \
    -H "x-renter-key: YOUR_KEY" \
    -d "$line"
done
```

40% cheaper than real-time due to better provider utilization.

### 5. Long-Running Endpoints (24/7 LLM servers)
Need persistent inference servers? Use `job_type: vllm_serve`:
```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: YOUR_KEY" \
  -d '{
    "job_type": "vllm_serve",
    "model": "mistralai/Mistral-7B-Instruct-v0.3",
    "duration_hours": 24
  }'
# You get an OpenAI-compatible endpoint
```

**Popular models on DCP:**
- **Nemotron Nano (4B):** Fastest cold start (5s). Best for edge. 5 SAR/hr
- **Mistral 7B:** Best cost-per-token. Code generation. 8 SAR/hr
- **Qwen 2.5 (Arabic):** Arabic-first. 32K context. 9 SAR/hr
- **Llama 3 (8B):** General reasoning + function calls. 9 SAR/hr
- **Nemotron Super (70B):** Enterprise-grade. Strongest reasoning. 45 SAR/hr

**Next steps:**
1. Add real balance (https://dcp.sa/renter/dashboard/billing)
2. Check out advanced features (API docs: https://dcp.sa/docs/api)
3. Join builder community (Discord: https://discord.dcp.sa)

Let's ship something great together.

Cheers,
The DCP Team

P.S. — After you spend 100 SAR, you unlock 10% discount on all future jobs (Tier 1). At 1000 SAR, it's 20% (Tier 2). Enterprise volume gets custom pricing.

---

## Renter Onboarding Checklist (Post-signup)

**Trigger:** After registration

**Subject:** Your DCP API Key + Next Steps

**From:** onboarding@dcp.sa

**Body:**

Hi [Renter Name],

Welcome to DCP. Here's your checklist:

**✅ Done:**
- [x] Account registered
- [x] API key generated: `sk_renter_XXXX...` (saved to your dashboard)
- [x] 50 SAR test credit added
- [x] Dashboard access ready

**📋 Next (choose one):**

**Option A: Run your first inference (5 min)**
```bash
export DCP_KEY="YOUR_API_KEY"

# Find available GPUs
curl https://dcp.sa/api/dc1/renters/available-providers \
  -H "x-renter-key: $DCP_KEY" | jq '.[] | {provider_id, gpu_model, price_sar_per_hour}'

# Submit job (Mistral 7B)
JOB_ID=$(curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: $DCP_KEY" \
  -d '{
    "model": "mistralai/Mistral-7B-Instruct-v0.3",
    "prompt": "What is Vision 2030?",
    "max_tokens": 128
  }' | jq -r '.job_id')

# Check status
curl https://dcp.sa/api/dc1/jobs/$JOB_ID \
  -H "x-renter-key: $DCP_KEY"

# Get results (when done)
curl https://dcp.sa/api/dc1/jobs/$JOB_ID/output \
  -H "x-renter-key: $DCP_KEY"
```

**Option B: Read migration guides (if switching from RunPod/Vast)**
- From RunPod: https://dcp.sa/docs/guides/migrate-runpod-to-dcp
- From Vast.ai: https://dcp.sa/docs/guides/migrate-vast-to-dcp

**Option C: Explore advanced features**
- API docs: https://dcp.sa/docs/api
- Code samples: https://github.com/dhnpmp-tech/dcp-sdk-examples
- Batch processing: https://dcp.sa/docs/guides/batch-processing

**⏰ Important deadlines:**
- 50 SAR credit expires in 7 days
- First 50 users who spend credit within 7 days get +25 SAR bonus

**Support:**
- Stuck? Email: support@dcp.sa
- Questions? Discord: https://discord.dcp.sa
- Docs: https://dcp.sa/docs

You're all set. Your first job is 30 seconds away.

Cheers,
The DCP Team

---

## Renter Free Trial Expiration (Day 7)

**Subject:** Your 50 SAR credit expires tomorrow (Get +25 SAR Bonus Now)

**From:** billing@dcp.sa

**Body:**

Hi [Renter Name],

Your 50 SAR test credit expires tomorrow.

**Good news:** You've submitted [X] jobs and spent [Y] SAR. You're on track to unlock **+25 SAR bonus** if you convert to paid account before midnight.

**Bad news:** If you don't convert, your credit disappears.

**Convert to paid in 2 minutes:**
https://dcp.sa/renter/dashboard/billing

Add payment method → Get +25 SAR bonus → Your credit becomes [Y+25] SAR

**Bonus breakdown:**
- Early adopter bonus: +25 SAR (expires tomorrow)
- Tier 1 discount: +10% on all jobs once you hit 100 SAR spent

**If you're on the fence:**
- "Too expensive?" We're 35–50% cheaper than RunPod. Compare: https://dcp.sa/pricing
- "Not enough models?" We have 6 production models + custom container support (Phase 2)
- "Worried about provider reliability?" Smart contract escrow + reputation system protects you

**Support:**
- Pricing questions: support@dcp.sa
- Technical issues: https://dcp.sa/docs
- Discord community: https://discord.dcp.sa

Add payment before tomorrow to keep your bonus.

Cheers,
The DCP Team

P.S. — Your top job so far: [JOB_DETAILS]. You're clearly getting value. Let's keep you going.

---

## Renter Churn Email (Inactive after day 3)

**Trigger:** No jobs submitted in 3 days

**Subject:** Here's Why You Should Try DCP Today (3 Common Blockers)

**From:** support@dcp.sa

**Body:**

Hi [Renter Name],

You registered for DCP but haven't submitted a job yet. Let's unblock you.

**Common blockers:**

### 1. "Your API is confusing"
Actually, it's simpler than RunPod/Vast. Three endpoints:
```bash
# 1. List GPUs
curl https://dcp.sa/api/dc1/renters/available-providers -H "x-renter-key: YOUR_KEY"

# 2. Submit job
curl -X POST https://dcp.sa/api/dc1/jobs/submit -H "x-renter-key: YOUR_KEY" -d {...}

# 3. Get results
curl https://dcp.sa/api/dc1/jobs/JOB_ID -H "x-renter-key: YOUR_KEY"
```

That's it. Docs: https://dcp.sa/docs/api

### 2. "I don't know if it'll work for my use case"
What are you trying to do?
- Real-time inference? ✅ (p50 latency ~200ms)
- Fine-tuning? ✅ (supports custom training containers)
- Image generation? ✅ (SDXL at 12 SAR/hr)
- Batch processing? ✅ (40% cheaper than real-time)

Email us with your use case—we'll set you up in 10 minutes: support@dcp.sa

### 3. "I'm worried about cost"
Your 50 SAR credit covers:
- 50 Mistral inferences
- 10 hours of Llama training
- 4 SDXL images

You have enough to experiment risk-free.

**Your next step:**
Pick one of the above → Reply to this email → We'll help

Or just submit a simple job:
```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: YOUR_KEY" \
  -d '{
    "model": "nemotron-nano",
    "prompt": "Hello, world!",
    "max_tokens": 10
  }'
```

Takes 30 seconds. Costs ~0.001 SAR.

We're here to help.

support@dcp.sa | https://discord.dcp.sa

Cheers,
The DCP Team

---

## Renter Engagement Email (Week 2 – Scaling)

**Trigger:** After 5+ jobs submitted

**Subject:** Ready to Scale? Here's How to 10x Your Inference Without 10x Your Costs

**From:** launch@dcp.sa

**Body:**

Hi [Renter Name],

You've submitted [X] jobs on DCP. Time to talk about scaling.

**Your usage so far:**
- Jobs: [X]
- Tokens: [Y]
- Total spent: [Z] SAR
- Avg latency: [W] ms

Here's how teams scale 10x without breaking budget:

### 1. Batch Processing (40% Cheaper)
Instead of real-time:
```
❌ Submit 1 job, wait for result, submit next
✅ Submit 1000 jobs at once, run overnight, collect results
```
Overnight batching gives providers better GPU utilization → cheaper rates → you save 40%.

### 2. Model Selection (Cost Per Token)
Compare your models:
- Nemotron Nano: Best speed-per-cost
- Mistral 7B: Best quality-per-cost
- Qwen 2.5: Best Arabic support
- Llama 3: Best reasoning

You're using [CURRENT_MODEL]. Could you save by switching?

### 3. Rate Limiting + Spend Control
Set limits per API key:
```bash
curl -X POST https://dcp.sa/api/dc1/renters/api-keys \
  -H "x-renter-key: YOUR_KEY" \
  -d '{
    "name": "my-app",
    "monthly_limit_sar": 5000,
    "daily_limit_sar": 500
  }'
```

Prevents runaway bills if your code bugs out.

### 4. Tiered Discounts (You're Close)
- Tier 0 (Starter): Free. No limits.
- **Tier 1 (Growth): 100+ SAR spent.** Get 10% discount. You're at [Z] SAR. **[100-Z] SAR away.**
- Tier 2 (Scale): 1000+ SAR spent. Get 20% discount.
- Tier 3 (Enterprise): 10,000+ SAR spent. Get custom pricing + dedicated support.

**You're close to Tier 1.** Every future job gets 10% off. At your current rate, you'll hit it in [X] days.

### 5. Dedicated Provider Pools (Enterprise)
Need guaranteed latency? Reserve capacity:
- Base fee: 20 SAR/hr
- Usage: Your normal job costs
- Benefit: Dedicated GPU, guaranteed <200ms p50 latency, priority queue

Enterprise teams use this. Interested? Reply and we'll quote.

### 6. Provider Routing (Smart Selection)
DCP auto-routes to the cheapest provider. But you can optimize:
```bash
# Route by latency
"provider_filter": {"max_latency_ms": 200}

# Route by cost
"provider_filter": {"max_price_sar_per_hour": 10}

# Route by specialty
"provider_filter": {"preferred_models": ["Qwen-2.5"]}
```

**Your recommendation:**
You're at [Z] SAR spend with [W]ms avg latency. You're a **Growth user**. Here's what we recommend:

1. Hit Tier 1 (10% discount) within the week
2. Implement batch processing for non-urgent jobs (save 40%)
3. Switch to Mistral for cost jobs, Qwen for Arabic-specific work
4. Set spending limits to prevent surprises

**Next steps:**
- Tier 1 roadmap: https://dcp.sa/docs/pricing-tiers
- Batch guide: https://dcp.sa/docs/guides/batch-processing
- Provider routing: https://dcp.sa/docs/api#provider-filters

You're scaling. Let's optimize the costs.

Cheers,
The DCP Team

P.S. — At your rate, you'll hit Tier 2 (20% discount) in [MONTH]. Plan accordingly.

---

## Renter Power User Email (High-volume users)

**Trigger:** >100 jobs submitted or >1000 SAR monthly volume

**Subject:** Enterprise Offer: Custom Pricing + Dedicated Support

**From:** enterprise@dcp.sa

**Body:**

Hi [Renter Name],

You're one of our power users.

**Your stats:**
- Jobs: [X]
- Monthly volume: [VOLUME] SAR
- Models used: [MODELS]
- Avg latency: [LATENCY]ms

At your scale, you likely need:
- Dedicated account manager
- Custom pricing (lower rates for volume)
- SLA guarantees (99.9% uptime per model)
- Priority job queue
- Provider failover guarantees

**Enterprise pricing:**
- Volume discounts: 20–40% off standard rates
- Base fee: 500 SAR/month (waived if you commit to 10K+ SAR/month)
- Support: 24/7 with dedicated manager
- SLA: 99.9% platform availability + 99% per-provider uptime

**Let's talk:**
Email: enterprise@dcp.sa
Or book a call: https://calendly.com/dcp-enterprise

We'll build a custom plan for your use case.

Cheers,
The DCP Team

---

## Renter Community Spotlight Email (Weekly)

**Subject:** This Week on DCP: Top Jobs + Community Highlights

**From:** community@dcp.sa

**Body:**

Hi DCP Community,

Here's what happened this week:

**🏆 Top Performance**
- Fastest job: [RENTER_NAME]'s Nemotron Nano inference (4.2 seconds)
- Largest batch: [RENTER_NAME] processed 50K tokens in one night
- Best uptime: [PROVIDER_NAME]'s provider (99.98%)

**💬 Community Highlights**
- [USER_A] shared a batch processing optimization (40% cost savings)
- [USER_B] deployed a 24/7 Mistral endpoint for production use
- [USER_C] migrated from RunPod, saved 60% on the first week

**📈 Platform Stats**
- Jobs this week: [X]
- Providers online: [Y]
- Average latency: [Z]ms
- Total earnings (providers): [AMOUNT] SAR

**🎉 Coming This Week**
- Provider reputation leaderboard goes live (featuring top 10)
- Custom container support beta opens
- New Qwen model added (Qwen-2.5-32B-Instruct)

**Want to be featured?**
Share your success story on Discord: https://discord.dcp.sa

Keep building.

The DCP Team
