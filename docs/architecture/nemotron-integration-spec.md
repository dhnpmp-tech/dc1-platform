# Nemotron Integration Spec + Container Template Matrix

Date: 2026-03-22 (UTC)
Owner: ML Infrastructure Engineer
Issue: DCP-551

## 1) Scope

This spec defines how DCP should integrate NVIDIA Nemotron models into the existing marketplace stack:
- Model catalog entries (`model_registry`, `/api/models`, `/api/vllm/models`)
- Runtime container templates for `vllm_serve`
- Provider capability matching with `resource_spec` (`cpu`, `ram`, `disk`, `gpu_uuid`)
- Endpoint and daemon impacts for inference-first rollout, with fine-tune compatibility guidance

## 2) Current Nemotron Family Snapshot (for DCP planning)

Data points were taken from NVIDIA/Hugging Face model cards and the Nemotron technical reports available as of 2026-03-22.

### A. Legacy frontier family (Nemotron-4)
- Family: `Nemotron-4` (Base/Instruct/Reward)
- Representative model: `nvidia/Nemotron-4-340B-Instruct`
- DCP stance: not a launch target for decentralized single-provider serving due extreme memory/parallelism requirements.
- Use in DCP: optional future enterprise managed pool only.

### B. Llama-Nemotron aligned family
- Family: `Llama-3.1/3.3 Nemotron` (Nano/Super/Ultra variants)
- Representative models:
  - `nvidia/Llama-3.1-Nemotron-70B-Instruct-HF`
  - `nvidia/Llama-3_1-Nemotron-Ultra-253B-v1`
  - `nvidia/Llama-3_3-Nemotron-Super-49B-v1_5`
- Practical inference note:
  - 70B class is realistic for high-VRAM providers (A100/H100-class)
  - 253B Ultra class requires multi-GPU tensor parallel and should be treated as enterprise only

### C. Nemotron-3 (MoE hybrid) family
- Family: `NVIDIA Nemotron-3` (Nano/Super/Ultra)
- Representative models:
  - `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16`
  - `nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4`
- Practical inference note:
  - Nano/Super variants are strong candidates for DCP production depending on quantization and TP strategy
  - Super/Ultra should be gated behind multi-GPU capability and stricter admission checks

## 3) DCP Catalog Proposal (Phaseable)

## Tier P0 (2-week target): single-GPU viable entries

| model_id | family | min_gpu_vram_gb (DCP schedule floor) | default_price_halala_per_min | notes |
|---|---|---:|---:|---|
| `nvidia/Llama-3.1-Nemotron-70B-Instruct-HF` | llama_nemotron | 48 | 40 | high-quality instruct baseline for premium pools |
| `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16` | nemotron3 | 24 | 24 | supports long-context + reasoning workflow |
| `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8` | nemotron3 | 16 | 20 | lower VRAM admission path |

## Tier P1 (4-week target): multi-GPU premium entries

| model_id | family | min_gpu_vram_gb | default_price_halala_per_min | notes |
|---|---|---:|---:|---|
| `nvidia/Llama-3_3-Nemotron-Super-49B-v1_5` | llama_nemotron | 48 | 42 | high-throughput production candidate |
| `nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4` | nemotron3 | 80 | 90 | require TP>=2 and strict scheduling |

## Tier P2 (8-week target): enterprise-only entries

| model_id | family | min_gpu_vram_gb | default_price_halala_per_min | notes |
|---|---|---:|---:|---|
| `nvidia/Llama-3_1-Nemotron-Ultra-253B-v1` | llama_nemotron | 160 | 180 | TP>=4/8; enterprise SLA only |
| `nvidia/Nemotron-4-340B-Instruct` | nemotron4 | 240 | 260 | managed cluster only; not open marketplace |

Pricing is intentionally relative and policy-safe; these are internal default seeds to preserve router behavior and avoid hardcoded public claims.

## 4) Inference + Fine-Tune Compatibility Guidance

## Inference support (vLLM)
- First-class: Nemotron models with stable vLLM serving path and standard OpenAI-compatible chat completion behavior.
- Endpoint surface (existing, keep stable):
  - `GET /api/vllm/models`
  - `POST /api/vllm/complete`
  - `POST /api/vllm/complete/stream`
  - `POST /api/jobs/submit` with `job_type="vllm_serve"`

## Fine-tune support guidance
- Phase P0/P1: no in-place marketplace fine-tune for Nemotron; inference-only public exposure.
- Allow only controlled `custom_container` fine-tune jobs for approved enterprise providers with:
  - explicit dataset compliance checks
  - bounded GPU-hour budget
  - adapter-output artifact policy (LoRA/QLoRA preferred)
- Add capability flag in catalog payload:
  - `fine_tune_support: "none" | "adapter_only" | "full"`

Recommended initial values:
- Llama-Nemotron 70B + Nemotron-3 Nano: `adapter_only`
- Super/Ultra and Nemotron-4: `none` (until dedicated cluster path exists)

## 5) Container Template Matrix

These templates extend current `vllm_serve` patterns and remain compatible with daemon-side Docker isolation.

| template_id | target_models | image | suggested launch flags | scheduler profile |
|---|---|---|---|---|
| `nemotron-nano-single-gpu` | Nemotron-3 Nano 30B FP8/BF16 | `vllm/vllm-openai:latest` | `--tensor-parallel-size 1 --max-model-len 131072 --gpu-memory-utilization 0.92` | single_gpu_highmem |
| `nemotron-70b-premium` | Llama-3.1 Nemotron 70B | `vllm/vllm-openai:latest` | `--tensor-parallel-size 1 --max-model-len 32768 --gpu-memory-utilization 0.95` | single_gpu_premium |
| `nemotron-super-multigpu` | Llama-3.3 Super 49B / Nemotron-3 Super | `vllm/vllm-openai:latest` | `--tensor-parallel-size 2 --max-model-len 65536 --gpu-memory-utilization 0.95` | multi_gpu_required |
| `nemotron-ultra-enterprise` | Llama-3.1 Ultra 253B | `vllm/vllm-openai:latest` | `--tensor-parallel-size 4|8 --max-model-len 32768 --gpu-memory-utilization 0.95` | enterprise_cluster_only |

Runtime constraints (carry from current daemon hardening):
- Keep `HostConfig.DeviceRequests` for NVIDIA only
- Keep `cap_drop`, `pids_limit`, `tmpfs`, `memory`, `cpu` limits
- Keep explicit health probe before endpoint-ready callback

## 6) Backend/Daemon Implementation Notes

## Backend changes

1. `backend/src/db.js`
- Seed Nemotron entries into `model_registry` with:
  - `family`: `nemotron3 | llama_nemotron | nemotron4`
  - `min_gpu_vram_gb`
  - `default_price_halala_per_min`
  - `use_cases` including `chat`, `reasoning`, `agentic`, `long_context`

2. `backend/src/routes/models.js`
- Extend payload with optional runtime hints:
  - `recommended_tensor_parallel_size`
  - `recommended_dtype`
  - `fine_tune_support`
- Preserve backward compatibility for existing fields.

3. `backend/src/routes/vllm.js`
- Add Nemotron-aware guardrails:
  - reject serve requests when provider TP capability < model requirement
  - include explicit diagnostic payload (`required_tp`, `required_vram_gb`, `capable_providers`)

4. `backend/src/routes/providers.js`
- In `/api/providers/models`, include Nemotron family labels and per-model scheduling class hints for marketplace ranking.

## Daemon/runtime changes

1. `backend/installers/dc1_daemon.py` (and parity file `dc1-daemon.py`)
- Extend `build_resource_spec()` compute environment tags:
  - `tp_capable:1|2|4|8`
  - `vllm_nemotron:true` for compatible hosts
- Enforce per-template resource ceilings in container start path.

2. GPU matching
- Use existing `gpu_uuid` advertisement from `resource_spec.resources[].id` for deterministic multi-GPU pinning.
- For TP>1 templates, reserve multiple GPU UUIDs and reject fragmented assignments.

3. Billing meter alignment
- Track `gpu_seconds_used` by GPU count (already present in `job_executions`) and multiply by TP width for Nemotron multi-GPU sessions.

## 7) Phased Rollout (2w / 4w / 8w)

## Weeks 0-2 (P0)
- Add 2-3 Nemotron catalog entries (single-GPU practical set)
- Add one new template: `nemotron-nano-single-gpu`
- Enable inference via existing vLLM endpoints only
- Ship guardrails + diagnostics in `vllm.js`

Exit criteria:
- 0 schema-breaking API changes
- successful `vllm_serve` runs on at least 2 provider GPU classes
- no unbounded queue growth for Nemotron-tagged jobs

## Weeks 3-4 (P1)
- Add `nemotron-70b-premium` and `nemotron-super-multigpu`
- Add TP capability checks and scheduler profile routing
- Add provider marketplace labeling for premium Nemotron capacity

Exit criteria:
- multi-GPU serve success >= 95% in smoke window
- endpoint-ready latency SLO captured per model tier

## Weeks 5-8 (P2)
- Introduce enterprise-only Ultra/Nemotron-4 gated catalog entries
- Add adapter fine-tune pilot path (`custom_container`, allowlisted only)
- Add admin observability cards for Nemotron queue depth, TP failures, cold-start outliers

Exit criteria:
- enterprise pilot stability with no billing drift
- incident rollback path validated for TP/multi-GPU failures

## 8) Acceptance Checklist

- [ ] `docs/architecture/nemotron-integration-spec.md` exists with model-family research and practical deployment guidance
- [ ] Includes DCP model-catalog seed plan with phased tiers
- [ ] Includes endpoint surface and fine-tune compatibility guidance
- [ ] Includes container template matrix with launch flags and scheduler profiles
- [ ] Includes backend route + daemon/runtime file-level implementation notes
- [ ] Includes explicit 2w/4w/8w rollout with measurable exit criteria

## 9) Explicit Non-Goals

- No immediate change to public pricing pages
- No claim of bare-metal serving
- No default enablement of Ultra/Nemotron-4 in open marketplace pool
- No new payment/payout coupling in this spec
