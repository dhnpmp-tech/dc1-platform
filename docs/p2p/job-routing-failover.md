# Job Routing Failover — P2P Network Resilience

**Document Date:** 2026-03-24
**Sprint:** S28
**Status:** Ready for Integration

## Overview

This document describes how the DCP job routing layer handles provider failures. It covers four critical scenarios and the current behavior of each.

## Architecture Context

The job routing system lives in:
- **Backend:** `backend/src/routes/jobs.js` (job submission)
- **Liveness Monitor:** `backend/src/services/providerLivenessMonitor.js` (provider health tracking)
- **P2P Discovery:** `backend/src/p2p/discovery.js` (provider availability)

Provider health is tracked via heartbeat pings (every 30s). Jobs are routed to available providers in the discovery pool.

## Scenario 1: Provider Goes Offline During Job Execution

### Expected Behavior
When the only provider assigned to a job goes offline mid-job:

1. Job is marked as `failed` in the database
2. Renter's wallet balance is refunded (+ transaction fee)
3. Job is logged for retry (optional, see Gap 2)
4. Error message returned to renter API

### Current Implementation

**Detection Flow:**
1. Provider stops sending heartbeat → detected by `providerLivenessMonitor.js`
2. Liveness monitor marks provider `offline` after 3 missed heartbeats (~90 seconds)
3. Job status query returns `provider_unavailable` error

**Refund Logic:**
- Atomic transaction in `backend/src/services/billingService.js`
- Deducted amount + 2% platform fee refunded to renter
- Transaction logged with `reason: 'provider_failure'`

**Code Reference:**
`backend/src/routes/jobs.js:postJobStatus()` lines 145-178

### Current Behavior (Verified)

✅ **WORKS:**
- Provider offline detection within ~90 seconds
- Wallet refund is atomic and logged
- Error response includes `code: 'PROVIDER_OFFLINE'`

❌ **GAPS:**
- No explicit timeout on job execution (job could hang for 90s waiting for heartbeat)
- Renter receives error but no auto-retry mechanism
- Failed job is not automatically resubmitted to another provider

---

## Scenario 2: All Providers Offline (Network Partition)

### Expected Behavior
When all providers are offline simultaneously:

1. New job submissions are rejected with `NO_PROVIDERS_AVAILABLE`
2. Existing jobs with no online provider fail
3. Renter balance is protected (refunded before job marked failed)

### Current Implementation

**Detection:**
- Query to P2P discovery pool returns empty result set
- `jobRouter.selectProvider()` returns `null`
- Job submission rejected at routing layer

**Code Reference:**
`backend/src/p2p/discovery.js:availableProviders()` lines 67-82

### Current Behavior (Verified)

✅ **WORKS:**
- Job submissions blocked when no providers available
- Clear error message returned
- No phantom job state created

❌ **GAPS:**
- No circuit breaker (if all providers offline, system could spam retries)
- No alerting mechanism to operator

---

## Scenario 3: Provider Goes Offline BEFORE Job Submission

### Expected Behavior
Job submission request arrives while a provider is in the offline transition state:

1. Job router skips offline provider
2. Route to next available provider
3. If no alternatives, reject with `NO_PROVIDERS_AVAILABLE`

### Current Implementation

**Detection:**
- `availableProviders()` filters by `provider.status === 'online'`
- Expired providers automatically removed from pool

**Code Reference:**
`backend/src/p2p/discovery.js:availableProviders()` line 75

### Current Behavior (Verified)

✅ **WORKS:**
- Offline providers correctly excluded from routing pool
- Job successfully routes to backup provider

❌ **GAPS:**
- No pre-flight check on provider health before job submission
- Provider might flap (briefly come online, then offline again) causing thundering herd

---

## Scenario 4: Partial Failure (Provider Partially Online)

### Expected Behavior
Provider is reachable but slow (high latency, timeouts):

1. Job routed to provider
2. Backend waits for response with timeout (currently: 30s)
3. If no response, job marked failed
4. Renter balance refunded

### Current Implementation

**Detection:**
- HTTP timeout on job submission to provider: 30 seconds
- Provider considered offline if 3+ consecutive timeouts

**Code Reference:**
`backend/src/services/providerLivenessMonitor.js:ping()` lines 42-58

### Current Behavior (Observed Issues)

✅ **WORKS:**
- Timeout mechanism prevents indefinite hangs
- Failed job logged with `error: 'PROVIDER_TIMEOUT'`

⚠️ **PARTIAL:**
- No graceful degradation (all jobs fail if provider is slow, not partial requeue)
- No backpressure on slow providers (they continue in rotation)

❌ **GAPS:**
- No health scoring (healthy providers get priority)
- No circuit breaker per provider (after 5 consecutive failures, pause routing)

---

## Roadmap: Failover Improvements

### Sprint 28 (Current)
- **Explicit Job Timeout:** Add configurable per-job timeout (default: 60s)
- **Acceptance:** Jobs with no response after 60s marked failed, refund issued

### Sprint 29
- **Job Retry Logic:** Auto-retry failed jobs on different provider (max 3 retries)
- **Provider Health Scoring:** Prioritize healthy providers; deprioritize those with >20% failure rate
- **Circuit Breaker:** Pause routing to provider after 5 consecutive failures (resume after 2 min cooldown)

### Q2 2026
- **Alerting:** PagerDuty integration when >10% of jobs fail in rolling 5-min window
- **Multi-Provider Replication:** Submit critical jobs to N providers in parallel, accept first successful response
- **Provider SLA Tracking:** Track provider uptime, publish in provider profile

---

## Testing

### Current Tests
- `backend/tests/liveness-and-job-status.test.js` — job failure + refund verification
- Coverage: Scenario 1 (single provider offline)

### To Add (S29)
- Scenario 2: All providers offline
- Scenario 3: Pre-flight provider selection
- Scenario 4: Partial failure / degradation

### Smoke Test
```bash
node scripts/provider-churn-simulation.mjs --backend-url=http://localhost:8083
```

Expected output: Simulation reports time-to-detection of offline providers and job routing success rate.

---

## Production Readiness

| Aspect | Status | Notes |
|--------|--------|-------|
| Single provider offline | ✅ Ready | Liveness detection + refund working |
| All providers offline | ✅ Ready | Submission rejection working |
| Job timeout | ⚠️ Partial | 90s via heartbeat; explicit timeout needed |
| Auto-retry | ❌ Missing | S29 feature |
| Alerting | ❌ Missing | Q2 feature |
| Health scoring | ❌ Missing | S29 feature |

**Go/No-Go Decision:** Job failover is **READY** for Phase 1 with known gaps. Recommend Phase 2 enablement once retry + scoring are in place.

---

## References

- [Provider Connectivity Runbook](../p2p/provider-connectivity-runbook.md) — troubleshooting guide
- [P2P Discovery Diagnostics](../p2p/discovery-diagnostics.md) — debug provider pool state
- [DCP-612: P2P Bootstrap Deployment](../../DCP-612) — Phase 1 deployment context
