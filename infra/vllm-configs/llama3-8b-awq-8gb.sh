#!/bin/bash

# Llama 3.1 8B AWQ — optimized for RTX 3060 Ti (8GB VRAM)
#
# Model: meta-llama/Meta-Llama-3.1-8B-Instruct-AWQ (or hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4)
# GPU: RTX 3060 Ti (8GB VRAM)
# Quantization: AWQ INT4
# Precision: float16
# Max Model Len: 2048 tokens (reduced to fit 8GB)
# GPU Memory Utilization: 0.90 (7.2GB used)
#
# Est. Throughput: 25-35 tok/s on RTX 3060 Ti
# Est. Cold-Start: 15-25s (AWQ load)
# VRAM: ~5-6GB
#
# Requirements:
#   pip install vllm autoawq
#
# To run:
#   bash infra/vllm-configs/llama3-8b-awq-8gb.sh

set -e

MODEL_NAME="${VLLM_MODEL:-hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4}"
PORT="${VLLM_PORT:-8000}"
MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-2048}"
GPU_MEMORY_UTIL="${VLLM_GPU_MEMORY_UTIL:-0.90}"

echo "[$(date)] Starting vLLM — Llama 3.1 8B AWQ (8GB tier)"
echo "  Model: $MODEL_NAME"
echo "  Port: $PORT"
echo "  Max context: $MAX_MODEL_LEN tokens"
echo "  GPU memory util: $GPU_MEMORY_UTIL"
echo ""

python -m vllm.entrypoints.openai.api_server \
  --model "$MODEL_NAME" \
  --host 0.0.0.0 \
  --port "$PORT" \
  --quantization awq \
  --dtype float16 \
  --max-model-len "$MAX_MODEL_LEN" \
  --gpu-memory-utilization "$GPU_MEMORY_UTIL" \
  --tensor-parallel-size 1 \
  --max-num-seqs 64 \
  --swap-space 2 \
  --disable-log-requests \
  --trust-remote-code

