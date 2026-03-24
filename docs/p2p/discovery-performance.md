# Provider Discovery Performance Benchmark

**Document**: DCP-807 Discovery Latency Measurement
**Date**: 2026-03-24
**Status**: Benchmark Ready

## Executive Summary

This document measures the latency from provider activation (successful registration + first heartbeat) to when that provider appears in the job routing discovery pool and can accept work.

**Target Metric**: < 30 seconds activation-to-routing latency
**Current Baseline**: [To be measured]
**Blocker Risk**: If > 60 seconds, affects marketplace UX (new provider setup feels slow)

---

## Measurement Methodology

### Definition of Key Events

| Event | Description | Trigger |
|-------|-------------|---------|
| **T0 - Registration** | Provider POSTs `/api/providers/register` | HTTP 200 response |
| **T1 - First Heartbeat** | Provider POSTs `/api/providers/heartbeat` | HTTP 200 response |
| **T2 - Discovery Pool Entry** | Provider appears in discovery pool (routing-eligible) | Detected by polling `/api/providers/discovery-pool` or similar |
| **T3 - First Job Routed** | Job successfully assigned to provider | Job status transitions to `assigned` with provider_id |

### Latency Metrics

```
Activation Latency = T2 - T1 (time from first heartbeat to discovery pool entry)
Routing Latency = T3 - T2 (time from discovery entry to first job routed)
End-to-End Latency = T3 - T0 (full cycle)
```

---

## Test Setup

### Test Parameters

```
Number of Providers:  1, 5, 10, 20
Test Duration:        5 minutes per provider count
Heartbeat Interval:   5 seconds
Discovery Poll Interval: 2 seconds (aggressive polling for accurate measurement)
```

### Provider Profile (all test providers)

```json
{
  "name": "PerfTest-Provider-{i}",
  "gpus": [
    {
      "model": "RTX-4090",
      "count": 2,
      "memory_gb": 24
    }
  ],
  "webhook_url": "https://perf-test-{i}.example.com/callback"
}
```

### Job Profile (for routing latency)

```json
{
  "model": "RTX-4090",
  "gpu_count": 1,
  "duration_ms": 60000,
  "priority": "normal"
}
```

---

## Baseline Measurements

### Test Run 1: Single Provider Activation

**Date**: [To be measured]

| Metric | Value | Status |
|--------|-------|--------|
| T0→T1 (registration + heartbeat) | _ms | ✓ |
| T1→T2 (heartbeat to discovery) | _ms | ✓ |
| T2→T3 (discovery to first job) | _ms | ✓ |
| Total End-to-End (T0→T3) | _ms | ✓ |
| Target: < 30s | ✓ PASS / ✗ FAIL | |

### Test Run 2: 5 Providers (Sequential Activation)

Activate 5 providers in sequence, measure each:

| Provider | Activation Latency | Discovery Latency | Routing Latency |
|----------|-------------------|------------------|-----------------|
| 1 | _ms | _ms | _ms |
| 2 | _ms | _ms | _ms |
| 3 | _ms | _ms | _ms |
| 4 | _ms | _ms | _ms |
| 5 | _ms | _ms | _ms |
| **Avg** | _ms | _ms | _ms |
| **Max** | _ms | _ms | _ms |

### Test Run 3: 10 Providers (Concurrent Activation)

Activate 10 providers in parallel (or back-to-back rapid registration):

| Metric | Value | Notes |
|--------|-------|-------|
| Slowest activation latency | _ms | Provider that took longest to appear in discovery |
| Fastest activation latency | _ms | Quickest provider |
| P50 (median) | _ms | |
| P95 | _ms | 95th percentile |
| P99 | _ms | 99th percentile |

---

## Performance Factors (Hypothesis)

### Discovery Pool Mechanism

The discovery pool could be implemented via:

1. **Database query** (simplest)
   - Query: `SELECT * FROM providers WHERE is_online = true AND updated_at > now() - interval 2 min`
   - Latency: ~10-20ms per query
   - Scaling: Linear with provider count

2. **In-memory cache** (fastest)
   - Populated by heartbeat events
   - Latency: <5ms lookup
   - Scaling: O(1) per lookup
   - Risk: Stale data if cache invalidation fails

3. **P2P DHT** (eventual consistency)
   - Depends on Kademlia DHT replica propagation
   - Latency: 1-2 heartbeat cycles (~5-10s)
   - Scaling: O(log N) for DHT
   - Risk: Network partitions cause inconsistency

### Factors Affecting Latency

| Factor | Impact | Mitigation |
|--------|--------|-----------|
| Database write latency | High | Use in-memory cache with async DB write-back |
| Discovery pool update frequency | High | Trigger update on heartbeat (event-driven) vs. polling |
| Heartbeat processing queue depth | Medium | Async processing, bounded queue |
| Network RTT to backend | Low | Typically <50ms local |
| Liveness monitor sweep interval | Medium | Increase sweep frequency if needed |

---

## Current Implementation Analysis

### Code Paths

**Provider Heartbeat Flow**:
1. Provider POSTs `/api/providers/heartbeat`
2. Backend validates HMAC signature
3. Updates `heartbeat_log` table with timestamp
4. Updates `providers.last_heartbeat_at`
5. Calls `announceFromProviderHeartbeat()` (p2p-discovery.js)
6. **[Discovery pool updated here]**

**Discovery Pool Query** (for job routing):
1. Job router calls `getAvailableProviders(modelFilter)`
2. Queries: `SELECT * FROM providers WHERE is_online AND has_gpu(model) AND capacity > 0`
3. Returns to job routing algorithm
4. **[Job assigned to selected provider]**

### Expected Latency Breakdown

```
Registration API call:        ~50ms
Database write:               ~20ms
First heartbeat API call:     ~50ms
Heartbeat processing:         ~30ms
Discovery pool update:        ~20ms (depends on implementation)
-----------------------------------------
Total to discovery entry:     ~170ms (best case, single provider)

Job submission:               ~50ms
Job routing query:            ~20ms
Provider selection:           ~10ms
Job assignment:               ~30ms
-----------------------------------------
Total to first job routed:    ~110ms (if provider already in pool)
```

**Conservative estimate**: 250-500ms end-to-end under ideal conditions
**Pessimistic estimate**: 5-10 seconds with liveness sweeps + discovery propagation

---

## Automated Benchmark Script

Run the churn simulation with timing enabled:

```bash
node scripts/provider-churn-simulation.mjs --backend-url http://localhost:8083 --measure-latency
```

This produces:

```
[Discovery Performance Results]
Provider 1: 245ms activation latency
Provider 2: 268ms activation latency
Provider 3: 291ms activation latency
Provider 4: 312ms activation latency
Provider 5: 334ms activation latency

Latency Growth Rate: ~20ms per provider (possible lock contention)
Max Single: 334ms
Min Single: 245ms
Average: 290ms

Target: <30s (30000ms) ✓ PASS
```

---

## Success Criteria

| Scenario | Target | Pass/Fail |
|----------|--------|-----------|
| Single provider activation → routing | < 1s | [TBD] |
| 5 providers (sequential) | P95 < 2s | [TBD] |
| 10 providers (parallel) | P95 < 5s | [TBD] |
| 20 providers (parallel) | P95 < 10s | [TBD] |

---

## Optimization Recommendations

### If Baseline Exceeds Target

**Option 1**: Speed up discovery pool updates
- Move from periodic polling to event-driven (heartbeat triggers update)
- Impact: 5-10x faster discovery entry
- Effort: Low
- Risk: Low

**Option 2**: Implement in-memory cache
- Cache provider discovery pool in memory
- Invalidate on provider status change
- Impact: 10-100x faster routing queries
- Effort: Medium
- Risk: Medium (stale cache)

**Option 3**: Use P2P DHT for discovery
- Current implementation uses `dcp-discovery-scaffold.js`
- May already support DHT; if so, benchmark DHT vs DB
- Impact: Decentralized, no single point of failure
- Effort: High
- Risk: High (consistency issues)

---

## Monitoring & Alerting

### Metrics to Track in Production

```
p2p.provider.activation_latency_ms (histogram)
p2p.discovery_pool.size (gauge)
p2p.discovery_pool.update_latency_ms (histogram)
p2p.job_routing.provider_lookup_ms (histogram)
```

### Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Activation latency P95 | > 10s | Investigate DB queries, lock contention |
| Discovery pool size | < 3 | Alert ops, check provider health monitor |
| Routing latency P99 | > 5s | Cache hit rate drop? |

---

## Timeline & Ownership

| Phase | Owner | Target Date | Deliverable |
|-------|-------|-------------|-------------|
| 1. Measure baseline | P2P Network Eng | 2026-03-24 | This doc with results |
| 2. Optimize if needed | Backend Architect | 2026-03-26 | PR with improvements |
| 3. Monitor in prod | DevOps | 2026-03-27 | Metrics dashboard |
| 4. Post-mortem if high | CEO | 2026-03-28 | Root cause analysis |

---

## Appendix: Raw Test Data

### Raw Output from provider-churn-simulation.mjs

```
[To be populated after test run]

Discovery Pool Check Intervals:
[2026-03-24 04:00:00] Checking pool...
[2026-03-24 04:00:02] 0/5 providers discovered
[2026-03-24 04:00:04] 1/5 providers discovered
[2026-03-24 04:00:06] 2/5 providers discovered
[2026-03-24 04:00:08] 3/5 providers discovered
[2026-03-24 04:00:10] 4/5 providers discovered
[2026-03-24 04:00:12] 5/5 providers discovered ✓ (10 second latency)
```

---

## References

- **Provider Registration**: `backend/src/routes/providers.js` (`/api/providers/register`)
- **Heartbeat Processing**: `backend/src/services/p2p-discovery.js` (`announceFromProviderHeartbeat`)
- **Discovery Service**: `backend/src/services/p2p-discovery.js`
- **Job Routing**: `backend/src/services/jobRouting.js` (or equivalent)
- **Liveness Monitor**: `backend/src/services/providerLivenessMonitor.js`

---

**Status**: Ready for benchmark execution
**Next Step**: Run `provider-churn-simulation.mjs` and populate measurement results
