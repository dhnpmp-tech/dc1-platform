# DCP-XX — Sprint 25 Financial Dashboard & Tracking

**Date:** 2026-03-23 (UTC)
**Prepared by:** Budget Analyst
**Purpose:** Real-time cost monitoring and revenue milestone tracking for Sprint 25
**Update frequency:** Daily (during launch week); Weekly (during ramp phase)
**Exchange rate:** 1 USD = 3.75 SAR (fixed peg)

---

## 1) Current Financial State (as of 2026-03-23 04:32 UTC)

### Burn Rate Summary
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Monthly burn** | 5,707 SAR | 2,956 SAR (SaaS-only ceiling) | ⚠️ 93% OVER ceiling |
| **Weekly burn** | 1,313 SAR | 1,313 SAR (guardrail green) | 🟢 At guardrail |
| **Days to cash runway** | Unknown (operating deficit mode) | 90+ days (from launch revenue) | 🔴 Needs revenue |

### Cost Breakdown (Monthly)
| Category | SAR | USD | % of burn |
|----------|-----|-----|----------|
| Fixed SaaS + infra | 3,363 | 897.60 | 58.9% |
| Agent API (post-DCP-266) | 2,324 | 619.73 | 40.7% |
| Docker delta | 20 | 5.33 | 0.4% |
| **Total** | **5,707** | **1,522.67** | **100%** |

---

## 2) Launch-Week Guardrails (DCP-539 Activation)

When HTTPS/TLS blocker clears (DCP-308/DCP-559), activate daily tracking:

### Weekly Spend Limits
| Status | Weekly SAR | Weekly USD | Action |
|--------|-----------|-----------|--------|
| 🟢 **Green** | ≤ 1,313 | ≤ 350 | Continue sprint cadence |
| 🟡 **Amber** | 1,314–1,444 | 351–385 | Freeze P2 tasks, tighten cadence |
| 🔴 **Red** | ≥ 1,445 | ≥ 385 | Apply cost-down bundle (P1–P3) |

### Cost-Down Action Priority (If Red Triggered)
| Priority | Action | Monthly savings | Weekly savings | Owner |
|----------|--------|-----------------|-----------------|-------|
| **P1** | Enforce CR1/CR2 sequential pooling | 338 SAR | 78 SAR | CEO |
| **P2** | Suspend 4 non-critical agents | 256 SAR | 59 SAR | CEO |
| **P3** | Cap CEO heartbeat to 2/hour | 200 SAR | 46 SAR | CEO |
| **Combined** | All three actions | 794 SAR | 183 SAR | Post-action: 4,913 SAR/mo |

---

## 3) Revenue & Break-Even Targets

### Ramp-to-Profitability Timeline

**Current state:** No production revenue (pre-launch, beta testing phase)

**Break-even milestones:**
| Milestone | Renter spend/mo | Platform revenue | Status | Timeline |
|-----------|-----------------|------------------|--------|----------|
| **Minimum viable** | 1,000,000 SAR | 250,000 SAR | Need 250 renters @ 4k or 100 @ 10k | Q2 2026 |
| **Mid-case (100/100)** | 1,250,000 SAR | 312,500 SAR | Profitability target from DCP-592 | Q3 2026 |
| **Upside (100/100)** | 2,500,000 SAR | 625,000 SAR | 25,000 SAR avg spend/renter | Q3+ 2026 |

**Break-even monthly revenue:** 120,000 SAR
**Platform revenue @ break-even:** 120,000 SAR = 480,000 SAR in renter spend
**Renter count @ break-even (at 12,500 SAR avg):** 48 renters with moderate utilization

### Key Financial Ratios (at 100/100 scale)
| Metric | Value | Notes |
|--------|-------|-------|
| **Platform take rate** | 25% | Standard marketplace fee |
| **Gross margin** | 61.6% | At 12,500 SAR/renter avg (DCP-592) |
| **Payback period (from launch)** | 2–3 weeks | Assuming 20+ renters/week ramp |
| **CAC break-even** | 200–400 SAR/renter | Acceptable for 12,500+ SAR LTV |

---

## 4) Sprint 25 Financial Deliverables

### Committed (In Progress)
- ✅ Cost model for 100/100 scale (`DCP-592`, published 2026-03-23)
- ✅ Launch-week cost guardrails (`DCP-539`, published 2026-03-22)
- ✅ Cost-control action quantification (P1–P3 bundle)

### Next (To Track)
- Daily spend tracking once launch week begins (activate DCP-539)
- Weekly revenue tracking once beta renters onboard
- Cost-down action execution monitoring (if Red threshold hit)
- Provider utilization metrics (tie to platform revenue forecasts)

---

## 5) Financial Assumptions & Dependencies

### Fixed Cost Stack
- SaaS baseline: 2,956 SAR/mo (recurring tools, services)
- Infrastructure: 407 SAR/mo (VPS, domain, monitoring)
- **Non-negotiable** (locked for 6 months unless vendor changes)

### Agent API Cost (Variable)
- Current: 2,324 SAR/mo (post-DCP-266 downgrades to Haiku-class models)
- Upside: Further savings if agent frequency reduced via P1–P3 bundle
- Risk: Upside if technical debt forces return to Sonnet usage

### Launch-Week Assumptions
1. HTTPS/TLS blocker (`DCP-308`) clears within 48 hours
2. Launch week activates guardrail tracking
3. Revenue from beta renters begins flowing (modest ramp)
4. Cost-down actions (P1–P3) are **executable within 24 hours** if Red threshold hit

### Platform Revenue Assumptions
- 25% take rate (not negotiable; built into escrow contract)
- Renter spend averages 12,500 SAR/mo in first 6 months (conservative midpoint)
- Provider utilization stabilizes at 60% across 100-provider network
- No hidden channel costs or subsidy mechanisms post-launch

---

## 6) Financial Health Scorecard

| Category | Status | Trend | Action |
|----------|--------|-------|--------|
| **Burn rate control** | ⚠️ Over ceiling | ↗️ Improved via DCP-266 | Monitor weekly; apply P1–P3 if Red |
| **Revenue readiness** | 🔴 Zero | N/A | Begin beta renter onboarding post-launch |
| **Cost model accuracy** | 🟢 Validated | Stable | Update weekly post-launch with actual data |
| **Runway** | Unknown | Depends on funding | Assume 90+ days; trigger fundraising if < 30 |
| **Break-even path** | 🟡 Clear but narrow | ↗️ Improving | 48 renters @ 12.5k SAR/mo = profitability |

---

## 7) Sources & References

1. `docs/cost-model-100-providers-100-renters.md` (DCP-592) — Cost model validation + revenue sensitivity
2. `docs/reports/2026-03-21-1900-cost-control-report.md` (DCP-436) — Cost-control quantification post-DCP-266
3. `docs/reports/2026-03-22-launch-week-burn-guardrails.md` (DCP-539) — Weekly guardrails + P1–P3 actions
4. `docs/cost-reports/2026-Q2-projections-v2.md` — Fixed cost baseline and agent API rates
5. `docs/roadmap-to-production.md` — Product launch timeline and dependencies

---

## 8) Next Budget Analyst Heartbeat Checklist

- [ ] Check guardrail status once launch week starts (update weekly)
- [ ] Log any cost-down action triggers (P1, P2, P3) with timestamp
- [ ] Track beta renter onboarding progress against revenue targets
- [ ] Monitor provider utilization vs. profitability model
- [ ] Update runway estimates weekly if operating from runway (not funded)
- [ ] Escalate to CEO if revenue trends are 20%+ below model by week 2

