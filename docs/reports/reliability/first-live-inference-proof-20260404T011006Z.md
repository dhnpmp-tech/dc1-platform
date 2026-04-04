# First-Live Inference Proof Report

- generated_at: `2026-04-04T01:10:08.578Z`
- verdict: **FAIL**
- base_url: `https://api.dcp.sa`
- model: `ALLaM-AI/ALLaM-7B-Instruct-preview`
- smoke_principal: renter_id=`1774351995125` key_hint=`dc1-sk-d...6ee3`
- transcript_command: `node tests/first-live-inference-proof-package.js`

## Probe Summary

| step | status | elapsed_ms | request_id | notes |
|---|---:|---:|---|---|
| health | 200 | 4 |  |  |
| models | 200 | 5 |  |  |
| completion_json | 503 | 1266 |  | Provider failover exhausted after initial error: provider_http_404 |
| completion_stream | 503 | 317 |  | missing [DONE] |

## Provider Route Evidence

- completion_json.provider_id: ``
- completion_json.provider_tier: ``
- completion_json.provider_endpoint_host: ``
- completion_stream.provider_id: ``
- completion_stream.provider_tier: ``
- completion_stream.provider_endpoint_host: ``

## Capacity Snapshot

- model_id: `ALLaM-AI/ALLaM-7B-Instruct-preview`
- min_vram_gb: `0`
- capable_providers: `0`
- provider_id: ``
- provider_tier: ``
- provider_endpoint_host: ``
- provider_http_status: `404`
- route_error_message: `Provider failover exhausted after initial error: provider_http_404`
- inferred_heartbeat_timestamp: ``
- evidence_complete: `true`

## Failure Classification

- code: `provider_unreachable_or_unavailable`
- severity: `blocking`
- action: Verify provider heartbeat, reachable vLLM endpoint URL, and model is loaded on at least one online provider.

## Artifacts

- json: `docs/reports/reliability/first-live-inference-proof-20260404T011006Z.json`
- markdown: `docs/reports/reliability/first-live-inference-proof-20260404T011006Z.md`
- log: `docs/reports/reliability/first-live-inference-proof-20260404T011006Z.log`
- latest_json: `docs/reports/reliability/first-live-inference-proof-latest.json`
- latest_markdown: `docs/reports/reliability/first-live-inference-proof-latest.md`
- latest_log: `docs/reports/reliability/first-live-inference-proof-latest.log`

