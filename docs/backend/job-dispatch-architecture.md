# Job Dispatch Architecture

**DCP-798 — Sprint 28**

This document covers the full dispatch path from job submission through provider assignment, retry, and billing settlement.

---

## Overview

When a renter submits a compute job the dispatch pipeline runs in this order:

```
POST /api/jobs/submit
  |
  +-- 1. Credit validation (creditService)
  +-- 2. Credit hold    (jobDispatchService)
  +-- 3. Provider match (jobScheduler -> jobQueue)
  +-- 4. Provider polls and picks up job
  +-- 5. Provider posts events (webhooks/provider/event)
  +-- 6. Settlement     (settlementService)
```

---

## Components

### jobDispatchService.js

Entry point called by the job submission route.

1. Calls `creditService.checkBalance()` — fails fast if renter cannot afford the estimated cost (with a 10% dispatch buffer).
2. Calls `creditService.deductCredits()` to hold funds.
3. Calls `jobQueue.enqueueJob()` to attempt provider assignment.
4. Emits an SSE event to any connected renter client.

On job completion `completeJob(jobId, actualCostHalala)` settles the actual cost and releases any over-held credit.

### jobQueue.js

Handles the assignment lifecycle with exponential-backoff retry.

**Attempt 1 — immediate:** `enqueueJob()` calls `tryAssign()` synchronously. If a provider is available the job is immediately set to `pending` and the renter SSE stream receives `provider_assigned`.

**Retry queue (attempts 2-3):** If no provider is found, the job is set to `queued` and added to the in-memory `_retryQueue` with:
- `attempts = 1`
- `nextRetryAt = now + BACKOFF_DELAYS_MS[0]` (30 s)

The background `processRetryQueue()` loop fires every 30 s. Each iteration:
1. Skips entries where `now < nextRetryAt` (honouring the backoff window).
2. Fails entries where `attempts >= MAX_DISPATCH_ATTEMPTS` (3) with note `dispatch_attempts_exhausted`.
3. Fails entries where `waitMs >= MAX_WAIT_MS` (10 min) with note `dispatch_timeout`.
4. Otherwise increments `attempts`, calls `tryAssign()`, and on failure schedules the next retry:

| Attempt | Delay before attempt |
|---------|---------------------|
| 1       | immediate            |
| 2       | 30 s                 |
| 3       | 120 s                |
| 4+      | permanently failed   |

**Status transitions written by jobQueue:**

| Status    | Meaning                                          |
|-----------|--------------------------------------------------|
| pending   | Provider assigned; awaiting daemon pickup        |
| queued    | Waiting for provider; in retry queue             |
| running   | Provider posted job_started event                |
| completed | Provider posted job_done / job_completed event   |
| failed    | Dispatch exhausted OR provider posted job_failed |

### jobScheduler.js

Scoring engine that selects the best available provider for a set of job requirements. Returns `{ provider, score }` or `null` if no match.

**Composite score (0-10,000):**

| Component       | Max points | Criteria                                       |
|----------------|-----------|------------------------------------------------|
| Status          | 3,000     | online=3000, degraded=1500, offline=disqualify |
| GPU match       | 2,000     | exact=2000, compatible fallback=1500           |
| VRAM headroom   | 1,500     | proportional; disqualify if insufficient        |
| Uptime          | 1,500     | linear (uptime% / 100 x 1500)                  |
| Pricing class   | 500       | priority class + preload_status='ready'         |
| Price           | 1,000     | inverse normalised (cheaper = higher)           |

**Heartbeat freshness:**
- **Online:** last heartbeat < 120 s ago
- **Degraded:** 120-600 s
- **Offline:** > 600 s (disqualified)

GPU compatibility fallback chains are defined (e.g. a job requiring A100 can run on H100 or L40S).

### jobRouter.js (legacy)

A simpler first-pass filter: online/degraded + sufficient VRAM, sort by uptime DESC then price ASC. Being superseded by `jobScheduler` but still present in some code paths.

---

## Provider Assignment Fairness

The current algorithm is **best-score-wins**, not round-robin.

**Pros:**
- Renters always get the highest-quality provider available.
- Providers with better uptime and lower price rank first, incentivising reliability.

**Known gaps:**

| Gap | Impact | Mitigation |
|-----|--------|-----------|
| No capacity accounting across concurrent jobs | A busy provider may be assigned multiple jobs before its next poll | `jobScheduler.scheduleMultipleJobs()` exists for batch scheduling |
| No sticky provider support | Renter cannot request same provider as last time | Not planned for Sprint 28 |
| In-memory retry queue | Server restart drops all queued jobs | Acceptable for current scale; persistent queue tracked in backlog |

---

## Billing Reconciliation Endpoint

`GET /api/admin/billing/reconcile?date=YYYY-MM-DD` (DCP-798)

Requires `DC1_ADMIN_TOKEN`. Returns every job created on the given UTC date with:

| Field                   | Description                              |
|------------------------|------------------------------------------|
| job_id                 | Unique job identifier                    |
| renter_id / renter_email | Renter identity                        |
| tokens_used            | From serve_sessions (0 if not LLM job)   |
| cost_halala / cost_sar | Total billed to renter                   |
| provider_earned_halala | Provider's 85% share                     |
| dc1_fee_halala         | DC1's 15% platform fee                   |
| status                 | completed / failed / queued / etc.       |
| job_type               | llm-inference / training / rendering etc |
| completed_at           | ISO timestamp or null                    |

Plus a `summary` block: total_jobs, completed_jobs, failed_jobs, total_cost_halala, total_cost_sar, total_tokens_used.

The existing `/api/admin/finance/reconciliation?days=N` endpoint covers multi-day discrepancy detection (split mismatches, missing billing, provider drift).

---

## Settlement Flow

On job completion, `jobDispatchService.completeJob(jobId, actualCostHalala)`:

1. Deducts `actualCostHalala` from renter balance (replacing the hold).
2. Releases any over-held credit back to available balance.
3. Calls `settlementService.recordSettlement()` to write to `job_settlements`.

Platform fee: **15%** blended. Provider payout: **85%** of gross.

Cost rates (halala/minute):

| Job type          | Rate (halala/min) |
|-------------------|--------------------|
| llm-inference     | 9                  |
| vllm_serve        | 9                  |
| training          | 7                  |
| rendering         | 10                 |
| image_generation  | 10                 |
| default           | 6                  |

---

## Files Reference

| File | Purpose |
|------|---------|
| `backend/src/services/jobQueue.js` | In-memory queue + exponential-backoff retry |
| `backend/src/services/jobScheduler.js` | GPU-aware provider scoring |
| `backend/src/services/jobDispatchService.js` | Credit hold + queue entry point |
| `backend/src/services/settlementService.js` | Post-job cost calculation & ledger |
| `backend/src/services/creditService.js` | Off-chain renter credit ledger |
| `backend/src/routes/admin.js` | `GET /api/admin/billing/reconcile` |
| `tests/jobQueue-retry.test.js` | Unit tests for retry logic |
