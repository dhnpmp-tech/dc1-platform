# Phase 1 Incident Response Runbook

**Date**: 2026-03-23
**Scope**: First 24 hours after Phase 1 bootstrap deployment
**Owner**: DevOps + Backend + P2P Engineer (on-call)
**Severity Levels**: 🔴 Critical (0 providers) | 🟡 High (< 20 providers) | 🟢 Medium (performance)

---

## Incident Detection & Escalation

### Key Metrics to Monitor (First 24h)

```bash
# Monitor every 30 minutes:
watch -n 30 'curl -s http://localhost:8083/api/providers/available?limit=1 && echo "---" && curl -s http://localhost:8083/api/p2p/health | jq .bootstrap_configured'
```

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Providers online | 30+ | 15–29 | <15 |
| Bootstrap responsive | <50ms | 50–200ms | >200ms |
| Jobs routed/hour | 10+ | 5–9 | <5 |
| Network uptime | >99.5% | 95–99.5% | <95% |
| P2P discovery success | >95% | 80–95% | <80% |

### Escalation Procedure

1. **Detect issue** (automated monitoring or user report)
2. **Assess severity** (use table above)
3. **Page on-call** if 🔴 Critical
4. **Post to #dcp-incidents** Slack channel
5. **Follow runbook** for your incident type

---

## Incident #1: Bootstrap Node Offline (🔴 CRITICAL)

**Symptoms**:
- Providers cannot connect to P2P bootstrap
- `nc -zv 76.13.179.86 4001` fails
- Smoke test: "Bootstrap node reachability" fails

### Root Cause Diagnosis

```bash
# 1. Is PM2 process running?
pm2 list | grep dc1-p2p-bootstrap
# If "stopped" or "crashed", go to Fix #1

# 2. Is the port open?
ss -tlnp | grep 4001
# If not listening, restart (Fix #1)

# 3. Is there a network issue?
ping -c 3 76.13.179.86
# If fails, contact infrastructure team

# 4. Check logs for errors
pm2 logs dc1-p2p-bootstrap | tail -50
# Look for: "Error", "listen", "EACCES", "EADDRINUSE"
```

### Fix #1: Restart Bootstrap Node

```bash
# Stop current process
pm2 stop dc1-p2p-bootstrap
pm2 delete dc1-p2p-bootstrap

# Wait 5 seconds
sleep 5

# Start fresh
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap --merge-logs
pm2 save

# Verify peer ID is printed
pm2 logs dc1-p2p-bootstrap | grep "Peer ID"
# IMPORTANT: If peer ID changed, update DCP_P2P_BOOTSTRAP env var (see below)
```

### Fix #2: Restore Bootstrap if Peer ID Changed

**If bootstrap restarted and peer ID changed** (libp2p generates new random ID):

```bash
# Extract new peer ID
NEW_PEER_ID=$(pm2 logs dc1-p2p-bootstrap | grep "Peer ID" | head -1 | sed 's/.*Peer ID.*: //')

# Update backend environment
export DCP_P2P_BOOTSTRAP="/ip4/76.13.179.86/tcp/4001/p2p/$NEW_PEER_ID"

# Restart backend
pm2 restart dc1-provider-onboarding --update-env

# Verify backend sees new bootstrap
curl -s http://localhost:8083/api/p2p/health | jq .bootstrap_addrs

# Restart providers (they'll auto-reconnect)
# Providers will automatically discover the new bootstrap within 1-2 heartbeat cycles

# Re-run smoke test
node scripts/bootstrap-health-smoke-test.mjs
```

**Prevention**: For Phase 2, generate a stable peer ID and persist it across restarts (see Phase D roadmap).

### Escalation Path

If bootstrap won't start after 2 restart attempts:
1. Check `/tmp/pm2.log` for system-level errors
2. Verify disk space: `df -h /` (need >1 GB free)
3. Check node modules: `ls -la p2p/node_modules/ | head`
4. If corrupt: `rm -rf p2p/node_modules && npm install` in `p2p/` directory
5. Escalate to Founding Engineer if still failing

---

## Incident #2: Providers Not Coming Online (🔴 CRITICAL)

**Symptoms**:
- Phase 1 deployed 30+ minutes ago
- `curl http://localhost:8083/api/providers/available` returns empty array
- Smoke test reports "0 providers online"

### Root Cause Diagnosis

```bash
# 1. Are providers sending heartbeats?
sqlite3 providers.db "SELECT COUNT(*) FROM providers WHERE last_heartbeat > datetime('now', '-5 minutes');"
# Should be > 0. If 0, providers haven't contacted backend at all.

# 2. Check provider logs (on provider machines)
# Ask providers to share: tail -100 dcp_daemon.log | grep -i error
# Look for: bootstrap, connection, timeout, peer

# 3. Is DNS resolution working?
nslookup api.dcp.sa
# If fails, providers can't find backend

# 4. Check backend logs for registration errors
tail -100 backend.log | grep -i "register\|heartbeat\|error"

# 5. Are old providers still trying to register?
sqlite3 providers.db "SELECT id, name, created_at FROM providers ORDER BY created_at DESC LIMIT 5;"
# Check if recent registrations (should be from this morning)
```

### Fix #1: Notify Providers to Restart Daemon

```bash
# Send to all providers in #dcp-provider-support:
"""
🔴 Phase 1 Rollout: Providers Need to Reconnect

Bootstrap is live, but we're not seeing heartbeats from your daemon yet.

Action: Restart your daemon
$ pkill -f dcp_daemon.py
$ python3 dcp_daemon.py --daemon-mode

Expected: Within 30 seconds, your heartbeat should appear on the network.

If still not appearing after 5 minutes, check your daemon logs:
$ tail -50 dcp_daemon.log | grep -i error

Support: Reply here or #dcp-incidents
"""
```

### Fix #2: Check Daemon Compatibility

If restarting doesn't help:
```bash
# Verify daemon version
# Providers should have v4.0.0-alpha.2 or newer for Phase 1 support

# Provide update URL:
curl -s https://api.dcp.sa/daemon/upgrade-path?current_version=3.0.0
# Or direct link:
wget https://api.dcp.sa/daemon/dcp_daemon-latest.py -O dcp_daemon.py
```

### Fix #3: Check Network Connectivity

```bash
# Test from backend VPS to provider (if we have provider IPs)
# Ask: Can providers reach api.dcp.sa?
for provider_ip in 192.168.1.{100..110}; do
  nc -zv -w 2 api.dcp.sa 443 &
done

# Or check provider firewall:
# Are they blocking outbound HTTPS (port 443)?
# Are they blocking P2P (port 4001)?
```

### Escalation

If <10 providers after 2 hours:
1. Check if there's a widespread provider issue (daemon crash, network outage)
2. Post in #dcp-provider-support with debugging steps
3. Call top 5 providers directly (if contact info available)
4. Consider rolling back if unable to resolve

---

## Incident #3: High Latency / Slow Job Routing (🟡 HIGH)

**Symptoms**:
- Smoke test reports: "Provider search latency: 250ms" (threshold is 100ms)
- Renters report: "Jobs taking 10+ seconds to assign"
- Backend logs show slow database queries

### Root Cause Diagnosis

```bash
# 1. Check database performance
sqlite3 providers.db "PRAGMA query_only; SELECT * FROM providers LIMIT 1;" --timer
# Should be <10ms. If >50ms, database is slow.

# 2. Check for missing indexes
sqlite3 providers.db ".indices providers"
# Should show indexes on: status, gpu_model, arabic_optimized, reliability_score

# 3. Check provider count
sqlite3 providers.db "SELECT COUNT(*) FROM providers WHERE status='online';"
# If >100, database query performance degrades

# 4. Check CPU/disk on VPS
top -b -n 1 | head -20
df -h /
# Look for: high CPU%, slow disk (%util >80%)

# 5. Check backend process
pm2 list | grep dc1-provider-onboarding
ps aux | grep node | grep -v grep
# If using >50% CPU or >2GB RAM, has a leak or needs scaling
```

### Fix #1: Optimize Database Indexes

```bash
sqlite3 providers.db << EOF
-- Create missing indexes if needed
CREATE INDEX IF NOT EXISTS idx_provider_status ON providers(status);
CREATE INDEX IF NOT EXISTS idx_provider_gpu_model ON providers(gpu_model);
CREATE INDEX IF NOT EXISTS idx_provider_arabic ON providers(arabic_optimized);
CREATE INDEX IF NOT EXISTS idx_provider_reliability ON providers(reliability_score);
CREATE INDEX IF NOT EXISTS idx_provider_last_heartbeat ON providers(last_heartbeat);

-- Vacuum and optimize
VACUUM;
PRAGMA optimize;
EOF

# Re-run smoke test
node scripts/bootstrap-health-smoke-test.mjs
```

### Fix #2: Archive Old Provider Records

If >50 providers accumulated:
```bash
# Archive providers offline for >7 days
sqlite3 providers.db << EOF
-- Count offline providers
SELECT COUNT(*) as offline_count FROM providers
WHERE last_heartbeat < datetime('now', '-7 days') AND status='offline';

-- Archive them (move to backup table, don't delete)
CREATE TABLE providers_archive AS
  SELECT * FROM providers
  WHERE last_heartbeat < datetime('now', '-7 days') AND status='offline';

DELETE FROM providers
WHERE last_heartbeat < datetime('now', '-7 days') AND status='offline';

VACUUM;
EOF
```

### Fix #3: Scale Backend if Needed

If backend is CPU-bound:
```bash
# Increase PM2 instances (use all cores)
CORES=$(nproc)
pm2 delete dc1-provider-onboarding
pm2 start backend/server.js -i $CORES --name dc1-provider-onboarding
pm2 save
```

---

## Incident #4: P2P Discovery Not Working (🟡 HIGH)

**Symptoms**:
- Smoke test fails: "Provider discovery API endpoints"
- DHT queries return empty results
- `curl http://localhost:8083/api/p2p/providers?discover_all=true` returns 0 providers

### Root Cause Diagnosis

```bash
# 1. Check backend P2P service
curl -s http://localhost:8083/api/p2p/health | jq .

# 2. Is libp2p module loaded?
grep -r "libp2p\|p2p-discovery" backend/src/server.js backend/src/index.js
# Should find import/require

# 3. Check P2P listener logs
pm2 logs dc1-provider-onboarding | grep -i "p2p\|dht\|gossip" | tail -20

# 4. Verify bootstrap is reachable from backend
curl http://localhost:8083/api/p2p/health?probe=true | jq .probe
# Should show bootstrap is reachable
```

### Fix #1: Restart P2P Listener

```bash
# Restart backend to reload P2P module
pm2 restart dc1-provider-onboarding

# Wait for startup
sleep 10

# Verify P2P service
curl -s http://localhost:8083/api/p2p/health | jq .
```

### Fix #2: Check P2P Dependencies

```bash
# Verify libp2p is installed
npm list libp2p --prefix backend/
# Should show libp2p v0.40+

# If missing, reinstall
cd backend && npm install libp2p @libp2p/kad-dht @libp2p/gossipsub
npm list libp2p

# Restart
pm2 restart dc1-provider-onboarding
```

### Fix #3: Reset P2P Cache

```bash
# Clear any cached peer data
rm -rf ~/.libp2p 2>/dev/null || true

# Clear backend cache (if applicable)
# This depends on implementation; check backend/src/services/p2p-discovery.js

# Restart backend
pm2 restart dc1-provider-onboarding

# Re-run discovery test
node scripts/bootstrap-health-smoke-test.mjs
```

---

## Incident #5: Providers Disconnecting Frequently (🟡 HIGH)

**Symptoms**:
- Providers appear online, then offline, then online again (every 30–60 seconds)
- Smoke test shows: "Latest heartbeat: 120s ago" (should be <30s)
- Provider logs show: "Lost connection to bootstrap" repeated

### Root Cause Diagnosis

```bash
# 1. Check heartbeat frequency
sqlite3 providers.db "SELECT provider_id, COUNT(*) as count FROM heartbeat_log WHERE timestamp > datetime('now', '-10 minutes') GROUP BY provider_id ORDER BY count DESC LIMIT 5;"

# If providers sending heartbeats normally, issue is on our side
# If sparse (<2 per 10 min), providers are having trouble

# 2. Check network stability
# Are there packet losses?
ping -c 20 8.8.8.8 | grep loss
# Should be 0% loss

# 3. Check VPS resources during peak
top -b -n 5 -d 1 | grep -E "Mem|Swap|load"
# Look for: swapping, load >4, memory near max
```

### Fix #1: Investigate Provider Network Issues

```bash
# Post to #dcp-provider-support:
"""
We're seeing intermittent disconnections from your provider.

If you see "Lost connection to bootstrap" messages:
1. Check your network: `ping api.dcp.sa`
2. Check for firewall rules blocking port 4001: `sudo ufw status`
3. Restart daemon and monitor logs: `tail -f dcp_daemon.log`

Most common cause: ISP-level intermittent outages or firewall rules.
"""
```

### Fix #2: Relax Availability Thresholds (Temporary)

If many providers are experiencing this:
```bash
# Temporarily increase heartbeat grace period
# Edit backend/src/routes/providers.js

// OLD: HEARTBEAT_DEGRADED_THRESHOLD_S = 600 (10 min)
// NEW: HEARTBEAT_DEGRADED_THRESHOLD_S = 1800 (30 min) for first 24h

# This gives providers more time to reconnect before marked offline
# Revert to 600s after providers stabilize
```

---

## Incident #6: Payment/Earnings Not Flowing (🔴 CRITICAL)

**Symptoms**:
- Jobs execute successfully
- Renters report: "Job completed but show $0 earnings"
- Providers report: "No SAR balance updating"

### Root Cause Diagnosis

```bash
# 1. Check escrow service
curl -s http://localhost:8083/api/escrow/health | jq .

# 2. Check recent transactions
sqlite3 providers.db "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5;"

# 3. Check job completion records
sqlite3 providers.db "SELECT id, status, provider_id, completed_at FROM jobs WHERE status='completed' ORDER BY completed_at DESC LIMIT 5;"

# 4. Check for transaction errors
pm2 logs dc1-provider-onboarding | grep -i "escrow\|payment\|transaction\|error" | tail -20
```

### Fix #1: Verify Escrow Contract

```bash
# If using blockchain (Phase 2+):
# Check contract balance
curl -s http://localhost:8083/api/escrow/contract-balance | jq .

# If balance is 0 or very low, funding is missing
# Contact founder to top up escrow wallet
```

### Fix #2: Reprocess Completed Jobs

```bash
# If transactions are missing:
# Find completed jobs without payments
sqlite3 providers.db << EOF
SELECT id, provider_id, amount_sar FROM jobs
WHERE status='completed' AND id NOT IN (
  SELECT job_id FROM transactions WHERE type='payment'
);
EOF

# Manually trigger payment processing for these jobs
# (Implementation depends on backend payment module)
```

### Escalation

If earnings are missing, this is 🔴 CRITICAL:
1. Post in #dcp-incidents
2. Page Founding Engineer immediately
3. Consider pausing new job assignments until resolved
4. Communicate with affected providers (they're working for free right now)

---

## Incident #7: Arabic Model Queries Failing (🟡 HIGH)

**Symptoms**:
- Renter submits Arabic RAG query (embeddings + reranker + LLM)
- Job times out or returns error
- Smoke test fails: "Arabic model routing support"

### Root Cause Diagnosis

```bash
# 1. Check if Arabic models are cached anywhere
sqlite3 providers.db "SELECT provider_id, cached_models FROM providers WHERE cached_models LIKE '%arabic%' OR cached_models LIKE '%allam%';"

# If empty, no providers have Arabic models

# 2. Check job logs
pm2 logs dc1-provider-onboarding | grep -i "arabic\|allam\|embeddings\|rag" | tail -20

# 3. Check provider-side logs
# Ask providers: Are they caching Arabic models?
```

### Fix #1: Notify Providers to Cache Arabic Models

```bash
# Send to #dcp-provider-support:
"""
📢 Arabic Model Opportunity

DCP is seeing demand for Arabic NLP workloads (embeddings, rerankers, Arabic LLMs).

To capture this market, cache these models on your provider:
- allam-7b (12–14 GB VRAM) — High demand
- arabic-embeddings-bgem3 (1–2 GB) — Low VRAM, 5–10x more earnings
- qwen-2.5-7b (12 GB) — Arabic-friendly, popular

Commands:
$ python3 dcp_daemon.py --preload-models "allam-7b,arabic-embeddings-bgem3"

Expected earnings uplift: +40–100% if you're the only Arabic provider.
"""
```

### Fix #2: Implement Arabic RAG Distributed Routing (Phase 2)

For now, Phase 1 routes to individual providers. Arabic RAG will require:
- Finding 3 providers (embedder + reranker + LLM)
- Coordinating multi-hop queries
- Deferred to Phase 2

---

## Checklist for On-Call Engineer

**At start of shift** (every 6 hours for first 24h):
- [ ] Run smoke test: `node scripts/bootstrap-health-smoke-test.mjs`
- [ ] Check provider count: `curl http://localhost:8083/api/providers/available`
- [ ] Check P2P health: `curl http://localhost:8083/api/p2p/health`
- [ ] Review error logs: `pm2 logs | grep -i error | tail -20`
- [ ] Post brief status to #dcp-incidents

**If any incident detected**:
- [ ] Document in #dcp-incidents Slack
- [ ] Post to DCP-612 issue
- [ ] Follow relevant runbook above
- [ ] Update status until resolved
- [ ] Post incident summary (what, why, fix) when resolved

**Escalation contacts** (for emergencies):
- Founding Engineer: peter@dcp.sa
- Backend: backend@dcp.sa
- DevOps: devops@dcp.sa
- Provider Support: providers@dcp.sa

---

## Post-Resolution: Incident Review

After resolving any incident:

1. **Document root cause** (was it provider issue, backend bug, infra problem?)
2. **Identify prevention** (can this be automated or prevented?)
3. **Update monitoring** (add alert for this metric)
4. **Post to #postmortems** (24h after incident)

---

*Runbook version: 1.0*
*Ready for Phase 1 launch (first 24h emergency reference)*
