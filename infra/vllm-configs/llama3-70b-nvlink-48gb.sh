#!/bin/bash

# Llama 3.1 70B — 2x RTX 3090 NVLink (48GB VRAM)
#
# Model: meta-llama/Meta-Llama-3.1-70B-Instruct
# GPU: 2x RTX 3090 NVLink (48GB total VRAM)
# Quantization: none (bfloat16)
# Tensor Parallelism: 2
# Max Model Len: 8192 tokens
# GPU Memory Utilization: 0.88
#
# Est. Throughput: 15-25 tok/s (tensor parallel across 2 GPUs)
# Est. VRAM: ~140GB bfloat16 — does NOT fit. Use AWQ or float8.
#
# NOTE: Llama 70B in bfloat16 requires ~140GB VRAM.
#       48GB is insufficient for FP16/BF16. Use AWQ INT4 (~38GB) or fp8.
#       Switch to: meta-llama/Meta-Llama-3.1-70B-Instruct-AWQ (if available)
#       Or: hugging-quants/Meta-Llama-3.1-70B-Instruct-AWQ-INT4
#
# To run:
#   bash infra/vllm-configs/llama3-70b-nvlink-48gb.sh

set -e

MODEL_NAME="${VLLM_MODEL:-hugging-quants/Meta-Llama-3.1-70B-Instruct-AWQ-INT4}"
PORT="${VLLM_PORT:-8000}"
MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-8192}"
GPU_MEMORY_UTIL="${VLLM_GPU_MEMORY_UTIL:-0.88}"

echo "[$(date)] Starting vLLM — Llama 3.1 70B AWQ (2x RTX 3090 NVLink 48GB)"
echo "  Model: $MODEL_NAME"
echo "  Port: $PORT"
echo "  Tensor parallel: 2 GPUs"
echo "  Max context: $MAX_MODEL_LEN tokens"
echo ""

python -m vllm.entrypoints.openai.api_server \
  --model "$MODEL_NAME" \
  --host 0.0.0.0 \
  --port "$PORT" \
  --quantization awq \
  --dtype float16 \
  --max-model-len "$MAX_MODEL_LEN" \
  --gpu-memory-utilization "$GPU_MEMORY_UTIL" \
  --tensor-parallel-size 2 \
  --max-num-seqs 128 \
  --swap-space 8 \
  --disable-log-requests \
  --trust-remote-code

