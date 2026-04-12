# DCP GPU Testing Protocol v2 (2026-04-12)

**Purpose:** Standard procedure for benchmarking GPU+model combinations through the `api.dcp.sa` daemon routing path. Every catalog entry must pass this protocol before going live on the website.

---

## Criteria for "Tier A — One-Click Deploy"

A GPU+model combination qualifies for the catalog when ALL of these are met:

| # | Criterion | Threshold |
|---|-----------|-----------|
| 1 | Single-user throughput | ≥ 50 tok/s |
| 2 | Concurrency curve measured | 1, 2, 4, 8, 12 users minimum |
| 3 | Routed through `api.dcp.sa` daemon | Not direct llama-server / not direct vLLM |
| 4 | Zero or near-zero errors at steady state | < 1% error rate at 4+ concurrent users |
| 5 | Cost basis known | RunPod $/hr documented |
| 6 | GPU is available on consumer market | Not discontinued, not enterprise-only |

---

## Test Procedure

### Step 1: Provision Pod
```bash
# RunPod GraphQL
provision_pod "<name>" "<cloud>" "<gpu_type>" "<ports>" <disk> <vol>
# Always include: 22/tcp,8000/tcp,11434/tcp
# Always set: PUBLIC_KEY env var for SSH
```

### Step 2: Bootstrap Engine
- **Non-Blackwell (sm < 120):** llama.cpp with CUDA 12.4 native
  ```bash
  cmake -B build -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=<CC> -DLLAMA_CURL=OFF
  cmake --build build -j16 --target llama-server
  ```
- **Blackwell (sm_120):** MUST install CUDA 12.9 + upgrade NCCL first
  ```bash
  apt-get install -y cuda-nvcc-12-9 cuda-cudart-dev-12-9 cuda-libraries-dev-12-9
  apt-get install -y --allow-change-held-packages libnccl2=2.29.7-1+cuda12.9 libnccl-dev=2.29.7-1+cuda12.9
  cmake -B build -DGGML_CUDA=ON -DCMAKE_CUDA_COMPILER=/usr/local/cuda-12.9/bin/nvcc -DCMAKE_CUDA_ARCHITECTURES=120
  ```
- **vLLM path:** Use vLLM 0.8.5+ with `VLLM_USE_V1=0` for Qwen MoE models. Dense models work on V1 engine. Known kernel blockers: gptq_marlin + Qwen3 MoE router_weight_on_input, compressed-tensors + some AWQ group sizes.

### Step 3: Download Model
```bash
export HF_HUB_ENABLE_HF_TRANSFER=1
hf download <repo> --local-dir /workspace/models/<name> --include "*Q4_K_M*"
```

### Step 4: Launch Server
```bash
./build/bin/llama-server \
  --model /workspace/models/<name>/<file>.gguf \
  --host 0.0.0.0 --port 8000 \
  --ctx-size 8192 -ngl 999 \
  --jinja -t 16 -b 2048 -ub 2048 \
  --flash-attn auto --no-warmup --parallel 4 \
  --alias <model-alias>
```

**CRITICAL — Expert offload decision:**
- If Q4_K_M model fits in VRAM (model_size + 2 GB per parallel slot + 1 GB reserve ≤ gpu_vram): **full GPU, NO `-ot` flag**
- If model exceeds VRAM AND host CPU has AVX-512 BF16: enable `-ot ".ffn_.*_exps.=CPU"`
- If model exceeds VRAM AND host CPU lacks AVX-512 BF16: **DO NOT TEST** — throughput will collapse to < 5 tok/s

**For reasoning models (Qwen 3.5 35B-A3B, Gemma 4 31B IT, etc.):**
- Use `max_tokens ≥ 800` in benchmark requests (thinking scratchpad eats ~500-1000 tokens before real content appears)
- `chat_template_kwargs.enable_thinking=false` does NOT work through llama.cpp `--jinja`

### Step 5: Deploy Daemon + Wire Backend
1. SCP `dcp_daemon.py` to the pod
2. Start with `python3 dcp_daemon.py --no-watchdog --key <provider-api-key> --url https://api.dcp.sa`
3. INSERT/UPDATE provider row in backend SQLite with `cached_models`, `vllm_endpoint_url`, `status='online'`
4. INSERT model into `model_registry` if not present (set `min_gpu_vram_gb` to 20 for 24GB GPUs — avoids the 24576 vs 24564 MB off-by-one)
5. Verify E2E: `curl -X POST https://api.dcp.sa/v1/chat/completions -H "Authorization: Bearer <renter-key>" -d '{"model":"<alias>","messages":[...]}'`

### Step 6: Sustained Benchmark (20-60 min)
```bash
python3 r5x-bench-api.py --model <alias> --gpu-tag <tag> --duration <min> --max-tokens 200
```
Records per-request tok/s, total tokens, error count. Content saved to `*-content.md`.

### Step 7: Concurrency Saturation Curve
```bash
python3 concurrency-test.py --model <alias> --levels 1,2,4,8,12 --duration 40 --max-tokens 300
```
Reports per-user tps, aggregate tps, saturation point.

**Known issue:** Backend heartbeat staleness gate causes 503 errors at low concurrency if not using a real daemon or a fast heartbeat refresher. Errors at 1-2 users with 0 errors at 4+ users = heartbeat race, not real failure.

### Step 8: Harvest + Terminate
- Save all logs, content, summary JSONs locally
- Terminate pods via RunPod GraphQL
- **Always arm a hard watcher** before long runs: `nohup bash -c "sleep <seconds> && harvest_and_terminate.sh" &`

---

## Current Tier-A Catalog (as of 2026-04-12, all daemon-certified)

| # | GPU | Model | Engine | Single tps | Peak aggr | Sat @ |
|---|---|---|---|---|---|---|
| 1 | RTX 4090 | Qwen 2.5 14B AWQ | vLLM+Marlin | 57 | **777** | 16+ |
| 2 | RTX 4090 | Qwen3-Coder-30B (MoE) | llama.cpp | 234 | 421 | 8 |
| 3 | RTX 4090 | Qwen3 30B-A3B (MoE) | llama.cpp | 163 | 243 | 12 |
| 4 | RTX 5090 | Mistral 7B | llama.cpp | 266 | **692** | 12 |
| 5 | RTX 5090 | Qwen 3.5 35B-A3B (MoE) | llama.cpp | 219 | 470 | 12 |
| 6 | RTX 5090 | Gemma 4 31B IT (dense) | llama.cpp | 69 | 155 | 8 |
| 7 | RTX 3090 | Qwen3 30B-A3B (MoE) | llama.cpp | 164 | 194 | 12 |
| 8 | RTX A5000 | Qwen3 30B-A3B (MoE) | llama.cpp | 200 | 383 | 12 |
| 9 | RTX A5000 | ALLaM 7B (Arabic) | llama.cpp | 125 | 246 | 12 |
| 10 | RTX 4080S | GLM-4 9B | llama.cpp | 99 | 121 | 12 |
| 11 | RTX 5090 | Gemma 4 31B IT (max_tokens=800) | llama.cpp | 68 | 121 | 8 |

## Not Viable (tested, below floor)

| GPU | Model | Single tps | Reason |
|---|---|---|---|
| RTX 4090 | Gemma 4 31B Dense | 44 | Dense 31B bandwidth-limited on 24 GB |
| RTX A40 | Qwen 2.5 32B Dense | 26 | Too slow |
| RTX A6000 | Llama 3.3 70B | 15 | Too slow |
| Any Zen 2/3 EPYC | MoE expert offload | 1-5 | No AVX-512 BF16, 9x collapse |
| RTX 5090 | GLM-5.1 | crash | Core dumped during load |
| RTX 5090 | KTransformers | N/A | sgl_kernel missing sm_120 binaries |

## Known Blockers for Future Tests

1. **vLLM + Qwen3 MoE:** gptq_marlin kernel doesn't support router_weight_on_input. Use llama.cpp or vLLM with dense models only.
2. **Blackwell + CUDA 12.4:** PTX forward-compat (sm_89 virtual) hangs at runtime. MUST use CUDA 12.9 nvcc.
3. **Reasoning models:** llama.cpp `--jinja` ignores `enable_thinking=false`. Budget 800+ max_tokens for thinking models.
4. **4080S Ollama proxy:** Backend `fetch()` returns connection_refused for Ollama on port 11434. Workaround: serve via llama.cpp on port 8000 instead.
5. **Model registry VRAM off-by-one:** Set `min_gpu_vram_gb=20` for 24 GB GPUs (4090 reports 24564 MB, not 24576).

---

## Budget Tracking

| Session | Date | Pods | Duration | Spend |
|---------|------|------|----------|-------|
| R5 Phase 2 | 2026-04-11 AM | 3 | ~5h | ~$7 |
| Gap-Fill | 2026-04-11 PM | 5 | 1h 26m | $2.94 |
| Gap-Close | 2026-04-11 PM | 3 | 1h 15m | $2.00 |
| **Total** | | | | **~$12** |
| **Balance remaining** | | | | **$31.68** |
