# Phase 1 Day 4 — ML Infrastructure Execution Checklist

**Owner:** ML Infrastructure Engineer
**Date:** 2026-03-24 (Created: Pre-Day 4)
**Execution Date:** 2026-03-26 08:00 UTC
**Duration:** 4 hours (08:00-12:00 UTC)

---

## Pre-Execution Setup (By 2026-03-26 07:45 UTC)

### Environment Verification

- [ ] SSH to VPS / confirm connection to backend
- [ ] Check current branch: `git status` (should be main)
- [ ] Verify latest code: `git log --oneline | head -1`
- [ ] Confirm DCP-921 monitoring docs merged:
  - [ ] phase1-sla-thresholds.md present
  - [ ] phase1-monitoring-spec.md present
  - [ ] gpu-benchmark-baselines.md present

### Health Poller Verification (DCP-883)

```bash
# Check if health poller running
pm2 status | grep health
# Expected: dc1-health-poller (or similar) showing "online"

# If not running, start it:
pm2 start scripts/model-health-poller.mjs --name dc1-health-poller --cron "*/30 * * * *"

# Verify it's collecting data
ls -lh backend/logs/phase1-health-*.json
# Expected: Recent file (dated today, <5 min old)
```

### Baseline Metric Capture

```bash
# View latest health snapshot
cat backend/logs/phase1-health-latest.json | jq '.'

# Capture baseline for reference
cp backend/logs/phase1-health-latest.json backend/logs/phase1-baseline-day4.json
```

### API Endpoint Quick Test

```bash
# Test each critical endpoint
curl -s https://api.dcp.sa/api/health | jq '.status'
# Expected: "OK"

curl -s https://api.dcp.sa/api/models | jq 'length'
# Expected: 11

curl -s https://api.dcp.sa/api/templates | jq 'length'
# Expected: >10

curl -s https://api.dcp.sa/api/providers/available | jq '.count'
# Expected: >0
```

---

## Phase 0: Pre-Test Validation (08:00-08:15 UTC)

### Health Monitor Status (5 min)

- [ ] Confirm health poller running and collecting data
- [ ] Verify all 4 endpoint groups responding:
  - [ ] API health ✅
  - [ ] Models count ✅
  - [ ] Templates available ✅
  - [ ] Providers online ✅
- [ ] Check no critical errors in backend logs

**If any check fails:**
1. Note exact failure point
2. Check `backend/logs/phase1-health-monitor.log`
3. Post to DCP-773: "@QA Engineer [specific error], investigating"
4. Attempt fix or escalate to Backend

### Baseline Metrics Establishment (5 min)

- [ ] Cold-start latency: Record actual value
- [ ] TTFT (Llama-3): Record p50 value
- [ ] GPU utilization: Record % value
- [ ] Provider uptime: Record % value
- [ ] API latency (p95): Record ms value

**Record baseline in format:**
```
Cold-start: ___s (target <15s)
TTFT: ___ms (target <300ms)
GPU: __% (target 70-95%)
Uptime: __% (target >99.5%)
API latency: ___ms (target <200ms)
```

### Standup Template Preparation

- [ ] Have standup template ready for 10:00 UTC post
- [ ] Prepare metrics table with placeholder values
- [ ] Confirm issue number (DCP-773 or similar) for posting

---

## Phase 1-4: Monitor During QA Testing (08:15-12:00 UTC)

### Continuous Monitoring (Every 30 seconds)

**Command to run in terminal:**
```bash
watch -n 30 'cat backend/logs/phase1-health-latest.json | jq ".checks"'
```

**Watch for:**
- ✅ All checks returning true (no ❌ marks)
- ✅ Models count staying at 11
- ✅ Providers count >0 (or >1 if any come online)
- ❌ Any CRITICAL alerts (API down, 0 providers)

### 15-Minute Spot Checks

**At 08:30, 08:45, 09:00, 09:15, etc. UTC:**

```bash
# Check health summary
echo "=== Health Check ===" && \
curl -s https://api.dcp.sa/api/health | jq '.' && \
echo "=== Metrics ===" && \
cat backend/logs/phase1-health-latest.json | jq '.checks'
```

### Escalation Detection

**CRITICAL (Immediate Action):**
- API returns 500+
- 0 providers online
- Health poller not updating (>5 min stale)
- Metering system errors

**HIGH (15 min response):**
- TTFT >2s for any model
- GPU utilization >99% or <20%
- Provider uptime <95%
- Token accuracy <95%

**MEDIUM (30 min response):**
- API latency p95 >500ms
- TTFT 1-2s range
- Provider uptime 90-95%
- Token accuracy 95-98%

---

## Pre-Test Status Report (Due by 09:00 UTC)

**Post to DCP-773:**

```markdown
## Phase 1 Day 4 — Pre-Test ML Infrastructure Status

**Time:** 2026-03-26 09:00 UTC
**Status:** ✅ READY or ⚠️ ISSUES

### Health Checks
- [ ] API Health: OK
- [ ] Models Online: 11/11
- [ ] Providers: ___  online
- [ ] Baselines Captured: Yes

### Baseline Metrics
- Cold-start: ___s (target <15s)
- TTFT: ___ms (target <300ms)
- GPU util: __% (target 70-95%)
- Provider uptime: __% (target >99.5%)

### Support Status
- Health poller running: ✅
- Baseline metrics ready: ✅
- Monitoring ready: ✅
- Standing by for testing: ✅

### Next Steps
- Continue monitoring per schedule
- Escalate any CRITICAL/HIGH alerts
- Post hourly updates if needed
```

---

## During QA Testing (09:00-11:30 UTC)

### Response Protocol

**If QA asks for help:**
1. Respond within 5 minutes
2. Provide specific metric/log reference
3. Suggest diagnostic command if unclear
4. Escalate to Backend if infrastructure issue

**If CRITICAL alert detected:**
1. Immediately post to DCP-773
2. Include exact error/metric value
3. Tag @QA Engineer if they need to pause tests
4. Provide recommended action

### Metric Tracking During Tests

Keep running tally:
```
Time | Cold-start | TTFT | GPU% | Uptime% | API-lat-p95
-----|------------|------|------|---------|----------
08:30|     9.1s   | 342ms|  75% |  99.8%  |   120ms
08:45|     9.3s   | 348ms|  78% |  99.8%  |   125ms
09:00|     9.2s   | 345ms|  76% |  99.9%  |   122ms
```

---

## Final Day 4 Report (11:30-12:00 UTC)

### Go/No-Go Assessment

**PASS (GO) if:**
- ✅ All 6 SLA metrics on target or acceptable
- ✅ No critical errors in logs
- ✅ Health poller stable (100% uptime)
- ✅ All endpoints responding <200ms
- ✅ Data integrity verified (no corruption)

**NO-GO (STOP) if:**
- ❌ Any metric in FAIL range
- ❌ CRITICAL errors in health logs
- ❌ Provider balance corruption
- ❌ Metering calculation errors
- ❌ API endpoints timing out

### Final Report to DCP-773

```markdown
## Phase 1 Day 4 — ML Infrastructure Final Report

**Status: ✅ PASS** or **🔴 NO-GO**

### Key Metrics (4-Hour Window)
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Cold-start | <15s | ___s | ✅/❌ |
| TTFT | <300ms | ___ms | ✅/❌ |
| Throughput | >45 tok/s | ___ tok/s | ✅/❌ |
| GPU util | 70-95% | __% | ✅/❌ |
| API latency (p95) | <200ms | ___ms | ✅/❌ |
| Provider uptime | >99.5% | __% | ✅/❌ |

### Observations
- [Performance stability, spikes, degradation notes]

### Health Poller Status
- Uptime: __% (target 100%)
- Data collection: ✅ continuous
- Errors: __ (target 0)

### Recommendation
[Proceed to Day 5 OR escalate for investigation]

**ML Infrastructure Ready:** ✅ YES / ❌ NO
```

---

## Post-Day-4 (If PASS)

- [ ] Archive Day 4 health logs to `backend/logs/day4-archive/`
- [ ] Prepare Day 5 baseline comparison file
- [ ] Reset monitoring for Day 5 execution
- [ ] Brief ML Infra team on Day 5 standby
- [ ] Get rest before Day 5 begins at 09:00 UTC

---

## Contacts & Resources

**Issue:** DCP-773 (Phase 1 Day 4 Testing)
**QA Lead:** @QA Engineer
**Backend:** @Backend Architect (if infrastructure issues)
**CEO:** @Founder (critical escalations only)

**Key Files:**
- SLA Thresholds: `docs/ml-infra/phase1-sla-thresholds.md`
- Monitoring Spec: `docs/ml-infra/phase1-monitoring-spec.md`
- Health Poller: `scripts/model-health-poller.mjs`
- Baselines: `docs/ml-infra/gpu-benchmark-baselines.md`

---

**Checklist Status:** READY
**Execution Date:** 2026-03-26 08:00 UTC
**Next Update:** During Day 4 testing
