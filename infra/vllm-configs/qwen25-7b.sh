#!/bin/bash

# Qwen 2.5 7B vLLM Startup Configuration
#
# Model: Qwen/Qwen2.5-7B-Instruct
# GPU: RTX 4090 (24GB VRAM)
# Tensor Parallelism: Single GPU
# Precision: bfloat16
# Max Model Len: 4096 tokens
# GPU Memory Utilization: 0.82 (82% of VRAM)
#
# Source: https://huggingface.co/Qwen/Qwen2.5-7B-Instruct
# Provider Tier: A (High-throughput, low-latency)
# Est. Throughput: 48+ tokens/sec on RTX 4090
# Est. Cold-Start: 7-10 seconds
#
# Requirements:
#   - VRAM: 19-21GB (bfloat16, context=4096)
#   - VRAM Available: 24GB (RTX 4090)
#   - Safety Margin: 3GB
#
# To run:
#   bash infra/vllm-configs/qwen25-7b.sh
#
# The service will listen on 0.0.0.0:8000 and accept:
#   - OpenAI-compatible /v1/chat/completions requests
#   - /health endpoint for readiness checks

set -e

MODEL_NAME="Qwen/Qwen2.5-7B-Instruct"
PORT="${VLLM_PORT:-8000}"
TENSOR_PARALLEL_SIZE="${VLLM_TENSOR_PARALLEL_SIZE:-1}"
MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-4096}"
GPU_MEMORY_UTIL="${VLLM_GPU_MEMORY_UTIL:-0.82}"
DTYPE="${VLLM_DTYPE:-bfloat16}"

echo "[$(date)] Starting vLLM for Qwen 2.5 7B..."
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
