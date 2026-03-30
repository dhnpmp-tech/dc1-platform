# OpenRouter Settlement Runbook (DCP-84)

## Objective
Provide an auditable usage-to-settlement path for OpenRouter-billed traffic, with reconciliation controls and recoverable failure handling.

## Data Flow
1. Usage events are written to `openrouter_usage_ledger` from `/v1/chat/completions`.
2. Finance runs a dry-run reconciliation to validate totals for a settlement window.
3. Finance executes a settlement run in one of two modes:
- `invoice`: creates `openrouter_settlement_invoices` record.
- `auto_topup`: creates `openrouter_settlement_topups` record.
4. Linked items are written to `openrouter_settlement_items`, and usage rows are marked `settled`.
5. Any mismatch between expected and reconciled totals writes a critical record in `openrouter_settlement_alerts`.

## Admin API
All endpoints require `x-admin-token`.

### Dry-run reconciliation
`POST /api/admin/openrouter/settlements/dry-run`

Optional body:
```json
{
  "period_start": "2026-03-30T00:00:00.000Z",
  "period_end": "2026-03-30T23:59:59.999Z",
  "expected_total_halala": 12345
}
```

### Execute settlement
`POST /api/admin/openrouter/settlements/run`

Optional body:
```json
{
  "period_start": "2026-03-30T00:00:00.000Z",
  "period_end": "2026-03-30T23:59:59.999Z",
  "mode": "invoice",
  "cadence": "daily",
  "expected_total_halala": 12345
}
```

### Settlement audit
- `GET /api/admin/openrouter/settlements?limit=20`
- `GET /api/admin/openrouter/settlements/:id`

## Cadence
- Default cadence is daily.
- Recommended run time: 00:05 UTC for previous UTC day.

## Failure & Recovery
### `SETTLEMENT_DISCREPANCY`
- Meaning: expected total differs from reconciled usage ledger total.
- Action: hold payout/topup processing, reconcile external OpenRouter statement, rerun with corrected expected total.

### `SETTLEMENT_EXECUTION_FAILED`
- Meaning: transactional write failed during settlement execution.
- Action: inspect settlement detail endpoint and database logs, then rerun the same time window after correcting root cause.

## Dry-Run Acceptance Evidence
For release readiness, archive:
1. Dry-run payload + response JSON.
2. Run payload + response JSON.
3. Settlement detail JSON including `items`, `invoice/topup`, and `alerts`.
