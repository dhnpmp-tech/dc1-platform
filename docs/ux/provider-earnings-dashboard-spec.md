# UX Spec: Provider Earnings Dashboard
## Post-Activation Dashboard for Active Providers

**Issue:** DCP-809
**Component:** Provider portal — earnings dashboard (post-activation)
**Status:** Implementation-ready
**Last Updated:** 2026-03-24

---

## 1. Overview

After a provider activates their GPU (completes DCP-766 onboarding), they land on the **Earnings Dashboard** — the primary interface for monitoring real-time earnings, utilization, and job history.

**Key Metrics Displayed:**
- **Current Status:** Online/offline toggle + last heartbeat
- **Today's Earnings:** Halala + SAR with comparison to yesterday
- **This Month Earnings:** Cumulative total + trend chart
- **Jobs Served:** Count, completion rate, average tokens processed
- **GPU Utilization:** % of time earning vs idle
- **Projected Monthly Earnings:** Extrapolation at current utilization rate

**Goal:** Providers see real-time feedback on how much their GPU is generating, which drives:
1. Retention (seeing daily earnings = stickiness)
2. Optimization (providers adjust availability based on utilization trends)
3. Trust (transparent real-time calculations, no hidden fees)

---

## 2. Layout & Components

### 2.1 Main Dashboard Grid

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔴 Online/Offline Toggle | Last Heartbeat: 2m ago | ⚙️ Settings │
├─────────────────────────────────────────────────────────────────────┤
│                         STATUS CARDS ROW                            │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┐      │
│ │ Today        │ This Month   │ Utilization │ Projected    │      │
│ │ SR 45.23 ↑15%│ SR 892 ↓5%   │ 73% 🟢       │ SR 1,245/mo  │      │
│ │ +18 halala   │ +152 jobs    │ optimal     │ at 73% util  │      │
│ └──────────────┴──────────────┴──────────────┴──────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│                       EARNINGS TREND CHART                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Earnings Trend (30 Days)                       [7d][30d][90d]  │
│  │  SAR                                                            │
│  │  100┤                                ╱╲                         │
│  │     │         ╱╲              ╱╲  ╱  ╲                         │
│  │   50┤  ╱╲  ╱  ╲            ╱  ╲╱    ╲                        │
│  │     │ ╱  ╲╱    ╲          ╱          ╲                        │
│  │    0└─────────────────────────────────────────────────────    │
│  │      1   5   10   15   20   25   30                            │
│  └───────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        JOB STATISTICS                               │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┐      │
│ │ Total Jobs   │ Completed    │ Success Rate │ Avg Duration │      │
│ │ 1,247        │ 1,215 (97%)  │ 97.4%        │ 12m 34s      │      │
│ │              │              │              │              │      │
│ └──────────────┴──────────────┴──────────────┴──────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│  GPU HEALTH SNAPSHOT                                               │
│  ┌────────────────┬────────────────┬────────────────┐              │
│  │ Temperature    │ Free VRAM       │ Driver Version │              │
│  │ 62°C (good)    │ 8.2 GB / 24 GB  │ 550.120        │              │
│  │ ━━━━━━━━━━━━━━ │ ━━━━━━━━━━░░░░░ │ up-to-date ✓   │              │
│  └────────────────┴────────────────┴────────────────┘              │
├─────────────────────────────────────────────────────────────────────┤
│  RECENT JOBS (Last 5 completed)                      [View All]    │
│  ┌──────┬─────────────┬────────┬──────────┬──────────────┬────────┐│
│  │ Time │ Job Type    │ Status │ Duration │ Earned (SAR) │ Renter ││
│  ├──────┼─────────────┼────────┼──────────┼──────────────┼────────┤│
│  │ 12:45│ Chat (8B)   │ ✅Done │ 8m 34s   │ SR 12.45     │ anon.. ││
│  │ 11:20│ Embedding   │ ✅Done │ 2m 12s   │ SR 3.21      │ user.. ││
│  │ 10:05│ Chat (13B)  │ ✅Done │ 14m 23s  │ SR 18.90     │ org... ││
│  │ 09:15│ Image Gen   │ ✅Done │ 5m 45s   │ SR 7.68      │ lab... ││
│  │ 08:30│ Chat (8B)   │ ✅Done │ 11m 5s   │ SR 14.33     │ user.. ││
│  └──────┴─────────────┴────────┴──────────┴──────────────┴────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Status Header

**Purpose:** Quick reference for provider online status and system health

```
┌─────────────────────────────────────────────────────────┐
│ 🔴 Offline        Last Heartbeat: 2m ago    ⚙️ Settings │
└─────────────────────────────────────────────────────────┘
```

**Styling:**
- **Container:** Sticky header (100% width, padding 16px 24px), background #FFFFFF (light), border-bottom 1px #E5E7EB
- **Status Indicator:** Large circular badge (24px) with real-time status:
  - 🟢 **Online** (green, #10B981) — Last heartbeat < 5 min
  - 🟡 **Connecting** (amber, #F59E0B) — Last heartbeat 5-15 min
  - 🔴 **Offline** (red, #EF4444) — Last heartbeat > 15 min
- **Heartbeat Text:** Poppins 500, 14px, #6B7280 (gray)
- **Settings Icon:** Links to `/provider/settings` for GPU configuration

**States:**
- **Online & Healthy:** Green indicator + "Last heartbeat: {mins}m ago"
- **Connecting:** Amber indicator + "Reconnecting..." (pulse animation)
- **Offline:** Red indicator + "Last heartbeat: {hours}h {mins}m ago" + "Troubleshoot" link to docs

---

### 3.2 Status Cards Row (KPI Metrics)

**Purpose:** Glanceable summary of today's earnings, month's earnings, utilization, and projection

```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ TODAY'S EARNINGS │ THIS MONTH       │ GPU UTILIZATION  │ PROJECTED MONTH  │
│                  │                  │                  │                  │
│ SR 45.23         │ SR 892.00        │ 73% 🟢 Optimal   │ SR 1,245.00      │
│ ↑ 15% vs yest.   │ ↓ 5% vs prev mo. │ (18 hrs / 24 hrs)│ @ 73% utilization│
│                  │                  │                  │                  │
│ +18 h. today     │ +152 jobs this mo│ 🔥 Hot period:  │ Payback: 8.3 mo  │
│                  │                  │ 18:00-06:00 UTC  │ (RTX 4090)       │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

**Styling:**
- **Container:** 4-column grid, 100% width, gap 16px, padding 24px
- **Card Background:** #F9FAFB (light gray), border 1px #E5E7EB, border-radius 12px, padding 16px
- **Main Value:** Poppins 700, 28px, #1F2937 (dark)
- **Subtext:** Poppins 400, 14px, #6B7280 (gray)
- **Trend Arrow:** ↑ green (#10B981) or ↓ red (#EF4444), Poppins 600, 16px
- **Mobile:** Stacks to 2x2 grid on < 640px; single column on < 480px

**Data Binding:**
```typescript
interface StatusCard {
  todayEarningsSar: number;        // e.g., 45.23
  todayEarningsHalala: number;     // e.g., 4523
  todayTrendPct: number;           // e.g., +15 (positive is up, negative is down)
  monthEarningsSar: number;        // e.g., 892.00
  monthEarningsHalala: number;     // e.g., 89200
  monthTrendPct: number;           // e.g., -5
  gpuUtilizationPct: number;       // 0-100, e.g., 73
  utilStatus: 'poor' | 'good' | 'optimal'; // 0-50: poor, 50-75: good, 75+: optimal
  projectedMonthlySar: number;     // e.g., 1245.00
  gpuModel: string;                // e.g., "RTX 4090"
  gpuPaybackMonths: number;        // e.g., 8.3
}
```

---

### 3.3 Earnings Trend Chart (30-Day)

**Purpose:** Visual trend of daily earnings to spot patterns and utilization changes

```
  Earnings Trend (30 Days)          [7d] [30d] [90d]
  SAR
  100┤                            ╱╲
     │         ╱╲          ╱╲  ╱  ╲
   50┤  ╱╲  ╱  ╲        ╱  ╲╱    ╲
     │ ╱  ╲╱    ╲      ╱          ╲
    0└─────────────────────────────────
      1   5   10   15   20   25   30
```

**Styling:**
- **Canvas:** 100% width, max-height 200px, padding 24px, background #F9FAFB, border 1px #E5E7EB, border-radius 12px
- **Chart Type:** Pure SVG line chart with area fill (no external charting library)
- **Area Color:** #2563EB (blue) with 15% opacity
- **Line Color:** #2563EB (solid)
- **Axis Labels:** Poppins 400, 12px, #9CA3AF (light gray)
- **Grid Lines:** Horizontal only, dotted, 1px #E5E7EB
- **Tooltip (hover):** Appears on bar hover, shows date + amount in SAR + count of jobs

**Data Binding:**
```typescript
interface TrendPoint {
  date: string;              // e.g., "2026-03-24"
  earningsSar: number;       // e.g., 45.23
  jobsCompleted: number;     // e.g., 12
  utilization: number;       // 0-100, e.g., 73
}

// 30 days of trend data, newest first (reverse chronological)
trendData: TrendPoint[];
```

**Interaction:**
- **Period Toggle:** Buttons [7d] [30d] [90d] swap the chart data
- **Tooltip:** Shows exact values on hover (desktop) or tap (mobile)
- **Mobile:** Scrollable horizontally on < 640px

---

### 3.4 Job Statistics Cards

**Purpose:** Aggregate job performance metrics (success rate, average duration, token throughput)

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ TOTAL JOBS   │ COMPLETED    │ SUCCESS RATE │ AVG DURATION │
│ 1,247        │ 1,215 (97%)  │ 97.4%        │ 12m 34s      │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Styling:**
- Same card design as Status Cards (4-column grid, #F9FAFB background)
- **Main Value:** Poppins 700, 24px, #1F2937
- **Label:** Poppins 500, 14px, #6B7280
- **Success Rate:** Green (#10B981) if ≥95%, amber (#F59E0B) if ≥90%, red (#EF4444) if < 90%

**Data Binding:**
```typescript
interface JobStats {
  totalJobs: number;           // e.g., 1247
  completedJobs: number;       // e.g., 1215
  failedJobs: number;          // e.g., 32
  successRatePct: number;      // 0-100, e.g., 97.4
  avgDurationSeconds: number;  // e.g., 754 (12m 34s)
  totalTokensProcessed?: number; // optional, e.g., 1_234_567
}
```

---

### 3.5 GPU Health Snapshot

**Purpose:** Real-time hardware status to help diagnose issues early

```
┌────────────────────────────────────────────────────────────┐
│  GPU HEALTH SNAPSHOT                                       │
│  ┌──────────────────┬──────────────────┬──────────────────┐ │
│  │ Temperature      │ Free VRAM         │ Driver Version   │ │
│  │ 62°C (good)      │ 8.2 GB / 24 GB    │ 550.120          │ │
│  │ ━━━━━━━━━━━━━━ │ ━━━━━━━━━░░░░░   │ up-to-date ✓     │ │
│  │ [Troubleshoot]   │                   │                  │ │
│  └──────────────────┴──────────────────┴──────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**Styling:**
- **Container:** Full-width card, padding 24px, background #F9FAFB, border 1px #E5E7EB, border-radius 12px
- **3-Column Grid:** Equal width, gap 16px
- **Metric Label:** Poppins 500, 14px, #6B7280
- **Main Value:** Poppins 700, 18px, #1F2937
- **Status Indicator:** Small badge showing health status (🟢 good, 🟡 warning, 🔴 critical)
- **Progress Bar:** Visual representation of utilization (VRAM free %)

**Health Thresholds:**
| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Temp (°C) | <70 | 70-85 | >85 |
| Free VRAM (%) | >30% | 10-30% | <10% |
| Driver | current | 1 version old | 2+ old |

**Data Binding:**
```typescript
interface GpuHealth {
  temperatureCelsius: number;    // e.g., 62
  freeVramGib: number;           // e.g., 8.2
  totalVramGib: number;          // e.g., 24
  driverVersion: string;         // e.g., "550.120"
  driverStatus: 'current' | 'outdated' | 'old';
  gpuModel: string;              // e.g., "RTX 4090"
  lastUpdated: string;           // ISO timestamp
}
```

---

### 3.6 Recent Jobs Table

**Purpose:** Recent job history with earnings + renter context

```
┌──────┬──────────────┬────────┬──────────┬──────────────┬──────────────┐
│ TIME │ JOB TYPE     │ STATUS │ DURATION │ EARNED (SAR) │ RENTER       │
├──────┼──────────────┼────────┼──────────┼──────────────┼──────────────┤
│ 12:45│ Chat (8B)    │ ✅ Done│ 8m 34s   │ SR 12.45     │ user_5x9... │
│ 11:20│ Embedding    │ ✅ Done│ 2m 12s   │ SR 3.21      │ anon_12a... │
│ 10:05│ Chat (13B)   │ ✅ Done│ 14m 23s  │ SR 18.90     │ org_ai_lab  │
│ 09:15│ Image Gen    │ ✅ Done│ 5m 45s   │ SR 7.68      │ researcher  │
│ 08:30│ Chat (8B)    │ ✅ Done│ 11m 5s   │ SR 14.33     │ user_8k2... │
└──────┴──────────────┴────────┴──────────┴──────────────┴──────────────┘

[View All Jobs] → /provider/jobs (paginated, filterable by date/type/status)
```

**Styling:**
- **Container:** 100% width, padding 24px, background #FFFFFF, border 1px #E5E7EB, border-radius 12px
- **Table:** Responsive design
  - Desktop (>640px): Full table layout
  - Mobile (<640px): Stacked cards (one row per job) with horizontal scroll
- **Row Hover:** Background #F3F4F6 (light gray), cursor pointer → links to job detail
- **Status Icon:** ✅ = completed (green), ⏳ = in progress (amber), ❌ = failed (red)
- **Text:** Poppins 400, 14px; header: Poppins 600, 12px

**Data Binding:**
```typescript
interface RecentJob {
  jobId: string;              // e.g., "job_abc123"
  jobType: string;            // e.g., "chat", "embedding", "image", "train"
  modelName: string;          // e.g., "Llama 3 8B" or "SDXL"
  status: 'completed' | 'running' | 'failed'; // final status
  durationSeconds: number;    // e.g., 514
  earnedSar: number;          // e.g., 12.45
  earnedHalala: number;       // e.g., 1245
  renterIdentifier: string;   // anonymized: "user_5x9..." or "org_ai_lab"
  completedAt: string;        // ISO timestamp, formatted as HH:MM
  tokenCount?: number;        // optional
}

recentJobs: RecentJob[]; // last 5 completed
```

---

## 4. Empty & Error States

### 4.1 No Jobs Yet (First 24 Hours)

```
┌──────────────────────────────────────────────┐
│                                              │
│          🚀 No jobs yet                     │
│                                              │
│  Your GPU is online and waiting for         │
│  renters. Estimated first job in 24-48h.    │
│                                              │
│  [Share Provider URL] [View Instructions]  │
│                                              │
│  While waiting:                             │
│  • Add detailed description of your GPU     │
│  • Join the #providers Telegram channel     │
│  • Check system health (GPU temp, VRAM)     │
│                                              │
└──────────────────────────────────────────────┘
```

**Styling:** Centered card, 400px max-width, padding 32px, background #F0F9FF (light blue), border 2px dashed #2563EB

---

### 4.2 Offline for > 1 Hour

```
┌──────────────────────────────────────────────┐
│ 🔴 GPU Offline for 1h 23m                    │
│                                              │
│  Your GPU stopped responding. This impacts  │
│  your reputation & earning potential.       │
│                                              │
│  [Troubleshoot] [View Logs] [Contact Help] │
│                                              │
│  Common causes:                             │
│  • Network disconnection                    │
│  • Power loss or system crash               │
│  • Driver crash                             │
│  • High temperature shutdown                │
│                                              │
└──────────────────────────────────────────────┘
```

**Styling:** Red border (#EF4444), warning background #FEF2F2

---

## 5. Mobile Responsiveness

| Breakpoint | Behavior |
|-----------|----------|
| < 480px | Stack cards vertically (1 column), hide some metrics |
| 480-640px | 2-column grid for KPI cards, stacked job table |
| 640-1024px | 4-column KPI grid, scrollable job table |
| > 1024px | Full desktop layout |

---

## 6. Localization (Arabic RTL)

**RTL Flip Regions:**
- Status header: Icon position right → left
- Card grid: Direction RTL, all text + numbers right-aligned
- Chart: X-axis reversed (day 30 on left, day 1 on right)
- Table: Column order reversed (renter → earned → duration → status → type → time)
- All currency symbols: SAR position (prefix in AR, suffix in EN)

**Arabic Content:**
- "اليوم" (Today's Earnings) vs "Today"
- "هذا الشهر" (This Month) vs "This Month"
- All status labels and job types translated

---

## 7. Data API Binding

**Required Backend Endpoints:**

```typescript
// 1. Dashboard summary (status, today, month, projected, GPU health)
GET /api/provider/dashboard/summary
→ {
  provider_id: string;
  status: 'online' | 'offline' | 'connecting';
  last_heartbeat_at: ISO8601;
  today_earnings_sar: number;
  today_earnings_trend_pct: number;
  month_earnings_sar: number;
  month_earnings_trend_pct: number;
  utilization_pct: number;
  projected_monthly_sar: number;
  gpu_model: string;
  gpu_payback_months: number;
  gpu_health: {
    temp_celsius: number;
    free_vram_gib: number;
    total_vram_gib: number;
    driver_version: string;
  };
  job_stats: {
    total: number;
    completed: number;
    failed: number;
    success_rate_pct: number;
    avg_duration_seconds: number;
  };
}

// 2. Trend data (7, 30, or 90 days)
GET /api/provider/dashboard/trend?period=30d
→ {
  period: '7d' | '30d' | '90d';
  points: [
    { date: '2026-03-24', earnings_sar: 45.23, jobs: 12, util_pct: 73 },
    ...
  ];
}

// 3. Recent jobs (last 5)
GET /api/provider/dashboard/recent-jobs?limit=5
→ {
  jobs: [
    {
      job_id: string;
      job_type: string;
      model_name: string;
      status: 'completed' | 'running' | 'failed';
      duration_seconds: number;
      earned_sar: number;
      renter_id: string; (anonymized, e.g., "user_5x9...")
      completed_at: ISO8601;
      token_count?: number;
    },
    ...
  ];
}
```

---

## 8. Analytics & KPIs

| Event | Trigger | Purpose |
|-------|---------|---------|
| `dashboard_view` | Page loads | Track engagement |
| `status_toggled` | Provider clicks online/offline | Track active provider behavior |
| `settings_clicked` | Clicks settings gear | Track configuration intent |
| `view_all_jobs_clicked` | Clicks "View All Jobs" | Track drill-down patterns |
| `gpu_health_alarm` | GPU temp > 85°C or free VRAM < 10% | Track hardware issues |

**Target KPIs:**
- **Daily Active Providers:** % of registered providers online every day
- **Session Duration:** Avg time spent on earnings dashboard
- **Optimization Rate:** % of providers that adjust availability based on utilization trends

---

## 9. Accessibility

- **WCAG AA Compliant**
- **Color Contrast:** All text ≥ 4.5:1 ratio
- **Focus Management:** Keyboard navigation (Tab) through all interactive elements
- **Focus Visible:** 2px blue outline (#2563EB) on focused buttons
- **Labels:** All inputs labeled with `<label>` or `aria-label`
- **Status Indicators:** Not color-only (icons + text + badges)
- **Charts:** SVG chart has text description fallback; hover tooltips announced via `aria-live`
- **Screen Reader:** Proper heading hierarchy (h1, h2, h3); table headers `<th>`; status updates announced with `aria-live="polite"`

---

## 10. Related Components

- **Settings Page** (`/provider/settings`) — Configure GPU, withdraw earnings, profile
- **Jobs List** (`/provider/jobs`) — Full job history, filterable & paginated
- **Notifications** — Push alerts for offline status, high temp, large jobs accepted
- **Withdrawal Portal** (`/provider/withdraw`) — SAR withdrawal to bank account

---

## 11. Implementation Checklist

- [ ] `app/provider/earnings/page.tsx` — Main page component (already exists, validate against this spec)
- [ ] `components/dashboard/StatusHeader.tsx` — Online/offline toggle + heartbeat
- [ ] `components/dashboard/StatusCards.tsx` — KPI metrics (4-column grid)
- [ ] `components/dashboard/EarningsTrendChart.tsx` — 30-day SVG chart with period toggle
- [ ] `components/dashboard/JobStats.tsx` — Job statistics (total, completed, success rate, duration)
- [ ] `components/dashboard/GpuHealth.tsx` — Temperature, VRAM, driver status
- [ ] `components/dashboard/RecentJobs.tsx` — Last 5 jobs table with responsive layout
- [ ] `components/dashboard/EmptyState.tsx` — "No jobs yet" and "Offline" states
- [ ] **Backend:** `GET /api/provider/dashboard/summary` — Aggregate metrics
- [ ] **Backend:** `GET /api/provider/dashboard/trend?period=30d` — Trend data
- [ ] **Backend:** `GET /api/provider/dashboard/recent-jobs?limit=5` — Job history
- [ ] **Mobile Testing:** Verify responsive layout on < 640px
- [ ] **Arabic Testing:** RTL layout, translations, currency formatting
- [ ] **A11y Testing:** WCAG AA, keyboard nav, screen reader
- [ ] **Analytics:** Event tracking for dashboard_view, status_toggled, settings_clicked

---

## 12. Success Criteria

✅ **Complete when:**
1. All KPI metrics display with real-time updates (< 5s refresh)
2. Status header shows accurate online/offline status and last heartbeat
3. Earnings trend chart renders 7/30/90-day views without external charting library
4. Job statistics calculate success rate and average duration correctly
5. GPU health thresholds alert provider when temp > 85°C or free VRAM < 10%
6. Recent jobs table displays last 5 completed jobs with anonymized renter names
7. Empty states display correctly when no jobs completed or GPU offline
8. Mobile layout stacks properly on < 640px
9. Arabic RTL layout is correct (right-to-left text, column order reversed)
10. All buttons accessible via Tab key with visible focus state
11. WCAG AA color contrast ≥ 4.5:1 on all text
12. Backend APIs return data in < 500ms response time

---

**Author:** UI/UX Specialist
**Target Sprint:** Sprint 28
**Related Issues:** DCP-766 (provider onboarding), DCP-770 (earnings calculator), DCP-792 (model catalog)
**Status:** ✅ Implementation-ready
