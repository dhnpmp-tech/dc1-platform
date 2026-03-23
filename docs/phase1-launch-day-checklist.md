# Phase 1 Launch Day Checklist

**Date**: 2026-03-23
**Trigger**: Founder deployment approval ("GO for Phase 1")
**Duration**: ~20 minutes from start to launch-ready confirmation
**Owner**: DevOps / Founding Engineer

---

## Timeline Overview

```
T+0:00  → Checklist starts (DevOps)
T+0:05  → Bootstrap deployed + peer ID visible
T+0:10  → Backend config updated + service restarted
T+0:15  → P2P monitor detects bootstrap online
T+0:20  → Phase 4 validation completes + results posted
```

---

## Phase 1: Bootstrap Node Deployment (5 min)

**Responsible**: DevOps / Founding Engineer

### Step 1.1: Verify Deployment Prerequisites
- [ ] SSH access to VPS (76.13.179.86) confirmed
- [ ] PM2 is installed: `pm2 --version` (should be v5.0+)
- [ ] Port 4001 (TCP) is open in firewall: `ufw show added | grep 4001`
- [ ] Node.js v18+ is available: `node --version`

**If any check fails**: Stop. Resolve before proceeding.

### Step 1.2: Deploy Bootstrap Node

```bash
cd /home/node/dc1-platform

# Kill any existing P2P bootstrap process
pm2 delete dc1-p2p-bootstrap 2>/dev/null || true

# Start bootstrap node
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap --merge-logs

# Verify it's running
pm2 list | grep dc1-p2p-bootstrap
# Expected: "online" status
```

**Expected output**:
```
[Bootstrap] Peer ID  : 12D3KooXXXXXXXXXXXXXXXXXX
[Bootstrap] Address  : /ip4/76.13.179.86/tcp/4001/p2p/12D3KooXXXXXXXXXXXXXXXXXX
```

- [ ] Bootstrap started successfully
- [ ] Peer ID visible in logs

### Step 1.3: Extract and Record Peer ID

```bash
# Get peer ID from logs
PEER_ID=$(pm2 logs dc1-p2p-bootstrap | grep "Peer ID" | head -1 | sed 's/.*Peer ID.*: //')

echo "✓ Bootstrap Peer ID: $PEER_ID"

# Or if logs aren't immediately visible:
PEER_ID="12D3KooXXXXXXXXXXXXXXXXXX"  # Copy from bootstrap output
```

- [ ] Peer ID recorded: `_________________`

**DO NOT PROCEED UNTIL PEER ID IS VISIBLE IN LOGS**

---

## Phase 2: Backend Configuration Update (5 min)

**Responsible**: Backend Architect / Founding Engineer

### Step 2.1: Update Backend Environment

```bash
# On VPS, in the backend root directory:
cd /home/node/dc1-platform/backend

# Set the bootstrap peer ID in environment
export DCP_P2P_BOOTSTRAP="/ip4/76.13.179.86/tcp/4001/p2p/{PEER_ID_FROM_STEP_1.3}"

# Verify it's set
echo $DCP_P2P_BOOTSTRAP
```

- [ ] `DCP_P2P_BOOTSTRAP` env var set correctly

### Step 2.2: Update PM2 Environment

```bash
# Update PM2 config to persist the env var
pm2 env 0  # Get current dc1-provider-onboarding env vars

# Or directly update the PM2 env:
pm2 restart dc1-provider-onboarding --update-env

# Verify backend is using new bootstrap:
pm2 logs dc1-provider-onboarding | grep -i "bootstrap\|p2p"
```

- [ ] Backend restarted with updated env

### Step 2.3: Verify Backend P2P Service

```bash
# Health check the P2P service
curl -s http://localhost:8083/api/p2p/health | jq .bootstrap_configured
# Expected: true

curl -s http://localhost:8083/api/p2p/health | jq .bootstrap_addrs
# Expected: ["/ip4/76.13.179.86/tcp/4001/p2p/12D3Koo..."]
```

- [ ] Backend P2P service reports bootstrap configured
- [ ] Bootstrap multiaddr is correct

**If health check fails**: Check backend logs, restart service, try again.

---

## Phase 3: P2P Monitor Detection (10 min)

**Responsible**: P2P Network Engineer (automatic)

### Step 3.1: Monitor Detects Bootstrap

```bash
# The P2P monitor (running on 5-min + 10-min cycle) will:
# 1. Read p2p/dc1-node.js looking for peer ID injection
# 2. Detect the change from PLACEHOLDER to actual peer ID
# 3. Auto-execute Phase 4 validation

# You can manually trigger if needed:
node scripts/validate-p2p-setup.sh
```

- [ ] P2P monitor has detected bootstrap online (or manually validated)

### Step 3.2: Verify Bootstrap is Reachable

```bash
# Test TCP connection to bootstrap
nc -zv 76.13.179.86 4001
# Expected: "succeeded"

# Test from another machine if available:
ssh provider-machine "nc -zv 76.13.179.86 4001"
```

- [ ] Bootstrap node is reachable on TCP 4001

---

## Phase 4: Validation & Launch Confirmation (5 min)

**Responsible**: P2P Network Engineer (automatic via smoke test)

### Step 4.1: Run Bootstrap Health Smoke Test

```bash
cd /home/node/dc1-platform

node scripts/bootstrap-health-smoke-test.mjs

# Expected output:
# Test Results: 10 passed, 0 failed
# Bootstrap health check PASSED ✓
```

- [ ] All 10 smoke tests pass (or 9/10 with acceptable warnings)
- [ ] Exit code 0 returned

**If tests fail**:
- Check console output for failures
- Reference `/docs/p2p/bootstrap-health-smoke-test-plan.md` failure scenarios
- Fix the issue, then re-run test

### Step 4.2: Post Results to DCP-612

```bash
# P2P Network Engineer will auto-post results to DCP-612 including:
# - All 10 test statuses
# - Performance metrics (latency, throughput)
# - Provider count (if any already online)
# - Next steps (activate provider recruitment)
```

- [ ] Smoke test results posted to DCP-612
- [ ] Status shows "PHASE 1: GO FOR LAUNCH ✓"

---

## Phase 5: Post-Launch Activation (Immediate)

**Responsible**: DevRel / Provider Recruitment

### Step 5.1: Notify Waiting Providers

Once Phase 1 launches, send to 43 registered providers:

**Email/Slack template**:
```
🚀 DCP PHASE 1 LIVE: Your GPU is now discoverable!

The DCP P2P bootstrap is online. Your daemon is automatically connecting.

What changed:
- Your GPU is now discoverable on a distributed DHT
- Renters find you faster (model-aware matching)
- Your earnings increase with model caching (especially Arabic)

To optimize:
1. Cache Tier A models (Llama, Mistral, Qwen)
2. Cache Arabic models if possible (ALLaM, JAIS, embeddings)
3. Monitor your earnings dashboard

Expected in 24h:
- 40+ providers online (>95% activation)
- 100+ jobs routed across network
- First Arabic RAG queries appearing

Support: #dcp-provider-support on Slack

Welcome to Phase 1! 🎉
```

- [ ] Notification sent to all providers

### Step 5.2: Activate Provider Dashboard

```bash
# Providers can now see:
# - Their discoverable status
# - Incoming jobs
# - Earnings in real-time

# URL: https://api.dcp.sa/provider-dashboard
```

- [ ] Provider dashboard is live and accessible

### Step 5.3: Monitor First 24 Hours

```bash
# Key metrics to watch:
# 1. Providers online: curl http://localhost:8083/api/providers/available
# 2. Heartbeat frequency: curl http://localhost:8083/api/p2p/health
# 3. Jobs routed: grep "job_assign" backend.log | wc -l
# 4. Network uptime: Any connection errors?

# Run every hour:
node scripts/bootstrap-health-smoke-test.mjs
```

- [ ] Hour 1: Check provider count trending toward 40+
- [ ] Hour 3: Check for first jobs appearing
- [ ] Hour 6: Review earnings dashboard activation
- [ ] Hour 12: First Arabic RAG query expected

---

## Success Criteria

### Minimum Success (LAUNCH APPROVED ✓)
- [ ] Bootstrap online on 76.13.179.86:4001
- [ ] Peer ID correctly injected & visible
- [ ] Backend P2P service configured + restarted
- [ ] All 10 smoke tests pass
- [ ] Providers receive activation notifications

### Full Success (PHASE 1 VALIDATED ✓)
- [ ] 40–42 providers online within 24h (>95%)
- [ ] 100+ jobs routed in first 24h
- [ ] Zero unplanned downtime (>99.5% uptime)
- [ ] First Arabic RAG query executed successfully
- [ ] Provider earnings flowing correctly

---

## Rollback Plan (If Needed)

If Phase 1 fails severely, rollback to centralized-only mode:

```bash
# 1. Stop bootstrap
pm2 stop dc1-p2p-bootstrap

# 2. Clear P2P env var
unset DCP_P2P_BOOTSTRAP
pm2 restart dc1-provider-onboarding

# 3. Revert backend to centralized mode
# (Backend will fall back to SQLite provider list automatically)

# 4. Notify providers
# "Phase 1 bootstrap temporarily offline; using centralized discovery"

# 5. Investigate & retry
# (See troubleshooting runbook)
```

- [ ] Rollback procedure documented and tested

---

## Team Contacts

**If something goes wrong**:

| Role | Slack | Email | Phone |
|------|-------|-------|-------|
| DevOps | @devops-oncall | devops@dcp.sa | - |
| Backend | @backend-team | backend@dcp.sa | - |
| P2P Engineer | @p2p-network | p2p@dcp.sa | - |
| Founder | @peter | peter@dcp.sa | - |

**Escalation path**: DevOps → Backend → P2P → Founder

---

## Final Sign-Off

**Phase 1 Launch Day Checklist: APPROVED FOR EXECUTION**

- [ ] All prerequisites checked
- [ ] DevOps ready with deployment playbook
- [ ] Backend ready with config updates
- [ ] P2P monitor ready with smoke tests
- [ ] DevRel ready with provider notifications
- [ ] Rollback plan documented

**Launch time**: TBD (awaiting founder "GO" signal)

**Expected completion**: 20 minutes from "GO" signal to "LAUNCH CONFIRMED"

---

*Checklist version: 1.0*
*Ready for Phase 1 execution*
