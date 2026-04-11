# DCP Provider Discovery Architecture

**Version**: 1.0
**Date**: 2026-03-19
**Author**: P2P Network Engineer
**Status**: Research / Phase D pre-design

---

## Section 1: Current Architecture — Centralized Pull Model

DCP's current provider discovery relies entirely on a centralized VPS running Express.js backed by a SQLite database. The flow is:

### 1.1 Registration

A provider downloads the DCP daemon (`dcp_daemon.py v4.0.0-alpha.2`) and runs it on their GPU machine. On first launch, the daemon calls:

```
POST /api/providers/register
Body: { name, email, gpu_model, os, resource_spec }
```

The backend inserts a row into the `providers` SQLite table, generates a unique `api_key` (`dc1-provider-<32 hex chars>`), and returns it. All subsequent daemon calls authenticate with this key.

### 1.2 Heartbeat

While the daemon is running, it sends a heartbeat **every 30 seconds**:

```
POST /api/providers/heartbeat
Body: { api_key, gpu_status: { gpu_name, gpu_vram_mib, gpu_util_pct, temp_c, power_w, free_vram_mib, gpu_count, all_gpus, daemon_version, ... }, provider_ip, provider_hostname, cached_models, resource_spec }
```

On each heartbeat the backend:
1. Updates `providers.last_heartbeat`, `providers.status = 'online'`, and all GPU telemetry fields.
2. Inserts a row into `heartbeat_log` (full time-series of GPU metrics).
3. Recomputes `uptime_percent` and `reputation_score` over a rolling 7-day window.
4. Responds with `{ success: true, update_available: bool, min_version: "3.3.0" }`.

The heartbeat endpoint is rate-limited to **4 requests/minute per IP** (the daemon's 30 s cadence produces ~2/min normally, leaving headroom for retries).

### 1.3 Availability Classification

Provider availability is computed in JavaScript from `last_heartbeat` age at query time — not stored as a status field (the stored `status` column is a coarser signal set by the recovery engine):

| Heartbeat age | Computed status | Marketplace visibility |
|---------------|-----------------|----------------------|
| < 2 minutes   | `online`        | Listed, is_live = true |
| 2–10 minutes  | `degraded`      | Listed, is_live = false |
| > 10 minutes  | `offline`       | Excluded from results |

Source: `providers.js:1591–1618` (`HEARTBEAT_ONLINE_THRESHOLD_S = 120`, `HEARTBEAT_DEGRADED_THRESHOLD_S = 600`).

A separate recovery engine (running every 30 s) marks providers `disconnected` in the database once their `last_heartbeat` is older than **90 seconds** — this triggers job migration.

### 1.4 Renter Discovery

Renters query:

```
GET /api/providers/available
```

The backend fetches all non-paused providers that have ever sent a heartbeat, computes their current status from heartbeat age, filters to `online` and `degraded`, enriches with GPU spec, cached models, and reputation score, sorts by (status, reputation DESC), and returns a ranked list. The renter's frontend or job-submission call then selects a provider.

### 1.5 Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  DCP VPS (76.13.179.86)              │
│                                                      │
│  Express.js API (port 8083)                          │
│  ┌──────────────────────────────────────────────┐   │
│  │  POST /providers/register                    │   │
│  │  POST /providers/heartbeat  ◄──── every 30s  │   │
│  │  GET  /providers/available  ◄──── on demand  │   │
│  │  POST /jobs/submit                           │   │
│  └──────────────────────────────────────────────┘   │
│                    │                                 │
│  SQLite (providers.db)                               │
│  ┌─────────────────────────────────────────────┐    │
│  │  providers table: last_heartbeat, status,   │    │
│  │  reputation_score, gpu_spec, ...            │    │
│  │  heartbeat_log table: time-series GPU data  │    │
│  └─────────────────────────────────────────────┘    │
└────────────────────┬───────────────────┬────────────┘
                     │                   │
           POST heartbeat         GET available
                     │                   │
         ┌───────────┴──┐       ┌───────┴──────────┐
         │ Provider A   │       │ Renter / Frontend │
         │ (daemon)     │       │                   │
         └──────────────┘       └───────────────────┘
         ┌──────────────┐
         │ Provider B   │
         │ (daemon)     │
         └──────────────┘
         ...
```

Every actor talks exclusively to the VPS. Providers do not know about each other.

---

## Section 2: Analysis — Failure Modes, Overhead, Latency

### 2.1 Failure Modes of Centralized Discovery

#### Single point of failure (critical)
If the VPS becomes unreachable (hardware failure, DDoS, network partition, deployment error), the consequences cascade:

| Component | Impact |
|-----------|--------|
| Provider heartbeats | Cannot reach `/providers/heartbeat` → all providers appear offline within 90–120 s |
| Renter discovery | `/providers/available` returns 503 → marketplace shows no GPUs |
| Job submission | `/jobs/submit` fails → renters cannot dispatch work |
| Job polling | Daemons cannot poll `/providers/:key/jobs` → running jobs stall until VPS recovers |
| Revenue | Zero transactions during outage — SAR locked in escrow is safe but inaccessible |

A 10-minute VPS outage degrades every active provider to `offline` status. Recovery requires the VPS to come back online AND each daemon to re-send a heartbeat (up to 30 s additional delay per provider).

#### Database corruption / write lock
SQLite under high concurrency is vulnerable to write lock contention. With 1000+ providers sending heartbeats every 30 s, peak write load can cause `SQLITE_BUSY` errors. better-sqlite3's synchronous model serializes writes, preventing corruption but introducing latency spikes that cause heartbeat timeouts.

#### Fake provider injection
Any attacker who can POST to `/providers/register` can create fraudulent provider entries. The current mitigation is the 38-GPU fraud detection heuristic and machine verification, but a centralized registry is a higher-value attack target than a distributed DHT where forged records can be cross-validated.

#### Stale provider list
Between heartbeats, the provider list is up to 30 s stale. Renters may select a provider that went offline 29 s ago. The recovery engine mitigates this but cannot eliminate the window.

### 2.2 Heartbeat Overhead at Scale

Each heartbeat is one HTTP POST request that triggers:
- 1× SQLite UPDATE on `providers`
- 1× SQLite INSERT into `heartbeat_log`
- 1× SQLite SELECT + UPDATE for reputation recompute
- JSON serialization of gpu_status blob

Estimated request rate at different provider counts:

| Providers | Heartbeat interval | Requests/minute | Requests/second |
|-----------|--------------------|-----------------|-----------------|
| 100       | 30 s               | ~200            | ~3.3            |
| 1,000     | 30 s               | ~2,000          | ~33             |
| 10,000    | 30 s               | ~20,000         | ~333            |

At 1,000 providers, the heartbeat load is manageable on a single Node.js process. At 10,000 providers, 333 req/s of write-heavy SQLite operations will saturate a single-threaded SQLite instance. PostgreSQL or distributed storage would be required before reaching this scale.

The `heartbeat_log` table grows at `providers × 2 heartbeats/min × 60 × 24 × 365 = ~1.05 billion rows/year` at 1,000 providers. Without aggressive pruning, disk usage becomes a constraint.

**Current rate limit**: 4 requests/minute per IP. This allows retry logic but does not meaningfully limit a malicious actor with many IPs.

### 2.3 Latency Added by Centralized Job Dispatch

The full job lifecycle in the current model:

```
Renter submits job  →  VPS assigns to provider  →  Daemon polls VPS  →  Daemon executes  →  VPS stores result  →  Renter fetches output
```

Round-trip latency components:

| Step | Typical latency |
|------|----------------|
| Renter → VPS (job submit) | 20–150 ms (Saudi Arabia → Hostinger VPS) |
| VPS processes + assigns | 5–20 ms (SQLite write) |
| Daemon poll cycle | 0–30 s (daemon polls every ~30 s) |
| VPS → Daemon (job payload) | 20–150 ms |
| Daemon executes job | model-dependent (seconds to minutes) |
| Daemon → VPS (result upload) | 20–150 ms |
| Renter polls result | 0–30 s (polling interval) |

**The dominant latency is daemon polling**: up to 30 s before the daemon picks up a newly assigned job. With a decentralized push model (GossipSub or direct peer notification), this polling window could be eliminated, reducing job start latency from O(30 s) to O(1 s).

All renter-to-VPS and VPS-to-daemon traffic is also routed through a single geographic choke point. A renter in Riyadh connecting to a provider in Riyadh still has all job data transit through the VPS, adding unnecessary round-trip latency for what could be a direct provider connection.

---

## Section 3: Phase D Proposal — Decentralized Peer Discovery

### 3.1 Core Architecture: libp2p + Kademlia DHT

The proposed Phase D system replaces the centralized provider registry with a **gossip-based P2P discovery layer** built on [libp2p](https://libp2p.io/). Providers and renters become peers on a distributed network. The DCP central API is retained as a coordination and trust layer, but is no longer the single source of truth for provider availability.

#### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| P2P framework | libp2p (JS/TS) | Peer identity, transport, multiplexing |
| Provider discovery | Kademlia DHT | Distributed hash table for provider lookup |
| Real-time broadcast | GossipSub | Provider join/leave/status events |
| Local network discovery | mDNS | Zero-config discovery on same LAN |
| NAT traversal | Circuit Relay v2 | Providers behind NAT/firewall |
| Transports | WebSocket + TCP | Browser (WS) and daemon (TCP) support |
| Bootstrap seeding | Known multiaddrs | Initial peer introduction |

#### Provider Announcement via CID

Similar to Ocean Protocol's `/ocean/nodes/1.0.0/kad/1.0.0` DHT pattern, DCP providers announce their compute environment as a **Content Identifier (CID)**. The CID encodes the provider's capabilities:

```
CID = hash({ gpu_model, vram_gb, os, cuda_version, cached_models, price_sar_hr })
```

A renter looking for "≥24 GB VRAM running Llama-3-70B" queries the DHT for providers matching that capability profile. The DHT returns a list of `PeerInfo` objects (peer ID + multiaddrs), and the renter connects directly or via circuit relay.

#### Network Topology

```
                    ┌──────────────────────────────┐
                    │  DCP Bootstrap Nodes (VPS)    │
                    │  libp2p node, known multiaddr │
                    │  DHT bootstrap + relay        │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────┴──────┐  ┌──────┴──────┐  ┌─────┴──────────┐
    │ Provider Node A│  │Provider B   │  │ Provider C     │
    │ libp2p peer    │  │ libp2p peer │  │ libp2p peer    │
    │ Announces CID  │  │ Announces   │  │ (behind NAT)   │
    │ TCP + WS       │  │ CID         │  │ Via relay      │
    └────────────────┘  └─────────────┘  └────────────────┘
              │                │
    ┌─────────┴──────┐  ┌──────┴──────┐
    │ Renter Node    │  │ DCP API     │
    │ Queries DHT    │  │ (optional   │
    │ for providers  │  │  read path) │
    └────────────────┘  └─────────────┘
```

### 3.2 Provider Lifecycle in P2P Model

#### Join
1. Provider daemon starts → creates a libp2p node with ed25519 keypair (persisted as `peer_id.key`).
2. Connects to one of the known DCP bootstrap node multiaddrs.
3. Announces capability CID to the Kademlia DHT: `dht.provide(capabilityCID)`.
4. Subscribes to GossipSub topic `/dcp/providers/1.0.0`.
5. Publishes `provider_joined` message: `{ peerId, capabilities, multiaddrs, api_key_hash }`.

`api_key_hash` is a one-way hash of the provider's DCP API key — allows the central API to cross-reference P2P identity with the registered provider without exposing the key on the network.

#### Heartbeat (P2P flavor)
Instead of POSTing to the VPS every 30 s, the daemon:
- Publishes a lightweight `provider_alive` GossipSub message every 60 s: `{ peerId, gpu_util_pct, free_vram_mib, timestamp }`.
- Continues sending heartbeats to the DCP API for billing, reputation, and job dispatch (in Phase D, both paths run in parallel).

This reduces VPS heartbeat load while keeping real-time availability signals on the P2P layer.

#### Discovery (Renter flow)
1. Renter node queries DHT: `dht.findProviders(capabilityCID)` → returns list of `PeerInfo`.
2. Renter connects to each candidate peer and requests a signed capability advertisement.
3. Renter selects best provider based on price, reputation, and VRAM.
4. Renter can submit jobs directly to the provider P2P node (Phase D+) OR fall back to the DCP central API (Phase D).

#### Leave
When a provider daemon shuts down gracefully, it:
1. Publishes `provider_left` GossipSub message: `{ peerId, reason: 'shutdown' }`.
2. Removes itself from the DHT.

When a provider crashes (ungraceful), the GossipSub `peer:disconnect` libp2p event triggers the bootstrap node to publish `provider_left` on its behalf. This reduces worst-case failover detection from ~120 s (current polling model) to ~5 s (immediate P2P event).

### 3.3 DCP Central API as Coordination Layer

The central API is retained in Phase D for:

| Function | Reason to keep centralized |
|----------|---------------------------|
| Provider registration | KYC, IBAN capture, legal compliance |
| Job billing and escrow | SAR transactions require a trusted ledger |
| Reputation scoring | Tamper-resistant history across providers |
| Daemon version enforcement | Controlled rollout of security patches |
| Fraud detection | 38-GPU heuristic requires cross-provider view |
| Payout processing | Bank transfers, IBAN verification |

The API becomes a **thin trust layer** rather than a discovery bottleneck. Discovery is delegated to the P2P network; the API focuses on money and identity.

### 3.4 GossipSub Topics

| Topic | Publisher | Subscribers | Payload |
|-------|-----------|-------------|---------|
| `/dcp/providers/1.0.0` | Providers, Bootstrap | Renters, DCP API | `provider_joined`, `provider_left`, `provider_alive` |
| `/dcp/jobs/1.0.0` | DCP API | Providers | `job_available`, `job_cancelled` |
| `/dcp/network/1.0.0` | Bootstrap | All peers | `bootstrap_alive`, `peer_count`, `network_stats` |

Each message is signed with the sender's libp2p ed25519 key. Recipients verify the signature before acting on any message — preventing forged provider announcements.

---

## Section 4: Implementation Roadmap

### 4.1 Phase Breakdown

#### Phase A — P2P Prototype (2 weeks)
**Goal**: A working libp2p node that providers can run alongside the existing daemon.

Deliverables:
- `p2p/node.ts` — libp2p node factory (TCP + WS transports, GossipSub, Kademlia DHT, mDNS)
- `p2p/bootstrap.ts` — Bootstrap node for the DCP VPS
- `p2p/provider-peer.ts` — Provider-side peer that announces capability CID and publishes heartbeat events
- `docker-compose.yml` in `p2p/` — 3-node test environment (bootstrap, 2 providers)
- No changes to the daemon or backend

Infrastructure changes: Deploy bootstrap node on VPS as a new PM2 service (port 4001 TCP, port 4002 WS).

#### Phase B — DHT Integration (2 weeks)
**Goal**: Renters can discover providers via DHT, running in parallel with the existing API.

Deliverables:
- `p2p/renter-peer.ts` — Renter-side DHT query client
- `p2p/capability-cid.ts` — CID generation from provider capability spec
- Backend bridge: DCP API reads DHT discovery results and cross-references with `providers` table
- Admin dashboard panel showing P2P network size and peer health

Infrastructure changes: None beyond Phase A bootstrap node.

#### Phase C — GossipSub Events + Backend Integration (2 weeks)
**Goal**: Provider join/leave events propagate in near-real-time; recovery engine is triggered by P2P events instead of polling.

Deliverables:
- Backend P2P listener: subscribes to `/dcp/providers/1.0.0`, calls `runRecoveryCycle()` immediately on `provider_left` event
- Daemon upgrade: daemon publishes `provider_alive` to GossipSub in addition to VPS heartbeat POST
- Reduce worst-case failover from ~120 s to ~5 s
- Test suite: `docs/p2p-resilience-test.md` scenarios executed against Phase C stack

Infrastructure changes: Backend must open a persistent libp2p connection to the P2P network. The existing `server.js` gains a P2P listener module.

#### Phase D — Full Decentralized Discovery (4 weeks)
**Goal**: Renters can discover and evaluate providers without querying the DCP API. Job submission optionally bypasses the VPS for direct provider-to-renter channels.

Deliverables:
- Browser-compatible renter P2P node (WebSocket transport, WebRTC optional)
- Direct job submission via P2P (provider signs job receipt; DCP API records billing)
- `GET /api/providers/available` deprecated (P2P DHT is authoritative)
- Fallback: renters without P2P capability continue using the REST API (maintained for 12 months)
- Provider price controls: each provider broadcasts their own `price_sar_hr` via DHT (Phase 4 gap closure)

Infrastructure changes:
- Bootstrap nodes: at least 2 geographically distributed bootstrap nodes (failover)
- Provider daemon `v4.0.0`: adds libp2p module
- Backwards compatibility: daemon versions < 4.0.0 continue working via central API for 6 months

### 4.2 Effort Estimate Summary

| Phase | Focus | Weeks | Team |
|-------|-------|-------|------|
| A | libp2p prototype, bootstrap node, 3-node Docker test | 2 | P2P Engineer |
| B | DHT + capability CID + renter client | 2 | P2P Engineer |
| C | GossipSub integration, backend bridge, recovery acceleration | 2 | P2P Engineer + Backend |
| D | Full decentralized discovery, daemon v4.0.0, browser client | 4 | P2P Engineer + Frontend + Backend |
| **Total** | | **10 weeks** | |

### 4.3 Infrastructure Changes

| Item | Phase A/B | Phase C/D |
|------|-----------|-----------|
| Bootstrap node (VPS) | Add PM2 service, open ports 4001/4002 | Add second bootstrap node (separate VPS or region) |
| Firewall | Open TCP 4001, WS 4002 on 76.13.179.86 | Same for second node |
| Daemon | No change | v4.0.0 adds libp2p module (~50 KB dependency) |
| Backend | No change | Add P2P listener module to server.js |
| Frontend | No change | Optional: WS-based renter P2P client |

### 4.4 Backwards Compatibility

The central REST API is maintained throughout all phases. The P2P layer is **additive** until Phase D, where the REST discovery path is deprecated (not removed). Providers running daemon < v4.0.0 continue working via heartbeat POST until the deprecation deadline.

The SQLite-backed `providers` table remains the authoritative store for billing, payout, and compliance data. P2P discovery complements it; the API does not become a passive mirror until Phase D+ (out of scope).

### 4.5 Key Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| NAT traversal failures (providers behind CGNAT) | High — residential GPU providers | Circuit Relay v2 required from Phase A |
| DHT Sybil attack (fake provider CIDs) | Medium | Require signed `api_key_hash` in DHT record; cross-check with central API |
| GossipSub message amplification | Low | Set `D = 6`, `Dlo = 4`, `Dhi = 12` in GossipSub params; limit message size to 4 KB |
| Bootstrap node DDoS | Medium | Rate limit bootstrap connections; deploy 2+ bootstrap nodes by Phase D |
| Daemon size increase | Low | libp2p JS adds ~2–5 MB to daemon bundle — acceptable |
| Split-brain duplicate job execution (Phase D) | Medium | Job IDs are idempotency keys in all GossipSub messages; atomic DB update on pickup |

---

## Appendix: Key Source References

| Reference | File | Lines |
|-----------|------|-------|
| Registration endpoint | `backend/src/routes/providers.js` | 53–118 |
| Heartbeat endpoint + contract | `backend/src/routes/providers.js` | 228–360 |
| Availability thresholds | `backend/src/routes/providers.js` | 1591–1618 |
| Available-providers query | `backend/src/routes/providers.js` | 1714–1795 |
| Recovery engine (offline detection) | `backend/src/services/recovery-engine.js` | 8–60 |
| Job migration logic | `backend/src/services/recovery-engine.js` | 92–108 |
| Timeout enforcer | `backend/src/routes/jobs.js` | 1495–1529 |
| Resilience test plan | `docs/p2p-resilience-test.md` | all |
