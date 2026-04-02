#!/bin/bash

# Llama 3.1 8B — full precision for RTX 3060 (12GB VRAM)
#
# Model: meta-llama/Meta-Llama-3.1-8B-Instruct
# GPU: RTX 3060 (12GB VRAM)
# Quantization: none (full float16)
# Max Model Len: 4096 tokens
# GPU Memory Utilization: 0.88
#
# Est. Throughput: 35-45 tok/s on RTX 3060
# Est. VRAM: ~16GB bfloat16 → use float16 to fit in 12GB (~9-10GB)
#
# To run:
#   bash infra/vllm-configs/llama3-8b-12gb.sh

set -e

MODEL_NAME="${VLLM_MODEL:-meta-llama/Meta-Llama-3.1-8B-Instruct}"
PORT="${VLLM_PORT:-8000}"
MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-4096}"
GPU_MEMORY_UTIL="${VLLM_GPU_MEMORY_UTIL:-0.88}"

echo "[$(date)] Starting vLLM — Llama 3.1 8B FP16 (12GB tier)"
echo "  Model: $MODEL_NAME"
echo "  Port: $PORT"
echo "  Max context: $MAX_MODEL_LEN tokens"
echo ""

python -m vllm.entrypoints.openai.api_server \
  --model "$MODEL_NAME" \
  --host 0.0.0.0 \
  --port "$PORT" \
  --dtype float16 \
  --max-model-len "$MAX_MODEL_LEN" \
  --gpu-memory-utilization "$GPU_MEMORY_UTIL" \
  --tensor-parallel-size 1 \
  --max-num-seqs 128 \
  --swap-space 4 \
  --disable-log-requests \
  --trust-remote-code

