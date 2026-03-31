# Runtime Route Parity Monitor Runbook

## Purpose

This monitor enforces production/runtime parity for the critical OpenRouter-facing API routes:

- `GET /api/providers/model-catalog`
- `GET /v1/models`
- `POST /v1/chat/completions` (auth guard contract)

It compares code-route declarations with live runtime responses and emits machine-readable diff artifacts.

## Execution

- CI schedule: `.github/workflows/runtime-route-parity-monitor.yml` (every 15 minutes).
- Manual run (local):

```bash
cd backend
npm run monitor:route-parity
```

## Environment Variables

- `ROUTE_PARITY_BASE_URL` (default: `https://api.dcp.sa`)
- `ROUTE_PARITY_TIMEOUT_MS` (default: `12000`)
- `ROUTE_PARITY_MAX_FAILURES` (default: `0`)
- `ROUTE_PARITY_LATENCY_THRESHOLD_MS` (default: `4000`)
- `ROUTE_PARITY_MAX_LATENCY_BREACHES` (default: `0`)
- `ROUTE_PARITY_ARTIFACT_DIR` (default: `docs/reports/runtime-parity`)

## Artifact Output

Each run writes:

- `docs/reports/runtime-parity/route-parity-<timestamp>.json`

Artifact schema includes:

- Route-level code-contract declaration status
- Runtime status code, content-type, response body snapshot
- Mismatch list (`mismatches[]`)
- Threshold breach summary

## Alert Policy

Run is `fail` when either condition is true:

1. `failed_routes > ROUTE_PARITY_MAX_FAILURES`
2. `latency_breaches > ROUTE_PARITY_MAX_LATENCY_BREACHES`

Default policy is strict (`0` failures, `0` latency breaches).

## Triage Steps

1. Open latest parity artifact and identify failing route IDs.
2. If `route missing in code router stack`: confirm route registration in `backend/src/routes/providers.js` or `backend/src/routes/v1.js`.
3. If status/content-type/body mismatches: compare runtime payload with expected contract in `backend/src/services/runtimeRouteParityMonitor.js`.
4. Validate live endpoint directly with `curl` against `ROUTE_PARITY_BASE_URL`.
5. If runtime regression is confirmed, roll forward a fix and re-run monitor manually.
6. Attach artifact path and root cause summary to the active reliability issue thread.
