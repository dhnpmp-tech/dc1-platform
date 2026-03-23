# Phase 1 Launch Coordination Guide

**Purpose:** Unified execution plan for all teams during Phase 1 bootstrap deployment
**Timeline:** ~20 minutes from Phase 1 start to launch-ready confirmation
**Participants:** DevOps, Backend, P2P Engineer, QA Engineer
**Last Updated:** 2026-03-23

---

## Pre-Launch (Do This Now)

### DevOps Team
- [ ] Verify SSH access to VPS 76.13.179.86
- [ ] Confirm P2P dependencies installed: `npm list --prefix p2p @libp2p/tcp`
- [ ] Verify PM2 installed and working: `pm2 status`
- [ ] Have DEVOPS-PHASE1-QUICKSTART.md open and ready
- [ ] Confirm network connectivity to VPS (ping 76.13.179.86)

### Backend Team
- [ ] Have p2p/dc1-node.js open in editor
- [ ] Locate line 47 (REPLACE_WITH_BOOTSTRAP_PEER_ID placeholder)
- [ ] Ensure git is ready for commit/push
- [ ] Have `pm2 restart dc1-provider-onboarding` command ready
- [ ] Verify backend service is currently running

### P2P Engineer (You)
- [ ] Phase 1 monitor running (PID 410166): ✅ Confirmed
- [ ] Cron recurring task scheduled (Job f742ebab): ✅ Confirmed
- [ ] Phase 4 validation script ready: ✅ Confirmed
- [ ] DCP-612 comments monitored for updates: ✅ Ready
- [ ] Results posting template prepared: ✅ Ready

### QA Engineer
- [ ] Smoke tests staged and ready
- [ ] Integration tests prepared
- [ ] Dashboard monitoring setup
- [ ] Have incident response procedures available
- [ ] Communication templates ready

---

## Phase 1 Timeline — The 20-Minute Launch Window

### T+0: DevOps Phase 1 Start

**DevOps Action:**
```bash
ssh root@76.13.179.86
cd /home/node/dc1-platform
npm install --prefix p2p && \
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap && \
pm2 save && pm2 startup
```

**DevOps Checkpoint:**
- [ ] SSH connection successful
- [ ] npm install completed without errors
- [ ] pm2 start executed successfully
- [ ] Bootstrap process shows "online" in `pm2 status`

**Expected Output:**
```
[PM2] Starting p2p/bootstrap.js in fork mode
[Bootstrap] Listening on /ip4/0.0.0.0/tcp/4001
[Bootstrap] Peer ID: 12D3KooW[...40+ character string...]
```

### T+2: DevOps Phase 1 Complete

**DevOps Action:**
Extract peer ID and post to DCP-612:
```bash
PEER_ID=$(pm2 logs dc1-p2p-bootstrap --lines 50 | grep -oP '12D3Koo[A-Za-z0-9]+' | head -1)
echo "Phase 1 Complete! Peer ID: $PEER_ID"
# Post to DCP-612 comment with peer ID
```

**DCP-612 Comment Format:**
```
## Phase 1 Complete — Bootstrap Deployed ✅

Bootstrap Peer ID: 12D3KooW[...full peer ID...]
Running at: 76.13.179.86:4001
Status: Online and stable

Backend team: You're next! Use peer ID above.
```

**Expected:** Peer ID posted to DCP-612 within 2 minutes

### T+2-5: Backend Phase 2 Starts

**Backend Notification:**
P2P Engineer comments on DCP-612 confirmation of peer ID receipt:
```
## Peer ID Received — Backend Phase 2 Ready to Start

P2P Engineer: Confirmed peer ID receipt. Backend: Execute Phase 2 configuration update.
```

**Backend Action:**
1. Copy peer ID from DCP-612
2. Update p2p/dc1-node.js line 47:
```javascript
// BEFORE:
'/ip4/76.13.179.86/tcp/4001/p2p/REPLACE_WITH_BOOTSTRAP_PEER_ID'

// AFTER:
'/ip4/76.13.179.86/tcp/4001/p2p/12D3KooW[...copied peer ID...]'
```

3. Commit and push:
```bash
git add p2p/dc1-node.js
git commit -m "config(p2p): Inject bootstrap peer ID for Phase 1 launch

Enables provider discovery via DHT. Peer ID: 12D3KooW[...]"
git push origin main
```

4. Restart backend service:
```bash
pm2 restart dc1-provider-onboarding
pm2 logs dc1-provider-onboarding | head -50
```

**Backend Checkpoint:**
- [ ] File updated with correct peer ID
- [ ] Commit pushed to main branch
- [ ] Backend service restarted without errors
- [ ] Logs show no P2P connection errors

**Expected:** Phase 2 complete within 5 minutes (T+7)

### T+7: P2P Engineer Phase 3 Monitoring

**P2P Engineer Action:**
Monitor for Phase 3 completion (automatic, 30 seconds):
```bash
# Monitor system processes provider re-announcement
watch -n 2 'sqlite3 /path/to/dcp.db "
SELECT COUNT(CASE WHEN p2p_peer_id IS NOT NULL THEN 1 END) as providers_with_ids
FROM providers WHERE approval_status=\"approved\";
"'
```

**Expected:** Providers being assigned peer IDs (increasing count)

### T+8: Phase 3 Complete (Automatic)

**System Actions (Automatic):**
- [ ] Providers detect bootstrap via DHT
- [ ] Providers re-announce their availability
- [ ] Provider status begins updating to "online"
- [ ] Heartbeat endpoint starts receiving provider announcements

**No manual action needed** — System handles automatically

### T+10: P2P Engineer Phase 4 Start

**P2P Engineer Action:**
Execute Phase 4 validation:
```bash
bash scripts/validate-p2p-setup.sh 2>&1 | tee /tmp/phase4-results-$(date +%s).log
EXIT_CODE=$?
echo "Validation exit code: $EXIT_CODE"
```

**Phase 4 Tests:**
- [ ] Bootstrap connectivity (port 4001 reachable)
- [ ] Backend API health (HTTP 200)
- [ ] Heartbeat endpoint operational
- [ ] Database schema ready (p2p_peer_id column exists)
- [ ] Provider peer IDs being assigned
- [ ] P2P module files all present
- [ ] Dependencies installed
- [ ] Documentation complete

**Expected:** All 23 tests pass, exit code 0

### T+15: Phase 4 Results Posted

**P2P Engineer Action:**
Post results to DCP-612:
```
## Phase 4 Complete — P2P Network Validation Successful ✅

**Validation Results:**
- Exit code: 0
- Tests: 23/23 passing
- Bootstrap: Reachable at 76.13.179.86:4001
- API: Responding at https://api.dcp.sa
- Heartbeat: Operational
- Provider status: 40+/43 online

**Provider Discovery:**
- Peer IDs assigned: 43/43 (100%)
- Online providers: 40+ (>90%)
- DHT announcements: Successful
- Uptime: >99%

**Phase 1 Launch Status: ✅ READY FOR PRODUCTION**

All systems validated. P2P discovery network operational.
Providers can now discover each other and renters can discover providers.
```

**Expected:** Results posted within 5 minutes of Phase 4 start

### T+20: Phase 1 Launch-Ready Confirmation

**QA Engineer Action:**
Confirm Phase 1 readiness across all systems:
```
## Phase 1 Launch-Ready Confirmation ✅

All teams: Phase 1 complete and validated

**Infrastructure Status:**
✓ Bootstrap node: Running and stable
✓ Backend service: Updated and restarted
✓ P2P network: Validated operational
✓ Provider discovery: 40+ providers online
✓ All tests: Passing

**Readiness: CONFIRMED**

Phase 1 launch successful. Proceeding to provider onboarding.
```

---

## Post-Phase 1 (Immediate - Next 24 Hours)

### T+20-30: Provider Onboarding Activation

**Provider Onboarding Team:**
Execute PROVIDER-ONBOARDING-P2P-LAUNCH.md procedures:
- [ ] Send provider notifications of Phase 1 live status
- [ ] Monitor provider reconnection (expected: 30+ online)
- [ ] Support first providers coming online
- [ ] Track earnings activation

### T+30 min: First Success Milestone

**Expected Outcomes:**
- 40-42 providers online (97.7% activation)
- 0-2 providers with temporary issues
- Peer IDs: 100% assigned
- First bookings: 2-5 incoming

### T+1 hour: Provider Onboarding Support

**Support Team Active:**
- [ ] Troubleshooting offline providers
- [ ] Supporting new provider connections
- [ ] Monitoring earnings flow
- [ ] First booking support

### T+6 hours: Major Success Checkpoint

**Expected Outcomes:**
- 41-42 providers online (>99% stable)
- 20+ bookings processed
- $200+ earnings flowing
- Zero critical issues

### T+24 hours: Phase 1 Success Confirmation

**Expected Outcomes:**
- 42/43 providers online (97.7%)
- >99.5% average uptime
- 100+ bookings processed
- $5000+ provider earnings
- Provider satisfaction: >4.5/5

---

## Communication Plan

### DCP-612 Comments (Real-time Updates)

**T+0:** DevOps posts Phase 1 start
**T+2:** DevOps posts Phase 1 complete + peer ID
**T+5:** Backend posts Phase 2 start acknowledgment
**T+7:** Backend posts Phase 2 complete
**T+10:** P2P Engineer posts Phase 4 start
**T+15:** P2P Engineer posts Phase 4 results
**T+20:** QA Engineer posts launch-ready confirmation

### All-Hands Notification (T+15)

Send to all team members:
```
Phase 1 P2P Bootstrap Launch: SUCCESSFUL ✅

Timeline: 20 minutes start-to-finish
- Bootstrap: Deployed (76.13.179.86:4001)
- Provider discovery: Active
- Renter discovery: Operational
- Launch status: READY FOR PRODUCTION

Provider onboarding beginning immediately.
Expected: 42+ providers active within 1 hour.
```

---

## Failure Scenarios & Rollback

### If Phase 1 Fails (Bootstrap Won't Start)

**Symptoms:** Port 4001 not listening, bootstrap offline
**Recovery (5-10 min):**
1. Check logs: `pm2 logs dc1-p2p-bootstrap | tail -100`
2. Verify dependencies: `ls p2p/node_modules/@libp2p/tcp`
3. Restart: `pm2 restart dc1-p2p-bootstrap`
4. If still fails: Refer to P2P-TROUBLESHOOTING-RUNBOOK.md

**Escalation:** Contact P2P Engineer

### If Phase 2 Fails (Backend Won't Update)

**Symptoms:** Git commit fails, backend restart fails
**Recovery (5 min):**
1. Check git status: `git status`
2. Verify peer ID is correctly formatted
3. Manually verify line 47: `grep "ip4/76.13.179.86" p2p/dc1-node.js`
4. Restart backend: `pm2 restart dc1-provider-onboarding`

**Escalation:** Contact Backend Engineer

### If Phase 4 Validation Fails

**Symptoms:** Validation script exits code 1, tests failing
**Analysis (5 min):**
1. Check bootstrap: `curl -s https://76.13.179.86:4001` or `nc -zv 76.13.179.86 4001`
2. Check backend: `curl -s https://api.dcp.sa/api/health`
3. Check database: `sqlite3 dcp.db "SELECT COUNT(*) FROM providers WHERE p2p_peer_id IS NOT NULL;"`
4. Refer to P2P-TROUBLESHOOTING-RUNBOOK.md for detailed diagnosis

**Escalation:** Contact P2P Engineer immediately

---

## Success Criteria

### Phase 1 Success (20 minutes)
- ✅ Bootstrap peer ID captured and posted
- ✅ Backend config updated and service restarted
- ✅ All 23 validation tests passing
- ✅ 40+ providers showing online status
- ✅ P2P discovery network operational

### Phase 1 Stability (First 6 hours)
- ✅ Bootstrap uptime: >99.5%
- ✅ Provider uptime: >99%
- ✅ Zero critical errors
- ✅ Provider discovery working reliably

### Phase 1 Full Success (First 24 hours)
- ✅ 42+ providers active (97.7%)
- ✅ 100+ bookings processed
- ✅ $5000+ provider earnings
- ✅ Provider satisfaction: >4.5/5
- ✅ Zero escalations

---

## Team Contacts & Escalation

**DevOps Team:** VPS deployment, bootstrap node
- Primary: DevOps Lead
- Escalation: Infrastructure Manager

**Backend Team:** Configuration update, service restart
- Primary: Backend Lead
- Escalation: CTO

**P2P Engineer:** Validation and provider discovery
- Primary: P2P Network Engineer (5978b3b2-af54-4650-8443-db0a105fc385)
- Available 24/7 during launch window

**QA Engineer:** Testing and readiness confirmation
- Primary: QA Lead
- Escalation: QA Manager

---

## Post-Launch Monitoring

### Hour-by-Hour (First 6 hours)
```
T+0h:  0-5 providers online
T+1h:  40+ providers online, phase 1 success
T+2h:  41-42 providers stable
T+3h:  20+ bookings, earnings flowing
T+4h:  99%+ uptime, all systems stable
T+6h:  42+ providers online, success confirmed
```

### Key Metrics Dashboard
```
Provider Status: 42/43 online (97.7%)
Uptime: >99.5%
Bookings: 100+ (24hr cumulative)
Earnings: $5000+ (24hr cumulative)
Errors: None critical
Satisfaction: >4.5/5
```

---

## References

- **DevOps:** DEVOPS-PHASE1-QUICKSTART.md
- **Backend:** PHASE-1-LAUNCH-CHECKLIST.md (Phase 2 section)
- **P2P:** PHASE-4-EXECUTION-PLAYBOOK.md
- **Provider:** PROVIDER-ONBOARDING-P2P-LAUNCH.md
- **Operations:** P2P-PHASE1-OPERATIONS.md
- **Troubleshooting:** P2P-TROUBLESHOOTING-RUNBOOK.md
- **Resources:** PHASE1-LAUNCH-RESOURCE-INDEX.md

---

**Phase 1 Launch Coordination: Ready to Execute**

All teams prepared. Timeline confirmed. Success criteria defined. 🚀

