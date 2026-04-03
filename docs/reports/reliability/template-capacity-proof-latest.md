# Template Capacity Proof

- generated_at: `2026-04-03T03:54:26.655Z`
- base_url: `https://api.dcp.sa`
- verdict: **FAIL**
- command: `node src/scripts/run-template-capacity-proof.js`

| template_id | status | elapsed_ms | required_vram_gb | capable_provider_count | idle_provider_count | selected_provider_id |
|---|---:|---:|---:|---:|---:|---:|
| allam-7b-instruct | 404 | 73 | 0 | 0 | 0 |  |
| jais-13b-chat | 404 | 4 | 0 | 0 | 0 |  |

## Failures

- `allam-7b-instruct`: HTTP 404: <!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot GET /api/templates/allam-7b-instruct/deploy/check</pre>
</body>
</html>

- `jais-13b-chat`: HTTP 404: <!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot GET /api/templates/jais-13b-chat/deploy/check</pre>
</body>
</html>


## Artifacts

- json: `docs/reports/reliability/template-capacity-proof-20260403T035426Z.json`
- markdown: `docs/reports/reliability/template-capacity-proof-20260403T035426Z.md`
- latest_json: `docs/reports/reliability/template-capacity-proof-latest.json`
- latest_markdown: `docs/reports/reliability/template-capacity-proof-latest.md`

