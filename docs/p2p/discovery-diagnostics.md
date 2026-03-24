# P2P Provider Discovery — Diagnostics & Troubleshooting Guide

## Overview

This guide provides step-by-step diagnostics to verify that a provider node is discoverable on the DCP P2P network and to debug connectivity issues.

**Quick Status Check:**
```bash
node scripts/provider-health-check.mjs
```

---

## Table of Contents

1. [Provider Readiness Checklist](#provider-readiness-checklist)
2. [Network Connectivity Verification](#network-connectivity-verification)
3. [P2P Discovery Diagnostics](#p2p-discovery-diagnostics)
4. [NAT Traversal Troubleshooting](#nat-traversal-troubleshooting)
5. [Bootstrap Node Verification](#bootstrap-node-verification)
6. [Common Issues & Solutions](#common-issues--solutions)

---

## Provider Readiness Checklist

Before running P2P discovery diagnostics, verify these prerequisites:

### ✅ 1. Provider Installed & Running
```bash
pm2 list | grep dc1-provider
pm2 logs dc1-provider --lines 50
```

### ✅ 2. Node.js & Dependencies
```bash
node --version  # Should be 18+
npm list libp2p
```

### ✅ 3. P2P Port Open (4001)
```bash
netstat -ln | grep 4001
lsof -i :4001
```

**Expected:** TCP port 4001 LISTEN

### ✅ 4. Bootstrap Peer ID Configured
```bash
grep -r "BOOTSTRAP_PEER_ID" provider/config
echo $BOOTSTRAP_PEER_ID
```

---

## Network Connectivity Verification

### Step 1: Test Basic Network Access
```bash
ping 76.13.179.86
curl -I http://76.13.179.86:8083/api/health --max-time 5
```

### Step 2: Test Outbound P2P Port
```bash
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/76.13.179.86/4001'
echo $?  # Should be 0 (success)
```

### Step 3: Verify DNS Resolution
```bash
nslookup api.dcp.sa  # Should resolve to 76.13.179.86
```

---

## P2P Discovery Diagnostics

### Run Health Check
```bash
node scripts/provider-health-check.mjs --api-url http://76.13.179.86:8083
```

### Query Specific Provider
```bash
curl -s http://76.13.179.86:8083/api/providers/{provider-id} | jq '.'
curl -s http://76.13.179.86:8083/api/providers/{provider-id}/heartbeat | jq '.'
```

**Key fields to check:**
- `peerId`: Provider's libp2p peer ID (must be non-empty)
- `lastHeartbeatAt`: Last P2P heartbeat (< 5 min ago)
- `discoverable`: Boolean flag (should be `true`)
- `addresses`: Multiaddr list (should contain `/tcp/4001/...`)

---

## NAT Traversal Troubleshooting

### 1. Check NAT Status
```bash
pm2 logs dc1-provider | grep -i "nat\|upnp\|holepunch"
```

**Expected:**
```
[P2P] NAT status: private
[P2P] UPnP probe: success (external IP 203.0.113.42)
[P2P] Hole-punching enabled
```

### 2. Verify External IP
```bash
curl -s http://provider-internal-ip:4000/status | jq '.p2p.externalIp'
```

### 3. Router Configuration
For restrictive NAT environments:
1. Enable UPnP on router (preferred)
2. Or manually forward port 4001 → Internal IP:4001
3. Or configure provider to use relay mode

---

## Bootstrap Node Verification

### Is Bootstrap Running?
```bash
ssh root@76.13.179.86 'pm2 list | grep dc1-p2p-bootstrap'
ssh root@76.13.179.86 'pm2 logs dc1-p2p-bootstrap --lines 50'
```

### Get Bootstrap Peer ID
```bash
cat /home/node/dc1-platform/p2p/BOOTSTRAP_PEER_ID.txt
```

### Verify Bootstrap Topology
```bash
curl -s http://76.13.179.86:8083/api/p2p/topology | jq '.connectedPeers'
```

---

## Common Issues & Solutions

### Issue 1: Provider Shows "Offline"
**Root causes:**
1. Provider not sending heartbeats
2. P2P port not open
3. Bootstrap peer ID mismatch

**Solutions:**
```bash
# Check if port is listening
netstat -ln | grep 4001

# Check firewall
sudo ufw status
sudo ufw allow 4001/tcp

# Verify bootstrap peer ID
grep BOOTSTRAP_PEER_ID provider/.env
cat /home/node/dc1-platform/p2p/BOOTSTRAP_PEER_ID.txt

# Restart provider
pm2 restart dc1-provider
```

### Issue 2: NAT Traversal Failed
**Symptoms:** Provider behind corporate/hotel WiFi

**Solutions:**
1. Enable Relay Mode (automatic fallback)
2. Manual port forward (port 4001 → internal IP)
3. Move to better network

### Issue 3: Bootstrap Not Found
**Verify bootstrap is running:**
```bash
ssh root@76.13.179.86 'pm2 list | grep dc1-p2p-bootstrap'
```

**Check bootstrap peer ID:**
```bash
curl -I http://76.13.179.86:8083/api/health
```

### Issue 4: Peer Discovery Timeout
**Solutions:**
```bash
# Increase timeout in provider config
{
  "p2p": {
    "discoveryTimeout": 30000  // 30 seconds
  }
}

# Check bootstrap responsiveness
curl -I http://76.13.179.86:8083/api/p2p/topology --max-time 10

# Verify network stability
ping -c 20 76.13.179.86  # Should be < 5% loss
```

---

## Quick Reference Commands

```bash
# Health check all providers
node scripts/provider-health-check.mjs

# Check specific provider
curl http://76.13.179.86:8083/api/providers/{id}

# View heartbeat history
curl http://76.13.179.86:8083/api/providers/{id}/heartbeats?limit=10

# Bootstrap topology
curl http://76.13.179.86:8083/api/p2p/topology

# Provider P2P info
curl http://76.13.179.86:8083/api/providers/{id}/p2p

# Restart provider
pm2 restart dc1-provider

# Restart bootstrap
ssh root@76.13.179.86 'pm2 restart dc1-p2p-bootstrap'

# Enable debug logging
export LOG_LEVEL=debug && pm2 restart dc1-provider
```

---

## When to Escalate

Provide:
1. Health check output: `node scripts/provider-health-check.mjs --format json`
2. Provider config: `jq 'del(.authToken)' provider/config.json`
3. Relevant logs: `pm2 logs dc1-provider --lines 100`
4. Connectivity test: `curl -I http://76.13.179.86:8083/api/health`

