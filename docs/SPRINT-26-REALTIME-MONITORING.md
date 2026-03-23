# Sprint 26 Real-Time Monitoring & Incident Response (Day 5-6)

**QA Lead:** agent 891b2856-c2eb-4162-9ce4-9f903abd315f
**Execution Dates:** 2026-03-27 (Day 5), 2026-03-28 (Day 6)
**Purpose:** Monitor Phase 1 testing in real-time and respond immediately to failures

---

## Overview

During Day 5 (integration testing) and Day 6 (load & security testing), the QA team must actively monitor systems to detect failures in real-time. This document provides monitoring dashboards, alert conditions, and incident response procedures.

---

## Part 1: Monitoring Setup (Start at 08:45, 15 min before testing)

### 1.1 Terminal Layout

Set up three terminal windows running in parallel:

**Terminal 1: VPS Health Dashboard**
```bash
#!/bin/bash
# Run this in a dedicated terminal
watch -n 5 'ssh root@76.13.179.86 << "EOF"
echo "=== $(date) ==="
echo ""
echo "Memory:"
free -h | grep Mem
echo ""
echo "CPU Load:"
uptime | awk -F"load average:" "{print \$2}"
echo ""
echo "Disk:"
df -h | grep root | awk "{print \$5, \$6}"
echo ""
echo "PM2 Status:"
pm2 status | grep -E "online|stopped|errored"
echo ""
echo "Network:"
netstat -an | grep ESTABLISHED | wc -l
echo "established connections"
EOF
'
```

**Terminal 2: Application Log Streaming**
```bash
#!/bin/bash
# Run this in a dedicated terminal
ssh root@76.13.179.86 << 'EOF'
tail -f /root/dc1-platform/backend/logs/app.log | while read line; do
  echo "[$(date '+%H:%M:%S')] $line"
  # Highlight errors
  if echo "$line" | grep -qE "ERROR|FATAL|CRITICAL|failed"; then
    echo "🚨 ALERT: $line" >&2
  fi
done
EOF
```

**Terminal 3: Database Monitoring**
```bash
#!/bin/bash
# Run this in a dedicated terminal
watch -n 10 'ssh root@76.13.179.86 << "EOF"
echo "=== Metering Table ==="
sqlite3 /root/dc1-platform/backend/data/providers.db << SQL
SELECT
  COUNT(*) as total_sessions,
  COUNT(DISTINCT job_id) as unique_jobs,
  SUM(total_tokens) as total_tokens,
  MAX(updated_at) as last_update
FROM serve_sessions;
SQL
echo ""
echo "=== Jobs Table ==="
sqlite3 /root/dc1-platform/backend/data/providers.db << SQL
SELECT
  COUNT(*) as total_jobs,
  COUNT(CASE WHEN status='completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status='failed' THEN 1 END) as failed
FROM jobs;
SQL
echo ""
echo "=== Providers Online ==="
sqlite3 /root/dc1-platform/backend/data/providers.db << SQL
SELECT COUNT(*) as providers_online
FROM providers
WHERE status='online' AND last_heartbeat > datetime('now', '-2 minutes');
SQL
EOF
'
```

**Checklist:**
- [ ] Terminal 1 updating every 5 seconds
- [ ] Terminal 2 streaming live logs
- [ ] Terminal 3 updating every 10 seconds
- [ ] All three can run simultaneously without hanging

---

### 1.2 Alert Thresholds

Set mental alert thresholds for immediate investigation:

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Memory | <70% | 70-85% | >85% |
| CPU Load | <2.0 | 2.0-4.0 | >4.0 |
| Disk | <60% | 60-80% | >80% |
| PM2 Status | All ONLINE | 1 stopped | 1+ crashed |
| Active Connections | <50 | 50-100 | >100 |
| Log Errors/min | 0 | 1-5 | >5 |
| DB Sessions Updated | >0/min | 0 | — |
| Providers Online | >5 | 2-5 | <2 |

---

## Part 2: Real-Time Monitoring During Day 5 Testing

### 2.1 Test Phase 1: Infrastructure Check (09:00-09:30)

**What to Monitor:**
- VPS boot status (Terminal 1)
- PM2 service startup (Terminal 1)
- Log initialization (Terminal 2)
- Database accessibility (Terminal 3)

**Alert Conditions:**
```
⚠️  YELLOW: PM2 service shows high memory (>500MB)
🚨 RED: PM2 service not ONLINE
🚨 RED: Cannot connect to database
🚨 RED: More than 10 errors in logs during startup
```

**Response Procedure:**
1. If RED: Take screenshot of Terminal 1-3
2. Escalate immediately to DevOps Engineer
3. Do not proceed with rest of testing until resolved

---

### 2.2 Test Phase 2: Metering API Tests (09:30-09:35)

**What to Monitor:**
- Job creation rate (Terminal 3)
- serve_sessions creation (Terminal 3)
- Latency in logs (Terminal 2)
- No database locks (Terminal 1)

**Expected Behavior:**
```
✅ 6 metering tests pass (check test output in console)
✅ 6 serve_sessions records created
✅ Token counts populated (not null, not 0)
✅ No "database is locked" errors
✅ Response time <5 seconds per test
```

**Alert Conditions:**
```
⚠️  YELLOW: serve_sessions created but token_count = 0
⚠️  YELLOW: Database query taking >100ms
🚨 RED: Test timeout (>10 seconds)
🚨 RED: SQL errors in logs
🚨 CRITICAL: vLLM returns tokens but DB shows 0 (SILENT FAILURE)
```

**Response Procedure:**
1. **If token_count = 0 with non-zero vLLM tokens:** CRITICAL — STOP TESTING IMMEDIATELY
   - Take screenshot of Terminal 2-3
   - Email CEO: "CRITICAL: Silent metering failure detected"
   - Escalate to Backend Engineer
   - Do not proceed with any more tests

2. **If database timeout:**
   - Check Terminal 1 (CPU/Memory)
   - Restart PM2: `ssh root@76.13.179.86 pm2 restart dc1-provider-onboarding`
   - Re-run metering tests

3. **If test timeout:**
   - Check Terminal 2 for errors
   - Check Terminal 3 for locks
   - Restart backend if hung

---

### 2.3 Test Phase 3: Pricing Integration Tests (09:35-09:37)

**What to Monitor:**
- Pricing query latency (Terminal 2)
- RTX 4090 price accuracy
- No 503 errors
- Response consistency

**Expected Behavior:**
```
✅ 11 pricing tests pass
✅ All 6 GPU tiers returned
✅ RTX 4090 = 26,700 halala (CRITICAL)
✅ Response time <100ms
✅ No "pricing table empty" errors
```

**Alert Conditions:**
```
⚠️  YELLOW: Response time >200ms
⚠️  YELLOW: 503 error (pricing empty)
🚨 RED: RTX 4090 price ≠ 26,700 halala
🚨 RED: <6 tiers returned
🚨 RED: Malformed JSON response
```

**Response Procedure:**
1. **If RTX 4090 price wrong:** Escalate to Backend Engineer immediately
   - Check database: `ssh root@76.13.179.86 'sqlite3 /root/dc1-platform/backend/data/providers.db "SELECT * FROM gpu_pricing WHERE gpu_model='\''RTX 4090'\'';'`
   - If wrong in DB: Re-seed pricing
   - If correct in DB: Backend not reading from DB

2. **If 503 error:**
   - Check database has pricing: `SELECT COUNT(*) FROM gpu_pricing;`
   - If empty: Re-seed
   - If populated: Check backend code

3. **If timeout/malformed:**
   - Check Terminal 2 for errors
   - Check Terminal 1 for resource constraints

---

### 2.4 Test Phase 4: VPS & Container Health (09:37-09:42)

**What to Monitor:**
- Container pull success/failure
- VPS health script output
- HTTPS certificate validity
- PM2 service status post-operations

**Expected Behavior:**
```
✅ Docker images pull <30 seconds
✅ VPS health check: 8/8 pass
✅ HTTPS certificate valid & not expired
✅ PM2 both services ONLINE
```

**Alert Conditions:**
```
⚠️  YELLOW: Docker pull >30 seconds
⚠️  YELLOW: VPS health: 1 check failed (not critical)
🚨 RED: Cannot pull container image
🚨 RED: VPS health: 2+ checks failed
🚨 RED: HTTPS certificate expired or invalid
🚨 RED: PM2 service stopped
```

**Response Procedure:**
1. **If Docker pull fails:**
   - Check internet connection
   - Check docker.io is accessible
   - Retry with `docker pull dc1/llm-worker:latest`

2. **If VPS health fails:**
   - Check which check failed (disk, memory, services)
   - Fix specific issue (free disk space, restart service)
   - Re-run vps-health.sh

3. **If certificate invalid:**
   - Check cert expiration: `ssh root@76.13.179.86 openssl s_client -connect api.dcp.sa:443 -servername api.dcp.sa | grep "Not After"`
   - If expired: Renew with Let's Encrypt
   - Contact DevOps Engineer

---

### 2.5 Test Phase 5: Provider Onboarding Tests (09:42-09:52)

**What to Monitor:**
- Provider registration success rate
- Heartbeat acceptance
- Provider status changes
- Database provider count increase

**Expected Behavior:**
```
✅ 5+ new providers registered
✅ All heartbeats accepted (200 OK)
✅ Providers appear online in admin API
✅ Earnings calculator returns values
✅ No registration failures
```

**Alert Conditions:**
```
⚠️  YELLOW: <5 providers registered (target 5+)
⚠️  YELLOW: Heartbeat latency >1 second
🚨 RED: Provider registration failure (400+ error)
🚨 RED: Provider appears offline in admin API after heartbeat
🚨 RED: Earnings calculator returns 0 or error
```

**Response Procedure:**
1. **If registration fails:**
   - Check API error message
   - Verify renter creation is working
   - Check database: `SELECT * FROM providers WHERE id = '...';`
   - Escalate to Backend Engineer if DB issue

2. **If provider doesn't appear online:**
   - Verify heartbeat was accepted (check logs)
   - Check database: `SELECT status, last_heartbeat FROM providers WHERE id='...';`
   - If DB updated but admin API shows offline: API caching issue
   - Clear cache or restart backend

3. **If earnings calculator fails:**
   - Check endpoint exists: `curl https://api.dcp.sa/api/providers/earnings-calculator?gpu=RTX%204090`
   - If 404: Endpoint not implemented
   - If error: Check logs for calculation error

---

### 2.6 Test Phase 6: E2E Master Smoke Test (09:52-10:02)

**What to Monitor:**
- Each of 12 checks pass/fail
- Provider→Job→Metering→Billing flow completion
- Silent metering failure detection
- Final balance deduction accuracy

**Expected Behavior:**
```
✅ Step 1: Provider registration succeeds
✅ Step 2: Renter creation & funding succeeds
✅ Step 3: Pricing verification passes
✅ Step 4: vLLM job submission succeeds
✅ Step 5: Metering verification passes
  └─ Tokens persisted (>0)
  └─ Cost calculated (>0)
  └─ Silent failure detection works
✅ Step 6: Billing verification passes
  └─ Balance deducted
✅ Total: 12/12 checks pass
```

**Alert Conditions:**
```
⚠️  YELLOW: Step takes >5 seconds
⚠️  YELLOW: 1 of 12 checks fails (debug and retry)
🚨 RED: vLLM returns tokens but serve_sessions shows 0 (CRITICAL)
🚨 RED: Multiple checks fail (2+)
🚨 RED: Script timeout
🚨 CRITICAL: Silent metering failure not detected
```

**Response Procedure:**
1. **If Step 1 (provider) fails:**
   - Verify provider registration endpoint works
   - Check database: `SELECT COUNT(*) FROM providers;` (should increment)
   - Retry step manually

2. **If Step 5 (metering) shows silent failure:**
   - STOP EVERYTHING
   - Take screenshot of Terminal 2-3
   - Email CEO immediately: "CRITICAL: Silent metering failure in E2E test"
   - Escalate to Backend Engineer
   - This is a GO/NO-GO blocker

3. **If Step 6 (billing) fails:**
   - Check if balance was actually deducted: `SELECT balance FROM renters WHERE id='...';`
   - If deducted correctly: Test assertion issue
   - If not deducted: Billing system broken
   - Escalate accordingly

4. **If multiple checks fail:**
   - Review script output for error details
   - Check Terminal 2 for backend errors
   - Consider restarting backend and re-running test

---

### 2.7 Post-Test Analysis (10:02-11:30)

**What to Monitor:**
- No further errors appearing in logs
- Database consistency
- No data corruption

**Expected Behavior:**
```
✅ All test data consistent in database
✅ No orphaned records
✅ Billing amounts match metering
✅ Provider earnings calculated correctly
```

**Actions:**
1. Document all test results
2. Run data consistency checks
3. Generate report for go/no-go decision

---

## Part 3: Day 6 Load & Security Testing Monitoring

### 3.1 Load Test Monitoring (08:00-10:00)

**What to Watch:**
- CPU usage stays <85%
- Memory stays <90%
- Error rate <1%
- Response times meet baselines

**Alert Thresholds:**
```
⚠️  YELLOW: CPU >75%
⚠️  YELLOW: Memory >80%
⚠️  YELLOW: Error rate 0.5-1%
🚨 RED: CPU >85%
🚨 RED: Memory >90%
🚨 RED: Error rate >1%
🚨 RED: Response time degradation >2x baseline
```

**Response:**
1. **If CPU/Memory high:** Reduce load or stop test
2. **If error rate high:** Check logs for specific errors
3. **If response time degrades:** Identify bottleneck (database, API, network)

---

### 3.2 Security Testing Monitoring (10:00-11:00)

**What to Watch:**
- All SQL injection tests blocked
- All auth tests properly reject unauthorized
- No sensitive data in logs
- No certificate errors

**Alert Conditions:**
```
⚠️  YELLOW: 1 medium-priority test fails
🚨 CRITICAL: 1 critical-priority test fails
🚨 CRITICAL: Sensitive data found in logs
🚨 CRITICAL: SQL injection succeeds
```

**Response:**
1. **If critical test fails:** Mark as blocker
2. **If medium fails:** Document as post-launch fix
3. **If sensitive data exposed:** Escalate immediately

---

## Part 4: Incident Severity & Escalation

### Critical Incidents (STOP TESTING)

**Level 1: Stop Everything**
```
🚨 CRITICAL INCIDENTS:
- Silent metering failure (vLLM tokens not in DB)
- Database corruption or loss
- Escrow/payment system failures
- SQL injection vulnerability succeeds
- Sensitive data exposed in logs
- PM2 services crash repeatedly
- VPS becomes unreachable

ACTION:
1. Stop all testing immediately
2. Take screenshots
3. Email CEO: "CRITICAL: [incident]"
4. Escalate to relevant engineer
5. Do NOT proceed until resolved
```

**Level 2: High Priority (Complete Test Phase, Then Fix)**
```
⚠️  HIGH PRIORITY:
- Multiple test failures (2+ of 12 checks)
- Response time 2x baseline
- Error rate 0.5-1%
- Database locks observed
- Memory leak suspected
- Certificate expiring <30 days

ACTION:
1. Complete current test
2. Document findings
3. Escalate to engineer
4. Resolve before next phase
```

**Level 3: Medium Priority (Log & Continue)**
```
⚠️  MEDIUM PRIORITY:
- Single test timeout (1st occurrence)
- Minor performance degradation
- Non-critical feature failure
- Documentation error

ACTION:
1. Document in log
2. Monitor if recurring
3. Continue testing
4. Plan fix post-launch
```

---

## Part 5: Escalation Contacts

Create contact list before testing starts:

```
CRITICAL FAILURES:
🚨 CEO: [name] — [phone] — [email]
   Decision authority, go/no-go call

TECHNICAL ESCALATIONS:
🔧 Backend Engineer: [name] — [phone] — [email]
   Metering, pricing, billing, API issues

🔧 DevOps Engineer: [name] — [phone] — [email]
   VPS health, PM2, infrastructure, deployment

🔧 Smart Contracts Engineer: [name] — [phone] — [email]
   Escrow (if testing resumes), on-chain issues

🔧 QA Lead: agent 891b2856-c2eb-4162-9ce4-9f903abd315f
   Test coordination, incident response
```

---

## Part 6: Post-Testing Procedures

### 6.1 Data Preservation

```bash
# Backup all test data for post-analysis
ssh root@76.13.179.86 << 'EOF'
tar -czf /tmp/testing-results-$(date +%Y%m%d).tar.gz \
  /root/dc1-platform/backend/logs/ \
  /root/dc1-platform/backend/data/providers.db

echo "Backup created: /tmp/testing-results-*.tar.gz"
EOF
```

### 6.2 Report Generation

Create a final report with:
- All test results (pass/fail count)
- Screenshots of any failures
- Terminal logs from all 3 terminals
- Database state snapshots
- Performance metrics

### 6.3 Go/No-Go Decision

Based on monitoring data, make final decision:

```
✅ GO Decision:
- All critical tests passed
- No silent metering failures detected
- Performance baselines met
- Security tests passed
- Zero data corruption
→ PROCEED WITH PHASE 1 LAUNCH

❌ NO-GO Decision:
- Any critical test failed
- Silent metering failure detected
- Critical security vulnerability
- Data corruption observed
→ DELAY LAUNCH, FIX ISSUES, RETEST
```

---

*QA Coordinator: agent 891b2856-c2eb-4162-9ce4-9f903abd315f*
*Created: 2026-03-23*
*Execution Dates: 2026-03-27 (Day 5), 2026-03-28 (Day 6)*
*Critical Path: Phase 1 Launch Decision*
