# First-Live Inference Proof Report

- generated_at: `2026-04-03T02:46:28.424Z`
- verdict: **FAIL**
- base_url: `https://api.dcp.sa`
- model: `allam-2-7b`
- smoke_principal: renter_id=`1774351995125` key_hint=`dc1-sk-2...bb08`
- transcript_command: `node tests/first-live-inference-proof-package.js`

## Probe Summary

| step | status | elapsed_ms | request_id | notes |
|---|---:|---:|---|---|
| health | 200 | 2 |  |  |
| models | 200 | 4 |  |  |
| completion_json | 503 | 9 |  | {"error":"no_capacity","message":"No online providers currently satisfy this model GPU requirement","diagnostics":{"model_id":"allam-2-7b","min_vram_gb":16,"capable_providers":0,"queued_vllm_jobs":0,"provider_heartbeat_stale_ms":600000,"wai |
| completion_stream | 200 | 4 |  |  |

## Provider Route Evidence

- completion_json.provider_id: ``
- completion_json.provider_tier: ``
- completion_json.provider_endpoint_host: ``
- completion_stream.provider_id: ``
- completion_stream.provider_tier: ``
- completion_stream.provider_endpoint_host: ``

## Failure Classification

- code: `provider_unreachable_or_unavailable`
- severity: `blocking`
- action: Verify provider heartbeat, reachable vLLM endpoint URL, and model is loaded on at least one online provider.

## Artifacts

- json: `docs/reports/reliability/first-live-inference-proof-20260403T024628Z.json`
- markdown: `docs/reports/reliability/first-live-inference-proof-20260403T024628Z.md`
- log: `docs/reports/reliability/first-live-inference-proof-20260403T024628Z.log`
- latest_json: `docs/reports/reliability/first-live-inference-proof-latest.json`
- latest_markdown: `docs/reports/reliability/first-live-inference-proof-latest.md`
- latest_log: `docs/reports/reliability/first-live-inference-proof-latest.log`

