#!/bin/bash

# Mistral 7B AWQ — optimized for RTX 3060 Ti (8GB VRAM)
#
# Model: TheBloke/Mistral-7B-Instruct-v0.2-AWQ
# GPU: RTX 3060 Ti (8GB VRAM)
# Quantization: AWQ INT4
# Precision: float16
# Max Model Len: 2048 tokens
# GPU Memory Utilization: 0.90
#
# Est. Throughput: 30-40 tok/s on RTX 3060 Ti
# Est. VRAM: ~4.5-5.5GB
#
# To run:
#   bash infra/vllm-configs/mistral-7b-awq-8gb.sh

set -e

MODEL_NAME="${VLLM_MODEL:-TheBloke/Mistral-7B-Instruct-v0.2-AWQ}"
PORT="${VLLM_PORT:-8000}"
MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-2048}"
GPU_MEMORY_UTIL="${VLLM_GPU_MEMORY_UTIL:-0.90}"

echo "[$(date)] Starting vLLM — Mistral 7B AWQ (8GB tier)"
echo "  Model: $MODEL_NAME"
echo "  Port: $PORT"

python -m vllm.entrypoints.openai.api_server \
  --model "$MODEL_NAME" \
  --host 0.0.0.0 \
  --port "$PORT" \
  --quantization awq_marlin \
  --dtype float16 \
  --max-model-len "$MAX_MODEL_LEN" \
  --gpu-memory-utilization "$GPU_MEMORY_UTIL" \
  --tensor-parallel-size 1 \
  --max-num-seqs 64 \
  --swap-space 2 \
  --disable-log-requests \
  --trust-remote-code

