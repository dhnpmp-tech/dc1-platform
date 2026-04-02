#!/bin/bash

# ALLaM-7B — full precision for RTX 3060 (12GB VRAM)
#
# Model: BOLT-IS/ALLaM-IT-7B
# GPU: RTX 3060 (12GB VRAM)
# Quantization: none (float16)
# Max Model Len: 4096 tokens
# GPU Memory Utilization: 0.88
#
# Est. Throughput: 30-40 tok/s on RTX 3060
# Est. VRAM: ~14GB bfloat16 → ~9-10GB float16 ✅ fits 12GB
#
# To run:
#   bash infra/vllm-configs/allam-7b-12gb.sh

set -e

MODEL_NAME="${VLLM_MODEL:-BOLT-IS/ALLaM-IT-7B}"
PORT="${VLLM_PORT:-8000}"
MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-4096}"
GPU_MEMORY_UTIL="${VLLM_GPU_MEMORY_UTIL:-0.88}"

echo "[$(date)] Starting vLLM — ALLaM-7B FP16 (12GB tier)"
echo "  Model: $MODEL_NAME"
echo "  Port: $PORT"
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

