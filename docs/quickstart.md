# DCP Quickstart — Submit a GPU Workload

DCP connects GPU providers and renters on a Saudi-hosted marketplace. Renters submit jobs (LLM inference, image generation, training) that run on providers' NVIDIA hardware in isolated containers.

**Base URL:** `https://api.dcp.sa` (production VPS)
**Currency:** Amounts are in **halala** internally (1 SAR = 100 halala) unless the field name ends in `_sar`.

---

## Step 1 — Create a renter account

```bash
curl -X POST https://dcp.sa/api/dc1/renters/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Name",
    "email": "you@example.com",
    "organization": "Acme Corp"
  }'
```

**Response:**

```json
{
  "success": true,
  "renter_id": 7,
  "api_key": "dc1-renter-a1b2c3d4e5f6...",
  "message": "Welcome Your Name! Save your API key — it won't be shown again."
}
```

**Save your `api_key` now**. Keep it secure, since it is only shown at generation time.

---

## Step 2 — Add balance

Top up your renter balance to add compute credits:

```bash
curl -X POST https://dcp.sa/api/dc1/renters/topup \
  -H "x-renter-key: dc1-renter-YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"amount_sar": 50}'
```

**Response:**

```json
{
  "success": true,
  "topped_up_sar": 50,
  "new_balance_sar": 60.0,
  "new_balance_halala": 6000
}
```

> Billing processor details and top-up UX may vary by deployment. The endpoint returns status fields that confirm the balance update or indicates the next top-up step.

---

## Step 3 — Find an available GPU

```bash
curl https://dcp.sa/api/dc1/renters/available-providers
```

**Response:**

```json
{
  "providers": [
    {
      "id": 3,
      "name": "Riyadh GPU Node A",
      "gpu_model": "NVIDIA RTX 4090",
      "vram_gb": 24,
      "gpu_count": 1,
      "status": "online",
      "is_live": true,
      "location": "SA",
      "reliability_score": 98,
      "cached_models": ["mistralai/Mistral-7B-Instruct-v0.2"]
    }
  ],
  "total": 1
}
```

Use the `id` field as your `provider_id`. Choose a provider with `is_live: true` — it means their daemon sent a heartbeat recently. If the model you need is in `cached_models`, startup can be faster after warm model loading.

---

## Step 4 — Submit a workload

Pick a job type and send the request with your renter key in the `x-renter-key` header.

### LLM Inference example

```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: dc1-renter-YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": 3,
    "job_type": "llm_inference",
    "duration_minutes": 5,
    "params": {
      "model": "mistralai/Mistral-7B-Instruct-v0.2",
      "prompt": "Explain quantum entanglement in simple terms",
      "max_tokens": 512,
      "temperature": 0.7
    }
  }'
```

### Image Generation example

```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: dc1-renter-YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": 3,
    "job_type": "image_generation",
    "duration_minutes": 10,
    "params": {
      "prompt": "A futuristic cityscape in Riyadh at dusk, cinematic lighting",
      "model": "stabilityai/stable-diffusion-xl-base-1.0",
      "steps": 30,
      "width": 1024,
      "height": 1024
    }
  }'
```

**Response (job submitted):**

```json
{
  "success": true,
  "job": {
    "job_id": "job-1710843200000-x7k2p",
    "status": "pending",
    "job_type": "llm_inference",
    "cost_halala": 75,
    "duration_minutes": 5,
    "submitted_at": "2026-03-19T11:00:00.000Z"
  }
}
```

The `cost_halala` is deducted from your balance upfront. If the job finishes sooner, you are refunded the difference.

---

## Step 5 — Poll job status

```bash
curl "https://dcp.sa/api/dc1/jobs/job-1710843200000-x7k2p" \
  -H "x-renter-key: dc1-renter-YOUR_KEY_HERE"
```

**Possible statuses:**

| Status | Meaning |
|--------|---------|
| `pending` | Waiting for daemon to pick up |
| `queued` | Provider busy — you are in queue |
| `running` | Executing on GPU now |
| `completed` | Done — result available |
| `failed` | Execution error |
| `cancelled` | Cancelled before start |

---

## Step 6 — Fetch the result

```bash
curl "https://dcp.sa/api/dc1/jobs/job-1710843200000-x7k2p/output" \
  -H "x-renter-key: dc1-renter-YOUR_KEY_HERE"
```

**LLM result:**

```json
{
  "job_id": "job-1710843200000-x7k2p",
  "status": "completed",
  "result": {
    "type": "text",
    "response": "Quantum entanglement is when two particles...",
    "tokens_generated": 387,
    "tokens_per_second": 24.3,
    "gen_time_s": 15.9,
    "model": "mistralai/Mistral-7B-Instruct-v0.2"
  },
  "actual_cost_halala": 45,
  "actual_duration_minutes": 3
}
```

**Image result:** The `result.image_base64` field contains the PNG encoded as base64. Decode it with `base64 -d` or your language's base64 library.

---

## Quick reference

```bash
# Check your balance in the renter profile payload
curl "https://dcp.sa/api/dc1/renters/me?key=dc1-renter-YOUR_KEY"

# List your recent jobs
curl "https://dcp.sa/api/dc1/renters/me?key=dc1-renter-YOUR_KEY"
```

## Cost model

Rates vary based on marketplace pricing and selected provider settings.

| Job type | Cost basis |
|----------|------------|
| `llm_inference` | Estimated at submission from provider pricing |
| `image_generation` | Estimated at submission from provider pricing |
| `vllm_serve` | Estimated at submission from provider pricing |
| `training` | Estimated at submission from provider pricing |
| `rendering` | Estimated at submission from provider pricing |
| `custom_container` | Estimated at submission from provider pricing |

Cost is **pre-deducted** based on your requested `duration_minutes`. On completion, actual elapsed time is billed and any overpayment is refunded to your balance.

---

## Next steps

- [Full API Reference](./api-reference.md) — all endpoints with request/response schemas
- [Provider Guide](./provider-guide.md) — earn SAR by connecting your GPU
- [SDK Guides](./sdk-guides.md) — Python and JavaScript SDKs
