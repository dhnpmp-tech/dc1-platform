# DCP API Reference

**Base URL:** `https://api.dcp.sa`
**Content-Type:** `application/json` for all POST/PATCH requests
**Currency:** All amounts are in **halala** (1 SAR = 100 halala) unless the field name ends in `_sar`

---

## Authentication

Three auth schemes are used depending on caller role:

| Role | Header | Query param | Example |
|------|--------|-------------|---------|
| Renter | `x-renter-key: dcp-renter-...` | `?key=dcp-renter-...` | Job submission, balance |
| Provider | `x-provider-key: dcp-...` | `?key=dcp-...` | Daemon heartbeat, earnings |
| Admin | `x-admin-token: <token>` | — | Platform administration |

Most read endpoints for renters accept `?key=` as a query param. All write endpoints (job submit, topup) require the `x-renter-key` header.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /providers/register` | 5 / IP / 10 minutes |
| `POST /providers/heartbeat` | 4 / IP / minute |
| `POST /renters/register` | 5 / IP / 10 minutes |
| `POST /jobs/submit` | 10 / API key / minute |
| `GET /providers/marketplace` | 60 / API key / minute |
| `POST /payments/topup` | 10 / IP / minute |
| `GET /api/admin/*` | 30 / admin token / minute |
| All other `/api/*` | 300 / IP / minute |

Exceeded rate limits return `429 Too Many Requests` with:

```json
{ "error": "Rate limit exceeded", "retryAfterMs": 60000 }
```

---

## Renter Endpoints

### POST /api/renters/register

Create a new renter account.

**Auth:** None required

**Request body:**

```json
{
  "name": "string (required)",
  "email": "string (required, unique)",
  "organization": "string (optional)"
}
```

**Response 201:**

```json
{
  "success": true,
  "renter_id": 7,
  "api_key": "dcp-renter-a1b2c3d4e5f6...",
  "message": "Welcome ...! Save your API key — it won't be shown again."
}
```

**Errors:**

| Code | Reason |
|------|--------|
| 400 | Missing `name` or `email`, or invalid email format |
| 409 | Email already registered |

---

### GET /api/renters/me

Fetch renter profile and recent jobs.

**Auth:** `?key=dcp-renter-...` or `x-renter-key` header

**Response 200:**

```json
{
  "renter": {
    "id": 7,
    "name": "Your Name",
    "email": "you@example.com",
    "organization": "Acme Corp",
    "balance_halala": 5000,
    "total_spent_halala": 1000,
    "total_jobs": 5,
    "created_at": "2026-03-19T10:00:00.000Z"
  },
  "recent_jobs": [
    {
      "id": 12,
      "job_id": "job-1710843200000-x7k2p",
      "job_type": "llm_inference",
      "status": "completed",
      "submitted_at": "2026-03-19T11:00:00.000Z",
      "completed_at": "2026-03-19T11:03:00.000Z",
      "actual_cost_halala": 45
    }
  ]
}
```

---

### GET /api/renters/balance

Quick balance check.

**Auth:** `x-renter-key` header or `?key=` query param

**Response 200:**

```json
{
  "balance_halala": 5000,
  "balance_sar": 50.0,
  "held_halala": 75,
  "held_sar": 0.75,
  "available_halala": 5000,
  "total_spent_halala": 1000,
  "total_spent_sar": 10.0,
  "total_jobs": 5
}
```

`held_halala` shows funds locked for running jobs. `available_halala` is spendable balance after all holds.

---

### POST /api/renters/topup

Add balance to a renter account.

**Auth:** `x-renter-key` header

**Request body** (send one of):

```json
{ "amount_halala": 5000 }
```

```json
{ "amount_sar": 50 }
```

Max 1,000 SAR (100,000 halala) per transaction.

**Response 200:**

```json
{
  "success": true,
  "topped_up_halala": 5000,
  "topped_up_sar": 50.0,
  "new_balance_halala": 6000,
  "new_balance_sar": 60.0
}
```

**Errors:**

| Code | Reason |
|------|--------|
| 400 | Amount missing, ≤ 0, or non-numeric |
| 400 | Amount exceeds 100,000 halala |
| 401 | API key not provided |
| 404 | Renter not found |

---

### GET /api/renters/available-providers

List all online GPU providers.

**Auth:** None required (public endpoint)

**Response 200:**

```json
{
  "providers": [
    {
      "id": 3,
      "name": "Riyadh GPU Node A",
      "gpu_model": "NVIDIA RTX 4090",
      "vram_gb": 24,
      "vram_mib": 24576,
      "gpu_count": 1,
      "driver_version": "535.54.03",
      "compute_capability": "8.9",
      "cuda_version": "12.2",
      "status": "online",
      "is_live": true,
      "location": "SA",
      "reliability_score": 98,
      "cached_models": ["mistralai/Mistral-7B-Instruct-v0.2"]
    }
  ],
  "total": 4
}
```

`is_live: true` means the daemon sent a heartbeat within the last 2 minutes. Prefer live providers. `cached_models` lists models already pulled — jobs targeting these will start faster.

---

## Job Endpoints

### POST /api/jobs/submit

Submit a compute job to a provider.

**Auth:** `x-renter-key` header (required)

**Request body:**

```json
{
  "provider_id": 3,
  "job_type": "llm_inference",
  "duration_minutes": 5,
  "params": {
    "model": "mistralai/Mistral-7B-Instruct-v0.2",
    "prompt": "Summarize the history of Saudi Arabia in 3 sentences",
    "max_tokens": 256,
    "temperature": 0.7
  },
  "priority": 2,
  "gpu_requirements": {
    "min_vram_gb": 16
  }
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_id` | integer | Yes | Provider ID from available-providers list |
| `job_type` | string | Yes | See supported job types below |
| `duration_minutes` | number | Yes | Estimated duration — used to pre-deduct cost |
| `params` | object | Yes (for template jobs) | Job-type-specific parameters |
| `priority` | integer | No | 1=high, 2=normal (default), 3=low |
| `gpu_requirements` | object | No | `{ "min_vram_gb": N }` |
| `max_duration_seconds` | integer | No | Hard timeout (max 3600, default 1800) |

**Supported job types:**

| Job type | Description | Required params |
|----------|-------------|-----------------|
| `llm_inference` | Text generation | `model`, `prompt`, `max_tokens`, `temperature` |
| `image_generation` | Image from text | `prompt`, `model`, `steps`, `width`, `height` |
| `vllm_serve` | OpenAI-compatible serving endpoint | `model`, `max_model_len`, `dtype` |
| `custom_container` | Custom Docker + script | `image_override`, `script` |
| `training` | Custom training job | raw `task_spec` Python script |
| `rendering` | Custom rendering job | raw `task_spec` Python script |
| `benchmark` | Benchmark the GPU | no params required |

**Allowed LLM models (`llm_inference`):**

- `microsoft/phi-2`
- `microsoft/phi-1_5`
- `TinyLlama/TinyLlama-1.1B-Chat-v1.0`
- `google/gemma-2b`
- `mistralai/Mistral-7B-Instruct-v0.2`

**Allowed image models (`image_generation`):**

- `CompVis/stable-diffusion-v1-4`
- `stabilityai/stable-diffusion-2-1`
- `runwayml/stable-diffusion-v1-5`
- `stabilityai/stable-diffusion-xl-base-1.0`

**Allowed vLLM models (`vllm_serve`):**

- `mistralai/Mistral-7B-Instruct-v0.2`
- `meta-llama/Meta-Llama-3-8B-Instruct`
- `microsoft/Phi-3-mini-4k-instruct`
- `google/gemma-2b-it`
- `TinyLlama/TinyLlama-1.1B-Chat-v1.0`

**Response 201:**

```json
{
  "success": true,
  "job": {
    "id": 42,
    "job_id": "job-1710843200000-x7k2p",
    "provider_id": 3,
    "renter_id": 7,
    "job_type": "llm_inference",
    "status": "pending",
    "submitted_at": "2026-03-19T11:00:00.000Z",
    "duration_minutes": 5,
    "cost_halala": 75,
    "max_duration_seconds": 1800,
    "timeout_at": "2026-03-19T11:30:00.000Z",
    "priority": 2,
    "queue_position": null
  }
}
```

If the provider is busy, `status` is `"queued"` and `queue_position` gives your place in line.

**Errors:**

| Code | Reason |
|------|--------|
| 400 | Missing required fields |
| 400 | Invalid `job_type` |
| 400 | Raw Python `task_spec` rejected (use `params` instead) |
| 400 | Provider does not meet GPU requirements |
| 401 | Renter API key not provided |
| 402 | Insufficient balance — includes `shortfall_halala` |
| 403 | Invalid renter API key |
| 404 | Provider not found |
| 400 | Provider is not online |

---

### GET /api/jobs/:job_id

Get job status and metadata.

**Auth:** `x-renter-key` header (or `x-provider-key` if you own the job)

`:job_id` accepts both the numeric `id` and the string `job_id` (e.g., `job-1710843200000-x7k2p`).

**Response 200:**

```json
{
  "job": {
    "id": 42,
    "job_id": "job-1710843200000-x7k2p",
    "provider_id": 3,
    "renter_id": 7,
    "job_type": "llm_inference",
    "status": "completed",
    "submitted_at": "2026-03-19T11:00:00.000Z",
    "started_at": "2026-03-19T11:00:05.000Z",
    "completed_at": "2026-03-19T11:03:00.000Z",
    "duration_minutes": 5,
    "actual_duration_minutes": 3,
    "cost_halala": 75,
    "actual_cost_halala": 45,
    "priority": 2,
    "queue_position": null,
    "gpu_requirements": null
  }
}
```

**Job status lifecycle:**

```
pending → running → completed
           ↓            ↓
         failed      (refund issued)
queued → pending
```

---

### GET /api/jobs/:job_id/output

Fetch the result of a completed job.

**Auth:** `x-renter-key` header

**Response 200 (LLM inference):**

```json
{
  "job_id": "job-1710843200000-x7k2p",
  "status": "completed",
  "result": {
    "type": "text",
    "response": "Saudi Arabia was founded in 1932...",
    "prompt": "Summarize the history of Saudi Arabia...",
    "model": "mistralai/Mistral-7B-Instruct-v0.2",
    "tokens_generated": 215,
    "tokens_per_second": 22.1,
    "gen_time_s": 9.7,
    "total_time_s": 12.4,
    "device": "cuda"
  },
  "actual_cost_halala": 45,
  "actual_duration_minutes": 3
}
```

**Response 200 (image generation):**

```json
{
  "job_id": "job-1710843200000-abc123",
  "status": "completed",
  "result": {
    "type": "image",
    "image_base64": "/9j/4AAQ...",
    "format": "png",
    "width": 1024,
    "height": 1024,
    "steps": 30,
    "seed": 42,
    "model": "stabilityai/stable-diffusion-xl-base-1.0",
    "gen_time_s": 18.3
  }
}
```

**Response 200 (vllm_serve — serving endpoint):**

```json
{
  "job_id": "job-1710843200000-srv01",
  "status": "running",
  "result": {
    "type": "endpoint",
    "endpoint_url": "http://76.13.179.86:8899/v1",
    "model": "mistralai/Mistral-7B-Instruct-v0.2",
    "openai_compatible": true
  }
}
```

---

### GET /api/jobs/:job_id/logs

Stream execution logs from the provider daemon.

**Auth:** `x-renter-key` header

**Response 200:**

```json
{
  "job_id": "job-1710843200000-x7k2p",
  "logs": [
    "[dcp] Loading model: mistralai/Mistral-7B-Instruct-v0.2",
    "[dcp] Model loaded in 8.3s on cuda",
    "[dcp-phase] generating",
    "[dcp] Generated 215 tokens in 9.7s"
  ]
}
```

---

### POST /api/jobs/:job_id/cancel

Cancel a pending or queued job. Refunds the pre-paid balance.

**Auth:** `x-renter-key` header

**Response 200:**

```json
{
  "success": true,
  "job_id": "job-1710843200000-x7k2p",
  "status": "cancelled",
  "refunded_halala": 75
}
```

Returns an error if the job has already started running.

---

### GET /api/jobs/history

List your job history with optional filters.

**Auth:** `x-renter-key` header

**Query params:**

| Param | Description |
|-------|-------------|
| `status` | Filter by status: `completed`, `failed`, `cancelled` |
| `job_type` | Filter by job type |
| `limit` | Max results (default 20) |
| `offset` | Pagination offset |

**Response 200:**

```json
{
  "jobs": [...],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

## Provider Endpoints

> These endpoints are primarily used by the **DCP daemon** running on provider machines. See the [Provider Guide](./provider-guide.md) for the full setup flow.

### POST /api/providers/register

Register a new GPU provider.

**Auth:** None (one-time setup)

**Request body:**

```json
{
  "name": "My GPU Node",
  "email": "provider@example.com",
  "gpu_model": "RTX 4090",
  "vram_gb": 24,
  "location": "SA"
}
```

**Response 201:**

```json
{
  "success": true,
  "api_key": "dcp-...",
  "provider_id": 3,
  "message": "Provider registered. Install the daemon and start heartbeating."
}
```

---

### POST /api/providers/heartbeat

Daemon heartbeat — keeps the provider online and reports GPU metrics.

**Auth:** `x-provider-key` header

**Request body:**

```json
{
  "gpu_utilization": 34,
  "vram_used_mib": 4096,
  "temperature_c": 68,
  "driver_version": "535.54.03"
}
```

**Response 200:**

```json
{
  "success": true,
  "status": "online"
}
```

---

### GET /api/providers/me

Provider dashboard data.

**Auth:** `?key=dcp-...` or `x-provider-key` header

**Response 200:** Returns provider profile, recent jobs, and earnings summary.

---

### GET /api/providers/earnings

Earnings and withdrawal balance.

**Auth:** `x-provider-key` header

**Response 200:**

```json
{
  "total_earned_halala": 7500,
  "total_earned_sar": 75.0,
  "pending_withdrawal_halala": 3750,
  "jobs_completed": 12
}
```

---

## Webhook Events

DCP sends POST requests to your configured webhook URL when key job events occur.

> Webhook URL configuration is in your account settings (coming in Phase 4).

### Event: `job.completed`

```json
{
  "event": "job.completed",
  "job_id": "job-1710843200000-x7k2p",
  "job_type": "llm_inference",
  "status": "completed",
  "actual_cost_halala": 45,
  "completed_at": "2026-03-19T11:03:00.000Z"
}
```

### Event: `job.failed`

```json
{
  "event": "job.failed",
  "job_id": "job-1710843200000-x7k2p",
  "job_type": "llm_inference",
  "status": "failed",
  "error": "CUDA out of memory",
  "refunded_halala": 75,
  "failed_at": "2026-03-19T11:01:30.000Z"
}
```

All webhook payloads are signed with HMAC-SHA256. Verify the `X-DCP-Signature` header:

```python
import hmac, hashlib

def verify_webhook(payload_bytes, signature_header, secret):
    expected = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)
```

---

## Provider Endpoints (continued)

### PATCH /api/providers/me/gpu-profile

Update GPU capabilities manually (e.g. after hardware upgrade).

**Auth:** `x-provider-key` header

**Request body** (all fields optional):

```json
{
  "gpu_model": "NVIDIA RTX 4090",
  "vram_gb": 24,
  "gpu_count": 2,
  "compute_capability": "8.9",
  "cuda_version": "12.2",
  "driver_version": "535.54.03",
  "location": "SA"
}
```

**Response 200:**

```json
{ "success": true, "provider_id": 3, "updated_fields": ["vram_gb", "gpu_count"] }
```

---

### POST /api/providers/me/withdraw

Request a payout. Alias for `POST /api/providers/withdraw`.

**Auth:** `x-provider-key` header

**Request body:**

```json
{
  "amount_sar": 100.00,
  "payout_method": "bank_transfer",
  "payout_details": { "iban": "SA4420000001234567891234", "account_name": "Ahmed Al-Rashidi" }
}
```

Minimum 10 SAR. Processing takes 1–3 business days.

**Response 201:**

```json
{
  "success": true,
  "withdrawal_id": "wd-1710843600000-ab3f",
  "amount_sar": 100.00,
  "status": "pending",
  "message": "Withdrawal request submitted. Processing takes 1-3 business days."
}
```

**Errors:**

| Code | Reason |
|------|--------|
| 402 | Insufficient available earnings |

---

### GET /api/providers/me/withdrawals

Provider withdrawal history.

**Auth:** `x-provider-key` header or `?key=`

**Response 200:** Same as `GET /api/providers/withdrawal-history`.

---

### GET /api/providers/public

Public GPU marketplace. No auth required.

**Response 200:**

```json
{
  "providers": [
    {
      "id": 3,
      "gpu_model": "NVIDIA RTX 4090",
      "vram_gb": 24,
      "gpu_count": 1,
      "location": "SA",
      "price_per_min_halala": 15,
      "uptime_pct": 98.5,
      "jobs_completed": 318,
      "is_live": true,
      "cached_models": ["mistralai/Mistral-7B-Instruct-v0.2"]
    }
  ],
  "total": 4
}
```

---

## Job Endpoints (continued)

### GET /api/jobs/:job_id/history

Execution attempt history for a job.

**Auth:** `x-renter-key` or `x-admin-token`

**Response 200:**

```json
{
  "job_id": "job-1710843200000-x7k2p",
  "attempts": [
    {
      "attempt": 1,
      "provider_id": 3,
      "started_at": "2026-03-19T11:00:05.000Z",
      "ended_at": "2026-03-19T11:01:30.000Z",
      "status": "failed",
      "error": "CUDA out of memory",
      "duration_seconds": 85
    },
    {
      "attempt": 2,
      "provider_id": 5,
      "started_at": "2026-03-19T11:02:00.000Z",
      "ended_at": "2026-03-19T11:04:45.000Z",
      "status": "completed",
      "error": null,
      "duration_seconds": 165
    }
  ]
}
```

---

### GET /api/jobs/:job_id/logs?attempt=N

Retrieve logs for a specific execution attempt. The `attempt` parameter is optional — omit for the latest attempt.

**Auth:** `x-renter-key`, `x-provider-key`, or `x-admin-token`

**Response 200:**

```json
{
  "job_id": "job-1710843200000-x7k2p",
  "attempt": 2,
  "logs": [
    { "ts": "2026-03-19T11:02:00.100Z", "line": "[dcp] Loading model..." },
    { "ts": "2026-03-19T11:04:44.000Z", "line": "[dcp] Generated 215 tokens in 9.7s" }
  ]
}
```

---

### GET /api/jobs/:job_id/logs/stream

Stream live logs as Server-Sent Events. Closes when the job reaches a terminal state.

**Auth:** `x-renter-key`, `x-provider-key`, or `x-admin-token`

**Response:** `Content-Type: text/event-stream`

```
data: [dcp] Loading model: mistralai/Mistral-7B-Instruct-v0.2

data: [dcp] Model loaded in 8.3s on cuda

data: [DONE]
```

---

### GET /api/jobs/queue/status

Queue depth by compute type. No auth required.

**Response 200:**

```json
{
  "queue": [
    { "job_type": "llm_inference", "queued": 2, "running": 3, "avg_wait_seconds": 45 },
    { "job_type": "image_generation", "queued": 0, "running": 1, "avg_wait_seconds": null }
  ],
  "total_queued": 2,
  "total_running": 4,
  "updated_at": "2026-03-19T11:05:00.000Z"
}
```

---

### POST /api/jobs/:job_id/retry

Retry a `failed` job. Max 3 attempts.

**Auth:** `x-renter-key` header

**Response 200:**

```json
{
  "success": true,
  "job_id": "job-1710843200000-x7k2p",
  "attempt": 2,
  "status": "queued",
  "cost_halala": 75,
  "new_balance_halala": 4925
}
```

**Errors:**

| Code | Reason |
|------|--------|
| 400 | Job is not failed, or max retries reached |
| 402 | Insufficient balance |

---

### POST /api/jobs/:job_id/pause

Checkpoint a running job. The daemon uses `docker checkpoint`.

**Auth:** `x-renter-key` header

**Response 200:**

```json
{ "success": true, "job_id": "...", "status": "pausing", "message": "Checkpoint initiated." }
```

---

### POST /api/jobs/:job_id/resume

Restore a paused job from its checkpoint.

**Auth:** `x-renter-key` header

**Response 200:**

```json
{ "success": true, "job_id": "...", "status": "resuming", "message": "Container resumed." }
```

---

## vLLM Inference Endpoints

DCP managed inference — no need to submit a separate job. The platform handles
provider selection and billing automatically.

### GET /api/vllm/models

List models available for managed inference. No auth required.

**Response 200:**

```json
{
  "models": [
    {
      "id": "mistralai/Mistral-7B-Instruct-v0.2",
      "object": "model",
      "context_length": 32768,
      "max_tokens": 4096,
      "vram_required_gb": 14,
      "available": true
    }
  ]
}
```

---

### POST /api/vllm/complete

Synchronous LLM completion. Waits for the full response (max 120s).

**Auth:** `x-renter-key` header

**Request body:**

```json
{
  "model": "mistralai/Mistral-7B-Instruct-v0.2",
  "prompt": "Explain quantum computing in simple terms.",
  "max_tokens": 512,
  "temperature": 0.7
}
```

**Response 200:**

```json
{
  "id": "job-1710843200000-x7k2p",
  "model": "mistralai/Mistral-7B-Instruct-v0.2",
  "choices": [
    { "index": 0, "text": "Quantum computing uses qubits...", "finish_reason": "stop" }
  ],
  "usage": { "prompt_tokens": 12, "completion_tokens": 215, "total_tokens": 227 },
  "cost_halala": 45,
  "latency_ms": 9700
}
```

---

### POST /api/vllm/complete/stream

Streaming LLM completion via SSE.

**Auth:** `x-renter-key` header

**Request body:** Same as `POST /api/vllm/complete`.

**Response:** `Content-Type: text/event-stream`

```
data: {"text": "Quantum ", "index": 0}

data: {"text": "computing ", "index": 0}

data: {"finish_reason": "stop", "usage": {"total_tokens": 227}, "cost_halala": 45}

data: [DONE]
```

---

## Container Registry Endpoints

### GET /api/containers/registry

List approved Docker images. No auth required.

**Response 200:**

```json
{
  "images": [
    {
      "id": 1,
      "image": "dc1/llm-worker:latest",
      "description": "LLM inference worker (vLLM)",
      "job_type": "llm_inference",
      "scan_status": "clean",
      "scan_at": "2026-03-01T00:00:00.000Z",
      "approved_at": "2026-03-01T00:00:00.000Z"
    }
  ],
  "total": 6
}
```

---

### POST /api/admin/containers/approve-image

Approve a custom Docker image for use in DCP jobs.

**Auth:** `x-admin-token` header

**Request body:**

```json
{
  "image": "myorg/custom-worker:v1.2",
  "description": "Custom ML training worker",
  "job_type": "training",
  "scan_first": true
}
```

**Response 201:**

```json
{ "success": true, "image": "myorg/custom-worker:v1.2", "status": "scan_pending", "message": "Trivy scan queued before final approval." }
```

---

### POST /api/admin/containers/scan-image

Trigger a Trivy vulnerability scan on an image.

**Auth:** `x-admin-token` header

**Request body:** `{ "image": "dc1/llm-worker:latest" }`

**Response 202:**

```json
{ "success": true, "image": "dc1/llm-worker:latest", "scan_id": "scan-abc123", "message": "Scan queued." }
```

---

### GET /api/admin/containers/security-status

Container security dashboard — CVE findings for all registry images.

**Auth:** `x-admin-token` header

**Query params:** `?status=flagged`, `?severity=CRITICAL`

**Response 200:**

```json
{
  "summary": { "total_images": 6, "clean": 5, "flagged": 1, "pending": 0 },
  "images": [
    { "image": "dc1/llm-worker:latest", "scan_status": "clean", "critical_cves": 0, "high_cves": 0 },
    { "image": "myorg/old-worker:v0.1", "scan_status": "flagged", "critical_cves": 2, "high_cves": 4, "findings_summary": "CVE-2024-1234 (libssl)" }
  ]
}
```

---

## PDPL Compliance Endpoints

Saudi Arabia's Personal Data Protection Law (PDPL) requires DCP to provide
data portability and account deletion for all users.

### GET /api/renters/me/export

Export all personal data as a JSON file.

**Auth:** `x-renter-key` header

**Response 200:** JSON document containing `renter` profile, full `jobs` array, full `payments` array, and `data_retention_policy`.

---

### DELETE /api/renters/me

Permanently delete a renter account. Irreversible.

**Auth:** `x-renter-key` header

**Preconditions:** Zero balance, no active jobs.

**Request body:**

```json
{ "confirm": "DELETE_MY_ACCOUNT", "reason": "No longer using the service" }
```

**Response 200:**

```json
{ "success": true, "message": "Account permanently deleted. All personal data erased.", "deleted_at": "2026-03-19T11:00:00.000Z" }
```

**Errors:**

| Code | Reason |
|------|--------|
| 400 | Confirmation string wrong or missing |
| 409 | Active jobs or non-zero balance |

---

### DELETE /api/providers/me

Permanently delete a provider account. Earnings history is anonymised (not erased) for regulatory audit compliance.

**Auth:** `x-provider-key` header

**Preconditions:** No active jobs, no pending withdrawals.

**Request body:**

```json
{ "confirm": "DELETE_MY_ACCOUNT" }
```

**Response 200:**

```json
{ "success": true, "message": "Provider account permanently deleted. Earnings history anonymised.", "deleted_at": "2026-03-19T11:00:00.000Z" }
```

---

## Error Format

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "code": "OPTIONAL_ERROR_CODE"
}
```

Common HTTP status codes:

| Code | Meaning |
|------|---------|
| 400 | Bad request — invalid params or body |
| 401 | Missing auth credential |
| 402 | Insufficient balance |
| 403 | Invalid credential or forbidden |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, etc.) |
| 429 | Rate limit exceeded |
| 500 | Server error |
