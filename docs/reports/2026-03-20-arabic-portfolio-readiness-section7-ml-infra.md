# Section 7 — Arabic Portfolio Serving and Benchmark Readiness (ML Infrastructure)

**Date:** 2026-03-20  
**Owner:** ML Infrastructure Engineer (DCP-374)  
**Scope:** Tier A/Tier B serving readiness for Arabic portfolio launch with container templates, benchmark execution tooling, and model card source data.

## Deliverables Completed

1. Tier metadata and launch targets added to `infra/config/arabic-portfolio.json`:
- `launch_priority`
- `benchmark_profile` (`quick|standard|full`)
- `target_p95_ms`
- `target_cold_start_ms`

2. Backend readiness and model-card source enhancements:
- `GET /api/models/portfolio-readiness` (new)
- `GET /api/models/benchmarks` enriched with tier/readiness metadata
- `GET /api/models/cards` enriched with tier/prewarm/container/readiness metadata
- `GET /api/models` now includes tier and prewarm class fields

3. Tier A/B model registry + benchmark profile seed expansion:
- Tier A: `ALLaM-AI/ALLaM-7B-Instruct-preview`, `tiiuae/Falcon-H1-7B-Instruct`, `Qwen/Qwen2-7B-Instruct`, `meta-llama/Meta-Llama-3-8B-Instruct`
- Tier B: `inceptionai/jais-13b-chat`, `BAAI/bge-m3`, `BAAI/bge-reranker-v2-m3`, `stabilityai/stable-diffusion-xl-base-1.0`

4. Benchmark batch-run utility for ops:
- Script: `backend/src/scripts/run-portfolio-benchmarks.js`
- Supports dry-run and commit mode for `tier_a`, `tier_b`, or `all`
- Writes benchmark rows to `benchmark_runs` with model annotations in `notes`

5. New deploy templates for Tier B retrieval workloads:
- `docker-templates/arabic-embeddings.json`
- `docker-templates/arabic-reranker.json`

## Tier A Launch Focus

Tier A models are marked as prewarm-critical (`prewarm_class=hot`) and prioritized by ascending `launch_priority` in readiness outputs.  
Operational go-live should require `readiness.launch_ready=true` for Tier A entries before opening default serverless routing.

## Validation Commands

```bash
# Model card source feed (EN/AR + readiness)
curl -s http://127.0.0.1:8083/api/models/cards

# Benchmark source feed (with tier metadata)
curl -s http://127.0.0.1:8083/api/models/benchmarks

# Tier-grouped launch readiness
curl -s http://127.0.0.1:8083/api/models/portfolio-readiness

# Benchmark run staging (dry-run)
node backend/src/scripts/run-portfolio-benchmarks.js --provider-id 1 --tier tier_a
```

## Operational Notes

- `target_p95_ms` and `target_cold_start_ms` are launch thresholds used for readiness gating.
- Embedding/reranker models intentionally use non-MMLU metrics; Arabic quality fields may be zero when not applicable.
- Section 7 outputs are intentionally additive and backward-compatible with existing `/api/models*` consumers.
