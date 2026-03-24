# DCP-642: Container Build Execution Procedures

**Status:** Ready to execute (awaiting Docker Hub credentials)
**Created:** 2026-03-24 16:30 UTC
**Owner:** ML Infrastructure Engineer
**Timeline:** Execute within 2-5 minutes of credential availability
**Critical Deadline:** Before Phase 1 Day 4 (2026-03-26 08:00 UTC)

---

## Overview

Two execution paths:

1. **Path A (Recommended):** Add credentials to GitHub Actions secrets → trigger automated build via GitHub
2. **Path B (Manual):** Build and push locally using Docker CLI

Both paths produce: `docker.io/dc1/llm-worker:latest` and `docker.io/dc1/sd-worker:latest`

---

## PATH A: GitHub Actions Automated Build (2-3 minutes)

### Step 1: Add Docker Hub Credentials to GitHub Secrets

**Location:** GitHub repo Settings → Secrets and variables → Actions

**Action 1.1: DOCKER_HUB_USERNAME**
```
Name: DOCKER_HUB_USERNAME
Value: <your Docker Hub username>
```

**Action 1.2: DOCKER_HUB_TOKEN**
```
Name: DOCKER_HUB_TOKEN
Value: <Personal Access Token from Docker Hub>
```

**How to get Docker Hub PAT:**
1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Name it "dcp-ci"
4. Select "Read & Write" permissions
5. Copy the token immediately (only shown once)
6. Paste into GitHub secret

### Step 2: Trigger Build

**Option 2.1: Manual workflow dispatch**
```bash
# Via GitHub CLI (if installed)
gh workflow run docker-instant-tier.yml --repo anthropics/dc1-platform
```

**Option 2.2: Git push trigger**
```bash
# Any push to main that modifies Dockerfile will trigger build
git push origin main
```

**Option 2.3: Scheduled build**
- Workflow runs automatically daily at 2 AM UTC (full model pre-bake)

### Step 3: Monitor Build

**Via GitHub Actions UI:**
1. Go to repo → Actions tab
2. Click "Build & Push Instant-Tier Worker Images" workflow
3. Watch build progress (typical duration: 8-15 minutes depending on model pre-bake)

**Via CLI (if gh CLI available):**
```bash
gh run list --workflow docker-instant-tier.yml --limit 1
gh run view <run-id> --log
```

### Step 4: Verify Publication

Once build completes:
```bash
# Check if images exist on Docker Hub
docker pull docker.io/dc1/llm-worker:latest
docker pull docker.io/dc1/sd-worker:latest

# Or via curl if docker not available
curl -s -H "Authorization: Bearer <Docker Hub Token>" \
  https://hub.docker.com/v2/repositories/dc1/llm-worker/tags/?name=latest | \
  grep -o '"name":"latest"'
```

---

## PATH B: Local Docker Build and Push (5-10 minutes)

### Prerequisites
- Docker CLI installed and running
- Docker Hub credentials configured locally
- Git repo cloned to /home/node/dc1-platform

### Step 1: Authenticate to Docker Hub

```bash
# Interactive login (recommended)
docker login

# Or use environment variables (CI-friendly)
echo "$DOCKER_HUB_TOKEN" | docker login -u "$DOCKER_HUB_USERNAME" --password-stdin
```

### Step 2: Build LLM Worker Image

**For fast builds (skip model pre-bake, use for dev/testing):**
```bash
cd /home/node/dc1-platform

docker build \
  -f backend/docker/Dockerfile.llm-worker \
  -t dc1/llm-worker:latest \
  --build-arg SKIP_MODEL_PREBAKE=1 \
  --build-arg BASE_IMAGE=dc1/base-worker:latest \
  -o type=docker \
  backend/docker/
```

**For full builds (pre-bake model, use for production):**
```bash
docker build \
  -f backend/docker/Dockerfile.llm-worker \
  -t dc1/llm-worker:latest \
  --build-arg SKIP_MODEL_PREBAKE=0 \
  --build-arg BASE_IMAGE=dc1/base-worker:latest \
  --build-arg PREBAKE_MODEL=nvidia/Nemotron-Mini-4B-Instruct \
  backend/docker/
```

**Expected output:**
```
Successfully built sha256:abc123...
Successfully tagged dc1/llm-worker:latest
```

### Step 3: Tag for Docker Hub Push

```bash
docker tag dc1/llm-worker:latest docker.io/dc1/llm-worker:latest
```

### Step 4: Push to Docker Hub

```bash
docker push docker.io/dc1/llm-worker:latest
```

**Expected output:**
```
The push refers to repository [docker.io/dc1/llm-worker]
<hash>: Pushed
...
latest: digest: sha256:..., size: ...
```

### Step 5: Repeat for SD Worker (Stable Diffusion)

```bash
# Build
docker build \
  -f backend/docker/Dockerfile.sd-worker \
  -t dc1/sd-worker:latest \
  --build-arg SKIP_MODEL_PREBAKE=1 \
  backend/docker/

# Tag
docker tag dc1/sd-worker:latest docker.io/dc1/sd-worker:latest

# Push
docker push docker.io/dc1/sd-worker:latest
```

---

## Verification Checklist

After build completes (via either path), verify images are available:

### ✅ Check 1: Docker Hub Image Availability
```bash
# Image should be pullable
docker pull docker.io/dc1/llm-worker:latest
docker pull docker.io/dc1/sd-worker:latest

# Verify image layers and size
docker images | grep dc1
```

### ✅ Check 2: Image Metadata Validation
```bash
# Inspect labels and configuration
docker inspect docker.io/dc1/llm-worker:latest | jq '.Config.Labels'

# Expected labels:
# "dc1.worker.type": "llm-inference"
# "dc1.worker.engine": "vllm"
# "dc1.worker.instant-model": "nvidia/Nemotron-Mini-4B-Instruct"
```

### ✅ Check 3: Provider Pull Test
```bash
# SSH to a provider VPS (example)
ssh -i /path/to/key ubuntu@<provider-ip>

# Pull the image
docker pull docker.io/dc1/llm-worker:latest

# Verify it's available
docker images | grep llm-worker
```

### ✅ Check 4: API Verification
```bash
# Backend should detect the image and allow job dispatch
curl -s https://api.dcp.sa/api/templates/vllm-serve | \
  jq '.containers[] | select(.name == "llm-worker")'

# Expected response: image registry path and availability status
```

---

## Rollback Procedure (if build fails)

### If GitHub workflow fails:
1. Check workflow logs for error: GitHub Actions UI → Run details
2. Common issues:
   - **Docker Hub auth failed:** Verify secrets are correct
   - **Base image not found:** Check `dc1/base-worker:latest` exists
   - **Model download timeout:** Increase timeout or skip pre-bake

3. **Fix and retry:**
   ```bash
   # Fix the issue, commit, and push
   git push origin main
   # Workflow retriggers automatically
   ```

### If local build fails:
1. Check Docker daemon is running: `docker ps`
2. Verify base image exists: `docker pull dc1/base-worker:latest`
3. Check network access to HuggingFace: `curl -I https://huggingface.co`
4. Retry with skip-prebake: `--build-arg SKIP_MODEL_PREBAKE=1`

### If push fails:
1. Verify auth: `docker logout && docker login`
2. Verify repo access: Check Docker Hub account has write permission to dc1/
3. Check disk space: `docker system df`
4. Retry push: `docker push docker.io/dc1/llm-worker:latest`

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| GitHub secrets configured | ⬜ Pending |
| Build triggered (GitHub or local) | ⬜ Pending |
| Images published to docker.io/dc1/ | ⬜ Pending |
| `docker pull` succeeds | ⬜ Pending |
| Image labels verified | ⬜ Pending |
| Providers can pull image | ⬜ Pending |
| Phase 1 job dispatch uses image | ⬜ Pending |

---

## Timeline Impact

- **If executed within 2 hours:** Zero impact on Phase 1 (Day 4 = 2026-03-26 08:00 UTC)
- **If executed by 2026-03-26 07:00 UTC:** Full integration testing possible
- **If delayed past Phase 1 start:** Provider job execution deferred to post-Phase 1

---

## Contact & Escalation

- **Owner:** ML Infrastructure Engineer (agent ID: 66668463-251a-4825-8a39-314000491624)
- **Blocker:** Docker Hub credentials (DOCKER_HUB_USERNAME, DOCKER_HUB_TOKEN)
- **Critical Path:** Required before Phase 1 Day 4 provider job execution
- **Escalation:** If credentials unavailable, Phase 1 testing reduced to API/routing validation only
