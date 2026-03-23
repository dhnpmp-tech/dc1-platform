# Phase 1 KPI Implementation Assignment — Critical Launch Blocker

**Status:** 🟢 UNBLOCKED (DCP-308 HTTPS/TLS now cleared) | 🔴 CRITICAL for Phase 1 launch-week
**Date:** 2026-03-23 (20:15 UTC)
**Prepared by:** Budget Analyst
**Urgency:** Start immediately — blocking Phase 1 launch readiness

---

## Executive Summary

The admin finance dashboard is missing 4 critical KPIs required for Phase 1 launch-week cost control and operational visibility. The blocker (DCP-308 HTTPS/TLS) is now ✅ DONE, so implementation can begin immediately.

**Missing KPIs:**
1. **GMV** (Gross Merchandise Volume) — total compute billed, foundation for all revenue metrics
2. **Break-Even Progress Bar** — visual cost control status, linked to DCP-539 guardrails
3. **MRR Trend** — monthly revenue history for forecasting
4. **ARPU** (Average Revenue Per Job) — pricing health indicator

**What needs to happen:**
- Backend Engineer: Implement 4 new `/api/admin/metrics/*` endpoints (4–6 hours)
- Frontend Developer: Add KPI cards and charts to `/app/admin/finance/page.tsx` (4–6 hours)
- Testing: Unit tests for calculations + integration tests (1–2 hours)

**Timeline:** All 4 can be done in parallel. Must complete before launch-week begins.

---

## Current State vs. Required

### What the Dashboard HAS ✅
- Total all-time revenue, DCP fees, provider payouts
- Today/This week/This month snapshots
- 14-day daily revenue bar chart
- Top 10 providers and renters
- Recent transaction table
- Renter balances and withdrawal tracking
- Billing discrepancy detection

### What the Dashboard IS MISSING 🔴

| KPI | Status | Business Impact | Data Available? | Implementation Priority |
|-----|--------|-----------------|-----------------|------------------------|
| **GMV** | Not labeled | Foundation for all revenue metrics | ✅ `SUM(actual_cost_halala)` | P0 — High |
| **Break-Even Bar** | Not shown | Critical for guardrail monitoring | ✅ `gmv × 0.25 ÷ 5,707 SAR/mo` | P0 — Critical |
| **MRR Trend** | Only snapshots | Forecasting and growth tracking | ✅ Aggregate by month | P1 — High |
| **ARPU** | Not calculated | Pricing health indicator | ✅ `revenue ÷ jobs` | P1 — High |

---

## KPI Specifications

### 1. GMV (Gross Merchandise Volume) [P0 — Low Effort]

**Definition:** Total value of compute billed before platform fee deduction (SAR)

**Data source:** `SUM(actual_cost_halala)` from `transactions` table

**Backend work:**
```
GET /api/admin/metrics/gmv?period=today|week|month|all_time
Response: { gmv_halala, gmv_sar, jobs_count, timestamp }
```

**Frontend work:**
- Update StatCard to label "Gross Merchandise Volume (GMV)"
- Add tooltip: "Total compute billed before platform fee"
- Display in SAR format

**Acceptance:**
- ✅ Metric labeled explicitly as GMV
- ✅ Data updates every 5–30 minutes (polling cycle)
- ✅ All time periods available (today, week, month, all-time)

**Effort:** 1–2 hours

---

### 2. Break-Even Progress Bar [P0 — Critical]

**Definition:** Visual progress showing platform revenue vs. monthly burn rate
Formula: `(GMV × 0.25) ÷ 5,707 SAR/month × 100%`

**Color-coded thresholds (tied to DCP-539 guardrails):**
- 🟢 Green: ≤100% (profitable or approaching)
- 🟡 Amber: 100–150% (cost-down actions P1–P3 possible)
- 🔴 Red: >150% (mandatory cost-down actions triggered)

**Data source:** GMV (above) + burn rate from DCP-539

**Backend work:**
```
GET /api/admin/metrics/break-even?period=today|week|month
Response: {
  ratio: 0.87,
  percentage: 87,
  status: "green",
  burn_rate_sar: 5707,
  platform_revenue_sar: 4965,
  gmv_sar: 19860,
  timestamp
}
```

**Frontend work:**
- Add progress bar component (can use recharts or simple SVG)
- Show color coding based on percentage
- Display threshold markers at 100%, 150%, 200%
- Show text: "Break-even at {revenue} SAR/mo. Current burn: {burn} SAR/mo"

**Acceptance:**
- ✅ Progress bar visible with color coding
- ✅ Threshold markers clearly labeled
- ✅ Text explanation of current status
- ✅ Updates every 5–30 minutes

**Effort:** 2–3 hours
**Critical for:** Launch-week cost control decisions

---

### 3. MRR Trend [P1 — High]

**Definition:** Platform revenue (DCP's 25% cut of GMV) tracked monthly over past 12 months
Formula: `SUM(actual_cost_halala × 0.25) / 100 SAR per month`

**Data source:** Aggregate `transactions` by completion month

**Backend work:**
```
GET /api/admin/metrics/mrr?months=3|6|12
Response: {
  monthly_data: [
    { month: "2025-04", revenue_sar: 0, jobs_count: 0, growth_pct: null },
    { month: "2026-03", revenue_sar: 1245, jobs_count: 98, growth_pct: 0 }
  ],
  forecast_next_month_sar: 2100,
  timestamp
}
```

**Frontend work:**
- Add line chart using recharts (already in app dependencies)
- X-axis: month labels (abbreviated, e.g., "Mar", "Apr")
- Y-axis: revenue in SAR
- Hover tooltip: `{month}: {revenue} SAR ({growth}% vs prev)`
- Optional: Show linear forecast for next month

**Acceptance:**
- ✅ Line chart displays 12-month history
- ✅ Month labels visible and readable
- ✅ Hover tooltips show revenue + growth %
- ✅ Forecast calculation visible

**Effort:** 3–4 hours

---

### 4. ARPU (Average Revenue Per Job) [P1 — High]

**Definition:** DCP platform revenue per completed job (SAR/job)
Formula: `(Total Platform Revenue) ÷ (Total Completed Jobs)`

**Data source:** `SUM(actual_cost × 0.25) ÷ COUNT(jobs)`

**Backend work:**
```
GET /api/admin/metrics/arpu?period=today|week|month
Response: {
  current_arpu_sar: 12.70,
  completed_jobs: 98,
  daily_data: [
    { date: "2026-03-23", arpu_sar: 15.20, jobs_count: 12 },
    { date: "2026-03-22", arpu_sar: 14.50, jobs_count: 11 }
  ],
  trend_14d_pct_change: -2.1,
  alert_threshold_exceeded: false,
  timestamp
}
```

**Frontend work:**
- Add stat card showing current ARPU
- Add 14-day trend chart (reuse daily revenue chart pattern)
- Show warning badge if ARPU dropped >10% this week
- Tooltip: "ARPU helps identify pricing pressure or race-to-bottom conditions"

**Acceptance:**
- ✅ Current ARPU displayed prominently
- ✅ 14-day trend chart visible
- ✅ Alert badge shows if >10% drop week-over-week
- ✅ Updates every 5–30 minutes

**Effort:** 2–3 hours

---

## Implementation Order & Timeline

### Week 1 (Before Launch-Week)

**Priority order:**
1. **GMV** (1–2 hours) — unblocks everything else
2. **Break-Even** (2–3 hours) — depends on GMV, critical for launch
3. **ARPU** (2–3 hours) — independent, can run in parallel
4. **MRR** (3–4 hours) — can run in parallel

**Parallelization:**
- Backend Engineer: All 4 endpoints in sequence (backend/src/routes/admin.js)
- Frontend Developer: All 4 cards/charts in sequence (app/admin/finance/page.tsx)
- Both can work simultaneously

**Total effort:** 8–12 hours combined (4–6 backend, 4–6 frontend)

---

## Code Files to Modify

**Backend:**
- `backend/src/routes/admin.js` — add `/api/admin/metrics/gmv`, `/break-even`, `/mrr`, `/arpu`
- `backend/src/services/adminService.js` — add calculation functions
- Database queries (may need indexes if missing)

**Frontend:**
- `app/admin/finance/page.tsx` — add stat cards and charts
- `app/components/ui/StatCard.tsx` — enhance if needed for progress bar
- `app/lib/i18n.ts` — add translation keys

---

## Testing Plan

1. **Unit tests (backend):**
   - GMV calculation: `total_revenue = SUM(actual_cost_halala)`
   - Break-even: `(gmv × 0.25) ÷ 5,707 × 100%`
   - ARPU: `platform_revenue ÷ jobs`
   - MRR aggregation: monthly sums

2. **Integration tests:**
   - API endpoints return correct data for all time periods
   - Performance: queries complete in <500ms
   - Data consistency: repeated calls return same data

3. **Manual smoke test:**
   - Load finance page in browser
   - Verify all 4 KPIs display
   - Trigger refresh and verify updates
   - Test with 0 revenue (graceful fallback)

---

## Launch Readiness Gate

**Condition:** All 4 Phase 1 KPIs must be live and updating before launch-week begins

**Sign-off:**
- [ ] GMV displaying and updating
- [ ] Break-even bar showing correct status
- [ ] MRR trend chart visible with 3+ months data
- [ ] ARPU metric displaying with trend
- [ ] No performance regressions
- [ ] All APIs responding in <500ms

**Who approves:** Backend Architect + Frontend Developer + Budget Analyst

---

## References

- Full roadmap: `docs/reports/2026-03-23-financial-kpi-implementation-roadmap.md`
- Cost guardrails: `docs/reports/2026-03-22-launch-week-burn-guardrails.md` (DCP-539)
- Blocker cleared: DCP-308 (HTTPS/TLS) — ✅ DONE
- Current dashboard: `app/admin/finance/page.tsx`

---

## Next Action

**Create Paperclip issues immediately:**
1. DCP-XXX (Backend): Implement 4 KPI metric endpoints
2. DCP-XXX (Frontend): Add KPI cards and charts to finance dashboard
3. DCP-XXX (QA): Test KPI calculation accuracy and performance

**Assign to:** Backend Engineer + Frontend Developer

**Timeline:** Complete all 4 before launch-week begins

---

*Prepared by: Budget Analyst*
*Status: Ready for assignment and implementation*
*Last updated: 2026-03-23 20:15 UTC*
