# First-Live Inference Proof Report

- generated_at: `2026-04-04T01:18:36.276Z`
- verdict: **FAIL**
- base_url: `https://api.dcp.sa`
- model: `allam-2-7b`
- smoke_principal: renter_id=`1774351995125` key_hint=`dc1-sk-4...5486`
- transcript_command: `node tests/first-live-inference-proof-package.js`

## Probe Summary

| step | status | elapsed_ms | request_id | notes |
|---|---:|---:|---|---|
| health | 200 | 2 |  |  |
| models | 200 | 2 |  |  |
| completion_json | 504 | 300052 |  | <html>
<head><title>504 Gateway Time-out</title></head>
<body>
<center><h1>504 Gateway Time-out</h1></center>
<hr><center>nginx/1.24.0 (Ubuntu)</center>
</body>
</html>
 |
| completion_stream | 401 | 10 |  | missing [DONE] |

## Provider Route Evidence

- completion_json.provider_id: ``
- completion_json.provider_tier: ``
- completion_json.provider_endpoint_host: ``
- completion_stream.provider_id: ``
- completion_stream.provider_tier: ``
- completion_stream.provider_endpoint_host: ``

## Failure Classification

- code: `auth_scope_failure`
- severity: `blocking`
- action: Run backend/tests/ensure-inference-smoke-principal.js and ensure scoped key carries inference scope.

## Artifacts

- json: `docs/reports/reliability/first-live-inference-proof-20260404T011336Z.json`
- markdown: `docs/reports/reliability/first-live-inference-proof-20260404T011336Z.md`
- log: `docs/reports/reliability/first-live-inference-proof-20260404T011336Z.log`
- latest_json: `docs/reports/reliability/first-live-inference-proof-latest.json`
- latest_markdown: `docs/reports/reliability/first-live-inference-proof-latest.md`
- latest_log: `docs/reports/reliability/first-live-inference-proof-latest.log`

