# DCP Payment Flow Test Results

**Test:** End-to-end off-chain payment ledger smoke test (DCP-842)
**Script:** `scripts/test-payment-flow.mjs`
**Run date:** 2026-03-24
**Result:** ✅ 19 PASS / 0 FAIL

---

## Test Environment

| Parameter | Value |
|---|---|
| Exchange rate | 1 USD = 3.75 SAR (Saudi Central Bank peg) |
| GPU under test | NVIDIA RTX 4090 |
| Rate (USD/hr) | $0.267 |
| Rate (SAR/hr) | 1.001 SAR |
| Platform split | 75% provider / 25% DC1 |
| DB | In-memory SQLite (isolated, production data never touched) |

---

## Scenario 1: Happy Path — 1-Hour RTX 4090 Job

**Setup:**
- Renter created with 100 SAR (10,000 halala) balance
- Provider created with RTX 4090
- Job submitted: `llm-inference`, 60 minutes, RTX 4090

**Cost calculation:**

```
Duration:           60 minutes (3,600 seconds)
Rate:               0.0000742 USD/sec × 3,600 × 3.75 × 100 = 100.17 raw halala
Cost (halala):      101  (ceiling)
Cost (SAR):         1.01 SAR
Provider earns:     75 halala  (floor(101 × 0.75))
DC1 fee:            26 halala  (101 − 75)
```

**Checks (all PASS):**

| # | Check | Expected | Got |
|---|---|---|---|
| 1 | Job record created | `true` | `true` |
| 2 | `cost_halala` matches pricing calculation | `101` | `101` |
| 3 | Job status after submit | `running` | `running` |
| 4 | Job `costSAR` | `1.01` | `1.01` |
| 5 | Renter balance decreased by 101 halala | `9,899` | `9,899` |
| 6 | `total_spent_halala` updated | `101` | `101` |
| 7 | Ledger debit entry recorded | `true` | `true` |
| 8 | Ledger debit amount matches job cost | `101` | `101` |
| 9 | Provider `claimable_earnings_halala` increased | `75` | `75` |
| 10 | Provider `total_jobs` incremented | `1` | `1` |
| 11 | `dc1_fee_halala` recorded on job | `26` | `26` |
| 12 | `provider_earned_halala` recorded on job | `75` | `75` |
| 13 | Job status after completion | `completed` | `completed` |
| 14 | Accounting identity: `provider_earned + dc1_fee === actual_cost` | `101` | `101` |
| 15 | Provider split ≈ 75% | `true` (74.3%) | `true` |

---

## Scenario 2: Insufficient Balance Guard

**Setup:** Renter with 0 SAR balance attempts a 1-hour job.

| # | Check | Expected | Got |
|---|---|---|---|
| 16 | Insufficient balance raises error | `true` | `true` |
| 17 | Renter balance unchanged after rejected submit | `0` | `0` |

The atomic `AND balance_halala >= ?` guard in the SQL UPDATE prevents any deduction when the balance is too low. No partial state is written.

---

## Scenario 3: Pricing Sanity vs USD/SAR

| # | Check | Expected | Got |
|---|---|---|---|
| 18 | 1-hr RTX 4090 cost USD ≈ $0.267 (within 2%) | `true` (0.2693) | `true` |
| 19 | 1-hr RTX 4090 cost SAR ≈ 1.00 SAR (within 5%) | `true` (1.01) | `true` |

---

## Implementation Notes

### Platform Split: 75/25, not 85/15

The task brief cited a 15% platform fee (85% to provider). The **actual implementation** in `backend/src/routes/jobs.js` uses:

```js
function splitBilling(totalHalala) {
  const provider = Math.floor(totalHalala * 0.75);
  return { provider, dc1: totalHalala - provider };
}
```

Provider receives **75%**, DC1 keeps **25%**. The smoke test verifies the actual code behavior. If the intended split is 85/15, the `splitBilling` function needs to be updated and this test re-run.

### Ledger / "payment_events"

The task referenced a `payment_events` table from DCP-825. The production schema uses `renter_credit_ledger` for immutable double-entry accounting of renter balance changes. Provider earnings are tracked directly on `providers.claimable_earnings_halala`. Platform fee is stored on `jobs.dc1_fee_halala`. This test validates all three stores.

### Halala Arithmetic

All monetary values are stored as integers (halala = 1/100 SAR) to avoid floating-point precision issues. The ceiling function ensures the platform always collects at least the quoted rate.

---

## Readiness Assessment

| Criterion | Status |
|---|---|
| Renter balance deduction correct | ✅ |
| Provider earnings credited correctly | ✅ |
| Platform fee recorded on job | ✅ |
| Accounting identity holds | ✅ |
| Insufficient balance guard works | ✅ |
| RTX 4090 pricing within spec | ✅ |
| **Overall: Ready for Phase 1 testing (2026-03-26 08:00 UTC)** | ✅ |
