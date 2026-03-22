# Viking Benchmark Methodology (Arabic/English/Multilingual)

Date: 2026-03-22 (UTC)
Owner: ML Infrastructure Engineer
Issue: DCP-552
Related: docs/architecture/open-viking-integration-spec.md

## 1) Goal
Define a repeatable benchmark protocol for Open Viking model variants on DCP so product, scheduler, and billing decisions are based on measured quality, latency, and cost.

This methodology is for inference-first rollout and covers:
- Arabic-first quality validation
- English and mixed-language robustness
- GPU-tier performance envelopes by quantization
- deployment admission and release gates

## 2) Test Matrix

## 2.1 Model Buckets Under Test
- `viking-lite-7b`
- `viking-mid-13b`
- `viking-pro-34b` (P1+)

## 2.2 Runtime Profiles
- INT4 (cost tier)
- INT8 (balanced tier)
- FP16/BF16 (premium tier, where VRAM allows)

## 2.3 Provider Classes
- `consumer_8_16gb`
- `prosumer_20_24gb`
- `datacenter_40_48gb`
- `datacenter_80gb_plus`

Required run dimensions per benchmark row:
- `model_id`
- `variant_bucket`
- `quantization`
- `provider_class`
- `gpu_name`
- `gpu_vram_gb`
- `tensor_parallel_size`
- `max_model_len`

## 3) Prompt Suite Design

Each suite run should include fixed prompts with deterministic IDs to support trend comparisons over time.

## 3.1 Arabic Task Set (A-series)
- `A1`: factual QA in Modern Standard Arabic (MSA)
- `A2`: Arabic summarization (news/business paragraph)
- `A3`: dialect handling check (Gulf + MSA paraphrase)
- `A4`: Arabic instruction-following with formatting constraints
- `A5`: Arabic safety refusal/redirect behavior

## 3.2 English Task Set (E-series)
- `E1`: factual QA
- `E2`: constrained summarization
- `E3`: structured extraction to JSON
- `E4`: tool-use style instruction following
- `E5`: safety refusal/redirect behavior

## 3.3 Multilingual Task Set (M-series)
- `M1`: Arabic prompt, English answer request
- `M2`: English prompt, Arabic answer request
- `M3`: code-mixed prompt with strict output language requirement
- `M4`: bilingual retrieval + concise synthesis
- `M5`: translation + preservation of named entities and numerals

Prompt governance:
- Keep prompts in versioned JSON files under `benchmarks/prompts/viking/*.json`.
- Do not include proprietary customer data.
- Keep prompt IDs stable; only add new IDs, never mutate existing semantics.

## 4) Execution Protocol

## 4.1 Run Steps
1. Preflight provider-model compatibility (`/api/providers/models/preflight`).
2. Launch serve endpoint (`/api/vllm/serve`) with explicit quantization and TP.
3. Wait until deployment state = `ready`.
4. Execute full prompt suite with fixed generation controls.
5. Collect quality + latency + cost signals.
6. Stop endpoint and persist benchmark artifact.

## 4.2 Controlled Generation Settings
Set and log these fields for every run:
- `temperature`
- `top_p`
- `max_tokens`
- `presence_penalty`
- `frequency_penalty`
- `seed` (when supported)

## 4.3 Repetition Policy
- Minimum 3 repetitions per prompt for latency/cost stability.
- Quality grading at least once per prompt; borderline outputs receive second reviewer pass.

## 5) Metrics and Scorecard

## 5.1 Quality Metrics
- `instruction_adherence_score` (0-5)
- `factuality_score` (0-5)
- `arabic_fluency_score` (0-5)
- `multilingual_consistency_score` (0-5)
- `safety_behavior_score` (0-5)

Composite quality score:
- `quality_weighted_score = 0.25*instruction + 0.2*factuality + 0.25*arabic + 0.2*multilingual + 0.1*safety`

## 5.2 Performance Metrics
- `ttft_ms_p50`, `ttft_ms_p95`
- `tokens_per_second_p50`, `tokens_per_second_p95`
- `end_to_end_latency_ms_p50`, `end_to_end_latency_ms_p95`
- `serve_warmup_seconds`
- `serve_failure_rate`

## 5.3 Cost/Billing Metrics
- `gpu_seconds_used`
- `gpu_count`
- `estimated_cost_halala`
- `provider_earn_halala`
- `dc1_fee_halala`

Cost normalization:
- Report `cost_per_1k_output_tokens_halala` to compare variants fairly.

## 5.4 Scorecard Output Schema
Persist one row per run in `docs/research/benchmarks/viking/<timestamp>.json`:

```json
{
  "run_id": "viking-20260322-1800Z-a100-40g-int8",
  "variant_bucket": "viking-mid-13b",
  "model_id": "<pinned-hf-id>",
  "quantization": "int8",
  "provider_class": "datacenter_40_48gb",
  "gpu": { "name": "NVIDIA A100", "vram_gb": 40, "count": 1 },
  "quality": {
    "instruction_adherence_score": 4.4,
    "factuality_score": 4.1,
    "arabic_fluency_score": 4.5,
    "multilingual_consistency_score": 4.2,
    "safety_behavior_score": 4.7,
    "quality_weighted_score": 4.36
  },
  "performance": {
    "ttft_ms_p50": 820,
    "ttft_ms_p95": 1450,
    "tokens_per_second_p50": 61,
    "tokens_per_second_p95": 45,
    "end_to_end_latency_ms_p50": 2310,
    "end_to_end_latency_ms_p95": 3980,
    "serve_warmup_seconds": 118,
    "serve_failure_rate": 0.0
  },
  "billing": {
    "gpu_seconds_used": 1920,
    "gpu_count": 1,
    "estimated_cost_halala": 1160,
    "provider_earn_halala": 870,
    "dc1_fee_halala": 290,
    "cost_per_1k_output_tokens_halala": 64
  },
  "status": "pass",
  "notes": []
}
```

## 6) Pass/Fail Gates by Rollout Phase

## Phase P0 (Weeks 0-2)
- `quality_weighted_score >= 3.8` on Arabic + multilingual suites
- `serve_failure_rate <= 5%`
- `ttft_ms_p50 <= 1500` for `viking-lite-7b` and `viking-mid-13b`
- No scheduler/billing schema mismatch for `gpu-uuid` resources

## Phase P1 (Weeks 3-4)
- `quality_weighted_score >= 4.1` for promoted production profile
- `serve_failure_rate <= 3%`
- No metering drift > 1% between execution logs and billing aggregates

## Phase P2 (Weeks 5-8, enterprise path)
- Multi-GPU TP runs stable with `serve_failure_rate <= 2%`
- Arabic safety behavior score >= 4.5 on enterprise policy prompts
- Incident rollback drill validated at least once per release cycle

## 7) Review Workflow

1. ML Infra runs benchmark harness and publishes raw JSON artifacts.
2. Applied AI reviewer grades a random quality sample (minimum 20%).
3. Backend owner validates metering and billing consistency.
4. Product owner signs off model tier promotion (Lite/Mid/Pro).

No tier promotion occurs without all four approvals.

## 8) Deliverables and Ownership
- Methodology doc: `docs/research/viking-benchmark-methodology.md`
- Prompt suites: `benchmarks/prompts/viking/` (implementation phase)
- Run artifacts: `docs/research/benchmarks/viking/`
- Dashboard scorecard view: follow-up issue under ML infra + backend

## 9) Non-Goals
- No public pricing claims from benchmark outputs.
- No benchmark use of customer production prompts.
- No bare-metal positioning; tests target containerized NVIDIA runtime only.
