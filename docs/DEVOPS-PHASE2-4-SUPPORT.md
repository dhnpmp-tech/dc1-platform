# DevOps Phase 2-4 Support — Post-Bootstrap Operations

**Status:** Preparation complete for Phase 2-4 execution
**Date:** 2026-03-23
**Owner:** DevOps Automator
**Objective:** Support backend configuration, provider discovery, and QA validation

---

## Overview

After Phase 1 (P2P bootstrap deployment), DevOps responsibilities shift to:
1. **Phase 2 Support** - Monitor backend configuration update execution
2. **Phase 3 Support** - Monitor provider DHT announcement and discovery
3. **Phase 4 Support** - Support QA validation and launch confirmation

This document provides operational procedures and monitoring for each phase.

---

## Phase 2: Backend Configuration Support

**Owner:** Backend Engineer
**Duration:** 5 minutes
**DevOps Role:** Monitor + support

### What Backend Team Does
1. Receives peer ID from DevOps (Phase 1 completion)
2. Injects peer ID into `p2p/dc1-node.js` line 47
3. Commits and pushes to main
4. Restarts backend service
5. Verifies P2P initialization

### DevOps Monitoring (During Phase 2)

**Real-time Health Check:**
```bash
# Monitor backend logs for P2P initialization
ssh root@76.13.179.86 'pm2 logs dc1-provider-onboarding --lines 50 | grep -i "p2p\|bootstrap\|peer"'

# Expected output:
# [Backend] P2P node initialized with peer ID: ...
# [Backend] Connected to bootstrap: 76.13.179.86:4001
# [Backend] DHT initialized
```

**Automated Monitoring Command:**
```bash
# Watch for P2P initialization in real-time
ssh root@76.13.179.86 'pm2 logs dc1-provider-onboarding --follow --lines 10 | grep -E "P2P|bootstrap|peer|DHT" --color=always'
```

### Phase 2 Success Criteria

- [ ] Backend restarted successfully (check pm2 status)
- [ ] P2P node initialized in logs
- [ ] Bootstrap connection confirmed
- [ ] No errors in 50 log lines
- [ ] Backend responding to health endpoint

### Phase 2 Troubleshooting (If Support Needed)

**Backend won't restart:**
```bash
ssh root@76.13.179.86 << 'EOF'
# Check what's wrong
pm2 logs dc1-provider-onboarding --lines 100 | tail -20

# If peer ID format incorrect
grep "REPLACE_WITH_BOOTSTRAP_PEER_ID" /home/node/dc1-platform/p2p/dc1-node.js
# Should return nothing if Phase 2 is done

# If node syntax error
node -c /home/node/dc1-platform/p2p/dc1-node.js

# Restart manually
pm2 restart dc1-provider-onboarding
EOF
```

---

## Phase 3: Provider Discovery (Automatic)

**Owner:** System (automatic, no action needed)
**Duration:** 30 seconds
**DevOps Role:** Monitor + document

### What Happens Automatically

1. Provider daemon polls for heartbeat endpoint
2. Provider sends heartbeat to backend
3. Backend detects bootstrap in P2P config
4. Backend announces provider to DHT
5. Provider daemon detects new bootstrap peers
6. Provider re-announces itself to DHT
7. Provider status updates in database

### DevOps Monitoring (During Phase 3)

**Real-time Provider Status:**
```bash
# Check provider table for online providers
ssh root@76.13.179.86 << 'EOF'
sqlite3 /home/node/dc1-platform/backend/data/providers.db << 'SQL'
SELECT
  provider_id,
  status,
  last_heartbeat,
  p2p_peer_id
FROM providers
WHERE status = 'online'
ORDER BY last_heartbeat DESC
LIMIT 5;
SQL
EOF

# Expected: Should see provider count increase from 0 during Phase 3
```

**Monitor Provider Announcements:**
```bash
# Watch backend logs for provider announcements
ssh root@76.13.179.86 'pm2 logs dc1-provider-onboarding --lines 100 | grep -i "provider\|announce\|heartbeat"'
```

### Phase 3 Success Criteria

- [ ] Provider count increases from 0
- [ ] At least 1 provider showing online status
- [ ] Backend logs show DHT announcements
- [ ] No errors in logs
- [ ] Provider heartbeats detected

### Phase 3 Troubleshooting (If Support Needed)

**No providers showing online:**
```bash
ssh root@76.13.179.86 << 'EOF'
# Check if backend is announcing to DHT
pm2 logs dc1-provider-onboarding --lines 200 | grep -i "announce\|dht"

# Check provider table has any entries
sqlite3 /home/node/dc1-platform/backend/data/providers.db \
  "SELECT count(*) as total_providers FROM providers;"

# Check if providers are registered but offline
sqlite3 /home/node/dc1-platform/backend/data/providers.db \
  "SELECT count(*) FROM providers WHERE status = 'offline';"

# Check P2P node status
pm2 logs dc1-provider-onboarding --lines 50 | grep -i "p2p\|peer\|dht"
EOF
```

---

## Phase 4: QA Validation Support

**Owner:** QA Engineer
**Duration:** 5-10 minutes
**DevOps Role:** Monitor infrastructure during testing

### What QA Does

1. Runs E2E smoke tests
2. Submits test jobs
3. Validates provider response
4. Checks job completion
5. Confirms launch readiness

### DevOps Monitoring (During Phase 4)

**Infrastructure Health During Testing:**
```bash
# Monitor system resources during test execution
ssh root@76.13.179.86 'bash /home/node/dc1-platform/scripts/vps-health.sh'

# Expected:
# - CPU usage < 80% during tests
# - Memory < 85%
# - Disk space adequate
# - No critical errors
```

**Database During Testing:**
```bash
# Monitor job table during test execution
ssh root@76.13.179.86 << 'EOF'
watch -n 5 'sqlite3 /home/node/dc1-platform/backend/data/providers.db \
  "SELECT status, count(*) FROM jobs GROUP BY status;"'
EOF

# Expected progression:
# pending -> assigned -> running -> completed
```

**Real-time Backend Logs:**
```bash
# Watch backend for test job processing
ssh root@76.13.179.86 'pm2 logs dc1-provider-onboarding --follow --lines 20'
```

### Phase 4 Success Criteria

- [ ] Test jobs submitted successfully
- [ ] Provider accepts job assignment
- [ ] Job execution begins
- [ ] Job completion detected
- [ ] No backend errors during testing
- [ ] System resources remain healthy
- [ ] All database transactions successful

### Phase 4 Troubleshooting (If Support Needed)

**Jobs not completing:**
```bash
ssh root@76.13.179.86 << 'EOF'
# Check job status distribution
sqlite3 /home/node/dc1-platform/backend/data/providers.db << 'SQL'
SELECT
  status,
  count(*) as count,
  max(created_at) as latest
FROM jobs
GROUP BY status;
SQL

# Check backend logs for job processing errors
pm2 logs dc1-provider-onboarding --lines 200 | grep -i "job\|error\|fail"

# Check provider logs for execution issues
pm2 logs provider-daemon --lines 100 | grep -i "error\|fail" || echo "Provider daemon not running"
EOF
```

**Provider not accepting jobs:**
```bash
ssh root@76.13.179.86 << 'EOF'
# Check provider online status
sqlite3 /home/node/dc1-platform/backend/data/providers.db \
  "SELECT provider_id, status, last_heartbeat FROM providers ORDER BY last_heartbeat DESC LIMIT 5;"

# Check if provider can be reached
curl -s http://provider-ip:8080/health || echo "Provider endpoint not responding"

# Check backend P2P connectivity
pm2 logs dc1-provider-onboarding --lines 50 | grep -i "peer\|dht\|announce"
EOF
```

---

## Integrated Monitoring Dashboard

For Phase 2-4, set up integrated monitoring:

```bash
# Terminal 1: Backend logs (P2P + jobs)
ssh root@76.13.179.86 'pm2 logs dc1-provider-onboarding --follow'

# Terminal 2: System health
ssh root@76.13.179.86 'watch -n 5 bash /home/node/dc1-platform/scripts/vps-health.sh'

# Terminal 3: Database monitoring
ssh root@76.13.179.86 'watch -n 5 "sqlite3 /home/node/dc1-platform/backend/data/providers.db \"SELECT COUNT(*) as online_providers FROM providers WHERE status='"'"'online'"'"'; SELECT COUNT(*) as pending_jobs FROM jobs WHERE status='"'"'pending'"'"';\""'

# Terminal 4: Local monitoring
bash /home/node/dc1-platform/scripts/monitor-phase1-completion.sh
```

---

## Emergency Procedures

### If Backend Crashes During Phase 2

```bash
ssh root@76.13.179.86 << 'EOF'
# 1. Check what happened
pm2 logs dc1-provider-onboarding --lines 200

# 2. Restart backend
pm2 restart dc1-provider-onboarding

# 3. Verify restart successful
pm2 status | grep dc1-provider-onboarding

# 4. Monitor logs
pm2 logs dc1-provider-onboarding --follow --lines 20
EOF
```

### If Phase 3 Doesn't Detect Providers

```bash
ssh root@76.13.179.86 << 'EOF'
# 1. Verify P2P configuration is correct
grep "REPLACE_WITH_BOOTSTRAP_PEER_ID" /home/node/dc1-platform/p2p/dc1-node.js
# Should return nothing (placeholder replaced)

# 2. Check DHT is initialized
pm2 logs dc1-provider-onboarding --lines 100 | grep "DHT\|announce"

# 3. Force provider rescan
curl -X POST http://localhost:8083/api/providers/rescan || echo "Endpoint not available"

# 4. Check provider daemon
pm2 status | grep provider-daemon
pm2 logs provider-daemon --lines 50
EOF
```

### If Phase 4 Tests Fail

```bash
ssh root@76.13.179.86 << 'EOF'
# 1. Verify provider is online
sqlite3 /home/node/dc1-platform/backend/data/providers.db \
  "SELECT COUNT(*) FROM providers WHERE status='online';"
# Should return > 0

# 2. Check job assignment logic
pm2 logs dc1-provider-onboarding --lines 100 | grep -i "assign\|match"

# 3. Verify provider can handle jobs
# Run lightweight test job
curl -X POST http://localhost:8083/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"model":"test","prompt":"hello","maxTokens":10}'

# 4. Check job processing in logs
pm2 logs dc1-provider-onboarding --lines 50 | grep -i "job"
EOF
```

---

## Deployment Timeline Reference

```
Phase 1: Bootstrap (DevOps) — 5-10 min ✅
Phase 2: Backend Config (Backend) — 5 min ⏳
  → DevOps monitors backend logs
Phase 3: Provider Discovery (Automatic) — 30 sec ⏳
  → DevOps watches provider count increase
Phase 4: QA Validation (QA) — 5-10 min ⏳
  → DevOps monitors infrastructure health

TOTAL: ~25 minutes
```

---

## Handoff Checklist

**From Phase 1 (DevOps) to Phase 2 (Backend):**
- [ ] Peer ID captured from bootstrap logs
- [ ] Peer ID posted to DCP-612 with format: `12D3Koo...`
- [ ] Backend team notified and ready

**From Phase 2 (Backend) to Phase 3 (Automatic):**
- [ ] Backend restarted with peer ID injected
- [ ] Verified in logs: "Connected to bootstrap"
- [ ] No errors in backend logs

**From Phase 3 (Automatic) to Phase 4 (QA):**
- [ ] Provider count > 0 (check database)
- [ ] Providers showing online status
- [ ] Backend logs show DHT announcements

**From Phase 4 (QA) to Launch:**
- [ ] Test jobs completed successfully
- [ ] Provider accepted and executed jobs
- [ ] All databases consistent
- [ ] No critical errors in logs
- [ ] System resources healthy

---

## Logs & Debugging Reference

**Key Log Locations:**
```
Backend logs:        pm2 logs dc1-provider-onboarding
Backend data:        /root/dc1-platform/backend/data/providers.db
Bootstrap logs:      pm2 logs dc1-p2p-bootstrap
VPS system logs:     /var/log/syslog
Nginx logs:          /var/log/nginx/access.log, error.log
```

**Useful Queries:**
```sql
-- Provider status summary
SELECT status, COUNT(*) FROM providers GROUP BY status;

-- Job status summary
SELECT status, COUNT(*) FROM jobs GROUP BY status;

-- Most recent provider
SELECT * FROM providers ORDER BY last_heartbeat DESC LIMIT 1;

-- Most recent job
SELECT * FROM jobs ORDER BY created_at DESC LIMIT 1;

-- Provider online count
SELECT COUNT(*) as online_providers FROM providers WHERE status='online';

-- Pending job count
SELECT COUNT(*) as pending_jobs FROM jobs WHERE status='pending';
```

---

## Status: Ready for Phase 2-4 Operations

All DevOps monitoring and support procedures documented and ready. Waiting for Phase 1 bootstrap completion to begin Phase 2-4 support sequence.

**Monitor Job:** `afb5f98b` (checks every 5 minutes for Phase 1 completion)

---
