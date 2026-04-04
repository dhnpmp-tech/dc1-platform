# First-Live Inference Proof Report

- generated_at: `2026-04-03T18:18:31.487Z`
- verdict: **FAIL**
- base_url: `https://api.dcp.sa`
- model: `ALLaM-AI/ALLaM-7B-Instruct-preview`
- smoke_principal: renter_id=`1774351995125` key_hint=`dc1-sk-b...e82a`
- transcript_command: `node tests/first-live-inference-proof-package.js`

## Probe Summary

| step | status | elapsed_ms | request_id | notes |
|---|---:|---:|---|---|
| health | 200 | 2 |  |  |
| models | 200 | 2 |  |  |
| providers_available | 200 | 6 |  |  |
| provider_liveness | null |  |  | no model-matched provider in /api/providers/available |
| completion_json | 503 | 2 |  | No inference providers available for this model |
| completion_stream | 503 | 3 |  | No inference providers available for this model |

## Provider Route Evidence

- completion_json.provider_id: ``
- completion_json.provider_tier: ``
- completion_json.provider_endpoint_host: ``
- completion_stream.provider_id: ``
- completion_stream.provider_tier: ``
- completion_stream.provider_endpoint_host: ``
- providers_available.total: `1`
- providers_available.live: `1`
- providers_available.model_matched_provider_id: ``
- provider_liveness.last_heartbeat: ``
- provider_liveness.heartbeat_age_seconds: ``

## Failure Classification

- code: `provider_unreachable_or_unavailable`
- severity: `blocking`
- action: Verify provider heartbeat, reachable vLLM endpoint URL, and model is loaded on at least one online provider.

## Artifacts

- json: `docs/reports/reliability/dcp-475-proof/first-live-inference-proof-20260403T181831Z.json`
- markdown: `docs/reports/reliability/dcp-475-proof/first-live-inference-proof-20260403T181831Z.md`
- log: `docs/reports/reliability/dcp-475-proof/first-live-inference-proof-20260403T181831Z.log`
- latest_json: `docs/reports/reliability/dcp-475-proof/first-live-inference-proof-latest.json`
- latest_markdown: `docs/reports/reliability/dcp-475-proof/first-live-inference-proof-latest.md`
- latest_log: `docs/reports/reliability/dcp-475-proof/first-live-inference-proof-latest.log`

