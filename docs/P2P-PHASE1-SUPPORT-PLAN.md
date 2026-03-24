# Phase 1 P2P Network Engineer Support Plan

**Status:** 🟢 **READY FOR EXECUTION**
**Timeline:** 2026-03-26 08:00 UTC — 2026-03-28 18:00 UTC (3 days)
**Decision:** Path B (HTTP-only Phase 1) activated per DCP-852
**Owner:** P2P Network Engineer

---

## Context

### Decision Made (2026-03-24 16:01 UTC)
- **P2P Bootstrap:** Not deployed (peer ID still placeholder at `p2p/dc1-node.js:47`)
- **Contingency Activated:** Path B (HTTP-only Phase 1 launch)
- **HTTP Discovery:** Operational and verified
- **Backend Health:** Nominal (93 sweep runs, 0 errors)
- **Provider Status:** 43 registered, 0 online (expected pre-Phase-1)

### Why HTTP-Only for Phase 1
1. **P2P bootstrap not deployed** — placeholder peer ID remains
2. **HTTP fallback fully operational** — tested and verified
3. **Provider activation timeline:** 4-6 hours (vs 2-4 hours with P2P)
4. **Risk level:** LOW — proven HTTP discovery mechanism
5. **Phase 1 duration:** 3 days — sufficient time for HTTP polling to activate providers

---

## Pre-Flight Checklist (2026-03-25 23:00 UTC)

### Execution
Run the pre-flight smoke test at **2026-03-25 23:00 UTC**:

```bash
node /home/node/dc1-platform/scripts/phase1-preflight-smoke.mjs
```

### Required Endpoints (Must Pass)
- [ ] `GET /api/health` → HTTP 200
- [ ] `GET /api/models` → HTTP 200, ≥ 11 models
- [ ] `GET /api/templates` → HTTP 200, ≥ 15 templates

### Optional Endpoints (Nice to Have)
- [ ] `POST /api/providers/heartbeat` → HTTP 200/400/401 (auth expected)
- [ ] `GET /api/jobs` → HTTP 200/401/404

### Go/No-Go Decision
- **GO Criteria:** All required endpoints pass + HTTP discovery operational
- **NO-GO Criteria:** Any required endpoint fails or backend unreachable
- **Escalation:** If NO-GO, notify founder immediately

---

## Phase 1 Execution (Day 4: 2026-03-26 08:00-23:00 UTC)

### Monitoring Checkpoints

| Time (UTC) | Activity | Responsibility |
|-----------|----------|-----------------|
| 08:00 | Phase 1 launch window opens | All teams |
| 08:00-12:00 | **First HTTP polling cycle** (4-6 total cycles) | P2P Engineer |
| 10:00 | Provider activation window opens | P2P Engineer |
| 12:00 | **Checkpoint 1:** First providers expected online | P2P Engineer |
| 14:00 | **Checkpoint 2:** Provider activation complete (expected) | P2P Engineer |
| 18:00 | Mid-Phase-1 status check | QA Engineer |
| 23:00 | Day 4 close-out | All teams |

### HTTP Provider Discovery Mechanism

**Heartbeat Flow:**
1. Provider daemon sends heartbeat → `POST /api/providers/heartbeat` (every 30s)
2. Backend records: `last_heartbeat` timestamp, GPU status, utilization
3. Liveness monitor polls every 60s (DCP-804)
4. Provider status updated: online (< 2 min) → degraded (2-10 min) → offline (> 10 min)

**Provider Activation Timeline:**
- **T+0:** Renter deploys job
- **T+0-30s:** First heartbeat arrives (provider detected)
- **T+30s:** Liveness sweep runs → status = "online"
- **T+30-90s:** Job routed to provider
- **T+90s+:** Job execution begins

**Expected Window:** First online provider within **4-6 hours** of Phase 1 start

### Metrics to Track

**Every 30 minutes during Phase 1 (08:00-23:00 UTC):**

1. **Provider Status Distribution**
   ```sql
   SELECT status, COUNT(*) FROM providers GROUP BY status;
   ```
   - Expected: status = 'online' count increases over 4-6h window

2. **Latest Heartbeat Age**
   ```sql
   SELECT id, name,
          ROUND((julianday('now') - julianday(last_heartbeat)) * 86400, 1) AS age_sec
   FROM providers
   ORDER BY last_heartbeat DESC
   LIMIT 10;
   ```
   - Expected: age_sec < 90s for online providers

3. **HTTP Discovery Latency**
   - Monitor: Time from provider registration to first heartbeat
   - Target: < 30s for local providers, < 60s for remote

4. **Backend Health**
   ```
   GET /api/health
   ```
   - Expected: sweep running, 0 errors, latency < 200ms

---

## Phase 1 Support (Day 5-6: 2026-03-27 08:00 — 2026-03-28 18:00 UTC)

### Responsibilities
- [ ] Monitor provider activation progress
- [ ] Track HTTP discovery latency
- [ ] Watch for timeout/stale issues
- [ ] Verify job routing to active providers
- [ ] Real-time P2P monitoring (dual-mode if later activated)

### Escalation Matrix

| Issue | Severity | Action |
|-------|----------|--------|
| Zero providers online after 2h | CRITICAL | Notify founder, check heartbeat endpoint |
| Backend /api/health failing | CRITICAL | Check PM2 logs, restart if needed (founder approval required) |
| HTTP discovery latency > 2min | HIGH | Verify network connectivity, check daemon logs |
| Job routing failing for online providers | HIGH | Debug job scheduler, verify API responses |
| Liveness sweep errors > 0 | MEDIUM | Review sweep logs, monitor for escalation |

---

## Contingency: P2P Activation During Phase 1

**If founder deploys P2P bootstrap during Phase 1:**

1. **Update peer ID:** Edit `p2p/dc1-node.js:47`
2. **Restart backend:** `pm2 reload dc1-provider-onboarding` (founder approval required)
3. **Monitor migration:** Track provider discovery shift from HTTP → P2P
4. **Maintain dual-mode:** Keep HTTP fallback active during transition
5. **Report migration timeline:** Time to first P2P peer connection

---

## Success Criteria

**Phase 1 is successful if:**
- [ ] Preflight checklist passes (2026-03-25 23:00 UTC)
- [ ] ≥ 1 provider online by 2026-03-26 14:00 UTC (2h activation target)
- [ ] ≥ 5 providers online by 2026-03-26 18:00 UTC (full window)
- [ ] HTTP discovery latency < 90s (one polling cycle)
- [ ] Zero backend health failures during 3-day window
- [ ] Zero job routing failures for active providers
- [ ] Phase 1 GO decision issued 2026-03-28 08:00 UTC

---

## Files & Commands Reference

**Pre-Flight:**
```bash
node /home/node/dc1-platform/scripts/phase1-preflight-smoke.mjs
```

**Backend Health:**
```bash
curl https://api.dcp.sa/api/health
```

**Provider Status:**
```bash
curl https://api.dcp.sa/api/providers/status
```

**Backend Logs (via SSH):**
```bash
pm2 logs dc1-provider-onboarding
```

**Database Queries:**
- Provider status: `SELECT id, name, status, last_heartbeat FROM providers ORDER BY last_heartbeat DESC;`
- Pending jobs: `SELECT id, job_id, status, provider_id FROM jobs WHERE status = 'pending';`
- Running jobs: `SELECT id, job_id, status, provider_id FROM jobs WHERE status = 'running';`

---

## Session Handoff Notes

✅ **DCP-852 Status:** DONE (decision executed 2026-03-24 16:01 UTC)
✅ **Pre-Flight Scheduled:** 2026-03-25 23:00 UTC
✅ **Phase 1 Ready:** Monitoring framework prepared
⏳ **Next:** Execute pre-flight checklist

**Contact:** P2P Network Engineer (5978b3b2-af54-4650-8443-db0a105fc385)
