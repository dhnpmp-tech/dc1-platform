# First-Live Inference Proof Report

- generated_at: `2026-04-03T23:04:42.618Z`
- verdict: **FAIL**
- base_url: `https://api.dcp.sa`
- model: `ALLaM-AI/ALLaM-7B-Instruct-preview`
- smoke_principal: renter_id=`1774351995125` key_hint=`dc1-sk-2...122f`
- transcript_command: `node tests/first-live-inference-proof-package.js`

## Probe Summary

| step | status | elapsed_ms | request_id | notes |
|---|---:|---:|---|---|
| health | 200 | 2 |  |  |
| models | 200 | 3 |  |  |
| completion_json | 503 | 3 |  | No inference providers available for this model |
| completion_stream | 503 | 4 |  | missing [DONE] |

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

- json: `docs/reports/reliability/first-live-inference-proof-20260403T230442Z.json`
- markdown: `docs/reports/reliability/first-live-inference-proof-20260403T230442Z.md`
- log: `docs/reports/reliability/first-live-inference-proof-20260403T230442Z.log`
- latest_json: `docs/reports/reliability/first-live-inference-proof-latest.json`
- latest_markdown: `docs/reports/reliability/first-live-inference-proof-latest.md`
- latest_log: `docs/reports/reliability/first-live-inference-proof-latest.log`

