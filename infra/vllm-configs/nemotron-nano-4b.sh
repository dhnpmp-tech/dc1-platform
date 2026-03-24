#!/bin/bash

# Nemotron Nano 4B vLLM Startup Configuration
#
# Model: nvidia/Nemotron-Mini-4B-Instruct
# GPU: RTX 4090 (24GB VRAM)
# Tensor Parallelism: Single GPU
# Precision: bfloat16
# Max Model Len: 4096 tokens
# GPU Memory Utilization: 0.75 (75% of VRAM) - smaller model, lower utilization
#
# Source: https://huggingface.co/nvidia/Nemotron-Mini-4B-Instruct
# Provider Tier: A (High-throughput, low-latency, smallest)
# Est. Throughput: 65+ tokens/sec on RTX 4090 (smallest model, fastest)
# Est. Cold-Start: 5-8 seconds (fastest cold-start)
#
# Requirements:
#   - VRAM: 11-13GB (bfloat16, context=4096)
#   - VRAM Available: 24GB (RTX 4090)
#   - Safety Margin: 11GB (plenty of room for batching)
#
# To run:
#   bash infra/vllm-configs/nemotron-nano-4b.sh
#
# The service will listen on 0.0.0.0:8000 and accept:
#   - OpenAI-compatible /v1/chat/completions requests
#   - /health endpoint for readiness checks

set -e

MODEL_NAME="nvidia/Nemotron-Mini-4B-Instruct"
PORT="${VLLM_PORT:-8000}"
TENSOR_PARALLEL_SIZE="${VLLM_TENSOR_PARALLEL_SIZE:-1}"
MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-4096}"
GPU_MEMORY_UTIL="${VLLM_GPU_MEMORY_UTIL:-0.75}"
DTYPE="${VLLM_DTYPE:-bfloat16}"

echo "[$(date)] Starting vLLM for Nemotron Nano 4B..."
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
