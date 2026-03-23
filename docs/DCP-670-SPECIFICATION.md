# DCP-670: Phase 1 KPI Dashboard Implementation

**Status:** 🔴 CRITICAL | Ready to create in Paperclip
**Priority:** Critical
**Effort:** 8-12 hours (4-6 backend, 4-6 frontend)
**Deadline:** Must be live before 3/29 launch
**Blocker Cleared:** DCP-308 (HTTPS/TLS) ✅ DONE

---

## Problem Statement

Phase 1 launches 3/29. Admin dashboard is **missing 4 KPIs** needed for launch-week financial monitoring and cost control:
1. **GMV** (Gross Merchandise Value) — Total compute billed (SAR)
2. **Break-Even Progress %** — Cost control status tied to DCP-539 guardrails
3. **MRR Trend** — Monthly recurring revenue history
4. **ARPU** — Average revenue per job (SAR/job)

**Impact:** Without these KPIs, founder/admin cannot:
- Track launch-week revenue velocity
- Monitor break-even progress vs. SAR 5,707 monthly burn
- Make cost control decisions if revenue drops
- Validate provider economics and recruitment ROI

---

## Success Criteria

- [ ] All 4 KPI endpoints return correct data (unit tests pass)
- [ ] Admin dashboard displays all 4 metrics with live data
- [ ] Break-even status updates in real-time (green/amber/red zones)
- [ ] MRR trend shows 30-day historical data + trend line
- [ ] ARPU calculation matches invoicing logic (validates pricing)
- [ ] Tests pass (backend unit + frontend E2E)
- [ ] Dashboard deployed and tested against production API before 3/29

---

## Backend Implementation (4-6 hours)

### Database Schema (Existing)
Assumes standard transaction/job schema with:
- `transactions` table: `actual_cost_halala`, `created_at`, `job_id`
- `jobs` table: `id`, `status`, `created_at`, `customer_id`

### New Endpoints (add to `backend/src/routes/admin.js`)

#### 1. GET /api/admin/metrics/gmv

**Purpose:** Total compute billed (SAR)

**Request:**
```javascript
GET /api/admin/metrics/gmv?period=today|week|month|all_time
```

**Response:**
```json
{
  "period": "month",
  "gmv_halala": 1986000,
  "gmv_sar": 19860.00,
  "completed_jobs": 98,
  "timestamp": "2026-03-29T20:30:00Z",
  "trend": {
    "previous_period_sar": 15240,
    "percent_change": 30.4
  }
}
```

**Implementation:**
```javascript
// backend/src/services/adminService.js
async function calculateGMV(period = 'month') {
  const periodStart = getPeriodStart(period);
  const result = await db.query(
    `SELECT
      SUM(actual_cost_halala) as total_halala,
      COUNT(DISTINCT job_id) as job_count
    FROM transactions
    WHERE created_at >= $1 AND status = 'completed'`,
    [periodStart]
  );

  const gmv_sar = result.rows[0].total_halala / 100;
  const previous = await calculatePreviousPeriodGMV(period);

  return {
    period,
    gmv_halala: result.rows[0].total_halala,
    gmv_sar,
    completed_jobs: result.rows[0].job_count,
    timestamp: new Date().toISOString(),
    trend: {
      previous_period_sar: previous,
      percent_change: ((gmv_sar - previous) / previous * 100).toFixed(1)
    }
  };
}
```

**Testing:**
```javascript
// backend/tests/admin.metrics.gmv.test.js
describe('GET /api/admin/metrics/gmv', () => {
  it('returns GMV for current month', async () => {
    // Setup: insert test transactions
    // Assert: gmv_sar = sum / 100
  });
  it('filters by period (today, week, month, all_time)', async () => {
    // Test each period
  });
  it('includes trend calculation', async () => {
    // Verify percent_change is accurate
  });
});
```

---

#### 2. GET /api/admin/metrics/break-even

**Purpose:** Platform revenue vs. burn rate (cost control status)

**Request:**
```javascript
GET /api/admin/metrics/break-even?period=day|week|month
```

**Response:**
```json
{
  "period": "month",
  "gmv_sar": 19860,
  "platform_revenue_sar": 4965,
  "burn_rate_sar": 5707,
  "ratio": 0.87,
  "percentage": 87,
  "status": "green",
  "timestamp": "2026-03-29T20:30:00Z"
}
```

**Status Logic:**
- 🟢 **Green:** < 100% (revenue covers costs)
- 🟡 **Amber:** 100-150% (approaching burn)
- 🔴 **Red:** > 150% (burn exceeded, activate cost levers)

**Implementation:**
```javascript
// backend/src/services/adminService.js
async function calculateBreakEven(period = 'month') {
  const gmvData = await calculateGMV(period);
  const gmv_sar = gmvData.gmv_sar;
  const platform_revenue = gmv_sar * 0.25; // 25% platform take
  const burn_rate = 5707; // From DCP-539, monthly

  const ratio = platform_revenue / burn_rate;
  const percentage = Math.round(ratio * 100);

  let status = 'green';
  if (percentage >= 150) status = 'red';
  else if (percentage >= 100) status = 'amber';

  return {
    period,
    gmv_sar: Math.round(gmv_sar),
    platform_revenue_sar: Math.round(platform_revenue),
    burn_rate_sar: burn_rate,
    ratio: parseFloat(ratio.toFixed(2)),
    percentage,
    status,
    timestamp: new Date().toISOString()
  };
}
```

**Testing:**
```javascript
describe('GET /api/admin/metrics/break-even', () => {
  it('returns green when revenue > burn', async () => {
    // GMV = 30000 → Revenue = 7500 → ratio = 1.31 → 131% → green
  });
  it('returns amber when revenue = 100-150% of burn', async () => {
    // Test edge cases
  });
  it('returns red when revenue < burn', async () => {
    // GMV = 15000 → Revenue = 3750 → ratio = 0.66 → 66% → red
  });
});
```

---

#### 3. GET /api/admin/metrics/mrr

**Purpose:** Monthly recurring revenue history

**Request:**
```javascript
GET /api/admin/metrics/mrr?days=7|30|90
```

**Response:**
```json
{
  "period_days": 30,
  "data": [
    {
      "date": "2026-02-28",
      "mRR": 15240,
      "jobs": 82
    },
    {
      "date": "2026-03-01",
      "mRR": 16890,
      "jobs": 91
    },
    ...
  ],
  "current_mrr": 19860,
  "trend": "upward",
  "avg_daily_rate": 662,
  "timestamp": "2026-03-29T20:30:00Z"
}
```

**Implementation:**
```javascript
async function calculateMRR(days = 30) {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - days);

  const result = await db.query(
    `SELECT
      DATE(created_at) as date,
      SUM(actual_cost_halala) / 100 as daily_sar,
      COUNT(DISTINCT job_id) as job_count
    FROM transactions
    WHERE created_at >= $1 AND status = 'completed'
    GROUP BY DATE(created_at)
    ORDER BY date ASC`,
    [periodStart]
  );

  const data = result.rows.map(row => ({
    date: row.date,
    mRR: Math.round(row.daily_sar),
    jobs: row.job_count
  }));

  const current_mrr = data[data.length - 1]?.mRR || 0;
  const trend = determineTrend(data);

  return {
    period_days: days,
    data,
    current_mrr,
    trend,
    avg_daily_rate: Math.round(current_mrr / 30),
    timestamp: new Date().toISOString()
  };
}
```

---

#### 4. GET /api/admin/metrics/arpu

**Purpose:** Average revenue per inference job

**Request:**
```javascript
GET /api/admin/metrics/arpu?period=week|month|all_time
```

**Response:**
```json
{
  "period": "month",
  "total_revenue_sar": 19860,
  "completed_jobs": 98,
  "arpu_sar": 202.65,
  "by_gpu_model": {
    "RTX_4090": {
      "arpu": 350.00,
      "jobs": 12
    },
    "RTX_4080": {
      "arpu": 180.50,
      "jobs": 45
    },
    "H100": {
      "arpu": 450.00,
      "jobs": 8
    }
  },
  "timestamp": "2026-03-29T20:30:00Z"
}
```

**Implementation:**
```javascript
async function calculateARPU(period = 'month') {
  const periodStart = getPeriodStart(period);

  const result = await db.query(
    `SELECT
      SUM(actual_cost_halala) / 100 as total_sar,
      COUNT(job_id) as job_count,
      gpu_model,
      COUNT(job_id) as gpu_job_count
    FROM transactions
    WHERE created_at >= $1 AND status = 'completed'
    GROUP BY gpu_model`,
    [periodStart]
  );

  const total_revenue = result.rows.reduce((sum, row) => sum + row.total_sar, 0);
  const total_jobs = result.rows.reduce((sum, row) => sum + row.job_count, 0);
  const arpu = total_revenue / total_jobs;

  const by_gpu = {};
  result.rows.forEach(row => {
    by_gpu[row.gpu_model] = {
      arpu: (row.total_sar / row.gpu_job_count).toFixed(2),
      jobs: row.gpu_job_count
    };
  });

  return {
    period,
    total_revenue_sar: Math.round(total_revenue),
    completed_jobs: total_jobs,
    arpu_sar: parseFloat(arpu.toFixed(2)),
    by_gpu_model: by_gpu,
    timestamp: new Date().toISOString()
  };
}
```

---

## Frontend Implementation (4-6 hours)

### Dashboard Cards (add to `app/pages/admin/dashboard.tsx`)

#### 1. GMV Card

```tsx
<Card>
  <CardHeader>
    <h3>GMV (Gross Merchandise Value)</h3>
    <Select value={period} onChange={setPeriod}>
      <option>Today</option>
      <option>Week</option>
      <option>Month</option>
      <option>All Time</option>
    </Select>
  </CardHeader>
  <CardBody>
    <div className="metric-value">
      SAR {gmvData.gmv_sar.toLocaleString()}
    </div>
    <div className="metric-subtitle">
      {gmvData.completed_jobs} jobs completed
    </div>
    {gmvData.trend && (
      <div className={`trend ${gmvData.trend.percent_change > 0 ? 'up' : 'down'}`}>
        {gmvData.trend.percent_change > 0 ? '↑' : '↓'}
        {Math.abs(gmvData.trend.percent_change).toFixed(1)}% vs previous
      </div>
    )}
  </CardBody>
</Card>
```

#### 2. Break-Even Progress Bar

```tsx
<Card>
  <CardHeader>
    <h3>Break-Even Progress</h3>
    <span className={`status-badge ${breakEvenData.status}`}>
      {breakEvenData.status.toUpperCase()}
    </span>
  </CardHeader>
  <CardBody>
    <ProgressBar
      value={breakEvenData.percentage}
      max={150}
      status={breakEvenData.status}
    />
    <div className="metrics-row">
      <div>
        <label>Platform Revenue</label>
        <value>SAR {breakEvenData.platform_revenue_sar}</value>
      </div>
      <div>
        <label>Monthly Burn</label>
        <value>SAR {breakEvenData.burn_rate_sar}</value>
      </div>
      <div>
        <label>Status</label>
        <value>{breakEvenData.percentage}%</value>
      </div>
    </div>
    {breakEvenData.status === 'red' && (
      <Alert type="error">
        Revenue below burn rate. Consider activating cost control levers (DCP-539).
      </Alert>
    )}
  </CardBody>
</Card>
```

#### 3. MRR Trend Chart

```tsx
<Card>
  <CardHeader>
    <h3>MRR Trend (30 Days)</h3>
  </CardHeader>
  <CardBody>
    <LineChart
      data={mrrData.data}
      xKey="date"
      yKey="mRR"
      height={300}
    />
    <div className="metrics-row">
      <div>
        <label>Current Daily Rate</label>
        <value>SAR {mrrData.avg_daily_rate}</value>
      </div>
      <div>
        <label>Trend</label>
        <value>{mrrData.trend === 'upward' ? '↑ Upward' : '↓ Downward'}</value>
      </div>
    </div>
  </CardBody>
</Card>
```

#### 4. ARPU Card

```tsx
<Card>
  <CardHeader>
    <h3>ARPU (Revenue per Job)</h3>
  </CardHeader>
  <CardBody>
    <div className="metric-value">
      SAR {arpuData.arpu_sar}
    </div>
    <div className="metric-subtitle">
      Across {arpuData.completed_jobs} jobs
    </div>
    <Table>
      <thead>
        <tr>
          <th>GPU Model</th>
          <th>ARPU</th>
          <th>Jobs</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(arpuData.by_gpu_model).map(([model, data]) => (
          <tr key={model}>
            <td>{model}</td>
            <td>SAR {data.arpu}</td>
            <td>{data.jobs}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  </CardBody>
</Card>
```

---

## Testing Requirements

### Backend Tests
- [ ] Unit tests for all 4 endpoints (response schema validation)
- [ ] Data accuracy tests (GMV calculations, break-even logic)
- [ ] Edge cases (no data, partial periods, zero revenue)
- [ ] Performance tests (queries should return < 500ms)

### Frontend Tests
- [ ] E2E: Dashboard loads all 4 cards
- [ ] Cards update on period selector change
- [ ] Status colors (green/amber/red) display correctly
- [ ] Chart rendering (MRR trend line)
- [ ] Error handling (API failure, slow response)

### Integration Tests
- [ ] End-to-end: Data flows from DB → API → Dashboard
- [ ] Real production API test before launch

---

## Deployment Checklist

Before marking done:
- [ ] All endpoints tested against production database
- [ ] Dashboard deployed to staging environment
- [ ] Founder/admin team approval on KPI display
- [ ] Performance verified (page load < 2 seconds)
- [ ] Red flag alerts tested (revenue drop, burn exceeded)

---

## Success Metrics (Launch Week)

**KPI Dashboard should enable:**
1. Real-time visibility of GMV during launch week
2. Break-even progress tracking vs. DCP-539 guardrails
3. Early detection of customer churn (MRR trend decline)
4. Premium tier validation (ARPU by GPU model)
5. Cost control lever activation decisions within 1 hour of red status

---

## Reference Documents

- **Phase 1 Financial Validation:** `docs/finance/phase1-launch-financial-validation.md` (commit f7af860)
- **Phase 1 Monitoring Dashboard:** `docs/finance/phase1-launch-financial-monitoring-dashboard.md` (commit 9ec4708)
- **Cost Control Guardrails:** DCP-539 (burn rate SAR 5,707/month)
- **Provider Economics:** DCP-668 pricing commit a11ba53
- **Handoff Brief:** `/docs/reports/2026-03-23-phase1-kpi-implementation-handoff.md`

---

## Estimated Timeline

- **Day 1:** Backend implementation (4-6 hours)
- **Day 1:** Frontend implementation (4-6 hours, parallel)
- **Day 2:** Testing + integration
- **Day 3:** Staging deployment + founder approval
- **Pre-launch:** Production deployment + verification

---

**Status:** Ready for immediate assignment to Backend Engineer + Frontend Developer
**Effort:** 8-12 hours total
**Critical Path Item:** Must complete before 3/29 launch
