# Phase 1 ML Infrastructure Execution Guide (Days 4-6)

**Owner:** ML Infrastructure Engineer
**Coordinator:** QA Engineer (DCP-773 lead)
**Duration:** 2026-03-26 to 2026-03-28 (3 days)
**Status:** 🟢 READY FOR DEPLOYMENT

---

## Quick Start: ML Infrastructure Setup (Before Day 4 08:00 UTC)

### 1. Deploy Monitoring Infrastructure (T-60 minutes)

```bash
# SSH to VPS or local environment
cd /home/node/dc1-platform

# Start health monitoring via PM2
pm2 start scripts/phase1-health-monitor.mjs --name ml-health-monitor
pm2 start scripts/api-latency-monitor.mjs --name ml-latency-monitor
pm2 start scripts/provider-uptime-check.mjs --name ml-uptime-check

# Verify all running
pm2 status | grep ml-

# Save PM2 state
pm2 save
pm2 startup
```

### 2. Verify Health Poller Running (DCP-883)

```bash
# Check model health poller from DCP-883 (should already be merged)
pm2 status | grep health

# If not running, start it:
pm2 start scripts/model-health-poller.mjs --name ml-health-poller --cron "*/30 * * * *"
```

### 3. Test Endpoints (T-30 minutes, before 08:00 UTC)

```bash
# Run quick endpoint verification
node scripts/model-catalog-smoke.mjs
# Expected: All 11 models, pricing data present

# Check baseline metrics
curl -s https://api.dcp.sa/api/health | jq '.status'
# Expected: "OK"

# Verify provider count
curl -s https://api.dcp.sa/api/providers/available | jq '.count'
# Expected: >0
```

---

## Day 4: Pre-Test Validation (2026-03-26 08:00 UTC)

### Phase 0: Environment Setup (08:00-08:15 UTC)

**ML Infrastructure Checklist:**

```bash
# 1. Verify health monitors are running
pm2 status | grep ml-
# Expected: ml-health-monitor, ml-latency-monitor, ml-uptime-check all "online"

# 2. Check baseline metrics collection
ls -lh backend/logs/phase1-health-latest.json
# Expected: Recent timestamp (< 1 min old)

# 3. View latest health snapshot
cat backend/logs/phase1-health-latest.json | jq '.'
# Expected: api_health=true, models_count=11, providers_online>0

# 4. Verify no critical errors in logs
tail -20 backend/logs/phase1-health-monitor.log
# Expected: No CRITICAL markers
```

**Actions if any check fails:**
- Health monitor down: Restart with `pm2 restart ml-health-monitor`
- Missing JSON snapshot: Check log directory permissions (`mkdir -p backend/logs`)
- Endpoint errors: Post to DCP-773 with screenshot, escalate to Backend

### Phase 1-4: Support QA Pre-Test Validation (08:15-09:00 UTC)

**ML Infrastructure Role:**
- Monitor health poller output continuously
- Spot-check API latency every 15 minutes
- Watch for critical failure alerts
- Respond to QA troubleshooting requests within 5 minutes

**Monitoring Commands (run in separate terminal):**

```bash
# Terminal A: Watch health monitor in real-time
tail -f backend/logs/phase1-health-monitor.log | grep -E "Check #|CRITICAL|❌"

# Terminal B: Monitor latency reports
ls -lht backend/logs/api-latency-report-*.json | head -5

# Terminal C: Watch provider uptime
tail -f backend/logs/provider-uptime-check.log | grep -E "Check #|providers"
```

**Pre-Test Validation Metrics (Expected by 09:00 UTC):**

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| API Health | ✅ OK | ___ | ☐ |
| Models Online | 11/11 | ___/11 | ☐ |
| Providers | >0 | ___ | ☐ |
| API Latency (p95) | <200ms | ___ms | ☐ |
| Health Monitor Uptime | 100% | __% | ☐ |
| Latency Monitor Running | ✅ Online | ___ | ☐ |
| Provider Uptime Check | ✅ Online | ___ | ☐ |

**ML Infrastructure Pre-Test Report (post to DCP-773 by 09:00 UTC):**

```markdown
## ML Infrastructure — Pre-Test Setup Report

**Status: ✅ READY** or **❌ ISSUES**

### Monitoring Systems
- [ ] Health monitor deployed and collecting data
- [ ] Latency monitor running (30s check intervals)
- [ ] Provider uptime monitor running (5m intervals)
- [ ] Model health poller operational (DCP-883)

### Baseline Verification
- [ ] API latency (p95): ___ms (target <200ms)
- [ ] Cold-start latency: ___s (target <30s)
- [ ] GPU utilization: __% (target 70-95%)
- [ ] Provider uptime: __% (target >99.5%)

### Ready for Testing
- [ ] All endpoints responding
- [ ] No critical errors in logs
- [ ] Monitoring infrastructure stable
```

---

## Day 5: Active Integration Testing (2026-03-27 09:00 UTC)

### Monitoring Schedule

**Continuous (every 30 seconds):**
- Health check (API, models, providers)
- Log results to phase1-health-monitor.log

**Every 10 seconds:**
- API latency sampling (p50/p95/p99)
- Store in api-latency-monitor.log

**Every 5 minutes:**
- Provider uptime check
- Store in provider-uptime-check.log

**Hourly (at :00 UTC):**
- Generate latency report: api-latency-report-N.json
- Generate uptime report: provider-uptime-report-N.json
- Post Day 5 standup to DCP-773

### Daily Standup Template (10:00 UTC)

```markdown
## Phase 1 Day 5 — ML Infrastructure Standup

**Time:** 2026-03-27 10:00 UTC
**Status:** ✅ ON TRACK

### Key Metrics (Last 60 minutes)
| Metric | p50 | p95 | p99 | Target |
|--------|-----|-----|-----|--------|
| TTFT (Llama-3) | ___ms | ___ms | ___ms | <300ms |
| Throughput | ___tok/s | ___tok/s | ___tok/s | >45tok/s |
| Cold-start | ___s | - | - | <15s |
| GPU Util | __% | - | - | 70-95% |
| API Latency | ___ms | ___ms | ___ms | <200ms |
| Provider Uptime | __% | - | - | >99.5% |

### Observations
- [Any performance trends, spikes, degradation]
- [Provider status changes]
- [Resource utilization notes]

### Issues / Escalations
- [None] or [List any blockers, escalation actions]

### Next 12 Hours
- Continue monitoring per schedule
- Watch for latency spikes >20% from baseline
- Alert if provider uptime drops below 95%

**Signed:** ML Infrastructure Engineer, 2026-03-27 10:00 UTC
```

### Escalation Triggers (Day 5)

| Trigger | p50 Response | Action |
|---------|--------------|--------|
| **CRITICAL:** API down | 5 min | Restart services, escalate to Backend |
| **CRITICAL:** 0 providers online | 5 min | Contact P2P Network Engineer |
| **HIGH:** TTFT >2s for 3 consecutive checks | 15 min | Check GPU utilization, investigate bottlenecks |
| **HIGH:** Provider uptime <95% | 15 min | Monitor trend, assess if degrading |
| **MEDIUM:** API latency p95 >500ms | 30 min | Investigate backend load, suggest scaling |
| **MEDIUM:** Token accuracy <95% | 30 min | Verify metering logic, check for silent failures |
| **LOW:** All metrics on target | 60 min | Continue monitoring, log observations |

---

## Day 6: Load Testing & Go/No-Go (2026-03-28 08:00 UTC)

### Pre-Load Verification (08:00-08:30 UTC)

Before launching concurrent renter sessions, verify baseline stability:

```bash
# Check provider capacity
curl -s https://api.dcp.sa/api/providers/available | jq '.providers[] | {id, gpu_util, vram_available}'
# All providers should show >50% available VRAM

# Check model response times under zero load
for model in "ALLaM-AI/ALLaM-7B-Instruct" "Qwen/Qwen2.5-7B" "NousResearch/Nemotron-4-340B-Instruct"; do
  curl -s -X POST https://api.dcp.sa/api/models/$model/estimate \
    -H "Content-Type: application/json" \
    -d '{"prompt_length": 100, "max_tokens": 100}' | jq '.estimated_ttft_ms'
done
# All should be <1s
```

### Load Phase (08:30-10:00 UTC)

**Monitor Continuously:**
- TTFT percentiles (p50, p95, p99) — Watch for degradation >20% from baseline
- GPU utilization — Should stay 70-95%, not exceed 99%
- Provider uptime — Watch for any going offline
- Token accuracy — Should stay ±2%
- Memory utilization — Check for leaks or fragmentation

**Monitoring Commands:**

```bash
# Real-time health dashboard
watch -n 5 'cat backend/logs/phase1-health-latest.json | jq ".checks"'

# Latency spike detection
tail -f backend/logs/api-latency-monitor.log | grep "spike"

# Provider status
curl -s https://api.dcp.sa/api/providers/available | jq '.count'
```

### Go/No-Go Decision Matrix (10:00-11:00 UTC)

**PASS Criteria (Proceed to Production):**
- ✅ All 6 SLA metrics pass (see phase1-sla-thresholds.md)
- ✅ API latency <200ms (p95)
- ✅ TTFT <1s (p95) for all models
- ✅ GPU utilization 70-95%
- ✅ Provider uptime >99.5%
- ✅ Token accuracy ±2%
- ✅ Zero critical errors
- ✅ Data integrity verified

**NO-GO Triggers (Stop and Escalate):**
- ❌ Any provider goes offline during load
- ❌ TTFT >2s (p95) sustained for >5 min
- ❌ API latency >500ms (p95)
- ❌ GPU utilization >99% (thermal throttling risk)
- ❌ Token accuracy <95%
- ❌ Memory leaks detected
- ❌ Any 500+ errors in API logs
- ❌ Provider balance corruption

### Final Day 6 Report (11:00 UTC)

```markdown
## Phase 1 Day 6 — ML Infrastructure Load Test Report

**Status: ✅ GO** or **🔴 NO-GO**

### Load Test Metrics (2026-03-28 08:30-10:00 UTC)
- Peak concurrent users: ___
- Sustained TTFT (p95): ___ms
- Peak GPU utilization: ___%
- Provider uptime: ___%
- Total requests processed: ___
- Requests with errors: ___
- Silent failures detected: ___

### Decision Basis
[Explain why GO or NO-GO based on SLA thresholds]

### Recommendations
[For production launch or post-launch optimization]

**Signed:** ML Infrastructure Engineer + QA Engineer
```

---

## Reference: Health Monitoring Commands

### Check Health Monitor Status

```bash
# View latest snapshot
cat backend/logs/phase1-health-latest.json | jq '.'

# Watch in real-time
tail -f backend/logs/phase1-health-monitor.log

# Count errors by type
grep "❌\|⚠️" backend/logs/phase1-health-monitor.log | wc -l
```

### Check Latency Monitor Status

```bash
# View latest report
ls -lh backend/logs/api-latency-report-*.json | tail -1 | awk '{print $NF}' | xargs cat | jq '.stats'

# Watch report generation
watch -n 10 'ls -lh backend/logs/api-latency-report-*.json | tail -1'
```

### Check Provider Uptime

```bash
# View latest state
cat infra/state/provider-health.json | jq '.providers[] | {id, uptime}'

# View hourly report
ls -lh backend/logs/provider-uptime-report-*.json | tail -1 | awk '{print $NF}' | xargs cat | jq '.'
```

### Manage Monitoring Services (PM2)

```bash
# Check all ML infrastructure services
pm2 list | grep ml-

# View logs for specific service
pm2 logs ml-health-monitor --lines 100

# Restart service if needed
pm2 restart ml-health-monitor

# Stop during maintenance
pm2 stop ml-health-monitor

# Resume after maintenance
pm2 restart ml-health-monitor
```

---

## Critical Contacts

- **QA Engineer (Day 4-6 Lead):** @QA_Engineer (DCP-773)
- **Backend Architect:** @Backend (API issues)
- **P2P Network Engineer:** @P2P (Provider connectivity)
- **ML Infrastructure Engineer:** @MLInfra (This team)
- **CEO/Founder:** @Founder (Critical escalations)

---

## Success Criteria (Full Phase 1 Complete)

✅ Day 4: Pre-test validation passes (12/12 sections)
✅ Day 5: Active testing metrics on target (≥3/4 thresholds)
✅ Day 6: Load testing passes (all 6 SLA metrics)
✅ Go/No-Go: **GO decision** issued
✅ Production ready to receive real renters

---

**Status:** 🟢 ML INFRASTRUCTURE READY FOR PHASE 1 EXECUTION
**Last Updated:** 2026-03-24 14:00 UTC
**Next Review:** 2026-03-26 07:45 UTC (pre-Day 4 kickoff)
