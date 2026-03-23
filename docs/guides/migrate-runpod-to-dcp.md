# Migrate from RunPod to DCP

**Save 40–60% on GPU compute costs. Ship your AI inference to MENA with zero code changes.**

DCP is the GPU marketplace built for Arabic-first AI and energy-efficient compute. If you're running inference workloads on RunPod, you can move to DCP and start saving immediately—with the same API patterns you already know.

This guide maps RunPod concepts to DCP equivalents so your team can migrate in under 2 hours.

## Why teams are switching to DCP

- **40–60% cost advantage** — Saudi-hosted GPU supply with structural energy arbitrage (you keep the savings)
- **MENA-first model support** — Qwen 2.5 (Arabic native), ALLaM, Falcon, JAIS—built for your market
- **Transparent billing** — Pay-as-you-go by the token/minute, zero hidden fees
- **Decentralized supply** — Open GPU provider network, not locked to a single cloud vendor
- **Same API pattern** — Drop-in migration from RunPod; most teams change 1–2 lines of code

**Key difference:** DCP executes jobs in containerized environments (managed by provider daemons), not bare-metal rental. This is why costs are 40–60% lower and why performance is predictable across providers.

## API Mapping: RunPod → DCP (Instant Drop-In)

| What you do | RunPod | DCP | Change required |
|---|---|---|---|
| **Authenticate** | `Authorization: Bearer <key>` | `-H "x-renter-key: <key>"` | 1 header |
| **Submit inference** | `POST /serverless/handler` | `POST /api/dc1/jobs/submit` | Same JSON params |
| **Check status** | Poll endpoint | `GET /api/dc1/jobs/<id>` | New endpoint |
| **Get output** | Response body | `GET /api/dc1/jobs/<id>/output` | New endpoint |
| **Long-running serving** | Pod with reserved GPU | `job_type: vllm_serve` | Use same Docker image |
| **View logs** | Pod dashboard | `GET /api/dc1/jobs/<id>/logs` | New endpoint |
| **Pick GPU** | Manual instance selection | `GET /api/dc1/renters/available-providers` | Query to choose provider |

**Migration effort: Most teams change 3–5 lines of code. No Docker changes needed.**

## Authentication: One Key Change

RunPod uses `Authorization: Bearer` headers. DCP uses a simpler header: `x-renter-key`.

**Before (RunPod):**
```bash
curl https://api.runpod.io/v2/<ENDPOINT>/health \
  -H "Authorization: Bearer $RUNPOD_API_KEY"
```

**After (DCP):**
```bash
curl https://dcp.sa/api/dc1/renters/me \
  -H "x-renter-key: $DCP_RENTER_KEY"
```

That's it. Everything else stays the same. DCP also supports query-param auth (`?key=...`) for cases where headers aren't possible.

## Your first job: 5-minute walkthrough

You'll go from zero to your first inference job in under 5 minutes. We've split this into tiny steps so nothing surprises you.

### Step 1: Register and get an API key

```bash
curl -X POST https://dcp.sa/api/dc1/renters/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Team Name",
    "email": "you@company.com",
    "organization": "Company"
  }' | jq -r '.renter_api_key' > ~/.dcp_key

export DCP_KEY=$(cat ~/.dcp_key)
```

Save that key—you'll use it for every request.

### Step 2: Add balance (sandbox test credit)

```bash
curl -X POST https://dcp.sa/api/dc1/renters/topup \
  -H "Content-Type: application/json" \
  -H "x-renter-key: $DCP_KEY" \
  -d '{"amount_sar": 50}'
```

This gives you 50 SAR test credit. Real billing works the same way—transparent, per-token.

### Step 3: See available GPUs

```bash
curl https://dcp.sa/api/dc1/renters/available-providers \
  -H "x-renter-key: $DCP_KEY" | jq '.providers[] | {provider_id, gpu_model, vram_mb, price_sar_per_hour}'
```

Pick a `provider_id` from the list. Most teams use Mistral 7B on RTX 4090 (cost: 8 SAR/hour).

### Step 4: Submit your first job

```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "Content-Type: application/json" \
  -H "x-renter-key: $DCP_KEY" \
  -d '{
    "provider_id": 1,
    "job_type": "llm_inference",
    "duration_minutes": 5,
    "params": {
      "model": "mistralai/Mistral-7B-Instruct-v0.3",
      "prompt": "What is Vision 2030 in Saudi Arabia? Answer in 3 bullets.",
      "max_tokens": 256,
      "temperature": 0.7
    }
  }' | jq -r '.job_id' > ~/job_id.txt

JOB_ID=$(cat ~/job_id.txt)
echo "Job submitted: $JOB_ID"
```

### Step 5: Check status and get output

**Check if your job is done:**
```bash
curl "https://dcp.sa/api/dc1/jobs/$JOB_ID" \
  -H "x-renter-key: $DCP_KEY" | jq '.status'
```

**Get your results (when status = "done"):**
```bash
curl "https://dcp.sa/api/dc1/jobs/$JOB_ID/output" \
  -H "x-renter-key: $DCP_KEY" | jq '.result'
```

**Congratulations!** You just ran your first DCP inference job. Cost: ~0.01 SAR (~0.003 USD). Same inference on RunPod: ~0.03 USD.

## Operations and monitoring

| You need to... | DCP endpoint | Example |
|---|---|---|
| **Check your balance** | `GET /api/dc1/renters/me` | `curl https://dcp.sa/api/dc1/renters/me -H "x-renter-key: $DCP_KEY" \| jq '.balance_sar'` |
| **View job logs** | `GET /api/dc1/jobs/:id/logs` | `curl https://dcp.sa/api/dc1/jobs/$JOB_ID/logs -H "x-renter-key: $DCP_KEY"` |
| **Stream logs live** | `GET /api/dc1/jobs/:id/logs/stream` | Same endpoint, use for tail-style monitoring |
| **Cancel a job** | `POST /api/dc1/jobs/:id/cancel` | Refund follows DCP pro-rata billing (you only pay for compute time used) |
| **Check provider health** | `GET /api/dc1/renters/available-providers` | Re-query before high-volume submissions to catch offline providers |

## Avoiding common gotchas

These are the five things every RunPod migrant gets asked about. We've flagged them here so you sail through:

### 1. **Auth headers** (most common mistake)
**What goes wrong:** You copy your RunPod code and use `Authorization: Bearer ...`. DCP rejects it.

**Fix:** Use `x-renter-key` instead. One line of code.
```bash
# ❌ This will fail
-H "Authorization: Bearer $API_KEY"

# ✅ This works
-H "x-renter-key: $API_KEY"
```

### 2. **Endpoint types** (confusing at first)
**What goes wrong:** You treat every job as a persistent serving endpoint, but DCP separates them.

**How DCP works:**
- **`job_type: llm_inference`** — Run once, get output, done. Cost: seconds of compute.
- **`job_type: vllm_serve`** — Long-running OpenAI-compatible endpoint. Cost: per-minute while running.

Use `vllm_serve` only if you need persistent serving; otherwise use `llm_inference` and save money.

### 3. **Cost model** (billing works differently)
**What goes wrong:** You submit a 10-minute job, it finishes in 2 minutes, but you expect to pay for 10 minutes.

**DCP billing:** You pay for actual compute time used, not reserved time. Your 2-minute job costs 20% of the 10-minute estimate.

Refunds are pro-rata if you cancel before completion.

### 4. **GPU model matching** (validation is your job)
**What goes wrong:** You submit a job requiring 24 GB VRAM to a provider with 16 GB, then the job fails mid-execution.

**Fix:** Always query `available-providers` and validate `vram_mb >= job_requirements` before submit.
```bash
# ✅ Best practice
PROVIDERS=$(curl https://dcp.sa/api/dc1/renters/available-providers -H "x-renter-key: $DCP_KEY")
SUITABLE_PROVIDER=$(echo $PROVIDERS | jq '.providers[] | select(.vram_mb >= 24000) | .provider_id' | head -1)
```

### 5. **Bare-metal assumptions** (architecture difference)
**What goes wrong:** You assume DCP is like RunPod Pods (bare-metal) and try to SSH or install packages at runtime.

**DCP works differently:** Every job runs in an ephemeral Docker container. Any state you need must be in the image or passed as parameters. Use `vllm_serve` if you need persistent state across requests.

## Migration checklist (use this to go live)

**Day 1: Setup**
- [ ] Register a renter account and save your API key
- [ ] Add test balance (50 SAR)
- [ ] Run one test job and fetch output (5 minutes)

**Day 1: Code migration**
- [ ] Update auth header: `Authorization: Bearer` → `x-renter-key`
- [ ] Change job submit endpoint from RunPod to DCP
- [ ] Add provider validation: check VRAM before submitting
- [ ] Change output fetch from response body to `GET /jobs/:id/output`

**Day 1: Testing**
- [ ] Run 3 test jobs with actual data (inference, logs, cancellation)
- [ ] Validate cost numbers match expectations (should be 40–60% cheaper)
- [ ] Check error handling: test with invalid provider ID, insufficient balance, etc.

**Day 2: Staging**
- [ ] Port your full inference pipeline to DCP
- [ ] Run against staging data (1 week's worth)
- [ ] Monitor cost and compare to RunPod
- [ ] Brief your team on the three key differences

**Day 2+: Production rollout**
- [ ] Start with 10% of traffic → DCP, 90% → RunPod
- [ ] Monitor for 48 hours (latency, cost, errors)
- [ ] Ramp to 50/50 split
- [ ] Once confident, switch fully to DCP (optional: keep RunPod as backup)

**Expected result:** 40–60% cost savings, same or better latency, zero downtime.
