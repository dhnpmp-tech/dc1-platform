# Sprint 27: Inference Benchmarks — Tier A Models

**Date:** 2026-03-23
**Status:** BENCHMARK PLAN READY (execution pending GPU access)

## Overview

This document specifies benchmark methodology and target metrics for all Tier A Arabic models. Benchmarks validate that production inference meets latency and throughput targets for Arabic workloads.

---

## Benchmark Methodology

### Test Configuration
- **Inference Server:** vLLM (v0.4+) with flash-attention-2
- **Quantization:** BF16 or FP16 (no quantization loss)
- **Batch Size:** 1 (interactive latency) and 32 (throughput)
- **Sequence Length:** 512 input tokens, 256 output tokens
- **Test Corpus:** Mixed Arabic queries (Saudi MSA, legal, financial, technical)
- **Warm-up Runs:** 5 per model (to stabilize GPU clocks)
- **Measurement Runs:** 20 per model per config
- **Timeout:** 5 minutes per test (graceful exit on timeout)

### Metrics Collected
1. **End-to-End Latency (ms):**
   - Batch size 1: p50, p75, p95, p99
   - Batch size 32: throughput (tokens/sec)

2. **Cold-Start Latency (ms):**
   - Time from container start to first inference complete
   - Includes model load, CUDA init, first token generation

3. **Warm-Start Latency (ms):**
   - Time from model cached in VRAM to inference complete
   - Demonstrates production steady-state performance

4. **Token Throughput (tokens/sec):**
   - Batch 32: total tokens generated / wall-clock time
   - Normalized to single-stream equivalent

5. **VRAM Usage (GB):**
   - Peak allocation during inference
   - Batch size 1 and 32

6. **Arabic vs. English Comparison:**
   - Token count: English vs. Arabic for same semantic content
   - Latency: identical prompt → Arabic output vs. English output
   - Quality: human evaluation (3-point scale)

---

## Target Metrics

### Tier A Models (Hot Cache)

#### 1. ALLaM 7B
**Batch Size 1 (Interactive Latency)**
| Metric | Target | Acceptable Range |
|--------|--------|------------------|
| **P50 Latency** | 850ms | 700-1000ms |
| **P95 Latency** | 1300ms | 1100-1500ms |
| **P99 Latency** | 1800ms | 1500-2100ms |
| **VRAM Usage** | 24 GB | <25 GB |

**Batch Size 32 (Throughput)**
| Metric | Target | Acceptable Range |
|--------|--------|------------------|
| **Throughput** | 40 tokens/sec | 35-45 tokens/sec |
| **VRAM Usage** | 24 GB | <25 GB |

**Cold-Start Latency**
| Stage | Target (ms) | Notes |
|-------|------------|-------|
| Container start → model load | 4000 | CUDA initialization |
| Model load → first token | 5500 | Prefill of prompt |
| **Total Cold-Start** | **9500** | Post-prefetch scenario |

**Arabic Quality (Target)**
| Aspect | Target |
|--------|--------|
| Arabic fluency (human eval) | 3/3 (fluent) |
| Factuality (legal queries) | >85% accurate |
| Supports Sharia concepts | Yes |

---

#### 2. Falcon H1 7B
**Batch Size 1**
| Metric | Target | Range |
|--------|--------|-------|
| **P50 Latency** | 750ms | 600-900ms |
| **P95 Latency** | 1200ms | 1000-1400ms |
| **P99 Latency** | 1700ms | 1400-2000ms |
| **VRAM Usage** | 24 GB | <25 GB |

**Batch Size 32**
| Metric | Target | Range |
|--------|--------|-------|
| **Throughput** | 42 tokens/sec | 37-47 tokens/sec |
| **VRAM Usage** | 24 GB | <25 GB |

**Cold-Start:** 9000ms

---

#### 3. Qwen 2.5 7B
**Batch Size 1**
| Metric | Target | Range |
|--------|--------|-------|
| **P50 Latency** | 650ms | 550-750ms |
| **P95 Latency** | 950ms | 800-1100ms |
| **P99 Latency** | 1400ms | 1200-1600ms |
| **VRAM Usage** | 16 GB | <17 GB |

**Batch Size 32**
| Metric | Target | Range |
|--------|--------|-------|
| **Throughput** | 50 tokens/sec | 45-55 tokens/sec |
| **VRAM Usage** | 16 GB | <17 GB |

**Cold-Start:** 8000ms

---

#### 4. Llama 3 8B
**Batch Size 1**
| Metric | Target | Range |
|--------|--------|-------|
| **P50 Latency** | 700ms | 600-800ms |
| **P95 Latency** | 1100ms | 900-1300ms |
| **P99 Latency** | 1600ms | 1300-1900ms |
| **VRAM Usage** | 16 GB | <17 GB |

**Batch Size 32**
| Metric | Target | Range |
|--------|--------|-------|
| **Throughput** | 48 tokens/sec | 43-53 tokens/sec |
| **VRAM Usage** | 16 GB | <17 GB |

**Cold-Start:** 9000ms

---

#### 5. Mistral 7B
**Batch Size 1**
| Metric | Target | Range |
|--------|--------|-------|
| **P50 Latency** | 600ms | 500-700ms |
| **P95 Latency** | 1000ms | 850-1150ms |
| **P99 Latency** | 1500ms | 1200-1800ms |
| **VRAM Usage** | 16 GB | <17 GB |

**Batch Size 32**
| Metric | Target | Range |
|--------|--------|-------|
| **Throughput** | 52 tokens/sec | 47-57 tokens/sec |
| **VRAM Usage** | 16 GB | <17 GB |

**Cold-Start:** 8500ms

---

#### 6. Nemotron Nano 4B
**Batch Size 1**
| Metric | Target | Range |
|--------|--------|-------|
| **P50 Latency** | 350ms | 300-400ms |
| **P95 Latency** | 600ms | 500-700ms |
| **P99 Latency** | 900ms | 700-1100ms |
| **VRAM Usage** | 8 GB | <9 GB |

**Batch Size 32**
| Metric | Target | Range |
|--------|--------|-------|
| **Throughput** | 60 tokens/sec | 55-65 tokens/sec |
| **VRAM Usage** | 8 GB | <9 GB |

**Cold-Start:** 4000ms (fastest due to smallest model)

---

## Test Queries (Arabic + English Comparison)

### Query Set 1: Legal/Compliance (Saudi Context)

**Arabic Query:**
```
ما هي متطلبات الامتثال لشركة أجنبية وفقاً لقانون الضريبة السعودي لعام 2024؟
```
(What are the compliance requirements for a foreign company under Saudi tax law 2024?)

**Expected Output Length:** 150-200 tokens
**Domain:** Financial/Legal
**Complexity:** High (requires domain knowledge)

### Query Set 2: Technical Documentation

**Arabic Query:**
```
اشرح كيفية استخدام واجهة برمجية RESTful في تطبيق Node.js باستخدام Express.js.
```
(Explain how to use a RESTful API interface in a Node.js application using Express.js.)

**Expected Output Length:** 100-150 tokens
**Domain:** Technical
**Complexity:** Medium

### Query Set 3: General Knowledge

**Arabic Query:**
```
ما هي أهم المدن السياحية في المملكة العربية السعودية وما يميز كل منها؟
```
(What are the most important tourist cities in Saudi Arabia and what makes each distinctive?)

**Expected Output Length:** 150-200 tokens
**Domain:** General Knowledge
**Complexity:** Low

---

## English Comparison (Same Queries Translated)

For token count comparison:

**English Query (same semantic):**
```
What are the compliance requirements for a foreign company under Saudi tax law 2024?
```

**Expected Output Length:** 120-150 tokens (English is more concise)

**Token Ratio:** Arabic typically requires 1.2-1.4x tokens vs. English for same content

---

## Benchmark Execution Plan

### Phase 1: Local Dry-Run (No GPU Required)
- [x] Define metrics and targets
- [x] Prepare test queries
- [x] Document methodology
- [ ] Validate benchmark script (placeholder repo paths)

### Phase 2: GPU Execution (Requires vLLM + GPU)
1. Spin up vLLM server with Tier A model
2. Execute warmup runs (5 iterations)
3. Execute measurement runs (20 iterations per batch size)
4. Collect latency + VRAM histograms
5. Repeat for each model

### Phase 3: Analysis
- Compare P50/P95/P99 against targets
- Flag any "red" metrics (outside acceptable range)
- Generate comparative charts: Arabic vs. English latency
- Calculate speedup: Nemotron Nano vs. ALLaM (cost-benefit)

### Phase 4: Delivery
- Create summary table (6 models × 6 metrics)
- Produce per-model flame graphs / latency histograms
- Document any deviations from targets
- Recommend model selection per use case

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| All Tier A models meet P95 targets (within range) | Pending execution |
| Arabic quality validation (fluency/factuality) | Pending execution |
| Throughput targets met for batch 32 | Pending execution |
| Cold-start latency < 10 seconds | Pending execution |
| VRAM usage within spec | Pending execution |

---

## References

- **vLLM Docs:** https://docs.vllm.ai/
- **Flash Attention:** https://github.com/dao-ailab/flash-attention
- **Portfolio Config:** `infra/config/arabic-portfolio.json`
- **Benchmark Script:** `scripts/benchmark-arabic-rag.sh` (to be created)

---

**Document Version:** 1.0
**Status:** Ready for GPU execution
**Last Updated:** 2026-03-23 15:25 UTC
