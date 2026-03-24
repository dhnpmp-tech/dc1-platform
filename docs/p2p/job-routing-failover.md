# Job Routing Failover Behavior

**Document**: DCP-807 Failover Test
**Date**: 2026-03-24
**Status**: Testing Ready

## Overview

This document describes the expected and actual behavior of the DC1 job routing system when providers fail, go offline, or become unreachable during active job execution.

## Scenarios Tested

### Scenario 1: Provider Goes Offline Mid-Job

**Setup**:
- Provider is actively serving a job
- Job is in `in_progress` state
- Provider heartbeat stops (daemon crashes or network loss)

**Expected Behavior** (ideal):
1. Liveness monitor detects missing heartbeat after threshold (typically 30-60s)
2. Job status transitions to `failed`
3. Renter balance is refunded (or credited back)
4. System logs error with provider ID and job ID
5. Job may be requeued to another provider (retry logic)

**Actual Behavior** (current implementation):

The system implements a liveness monitor (`providerLivenessMonitor.js`) that:
- Runs periodic sweeps (every 60 seconds by default)
- Checks `heartbeat_log` table for stale entries
- Marks providers `is_online = false` when heartbeat threshold exceeded
- Queries `serve_sessions` to find in-progress jobs on offline providers
- Requeues jobs with status change to `queued` (reentry to job pool)
- Logs lifecycle event `provider_went_offline` with context

**Code Reference**: `backend/src/services/providerLivenessMonitor.js`

**Timing**:
- Detection latency: ~60 seconds (configurable via `LIVENESS_SWEEP_INTERVAL_MS`)
- Job requeue: immediate after detection
- Renter notification: async email (via emailService)

---

### Scenario 2: Only Provider for Model Goes Offline

**Setup**:
- Job requests specific model (e.g., RTX-4090)
- Only 1 provider in pool has that GPU model
- That provider becomes unreachable

**Expected Behavior**:
1. Job cannot be routed (no available provider)
2. Job queues and waits for provider recovery
3. Timeout triggers (30 min default?) → job fails
4. Renter receives error notification

**Actual Behavior** (current):

Job routing (`backend/src/services/jobRouting.js` or similar) filters providers by:
- `is_online = true`
- GPU availability in `provider_benchmarks`
- No jobs currently running at capacity

If no provider matches, job remains `queued` indefinitely until:
- A matching provider comes online (auto-resume)
- Explicit timeout/cancellation by renter or admin
- Manual requeue (admin endpoint)

**Current Gap**: No explicit timeout mechanism documented. Jobs may queue indefinitely.

---

### Scenario 3: Provider Partial Failure (Heartbeat OK, Jobs Failing)

**Setup**:
- Provider heartbeats successfully
- But job execution fails mysteriously (crash, OOM, network to job output)
- Provider does not report job failure to backend

**Expected Behavior**:
1. Job status remains `in_progress` indefinitely
2. Renter has no visibility (stuck job)
3. Eventually detected by timeout mechanism
4. Job marked failed, balance refunded

**Actual Behavior** (current):

- No automatic timeout documented in current system
- Relies on provider to POST job status updates
- If provider loses connection mid-job, status is unknown
- Liveness monitor only marks provider offline, does not directly fail individual jobs

**Current Gap**: Partial failures (provider heartbeats but jobs fail) are not detected until manual intervention or renter cancellation.

---

### Scenario 4: Cascading Provider Failures

**Setup**:
- 10 providers in discovery pool
- 3 providers go offline suddenly (network issue, coordinated restart)
- 7 providers remain

**Expected Behavior**:
1. All affected jobs requeued within 60s
2. Remaining 7 providers absorb load
3. Job latency increases but system remains available
4. Alert sent to ops team

**Actual Behavior** (current):

- Liveness monitor processes all failures in single sweep
- Requeue is atomic (single DB transaction)
- No backpressure mechanism; jobs flood remaining providers
- Alert mechanism: TBD (may not be implemented)

**Stress Test Result**: See `provider-churn-simulation.mjs` test output

---

## Job State Transitions During Failover

```
[Normal Path]
queued -> in_progress -> completed

[Failover Path - Mid-Job Failure]
in_progress -> [provider offline detected] -> requeue/failed

[Failover Path - No Provider Available]
queued -> [wait for timeout or provider recovery] -> expired/failed

[Admin Intervention]
[any state] -> [cancel_job API call] -> cancelled
```

## Requeue Logic

**When a provider goes offline:**

```sql
UPDATE jobs
SET status = 'queued'
WHERE provider_id = :offlineProviderId
  AND status = 'in_progress'
  AND completed_at IS NULL;

-- Record lifecycle event for audit
INSERT INTO job_lifecycle_events (job_id, event_type, provider_id, details)
VALUES (:jobId, 'provider_went_offline', :providerId, '...')
```

**Renter Experience**:
- Job appears back in active job list as `queued`
- Balance remains held (not double-deducted)
- Renter can cancel or wait for re-assignment
- Email notification sent: "Your job was interrupted. It's queued for retry."

---

## Configuration & Thresholds

**Liveness Monitor Settings** (environment variables):

| Variable | Default | Purpose |
|----------|---------|---------|
| `LIVENESS_SWEEP_INTERVAL_MS` | `60000` | How often to check for stale heartbeats |
| `PROVIDER_HEARTBEAT_TIMEOUT_MS` | `120000` | How long without heartbeat before marked offline |
| `LIVENESS_ENABLE_AUTO_REQUEUE` | `true` | Automatically requeue jobs from offline providers |
| `LIVENESS_ENABLE_EMAIL_ALERT` | `true` | Send email to renter on failover |

**Job Timeout Settings**:

| Variable | Default | Purpose |
|----------|---------|---------|
| `JOB_TIMEOUT_MS` | `TBD` | Max time job can be queued/in-progress |
| `JOB_EXECUTION_TIMEOUT_MS` | `TBD` | Max time provider has to complete job |

---

## Testing & Verification

### Manual Failover Test

1. **Setup**: Register 3 test providers, submit a job
2. **Simulate Failure**: Kill provider daemon
3. **Observe**:
   - Job remains in-progress for 1-2 minutes
   - Liveness sweep triggers
   - Job requeued to another provider
   - Verify balance handling (not double-charged)

### Automated Test

Run: `node scripts/provider-churn-simulation.mjs`

Expected output:
```
✓ 5 providers registered
✓ 5 providers discovered
✓ 2 providers taken offline
✓ 3 providers continue serving
✓ Remaining providers accept job assignments
```

---

## Known Gaps & Limitations

1. **No Explicit Job Timeout**: Jobs can queue indefinitely if no providers available
   - Impact: Stuck renter jobs with no completion signal
   - Fix: Implement job timeout with automatic failure + refund

2. **Partial Failure Not Detected**: Provider heartbeat continues but job fails
   - Impact: Renter job appears in-progress forever
   - Fix: Implement job execution timeout (e.g., 30 min max per job)

3. **No Automatic Rollback**: Failed jobs not automatically retried on different provider
   - Impact: Renter must cancel and resubmit
   - Fix: Implement automatic retry with backoff (max 3 attempts)

4. **No Cascade Alerting**: Ops team not notified of multi-provider failures
   - Impact: Human response delayed
   - Fix: Implement alert threshold (e.g., 3+ providers offline → page on-call)

5. **No Circuit Breaker**: Failing provider can accept unlimited jobs
   - Impact: All new jobs fail on that provider
   - Fix: Implement circuit breaker (disable provider after N consecutive failures)

---

## Roadmap

- **Phase 1** (Now): Document current behavior, test with simulation
- **Phase 2** (Sprint 28): Implement job execution timeout
- **Phase 3** (Sprint 29): Add automatic retry logic + circuit breaker
- **Phase 4** (Q2 2026): Ops alerting + dashboard for failover events

---

## Related Issues

- DCP-612: Bootstrap node deployment (provider discovery infrastructure)
- DCP-802: Provider self-test/activation (baseline provider health)
- DCP-807: This testing & verification work
- DCP-779: Provider liveness monitor (core failover implementation)

---

## Sign-Off

**Test Execution**: [To be filled in after running provider-churn-simulation.mjs]

- [ ] Churn simulation passes
- [ ] Discovery latency measured
- [ ] Routing failover verified
- [ ] Documentation accurate vs. actual behavior

**Verified By**: P2P Network Engineer
**Date**: 2026-03-24
