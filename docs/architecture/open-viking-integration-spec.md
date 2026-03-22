# Open Viking Integration Spec (Multilingual + One-Click Deploy)

Date: 2026-03-22 (UTC)
Owner: ML Infrastructure Engineer
Issue: DCP-552

## 1) Objective
Define how DCP should support open Viking-family models for Arabic/English/multilingual workloads across:
- Model catalog + scheduler compatibility
- GPU class and quantization guidance
- One-click deployment path (API and UX)
- Operational constraints for daemon/runtime safety

V1 scope is inference-first. Fine-tuning is controlled and enterprise-gated.

## 2) Viking Model Variant Inventory (Planning Snapshot)

Open Viking naming is fragmented across community releases and forks. DCP should treat the following as canonical intake buckets, then pin exact model IDs during implementation.

| Variant Bucket | Typical Size Class | Primary Use | Arabic/Multilingual Fit | DCP Launch Tier |
|---|---:|---|---|---|
| `viking-lite-7b` | 7B-8B | low-latency chat + retrieval helpers | good with multilingual prompting + system constraints | P0 |
| `viking-mid-13b` | 13B-14B | stronger reasoning and instruction adherence | strong candidate for Arabic/English mixed tasks | P0 |
| `viking-pro-34b` | 30B-34B | premium quality generation and tool-use | strong, but needs high-VRAM routing | P1 |
| `viking-moe-large` | 70B+ / MoE | enterprise high-quality tier | promising, requires multi-GPU and strict admission | P2 |

Implementation note:
- Before enabling any bucket publicly, require model card validation for license, tokenizer behavior, context limits, and commercial-use restrictions.
- Persist exact finalized HF model IDs in `model_registry` only after verification.

## 3) Provider Class + Quantization Guidance

## 3.1 Provider Classes
| Provider Class | Representative GPU Capacity | Recommended Viking Tier |
|---|---|---|
| `consumer_8_16gb` | RTX 3060/4060/4070 class | `viking-lite-7b` INT4/INT8 |
| `prosumer_20_24gb` | RTX 4090 / A5000 class | `viking-lite-7b`, `viking-mid-13b` INT4/INT8 |
| `datacenter_40_48gb` | A100-40G / A6000 / L40S class | `viking-mid-13b` FP16/INT8, `viking-pro-34b` INT4 |
| `datacenter_80gb_plus` | A100-80G / H100 class | `viking-pro-34b` FP16/INT8, multi-GPU prep |
| `multi_gpu_cluster` | 2x+ datacenter GPUs | `viking-moe-large` (TP/PP required) |

## 3.2 Quantization Policy
| Quantization | Use Case | Quality/Latency Tradeoff | Recommended Entry Path |
|---|---|---|---|
| INT4 | low VRAM admission | best cost efficiency, more quality drop on complex Arabic reasoning | P0 consumer classes |
| INT8 | balanced production default | stronger quality stability with moderate VRAM | P0/P1 default |
| FP16/BF16 | premium quality | highest VRAM cost, best generation consistency | P1/P2 premium pools |

Guardrail:
- Scheduler must reject runtime configs where `required_vram_gb > available_vram_gb * 0.92`.

## 4) One-Click Deploy Design (API + UX)

## 4.1 API Surface

### A) Catalog discovery
- `GET /api/models`
- Add fields for Viking entries:
  - `family: "viking"`
  - `variant_bucket`
  - `supported_locales: ["ar", "en", "multilingual"]`
  - `recommended_quantizations`
  - `min_gpu_vram_gb`
  - `recommended_tp`

### B) Provider capability preflight
- `POST /api/providers/models/preflight`
- Input: provider key + desired model + quantization
- Output: compatible/incompatible + explicit reasons (`insufficient_vram`, `missing_cuda_capability`, `tp_requirement_unmet`)

### C) One-click serve launch
- `POST /api/vllm/serve`
- Input:
```json
{
  "model": "<finalized-viking-model-id>",
  "quantization": "int8",
  "tensor_parallel_size": 1,
  "max_model_len": 8192,
  "provider_selection": "auto"
}
```
- Output: deployment id + endpoint status URL + fallback troubleshooting hints.

### D) Status + stop
- `GET /api/vllm/serve/:deploymentId`
- `POST /api/vllm/serve/:deploymentId/stop`

All errors must follow `{ "error": "descriptive message" }`.

## 4.2 UX Touchpoints

1. Renter/enterprise model picker:
- Add “Viking (Arabic + Multilingual)” family badge in model cards.
- Show quality tiers (Lite/Mid/Pro) and required provider class.

2. One-click wizard:
- Step 1: choose variant bucket
- Step 2: choose quality mode (`cost`, `balanced`, `premium`)
- Step 3: launch + status stream (`allocating`, `pulling`, `warming`, `ready`)

3. Failure UX:
- Show deterministic remediation (choose lower tier, lower max context, or higher VRAM class).
- Never show stack traces to end users.

## 5) Runtime/Daemon Integration

Files in scope:
- `backend/installers/dc1_daemon.py`
- `backend/src/routes/vllm.js`
- `backend/src/routes/providers.js`
- `backend/src/routes/models.js`
- `backend/src/services/gpu-scheduler.js`

Required behavior:
1. Resource schema parity:
- Ensure Viking deployments use `resource_spec.resources` with `cpu`, `ram`, `disk`, `gpu-uuid`.
- For TP>1, reserve a deterministic set of `gpu-uuid` values.

2. GPU detection and fit:
- Daemon advertises per-GPU VRAM, CUDA capability, and availability.
- Scheduler matches quantization profile to provider class and rejects fragmented TP assignments.

3. Docker launch safety:
- Keep NVIDIA `DeviceRequests` pass-through only.
- Enforce CPU/RAM/disk quotas and timeout ceilings.
- Require health probe success before endpoint marked `ready`.

4. Metering:
- Bill by GPU-minute using active GPU count × session duration.
- Persist metering dimensions for audit (`deploymentId`, `gpu_count`, `gpu_seconds_used`, `quantization`).

## 6) Phased Rollout

## Weeks 0-2 (P0)
- Publish `viking-lite-7b` and `viking-mid-13b` catalog entries.
- Enable one-click serve for INT4/INT8 single-GPU classes.
- Ship preflight endpoint + user-safe failure reasons.

Exit criteria:
- No schema-breaking API changes.
- Successful serve launch on at least 2 provider classes.
- P50 warm-start under target threshold set by benchmark baseline.

## Weeks 3-4 (P1)
- Add `viking-pro-34b` tier with premium provider routing.
- Add TP-aware scheduler path for eligible providers.
- Add provider ranking hint for Viking readiness.

Exit criteria:
- Serve success >= 95% on eligible providers.
- No metering drift in billing audits.

## Weeks 5-8 (P2)
- Add enterprise-gated `viking-moe-large` path.
- Multi-GPU launch templates + stricter admission controls.
- Admin observability cards for Viking queue pressure and launch failures.

Exit criteria:
- Stable multi-GPU deploy path with rollback tested.
- Reliability score impact remains within alert budget.

## 7) Acceptance Checklist
- [ ] `docs/architecture/open-viking-integration-spec.md` includes Viking variant inventory and rollout tiers.
- [ ] Includes GPU compatibility matrix by provider class.
- [ ] Includes quantization guidance and scheduler guardrails.
- [ ] Includes one-click deploy API + UX design.
- [ ] Includes daemon/runtime resource-spec alignment notes.
- [ ] Includes 2w/4w/8w phased implementation plan.

## 8) Non-Goals
- No public pricing promises or fixed public rate cards.
- No bare-metal claims; runtime remains containerized with NVIDIA toolkit.
- No automatic dynamic pricing writes in this phase.
