# P2P Network Configuration Guide for Operators

**Status:** Phase 1 Production Configuration Reference
**Audience:** DevOps, Infrastructure Operators, System Administrators
**Date:** 2026-03-23

---

## Overview

This guide provides complete P2P network configuration for operators deploying DCP Phase 1. Covers environment variables, bootstrapping, monitoring, and production checklist.

---

## Environment Variables

### Provider Daemon Configuration (dcp_daemon.py)

```bash
# === P2P Network Settings ===

# Enable P2P provider announcements to DHT
export P2P_DISCOVERY_ENABLED=true

# Bootstrap node address (DHT entry point)
# Default: /ip4/76.13.179.86/tcp/4001/p2p/REPLACE_WITH_BOOTSTRAP_PEER_ID
# Once bootstrap node is deployed, set to actual peer ID:
export DCP_P2P_BOOTSTRAP='/ip4/76.13.179.86/tcp/4001/p2p/12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh'

# Enable NAT traversal support (Phase 1.5+)
export P2P_DISCOVERY_ENABLE_RELAY=false  # Set to true for NATed providers

# Enable WebSocket transport for browser renters (Phase 2+)
export P2P_DISCOVERY_ENABLE_WEBSOCKET=false

# Enable mDNS local discovery (Phase 2+)
export P2P_DISCOVERY_ENABLE_MDNS=false

# Heartbeat interval in milliseconds
export DEFAULT_HEARTBEAT_INTERVAL_MS=30000  # Emit every 30 seconds

# Heartbeat TTL (how long stored in DHT)
export DEFAULT_HEARTBEAT_TTL_MS=60000  # 60 seconds

# Heartbeat stale threshold
export HEARTBEAT_STALE_MS=90000  # Mark offline after 90 seconds
```

### Backend Service Configuration (dc1-provider-onboarding)

```bash
# === P2P DHT Service ===

# Enable P2P DHT announcements from heartbeats
export P2P_DISCOVERY_ENABLED=true

# Protocol namespace for isolated DHT
export DCP_P2P_PROTOCOL='/dc1/kad/1.0.0'

# kBucketSize for DHT routing table
# Small value (2-4) for prototype networks < 20 providers
# Default value (20) for production networks > 100 providers
export DCP_P2P_KBUCKET_SIZE=20

# DHT refresh interval
export DCP_DHT_REFRESH_INTERVAL_MS=600000  # 10 minutes
```

### Relay Server Configuration (Phase 1.5+, Optional)

```bash
# === Circuit Relay v2 (NAT Traversal) ===

# Run as relay server (on public IP)
export P2P_DISCOVERY_ENABLE_RELAY=true
export RELAY_SERVER_MODE=true

# Max connections to relay
export RELAY_MAX_CONNECTIONS=100

# Relay server listen address
export RELAY_LISTEN_ADDR='/ip4/0.0.0.0/tcp/4002'

# Relay public address (advertised to network)
export RELAY_PUBLIC_ADDR='/ip4/76.13.179.86/tcp/4002'
```

---

## Phase 1 Production Deployment Checklist

### Pre-Launch (1-2 days before)

#### Bootstrap Node Setup

- [ ] Reserve port 4001 on VPS 76.13.179.86
- [ ] Ensure VPS has stable public IP
- [ ] Verify firewall allows TCP 4001 inbound
- [ ] Test port accessibility: `nc -zv 76.13.179.86 4001`

#### Provider Daemon Configuration

- [ ] Set `P2P_DISCOVERY_ENABLED=true` on all provider machines
- [ ] Leave `P2P_DISCOVERY_ENABLE_RELAY=false` (Phase 1 uses public IPs only)
- [ ] Keep `DEFAULT_HEARTBEAT_INTERVAL_MS=30000` (30 second heartbeats)
- [ ] Document all environment variables in deployment scripts

#### Backend Service Configuration

- [ ] Set `P2P_DISCOVERY_ENABLED=true` on backend
- [ ] Verify `p2p-discovery.js` service is loaded
- [ ] Set `DCP_P2P_KBUCKET_SIZE=20` for production network
- [ ] Enable debug logging: `DEBUG=dcp:p2p:*` (optional, for troubleshooting)

### Launch Day (Day 0)

#### 1. Deploy Bootstrap Node (T-30 minutes)

```bash
# On VPS 76.13.179.86
ssh root@76.13.179.86

# Navigate to repo
cd /home/node/dc1-platform

# Start bootstrap node via PM2
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
pm2 save
pm2 startup

# Capture peer ID from logs
pm2 logs dc1-p2p-bootstrap | grep "Peer ID" > /tmp/bootstrap-peer-id.txt
cat /tmp/bootstrap-peer-id.txt
# Output: [Bootstrap] Peer ID  : 12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh
```

#### 2. Update Configuration (T-20 minutes)

```bash
# Update p2p/dc1-node.js with actual peer ID
# Line 47, replace placeholder:

# OLD:
# '/ip4/76.13.179.86/tcp/4001/p2p/REPLACE_WITH_BOOTSTRAP_PEER_ID'

# NEW:
# '/ip4/76.13.179.86/tcp/4001/p2p/12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh'

# Commit and redeploy backend
git commit -am "config(p2p): update bootstrap peer ID for Phase 1"
git push origin main

# Restart backend service
pm2 restart dc1-provider-onboarding
pm2 save
```

#### 3. Verify Bootstrap Connectivity (T-15 minutes)

```bash
# On provider machine
export DCP_P2P_BOOTSTRAP='/ip4/76.13.179.86/tcp/4001/p2p/12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh'

# Start provider daemon
python3 /backend/installers/dcp_daemon.py

# Check logs for bootstrap connection
tail -f /var/log/dcp_daemon.log | grep -i "bootstrap\|dht\|p2p"

# Expected output:
# [P2P] Bootstrapping into DHT...
# [P2P] DHT initialized, routing table size: 1
# P2P heartbeat emitted (seq=0), status=healthy
```

#### 4. Verify Heartbeat Endpoint (T-10 minutes)

```bash
# Test heartbeat endpoint
curl -X POST https://api.dcp.sa/api/providers/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "api_key":"pk_test_provider_key",
    "gpu_status":{"status":"online","gpu_util_pct":50},
    "gpu_info":{"gpu_name":"RTX 4090","vram_mb":24576},
    "peer_id":"12D3KooWProvider..."
  }'

# Expected: HTTP 200, {"success": true, "message": "Heartbeat received"}
```

#### 5. Monitor First Heartbeats (T-5 minutes to T+5 minutes)

```bash
# Check bootstrap node receives provider connections
pm2 logs dc1-p2p-bootstrap

# Expected:
# [Bootstrap] + peer connected   : 12D3KooWProvider...
# [Bootstrap]   routing table size: 1

# Check database for heartbeat persistence
sqlite3 /path/to/dcp.db "SELECT COUNT(*) as online FROM providers WHERE status='online' AND last_heartbeat > datetime('now', '-5 minutes');"
```

### Post-Launch Monitoring (Day 1+)

- [ ] Bootstrap node stability: `pm2 status`
- [ ] Provider heartbeat frequency: Should see new heartbeats every 30 seconds
- [ ] DHT health: Check routing table size growing
- [ ] Stale detection: Verify offline providers removed from discovery after 90 seconds

---

## Production Monitoring Commands

### Real-Time Bootstrap Node Status

```bash
# SSH to VPS
ssh root@76.13.179.86

# Watch active connections
pm2 logs dc1-p2p-bootstrap | tail -20

# Check PM2 status
pm2 status

# View full logs with filtering
pm2 logs dc1-p2p-bootstrap --err | grep -i "error\|fail"
```

### Provider Heartbeat Health

```bash
# Count online providers
sqlite3 /path/to/dcp.db "SELECT COUNT(*) FROM providers WHERE status='online' AND last_heartbeat > datetime('now', '-2 minutes');"

# Find stale providers (>90s without heartbeat)
sqlite3 /path/to/dcp.db "SELECT id, name, last_heartbeat FROM providers WHERE last_heartbeat < datetime('now', '-90 seconds') AND last_heartbeat IS NOT NULL LIMIT 10;"

# Average heartbeat freshness
sqlite3 /path/to/dcp.db "SELECT AVG(CAST((julianday('now') - julianday(last_heartbeat)) * 86400 AS REAL)) as avg_staleness_sec FROM providers WHERE last_heartbeat IS NOT NULL;"

# Providers with peer IDs (DHT registered)
sqlite3 /path/to/dcp.db "SELECT COUNT(*) as with_peer_id FROM providers WHERE p2p_peer_id IS NOT NULL;"
```

### Backend P2P Service Health

```bash
# Check for P2P announcement errors
tail -f /var/log/dcp-backend.log | grep -i "p2p\|announce\|discovery\|error"

# Count successful announcements
tail -100 /var/log/dcp-backend.log | grep -c "heartbeat announce enqueued"

# Verify DHT protocol is correct
grep -r "'/dc1/kad/1.0.0'" /home/node/dc1-platform/p2p/

# Check for failed heartbeat validations
tail -f /var/log/dcp-backend.log | grep -i "heartbeat.*error\|heartbeat.*invalid"
```

---

## Troubleshooting Configuration Issues

### Issue: Bootstrap Node Won't Start

**Symptom:** `pm2 start p2p/bootstrap.js` fails or crashes

**Diagnosis:**
```bash
# Check if port 4001 is already in use
lsof -i :4001
netstat -tlnp | grep 4001

# Check Node.js version
node --version  # Should be 18.x or higher

# Check dependencies
cd /home/node/dc1-platform/p2p
npm list
```

**Fix:**
```bash
# Kill process using port 4001
kill -9 $(lsof -t -i :4001)

# Reinstall dependencies
npm install

# Start with verbose logging
node p2p/bootstrap.js 2>&1 | tee bootstrap.log
```

### Issue: Providers Can't Connect to Bootstrap

**Symptom:** Provider logs show bootstrap connection timeout

**Diagnosis:**
```bash
# Test connectivity from provider machine
nc -zv 76.13.179.86 4001  # Should succeed

# Check VPS firewall
ssh root@76.13.179.86
sudo ufw status
sudo iptables -L -n | grep 4001
```

**Fix:**
```bash
# On VPS, allow port 4001
sudo ufw allow 4001/tcp

# Or with iptables
sudo iptables -A INPUT -p tcp --dport 4001 -j ACCEPT
sudo iptables-save
```

### Issue: Heartbeat Endpoint Returns 403

**Symptom:** Providers get "Provider is not approved yet"

**Diagnosis:**
```bash
# Check provider approval status
sqlite3 /path/to/dcp.db "SELECT id, name, approval_status FROM providers WHERE api_key='pk_test_key';"
```

**Fix:**
```bash
# For testing, enable unapproved heartbeats
export ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT=1

# For production, approve provider in admin dashboard
sqlite3 /path/to/dcp.db "UPDATE providers SET approval_status='approved' WHERE api_key='pk_test_key';"
```

---

## Performance Tuning (Phase 2+)

### Large Network Optimization (100+ providers)

```bash
# Increase kBucketSize for larger networks
export DCP_P2P_KBUCKET_SIZE=20  # Default, good for 100+ providers

# Reduce heartbeat interval for faster detection
export DEFAULT_HEARTBEAT_INTERVAL_MS=15000  # 15 seconds (faster but more traffic)

# Reduce stale threshold for quicker offline detection
export HEARTBEAT_STALE_MS=60000  # 60 seconds (faster removal)
```

### Regional Deployment (Latency Optimization)

For multiple regions, deploy regional bootstrap nodes:

```bash
# Region: EU
export EU_P2P_BOOTSTRAP='/ip4/eu-bootstrap.dcp.sa/tcp/4001/p2p/...'

# Region: APAC
export APAC_P2P_BOOTSTRAP='/ip4/apac-bootstrap.dcp.sa/tcp/4001/p2p/...'

# Region: Americas
export AMERICAS_P2P_BOOTSTRAP='/ip4/americas-bootstrap.dcp.sa/tcp/4001/p2p/...'
```

Provider daemon auto-selects based on location.

---

## Rollback Procedures

### Disable P2P DHT Temporarily

If P2P network has critical issues:

```bash
# Stop bootstrap node
pm2 stop dc1-p2p-bootstrap

# Disable P2P announcements
export P2P_DISCOVERY_ENABLED=false

# Restart backend (will accept heartbeats but not announce to DHT)
pm2 restart dc1-provider-onboarding

# Provider discovery will still work via fallback mechanisms
# (HTTP API, direct connection)
```

### Restore P2P Network

```bash
# Restart bootstrap node
pm2 restart dc1-p2p-bootstrap

# Re-enable P2P announcements
export P2P_DISCOVERY_ENABLED=true

# Restart backend
pm2 restart dc1-provider-onboarding

# Providers will re-announce to DHT within 30 seconds
```

---

## References

- **Bootstrap Node:** `p2p/bootstrap.js`
- **Node Configuration:** `p2p/dc1-node.js`
- **Discovery Service:** `p2p/dcp-discovery-scaffold.js`
- **Heartbeat Protocol:** `p2p/heartbeat-protocol.js`
- **Backend Integration:** `backend/src/routes/providers.js`
- **P2P Services:** `backend/src/services/p2p-discovery.js`

---

## Support

- **P2P Network Engineer:** Agent 5978b3b2-af54-4650-8443-db0a105fc385
- **For P2P issues:** Check `docs/P2P-E2E-SMOKE-TEST-GUIDE.md` (troubleshooting)
- **For deployment:** Check `docs/P2P-BOOTSTRAP-DEPLOYMENT.md` (step-by-step)
- **For status:** Check `docs/P2P-STATUS-PHASE-1.md` (readiness)

---

*Last Updated: 2026-03-23*
*P2P Network Engineer: Agent 5978b3b2-af54-4650-8443-db0a105fc385*
