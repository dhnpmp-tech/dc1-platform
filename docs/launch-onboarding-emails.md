# DCP Onboarding Email Sequence (3-Email Drip)

## Email 1: Welcome + First Job (Send immediately after registration)

**Subject:** Welcome to DCP — Your 50 SAR test credit is ready

**From:** launch@dcp.sa

**Body:**

Hi [Renter Name],

Welcome to DCP, the GPU marketplace built for Arabic AI.

You're all set. Your renter API key is active, and we've added 50 SAR test credit to your account. That's enough to run ~10 Mistral 7B inferences or ~2 hours of Llama 3 training.

**Here's what's next—run your first job in 2 minutes:**

1. **Get your API key**
```bash
curl https://dcp.sa/api/dc1/renters/me \
  -H "x-renter-key: YOUR_API_KEY_HERE"
```

2. **Pick a GPU**
```bash
curl https://dcp.sa/api/dc1/renters/available-providers \
  -H "x-renter-key: YOUR_API_KEY_HERE" | head -5
```

3. **Submit an inference job**
```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": 1,
    "job_type": "llm_inference",
    "duration_minutes": 5,
    "params": {
      "model": "mistralai/Mistral-7B-Instruct-v0.3",
      "prompt": "What is Vision 2030?",
      "max_tokens": 128
    }
  }'
```

Save that `job_id` and check back in 30 seconds:
```bash
curl https://dcp.sa/api/dc1/jobs/JOB_ID/output \
  -H "x-renter-key: YOUR_API_KEY_HERE"
```

**Expected cost:** ~0.01 SAR (one of the cheapest AI inferences in the world).

**Why DCP is 35–50% cheaper:**
- Saudi energy arbitrage (lower server costs)
- Decentralized provider competition (no middleman markup)
- Pay only for actual compute time (no reserved capacity)

**Next step:** Review our [Migration Guides](https://dcp.sa/docs/guides/) if you're switching from RunPod or Vast.ai.

Questions? Reply to this email or visit [dcp.sa/docs](https://dcp.sa/docs).

Cheers,
The DCP Team

P.S. — 50 SAR test credit expires in 7 days. After that, you can add real balance via the dashboard.

---

## Email 2: Cost Advantage + Advanced Features (Send after first job completes, ~Day 2)

**Subject:** You just saved 65% on that job (compared to RunPod)

**From:** launch@dcp.sa

**Body:**

Hi [Renter Name],

Congrats on running your first DCP job! 🎉

Here's the breakdown:
- **Job compute time:** 3 seconds
- **DCP cost:** 0.01 SAR (~$0.003)
- **Same job on RunPod:** 0.03 SAR (~$0.009)
- **Your savings:** 0.02 SAR (67% cheaper)

Over 1M tokens/month, that adds up to **~4,000 SAR saved per month** vs RunPod.

**Now that you're up and running, here are 3 features to explore:**

### 1. **API Keys with Scopes**
Create API keys scoped to specific endpoints (inference, admin, etc.). Great for teams—track cost per app, revoke keys without downtime.

```bash
curl -X POST https://dcp.sa/api/dc1/renters/api-keys \
  -H "x-renter-key: YOUR_API_KEY" \
  -d '{"name": "my-app", "scopes": ["inference"]}'
```

### 2. **Streaming Responses**
Get real-time token-by-token output instead of waiting for full completion:

```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: YOUR_API_KEY" \
  -d '{...,"stream": true}' | jq -R 'fromjson | select(.token)'
```

### 3. **Long-Running Endpoints (vLLM)**
Need persistent inference servers? Use `job_type: vllm_serve` to run OpenAI-compatible endpoints 24/7. Billed per-minute, not reserved capacity.

**Popular models on DCP:**
- **Mistral 7B** — Best cost-per-token (8 SAR/hr)
- **Qwen 2.5 7B** — Arabic-first + 32K context (9 SAR/hr)
- **Llama 3 8B** — Reasoning + function calls (9 SAR/hr)
- **Nemotron Super 70B** — Enterprise reasoning (45 SAR/hr)

**Next steps:**
- Read [API Docs](https://dcp.sa/docs/api/) for advanced usage
- Join our [Slack community](https://slack.dcp.sa) to chat with other builders
- Run a larger workload—50 SAR credit remaining

Let's ship something great together.

Cheers,
The DCP Team

P.S. — We're tracking latency and cost per model. Nemotron Nano is our fastest (5s cold start). Mistral 7B is our most efficient (8 SAR/hr).

---

## Email 3: Scale + Enterprise Features (Send ~Day 5, after sustained usage)

**Subject:** Ready to scale? Here's how to 10x your compute without 10x your costs

**From:** launch@dcp.sa

**Body:**

Hi [Renter Name],

You've been running jobs on DCP for a few days. Time to talk about scaling.

**Your usage so far:**
- Jobs submitted: [X]
- Total compute: [Y hours]
- Total spent: [Z SAR]
- Average latency: [W ms]

Here's how teams 10x their inference workload without breaking the budget:

### 1. **Batch Jobs + Scheduled Inference**
Instead of real-time request/response, batch 1000 jobs and run them overnight. 40% cheaper than real-time due to better GPU utilization and provider discounts.

Example: Fine-tune 100K documents overnight instead of streaming real-time.

### 2. **Multi-Provider Routing**
DCP automatically routes to the cheapest available provider. But you can optimize further:
- Route by latency (pick providers closest to your users)
- Route by cost (use Mistral 7B, not Llama 3, when possible)
- Route by specialty (use Qwen 2.5 for Arabic, Llama 3 for English)

### 3. **Volume Discounts**
Running >10,000 tokens/month? We offer:
- 10% discount at 1M tokens/month
- 20% discount at 10M tokens/month
- Custom pricing for >100M tokens/month

Reply to this email to discuss enterprise contracts.

### 4. **Rate Limiting + Cost Control**
Set spending limits per API key to prevent runaway bills:
- Max 100 SAR/hour per key
- Max 5000 SAR/month per project
- Alerts when you hit 75% of budget

### 5. **Dedicated Provider Pools**
Guarantee latency SLA by reserving capacity on high-spec providers. Starting at 20 SAR/hr base fee + usage charges.

---

## Enterprise Path

**If you're building seriously on DCP:**

- **Tier 1 (Free):** Up to 1M tokens/month. Community support.
- **Tier 2 (Growth):** 1–50M tokens/month. 15% discount. Email support.
- **Tier 3 (Scale):** 50M+ tokens/month. Custom pricing. Dedicated manager. SLA guarantee.

Your current usage suggests you're heading toward Tier 2. Let's talk about what that looks like.

**Next actions:**
1. [Upgrade your account](https://dcp.sa/dashboard/billing) to add real balance
2. Join the [builder community](https://slack.dcp.sa) for tips and tricks
3. Reply to this email if you're interested in enterprise features

You're building at the intersection of AI and energy efficiency. That's powerful. Let's scale it together.

Cheers,
The DCP Team

P.S. — In the next 2 weeks, we're launching:
- Custom container support (bring your own model)
- Multi-region routing (choose provider by geography)
- Rate limiting UI (dashboard-based budget controls)

Stay tuned.

---

## Email Template Notes

### Personalization Variables
- `[Renter Name]` — from registration
- `[X]` jobs submitted — from API usage data
- `[Y hours]` compute — from billing logs
- `[Z SAR]` total spent — from wallet history
- `[W ms]` average latency — from job metrics

### Send Timing
- **Email 1:** Immediately after registration (registration confirmation email)
- **Email 2:** 24–48 hours after first successful job (or Day 2 if no job submitted)
- **Email 3:** Day 5 or after 10th job submitted (whichever comes first)

### Fallback (Inactive Renters)
If renter registers but doesn't submit a job within 2 days, send a simplified Email 1 variant with subject: "Your 50 SAR credit is waiting—here's how to use it"

### Personalized Paths
- **Power users** (10+ jobs/day): Skip Email 2, move directly to Email 3 with enterprise offer
- **Inactive renters** (no jobs after Email 2): Send reminder email Day 7 before credit expires
- **Enterprise accounts** (>1M tokens): Replace Email 3 with dedicated onboarding from account manager
