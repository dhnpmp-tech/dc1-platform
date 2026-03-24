# vLLM Serving Configurations — Arabic Model Portfolio

This document provides production-ready vLLM startup commands and Docker Compose configurations for every model in the DCP Arabic portfolio (Tier A + Tier B).

Each configuration includes:
- **vLLM startup command** with verified VRAM allocation
- **Docker Compose service snippet** using backend/docker/ conventions
- **Health check endpoint pattern**
- **Estimated time-to-first-token** (RTX 4090 baseline)
- **Container resource limits**

**Base Image**: `dc1/llm-worker:latest` (built from `backend/docker-templates/vllm-serve.Dockerfile`)
**vLLM Version**: 0.5.5
**OpenAI API Port**: 8000

---

## TIER A — Instant-Tier Models (RTX 4090 Baseline)

Tier A models are pre-warmed on active providers for <5s cold start. All fit comfortably on single RTX 4090 (24GB VRAM).

### 1. ALLaM-7B-Instruct

**Model ID**: `ALLaM-AI/ALLaM-7B-Instruct-preview`

**Specifications**:
- Parameters: 7B
- Framework: Transformers
- Base VRAM: 16 GB minimum, 22 GB recommended
- Max sequence length: 4096 (verified, fits in 24GB)
- Tensor parallel: 1 (single GPU)

**vLLM Startup Command**:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model ALLaM-AI/ALLaM-7B-Instruct-preview \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --tensor-parallel-size 1 \
  --pipeline-parallel-size 1
```

**Docker Compose Service**:

```yaml
allam-7b:
  image: dc1/llm-worker:latest
  container_name: vllm-allam-7b
  restart: always
  ports:
    - "8000:8000"
  environment:
    HF_HOME: /opt/dcp/model-cache
    TRANSFORMERS_CACHE: /opt/dcp/model-cache
    VLLM_ALLOW_LONG_MAX_MODEL_LEN: 1
    MODEL_ID: ALLaM-AI/ALLaM-7B-Instruct-preview
    VLLM_ARGS: >
      --max-model-len 4096
      --gpu-memory-utilization 0.90
      --dtype float16
      --tensor-parallel-size 1
  volumes:
    - allam-cache:/opt/dcp/model-cache
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
      limits:
        memory: 24G
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 120s
  logging:
    driver: json-file
    options:
      max-size: "10m"
      max-file: "3"
```

**Health Check Endpoint**:

```
GET http://localhost:8000/health
Response: { "status": "ok" }
```

**Estimated Metrics (RTX 4090)**:
- Time-to-first-token: ~280-320ms
- Peak VRAM: ~21.5 GB
- Throughput: ~45 tok/s
- Startup time: ~20-30s (cold start from image)

---

### 2. Falcon-H1-7B-Instruct

**Model ID**: `tiiuae/Falcon-H1-7B-Instruct`

**Specifications**:
- Parameters: 7B
- Framework: Transformers
- Base VRAM: 16 GB minimum, 22 GB recommended
- Max sequence length: 4096
- Tensor parallel: 1

**vLLM Startup Command**:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model tiiuae/Falcon-H1-7B-Instruct \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --tensor-parallel-size 1 \
  --pipeline-parallel-size 1
```

**Docker Compose Service**:

```yaml
falcon-h1-7b:
  image: dc1/llm-worker:latest
  container_name: vllm-falcon-h1-7b
  restart: always
  ports:
    - "8001:8000"
  environment:
    HF_HOME: /opt/dcp/model-cache
    TRANSFORMERS_CACHE: /opt/dcp/model-cache
    VLLM_ALLOW_LONG_MAX_MODEL_LEN: 1
    MODEL_ID: tiiuae/Falcon-H1-7B-Instruct
    VLLM_ARGS: >
      --max-model-len 4096
      --gpu-memory-utilization 0.90
      --dtype float16
      --tensor-parallel-size 1
  volumes:
    - falcon-cache:/opt/dcp/model-cache
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
      limits:
        memory: 24G
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 120s
```

**Health Check Endpoint**: `GET http://localhost:8000/health`

**Estimated Metrics (RTX 4090)**:
- Time-to-first-token: ~260-300ms
- Peak VRAM: ~21.0 GB
- Throughput: ~48 tok/s
- Startup time: ~18-25s (cold start)

---

### 3. Qwen 2.5-7B-Instruct

**Model ID**: `Qwen/Qwen2.5-7B-Instruct`

**Specifications**:
- Parameters: 7B
- Framework: Transformers (requires flash-attention)
- Base VRAM: 18 GB minimum, 24 GB recommended
- Max sequence length: 32768 (context window)
- Tensor parallel: 1

**vLLM Startup Command**:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --tensor-parallel-size 1 \
  --pipeline-parallel-size 1 \
  --enable-lora
```

**Docker Compose Service**:

```yaml
qwen25-7b:
  image: dc1/llm-worker:latest
  container_name: vllm-qwen25-7b
  restart: always
  ports:
    - "8002:8000"
  environment:
    HF_HOME: /opt/dcp/model-cache
    TRANSFORMERS_CACHE: /opt/dcp/model-cache
    VLLM_ALLOW_LONG_MAX_MODEL_LEN: 1
    MODEL_ID: Qwen/Qwen2.5-7B-Instruct
    VLLM_ARGS: >
      --max-model-len 8192
      --gpu-memory-utilization 0.90
      --dtype float16
      --tensor-parallel-size 1
      --enable-lora
  volumes:
    - qwen-cache:/opt/dcp/model-cache
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
      limits:
        memory: 24G
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 120s
```

**Health Check Endpoint**: `GET http://localhost:8000/health`

**Estimated Metrics (RTX 4090)**:
- Time-to-first-token: ~240-280ms (optimized for Arabic)
- Peak VRAM: ~22.5 GB
- Throughput: ~52 tok/s
- Startup time: ~16-20s (cold start)

---

### 4. Llama-3-8B-Instruct

**Model ID**: `meta-llama/Meta-Llama-3-8B-Instruct`

**Specifications**:
- Parameters: 8B
- Framework: Transformers
- Base VRAM: 19 GB minimum, 26 GB recommended
- Max sequence length: 8192
- Tensor parallel: 1

**vLLM Startup Command**:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3-8B-Instruct \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --tensor-parallel-size 1 \
  --pipeline-parallel-size 1
```

**Docker Compose Service**:

```yaml
llama-3-8b:
  image: dc1/llm-worker:latest
  container_name: vllm-llama-3-8b
  restart: always
  ports:
    - "8003:8000"
  environment:
    HF_HOME: /opt/dcp/model-cache
    TRANSFORMERS_CACHE: /opt/dcp/model-cache
    VLLM_ALLOW_LONG_MAX_MODEL_LEN: 1
    MODEL_ID: meta-llama/Meta-Llama-3-8B-Instruct
    VLLM_ARGS: >
      --max-model-len 8192
      --gpu-memory-utilization 0.90
      --dtype float16
      --tensor-parallel-size 1
  volumes:
    - llama3-cache:/opt/dcp/model-cache
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
      limits:
        memory: 24G
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 120s
```

**Health Check Endpoint**: `GET http://localhost:8000/health`

**Estimated Metrics (RTX 4090)**:
- Time-to-first-token: ~300-350ms
- Peak VRAM: ~22.8 GB
- Throughput: ~42 tok/s
- Startup time: ~22-28s (cold start)

---

### 5. Mistral-7B-Instruct-v0.2

**Model ID**: `mistralai/Mistral-7B-Instruct-v0.2`

**Specifications**:
- Parameters: 7B
- Framework: Transformers
- Base VRAM: 17 GB minimum, 24 GB recommended
- Max sequence length: 32768 (context window)
- Tensor parallel: 1

**vLLM Startup Command**:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model mistralai/Mistral-7B-Instruct-v0.2 \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --tensor-parallel-size 1 \
  --pipeline-parallel-size 1
```

**Docker Compose Service**:

```yaml
mistral-7b:
  image: dc1/llm-worker:latest
  container_name: vllm-mistral-7b
  restart: always
  ports:
    - "8004:8000"
  environment:
    HF_HOME: /opt/dcp/model-cache
    TRANSFORMERS_CACHE: /opt/dcp/model-cache
    VLLM_ALLOW_LONG_MAX_MODEL_LEN: 1
    MODEL_ID: mistralai/Mistral-7B-Instruct-v0.2
    VLLM_ARGS: >
      --max-model-len 8192
      --gpu-memory-utilization 0.90
      --dtype float16
      --tensor-parallel-size 1
  volumes:
    - mistral-cache:/opt/dcp/model-cache
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
      limits:
        memory: 24G
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 120s
```

**Health Check Endpoint**: `GET http://localhost:8000/health`

**Estimated Metrics (RTX 4090)**:
- Time-to-first-token: ~250-290ms
- Peak VRAM: ~21.2 GB
- Throughput: ~50 tok/s
- Startup time: ~18-24s (cold start)

---

### 6. Nemotron-Nano-4B-Instruct

**Model ID**: `nvidia/Nemotron-Mini-4B-Instruct`

**Specifications**:
- Parameters: 4B
- Framework: Transformers
- Base VRAM: 10 GB minimum, 14 GB recommended
- Max sequence length: 4096
- Tensor parallel: 1
- **Note**: Instant-tier candidate — small footprint enables pre-baking into provider Docker image

**vLLM Startup Command**:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model nvidia/Nemotron-Mini-4B-Instruct \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --tensor-parallel-size 1 \
  --pipeline-parallel-size 1
```

**Docker Compose Service**:

```yaml
nemotron-nano-4b:
  image: dc1/llm-worker:latest
  container_name: vllm-nemotron-nano-4b
  restart: always
  ports:
    - "8005:8000"
  environment:
    HF_HOME: /opt/dcp/model-cache
    TRANSFORMERS_CACHE: /opt/dcp/model-cache
    VLLM_ALLOW_LONG_MAX_MODEL_LEN: 1
    MODEL_ID: nvidia/Nemotron-Mini-4B-Instruct
    VLLM_ARGS: >
      --max-model-len 4096
      --gpu-memory-utilization 0.90
      --dtype float16
      --tensor-parallel-size 1
  volumes:
    - nemotron-cache:/opt/dcp/model-cache
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
      limits:
        memory: 24G
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 60s
```

**Health Check Endpoint**: `GET http://localhost:8000/health`

**Estimated Metrics (RTX 4090)**:
- Time-to-first-token: ~150-180ms (fastest Tier A)
- Peak VRAM: ~11.8 GB
- Throughput: ~75 tok/s
- Startup time: ~8-12s (cold start) — **ideal for instant-tier**

---

## TIER B — Secondary-Tier Models (Dual RTX 4090 / H100 Baseline)

Tier B models include larger LLMs requiring multi-GPU setups, and specialized services (embeddings, reranker, image generation).

### 7. JAIS-13B-Chat

**Model ID**: `inceptionai/jais-13b-chat`

**Specifications**:
- Parameters: 13B
- Framework: Transformers
- Base VRAM: 31 GB minimum, 38 GB recommended
- **Requires**: Tensor-parallel-size 2 (dual RTX 4090 or H100)
- Max sequence length: 2048
- Native Arabic model — **critical for Arabic RAG**

**vLLM Startup Command** (Dual GPU):

```bash
python -m vllm.entrypoints.openai.api_server \
  --model inceptionai/jais-13b-chat \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 2048 \
  --gpu-memory-utilization 0.90 \
  --dtype float16 \
  --tensor-parallel-size 2 \
  --pipeline-parallel-size 1
```

**Docker Compose Service** (Dual GPU):

```yaml
jais-13b:
  image: dc1/llm-worker:latest
  container_name: vllm-jais-13b
  restart: always
  ports:
    - "8010:8000"
  environment:
    HF_HOME: /opt/dcp/model-cache
    TRANSFORMERS_CACHE: /opt/dcp/model-cache
    VLLM_ALLOW_LONG_MAX_MODEL_LEN: 1
    MODEL_ID: inceptionai/jais-13b-chat
    VLLM_ARGS: >
      --max-model-len 2048
      --gpu-memory-utilization 0.90
      --dtype float16
      --tensor-parallel-size 2
      --pipeline-parallel-size 1
  volumes:
    - jais-cache:/opt/dcp/model-cache
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 2
            capabilities: [gpu]
      limits:
        memory: 48G
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 180s
```

**Health Check Endpoint**: `GET http://localhost:8000/health`

**Estimated Metrics (Dual RTX 4090)**:
- Time-to-first-token: ~380-420ms
- Peak VRAM: ~36.5 GB (18.25 per GPU)
- Throughput: ~35 tok/s (combined)
- Startup time: ~40-60s (cold start, distributed initialization)

**Provider Requirement**: **Two RTX 4090s minimum** (or one H100 with tensor-parallel-size 1)

---

### 8. BGE-M3 Embedding Service

**Model ID**: `BAAI/bge-m3`

**Specifications**:
- Type: Multi-lingual Dense Embedding (Arabic-capable)
- Parameters: ~125M
- VRAM: 1-2 GB
- Batch size: Supports up to 512 in single request
- Embedding dimension: 1024
- Max input length: 8192 tokens

**vLLM Startup Command** (Embedding Service):

```bash
python -m vllm.entrypoints.openai.api_server \
  --model BAAI/bge-m3 \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.80 \
  --dtype float16 \
  --tensor-parallel-size 1 \
  --pipeline-parallel-size 1 \
  --tokenizer-pool-size 1
```

**Docker Compose Service**:

```yaml
bge-m3:
  image: dc1/llm-worker:latest
  container_name: vllm-bge-m3
  restart: always
  ports:
    - "8011:8000"
  environment:
    HF_HOME: /opt/dcp/model-cache
    TRANSFORMERS_CACHE: /opt/dcp/model-cache
    VLLM_ALLOW_LONG_MAX_MODEL_LEN: 1
    MODEL_ID: BAAI/bge-m3
    VLLM_ARGS: >
      --max-model-len 8192
      --gpu-memory-utilization 0.80
      --dtype float16
      --tensor-parallel-size 1
      --tokenizer-pool-size 1
  volumes:
    - bge-m3-cache:/opt/dcp/model-cache
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
      limits:
        memory: 8G
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 60s
```

**Health Check Endpoint**: `GET http://localhost:8000/health`

**Estimated Metrics (RTX 4090)**:
- Latency per embedding (1024 dim): ~15-25ms
- Throughput: 1,000+ embeddings/s (batch mode)
- Peak VRAM: ~1.8 GB
- Startup time: ~5-8s (cold start)

**API Usage Example**:

```bash
curl http://localhost:8000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "input": "مرحبا بك في منصة DCP",
    "model": "BAAI/bge-m3"
  }'
```

---

### 9. BGE-Reranker-v2-M3

**Model ID**: `BAAI/bge-reranker-v2-m3`

**Specifications**:
- Type: Cross-encoder Reranker (Arabic-capable)
- Parameters: ~140M
- VRAM: 1-2 GB
- Max input pairs: 256
- Input length: 512 tokens per passage

**vLLM Startup Command**:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model BAAI/bge-reranker-v2-m3 \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 512 \
  --gpu-memory-utilization 0.80 \
  --dtype float16 \
  --tensor-parallel-size 1 \
  --pipeline-parallel-size 1
```

**Docker Compose Service**:

```yaml
bge-reranker:
  image: dc1/llm-worker:latest
  container_name: vllm-bge-reranker
  restart: always
  ports:
    - "8012:8000"
  environment:
    HF_HOME: /opt/dcp/model-cache
    TRANSFORMERS_CACHE: /opt/dcp/model-cache
    VLLM_ALLOW_LONG_MAX_MODEL_LEN: 1
    MODEL_ID: BAAI/bge-reranker-v2-m3
    VLLM_ARGS: >
      --max-model-len 512
      --gpu-memory-utilization 0.80
      --dtype float16
      --tensor-parallel-size 1
  volumes:
    - bge-reranker-cache:/opt/dcp/model-cache
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
      limits:
        memory: 8G
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 60s
```

**Health Check Endpoint**: `GET http://localhost:8000/health`

**Estimated Metrics (RTX 4090)**:
- Latency per rerank (256 passages): ~40-60ms
- Throughput: 4,000+ passages/s (batch mode)
- Peak VRAM: ~1.9 GB
- Startup time: ~5-8s (cold start)

---

### 10. SDXL Base 1.0 (Image Generation)

**Model ID**: `stabilityai/stable-diffusion-xl-base-1.0`

**Specifications**:
- Type: Text-to-Image Diffusion
- Parameters: 2.6B
- VRAM: 6-10 GB (requires VAE tiling for 24GB constraints)
- Inference steps: 30-50 (20-25s per image)
- Output: 1024x1024 PNG

**vLLM Startup Command**:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model stabilityai/stable-diffusion-xl-base-1.0 \
  --host 0.0.0.0 \
  --port 8000 \
  --gpu-memory-utilization 0.85 \
  --dtype float16 \
  --tensor-parallel-size 1
```

**Docker Compose Service** (with VAE Tiling):

```yaml
sdxl:
  image: dc1/llm-worker:latest
  container_name: vllm-sdxl
  restart: always
  ports:
    - "8013:8000"
  environment:
    HF_HOME: /opt/dcp/model-cache
    TRANSFORMERS_CACHE: /opt/dcp/model-cache
    VLLM_ALLOW_LONG_MAX_MODEL_LEN: 1
    MODEL_ID: stabilityai/stable-diffusion-xl-base-1.0
    VLLM_ARGS: >
      --gpu-memory-utilization 0.85
      --dtype float16
      --tensor-parallel-size 1
    DIFFUSERS_CACHE: /opt/dcp/model-cache
  volumes:
    - sdxl-cache:/opt/dcp/model-cache
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
      limits:
        memory: 24G
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 90s
```

**Health Check Endpoint**: `GET http://localhost:8000/health`

**Estimated Metrics (RTX 4090)**:
- Latency per image (30 steps): ~20-25s
- Peak VRAM: ~9.5 GB (with VAE tiling enabled)
- Throughput: 1 image / 25s = 0.04 img/s
- Startup time: ~25-35s (cold start)

**API Usage Example**:

```bash
curl http://localhost:8000/v1/images/generations \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Beautiful Saudi landscape at sunset",
    "model": "stabilityai/stable-diffusion-xl-base-1.0",
    "n": 1,
    "size": "1024x1024",
    "quality": "hd"
  }'
```

---

## Deployment Checklist

### Before Launching Any Model

- [ ] **GPU availability**: Verify GPU count and VRAM with `nvidia-smi`
  - Tier A: Minimum 24GB (single RTX 4090)
  - JAIS-13B: Minimum 48GB (dual RTX 4090)
  - Embeddings/Reranker: Minimum 8GB shared

- [ ] **Model cache**: Pre-stage HuggingFace models
  ```bash
  huggingface-cli download ALLaM-AI/ALLaM-7B-Instruct-preview --cache-dir /opt/dcp/model-cache
  ```

- [ ] **Health checks**: Verify port accessibility
  ```bash
  curl -v http://localhost:8000/health
  ```

- [ ] **Docker image built**: Ensure `dc1/llm-worker:latest` is built
  ```bash
  docker build -t dc1/llm-worker:latest -f backend/docker-templates/vllm-serve.Dockerfile .
  ```

### Monitoring Health

All services include vLLM OpenAI-compatible `/health` endpoints. Provider agents should monitor:

```
GET /health → { "status": "ok" }
```

If health check fails 3x consecutively, service enters `unhealthy` state and PM2/systemd will restart.

---

## Performance Tuning

### VRAM Optimization

- **`--gpu-memory-utilization 0.90`**: 90% of available VRAM
- **`--dtype float16`**: FP16 (16-bit) reduces memory vs FP32
- **`--max-model-len`**: Sets KV cache size; lower = less VRAM but shorter context
  - ALLaM/Falcon: 4096 (balanced for 24GB)
  - Qwen/Llama/Mistral: 8192 (fits in 24GB with 0.90 util)
  - JAIS: 2048 (requires dual GPU)

### Throughput Optimization

- **`--gpu-memory-utilization 0.95`**: Max throughput (slight OOM risk)
- **Batch size**: vLLM auto-batches up to `--max-batch-size` (default: 256)
- **Pipeline parallel**: Only for models > 80B (not needed for Tier A/B)

### Latency Optimization

- **Pre-warming**: Providers should keep instant-tier models loaded
- **Flash-Attention**: Enabled by default in vLLM 0.5.5
- **PagedAttention**: Reduces memory overhead for long sequences

---

## Troubleshooting

### Out-of-Memory (OOM)

```
RuntimeError: CUDA out of memory
```

**Solution**:
- Lower `--max-model-len` (reduces KV cache size)
- Reduce `--gpu-memory-utilization` (e.g., 0.85 instead of 0.90)
- Add second GPU for JAIS-13B

### Model Not Found / Slow Download

```
FileNotFoundError: hutingface.co/ALLaM-AI/ALLaM-7B-Instruct-preview
```

**Solution**:
- Pre-cache model: `huggingface-cli download <model-id>`
- Check HF token: `huggingface-cli login`
- Mount `/opt/dcp/model-cache` as persistent volume

### Health Check Timeout

```
HealthCheck failed 3 times
```

**Solution**:
- Increase `start_period` in healthcheck (currently 120s, increase to 180s for large models)
- Check logs: `docker logs vllm-<model-name>`
- Verify GPU is not full: `nvidia-smi`

---

## Integration with DCP Backend

Each vLLM service exposes OpenAI-compatible API at `http://localhost:8000/v1/*`:

- **Chat**: `POST /v1/chat/completions` (LLMs: ALLaM, Falcon, Qwen, Llama, Mistral, JAIS)
- **Embeddings**: `POST /v1/embeddings` (BGE-M3, Reranker)
- **Images**: `POST /v1/images/generations` (SDXL)

Backend routes (`backend/src/routes/vllm.js`) proxy requests to active provider endpoints and handle metering, authentication, and billing.

---

## References

- vLLM Documentation: https://docs.vllm.ai
- Arabic Portfolio: `infra/config/arabic-portfolio.json`
- vLLM Base Image: `backend/docker-templates/vllm-serve.Dockerfile`
- Provider Onboarding: `docs/provider-onboarding.md`
