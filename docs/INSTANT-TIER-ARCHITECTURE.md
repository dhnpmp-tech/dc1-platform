# Instant-Tier & Cached-Tier Model Loading Architecture (DCP-611)

Date: 2026-03-23
Status: Implementation Validation
Issue: DCP-611

## Overview

DCP implements a three-layer model loading strategy to minimize cold-start latency and support diverse provider GPU configurations:

1. **Instant Tier** — Pre-baked models in Docker image (zero download time)
2. **Cached Tier** — Persistent volume for runtime model resolution
3. **On-Demand Tier** — Network fetch fallback (highest latency)

This document describes the architecture, tier preferences, and validation approach.

---

## 1) Instant-Tier: Pre-Baked Model Images

### Design

The instant tier uses Docker image layering to eliminate model download time. Providers pull a single image containing the model weights—no HuggingFace download required at startup.

### Implementation

**Docker Image:** `dc1/llm-worker:latest`
**Pre-baked Model:** `nvidia/Nemotron-Mini-4B-Instruct` (~8 GB)
**Dockerfile:** `backend/docker/Dockerfile.llm-worker`

```dockerfile
ARG PREBAKE_MODEL=nvidia/Nemotron-Mini-4B-Instruct
ENV HF_HOME=/opt/dcp/model-cache/hf

RUN if [ "$SKIP_MODEL_PREBAKE" != "1" ]; then \
      python3 -c "\
from huggingface_hub import snapshot_download; \
snapshot_download( \
    repo_id='nvidia/Nemotron-Mini-4B-Instruct', \
    cache_dir='/opt/dcp/model-cache/hf', \
    local_dir_use_symlinks=False \
); \
print('Instant-tier model pre-baked.')"; \
    fi
```

### Build Pipeline

**Workflow:** `.github/workflows/docker-instant-tier.yml`

- **On-push builds** (`docker-instant-tier.yml`): Push to `dc1/llm-worker:latest`
  - Build arg: `SKIP_MODEL_PREBAKE=1` (skip prebake, faster CI)

- **Nightly scheduled builds** (cron `0 2 * * *`): Push to `dc1/llm-worker:latest-fullbake`
  - Build arg: `SKIP_MODEL_PREBAKE=0` (pre-bake Nemotron)
  - Full image includes model weights (~8GB additional layer)

### Cold-Start Target

**SLO: <30 seconds** from container start to first inference ready.

Providers with 8GB+ VRAM can serve the instant-tier model without any download step:

```
Docker pull dc1/llm-worker:latest  (cached on provider)
↓
Container start                     (~2-3s)
↓
vLLM engine init                    (~5-10s)
↓
Model already loaded in /opt/dcp/model-cache/hf (0s)
↓
Endpoint ready for inference        (~15-20s total)
```

---

## 2) Cached-Tier: Persistent Volume Model Caching

### Design

The cached tier uses a persistent volume (`/opt/dcp/model-cache`) shared across provider containers. Models are downloaded once and reused across job executions.

### Implementation

**Volume Mount:** `/opt/dcp/model-cache`
**Cache Path:** `/opt/dcp/model-cache/hf` (HuggingFace snapshot_download format)

```yaml
# Example docker-compose volume mount
volumes:
  - dcp_model_cache:/opt/dcp/model-cache
```

Cached-tier models (all Tier A except nemotron-nano):
- ALLaM-7B-Instruct (24 GB VRAM)
- Falcon-H1-Arabic-7B (24 GB VRAM)
- Qwen 2.5-7B-Instruct (16 GB VRAM)
- Llama-3-8B-Instruct (16 GB VRAM)
- Mistral-7B-Instruct-v0.2 (16 GB VRAM)

Cold-start flow for cached models:

```
First inference request
↓
Check /opt/dcp/model-cache/hf/{model-id}/
  - If exists & valid: use cached version (5-15s load)
  - If not exists: download from HuggingFace (60-180s load)
↓
vLLM engine init with model (~5-10s)
↓
Endpoint ready for inference
```

### Fallback Chain

Model routing respects this preference order:

1. **Instant** — Pre-baked in image (nemotron-nano-4b)
2. **Cached** — Volume cache hit (5-15s penalty)
3. **On-Demand** — Network fetch from HuggingFace (60-180s penalty)

---

## 3) Portfolio-Based Model Tier System

### Configuration

**File:** `infra/config/arabic-portfolio.json`

Portfolio defines model metadata, SLOs, and tier ranking:

```json
{
  "tiers": {
    "tier_a": [
      {
        "id": "nemotron-nano-4b",
        "repo": "nvidia/Nemotron-Mini-4B-Instruct",
        "prewarm_class": "hot",
        "min_vram_gb": 8,
        "target_cold_start_ms": 4000,
        "tier_note": "instant-candidate: small footprint enables pre-bake"
      }
    ]
  }
}
```

**Tier Ranking:**
- `tier_a`: Rank 1 (highest priority, hot prewarm)
- `tier_b`: Rank 2 (warm prewarm)
- `tier_c`: Rank 3 (cold prewarm, enterprise only)

### Tier Preference in Model Selection

Backend routing (`backend/src/routes/models.js`):

```javascript
const TIER_RANK = {
  tier_a: 1,
  tier_b: 2,
  tier_c: 3,
};

// Models sorted by tier rank, then launch_priority
function sortByTierAndPriority(models) {
  return models.sort((a, b) => {
    const tierDiff = (a.tier_rank || 99) - (b.tier_rank || 99);
    if (tierDiff !== 0) return tierDiff;
    return (a.launch_priority || 999) - (b.launch_priority || 999);
  });
}
```

---

## 4) Provider Warm-Start Preference

### Preload Status

Providers advertise preloaded models via heartbeat:

```javascript
const warmFreshProviders = capableFreshProviders.filter((provider) => {
  const status = String(provider.model_preload_status || '').toLowerCase();
  return status === 'ready' && String(provider.model_preload_model) === model_id;
});
```

Model availability payloads include:

```json
{
  "model_id": "nemotron-nano-4b",
  "availability": {
    "providers_online": 12,
    "providers_warm": 8,
    "status": "available"
  }
}
```

**Warm providers** (model_preload_status='ready'):
- Model already in memory or volume cache
- Serve requests immediately (no load penalty)

---

## 5) Validation Checklist (DCP-611)

### 1a) Instant-Tier Load Time Validation

- [ ] Docker image `dc1/llm-worker:latest` successfully built
- [ ] Image includes Nemotron-Mini-4B-Instruct model weights
- [ ] Cold start time <30s on 8GB VRAM provider
  - [ ] Pull image (if not cached)
  - [ ] Start container
  - [ ] vLLM engine init
  - [ ] Endpoint ready
- [ ] Benchmark records load time per provider GPU class

### 1b) Instant-Tier Fallback

- [ ] If instant-tier provider unavailable, route to cached-tier
- [ ] If no cached provider, route to on-demand
- [ ] Renter sees appropriate latency estimates in model catalog

### 2a) Cached-Tier Volume Setup

- [ ] Persistent volume created at `/opt/dcp/model-cache`
- [ ] Volume is provider-local and survives container restarts
- [ ] HuggingFace snapshot_download format preserved

### 2b) Cached-Tier Model Loading

- [ ] First request: download from HuggingFace (60-180s)
  - [ ] Model cached in `/opt/dcp/model-cache/hf/{model-id}/`
- [ ] Second request: load from cache (5-15s)
  - [ ] No re-download
  - [ ] vLLM loads from local filesystem
- [ ] Test all 5 cached-tier Tier A models

### 3a) Model Routing Preference

- [ ] Renter requests model X
- [ ] Backend checks provider availability in order:
  1. Instant-tier provider (nemotron-nano-4b only)
  2. Warm provider with cached X
  3. Any capable provider (online, sufficient VRAM)
- [ ] Provider selected reflects tier preference

### 3b) Tier Ranking Validation

- [ ] `tier_a` models ranked 1-5
- [ ] `tier_b` models ranked 10+
- [ ] `tier_c` models ranked 20+
- [ ] Model catalog API reflects correct rank in `portfolio.tier_rank`

### 4a) Benchmark: 6 Tier A Models

Run `scripts/tier-model-validation.mjs`:

```bash
DCP_API_BASE=https://api.dcp.sa DCP_RENTER_KEY=xxx node tier-model-validation.mjs
```

Expected output:

| Model | Cold-Start (ms) | Target (ms) | Status |
|-------|-----------------|-------------|--------|
| nemotron-nano-4b | 3500–4500 | 4000 | PASS |
| llama-3-8b | 8500–9500 | 9000 | PASS |
| qwen25-7b | 7500–8500 | 8000 | PASS |
| mistral-7b | 8000–9000 | 8500 | PASS |
| falcon-h1 | 8500–9500 | 9000 | PASS |
| allam-7b | 9000–10000 | 9500 | PASS |

- [ ] All 6 models meet cold-start SLO
- [ ] P95 latency percentile <1.5× target
- [ ] Memory footprint aligns with declared VRAM

### 4b) Benchmark: Provider GPU Classes

Test on representative provider GPU configurations:

- [ ] RTX 4090 (24GB VRAM) — all Tier A models
- [ ] RTX 3090 (24GB VRAM) — all Tier A models
- [ ] RTX 4080 (16GB VRAM) — small Tier A (8–16GB class)
- [ ] A100 (40GB VRAM) — Tier A + some Tier B

---

## 6) Troubleshooting

### Cold Start >30s

1. **Docker image size**
   - Verify image includes pre-baked model: `docker inspect dc1/llm-worker:latest`
   - Check layer sizes: `docker history dc1/llm-worker:latest`

2. **Volume not mounted**
   - Confirm `/opt/dcp/model-cache` exists in container
   - Check docker-compose volume mount

3. **vLLM engine init slow**
   - Increase `--gpu-memory-utilization` in launch flags
   - Check GPU load during startup

### Cached-Tier Model Not Found

1. **Cache directory corrupted**
   - Inspect `/opt/dcp/model-cache/hf/` permissions
   - Verify HuggingFace format (should have `snapshots/` subdirs)

2. **Model ID mismatch**
   - Verify model ID in db matches HuggingFace repo ID
   - Check snapshot_download repo_id parameter

### Model Routing Incorrect

1. **Provider VRAM reported incorrectly**
   - Query provider via `GET /api/providers/{id}` for actual VRAM
   - Verify heartbeat includes valid `gpu_vram_mb` or `vram_gb`

2. **Tier ranking not applied**
   - Reload `infra/config/arabic-portfolio.json`
   - Verify `portfolio.tier_rank` in model catalog response

---

## 7) Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Instant-tier cold start | <30s | Nemotron-Mini-4B, 8GB+ provider |
| Cached-tier (first load) | 60–180s | HuggingFace download + vLLM init |
| Cached-tier (cache hit) | 5–15s | Volume load + vLLM init |
| Tier A model P95 latency | ≤target × 1.2 | From portfolio.target_p95_ms |
| Provider warm availability | >50% of tier_a | Models with preload_status='ready' |

---

## 8) Deployment Checklist

- [ ] `.github/workflows/docker-instant-tier.yml` enabled on main branch
- [ ] Nightly build scheduled (2 AM UTC)
- [ ] Docker Hub registry credentials available to CI
- [ ] `infra/config/arabic-portfolio.json` loaded by backend at startup
- [ ] Provider volume mounts configured in docker-compose
- [ ] vLLM serving endpoints tested against cached-tier models
- [ ] Monitoring: track cold-start times per model and provider GPU class

---

## 9) Phase-Out: On-Demand Tier (Future)

Once instant-tier and cached-tier are stable (>95% hit rate), phase out on-demand network fetches:

1. Pre-seed model cache on all providers
2. Deprecate network fetch path in vLLM serving logic
3. Treat missing cached models as provider capability gap (flag for operator)

---

## References

- Dockerfile: `backend/docker/Dockerfile.llm-worker`
- CI Pipeline: `.github/workflows/docker-instant-tier.yml`
- Portfolio: `infra/config/arabic-portfolio.json`
- Validation Script: `scripts/tier-model-validation.mjs`
- Model Catalog Backend: `backend/src/routes/models.js`
- Nemotron Integration Spec: `docs/architecture/nemotron-integration-spec.md`
