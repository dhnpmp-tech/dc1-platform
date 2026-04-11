# Arabic Portfolio Pre-Fetch Deployment Procedure
**Sprint 27 Operational Guide**

**Date:** 2026-03-23
**Version:** 1.0
**Status:** Ready for Execution (Awaiting Founder Approval for VPS)
**Target:** Activate Tier A models on first 3-5 active providers

---

## Executive Summary

This document specifies the exact steps to pre-fetch and cache the Arabic model portfolio on provider instances, eliminating cold-start latency (from 5-15 min to <30 sec).

**What Gets Pre-Fetched:**
- **Tier A (Hot Cache):** 6 foundation models for instant availability
- **Tier B (Warm Cache):** 4 Arabic-specialized models for rapid access
- **Location:** `/opt/dcp/model-cache` (persistent provider volume)

**Time Estimate:**
- Tier A download: 60-120 minutes (depends on internet speed)
- Tier B download: 40-60 minutes
- Per-provider, sequential: ~3 hours total first run

**Why This Matters:**
Cold-start latency is the #1 UX complaint in GPU marketplaces. Pre-fetching eliminates this for competitive advantage vs Vast.ai, RunPod, Lambda Labs.

---

## Part 1: Prerequisites & Validation

### 1.1 Provider Hardware Requirements

**Minimum Specs:**
```
✓ GPU: RTX 4090, RTX 4080, H100, A100 (8 GB+ VRAM)
✓ SSD: 500+ GB free space (/opt/dcp/model-cache)
✓ CPU: 8+ cores (for parallel model loading)
✓ RAM: 32+ GB system RAM
✓ Network: 100+ Mbps sustained (for ~3-hour download)
✓ Docker: 20.10+, buildx enabled
✓ HuggingFace Hub: accessible without VPN/proxy
```

### 1.2 Pre-Flight Checklist (Run on Provider)

```bash
# [Provider Operator] Run these checks before starting prefetch

# 1. Check free space
df -h /opt/dcp/model-cache
# Expected: 500+ GB available (du -sh /opt/dcp/model-cache should show < 50 GB initially)

# 2. Check Docker daemon
docker ps
docker images | grep dc1
# Expected: dc1/llm-worker:latest, dc1/sd-worker:latest present

# 3. Check HuggingFace connectivity
curl -s -I https://huggingface.co/models
# Expected: HTTP 200

# 4. Check daemon is running
pm2 list | grep dcp_daemon
# Expected: dcp_daemon in "online" status

# 5. Check provider registration
curl -s http://localhost:9000/api/provider/status
# Expected: { "provider_id": "...", "status": "registered" }
```

### 1.3 Environment Variables (DevOps Sets Up)

```bash
# Set these in PM2 env or .env file before running prefetch

export DCP_PROVIDER_HOST="<provider-ip-or-hostname>"
export DCP_PROVIDER_PORT="9000"  # daemon port
export DCP_PREFETCH_MODE="tier-a"  # or "tier-a-b", "full"
export DCP_PREFETCH_DRY_RUN="0"  # 1 for dry-run, 0 for actual
export DCP_PREFETCH_TIMEOUT_MINUTES="180"  # abort after 3 hours
export HF_HOME="/opt/dcp/model-cache/hf"  # persistent cache location
export TRANSFORMERS_CACHE="/opt/dcp/model-cache/transformers"
```

---

## Part 2: Model Tiers & Inventory

### 2.1 Tier A (Hot Cache) — Priority 1
**What:** 6 foundation models for instant availability
**When:** Deploy to ALL active providers immediately
**Disk Space:** 102 GB total

| # | Model | Repository | Size | VRAM | Purpose |
|---|---|---|---|---|---|
| 1 | ALLaM 7B Instruct | ailang/ALLaM-7B-Instruct-preview | 24 GB | 16+ GB | Arabic LLM |
| 2 | Falcon H1 7B Arabic | tiiuae/Falcon-H1-7B-Instruct | 24 GB | 16+ GB | Arabic LLM |
| 3 | Qwen 2.5 7B | Qwen/Qwen2.5-7B-Instruct | 16 GB | 16+ GB | General LLM + Arabic |
| 4 | Llama 3 8B | meta-llama/Meta-Llama-3-8B-Instruct | 16 GB | 16+ GB | General LLM |
| 5 | Mistral 7B | mistralai/Mistral-7B-Instruct-v0.3 | 14 GB | 14+ GB | General LLM |
| 6 | Nemotron Nano 4B | nvidia/Nemotron-Mini-4B-Instruct | 8 GB | 8+ GB | Compact LLM |

**Fetch Config Source:** `infra/config/arabic-portfolio.json` → `tiers.tier_a`

### 2.2 Tier B (Warm Cache) — Priority 2
**What:** 4 Arabic-specialized models for RAG + embedding
**When:** Deploy after Tier A completes
**Disk Space:** 40 GB total

| # | Model | Repository | Size | VRAM | Purpose |
|---|---|---|---|---|---|
| 7 | JAIS 13B | inception-mbzuai/jais-13b-chat | 26 GB | 24+ GB | Arabic LLM |
| 8 | BGE-M3 Embeddings | BAAI/bge-m3 | 7 GB | 8+ GB | Arabic Embeddings |
| 9 | BGE Reranker v2 | BAAI/bge-reranker-v2-m3 | 5 GB | 8+ GB | Cross-lingual Reranking |
| 10 | SDXL (Vision) | stabilityai/stable-diffusion-xl-base-1.0 | 2 GB | 12+ GB | Image Generation |

**Fetch Config Source:** `infra/config/arabic-portfolio.json` → `tiers.tier_b`

### 2.3 Benchmark Targets (SLAs)
```json
{
  "model": "ALLaM-7B-Instruct",
  "target_p95_ms": 1300,
  "target_cold_start_ms": 9500,
  "post_prefetch_cold_start_ms": 2000,
  "savings_percent": 79
}
```

**Goal:** Reduce cold-start from 9.5s (first download) to 2s (cached) = 79% improvement.

---

## Part 3: Dry-Run Mode (No Execution)

**USE THIS FIRST** to validate everything before executing the actual prefetch.

### 3.1 Validate Model List

```bash
# [ML Infra Engineer] Show what will be fetched
cd /home/node/dc1-platform

cat infra/config/arabic-portfolio.json | jq '.tiers.tier_a[] | {id, repo, min_vram_gb}'
# Output:
# {
#   "id": "allam-7b-instruct",
#   "repo": "ailang/ALLaM-7B-Instruct-preview",
#   "min_vram_gb": 24
# }
# ... (6 total)

# Total size calculation
cat infra/config/arabic-portfolio.json | jq '.tiers.tier_a | map(.repo) | length'
# Output: 6

echo "Tier A total: 102 GB"
echo "Tier B total: 40 GB"
echo "Combined: 142 GB"
```

### 3.2 Validate Script Syntax

```bash
# [DevOps] Check prefetch script for syntax errors
bash -n infra/docker/prefetch-models.sh
# Expected: No output (no errors)

# Show script version and help
head -20 infra/docker/prefetch-models.sh
# Expected: #!/bin/bash, comments explaining usage
```

### 3.3 Dry-Run Execution

```bash
# [DevOps] Simulate the prefetch without actually downloading anything
# This validates connectivity, script logic, and timing estimates

cd /home/node/dc1-platform

export DCP_PROVIDER_HOST="10.0.1.5"  # Example provider IP
export DCP_PROVIDER_PORT="9000"
export DCP_PREFETCH_MODE="tier-a"
export DCP_PREFETCH_DRY_RUN="1"  # ← KEY: Dry-run mode
export HF_HOME="/opt/dcp/model-cache/hf"

bash infra/docker/prefetch-models.sh

# Expected output:
# [DRY-RUN] Prefetch Mode: tier-a
# [DRY-RUN] Target Provider: 10.0.1.5:9000
# [DRY-RUN] Models to Fetch:
#   - ailang/ALLaM-7B-Instruct-preview (24 GB)
#   - tiiuae/Falcon-H1-7B-Instruct (24 GB)
#   ... (4 more)
# [DRY-RUN] Total Size: 102 GB
# [DRY-RUN] Estimated Time: 60-120 minutes (at 100 Mbps)
# [DRY-RUN] Disk Check: /opt/dcp/model-cache has 500 GB available ✓
# [DRY-RUN] Connectivity Check: daemon responds on 10.0.1.5:9000 ✓
# [DRY-RUN] No changes made. Re-run with DCP_PREFETCH_DRY_RUN=0 to execute.
```

### 3.4 Estimate Duration & Bandwidth

```bash
# [DevOps] Calculate time based on provider internet speed

# Test provider bandwidth
ssh provider@10.0.1.5 "speedtest-cli --simple"
# Output: download 1000000000 bits/sec (1 Gbps)

# Calculate time
TOTAL_GB=102
BANDWIDTH_MBPS=1000  # 1 Gbps = 1000 Mbps
TIME_MINUTES=$((($TOTAL_GB * 8192) / $BANDWIDTH_MBPS))
echo "Estimated Tier A prefetch time: $TIME_MINUTES minutes"
# Output: Estimated Tier A prefetch time: 13 minutes (at 1 Gbps)

# At typical 100 Mbps:
TIME_MINUTES=$(( ($TOTAL_GB * 8192) / 100 ))
echo "Estimated Tier A prefetch time: $TIME_MINUTES minutes (at 100 Mbps)"
# Output: Estimated Tier A prefetch time: 8355 minutes = 5.8 hours (at 100 Mbps)
```

**Rule of Thumb:**
- At 1 Gbps: ~15 minutes per Tier A
- At 100 Mbps: ~2.5 hours per Tier A
- At 50 Mbps: ~5 hours per Tier A

---

## Part 4: Actual Execution (REQUIRES FOUNDER APPROVAL)

### 4.1 Pre-Execution Checklist

```bash
# [DevOps] Before executing, verify:
- [ ] Founder has approved via DEPLOY REQUEST issue
- [ ] Dry-run completed successfully
- [ ] Provider has 500+ GB free space
- [ ] Provider internet stable (no VPN/proxy issues)
- [ ] Maintenance window scheduled (provider unavailable for 3-6 hours)
- [ ] Monitoring dashboard open (to track progress)
- [ ] Rollback plan documented (in case of failure)
```

### 4.2 Execute Prefetch

```bash
# [DevOps] Run the actual prefetch (ONLY with founder approval)

cd /home/node/dc1-platform

export DCP_PROVIDER_HOST="10.0.1.5"
export DCP_PROVIDER_PORT="9000"
export DCP_PREFETCH_MODE="tier-a"
export DCP_PREFETCH_DRY_RUN="0"  # ← ACTUAL EXECUTION
export DCP_PREFETCH_TIMEOUT_MINUTES="180"
export HF_HOME="/opt/dcp/model-cache/hf"

# Start prefetch and log output
bash infra/docker/prefetch-models.sh | tee /tmp/prefetch-$(date +%Y%m%d-%H%M%S).log

# Expected output (first 5 minutes):
# [2026-03-23 14:00:00] Starting Tier A prefetch on 10.0.1.5:9000
# [2026-03-23 14:00:05] Validating provider connectivity... ✓
# [2026-03-23 14:00:10] Checking disk space... ✓
# [2026-03-23 14:00:15] Starting model download: ailang/ALLaM-7B-Instruct-preview (24 GB)
# [2026-03-23 14:02:30] Downloaded 500 MB / 24 GB (2.1%) | ETA 18 minutes
# ... (continues for 60-120 minutes)
# [2026-03-23 15:45:00] Model download complete: ailang/ALLaM-7B-Instruct-preview
# [2026-03-23 15:45:15] Verifying model integrity...
# [2026-03-23 15:46:00] ✓ Model verified
# [2026-03-23 15:46:05] Moving to next model: tiiuae/Falcon-H1-7B-Instruct
# ... (repeats for each model)
# [2026-03-23 18:30:00] All Tier A models prefetched successfully
# [2026-03-23 18:30:05] Cache Summary:
#   - Total models cached: 6
#   - Total disk used: 102 GB
#   - Cache location: /opt/dcp/model-cache
#   - Next models ready for Tier B prefetch
```

### 4.3 Monitoring During Execution

```bash
# [DevOps/ML Infra] Monitor progress in separate terminal

# Watch provider disk usage
watch -n 5 'ssh provider@10.0.1.5 "du -sh /opt/dcp/model-cache"'
# Expected: incrementing (0 → 10 GB → 30 GB → 102 GB)

# Check provider network
watch -n 5 'ssh provider@10.0.1.5 "ifstat 1 1 | tail -1"'
# Expected: 100+ Mbps RX during download

# Monitor Docker daemon
watch -n 5 'ssh provider@10.0.1.5 "docker stats"'
# Expected: Container running, pulling layers

# Check HF cache directory
ssh provider@10.0.1.5 "ls -lh /opt/dcp/model-cache/hf/"
# Expected: snapshots/ directory with model versions
```

### 4.4 Post-Execution Validation

```bash
# [ML Infra] Verify all models cached correctly

# 1. Check disk usage
ssh provider@10.0.1.5 'du -sh /opt/dcp/model-cache'
# Expected: 102+ GB

# 2. Verify model files exist
ssh provider@10.0.1.5 'find /opt/dcp/model-cache -type f -name "config.json" | wc -l'
# Expected: 6 (one per model)

# 3. Test cold-start latency
curl -X POST http://10.0.1.5:9000/api/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "ailang/ALLaM-7B-Instruct-preview",
    "prompt": "مرحبا",
    "max_tokens": 10
  }' | jq '.cold_start_ms'
# Expected: < 3000 ms (was 9500 ms before prefetch)

# 4. Benchmark all models
bash scripts/benchmark-prefetch-models.sh provider=10.0.1.5
# Expected: latency_ms < target SLA for each model
```

---

## Part 5: Tier B Pre-Fetch (After Tier A Completes)

### 5.1 Sequential Deployment

```bash
# [DevOps] After Tier A completes successfully, deploy Tier B
# Tier B adds Arabic-specialized models for RAG

export DCP_PREFETCH_MODE="tier-b"  # ← Changed from "tier-a"
export DCP_PREFETCH_DRY_RUN="0"

bash infra/docker/prefetch-models.sh | tee /tmp/prefetch-tierb-$(date +%Y%m%d-%H%M%S).log

# Expected total time for Tier B: 40-60 minutes
# Final cache size: 142 GB (102 Tier A + 40 Tier B)
```

### 5.2 Combined Tier A+B Deployment

```bash
# [Advanced] Deploy all tiers at once (not recommended for first providers)

export DCP_PREFETCH_MODE="tier-a-b"
bash infra/docker/prefetch-models.sh
# Total time: ~3-4 hours
# Total space: 142 GB
```

---

## Part 6: Troubleshooting & Rollback

### 6.1 Common Issues

**Issue: "Provider not responding on port 9000"**
```bash
# Cause: Daemon not running or wrong IP
# Fix:
ssh provider@<ip> "pm2 list | grep dcp_daemon"
# If not online:
ssh provider@<ip> "pm2 start dcp_daemon"
# Wait 5 seconds and retry prefetch
```

**Issue: "Disk space exhausted"**
```bash
# Cause: Provider only had 400 GB free, not 500 GB
# Fix: Delete old cache and retry
ssh provider@<ip> "rm -rf /opt/dcp/model-cache/*"
# Verify free space
ssh provider@<ip> "df -h /opt/dcp/model-cache"
# Retry prefetch
```

**Issue: "Timeout after 180 minutes"**
```bash
# Cause: Internet too slow (< 50 Mbps)
# Fix: Increase timeout
export DCP_PREFETCH_TIMEOUT_MINUTES="360"
# Re-run (will skip already-cached models, only download missing ones)
bash infra/docker/prefetch-models.sh
```

**Issue: "Model download failed / corrupted"**
```bash
# Cause: Interrupted download or cache corruption
# Fix: Clear cache and retry
ssh provider@<ip> "rm -rf /opt/dcp/model-cache/hf/snapshots/<model-hash>"
# Re-run prefetch (will re-download that model)
bash infra/docker/prefetch-models.sh
```

### 6.2 Rollback (Manual Cache Deletion)

```bash
# [DevOps] If prefetch fails and cannot be recovered

ssh provider@10.0.1.5 'rm -rf /opt/dcp/model-cache/*'
# Wait for confirmation
ssh provider@10.0.1.5 'df -h /opt/dcp/model-cache'
# Expected: 500+ GB free

# Provider is back to clean state, ready for retry
```

---

## Part 7: Monitoring & Performance Dashboards

### 7.1 Cache Status Dashboard (Real-Time)

```bash
# [DevOps] Monitor prefetch across all providers

# Run this in a tmux window for continuous monitoring
watch -n 10 '
for provider in 10.0.1.5 10.0.1.6 10.0.1.7; do
  echo "=== Provider $provider ==="
  ssh $provider "du -sh /opt/dcp/model-cache && echo && ls -1 /opt/dcp/model-cache/hf/snapshots | wc -l"
done
'

# Output:
# === Provider 10.0.1.5 ===
# 102G    /opt/dcp/model-cache
# 6
#
# === Provider 10.0.1.6 ===
# 45G     /opt/dcp/model-cache
# (prefetch in progress)
#
# === Provider 10.0.1.7 ===
# 0G      /opt/dcp/model-cache
# (not started)
```

### 7.2 Performance Benchmark Dashboard

```bash
# [ML Infra] Run benchmarks to measure improvement

bash scripts/benchmark-prefetch-models.sh \
  --providers "10.0.1.5,10.0.1.6,10.0.1.7" \
  --output-format csv > /tmp/prefetch-benchmark-$(date +%Y%m%d).csv

# CSV output:
# provider,model_id,cold_start_ms_before,cold_start_ms_after,improvement_percent
# 10.0.1.5,ailang/ALLaM-7B-Instruct-preview,9500,2000,79%
# 10.0.1.5,tiiuae/Falcon-H1-7B-Instruct,9000,1900,79%
# ... (etc)

# Post to monitoring dashboard for tracking
curl -X POST http://monitoring.internal/api/metrics \
  -H "Content-Type: text/csv" \
  -d @/tmp/prefetch-benchmark-$(date +%Y%m%d).csv
```

---

## Part 8: Provider Activation Sequence (Recommended)

### Phase 1 (Week 1): First 3 Providers
1. Select: RTX 4090 or H100 providers with strong internet
2. Run dry-run on each
3. Execute Tier A prefetch sequentially (6 hours total for 3)
4. Validate cache on each
5. Monitor for 24 hours (any issues?)

### Phase 2 (Week 2): Next 5 Providers
1. Expand to RTX 4080 + gaming center providers
2. Batch dry-runs in parallel (faster validation)
3. Execute Tier A prefetch (30 min apart, not simultaneous)
4. Validate and monitor

### Phase 3 (Week 3): Full Rollout
1. Deploy to all 43 registered providers
2. Auto-prefetch via daemon (CI/CD integration)
3. Monitor cache hit rate (should be 90%+)

---

## Part 9: DEPLOY REQUEST Template

**Copy this when requesting founder approval for actual VPS/provider deployment:**

```markdown
# DEPLOY REQUEST: Arabic Portfolio Pre-Fetch (Tier A)

**Status:** Ready for Execution
**Blocked:** Awaiting founder approval

## What Will Execute
```bash
export DCP_PROVIDER_HOST="10.0.1.5"
export DCP_PROVIDER_PORT="9000"
export DCP_PREFETCH_MODE="tier-a"
export DCP_PREFETCH_DRY_RUN="0"  # ACTUAL EXECUTION
bash infra/docker/prefetch-models.sh
```

## Impact
- Downloads 6 foundation models (102 GB total)
- Caches to `/opt/dcp/model-cache` (persistent)
- Execution time: 60-120 minutes
- Provider unavailable during download (maintenance mode)
- Post-deployment: cold-start latency improves 79% (9.5s → 2s)

## Validation
- [x] Dry-run completed successfully
- [x] Disk space confirmed (500+ GB)
- [x] Provider connectivity validated
- [x] HuggingFace Hub accessible
- [x] Monitoring dashboard ready

## Rollback Plan
- If failed: `ssh provider rm -rf /opt/dcp/model-cache/*`
- Re-run prefetch (will resume from checkpoint)

## Approval
Awaiting @founder (Peter / setup@oida.ae) written approval to proceed.
```

---

## References

- Script: `infra/docker/prefetch-models.sh`
- Config: `infra/config/arabic-portfolio.json`
- Ops Guide: `docs/arabic-portfolio-serving-ops.md`
- Roadmap: `docs/roadmap-to-production.md`

---

## Success Metrics

✓ All 6 Tier A models cached on provider
✓ Cold-start latency < 3000 ms (down from 9500 ms)
✓ Cache disk usage: 102 GB (Tier A only)
✓ Zero model load failures in 24-hour monitor window
✓ First renter job submitted and completed successfully on prefetched provider

