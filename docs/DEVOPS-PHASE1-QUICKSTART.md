# DevOps Phase 1 Quick-Start — Bootstrap Deployment (5-10 min)

**Owner:** DevOps / VPS Operator
**Target:** VPS 76.13.179.86
**Duration:** 5-10 minutes
**Success Criterion:** Bootstrap running + peer ID captured

---

## Quick-Start (Copy & Paste Ready)

### Step 1: SSH to VPS

```bash
ssh root@76.13.179.86
cd /home/node/dc1-platform
```

### Step 2: Install Bootstrap (one command)

```bash
npm install --prefix p2p && pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
```

### Step 3: Capture Peer ID (one command)

```bash
PEER_ID=$(pm2 logs dc1-p2p-bootstrap --lines 50 | grep -o '12D3Koo[A-Za-z0-9]*' | head -1)
echo "Bootstrap Peer ID: $PEER_ID"
```

### Step 4: Save PM2 Config

```bash
pm2 save && pm2 startup
```

### Step 5: Post Peer ID to DCP-612

Copy the peer ID from output above and post as comment to DCP-612 with this format:

```
## Phase 1 Complete — Bootstrap Deployed

Peer ID: 12D3KooW[...]
Bootstrap: Running at 76.13.179.86:4001
```

---

## Detailed Steps (If Quick-Start Doesn't Work)

### Prerequisites Check

```bash
# Verify Node.js installed
node --version  # Should be v20+

# Verify git repo
cd /home/node/dc1-platform
git status

# Verify p2p directory exists
ls -la p2p/bootstrap.js
```

### Step 1: Install P2P Dependencies

```bash
cd /home/node/dc1-platform
npm install --prefix p2p
# Should complete in 30-60 seconds
```

### Step 2: Start Bootstrap Node with PM2

```bash
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap --time
# Should output: "[PM2] Starting p2p/bootstrap.js in fork mode"
```

### Step 3: Verify Bootstrap is Running

```bash
# Check PM2 status
pm2 status
# Look for: dc1-p2p-bootstrap | 0   | fork   | 0 | online

# Check bootstrap logs
pm2 logs dc1-p2p-bootstrap | head -20
# Look for: [Bootstrap] Listening on /ip4/0.0.0.0/tcp/4001
# Look for: [Bootstrap] Peer ID: 12D3KooW...
```

### Step 4: Extract Peer ID

```bash
# Method 1: From logs
pm2 logs dc1-p2p-bootstrap --lines 100 | grep "Peer ID"

# Method 2: Capture and save
BOOTSTRAP_PEER_ID=$(pm2 logs dc1-p2p-bootstrap --lines 50 | grep -oP '12D3Koo[A-Za-z0-9]+' | head -1)
echo $BOOTSTRAP_PEER_ID

# Method 3: From file (if logged)
grep -h "Peer ID" /root/.pm2/logs/*.log | tail -1
```

### Step 5: Persistent Configuration

```bash
# Save PM2 configuration for reboot persistence
pm2 save
pm2 startup

# Verify startup
pm2 describe dc1-p2p-bootstrap | grep -i "args\|exec"
```

---

## Troubleshooting

### Bootstrap Won't Start

**Error:** `Cannot find module '@libp2p/tcp'`

**Fix:**
```bash
cd /home/node/dc1-platform
npm install --prefix p2p
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
```

### Port 4001 Already in Use

**Error:** `Error: listen EADDRINUSE :::4001`

**Fix:**
```bash
# Find process using port 4001
lsof -i :4001
# Or: netstat -tlnp | grep 4001

# Kill the process
kill -9 <PID>

# Then restart
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
```

### Can't Find Peer ID in Logs

**If bootstrap is running but no peer ID in logs:**

```bash
# Increase log lines
pm2 logs dc1-p2p-bootstrap --lines 500 | grep -i "peer\|listening"

# Or check stderr
pm2 logs dc1-p2p-bootstrap:err --lines 100

# Or directly run and watch
node p2p/bootstrap.js
# (Ctrl+C to stop)
```

### Bootstrap Running but Not Listening on Port 4001

**Verify:**
```bash
netstat -tlnp | grep 4001
# Should show: tcp 0 0 0.0.0.0:4001 0.0.0.0:* LISTEN <pid>

# Or test connectivity
nc -zv 127.0.0.1 4001
# Should respond: Connection succeeded
```

---

## Success Checklist

- [ ] Node.js v20+ installed: `node --version`
- [ ] P2P dependencies installed: `ls p2p/node_modules/@libp2p/`
- [ ] Bootstrap started with PM2: `pm2 status | grep bootstrap`
- [ ] Peer ID captured: `echo $BOOTSTRAP_PEER_ID`
- [ ] Bootstrap listening on port 4001: `netstat -tlnp | grep 4001`
- [ ] PM2 config saved: `pm2 describe dc1-p2p-bootstrap`
- [ ] Peer ID posted to DCP-612

---

## After Phase 1: What Happens Next

1. **Backend Team (Phase 2):** Uses your peer ID to update p2p/dc1-node.js line 47
2. **Automatic (Phase 3):** Providers discover bootstrap and re-announce to DHT (30 seconds)
3. **P2P Engineer (Phase 4):** Validates infrastructure and confirms launch-ready

**Timeline after Phase 1 starts:**
- Phase 1 (you): 5-10 min
- Phase 2 (Backend): 5 min
- Phase 3 (Auto): 1 min
- Phase 4 (P2P Eng): 5 min
- **Total: ~20 minutes to launch-ready**

---

## Critical: Post Peer ID Immediately After Phase 1

**As soon as bootstrap is running and peer ID is captured:**

Post to DCP-612 with:
```
## Phase 1 Complete — Bootstrap Deployed

Bootstrap Peer ID: 12D3KooWXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Running at: 76.13.179.86:4001
```

**This unblocks Backend Phase 2 and triggers the launch sequence.**

---

## References

- Detailed execution: docs/PHASE-1-LAUNCH-CHECKLIST.md
- Troubleshooting: docs/P2P-TROUBLESHOOTING-RUNBOOK.md
- Bootstrap code: p2p/bootstrap.js
- Communication template: docs/PHASE-1-COMMUNICATION-TEMPLATES.md

