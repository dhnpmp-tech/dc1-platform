# Phase 1 SLA Thresholds & Performance Targets

**Document Version:** 2026-03-24
**Phase 1 Timeline:** 2026-03-26 (Day 4) to 2026-03-28 (Day 6)
**Baseline Reference:** gpu-benchmark-baselines.md (RTX 4090 measured performance)
**Purpose:** Define QA pass/fail criteria for Phase 1 integration testing

---

## Executive Summary

Phase 1 testing (Days 4–6) will validate the DCP marketplace and model serving infrastructure with 4–5 real renters deploying and using Arabic models on live infrastructure. This document defines concrete SLA thresholds that QA will use in their go/no-go decision at each checkpoint.

**Key Thresholds:**
- Model cold-start: <30s (with prefetch) | >60s = FAIL
- Inference latency p50 (7B): <5s/100 tokens | >10s = FAIL
- GPU utilization: 50–95% | <20% or >99% = FAIL
- Token count accuracy: ±5% | >10% error = FAIL

---

## SLA Definition Framework

### 1. Cold-Start Latency (Model Load Time)

**What it measures:** Time from API request to first output token (includes model loading if not pre-warmed).

**Why it matters:** Renters expect responsive inference; long cold-starts create poor UX and trigger support issues.

| Scenario | Target | Acceptable | Fail |
|----------|--------|-----------|------|
| Cold-start with prefetch (fresh provider) | <15s | <30s | >60s |
| Cold-start no prefetch (cache miss) | <120s | <180s | >300s |
| Warm cache (model already loaded) | <1s | <3s | >5s |

**Measurement Method:**
```bash
time curl -X POST https://api.dcp.sa/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-3-8B-Instruct",
    "messages": [{"role": "user", "content": "Hello"}]
  }' | jq '.metadata.response_time_ms'
```

**Expected Range (RTX 4090 Baseline):**
- With prefetch: 8–15s (includes model load from disk)
- Without prefetch: 45–120s (includes download + load)
- Warm cache: <500ms to first token (just inference)

**Owner:** ML Infrastructure Engineer + QA Team

---

### 2. Inference Latency (TTFT + Generation Speed)

**What it measures:** Time-to-first-token (TTFT) + sustained throughput for generation.

**Why it matters:** Inference latency is the primary renter cost signal. High latency = low earning for providers, poor value for renters.

#### 2a. Time-to-First-Token (TTFT)

| Model Class | Target p50 | Acceptable p50 | Fail |
|-------------|-----------|----------------|------|
| Tier A (7B) | <300ms | <500ms | >1s |
| Tier A (4B Nemotron) | <150ms | <250ms | >500ms |
| Tier B (13B JAIS) | <600ms | <900ms | >1.5s |
| Tier B (Embeddings) | <150ms | <250ms | >500ms |

**Measurement Method:**
```bash
node scripts/benchmark-ttft.mjs \
  --model meta-llama/Llama-3-8B-Instruct \
  --num-requests 20 \
  --prompt-tokens 256
```

**Expected Values (RTX 4090):**
- ALLaM-7B: 315ms
- Falcon-H1-7B: 298ms
- Qwen2.5-7B: 287ms
- Llama-3-8B: 342ms
- Mistral-7B: 305ms
- Nemotron-Nano-4B: 145ms

#### 2b. Token Generation Throughput

| Model Class | Target | Acceptable | Fail |
|-------------|--------|-----------|------|
| Tier A (7B) | >45 tok/s | >35 tok/s | <20 tok/s |
| Tier A (4B) | >80 tok/s | >60 tok/s | <40 tok/s |
| Tier B (13B) | >35 tok/s | >25 tok/s | <15 tok/s |

**Measurement:**
```bash
node scripts/vllm-metering-smoke.mjs \
  --model llama-3-8b \
  --num-tokens 10000
```

**Owner:** QA Team (daily during Phase 1)

---

### 3. GPU Resource Utilization

**What it measures:** GPU/VRAM utilization during inference, thermal conditions, and power draw.

**Why it matters:** Misconfigured models waste electricity, reduce provider earnings, and can cause thermal throttling.

| Metric | Target | Acceptable | Fail |
|--------|--------|-----------|------|
| GPU Utilization | 70–95% | 50–99% | <20% or >99% |
| VRAM Usage | 75–90% of capacity | 60–95% | >99% or OOM |
| Memory Thermal Throttle | None | Occasional (<5% runtime) | Sustained |
| Power Draw | Within spec | ±10% | >20% above TDP |

**Measurement Commands:**
```bash
# During inference request, monitor:
nvidia-smi dmon -s pucvmet -n 100

# Expected output for Llama-3-8B on RTX 4090:
# GPU: 85-95%, VRAM: 23GB, Power: 320W, Temp: 70-75°C
```

**Owner:** DevOps + QA (real-time monitoring during Day 4-6)

---

### 4. Token Count Accuracy & Metering

**What it measures:** Difference between requested token count and actual metering in billing logs.

**Why it matters:** Inaccurate metering breaks billing trust for renters and providers; creates refund disputes.

| Metric | Target | Acceptable | Fail |
|--------|--------|-----------|------|
| Token count accuracy | ±2% of expected | ±5% | >10% error |
| Billing entry latency | <5 seconds | <30 seconds | >60 seconds |
| Missing billing records | 0% | <1% | >1% |

**Verification:**
```bash
# 1. Send request with known token count
curl -X POST https://api.dcp.sa/v1/completions \
  -d '{"model": "llama-3-8b", "prompt": "...", "max_tokens": 100}'

# 2. Check metering logs
node scripts/vllm-metering-smoke.mjs

# 3. Compare token_count in response vs billing record
# Expected: response.usage.completion_tokens == billing_record.tokens
```

**Reference Issue:** DCP-895 (vLLM metering verification)

**Owner:** ML Infrastructure Engineer + QA

---

### 5. Provider Heartbeat Uptime & Registration Stability

**What it measures:** Provider health checks, registration persistence, and provider heartbeat reliability.

**Why it matters:** If providers disappear from the marketplace, renters can't deploy workloads.

| Metric | Target | Acceptable | Fail |
|--------|--------|-----------|------|
| Provider heartbeat uptime | >99.5% | >95% | <90% |
| Registration persistence | 100% (no dropouts) | <1 dropout/day | >1 dropout/day |
| Health check latency | <500ms | <1s | >3s |

**Monitoring:**
```bash
# Check provider health index
cat infra/state/provider-health.json

# Expected structure:
# {
#   "providers": [
#     {
#       "id": "provider-xyz",
#       "status": "online",
#       "lastHeartbeat": "2026-03-24T11:30:00Z",
#       "capabilityIndex": { ... }
#     }
#   ]
# }
```

**Owner:** P2P Network Engineer + QA

---

## Estimated Baseline Latencies (Tier A Models on RTX 4090)

Based on `gpu-benchmark-baselines.md` measured performance:

| Model | TTFT (p50) | Throughput | Cold Start | VRAM |
|-------|-----------|-----------|-----------|------|
| ALLaM-7B | 315ms | 48.2 tok/s | 9.2s | 21.5 GB |
| Falcon-H1-7B | 298ms | 50.1 tok/s | 8.9s | 21.3 GB |
| Qwen2.5-7B | 287ms | 52.3 tok/s | 8.1s | 20.8 GB |
| Llama-3-8B | 342ms | 45.7 tok/s | 9.1s | 23.1 GB |
| Mistral-7B | 305ms | 49.8 tok/s | 8.5s | 21.9 GB |
| Nemotron-Nano-4B | 145ms | 89.4 tok/s | 3.8s | 12.2 GB |

**Notes:**
- All times measured on RTX 4090 with float16 precision
- Cold-start times assume prefetch enabled (reduce by ~50% from no-prefetch baseline)
- Throughput is batch=1 (conservative); scales linearly with batch size up to model limits
- VRAM allocated at model startup; headroom available for request batching

---

## Phase 1 QA Checkpoint Gates

### Day 4 (2026-03-26) — Pre-Test Validation
- ✅ All endpoints responding (health, models, templates)
- ✅ Provider heartbeat stable (0 online providers acceptable at start)
- ✅ Test infrastructure ready (scripts, monitoring, logs)
- **Go/No-Go:** Proceed if all 3 items pass

### Day 5 (2026-03-27) — Integration Testing Active
- **Metric 1:** Cold-start latency <30s (with prefetch)
- **Metric 2:** Inference latency p50 <500ms for Tier A models
- **Metric 3:** Token count accuracy ±5%
- **Metric 4:** GPU utilization 50–95%
- **Go/No-Go:** Pass if ≥3/4 metrics pass; reassess if <3 pass

### Day 6 (2026-03-28) — Final Validation & Load Testing
- **Metric 1:** Sustained inference latency (p99) <1s for Tier A
- **Metric 2:** Provider heartbeat uptime >95%
- **Metric 3:** No billing mismatches (token count accuracy ±2%)
- **Metric 4:** Handle 5+ concurrent renters without degradation
- **Go/No-Go:** Launch-ready if all 4 metrics pass; document gaps if any fail

---

## Troubleshooting Threshold Breaches

### If Cold-Start > 60s
1. Check if model is prefetched: `ls infra/models/`
2. Check disk I/O: `iostat -x 1` (look for %util > 80%)
3. Check network (if model downloaded): `nethogs` or `iftop`
4. **Action:** Re-run prefetch script or increase provider disk speed

### If TTFT > 1s
1. Check GPU utilization: Should be >80% (if <50%, model may not be loading properly)
2. Check thermal throttling: GPU clock should be at max (check with `nvidia-smi`)
3. Check queue length: Are other requests blocking? (vLLM log shows pending requests)
4. **Action:** Reduce batch size or add GPU memory constraint

### If Token Count Mismatch > 10%
1. Check metering script: `node scripts/vllm-metering-smoke.mjs --debug`
2. Cross-check response tokens: `curl ... | jq '.usage.completion_tokens'`
3. Check billing DB: `SELECT * FROM billing_records WHERE job_id='...'`
4. **Action:** File DCP-895 blocker or restart metering service

### If Provider Heartbeat Downtime > 5%
1. Check network connectivity: `ping provider-ip`
2. Check provider service: `pm2 list` on provider
3. Check coordinator logs: `/var/log/dc1/coordinator.log`
4. **Action:** Reboot provider or restart heartbeat service

---

## Alerting & Escalation

| Condition | Severity | Action | Owner |
|-----------|----------|--------|-------|
| Any metric > FAIL threshold | CRITICAL | Pause testing, investigate | ML Infra Eng |
| ≥2 metrics in Acceptable range | HIGH | Document, continue monitoring | QA Lead |
| 1 metric in Acceptable range | MEDIUM | Note, proceed | QA Lead |
| All metrics Target or better | LOW | Continue, collect data | QA Lead |

---

## Related Issues & Documentation

- **DCP-883:** Model health poller (merged, commit 11dccd4)
- **DCP-895:** vLLM metering verification (in_review)
- **DCP-832:** GPU benchmarking (completed)
- **DCP-921:** This task (Phase 1 monitoring spec)
- **Benchmark Reference:** `docs/ml-infra/gpu-benchmark-baselines.md`
- **Provider Health:** `infra/state/provider-health.json`
- **Monitoring Script:** `scripts/model-health-poller.mjs`
- **Metering Script:** `scripts/vllm-metering-smoke.mjs`

---

**Owner:** ML Infrastructure Engineer (DCP-921)
**Last Updated:** 2026-03-24
**Next Review:** After Phase 1 Day 4 execution (2026-03-26)
