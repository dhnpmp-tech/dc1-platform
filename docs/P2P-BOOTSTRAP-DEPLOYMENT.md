# P2P Bootstrap Node Deployment — Phase 1 Infrastructure

**Status:** Requires VPS deployment
**Owner:** DevOps / Operator (requires VPS access)
**Effort:** 15 minutes (deployment + configuration update)
**Priority:** Medium-High (Phase 1 infrastructure)

---

## Overview

The DCP P2P network uses a Kademlia DHT (Distributed Hash Table) for provider discovery. Provider nodes need a **bootstrap node** — a well-known DHT peer they can connect to on startup to join the network.

The bootstrap node is ready to deploy on VPS `76.13.179.86` but requires:
1. Running `p2p/bootstrap.js` on the VPS via PM2
2. Capturing the generated peer ID
3. Updating the configuration in `p2p/dc1-node.js`

---

## Current Configuration Status

**File:** `p2p/dc1-node.js` line 44-47

```javascript
export const DEFAULT_BOOTSTRAP_ADDR =
  process.env.DCP_P2P_BOOTSTRAP ||
  process.env.DC1_P2P_BOOTSTRAP ||
  '/ip4/76.13.179.86/tcp/4001/p2p/REPLACE_WITH_BOOTSTRAP_PEER_ID'  // ← PLACEHOLDER
```

**Issue:** The peer ID is a placeholder `REPLACE_WITH_BOOTSTRAP_PEER_ID`. This prevents provider nodes from bootstrapping without an environment variable override.

---

## Deployment Steps

### Step 1: Deploy Bootstrap Node to VPS

**SSH to VPS:**
```bash
ssh root@76.13.179.86
cd /home/node/dc1-platform
```

**Start via PM2 (recommended for persistence):**
```bash
npm install -g pm2  # if not already installed
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
pm2 save
pm2 startup  # enables auto-restart on VPS reboot
```

**Or run directly (for testing):**
```bash
node p2p/bootstrap.js
```

### Step 2: Capture Peer ID

The bootstrap node prints output like:
```
[Bootstrap] ─────────────────────────────────────────────
[Bootstrap] Peer ID  : 12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh
[Bootstrap] Address  : /ip4/76.13.179.86/tcp/4001/p2p/12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh
[Bootstrap] ─────────────────────────────────────────────
```

**From VPS logs:**
```bash
pm2 logs dc1-p2p-bootstrap | grep "Peer ID"
```

**Copy the peer ID** (e.g., `12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh`)

### Step 3: Update Configuration

**File:** `p2p/dc1-node.js`

Replace line 47:
```javascript
// Before:
'/ip4/76.13.179.86/tcp/4001/p2p/REPLACE_WITH_BOOTSTRAP_PEER_ID'

// After:
'/ip4/76.13.179.86/tcp/4001/p2p/12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh'
```

**Example complete configuration:**
```javascript
export const DEFAULT_BOOTSTRAP_ADDR =
  process.env.DCP_P2P_BOOTSTRAP ||
  process.env.DC1_P2P_BOOTSTRAP ||
  '/ip4/76.13.179.86/tcp/4001/p2p/12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh'
```

**Commit the change:**
```bash
git add p2p/dc1-node.js
git commit -m "config(p2p): update bootstrap node peer ID from VPS deployment"
```

### Step 4: Verification

**Provider daemon logs should show:**
```
[P2P] Bootstrapping into DHT with: /ip4/76.13.179.86/tcp/4001/p2p/12D3KooW...
[P2P] DHT initialized, routing table size: 1
```

**Bootstrap node logs should show:**
```
[Bootstrap] + peer connected   : 12D3KooW[provider_peer_id]
[Bootstrap] - peer disconnected: 12D3KooW[provider_peer_id]
[Bootstrap]   routing table size: 1
```

---

## Important Notes

### Persistent Peer ID (Future Enhancement)

Currently, libp2p generates a **new random peer ID each startup**. For production robustness, the bootstrap node should persist its peer ID.

**Tracked in:** `p2p/bootstrap.js` lines 23-26

```javascript
// ── Stable peer ID across restarts ────────────────────────────
//   libp2p generates a random peer ID each start by default.
//   For a stable, predictable multiaddr, generate a key once and
//   persist it (future enhancement tracked in Phase D backlog).
```

**For Phase 1:** Acceptable to redeploy with environment variable override if needed.

**For Phase 2:** Implement persistent peer ID storage (likely in `.env.local` or database).

### Environment Variable Override

If the bootstrap node restarts and peer ID changes:
```bash
# On provider machines:
export DCP_P2P_BOOTSTRAP='/ip4/76.13.179.86/tcp/4001/p2p/[NEW_PEER_ID]'
```

---

## Monitoring the Bootstrap Node

**Check status:**
```bash
pm2 status
```

**View logs:**
```bash
pm2 logs dc1-p2p-bootstrap
```

**Restart:**
```bash
pm2 restart dc1-p2p-bootstrap
```

**Stop:**
```bash
pm2 stop dc1-p2p-bootstrap
```

---

## Impact on Phase 1 Launch

| Scenario | Impact | Mitigation |
|----------|--------|-----------|
| Bootstrap not deployed | Providers can't discover DHT without env var | Set `DCP_P2P_BOOTSTRAP` env var on each provider |
| Bootstrap peer ID stale | Provider doesn't find DHT | Update `p2p/dc1-node.js` with new peer ID |
| Bootstrap node offline | New providers can't join network | Use `DCP_P2P_BOOTSTRAP` env var as fallback |

**For Phase 1:** Not a hard blocker. Environment variable override can support up to 100 providers.
**For Phase 2+:** Required for automatic provider onboarding at scale.

---

## Related Documentation

- **Bootstrap Code:** `p2p/bootstrap.js`
- **Node Configuration:** `p2p/dc1-node.js`
- **NAT Traversal:** `p2p/NAT-TRAVERSAL.md` (lists bootstrap in deployment checklist)
- **Roadmap:** `docs/roadmap-to-production.md` (Part 2.5: P2P Architecture)
- **P2P Status:** `docs/P2P-STATUS-PHASE-1.md` (current readiness)

---

## Next Steps

1. **DevOps/Operator:** Deploy bootstrap node via PM2 on VPS 76.13.179.86
2. **P2P Engineer:** Update `p2p/dc1-node.js` with captured peer ID
3. **QA:** Verify provider nodes connect to DHT during smoke tests
4. **Phase 2:** Implement persistent peer ID to avoid redeployment issues

---

*Updated: 2026-03-23*
*P2P Network Engineer: Agent 5978b3b2-af54-4650-8443-db0a105fc385*
