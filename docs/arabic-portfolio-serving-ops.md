# Arabic Portfolio Containers and Serving Ops Runbook

This runbook defines how DCP packages, prewarms, deploys, and operates launch-critical Arabic and bilingual model tiers.

## Scope

- Container runtime for model serving (`vllm-serve` and compatible workers)
- Arabic model portfolio tier definitions
- Prewarm policy alignment (`hot`, `warm`, `cold`)
- Deployment and rollback checks for launch readiness

## Portfolio Source of Truth

- File: `infra/config/arabic-portfolio.json`
- Tiers:
  - `tier_a` (launch-critical): prewarm class `hot`
  - `tier_b` (high-value add-ons): prewarm class `warm`
  - `tier_c` (on-demand frontier): prewarm class `cold`

Each model entry carries:
- `id`: internal model handle for ops logging
- `repo`: Hugging Face repository pulled into cache
- `prewarm_class`: `hot|warm|cold`
- `container_profile`: serving profile (`vllm`, `embedding`, `diffusion`)
- `min_vram_gb`: scheduling floor
- `launch_priority`: lower number means earlier launch slot for prewarm windows
- `benchmark_profile`: recommended benchmark run depth (`quick|standard|full`)
- `target_p95_ms` and `target_cold_start_ms`: launch readiness targets

## Prewarm Execution

Command:

```bash
./infra/docker/prefetch-models.sh
```

Key environment controls:

- `DCP_ARABIC_PORTFOLIO_FILE` (default: `infra/config/arabic-portfolio.json`)
- `DCP_PREWARM_TIER` (`tier_a`, `tier_b`, `tier_c`, or `all`; default: `tier_a`)
- `DCP_PREWARM_POLICY` (`hot-only`, `hot-warm`, `all`; default: `hot-warm`)
- `DCP_CACHE_HIGH_WATERMARK_PCT` (default: `90`)
- `DCP_MODEL_CACHE_ROOT` (default: `/opt/dcp/model-cache`)
- `DCP_MODEL_CACHE_VOLUME` (default: `dcp-model-cache`)
- `HF_TOKEN` for gated/private model pulls

Behavior:

- Reads model list from the portfolio file.
- Prefetches only models allowed by `DCP_PREWARM_POLICY`.
- Under disk pressure (`usage >= high watermark`), prefetches only `hot` models.
- Falls back to legacy two-model prefetch only if portfolio parsing fails.

## Deployment Procedure (Repeatable)

1. Ensure cache volume exists:
   - `./infra/setup-model-cache.sh`
2. Pull launch-critical models:
   - `DCP_PREWARM_TIER=tier_a DCP_PREWARM_POLICY=hot-only ./infra/docker/prefetch-models.sh`
3. Pull warm models (off-peak):
   - `DCP_PREWARM_TIER=tier_b DCP_PREWARM_POLICY=hot-warm ./infra/docker/prefetch-models.sh`
4. Validate serving templates:
   - `GET /api/templates`
   - `GET /api/templates/whitelist`
5. Smoke test vLLM endpoint readiness path:
   - submit `vllm_serve` job
   - verify `/api/jobs/:id/endpoint-ready` callback path
6. Validate portfolio readiness feed:
   - `GET /api/models/portfolio-readiness`
   - confirm `tiers.tier_a[*].readiness.launch_ready` for launch-priority models

## Section 7 Benchmark Batch Runs

Use this helper to generate or insert benchmark run rows for a provider against Tier A/Tier B portfolio groups:

```bash
# Dry run (no DB writes)
node backend/src/scripts/run-portfolio-benchmarks.js --provider-id 1 --tier tier_a

# Commit benchmark rows
node backend/src/scripts/run-portfolio-benchmarks.js --provider-id 1 --tier tier_a --commit
```

Notes:
- `--tier` supports `tier_a`, `tier_b`, or `all`.
- Benchmark type is selected from `benchmark_profile` in `infra/config/arabic-portfolio.json`.
- Each inserted row is tagged in `benchmark_runs.notes` with `section7 portfolio benchmark model=...`.

## Rollback and Safety

- If prewarm causes storage pressure:
  - Raise `DCP_PREWARM_POLICY=hot-only`
  - Re-run prefetch for `tier_a` only
- If a model pull repeatedly fails:
  - Remove or replace the model entry in `infra/config/arabic-portfolio.json`
  - Re-run prefetch and confirm successful completion log
- Keep prewarm and serving changes separate from billing/auth changes for easier rollback isolation.

## Operational SLO Alignment

Target operational posture for launch:

- `tier_a` models prewarmed before traffic windows
- cold-start percentiles tracked from provider telemetry (`cold_start_p50_ms`, `cold_start_p95_ms`)
- cache usage stays below high-watermark threshold during peak windows
- Tier A launch-priority models (`launch_priority` ascending) marked `launch_ready=true` in `/api/models/portfolio-readiness`

This runbook is the DevOps contract for Section 7 launch readiness and should be updated with each portfolio tier revision.
