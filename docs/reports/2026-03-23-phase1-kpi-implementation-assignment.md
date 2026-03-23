# Phase 1 KPI Implementation Assignment — Critical Launch Blocker

**Status:** 🟢 UNBLOCKED (DCP-308 HTTPS/TLS now cleared) | 🔴 CRITICAL for Phase 1 launch-week
**Date:** 2026-03-23
**Prepared by:** Budget Analyst
**Urgency:** Start immediately

---

## Executive Summary

The admin finance dashboard is missing 4 critical KPIs required for Phase 1 launch-week cost control. The blocker (DCP-308) is now ✅ DONE.

**Missing KPIs:**
1. **GMV** (Gross Merchandise Volume) — total compute billed
2. **Break-Even Progress Bar** — cost control status, tied to DCP-539 guardrails  
3. **MRR Trend** — monthly revenue history for forecasting
4. **ARPU** (Average Revenue Per Job) — pricing health indicator

## Implementation Details

### 1. GMV (Gross Merchandise Volume)
- **Data source:** `SUM(actual_cost_halala)` from transactions
- **API:** `GET /api/admin/metrics/gmv?period=today|week|month|all_time`
- **Frontend:** Update StatCard to label "GMV", add tooltip
- **Effort:** 1–2 hours

### 2. Break-Even Progress Bar
- **Formula:** `(GMV × 0.25) ÷ 5,707 SAR/mo × 100%`
- **Color coding:** 
  - 🟢 Green: ≤100% (profitable)
  - 🟡 Amber: 100–150% (cost-down actions possible)
  - 🔴 Red: >150% (mandatory cost-down)
- **API:** `GET /api/admin/metrics/break-even`
- **Effort:** 2–3 hours

### 3. MRR Trend (Monthly Recurring Revenue)
- **Data source:** Aggregate GMV by month
- **API:** `GET /api/admin/metrics/mrr?months=12`
- **Frontend:** Line chart with month labels, hover tooltips, forecast
- **Effort:** 3–4 hours

### 4. ARPU (Average Revenue Per Job)
- **Formula:** `Platform Revenue ÷ Completed Jobs`
- **API:** `GET /api/admin/metrics/arpu?period=today|week|month`
- **Frontend:** Stat card + 14-day trend chart, alert if >10% drop
- **Effort:** 2–3 hours

## Implementation Timeline

**Total effort:** 8–12 hours (backend 4–6 hrs, frontend 4–6 hrs)

**Order of priority:**
1. GMV (foundation)
2. Break-Even (critical for launch)
3. ARPU (parallel)
4. MRR (parallel)

**Parallelization:** Backend Engineer + Frontend Developer can work simultaneously

## Code Files to Modify

**Backend:**
- `backend/src/routes/admin.js` — add new metric endpoints
- `backend/src/services/adminService.js` — add calculation logic

**Frontend:**
- `app/admin/finance/page.tsx` — add KPI cards/charts
- `app/components/ui/StatCard.tsx` — enhance if needed
- `app/lib/i18n.ts` — add translation keys

## Testing Plan

1. Unit tests: GMV, break-even, ARPU, MRR calculations
2. Integration tests: API endpoints, performance (<500ms)
3. Manual smoke test: Load dashboard, verify updates every 5–30 min

## Launch Readiness Gate

**All 4 KPIs must be live before launch-week begins**

Sign-off:
- ✅ GMV displaying and updating
- ✅ Break-even bar showing correct status
- ✅ MRR trend chart visible
- ✅ ARPU metric with trend
- ✅ No performance regressions

## References

- Full roadmap: `docs/reports/2026-03-23-financial-kpi-implementation-roadmap.md`
- Cost guardrails: `docs/reports/2026-03-22-launch-week-burn-guardrails.md` (DCP-539)
- Current dashboard: `app/admin/finance/page.tsx`

---

*Prepared by: Budget Analyst*
*Status: Ready for assignment and implementation*
*Last updated: 2026-03-23*
