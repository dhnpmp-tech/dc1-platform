# DCP Job Lifecycle

This document describes the complete lifecycle of a compute job — from renter deployment
through provider execution and final cost settlement.

## Overview

```
Renter                     Backend                    Provider
  │                           │                           │
  │  POST /templates/:id/deploy │                         │
  │ ─────────────────────────► │                         │
  │                            │  findAvailableProvider() │
  │                            │  creates job (status=pending)
  │                            │  deducts renter balance  │
  │  201 { jobId, totalCost }  │                          │
  │ ◄───────────────────────── │                          │
  │                            │                          │
  │                            │    GET /providers/jobs/next
  │                            │ ◄──────────────────────── │
  │                            │    { job: { job_id, task_spec, ... } }
  │                            │ ──────────────────────────►│
  │                            │                           │  (executes job)
  │                            │                           │
  │                            │  POST /webhooks/provider/event
  │                            │  { event: "job_started" } │
  │                            │ ◄──────────────────────── │
  │                            │  handleProviderEvent()    │
  │                            │  → status: running        │
  │                            │                           │  (job runs...)
  │                            │                           │
  │                            │  POST /webhooks/provider/event
  │                            │  { event: "job_completed", payload: { tokens_used, duration_sec } }
  │                            │ ◄──────────────────────── │
  │                            │  handleProviderEvent()    │
  │                            │  → status: completed      │
  │                            │                           │
  │  GET /renters/me/jobs       │                          │
  │ ─────────────────────────► │                          │
  │  { jobs: [ { status: "completed", cost_halala } ] }   │
  │ ◄───────────────────────── │                          │
```

## Job Status Machine

```
pending ──► running ──► completed
   │                        ▲
   │  (provider webhook)    │
   ▼                        │
queued ──────────────────────
   │  (timeout 10 min)
   ▼
failed
```

| Status      | Set by                                    | Meaning                                          |
|-------------|-------------------------------------------|--------------------------------------------------|
| `pending`   | templates.js deploy, jobs.js submit       | Job created, provider assigned                   |
| `queued`    | jobQueue.enqueueJob (no provider found)   | Waiting for an available provider (retry every 30s) |
| `running`   | jobQueue.handleProviderEvent (job_started)| Provider has started executing                   |
| `completed` | jobQueue.handleProviderEvent (job_completed, job_done, container_exit) | Execution finished |
| `failed`    | jobQueue (timeout), handleProviderEvent (job_failed, error_report) | Job failed or timed out |

## Detailed Step-by-Step

### 1. Provider Registration and Heartbeat

Providers register via `POST /api/providers/register`. This creates a DB record with:
- `status = 'registered'`
- `approval_status = 'pending'`

After human approval (`approval_status = 'approved'`), the provider daemon starts sending
heartbeats via `POST /api/providers/heartbeat`. Each heartbeat sets:
- `status = 'online'` (or `'degraded'` if container_restart_count > 10)
- `last_heartbeat = now`
- `gpu_vram_mib` — detected VRAM capacity

**Note for test environments:** Set `ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT=1` to let
test providers heartbeat without going through the approval flow.

### 2. Template Deployment (Job Creation)

`POST /api/templates/:id/deploy` (x-renter-key required):

1. Authenticates renter and loads template JSON from `docker-templates/`
2. Calculates estimated cost: `COST_RATES[job_type] × duration_minutes × pricing_multiplier`
3. Checks renter balance ≥ cost (returns HTTP 402 if not)
4. Calls `findAvailableProvider(template.min_vram_gb)` — selects the provider with:
   - `status IN ('active', 'online')` (both manual-set and heartbeat-set statuses accepted)
   - `last_heartbeat` within the last 10 minutes
   - `gpu_vram_mib ≥ min_vram_gb × 1024`
   - No active jobs currently assigned
5. Atomically deducts cost from renter balance and inserts job record (`status = 'pending'`)
6. Returns `{ jobId, status, estimatedStart, gpuTier, totalCost, template, provider }`

If no provider is available, returns HTTP 503. The renter can retry or use
`POST /api/jobs/submit` which queues the job for automatic assignment when a provider
comes online.

**Cost rates (halala/min):**

| Job type          | Rate | Example: 60 min (SAR) |
|-------------------|------|-----------------------|
| llm-inference     | 9    | 5.40 SAR              |
| vllm_serve        | 9    | 5.40 SAR              |
| rendering         | 10   | 6.00 SAR              |
| image_generation  | 10   | 6.00 SAR              |
| training          | 7    | 4.20 SAR              |
| rag-pipeline      | 15   | 9.00 SAR              |
| custom_container  | 7    | 4.20 SAR              |

Pricing class multipliers: `priority ×1.20`, `standard ×1.00`, `economy ×0.90`.

### 3. Provider Job Poll

Providers call `GET /api/providers/jobs/next?key=API_KEY` every few seconds.

The endpoint returns the highest-priority pending job assigned to that provider, ordered by:
- pricing_class (priority > standard > economy)
- numeric priority field
- FIFO (submitted_at)

The response includes `task_spec` (HMAC-signed payload containing job parameters) and
`container_spec` (Docker image, pricing class).

Alternatively, providers can use `GET /api/providers/:api_key/jobs` to retrieve up to
5 pending jobs at once.

### 4. Provider Execution and Webhooks

Once the provider starts executing, it sends signed events to:

```
POST /api/webhooks/provider/event
Headers:
  X-Provider-Key: <provider_api_key>
  X-DCP-Timestamp: <unix_epoch_seconds>
  X-DCP-Signature: sha256=HMAC-SHA256(rawBody, provider_api_key)
Body:
  { "event": "job_started", "job_id": "job-...", "payload": { ... } }
```

#### Supported event types

| Event            | Job Status → | Notes                                              |
|------------------|--------------|----------------------------------------------------|
| `job_started`    | `running`    | Sets `started_at`                                  |
| `job_running`    | `running`    | Alias for job_started                              |
| `job_completed`  | `completed`  | Sets `completed_at`. Include `tokens_used`, `duration_sec` in payload |
| `job_done`       | `completed`  | Alias for job_completed                            |
| `container_exit` | `completed`  | Container exited cleanly                           |
| `job_failed`     | `failed`     | Include `error` string in payload                  |
| `error_report`   | `failed`     | Unexpected error                                   |

The webhook handler calls `jobQueue.handleProviderEvent()` which:
1. Validates the event type maps to a known status
2. Guards against status downgrades (won't un-complete a completed job)
3. Writes the new status (and `started_at`/`completed_at` as appropriate) to the DB

#### Metering data in job_completed payload

```json
{
  "event": "job_completed",
  "job_id": "job-1711270344890-abc123",
  "payload": {
    "tokens_used": 512,
    "duration_sec": 14.7,
    "tokens_per_second": 34,
    "model": "meta-llama/Meta-Llama-3-8B-Instruct",
    "completed_at": "2026-03-24T10:05:00.000Z"
  }
}
```

### 5. Renter Cost Dashboard

After the job completes, renters can view job history and costs:

```
GET /api/renters/me/jobs?key=API_KEY
Response:
{
  "jobs": [
    {
      "job_id": "job-...",
      "job_type": "llm-inference",
      "status": "completed",
      "cost_halala": 9,
      "cost_sar": "0.0900",
      "submitted_at": "...",
      "started_at": "...",
      "completed_at": "...",
      "provider_gpu": "NVIDIA GeForce RTX 4090"
    }
  ],
  "pagination": { "page": 0, "limit": 20, "total": 1 }
}
```

Balance is deducted at job creation time (not at completion). Actual cost uses
`actual_cost_halala` if set, falling back to the estimated `cost_halala`.

## Job Queue and Provider Matching

For `POST /api/jobs/submit` (and as fallback for template deploy), `jobQueue.enqueueJob()`
handles provider matching:

1. **Immediate assignment** — calls `jobScheduler.findBestProvider()` which scores providers by:
   - Heartbeat freshness (online > degraded > offline)
   - Uptime percentage
   - Price (halala/min)
   - VRAM headroom above requirement

2. **Queued retry** — if no provider is available, the job is marked `queued` and retried
   every 30 seconds for up to 10 minutes. After 10 minutes with no match, the job is
   marked `failed`.

The retry loop is started at server startup in `server.js` via `startRetryLoop()`.

## Security

### Webhook HMAC

Provider webhooks are authenticated via `HMAC-SHA256(rawBody, provider_api_key)`.
The signature is sent in the `X-DCP-Signature: sha256=<hex>` header alongside a
timestamp in `X-DCP-Timestamp` for replay prevention (default 5-minute window).

### Heartbeat HMAC (optional)

Heartbeats can optionally require `X-DC1-Signature: sha256=HMAC-SHA256(rawBody, DC1_HMAC_SECRET)`.
Enforcement is controlled by `DC1_REQUIRE_HEARTBEAT_HMAC=1`.

### Provider Approval

Providers must have `approval_status = 'approved'` before heartbeating in production.
In test environments, set `ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT=1` to bypass this check.

## Running the Integration Test

```bash
# Start the backend with test mode enabled
ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT=1 node backend/src/server.js

# Run the end-to-end integration test
node scripts/test-job-lifecycle.mjs
```

Expected output (all phases passing):
```
[PASS] Provider registration — api_key obtained
[PASS] Provider heartbeat
[PASS] Renter registration — api_key obtained, starting balance=1000 halala
[PASS] Renter starting balance — balance=1000 halala (10.00 SAR)
[PASS] Template deployment — jobId=job-...
[PASS] Provider polls and receives job — found after 1 attempt(s)
[PASS] Webhook job_started accepted
[PASS] Webhook dispatched to job queue (job_updated=true)
[PASS] Webhook job_completed accepted
[PASS] Webhook dispatched — job marked completed
[PASS] Job reaches terminal state — status=completed
[PASS] Completed job has cost recorded — cost=9 halala (0.09 SAR)
[PASS] Renter balance deducted for job — deducted=9 halala
```

## Integration Gaps Fixed (DCP-740)

### GAP-1: Provider status mismatch in template deploy

**File:** `backend/src/routes/templates.js`

`findAvailableProvider` queried `WHERE status = 'active'`, but the heartbeat endpoint
sets `status = 'online'` (or `'degraded'`). Providers registered for the first time
have `status = 'registered'`, and after heartbeat they become `'online'`. The `'active'`
status is only set manually. This meant no provider would ever be found for template
deployments after heartbeat.

**Fix:** Changed the query to `WHERE status IN ('active', 'online')`.

### GAP-2: Webhook events not dispatched to job queue

**File:** `backend/src/routes/webhooks.js`

The `POST /api/webhooks/provider/event` route received and validated provider events
but included only a comment: `// Future: dispatch to event handlers, update job status`.
Job status never changed when providers sent `job_started` or `job_completed` events,
leaving jobs stuck in `pending` status forever.

**Fix:** Added `const { handleProviderEvent } = require('../services/jobQueue')` and
wired the route to call `handleProviderEvent({ event, job_id, provider_id, payload })`.
The response now includes `job_updated` and `new_status` fields for observability.
