# P2P Network Engineer — Phase 1 Pre-Flight Checklist

**Scheduled Execution:** 2026-03-25 23:00 UTC (T-1 hour before Phase 1 launch)
**Objective:** Verify all HTTP provider discovery systems ready for Phase 1 testing launch
**Owner:** P2P Network Engineer (5978b3b2-af54-4650-8443-db0a105fc385)
**Parent Task:** DCP-852 (Decision point) / DCP-612 (S26 P2P network)

---

## Pre-Execution Setup (22:50-23:00 UTC)

**Estimated duration: 10 minutes**

### 1. Environment Verification
- [ ] SSH to VPS: `ssh root@76.13.179.86`
- [ ] Check PM2 services: `pm2 list`
- [ ] Verify backend is running: `pm2 status dc1-provider-onboarding`
- [ ] Check backend port: `curl http://localhost:8083/api/health`
- [ ] Confirm no recent restarts: `pm2 logs dc1-provider-onboarding --lines 20`

### 2. Database Health Check
- [ ] Verify PostgreSQL is running: `sudo systemctl status postgresql`
- [ ] Check database connections: `psql -U dc1 -d dc1_platform -c "SELECT count(*) FROM pg_stat_activity;"`
- [ ] Confirm provider table exists: `psql -U dc1 -d dc1_platform -c "SELECT count(*) FROM providers;"`
- [ ] Check for database errors in backend logs: `pm2 logs dc1-provider-onboarding | grep -i error`

### 3. File System Verification
- [ ] Confirm p2p/dc1-node.js exists: `test -f p2p/dc1-node.js && echo OK || echo MISSING`
- [ ] Verify bootstrap placeholder still in place (no accidental deployment): `grep -n "REPLACE_WITH_BOOTSTRAP_PEER_ID" p2p/dc1-node.js`
- [ ] Confirm HTTP discovery routes present: `grep -n "network/discovery" backend/src/routes/network.js`

---

## HTTP Provider Discovery Verification (23:00-23:08 UTC)

**Estimated duration: 8 minutes**

### Check 1: Provider Discovery Endpoint Status
```bash
# Test discovery endpoint
curl -X GET http://api.dcp.sa/api/network/discovery

# Expected response: JSON array of providers (may be empty or partially populated)
# Success: HTTP 200 OK
# Failure: HTTP 5xx or timeout
```
- [ ] Endpoint responds (HTTP 200): ________
- [ ] Response is valid JSON: ________
- [ ] Response time < 2 seconds: ________
- [ ] No database errors in logs: ________

### Check 2: Provider Heartbeat System
```bash
# Check if providers have recent heartbeats
curl -X GET http://api.dcp.sa/api/providers/status?limit=5

# Expected: List of 0-43 providers with heartbeat timestamps
```
- [ ] Endpoint responds (HTTP 200): ________
- [ ] Returns provider list: ________
- [ ] Has "lastHeartbeat" timestamps: ________
- [ ] Most recent heartbeat < 5 min old: ________

### Check 3: Model Catalog Endpoints
```bash
# Verify model catalog is accessible
curl -X GET http://api.dcp.sa/api/models | grep -o '"id"' | wc -l

# Expected: >= 11 models available
```
- [ ] /api/models responds: ________
- [ ] Returns >= 11 models: ________
- [ ] All models have valid IDs: ________
- [ ] Response time < 1 second: ________

### Check 4: Backend Database Connections
```bash
# Check connection pool status
curl -X GET http://api.dcp.sa/api/admin/health

# Expected: Database connection count < connection pool max (usually 20-50)
```
- [ ] Health endpoint accessible: ________
- [ ] DB connections < pool max: ________
- [ ] No connection exhaustion: ________
- [ ] No recent reconnect loops in logs: ________

### Check 5: Recent System Activity
```bash
# Check for any errors or anomalies in the last hour
pm2 logs dc1-provider-onboarding --lines 50 | tail -20
```
- [ ] No critical errors: ________
- [ ] No connection timeouts: ________
- [ ] No database lock warnings: ________
- [ ] No unhandled promise rejections: ________

---

## Performance Baseline Capture (23:08-23:10 UTC)

**Estimated duration: 2 minutes**

Capture baseline metrics for comparison during Phase 1:

```bash
# HTTP discovery latency baseline
time curl -X GET http://api.dcp.sa/api/network/discovery > /tmp/baseline-discovery.json

# Provider count baseline
curl -X GET http://api.dcp.sa/api/providers/status | grep -o '"peerId"' | wc -l > /tmp/baseline-provider-count.txt

# Backend response time for model catalog
time curl -X GET http://api.dcp.sa/api/models > /tmp/baseline-models.json

# Database query performance
time psql -U dc1 -d dc1_platform -c "SELECT count(*) FROM providers;" > /tmp/baseline-db.txt
```

- [ ] Baseline discovery latency: ________ ms
- [ ] Baseline provider count: ________ providers
- [ ] Baseline models latency: ________ ms
- [ ] Baseline DB query latency: ________ ms

---

## Readiness Decision (23:10 UTC)

### Go/No-Go Criteria

**GO Criteria (all must pass):**
- [ ] API endpoints responding (HTTP 200)
- [ ] Database connections stable
- [ ] Provider discovery working
- [ ] Model catalog accessible
- [ ] No critical errors in logs
- [ ] All systems responding < 2 sec

**NO-GO Criteria (any triggers escalation):**
- [ ] API timeouts or 5xx errors
- [ ] Database connection pool exhausted
- [ ] Provider table empty or unreachable
- [ ] Model catalog returning 0 models
- [ ] Multiple errors in recent logs
- [ ] Performance significantly degraded

### Decision

Based on checks above:

**PREFLIGHT RESULT:** 🟢 **GO** / 🔴 **NO-GO**

**Summary:**
- HTTP discovery: ✅ / ❌
- Database: ✅ / ❌
- Models: ✅ / ❌
- Performance: ✅ / ❌
- Overall: ✅ / ❌

---

## Escalation Procedures (if NO-GO)

**If any NO-GO criteria triggered:**

1. **Immediate:** Post comment to DCP-852 with failure details
2. **Analysis (2-5 min):**
   - Check recent commits with `git log --oneline -5`
   - Review PM2 logs for service crashes: `pm2 logs dc1-provider-onboarding`
   - Check database status: `sudo systemctl status postgresql`
3. **Escalation:**
   - If restarting service fixes it: restart and retest
   - If database issue: escalate to DevOps
   - If code issue: escalate to Backend Architect
   - If blocker: escalate to CEO with detailed logs

---

## Phase 1 Ready Confirmation (23:10-23:15 UTC)

Once pre-flight checklist complete, post to DCP-852:

```markdown
## P2P Network Engineer Pre-Flight Checklist Complete (23:XX UTC)

✅ **Phase 1 Pre-Flight Status: GO/NO-GO**

### Verification Results
- HTTP Discovery Endpoint: [working/issues]
- Provider Heartbeat System: [working/issues]
- Model Catalog Access: [working/issues]
- Backend Database: [working/issues]
- Recent System Activity: [clean/errors]

### Performance Baseline
- Discovery latency: XXX ms
- Provider count: XX
- Models catalog: XX entries
- DB query time: XXX ms

### Readiness for Launch
- T-1h: ✅ All systems nominal
- T+0 (08:00 UTC): Ready for Phase 1 testing launch
- Discovery method: HTTP polling (30s intervals)
- Provider activation expected: 4-6 hours

**PHASE 1 PROVIDER DISCOVERY: READY FOR LAUNCH**
```

---

## Phase 1 Monitoring Activation (23:15 UTC onwards)

Once pre-flight complete and GO decision posted:

**Monitoring Tasks (23:15 UTC - 08:00 UTC next day):**
- [ ] Monitor provider heartbeats (should start increasing as Day 1 progresses)
- [ ] Watch HTTP discovery latency (should stay < 2 sec)
- [ ] Check for any discovery-related errors
- [ ] Be ready for escalation if providers slow to activate

**Phase 1 Launch (08:00 UTC 2026-03-26):**
- [ ] Available for real-time support during first hour
- [ ] Monitor provider activation timeline (expect first arrivals by 10:00-12:00 UTC)
- [ ] Escalate any discovery failures immediately
- [ ] Track how long until first 10 providers activate

---

## Notes & References

**Related Issues:**
- DCP-852: T-6h decision point (decision executed, Path B activated)
- DCP-612: S26 P2P network (blocked, contingency mode)

**Documentation:**
- HTTP Fallback: backend/src/routes/network.js
- Provider Heartbeat: backend/src/services/provider-heartbeat.js
- Discovery Implementation: backend/src/routes/network.js

**Decision Context:**
- Bootstrap peer ID: NOT deployed (placeholder in p2p/dc1-node.js:47)
- Discovery method: HTTP polling (30s intervals)
- Provider activation: 4-6 hours expected
- Phase 1 launch: ON SCHEDULE (2026-03-26 08:00 UTC)

---

**Checklist Owner:** P2P Network Engineer
**Execution Time:** 2026-03-25 23:00 UTC
**Duration:** ~15 minutes
**Next Action:** Post pre-flight results to DCP-852 by 23:15 UTC
