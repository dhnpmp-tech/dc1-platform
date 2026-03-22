# DCP GPU Benchmark Baselines

This table provides baseline performance expectations for common GPUs on DCP. Values are representative reference points for model serving and image generation workloads.

Value score is calculated as:

`tokens_per_sar = (LLaMA-7B tokens/s) / (price SAR/hr)`

| GPU | VRAM | LLaMA-7B (tokens/s) | Stable Diffusion (img/s) | Price (SAR/hr) | Value score |
|-----|------|---------------------|--------------------------|----------------|-------------|
| RTX 3060 Ti | 8 GB | 22 | 1.8 | 3.50 | 6.29 tokens/SAR (High) |
| RTX 3090 | 24 GB | 45 | 3.2 | 7.50 | 6.00 tokens/SAR (High) |
| RTX 4090 | 24 GB | 85 | 5.1 | 12.00 | 7.08 tokens/SAR (Medium) |
| A100 40GB | 40 GB | 120 | 7.5 | 22.00 | 5.45 tokens/SAR (Medium) |
| H100 80GB | 80 GB | 280 | 15.0 | 38.00 | 7.37 tokens/SAR (Low, premium) |

## Notes

- These are baseline estimates, not hard guarantees.
- Real performance varies with batch size, precision mode, model quantization, cooling, and concurrent workload.
- For provider-specific benchmarks, query: `GET /api/providers/:id/benchmarks`.
