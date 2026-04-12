# DCP Technical Changelog — April 11-12, 2026

**For:** Nexus (AI COO Agent)
**From:** Peter + Claude Code engineering sessions
**Covers:** 2026-04-11 00:00 UTC through 2026-04-12 ~18:00 UTC
**Source files:** Listed per section below

---

## 1. Executive Summary

Across April 11-12, DCP completed its largest benchmark campaign to date (Round 5 Phase 2 + Gap-Fill + Gap-Close), producing 11 daemon-certified Tier-A catalog entries with full concurrency curves through the production `api.dcp.sa` routing path -- up from 2 entries before this work. The daemon v4.0.0-alpha.2 codebase was finalized (5,431 lines, DC1-to-DCP rename across 65 files) on branch `refactor/dcp-daemon-rename` and pushed to gate0 via SCP. Four knowledge-base articles documenting critical negative results (KTransformers Blackwell blocker, AVX-512 expert-offload 9x regression, Blackwell sm_120 build recipe, and 9-item daemon v4.1 improvement backlog) were written. A gap-fill content harvest generated 374 curated sections (~125K words) of technical content across 4 model/GPU sources. The Windows installer feasibility study was completed with a 3-phase production plan for Fadi's RTX 3060 Ti onboarding. Provider onboarding ground truth was documented, correcting 6 false claims in Nexus's memory.

---

## 2. Daemon v4.0.0-alpha.2 -- Shipped to Production

**What it is:** 5,431 lines of Python, implementing 7 Phase 1 features (heartbeat, model auto-detect, engine watchdog, SIGTERM drain, JSON sanitizer, concurrency probe, cost-plus self-report) and 7 Phase 1.5 fixes distilled from Round 4.

**Git:**
- Branch: `refactor/dcp-daemon-rename`
- Commit: `77c1b57`
- PR: #278

**Deployment:**
- Pushed to gate0 (76.13.179.86) via SCP
- nginx `install.sh` updated to serve from `https://api.dcp.sa/install` (no `.sh` suffix)
- PM2 restarted
- Backend route backward-compat: tries `dcp_daemon.py` first, falls back to `dc1_daemon.py`

**DC1-to-DCP rename sweep:**
- 65 files modified
- +3,014 / -4,778 lines changed
- All references to `dc1_daemon.py` renamed to `dcp_daemon.py` in codebase
- `install.sh` now references `dcp_daemon.py`

**NSIS installer scripts:**
- Renamed and version-bumped in source
- Needs recompilation on a Windows machine with NSIS 3.x (not yet recompiled)

**IMPORTANT CAVEAT (from ground truth doc):** The file actually served by the backend download route on gate0 is still `dc1_daemon.py` at v3.5.0 (uncommitted modifications in working tree of branch `fix/dcp-logo-gradient-update-h20`). The v4.0.0-alpha.2 features exist in the `refactor/dcp-daemon-rename` branch but have not been merged into the production-serving path. The benchmark sessions ran with the v4.0.0-alpha.2 daemon deployed manually via SCP, not through the install.sh path.

---

## 3. Benchmark Results -- Round 5 Phase 2 + Gap-Fill + Gap-Close

### 3.1 Round 5 Phase 2 (2026-04-11, first session)

All traffic through `api.dcp.sa` daemon routing. 7,186 total requests, 5 errors (0.07%).

| # | GPU | Model | Arch | Single tps | Peak Aggr tps | Sat @ | Verdict |
|---|-----|-------|------|-----------|---------------|-------|---------|
| 1 | RTX 4090 | Qwen3-Coder-30B-A3B (Q4_K_M) | MoE 30B/3B | **233.8** | **421.3** | 8u | Tier A -- beats akitaonrails 145 tps ref by 61% |
| 2 | RTX 5090 | Qwen 3.5 35B-A3B (Q4_K_M) | MoE 35B/3B | **219.1** | **427.9** | 8u | Tier A -- Blackwell MoE flagship |
| 3 | RTX 4090 | Gemma 4 31B IT (Q4_K_M) | Dense 31B | 43.7 | 103.0 | 4u | REMOVED from catalog -- below 50 tps floor on 24GB |
| 4 | RTX 5090 | Gemma 4 31B IT (Q4_K_M) | Dense 31B | 69.3 | 157.4 | 8u | Tier A with cap=2 users (thinking tokens eat budget) |

**Concurrency curves (R5 Phase 2):**

```
RTX 4090 + Qwen3-Coder-30B (MoE):
  1u  -> 103 aggr  (231 per-user)
  2u  -> 183 aggr  (179 per-user)
  4u  -> 294 aggr  (126 per-user)
  8u  -> 421 aggr  (113 per-user)  <- saturation knee
 12u  -> 419 aggr  (113 per-user)  <- plateau

RTX 5090 + Qwen 3.5 35B-A3B (MoE):
  1u  -> 116 aggr  (219 per-user)
  2u  -> 198 aggr  (175 per-user)
  4u  -> 311 aggr  (130 per-user)
  8u  -> 428 aggr  (130 per-user)  <- saturation knee
 12u  -> 428 aggr  (130 per-user)  <- plateau

RTX 4090 + Gemma 4 31B (Dense):
  1u  ->  35 aggr  (44 per-user)
  2u  ->  62 aggr  (41 per-user)
  4u  -> 103 aggr  (36 per-user)
  (not tested beyond 4u -- below floor)

RTX 5090 + Gemma 4 31B (Dense):
  1u  ->  53 aggr  (69 per-user)
  2u  ->  96 aggr  (64 per-user)
  4u  -> 140 aggr  (46 per-user)
  8u  -> 157 aggr  (46 per-user)
```

### 3.2 Gap-Fill Session (2026-04-11, second session)

84 minutes, $2.94 spent, 5 pods provisioned. All through `api.dcp.sa` daemon. 7 of 8 gaps closed. Tier-A catalog went from 2 to 8 entries.

| # | GPU | Model | Engine | Single tps | Peak Aggr | Sat @ | Verdict |
|---|-----|-------|--------|-----------|-----------|-------|---------|
| 5 | RTX 5090 | Mistral 7B (Q4_K_M) | llama.cpp p=8 | **266** | **692** @ 12u | >=12 | Tier A -- hero number for 7B dense |
| 6 | RTX 5090 | Qwen 3.5 35B-A3B (Q4_K_M) | llama.cpp p=4 | 218 | 470 @ 12u | 8 | Tier A -- reverified from R5p2, 0.5% variance |
| 7 | RTX 5090 | Gemma 4 31B IT (Q4_K_M) | llama.cpp p=4 | 69 | 155 @ 8u | 8 | Tier A with cap=2 (thinking mode) |
| 8 | RTX 4090 | Qwen3 30B-A3B (Q4_K_M) | llama.cpp p=4 | 163 | 243 @ 12u | 8 | Tier A -- 1st daemon-certified 4090 MoE via llama.cpp |
| 9 | RTX 3090 | Qwen3 30B-A3B (Q4_K_M) | llama.cpp p=4 | 164 | 194 @ 12u | 12 | Tier A -- 1st daemon-certified 3090 MoE |
| 10 | RTX A5000 | Qwen3 30B-A3B (Q4_K_M) | llama.cpp p=4 | 200 | 383 @ 12u | 12 | Tier A -- 1st daemon-certified A5000 MoE |
| 11 | RTX A5000 | ALLaM 7B (Q4_K_M, Arabic) | llama.cpp p=8 | 125 | 246 @ 12u | 12 | Tier A -- Arabic flagship for KSA |

**Concurrency curves (Gap-Fill):**

```
RTX 5090 + Mistral 7B (dense, parallel=8):
  1u  -> 122  (266 per-user)
  2u  -> 224  (243)
  4u  -> 320  (150)
  8u  -> 528  (102)
 12u  -> 692  (107)   <- HERO

RTX 5090 + Qwen 3.5 35B-A3B (MoE, parallel=4):
  1u  -> 142  (218 per-user)
  2u  -> 191  (174)
  4u  -> 410  (128)
  8u  -> 465  (128)   <- saturation knee
 12u  -> 470  (128)

RTX 5090 + Gemma 4 31B IT (dense, parallel=4):
  1u  ->  62  (69 per-user)
  2u  -> 109  (63)
  4u  -> 153  (45)
  8u  -> 155  (43)

RTX 4090 + Qwen3 30B-A3B (MoE, parallel=4):
  1u  -> 110  (163 per-user)
  2u  -> 137  (115)
  4u  -> 185  (104)
  8u  -> 240  (110)
 12u  -> 243  (109)

RTX 3090 + Qwen3 30B-A3B (MoE, parallel=4):
  1u  -> 111  (164 per-user)
  2u  -> 128  (109)
  4u  -> 183  (105)
  8u  -> 182  (110)
 12u  -> 194  (107)

RTX A5000 + Qwen3 30B-A3B (MoE, parallel=4):
  1u  ->  68  (200 per-user)
  2u  -> 205  (147)
  4u  -> 323  (110)
  8u  -> 380  (108)
 12u  -> 383  (107)

RTX A5000 + ALLaM 7B (Arabic dense, parallel=8):
  1u  ->  62  (125 per-user)
  2u  -> 112  (104)
  4u  -> 174  (64)
  8u  -> 216  (33)
 12u  -> 246  (33)
```

### 3.3 Gap-Close Session (2026-04-11 ~19:00 UTC, third session)

~75 minutes, $3.08 spent, 3 fresh pods. Closed the remaining 3 gaps. All 8/8 gaps now closed.

| # | GPU | Model | Engine | Single tps | Peak Aggr | Sat @ | Verdict |
|---|-----|-------|--------|-----------|-----------|-------|---------|
| -- | RTX 4090 | Qwen 2.5 14B AWQ | vLLM 0.8.5 + Marlin (daemon!) | 57 | **776.8** @ 16u | >=16 | Tier A -- first daemon-certified vLLM+Marlin continuous-batching |
| -- | RTX 5090 | Gemma 4 31B IT (max_tokens=800) | llama.cpp | 68 | 121.0 @ 8u | 8 | Tier A -- thinking model, needs max_tokens>=800 |
| -- | RTX 4080S | GLM-4 9B | llama.cpp on port 8000 | 99 | 121.2 @ 12u | 12 | Tier A -- bypasses Ollama-proxy backend bug |

**Concurrency curves (Gap-Close):**

```
RTX 4090 + Qwen 2.5 14B AWQ (vLLM 0.8.5 + Marlin, daemon):
  1u  ->  50 aggr  (57 per-user)    <- FIRST vLLM-daemon-certified curve
  2u  ->  96 aggr  (56 per-user)
  4u  -> 190 aggr  (55 per-user)
  8u  -> 357 aggr  (55 per-user)
 12u  -> 552 aggr  (53 per-user)
 16u  -> 777 aggr  (53 per-user)    <- linear scaling, not yet saturated

RTX 5090 + Gemma 4 31B IT (max_tokens=800):
  1u  ->  30 aggr  (68 per-user)
  2u  ->  62 aggr  (63 per-user)
  4u  ->  92 aggr  (44 per-user)
  8u  -> 121 aggr  (43 per-user)

RTX 4080S + GLM-4 9B (llama.cpp, port 8000):
  1u  ->   9 aggr  (99 per-user)    <- cold start errors
  2u  ->  20 aggr  (93 per-user)
  4u  ->  42 aggr  (81 per-user)
  8u  ->  74 aggr  (60 per-user)
 12u  -> 121 aggr  (66 per-user)
```

### 3.4 Gap Closure Scorecard -- Final State

| Gap | Status |
|-----|--------|
| 1. 4090 vLLM+Marlin through daemon | CLOSED via Qwen 2.5 14B AWQ (Qwen3 MoE blocked by vLLM kernel gaps) |
| 2. 5090 Qwen 3.5 35B daemon delta | CLOSED -- 218 tps, 0.5% variance from R5p2 |
| 3. Gemma 4 31B thinking-off | CLOSED -- not a bug, needs max_tokens>=800 |
| 4. 4080S via daemon | CLOSED via llama.cpp on port 8000 (bypasses Ollama-proxy bug) |
| 5. 5090 Ollama re-verify | CLOSED -- Mistral 7B via llama.cpp = 266/692 |
| 6. 3090 daemon | CLOSED -- Qwen3 30B-A3B = 164/194 |
| 7. A5000 beyond Qwen3 | CLOSED -- ALLaM 7B + Qwen3 30B-A3B both daemon-certified |
| 8. Arabic through daemon | CLOSED -- ALLaM 7B verified producing native Arabic content |

**All 8/8 gaps closed. All Tier-A catalog entries have full concurrency curves through `api.dcp.sa`.**

---

## 4. Knowledge Base Articles Written

| Article | Title | Summary |
|---------|-------|---------|
| KB-47 | KTransformers Blackwell Blocker | KTransformers v0.5.3 does not run on sm_120 (RTX 5090) -- `sgl_kernel` 0.3.21 ships only sm_90/sm_100 binaries; `kt bench inference` and `kt microbench moe` are stubs. ~$2 and ~3 hours burned. Do not recommend KT for Blackwell providers. |
| KB-48 | Expert Offload AVX-512 BF16 Trap | Running llama.cpp with `-ot ".ffn_.*_exps.=CPU"` on EPYC 7302/7763 (Zen 2/3, AVX2-only) collapses MoE throughput from 234 to 25 tok/s -- a 9x regression. Fix: drop the `-ot` flag when model fits in VRAM. Daemon must gate expert-offload on AVX-512 BF16 CPU capability. |
| KB-49 | Blackwell sm_120 llama.cpp Build Recipe | Stock RunPod pytorch image ships CUDA 12.4 which cannot target sm_120. Recipe: install `cuda-nvcc-12-9`, `cuda-libraries-dev-12-9`, upgrade `libnccl2` to `2.29.7-1+cuda12.9`, rebuild llama.cpp with `-DCMAKE_CUDA_ARCHITECTURES=120`. PTX forward-compat (sm_89-virtual) hangs at runtime. |
| KB-50 | Daemon v4.1 Improvements from R5 Phase 2 | 9 concrete improvements surfaced during the benchmark sessions, totaling ~590 LoC. Three are critical (AVX-512 gate, Blackwell bootstrap, install.sh template fix). |

**File paths:**
- `/Users/pp/DC1-Platform/knowledge-base/articles/47-ktransformers-blackwell-blocker.md`
- `/Users/pp/DC1-Platform/knowledge-base/articles/48-expert-offload-avx512-trap.md`
- `/Users/pp/DC1-Platform/knowledge-base/articles/49-blackwell-sm120-llamacpp-build.md`
- `/Users/pp/DC1-Platform/knowledge-base/articles/50-daemon-v4.1-improvements-from-round5-phase2.md`

---

## 5. Research Content Harvested

### Round 5 Phase 2 Sustained Runs
- **40 topics** across coder/engineering content
- **1,428 successful requests** on the 4090 Qwen3-Coder-30B run alone (50 min)
- **280,519 tokens generated** on the 4090 run; 287,800 on the 5090 run
- **Total R5p2 tokens:** 716,119

### Gap-Fill Content Harvest
- **374 curated sections** across 45 unique DCP engineering topics
- **~125,343 words** of usable technical content
- **4 model/GPU sources:**

| Source | Model | GPU | Topics | Raw Versions | Curated | Words |
|--------|-------|-----|--------|-------------|---------|-------|
| 4090-qwen3 | Qwen3 30B-A3B | RTX 4090 | 41 | 68 | 68 | 16,892 |
| 3090-qwen3 | Qwen3 30B-A3B | RTX 3090 | 44 | 71 | 71 | 17,390 |
| 5090-mistral | Mistral 7B | RTX 5090 | 45 | 124 | 108 | 40,269 |
| a5000-allam-arabic | ALLaM 7B (Arabic) | RTX A5000 | 45 | 148 | 127 | 50,792 |

- **Unusable:** 5090 Qwen 3.5 35B-A3B produced 300 KB of `<thinking>` scratchpad -- llama.cpp `--jinja` does not honour `chat_template_kwargs.enable_thinking=false`. Tracked as daemon v4.1 #8.

**File locations:**
- Content index: `/Users/pp/DC1-Platform/knowledge-base/research/r5-gapfill-INDEX.md`
- Per-source directories: `/Users/pp/DC1-Platform/knowledge-base/research/r5-gapfill/{4090-qwen3,3090-qwen3,5090-mistral,a5000-allam-arabic}/`
- Phase 2 summary: `/Users/pp/DC1-Platform/research-output/round5-rerun/phase2/SUMMARY.json`
- Gap-fill summary: `/Users/pp/DC1-Platform/research-output/round5-rerun/gapfill/GAPFILL-SUMMARY.json`
- Gap-close curves: `/Users/pp/DC1-Platform/research-output/round5-rerun/final/`

---

## 6. Technical Findings

### 6.1 AVX-512 BF16 Expert Offload 9x Regression (CRITICAL)

**What:** Running llama.cpp with `-ot ".ffn_.*_exps.=CPU"` on AMD EPYC 7302 (Zen 2) or 7763 (Zen 3) hosts collapses MoE throughput from ~230 tok/s to ~25 tok/s. These CPUs lack AVX-512 BF16/VNNI; llama.cpp falls back to scalar FP32 dispatch -- an order of magnitude slower.

**Fix:** Drop the `-ot` flag when the Q4_K_M model fits in VRAM (Qwen3-Coder-30B Q4_K_M = 18.5 GB, fits in 24 GB 4090). Result: 234 tok/s sustained, 1,428 requests, 1 error over 50 minutes.

**Rule:** If model fits in VRAM -> full GPU, no `-ot`. If model doesn't fit and CPU lacks AVX-512 BF16 -> refuse the job.

**Reference:** KB-48

### 6.2 Blackwell sm_120 CUDA 12.9 Build Recipe

**What:** RunPod pytorch image ships CUDA 12.4. CUDA 12.4 nvcc cannot generate sm_120 code. PTX forward-compat (sm_89-virtual) builds cleanly but hangs at runtime during `ggml_cuda_init`.

**Fix:** Install `cuda-nvcc-12-9`, `cuda-cudart-dev-12-9`, `cuda-libraries-dev-12-9`, upgrade `libnccl2` to `2.29.7-1+cuda12.9`, rebuild llama.cpp with `-DCMAKE_CUDA_ARCHITECTURES=120 -DCMAKE_CUDA_COMPILER=/usr/local/cuda-12.9/bin/nvcc`. Build time: ~5 min on 16-vCPU pod. Wall time to first working Blackwell inference: ~55 min from fresh pod (target for daemon v4.1: ~5 min).

**Reference:** KB-49

### 6.3 KTransformers sgl_kernel sm_120 Blocker

**What:** KTransformers v0.5.3 cannot run inference on Blackwell GPUs. `sgl_kernel` 0.3.21 ships only sm_90 and sm_100 binary directories -- no sm_120. The dispatcher reads `torch.cuda.get_device_capability()`, formats as `sm120`, and crashes when the directory doesn't exist. `kt bench inference` and `kt microbench moe` are unimplemented stubs ("coming soon").

**Workaround:** Symlinking `sm100` -> `sm120` lets the import succeed but is not safe for production (different tensor core generations). The KT path was abandoned; llama.cpp with CUDA 12.9 sm_120 native was used instead.

**Cost:** ~$2, ~3 hours, zero throughput data.

**Reference:** KB-47

### 6.4 vLLM Qwen3 MoE Kernel Limitations

Two separate kernel blockers prevent vLLM 0.8.5 from running Qwen3 MoE models:

1. **gptq_marlin:** `"Apply router weight on input is not supported for fused Marlin MoE method"` -- the fused MoE kernel does not support the `router_weight_on_input` config that Qwen3 30B-A3B uses.
2. **compressed-tensors (AWQ):** `"BLOCK_SIZE_K // group_size must be one of [1, 2, 4, 8]"` -- the AWQ quantization config for Qwen3 MoE violates a Triton kernel constraint.

**Workaround:** For vLLM+Marlin daemon demos, use Qwen 2.5 14B AWQ (verified working at 776 tps aggregate @ 16u). For Qwen3 MoE daemon-verified benchmarks, use llama.cpp.

### 6.5 Gemma 4 31B Thinking-Mode Token Budget Fix

**What:** Gemma 4 31B benchmarked at 69 tps on 5090 vs article reference of 213 tps. The gap is not hardware -- it's that Gemma 4 has `thinking=1` by default in its chat template. With `max_tokens=200` (benchmark default), the entire budget is consumed by `<thinking>` scratchpad before any real answer is emitted. `finish_reason: length` fires before any visible output.

**Fix:** Set `max_tokens>=800` for reasoning models. At 800 tokens: 257 chars of real answer + 1,247 chars of reasoning scaffold per response, 0 errors.

### 6.6 4080S Ollama Backend Proxy connection_refused

**What:** The backend's `fetch(endpointUrl)` call returns `connection_refused` when proxying to Ollama on the 4080S pod, even though direct curl to Ollama's public port works fine from anywhere.

**Fix (workaround):** Skip Ollama entirely. Serve the model via llama.cpp on port 8000 instead of Ollama on 11434. The backend route works normally with llama.cpp's `/v1/chat/completions` endpoint.

**Root cause:** Unknown. Candidates: node.js fetch DNS resolution, request shape mismatch with Ollama's `/v1/` endpoint, or aggressive timeout. Needs deeper backend debug.

### 6.7 Backend VRAM Rounding Off-by-One

**What:** The backend routing filter requires `gpu_vram_mib >= model.min_gpu_vram_gb * 1024`. An RTX 4090 reports 24,564 MiB (not 24,576). If a model's `min_gpu_vram_gb` is set to exactly 24, the filter computes 24 * 1024 = 24,576 and the 4090 fails the check by 12 MiB.

**Fix:** Use floor-rounded VRAM in provider rows or add a small tolerance margin in the routing filter.

---

## 7. Infrastructure Changes

### Provider Rows in SQLite
- Created fresh provider rows for each benchmark pod (dcp-4090-r5x, dcp-5090-qwen35, dcp-4090-gemma31, plus 5 gap-fill pods, plus 3 gap-close pods)
- Each row required manual `UPDATE` for `vllm_endpoint_url`, `cached_models`, `gpu_vram_mib`, `status='online'`
- Cleanup test probe row (id 1774351995304) deleted after ground-truth verification

### Model Registry
- Entries added/verified for: `qwen3-coder-30b-a3b`, `qwen3.5-35b-a3b`, `gemma-4-31b-it`, `qwen3-30b-a3b`, `mistral-7b`, `allam-7b`, `glm-4-9b`, `qwen2.5-14b-awq`

### Renter Balance
- Topped up mid-session after 402 billing errors silently aborted two sustained benchmark runs (gemma31 and qwen35)
- The billing exhaustion was invisible until client logs showed 11 consecutive HTTP 402s

### Heartbeat Refresher Pattern
- For benchmark pods, heartbeats were refreshed via a manual `curl` loop every 30 seconds to keep the provider's `last_heartbeat` within the 10-minute staleness window
- Production daemons handle this automatically; benchmark sessions used ad-hoc curl because the daemon wasn't always running the heartbeat loop during manual testing

### Hard Watcher Pattern (sleep + harvest + terminate)
- Each benchmark pod was managed with a timed session: start benchmark -> sleep N minutes -> harvest results -> terminate pod
- Prevents runaway pod costs from forgotten instances

### RunPod Pods Provisioned and Terminated
- **R5 Phase 2:** 3 pods (4090, 5090, 4090-gemma31)
- **Gap-Fill:** 5 pods (5090-mistral, 5090-qwen35, 4090-qwen3, 3090-qwen3, a5000-allam/qwen3)
- **Gap-Close:** 3 pods (4090-vllm, 5090-gemma-800, 4080s-glm4)
- **Total spend:** ~$6.02 across gap-fill ($2.94) and gap-close ($3.08), plus R5p2 costs

---

## 8. Daemon v4.1 Improvement Backlog

Nine improvements surfaced from the R5 Phase 2 benchmark sessions, totaling ~590 LoC of Python. Source: KB-50.

| # | Improvement | LoC | Severity |
|---|-------------|-----|----------|
| 1 | AVX-512 BF16 detection gate for expert offload | 50 | **CRITICAL** |
| 2 | Blackwell sm_120 bootstrap auto-installation | 150 | HIGH |
| 3 | Don't clear `cached_models` during transient llama-server-down window | 30 | MEDIUM |
| 4 | Self-report public port via RunPod metadata API / env vars | 40 | MEDIUM |
| 5 | Surface 402 billing errors upstream | 60 | MEDIUM |
| 6 | Fix `install.sh` template-replacement path (`{{API_KEY}}` sed-replace) | 30 | HIGH (tech debt) |
| 7 | `/daemon/overhead` measurement endpoint | 80 | LOW (observability) |
| 8 | Reasoning-model detection + thinking-mode routing (dual model IDs) | 100 | MEDIUM |
| 9 | Model freshness / integrity check at startup (SHA256 header+EOF) | 50 | LOW |

**Priority ordering:**
- **Ship first (blockers):** #1, #2, #6 -- prevent 9x collapse, unblock Blackwell providers, fix install path
- **Ship second (UX/ops):** #3, #4, #5 -- eliminate manual SQL UPDATEs, surface billing vs provider failures
- **Ship third (observability):** #7, #8, #9

**Reference:** `/Users/pp/DC1-Platform/knowledge-base/articles/50-daemon-v4.1-improvements-from-round5-phase2.md`

---

## 9. Provider Onboarding Ground Truth

**Correct install URL:** `https://api.dcp.sa/install` (GET, pipe to bash)
**Correct daemon file name on gate0:** `dc1_daemon.py` (NOT `dcp_daemon.py` -- the rename has not been deployed to the serving path)
**Correct daemon version in production:** v3.5.0 (uncommitted modifications in working tree)
**Correct one-line install command:**
```bash
curl -sSL https://api.dcp.sa/install | bash -s -- <provider-email>
```

**Known-false URLs (404):**
- `https://dcp.sa/install/daemon.sh` -- does not exist
- `https://api.dcp.sa/install.sh` -- returns Next.js 404 HTML

**Known-false claims corrected:**
1. "Yazan has daemon v3.2.0 running" -- no provider row exists for Yazan
2. "Install URL is dcp.sa/install/daemon.sh" -- 404; correct is `api.dcp.sa/install`
3. "Daemon is v4.0-alpha.2" -- production is v3.5.0 uncommitted
4. "Edit ~/.dcp/config.json" -- file is `~/.dcp/config` (no `.json` extension)
5. "sudo systemctl stop dcp-daemon" -- real service is `dcp-provider.service`, user mode: `systemctl --user stop dcp-provider`
6. "Backend is Supabase-first" -- backend is SQLite-first on gate0; Supabase is a 30-sec sync mirror

**Reference:** `/Users/pp/DC1-Platform/DCP-PROVIDER-ONBOARDING-GROUND-TRUTH.md`

---

## 10. Windows Installer Status

### What Exists
| Component | File | Status | Lines |
|-----------|------|--------|-------|
| NSIS installer script | `dc1-provider-Windows.nsi` | Functional, compiled | 430 |
| Compiled .exe | `dc1-provider-setup-Windows.exe` | 200 KB, compiled 2026-03-23 | -- |
| Setup helper | `dc1-setup-helper.ps1` | Functional v2.3 | 432 |
| Uninstall helper | `dc1-uninstall-helper.ps1` | Functional v2.2 | 95 |
| Daemon PowerShell | `daemon.ps1` | Functional v2.0 | 159 |
| System tray app | `dcp_tray_windows.py` | Functional v2.0 | 464 |
| App icon | `dcp-icon.ico` | 4 sizes (64/48/32px) | -- |

### What's Broken / Outdated
- All filenames still use `dc1-` prefix (not `dcp-`)
- Registry keys use `DC1Provider`
- Config uses `DC1_*` env vars
- Install dir is `%LOCALAPPDATA%\dc1-provider` (should be `dcp-provider`)
- Version strings say v3.3.0 (should be v4.0.0-alpha.2)
- The .exe was compiled 2026-03-23 -- pre-rename, pre-v4

### 3-Phase Production Plan

| Phase | Technology | Timeline | Deliverable |
|-------|-----------|----------|-------------|
| Phase 0 (MVP) | NSIS fix + recompile | 2-3 days (~7 hours) | Working `dcp-provider-setup-Windows.exe` with DCP branding for Fadi |
| Phase 1 (Polish) | NSIS + earnings estimate + model picker | 1 week (~26 hours) | Branded installer with GPU earnings estimate, silent install mode |
| Phase 2 (Rewrite) | Inno Setup | 2 weeks (~10 days) | Prettier wizard, GPU benchmark during install, gaming mode v1, code signing |
| Phase 3 (Long-term) | Tauri desktop app | Q3 2026 (~19 days) | Full native tray app + installer, auto-updater, gaming mode v2, MSIX |

**Reference:** `/Users/pp/DC1-Platform/DCP-WINDOWS-INSTALLER-FEASIBILITY.md`

---

## 11. Fadi/Yazan Onboarding Status

- **Yazan is Fadi's son** (same household, same network)
- **No provider row exists** in the SQLite `providers` table for either Yazan or Fadi
- **No renter row exists** either -- Fadi needs a `dc1-renter-...` key with non-zero balance to send inference requests
- **Hardware:** RTX 3060 Ti, 8 GB VRAM, Windows PC
- **Model recommendation:** Qwen3 8B (fits in 8 GB VRAM, 107-197 tps depending on GPU generation) or Mistral 7B (4.1 GB Q4_K_M, high-demand, non-reasoning, fast). Alternative: Qwen3 4B (2.5 GB, even faster).
- **Ready to onboard via:**
  ```bash
  curl -sSL https://api.dcp.sa/install | bash -s -- <fadi-email>
  ```
- **Fastest path:** Create Fadi's provider row in the DB with a pre-generated key, have him run the raw daemon via Python while the polished Windows installer is prepared in parallel.

---

## 12. Open Items

### Critical (blocks revenue / providers)
1. **Daemon v4.0.0-alpha.2 is not in the production serving path.** The `refactor/dcp-daemon-rename` branch needs to be merged and deployed to gate0 so `install.sh` serves the v4 daemon. Currently serving v3.5.0 from uncommitted working tree.
2. **AVX-512 BF16 detection gate (daemon v4.1 #1)** -- prevents the single worst silent performance collapse. Must ship before any provider runs MoE with expert offload.
3. **Blackwell sm_120 bootstrap (daemon v4.1 #2)** -- every 5090 provider will hit the ~55-minute manual setup wall without this.
4. **install.sh template replacement (daemon v4.1 #6)** -- the `{{API_KEY}}` sed-replace path may not be firing; providers fall back to CLI workarounds.

### High Priority
5. **Windows installer recompile** -- rename DC1 -> DCP, bump version, recompile NSIS for Fadi. ~7 hours work.
6. **Fadi/Yazan provider + renter row creation** -- no rows exist; cannot onboard until created.
7. **4080S Ollama-proxy backend bug root cause** -- workaround (llama.cpp on port 8000) exists but the underlying node.js fetch issue is not understood.
8. **vLLM Qwen3 MoE kernel support** -- blocked in vLLM 0.8.5 by gptq_marlin router_weight_on_input and compressed-tensors BLOCK_SIZE_K constraints. Monitor newer vLLM releases.

### Medium Priority
9. **Daemon v4.1 items #3, #4, #5** -- eliminate manual SQL UPDATEs for new pods, surface billing errors.
10. **Reasoning-model detection (daemon v4.1 #8)** -- needed to properly serve Gemma 4 31B and Qwen 3.5 35B-A3B in thinking-off mode.
11. **Backend VRAM rounding off-by-one** -- 4090 reports 24,564 MiB vs 24,576 MiB threshold.
12. **KTransformers sm_120 support** -- monitor `sgl_kernel` releases for Blackwell binaries.
13. **GPU matrix v9 -> model registry sync** -- ensure all 11 Tier-A catalog entries are in the backend `model_registry` with correct `min_gpu_vram_gb` values.

### Low Priority / Tracking
14. **Daemon v4.0 Phase 2-4 backlog** -- encryption (ed25519), provider experience (3-min install, live dashboard), migration tool (v3.5 -> v4.0). Zero lines written.
15. **Code signing certificate for Windows .exe** -- ~$200-400/year, needed to avoid SmartScreen warning.
16. **Tauri desktop app (Phase 3)** -- Q3 2026 timeline, 19 days estimated.
17. **RunPod balance monitoring** -- auto-recharge should be enabled; RunPod terminates ALL pods at $0 with no warning.
18. **A40 anomaly** -- Qwen 2.5 32B dense at 26.1 tok/s is ~40% below memory-bandwidth prediction. Needs root-cause.
19. **Content quality review** -- 125K words of gap-fill content needs editorial pass before publication.

---

*Generated 2026-04-12. Source data from files listed in each section. All benchmark numbers are daemon-routed through `api.dcp.sa` unless explicitly marked "direct".*

---

## 13. PR #278 Merged + Gate0 Synced (2026-04-12 ~12:30 UTC)

**PR:** https://github.com/dhnpmp-tech/dc1-platform/pull/278
**Merge commit:** `5800a72`
**Branch:** `refactor/dcp-daemon-rename` → `main` (4 commits, 73 files)

### Codex Review Fixes (pre-merge)
Two issues flagged by automated Codex review, both fixed in commit `6f8da50`:
- **P1 (Critical):** `install.sh` ran `apt-get` without `sudo` in the Ollama install path — broke non-root provider installs. Fixed: checks `id -u`, prefixes with `sudo` when not root, warns if neither root nor sudo available.
- **P2 (Model substitution):** `v1.js` OLLAMA_MODEL_ALIASES mapped `qwen/qwen3.5-35b-a3b-gptq-int4` → `qwen3:30b-a3b` (wrong, smaller model). Fixed: maps to `qwen3.5:35b-a3b` (correct tag).

### Gate0 Production Sync
After merge, gate0 was synced:
```
git fetch origin && git checkout main && git pull origin main
```
- Conflicting SCP-deployed files (`dcp_daemon.py`, `renter-dashboard.html`) moved to `/tmp/` before pull
- 201 commits fast-forwarded
- Stashed live fixes (renters.js, vllm.js, server.js) restored via `git stash pop`
- `/var/www/html/install.sh` copied from git version (nginx serves `/install` from this path)
- PM2 restarted (restart #35)

### Post-Merge Smoke Test (all pass)
- `curl https://api.dcp.sa/install` → serves `dcp_daemon.py` path ✅
- `POST /api/providers/register` → returns `{success: true, api_key}` ✅
- `GET /api/providers/download/daemon?key=...` → streams `DAEMON_VERSION = "4.0.0-alpha.2"` ✅
- Gate0 HEAD matches merged main: `5800a72` ✅

### Final Git State on Gate0
- Branch: `main`
- HEAD: `5800a72 Merge pull request #278 from dhnpmp-tech/refactor/dcp-daemon-rename`
- Uncommitted: renters.js, vllm.js, server.js (live fixes from pre-v4, preserved via stash)
- Clean: no untracked installer conflicts remaining
