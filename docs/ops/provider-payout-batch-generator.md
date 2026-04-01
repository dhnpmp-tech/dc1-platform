# Provider Payout Batch Generator

Deterministic FinOps payout export from the settlement ledger.

## Command

```bash
cd backend
npm run payouts:generate-batch -- --window-start 2026-03-01T00:00:00.000Z --window-end 2026-03-31T23:59:59.000Z
```

Optional output directory:

```bash
cd backend
npm run payouts:generate-batch -- --window-start 2026-03-01T00:00:00.000Z --window-end 2026-03-31T23:59:59.000Z --out-dir ../docs/reports/finops/payout-batches
```

## Artifacts

- JSON summary: `docs/reports/finops/payout-batches/<batch-id>.json`
- CSV export (IBAN-ready): `docs/reports/finops/payout-batches/<batch-id>.csv`

## Guardrails

- Source of truth is `job_settlements` (`status='completed'`) in the requested window.
- Rows without IBAN are skipped and tracked in `skipped` with `missing_iban`.
- Batch throws if exported totals do not match covered ledger totals.
- SHA-256 checksum is always emitted; if `PAYOUT_BATCH_SIGNING_KEY` is set, output also includes HMAC-SHA256 signature.

