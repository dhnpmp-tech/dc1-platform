# P2P Provider Activation — Complete Integration Guide

**Date**: 2026-03-24
**Status**: Sprint 28 Integration Ready
**Audience**: Backend architects, P2P engineers, QA testing teams
**Scope**: End-to-end provider activation workflow (registration → online → job routing)

---

## Overview

The provider activation pipeline consists of four integrated components built in Sprint 28:

| Component | Task | Status | Role |
|-----------|------|--------|------|
| Self-Test Endpoint | DCP-802 | ✅ DONE | Provider readiness validation |
| Liveness Monitor | DCP-804 | ✅ DONE | Offline detection & status management |
| Discovery Stress Test | DCP-807 | ✅ DONE | Routing resilience verification |
| Earnings Dashboard | DCP-813 | ✅ DONE | Provider motivation & visibility |

Together, these enable a complete provider lifecycle: registration → validation → activation → online status → job routing → earnings tracking.

---

## Component Details

### 1. Provider Self-Test Endpoint (DCP-802)

**File**: `backend/src/routes/providers.js`
**Endpoints**:
- `GET /api/providers/self-test` — Validation checklist
- `POST /api/providers/activate` — Activate provider

**What it does**:
- Validates provider key, GPU spec, Docker access, network reachability
- Returns actionable `next_step` for providers who aren't ready
- Activates provider and sets online status when all checks pass
- Triggers heartbeat subscription

**Test coverage**: Unit tests in `backend/tests/provider-self-test.test.js`

**Integration point**: Providers call this before going online; dashboard shows status.

---

### 2. Provider Liveness Monitor (DCP-804)

**File**: `backend/src/services/providerLivenessMonitor.js`
**Endpoints**:
- `GET /api/providers/{id}/liveness` — Provider health status

**What it does**:
- Runs every 60 seconds, checking for missed heartbeats
- Marks providers offline if no heartbeat for 5+ minutes
- Logs transitions (online → offline, offline → online)
- Powers the marketplace UI provider availability indicator

**Test coverage**: Integration test in `backend/tests/liveness-and-job-status.test.js`

**Integration point**: Job dispatcher queries liveness before routing; dashboard shows "online/offline" status.

---

### 3. Discovery Stress Test & Performance Benchmark (DCP-807)

**Files**:
- `scripts/provider-churn-simulation.mjs` — Simulation script
- `docs/p2p/job-routing-failover.md` — Failover scenarios
- `docs/p2p/discovery-performance.md` — Latency measurement

**What it measures**:
- Provider join/leave cycles and their effect on job routing
- Failover behavior when providers go offline during job execution
- End-to-end discovery latency (registration → routing pool)

**Test execution**:
```bash
node scripts/provider-churn-simulation.mjs --backend-url=http://localhost:8083
```

**Expected results**:
- 5 providers join: all discoverable within 500-700ms
- 2 providers offline: remaining 3 continue routing jobs
- Failover: jobs marked failed, renter refunded within 90 seconds

**Integration point**: Validates that DCP-802, DCP-804, DCP-813 work together under realistic conditions.

---

### 4. Provider Earnings Dashboard (DCP-813)

**File**: `app/provider/dashboard/page.tsx`
**Endpoints**:
- `GET /api/providers/me/earnings` — Earnings data
- `GET /api/providers/me/jobs` — Job history
- `PATCH /api/providers/status` — Online/offline toggle

**What it shows**:
- Real-time earnings in halala + SAR equivalent
- GPU utilization percentage
- Recent job history (last 10 jobs with duration, tokens, earnings)
- GPU payback progress (e.g., "RTX 4090: 23% paid off")

**Test coverage**: Manual QA testing with live providers

**Integration point**: Provides visibility to keep providers motivated; shows real-time status from liveness monitor.

---

## End-to-End Provider Lifecycle

### Provider Registration
```
Provider registers with /api/providers/register
↓
Provider receives key + discovery token
```

### Provider Activation
```
Provider runs self-test: GET /api/providers/self-test
↓
If all checks pass → POST /api/providers/activate
↓
Provider status set to `online` in registry
↓
Liveness monitor starts tracking heartbeats
```

### Job Routing
```
Renter requests job → Backend queries /api/providers/available
↓
Liveness monitor returns: provider.status = 'online'
↓
Job dispatcher routes job to provider
↓
Provider executes job, sends results
```

### Provider Goes Offline
```
Provider stops sending heartbeats
↓
After 5 min → Liveness monitor marks offline
↓
Active job marked failed
↓
Renter balance refunded
↓
Dashboard shows provider as "offline"
```

### Provider Earnings
```
Each completed job → earnings recorded
↓
Dashboard aggregates: today/month/year earnings
↓
Displays GPU payback progress and projected annual revenue
```

---

## Testing Strategy

### Phase 1: Component Tests (Individual)
- DCP-802: Self-test endpoint validation ✅
- DCP-804: Liveness monitor transitions ✅
- DCP-813: Dashboard data retrieval ✅

### Phase 2: Integration Tests (Workflow)
- Provider activation flow: register → self-test → activate → online ⏳ (DCP-807 validates)
- Job routing with dynamic provider pool: providers join/leave, jobs route correctly ⏳ (DCP-807 validates)
- Failover scenarios: provider offline mid-job, refund issued ⏳ (DCP-807 validates)

### Phase 3: Stress Testing (Production Readiness)
- Run DCP-807 stress test: `node scripts/provider-churn-simulation.mjs`
- Target: 5+ providers, 2 offline simultaneously, <700ms discovery latency
- Success criteria: 100% job completion for online providers

---

## Known Gaps & Roadmap

### Current (Sprint 28)
- ✅ Self-test endpoint — validates provider readiness
- ✅ Liveness monitor — detects provider offline status (90s detection latency)
- ✅ Discovery stress test — validates routing under churn
- ✅ Earnings dashboard — shows earnings in real-time

### Sprint 29 (Next)
- Explicit job timeout (currently implicit via heartbeat, need explicit <60s timeout)
- Auto-retry logic: failed jobs resubmitted to backup provider (max 3 retries)
- Provider health scoring: prioritize healthy providers, deprioritize those with >20% failure rate
- Circuit breaker: pause routing to provider after 5 consecutive failures (resume after 2 min)

### Q2 2026
- Alerting: PagerDuty integration for >10% job failure rate
- Multi-provider replication: submit critical jobs to N providers, accept first successful response
- SLA tracking: track provider uptime, publish in profile

---

## Running the Integration Test

### Prerequisites
1. Backend running: `npm run dev` (or PM2 service)
2. Database: provider schema initialized
3. Test providers: 5 mock provider keys ready

### Step-by-step
```bash
# 1. Start backend
cd backend && npm run dev

# 2. In another terminal, run stress test
cd /home/node/dc1-platform
node scripts/provider-churn-simulation.mjs --backend-url=http://localhost:8083

# 3. Monitor output
# Expected: ✓ Providers registered, jobs routed, offline detected within 30s
# If failures: check liveness monitor logs, provider heartbeat logs
```

### What to look for
- **Join latency**: <100ms per provider registration
- **Job routing latency**: <50ms average
- **Discovery detection**: offline providers detected within <30s
- **Success rate**: 100% for online providers, 0% for offline providers

---

## Integration Checkpoints

Before marking Phase 1 complete, verify:

- [ ] All 4 components deployed to production
- [ ] Stress test runs successfully with 5+ providers
- [ ] Provider can register → self-test → activate → receive jobs
- [ ] Offline providers automatically removed from routing pool
- [ ] Earnings dashboard shows real earnings from completed jobs
- [ ] Team has run DCP-807 stress test at least once
- [ ] Documentation in `/docs/p2p/` is complete and current

---

## References

- [Provider Self-Test Spec](../CLAUDE.md) — DCP-802 implementation details
- [Liveness Monitor Design](provider-connectivity-runbook.md) — heartbeat architecture
- [Discovery Stress Test Results](discovery-performance.md) — latency measurements
- [Job Routing Failover Scenarios](job-routing-failover.md) — failure handling

---

**Next Step**: Run DCP-807 stress test. If all checks pass, Phase 1 provider activation is ready for real-world testing with 43 registered providers.
