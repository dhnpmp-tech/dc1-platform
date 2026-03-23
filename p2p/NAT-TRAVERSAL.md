# DCP P2P NAT Traversal & Heartbeat Protocol

## Overview

This document describes the NAT traversal and heartbeat mechanisms for the DCP P2P networking layer, enabling provider nodes behind NATs to participate in the decentralized compute network.

## NAT Traversal Strategy

DCP uses a multi-layered approach to handle NAT-ed provider nodes:

### 1. Circuit Relay v2 (Primary)

**What it does:**
- Allows NATed providers to announce themselves via a relay server
- Renters can discover and connect to providers through the relay
- Provides a fallback path when direct NAT hole-punching is not feasible

**Configuration:**
```javascript
import { circuitRelayTransport, circuitRelayServer } from '@libp2p/circuit-relay-v2'

const node = await createLibp2p({
  transports: [
    tcp(),
    circuitRelayTransport({
      discoverRelays: 1,
      maxConnections: 10,
    })
  ],
  services: {
    dcpRelayServer: circuitRelayServer(),
  }
})
```

**Feature flag:**
```bash
P2P_DISCOVERY_ENABLE_RELAY=true
```

**How providers use it:**
1. Provider node boots and discovers relay servers via DHT bootstrap
2. Provider connects to relay and announces itself
3. Relay stores provider's relay address: `/ip4/relay-ip/tcp/relay-port/p2p/relay-id/p2p-circuit/p2p/provider-id`
4. Renters query DHT, get relay address, and dial through it

### 2. WebSocket Transport (Optional)

**What it does:**
- Enables browser-based renters to connect to provider nodes
- Works through most firewalls via port 80/443
- Can be combined with Circuit Relay

**Configuration:**
```bash
P2P_DISCOVERY_ENABLE_WEBSOCKET=true
```

### 3. mDNS Local Discovery (Optional)

**What it does:**
- Enables local provider clustering on the same LAN
- Providers advertise themselves via multicast DNS
- Useful for on-premises deployments

**Configuration:**
```bash
P2P_DISCOVERY_ENABLE_MDNS=true
```

## Heartbeat Protocol

The heartbeat protocol tracks provider node liveness and health in real-time.

### Design

**Key characteristics:**
- Periodic announcements every 30 seconds (configurable)
- DHT-backed storage with 60-second TTL
- Stale detection at 90 seconds
- Minimal overhead (< 1KB per heartbeat)
- Per-peer metrics (CPU, memory, GPU utilization)

### Heartbeat Record Schema

```json
{
  "version": 1,
  "peer_id": "12D3KooW...",
  "timestamp": "2026-03-23T08:26:23.826Z",
  "sequence": 42,
  "status": "healthy|degraded|warning",
  "metrics": {
    "cpu_utilization": 45.5,
    "memory_utilization": 60.2,
    "gpu_utilization": 80.1
  },
  "heartbeat_interval_ms": 30000
}
```

### Status Meanings

| Status | Meaning | Action |
|--------|---------|--------|
| `healthy` | Provider fully operational | Accept jobs |
| `degraded` | Performance issues detected | Lower priority in bidding |
| `warning` | Resource exhaustion imminent | Queue new jobs only |

### Integration in Code

**Provider side:**
```javascript
import { createHeartbeatEmitter } from './heartbeat-protocol.js'

const emitter = createHeartbeatEmitter(node, peerId, {
  getMetrics: async () => ({
    cpu_utilization: await getCpuLoad(),
    memory_utilization: getMemoryUsage(),
    gpu_utilization: getGpuLoad(),
  }),
  getStatus: () => {
    if (cpuLoad > 95) return 'warning'
    if (gpuMemory > 90) return 'degraded'
    return 'healthy'
  },
  intervalMs: 30000,
})

// Later: emitter.stop()
```

**Renter/Monitor side:**
```javascript
import { resolveHeartbeats, summarizeHeartbeatHealth } from './heartbeat-protocol.js'

const results = await resolveHeartbeats(node, providerPeerIds)
const health = summarizeHeartbeatHealth(results)

console.log(health)
// { healthy: [...], degraded: [...], offline: [...], total: N }
```

## Provider Discovery Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Provider Node (Behind NAT)                                   │
├─────────────────────────────────────────────────────────────┤
│ 1. Connect to DHT bootstrap node (VPS)                       │
│ 2. Announce compute environment to DHT                       │
│ 3. Emit periodic heartbeats every 30s                        │
│ 4. If behind NAT: Connect to relay server & register         │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│ DHT & Relay Infrastructure                                   │
├─────────────────────────────────────────────────────────────┤
│ - DHT stores: provider spec, heartbeat, relay address        │
│ - Relay stores: connection state for NATed providers         │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│ Renter/Monitor Client                                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Query DHT for available providers                         │
│ 2. Check heartbeats for liveness                             │
│ 3. If direct connection fails: use relay address             │
│ 4. Connect & bid on jobs                                     │
└─────────────────────────────────────────────────────────────┘
```

## Production Deployment Checklist

### For Provider Nodes

- [ ] Enable heartbeat announcements: `P2P_DISCOVERY_ENABLED=true`
- [ ] Configure metrics collection (CPU, memory, GPU load)
- [ ] Set heartbeat interval: `DEFAULT_HEARTBEAT_INTERVAL_MS=30000` (or lower for responsive monitoring)
- [ ] If behind NAT: Enable Circuit Relay: `P2P_DISCOVERY_ENABLE_RELAY=true`
- [ ] Configure relay servers list in bootstrap config
- [ ] Monitor heartbeat emission stats (should emit every 30s)
- [ ] Set appropriate status thresholds (CPU > 95% = warning)

### For Relay Servers

- [ ] Run relay service on stable public IP (e.g., VPS)
- [ ] Configure: `P2P_DISCOVERY_ENABLE_RELAY=true` + server mode
- [ ] Monitor relay connection count and traffic
- [ ] Set max connections: `maxConnections: 100` (tune based on load)
- [ ] Enable metrics export for monitoring relay health

### For Bootstrap Nodes

- [ ] Run on stable public IP
- [ ] Enable DHT service
- [ ] Configure public multiaddr: `/ip4/{public-ip}/tcp/4001`
- [ ] Monitor DHT routing table size
- [ ] Keep heartbeat TTL sync'd across network

## Performance Tuning

### Heartbeat Frequency

```javascript
// Faster monitoring (lower latency detection of failures)
const emitter = createHeartbeatEmitter(node, peerId, {
  intervalMs: 15000, // Every 15 seconds
})

// Lower overhead (fewer network messages)
const emitter = createHeartbeatEmitter(node, peerId, {
  intervalMs: 60000, // Every 60 seconds
})
```

**Trade-off:** Lower interval = faster failure detection but higher network load.

### DHT Timeout

```javascript
// Fast queries in well-connected networks
node.dcpDiscoveryTimeoutMs = 3000

// Patient queries in slow/remote networks
node.dcpDiscoveryTimeoutMs = 15000
```

## Testing

```bash
# Run heartbeat protocol tests
npm run test:heartbeat

# Expected output:
# Results: 6/6 passed
# - Heartbeat record generation
# - Staleness detection
# - Health summary
# - Metric normalization
# - Multiple heartbeats
# - Validation edge cases
```

## Monitoring & Metrics

### Provider Heartbeat Emitter Stats

```javascript
const stats = emitter.getStats()
// {
//   announced: 42,      // Successful announcements
//   failed: 1,          // Failed announcements
//   sequence: 43,       // Next sequence number
//   lastAnnounceAt: "2026-03-23T08:26:23.826Z"
// }
```

### Renter Heartbeat Health

```javascript
const health = summarizeHeartbeatHealth(results)
// {
//   healthy: [peerId1, peerId2, ...],
//   degraded: [peerId3, ...],
//   offline: [peerId4, ...],
//   total: N
// }
```

## Future Improvements (Phase D+)

- [ ] Automatic relay discovery and failover
- [ ] GossipSub for real-time availability updates
- [ ] NAT hole-punching via STUN/TURN
- [ ] Provider reputation scoring based on heartbeats
- [ ] Adaptive heartbeat frequency based on network conditions
- [ ] Metrics persistence for provider analytics
