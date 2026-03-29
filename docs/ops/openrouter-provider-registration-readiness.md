# OpenRouter Provider Registration Readiness

Last updated: 2026-03-29 01:27 UTC
Owner: CTO (`DCP-82`)

## Goal
Provide the minimum technical package required to register DCP as an OpenRouter-compatible upstream provider.

## Public Endpoint Readiness
- Primary API shape: OpenAI-compatible `/v1/chat/completions` and `/v1/models`.
- Required transport: HTTPS endpoint with stable DNS (pending operator confirmation for final registration URL).
- Auth pattern: Bearer token API keys.

## Current Capability Snapshot
- Dynamic provider routing by model VRAM requirement.
- Direct provider endpoint proxy path with bounded failover retries.
- Queue-based fallback path for legacy/non-endpoint providers.
- Metering persistence fallback in `serve_sessions` (update-or-create path).
- Dynamic capacity report surfaced from provider heartbeat:
  - `queue_depth_by_model`
  - `active_inference_jobs`
  - `available_gpu_slots`
  - `estimated_wait_seconds`

## Model and Pricing Evidence
Model availability source:
- `model_registry` + provider online status via `/v1/models`.

Pricing baseline source:
- `cost_rates` token rates and per-job billing accounting in halala.
- Provider-side runtime pricing evidence from existing billing tables and `jobs` records.

## Reliability Evidence Package
The following are required before external registration submission:
1. Success-rate sample window for inference requests (24h/72h).
2. P50/P95/P99 latency by top served model IDs.
3. Error-rate breakout by cause class:
   - provider upstream failure
   - timeout
   - capacity unavailable
4. Capacity continuity evidence from heartbeat `capacity_report` fields.
5. QA signoff against checklist in `docs/ops/openrouter-qa-gate-checklist.md`.

## Operational Blockers
1. Control-plane issue creation path degradation:
   - `POST /api/companies/{companyId}/issues` currently returns HTTP 500 in Paperclip control plane.
   - Does not block runtime API functionality, but blocks formal child issue decomposition.
2. Final registration endpoint and operator-run rollback evidence still pending in task thread.

## Submission Checklist
- [ ] Stable provider URL confirmed.
- [ ] `/v1/models` and `/v1/chat/completions` smoke tests captured.
- [ ] Reliability metrics exported and attached.
- [ ] Pricing mapping reviewed for OpenRouter display.
- [ ] QA evidence posted and approved.
- [ ] CEO review posted in `DCP-82`.

## Immediate Next Steps
1. QA executes targeted regression on latest gap 1/3/4 changes.
2. CTO posts reliability metric extraction commands + first sample outputs.
3. CEO/board confirms registration submission timing and operator-side blocker status.
