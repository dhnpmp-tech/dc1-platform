# Model Cold-Start Benchmarks

## Overview

Cold-start latency is the time from job submission to first token generation. This is the #1 UX complaint for GPU marketplaces and the primary reason DCP implements model pre-fetching.

This document provides:
1. **Cold-start times** with pre-fetched weights (typical for DCP)
2. **Warm-start times** (model already in memory from prior inference)
3. **Cold pull times** (weights downloaded from Hugging Face Hub; reference only—DCP providers should pre-fetch)

All measurements are **estimates based on hardware specs** (actual benchmarks pending live provider deployment).

---

## Tier A Models — Cold-Start Comparison

### Summary Table

| Model | Size | Pre-fetch Load | Cold Pull | Warm Start | RTX 4090 P95 | Notes |
|-------|------|---|---|---|---|---|
| Nemotron 4B | 4B | 3.1s | 12s | 0.3s | 450ms | Fastest; ideal for instant tier |
| Mistral 7B | 7B | 5.5s | 18s | 0.5s | 650ms | High throughput; real-time APIs |
| ALLaM 7B | 7B | 6.2s | 20s | 0.6s | 750ms | Best Arabic formal; government docs |
| Falcon H1 7B | 7B | 5.9s | 19s | 0.5s | 700ms | Dialogue optimized; conversational |
| Qwen 2.5 7B | 7B | 6.8s | 21s | 0.7s | 850ms | LoRA-capable; multilingual |
| Llama 3 8B | 8B | 7.1s | 22s | 0.8s | 900ms | Largest; best quality |

### Key Insights

**Pre-fetch vs Cold Pull Impact:**
- Pre-fetched: Model loads from local NVMe SSD (30-90 min one-time setup)
- Cold pull: Model downloaded from Hugging Face (15-25 MB/s, per request)
- **DCP target:** All providers pre-fetch; cold pull is reference only

**Load Time Breakdown** (RTX 4090, pre-fetched, ALLaM 7B example):
```
1. Docker container startup       → 1.2s
2. vLLM initialization            → 1.8s
3. Model weight loading from SSD  → 2.1s
4. CUDA kernel warmup             → 1.1s
---
Total pre-fetch load time         → 6.2s
```

**Warm Start (same GPU, second request):**
- Model already in VRAM; skip steps 2-3 above
- **Warm latency:** 0.1-0.2s (tokenization + inference only)

---

## Detailed Benchmarks by Model

### 1. Nemotron Mini 4B — Instant-Tier Candidate

**Pre-Fetch Scenario** (weights cached on NVMe SSD)
```
Cold Start (first job):    3.1s
├─ Docker startup:         0.8s
├─ vLLM init:              0.7s
├─ Model load from SSD:    1.2s
├─ CUDA warmup:            0.4s
Warm Start (same GPU):     0.3s (model in VRAM)
```

**Cold Pull Scenario** (weights from Hugging Face, 100 Mbps)
```
Cold Start:               12.0s
├─ Model download:        8.5s (4 GB model @ 500 Mbps = 8.5s; capped by network)
├─ Load + init:           2.1s
├─ CUDA warmup:           0.4s
├─ Warm Start:            0.3s
```

**Hardware Comparison**
| GPU | Cold Start | Warm Start | Notes |
|-----|---|---|---|
| RTX 4090 | 3.1s | 0.3s | Target tier |
| RTX 4080 | 3.6s | 0.4s | 10% slower (lower PCIe bandwidth) |
| RTX 4070 | 4.0s | 0.4s | More constrained |
| H100 | 1.9s | 0.2s | 40% faster (NVLink) |

**Renter Experience:**
- Submit job: `t=0s`
- First token: `t=3.1s` (pre-fetch) or `t=12.0s` (cold pull)
- Continuous streaming: 180 tok/s = 1 token every 5.5ms

---

### 2. Mistral 7B Instruct — Speed Champion

**Pre-Fetch Scenario**
```
Cold Start:               5.5s
├─ Docker startup:        1.0s
├─ vLLM init:             1.5s
├─ Model load from SSD:   1.8s
├─ CUDA warmup:           0.5s
├─ First token:           0.7s
Warm Start:               0.5s
```

**Performance Profile**
- **Throughput:** 158 tok/s on RTX 4090
- **Batch latency:** 100 tokens in 635ms (ideal for real-time APIs)
- **Typical use:** Streaming chatbot, real-time translation

**Network Comparison** (cold pull scenarios)
| Network | Download Time | Total Cold Start |
|---------|---|---|
| 100 Mbps | 10.2s | 15.5s |
| 50 Mbps | 20.4s | 25.9s |
| 25 Mbps | 40.8s | 46.3s |
| Pre-fetch | — | 5.5s |

**Renter Cost Impact** (Mistral on RTX 4090, $0.267/hour)
- Pre-fetch path: 5.5s load = $0.00041 cost for load alone
- Cold pull path: 25.9s load = $0.00192 cost (4.7x higher!)

---

### 3. ALLaM 7B — Formal Arabic

**Pre-Fetch Scenario**
```
Cold Start:               6.2s
├─ Docker startup:        1.2s
├─ vLLM init:             1.7s
├─ Model load from SSD:   2.1s
├─ CUDA warmup:           0.6s
├─ First token:           0.6s
Warm Start:               0.6s
```

**Government/Legal Optimization**
- Pre-fetch assumes 100 Mbps+ NVMe SSD (typical enterprise)
- Long context (4K tokens): batch size up to 8 concurrent renames
- Arabic quality metric: >95% accuracy on formal government documents

**Multi-Document RAG Use Case**
```
Scenario: Renter processing 10 government circulars (50KB each)
├─ Cold start (first doc):      6.2s
├─ Process 10 docs (2.5s each): 25.0s
├─ Total end-to-end:            31.2s
├─ Cost:                         31.2s × $0.267/hour = $0.0023
```

---

### 4. Falcon H1 7B — Dialogue Specialist

**Pre-Fetch Scenario**
```
Cold Start:               5.9s
├─ Docker startup:        1.1s
├─ vLLM init:             1.6s
├─ Model load from SSD:   1.9s
├─ CUDA warmup:           0.5s
├─ First token:           0.8s
Warm Start:               0.5s
```

**Conversational Streaming** (Falcon excels at parallel inference)
- Batch size: 8 concurrent conversations
- Per-conversation latency: 5.9s cold start + streaming 152 tok/s
- Typical chatbot interaction: cold start once per conversation, then stream

**Benchmark: Multi-Turn Conversation**
```
Turn 1 (cold start):  5.9s + 3 token gen (55ms) = 6.0s
Turn 2-10 (warm):     0.5s + streaming = <1s per turn
Total 10-turn convo:  6.0s + 9×0.8s = 13.2s user latency
```

---

### 5. Qwen 2.5 7B — Multilingual+LoRA

**Pre-Fetch Scenario**
```
Cold Start:               6.8s
├─ Docker startup:        1.1s
├─ vLLM init:             1.8s
├─ Model load from SSD:   2.2s
├─ LoRA adapter load:     0.8s (if renter uses adapter)
├─ CUDA warmup:           0.6s
├─ First token:           0.3s
Warm Start:               0.7s
```

**LoRA-Enabled Variant**
- If renter provides custom LoRA adapter (fine-tuned weights):
  - Load time increases by 0.8s
  - First token unchanged
- Benefit: Renter can customize without full retraining

**RAG-Specific Optimization**
- Qwen 2.5 excels at long-context retrieval (8K tokens)
- Batch size: 6-8 concurrent retrieval queries
- Ideal for: Technical documentation RAG, codebase search

---

### 6. Llama 3 8B — Balanced Quality

**Pre-Fetch Scenario**
```
Cold Start:               7.1s
├─ Docker startup:        1.2s
├─ vLLM init:             1.8s
├─ Model load from SSD:   2.5s (largest model; 8B params)
├─ CUDA warmup:           0.8s
├─ First token:           0.8s
Warm Start:               0.8s
```

**Quality vs Speed Tradeoff**
- Longest cold start (7.1s) but best Arabic quality
- Recommended for: batch processing, document analysis (where cold start is amortized)
- P95 latency: 900ms (most consistent performance)

**Batch Processing Example**
```
Scenario: Renter analyzes 100 documents
├─ Cold start:           7.1s (once)
├─ Per-document:         ~2.5s (512 tokens @ 200 tok/s)
├─ Total 100 docs:       7.1s + 250s = ~257s
├─ Cost:                 257s × $0.267/hour = $0.019
├─ Per-document cost:    $0.00019
```

---

## Cold-Start Breakdown by Component

### What Takes the Most Time?

**Model Weight Loading** (dominant factor)
- Nemotron 4B: ~1.2s (4 GB from SSD @ 3.5 GB/s)
- Llama 3 8B: ~2.5s (8 GB from SSD @ 3.2 GB/s)
- Dependency: SSD bandwidth (NVMe required)

**vLLM Initialization**
- Tokenizer loading: ~0.5s
- vLLM runtime setup: ~1.2s
- Fixed overhead: ~1.7s per model

**Docker Container Overhead**
- Startup time: 0.8-1.2s
- Varies by base image size and init complexity

**CUDA Kernel Warmup**
- First matmul operation: ~0.5s
- Subsequent ops: cached kernels

### Optimization Levers

| Factor | Current | Optimization | Impact |
|--------|---------|---|---|
| Storage | NVMe SSD | Dedicated NVMe (PCIe 4.0) | -10-15% load time |
| CPU | 8 core | Higher core count | -5-10% vLLM init |
| Docker | Standard image | Distroless / slim | -5% |
| Model | Full precision | Quantization (4-bit) | -30% load, -10% quality |

---

## Cold-Start Service Level Targets

### DCP Target SLAs

| Model | Tier | P50 | P95 | P99 |
|-------|------|-----|-----|-----|
| Nemotron 4B | Instant | 3.1s | 4.2s | 5.0s |
| Mistral 7B | Premium | 5.5s | 7.0s | 8.2s |
| ALLaM 7B | Premium | 6.2s | 8.1s | 9.5s |
| Falcon H1 7B | Standard | 5.9s | 7.8s | 9.0s |
| Qwen 2.5 7B | Standard | 6.8s | 8.9s | 10.5s |
| Llama 3 8B | Standard | 7.1s | 9.3s | 11.0s |

**Renters should expect:**
- Pre-fetched models: 3-7s cold start
- Cold pull models: 12-25s (plan accordingly or pre-fetch yourself)
- Warm start (model in memory): 0.3-0.8s

---

## Pre-Fetch vs Cold Pull Economics

### Cost Comparison (RTX 4090, $0.267/hour)

**Single Document Processing**
```
Pre-fetch path:
├─ Cold start load:  6.2s × $0.267/hr = $0.00046
├─ Processing:       2.5s × $0.267/hr = $0.00019
└─ Total:            $0.00065

Cold pull path (20s download):
├─ Cold start load:  26.2s × $0.267/hr = $0.00195
├─ Processing:       2.5s × $0.267/hr = $0.00019
└─ Total:            $0.00214
```

**Provider Advantage:**
Pre-fetch reduces job cost by **68%** for single small jobs. Savings increase with batch size.

---

## Methodology Notes

- **Estimates based on:**
  - Hardware specs (VRAM, PCIe bandwidth, SSD speed)
  - vLLM profiling on similar models
  - Hugging Face Hub network benchmarks
- **Not included:** Network latency to DCP API, renter's application overhead
- **Live benchmarks:** To be collected after first 10+ providers go live

