# DCP P2P Network — Failure Resilience Test Plan

**Version**: 1.0
**Date**: 2026-03-19
**Author**: P2P Network Engineer
**Relates to**: DCP-169

---

## Overview

This document extends the existing 3-node Docker P2P test (`p2p/docker-compose.yml`) with failure scenarios. The goal is to validate that the DCP P2P network handles provider disconnects gracefully without data loss, duplicate job execution, or unbounded renter fund exposure.

### Existing 3-Node Baseline

The current `docker-compose.yml` establishes:

| Service     | Role            | GPU       | VRAM | Price SAR/hr |
|-------------|-----------------|-----------|------|-------------|
| bootstrap   | Relay/rendezvous| —         | —    | —           |
| provider1   | Provider node   | RTX 3090  | 24 GB| 20          |
| provider2   | Provider node   | RTX 4090  | 24 GB| 35          |
| renter      | Client          | —         | —    | —           |

All nodes communicate over the `dc1-p2p` Docker bridge network via WebSocket to the Python bootstrap server (`bootstrap_server.py`, port 8765).

---

## Current Backend Implementation — Findings

Before designing test scenarios, the following was extracted from the live backend source code.

### 1. Heartbeat Interval

**Daemon sends heartbeats every 30 seconds** (configurable via the daemon, rate-limited at the API layer to 4/min per IP).

Source: `backend/src/server.js:82`
```
// Heartbeat: 4 per minute per IP (daemon sends every 30s = 2/min normally)
```

The heartbeat endpoint (`POST /api/providers/heartbeat`) updates `providers.last_heartbeat` and `status = 'online'` on every valid call.

### 2. Offline Detection Threshold

**Providers with `last_heartbeat` older than 90 seconds are marked `disconnected`.**

Source: `backend/src/services/recovery-engine.js:8-18`
```js
function detectDisconnectedProviders() {
  const cutoff = new Date(Date.now() - 90 * 1000).toISOString();
  const stale = db.all(
    `SELECT id, name FROM providers
     WHERE status = 'online' AND last_heartbeat < ?`,
    cutoff
  );
  for (const provider of stale) {
    db.run(`UPDATE providers SET status = 'disconnected' WHERE id = ?`, provider.id);
  }
  return stale;
}
```

The recovery cycle runs **every 30 seconds** via `setInterval(runRecoveryCycle, 30 * 1000)` in `server.js:323`.

A second threshold applies for the available-providers listing: **providers are shown as "live" only if their heartbeat is less than 120 seconds old** (`providers.js:1394`). This means there is a window of 90–120 seconds where a provider may be internally marked `disconnected` but not yet filtered from the available list — a minor display inconsistency that does not affect job routing.

### 3. Job Requeue Logic

The backend has **two complementary requeue mechanisms**:

#### Mechanism A — Recovery Engine (provider dropout)

Source: `backend/src/services/recovery-engine.js:92-108`

When the recovery cycle detects a disconnected provider, it:
1. Finds all jobs for that provider with status `pending` or `running`.
2. Calls `findBackupProvider(requiredVram, excludeProviderId)` — selects the online provider with the smallest VRAM that still satisfies the job requirement (ascending VRAM sort, excludes the failed provider).
3. Calls `migrateJob(jobId, fromProviderId, toProviderId)` which:
   - Inserts a `recovery_events` row with `reason = 'provider_disconnect'`.
   - Updates `jobs.provider_id` to the backup provider.
   - Sets `recovery_events.status = 'success'` immediately (optimistic — daemon pickup is not confirmed here).

If no backup provider is available, the job is left assigned to the disconnected provider with a `recovery_events` row of `status = 'no_backup'`. The job will eventually expire via the timeout enforcer (Mechanism B).

#### Mechanism B — Timeout Enforcer (job-level fallback)

Source: `backend/src/routes/jobs.js:1495-1529`

Runs every 30 seconds. Jobs in `running`, `assigned`, or `pulling` state that have passed their `timeout_at` timestamp are:
1. Marked `failed` with error `'Job timed out — provider may be offline or model too large'`.
2. Renter is refunded the full `cost_halala` amount.
3. Escrow hold is set to `expired`.
4. `promoteNextQueuedJob(providerId)` is called — promotes the next `queued` job for the **same provider** to `pending`. Note: if the provider is offline, promoted jobs will themselves time out unless a further recovery cycle migrates them.

#### Mechanism C — Queue Promotion

Source: `backend/src/routes/jobs.js:71-89`

When any job on a provider completes or fails, `promoteNextQueuedJob(providerId)` is called. It selects the highest-priority `queued` job for that provider (priority ASC, then `created_at` ASC) and transitions it to `pending`.

---

## Test Scenarios

### Scenario 1: Provider Dropout

**Goal**: Validate that a single provider disappearing from the network causes its in-flight job to be migrated to the remaining provider within one recovery cycle.

#### Setup
```yaml
# docker-compose.resilience-s1.yml (extends base compose)
services:
  provider1: ...   # RTX 3090, price 20 — will be the dropout node
  provider2: ...   # RTX 4090, price 35 — backup
  renter:          # submits a job targeting provider1
```

#### Steps

1. Start all nodes: `docker compose up bootstrap provider1 provider2`
2. Wait for provider1 and provider2 to complete registration with the bootstrap.
3. Renter submits an `llm_inference` job — because provider1 is cheaper (20 SAR/hr < 25 SAR/hr max), it should win the bid and be assigned the job.
4. Confirm job is in `running` status on provider1.
5. **Simulate dropout**: `docker stop provider1`
6. Wait up to **120 seconds** (worst case: one missed heartbeat + recovery cycle).

#### Expected Behaviour

| Time | Event |
|------|-------|
| t+0  | provider1 stops — no more heartbeats sent |
| t+30 | Last heartbeat is now ~30s old — within tolerance |
| t+60 | Last heartbeat is ~60s old — still within tolerance |
| t+90 | `detectDisconnectedProviders()` fires — provider1's `last_heartbeat` < cutoff → status = `disconnected` |
| t+90 | `runRecoveryCycle()` finds in-flight job on provider1 |
| t+90 | `findBackupProvider(requiredVram, provider1.id)` returns provider2 (the only online provider with sufficient VRAM) |
| t+90 | `migrateJob()` updates `jobs.provider_id = provider2.id`, records `recovery_events` row |
| t+90–120 | provider2's daemon polls `GET /api/providers/:key/jobs` and picks up the migrated job |

#### Pass Criteria
- Job status transitions to `running` on provider2 within 2 minutes of provider1 stopping.
- `recovery_events` table has a row with `reason = 'provider_disconnect'`, `status = 'success'`.
- Renter's balance is **not** debited twice.
- provider1 status = `disconnected` in the providers table.

#### Failure Modes to Watch
- **No backup VRAM**: if provider2 is also stopped, job lands in `no_backup` state and eventually times out. Renter gets a full refund.
- **Migration race**: if provider2 receives the migrated job assignment but provider1 restarts before the daemon pickup, both daemons could poll and see the job. The `UPDATE jobs SET status = 'assigned' WHERE status = 'pending'` atomic update in the daemon job-fetch endpoint ensures only one daemon wins (first write wins; second attempt sees non-`pending` status and gets a 404 or empty response).

---

### Scenario 2: Network Partition (Split Brain)

**Goal**: Validate that when two providers lose direct connectivity but retain a path through the bootstrap, no job is executed twice.

#### Topology
```
Node1 ←—✗—→ Node2
  \              \
   └——→ Bootstrap ←——┘
```

Node1 and Node2 cannot reach each other's WebSocket ports directly. Both can still reach Bootstrap.

#### Setup

In Docker, simulate this via network policy or `docker network disconnect`:
```bash
# Disconnect provider1 from provider2 directly (leave bootstrap reachable)
docker network disconnect dc1-p2p provider1
docker network connect --ip 172.28.0.10 dc1-p2p provider1   # re-attach with isolated IP
# Add iptables rule to block provider1 → provider2 direct traffic
docker exec provider1 iptables -A OUTPUT -d <provider2_ip> -j DROP
docker exec provider2 iptables -A OUTPUT -d <provider1_ip> -j DROP
```

Both providers continue heartbeating to the VPS backend (they share a route via Bootstrap/VPS, not via each other).

#### Expected Behaviour

- Both providers remain `online` in the backend (heartbeats still reach the VPS).
- When renter submits a job, the backend assigns it to exactly one provider based on the bid/selection logic.
- The assigned provider's daemon fetches the job via `GET /api/providers/:key/jobs`.
- The non-assigned provider never sees the job (job is provider-scoped by `provider_id`).
- **No duplicate execution** — the job record has a single `provider_id` and the status transition `pending → assigned` is atomic.

#### Pass Criteria
- Exactly one `running` record exists for the job.
- Exactly one provider reports job completion.
- Renter is charged once.
- `recovery_events` has zero rows for this job (no disconnect occurred).

#### Notes on Split-Brain Risk

The current backend architecture is **not vulnerable to split-brain duplicate execution** because:
1. Job assignment is mediated entirely by the central SQLite database via atomic `UPDATE … WHERE status = 'pending'`.
2. Providers do not communicate with each other to coordinate job pickup — they each poll the VPS independently.
3. There is no peer-to-peer job handoff in the current stack.

Split-brain becomes a concern only after Phase D, when GossipSub job announcements are added. At that point, deduplication must be enforced by including the job's `job_id` as an idempotency key in any GossipSub message.

---

### Scenario 3: Reconnection After Dropout

**Goal**: Validate that a provider that went offline and comes back re-announces itself and becomes available for new jobs within one heartbeat cycle.

#### Steps

1. Repeat Scenario 1 steps 1–5 (stop provider1 and allow job migration).
2. Wait for provider1 status to be `disconnected`.
3. **Restart provider1**: `docker start provider1`
4. Provider1 daemon starts, resumes heartbeating to `POST /api/providers/heartbeat`.

#### Expected Behaviour

| Time | Event |
|------|-------|
| t+0  | `docker start provider1` — daemon boots, begins heartbeat loop |
| t+30 | First heartbeat received by backend — `UPDATE providers SET status = 'online', last_heartbeat = NOW()` |
| t+30 | provider1 appears in `GET /api/renters/available-providers` (heartbeat_age < 120s) |
| t+30–60 | Renter can submit a new job; provider1 is eligible again |

#### Pass Criteria
- provider1 status transitions from `disconnected` → `online` on first successful heartbeat.
- `uptime_percent` and `reputation_score` are recomputed on reconnect (rolling 7-day window via `computeReputationScore()`).
- provider1 appears in available-providers endpoint with `is_live: true`.
- A new job submitted by the renter can be won by provider1 again.

#### Note on Reputation Impact

The 7-day uptime window in `computeReputationScore()` means that a 5-minute offline period subtracts approximately 5/10080 ≈ 0.05% from provider1's 7-day uptime score. This is negligible. A provider offline for hours will see a more meaningful reputation drop, which is the intended incentive mechanism.

---

## Docker Compose Extension for Resilience Tests

Add a `docker-compose.resilience.yml` override file that extends the base compose with test helper services:

```yaml
# p2p/docker-compose.resilience.yml
version: "3.9"

services:
  # Watchdog: logs provider connectivity events to stdout
  watchdog:
    build:
      context: .
      dockerfile: Dockerfile
    command: >
      python3 -c "
      import asyncio, websockets, json, time
      async def watch():
          async with websockets.connect('ws://bootstrap:8765') as ws:
              await ws.send(json.dumps({'type': 'subscribe', 'topic': 'peer_events'}))
              while True:
                  msg = await ws.recv()
                  print(f'[{time.time():.1f}] WATCHDOG: {msg}')
      asyncio.run(watch())
      "
    depends_on:
      bootstrap:
        condition: service_healthy
    networks:
      - dc1-p2p

networks:
  dc1-p2p:
    driver: bridge
```

Run the resilience suite:
```bash
cd p2p

# Scenario 1: Provider dropout
docker compose -f docker-compose.yml -f docker-compose.resilience.yml up -d
docker compose logs -f renter watchdog &
sleep 30   # let job get assigned to provider1
docker compose stop provider1
sleep 120  # wait for recovery cycle
docker compose logs renter | grep -E "JOB|COMPLETE|ERROR"

# Scenario 3: Reconnection
docker compose start provider1
sleep 60
docker compose logs renter | grep "available"
```

---

## Timing Summary

| Parameter | Value | Source |
|-----------|-------|--------|
| Daemon heartbeat interval | 30 seconds | `server.js:82`, daemon config |
| Offline detection threshold | 90 seconds | `recovery-engine.js:9` |
| Live availability threshold | 120 seconds | `providers.js:1394` |
| Recovery cycle frequency | 30 seconds | `server.js:323` |
| Timeout enforcement frequency | 30 seconds | `server.js:328` |
| Worst-case failover latency | ~120 seconds | 90s detection + 30s cycle lag |

---

## Gaps and Recommendations

| Gap | Impact | Recommendation |
|-----|--------|---------------|
| `migrateJob()` updates `provider_id` atomically but does NOT reset `status` back to `pending` | Migrated job may stay `running` — backup daemon won't pick it up until status is `pending` | Add `status = 'pending'` to the `UPDATE jobs` in `migrateJob()` |
| `promoteNextQueuedJob()` promotes to the **same** (potentially offline) provider | Promoted jobs will time out if the provider is still offline | Check provider status before promoting; if `disconnected`, skip or migrate |
| Recovery cycle marks provider `disconnected` but does NOT requeue `queued` jobs (only `pending`/`running`) | Queued jobs are stranded on offline provider indefinitely | Include `status = 'queued'` in `findActiveJobsOnProvider()` |
| No P2P-level disconnect signal | P2P layer doesn't notify backend when a peer drops | Phase D: add GossipSub `peer_left` event → trigger `runRecoveryCycle()` immediately |

---

## Phase D P2P Integration Notes

When GossipSub is added (Phase D), the dropout detection pathway should be:

```
Provider P2P node drops  →  libp2p peer:disconnect event
  →  Bootstrap emits GossipSub 'provider_left/{peerId}' to all subscribers
  →  Backend P2P listener receives event
  →  Immediately calls runRecoveryCycle() (instead of waiting ≤30s)
  →  Reduces worst-case failover from ~120s to ~5s
```

This eliminates the polling-based recovery window and is the primary motivation for adding GossipSub in Phase D.
