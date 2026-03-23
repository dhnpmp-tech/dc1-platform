# Sprint 26 Load Testing Plan — Phase 1 Production Readiness

**Date:** 2026-03-23
**Execution:** Day 6 (2026-03-28) - Post-launch validation
**QA Lead:** agent 891b2856-c2eb-4162-9ce4-9f903abd315f

---

## Overview

Load testing validates that DCP infrastructure can handle Phase 1 production traffic:
- Multiple concurrent renters submitting jobs
- Provider heartbeat traffic (every 30 seconds per provider)
- Public pricing API queries (high concurrency expected)
- Admin queries for metering and analytics

---

## Load Test Scenarios

### Scenario 1: Pricing API Spike (Peak Load)

**Scenario:** 100 concurrent renters viewing pricing dashboard

```
Configuration:
- Concurrent Users: 100
- Duration: 5 minutes
- RPS Target: ~500 requests/sec
- Endpoint: GET /api/renters/pricing

Expected Metrics:
- Response Time (p99): <200ms
- Success Rate: >99.5%
- Throughput: >450 RPS
- Error Rate: <0.5%

Acceptance Criteria:
✓ No 503 errors from database
✓ Response time stays <500ms (p99)
✓ Server memory remains <90%
✓ CPU stays <85%
```

### Scenario 2: Job Submission Burst

**Scenario:** 50 renters submit jobs simultaneously

```
Configuration:
- Concurrent Users: 50
- Jobs per User: 1 (burst)
- Endpoint: POST /api/vllm/complete
- Duration: 10 minutes (job execution + metering)

Expected Metrics:
- Escrow holds created: 50
- Serve sessions created: 50
- Job completion rate: >95%
- Metering persistence: 100%

Acceptance Criteria:
✓ All 50 escrow holds created successfully
✓ All 50 serve_sessions records created
✓ All 50 jobs complete without timeout
✓ Zero silent metering failures
✓ Balance deductions match metering costs (100%)
```

### Scenario 3: Provider Heartbeat Traffic

**Scenario:** 100 providers sending heartbeats (realistic sustained load)

```
Configuration:
- Provider Count: 100
- Heartbeat Interval: 30 seconds
- Duration: 5 minutes
- RPS Target: ~3 RPS sustained

Expected Metrics:
- Heartbeat Processing: <100ms
- Provider Status Update: <200ms latency
- Success Rate: 100%
- Database connections: <20

Acceptance Criteria:
✓ All 100 providers remain online
✓ Status updates within 500ms
✓ No dropped heartbeats
✓ Database handles 100+ concurrent updates
```

### Scenario 4: Admin API Metering Queries

**Scenario:** QA team + monitoring systems query metering data

```
Configuration:
- Concurrent Queries: 10
- Query Type: /api/admin/serve-sessions/{job_id}
- Frequency: 1 per second per user
- Duration: 5 minutes

Expected Metrics:
- Query Response: <50ms (p99)
- Success Rate: 100%
- No database locks
- No timeout errors

Acceptance Criteria:
✓ All queries return correct metering data
✓ Response time consistent <100ms
✓ No 404s (assuming valid job_ids)
✓ Admin token validation working
```

### Scenario 5: Mixed Realistic Load

**Scenario:** Simulate real Phase 1 day with diverse traffic

```
Configuration:
- Active Renters: 50 (viewing pricing, submitting jobs)
- Active Providers: 100 (heartbeats, job completion)
- Concurrent Requests: 200-500
- Duration: 15 minutes

Traffic Distribution:
- GET /api/renters/pricing: 40% (pricing views)
- POST /api/vllm/complete: 20% (job submissions)
- POST /api/providers/heartbeat: 30% (provider heartbeats)
- GET /api/admin/*: 10% (monitoring queries)

Expected Metrics:
- Overall Success Rate: >99%
- Average Response Time: <300ms
- p99 Response Time: <1000ms
- Error Rate: <1%

Acceptance Criteria:
✓ System handles mixed load without degradation
✓ No cascading failures
✓ Metering 100% accurate under load
✓ Database remains responsive
✓ Memory/CPU within limits
```

---

## Performance Baselines

| Endpoint | Target p50 | Target p99 | Target Throughput |
|----------|-----------|-----------|------------------|
| GET /api/renters/pricing | <50ms | <200ms | >500 RPS |
| POST /api/vllm/complete | <5000ms | <10000ms | >5 RPS |
| POST /api/providers/heartbeat | <100ms | <200ms | >500 RPS |
| GET /api/admin/serve-sessions | <50ms | <100ms | >100 RPS |

---

## Load Testing Tools

### Option 1: k6 (JavaScript-based, recommended)

```bash
# Install
npm install -g k6

# Run pricing spike test
k6 run tests/load/pricing-spike.js

# Run mixed load test
k6 run tests/load/mixed-load.js --vus 200 --duration 15m
```

### Option 2: Apache JMeter

```bash
# GUI mode
jmeter -t tests/load/phase1-load.jmx

# Headless mode
jmeter -n -t tests/load/phase1-load.jmx -l results.jtl -j jmeter.log
```

### Option 3: Locust (Python)

```bash
# Install
pip install locust

# Run
locust -f tests/load/locustfile.py --host=https://api.dcp.sa
```

---

## Test Execution Schedule

**Day 6 Morning (2026-03-28, 08:00-12:00):**

| Time | Test | Owner | Duration |
|------|------|-------|----------|
| 08:00 | Pricing API Spike | QA Eng | 10 min |
| 08:20 | Job Submission Burst | QA Eng | 15 min |
| 08:40 | Provider Heartbeat Traffic | QA Eng | 10 min |
| 09:00 | Admin API Query Load | QA Eng | 10 min |
| 09:20 | Mixed Realistic Load | QA Eng | 20 min |
| 10:00 | Analysis & Report | QA Eng | 60 min |
| 11:00 | Resolution of any issues | Engineers | 60 min |
| 12:00 | Sign-off for production | CEO | 30 min |

---

## Success Criteria for Production Ready

### Critical Performance Gates

✓ Pricing API: <200ms p99, >450 RPS (public API must scale)
✓ Job Submission: <10s p99 response, 100% metering persistence
✓ Provider Heartbeats: <200ms p99, 100% success rate
✓ Admin Queries: <100ms p99, immediate data availability

### Reliability Gates

✓ Error Rate: <1% under sustained load
✓ Success Rate: >99% for all endpoints
✓ Silent Failures: Zero detected (metering critical)
✓ Database Locks: None during load tests
✓ Memory Leaks: None detected (sustained 15-min test)

### Infrastructure Gates

✓ CPU Usage: <85% peak
✓ Memory Usage: <90% peak
✓ Disk I/O: <70% peak
✓ Network: <70% capacity
✓ PM2 Services: Both remain ONLINE

---

## Failure Response Plan

**If Performance Fails:**

1. Identify bottleneck (database, API, network, infrastructure)
2. Escalate to appropriate engineer
3. Apply optimization (indexing, caching, pooling)
4. Re-test to confirm fix
5. Document lessons learned

**If Any Endpoint Fails:**
- Mark as CRITICAL
- Delay launch if critical path
- Implement fallback or caching
- Re-test before go-live

**If Silent Metering Failure Detected:**
- IMMEDIATE ESCALATION
- Block launch until resolved
- Audit all previous test data
- Root cause analysis required

---

## Monitoring During Tests

Keep running during all load tests:

```bash
# Terminal 1: VPS Health
watch -n 5 'ssh root@76.13.179.86 ./scripts/vps-health.sh'

# Terminal 2: Database Monitoring
watch -n 5 'sqlite3 /root/dc1-platform/backend/data/providers.db "SELECT count(*) as jobs, sum(cost_halala) as total_cost FROM jobs;"'

# Terminal 3: Application Logs
ssh root@76.13.179.86 tail -f /root/dc1-platform/backend/logs/app.log | grep -i error
```

---

## Pass/Fail Report Template

```markdown
# Load Test Results — [Date]

## Test Summary
- Scenario: [Name]
- Duration: [Minutes]
- Peak Concurrent Users: [Number]
- Total Requests: [Count]

## Performance Results
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| p50 Response | XXms | XXms | ✓/✗ |
| p99 Response | XXms | XXms | ✓/✗ |
| Throughput | XXX RPS | XXX RPS | ✓/✗ |
| Success Rate | >99% | XX% | ✓/✗ |
| Error Rate | <1% | X% | ✓/✗ |

## Infrastructure Health
- CPU Peak: XX% (target: <85%) ✓/✗
- Memory Peak: XX% (target: <90%) ✓/✗
- Database Connections: XX (target: <20) ✓/✗
- PM2 Services: ONLINE ✓

## Metering Validation
- Total Jobs: [Count]
- Serve Sessions Created: [Count]
- Silent Failures: 0 ✓
- Balance Deductions: 100% accurate ✓

## Issues Found
1. [Issue]: [Description]
   - Root Cause: [Analysis]
   - Resolution: [Fix]
   - Re-test Result: PASS/FAIL

## Sign-Off
- Status: PASS / FAIL
- Production Ready: YES / NO
- Approved by: [QA Lead]
- Date: [Timestamp]
```

---

## Post-Load Test Checklist

After ALL load tests pass:

```
[ ] All performance targets met
[ ] Zero silent metering failures
[ ] Zero cascading failures
[ ] Database integrity verified (SELECT COUNT)
[ ] Provider/Renter data consistent
[ ] Metering calculations 100% accurate
[ ] No memory leaks detected
[ ] All PM2 services still running
[ ] Application logs show no errors
[ ] Pricing API responsive and accurate
[ ] Escrow holds created/released correctly
[ ] Provider earnings calculated correctly
```

---

*QA Engineer: agent 891b2856-c2eb-4162-9ce4-9f903abd315f*
*Phase 1 Load Testing Coordinator*
*Execution: Day 6 morning (2026-03-28)*
