# DCP Quickstart — Submit a GPU Workload

DCP connects Saudi-hosted GPU providers and renters in one API-first flow. Renters submit containerized workloads (LLM inference, image generation, rendering, training, endpoint serving) on approved runtimes.

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

Save your `api_key` immediately and keep it secure. The platform returns it once.

---

## Step 2 — Add balance

Top up your renter balance before submitting paid workloads:

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

> Top-up details (checkout and payment UX) are deployment-specific. Check the returned `success`, `new_balance_*`, and any follow-up fields to confirm the update.

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

Use `id` as your `provider_id`. `is_live: true` indicates recent heartbeat activity. If your target model appears in `cached_models`, startup can often begin with fewer warm-load delays.

---

## Step 4 — Submit a workload

Choose a job type and send the request with your renter key in the `x-renter-key` header.

### LLM inference example

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

### Image generation example

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

The `cost_halala` is reserved at submit time. If execution finishes sooner than requested, remaining balance is released automatically after settlement.

---

## Step 5 — Poll job status

```bash
curl "https://dcp.sa/api/dc1/jobs/job-1710843200000-x7k2p" \
  -H "x-renter-key: dc1-renter-YOUR_KEY_HERE"
```

**Possible statuses:**

| Status | Meaning |
|--------|---------|
| `pending` | Waiting for daemon pickup |
| `queued` | Provider currently busy — queued locally |
| `running` | Job executing on assigned GPU |
| `completed` | Done and ready to fetch |
| `failed` | Runtime or execution error |
| `cancelled` | Cancelled before completion |

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

**Image result:** `result.image_base64` contains a PNG payload. Decode with `base64 -d` or your language base64 library.

---

## Quick reference

```bash
# Check your balance in renter profile payload
curl "https://dcp.sa/api/dc1/renters/me?key=dc1-renter-YOUR_KEY"

# See recent jobs in the profile response
curl "https://dcp.sa/api/dc1/renters/me?key=dc1-renter-YOUR_KEY"
```

## Cost model

Rates vary by job class and provider pricing settings in the marketplace.

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
- [Provider Guide](/docs/provider-guide) — earn SAR by connecting your GPU
- [SDK Guides](/docs/sdk-guides) — Python and JavaScript SDKs
