# DCP Provider Connectivity Runbook

**For: Providers getting from registered → connected on the DCP P2P network**

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Network Architecture Overview](#network-architecture-overview)
4. [Step-by-Step Connectivity Verification](#step-by-step-connectivity-verification)
5. [Common Connectivity Failure Modes](#common-connectivity-failure-modes)
6. [Troubleshooting Decision Tree](#troubleshooting-decision-tree)
7. [Port Requirements & Firewall Config](#port-requirements--firewall-config)
8. [NAT Traversal Strategies](#nat-traversal-strategies)
9. [Docker Network Gotchas](#docker-network-gotchas)
10. [Testing Provider Reachability](#testing-provider-reachability)
11. [Escalation Checklist](#escalation-checklist)

---

## Quick Start

**One command to test your provider connectivity:**

```bash
node scripts/provider-connectivity-test.mjs
```

If all checks pass, your provider is reachable. If not, follow the [Troubleshooting Decision Tree](#troubleshooting-decision-tree).

---

## Prerequisites

Before starting connectivity checks, verify:

### 1. Provider Software Running
```bash
# Check if provider service is active
pm2 list | grep -E "dc1-provider|dcap|provider"

# If not, start it
pm2 start provider.config.js
```

### 2. Node.js & Dependencies Installed
```bash
node --version           # Must be 18.0.0 or later
npm list libp2p        # Should show @libp2p packages
npm list @libp2p/bootstrap
```

If missing, reinstall:
```bash
npm install --save @libp2p/bootstrap libp2p
```

### 3. P2P Port Not Blocked
The default P2P port is **4001** (TCP). Check if it's in use:
```bash
netstat -tlnp | grep 4001
lsof -i :4001
```

If port 4001 is in use by another process, change it:
```bash
export DCP_P2P_PORT=4002
pm2 restart dc1-provider
```

### 4. Bootstrap Peer ID Configured
The bootstrap node acts as your entry point to the DHT. Verify it's configured:
```bash
# Check environment variable
echo $DCP_P2P_BOOTSTRAP

# If not set, use the DCP VPS bootstrap:
export DCP_P2P_BOOTSTRAP="/ip4/76.13.179.86/tcp/4001/p2p/REPLACE_WITH_ACTUAL_PEER_ID"
```

**⚠️ Important:** The peer ID changes every time the bootstrap node restarts. After the bootstrap node starts, grab the peer ID from:
```bash
cat /home/node/dc1-platform/p2p/BOOTSTRAP_PEER_ID.txt
```

---

## Network Architecture Overview

```
Your Provider Machine                  DCP VPS (76.13.179.86)
─────────────────────────────────  ≈  ──────────────────────────
 [Provider Node] ─────────────       [Bootstrap Node]
      :4001 (P2P)                          :4001
         │                                    │
         └────── TCP/IP (Port 4001) ────────┘

      Other Providers ──────┐
      (DHT routing table)   │
                            └──── Bootstrap node indexes peers
```

**Key roles:**
- **Your Provider Node:** Announces GPU specs to DHT, receives job requests
- **Bootstrap Node:** Well-known entry point; doesn't store data, just routes
- **DHT (Distributed Hash Table):** Indexes all provider GPU specs for discovery

---

## Step-by-Step Connectivity Verification

### Step 1: Verify P2P Port is Listening

On your provider machine:
```bash
netstat -tlnp | grep 4001
```

**Expected output:**
```
tcp  0  0  0.0.0.0:4001  0.0.0.0:*  LISTEN  1234/node
```

**If you see nothing:**
- P2P port is not listening
- Go to [Troubleshooting: P2P Port Not Listening](#p2p-port-not-listening)

### Step 2: Verify Outbound Connectivity to Bootstrap

Test that you can reach the bootstrap node:
```bash
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/76.13.179.86/4001'
echo "Exit code: $?"
```

**Expected:** Exit code `0` (success)

**If exit code is non-zero (timeout or refused):**
- Firewall is blocking outbound port 4001
- Bootstrap node is down
- Go to [Troubleshooting: Cannot Reach Bootstrap](#cannot-reach-bootstrap)

### Step 3: Check Your Public IP (Critical for NAT)

If you're behind a NAT/router, find your public IP:
```bash
# Option 1: Check your router's admin page
# Option 2: Use an online service
curl -s https://api.ipify.org
curl -s https://ifconfig.me

# Store it
export MY_PUBLIC_IP=$(curl -s https://api.ipify.org)
echo "My public IP: $MY_PUBLIC_IP"
```

**Why this matters:** If your provider is behind NAT, the bootstrap node sees your public IP + port, not your internal IP. The remote peer trying to reach you must connect to your public IP.

### Step 4: Run the Connectivity Test Script

```bash
node scripts/provider-connectivity-test.mjs --verbose
```

This script:
- Tests P2P port listening
- Tests bootstrap reachability
- Tests NAT traversal capability
- Reports open ports
- Returns exit code 0 (success) or 1 (failure)

**If all tests pass:** ✅ Your provider is ready to accept jobs!

**If any test fails:** Review the error message and jump to [Troubleshooting Decision Tree](#troubleshooting-decision-tree).

### Step 5: Verify Heartbeat is Being Sent

The provider sends a heartbeat every 30 seconds. Check the logs:
```bash
pm2 logs dc1-provider --lines 50 | grep -E "heartbeat|peer|DHT|announce"
```

**Expected messages:**
```
[P2P] Heartbeat sent: peer_id=12D3KooXXXX sequence=42 status=healthy
[P2P] Connected to 2 peers
[P2P] DHT query: /dc1/provider/{peerId} → success
```

**If you don't see heartbeat messages:**
- Provider node crashed or misconfigured
- Check full logs: `pm2 logs dc1-provider --lines 100`

---

## Common Connectivity Failure Modes

### 1. Symmetric NAT (Home Network)

**Symptoms:**
- Outbound connections work fine
- Remote peers cannot reach you
- P2P port shows as "open" from your machine but "closed" from outside
- Tests pass locally but not remotely

**Root cause:** Your ISP or home router uses Symmetric NAT. The port that your computer sends traffic from doesn't match the port external peers use to reach you.

**Solutions (in order of preference):**
1. **Enable UPnP on your router** (if available)
   - Most home routers support UPnP
   - Libp2p can auto-negotiate port mappings
   - No manual config needed

2. **Manual port forwarding**
   - Log into router admin (usually 192.168.1.1)
   - Forward external port 4001 → your internal IP:4001
   - Ensure firewall allows 4001 in

3. **Use Relay Mode** (automatic fallback)
   - Provider connects through the bootstrap node as a relay
   - Slower, but always works
   - Enable with: `P2P_DISCOVERY_ENABLE_RELAY=true`

### 2. Firewall Blocks Port 4001

**Symptoms:**
- Port 4001 shows as LISTEN locally
- Cannot connect from outside (timeout)
- `netstat -tlnp` shows port, but external test fails

**Solutions:**
```bash
# Linux (UFW)
sudo ufw allow 4001/tcp
sudo ufw reload

# Linux (iptables)
sudo iptables -A INPUT -p tcp --dport 4001 -j ACCEPT

# macOS (Hardware Firewall)
System Preferences → Security & Privacy → Firewall Options → Allow incoming

# Windows
netsh advfirewall firewall add rule name="DCP P2P" dir=in action=allow protocol=tcp localport=4001
```

### 3. Docker Bridge Network Isolation

**Symptoms:**
- Provider runs in Docker container
- Logs show P2P node started, but remote peers cannot reach it
- Port 4001 is listening inside container, but not on host

**Solutions:**

**Option A: Expose port to host**
```bash
docker run -p 4001:4001/tcp -p 4001:4001/udp your-provider-image
```

**Option B: Use host network** (simpler, but less isolated)
```bash
docker run --network host your-provider-image
```

**Option C: Check bridge gateway** (if using custom bridge)
```bash
docker network inspect my-network | grep Gateway

# Provider may need to bind to the bridge gateway, not 0.0.0.0:4001
```

### 4. Bootstrap Node Peer ID Mismatch

**Symptoms:**
- P2P node starts but cannot find bootstrap
- DHT queries timeout
- Logs show "cannot dial bootstrap"

**Solution:**

Get the current bootstrap peer ID:
```bash
# On the VPS (or ask the founder)
ssh root@76.13.179.86 "pm2 logs dc1-p2p-bootstrap --lines 5"

# Look for line like:
# [Bootstrap] Address  : /ip4/76.13.179.86/tcp/4001/p2p/12D3KooXXXXXXXXXXX
```

Update on your provider:
```bash
export DCP_P2P_BOOTSTRAP="/ip4/76.13.179.86/tcp/4001/p2p/12D3KooXXXXXXXXXXX"
pm2 restart dc1-provider
```

### 5. Stale or Incorrect Provider Config

**Symptoms:**
- Multiple providers show "last seen 2 hours ago"
- Heartbeat not updating
- Old bootstrap peer ID still configured

**Solution:**
```bash
# Audit your provider config
cat provider/.env | grep -E "P2P|BOOTSTRAP|PORT"

# Show running process args
ps aux | grep "provider\|node" | head -5

# Restart with correct config
export DCP_P2P_BOOTSTRAP="/ip4/76.13.179.86/tcp/4001/p2p/CORRECT_ID"
pm2 delete dc1-provider
pm2 start provider.config.js
```

### 6. ISP Blocks High-Numbered Ports

**Symptoms:**
- Works on port 80 or 443, but not 4001
- ISP throttles or blocks your machine
- Carrier-grade NAT (CGNAT) detected

**Solutions:**
1. Switch to port 443 (HTTPS):
   ```bash
   export DCP_P2P_PORT=443
   pm2 restart dc1-provider
   ```

2. Contact ISP and request exemption or static IP

3. Consider moving to a data center provider (better network)

---

## Troubleshooting Decision Tree

```
Is port 4001 listening locally?
├─ NO  → [Fix #1: Enable Provider Service](#p2p-port-not-listening)
└─ YES
   │
   Can you connect to bootstrap from this machine?
   ├─ NO  → [Fix #2: Network or Firewall Issue](#cannot-reach-bootstrap)
   └─ YES
      │
      Are you behind NAT/router?
      ├─ NOT SURE → [Check public IP](#step-3-check-your-public-ip-critical-for-nat)
      ├─ NO  → [Continue to Provider Reachability Test](#testing-provider-reachability)
      └─ YES
         │
         Can external peers reach you?
         ├─ NOT TESTED YET → [Run connectivity test](#step-4-run-the-connectivity-test-script)
         ├─ NO  → [Fix #4: NAT Traversal](#nat-traversal-strategies)
         └─ YES → ✅ Provider is connected!
```

---

## Port Requirements & Firewall Config

| Port | Protocol | Direction | Purpose | Notes |
|------|----------|-----------|---------|-------|
| **4001** | TCP | Both | P2P peer-to-peer | Primary; must be open |
| 4001 | UDP | Optional | NAT hole-punching | Speeds up connections through restrictive NAT |
| 443 | TCP | Out | Fallback P2P over HTTPS | Used if 4001 blocked |
| 8083 | TCP | Out | Provider → Backend API | Heartbeat submissions, job fetching |

### UFW (Linux) Configuration

```bash
# Allow incoming P2P
sudo ufw allow 4001/tcp
sudo ufw allow 4001/udp

# Allow outbound to backend API
sudo ufw allow out to 76.13.179.86 port 8083

# Check status
sudo ufw status
```

### iptables Configuration

```bash
# Allow incoming P2P
sudo iptables -A INPUT -p tcp --dport 4001 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 4001 -j ACCEPT

# Allow outbound to bootstrap
sudo iptables -A OUTPUT -p tcp --dport 4001 -j ACCEPT

# Save rules (Debian/Ubuntu)
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

### AWS Security Group Rules

If running on AWS EC2:
1. Open Security Group for instance
2. Add inbound rule: Type=Custom TCP, Port=4001, Source=0.0.0.0/0
3. Add inbound rule: Type=Custom UDP, Port=4001, Source=0.0.0.0/0

---

## NAT Traversal Strategies

### Strategy 1: UPnP (Automatic, Recommended)

If your router supports UPnP, libp2p handles port mapping automatically:
```bash
# Enable UPnP discovery (some configs may have this enabled by default)
export P2P_DISCOVERY_ENABLE_UPNP=true
pm2 restart dc1-provider
```

Check logs for UPnP success:
```bash
pm2 logs dc1-provider | grep -i "upnp\|nat"
# Expected: "UPnP: port mapping successful"
```

### Strategy 2: Manual Port Forwarding

1. Find your router's admin IP (usually 192.168.1.1 or 192.168.0.1)
2. Log in with admin credentials
3. Find "Port Forwarding" or "Virtual Server" section
4. Create rule: External Port 4001 → Internal IP (your machine) Port 4001
5. Save and restart provider

### Strategy 3: Circuit Relay (Fallback)

If NAT is too restrictive, use the bootstrap node as a relay:
```bash
export P2P_DISCOVERY_ENABLE_RELAY=true
pm2 restart dc1-provider
```

**Trade-off:** Slower (extra hop) but works through any NAT.

### Strategy 4: IPv6 (if available)

Some ISPs offer IPv6 with full cone NAT, allowing direct peer connections:
```bash
export DCP_P2P_LISTEN_IPV6=true
pm2 restart dc1-provider
```

---

## Docker Network Gotchas

### Issue: Provider Can Reach Bootstrap, But Bootstrap Cannot Reach Provider

**Cause:** Docker bridge network only exposes ports via `-p` flag; binding to `0.0.0.0:4001` inside the container doesn't make it reachable from outside.

**Fix:**
```bash
# Dockerfile: ensure provider listens on correct interface
EXPOSE 4001/tcp

# Run with port mapping
docker run -p 4001:4001/tcp provider-image:latest

# OR use host network (less isolation)
docker run --network host provider-image:latest
```

### Issue: Port 4001 Works in Container, But Not Across Multiple Containers

**Cause:** Docker bridge network isolates containers; they can talk to each other, but not to external peers on that port.

**Fix:** Use host network mode or Docker Compose with proper networking:
```yaml
version: '3.9'
services:
  provider:
    image: provider:latest
    ports:
      - "4001:4001/tcp"
    networks:
      - dcp-network

networks:
  dcp-network:
    driver: bridge
```

---

## Testing Provider Reachability

### Test from Your Machine

```bash
# Does your P2P port listen?
netstat -tlnp | grep 4001

# Can you connect to yourself?
timeout 2 bash -c 'cat < /dev/null > /dev/tcp/127.0.0.1/4001'
echo "Local: $?"
```

### Test from Outside (Remote Peer Simulation)

If you have SSH access to another machine on a different network:
```bash
# From remote machine
PROVIDER_IP=your.provider.public.ip
timeout 3 bash -c "cat < /dev/null > /dev/tcp/$PROVIDER_IP/4001"
echo "Remote: $?"  # Should be 0 (success)
```

### Test via Connectivity Script

```bash
node scripts/provider-connectivity-test.mjs --peer-test
```

This script:
- Spins up a temporary test peer
- Attempts to connect to your provider
- Reports success/failure

---

## Escalation Checklist

If you've worked through the decision tree and still cannot get connected, provide this info to support:

### 1. Connectivity Test Output
```bash
node scripts/provider-connectivity-test.mjs --verbose > /tmp/connectivity-test.log 2>&1
cat /tmp/connectivity-test.log
```

### 2. Provider Logs (Last 100 Lines)
```bash
pm2 logs dc1-provider --lines 100 > /tmp/provider-logs.txt
cat /tmp/provider-logs.txt
```

### 3. Network Configuration
```bash
echo "=== Environment Variables ===" && env | grep -E "P2P|BOOTSTRAP|PORT|API" && \
echo "=== Network Status ===" && netstat -tlnp | grep -E "4001|8083" && \
echo "=== DNS Resolution ===" && nslookup api.dcp.sa && \
echo "=== Public IP ===" && curl -s https://api.ipify.org && \
echo "=== Provider Config ===" && jq 'del(.authToken)' provider/.env 2>/dev/null || echo "No env file"
```

### 4. Firewall Status
```bash
# Linux UFW
sudo ufw status

# Linux iptables
sudo iptables -L -n | grep 4001

# macOS
sudo pfctl -sn | grep 4001
```

### 5. Escalation Form

Create an issue with:
- **Node version:** `node --version`
- **Connectivity test result:** (pass/fail/specific error)
- **Provider logs:** (last 50 lines)
- **Network type:** (home ISP / VPS / datacenter / mobile)
- **NAT type:** (none / UPnP-enabled / manual forwarding / symmetric NAT)
- **Docker in use:** (yes/no, and version if yes)
- **Country & region:** (for latency expectations)

---

## Reference

- **P2P Bootstrap Code:** `/p2p/bootstrap.js`
- **Provider Announcement:** `/p2p/provider-announce.js`
- **Heartbeat Protocol:** `/p2p/heartbeat-protocol.js`
- **Discovery Diagnostics:** `/docs/p2p/discovery-diagnostics.md`
- **Connectivity Test Script:** `/scripts/provider-connectivity-test.mjs`
- **Environment Variables:** See [Prerequisites](#prerequisites)
