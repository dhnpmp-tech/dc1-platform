# Container Build Execution & Validation Plan (DCP-642)

Date: 2026-03-23
Status: Execution Blocked on Secrets
Issue: DCP-642

## Overview

This document specifies the exact steps to execute the container build once Docker Hub credentials are configured, plus comprehensive validation procedures.

---

## Phase 1: Setup (One-Time)

### 1.1 Configure GitHub Actions Secrets

**Location:** Repository Settings → Secrets and variables → Actions

**Required Secrets:**
```
DOCKER_HUB_USERNAME = <dockerhub-account>
DOCKER_HUB_TOKEN = <dockerhub-pat>
```

**How to Get Token:**
1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Name: `dcp-ci-build`
4. Permissions: `Read, Write`
5. Copy token and save securely

**Verification:**
```bash
# Test locally (optional)
echo "$DOCKER_HUB_TOKEN" | docker login -u "$DOCKER_HUB_USERNAME" --password-stdin
docker pull docker.io/dc1/base-worker:latest  # Should fail initially (not pushed yet)
```

### 1.2 Verify Dockerfile Dependencies

```bash
# Check all Dockerfiles are present
ls -lh backend/docker/Dockerfile.*
# Expected: Dockerfile.base, Dockerfile.llm-worker, Dockerfile.sd-worker, Dockerfile.general-worker

# Check base dependencies available
cd backend/docker
cat Dockerfile.base | grep "FROM\|RUN pip"
# Should reference: nvidia/cuda:12.2.0-runtime-ubuntu22.04
```

### 1.3 Verify CI Workflow Configuration

```bash
# Check workflow file
cat .github/workflows/docker-instant-tier.yml | grep -E "push|schedule|registry|build-args"
# Expected:
# - on.push.branches: main
# - on.schedule: 0 2 * * * (2 AM UTC nightly)
# - env.REGISTRY: docker.io
# - env.IMAGE_REGISTRY_PATH: dc1
```

---

## Phase 2: Trigger Build

### 2.1 Option A: Manual Trigger (Fastest)

**When:** Secrets configured, need build immediately

```bash
# Go to GitHub Actions UI
# https://github.com/your-org/dc1-platform/actions
#
# Find: "Build & Push Instant-Tier Worker Images"
# Click "Run workflow" → Run workflow
# Branch: main
# Wait for status
```

**Estimated Duration:**
- build-llm-worker: ~5-10 minutes (SKIP_MODEL_PREBAKE=1, no model download)
- build-sd-worker: ~5-8 minutes
- Parallel execution: ~8-10 minutes total
- Push to Docker Hub: ~2-3 minutes
- **Total: ~10-15 minutes**

### 2.2 Option B: Automated Trigger (Standard)

**When:** Using normal CI pipeline

```bash
# Push any change to main (or modify Dockerfile)
git commit --allow-empty -m "chore(ci): trigger container build"
git push origin main

# This automatically triggers workflow
```

**Duration:** Same as Option A (~10-15 min)

### 2.3 Option C: Scheduled Trigger (With Model Pre-Bake)

**When:** Nightly full build with model included

**Timing:** 2:00 AM UTC daily (set by cron: `0 2 * * *`)

**Build Changes:**
- SKIP_MODEL_PREBAKE=0 (downloads Nemotron model)
- Tag: `dc1/llm-worker:latest-fullbake`
- Duration: 30-45 minutes (includes model download)

**Not Needed For Initial Launch** — Option A or B sufficient

---

## Phase 3: Monitor Build

### 3.1 Watch Build Progress

**GitHub Actions UI:**
```
https://github.com/your-org/dc1-platform/actions
→ Workflow: "Build & Push Instant-Tier Worker Images"
→ Latest run
→ Jobs: build-llm-worker, build-sd-worker, notify
```

**Timeline:**
```
[00:00] Checkout code
[01:00] Set up Docker Buildx
[02:00] Login to Docker Hub
[03:00] Determine build args
[04:00] Build and push LLM worker ← Longest (~5-10 min)
[09:00] Build and push SD worker ← Parallel (~5-8 min)
[12:00] Notify (summary) ← Check success/failure
[15:00] COMPLETE
```

### 3.2 Build Log Inspection

**Look for:**
- ✅ `Successfully logged in to docker.io`
- ✅ `Successfully built dc1/llm-worker`
- ✅ `Successfully tagged dc1/llm-worker:latest`
- ✅ `Pushed image to docker.io/dc1/llm-worker:latest`
- ✅ `Instant-tier worker images built and pushed successfully`

**Common Warnings (Not Critical):**
- `Deleting old docker builder` — Normal cleanup
- `Cache layer reused` — Expected for repeated builds
- `Layer already exists in registry` — Expected if tag unchanged

**Errors to Watch For:**
- ❌ `Failed to login to docker.io` → Check DOCKER_HUB_TOKEN
- ❌ `Out of disk space` → GitHub Actions runner issue (rare)
- ❌ `HuggingFace download timeout` → Retry nightly build later
- ❌ `PyTorch installation failed` → Check PyTorch wheel availability

---

## Phase 4: Verify Publication

### 4.1 Docker Hub Verification

**Check Image Tags:**
```bash
# Browser: https://hub.docker.com/r/dc1/llm-worker
# Or CLI:
curl -s https://registry.hub.docker.com/v2/repositories/dc1/llm-worker/tags | jq '.results[].name'
# Expected output:
# "latest"
# "latest-fullbake" (only after nightly build)
```

**Verify Image Manifest:**
```bash
# Check image architecture and layers
docker manifest inspect docker.io/dc1/llm-worker:latest
# Should show: linux/amd64, size ~7GB
```

### 4.2 Image Pull Test

**Local Machine (if Docker available):**
```bash
# Pull image (may take 5-10 minutes)
docker pull docker.io/dc1/llm-worker:latest

# Verify image exists
docker images | grep dc1/llm-worker
# Expected: dc1/llm-worker    latest    <sha>    7.2 GB    <timestamp>

# Inspect layers
docker history docker.io/dc1/llm-worker:latest
# Should show: base-worker, vLLM packages, model cache
```

### 4.3 Size Validation

**Expected Image Sizes:**
| Image | SKIP_MODEL_PREBAKE | Size |
|-------|-------------------|------|
| dc1/base-worker | 0/1 | ~5 GB |
| dc1/llm-worker | 1 | ~7 GB |
| dc1/llm-worker | 0 (fullbake) | ~11-12 GB |
| dc1/sd-worker | 1 | ~6.5 GB |
| dc1/general-worker | 1 | ~6 GB |

**If Size Wrong:**
- Too small: Check if prebake succeeded
- Too large: Check for duplicate layers or unnecessary bloat

---

## Phase 5: Provider Testing

### 5.1 Provider Environment Setup

**Test on Representative GPU:**
- RTX 4090 (24 GB VRAM) — Best case, all models fit
- RTX 3090 (24 GB VRAM) — Standard provider setup
- RTX 4080 (16 GB VRAM) — Minimum for large models
- A100 (40 GB VRAM) — Enterprise GPU

**Provider Daemon Version:**
```bash
# Test with latest daemon from main branch
cd /path/to/provider-daemon
git pull origin main
npm install
```

### 5.2 Container Pull & Start

**Pull Image:**
```bash
docker pull docker.io/dc1/llm-worker:latest-fullbake
# Time: ~5-10 minutes (7 GB image)
```

**Start Container:**
```bash
docker run --gpus=all \
  -e HF_HOME=/opt/dcp/model-cache/hf \
  -v dcp_model_cache:/opt/dcp/model-cache \
  --rm \
  -it \
  docker.io/dc1/llm-worker:latest-fullbake \
  bash
```

**Verify GPU Access:**
```bash
# Inside container
nvidia-smi
# Expected: GPU detected, CUDA available
```

### 5.3 vLLM Model Load Test

**Test Model Loading:**
```bash
# Inside container
python3 << 'EOF'
from vllm import LLM

# Load Nemotron-Mini (pre-baked in image)
model = LLM("nvidia/Nemotron-Mini-4B-Instruct", tensor_parallel_size=1)
print("✓ Model loaded successfully")

# Measure load time
import time
start = time.time()
output = model.generate("Hello, world!", max_tokens=5)
elapsed = time.time() - start
print(f"✓ First inference: {elapsed:.1f}s")
print(f"  Output: {output[0].outputs[0].text}")
EOF
```

**Expected Results:**
- Model loads in: ~5-15 seconds
- First inference: <30 seconds
- Output: Text from Nemotron model

### 5.4 Cached-Tier Fallback Test

**Test Model Not Pre-Baked:**
```bash
# Inside container
python3 << 'EOF'
from vllm import LLM
import time

# Load a non-preakked model (should download)
start = time.time()
model = LLM("meta-llama/Llama-2-7b-hf", tensor_parallel_size=1)
elapsed = time.time() - start
print(f"✓ Cached-tier load: {elapsed:.1f}s (includes HF download)")
EOF
```

**Expected:**
- First load: 60-180 seconds (HF download + vLLM init)
- Subsequent loads: 5-15 seconds (volume cache hit)

### 5.5 Provider Daemon Integration Test

**Start Full Provider:**
```bash
# Using provider daemon with DCP backend
pm2 start provider-daemon.json

# Check logs
pm2 logs provider-daemon

# Expected in logs:
# "Container ready: docker.io/dc1/llm-worker:latest"
# "Heartbeat sent to api.dcp.sa"
```

**Test Job Submission:**
```bash
# Submit inference job to provider
curl -X POST https://api.dcp.sa/api/jobs/submit \
  -H "X-Renter-Key: $RENTER_KEY" \
  -d '{
    "job_type": "vllm_serve",
    "model": "nvidia/Nemotron-Mini-4B-Instruct",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }'

# Expected: Job completes in <30s (instant-tier model)
```

---

## Phase 6: Production Rollout

### 6.1 Provider Notification

**When image is ready for production:**

```bash
# Announce in provider docs/comms
echo "dc1/llm-worker:latest-fullbake ready for deployment"
echo "This image includes Nemotron-Mini-4B-Instruct pre-baked"
echo "Cold start: <30 seconds on 8GB+ GPUs"
```

### 6.2 Gradual Rollout

**Stage 1: Beta Providers (Day 1)**
- Deploy to 5 test providers
- Monitor for issues
- Expected: 100% uptime

**Stage 2: Early Adopters (Day 2-3)**
- Deploy to providers who volunteer
- Monitor job success rate and cold-start times
- Expected: >95% success rate

**Stage 3: Production (Day 4+)**
- Roll out to all active providers
- Expected: Full adoption within 1 week

### 6.3 Monitoring & Metrics

**Track During Rollout:**
```
- Container pull success rate
- Cold-start times (target: <30s)
- Job completion rate
- Model inference latency (P50, P95, P99)
- Provider uptime (target: >99%)
```

**Rollback Plan:**
- If issues appear, revert to prior image tag
- Notify providers to revert: `docker pull dc1/llm-worker:previous`

---

## Phase 7: Blockers & Escalation

### Current Status: BLOCKED

**Waiting For:**
- Docker Hub credentials (DOCKER_HUB_USERNAME, DOCKER_HUB_TOKEN)
- GitHub Actions secrets configured by DevOps/CEO

**Escalation Path:**
1. ML Infrastructure Engineer (me) — Prepared documentation ✅
2. DevOps/GitHub Admin — Configure secrets
3. CI/CD Pipeline — Auto-triggers build
4. Docker Hub — Publishes images
5. Providers — Pull and run

**Once Secrets Configured:**
- Build can execute immediately (Option A: 10-15 min)
- No other blockers identified
- Full validation path documented and ready

---

## Success Criteria

**Build Successful:**
- ✅ GitHub Actions workflow completes without errors
- ✅ Images published to docker.io/dc1/llm-worker:latest
- ✅ Image size within expected range (~7 GB)
- ✅ All 4 worker images available

**Provider Testing Successful:**
- ✅ Provider can pull image
- ✅ Container starts on GPU
- ✅ Model loads in <30s
- ✅ Inference works end-to-end
- ✅ Cached-tier fallback works

**Sprint 26 Priority #1 Complete:**
- ✅ Instant-tier images built and published
- ✅ Providers can deploy immediately
- ✅ Zero-download cold starts enabled
- ✅ Documentation complete

---

## References

- Build Guide: `docs/CONTAINER-BUILD-GUIDE.md`
- CI Workflow: `.github/workflows/docker-instant-tier.yml`
- Build Script: `backend/docker/build-images.sh`
- Dockerfile LLM: `backend/docker/Dockerfile.llm-worker`
- Instant-Tier Arch: `docs/INSTANT-TIER-ARCHITECTURE.md`
- DCP-611: Instant-Tier Validation (completed)
- DCP-642: Container Build (this task)
