# DCP GPU Compatibility Matrix (vLLM)

All throughput numbers are planning estimates for common instruct workloads (short-to-medium prompts, batch inference). Actual values vary by quantization, prompt length, context cache, and model choice.

| GPU | VRAM | Models Runnable (Typical) | vLLM Batch Size (7B-8B) | Estimated tokens/sec (7B-8B) |
|-----|------|----------------------------|---------------------------|-------------------------------|
| RTX 3090 | 24 GB | Phi-3 Mini, Mistral 7B, Llama 3 8B, Qwen2 7B, CodeLlama 7B/13B (quantized), DeepSeek Coder 6.7B | 8-16 | 45-90 tok/s |
| RTX 4090 | 24 GB | Same as 3090 + stronger headroom for 13B/14B quantized (Phi-3 14B, JAIS-13B) | 12-24 | 70-130 tok/s |
| A100 40GB | 40 GB | 7B-14B at high throughput, 30B+ quantized classes, selected Mixtral configs | 16-32 | 120-220 tok/s |
| A100 80GB | 80 GB | Llama 3 70B (quantized), Qwen2 72B (quantized), Mixtral 8x7B, high-throughput 7B-34B | 24-48 | 160-300 tok/s |
| H100 80GB | 80 GB | Same as A100 80GB with higher throughput and lower latency for long-context serving | 32-64 | 260-500 tok/s |

## Quick Selection Rules

- Choose `RTX 3090/4090` for cost-efficient single-model serving in 7B-14B ranges.
- Choose `A100 80GB` when you need 70B-class models without multi-GPU complexity.
- Choose `H100 80GB` for premium latency SLAs, high concurrency, or heavy long-context traffic.
- For Arabic workloads at moderate cost, start with `JAIS-13B` on `RTX 4090`; scale to `Qwen2 72B` on `A100/H100` for quality-sensitive deployments.

## Deployment Notes for Providers

- Ensure recent NVIDIA drivers and CUDA runtime compatibility with vLLM container images.
- Keep VRAM reserve headroom for KV cache growth under long context windows.
- Use DCP daemon heartbeat metrics (`gpu_vram_mib`, utilization, temperature) to tune safe batch sizes.

