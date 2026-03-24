# Provider Earnings Dashboard — UX Specification

## Overview
The Provider Earnings Dashboard is a real-time view for GPU providers to track their earnings, completed jobs, and payout status. It answers three critical questions:
- **How much have I earned?**
- **From which jobs?**
- **When can I withdraw?**

---

## Screen Layout

### 1. Header Section
- **Page Title:** "Earnings" (Arabic: الأرباح)
- **Last Updated:** Timestamp showing when earnings data was last refreshed (e.g., "Updated 2 min ago")
- **Refresh Button:** Manual refresh icon to sync latest job data

---

### 2. Summary Cards (Top Section)

Four key metric cards displayed in a 2×2 grid (responsive: 1×4 on mobile):

#### Card 1: Total Earned
- **Label:** "Total Earned" (Arabic: إجمالي الأرباح)
- **Value:** Large SAR amount (e.g., "1,245.50 SAR")
- **Subtext:** "All time" or "Since activation"
- **Icon:** Stacked coins or wallet icon
- **Color:** Green (#10b981)

#### Card 2: Pending Payout
- **Label:** "Pending Payout" (Arabic: الدفع المعلق)
- **Value:** Current withdrawal-eligible balance (e.g., "245.50 SAR")
- **Subtext:** Minimum for withdrawal shown if balance < 10 SAR (e.g., "Min 10 SAR to request")
- **Icon:** Clock/hourglass icon
- **Color:** Amber (#f59e0b)
- **State:** Balance >= 10 SAR → show "Request Payout" button below
- **ETH Equivalent:** Show estimated ETH equivalent based on current SAR/ETH rate (e.g., "≈ 0.0045 ETH")

#### Card 3: Jobs Completed
- **Label:** "Jobs Completed" (Arabic: الوظائف المكتملة)
- **Value:** Integer count (e.g., "47")
- **Subtext:** "This month" or "All time" toggle option
- **Icon:** Checkmark or task icon
- **Color:** Blue (#3b82f6)

#### Card 4: Average Tokens/Job
- **Label:** "Avg Tokens/Job" (Arabic: متوسط الرموز/الوظيفة)
- **Value:** Number (e.g., "2,847 tokens")
- **Subtext:** "Average transaction size"
- **Icon:** Network/nodes icon
- **Color:** Purple (#8b5cf6)

---

### 3. Earnings Chart (Middle Section)

#### Title: "Earnings Trend"
- **Time Range:** Last 30 days, always
- **Chart Type:** Vertical bar chart
- **X-Axis:** Dates (showing every 5 days or every week, depending on mobile/desktop)
- **Y-Axis:** SAR amount (auto-scaled)
- **Bars:**
  - One bar per day
  - Color: Green gradient (#10b981 to #059669)
  - Hover tooltip: Shows exact date and SAR earned that day
- **Empty Days:** Gray bars or no bar for days with zero earnings
- **Mobile:** Scrollable horizontally if needed

---

### 4. Request Payout Section (Prominent CTA)

**Visible only when balance >= 10 SAR**

- **Button Text:** "Request Payout" (Arabic: طلب السحب)
- **Button Style:** Primary action, green background, full-width on mobile
- **Button State:**
  - **Active** (balance >= 10 SAR): Clickable, leads to payout modal
  - **Disabled** (balance < 10 SAR): Grayed out with tooltip "Minimum 10 SAR required"
- **Modal on Click:**
  - Show withdrawal-eligible balance (e.g., "245.50 SAR")
  - Show estimated ETH equivalent (e.g., "≈ 0.0045 ETH")
  - Show withdrawal address (partially masked, e.g., "0x7f...a8C")
  - Show estimated processing time (e.g., "1-3 business days")
  - "Confirm Payout" button (requires checkbox: "I understand this is irreversible")
  - "Cancel" button

---

### 5. Job Breakdown Table (Lower Section)

#### Title: "Recent Jobs"
- **Table Headers:** Date | Model | Duration | Tokens | SAR Earned
  - Arabic headers on RTL layout
- **Rows:** Last 50 completed jobs, newest first
- **Pagination:** "Show 10 / 25 / 50 per page" dropdown; page controls at bottom
- **Sortable Columns:** Click header to sort (date, model, duration, tokens, SAR)

#### Column Details:

| Column | Content | Format | Example |
|--------|---------|--------|---------|
| **Date** | Job completion date + time | `DD/MM/YYYY HH:MM` (locale-aware) | `24/03/2026 14:32` |
| **Model** | LLM model name served | Text | `Nemotron-Nano` or `ALLaM-7B` |
| **Duration** | Total GPU time for job | `Xh YYm` or `ZZm` | `5m 23s` or `1h 12m` |
| **Tokens** | Total tokens processed (input+output) | Integer | `2,847` |
| **SAR Earned** | Payment for this job | `XX.XX SAR` | `5.23 SAR` |

#### Row Actions (Hover Reveals):
- **View Details Icon:** Expands row to show:
  - Request ID
  - Renter identifier (masked)
  - Full token breakdown (input/output)
  - Gas/fees if applicable

#### Empty State:
- Show when provider has zero completed jobs
- **Message:** "No jobs yet" (Arabic: لا توجد وظائف حتى الآن)
- **Subtext:** "Start serving requests to see your earnings. You can earn **0.02–0.12 SAR per job** depending on model and complexity."
- **Action Button:** "View Available Models" (links to provider dashboard model list)
- **Graphic:** Illustrated empty state (stacked money/laptop icon)

---

## Empty State (No Jobs Yet)

**Visible on first visit or before any jobs are completed**

- **Headline:** "Ready to earn?" (Arabic: جاهز لكسب المال؟)
- **Subtext:** "Once renters submit jobs to your GPUs, you'll see your earnings here. Based on our marketplace data, providers earn **10–50 SAR per day** at 70% utilization with current models."
- **Estimated Earnings Table:**
  | GPU Model | Utilization | Daily Earnings | Monthly Earnings |
  |-----------|-------------|----------------|------------------|
  | RTX 4090 | 70% | ~12.50 SAR | ~375 SAR |
  | RTX 4080 | 70% | ~8.75 SAR | ~263 SAR |
  | H100 | 70% | ~18.50 SAR | ~555 SAR |
- **Action:** "View My GPU Details" button (links to provider settings or GPU configuration page)

---

## Responsive Design

### Desktop (≥1024px)
- Summary cards: 2×2 grid
- Chart: Full width, 400px height
- Table: Full width, scrollable horizontally if needed

### Tablet (768px–1023px)
- Summary cards: 2×2 grid or 1×4 stacked
- Chart: Full width
- Table: Full width, condensed columns

### Mobile (<768px)
- Summary cards: 1×4 stacked (single column)
- Chart: Full width, 300px height, scrollable X-axis
- Table: Horizontal scroll or card layout (each job as a card)
- Buttons: Full width

---

## Localization & RTL Support

### Arabic (ar-SA) Layout
- **Page Direction:** RTL (right-to-left)
- **Cards:** Reversed grid order (top-right first on desktop)
- **Table Headers:** RTL text direction
- **Numbers:** SAR amounts displayed as "SAR XX.XX" (amount first, currency second in Arabic context)
- **Date Format:** DD/MM/YYYY (Arabic standard)

### Key Arabic Translations
- Earnings = الأرباح
- Pending Payout = الدفع المعلق
- Jobs Completed = الوظائف المكتملة
- Avg Tokens/Job = متوسط الرموز/الوظيفة
- Request Payout = طلب السحب
- Recent Jobs = الوظائف الأخيرة
- Minimum 10 SAR required = الحد الأدنى 10 SAR مطلوب

---

## Accessibility

- **Color Contrast:** All text meets WCAG AA standard (4.5:1 or higher)
- **Keyboard Navigation:** Full tab-through of all interactive elements
- **Screen Reader:** Proper ARIA labels on charts, buttons, and table headers
- **Focus Indicators:** Visible focus outline on all interactive elements
- **Form Fields:** Associated labels for any input fields in payout modal

---

## Performance & Real-Time Updates

- **Data Refresh:** Fetch latest earnings data every 30 seconds in background
- **Cache:** Cache earnings data locally (localStorage) with 60-second TTL
- **Loading States:** Show skeleton loaders for cards/chart while fetching
- **Error Handling:** If fetch fails, show cached data with "offline" badge; retry button available
- **Toast Notifications:** Success/error for payout requests

---

## Security Considerations

- **Sensitive Data:** Mask renter identifiers; show only masked wallet addresses
- **Payout Requests:** Require confirmation with checkbox + optional 2FA (if enabled on account)
- **Data Validation:** Server-side verification of all payout amounts before submission
- **Rate Limiting:** Limit payout requests to 1 per minute per provider

---

## Future Enhancements

- **Tax Reports:** Export earnings as CSV/PDF with year-to-date summaries
- **Referral Earnings:** Add section for earnings from referred providers (if applicable)
- **Performance Benchmarks:** Compare earnings vs. similar GPU models in marketplace
- **Withdrawal History:** Log of all past payout requests and settlement dates
