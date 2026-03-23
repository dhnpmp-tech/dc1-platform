# Revenue Activation Checklist — Post-Provider Connectivity

**Prepared by:** Budget Analyst
**Triggered when:** ≥1 provider comes online
**Purpose:** Fast-track renter onboarding and revenue tracking after blocker resolves

---

## Phase 1: Provider Connectivity Restored (Immediate)

When first provider comes online at https://api.dcp.sa/api/health:

- [ ] Notify engineering: "Provider connectivity restored, proceeding with E2E smoke test"
- [ ] Run E2E smoke test (submit test job → verify execution → confirm completion)
- [ ] Validate: Jobs can queue and execute successfully
- [ ] Record timestamp: First provider online (for timeline)

**Financial impact:** Still $0 until first renter job completes

---

## Phase 2: E2E Smoke Test Complete (1-2 hours)

When test job successfully completes:

- [ ] Confirm test job result is valid
- [ ] Verify provider payment calculation (25% platform fee applied)
- [ ] Check provider wallet receives earnings (75% of test compute)
- [ ] Activate real-time spend monitoring dashboard

**Financial milestone:** First compute cycle complete = system validated

---

## Phase 3: First Renter Onboarding (4-6 hours)

When first production renter joins:

- [ ] Renter registers via `/api/renters/register`
- [ ] Renter receives API key and accesses dashboard
- [ ] Renter views available providers (should see ≥1 online)
- [ ] Renter submits first compute job

**Financial trigger:** First renter job = REVENUE ACTIVATION

---

## Phase 4: Revenue Tracking Activated (6-12 hours)

When first renter job completes:

### Financial Metrics to Track
- [ ] First job cost: Record SAR amount, duration, GPU type
- [ ] Platform revenue: Calculate 25% take (invoice DCP)
- [ ] Provider earnings: 75% credited to provider wallet
- [ ] Renter spend: Deducted from renter wallet

### Break-Even Timeline Calculation
- [ ] Calculate daily revenue run-rate: `first_day_revenue × 30`
- [ ] Calculate days to break-even: `monthly_burn ÷ daily_revenue`
- [ ] Update financial-model.md with actual vs. projected data

### Reporting
- [ ] Update daily status report with first revenue figures
- [ ] Post renter acquisition status (1/48 toward break-even target)
- [ ] Track provider utilization (1 provider online)
- [ ] Monitor renter CAC (cost to acquire renter)

---

## Phase 5: Week 1 Revenue Report (End of 2026-03-29)

Summarize first week metrics:

| Metric | Target | Actual | Delta |
|--------|--------|--------|-------|
| Providers online | 20+ | — | — |
| Renters onboarded | 10+ | — | — |
| Total compute jobs | 50+ | — | — |
| Weekly platform revenue | TBD | — | — |
| Provider earnings distributed | TBD | — | — |
| Break-even days remaining | 7–14 | — | — |

### Revenue Forecast Adjustment
- Update cost model with actual utilization data
- Recalculate break-even timeline
- Assess trajectory to 48-renter break-even target

---

## Financial Gates (Must-Pass)

Before moving to ramp phase (Week 2):

- ✅ First renter successfully onboarded
- ✅ First compute job completed
- ✅ Revenue calculated and distributed correctly
- ✅ Provider and renter wallets functioning
- ✅ No payment settlement bugs or delays

---

## Monitoring During Ramp

Once in production (Week 2+):

- **Daily:** Spend vs 1,313 SAR/week guardrail
- **Daily:** Provider online count and utilization
- **Daily:** Renter onboarding rate (target: 7+ renters/week)
- **Daily:** Platform revenue and burn offset
- **Weekly:** Break-even timeline (days remaining)
- **Weekly:** Cost-down P1-P3 readiness (if Red triggered)

---

## Owner Checklist

**Engineering:** Provider daemon connectivity
**Product:** E2E smoke test validation
**Business:** First renter onboarding
**Finance:** Revenue calculation and reporting (Budget Analyst)
**CEO:** Overall gate approval and escalations

---

## Status

**Current:** Awaiting provider connectivity resolution (BLOCKED)
**Next step:** Activate Phase 1 when ≥1 provider online
**Timeline:** Phases 1-4 expected within 12-24 hours of blocker resolution
