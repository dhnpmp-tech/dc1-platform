# First-Live Inference Proof Report

- generated_at: `2026-04-04T03:32:20.727Z`
- verdict: **FAIL**
- base_url: `https://api.dcp.sa`
- model: `ALLaM-AI/ALLaM-7B-Instruct-preview`
- smoke_principal: renter_id=`1774351995125` key_hint=`dc1-sk-9...7bf2`
- transcript_command: `node tests/first-live-inference-proof-package.js`

## Probe Summary

| step | status | elapsed_ms | request_id | notes |
|---|---:|---:|---|---|
| health | 200 | 2 |  |  |
| models | 200 | 4 |  |  |
| completion_json | 503 | 1371 |  | Provider failover exhausted after initial error: provider_http_404 |
| completion_stream | 503 | 308 |  | missing [DONE] |
| active_providers | 200 | 10 |  |  |

## Provider Route Evidence

- completion_json.provider_id: ``
- completion_json.provider_tier: ``
- completion_json.provider_endpoint_host: ``
- completion_stream.provider_id: ``
- completion_stream.provider_tier: ``
- completion_stream.provider_endpoint_host: ``

## Capacity Snapshot

- captured_at: `2026-04-04T03:32:20.726Z`
- model_id: `ALLaM-AI/ALLaM-7B-Instruct-preview`
- min_vram_gb: ``
- capable_providers: `2`
- capable_providers_source: `active_providers_vram_gate`
- candidate_provider_count: `2`

| provider_id | heartbeat_observed_at | heartbeat_age_seconds | vram_gb | vram_eligible | model_cache_match |
|---:|---|---:|---:|---|---|
| 1774351995136 | 2026-04-04T03:31:58.726Z | 22 | 0 | yes | no |
| 1774351995138 | 2026-04-04T03:31:53.726Z | 27 | 45 | yes | no |

## Failure Classification

- code: `provider_unreachable_or_unavailable`
- severity: `blocking`
- action: Verify provider heartbeat, reachable vLLM endpoint URL, and model is loaded on at least one online provider.

## Artifacts

- json: `docs/reports/reliability/dcp-475-proof/first-live-inference-proof-20260404T033218Z.json`
- markdown: `docs/reports/reliability/dcp-475-proof/first-live-inference-proof-20260404T033218Z.md`
- log: `docs/reports/reliability/dcp-475-proof/first-live-inference-proof-20260404T033218Z.log`
- latest_json: `docs/reports/reliability/dcp-475-proof/first-live-inference-proof-latest.json`
- latest_markdown: `docs/reports/reliability/dcp-475-proof/first-live-inference-proof-latest.md`
- latest_log: `docs/reports/reliability/dcp-475-proof/first-live-inference-proof-latest.log`

