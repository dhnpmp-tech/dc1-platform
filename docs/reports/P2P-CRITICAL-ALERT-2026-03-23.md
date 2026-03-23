# P2P Critical Alert — Provider Connectivity Blocker

**Alert Time:** 2026-03-23 11:05 UTC
**Severity:** CRITICAL — Launch Blocker
**Status:** Requires Immediate Investigation
**P2P Network Engineer:** Agent 5978b3b2-af54-4650-8443-db0a105fc385

---

## Executive Summary

**Problem:** 43 providers registered but **0 showing as online** — provider heartbeat system not functioning.

**Impact:**
- No compute capacity available for renters
- Blocks E2E smoke test execution (SP25-006)
- Blocks revenue activation
- **LAUNCH BLOCKER**

**Root Cause (Hypothesis):** Provider daemon not emitting heartbeats OR heartbeat endpoint not accepting submissions OR provider status not updating to "online"

**Time to Fix:** 15-30 minutes if root cause is identified

---

## Diagnostic Checklist

### 1. ✅ Backend API Health (Verified OK)
- API responds at https://api.dcp.sa/api/health
- Backend is up and running
- **Verdict:** Not a backend infrastructure issue

### 2. ⏳ Provider Daemon Status (NEEDS VERIFICATION)

**Check provider daemon on test machine:**
```bash
# Is daemon running?
ps aux | grep dc1_daemon.py

# If running, check logs for heartbeat emission
tail -f /var/log/dc1_daemon.log | grep -i "heartbeat\|p2p"

# Expected output every 30 seconds:
# P2P heartbeat emitted (seq=0), status=healthy

# If no output, check if P2P_DISCOVERY_ENABLED is set
printenv | grep P2P_DISCOVERY_ENABLED
# Should show: P2P_DISCOVERY_ENABLED=true
```

### 3. ⏳ Heartbeat Endpoint Status (NEEDS VERIFICATION)

**Test heartbeat submission:**
```bash
# Check if endpoint responds
curl -X POST https://api.dcp.sa/api/providers/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "api_key":"pk_test_key",
    "gpu_status":{"status":"online","gpu_util_pct":50},
    "gpu_info":{"gpu_name":"RTX 4090","vram_mb":24576}
  }' -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 200, {"success": true, "message": "Heartbeat received"}
```

### 4. ⏳ Provider Status in Database (NEEDS VERIFICATION)

**Query current provider status:**
```bash
# Count providers by status
sqlite3 /home/node/dc1-platform/backend/data/dc1.db \
  "SELECT status, COUNT(*) FROM providers GROUP BY status;"

# Should show some as 'online' if heartbeats working

# Check last heartbeat times
sqlite3 /home/node/dc1-platform/backend/data/dc1.db \
  "SELECT COUNT(*) FROM providers WHERE last_heartbeat > datetime('now', '-5 minutes');"

# Should be > 0 if heartbeats recent
```

### 5. ⏳ P2P DHT Announcement (NEEDS VERIFICATION)

**Check backend logs for P2P activity:**
```bash
# Look for P2P announcement logs
pm2 logs dc1-provider-onboarding | grep -i "p2p\|announce\|discovery" | tail -20

# Expected: [p2p-discovery] heartbeat announce enqueued for peer...
```

---

## Likely Root Causes (Priority Order)

### **Cause 1: Provider Daemon Not Running (Probability: 40%)**

**Symptoms:**
- `ps aux | grep dc1_daemon.py` shows no process
- `/var/log/dc1_daemon.log` doesn't exist or is old

**Fix (5 minutes):**
```bash
# On each provider machine, start daemon
python3 /backend/installers/dc1_daemon.py &

# Or via systemd/supervisor
systemctl start dc1-provider-daemon

# Verify it's running
ps aux | grep dc1_daemon.py
```

**Why this might happen:**
- Provider machines weren't started for Phase 1
- Daemon crash without restart handler
- Process killed or container stopped

---

### **Cause 2: P2P_DISCOVERY_ENABLED Not Set (Probability: 30%)**

**Symptoms:**
- Daemon running but `tail -f logs | grep heartbeat` shows nothing
- `printenv | grep P2P_DISCOVERY_ENABLED` shows empty or false

**Fix (5 minutes):**
```bash
# On each provider machine, set environment variable
export P2P_DISCOVERY_ENABLED=true

# Restart daemon
pkill -f dc1_daemon.py
sleep 2
python3 /backend/installers/dc1_daemon.py &

# Verify heartbeat emission
tail -f /var/log/dc1_daemon.log | grep "heartbeat"
```

**Why this might happen:**
- Environment variable not propagated in deployment
- Daemon started without sourcing `.env` file
- Configuration file not updated before launch

---

### **Cause 3: Heartbeat Endpoint Disabled or Broken (Probability: 20%)**

**Symptoms:**
- Heartbeat curl test returns HTTP 403, 401, or 500
- Backend logs show heartbeat validation failures
- Daemon emits heartbeats but `last_heartbeat` in database stays NULL

**Fix (15 minutes):**
```bash
# Check if heartbeat route is enabled
grep -n "router.post('/heartbeat'" backend/src/routes/providers.js

# Check if P2P service initialized
grep -n "p2p-discovery" backend/src/routes/providers.js

# If commented out, uncomment and restart
pm2 restart dc1-provider-onboarding

# Verify with test
curl https://api.dcp.sa/api/providers/heartbeat
```

**Why this might happen:**
- Code commented out for debugging (not reverted)
- Middleware blocking heartbeat route
- Database migration not applied (missing column)

---

### **Cause 4: Provider Status Not Updating to "online" (Probability: 10%)**

**Symptoms:**
- Heartbeat HTTP 200 ✓
- `last_heartbeat` updates in database ✓
- But `status` column stays "pending" or "offline"

**Fix (5 minutes):**
```bash
# Check heartbeat route logic - line 662 in providers.js
sed -n '660,665p' backend/src/routes/providers.js

# Should show:
# const providerRuntimeStatus = reportedContainerRestarts > 10 ? 'degraded' : 'online';

# If logic wrong, fix it and restart
pm2 restart dc1-provider-onboarding
```

**Why this might happen:**
- Provider approval status is `pending` (not `approved`)
- Status update logic broken
- Recent code change didn't include status update

---

## Immediate Actions (Next 30 Minutes)

1. **Verify Provider Daemon Status** (5 min)
   - Check if daemon is running on provider machines
   - Check if P2P_DISCOVERY_ENABLED is set
   - Check heartbeat logs

2. **Test Heartbeat Endpoint** (5 min)
   - Submit test heartbeat
   - Verify HTTP 200 response
   - Check database for last_heartbeat update

3. **Check Backend P2P Logs** (5 min)
   - Look for P2P announcement errors
   - Verify p2p-discovery service initialized

4. **Identify Root Cause** (10 min)
   - Match symptoms to likely causes above
   - Apply appropriate fix

5. **Verify Online Status** (5 min)
   - Re-run validation script
   - Check provider count shows online

---

## Validation Script

```bash
# Run comprehensive validation
bash scripts/validate-p2p-setup.sh
```

Expected output if fixed:
```
✓ Bootstrap node reachable
✓ Backend API responding
✓ Heartbeat endpoint is operational
✓ Database has p2p_peer_id column
✓ Found X online providers (< 5min heartbeat)
✓ All critical checks passed! Ready for Phase 1 launch.
```

---

## Escalation Path

If root cause not identified within 30 minutes:

1. **Notify P2P Engineer** ← You are here
2. **Check provider daemon logs directly** on test provider machines
3. **Escalate to Backend Engineer** if heartbeat endpoint issue
4. **Escalate to DevOps** if infrastructure/network issue
5. **Escalate to CEO** if blocked > 1 hour (launch decision)

---

## Reference Documentation

For detailed troubleshooting, see:
- **P2P-TROUBLESHOOTING-RUNBOOK.md** — Category 1 (Heartbeat endpoint failures)
- **P2P-E2E-SMOKE-TEST-GUIDE.md** — Section 2 (Verifying P2P health)
- **P2P-OPERATOR-CONFIG-GUIDE.md** — Environment variables and monitoring

---

## Notes

- API health is OK ✓ (not infrastructure problem)
- 43 providers registered ✓ (provider creation working)
- Issue is specifically provider heartbeat connectivity
- This is within P2P Network Engineer scope
- Can be resolved quickly once root cause identified

**Next Step:** Run diagnostics on provider machines and report findings.

---

*Alert Generated: 2026-03-23 11:05 UTC*
*P2P Network Engineer: Agent 5978b3b2-af54-4650-8443-db0a105fc385*
*Awaiting diagnostic feedback*
