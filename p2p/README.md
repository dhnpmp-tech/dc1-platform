# DC1 P2P Provider Discovery — Phase C Prototype

> **Status**: Research prototype (Phase C). Not yet integrated into production.
> Production integration is planned for Phase D.

## Overview

DC1 currently uses a centralised SQLite registry on the VPS at `76.13.179.86`.
Providers register once and renters query `/api/providers/available` — a single
point of failure that also requires the VPS to be online for any GPU discovery
to work.

This module replaces that registry with a **Kademlia DHT** built on
[libp2p](https://libp2p.io). Providers write their GPU compute spec to the DHT;
renters walk the DHT to discover providers without touching the VPS.

```
Current (Phase A/B)                Phase C/D target
────────────────────────────       ──────────────────────────────────
Provider daemon                    Provider daemon
  └─ POST /api/providers/heartbeat   └─ node p2p/provider-announce.js
       │                                   │
       ▼                                   ▼
VPS SQLite DB ◄──── single point    Kademlia DHT (distributed)
       │            of failure            │
       ▼                                  ▼ (any node in DHT)
GET /api/providers/available        Renter queries DHT
       │                                   │
       ▼                                   ▼
Renter selects GPU                 Renter selects GPU
```

## Architecture

### Stack

| Layer | Package | Note |
|---|---|---|
| Transport | `@libp2p/tcp` | TCP for provider/VPS nodes; WebSocket added in Phase D for browser renters |
| Encryption | `@libp2p/noise` | Noise XX handshake — libp2p standard |
| Muxer | `@libp2p/yamux` | Stream multiplexer |
| Discovery | `@libp2p/kad-dht` | Kademlia DHT, scoped to `/dc1/kad/1.0.0` |
| Bootstrap | `@libp2p/bootstrap` | Initial seed peer (VPS) for network entry |

### DHT key schema

```
/dc1/provider/{peerId}  →  JSON GPU spec
```

Example record:

```json
{
  "gpu": "RTX 4090",
  "vram_gb": 24,
  "price_sar_per_hour": 45,
  "cuda_version": "12.3",
  "driver_version": "545.23.08",
  "location": "Riyadh, SA",
  "peer_id": "12D3KooW...",
  "announced_at": "2026-03-18T21:00:00.000Z",
  "addrs": ["/ip4/203.0.113.42/tcp/4001"]
}
```

### Scoped DHT

The DHT uses protocol `/dc1/kad/1.0.0` — **it never touches the public IPFS DHT**.
DC1 provider data stays within the DC1 network.

## Files

| File | Role |
|---|---|
| `dc1-node.js` | Core libp2p node factory + DHT helper functions |
| `bootstrap.js` | Stable routing-only node to run on VPS (PM2) |
| `provider-announce.js` | CLI tool called by `dc1_daemon.py` to write spec to DHT |
| `demo.js` | Self-contained two-node demo — no VPS needed |
| `package.json` | Isolated package (`"type": "module"`) |

## Quick start

```bash
cd p2p
npm install

# Run the discovery demo (no VPS needed):
node demo.js
```

## Python Job Routing Prototype (Phase C)

The Python layer adds **job routing** on top of the discovery layer:
providers form a mesh, renters broadcast job requests, providers bid, and
the renter picks the cheapest bid.  The central VPS API is **not** involved
in job data transfer — only in billing (Phase D).

### Message flow

```
Renter                Bootstrap              Provider 1        Provider 2
  │                       │                      │                 │
  │── PEER_HELLO ─────────▶│                      │                 │
  │◀─ PEER_LIST ───────────│                      │                 │
  │                        │◀── ANNOUNCE_CAPACITY─┤                 │
  │◀── ANNOUNCE_CAPACITY ──│◀── ANNOUNCE_CAPACITY─┼─────────────────┤
  │── JOB_REQUEST ─────────▶── broadcast ─────────▶─────────────────▶
  │◀─ JOB_BID (20 SAR/hr)──│◀──────────────────────┤                 │
  │◀─ JOB_BID (35 SAR/hr)──│◀────────────────────────────────────────┤
  │── JOB_ACCEPT ──────────▶──────────────────────▶                  │
  │                         │                      │ (executes job)   │
  │◀─────────────── JOB_RESULT (direct P2P) ───────┤                 │
```

Provider 1 wins because it bids lower (20 SAR/hr < 35 SAR/hr).

### 3-node Docker Compose test

```bash
cd p2p
docker compose up --build
```

Expected result: renter log shows `>>> Winning bid: ... GPU=RTX 3090  2000 h/hr`
then `JOB COMPLETE  Success: True`.

### Running without Docker

```bash
cd p2p
pip install websockets

# Terminal 1 — bootstrap
python3 bootstrap_server.py

# Terminal 2 — provider 1 (cheaper)
DC1_P2P_BOOTSTRAP=ws://127.0.0.1:8765 \
  python3 provider_node.py --gpu "RTX 3090" --vram 24 --price 20.0

# Terminal 3 — provider 2 (more expensive)
DC1_P2P_BOOTSTRAP=ws://127.0.0.1:8765 \
  python3 provider_node.py --gpu "RTX 4090" --vram 24 --price 35.0

# Terminal 4 — renter
DC1_P2P_BOOTSTRAP=ws://127.0.0.1:8765 \
  python3 renter_client.py --image dc1/simulate --max-price 25.0
```

### Environment variables (Python layer)

| Variable | Default | Description |
|---|---|---|
| `DC1_P2P_BOOTSTRAP` | `ws://127.0.0.1:8765` | Bootstrap WS address (comma-separated for multiple) |
| `DC1_P2P_BOOTSTRAP_PORT` | `8765` | Bootstrap listen port |
| `DC1_P2P_HOST` | auto-detect | Provider's externally reachable hostname |
| `DC1_P2P_PORT` | `8766` | Provider's direct P2P WebSocket port |
| `DC1_RENTER_HOST` | `127.0.0.1` | Renter's externally reachable hostname |
| `DC1_RENTER_PORT` | `8767` | Renter's result WebSocket port |
| `DC1_BID_WINDOW_SECS` | `5` | Seconds renter waits to collect bids |
| `DC1_JOB_TIMEOUT_SECS` | `300` | Max job execution time (seconds) |

## VPS Setup (Phase D prerequisite)

Run the bootstrap node on the VPS alongside the Express API:

```bash
# On VPS
cd /opt/dc1/p2p
npm install
pm2 start bootstrap.js --name dc1-p2p-bootstrap
pm2 save
```

Copy the printed multiaddr (e.g. `/ip4/76.13.179.86/tcp/4001/p2p/12D3KooW...`)
and set it as an environment variable on all provider machines:

```bash
export DC1_P2P_BOOTSTRAP=/ip4/76.13.179.86/tcp/4001/p2p/12D3KooW...
```

Also update `DEFAULT_BOOTSTRAP_ADDR` in `dc1-node.js`.

## Integrating with dc1_daemon.py

After the provider daemon's 30-second heartbeat, call `provider-announce.js`
as a fire-and-forget subprocess:

**Option A — subprocess (simplest):**

```python
import subprocess, json

spec = {
    "gpu": gpu_name,
    "vram_gb": vram_gb,
    "price_sar_per_hour": price_sar
}

subprocess.Popen(
    ["node", "p2p/provider-announce.js", "--spec", json.dumps(spec)],
    cwd="/opt/dc1"
)
```

**Option B — HTTP IPC (Phase D):**

```python
import aiohttp, json

async def announce_p2p(spec):
    async with aiohttp.ClientSession() as s:
        await s.post(
            "http://localhost:8083/api/p2p/announce",
            json={"spec": spec}
        )
```

Backend route `/api/p2p/announce` (to be built in Phase D) calls the libp2p
node internally via IPC and keeps a single persistent libp2p node per VPS
process — more efficient than spawning per heartbeat.

## Phase Roadmap

### Phase A/B (current) — Centralised
- Providers → VPS SQLite
- Renters → `/api/providers/available`
- VPS is required for all discovery

### Phase C (this prototype) — DHT research + P2P job routing

**Provider discovery (JavaScript / libp2p Kademlia DHT):**
- ✅ `dc1-node.js` — core libp2p node factory
- ✅ `bootstrap.js` — VPS routing node
- ✅ `provider-announce.js` — daemon integration hook
- ✅ `demo.js` — working end-to-end discovery demo
- ❌ Not yet integrated into daemon or backend

**Job routing (Python / WebSocket mesh):**
- ✅ `config.py` — network config, env overrides, `MsgType` constants
- ✅ `bootstrap_server.py` — relay/rendezvous server (Circuit Relay pattern)
- ✅ `provider_node.py` — announces GPU capacity, bids on jobs, executes & delivers results P2P
- ✅ `renter_client.py` — discovers providers, broadcasts job, selects lowest bid, receives result
- ✅ `proto/dc1.proto` — canonical Protobuf schema for all wire messages
- ✅ `docker-compose.yml` — 3-node local test (bootstrap + 2 providers + renter)
- ✅ `Dockerfile` + `requirements.txt` — Python 3.11-slim, `websockets>=12.0`

### Phase D — DHT in production
- [ ] Run `bootstrap.js` on VPS under PM2
- [ ] Integrate `provider-announce.js` call into `dc1_daemon.py`
- [ ] Add WebSocket transport for browser renters
- [ ] Add GossipSub for real-time provider availability broadcasts
- [ ] Add Circuit Relay for providers behind NAT
- [ ] Build prefix-scan (`/dc1/provider/*`) via DHT Provider Records or a
      dedicated rendezvous point so renters can list *all* providers
- [ ] Persist bootstrap peer ID across VPS restarts (stable multiaddr)
- [ ] Replicate provider records to multiple VPS bootstrap nodes (HA)
- [ ] Backend `/api/p2p/announce` route (Option B daemon integration)

### Phase E — Full decentralisation
- VPS becomes optional — discovery works peer-to-peer
- Job matching and payment escrow moved to smart contracts (TBD)

## Design Decisions

### Why Kademlia DHT?
Ocean Protocol uses the same pattern (`/ocean/nodes/1.0.0/kad/1.0.0`) for
decentralised data asset discovery. It is battle-tested at millions of nodes
and well supported by libp2p.

### Why not just use IPFS?
DC1 provider data is ephemeral (expires when a provider goes offline) and
financially sensitive. A scoped private DHT keeps DC1 data off the public IPFS
network and allows us to enforce access control in later phases.

### Why TCP for now?
Providers run server-grade Linux machines with static IPs — TCP is appropriate.
WebSocket transport is added in Phase D so browser-based renter dashboards can
perform DHT discovery directly without proxying through the VPS.

### kBucketSize = 2
The prototype uses `kBucketSize: 2` (normally 20) to reduce memory overhead
during local testing with < 5 nodes. **Set back to 20 for production.**

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DC1_P2P_BOOTSTRAP` | (placeholder) | Full multiaddr of bootstrap node |
| `DC1_P2P_BOOTSTRAP_PORT` | `4001` | Bootstrap node TCP port |
| `DC1_P2P_PORT` | `0` (random) | Provider node TCP port |
| `DC1_P2P_TIMEOUT_MS` | `15000` | Max ms for DHT put in provider-announce.js |
