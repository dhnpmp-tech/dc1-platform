# Provider Route Parity Guard Report

- generated_at: `2026-04-02T09:05:44.977Z`
- base_url: `https://api.dcp.sa`
- command: `cd backend && npm run gate:provider-route-parity`
- verdict: **FAIL**
- pass: `1`
- failed: `1`

## Route Results

### GET /api/providers/model-catalog
- status: **FAIL**
- declared_in_code: `true`
- runtime_status: `404`
- runtime_duration_ms: `82`
- mismatches:
  - status mismatch: expected 200, got 404
  - content-type mismatch: expected to include "application/json", got "text/html; charset=utf-8"
  - response body is not a JSON object

### GET /api/providers/models
- status: **PASS**
- declared_in_code: `true`
- runtime_status: `200`
- runtime_duration_ms: `6`

