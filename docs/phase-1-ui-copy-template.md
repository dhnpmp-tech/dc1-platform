# Phase 1 UI Copy Template — Dashboard Microcopy

**Purpose:** Template for all UI copy needed in billing/earnings dashboards (SP25-004, SP25-005)

## Dashboard Page Structure

### Renter Billing Dashboard (SP25-004)

#### Page Header
- **Title:** "Billing & Usage"
- **Subtitle:** "Track your compute spending, API usage, and credits"

#### Summary Cards (Top Section)
```
Card 1: Total Spend (This Month)
- Label: "Total Spend"
- Value: "2,450 SAR"
- Subtitle: "vs 1,890 SAR last month (+29%)"
- Help text: "Sum of all inference jobs this calendar month"

Card 2: Credits Remaining
- Label: "Available Credits"
- Value: "3,200 SAR"
- Subtitle: "From 50 SAR welcome credit + top-ups"
- Help text: "Credit expires 7 days after topup unless renewed"

Card 3: API Usage (This Month)
- Label: "Tokens Processed"
- Value: "2.4M"
- Subtitle: "vs 1.8M last month"
- Help text: "Total input + output tokens across all models"

Card 4: Average Cost
- Label: "Avg Cost per 1K Tokens"
- Value: "0.89 SAR"
- Subtitle: "Best rate: Mistral 7B (0.80 SAR/1K)"
- Help text: "Weighted average across all models used"
```

#### Usage Table
- **Column 1:** Date (MM/DD)
- **Column 2:** Model Used (e.g., "Llama 3 8B")
- **Column 3:** Tokens (e.g., "45,320")
- **Column 4:** Duration (e.g., "2m 34s")
- **Column 5:** Cost (e.g., "40.4 SAR")
- **Column 6:** Status (✓ Complete, ⏳ Pending, ✗ Failed)

**Empty State (No usage yet):**
```
🚀 No inference jobs yet

You haven't submitted any jobs this month.
Get started with a simple inference request:

[View Quickstart Guide]
```

#### CTA Buttons
- **Primary:** "Add Credits" → Links to billing page
- **Secondary:** "View API Keys" → Links to key management
- **Tertiary:** "Download Invoice" → Exports CSV

---

### Provider Earnings Dashboard (SP25-005)

#### Page Header
- **Title:** "Earnings & Jobs"
- **Subtitle:** "Monitor your GPU earnings, job history, and provider metrics"

#### Summary Cards (Top Section)
```
Card 1: Total Earned (This Month)
- Label: "Earned This Month"
- Value: "8,450 SAR"
- Subtitle: "vs 5,230 SAR last month (+61%)"
- Help text: "Your 75% share of job fees (DCP takes 25% platform fee)"

Card 2: Active Jobs
- Label: "Jobs in Progress"
- Value: "2"
- Subtitle: "Est. completion in 3-5 min"
- Help text: "Jobs currently using your GPU"

Card 3: Utilization
- Label: "GPU Utilization"
- Value: "68%"
- Subtitle: "Optimal range: 60-80%"
- Help text: "Percentage of available GPU capacity currently in use"

Card 4: Provider Uptime
- Label: "Uptime"
- Value: "99.7%"
- Subtitle: "Last 7 days"
- Help text: "Percentage of time your provider was online and available"
```

#### Job History Table
- **Column 1:** Start Time (HH:MM)
- **Column 2:** Renter Model (e.g., "Llama 3 8B")
- **Column 3:** Duration (e.g., "1m 23s")
- **Column 4:** Tokens (e.g., "12,450")
- **Column 5:** Earning (e.g., "75 SAR")
- **Column 6:** Status (✓ Completed, ✗ Failed, ⊘ Cancelled)

**Empty State (No jobs yet):**
```
🟢 Ready to earn

Your daemon is online and waiting for jobs. 
You'll start earning as soon as renters submit inference requests.

[Check Daemon Status] [View Provider Guide]
```

#### Provider Metrics
- **Daemon Version:** "1.2.3"
- **GPU Memory:** "24GB / 24GB (100%)"
- **Cached Models:** "3 (Llama 3, Mistral 7B, SDXL)"
- **Network Status:** "🟢 Connected" or "🔴 Offline"

#### CTA Buttons
- **Primary:** "Withdraw Earnings" → Links to withdrawal flow
- **Secondary:** "Manage Cached Models" → Links to cache management
- **Tertiary:** "View Provider Logs" → Links to diagnostics

---

## Common UI Patterns

### Empty States
```
When no data:
🎯 [Large emoji/icon]
[Clear headline]
[One-sentence explanation]
[CTA button if applicable]
```

### Loading States
```
⏳ Refreshing billing data...
(Shows while fetching from API)
```

### Error States
```
❌ Failed to load dashboard
Something went wrong. Please try again.
[Retry] [Contact Support]
```

### Success Messages
```
✓ Withdrawal request submitted
Your earnings will arrive in 1-2 business days.
[Dismiss] [View Status]
```

### Help Text
- Always positioned below label
- Gray text (secondary color)
- 1-2 sentences max
- Explain what the metric means or why it matters

---

## Tone & Voice Guidelines

### For Renters
- **Tone:** Professional, reassuring, transparent
- **Focus:** Cost savings, clarity, control
- **Examples:**
  - "Only pay for time your job actually runs"
  - "No hidden fees or surprise charges"
  - "Save up to 50% compared to other marketplaces"

### For Providers
- **Tone:** Encouraging, rewarding, supportive
- **Focus:** Earning potential, transparency, simplicity
- **Examples:**
  - "Turn your unused GPUs into income"
  - "You keep 75% of every job fee"
  - "Automatic payments every week"

---

## Color & Symbol Coding

- ✓ **Green:** Success, complete, online
- ✗ **Red:** Error, failed, offline
- ⏳ **Gray:** Pending, in progress, loading
- ⊘ **Orange:** Cancelled, warning
- 🟢 **Green dot:** Status indicator (online)
- 🔴 **Red dot:** Status indicator (offline)

---

## Accessibility Requirements

- All icons have text labels
- Color is not the only differentiator
- Sufficient contrast (WCAG AA minimum)
- Help text linked to labels
- CTA buttons clear and descriptive

