#!/bin/bash

# ALLaM-7B AWQ — optimized for RTX 3060 Ti (8GB VRAM)
#
# Model: BOLT-IS/ALLaM-IT-7B (check HuggingFace for AWQ variant)
# NOTE: As of Apr 2026, no official AWQ variant of ALLaM-IT-7B exists on HuggingFace.
#       Options:
#       1. Use full bfloat16 on 12GB+ cards (RTX 3060 or better)
#       2. Self-quantize: autoawq --model BOLT-IS/ALLaM-IT-7B --quant-path ./allam-7b-awq
#       3. Wait for community AWQ release (check: https://huggingface.co/models?search=allam+awq)
#
# GPU: RTX 3060 Ti (8GB VRAM)
# Quantization: AWQ INT4 (if AWQ weights available) or GPTQ
# Precision: float16
# Max Model Len: 2048 tokens
#
# SELF-QUANTIZATION (one-time, ~30min on GPU):
#   pip install autoawq
#   python -c "
#   from awq import AutoAWQForCausalLM
#   from transformers import AutoTokenizer
#   model = AutoAWQForCausalLM.from_pretrained('BOLT-IS/ALLaM-IT-7B')
#   tokenizer = AutoTokenizer.from_pretrained('BOLT-IS/ALLaM-IT-7B')
#   model.quantize(tokenizer, quant_config={'zero_point': True, 'q_group_size': 128, 'w_bit': 4, 'version': 'GEMM'})
#   model.save_quantized('./allam-7b-awq')
#   tokenizer.save_pretrained('./allam-7b-awq')
#   "
#   Then set VLLM_MODEL=./allam-7b-awq below.
#
# To run (after AWQ weights ready):
#   VLLM_MODEL=./allam-7b-awq bash infra/vllm-configs/allam-7b-awq-8gb.sh

set -e

MODEL_NAME="${VLLM_MODEL:-./allam-7b-awq}"
PORT="${VLLM_PORT:-8000}"
MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-2048}"
GPU_MEMORY_UTIL="${VLLM_GPU_MEMORY_UTIL:-0.90}"

echo "[$(date)] Starting vLLM — ALLaM-7B AWQ (8GB tier)"
echo "  Model: $MODEL_NAME"
echo "  Port: $PORT"
echo "  NOTE: Requires pre-quantized AWQ weights. See comments above."
echo ""

if [ ! -d "$MODEL_NAME" ] && [[ "$MODEL_NAME" == ./* ]]; then
  echo "ERROR: AWQ model directory '$MODEL_NAME' not found."
  echo "Run self-quantization first (see comments in this script)."
  exit 1
fi

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

