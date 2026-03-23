# Phase 1 Launch Quick Reference — All Roles

**Date:** 2026-03-23
**Purpose:** One-page reference for Phase 1 launch execution
**Print:** Yes - recommend printing for all team members
**URL:** Keep for copy-paste commands

---

## Phase 1 Timeline (April 2026)

```
Phase 1: Bootstrap (DevOps)        — 5-10 min
  └─ Deploy P2P bootstrap node to VPS

Phase 2: Configuration (Backend)   — 5 min
  └─ Inject bootstrap peer ID, restart backend

Phase 3: Discovery (Auto)          — 30 sec
  └─ Providers announce to DHT

Phase 4: Validation (QA)           — 5-10 min
  └─ Test job submission and execution

TOTAL LAUNCH: ~25 minutes
```

---

## By Role

### 🖥️ DevOps

**Objective:** Deploy P2P bootstrap node

**Commands:**
```bash
ssh root@76.13.179.86
cd /home/node/dc1-platform
npm install --prefix p2p && \
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
pm2 save && pm2 startup
```

**Capture peer ID:**
```bash
PEER_ID=$(pm2 logs dc1-p2p-bootstrap --lines 50 | grep -o '12D3Koo[A-Za-z0-9]*' | head -1)
echo "Peer ID: $PEER_ID"
```

**Post to DCP-612:** Include full peer ID string (format: `12D3Koo...`)

**Monitor:** `pm2 status | grep dc1-p2p-bootstrap`

**Reference:** `/docs/DEVOPS-PHASE1-QUICKSTART.md`

---

### 🔧 Backend Engineer

**Objective:** Configure backend with bootstrap peer ID

**File to edit:** `p2p/dc1-node.js` line 47

**Before:**
```javascript
const bootstrapNode = '/ip4/76.13.179.86/tcp/4001/p2p/REPLACE_WITH_BOOTSTRAP_PEER_ID'
```

**After:**
```javascript
const bootstrapNode = '/ip4/76.13.179.86/tcp/4001/p2p/12D3KooWXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
```

**Commands:**
```bash
# Commit and push
git add p2p/dc1-node.js
git commit -m "config(p2p): bootstrap peer ID for Phase 1"
git push origin main

# Restart backend
ssh root@76.13.179.86 'pm2 restart dc1-provider-onboarding'

# Verify in logs
ssh root@76.13.179.86 'pm2 logs dc1-provider-onboarding --lines 20'
```

**Success criteria:**
- [ ] Peer ID injected correctly (no placeholder remaining)
- [ ] Syntax valid: `node -c p2p/dc1-node.js`
- [ ] Backend restarted successfully
- [ ] Logs show "Connected to bootstrap"

**Reference:** `/docs/PHASE-1-LAUNCH-CHECKLIST.md` (Phase 2 section)

---

### 📡 P2P Network Engineer

**Objective:** Monitor provider discovery and DHT announcements

**Monitor commands:**
```bash
# Check provider status
ssh root@76.13.179.86 << 'EOF'
sqlite3 /home/node/dc1-platform/backend/data/providers.db \
  "SELECT status, COUNT(*) FROM providers GROUP BY status;"
EOF

# Watch backend logs
ssh root@76.13.179.86 'pm2 logs dc1-provider-onboarding --follow | grep -i "announce\|peer"'
```

**Success criteria:**
- [ ] Provider count > 0
- [ ] Providers showing "online" status
- [ ] Backend logs show DHT announcements

**Reference:** `/docs/PHASE-1-DEPLOYMENT-SEQUENCE.md`

---

### 🧪 QA Engineer

**Objective:** Validate provider job acceptance and execution

**Test procedure:**
```bash
# 1. Submit test job
curl -X POST https://api.dcp.sa/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "model": "test",
    "prompt": "Say hello",
    "maxTokens": 10
  }'

# 2. Check job status
curl https://api.dcp.sa/api/jobs/{job-id}

# 3. Monitor backend logs
ssh root@76.13.179.86 'pm2 logs dc1-provider-onboarding --follow | grep -i "job"'
```

**Success criteria:**
- [ ] Test jobs submitted successfully
- [ ] Provider accepts job assignment
- [ ] Job execution begins
- [ ] Job completion detected
- [ ] No backend errors during testing
- [ ] All results validated

**Reference:** `/docs/SPRINT-26-TEST-EXECUTION-HANDBOOK.md`

---

### 👥 Provider Operator

**Objective:** Get provider ready and monitor Phase 1

**Pre-Phase 1:**
```bash
# Update daemon
pip install --upgrade dcp-provider-daemon

# Enable P2P discovery
export P2P_DISCOVERY_ENABLED=true

# Start daemon
python provider_daemon.py
```

**During Phase 1:**
```bash
# Monitor heartbeats
tail -f provider_daemon.log | grep -i "heartbeat\|p2p"

# Check status on DCP
curl https://api.dcp.sa/api/providers/YOUR_ID

# Monitor for test jobs
tail -f provider_daemon.log | grep -i "job\|assign"
```

**Success criteria:**
- [ ] Provider status shows "online"
- [ ] Heartbeats sending every 30 seconds
- [ ] Test jobs accepted and executed
- [ ] Job completion logged

**Reference:** `/docs/PROVIDER-INTEGRATION-GUIDE.md`

---

### 📋 CEO/Project Manager

**Objective:** Coordinate all teams and make go/no-go decision

**Pre-Phase 1 checklist:**
- [ ] Bootstrap node prepared (DevOps)
- [ ] Backend config ready (Backend)
- [ ] Providers updated and ready (Provider)
- [ ] QA test plan ready (QA)
- [ ] All documentation reviewed
- [ ] Emergency procedures documented

**On Phase 1 day:**
- [ ] Monitor timeline (25 minutes total)
- [ ] Escalate any blockers
- [ ] Get daily reports from each team
- [ ] Make launch go/no-go decision

**Success = "Phase 1 Complete"**
- ✅ Providers discovered and online
- ✅ Test jobs submitted and completed
- ✅ All systems healthy
- ✅ Ready for Phase 2

**Reference:** `/docs/PHASE-1-DEPLOYMENT-SEQUENCE.md`

---

## Critical Path Decision Tree

```
START: Phase 1 Bootstrap Deployment

├─ STEP 1: DevOps deploys bootstrap (5-10 min)
│  ├─ Success: Peer ID captured → Continue
│  └─ Fail: Retry with troubleshooting → Contact DevOps Lead
│
├─ STEP 2: Backend injects peer ID (5 min)
│  ├─ Success: Backend restarted → Continue
│  └─ Fail: Syntax error? → Contact Backend Lead
│
├─ STEP 3: Providers discover (30 sec auto)
│  ├─ Success: Provider count > 0 → Continue
│  └─ Fail: Check provider connectivity → Contact P2P Lead
│
└─ STEP 4: QA validates jobs (5-10 min)
   ├─ Success: Jobs complete → Phase 1 COMPLETE ✅
   └─ Fail: Debug job execution → Contact QA Lead
```

---

## Emergency Contacts

| Role | Name | Contact | Slack |
|------|------|---------|-------|
| DevOps Lead | - | devops-oncall | #devops |
| Backend Lead | - | backend-oncall | #backend |
| P2P Lead | - | p2p-oncall | #p2p |
| QA Lead | - | qa-oncall | #qa |
| CEO | - | ceo-office | #leadership |

---

## Key Endpoints & IPs

| Service | URL | IP |
|---------|-----|----|
| DCP Backend | https://api.dcp.sa | 76.13.179.86:8083 |
| P2P Bootstrap | 76.13.179.86:4001 | 76.13.179.86 |
| VPS SSH | - | 76.13.179.86:22 |

---

## Troubleshooting Quick Links

| Issue | Reference |
|-------|-----------|
| Bootstrap won't start | `/docs/DEVOPS-PHASE1-QUICKSTART.md` |
| Backend won't restart | `/docs/PHASE-1-LAUNCH-CHECKLIST.md` |
| Providers not discovered | `/docs/PHASE-1-DEPLOYMENT-SEQUENCE.md` |
| Jobs fail to execute | `/docs/SPRINT-26-TEST-EXECUTION-HANDBOOK.md` |
| Provider issues | `/docs/PROVIDER-INTEGRATION-GUIDE.md` |
| Any issue | `/docs/P2P-TROUBLESHOOTING-RUNBOOK.md` |

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Bootstrap uptime | 100% | TBD |
| Provider discovery time | < 30 sec | TBD |
| Job submission success | > 95% | TBD |
| Job execution success | > 95% | TBD |
| System resource usage | < 80% | TBD |

---

## Go/No-Go Checklist (Final)

**Before Phase 1 starts, verify:**

- [ ] DevOps: Bootstrap ready, documentation complete
- [ ] Backend: Config injection procedure tested
- [ ] P2P Eng: Monitoring scripts ready
- [ ] QA: Test plan finalized, jobs prepared
- [ ] Providers: Daemon updated, P2P enabled
- [ ] CEO: All teams aligned, timeline approved
- [ ] Communication: All teams have contacts
- [ ] Escalation: Emergency procedures documented

**Phase 1 Start:** ✅ All checkboxes done → PROCEED

**Phase 1 Blocker:** ❌ Any checkbox incomplete → DELAY

---

## Post-Phase 1

**Within 5 minutes of Phase 1 completion:**
- [ ] Report success to CEO
- [ ] Document any issues
- [ ] Plan Phase 2 schedule
- [ ] Begin provider onboarding

---

**Status:** Ready for Phase 1 Launch
**Last Updated:** 2026-03-23
**Print & Distribute:** YES

---
