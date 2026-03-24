# Arabic Model Pre-fetching Deployment Guide

**Document Version:** 2026-03-24
**Tier A Models Ready:** ✅ 6 models
**Pre-fetch Script:** `infra/docker/prefetch-models.sh`
**Portfolio Config:** `infra/config/arabic-portfolio.json`

---

## Overview

This guide enables providers to pre-warm Tier A Arabic models on their GPU infrastructure. Pre-fetching eliminates cold-start latency (currently 8-12 seconds) and creates a competitive advantage in the marketplace.

**Cold-start latency reduction:**
- Before pre-fetch: 8,000–14,000 ms first request
- After pre-fetch: 450–1,400 ms (P95 latency)
- **UX impact:** +25–30% repeat job rate (from Phase 2 research)

---

## Tier A Models (Hot Pre-warming)

All Tier A models are marked for "hot" pre-warming — they download immediately during provider activation.

| Model ID | HuggingFace Repo | Min VRAM | Recommended | Cold Start | P95 Latency | GPU Fit |
|----------|------------------|----------|------------|----------|------------|---------|
| **allam-7b-instruct** | ALLaM-AI/ALLaM-7B-Instruct-preview | 16 GB | 22 GB | 9.5 s | 1.3 s | RTX 4090, RTX 4080, 2x RTX 4070 |
| **falcon-h1-arabic-7b** | tiiuae/Falcon-H1-7B-Instruct | 16 GB | 22 GB | 9.0 s | 1.2 s | RTX 4090, RTX 4080, 2x RTX 4070 |
| **qwen25-7b-instruct** | Qwen/Qwen2.5-7B-Instruct | 18 GB | 24 GB | 8.0 s | 0.95 s | RTX 4090, RTX 4080 |
| **llama-3-8b-instruct** | meta-llama/Meta-Llama-3-8B-Instruct | 19 GB | 26 GB | 9.0 s | 1.1 s | RTX 4090, RTX 4080, H100 |
| **mistral-7b-instruct** | mistralai/Mistral-7B-Instruct-v0.2 | 17 GB | 24 GB | 8.5 s | 1.0 s | RTX 4090, RTX 4080 |
| **nemotron-nano-4b** | nvidia/Nemotron-Mini-4B-Instruct | 10 GB | 14 GB | 4.0 s | 0.6 s | RTX 4070, RTX 4060 Ti, single GPU |

---

## How Pre-fetching Works

### Pre-fetch Script Flow

```
1. setup-model-cache.sh
   └─ Create /opt/dcp/model-cache volume
   └─ Prepare cache directory with permissions

2. emit_portfolio_models()
   └─ Parse infra/config/arabic-portfolio.json
   └─ Extract tier_a models (6 models)
   └─ Filter by prewarm_class (all "hot" for tier_a)

3. For each model in tier_a:
   └─ Check cache disk usage
   └─ If usage < 90%: pull_one() model repo
   └─ Cache model weights to /opt/dcp/model-cache/hf
   └─ Log success/skip

4. Emit summary:
   └─ prefetched=N, skipped=M, tier=tier_a
   └─ Show final cache disk usage
```

### Environment Variables

Providers can customize pre-fetch behavior:

```bash
# Portfolio file (default: infra/config/arabic-portfolio.json)
export DCP_ARABIC_PORTFOLIO_FILE="/path/to/portfolio.json"

# Model cache root (default: /opt/dcp/model-cache)
export DCP_MODEL_CACHE_ROOT="/mnt/gpu-nvme/model-cache"

# Docker volume name (default: dcp-model-cache)
export DCP_MODEL_CACHE_VOLUME="dcp-model-cache"

# Pre-warming policy (default: hot-warm)
# hot-only    = tier_a models only (marked "hot")
# hot-warm    = tier_a + tier_b warm models
# all         = all tiers (slow, not recommended for first run)
export DCP_PREWARM_POLICY="hot-only"

# Disk high-water mark % (default: 90)
# Skip non-hot models if cache usage >= this threshold
export DCP_CACHE_HIGH_WATERMARK_PCT="85"

# Hugging Face API token (for private model access)
export HF_TOKEN="hf_xxxxxxxxxxxxx"
```

---

## Provider Activation Flow

### Step 1: Prerequisites Verification
```bash
./infra/setup-model-cache.sh
# Checks: docker, docker daemon, nvidia-docker, disk space (>= 500 GB)
```

### Step 2: Run Pre-fetch
```bash
./infra/docker/prefetch-models.sh
# Output:
# prefetch start: allam-7b-instruct (ALLaM-AI/ALLaM-7B-Instruct-preview)
# prefetch done: allam-7b-instruct
# ... (repeat for each model)
# model prefetch complete (prefetched=6, skipped=0, tier=tier_a, policy=hot-warm)
```

### Step 3: Verify Cache
```bash
docker volume inspect dcp-model-cache
# Returns: mount path, labels, driver options

ls -lh /opt/dcp/model-cache/hf/
# Shows: models directory with cached weights
```

### Step 4: Start vLLM with Pre-warmed Models
```bash
docker run --gpus all \
  -v dcp-model-cache:/root/.cache \
  -e HF_HOME=/root/.cache/hf \
  vllm/vllm:latest \
  python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3-8B-Instruct \
  --port 8000
# First request now has ~1.1s latency instead of 9s
```

---

## Disk Space Requirements

**Per-model download size (after decompression):**

| Model | Size on Disk | Cache with Overhead |
|-------|-------------|-------------------|
| ALLaM 7B | 14 GB | 16 GB |
| Falcon H1 7B | 14 GB | 16 GB |
| Qwen 2.5 7B | 15 GB | 17 GB |
| Llama 3 8B | 16 GB | 18 GB |
| Mistral 7B | 14 GB | 16 GB |
| Nemotron Nano 4B | 8 GB | 10 GB |
| **Tier A Total** | **81 GB** | **93 GB** |

**Recommended:**
- Minimum: 150 GB free disk space (Tier A models + 50 GB buffer)
- Recommended: 250 GB free disk space (supports Tier B warm models + safety margin)
- NVMe strongly recommended for model loading performance

---

## Expected Timing

**Total pre-fetch time for Tier A (all 6 models):**
- **First run:** 45–90 minutes (dependent on bandwidth, HF mirror availability)
- **Typical:** ~60 minutes (500 Mbps connection)
- **High bandwidth:** ~30 minutes (2+ Gbps connection)

Per-model timing (approximate):
- ALLaM 7B: 8–15 min (14 GB download)
- Falcon H1 7B: 8–15 min (14 GB download)
- Qwen 2.5 7B: 9–16 min (15 GB download)
- Llama 3 8B: 10–18 min (16 GB download)
- Mistral 7B: 8–15 min (14 GB download)
- Nemotron Nano 4B: 4–8 min (8 GB download)

---

## Error Handling

### Docker volume not found
```
error: docker volume not found: dcp-model-cache
```
**Fix:** Run `setup-model-cache.sh` first
```bash
./infra/setup-model-cache.sh
```

### Portfolio JSON parse error
```
warning: falling back to legacy two-model prefetch
```
**Fix:** Verify JSON syntax in `infra/config/arabic-portfolio.json`
```bash
python3 -m json.tool infra/config/arabic-portfolio.json
```

---

## Validation Checklist

After pre-fetch completes, verify:

- [ ] All 6 Tier A models downloaded
- [ ] No errors in prefetch log (exit code 0)
- [ ] Disk usage is correct (~93 GB for Tier A)
- [ ] vLLM can load models successfully
- [ ] Earnings calculator API working for provider's GPU tier

---

## References

- Portfolio config: `infra/config/arabic-portfolio.json`
- Pre-fetch script: `infra/docker/prefetch-models.sh`
- Setup script: `infra/setup-model-cache.sh`
- Earnings API: `backend/src/routes/earnings.js` (DCP-770)
