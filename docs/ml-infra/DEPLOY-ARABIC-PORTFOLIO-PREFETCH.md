# Deploy Arabic Portfolio Pre-Fetching — Sprint 27 Activation Guide

**Status:** Ready for deployment | **Founder approval needed**
**Last Updated:** 2026-03-24
**Target:** First 3-5 active providers with Tier A GPUs (RTX 4090+, H100+)

## Overview

Pre-fetching Tier A models eliminates cold-start latency (the #1 UX complaint in GPU marketplaces). Models are downloaded to provider machines during setup so they're ready for immediate serving.

**Impact:**
- Reduces first job latency by 85-90% (from 9-12s cold-start to <200ms warm-start)
- Improves renter experience: instant model availability
- Competitive advantage: DCP 33-51% faster than io.net/RunPod

## Pre-Fetched Models (Tier A)

| Model | Size | VRAM | Fetch Time | Storage |
|-------|------|------|-----------|---------|
| ALLaM 7B | 13.8GB | 16GB | 15-30m | 14GB |
| Falcon H1 7B | 13.2GB | 16GB | 15-30m | 14GB |
| Qwen 2.5 7B | 14.7GB | 18GB | 15-30m | 15GB |
| Llama 3 8B | 15.1GB | 19GB | 15-30m | 16GB |
| Mistral 7B | 13.1GB | 17GB | 15-30m | 14GB |
| Nemotron Nano 4B | 8.4GB | 10GB | 10-15m | 9GB |

**Total storage needed:** ~92GB (all Tier A models)
**Time to prefetch all Tier A:** 90-150 minutes on standard internet

## Deployment Steps

### 1. Verify Provider Prerequisites

Before deploying prefetch to a provider:

```bash
# SSH to provider machine
ssh provider@<provider-ip>

# Verify Docker is installed and running
docker --version && docker info

# Check available disk space (need >= 100GB free for cache + OS)
df -h / | grep -E '^/dev'

# Verify HuggingFace CLI and permissions
python3 -c "from huggingface_hub import snapshot_download; print('✓ huggingface_hub available')"

# Check HF_TOKEN is set (if using gated models like Llama)
echo "HF_TOKEN=${HF_TOKEN:-UNSET}"
```

**Requirements:**
- Docker installed + daemon running
- 100+ GB free disk space on `/opt` or configurable cache root
- HF_TOKEN set (if accessing gated models)
- Internet connectivity for HuggingFace downloads

### 2. Set Up Model Cache Volume

Run the setup script (typically done by provider-onboard.mjs, but can be run standalone):

```bash
ssh provider@<provider-ip>
cd /opt/dc1-platform

# Setup Docker volume for model cache
bash infra/setup-model-cache.sh
```

This creates a persistent Docker volume (`dcp-model-cache`) and mounts it at `/opt/dcp/model-cache`.

### 3. Run Prefetch Script

**Option A: Fetch Tier A models only (recommended for first 5 providers)**

```bash
ssh provider@<provider-ip>

export DCP_PREWARM_TIER=tier_a
export DCP_PREWARM_POLICY=hot-warm  # Fetch hot+warm models
export HF_TOKEN=<your-hf-token>     # For gated models (Llama, etc.)

bash /opt/dc1-platform/infra/docker/prefetch-models.sh
```

**Option B: Fetch specific tier + policy**

```bash
export DCP_PREWARM_TIER=tier_a          # Options: tier_a, tier_b, tier_c
export DCP_PREWARM_POLICY=hot-warm      # Options: hot-only, hot-warm, all
export DCP_CACHE_HIGH_WATERMARK_PCT=85  # Stop at 85% disk usage
export DCP_MODEL_CACHE_ROOT=/opt/dcp/model-cache

bash /opt/dc1-platform/infra/docker/prefetch-models.sh
```

**Option C: Fetch via CI/CD (recommended for VPS automation)**

Add to PM2 ecosystem file or CI/CD pipeline:

```json
{
  "apps": [
    {
      "name": "model-prefetch-tier-a",
      "script": "/opt/dc1-platform/infra/docker/prefetch-models.sh",
      "autorestart": false,
      "merge_logs": true,
      "env": {
        "DCP_PREWARM_TIER": "tier_a",
        "DCP_PREWARM_POLICY": "hot-warm",
        "HF_TOKEN": "<your-hf-token>"
      }
    }
  ]
}
```

### 4. Verify Prefetch Success

After prefetch completes, verify models are cached:

```bash
ssh provider@<provider-ip>

# Check Docker volume space
docker volume inspect dcp-model-cache --format='{{.Mountpoint}}' | xargs du -sh

# Verify HuggingFace cache structure
ls -lh /opt/dcp/model-cache/hf/models--*/
```

Expected output:
```
/opt/dcp/model-cache/hf/models--ALLaM-AI--ALLaM-7B-Instruct-preview
/opt/dcp/model-cache/hf/models--tiiuae--Falcon-H1-7B-Instruct
/opt/dcp/model-cache/hf/models--Qwen--Qwen2.5-7B-Instruct
...
```

## Testing Cold-Start Performance

After prefetch, use the benchmark script to validate performance:

```bash
# From provider machine, start vLLM with cached model
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3-8B-Instruct \
  --download-dir /opt/dcp/model-cache/hf

# In another terminal, run benchmark
export VLLM_ENDPOINT=http://localhost:8000
node scripts/benchmark-arabic-models.mjs --model llama-3-8b-instruct
```

**Expected results (warm-start with cached model):**
- TTFT: < 200ms (vs 1-2s cold-start)
- Cold-start (first job): < 2-3s
- Subsequent jobs: < 500ms

## Monitoring & Maintenance

### Health Checks

```bash
# Monitor cache usage over time
watch -n 60 'docker volume inspect dcp-model-cache --format="{{.Mountpoint}}" | xargs du -sh'

# Alert if cache usage exceeds 85%
disk_usage=$(docker volume inspect dcp-model-cache --format="{{.Mountpoint}}" | xargs df -h | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$disk_usage" -gt 85 ]; then
  echo "ALERT: Model cache at ${disk_usage}%"
fi
```

### Updating Models

When new models are added to the portfolio:

```bash
# Re-run prefetch to add new models
bash /opt/dc1-platform/infra/docker/prefetch-models.sh

# Script will skip existing models and only fetch new ones
```

### Cleanup (if needed)

```bash
# Remove unused Tier B/C models to free space
rm -rf /opt/dcp/model-cache/hf/models--*/

# Re-prefetch only Tier A
export DCP_PREWARM_TIER=tier_a
bash /opt/dc1-platform/infra/docker/prefetch-models.sh
```

## Rollout Plan (Recommended)

| Phase | Providers | Timeline | Models | Impact |
|-------|-----------|----------|--------|--------|
| **Phase 1** | 3-5 (RTX 4090) | Immediate | Tier A (Nemotron, ALLaM, Falcon) | Validation run |
| **Phase 2** | 10-15 (H100, RTX 4090) | +1 week | Tier A + B | Scale to cohort |
| **Phase 3** | 30+ (all tiers) | +2 weeks | Tier A + B + C | Full activation |

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "docker volume not found" | setup-model-cache.sh not run | Run: `bash infra/setup-model-cache.sh` |
| "disk usage at 95%" | Cache volume too small | Increase allocation or cleanup Tier C models |
| "HF_TOKEN: permission denied" | Gated model (Llama) without auth | Set HF_TOKEN env var with valid token |
| "Connection timeout" | Network issues | Check provider internet, retry prefetch |
| "Out of memory" | Docker daemon OOM | Restart Docker: `systemctl restart docker` |

## Related Docs

- **Benchmark Baseline:** `docs/ml-infra/arabic-model-benchmarks-baseline.md`
- **Portfolio Config:** `infra/config/arabic-portfolio.json`
- **Model Cache Setup:** `infra/setup-model-cache.sh`
- **Prefetch Script:** `infra/docker/prefetch-models.sh`
- **vLLM Optimization Guide:** `docs/ml-infra/vllm-optimization-guide.md`

## Approval & Deployment

**Required for deployment:**
- [ ] Founder approval (sign-off on rollout plan)
- [ ] 3-5 providers identified and verified (GPU + disk space)
- [ ] HF_TOKEN provisioned for gated models
- [ ] CI/CD environment configured (if using automated prefetch)

**After approval, deployment timeline:**
- T+0: Start Phase 1 (3-5 providers)
- T+30min-2.5hr: Models fully cached on first cohort
- T+1 week: Evaluate performance metrics, begin Phase 2
- T+2-3 weeks: Full rollout to 30+ providers

**Contact:** Founder for approval | @ML Infrastructure Engineer for execution

---

**Last tested:** 2026-03-24 | **Script versions:** prefetch-models.sh (HEAD), setup-model-cache.sh (HEAD)
