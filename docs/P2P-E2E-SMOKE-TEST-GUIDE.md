# P2P Network — E2E Smoke Test Support Guide

**Status:** Ready for E2E test execution
**Purpose:** Support QA during Phase 1 E2E smoke test execution (SP25-006)
**Audience:** QA Engineer, DevOps, P2P Network Engineer
**Date:** 2026-03-23

---

## Overview

When E2E smoke tests run (once SP25-001 metering fix and SP25-002 escrow deployment are complete), the P2P heartbeat protocol is a critical component. This guide provides:

1. **What to verify** — P2P components tested in smoke tests
2. **Troubleshooting** — Common P2P issues and fixes
3. **Monitoring** — How to watch P2P health during test execution
4. **Success criteria** — What passing P2P behavior looks like

---

## P2P Components Tested in E2E Smoke Tests

### Test Suite: gpu-job-lifecycle-smoke.mjs

**P2P Checkpoint: Provider Heartbeat Acceptance (Line 112-124)**

```javascript
const heartbeat = await requestJson('/providers/heartbeat', {
  provider_key: providerKey,
  gpu_id: 0,
  online: true,
  metrics: { cpu_usage: 45, gpu_usage: 75 }
})
recordCheck('Provider heartbeat accepted', heartbeat.ok, `HTTP ${heartbeat.status}`)
```

**What this tests:**
- ✅ Provider can submit heartbeat to `/api/providers/heartbeat` endpoint
- ✅ Backend accepts heartbeat (HTTP 200)
- ✅ Backend triggers P2P DHT announcement (internal, not visible in test)
- ✅ Provider profile updates with `last_heartbeat` timestamp

**P2P flow during this checkpoint:**
```
Provider heartbeat POST → Backend validates → Updates DB with peer_id
                                           ↓
                                   Calls announceFromProviderHeartbeat()
                                           ↓
                                   Provider spec published to DHT
                                           ↓
                                   Heartbeat record stored in DHT with TTL
```

---

## Verifying P2P Health During Test Execution

### 1. Check Heartbeat Endpoint is Responding

**Command:**
```bash
curl -X POST https://api.dcp.sa/api/providers/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "api_key":"<test_provider_key>",
    "gpu_status":{"status":"online","gpu_util_pct":50},
    "gpu_info":{"gpu_name":"RTX 4090","vram_mb":24576}
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Heartbeat received",
  "timestamp": "2026-03-23T10:30:45.123Z",
  "needs_update": false,
  "approval_status": "approved"
}
```

**If failing:**
- Check provider API key is valid
- Verify provider is approved (status = "approved")
- Check backend health: `curl https://api.dcp.sa/api/health`

### 2. Verify Heartbeat Stored in Database

**Provider dashboard should show:**
```bash
GET /api/providers/me?key=<test_provider_key>
```

**Response should include:**
```json
{
  "provider": {
    "status": "online",
    "last_heartbeat": "2026-03-23T10:30:45.123Z",
    "gpu_metrics": {
      "utilization_pct": 50,
      "vram_used_mib": 12288,
      "temperature_c": 45
    }
  }
}
```

**If `last_heartbeat` is old or missing:**
- Provider heartbeat not being received
- Check provider network connectivity
- Verify provider daemon is running (check `dc1_daemon.py` logs)

### 3. Monitor Backend P2P Announcement Logs

**Check backend logs for P2P DHT announcement:**
```bash
tail -f /var/log/dcp-backend.log | grep -i "p2p\|announce\|discovery"
```

**Expected patterns:**
```
[p2p-discovery] heartbeat announce enqueued for peer 12D3KooW...
[p2p-discovery] Provider spec published to DHT: {peer_id, gpu_model, vram_mb, price}
```

**If no P2P logs appear:**
- Check that `../services/p2p-discovery.js` is loaded
- Verify `announceFromProviderHeartbeat()` is being called (line 813 in providers.js)
- Check P2P service error handling (line 822-823)

### 4. Verify Provider Appears in Discovery

**Once heartbeat is accepted, provider should be discoverable:**

```javascript
// Renter-side discovery
import { resolveHeartbeats, summarizeHeartbeatHealth } from './p2p/heartbeat-protocol.js'

const providerPeerIds = ['12D3KooW...'] // From DHT
const results = await resolveHeartbeats(node, providerPeerIds)
const health = summarizeHeartbeatHealth(results)

console.log(health)
// Expected: { healthy: 1, degraded: 0, offline: 0, total: 1 }
```

**If provider not found in DHT:**
- Bootstrap node connectivity issue (see next section)
- Provider peer ID mismatch
- DHT key prefix issue (`/dcp/nodes/1.0.0/heartbeats/{peerId}`)

---

## Troubleshooting P2P Issues During E2E Tests

### Issue 1: Heartbeat Endpoint Returns 403 (Unapproved Provider)

**Symptom:**
```
HTTP 403: Provider is not approved yet
```

**Cause:**
- Provider approval status is `pending` or `rejected`, not `approved`
- In production mode (not test mode)

**Fix:**
```sql
-- Check provider approval status
SELECT id, name, approval_status FROM providers WHERE api_key = '<test_key>';

-- If pending, approve provider
UPDATE providers SET approval_status = 'approved' WHERE api_key = '<test_key>';
```

**Or use test mode flag:**
```bash
export ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT=1  # Allows pending providers in tests
```

### Issue 2: Heartbeat Accepted but P2P Announcement Fails

**Symptom:**
- Heartbeat HTTP 200 succeeds
- But logs show: `[p2p-discovery] heartbeat announce enqueue failed: ...`

**Cause:**
- P2P discovery service not initialized
- Network connectivity to DHT bootstrap node

**Fix:**
```bash
# Restart backend to reinitialize P2P discovery
pm2 restart dc1-provider-onboarding

# Check bootstrap node is reachable
nc -zv 76.13.179.86 4001  # Should succeed
```

### Issue 3: Provider Peer ID Not Stored

**Symptom:**
- Heartbeat accepted
- But `p2p_peer_id` column is NULL in providers table

**Cause:**
- Provider not sending `peer_id` in heartbeat request

**Fix:**
```bash
# Provider daemon should emit peer_id automatically
# Check dc1_daemon.py emit_p2p_heartbeat() includes peer_id

# Or manually test with peer_id in request:
curl -X POST https://api.dcp.sa/api/providers/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "api_key":"<key>",
    "peer_id":"12D3KooW...",  # Add this
    "gpu_status":{"status":"online"}
  }'
```

### Issue 4: Bootstrap Node Connection Fails

**Symptom:**
- Provider can't connect to DHT
- Logs: `DHT bootstrap failed: ECONNREFUSED`

**Cause:**
- Bootstrap node not running on VPS 76.13.179.86
- Firewall blocking port 4001

**Fix:**
```bash
# Deploy bootstrap node if not running
ssh root@76.13.179.86
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
pm2 logs dc1-p2p-bootstrap | grep "Peer ID"  # Get actual peer ID

# Update configuration with actual peer ID
# Edit p2p/dc1-node.js line 47 with output from above
```

---

## Success Criteria for P2P During E2E Tests

✅ **All of these should pass:**

| Criterion | How to Verify | Expected Result |
|-----------|---------------|-----------------|
| Heartbeat endpoint accepts POST | `curl POST /api/providers/heartbeat` | HTTP 200, `"success": true` |
| Last heartbeat timestamp updates | `GET /api/providers/me` | Timestamp is recent (< 1 min old) |
| P2P announcement logs appear | `grep p2p-discovery` backend logs | `heartbeat announce enqueued` message |
| Provider peer ID is stored | `SELECT p2p_peer_id FROM providers` | Non-NULL peer ID (12D3KooW...) |
| Provider discoverable via DHT | Run `resolveHeartbeats()` with peer IDs | `{ healthy: 1, degraded: 0, offline: 0 }` |
| Health status is "healthy" | Parse heartbeat record from DHT | `"status": "healthy"` (not degraded/warning) |

---

## P2P Metrics to Monitor During Test Execution

**Real-time dashboard queries:**

```sql
-- Number of online providers
SELECT COUNT(*) as online_count FROM providers WHERE status = 'online' AND last_heartbeat > datetime('now', '-5 minutes');

-- Average heartbeat latency
SELECT AVG(CAST((julianday('now') - julianday(last_heartbeat)) * 86400 AS REAL)) as latency_sec FROM providers WHERE last_heartbeat IS NOT NULL;

-- Providers with stale heartbeats (>90s old)
SELECT COUNT(*) as stale_count FROM providers WHERE last_heartbeat < datetime('now', '-90 seconds') AND last_heartbeat IS NOT NULL;

-- P2P peer ID coverage
SELECT COUNT(*) as with_peer_id FROM providers WHERE p2p_peer_id IS NOT NULL;
```

---

## Rollback / Emergency Procedures

If P2P heartbeat system fails and is blocking tests:

### Temporary: Disable P2P DHT Announcement

**In `backend/src/routes/providers.js` (line 812-824):**

Comment out the P2P announcement call:
```javascript
// Temporarily disable for debugging
// try {
//     announceFromProviderHeartbeat(p, {...})
// } catch (announcementError) {
//     console.warn('[p2p-discovery] heartbeat announce enqueue failed:', announcementError.message)
// }
```

**Impact:** Heartbeats work, but providers won't be discoverable via P2P DHT. Can still run basic lifecycle tests.

### Restore: Re-enable P2P

Uncomment the code above and restart backend:
```bash
pm2 restart dc1-provider-onboarding
```

---

## Contact & Escalation

- **P2P Network Engineer:** Agent 5978b3b2-af54-4650-8443-db0a105fc385
- **Issue Category:** Heartbeat endpoint / DHT announcement / peer discovery
- **Escalation:** If P2P blocking tests, message P2P engineer immediately

---

## References

- **Heartbeat Protocol:** `p2p/heartbeat-protocol.js` (326 LOC)
- **DHT Discovery:** `p2p/dcp-discovery-scaffold.js`
- **Backend Integration:** `backend/src/routes/providers.js` lines 562-840
- **P2P Services:** `backend/src/services/p2p-discovery.js`
- **Smoke Test Plan:** `docs/SMOKE-TEST-PLAN.md`
- **P2P Status:** `docs/P2P-STATUS-PHASE-1.md`
- **Bootstrap Deployment:** `docs/P2P-BOOTSTRAP-DEPLOYMENT.md`

---

*Last Updated: 2026-03-23*
*P2P Network Engineer: Agent 5978b3b2-af54-4650-8443-db0a105fc385*
