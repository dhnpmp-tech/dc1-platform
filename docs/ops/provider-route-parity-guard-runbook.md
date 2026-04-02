# Provider Route Parity Guard Runbook

Owner: Backend Developer  
Related issue: [DCP-223](/DCP/issues/DCP-223)

## Purpose

Block merge/deploy requests when deployed runtime route coverage drifts from backend code for critical provider catalog endpoints:

- `GET /api/providers/model-catalog`
- `GET /api/providers/models`

The guard validates both code declaration (`backend/src/routes/providers.js`) and live runtime responses on a target base URL.

## Canonical Command

```bash
cd backend
npm run gate:provider-route-parity
```

Run this before requesting release merge/deploy approval.

## Optional Environment Variables

- `PROVIDER_ROUTE_PARITY_BASE_URL` (default `https://api.dcp.sa`)
- `PROVIDER_ROUTE_PARITY_TIMEOUT_MS` (default `12000`)

## Artifact Contract

Each run writes:

- `docs/reports/reliability/provider-route-parity-guard-<timestamp>.json`
- `docs/reports/reliability/provider-route-parity-guard-<timestamp>.md`
- `docs/reports/reliability/provider-route-parity-guard-latest.json`
- `docs/reports/reliability/provider-route-parity-guard-latest.md`

## Exit Behavior

- Exit code `0`: both routes are declared in code and runtime checks pass.
- Exit code `1`: any code/runtime mismatch, missing route, or probe failure.
