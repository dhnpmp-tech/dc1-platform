# Phase 4 Execution Playbook — P2P Network Validation

**Owner:** P2P Network Engineer
**Duration:** 5 minutes
**Trigger:** Phase 3 completion (providers re-announce to DHT)
**Success Criteria:** Validation script exit code 0 + all critical checks pass

---

## Phase 4 Timeline

| Time | Action | Owner | Status |
|------|--------|-------|--------|
| T-30s | Monitor Phase 3 completion | P2P Engineer | Monitoring |
| T+0m | Validation script execution | P2P Engineer | Execute |
| T+2m | Parse results | P2P Engineer | Analyze |
| T+3m | Query database for provider status | P2P Engineer | Verify |
| T+4m | Post results to DCP-612 | P2P Engineer | Report |
| T+5m | Phase 4 complete | P2P Engineer | Done |

---

## Pre-Execution Checklist

Before Phase 3 completes, verify:

- [ ] Validation script updated and tested (commit 9f7a468)
- [ ] Database accessible
- [ ] Backend API reachable at https://api.dcp.sa
- [ ] Phase 4 execution environment ready
- [ ] DCP-612 comment space prepared

---

## Phase 4 Execution Steps

### Step 1: Run Validation Script (T+0m)

```bash
cd /home/node/dc1-platform
bash scripts/validate-p2p-setup.sh 2>&1 | tee /tmp/phase4-validation-$(date +%s).log
EXIT_CODE=$?
echo "Exit code: $EXIT_CODE"
```

**Expected Output:**
```
Tests run: 23+
  ✓ Passed: 16+
  ✗ Failed: 0
  ⚠ Warnings: 0-2 (environment variables)

✓ All P2P checks passed! Ready for Phase 1 launch.
```

**Success:** Exit code 0

### Step 2: Query Provider Status (T+2m)

```bash
sqlite3 /path/to/dcp.db << 'EOF'
.mode column
.headers on

-- Total providers
SELECT COUNT(*) as total_providers FROM providers;

-- Providers with peer IDs
SELECT COUNT(*) as with_peer_ids FROM providers WHERE p2p_peer_id IS NOT NULL;

-- Online providers
SELECT COUNT(*) as online_providers FROM providers
WHERE status='online' AND last_heartbeat > datetime('now', '-5 minutes');

-- Recent heartbeats
SELECT api_key, p2p_peer_id, status, last_heartbeat
FROM providers
WHERE p2p_peer_id IS NOT NULL
ORDER BY last_heartbeat DESC
LIMIT 5;
EOF
```

**Expected Results:**
- Total providers: 43 (all registered)
- With peer IDs: 43 (all have discovered bootstrap)
- Online providers: 40+ (majority online)
- Recent heartbeats: All recent (< 5 min old)

### Step 3: Verify Heartbeat Logs (T+3m)

```bash
sqlite3 /path/to/dcp.db << 'EOF'
.mode column
.headers on

-- Heartbeat activity in last 5 minutes
SELECT COUNT(*) as recent_heartbeats FROM heartbeat_log
WHERE received_at > datetime('now', '-5 minutes');

-- Providers by status
SELECT status, COUNT(*) as count FROM providers GROUP BY status;

-- Uptime calculation (last 24 hours)
SELECT api_key,
       COUNT(*) as heartbeat_count,
       ROUND(COUNT() / 2880.0 * 100, 1) as uptime_pct
FROM heartbeat_log
WHERE received_at > datetime('now', '-1 days')
GROUP BY api_key
ORDER BY uptime_pct DESC
LIMIT 5;
EOF
```

**Expected Results:**
- Recent heartbeats: 40+ in last 5 minutes
- Provider status: Majority "online"
- Uptime: > 90% for most providers

### Step 4: Check Backend Logs (T+3m-30s)

```bash
# Check for P2P errors
grep -i "p2p\|bootstrap\|dht\|peer" /var/log/dc1-provider-onboarding.log | tail -20

# Check for provider discovery events
grep "announceFromProviderHeartbeat\|DHT announce" /var/log/dc1-provider-onboarding.log | tail -10
```

**Expected:** No errors, successful DHT announcements

---

## Phase 4 Success Report

When all checks pass, post to DCP-612:

```markdown
## Phase 4 Complete — P2P Network Validation Successful ✅

**Timestamp:** [ISO-8601 timestamp]
**Duration:** 5 minutes (T+0m to T+5m)

### Validation Results

**Automated Tests (9 suites, 23 tests):**
- Exit code: 0 ✓
- Tests passed: 23/23 ✓
- Bootstrap node: Reachable at 76.13.179.86:4001 ✓
- Backend API: Responding at https://api.dcp.sa ✓
- Heartbeat endpoint: Operational ✓
- P2P infrastructure: All components present ✓

**Provider Status:**
- Total registered: 43 ✓
- With peer IDs: 43/43 (100%) ✓
- Online: 40+ (>90%) ✓
- Recent heartbeats: 40+ in last 5 min ✓

**Infrastructure Health:**
- Database: Operational ✓
- Backend: Responding ✓
- Provider discovery: Active ✓
- Uptime: > 90% for majority ✓

### Phase 1 Launch Status

🎉 **READY FOR PRODUCTION**

All P2P infrastructure validated and ready:
- Bootstrap node stable
- Provider discovery active
- Renters can discover providers
- Marketplace ready for bookings

### Critical Metrics

- Bootstrap peer ID: 12D3KooW[...]
- DHT prefix: /dc1/provider/
- Heartbeat interval: 30 seconds
- Stale detection: 90 seconds
- Provider online: 40+/43 (93%)

### Next Steps

1. Enable marketplace ordering (Phase 5)
2. Monitor provider stability (ongoing)
3. Scale to additional regions (Phase 6)
4. Activate premium features (Phase 7)

---

**P2P Network Engineer: Phase 1 launch complete. Infrastructure stable and ready for production.**
```

---

## Phase 4 Failure Handling

If validation fails, follow this procedure:

### Failure: Bootstrap Node Unreachable

```bash
# Check if bootstrap is running
pm2 status | grep dc1-p2p-bootstrap

# Check bootstrap logs
pm2 logs dc1-p2p-bootstrap | tail -50

# If not running, escalate to DevOps
echo "Bootstrap node not running. Escalating to DevOps."
# Post to DCP-612: Phase 1 blocker detected
```

### Failure: Backend API Not Responding

```bash
# Check backend status
pm2 status | grep dc1-provider-onboarding

# Check backend logs
pm2 logs dc1-provider-onboarding | tail -50

# If errors, escalate to Backend team
echo "Backend API errors detected. Escalating to Backend."
# Post to DCP-612: Phase 2 blocker detected
```

### Failure: Providers Not Online

```bash
# Query provider heartbeat status
sqlite3 /path/to/dcp.db "
SELECT COUNT(*) as online FROM providers
WHERE status='online' AND last_heartbeat > datetime('now', '-5 minutes');
"

# If count < 30, providers not discovering
# Escalate: Post to DCP-612 with provider status query results
echo "Providers not coming online. Escalating to Backend."
```

---

## Edge Cases and Recovery

### Edge Case 1: Partial Provider Online Status

**Symptom:** 20-40 providers online (not 40+)

**Recovery:**
1. Wait 30 more seconds (one heartbeat cycle)
2. Re-run validation
3. If still low, check backend restart logs
4. Escalate if unresolved

### Edge Case 2: Bootstrap Connectivity Timeout

**Symptom:** Validation times out on bootstrap check

**Recovery:**
1. Check VPS firewall (port 4001)
2. Verify TCP connectivity: `nc -zv 76.13.179.86 4001`
3. Check bootstrap logs on VPS
4. Restart bootstrap if needed

### Edge Case 3: Database Query Fails

**Symptom:** SQLite errors during provider status check

**Recovery:**
1. Check database file permissions
2. Verify database is not corrupted: `sqlite3 /path/to/dcp.db "PRAGMA integrity_check;"`
3. If corrupted, restore from backup
4. Escalate to DevOps

---

## Monitoring and Alerts

**Continuous Monitoring (Post-Phase 4):**

```bash
# Monitor provider status every 60 seconds
while true; do
  ONLINE=$(sqlite3 /path/to/dcp.db \
    "SELECT COUNT(*) FROM providers WHERE status='online' AND last_heartbeat > datetime('now', '-5 minutes');")
  echo "$(date): Online providers: $ONLINE/43"

  if [ "$ONLINE" -lt 30 ]; then
    echo "WARNING: Provider count dropped below 30"
    # Alert ops team
  fi

  sleep 60
done
```

---

## Success Metrics (Post-Phase 4)

Once Phase 4 completes successfully:

✅ Bootstrap node stable and accessible
✅ 40+ providers online and discoverable
✅ Provider-to-provider P2P connections active
✅ DHT routing functional
✅ Renter discovery capability verified
✅ All validation tests passing
✅ No P2P errors in logs
✅ Heartbeat cadence regular (30 sec intervals)

**Phase 1 Launch Status: PRODUCTION READY** 🎉

---

## References

- docs/PHASE-1-LAUNCH-CHECKLIST.md — Overall launch sequence
- docs/P2P-TROUBLESHOOTING-RUNBOOK.md — Issue diagnosis
- scripts/validate-p2p-setup.sh — Automated validation
- backend/src/routes/providers.js:562 — Heartbeat endpoint
- p2p/heartbeat-protocol.js — Heartbeat protocol spec

