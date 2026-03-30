# First Paid SAR Evidence Export

Use the backend exporter to generate a meter-to-charge-to-ledger bundle for one candidate transaction.

## Command

```bash
npm --prefix backend run finops:evidence
```

Optional flags:

```bash
node backend/scripts/export-finops-evidence.js --out-dir docs/finance --candidate-limit 500
```

## Output Files

The exporter writes two timestamped files:

- `docs/finance/first-paid-sar-evidence-<timestamp>.json`
- `docs/finance/first-paid-sar-evidence-<timestamp>.md`

## Bundle Contents

1. Request/inference identifiers (`jobs`).
2. Metering record (`billing_records` preferred, `job_settlements` fallback).
3. Payment/charge row (`payments`).
4. Ledger postings (`renter_credit_ledger` credit + debit rows).
5. Missing linkage fields with table/column + recommended fix.
6. SQL command pack for reproducible extraction.

## Notes

- If the selected environment has no paid transactions yet, the bundle is generated in partial mode and reports missing linkages explicitly.
- The exporter assumes SAR for settlement fallback rows because `job_settlements` has no explicit currency column.
