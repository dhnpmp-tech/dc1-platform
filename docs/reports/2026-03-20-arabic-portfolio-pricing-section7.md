# Section 7 — Arabic Portfolio Pricing Recommendations (Tier A / Tier B)

**Date:** 2026-03-20
**Owner:** Budget Analyst (DCP-376)
**Scope:** Model-by-model launch pricing recommendations for Arabic portfolio models with cost basis and margin rationale.
**Currency:** SAR (1 SAR = 100 halala)

---

## 1. Inputs and Constraints

### Pricing Inputs Used
- `docs/pricing-guide.md`:
  - GPU launch promo anchors (SAR/hr): RTX 3090 = 10, RTX 4090 = 14, A100 40GB = 28, A100 80GB = 45, H100 80GB = 80.
  - Platform split: Provider 75% / DCP 25%.
- `docs/gpu-matrix.md`:
  - Benchmark throughput bands (planning):
    - RTX 3090: 45-90 tok/s (7B-8B)
    - RTX 4090: 70-130 tok/s (7B-8B)
    - A100 80GB: 160-300 tok/s (7B-8B class)
    - H100 80GB: 260-500 tok/s (7B-8B class)
- `docs/models.md`:
  - Arabic-relevant catalog and GPU fit (JAIS-13B, AceGPT, Qwen2, Llama 3 family).
- `AGENT_LOG.md` (2026-03-20 17:34 UTC strategic brief):
  - Tier strategy: Tier A prewarmed launch-critical, Tier B add-on/on-demand.
  - Cold-start SLO targets for serverless readiness (`p50 < 8s`, `p95 < 20s`).

### Operational Constraints Used in Pricing
1. Tier A models are prewarmed and must absorb idle reservation cost.
2. Tier B models are mostly on-demand and tolerate cold-start.
3. Provider pricing must remain above launch promo floors to keep supply online.
4. DCP fee remains fixed at 25% (no model-specific fee changes).

---

## 2. Pricing Method

For each model, recommended renter price is set by:

`Recommended SAR/hr = GPU promo anchor × model complexity factor × ops factor`

Where:
- **Model complexity factor** accounts for model size/context pressure versus baseline 7B-8B serving.
- **Ops factor**:
  - Tier A prewarmed: `1.10` to `1.20`
  - Tier B on-demand/add-on: `1.15` to `1.35`

Then platform split is applied:
- `Provider payout/hr = 75% × Recommended SAR/hr`
- `DCP take/hr = 25% × Recommended SAR/hr`

---

## 3. Tier A (Launch-Critical, Prewarmed)

| Model | GPU Anchor | Cost Basis (SAR/hr) | Recommended Price (SAR/hr) | Provider 75% | DCP 25% | Margin Rationale |
|------|------|------:|------:|------:|------:|------|
| Qwen2 7B Instruct | RTX 3090/4090 | 11.0-12.5 | **12** | 9.00 | 3.00 | Core bilingual traffic model; keep near floor to maximize adoption and utilization. |
| Llama 3 8B Instruct | RTX 3090/4090 | 11.0-12.5 | **12** | 9.00 | 3.00 | Similar perf/cost class to Qwen2 7B; price parity simplifies catalog decisions. |
| Falcon Arabic/H1 Arabic (7B-11B class) | RTX 4090 | 12.5-13.5 | **13** | 9.75 | 3.25 | Arabic-first premium over generic 7B, but still positioned as mainstream tier-A option. |
| JAIS-13B Chat | RTX 4090 / A100 40 | 14.5-16.0 | **16** | 12.00 | 4.00 | Best Arabic enterprise default in current catalog; priced above 8B due to memory/headroom pressure. |
| AceGPT (7B-13B Arabic) | RTX 4090 | 13.5-15.0 | **15** | 11.25 | 3.75 | Arabic-specialized quality with strong latency profile; priced between 8B and JAIS-13B. |
| Qwen Coder (7B-14B serving class) | RTX 4090 | 15.5-18.0 | **18** | 13.50 | 4.50 | Coding workloads carry higher willingness-to-pay and longer completion traces. |

### Tier A Recommendation Summary
- Keep Tier A band tight (`12-18 SAR/hr`) to reduce choice friction.
- Default prewarmed routing order for Arabic chat: `JAIS-13B` -> `Qwen2 7B` -> `Llama 3 8B`.
- If utilization drops below 50%, first cut 8B models from 12 to 11 SAR/hr before touching JAIS.

---

## 4. Tier B (High-Value Add-ons, Mostly On-Demand)

| Model | GPU Anchor | Cost Basis (SAR/hr) | Recommended Price (SAR/hr) | Provider 75% | DCP 25% | Margin Rationale |
|------|------|------:|------:|------:|------:|------|
| Qwen2 72B Instruct | A100 80 / H100 80 | 52-58 | **58** | 43.50 | 14.50 | Premium multilingual/Arabic quality tier; lower utilization and larger VRAM reservation risk. |
| Llama 3 70B Instruct | A100 80 / H100 80 | 50-56 | **56** | 42.00 | 14.00 | Enterprise reasoning tier; slightly below Qwen2 72B to maintain competitive laddering. |
| Arabic Embeddings API (high-throughput) | RTX 3090 | 8-9 | **9** | 6.75 | 2.25 | Volume product with low per-request latency; priced for high call frequency and sticky usage. |
| Arabic Reranker (7B class) | RTX 4090 | 12-14 | **14** | 10.50 | 3.50 | RAG quality add-on; moderate compute intensity, sold with embedding bundle. |
| Arabic ASR (Whisper-large class) | RTX 4090 | 11-13 | **13** | 9.75 | 3.25 | Speech transcription demand is bursty; on-demand premium offsets idle windows. |
| Arabic TTS (neural) | RTX 3090/4090 | 9-11 | **11** | 8.25 | 2.75 | Lower compute than ASR but requires low-latency response guarantees in production flows. |
| Arabic prompt image generation (SDXL-class) | RTX 4090 / A100 40 | 16-20 | **20** | 15.00 | 5.00 | Image generation is memory-heavy and bursty; price must absorb cold-start and queue volatility. |

### Tier B Recommendation Summary
- Keep Tier B as opt-in/on-demand catalog by default; do not prewarm all SKUs.
- Trigger prewarm only when 7-day utilization per model exceeds 60%.
- Use bundle pricing (`Embeddings + Reranker`) to improve blended margin and reduce churn.

---

## 5. Portfolio Economics Check

### Weighted Gross Margin (DCP share)
Because platform fee is fixed, DCP gross margin is 25% on every model by design.

### Weighted Revenue Mix Target (first 90 days)
- Tier A volume share target: `70%`
- Tier B volume share target: `30%`
- Portfolio weighted average recommended price (planning mix):
  - Tier A midpoint: ~14.3 SAR/hr
  - Tier B midpoint: ~25.9 SAR/hr
  - Weighted portfolio midpoint: ~17.8 SAR/hr

At 17.8 SAR/hr blended:
- Provider earns: 13.35 SAR/hr
- DCP earns: 4.45 SAR/hr

This is above the standard 9 SAR/hr financial model baseline in `docs/financial-model.md`, improving break-even speed if utilization targets are met.

---

## 6. Launch Guardrails

1. Keep Tier A prices fixed for first 30 days; optimize via utilization, not daily repricing.
2. Enforce cold-start SLOs before expanding Tier A prewarmed set.
3. If queue wait exceeds SLA, temporarily increase Tier B rate by 10% to suppress overload and protect latency-sensitive tenants.
4. Re-price monthly using actual realized tok/s and queue wait metrics from production telemetry.

---

## 7. Final Recommendation (Go-Live)

- **Tier A go-live prices (SAR/hr):** `12, 12, 13, 16, 15, 18`
- **Tier B go-live prices (SAR/hr):** `58, 56, 9, 14, 13, 11, 20`

These rates preserve provider incentives, keep DCP fee economics intact (25%), align with current GPU benchmark ranges, and reflect prewarm/on-demand operational constraints for the Arabic portfolio.

---

## Sources
- `docs/pricing-guide.md`
- `docs/gpu-matrix.md`
- `docs/models.md`
- `docs/financial-model.md`
- `AGENT_LOG.md` (Strategic Brief entry at 2026-03-20 17:34 UTC)
