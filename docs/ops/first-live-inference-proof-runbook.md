# First-Live Inference Proof Runbook

Owner: Backend Developer  
Related issues: [DCP-371](/DCP/issues/DCP-371), [DCP-372](/DCP/issues/DCP-372), [DCP-373](/DCP/issues/DCP-373)

## Purpose

Produce a deterministic proof bundle for one authenticated `/v1/chat/completions` flow without manual credential handoff.

The command pack now self-serves a non-human smoke principal by:

1. creating (or recovering) a deterministic renter account by email,
2. minting a short-lived scoped inference sub-key,
3. running health/models/completion probes with that key,
4. writing artifacts under `docs/reports/reliability/`.

## Commands

Run just the smoke principal bootstrap:

```bash
cd backend
npm run test:reliability:ensure-smoke-principal
```

Run full first-live proof package:

```bash
cd backend
npm run test:reliability:first-live-proof
```

## Optional Environment Variables

- `DCP_API_BASE_URL`: API host (default `https://api.dcp.sa`)
- `DCP_SMOKE_MODEL`: model id for completion probe (default `allam-2-7b`)
- `DCP_SMOKE_PRINCIPAL_EMAIL`: deterministic renter email override
- `DCP_SMOKE_KEY_TTL_HOURS`: scoped key expiry (default `6`, max `72`)
- `DCP_SMOKE_MIN_BALANCE_HALALA`: minimum balance guard (default `1`)
- `DCP_PROOF_OUTPUT_DIR`: override artifact output directory

## Artifact Contract

Output files:

- `docs/reports/reliability/first-live-inference-proof-<timestamp>.json`
- `docs/reports/reliability/first-live-inference-proof-<timestamp>.md`
- `docs/reports/reliability/first-live-inference-proof-<timestamp>.log`
- `docs/reports/reliability/first-live-inference-proof-latest.json`
- `docs/reports/reliability/first-live-inference-proof-latest.md`
- `docs/reports/reliability/first-live-inference-proof-latest.log`

The JSON/Markdown report includes:

- smoke principal metadata (`renter_id`, `key_hint`, scoped key id/expiry),
- request IDs and response hashes for each probe,
- explicit verdict (`PASS` / `FAIL`),
- structured failure classification with actionable remediation.

## Failure Taxonomy

- `auth_scope_failure`: scoped key invalid/missing inference scope
- `provider_unreachable_or_unavailable`: provider route cannot serve completion
- `sse_done_missing`: streaming path does not terminate with `data: [DONE]`
- `model_or_route_not_found`: requested model or endpoint contract mismatch
- `unexpected_completion_status`: fallback bucket for non-contract responses
