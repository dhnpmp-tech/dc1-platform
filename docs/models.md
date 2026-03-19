# DCP vLLM Model Catalog

This catalog helps renters pick models that fit provider GPUs on DCP. Values below are deployment guidance for vLLM (not hard platform limits).

## Supported Models

| Model | Parameters | Min VRAM | Recommended GPU | Context Length | Use Case |
|------|------:|------:|------|------|------|
| Llama 3 8B Instruct | 8B | 16 GB | RTX 3090 / RTX 4090 | 8K | General chat, copilots, Arabic+English customer support |
| Llama 3 70B Instruct | 70B | 80 GB (quantized) / 2x80 GB preferred | A100 80GB / H100 80GB | 8K | High-quality enterprise assistants, multi-step reasoning |
| Mistral 7B Instruct | 7B | 14 GB | RTX 3090 / RTX 4090 | 8K | Fast low-cost inference, summarization, support bots |
| Mixtral 8x7B Instruct | 46.7B MoE | 48 GB (quantized) / 80 GB preferred | A100 80GB / H100 80GB | 32K | Better quality than 7B class with good throughput |
| Phi-3 Mini Instruct | 3.8B | 8 GB | RTX 3090 / RTX 4090 | 4K | Ultra-low-cost inference, short-form Q&A |
| Phi-3 Medium Instruct | 14B | 24 GB (quantized) / 32 GB preferred | RTX 4090 / A100 40GB | 4K-8K | Better reasoning under tight budgets |
| Qwen2 7B Instruct | 7B | 16 GB | RTX 3090 / RTX 4090 | 32K | Long-context assistants, multilingual chat |
| Qwen2 72B Instruct | 72B | 80 GB (quantized) / multi-GPU preferred | A100 80GB / H100 80GB | 32K | Premium multilingual and enterprise-grade assistants |
| JAIS-13B Chat | 13B | 24 GB | RTX 4090 / A100 40GB | 4K | Arabic-first assistants and GCC enterprise text workloads |
| AceGPT (Arabic-optimized, 7B-13B class) | 7B-13B class | 16-24 GB | RTX 3090 / RTX 4090 | 4K-8K | Arabic generation, regional terminology handling |
| CodeLlama Instruct (7B/13B/34B) | 7B-34B | 16 GB (7B), 24 GB (13B), 48+ GB (34B quantized) | RTX 3090 / RTX 4090 / A100 | 16K | Code generation, refactoring, DevOps assistants |
| DeepSeek Coder Instruct (6.7B/33B) | 6.7B-33B | 14 GB (6.7B), 48+ GB (33B quantized) | RTX 3090 / RTX 4090 / A100 | 16K | Code-heavy workloads, test generation, repo Q&A |

## Arabic-Focused Notes

- Best Arabic quality in this catalog: `JAIS-13B`, `AceGPT`, and larger multilingual models (`Qwen2 72B`, `Llama 3 70B`) when budget allows.
- `JAIS-13B` is a strong default for Arabic enterprise chat on single-GPU high-end consumer cards (24 GB class).
- `AceGPT` is a practical low-latency Arabic option for customer-facing flows where cost and speed matter more than top-end reasoning.
- For Saudi enterprise use cases:
  - Regulated industries (finance/health/public sector): prefer `Llama 3 70B` or `Qwen2 72B` on A100/H100 tiers.
  - High-volume service desks: `Mistral 7B`, `Qwen2 7B`, or `Phi-3` classes provide best SAR efficiency.

## DCP Runtime Notes

- DCP currently supports `vllm_serve` jobs with OpenAI-compatible endpoints for inference.
- Internal billing is in `halala` (100 halala = 1 SAR).
- Default model token-rate rows exist in `cost_rates` for baseline billing (`__default__`, Mistral, Llama 3 8B, Phi-3, Gemma, TinyLlama).
- `POST /api/jobs/submit` now accepts both `params.model` and a top-level `model` field. DCP stores the selected model on the job row for routing/analytics.
- Job priority is an integer `0..10` (`10` highest, default `5`).
- Provider queue dispatch order is per provider: `priority DESC`, then `created_at ASC` (FIFO within same priority).
- Providers can fetch their next job using `GET /api/jobs/queue?key=PROVIDER_API_KEY` (or `x-provider-key` header). Response shape is `{ "job": { ... } }` or `{ "job": null }` when no job is ready.

## Currently Available (Marketplace API)

`GET /api/providers/models` returns the deduplicated model list for online providers. If a provider does not report explicit model metadata, DCP falls back to VRAM-tier mapping:

- 8 GB tier: `llama-3-8b`, `mistral-7b`, `phi-3-mini`
- 24 GB tier: `llama-3-70b-q4`, `codellama-34b`, `mixtral-8x7b`
- 40+ GB tier: `llama-3-70b`, `falcon-40b`, `yi-34b`
