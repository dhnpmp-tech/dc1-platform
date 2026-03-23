# Phase 1 Bootstrap Deployment & Provider Discovery Activation

**Date:** 2026-03-23
**Status:** Ready for Execution
**Owner:** P2P Network Engineer (Agent 5978b3b2-af54-4650-8443-db0a105fc385)
**Coordination Task:** DCP-612

---

## Overview

This document describes the 4-phase deployment sequence to activate P2P provider discovery and unblock the 0-online-providers critical alert.

**Current Status:**
- ✅ All P2P components verified and production-ready
- ✅ Validation script tested and working
- ✅ Troubleshooting runbooks complete
- ⏳ Bootstrap node deployment awaiting DevOps execution
- ⏳ Configuration update awaiting Backend execution
- ⏳ Final validation awaiting Phase 1-2 completion

---

## Phase 1: VPS Bootstrap Node Deployment

**Owner:** DevOps Team
**Timeline:** T-30 minutes before Phase 1 launch
**Duration:** 5-10 minutes
**Blocker for:** Phase 2 (needs actual peer ID)

### Steps

```bash
# SSH to VPS
ssh root@76.13.179.86

# Navigate to repo
cd /home/node/dc1-platform

# Start bootstrap node via PM2
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
pm2 save
pm2 startup

# Verify bootstrap is running
pm2 status | grep dc1-p2p-bootstrap
# Expected: online

# Capture peer ID from logs (CRITICAL — share with Backend team)
pm2 logs dc1-p2p-bootstrap | grep "Peer ID"
# Expected output: [Bootstrap] Peer ID: 12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh
```

### Success Criteria

- [ ] Bootstrap node running (pm2 status shows `online`)
- [ ] Peer ID captured from logs
- [ ] Peer ID shared with Backend team (via comment in DCP-612)

### Troubleshooting

**Bootstrap won't start:**
```bash
# Check if port 4001 is in use
lsof -i :4001
# Kill if needed: kill -9 <PID>

# Check Node.js version
node --version  # Should be 18.x or higher

# Check dependencies
cd /home/node/dc1-platform/p2p
npm list
```

**PM2 issues:**
```bash
# Reset PM2
pm2 kill
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap
```

---

## Phase 2: Configuration Update

**Owner:** Backend Team
**Timeline:** T-20 minutes before Phase 1 launch (after Phase 1 peer ID captured)
**Duration:** 5 minutes
**Blocker for:** Phase 3 (providers need correct bootstrap address)

### Steps

**File:** `p2p/dc1-node.js` line 47

Replace the placeholder with the actual peer ID from Phase 1:

```javascript
// OLD (line 47):
const bootstrapNode = '/ip4/76.13.179.86/tcp/4001/p2p/REPLACE_WITH_BOOTSTRAP_PEER_ID'

// NEW (after Phase 1, use actual peer ID):
const bootstrapNode = '/ip4/76.13.179.86/tcp/4001/p2p/12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh'
```

Then:

```bash
# Commit and push
git commit -am "config(p2p): update bootstrap peer ID for Phase 1 launch"
git push origin main

# Restart backend service
pm2 restart dc1-provider-onboarding
pm2 save

# Verify restart
pm2 status | grep dc1-provider-onboarding
# Expected: online
```

### Success Criteria

- [ ] Configuration file updated with actual peer ID
- [ ] Changes committed to main branch
- [ ] Backend service restarted successfully
- [ ] Backend logs show no P2P errors

### Troubleshooting

**Configuration update fails:**
```bash
# Check for syntax errors in p2p/dc1-node.js
node -c p2p/dc1-node.js

# Check git status
git status
git diff p2p/dc1-node.js
```

**Backend won't restart:**
```bash
# Check PM2 logs
pm2 logs dc1-provider-onboarding

# Manual restart with verbose output
pm2 delete dc1-provider-onboarding
pm2 start backend/src/index.js --name dc1-provider-onboarding
```

---

## Phase 3: Provider Discovery Activation

**Owner:** Automatic (no manual action)
**Timeline:** Immediate after Phase 2 completes
**Duration:** 30 seconds
**Result:** Providers re-announce to DHT

### What Happens

When the backend restarts with the correct bootstrap peer ID:

1. Backend P2P discovery service initializes
2. Existing provider heartbeats trigger re-announcement to DHT
3. New provider registrations automatically announce
4. Provider status updates: `pending` → `online`

### Monitoring

Watch for P2P logs during this phase:

```bash
# Real-time backend logs
tail -f /var/log/dcp-backend.log | grep -i "p2p\|bootstrap\|announce"

# Expected patterns:
# [p2p-discovery] Bootstrapping into DHT...
# [p2p-discovery] DHT initialized
# [p2p-discovery] heartbeat announce enqueued for peer...
# [p2p-discovery] Provider spec published to DHT
```

### Success Criteria

- [ ] Backend logs show successful DHT bootstrap
- [ ] Provider heartbeat announcements begin flowing
- [ ] Database shows providers with `p2p_peer_id` (non-NULL)
- [ ] Provider count shows providers with recent heartbeats

---

## Phase 4: Validation & Production Confirmation

**Owner:** P2P Network Engineer
**Timeline:** T+5 minutes after Phase 2 complete
**Duration:** 5 minutes

### Validation Script

```bash
# Run comprehensive P2P validation
bash scripts/validate-p2p-setup.sh \
  --bootstrap-addr "/ip4/76.13.179.86/tcp/4001/p2p/12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh" \
  --api-base "https://api.dcp.sa" \
  --db-path "backend/data/dc1.db"

# Expected output:
# ✓ Bootstrap node reachable
# ✓ Backend API responding
# ✓ Heartbeat endpoint is operational
# ✓ Database has p2p_peer_id column
# ✓ Found X online providers (< 5min heartbeat)
# ✓ All critical checks passed! Ready for Phase 1 launch.
```

### Manual Verification Queries

```sql
-- Check provider online count
SELECT COUNT(*) as online_count
FROM providers
WHERE status = 'online'
AND last_heartbeat > datetime('now', '-5 minutes');
-- Expected: > 0

-- Check peer ID coverage
SELECT COUNT(*) as with_peer_id
FROM providers
WHERE p2p_peer_id IS NOT NULL;
-- Expected: > 0

-- Check heartbeat freshness
SELECT AVG(CAST((julianday('now') - julianday(last_heartbeat)) * 86400 AS REAL)) as latency_sec
FROM providers
WHERE last_heartbeat IS NOT NULL;
-- Expected: < 30 seconds
```

### Success Criteria

- [ ] Validation script passes (exit code 0)
- [ ] > 0 providers showing as online
- [ ] All providers have peer IDs
- [ ] No P2P errors in logs
- [ ] Bootstrap connectivity confirmed

### Failure Response

If validation fails, **do not proceed to Phase 1 launch.** Instead:

1. Review output from validation script
2. Consult `docs/P2P-TROUBLESHOOTING-RUNBOOK.md` (12 categories)
3. Post blocker comment in DCP-612 with:
   - Specific error message
   - Diagnostic output
   - Recommended fix
   - Escalation path (P2P Engineer → Backend → DevOps)

---

## Execution Timeline

| Phase | Owner | Start | Duration | Blocker |
|-------|-------|-------|----------|---------|
| 1. Bootstrap Deploy | DevOps | T-30m | 5-10m | None |
| 2. Config Update | Backend | T-20m | 5m | Phase 1 peer ID |
| 3. Auto-Activation | System | T-15m | 1m | Phase 2 restart |
| 4. Validation | P2P Eng | T-10m | 5m | Phase 3 complete |
| **Total** | **Team** | **T-30m** | **~20m** | **None** |

**Launch ready:** T+0 (immediately after Phase 4 passes)

---

## Rollback (If Needed)

If Phase 1 encounters critical issues:

```bash
# Stop bootstrap node
ssh root@76.13.179.86
pm2 stop dc1-p2p-bootstrap

# Disable P2P in backend temporarily
export P2P_DISCOVERY_ENABLED=false
pm2 restart dc1-provider-onboarding

# Note: Providers will still accept heartbeats, but won't be discoverable via DHT
# Fall back to HTTP API-based discovery
```

To restore:

```bash
# Restart bootstrap
pm2 restart dc1-p2p-bootstrap

# Re-enable P2P
export P2P_DISCOVERY_ENABLED=true
pm2 restart dc1-provider-onboarding

# Providers re-announce within 30 seconds
```

---

## Coordination Notes

- **DevOps:** Once Phase 1 completes, post peer ID as comment in DCP-612
- **Backend:** Wait for Phase 1 peer ID before starting Phase 2
- **P2P Engineer:** Monitor Phase 3-4, post validation results to DCP-612
- **All:** Use `docs/P2P-TROUBLESHOOTING-RUNBOOK.md` for any issues

## References

- **Bootstrap Deployment:** `docs/P2P-BOOTSTRAP-DEPLOYMENT.md`
- **Operator Config:** `docs/P2P-OPERATOR-CONFIG-GUIDE.md`
- **Troubleshooting:** `docs/P2P-TROUBLESHOOTING-RUNBOOK.md`
- **E2E Test Support:** `docs/P2P-E2E-SMOKE-TEST-GUIDE.md`
- **Critical Alert:** `docs/reports/P2P-CRITICAL-ALERT-2026-03-23.md`
- **Phase 1 Status:** `docs/P2P-STATUS-PHASE-1.md`

---

*Created: 2026-03-23 11:35 UTC*
*P2P Network Engineer: Agent 5978b3b2-af54-4650-8443-db0a105fc385*
