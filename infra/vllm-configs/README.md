# vLLM Model Serving Configurations

Production-ready vLLM startup scripts for Tier A Arabic models on RTX 4090 GPUs, plus AWQ-first bootstrap scripts for 8GB/12GB providers.

## Overview

This directory contains optimized vLLM configurations for serving the DCP platform's Arabic model portfolio on consumer-grade GPUs (RTX 4090). Each script is tuned for:

- **Throughput:** 42-65 tokens/sec depending on model
- **Cold-start:** 5-15 seconds depending on model
- **VRAM efficiency:** 75-88% utilization
- **Fault tolerance:** Swap space configured for OOM protection

Low-VRAM providers use dedicated AWQ bootstraps and matrix-based admission:

- `awq-8gb-bootstrap.sh` for <=8GB cards
- `awq-12gb-bootstrap.sh` for <=12GB cards
- `compatibility-matrix.json` for model compatibility and fallback handling

## Models

| Model | Script | Throughput | Cold-Start | VRAM | Context |
|-------|--------|-----------|-----------|------|---------|
| ALLaM-7B | `allam-7b.sh` | 45+ tok/s | 8-12s | 20-22GB | 4096 |
| Qwen 2.5 7B | `qwen25-7b.sh` | 48+ tok/s | 7-10s | 19-21GB | 4096 |
| Llama 3 8B | `llama3-8b.sh` | 42+ tok/s | 10-15s | 20-22GB | 6144 |
| Mistral 7B | `mistral-7b.sh` | 50+ tok/s | 8-12s | 20-22GB | 8192 |
| Nemotron Nano 4B | `nemotron-nano-4b.sh` | 65+ tok/s | 5-8s | 11-13GB | 4096 |

## Usage

### Quick Start

```bash
# Start ALLaM-7B on default port (8000)
bash infra/vllm-configs/allam-7b.sh

# Start Qwen on custom port
VLLM_PORT=8001 bash infra/vllm-configs/qwen25-7b.sh

# Start 8GB AWQ bootstrap
bash infra/vllm-configs/awq-8gb-bootstrap.sh

# Start 12GB AWQ bootstrap
bash infra/vllm-configs/awq-12gb-bootstrap.sh
```

### Low-VRAM Defaults (8GB/12GB AWQ)

Both low-VRAM scripts default to:

- `--quantization awq`
- `--dtype float16`
- `--gpu-memory-utilization 0.90`
- `--max-model-len 2048`

ALLaM-7B AWQ is explicitly tracked as unavailable in `compatibility-matrix.json` and falls back to fp16 requirements when possible.

### Environment Variables

Each script respects these environment variables for runtime customization:

| Variable | Default | Example |
|----------|---------|---------|
| `VLLM_PORT` | 8000 | `8001` |
| `VLLM_MAX_MODEL_LEN` | Per model | `2048` (reduce context) |
| `VLLM_GPU_MEMORY_UTIL` | Per model | `0.90` (increase utilization) |
| `VLLM_DTYPE` | bfloat16 | `float16` (less VRAM) |
| `VLLM_TENSOR_PARALLEL_SIZE` | 1 | `2` (multi-GPU) |

### Full Example: Start Multiple Models

```bash
#!/bin/bash

# Terminal 1: ALLaM-7B
VLLM_PORT=8000 bash infra/vllm-configs/allam-7b.sh

# Terminal 2: Qwen 2.5 7B
VLLM_PORT=8001 bash infra/vllm-configs/qwen25-7b.sh

# Terminal 3: Nemotron (fast, low VRAM)
VLLM_PORT=8002 bash infra/vllm-configs/nemotron-nano-4b.sh
```

## Health Checks

Each vLLM service exposes a `/health` endpoint:

```bash
curl http://localhost:8000/health
# Returns: {"status": "ok", "model": "BOLT-IS/ALLaM-IT-7B", ...}
```

## Monitoring

vLLM logs are sent to stdout. Common patterns to look for:

- **INFO Loaded pretrained model:** Model loading started
- **INFO Finishing LoRA request:** Request completed
- **ERROR:** Errors (out of memory, invalid input, etc.)

## Performance Tuning

### For Higher Throughput

Increase `VLLM_GPU_MEMORY_UTIL`:

```bash
VLLM_GPU_MEMORY_UTIL=0.95 bash infra/vllm-configs/allam-7b.sh
```

Allows more concurrent requests at the cost of higher OOM risk.

### For Lower Latency

Reduce `VLLM_MAX_MODEL_LEN` to free VRAM for caching:

```bash
VLLM_MAX_MODEL_LEN=2048 bash infra/vllm-configs/allam-7b.sh
```

### For Lower VRAM Usage

Use float16 instead of bfloat16:

```bash
VLLM_DTYPE=float16 bash infra/vllm-configs/allam-7b.sh
```

Saves ~2GB VRAM per model, but may have accuracy/stability implications.

## Testing with Provider Simulator

For integration testing without real GPUs, use the vLLM provider simulator:

```bash
# Terminal 1: Simulator
node scripts/vllm-provider-simulator.mjs --port 8000 --model ALLaM-7B

# Terminal 2: Test proxy routing
curl -X POST http://localhost:3000/api/proxy/chat/completions \
  -H "Authorization: Bearer <renter-key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"ALLaM-7B","messages":[{"role":"user","content":"Hello"}]}'
```

## Tier A vs Other Tiers

**Tier A Models** (in this directory):
- ✅ Production-ready
- ✅ Tested on RTX 4090
- ✅ Low cold-start latency
- ✅ High throughput
- ✅ Cost-effective for providers

**Tier B Models** (JAIS, BGE embeddings, etc.):
- Pre-fetching optimized
- Batch serving (not real-time)
- See `infra/config/arabic-portfolio.json` for full portfolio

**Tier C Models** (specialized, rare):
- Custom deployment per provider
- Used for specific use cases

## Deployment to Providers

When providers activate, they pull from the model pre-fetch cache:

```bash
# Provider side (runs once during activation)
bash infra/docker/prefetch-models.sh

# Models are cached locally, then vLLM loads from cache
bash infra/vllm-configs/allam-7b.sh
# [Fast load from cache, no re-download]
```

## Troubleshooting

### Out of Memory (OOM)

```
[Error] RuntimeError: CUDA out of memory...
```

**Solutions:**
1. Reduce `VLLM_GPU_MEMORY_UTIL` from 0.85 to 0.75
2. Reduce `VLLM_MAX_MODEL_LEN` from 4096 to 2048
3. Use float16 instead of bfloat16
4. Reduce `--max-num-seqs` from 256 to 128

### Slow Model Loading

```
[INFO] Loading pretrained model (takes 10+ seconds)
```

**Solutions:**
1. Pre-fetch models: `bash infra/docker/prefetch-models.sh`
2. Use NVMe for model cache instead of HDD
3. Check GPU memory fragmentation with `nvidia-smi`

### Connection Refused

```
curl: (7) Failed to connect to localhost:8000
```

**Solutions:**
1. Check vLLM process: `ps aux | grep vllm`
2. Check port in use: `lsof -i :8000`
3. Verify host binding: script uses `0.0.0.0:$PORT`
4. Check firewall rules

## References

- vLLM Docs: https://docs.vllm.ai/
- Model Cards:
  - [ALLaM-7B](https://huggingface.co/BOLT-IS/ALLaM-IT-7B)
  - [Qwen 2.5 7B](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct)
  - [Llama 3 8B](https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct)
  - [Mistral 7B](https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.2)
  - [Nemotron Nano 4B](https://huggingface.co/nvidia/Nemotron-Mini-4B-Instruct)
- DCP Provider Activation: See `docs/provider-activation-guide.md`
- DCP Arabic Portfolio: See `infra/config/arabic-portfolio.json`
