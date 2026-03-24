#!/bin/bash

# ALLaM-7B vLLM Startup Configuration
#
# Model: ALLaM-IT-7B (Arabic Large Language Model)
# GPU: RTX 4090 (24GB VRAM)
# Tensor Parallelism: Single GPU
# Precision: bfloat16
# Max Model Len: 4096 tokens
# GPU Memory Utilization: 0.85 (85% of VRAM)
#
# Source: https://huggingface.co/BOLT-IS/ALLaM-IT-7B
# Provider Tier: A (High-throughput, low-latency)
# Est. Throughput: 45+ tokens/sec on RTX 4090
# Est. Cold-Start: 8-12 seconds
#
# Requirements:
#   - VRAM: 20-22GB (bfloat16, context=4096)
#   - VRAM Available: 24GB (RTX 4090)
#   - Safety Margin: 2GB
#
# To run:
#   bash infra/vllm-configs/allam-7b.sh
#
# The service will listen on 0.0.0.0:8000 and accept:
#   - OpenAI-compatible /v1/chat/completions requests
#   - /health endpoint for readiness checks

set -e

MODEL_NAME="BOLT-IS/ALLaM-IT-7B"
PORT="${VLLM_PORT:-8000}"
TENSOR_PARALLEL_SIZE="${VLLM_TENSOR_PARALLEL_SIZE:-1}"
MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-4096}"
GPU_MEMORY_UTIL="${VLLM_GPU_MEMORY_UTIL:-0.85}"
DTYPE="${VLLM_DTYPE:-bfloat16}"

echo "[$(date)] Starting vLLM for ALLaM-7B..."
echo "  Model: $MODEL_NAME"
echo "  Port: $PORT"
echo "  GPU Memory Utilization: $GPU_MEMORY_UTIL"
echo "  Max Model Len: $MAX_MODEL_LEN"
echo "  Dtype: $DTYPE"
echo ""

python -m vllm.entrypoints.openai.api_server \
  --model "$MODEL_NAME" \
  --host 0.0.0.0 \
  --port "$PORT" \
  --max-model-len "$MAX_MODEL_LEN" \
  --gpu-memory-utilization "$GPU_MEMORY_UTIL" \
  --tensor-parallel-size "$TENSOR_PARALLEL_SIZE" \
  --dtype "$DTYPE" \
  --max-num-seqs 256 \
  --swap-space 4 \
  --disable-log-requests \
  --trust-remote-code
