# ML Infrastructure — Phase 1 Execution Procedures

**Owner:** ML Infrastructure Engineer (agent ID: 66668463-251a-4825-8a39-314000491624)
**Phase 1 Window:** 2026-03-26 08:00 UTC to 2026-03-28 23:59 UTC (Days 4, 5, 6)
**Pre-Flight:** 2026-03-25 23:00 UTC (T-1 hour)

---

## Overview

Phase 1 tests the complete DCP marketplace: provider registration → renter job dispatch → GPU execution → earnings settlement. ML Infrastructure is responsible for:

1. **Health monitoring** — vLLM endpoints, model cache, provider GPU connectivity
2. **Model serving validation** — Cold-start latency, throughput, metering accuracy
3. **Arabic portfolio readiness** — Tier A/B model pre-fetching, VRAM availability
4. **Escalation** — Real-time incident response if infrastructure degrades

---

## Phase 1 Day 4 (2026-03-26)

**Objective:** Verify infrastructure is ready for Day 5-6 renter testing

### Pre-Flight Checklist (23:00 UTC on 2026-03-25 — T-1 hour)

**15 minutes before Phase 1 start, complete:**

```bash
# Terminal 1: SSH to VPS
ssh root@76.13.179.86

# Check 1: PM2 services running
pm2 list
pm2 status dc1-provider-onboarding
pm2 status dc1-webhook

# Check 2: Docker daemon ready
docker ps
docker images | grep -E "llm-worker|sd-worker"

# Check 3: Model cache volume exists
docker volume ls | grep dcp-model-cache
df -h /opt/dcp/model-cache

# Check 4: PostgreSQL connectivity
psql -U dc1 -d dc1_platform -c "SELECT count(*) FROM providers;"

# Check 5: Backend health
curl http://localhost:8083/api/health
curl http://localhost:8083/api/models | head -20
```

**Success Criteria:**
- ✅ PM2 services: `online` status
- ✅ Docker daemon responding
- ✅ Model cache volume mounted
- ✅ PostgreSQL responding
- ✅ Backend health: `{ "status": "ok" }`

**If any check fails:** Post issue in Phase 1 coordination chat with:
- Failed check number
- Actual error output
- Recommended action

### Day 4 Morning (08:00-12:00 UTC)

**Objective:** Validate vLLM health and model availability

#### 4.1 Model Cache Validation

```bash
# Check model cache disk usage
du -sh /opt/dcp/model-cache
du -sh /opt/dcp/model-cache/hf

# Expected: < 90% of disk (trigger prefetch if > 85%)
# If disk pressure high: report in escalation channel

# List available models
ls -la /opt/dcp/model-cache/hf/ | head -20
```

**Success Criteria:**
- ✅ Disk usage < 85%
- ✅ Model files readable
- ✅ Ownership correct (dcp:dcp)

#### 4.2 vLLM Endpoint Health

```bash
# Test vLLM availability via API
curl -X GET "http://api.dcp.sa/api/models/vllm-serve/health"

# Expected response:
# {
#   "status": "ready",
#   "model": "nvidia/Nemotron-Mini-4B-Instruct",
#   "cuda_available": true,
#   "memory_mb": 8192,
#   "load_time_ms": 1234
# }
```

**Success Criteria:**
- ✅ HTTP 200 OK
- ✅ status: "ready"
- ✅ CUDA available: true
- ✅ Response time < 2 seconds

#### 4.3 Provider Capability Index

```bash
# Verify provider GPU catalog is populated
curl -X GET "http://api.dcp.sa/api/providers/capabilities?gpu_type=rtx_4090"

# Expected: List of 5+ providers with RTX 4090 capability
```

**Success Criteria:**
- ✅ HTTP 200 OK
- ✅ Response contains 5+ providers
- ✅ Each provider has: gpu_count, vram_gb, network_mbps

#### 4.4 Metering Integration Test

```bash
# Verify token counting is operational
curl -X POST "http://api.dcp.sa/api/jobs/validate-metering" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nvidia/Nemotron-Mini-4B-Instruct",
    "prompt": "Hello, what is machine learning?",
    "max_tokens": 100
  }'

# Expected response:
# {
#   "input_tokens": 8,
#   "output_tokens": 45,
#   "total_tokens": 53,
#   "cost_usd": 0.012
# }
```

**Success Criteria:**
- ✅ Token counts > 0
- ✅ Output tokens < max_tokens
- ✅ Cost calculated correctly

### Day 4 Afternoon (12:00-16:00 UTC)

**Objective:** Test end-to-end job dispatch and execution

#### 4.5 E2E Job Dispatch Test

```bash
# Submit a test job to a provider
curl -X POST "http://api.dcp.sa/api/jobs" \
  -H "Authorization: Bearer <renter-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nvidia/Nemotron-Mini-4B-Instruct",
    "prompt": "Explain quantum computing in one sentence.",
    "max_tokens": 50,
    "provider_id": "<active-provider-id>"
  }'

# Poll job status
curl -X GET "http://api.dcp.sa/api/jobs/<job-id>/status"

# Expected progression: submitted → assigned → executing → completed
```

**Success Criteria:**
- ✅ Job submitted successfully
- ✅ Status transitions through all phases
- ✅ Completion time < 30 seconds (cold-start acceptable)
- ✅ Output contains valid inference result

#### 4.6 Multi-Model Cold-Start Baseline

Run baseline benchmarks for Tier A models:

```bash
# Run via script (if available)
node scripts/benchmark-tier-a-coldstart.js

# OR manual test for each model:
# - nvidia/Nemotron-Mini-4B-Instruct
# - meta-llama/Llama-3-8B
# - mistralai/Mistral-7B
# - Qwen/Qwen2.5-7B
# - tiiuae/falcon-7b-instruct

# Expected: First request cold-start < 15s, subsequent < 2s
```

**Success Criteria:**
- ✅ All Tier A models load successfully
- ✅ Cold-start time logged
- ✅ Second request latency < 2s (cache hit)

### Day 4 Evening (16:00-23:59 UTC)

**Objective:** Monitor for stability and escalate issues

#### 4.7 Continuous Health Monitoring

**Run in background terminal:**

```bash
# Monitor backend logs for errors
pm2 logs dc1-provider-onboarding --err | grep -i "error\|exception\|fail"

# Monitor model cache pressure
watch -n 10 'du -sh /opt/dcp/model-cache && df -h /opt/dcp/model-cache'

# Monitor provider heartbeats
while true; do
  curl -s "http://api.dcp.sa/api/providers/status?limit=10" | \
    jq '.providers[] | {id, status, last_heartbeat}'
  sleep 30
done
```

**Watch for:**
- 🔴 Out-of-memory errors (OOM) in vLLM
- 🔴 Disk full (model cache > 95%)
- 🔴 Provider heartbeat timeouts
- 🔴 Job execution failures

**If issue detected:** Report immediately in Phase 1 escalation channel with:
- Timestamp
- Affected component (vLLM, cache, provider, job dispatch)
- Error message
- Recommended action

---

## Phase 1 Day 5 (2026-03-27)

**Objective:** Support active renter testing with real workloads

### 5.1 Morning Health Snapshot (08:00 UTC)

```bash
# Comprehensive infrastructure status
echo "=== INFRASTRUCTURE STATUS ==="
echo "Backend: $(curl -s http://api.dcp.sa/api/health | jq .status)"
echo "Active providers: $(curl -s http://api.dcp.sa/api/providers/status | jq '.providers | length')"
echo "Model cache: $(du -sh /opt/dcp/model-cache | cut -f1)"
echo "Disk usage: $(df -h /opt/dcp/model-cache | tail -1 | awk '{print $5}')"
echo "PostgreSQL: $(pg_isready -h localhost -U dc1 -d dc1_platform)"
```

### 5.2 Job Throughput Monitoring

Track job execution metrics throughout Day 5:

```bash
# Hourly snapshot of job metrics
curl -s "http://api.dcp.sa/api/metrics/jobs?window=1h" | jq '{
  total_jobs: .count,
  completed: .completed,
  failed: .failed,
  avg_latency_ms: .avg_latency_ms,
  p95_latency_ms: .p95_latency_ms,
  throughput_jobs_per_min: .throughput_jobs_per_min
}'
```

**Expected metrics:**
- ✅ Throughput: 10+ jobs/minute
- ✅ Completion rate: > 95%
- ✅ P95 latency: < 5 seconds (excluding cold-start)

### 5.3 Model Serving Performance

Monitor per-model performance:

```bash
curl -s "http://api.dcp.sa/api/metrics/models" | jq '.[] | {
  model: .name,
  requests: .request_count,
  avg_latency_ms: .avg_latency_ms,
  cache_hit_rate: .cache_hit_rate
}'
```

**Expected:**
- ✅ Cache hit rate > 70% (multiple users → multiple requests per model)
- ✅ Latency consistency across providers

### 5.4 Arabic Portfolio Validation

Validate Tier A + B model availability:

```bash
# Check model readiness across providers
curl -s "http://api.dcp.sa/api/models/portfolio-readiness" | jq '.tiers.tier_a[] | {
  model: .name,
  providers_available: .provider_count,
  readiness_pct: .readiness_percentage
}'

# Expected: All Tier A models available on 3+ providers
```

---

## Phase 1 Day 6 (2026-03-28)

**Objective:** Final validation before go/no-go decision

### 6.1 Token Metering Verification

Verify that token counts persist correctly across job lifecycle:

```bash
# Pull sample of completed jobs
curl -s "http://api.dcp.sa/api/jobs?status=completed&limit=20" | jq '.[] | {
  id: .job_id,
  model: .model,
  input_tokens: .metering.input_tokens,
  output_tokens: .metering.output_tokens,
  provider_reported_tokens: .provider_metering.total_tokens,
  token_match: (.metering.input_tokens + .metering.output_tokens == .provider_metering.total_tokens)
}'

# Expected: token_match == true for all jobs (100% accuracy)
```

**Success Criteria:**
- ✅ Input tokens logged correctly
- ✅ Output tokens logged correctly
- ✅ Provider-reported tokens match API count
- ✅ Zero token discrepancies across 20+ jobs

### 6.2 Cost Validation

Verify billing calculations are correct:

```bash
curl -s "http://api.dcp.sa/api/jobs?status=completed&limit=20" | jq '.[] | {
  job_id: .job_id,
  model: .model,
  tokens: (.metering.input_tokens + .metering.output_tokens),
  api_cost: .billing.cost_usd,
  expected_cost: ((.metering.input_tokens * 0.0001) + (.metering.output_tokens * 0.0003)),
  cost_match: ((.billing.cost_usd - expected_cost) < 0.001)
}'

# Check billing accuracy within $0.001 tolerance
```

**Success Criteria:**
- ✅ Cost matches token count × rate
- ✅ Renter charges deducted correctly
- ✅ Provider earnings calculated

### 6.3 Provider Earnings Settlement

Validate provider earnings are calculated:

```bash
# Check provider earnings ledger
curl -s "http://api.dcp.sa/api/providers/<provider-id>/earnings?period=phase1" | jq '{
  total_jobs: .job_count,
  total_tokens: .token_count,
  earnings_usd: .total_earnings,
  daily_rate: (.total_earnings / 3)
}'
```

**Success Criteria:**
- ✅ Earnings calculated for all active providers
- ✅ Per-job breakdown available
- ✅ Total earnings > $0 for active providers

### 6.4 Go/No-Go Readiness Assessment

Final infrastructure readiness:

```bash
echo "=== PHASE 1 ML INFRASTRUCTURE GO/NO-GO ==="
echo ""
echo "✅ vLLM health: READY"
echo "✅ Model cache: OPERATIONAL"
echo "✅ Job dispatch: FUNCTIONING"
echo "✅ Token metering: VERIFIED"
echo "✅ Provider earnings: CALCULATED"
echo "✅ Provider activation: 0 → X providers online"
echo ""
echo "RECOMMENDATION: GO for provider activation + Phase 2 planning"
```

---

## Escalation Matrix

| Issue | Severity | Immediate Action | Escalation |
|-------|----------|------------------|------------|
| vLLM endpoint down | 🔴 CRITICAL | Restart service via PM2 | P2P Network Engineer + DevOps |
| Model cache disk full | 🔴 CRITICAL | Clear oldest models, reduce prefetch | DevOps |
| Job dispatch failures > 5% | 🟠 HIGH | Check provider heartbeats | P2P Network Engineer |
| Token metering inaccurate | 🟠 HIGH | Validate vLLM counts vs. API | Backend Architect |
| Provider offline > 30min | 🟡 MEDIUM | Check network, restart provider docker | P2P Network Engineer |
| Model cold-start > 30s | 🟡 MEDIUM | Monitor VRAM pressure, optimize prefetch | ML Infrastructure |

---

## Success Criteria Summary

**Phase 1 ML Infrastructure is GO if:**

- ✅ Pre-flight checklist: 5/5 checks passing
- ✅ Day 4 health monitoring: Zero critical errors
- ✅ Day 5 job throughput: 10+ jobs/minute, > 95% completion
- ✅ Day 6 metering: 100% token accuracy across 20+ jobs
- ✅ Provider earnings: Calculated and accessible
- ✅ Escalation response: < 15 minutes per incident

**If any criterion fails:** Flag in go/no-go decision and defer Phase 2 to post-Phase-1 fixes.

---

## Communication Channels

- **Real-time:** Phase 1 coordination Slack channel
- **Status updates:** Hourly summaries (Days 5-6)
- **Escalations:** Immediate post in escalation thread
- **Final report:** Day 6 evening go/no-go assessment

---

## Appendix: Useful Commands

```bash
# Quick health check
curl -s http://api.dcp.sa/api/health && echo "✅ Backend UP"

# List all Tier A models
curl -s http://api.dcp.sa/api/models | jq '.[] | select(.tier == "a") | .name'

# Provider status
curl -s http://api.dcp.sa/api/providers/status | jq '.providers[] | {id, status, uptime_hours}'

# Job metrics snapshot
curl -s http://api.dcp.sa/api/metrics/jobs | jq '.summary'

# Model cache size
du -sh /opt/dcp/model-cache

# Disk usage warning
df -h /opt/dcp/model-cache | awk '{if (NR==2 && $5 > 85) print "⚠️  DISK PRESSURE"}'

# Backend logs
pm2 logs dc1-provider-onboarding --lines 100
```

---

**Owner:** ML Infrastructure Engineer
**Last Updated:** 2026-03-24 16:45 UTC
**Status:** Ready for Phase 1 execution
