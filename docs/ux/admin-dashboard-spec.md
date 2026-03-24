# Admin Platform Dashboard — UX Specification

## Overview

The Admin Platform Dashboard is an executive view for the DCP founder/platform admins to monitor real-time platform health, revenue, provider performance, and system alerts. It answers critical operational questions:
- **How many active providers and renters?**
- **What is today's revenue and month-to-date revenue?**
- **Which providers are offline or problematic?**
- **Are there any blocked jobs or rate limit issues?**

---

## Access & Security

- **Route:** `/admin/dashboard`
- **Authentication:** Requires `DC1_ADMIN_TOKEN` header (Bearer token) in all requests
- **Authorization:** Only founder/admins with valid token can access
- **Session:** Token must be valid; expired tokens return 401 Unauthorized
- **Audit:** Log all access attempts (timestamp, token fingerprint, IP)

---

## Screen Layout

### 1. Header Section

- **Page Title:** "Platform Dashboard" (no Arabic required for admin-only view)
- **Refresh Interval Selector:** Dropdown: "Auto-refresh: 30s / 1m / 5m / Off"
- **Last Updated:** Timestamp (e.g., "Last updated 15s ago")
- **Manual Refresh Button:** Icon button to force immediate refresh
- **Date Range Selector (Optional):** Allow admin to view 7d / 30d / 90d / YTD data

---

### 2. KPI Row (Top Priority)

Five key metric cards displayed in a single row (responsive: wraps on smaller screens):

#### Card 1: Total Providers

- **Label:** "Total Providers"
- **Primary Value:** Active count (e.g., "23 active")
- **Secondary Value:** Registered count (e.g., "43 registered")
- **Badge:** Show percentage (e.g., "53% activated")
- **Icon:** Users/servers icon
- **Color:** Blue (#3b82f6)
- **Breakdown (on hover/click):**
  - Active (online, serving jobs)
  - Inactive (registered but offline)
  - Awaiting GPU verification

#### Card 2: Total Renters

- **Label:** "Total Renters"
- **Value:** Unique renter count (e.g., "187")
- **Subtext:** "This month" or "All time" toggle
- **Trend Indicator:** Up/down arrow + percentage change from last month
- **Icon:** Users/briefcase icon
- **Color:** Green (#10b981)

#### Card 3: Total Jobs Today

- **Label:** "Total Jobs Today"
- **Value:** Integer count (e.g., "456")
- **Subtext:** Shows time period (e.g., "00:00–23:59 SAR time")
- **Trend:** Display as "↑ 15% vs yesterday"
- **Icon:** Checkmark/task icon
- **Color:** Purple (#8b5cf6)

#### Card 4: Revenue Today (SAR)

- **Label:** "Revenue Today"
- **Value:** Large SAR amount (e.g., "1,234.56 SAR")
- **Subtext:** DCP's take (e.g., "DCP fee: 308.64 SAR @ 25%")
- **Trend:** Show percentage change vs. previous day
- **Icon:** Money/chart icon
- **Color:** Amber (#f59e0b)

#### Card 5: Revenue MTD (SAR)

- **Label:** "Revenue MTD"
- **Value:** Month-to-date SAR (e.g., "18,456.78 SAR")
- **Subtext:** "March 1–24" or current month
- **Burn Rate:** Show daily average (e.g., "~768 SAR/day avg")
- **Icon:** Calendar icon
- **Color:** Red (#ef4444)
- **Projection:** Show month-end projection if trend continues (e.g., "Est. 23,456 SAR by Mar 31")

---

### 3. Revenue Chart (Middle Section)

#### Title: "Daily Revenue (Last 7 Days)"

- **Chart Type:** Vertical bar chart with line overlay
- **X-Axis:** Last 7 days, labeled with dates (e.g., "Mon 17 Mar", "Tue 18 Mar", etc.)
- **Y-Axis:** SAR amount (auto-scaled)
- **Bars:**
  - Daily revenue (stacked or grouped if showing provider earnings vs. DCP take)
  - Color: Blue for total, or Blue/Green split (total / DCP take)
  - Hover tooltip: Exact SAR, job count, avg job value
- **Line Overlay (Optional):** 7-day moving average (gray line)
- **Empty Days:** Show zero with gray bar
- **Mobile:** Scrollable or condensed to 3 days

---

### 4. Provider Health Table (High Priority)

#### Title: "Top 10 Providers by Activity"

**Purpose:** Identify which providers are healthy and which need attention.

#### Table Headers:
Provider | GPU Model | Jobs Today | Uptime % | Earnings Today (SAR) | Status

#### Columns:

| Column | Content | Format | Example |
|--------|---------|--------|---------|
| **Provider** | Provider identifier (masked for privacy) | `PRV-XXXX` | `PRV-A7F2` |
| **GPU Model** | Primary GPU type | Text | `RTX 4090`, `H100` |
| **Jobs Today** | Number of jobs completed | Integer | `24` |
| **Uptime %** | Percentage of time online | `XX%` | `98.5%` |
| **Earnings Today** | Revenue generated for provider | `XXX.XX SAR` | `247.50 SAR` |
| **Status** | Visual indicator + badge | Icon + badge | 🟢 Online |

#### Row Styling:
- **🟢 Online (Uptime > 95%):** Green background tint
- **🟡 Degraded (Uptime 80–95%):** Yellow/amber tint
- **🔴 Offline (Uptime < 80%):** Red tint
- **⚠️ Pending Verification:** Gray tint

#### Row Actions (Hover Reveals):
- **View Details:** Opens provider detail panel showing:
  - Full provider ID
  - Registered date
  - Total jobs served (all time)
  - Total earnings (all time)
  - GPU specs (VRAM, compute capability)
  - Recent error logs (last 3)
  - Restart/maintenance options
- **Send Alert:** Option to send in-app message to provider
- **Disable/Suspend:** Admin action to temporarily disable provider (requires confirmation)

#### Empty State:
- If no providers active: "No active providers yet. Awaiting provider activation."

---

### 5. Recent Jobs Feed (Lower Section)

#### Title: "Recent Jobs (Last 20)"

**Purpose:** Monitor individual job executions and identify failures.

#### Display Format: Card Layout (not table)

Each card shows:

```
[Model Icon] LLM Model Name
Duration: 5m 23s | Tokens: 2,847 | Cost: 5.23 SAR
Renter: [Masked] | Provider: PRV-XXXX | Status: ✅ Completed
```

#### Card Fields:
- **Model:** Which LLM was executed
- **Duration:** Total GPU time
- **Tokens:** Processed token count
- **Cost:** SAR charged (or estimated if not yet settled)
- **Renter:** Masked identifier
- **Provider:** Provider identifier
- **Status:** Badge (✅ Completed, ⏳ In Progress, ❌ Failed, ⏸️ Cancelled)

#### Card Ordering:
- Newest first
- Status-based filtering: Show all / Show failed only / Show in progress

#### Pagination:
- Show 10 jobs per screen; "Load More" button at bottom
- Or scrollable infinite-scroll feed

#### Click to Expand:
- Show full job metadata:
  - Request ID
  - Full timestamps (submitted, started, completed)
  - Exact token breakdown (input/output)
  - Gas/settlement TX hash (if on-chain)
  - Error message (if failed)

---

### 6. Alert Panel (Right Sidebar or Below Jobs)

#### Title: "System Alerts"

**Purpose:** Highlight critical issues requiring immediate attention.

#### Alert Types:

| Alert Type | Severity | Example | Action |
|-----------|----------|---------|--------|
| **Blocked Jobs** | Critical | "3 jobs stuck in queue for >10m" | [View] |
| **Offline Providers** | High | "5 providers offline >1h" | [View Providers] |
| **Rate Limit Hits** | Medium | "2 renters hit API rate limits" | [View] |
| **Failed Settlements** | High | "1 payout transaction failed" | [Retry] |
| **GPU Verification Pending** | Medium | "8 providers awaiting GPU validation" | [Review Queue] |
| **Low Liquidity** | Medium | "DCP escrow balance < 50 SAR" | [Top-up] |

#### Alert UI:
- Each alert is a compact row/card
- **Icon:** Severity indicator (🔴 / 🟠 / 🟡)
- **Message:** Human-readable description
- **Timestamp:** When alert was first triggered
- **Action Button:** Context-specific action (View, Retry, Dismiss, etc.)
- **Dismiss:** Checkbox to acknowledge and hide alert

#### Alert History:
- "Show resolved alerts" toggle to view past alerts
- Archive old alerts after 24 hours

---

## Responsive Design

### Desktop (≥1440px)
- KPI row: 5 cards in single row
- Chart: Full width below KPIs
- Provider table: Full width, 10 visible rows
- Jobs feed: Below table, scrollable
- Alert sidebar: Right-aligned fixed panel (250px), sticky

### Tablet (768px–1439px)
- KPI row: 2–3 rows, cards stacked
- Chart: Full width
- Provider table: Full width, 5 visible rows, horizontal scroll for columns if needed
- Jobs feed: Below table
- Alert panel: Below jobs, full width

### Mobile (<768px)
- KPI row: Single column, stacked cards (auto-refresh off by default)
- Chart: Full width, 200px height, X-axis labels every 2 days
- Provider table: Card layout instead of table (swipe-able)
- Jobs feed: Card layout, infinite scroll
- Alert panel: Bottom sheet (swipe up to view)
- Refresh interval: Defaults to "5m" or "Off" to preserve battery

---

## Real-Time Updates & Performance

### Data Refresh Strategy
- **KPI Cards:** Refresh every 10 seconds
- **Chart:** Refresh every 30 seconds
- **Provider Table:** Refresh every 30 seconds
- **Jobs Feed:** Refresh every 10 seconds (or WebSocket push)
- **Alert Panel:** Real-time push (WebSocket) for critical alerts

### Caching
- Cache all data in browser (localStorage) with 60-second TTL
- Show cached data while fetching fresh data to avoid blank screens
- Indicate "cached" state with subtle badge if data is >30 seconds old

### Loading States
- Show skeleton loaders for cards/chart while fetching
- Fade in data when refresh completes
- Avoid full-page reload; update sections independently

### Error Handling
- If API fetch fails, show cached data with "offline" badge and retry button
- Toast notification for connection issues
- Graceful fallback to read-only view if admin token expires

---

## Accessibility

- **Color Contrast:** All text meets WCAG AA (4.5:1 or higher)
- **Status Indicators:** Use both color AND icons/text (not color alone)
  - ✅ / ❌ / ⏳ / ⚠️ symbols in addition to color
- **Keyboard Navigation:** Full tab-through of all interactive elements
- **Screen Reader:** Proper ARIA labels on charts, tables, and buttons
- **Focus Indicators:** Visible outline on all interactive elements
- **Tooltips:** All abbreviations (MTD, SAR, etc.) have hover/tooltip explanations

---

## Security & Data Protection

- **Token Validation:** Verify `DC1_ADMIN_TOKEN` on every request
- **Rate Limiting:** Rate-limit dashboard API endpoints to prevent DDoS
- **Data Masking:** Mask renter and provider IDs (show only last 4 chars or hash)
- **Sensitive Fields:** Don't log or expose wallet addresses in plain text
- **Audit Trail:** Log all admin dashboard accesses and actions taken (disable provider, etc.)
- **CSP Headers:** Strict Content Security Policy to prevent XSS
- **CORS:** Restrict dashboard to trusted origins only

---

## Future Enhancements

- **Custom Date Range Picker:** Allow admin to select any date range, not just fixed periods
- **Export Reports:** Download dashboard data as CSV/PDF for investor reporting
- **Predictive Alerts:** ML-based anomaly detection (e.g., unusual job failure rates)
- **Provider Geo Map:** Visualize geographic distribution of providers on a map
- **Pricing Adjustments:** UI to dynamically adjust platform fees or GPU pricing
- **Renter Segmentation:** Break down revenue by renter type (enterprise, student, hobbyist)
- **Cost Analysis:** Show DCP's costs (infrastructure, bandwidth, support) vs. revenue
- **Compliance Reports:** Generate PDPL/regulatory compliance logs on demand
