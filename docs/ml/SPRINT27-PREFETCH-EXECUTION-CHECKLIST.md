# Sprint 27: Prefetch Deployment Execution Checklist

**Quick Reference for Prefetch Deployment**
**Created:** 2026-03-23
**Status:** Ready for Execution (Pending Founder Approval)

---

## Pre-Deployment Checklist (Local/Staging)

### Environment Setup
- [ ] Confirm target VPS or provider host: `76.13.179.86` or `<provider-ip>`
- [ ] Verify SSH access to target host
- [ ] Confirm HF_TOKEN is available (if private repo access needed)
- [ ] Verify network bandwidth ≥100 Mbps (required for 91-min Tier A prefetch)

### Script & Config Validation
- [ ] Script exists: `/home/node/dc1-platform/infra/docker/prefetch-models.sh` ✓
- [ ] Config exists: `/home/node/dc1-platform/infra/config/arabic-portfolio.json` ✓
- [ ] Setup script exists: `/home/node/dc1-platform/infra/setup-model-cache.sh` ✓
- [ ] Hardware validator exists: `/home/node/dc1-platform/scripts/validate-provider-hardware.sh` ✓

### Documentation Review
- [ ] Read `docs/ml/prefetch-validation-results.md` — understand model specs
- [ ] Read `docs/ml/sprint27-inference-benchmarks.md` — understand target metrics
- [ ] Read `docs/ml/sprint27-arabic-rag-validation.md` — understand end-to-end pipeline
- [ ] Read `docs/ml/PREFETCH-DEPLOYMENT-PROCEDURE-SPRINT27.md` (if exists)

---

## Phase 1: Provider Hardware Validation

**Duration:** ~10 minutes per provider

### On Target Provider/VPS
```bash
cd /home/node/dc1-platform
./scripts/validate-provider-hardware.sh --tier tier_a --verbose

# Expected output:
# ✓ Docker daemon responsive
# ✓ Found 1 GPU(s)
# ✓ CUDA version 12.2+ compatible
# ✓ Available disk space: XXX GB (required: 125 GB)
# ✓ Disk write speed: XXX MB/s (adequate for prefetch)
# ✓ Hardware validation PASSED
```

**Success Criteria:**
- All checks return `✓` (green)
- VRAM available: ≥104 GB (for all Tier A hot models)
- Disk space available: ≥125 GB
- Disk write speed: ≥50 MB/s (for 91-min prefetch window)

**If Validation Fails:**
- Red (✗) items block deployment
- Yellow (⚠) items are warnings (can proceed with caution)
- Review output, fix prerequisites, re-run validation

---

## Phase 2: Setup Model Cache Directories

**Duration:** ~2 minutes

### On Target Provider/VPS
```bash
cd /home/node/dc1-platform

# This script creates directories and Docker volume
./infra/setup-model-cache.sh

# Expected output:
# volume exists: dcp-model-cache
# created docker volume dcp-model-cache -> /opt/dcp/model-cache
```

**Verify Setup:**
```bash
docker volume inspect dcp-model-cache  # Should succeed
ls -la /opt/dcp/model-cache            # Should exist
df -h /opt/dcp/model-cache             # Check space
```

---

## Phase 3: Execute Prefetch (Tier A)

**Duration:** ~91 minutes @ 100 Mbps network speed

### Command
```bash
cd /home/node/dc1-platform

export DCP_PREWARM_TIER=tier_a
export DCP_PREWARM_POLICY=hot-warm
export DCP_MODEL_CACHE_ROOT=/opt/dcp/model-cache
export DCP_MODEL_CACHE_VOLUME=dcp-model-cache
export DCP_CACHE_HIGH_WATERMARK_PCT=90

./infra/docker/prefetch-models.sh 2>&1 | tee prefetch-$(date +%Y%m%d_%H%M%S).log
```

**Expected Output:**
```
prefetch start: allam-7b-instruct (ALLaM-AI/ALLaM-7B-Instruct-preview)
... [docker run, huggingface_hub download] ...
prefetch done: allam-7b-instruct

prefetch start: falcon-h1-arabic-7b (tiiuae/Falcon-H1-7B-Instruct)
... [similar] ...
prefetch done: falcon-h1-arabic-7b

[continues for all 6 Tier A models...]

model prefetch complete (prefetched=6, skipped=0, tier=tier_a, policy=hot-warm)
cache disk usage:
Filesystem       Size  Used Avail Use% Mounted on
...              ...   104G  ...  ...  /opt/dcp/model-cache
```

**Success Criteria:**
- All 6 models download without error
- Cache directory ≈ 104 GB used
- Final log line shows `prefetched=6, skipped=0`
- No "error:" or "ERROR:" lines in output

**If Prefetch Fails:**
- Check network connectivity: `ping huggingface.co`
- Check disk space: `df -h /opt/dcp/model-cache`
- Check HuggingFace Hub status: https://huggingface.co/
- Retry with `resume_download=True` (already in script)
- Check logs for specific model failure

---

## Phase 4: Verify Cache Integrity

**Duration:** ~5 minutes

### Check Cache Contents
```bash
du -sh /opt/dcp/model-cache                    # Should be ~104 GB
du -sh /opt/dcp/model-cache/hf/models--*       # List all model dirs

# Expected structure:
# /opt/dcp/model-cache/hf/models--ALLaM-AI--ALLaM-7B-Instruct-preview
# /opt/dcp/model-cache/hf/models--tiiuae--Falcon-H1-7B-Instruct
# /opt/dcp/model-cache/hf/models--Qwen--Qwen2.5-7B-Instruct
# /opt/dcp/model-cache/hf/models--meta-llama--Meta-Llama-3-8B-Instruct
# /opt/dcp/model-cache/hf/models--mistralai--Mistral-7B-Instruct-v0.2
# /opt/dcp/model-cache/hf/models--nvidia--Nemotron-Mini-4B-Instruct
```

### Verify Model Files
```bash
# Check one model as example
ls -la /opt/dcp/model-cache/hf/models--ALLaM-AI--ALLaM-7B-Instruct-preview/

# Should contain: pytorch_model.bin, config.json, tokenizer.json, etc.
# pytorch_model.bin should be ~24 GB
```

**Success Criteria:**
- Cache directory is 100-110 GB (104 GB ± overhead)
- All 6 model directories present
- Each model contains required files (not just lock files)
- No partial downloads (no .incomplete files)

---

## Phase 5: Test Cold-Start Latency

**Duration:** ~10 minutes (one quick inference test per model)

### Quick Inference Test (Using vLLM)
```bash
# Start one model in a test container
docker run --rm \
  -e HF_HOME=/cache/hf \
  -e TRANSFORMERS_CACHE=/cache/hf \
  -e HUGGINGFACE_HUB_CACHE=/cache/hf \
  -v dcp-model-cache:/cache \
  -v /dev/shm:/dev/shm \
  --gpus all \
  vllm/vllm-openai:latest \
  --model ailang/ALLaM-7B-Instruct \
  --served-model-name allam-7b \
  &

# Wait 30-60 seconds for startup
sleep 45

# Test with curl
curl -X POST http://127.0.0.1:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "allam-7b",
    "prompt": "مرحبا",
    "max_tokens": 10,
    "temperature": 0
  }'

# Expected: Returns Arabic completion in < 5 seconds
```

**Success Criteria:**
- Container starts without errors
- HTTP request succeeds (200 status)
- Inference completes in < 10 seconds per query
- Output is valid Arabic text

---

## Phase 6: Post-Deployment Documentation

### Document Results
```bash
# Capture final state
cat > /tmp/prefetch-deployment-summary.txt << 'EOF'
Prefetch Deployment Summary
Date: $(date -u '+%Y-%m-%d %H:%M UTC')
Target: VPS 76.13.179.86
Tier: tier_a

Hardware:
$(nvidia-smi -q -d Memory | head -10)

Cache Status:
$(du -sh /opt/dcp/model-cache/hf/models--*)

Execution Time: $(grep "prefetch complete" prefetch-*.log)
EOF

cat /tmp/prefetch-deployment-summary.txt
```

### Archive Logs
```bash
tar czf ~/prefetch-deployment-$(date +%Y%m%d_%H%M%S).tar.gz \
  /home/node/dc1-platform/prefetch-*.log \
  /tmp/prefetch-deployment-summary.txt
```

---

## Phase 7: Notify QA Engineer

### Communication
Post update to **DCP-619** (Metering Verification) and **DCP-641** (Phase 1 Integration Testing):

```
Prefetch deployment complete on VPS 76.13.179.86

✅ All 6 Tier A models cached
✅ Cache size: ~104 GB
✅ Hardware validation passed
✅ Cold-start latency verified

Ready for QA benchmark execution. See docs/ml/sprint27-inference-benchmarks.md for test plan.
```

---

## Rollback Procedure (If Needed)

### Quick Rollback
```bash
# Fastest: Clear cache (preserves Docker volume)
rm -rf /opt/dcp/model-cache/hf/*

# Full rollback: Remove volume
docker volume rm dcp-model-cache
sudo rm -rf /opt/dcp/model-cache
```

**Expected Result:** ~15 minutes to restore from scratch

---

## Success Criteria Summary

| Phase | Criterion | Success |
|-------|-----------|---------|
| **1** | Hardware validation passes | ✓ |
| **2** | Cache directories created | ✓ |
| **3** | Prefetch completes (prefetched=6) | ✓ |
| **4** | Cache ≈104 GB, 6 model dirs present | ✓ |
| **5** | Cold-start latency < 10 sec | ✓ |
| **6** | Logs archived | ✓ |
| **7** | QA notified, ready for benchmarks | ✓ |

---

## Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Hardware Validation | 10 min | 10 min |
| Setup Directories | 2 min | 12 min |
| Prefetch (Tier A) | 91 min | 103 min |
| Verify Cache | 5 min | 108 min |
| Cold-Start Test | 10 min | 118 min |
| Documentation | 5 min | 123 min |
| **Total** | **~2 hours** | |

---

## Key Documents

- **Validation Results:** `docs/ml/prefetch-validation-results.md`
- **Benchmark Specs:** `docs/ml/sprint27-inference-benchmarks.md`
- **RAG Validation:** `docs/ml/sprint27-arabic-rag-validation.md`
- **Hardware Validator:** `scripts/validate-provider-hardware.sh`
- **Prefetch Script:** `infra/docker/prefetch-models.sh`
- **Setup Script:** `infra/setup-model-cache.sh`

---

## Escalation

**If blocked on:**
- Network issues → Check VPS connectivity, HuggingFace Hub status
- Disk space → Clean unused containers, resize volume
- GPU issues → Run hardware validator, check nvidia-smi
- Model download failures → Check HF token, verify repo IDs

**Escalate to:** Founder (setup@oida.ae) with detailed error logs

---

**Document Version:** 1.0
**Last Updated:** 2026-03-23 15:25 UTC
**Status:** READY FOR EXECUTION
