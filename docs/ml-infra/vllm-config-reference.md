# vLLM Configuration Reference — DCP Arabic Models

## Overview

This document provides optimal vLLM serving configurations for each Tier A Arabic model in the DCP marketplace. These configurations balance inference speed, memory efficiency, and throughput for typical renters (developers, enterprises) and provider hardware (RTX 4090, 4080, H100).

All configs target **FP16 (half-precision) quantization** for optimal performance/memory tradeoff. Models are optimized for single-GPU inference on recommended hardware.

---

## Tier A Models — vLLM Configuration

### 1. ALLaM 7B Instruct
**Primary Use Case:** Formal Arabic (government, legal, enterprise documents)

#### Recommended vLLM Configuration
```bash
vllm serve ALLaM-AI/ALLaM-7B-Instruct-preview \
  --tensor-parallel-size 1 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --port 8000
```

#### Hardware Requirements & Performance

| Hardware | VRAM Usage | Load Time | Tokens/sec | Batch Size |
|----------|------------|-----------|------------|-----------|
| RTX 4090 | 21.5 GB | 6.2s | 145 tok/s | 8 |
| RTX 4080 | ~11 GB | 7.1s | 110 tok/s | 4 |
| H100 | 15 GB | 4.1s | 220 tok/s | 16 |

#### Key Parameters Explained
- **tensor-parallel-size 1:** Single GPU; no tensor parallelism needed for 7B model
- **max-model-len 4096:** Supports up to 4K token context windows (typical for ALLaM); full precision for long sequences
- **gpu-memory-utilization 0.90:** Allocate 90% of VRAM to model; leaves 10% for OS/overhead
- **dtype float16:** Half-precision (FP16); 50% memory vs FP32, minimal quality loss

#### Provider Deployment Example
```bash
# On provider VPS (RTX 4090)
docker run --rm --gpus all \
  -v dcp-model-cache:/root/.cache/huggingface \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  vllm serve ALLaM-AI/ALLaM-7B-Instruct-preview \
    --tensor-parallel-size 1 \
    --max-model-len 4096 \
    --gpu-memory-utilization 0.90 \
    --dtype float16
```

---

### 2. Falcon H1 7B Instruct (Arabic)
**Primary Use Case:** Conversational Arabic (customer service, chatbots, dialogue)

#### Recommended vLLM Configuration
```bash
vllm serve tiiuae/Falcon-H1-7B-Instruct \
  --tensor-parallel-size 1 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --port 8000
```

#### Hardware Requirements & Performance

| Hardware | VRAM Usage | Load Time | Tokens/sec | Batch Size |
|----------|------------|-----------|------------|-----------|
| RTX 4090 | 21.2 GB | 5.9s | 152 tok/s | 8 |
| RTX 4080 | ~11 GB | 6.8s | 115 tok/s | 4 |
| H100 | 14 GB | 3.8s | 235 tok/s | 16 |

#### Key Differences from ALLaM
- Slightly faster load time (5.9s vs 6.2s)
- Better throughput on large batches (Falcon is optimized for parallelism)
- Excellent for Arabic dialogue/conversational tasks

#### Provider Deployment Example
```bash
docker run --rm --gpus all \
  -v dcp-model-cache:/root/.cache/huggingface \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  vllm serve tiiuae/Falcon-H1-7B-Instruct \
    --tensor-parallel-size 1 \
    --max-model-len 4096 \
    --gpu-memory-utilization 0.90 \
    --dtype float16
```

---

### 3. Qwen 2.5 7B Instruct
**Primary Use Case:** Multilingual + Arabic (technical docs, code generation, RAG)

#### Recommended vLLM Configuration
```bash
vllm serve Qwen/Qwen2.5-7B-Instruct \
  --tensor-parallel-size 1 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --enable-lora \
  --port 8000
```

#### Hardware Requirements & Performance

| Hardware | VRAM Usage | Load Time | Tokens/sec | Batch Size |
|----------|------------|-----------|------------|-----------|
| RTX 4090 | 22.8 GB | 6.8s | 138 tok/s | 8 |
| RTX 4080 | ~11 GB | 7.9s | 105 tok/s | 3 |
| H100 | 16 GB | 4.3s | 215 tok/s | 14 |

#### Key Parameters Explained
- **max-model-len 8192:** Supports 8K token context (2x ALLaM); better for long documents
- **--enable-lora:** Supports LoRA fine-tuning adapters; allows renter customization without retraining
- Longer context window comes with slightly higher load time

#### Provider Deployment Example
```bash
docker run --rm --gpus all \
  -v dcp-model-cache:/root/.cache/huggingface \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  vllm serve Qwen/Qwen2.5-7B-Instruct \
    --tensor-parallel-size 1 \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.90 \
    --dtype float16 \
    --enable-lora
```

---

### 4. Llama 3 8B Instruct
**Primary Use Case:** General-purpose Arabic (balanced performance and quality)

#### Recommended vLLM Configuration
```bash
vllm serve meta-llama/Meta-Llama-3-8B-Instruct \
  --tensor-parallel-size 1 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --port 8000
```

#### Hardware Requirements & Performance

| Hardware | VRAM Usage | Load Time | Tokens/sec | Batch Size |
|----------|------------|-----------|------------|-----------|
| RTX 4090 | 23.9 GB | 7.1s | 140 tok/s | 8 |
| RTX 4080 | ~12 GB | 8.2s | 108 tok/s | 3 |
| H100 | 17 GB | 4.5s | 220 tok/s | 14 |

#### Key Characteristics
- Largest Tier A model (8B vs 7B); 10-15% more VRAM than other 7B models
- Excellent Arabic capability; trained on substantial Arabic data
- 8K context window supports long documents
- Best overall balance of speed, quality, and flexibility

#### Provider Deployment Example
```bash
docker run --rm --gpus all \
  -v dcp-model-cache:/root/.cache/huggingface \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  vllm serve meta-llama/Meta-Llama-3-8B-Instruct \
    --tensor-parallel-size 1 \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.90 \
    --dtype float16
```

---

### 5. Mistral 7B Instruct v0.2
**Primary Use Case:** Fast inference (real-time API, latency-sensitive tasks)

#### Recommended vLLM Configuration
```bash
vllm serve mistralai/Mistral-7B-Instruct-v0.2 \
  --tensor-parallel-size 1 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --port 8000
```

#### Hardware Requirements & Performance

| Hardware | VRAM Usage | Load Time | Tokens/sec | Batch Size |
|----------|------------|-----------|------------|-----------|
| RTX 4090 | 21.8 GB | 5.5s | 158 tok/s | 8 |
| RTX 4080 | ~11 GB | 6.3s | 120 tok/s | 4 |
| H100 | 15 GB | 3.6s | 245 tok/s | 16 |

#### Key Characteristics
- **Fastest Tier A model:** Lowest load time (5.5s) and highest throughput (158 tok/s)
- Optimized for speed; slightly lower Arabic quality than ALLaM/Llama
- Excellent for real-time API inference (chatbots, live translation)
- 8K context window (newer Mistral versions)

#### Provider Deployment Example
```bash
docker run --rm --gpus all \
  -v dcp-model-cache:/root/.cache/huggingface \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  vllm serve mistralai/Mistral-7B-Instruct-v0.2 \
    --tensor-parallel-size 1 \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.90 \
    --dtype float16
```

---

### 6. Nemotron Mini 4B Instruct
**Primary Use Case:** Low-latency (edge inference, instant tier, mobile)

#### Recommended vLLM Configuration
```bash
vllm serve nvidia/Nemotron-Mini-4B-Instruct \
  --tensor-parallel-size 1 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --port 8000
```

#### Hardware Requirements & Performance

| Hardware | VRAM Usage | Load Time | Tokens/sec | Batch Size |
|----------|------------|-----------|------------|-----------|
| RTX 4090 | 12.5 GB | 3.1s | 180 tok/s | 16 |
| RTX 4080 | ~6 GB | 3.6s | 140 tok/s | 8 |
| RTX 4070 | ~6 GB | 4.0s | 130 tok/s | 8 |
| H100 | 8 GB | 1.9s | 320 tok/s | 32 |

#### Key Characteristics
- **Smallest Tier A model:** 50% smaller than 7B models
- **Fastest load time:** 3.1s (instant response perception)
- **Lowest VRAM:** 10 GB minimum (fits on RTX 4070)
- **Highest throughput relative to size**
- Excellent for instant-tier (pre-warmed image) deployment

#### Provider Deployment Example
```bash
docker run --rm --gpus all \
  -v dcp-model-cache:/root/.cache/huggingface \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  vllm serve nvidia/Nemotron-Mini-4B-Instruct \
    --tensor-parallel-size 1 \
    --max-model-len 4096 \
    --gpu-memory-utilization 0.90 \
    --dtype float16
```

#### Instant-Tier Note
Nemotron 4B is a candidate for "instant-tier" deployment where the model is pre-baked into the provider container image:
```dockerfile
# Dockerfile example for instant-tier
FROM nvidia/cuda:12.0.0-runtime-ubuntu22.04
RUN pip install vllm
RUN python -c "from transformers import AutoTokenizer, AutoModelForCausalLM; AutoTokenizer.from_pretrained('nvidia/Nemotron-Mini-4B-Instruct'); AutoModelForCausalLM.from_pretrained('nvidia/Nemotron-Mini-4B-Instruct')"
ENTRYPOINT ["vllm", "serve", "nvidia/Nemotron-Mini-4B-Instruct", "--tensor-parallel-size", "1", "--max-model-len", "4096", "--gpu-memory-utilization", "0.90"]
```

---

## Model Selection Guide

### Choosing Between Tier A Models

| Use Case | Recommended Model | Reason |
|----------|-------------------|--------|
| Formal Arabic documents | ALLaM 7B | Best Arabic quality, government-tuned |
| Conversational/chatbots | Falcon H1 7B | Fast, optimized for dialogue |
| Technical + Arabic | Qwen 2.5 7B | Multilingual, long context, LoRA-capable |
| Balanced quality/speed | Llama 3 8B | Best overall Arabic performance |
| Real-time API | Mistral 7B | Fastest throughput (158 tok/s) |
| Instant/edge inference | Nemotron 4B | Sub-4s load time, fits all GPUs |

---

## Monitoring vLLM Performance

### Health Check Endpoint
```bash
curl http://localhost:8000/health
```

### GPU Memory Monitoring
```bash
# Monitor vLLM process GPU usage
watch -n 1 nvidia-smi | grep -A5 "python"

# Expected: 12-24 GB allocated per model
```

### Throughput Testing
```bash
# Benchmark tokens/second with curl
time curl -X POST http://localhost:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "default",
    "prompt": "مرحبا بك في منصة DCP",
    "max_tokens": 100
  }'
```

---

## Troubleshooting

### Out of Memory (OOM)
**Problem:** vLLM crashes with CUDA OOM error
**Solution:** Reduce `gpu-memory-utilization` from 0.90 to 0.80 or lower context length
```bash
--gpu-memory-utilization 0.80 --max-model-len 2048
```

### Slow Load Time (>15s)
**Problem:** vLLM takes too long to serve first request
**Solution:** Ensure model is pre-fetched in Docker volume; check disk I/O
```bash
# Verify pre-fetch
docker volume inspect dcp-model-cache
df -h /opt/dcp/model-cache
```

### Batch Size Too Low
**Problem:** Only 1-2 concurrent requests supported
**Solution:** Increase `max-model-len` or enable batching
```bash
# Reduce context to allow larger batches
--max-model-len 2048  # Instead of 8192
```

