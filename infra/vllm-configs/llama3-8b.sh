#!/bin/bash

# Llama 3 8B vLLM Startup Configuration
#
# Model: Meta-Llama-3-8B-Instruct
# GPU: RTX 4090 (24GB VRAM)
# Tensor Parallelism: Single GPU
# Precision: bfloat16
# Max Model Len: 6144 tokens (supports longer context)
# GPU Memory Utilization: 0.88 (88% of VRAM)
#
# Source: https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct
# Provider Tier: A (High-throughput, low-latency)
# Est. Throughput: 42+ tokens/sec on RTX 4090
# Est. Cold-Start: 10-15 seconds
#
# Requirements:
#   - VRAM: 20-22GB (bfloat16, context=6144)
#   - VRAM Available: 24GB (RTX 4090)
#   - Safety Margin: 2GB
#
# To run:
#   bash infra/vllm-configs/llama3-8b.sh
#
# The service will listen on 0.0.0.0:8000 and accept:
#   - OpenAI-compatible /v1/chat/completions requests
#   - /health endpoint for readiness checks

set -e

MODEL_NAME="meta-llama/Meta-Llama-3-8B-Instruct"
PORT="${VLLM_PORT:-8000}"
TENSOR_PARALLEL_SIZE="${VLLM_TENSOR_PARALLEL_SIZE:-1}"
MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-6144}"
GPU_MEMORY_UTIL="${VLLM_GPU_MEMORY_UTIL:-0.88}"
DTYPE="${VLLM_DTYPE:-bfloat16}"

echo "[$(date)] Starting vLLM for Llama 3 8B..."
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
