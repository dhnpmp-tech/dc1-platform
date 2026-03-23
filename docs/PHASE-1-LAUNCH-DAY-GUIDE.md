# Phase 1 Launch Day Operations Guide

**Date:** 2026-03-26 (Launch Day)
**Duration:** 08:00 UTC — 08:30 UTC (30 minutes total)
**Owner:** CEO / Launch Coordinator
**Format:** Minute-by-minute timeline with parallel activities

---

## Pre-Launch (07:45 UTC) — Last Checks

### All Teams (T-15 minutes)

```bash
# 1. Final infrastructure health check
ssh root@76.13.179.86 'bash /home/node/dc1-platform/scripts/vps-health.sh'
# Expected: All systems GREEN

# 2. Verify all documentation accessible
ls -1 /home/node/dc1-platform/docs/PHASE-1-*.md | wc -l
# Expected: 5+ files

# 3. Confirm communication channels open
# Slack: #phase-1-launch channel active
# Email: Contacts verified
# Phone: On-call numbers confirmed
```

### DevOps (T-15 minutes)

```bash
# 1. SSH to VPS confirmed
ssh root@76.13.179.86 'uptime'
# Expected: Connection successful

# 2. P2P bootstrap script ready
ls -la /home/node/dc1-platform/p2p/bootstrap.js
# Expected: File exists, readable

# 3. PM2 available
ssh root@76.13.179.86 'pm2 --version'
# Expected: Version 4.x or higher
```

### Backend (T-15 minutes)

```bash
# 1. p2p/dc1-node.js accessible
ls -la /home/node/dc1-platform/p2p/dc1-node.js

# 2. Git repo up-to-date
git status
# Expected: Working tree clean

# 3. Peer ID placeholder present
grep "REPLACE_WITH_BOOTSTRAP_PEER_ID" /home/node/dc1-platform/p2p/dc1-node.js
# Expected: Found
```

### QA (T-15 minutes)

```bash
# 1. Test job prepared
cat test-job.json
# Expected: Valid JSON with model, prompt, maxTokens

# 2. Test script ready
bash /home/node/dc1-platform/scripts/smoke-test.sh --dry-run
# Expected: No errors
```

### Providers (T-15 minutes)

```bash
# 1. P2P discovery enabled
echo $P2P_DISCOVERY_ENABLED
# Expected: true

# 2. Provider daemon running
ps aux | grep provider_daemon | grep -v grep
# Expected: Process running
```

---

## Launch Timeline (08:00 UTC — 08:30 UTC)

### T+0:00 — LAUNCH START

**All Teams:**
- [ ] Open `/docs/PHASE-1-QUICK-REFERENCE.md`
- [ ] Enable logging and monitoring
- [ ] Open communication channels (Slack #phase-1-launch)
- [ ] **Log:** "Phase 1 Launch initiated at 08:00 UTC"

**DevOps:**
- [ ] Announce: "Starting Phase 1 Bootstrap Deployment"
- [ ] Post to Slack: "Phase 1: DevOps starting"

---

### T+0:00 — Phase 1: Bootstrap Deployment (DevOps)

**Duration:** 5-10 minutes

**Commands:**
```bash
ssh root@76.13.179.86 << 'EOF'
cd /home/node/dc1-platform
npm install --prefix p2p
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
pm2 save && pm2 startup
EOF
```

**Parallel Actions (while DevOps working):**
- Backend: Ready configuration update (have editor open, peer ID placeholder visible)
- QA: Prepare test jobs
- Providers: Monitor logs for bootstrap detection

**DevOps Checklist:**
- [ ] `npm install` completed (30-60 seconds)
- [ ] PM2 start command executed
- [ ] Bootstrap shows `[PM2] Started` message
- [ ] **Log:** "Bootstrap started, extracting peer ID"

---

### T+5:00 — Extract Peer ID (DevOps)

**Duration:** 1-2 minutes

**Command:**
```bash
PEER_ID=$(pm2 logs dc1-p2p-bootstrap --lines 50 | grep -o '12D3Koo[A-Za-z0-9]*' | head -1)
echo "Peer ID: $PEER_ID"
```

**Expected Output:**
```
Peer ID: 12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh
```

**DevOps Actions:**
- [ ] Copy full peer ID string
- [ ] **Post to Slack:** `Peer ID: 12D3Koo...` (full string)
- [ ] **Log:** "Peer ID captured and posted"
- [ ] Verify bootstrap still running: `pm2 status | grep dc1-p2p-bootstrap`

---

### T+7:00 — Notify Backend (DevOps → Backend)

**Message to Backend Team:**
```
🚀 PHASE 1 BOOTSTRAP COMPLETE

Peer ID: 12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh
Bootstrap: Running at 76.13.179.86:4001
Status: Online and listening

PROCEED WITH PHASE 2 CONFIGURATION
```

**Backend → All Teams:**
- [ ] Acknowledge receipt in Slack
- [ ] Begin Phase 2 configuration immediately

---

### T+7:00 — Phase 2: Backend Configuration (Backend)

**Duration:** 5 minutes

**Step 1: Update p2p/dc1-node.js (T+7:00)**
```bash
# Edit line 47
# OLD: '/ip4/76.13.179.86/tcp/4001/p2p/REPLACE_WITH_BOOTSTRAP_PEER_ID'
# NEW: '/ip4/76.13.179.86/tcp/4001/p2p/12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh'

# Verify syntax
node -c /home/node/dc1-platform/p2p/dc1-node.js
# Expected: No output (syntax OK)
```

**Step 2: Commit and Push (T+8:00)**
```bash
git add p2p/dc1-node.js
git commit -m "config(p2p): bootstrap peer ID for Phase 1 launch"
git push origin main
```

**Backend Checklist:**
- [ ] Peer ID injected correctly
- [ ] Syntax verified
- [ ] Commit created and pushed
- [ ] **Log:** "Peer ID injected, preparing to restart"

**Step 3: Restart Backend (T+9:00)**
```bash
ssh root@76.13.179.86 'pm2 restart dc1-provider-onboarding'

# Verify restart
ssh root@76.13.179.86 'pm2 status | grep dc1-provider-onboarding'
# Expected: online
```

**Backend Checklist:**
- [ ] Service restart completed
- [ ] Status shows "online"
- [ ] No errors in logs (first 20 lines clean)
- [ ] **Log:** "Backend restarted, Phase 2 complete"
- [ ] **Post to Slack:** "Phase 2 COMPLETE - Backend configured"

---

### T+12:00 — Phase 3: Provider Discovery (Automatic)

**Duration:** 30 seconds (automatic process)

**DevOps/P2P Monitoring (watch for provider announcements):**

```bash
# Monitor backend logs
ssh root@76.13.179.86 'pm2 logs dc1-provider-onboarding --follow --lines 20' &

# Monitor provider count
watch -n 2 'sqlite3 /home/node/dc1-platform/backend/data/providers.db \
  "SELECT COUNT(*) as online_count FROM providers WHERE status=\"online\";"'
```

**Expected Progress:**
- T+12:00 — 0 providers online
- T+13:00 — 1-3 providers online (first waves announcing)
- T+13:30 — 5+ providers online (full discovery)

**P2P Engineering Checklist:**
- [ ] Watch for DHT announcements in backend logs
- [ ] Provider count increasing
- [ ] Status showing "online" for discovered providers
- [ ] **Log:** "Providers discovering and announcing"
- [ ] **Post to Slack:** "Phase 3: X providers online"

---

### T+13:00 — Phase 4: QA Validation Begins (Parallel)

**Duration:** 5-10 minutes (while providers announcing)

**QA Procedure:**

```bash
# 1. Submit test job (T+13:00)
RESPONSE=$(curl -s -X POST https://api.dcp.sa/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "model":"test",
    "prompt":"Say hello world",
    "maxTokens":10
  }')

JOB_ID=$(echo $RESPONSE | jq -r '.job_id')
echo "Test job submitted: $JOB_ID"

# 2. Monitor job status (T+13:30)
for i in {1..30}; do
  STATUS=$(curl -s https://api.dcp.sa/api/jobs/$JOB_ID | jq -r '.status')
  echo "Job status: $STATUS"
  [ "$STATUS" = "completed" ] && break
  sleep 2
done

# 3. Verify completion (T+14:00)
curl -s https://api.dcp.sa/api/jobs/$JOB_ID | jq '.'
# Expected: status=completed, result populated
```

**QA Checklist:**
- [ ] Test job submitted successfully
- [ ] Job accepted by provider (status: assigned)
- [ ] Job execution begins (status: running)
- [ ] Job completes within 30 seconds
- [ ] Result valid and matches prompt
- [ ] **Log:** "Test job completed successfully"
- [ ] **Post to Slack:** "Phase 4: Test job ✅ PASSED"

---

### T+15:00 — System Health Check (DevOps)

**Duration:** 2 minutes

```bash
# Final infrastructure check
ssh root@76.13.179.86 'bash /home/node/dc1-platform/scripts/vps-health.sh'

# Expected output:
# Disk usage: <80% ✓
# Memory usage: <80% ✓
# CPU load: <80% ✓
# Port 8083: Open ✓
# Services: All online ✓
```

**DevOps Checklist:**
- [ ] All infrastructure healthy
- [ ] No critical errors
- [ ] Database responding
- [ ] Logs clean (no ERROR entries)
- [ ] **Log:** "Infrastructure health: GREEN"

---

### T+17:00 — Phase 1 COMPLETE ✅

**All Teams - Final Status Report:**

**DevOps:**
- ✅ Bootstrap node running
- ✅ Health monitoring active
- ✅ All systems operational

**Backend:**
- ✅ Configuration updated
- ✅ Service running
- ✅ P2P initialized

**P2P Engineering:**
- ✅ Providers discovered: X online
- ✅ DHT announcements flowing
- ✅ Network healthy

**QA:**
- ✅ Test jobs passing
- ✅ Job execution working
- ✅ System validated

**Providers:**
- ✅ Heartbeats sending
- ✅ Status online
- ✅ Ready for jobs

---

## Post-Launch (T+20:00)

### CEO Decision: GO / NO-GO

**GO Criteria (All must be TRUE):**
- [ ] All phases completed in timeline
- [ ] No critical errors
- [ ] Providers discovered and online
- [ ] Test jobs executing successfully
- [ ] Infrastructure healthy
- [ ] All teams report ready

**GO Decision:**
- [ ] CEO approves Phase 2 start
- [ ] **Announcement:** "Phase 1 COMPLETE - Phase 2 begins immediately"
- [ ] **Post to Slack:** @channel Phase 1 launch successful ✅

**NO-GO Decision (if any failures):**
- [ ] CEO directs investigation
- [ ] Escalate to relevant lead
- [ ] Document issue and fix
- [ ] Schedule Phase 1 retry

### Final Logs & Documentation

```bash
# Capture final system state
ssh root@76.13.179.86 'pm2 status' > phase1-final-state.log
ssh root@76.13.179.86 'pm2 logs dc1-provider-onboarding --lines 100' >> phase1-final-state.log

# Backup database
ssh root@76.13.179.86 'bash /home/node/dc1-platform/scripts/backup-db.sh'

# Document completion
echo "Phase 1 Launch Complete - $(date)" >> /tmp/phase1-summary.log
```

---

## Troubleshooting During Launch

### If Bootstrap Won't Start (T+0-5)

```bash
# 1. Check Node.js
node --version  # Should be v18+

# 2. Check dependencies
npm list --prefix p2p

# 3. Kill any existing process on port 4001
lsof -i :4001 | awk 'NR>1 {print $2}' | xargs kill -9

# 4. Retry
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
```

**Escalate:** Contact DevOps Lead if still fails after retry

### If Backend Won't Restart (T+9)

```bash
# 1. Check logs
pm2 logs dc1-provider-onboarding --lines 50

# 2. Verify syntax
node -c /home/node/dc1-platform/p2p/dc1-node.js

# 3. Manual restart
pm2 kill
pm2 start p2p/dc1-node.js --name dc1-provider-onboarding
```

**Escalate:** Contact Backend Lead if still fails after retry

### If Providers Not Discovering (T+13)

```bash
# 1. Check DHT announcements in logs
pm2 logs dc1-provider-onboarding --lines 100 | grep -i "announce"

# 2. Check provider connectivity
curl -s http://provider-ip:8080/health

# 3. Ask providers to restart daemon
# Message to providers: "Please restart daemon: pkill provider_daemon"
```

**Escalate:** Contact P2P Lead if still fails after 60 seconds

### If Test Jobs Fail (T+13+)

```bash
# 1. Check job in database
sqlite3 /home/node/dc1-platform/backend/data/providers.db \
  "SELECT * FROM jobs WHERE job_id='YOUR_JOB_ID';"

# 2. Check provider logs
ssh root@provider-ip 'tail -100 provider_daemon.log | grep -i error'

# 3. Try simpler test job
curl -X POST http://localhost:8083/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"model":"test","prompt":"hi","maxTokens":1}'
```

**Escalate:** Contact QA Lead if job consistently fails

---

## Communication Template

**For Slack #phase-1-launch channel:**

```
[HH:MM UTC] [Team] [Status]

08:00 ALL: 🚀 PHASE 1 LAUNCH STARTED
08:00 DevOps: Starting bootstrap deployment
08:05 DevOps: Peer ID captured: 12D3Koo...
08:07 Backend: Starting configuration update
08:09 Backend: 🎯 PHASE 2 COMPLETE
08:12 QA: Starting test job submissions
08:13 Providers: Provider count increasing: 5 online
08:14 QA: 🎯 TEST JOB PASSED
08:17 ALL: ✅ PHASE 1 COMPLETE
```

---

## Launch Day Success Checklist

- [ ] Pre-launch verification complete (T-15)
- [ ] All teams online and ready (T-15)
- [ ] Phase 1: Bootstrap deployed (T+5)
- [ ] Peer ID extracted (T+7)
- [ ] Phase 2: Backend configured (T+12)
- [ ] Phase 3: Providers discovering (T+13)
- [ ] Phase 4: Test jobs passing (T+14)
- [ ] Infrastructure healthy (T+15)
- [ ] CEO approval obtained (T+17)
- [ ] Launch celebration! 🎉

---

## Post-Launch Next Steps

1. Phase 2 begins immediately (provider activation)
2. Monitor first 24 hours intensely
3. Daily standups with all teams
4. Document lessons learned
5. Plan Phase 3 (contract enforcement)
6. Plan Phase 4 (token economics)

---

**Status:** Ready for Phase 1 Launch Day
**Last Updated:** 2026-03-23
**Distribution:** All launch team members

---
