# Arabic Model Pre-fetching Deployment Guide

## Overview

This guide explains how to pre-fetch Tier A Arabic models to a GPU provider's local cache, eliminating cold-start latency on the DCP marketplace. Pre-fetching downloads model weights from Hugging Face Hub once and caches them on the provider's local storage, reducing subsequent inference startup from 30-90s to <5s.

**Execution Time:** 30-90 minutes depending on network bandwidth and model size
**Disk Space Required:** ~93 GB for Tier A + overhead
**VRAM Required:** See per-model specifications below

---

## Tier A Models — Specifications and Requirements

All Tier A models are classified as `hot` in DCP's pre-warming policy, meaning they should be pre-fetched before provider activation.

### 1. ALLaM 7B Instruct
- **Repository:** ALLaM-AI/ALLaM-7B-Instruct-preview
- **Model Size:** ~14 GB (quantized: ~7 GB FP16)
- **Minimum VRAM:** 16 GB
- **Recommended VRAM:** 22 GB (includes vLLM overhead)
- **Disk Space:** ~15 GB
- **Cold Start (unfetched):** 9.5s
- **Warm Start (prefetched):** <5s
- **vLLM Configuration:**
  ```
  --max-model-len 4096 --gpu-memory-utilization 0.90 --dtype float16 --tensor-parallel-size 1
  ```
- **Container Profile:** vLLM inference engine
- **Launch Priority:** 1 (highest priority for Tier A)

### 2. Falcon H1 7B Instruct (Arabic)
- **Repository:** tiiuae/Falcon-H1-7B-Instruct
- **Model Size:** ~14 GB (quantized: ~7 GB FP16)
- **Minimum VRAM:** 16 GB
- **Recommended VRAM:** 22 GB
- **Disk Space:** ~15 GB
- **Cold Start (unfetched):** 9.0s
- **Warm Start (prefetched):** <5s
- **vLLM Configuration:**
  ```
  --max-model-len 4096 --gpu-memory-utilization 0.90 --dtype float16 --tensor-parallel-size 1
  ```
- **Container Profile:** vLLM inference engine
- **Launch Priority:** 2

### 3. Qwen 2.5 7B Instruct
- **Repository:** Qwen/Qwen2.5-7B-Instruct
- **Model Size:** ~14 GB (quantized: ~7 GB FP16)
- **Minimum VRAM:** 18 GB
- **Recommended VRAM:** 24 GB
- **Disk Space:** ~15 GB
- **Cold Start (unfetched):** 8.0s
- **Warm Start (prefetched):** <5s
- **vLLM Configuration:**
  ```
  --max-model-len 8192 --gpu-memory-utilization 0.90 --dtype float16 --tensor-parallel-size 1 --enable-lora
  ```
- **Container Profile:** vLLM inference engine with LoRA support
- **Launch Priority:** 3

### 4. Llama 3 8B Instruct
- **Repository:** meta-llama/Meta-Llama-3-8B-Instruct
- **Model Size:** ~16 GB (quantized: ~8 GB FP16)
- **Minimum VRAM:** 19 GB
- **Recommended VRAM:** 26 GB
- **Disk Space:** ~17 GB
- **Cold Start (unfetched):** 9.0s
- **Warm Start (prefetched):** <5s
- **vLLM Configuration:**
  ```
  --max-model-len 8192 --gpu-memory-utilization 0.90 --dtype float16 --tensor-parallel-size 1
  ```
- **Container Profile:** vLLM inference engine
- **Launch Priority:** 4

### 5. Mistral 7B Instruct v0.2
- **Repository:** mistralai/Mistral-7B-Instruct-v0.2
- **Model Size:** ~14 GB (quantized: ~7 GB FP16)
- **Minimum VRAM:** 17 GB
- **Recommended VRAM:** 24 GB
- **Disk Space:** ~15 GB
- **Cold Start (unfetched):** 8.5s
- **Warm Start (prefetched):** <5s
- **vLLM Configuration:**
  ```
  --max-model-len 8192 --gpu-memory-utilization 0.90 --dtype float16 --tensor-parallel-size 1
  ```
- **Container Profile:** vLLM inference engine
- **Launch Priority:** 5

### 6. Nemotron Mini 4B Instruct
- **Repository:** nvidia/Nemotron-Mini-4B-Instruct
- **Model Size:** ~8 GB (quantized: ~4 GB FP16)
- **Minimum VRAM:** 10 GB
- **Recommended VRAM:** 14 GB
- **Disk Space:** ~9 GB
- **Cold Start (unfetched):** 4.0s
- **Warm Start (prefetched):** <3s
- **vLLM Configuration:**
  ```
  --max-model-len 4096 --gpu-memory-utilization 0.90 --dtype float16 --tensor-parallel-size 1
  ```
- **Container Profile:** vLLM inference engine
- **Launch Priority:** 6 (instant-tier candidate)
- **Special Note:** Smallest footprint; can be pre-baked into provider image for instant activation

---

## Tier A Aggregate Requirements

| Metric | Value |
|--------|-------|
| **Total Disk Space** | ~93 GB |
| **Minimum VRAM** | 10 GB (Nemotron-only) |
| **Recommended VRAM** | 26 GB (for Llama 3) |
| **Maximum VRAM** | 26 GB (Llama 3 recommended) |
| **Download Time** | 30-90 min (100 Mbps) |
| **Total Model Count** | 6 models |
| **Network Requirement** | 100 Mbps recommended |

---

## Pre-fetch Script Usage

DCP provides the pre-fetch script at `infra/docker/prefetch-models.sh`.

### Basic Execution

```bash
# Pre-fetch all Tier A models (default)
./infra/docker/prefetch-models.sh

# Pre-fetch Tier B models (embeddings + reranker)
DCP_PREWARM_TIER=tier_b ./infra/docker/prefetch-models.sh

# Pre-fetch all tiers
DCP_PREWARM_TIER=all ./infra/docker/prefetch-models.sh
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DCP_MODEL_CACHE_ROOT` | `/opt/dcp/model-cache` | Local cache directory |
| `DCP_MODEL_CACHE_VOLUME` | `dcp-model-cache` | Docker volume name |
| `DCP_PREWARM_TIER` | `tier_a` | Tier to pre-fetch: `tier_a`, `tier_b`, `tier_c`, or `all` |
| `DCP_PREWARM_POLICY` | `hot-warm` | Policy: `hot-only`, `hot-warm`, or `all` |
| `HF_TOKEN` | (unset) | Hugging Face API token for gated model access |
| `DCP_CACHE_HIGH_WATERMARK_PCT` | `90` | Skip pre-fetch if cache usage > this % |

### Example: Pre-fetch with Custom Cache Location

```bash
DCP_MODEL_CACHE_ROOT=/mnt/fast-nvme/model-cache \
DCP_PREWARM_TIER=tier_a \
./infra/docker/prefetch-models.sh
```

---

## Error Handling

### Common Errors

#### "Docker is required / docker daemon is not reachable"
**Cause:** Docker is not installed or not running
**Solution:** Install Docker and enable the Docker daemon before running pre-fetch
```bash
sudo systemctl start docker
sudo usermod -aG docker $USER
```

#### "Docker volume not found: dcp-model-cache"
**Cause:** Docker volume was not created by provider setup script
**Solution:** Run provider prerequisites script first (see provider-activation-prerequisites.md)
```bash
./infra/setup-model-cache.sh
```

#### "Cache usage X% >= 90%"
**Cause:** Disk cache is too full; pre-fetch is skipped to prevent OOM
**Solution:** Free disk space or increase `DCP_CACHE_HIGH_WATERMARK_PCT`
```bash
df /opt/dcp/model-cache  # Check disk usage
DCP_CACHE_HIGH_WATERMARK_PCT=95 ./infra/docker/prefetch-models.sh
```

#### "No models found for tier 'tier_a' in /path/to/arabic-portfolio.json"
**Cause:** Portfolio configuration is missing or path is incorrect
**Solution:** Verify portfolio file exists at path specified in `DCP_ARABIC_PORTFOLIO_FILE`
```bash
cat $DCP_ARABIC_PORTFOLIO_FILE | head -20
```

---

## Performance Tuning

### Network Optimization
- **Target Bandwidth:** 100+ Mbps for <1 hour pre-fetch
- **Low Bandwidth (<50 Mbps):** Expect 2-3 hours for Tier A
- **Parallel Downloads:** Script limits to 1 concurrent download to prevent throttling

### Storage Optimization
- **SSD Required:** NVMe SSD strongly recommended for <90min pre-fetch
- **HDD Warning:** Spinning disk may require 2-3x longer due to I/O contention

### VRAM Optimization
- Recommended: 26 GB for all Tier A models concurrently
- Minimum: 10 GB for single model (Nemotron)
- **Multi-GPU:** Pre-fetch distributes across available GPUs using `--tensor-parallel-size`

---

## Verification

After pre-fetch completes, verify models are cached:

```bash
# Check Docker volume contents
docker run --rm -v dcp-model-cache:/cache busybox \
  du -sh /cache/hf/models--*/

# Expected: ~93 GB across all Tier A model directories
```

---

## Next Steps

1. Ensure prerequisites are met (see provider-activation-prerequisites.md)
2. Run pre-fetch script with appropriate tier
3. Monitor disk space during download
4. Verify completion with cache check above
5. Start vLLM service containers for deployed models

