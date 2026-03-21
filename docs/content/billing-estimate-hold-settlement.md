# How DCP Billing Works: Estimate, Hold, Settlement

This explainer covers the exact billing sequence for renter jobs on DCP: prepay estimate, hold before execution, runtime tracking, and final settlement after completion.

## Core billing model
- Currency: Saudi Riyal (SAR).
- Internal unit: halala.
- Conversion: `100 halala = 1 SAR`.

DCP uses a prepay model so billing state is clear before a job starts, then reconciles to actual runtime after the job finishes.

## Before run: estimate and balance check
Before launching a paid job, DCP calculates an estimated cost and verifies balance coverage.

What this gives technical teams:
- A predictable pre-run cost signal.
- A clear go/no-go state before compute starts.
- Fewer surprise charges in later reconciliation.

## Hold stage: reserving the estimate
When the estimate is accepted and balance is sufficient, DCP places a hold for the estimated amount.

Important behavior:
- The hold is a temporary reservation, not final billing.
- The hold protects compute execution from mid-run balance failure.

## During run: actual usage tracking
While the job executes, DCP tracks runtime usage. This becomes the source of truth for final settlement.

Practical implication:
- Final charge follows actual resource usage, not only initial estimate.

## After run: settlement and automatic return of unused hold
When the job completes, DCP settles the final cost from actual usage and releases any unused portion of the hold back to the renter balance automatically.

This sequence provides:
- Upfront transparency (estimate before run).
- Runtime accuracy (settlement on actual usage).
- Automatic balance reconciliation (unused hold returned).

## Provider economics context
Provider-side earnings from completed jobs follow DCP platform economics:
- Provider share: `75%`
- Platform share: `25%`

## FAQ
### Is the estimate always the final charge?
No. The estimate is used for prepay hold. Final billing is settled from actual runtime usage.

### Why use halala instead of decimals?
Halala provides integer precision for internal accounting and avoids floating-point rounding issues.

### What should I verify in integration tests?
- Pre-run estimate is returned.
- Job executes only when balance/hold checks pass.
- Final settlement updates balance after completion.
- Unused hold is returned automatically.

### Does this document include gateway or withdrawal implementation details?
No. This explainer documents current platform billing behavior for renter job execution.

## CTA
### Validate billing flow before first paid workload
- Review renter quickstart: `/docs/quickstart`
- Check renter billing UI path: `/renter/billing`
- Confirm API contracts and response shapes: `/docs/api`
- Submit and track one end-to-end test job: `/renter/playground`
