# DCP-XX — Financial KPI Implementation Roadmap

**Date:** 2026-03-23
**Prepared by:** Budget Analyst
**Purpose:** Prioritized plan to implement missing financial KPIs in admin finance dashboard
**Target:** Activate KPI tracking before launch-week begins (post-DCP-308 HTTPS/TLS clearance)

---

## Overview

The admin finance page (`app/admin/finance/page.tsx`) currently lacks critical financial metrics identified in `docs/financial-model.md` Section 10. This roadmap prioritizes KPI implementation by business impact and engineering effort.

**Current state:** 8 KPI gaps identified (4 high-priority, 4 medium, 4 low-priority)

---

## Phase 1: High-Priority KPIs (Pre-Launch — Blocking)

These metrics are **essential** for launch-week cost control and break-even monitoring.

### 1.1 Gross Merchandise Volume (GMV)

| Aspect | Detail |
|--------|--------|
| **KPI Definition** | Total compute billed before platform fee deduction (SAR) |
| **Business Impact** | Primary marketplace health signal; foundation for all revenue metrics |
| **Current State** | Buried in revenue calculation; not exposed as standalone metric |
| **Data Source** | `SUM(actual_cost_halala)` on completed jobs → convert to SAR |
| **Affected File** | `app/admin/finance/page.tsx` |
| **Effort** | Low (1–2 hours) |
| **Owner** | Backend Engineer (expose via `/api/admin/metrics/gmv`) → Frontend Developer (display) |
| **Acceptance Criteria** | GMV displayed as primary metric; updates within 5-minute delay |
| **Target Launch** | Before launch-week (DCP-308 clearance) |

**Implementation steps:**
1. Add `calculateGMV()` function to backend metrics service
2. Expose via `/api/admin/metrics/gmv?period=today,week,month`
3. Display as top-line metric in finance page
4. Link to daily/weekly/monthly trends

---

### 1.2 Break-Even Progress Bar

| Aspect | Detail |
|--------|--------|
| **KPI Definition** | `(Monthly DCP Revenue ÷ Monthly Burn) × 100%` — visual distance to profitability |
| **Business Impact** | Critical for launch-week cost control; shows if cost-down actions (P1–P3) are needed |
| **Current State** | Not displayed; requires manual calculation from separate documents |
| **Data Source** | `GMV × 0.25` (DCP revenue) vs. `5,707 SAR/mo` (current burn from DCP-539) |
| **Affected File** | `app/admin/finance/page.tsx` |
| **Effort** | Low–Medium (2–3 hours) |
| **Owner** | Backend Engineer (hardcode burn rate or expose via config) → Frontend Developer |
| **Acceptance Criteria** | Progress bar displays; threshold markers for 25%, 50%, 75%, 100%, 150% (cost overrun) |
| **Target Launch** | Before launch-week (required for guardrail monitoring) |

**Implementation steps:**
1. Define thresholds in backend config (tied to DCP-539 guardrails)
2. Expose `breakEvenRatio()` endpoint that returns `(gmv×0.25) ÷ burn`
3. Display as progress bar with color coding (green <100%, red >100%)
4. Show text label with current burn rate and target

**Guardrail Integration (DCP-539):**
- Green: ≤100% (profitable)
- Amber: 100–150% (near guardrail)
- Red: >150% (triggers cost-down actions P1–P3)

---

### 1.3 Monthly Recurring Revenue (MRR) Trend

| Aspect | Detail |
|--------|--------|
| **KPI Definition** | DCP's monthly revenue (25% of GMV) tracked over time |
| **Business Impact** | Shows revenue acceleration; critical for forecasting provider break-even |
| **Current State** | Only spot figures; no historical trend |
| **Data Source** | Aggregate `(gmv × 0.25)` by month from completed jobs |
| **Affected File** | `app/admin/finance/page.tsx` (add time-series chart) |
| **Effort** | Medium (3–4 hours for time-series chart + data aggregation) |
| **Owner** | Backend Engineer (expose `/api/admin/metrics/mrr?months=3,6,12`) → Frontend Developer |
| **Acceptance Criteria** | Line chart showing MRR trend over past 12 months; month-over-month growth % displayed |
| **Target Launch** | Before launch-week (track ramp during first week) |

**Implementation steps:**
1. Add database query to aggregate monthly revenue (use job completion timestamp)
2. Expose `/api/admin/metrics/mrr?period_months=12`
3. Build time-series line chart (use existing recharts library)
4. Display growth rate and forecast for next month

---

### 1.4 Average Revenue Per Job (ARPU)

| Aspect | Detail |
|--------|--------|
| **KPI Definition** | `Total DCP Revenue ÷ Completed Jobs` (SAR per job) |
| **Business Impact** | Pricing health indicator; falling ARPU signals races to the bottom or discounting pressure |
| **Current State** | Not tracked; hidden in aggregate metrics |
| **Data Source** | `(SUM(actual_cost) × 0.25) ÷ COUNT(completed_jobs)` |
| **Affected File** | `app/admin/finance/page.tsx` |
| **Effort** | Low (1–2 hours) |
| **Owner** | Backend Engineer (expose ARPU endpoint) → Frontend Developer |
| **Acceptance Criteria** | ARPU displayed with historical trend (14 days); alert if ARPU drops >10% week-over-week |
| **Target Launch** | Before launch-week |

**Implementation steps:**
1. Calculate `ARPU = platform_revenue ÷ completed_jobs`
2. Expose `/api/admin/metrics/arpu?period=today,week,month`
3. Display current ARPU + trend chart
4. Implement alert threshold (>10% drop triggers warning)

---

## Phase 2: Medium-Priority KPIs (Launch Week → Week 1)

Important for operational efficiency, but not blocking launch.

### 2.1 GPU Utilization Rate

- **Definition:** `(Total GPU hours online ÷ Total GPU hours registered) × 100%`
- **Impact:** Core marketplace efficiency; drives profitability models
- **Data Source:** Aggregate provider heartbeat data
- **Target:** Within 7 days post-launch

### 2.2 Average Job Duration

- **Definition:** `AVG(job.end_time - job.start_time)` in minutes
- **Impact:** Validates pricing model accuracy; identifies inefficiencies
- **Data Source:** `jobs` table + execution metadata
- **Target:** Within 7 days post-launch

### 2.3 Provider Earnings Pending Payout

- **Definition:** `SUM(pending_withdrawals)` across all providers
- **Impact:** Cash liability; needed before payout infrastructure ships
- **Data Source:** `provider_payouts` table, filtered `status = 'pending'`
- **Target:** Before payout automation (Phase B)

### 2.4 Revenue Per Active Provider

- **Definition:** `Monthly DCP Revenue ÷ Active Provider Count`
- **Impact:** Supply-side efficiency; flags underperforming providers
- **Data Source:** GMV × 0.25 ÷ providers with heartbeat < 2h
- **Target:** Within 7 days post-launch

---

## Phase 3: Low-Priority KPIs (Post-Launch Optimization)

Nice-to-have metrics for future optimization.

- **Job Queue Depth:** Supply/demand imbalance indicator
- **Agent API Cost Burn:** Operational cost visibility (monthly Paperclip API spend)
- **Cost vs. Revenue Ratio:** Profitability metric for board reviews
- **Top GPU Models by Revenue:** Provider acquisition targeting

---

## Implementation Blockers & Dependencies

| Blocker | Status | Impact | Mitigation |
|---------|--------|--------|------------|
| **HTTPS/TLS clearance (DCP-308)** | 🔴 Blocking | Can't deploy any changes until launch gate clears | Await DCP-559 evidence bundle |
| **Payment gateway not live** | 🟡 Partial | MRR trend will show $0 until first renters fund accounts | Ship KPI infrastructure anyway; data will follow |
| **Provider payout infra not built** | 🟡 Partial | Can't verify provider earnings pending payout accuracy | Calculate but mark as "estimated pending payout system" |

---

## Rollout Timeline

| Phase | KPIs | Target Date | Status |
|-------|------|-------------|--------|
| **Phase 1** | GMV, Break-even, MRR, ARPU | Before launch-week (HTTPS clearance) | Blocked on DCP-308 |
| **Phase 2** | GPU util, Job duration, Provider earnings, Revenue/provider | Launch week + 7 days | Depends on Phase 1 |
| **Phase 3** | Queue depth, Agent cost, Margin ratio, GPU models | Post-launch optimization | No blockers |

---

## Success Metrics

- ✅ All Phase 1 KPIs deployed and updating in real-time before launch-week activates
- ✅ Break-even progress bar tied to DCP-539 guardrail thresholds
- ✅ MRR trend visible with >3 data points by end of launch week
- ✅ Admin can make cost-down decisions (P1–P3) based on live break-even metric

---

## Owner Assignment

| Phase | Owner | Effort | Status |
|-------|-------|--------|--------|
| **Phase 1** | Backend Engineer (API layer) + Frontend Developer (UI) | 8–10 hours combined | Pending assignment |
| **Phase 2** | Same team | 6–8 hours | Pending Phase 1 completion |
| **Phase 3** | Same team | 4–6 hours | Nice-to-have; defer post-launch |

---

## Sources & References

- `docs/financial-model.md` Section 10 (KPI gap analysis, original audit)
- `docs/reports/2026-03-22-launch-week-burn-guardrails.md` (DCP-539, guardrail thresholds)
- `app/admin/finance/page.tsx` (current implementation to extend)
- `docs/cost-model-100-providers-100-renters.md` (DCP-592, burn rate baseline: 5,707 SAR/mo)

---

_Prepared by: Budget Analyst_
_Co-authored with: DCP-539 (DCP-436 cost control insights)_
_Next step: Assign Phase 1 KPIs to Backend + Frontend engineers once HTTPS/TLS blocker (DCP-308) clears._
