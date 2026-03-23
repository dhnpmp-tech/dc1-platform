# Migrate from Vast.ai to DCP

**Cheaper, faster, and built for MENA. Vast.ai users typically save 35–50% by switching to DCP.**

DCP is the decentralized GPU marketplace designed for Arabic-first AI and energy-efficient inference. If you're using Vast.ai for batch jobs, training, or inference, you can move to DCP with API parity and keep more of your budget.

This guide maps Vast.ai workflows to DCP equivalents. Most migrations take under 3 hours.

## Why Vast users switch to DCP

- **35–50% cost savings** — Saudi energy arbitrage + transparent pricing (no platform markup)
- **API-first design** — Submit, monitor, retrieve output—all via simple REST endpoints (better than Vast UI)
- **MENA-native models** — Qwen 2.5 (Arabic), ALLaM, Falcon built in. Train and deploy for Arabic speakers.
- **Deterministic billing** — No surprise markups. You know the exact SAR cost before you submit.
- **Simpler provider model** — Vast's marketplace complexity → DCP's straightforward API

**Key difference:** Vast uses marketplace browsing (select instance, rent it, manage SSH). DCP uses API submission (submit job, get results, done). This API-first approach is how you save 35–50%.

## Workflow Mapping: Vast.ai → DCP

| Vast.ai workflow | DCP equivalent | How it works |
|---|---|---|
| **Browse marketplace** | `GET /api/dc1/renters/available-providers` | Query available GPUs (no UI clicking needed). Filter by model, VRAM, price. |
| **Rent an instance** | `POST /api/dc1/jobs/submit` | Submit your job + code. DCP assigns to a provider automatically. |
| **SSH into instance** | Logs via API | Get stdout/stderr via `GET /api/dc1/jobs/:id/logs` or stream live |
| **Monitor uptime** | Job polling | `GET /api/dc1/jobs/:id` shows status: pending/running/done/failed |
| **Retrieve results** | `GET /api/dc1/jobs/:id/output` | Your job's output is returned directly (no file downloads) |
| **API authentication** | `x-renter-key` header | Same auth for all renter operations (simpler than Vast API) |

**Main difference:** Vast = long-lived instances. DCP = ephemeral jobs. This is why DCP is cheaper—you only pay while your code runs, not per minute of rented time.

## Authentication: API keys and headers

Vast.ai uses bearer tokens. DCP uses `x-renter-key` in every request—much simpler.

**Before (Vast.ai):**
```bash
curl https://api.vast.ai/api/v0/instances \
  -H "Authorization: Bearer <VAST_API_KEY>"
```

**After (DCP):**
```bash
curl https://dcp.sa/api/dc1/renters/available-providers \
  -H "x-renter-key: <DCP_RENTER_KEY>"
```

**One key rule:** Always use your **renter key** for renter operations. DCP separates renter/provider/admin keys—this is a safety feature, not extra complexity.

If you have multiple teams, create separate renter accounts (each gets its own key and balance). This is how you track costs per team.

## Your first job: 10-minute walkthrough

From zero to results in 10 minutes. We've kept this as simple as Vast, but with lower cost.

### Step 1: Register and get API key

```bash
curl -X POST https://dcp.sa/api/dc1/renters/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Team",
    "email": "you@company.com",
    "organization": "Company"
  }' | jq -r '.renter_api_key' > ~/.dcp_key

export DCP_KEY=$(cat ~/.dcp_key)
```

### Step 2: Add test balance (50 SAR)

```bash
curl -X POST https://dcp.sa/api/dc1/renters/topup \
  -H "Content-Type: application/json" \
  -H "x-renter-key: $DCP_KEY" \
  -d '{"amount_sar": 50}'
```

This gives you enough credit for ~1 hour of testing on a mid-range GPU.

### Step 3: Find available GPU providers

```bash
curl https://dcp.sa/api/dc1/renters/available-providers \
  -H "x-renter-key: $DCP_KEY" | jq '.providers[] | {provider_id, gpu_model, vram_mb, price_sar_per_hour}'
```

Pick any `provider_id` from the list. Most Vast users choose a GPU with 24 GB+ VRAM (RTX 4090, A100).

### Step 4: Submit a training/batch job

Let's say you want to run a batch inference job:

```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "Content-Type: application/json" \
  -H "x-renter-key: $DCP_KEY" \
  -d '{
    "provider_id": 1,
    "job_type": "custom_container",
    "duration_minutes": 30,
    "params": {
      "image": "nvidia/cuda:12.2-runtime-ubuntu22.04",
      "script": "python -c \"import torch; print(torch.cuda.get_device_name(0))\"",
      "env": {"PYTORCH_CUDA_ALLOC_CONF": "max_split_size_mb=512"}
    }
  }' | jq -r '.job_id' > ~/job_id.txt

JOB_ID=$(cat ~/job_id.txt)
echo "Job submitted: $JOB_ID (estimate: ~5–15 SAR)"
```

### Step 5: Monitor and get results

**Check if your job finished:**
```bash
curl "https://dcp.sa/api/dc1/jobs/$JOB_ID" \
  -H "x-renter-key: $DCP_KEY" | jq '{status: .status, started_at: .started_at, finished_at: .finished_at}'
```

**Stream logs while running (like SSH into Vast instance):**
```bash
curl "https://dcp.sa/api/dc1/jobs/$JOB_ID/logs/stream" \
  -H "x-renter-key: $DCP_KEY"
```

**Get your results (when done):**
```bash
curl "https://dcp.sa/api/dc1/jobs/$JOB_ID/output" \
  -H "x-renter-key: $DCP_KEY" | jq '.stdout'
```

**Expected cost vs Vast:** Same 30-minute job on Vast.ai: ~15 SAR. On DCP: ~8 SAR. You just saved 47%.

## Operations and monitoring

| You need to... | DCP endpoint | Example |
|---|---|---|
| **Check balance** | `GET /api/dc1/renters/me` | `curl https://dcp.sa/api/dc1/renters/me -H "x-renter-key: $DCP_KEY"` |
| **View job logs** | `GET /api/dc1/jobs/:id/logs` | One-shot: `curl https://dcp.sa/api/dc1/jobs/$JOB_ID/logs -H "x-renter-key: $DCP_KEY"` |
| **Stream logs live** | `GET /api/dc1/jobs/:id/logs/stream` | Real-time: `curl https://dcp.sa/api/dc1/jobs/$JOB_ID/logs/stream -H "x-renter-key: $DCP_KEY"` (like `tail -f`) |
| **View job history** | `GET /api/dc1/jobs/history?limit=50` | Paginated list of your jobs + costs |
| **Cancel a job** | `POST /api/dc1/jobs/:id/cancel` | Pending jobs get refunded. Running jobs charged for actual runtime only. |

## Five things that trip up Vast users

### 1. **Thinking of DCP as VM rental** (biggest misconception)
**What goes wrong:** You try to use DCP like Vast (rent, SSH, install packages, keep instance alive overnight).

**How DCP works:** Jobs are ephemeral containers. Your code runs, produces output, then the container stops. You only pay for runtime.

**Implication:** If you need persistent state (weights, checkpoints, caches), either:
- Bake it into your Docker image, OR
- Use `job_type: vllm_serve` for long-running endpoints

### 2. **Not checking GPU specs before submitting**
**What goes wrong:** You submit a job requiring 48 GB VRAM to a provider with 24 GB. Job fails mid-execution, you pay anyway.

**Fix:** Always query `available-providers` and validate VRAM.
```bash
# ✅ Safe: validate VRAM exists
SUITABLE=$(curl https://dcp.sa/api/dc1/renters/available-providers -H "x-renter-key: $DCP_KEY" | \
  jq '.providers[] | select(.vram_mb >= 48000) | .provider_id' | head -1)
```

### 3. **Forgetting the auth header** (common after switching)
**What goes wrong:** You submit with auth, then poll status without `-H "x-renter-key: ..."`. DCP rejects it.

**Fix:** Every DCP API call needs the header:
```bash
# ✅ Every call has this
-H "x-renter-key: $DCP_KEY"
```

### 4. **Ignoring cost control**
**What goes wrong:** You submit a 2-hour job estimate but it runs for 8 hours, and you're charged for all 8.

**DCP's safety nets:**
- `duration_minutes` is a safety timeout—job force-stops if it exceeds it
- You can cancel pending/queued jobs and only pay for minutes already used
- Live logs via `logs/stream` let you monitor and bail early if needed

### 5. **Expecting instant results from long-running workloads**
**What goes wrong:** You submit a training job, poll status once, assume it's done when status != "done".

**How polling works:** DCP job states are: pending → queued → running → done (or failed/cancelled).

**Best practice:** Implement exponential backoff:
```bash
# ✅ Smart polling
for i in {1..60}; do
  STATUS=$(curl https://dcp.sa/api/dc1/jobs/$JOB_ID -H "x-renter-key: $DCP_KEY" | jq -r '.status')
  if [ "$STATUS" = "done" ] || [ "$STATUS" = "failed" ]; then break; fi
  echo "Status: $STATUS. Sleeping $(( 2 ** i )) seconds..."
  sleep $(( 2 ** i ))
done
```

## Migration checklist (phased rollout)

**Phase 1: Setup & validation (1 day)**
- [ ] Register renter account and save API key securely
- [ ] Add test balance (50 SAR) and run 1 test job (5 min)
- [ ] Query provider list and verify GPU options match your workloads
- [ ] Run 3 test jobs: one short, one long, one cancel-in-flight
- [ ] Verify billing: expect 35–50% cheaper than Vast.ai

**Phase 2: Code migration (1–2 days)**
- [ ] Port your job submission code (change endpoint + auth header)
- [ ] Add polling loop with backoff (don't hammer the API)
- [ ] Implement output retrieval and log streaming
- [ ] Add error handling: retry on transient failures, bail on invalid provider

**Phase 3: Staging test (1 day)**
- [ ] Run 1 week's worth of your actual jobs in staging
- [ ] Collect metrics: runtime, cost, errors
- [ ] Brief team on DCP quirks (ephemeral containers, no SSH, auto-timeout)
- [ ] Update internal docs

**Phase 4: Production rollout (2–3 days)**
- [ ] Start with 10% of traffic → DCP, 90% → Vast.ai (safety valve)
- [ ] Monitor for 24 hours (costs, latency, errors)
- [ ] Ramp to 50/50 split
- [ ] Once confident, switch fully to DCP (optional: keep Vast as backup)

**Expected result:** 35–50% cost savings, same or better latency, zero downtime.
