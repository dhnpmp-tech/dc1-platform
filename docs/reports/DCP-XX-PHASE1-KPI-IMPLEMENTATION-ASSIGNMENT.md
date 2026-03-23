# DCP-XX: Phase 1 KPI Implementation — Ready to Start

**Status:** 🔴 CRITICAL — Launch Blocker | 🟢 UNBLOCKED as of DCP-308 completion
**Date:** 2026-03-23
**Prepared by:** Budget Analyst
**Urgency:** Start immediately — blocking Phase 1 launch readiness

---

## Executive Summary

The admin finance dashboard is missing 4 critical KPIs required for Phase 1 launch-week cost control and operational visibility:

1. **GMV (Gross Merchandise Volume)** — total compute billed, foundation for all revenue metrics
2. **Break-Even Progress Bar** — visual indicator of cost control status (linked to DCP-539 guardrails)
3. **MRR Trend** — monthly revenue history for forecasting and growth tracking
4. **ARPU (Average Revenue Per Job)** — pricing health indicator

These are currently **NOT** displayed in `/app/admin/finance/page.tsx`.

**Blocker resolution:** DCP-308 (HTTPS/TLS) is now ✅ DONE. Phase 1 KPI implementation can begin immediately.

---

## Current State vs. Target

### What the Dashboard HAS ✅
- Total all-time revenue, DCP fees, provider payouts
- Today/This week/This month snapshots
- 14-day daily revenue bar chart
- Top 10 providers and renters
- Recent transaction table (15 items paginated)
- Renter balances and withdrawal tracking
- Billing discrepancy detection

### What the Dashboard IS MISSING 🔴
| KPI | Current State | Required for Launch | Data Available? |
|-----|---------------|---------------------|-----------------|
| **GMV** | Buried in `total_revenue` | Yes, explicit metric | ✅ Yes (`SUM(actual_cost_halala)`) |
| **Break-Even Progress Bar** | Not shown | Yes, critical for guardrails | ✅ Yes (gmv × 0.25 ÷ 5,707 SAR/mo burn) |
| **MRR Trend** | Only today/week/month snapshots | Yes, historical trend | ✅ Yes (aggregate by month) |
| **ARPU** | Not calculated | Yes, pricing health | ✅ Yes (`platform_revenue ÷ completed_jobs`) |

---

## Phase 1 KPI Priority & Implementation Detail

### 1. GMV — Gross Merchandise Volume [HIGH — Low Effort]

**What to implement:**
- Rename/enhance the current `total_revenue` stat card to explicitly label it as GMV
- Add breakdown showing GMV before platform fee deduction
- Link to 3-month historical trend

**Data source:** `/api/dc1/admin/finance/summary` already returns `all_time.total_revenue`

**Backend work:**
- Expose endpoint: `GET /api/admin/metrics/gmv?period=today,week,month,all_time`
- Return: `{ gmv_halala, gmv_sar, jobs_count, period }`

**Frontend work:**
- Update StatCard to use "Gross Merchandise Volume (GMV)" label
- Add tooltip explaining GMV = total compute billed before platform fee
- Display in SAR (already formatted via `halalaToSar()`)

**Effort:** 1–2 hours (backend + frontend)
**Owner:** Backend Engineer + Frontend Developer

---

### 2. Break-Even Progress Bar [CRITICAL — Medium Effort]

**What to implement:**
- Visual progress bar showing: `(GMV × 0.25) ÷ Monthly Burn Rate`
- Color-coded thresholds (linked to DCP-539 cost guardrails):
  - 🟢 Green: ≤100% (profitable)
  - 🟡 Amber: 100–150% (near guardrail, cost-down actions P1–P3 possible)
  - 🔴 Red: >150% (triggers mandatory cost-down actions)

**Data source:**
- GMV from above
- Monthly burn rate: 5,707 SAR/mo (from DCP-539 post-DCP-266)
- Formula: `break_even_ratio = (gmv × 0.25) ÷ 5,707`

**Backend work:**
- Expose: `GET /api/admin/metrics/break-even?period=today,week,month`
- Return: `{ ratio, percentage, status (green|amber|red), burn_rate_sar, platform_revenue_sar }`

**Frontend work:**
- Add new card with progress bar component (use existing recharts or build simple SVG)
- Show thresholds at 100%, 150%, 200% (cost overrun)
- Display text: "Break-even at {platform_revenue_sar} SAR/month. Current burn: {burn_rate_sar} SAR/month"
- Optional: Link to DCP-539 guardrails document

**Effort:** 2–3 hours (backend + frontend)
**Owner:** Backend Engineer + Frontend Developer

**Dependencies:**
- DCP-539 (cost guardrails) — already defined
- GMV implementation (above)

---

### 3. MRR Trend — Monthly Recurring Revenue [HIGH — Medium Effort]

**What to implement:**
- Line chart showing monthly DCP revenue over past 12 months
- Display month-over-month growth rate (%)
- Show forecast for next month (simple trend extrapolation)

**Data source:**
- Aggregate `(gmv × 0.25)` by completion month
- Requires historical data from `jobs` table

**Backend work:**
- Expose: `GET /api/admin/metrics/mrr?months=3,6,12`
- Return: `{ monthly_data: [{ month, revenue_sar, jobs_count, growth_pct }, ...] }`

**Frontend work:**
- Add time-series line chart using recharts (already imported in other parts of the app)
- Show month labels (abbreviated, e.g., "Mar", "Apr")
- Hover tooltip: `{month}: {revenue_sar} SAR ({growth_pct}% vs prev month)`
- Optional: Show simple linear forecast for next month

**Effort:** 3–4 hours (backend + frontend)
**Owner:** Backend Engineer + Frontend Developer

---

### 4. ARPU — Average Revenue Per Job [HIGH — Low Effort]

**What to implement:**
- Display current ARPU (SAR per job)
- Show 14-day trend (similar to daily revenue chart, but aggregated to days)
- Alert if ARPU drops >10% week-over-week

**Data source:**
- Platform revenue ÷ completed jobs = `(gmv × 0.25) ÷ job_count`
- Aggregate by day for trend

**Backend work:**
- Expose: `GET /api/admin/metrics/arpu?period=today,week,month`
- Return: `{ current_arpu_sar, daily_data: [{ date, arpu_sar, jobs_count }, ...], trend_14d: { pct_change, alert_threshold } }`

**Frontend work:**
- Add stat card with current ARPU
- Add 14-day trend chart (reuse daily revenue chart pattern)
- Show warning badge if ARPU dropped >10% this week
- Tooltip: "ARPU helps identify races to the bottom or pricing pressure"

**Effort:** 2–3 hours (backend + frontend)
**Owner:** Backend Engineer + Frontend Developer

---

## Implementation Order & Dependencies

**Week 1 (Before Launch-Week):**

1. **GMV** — Start first, unblocks everything else (1–2 hours)
2. **Break-Even Progress Bar** — Depends on GMV (2–3 hours)
3. **ARPU** — Independent (2–3 hours)
4. **MRR Trend** — Can run in parallel (3–4 hours)

**Timeline:** All 4 can be completed in parallel across 2 engineers (backend + frontend). Total effort: 8–12 hours combined.

**Critical path:** GMV → Break-Even (these drive launch readiness decision)

---

## API Response Schemas (Draft)

### GET /api/admin/metrics/gmv?period=today|week|month|all_time

```json
{
  "period": "today",
  "gmv_halala": 125000,
  "gmv_sar": 1250.00,
  "completed_jobs": 42,
  "timestamp": "2026-03-23T15:30:00Z"
}
```

### GET /api/admin/metrics/break-even?period=today|week|month

```json
{
  "period": "month",
  "ratio": 0.87,
  "percentage": 87,
  "status": "green",
  "burn_rate_sar": 5707,
  "platform_revenue_sar": 4965,
  "gmv_sar": 19860,
  "timestamp": "2026-03-23T15:30:00Z"
}
```

### GET /api/admin/metrics/mrr?months=12

```json
{
  "monthly_data": [
    { "month": "2025-04", "revenue_sar": 0, "jobs_count": 0, "growth_pct": null },
    { "month": "2026-03", "revenue_sar": 1245, "jobs_count": 98, "growth_pct": null }
  ],
  "forecast_next_month_sar": 2100,
  "timestamp": "2026-03-23T15:30:00Z"
}
```

### GET /api/admin/metrics/arpu?period=today|week|month

```json
{
  "period": "month",
  "current_arpu_sar": 12.70,
  "completed_jobs": 98,
  "daily_data": [
    { "date": "2026-03-23", "arpu_sar": 15.20, "jobs_count": 12 },
    { "date": "2026-03-22", "arpu_sar": 14.50, "jobs_count": 11 }
  ],
  "trend_14d_pct_change": -2.1,
  "alert_threshold_exceeded": false,
  "timestamp": "2026-03-23T15:30:00Z"
}
```

---

## Acceptance Criteria

✅ **GMV**
- Metric displayed as primary KPI on finance page
- Updates within 5-minute polling cycle
- Labeled clearly as "Gross Merchandise Volume (GMV)" with tooltip

✅ **Break-Even**
- Progress bar visible with color coding (green/amber/red)
- Text label shows current platform revenue vs. burn rate
- Thresholds at 100%, 150%, 200% marked on bar
- Updates within 5-minute polling cycle

✅ **MRR Trend**
- Line chart shows past 12 months of data
- Month labels visible on X-axis
- Hover tooltip shows revenue, job count, growth %
- Forecast for next month displayed

✅ **ARPU**
- Current ARPU displayed as stat card
- 14-day trend chart shows daily ARPU
- Alert badge shows if drop >10% week-over-week
- Tooltip explains ARPU significance

✅ **No Performance Degradation**
- Finance page load time remains <2s (currently ~30s refresh interval)
- New endpoints respond in <500ms
- No new database queries that require optimization

---

## Code Files to Modify

**Backend:**
- `backend/src/routes/admin.js` — add new `/api/admin/metrics/*` endpoints
- `backend/src/services/adminService.js` — add GMV, break-even, MRR, ARPU calculation logic
- Database queries (may need indexes if missing)

**Frontend:**
- `app/admin/finance/page.tsx` — add new metric cards and charts
- `app/components/ui/StatCard.tsx` — enhance if needed for break-even progress bar
- `app/lib/i18n.ts` — add translation keys for new KPI labels

---

## Testing Plan

1. **Unit tests:**
   - GMV calculation (total revenue = total jobs × avg cost)
   - Break-even ratio (gmv × 0.25 ÷ burn rate)
   - ARPU calculation (platform_revenue ÷ jobs)
   - MRR aggregation by month

2. **Integration tests:**
   - API endpoints return correct data for past/present periods
   - Performance: queries complete in <500ms
   - Data consistency: repeated calls return same data

3. **Manual smoke test:**
   - Load finance page in browser
   - Verify all 4 new KPIs display correctly
   - Trigger refresh (30s interval) and verify updates
   - Test with 0 revenue (no jobs yet) — graceful fallback

---

## Launch Readiness Gate

**Blocking condition:** All Phase 1 KPIs (GMV, Break-Even, MRR, ARPU) must be live and updating on the finance dashboard **before launch-week begins**.

**Who approves:** Backend Architect + Frontend Developer + Budget Analyst (verify calculations)

**Sign-off criteria:**
- [ ] All 4 KPIs displaying on finance page
- [ ] Data updates every 5–30 minutes (within polling interval)
- [ ] Break-even status is accurate to current spend
- [ ] No performance regressions

---

## Next Steps

1. **Create Paperclip issues:**
   - DCP-XX (Backend): Implement GMV, break-even, MRR, ARPU endpoints
   - DCP-XX (Frontend): Add KPI cards and charts to finance dashboard

2. **Assign to engineers:**
   - Backend Engineer (4–6 hours)
   - Frontend Developer (4–6 hours)

3. **Timeline:** Complete before DCP-308 closes (if not already closed)

4. **Reference:** See `docs/reports/2026-03-23-financial-kpi-implementation-roadmap.md` for full phase breakdown and Phase 2/3 KPI details.

---

**Prepared by:** Budget Analyst
**Source:** Financial KPI Implementation Roadmap (2026-03-23)
**Co-author:** DCP-539 (cost guardrails), DCP-308 (HTTPS/TLS blocking condition)
