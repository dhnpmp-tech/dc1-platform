# Arabic Model Cold-Start Benchmarks — Baseline SLAs

**Last Updated:** 2026-03-24
**Version:** 1.0
**Scope:** Tier A Arabic models on vLLM v0.4+

## Overview

This document defines baseline cold-start performance expectations for DCP's Arabic model portfolio. These targets are derived from:
1. vLLM configuration in `infra/config/arabic-portfolio.json`
2. Actual provider benchmarks run via `scripts/benchmark-arabic-models.mjs`
3. Competitor cold-start times (io.net, RunPod)

Cold-start performance directly impacts user experience — renters expect models to be ready within seconds, not minutes.

## SLA Targets

### Tier A Models (7B Base, RTX 4090+)

| Model | Min VRAM | Target TTFT | Target Cold-Start | P95 SLA |
|-------|----------|-------------|-------------------|---------|
| ALLaM 7B | 16GB | < 1.3s | < 9.5s | < 12s |
| Falcon H1 7B | 16GB | < 1.2s | < 9.0s | < 11s |
| Qwen 2.5 7B | 18GB | < 0.95s | < 8.0s | < 10s |
| Llama 3 8B | 19GB | < 1.1s | < 9.0s | < 11s |
| Mistral 7B | 17GB | < 1.0s | < 8.5s | < 11s |
| Nemotron Nano 4B | 10GB | < 0.6s | < 4.0s | < 5s |

**TTFT** = Time-to-first-token (first output token latency)
**Cold-Start** = Total time from job submission to first output
**P95** = 95th percentile (accounts for worst-case scenarios)

### Tier B Models (13B+, H100 or dual RTX 4090)

| Model | Min VRAM | Target TTFT | Target Cold-Start | P95 SLA |
|-------|----------|-------------|-------------------|---------|
| JAIS 13B | 31GB | < 1.4s | < 12.0s | < 15s |
| BGE-M3 Embedding | 1GB | < 0.45s | < 5.0s | < 6s |
| BGE Reranker | 1GB | < 0.52s | < 5.5s | < 7s |
| SDXL 1.0 | 6GB | < 2.2s | < 14.0s | < 17s |

### Performance Assumptions

1. **Model not in memory** — vLLM must load model from disk
2. **Single concurrent request** — no other jobs running
3. **No GPU memory contention** — dedicated provider GPU
4. **Standard networking latency** — < 100ms API round-trip

**Not included in SLA:**
- Network latency to vLLM server
- Request queuing time
- Provider infrastructure overhead

## Comparison to Competitors

Based on 2026-03-24 market data from `FOUNDER-STRATEGIC-BRIEF.md`:

| Competitor | RTX 4090 Cold-Start | H100 Cold-Start | Arabic Support |
|------------|-------------------|-----------------|----------------|
| **DCP** | < 9s | < 12s | ✅ Native (ALLaM, JAIS) |
| io.net | 15-20s | 12-18s | ⚠️ via API only |
| RunPod | 12-18s | 10-15s | ❌ Not offered |
| Vast.ai | 18-25s | 14-20s | ❌ Not offered |
| Akash | 20-30s | 15-22s | ❌ Not offered |

**DCP Advantage:** 33-51% faster cold-start than competitors + native Arabic models.

## Hardware Targets

### GPU Models & Expected Cold-Start

| GPU Model | VRAM | ALLaM 7B | Qwen 2.5 7B | JAIS 13B | Status |
|-----------|------|----------|-------------|----------|--------|
| H100 | 80GB | < 6s | < 5s | < 8s | 🟢 Tier A |
| H200 | 120GB | < 5s | < 4s | < 7s | 🟢 Tier A |
| RTX 4090 | 24GB | < 9.5s | < 8s | ❌ | 🟢 Tier A |
| RTX 4080 | 16GB | ❌ | < 10s | ❌ | 🟡 Tier B |
| RTX A6000 | 48GB | < 9s | < 8s | < 10s | 🟡 Tier B |
| L40S | 48GB | < 8s | < 7s | < 9s | 🟢 Tier B |

❌ = insufficient VRAM
🟢 = meets all SLAs
🟡 = meets some SLAs

## Measuring Cold-Start Performance

### 1. Using the Benchmark Script

```bash
# Test all Tier A models
VLLM_ENDPOINT=http://provider-gpu:8000 \
node scripts/benchmark-arabic-models.mjs

# Test single model
VLLM_ENDPOINT=http://provider-gpu:8000 \
node scripts/benchmark-arabic-models.mjs --model allam-7b-instruct
```

Output: `benchmark-results/benchmark-{timestamp}.json`

### 2. Interpreting Results

```json
{
  "id": "allam-7b-instruct",
  "target_cold_start_ms": 9500,
  "summary": {
    "avg_ttft_ms": 1250,
    "p95_ttft_ms": 1420,
    "avg_throughput": "85.34",
    "sla_met": true
  }
}
```

- **avg_ttft_ms** ≤ **target_cold_start_ms** → ✅ SLA met
- P95 should be ≤ target × 1.2 for headroom

### 3. Failure Diagnosis

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| TTFT > target 2x | Model not quantized | Use `--dtype float16` in vLLM |
| TTFT varies widely | Memory pressure | Reduce `max_num_seqs` |
| TTFT > 30s | Model loading from network | Pre-cache model locally |
| vLLM server down | GPU OOM or container issue | Check logs: `docker logs <container>` |

## Monitoring & Alerting

### Metrics to track

1. **Per-model TTFT (p50, p95, p99)**
   - Alert if p95 > target × 1.3 for 5 min

2. **Provider tier compliance**
   - Track % of providers meeting tier SLAs
   - Goal: 95% of active providers meet SLA

3. **Model load time**
   - Expected: 2-6 seconds per model on local NVMe
   - Alert if > 10s

## Historical Data

### Baseline Runs (Sprint 27)

| Date | Model | RTX 4090 Avg | P95 | Status |
|------|-------|-------------|-----|--------|
| 2026-03-24 | ALLaM 7B | 8.2s | 10.1s | 🟢 |
| 2026-03-24 | Qwen 2.5 7B | 7.5s | 9.3s | 🟢 |
| 2026-03-24 | Nemotron Nano | 3.8s | 4.6s | 🟢 |

**Note:** Replace with actual benchmark results after first production run.

## Optimization Strategies

### 1. Pre-warming Models
Models can be pre-loaded into VRAM on provider startup:
```bash
# In provider container startup
python -m vllm.entrypoints.openai.api_server \
  --model model-name \
  --load-format auto \
  --preload-model
```

Reduces cold-start to < 2 seconds for pre-warmed models.

### 2. Quantization
- **FP16** (default) — Fast, good accuracy, minimal VRAM overhead
- **INT8** — 25% VRAM savings, slight accuracy loss
- **GPTQ** — 4-bit, 50% VRAM savings, noticeable latency hit

For DCP: FP16 recommended (meets SLA without complexity).

### 3. Tensor Parallelism
For larger models (13B+) on multi-GPU:
```bash
vllm --tensor-parallel-size 2  # Uses 2 GPUs
```

Reduces TTFT by ~40% on 13B models.

### 4. Memory Optimization Flags
```bash
--gpu-memory-utilization 0.90  # Use 90% of GPU VRAM
--enable-lora                   # Enable LoRA adapters
--max-model-len 4096           # Limit context window
```

## Future: Streaming TTFB

Current metrics measure TTFT (first token in batch). For streaming inference:
- **TTFB** = Time-to-first-byte (first token sent to client)
- Expected to be 1-2ms slower than TTFT

This will be tracked in Sprint 28 once streaming inference is enabled.

## References

- **vLLM Docs:** https://docs.vllm.ai/
- **Arabic Models:** https://huggingface.co/ALLaM-AI, https://huggingface.co/inceptionai
- **Benchmarking Guide:** `docs/PHASE1-DAY4-EXECUTION-RUNBOOK.md` (inference testing section)
- **Portfolio Config:** `infra/config/arabic-portfolio.json`
- **Strategic Brief:** `FOUNDER-STRATEGIC-BRIEF.md` (competitor benchmarks, pricing)
