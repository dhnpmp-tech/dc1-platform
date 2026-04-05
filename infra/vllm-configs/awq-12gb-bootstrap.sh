#!/bin/bash

# vLLM AWQ bootstrap for 12GB providers (e.g. RTX 3060, RTX 4070 Laptop)
# Tuned for 7B AWQ-class serving on constrained devices.

set -euo pipefail

MODEL_NAME="${VLLM_MODEL:-mistralai/Mistral-7B-Instruct-v0.2-AWQ}"
PORT="${VLLM_PORT:-8000}"
MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-2048}"
GPU_MEMORY_UTIL="${VLLM_GPU_MEMORY_UTIL:-0.90}"
DTYPE="${VLLM_DTYPE:-float16}"
TENSOR_PARALLEL_SIZE="${VLLM_TENSOR_PARALLEL_SIZE:-1}"
MAX_NUM_SEQS="${VLLM_MAX_NUM_SEQS:-64}"

echo "[$(date)] Starting 12GB AWQ vLLM bootstrap"
echo "  Model: $MODEL_NAME"
echo "  Port: $PORT"
echo "  Quantization: awq_marlin"
echo "  Dtype: $DTYPE"
echo "  Max model len: $MAX_MODEL_LEN"
echo "  GPU memory util: $GPU_MEMORY_UTIL"
echo ""

python -m vllm.entrypoints.openai.api_server \
  --model "$MODEL_NAME" \
  --host 0.0.0.0 \
  --port "$PORT" \
  --quantization awq_marlin \
  --dtype "$DTYPE" \
  --gpu-memory-utilization "$GPU_MEMORY_UTIL" \
  --max-model-len "$MAX_MODEL_LEN" \
  --tensor-parallel-size "$TENSOR_PARALLEL_SIZE" \
  --max-num-seqs "$MAX_NUM_SEQS" \
  --swap-space 6 \
  --disable-log-requests \
  --trust-remote-code
