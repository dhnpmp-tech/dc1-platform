# DCP-436 — 19:00 UTC Cost-Control Report (Post DCP-266 Model Downgrades)

**Date:** 2026-03-21 19:00 UTC  
**Prepared by:** Budget Analyst  
**Scope:** Updated monthly burn after non-critical agents moved to Haiku-class model (DCP-266 execution)

## 1) Before/After Monthly Burn Estimate

| Metric | Before downgrades | After downgrades | Delta |
|---|---:|---:|---:|
| Total monthly burn (SAR) | 10,313 | 5,707 | -4,606 |
| Total monthly burn (USD @ 3.75) | 2,750.13 | 1,521.87 | -1,228.27 |
| Reduction % | — | — | -44.7% |

**Formula notes**
- Before: fixed (3,363) + pre-downgrade agent API (6,930) + Docker delta (~20) = ~10,313 SAR/mo
- After: fixed (3,363) + post-downgrade agent API (~2,324) + Docker delta (~20) = ~5,707 SAR/mo

## 2) Remaining Overrun Risks

| Risk | Current impact | Why it matters |
|---|---:|---|
| Still above legacy SaaS ceiling (2,956 SAR) | +2,751 SAR/mo | Even after DCP-266, blended burn remains above the old SaaS-only ceiling definition |
| Revenue sensitivity to utilization | High | Post-downgrade break-even still needs ~14 fully utilized GPUs (or higher provider count at lower utilization) |
| Execution drift (heartbeat / model routing) | Medium | If agents regress to high-frequency Sonnet usage, monthly burn can rebound toward pre-downgrade levels |

## 3) Top 3 Immediate Savings Actions (If Still Above Ceiling)

| Priority | Action | Monthly savings (SAR) | New run-rate effect |
|---|---|---:|---:|
| 1 | Enforce CR1/CR2 sequential pooling (no parallel default) | ~338 | 5,707 -> 5,369 |
| 2 | Suspend 4 non-critical agents (Blockchain, P2P, IDE Extension, ML Infra) while backlog is thin | ~256 | 5,369 -> 5,113 |
| 3 | Cap CEO heartbeat to 2/hour outside sprint windows | ~200 | 5,113 -> 4,913 |

**Combined immediate savings:** ~794 SAR/mo  
**Run-rate after top 3:** ~4,913 SAR/mo (still ~1,957 SAR above 2,956)

## 4) Board Takeaway

- DCP-266 delivered material cost control: **~4,606 SAR/mo savings** and **~45% burn reduction**.
- Cost crisis is reduced but not eliminated under a strict 2,956 SAR cap framework.
- After the top 3 immediate actions, the remaining gap should be closed primarily via revenue ramp (provider utilization), not additional deep staffing cuts.

## Sources

1. `docs/cost-reports/2026-Q2-projections-v2.md` (DCP-327):
   - 10,313 SAR pre-downgrade pace
   - 5,707 SAR post-DCP-266 total OPEX
   - 2,324 SAR post-Haiku agent API
   - 3,363 SAR fixed + infra baseline
   - break-even provider/GPU thresholds
2. `docs/cost-reports/2026-03-march.md`:
   - CR pooling savings (~338 SAR/mo)
   - suspend 4 non-critical agents (~256 SAR/mo)
   - CEO heartbeat cap (~200 SAR/mo)
3. Exchange rate assumption: 1 USD = 3.75 SAR (fixed peg), as used in existing DCP cost reports.
