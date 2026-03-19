# DC1 Quickstart — Submit Your First GPU Job in 5 Minutes

DC1 is Saudi Arabia's first decentralized GPU compute marketplace. Renters submit jobs (LLM inference, image generation, training) that run on providers' NVIDIA hardware. You pay in SAR; providers earn 75%, DC1 takes 25%.

**Base URL:** `http://76.13.179.86:8083` (production VPS)
**Currency:** All amounts are in **halala** (1 SAR = 100 halala) unless the field name ends in `_sar`.

---

## Step 1 — Create a renter account

```bash
curl -X POST http://76.13.179.86:8083/api/renters/register \
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

**Save your `api_key`.** It is shown exactly once. You cannot recover it — you would need to re-register with a different email.

---

## Step 2 — Add balance

New accounts start with 10 SAR (1,000 halala) free credit. To add more:

```bash
curl -X POST http://76.13.179.86:8083/api/renters/topup \
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

> Payments go through Moyasar (Saudi payment gateway). The topup endpoint returns a `checkout_url` in production; you redirect the user there to complete card payment.

---

## Step 3 — Find an available GPU

```bash
curl http://76.13.179.86:8083/api/renters/available-providers
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

Use the `id` field as your `provider_id`. Choose a provider with `is_live: true` — it means their daemon sent a heartbeat in the last 2 minutes. If the model you need is in `cached_models`, it will start faster (no download required).

---

## Step 4 — Submit a GPU job

Pick a job type and send the request with your renter key in the `x-renter-key` header.

### LLM Inference example

```bash
curl -X POST http://76.13.179.86:8083/api/jobs/submit \
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
curl -X POST http://76.13.179.86:8083/api/jobs/submit \
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
curl "http://76.13.179.86:8083/api/jobs/job-1710843200000-x7k2p" \
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
curl "http://76.13.179.86:8083/api/jobs/job-1710843200000-x7k2p/output" \
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
# Check your balance anytime
curl "http://76.13.179.86:8083/api/renters/balance" \
  -H "x-renter-key: dc1-renter-YOUR_KEY"

# List your recent jobs
curl "http://76.13.179.86:8083/api/renters/me?key=dc1-renter-YOUR_KEY"
```

## Cost rates

| Job type | Rate |
|----------|------|
| `llm_inference` | 0.15 SAR/min |
| `image_generation` | 0.20 SAR/min |
| `vllm_serve` | 0.20 SAR/min |
| `training` | 0.25 SAR/min |
| `rendering` | 0.20 SAR/min |
| `custom_container` | 0.10 SAR/min |

Cost is **pre-deducted** based on your requested `duration_minutes`. On completion, actual elapsed time is billed and any overpayment is refunded to your balance.

---

## Next steps

- [Full API Reference](./api-reference.md) — all endpoints with request/response schemas
- [Provider Guide](./provider-guide.md) — earn SAR by connecting your GPU
- [SDK Guides](./sdk-guides.md) — Python and JavaScript SDKs
