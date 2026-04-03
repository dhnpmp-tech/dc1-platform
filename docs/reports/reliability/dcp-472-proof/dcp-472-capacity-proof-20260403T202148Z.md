# DCP-472 Capacity Proof

- generated_at: `2026-04-03T20:21:48.609Z`
- verdict: **FAIL**
- base_url: `https://api.dcp.sa`
- model: `ALLaM-AI/ALLaM-7B-Instruct-preview`
- renter_id: `1774351995125`
- provider_id: ``
- heartbeat_timestamp: ``
- capable_providers: `0`

## Probes

- providers_available.status: `200`
- providers_available.total: `1`
- providers_available.model_matched_provider_count: `0`
- completion_json.status: `503`
- completion_json.error: `No inference providers available for this model`

## Failure

- code: `dcp472_capacity_not_restored`
- action: Deploy ALLaM routing fix to production and ensure at least one live provider advertises the requested model in cached_models.

## Artifacts

- json: `docs/reports/reliability/dcp-472-proof/dcp-472-capacity-proof-20260403T202148Z.json`
- markdown: `docs/reports/reliability/dcp-472-proof/dcp-472-capacity-proof-20260403T202148Z.md`
- log: `docs/reports/reliability/dcp-472-proof/dcp-472-capacity-proof-20260403T202148Z.log`
- latest_json: `docs/reports/reliability/dcp-472-proof/dcp-472-capacity-proof-latest.json`
- latest_markdown: `docs/reports/reliability/dcp-472-proof/dcp-472-capacity-proof-latest.md`
- latest_log: `docs/reports/reliability/dcp-472-proof/dcp-472-capacity-proof-latest.log`

