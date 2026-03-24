# Phase 1 Monitoring Dashboard Specification

**Document Version:** 2026-03-24
**Phase 1 Timeline:** 2026-03-26 08:00 UTC (Day 4) to 2026-03-28 (Day 6)
**Purpose:** Define what to monitor, how to read metrics, and when to escalate during Phase 1 testing
**Audience:** QA Team, ML Infrastructure Engineer, DevOps, Founder

---

## Overview

Phase 1 will have 4–5 real renters deploying Arabic models on live infrastructure (api.dcp.sa). During Days 4–6, the monitoring team will track:

1. **API System Health** — uptime, request latency, error rates
2. **Model Serving Performance** — cold-start, inference latency, GPU utilization
3. **Provider Infrastructure** — heartbeat status, resource usage, network health
4. **Billing & Metering** — token counts, billing record accuracy, transaction logs
5. **Renter Experience** — deployment success, model availability, error messages

This spec explains how to read each metric and when to escalate to the founder.

---

## 1. API System Health Monitoring

### 1.1 Health Check Endpoint

**Endpoint:** `GET https://api.dcp.sa/api/health`

**Check Frequency:** Every 30 seconds during testing (automated via `scripts/phase1-health-monitor.mjs`)

**Sample Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-24T11:30:37.371Z",
  "db": "ok",
  "providers": {
    "total": 5,
    "online": 3,
    "offline": 2
  },
  "jobs": {
    "queued": 2,
    "running": 4,
    "failed": 0
  },
  "sweep": {
    "totalRuns": 1515,
    "sweepErrors": 0,
    "lastRunAt": "2026-03-24T11:30:13.557Z"
  }
}
```

**What Each Field Means:**
- `status: "ok"` — API is responding and healthy
- `db: "ok"` — Database connection working
- `providers.online` — Number of active providers (should grow Day 4 → Day 6)
- `jobs.running` — Active renter workloads
- `sweepErrors` — P2P network errors (target: 0)

**Acceptable Ranges:**
- Response time: <500ms
- Error rate: <1% of requests
- 99.5% uptime

**Action if Failed:**
- `status: "error"` → **CRITICAL** — Contact DevOps immediately
- `db: "error"` → **CRITICAL** — Database issue, page on-call
- `sweepErrors > 0` → **HIGH** — P2P network glitch, check logs
- Uptime < 99.5% → **HIGH** — Document outage, notify founder

---

### 1.2 API Request Latency Distribution

**Monitor:** Response time percentiles for all API endpoints

**Command:**
```bash
node scripts/api-latency-monitor.mjs \
  --sample-rate 0.1 \
  --interval 60s
```

**Expected Output:**
```
=== API Latency (last 60s) ===
GET /api/models
  p50: 42ms | p95: 180ms | p99: 320ms ✅
GET /api/health
  p50: 15ms | p95: 45ms | p99: 120ms ✅
POST /api/jobs
  p50: 280ms | p95: 650ms | p99: 1200ms ✅
GET /api/jobs/:id
  p50: 120ms | p95: 400ms | p99: 800ms ✅
```

**Acceptable Ranges:**
| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| GET /api/models | <100ms | <500ms | <1s |
| GET /api/health | <50ms | <200ms | <500ms |
| POST /api/jobs | <300ms | <700ms | <1.5s |
| GET /api/jobs/:id | <200ms | <500ms | <1s |

**Action if Exceeded:**
- p99 > 2s → **HIGH** — Investigate backend bottleneck, check DB slow query log
- Sustained increase → **MEDIUM** — Log and monitor; may indicate load scaling issue

---

## 2. Model Serving Performance Monitoring

### 2.1 Model Health Poller

**Location:** `scripts/model-health-poller.mjs` (merged in DCP-883)

**What it does:**
- Queries each model endpoint every 30 seconds
- Records TTFT, throughput, GPU utilization
- Writes to `infra/state/provider-health.json`

**Run During Phase 1:**
```bash
node scripts/model-health-poller.mjs \
  --interval 30s \
  --output infra/state/provider-health.json \
  --log scripts/logs/model-health-2026-03-26.log
```

**Sample Output (infra/state/provider-health.json):**
```json
{
  "timestamp": "2026-03-26T10:15:00Z",
  "models": [
    {
      "id": "llama-3-8b",
      "status": "online",
      "latency_ms": 287,
      "ttft_ms": 342,
      "throughput_tok_s": 45.7,
      "gpu_util_percent": 87,
      "vram_gb": 23.1,
      "temp_celsius": 72,
      "power_watts": 315,
      "batch_size": 1,
      "last_check_at": "2026-03-26T10:15:00Z"
    },
    {
      "id": "nemotron-nano-4b",
      "status": "online",
      "latency_ms": 145,
      "ttft_ms": 145,
      "throughput_tok_s": 89.4,
      "gpu_util_percent": 62,
      "vram_gb": 12.2,
      "temp_celsius": 58,
      "power_watts": 185,
      "batch_size": 4,
      "last_check_at": "2026-03-26T10:15:00Z"
    }
  ]
}
```

**Metrics to Watch:**
- `status` → Should be "online" for all models
- `latency_ms` (TTFT) → Should match SLA targets (see phase1-sla-thresholds.md)
- `gpu_util_percent` → Should be 50–95% during inference
- `temp_celsius` → Should stay <80°C (thermal throttling risk above 85°C)
- `power_watts` → Should match GPU TDP ±10% (RTX 4090 = 350W nominal)

**Acceptable Ranges:**
| Metric | Target | Acceptable | Fail |
|--------|--------|-----------|------|
| Model status | online | online | offline |
| TTFT | <500ms | <1s | >1.5s |
| GPU util | 70–95% | 50–99% | <20% or >99% |
| Temperature | <75°C | <85°C | >85°C (throttling) |

**Visualization Command (manual check):**
```bash
# Pretty-print health status
cat infra/state/provider-health.json | jq '.models[] | {id, status, latency_ms, gpu_util_percent, temp_celsius}'

# Or monitor live:
watch -n 5 'jq ".models[] | {id, latency_ms, gpu_util_percent}" infra/state/provider-health.json'
```

**Action if Failed:**
- Any model `status: "offline"` → **CRITICAL** — Check provider logs, restart model service
- TTFT > 1.5s → **HIGH** — Investigate GPU load, check for thermal throttling
- GPU util <20% → **MEDIUM** — Model may be stuck or unloaded; check provider heartbeat

---

### 2.2 Cold-Start Latency Baseline

**When to Measure:** Beginning of Day 4 (before prefetch deployment)

**Procedure:**
```bash
# 1. Clear all model caches
rm -rf /var/cache/models/*

# 2. Send first request to each model (cold-start)
for model in llama-3-8b qwen-2.5-7b nemotron-nano-4b; do
  time curl -X POST https://api.dcp.sa/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model": "'$model'", "messages": [{"role": "user", "content": "Hi"}]}'
done

# 3. Record times in Phase 1 SLA log
```

**Expected Results (with prefetch):**
| Model | Cold-Start (prefetch) | Cold-Start (no prefetch) |
|-------|----------------------|--------------------------|
| Llama-3-8B | 8–15s | 45–120s |
| Qwen2.5-7B | 8–10s | 40–100s |
| Nemotron-Nano-4B | 3–5s | 20–60s |

**Owner:** QA Team (Day 4, early morning)

---

### 2.3 Inference Latency Tracking

**Run During Each Day (4–6) of Phase 1:**

```bash
node scripts/benchmark-ttft.mjs \
  --models llama-3-8b,nemotron-nano-4b \
  --num-requests 50 \
  --prompt-tokens 256 \
  --output-file scripts/logs/ttft-phase1-day4.json
```

**Sample Output:**
```json
{
  "model": "llama-3-8b",
  "num_requests": 50,
  "ttft_percentiles": {
    "p50": 342,
    "p95": 520,
    "p99": 680
  },
  "throughput_tok_s": {
    "mean": 45.7,
    "min": 42.1,
    "max": 48.3
  },
  "test_timestamp": "2026-03-26T09:30:00Z"
}
```

**Comparison to SLA (see phase1-sla-thresholds.md):**
- p50: Should match baseline ±10% (e.g., 342ms Llama-3-8B → accept 308–376ms)
- p99: Should be <1s for Tier A (failure if >1.5s)

**Trend Analysis:**
- If TTFT increases >20% from Day 4 → Day 5, investigate model or GPU degradation
- If throughput decreases >20%, check batch size limits or queue depth

---

## 3. Provider Infrastructure Monitoring

### 3.1 Provider Heartbeat Status

**Endpoint:** Check `infra/state/provider-health.json` (from poller output)

**Example (expanded):**
```json
{
  "timestamp": "2026-03-26T10:15:00Z",
  "providers": [
    {
      "id": "provider-abc-xyz",
      "name": "Internet Cafe, Riyadh",
      "status": "online",
      "lastHeartbeatAt": "2026-03-26T10:14:55Z",
      "heartbeatInterval": 30,
      "uptime_percent": 99.8,
      "network_latency_ms": 12,
      "p2p_connected_peers": 5,
      "models": [
        { "id": "llama-3-8b", "status": "online", "gpu": "RTX 4090" },
        { "id": "nemotron-nano-4b", "status": "online", "gpu": "RTX 4090" }
      ]
    }
  ]
}
```

**Key Metrics:**
- `status` → Should be "online"
- `lastHeartbeatAt` → Should be <60s ago (if older, provider may be offline)
- `uptime_percent` → Should be >99% (acceptable >95%)
- `network_latency_ms` → Should be <50ms (Saudi data center)
- `p2p_connected_peers` → Should be ≥1 (network isolation risk if 0)

**Daily Check (automated):**
```bash
# QA to run hourly during Day 4-6:
node scripts/provider-uptime-check.mjs \
  --duration 24h \
  --report-file scripts/logs/provider-uptime-phase1-day4.json
```

**Acceptable Ranges:**
| Metric | Target | Acceptable | Fail |
|--------|--------|-----------|------|
| Provider online | >80% | >70% | <70% |
| Heartbeat latency | <50ms | <200ms | >500ms |
| P2P peers | ≥1 | ≥1 | 0 (isolated) |

**Action if Provider Offline:**
- Offline <30 min → **MEDIUM** — Monitor, may be transient
- Offline >1 hour → **HIGH** — Check provider network, ping IP
- Offline >4 hours → **CRITICAL** — Escalate to founder, consider provider replacement

---

### 3.2 Network Connectivity

**Command (run from coordinator):**
```bash
# Check P2P network health
node infra/p2p/network-health-check.mjs

# Expected output:
# P2P Network Status
# Active peers: 3/5 ✅
# Network latency (median): 15ms ✅
# Message delivery rate: 99.8% ✅
# Last sync: 2s ago ✅
```

**Metrics to Watch:**
- Active peers > 2 (redundancy requirement)
- Network latency <100ms (if higher, may indicate ISP issues)
- Message delivery rate >99% (packet loss)

---

## 4. Billing & Metering Monitoring

### 4.1 Token Count Verification

**Run Daily (morning + evening of Phase 1):**

```bash
node scripts/vllm-metering-smoke.mjs \
  --test-duration 300s \
  --expected-tokens 10000 \
  --output-file scripts/logs/metering-phase1-day4.json
```

**Sample Output:**
```json
{
  "test_timestamp": "2026-03-26T09:30:00Z",
  "test_duration_s": 300,
  "requests_sent": 150,
  "total_tokens_requested": 10000,
  "total_tokens_metered": 9987,
  "accuracy_percent": 99.87,
  "accuracy_range": "±0.13%",
  "failures": 0,
  "result": "PASS"
}
```

**Pass Criteria (from SLA thresholds):**
- Accuracy ≥98% (target ±2%)
- Failures = 0
- All billing records present in DB

**Failure Investigation:**
```bash
# If metering fails, check:
# 1. vLLM logs
tail -100 provider-logs/vllm-serve.log

# 2. Metering service logs
tail -100 /var/log/dc1/metering-service.log

# 3. Compare response tokens vs billing DB
sqlite3 db/billing.db "SELECT SUM(tokens) FROM billing_records WHERE created_at > datetime('now', '-1 hour')"

# 4. Check for dropped records
jq '.[] | select(.status != "recorded")' scripts/logs/metering-phase1-day4.json
```

**Action if Accuracy < 95%:**
- **CRITICAL** — Stop testing, investigate metering service
- Check DCP-895 (metering verification issue)
- May require token recount or billing adjustment

---

### 4.2 Billing Record Completeness

**Daily Audit (end of each Phase 1 day):**

```bash
# Query billing database for completeness
node scripts/billing-audit.mjs \
  --start-time "2026-03-26T08:00:00Z" \
  --end-time "2026-03-26T20:00:00Z" \
  --report-file scripts/logs/billing-audit-phase1-day4.json

# Expected output:
# Total jobs run: 47
# Total billing records: 47
# Missing records: 0
# Duplicates: 0
# Result: ✅ PASS
```

**Acceptable Ranges:**
- Missing records: 0% (100% billing capture)
- Duplicates: 0%
- Disputed records: 0

**Action if Records Missing:**
- < 1% missing → **LOW** — Acceptable, investigate after Phase 1
- 1–5% missing → **MEDIUM** — Fix in next release, track carefully
- > 5% missing → **CRITICAL** — Stop marketplace, investigate metering pipeline

---

## 5. Renter Experience Monitoring

### 5.1 Deployment Success Rate

**Track for Each Renter (Days 4–6):**

```bash
# Log template deployment outcomes
node scripts/log-deployments.mjs \
  --format json \
  --output scripts/logs/deployments-phase1-day4.json
```

**Sample Log Entry:**
```json
{
  "timestamp": "2026-03-26T09:15:00Z",
  "renter_id": "renter-xyz",
  "template": "vllm-serve-llama-3",
  "model": "meta-llama/Llama-3-8B-Instruct",
  "status": "success",
  "deployment_time_s": 45,
  "container_id": "abc123def456"
}
```

**Acceptable Success Rate:**
- 100% of deployments succeed (required)
- Deployment time: <120s (no-prefetch) | <30s (with prefetch)

**Action if Deployment Fails:**
- First failure → **HIGH** — Investigate, contact QA lead
- 2+ failures → **CRITICAL** — Pause testing, fix deployment pipeline

---

### 5.2 Error Message Tracking

**Collect During Phase 1 Testing:**

```bash
# Grep logs for renter-facing errors
grep -r "ERROR\|FAIL" /var/log/dc1/ \
  | grep -E "renter|deployment|model" \
  | tee scripts/logs/renter-errors-phase1-day4.log

# Expected: 0 renter-facing errors (internal errors OK if auto-recovered)
```

**Common Errors to Investigate:**
- "Model not found" → Catalog mismatch
- "GPU out of memory" → Batch size too high
- "Network timeout" → Provider connectivity issue
- "Billing record creation failed" → Metering service down

---

## 6. Escalation Matrix & Response Times

| Alert Level | Condition | Response Time | Owner | Action |
|-------------|-----------|---------------|-------|--------|
| **CRITICAL** | API down, DB error, metering broken, 0 providers online, deployment 100% fail rate | 5 min | ML Infra Eng + DevOps | Page on-call, investigate root cause, prepare rollback |
| **HIGH** | TTFT > 2s, uptime < 95%, token accuracy < 95%, 2+ deployment failures | 15 min | QA Lead + ML Infra Eng | Investigate, document impact, decide to continue or pause |
| **MEDIUM** | TTFT 1–2s, uptime 90–95%, accuracy 95–98%, 1 deployment failure | 30 min | QA Lead | Monitor trend, log, continue testing |
| **LOW** | TTFT <1s, uptime >95%, accuracy >98%, all deployments succeed | 60 min | QA Lead | Log metrics, proceed with testing |

**Escalation Chain:**
1. QA detects alert → logs in `scripts/logs/`
2. If CRITICAL → notify ML Infra Eng immediately (@mention in DCP-921 or Slack)
3. If HIGH → notify ML Infra Eng (message in Slack #ml-infrastructure)
4. If MEDIUM → add to daily standup
5. All issues → update DCP-921 issue comments with summary

---

## 7. Daily Standup Template (Use During Phase 1)

**Time:** 10:00 UTC each day (Day 4–6)
**Location:** DCP-921 issue comments

**Template:**
```markdown
## Day 4 Standup (2026-03-26)

### System Health
- API uptime: 99.8% ✅
- Providers online: 3/5
- Active jobs: 12

### Inference Performance
- Llama-3-8B TTFT p50: 328ms (target <500ms) ✅
- Nemotron-Nano-4B TTFT p50: 147ms (target <250ms) ✅
- GPU utilization: 75% average ✅

### Metering & Billing
- Token accuracy: 99.2% (target ±5%) ✅
- Billing records: 47/47 complete (0 missing) ✅

### Renter Experience
- Deployments: 12/12 successful (100%) ✅
- Avg deployment time: 42s ✅
- Errors: 0 renter-facing ✅

### Issues & Actions
- [Describe any alerts or investigations here]
- [Link to blocking issues]

### Next 24 Hours
- [What we're testing next]
- [Any preparations needed]
```

---

## 8. Real-Time Monitoring Dashboards (Nice-to-Have)

If time permits, set up these dashboards:

### Option A: Terminal-Based (using `watch`)
```bash
# Monitor all metrics in one terminal
watch -n 5 'echo "=== PHASE 1 MONITORING ===" && \
  echo "API Health: $(curl -s https://api.dcp.sa/api/health | jq .status)" && \
  echo "Providers Online: $(jq .providers[].status infra/state/provider-health.json | grep online | wc -l)" && \
  jq ".models[] | {id, ttft_ms, gpu_util_percent}" infra/state/provider-health.json'
```

### Option B: Manual Checks (every 30 min during testing)
```bash
# Run health check script
node scripts/phase1-health-monitor.mjs --check-interval 30m
```

### Option C: Log Aggregation (post-test analysis)
```bash
# After each day, compile metrics
node scripts/aggregate-phase1-metrics.mjs \
  --start-date 2026-03-26 \
  --end-date 2026-03-28 \
  --output-file scripts/logs/phase1-metrics-summary.json
```

---

## Related Issues & Scripts

- **DCP-883:** Model health poller (scripts/model-health-poller.mjs) ✅ MERGED
- **DCP-895:** vLLM metering verification (scripts/vllm-metering-smoke.mjs) — In review
- **DCP-921:** Phase 1 monitoring spec (this document)
- **SLA Thresholds:** docs/ml-infra/phase1-sla-thresholds.md
- **GPU Baselines:** docs/ml-infra/gpu-benchmark-baselines.md

---

## Appendix: Troubleshooting Commands

### Quick Health Check
```bash
# All-in-one health check
echo "=== API ===" && curl -s https://api.dcp.sa/api/health | jq '.status' && \
echo "=== Models ===" && jq '.models | length' infra/state/provider-health.json && \
echo "=== Providers ===" && jq '.providers | length' infra/state/provider-health.json
```

### Monitor GPU Directly
```bash
# SSH to provider and monitor
ssh provider-ip
watch -n 1 nvidia-smi
```

### Check vLLM Service
```bash
# On provider
pm2 list | grep vllm
pm2 logs vllm-llama --lines 50
```

### Check Metering Service
```bash
# On coordinator
ps aux | grep metering
tail -50 /var/log/dc1/metering-service.log
```

---

**Owner:** ML Infrastructure Engineer + QA Team
**Last Updated:** 2026-03-24
**Next Review:** After Phase 1 Day 4 (2026-03-26)
