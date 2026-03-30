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

## Alert Matrix And Routing
Use this matrix for the first response. Any `critical` condition blocks settlement completion until explicitly cleared.

| Condition | Trigger threshold | Severity | Primary owner | Escalate to | Required response |
| --- | --- | --- | --- | --- | --- |
| `SETTLEMENT_DISCREPANCY` | `discrepancy_halala !== 0` on dry-run or execute response | critical | Finance/Payments operator on call | CTO if not explained within 30 minutes | Freeze invoice/topup execution for the window, reconcile expected total against OpenRouter statement, rerun dry-run with corrected expectation, then rerun execute only after discrepancy returns `0`. |
| `SETTLEMENT_EXECUTION_FAILED` | API returns `500` or settlement detail shows status `failed` | critical | Backend/on-call engineer | CTO immediately | Preserve request payload and response body, inspect service logs + database state, fix root cause, then rerun the same window once the partial-write risk is understood. |
| Empty settlement window with expected non-zero revenue | `usage_count === 0` while finance expects billable OpenRouter traffic | critical | Finance/Payments operator on call | CTO if ledger gap is not resolved within 30 minutes | Stop settlement for the window, verify [DCP-98](/DCP/issues/DCP-98) metering inputs and recent `/v1/chat/completions` traffic, then rerun dry-run after the missing ledger cause is identified. |
| Empty settlement window with no expected traffic | `usage_count === 0` and no expected usage for the period | warning | Finance/Payments operator on call | none | Record the dry-run result and continue to the next scheduled window; no execute call is needed. |

## Operator Handoff
Use this chain every time a settlement alert fires:

1. Finance/Payments operator owns the first dry-run/execute response review.
2. Backend/on-call engineer joins immediately for any `critical` alert or API `500`.
3. CTO is paged if the alert is unresolved after 30 minutes, if settlement data appears missing, or if more than one settlement window is impacted.
4. QA is brought in only after the window is stable again to replay the validation checklist below and archive fresh evidence.

## Failure & Recovery
### `SETTLEMENT_DISCREPANCY`
- Meaning: expected total differs from reconciled usage ledger total.
- Action: hold payout/topup processing, reconcile external OpenRouter statement, rerun with corrected expected total.

### `SETTLEMENT_EXECUTION_FAILED`
- Meaning: transactional write failed during settlement execution.
- Action: inspect settlement detail endpoint and database logs, then rerun the same time window after correcting root cause.

## Command-Level Recovery Procedure
Run the same sequence for every blocked settlement window so recovery is reproducible:

1. Reproduce the dry-run summary:
   ```bash
   curl -X POST "$BASE_URL/api/admin/openrouter/settlements/dry-run" \
     -H "Content-Type: application/json" \
     -H "x-admin-token: $DC1_ADMIN_TOKEN" \
     -d '{
       "period_start": "2026-03-30T00:00:00.000Z",
       "period_end": "2026-03-30T23:59:59.999Z",
       "expected_total_halala": 12345
     }'
   ```
2. If the summary is unexpected, inspect the most recent settled and pending windows before rerunning:
   ```bash
   curl -H "x-admin-token: $DC1_ADMIN_TOKEN" \
     "$BASE_URL/api/admin/openrouter/settlements?limit=20"
   ```
3. If an execute call failed after creating a settlement record, fetch the detail payload and preserve it in the incident thread:
   ```bash
   curl -H "x-admin-token: $DC1_ADMIN_TOKEN" \
     "$BASE_URL/api/admin/openrouter/settlements/$SETTLEMENT_ID"
   ```
4. Only after the discrepancy or execution failure is understood should finance rerun:
   ```bash
   curl -X POST "$BASE_URL/api/admin/openrouter/settlements/run" \
     -H "Content-Type: application/json" \
     -H "x-admin-token: $DC1_ADMIN_TOKEN" \
     -d '{
       "period_start": "2026-03-30T00:00:00.000Z",
       "period_end": "2026-03-30T23:59:59.999Z",
       "mode": "invoice",
       "cadence": "daily",
       "expected_total_halala": 12345
     }'
   ```

## QA Validation Checklist
QA should use this checklist after backend confirms a stable window:

1. Run one dry-run for the target window and verify:
   - `usage_count` matches the expected billable traffic count.
   - `discrepancy_halala` is `0`.
   - `top_renters` totals look plausible for the window.
2. Run one execute call in the intended mode (`invoice` or `auto_topup`) and verify:
   - the response includes a `settlement.id`.
   - `summary.reconciled_halala` matches the dry-run value.
   - `alerts` is empty for a clean window.
3. Fetch `GET /api/admin/openrouter/settlements/:id` and verify:
   - every `item.usage_id` is unique.
   - either `invoice` or `topup` is present, matching the chosen mode.
   - no unexpected alert rows were written for the clean run.
4. Archive the exact request payloads and all three JSON responses in the release evidence bundle.

## Related Artifacts
- `docs/ops/openrouter-settlement-traceability-matrix.md` (DCP-105): usage-to-settlement traceability matrix, control thresholds, and failure ownership map.

## Dependency Notes
- [DCP-84](/DCP/issues/DCP-84) supplies the ledger, reconciliation, settlement APIs, and alert writes this runbook depends on.
- [DCP-98](/DCP/issues/DCP-98) supplies the metering normalization that makes the dry-run totals trustworthy for operator review.

## Dry-Run Acceptance Evidence
For release readiness, archive:
1. Dry-run payload + response JSON.
2. Run payload + response JSON.
3. Settlement detail JSON including `items`, `invoice/topup`, and `alerts`.
