# Phase 1 Provider Earnings Dashboard — UI Copy (SP25-005)
**Copywriter:** Copywriter Agent
**Status:** Production-Ready for Integration
**Date:** 2026-03-23
**Template:** docs/phase-1-ui-copy-template.md

---

## Dashboard Page Structure

### Page Header
```
Title:    "Earnings & Jobs"
Subtitle: "Monitor your GPU earnings, job history, and provider metrics"
```

---

## Summary Cards — Top Section

### Card 1: Total Earned (This Month)
```
Label:     "Earned This Month"
Value:     "{amount} SAR" (e.g., "8,450 SAR")
Subtitle:  "vs {last_month} SAR last month ({change}%)"
           Example: "vs 5,230 SAR last month (+61%)"
Help text: "Your 75% share of job fees (DCP takes 25% platform fee)"
Tooltip:   Hover to show: "Click 'Withdraw Earnings' to transfer to your bank account"
```

---

### Card 2: Jobs in Progress
```
Label:     "Jobs in Progress"
Value:     "{count}" (e.g., "2")
Subtitle:  "Est. completion in {time}"
           Example: "Est. completion in 3-5 min"
Help text: "Jobs currently using your GPU"
Tooltip:   Hover to show: "Active jobs use your GPU capacity. Monitor logs for any issues."
Status:    Green indicator (🟢) if > 0, Gray (⏳) if none
```

---

### Card 3: GPU Utilization
```
Label:     "GPU Utilization"
Value:     "{percent}%" (e.g., "68%")
Subtitle:  "Optimal range: 60-80%"
           Visual: Color-coded bar (green 60-80%, yellow 40-60%, red <40% or >90%)
Help text: "Percentage of available GPU capacity currently in use"
Tooltip:   Hover to show: "Higher utilization = higher earnings. Target 60-80% for balance."
Status:    Green (optimal), Yellow (acceptable), Red (investigate)
```

---

### Card 4: Provider Uptime
```
Label:     "Uptime"
Value:     "{percent}%" (e.g., "99.7%")
Subtitle:  "Last 7 days"
           Optional detail: "3 min downtime"
Help text: "Percentage of time your provider was online and available"
Tooltip:   Hover to show: "Offline = no earnings. Keep daemon running 24/7 for best results."
Alert:     If < 95% uptime this week, show: "⚠️ Your uptime is below target. Check daemon logs."
```

---

## Job History Table

### Table Header Row
```
Column 1:  "Start Time"
Column 2:  "Model"
Column 3:  "Duration"
Column 4:  "Tokens"
Column 5:  "Earning"
Column 6:  "Status"
```

### Example Data Row
```
Column 1:  "14:23" (HH:MM format, local time)
Column 2:  "Llama 3 8B" (model name from renter)
Column 3:  "1m 23s" (wall-clock time)
Column 4:  "12,450" (input + output tokens)
Column 5:  "75 SAR" (your earnings after 25% fee)
Column 6:  "✓ Completed" (green checkmark)
           OR "✗ Failed" (red X + reason in hover)
           OR "⊘ Cancelled" (orange slash)
```

### Table Row States

**Completed Job:**
```
Status: ✓ Completed
Icon:   Green checkmark
Color:  Light green background
Hover:  Show timestamps (started, ended), tokens/sec rate
CTA:    None
```

**Failed Job:**
```
Status: ✗ Failed
Icon:   Red X
Color:  Light red background
Hover:  Show error reason (e.g., "Out of memory", "Network timeout")
CTA:    [View Logs] link to provider logs page
```

**Cancelled Job:**
```
Status: ⊘ Cancelled
Icon:   Orange slash
Color:  Light orange background
Hover:  Show cancellation reason (e.g., "Renter cancelled")
CTA:    None
```

**In Progress Job:**
```
Status: ⏳ In Progress
Icon:   Animated hourglass
Color:  Light blue background
Duration: Live update (e.g., "45s elapsed, est. 30s remaining")
Progress bar: Visual indicator of completion
Hover:  Show live metrics (tokens processed so far, current utilization)
CTA:    None (read-only while in progress)
```

### Empty State (No Jobs Yet)
```
Icon:      🟢 (green circle, large)
Headline:  "Ready to Earn"
Body:      "Your daemon is online and waiting for jobs. You'll start earning as soon as renters submit inference requests."
CTA 1:     [Check Daemon Status]  → Links to /provider/settings#daemon
CTA 2:     [View Provider Guide]  → Links to docs/provider-guide.md
```

### Pagination/Infinite Scroll
```
Default view:    Last 50 jobs (24-hour window)
Load more:       "Load earlier jobs..." button at bottom
Sorting:         "Sort by: Latest, Highest Earning, Longest, Most Tokens"
Date filter:     "Last 24 hours, Last 7 days, Last 30 days, Custom range"
```

---

## Provider Metrics Section

### Subtitle
```
Text: "System Health & Configuration"
```

### Metrics Display

**Row 1: Daemon Version**
```
Label:  "Daemon Version"
Value:  "1.2.3" (semantic version)
Status: 🟢 "Up to date" OR ⚠️ "Update available (1.2.4)"
CTA:    If update available, show [Update Now] button
Help:   "Your provider daemon handles job execution and GPU management"
```

**Row 2: GPU Memory**
```
Label:  "GPU Memory"
Value:  "24GB / 24GB (100%)"
        Visual: Progress bar filled
Status: 🟢 "Healthy" OR 🟡 "Running low" (>85%) OR 🔴 "Critical" (>95%)
Help:   "Total VRAM allocated vs. available. High usage is normal during jobs."
Hover:  Show breakdown: "Models cached: 3.2GB, Active jobs: 8.1GB, Free: 12.7GB"
```

**Row 3: Cached Models**
```
Label:  "Cached Models"
Value:  "3 (Llama 3, Mistral 7B, SDXL)"
Size:   "Showing top 3 by recent use. View all →"
CTA:    [Manage Cache] → Opens cache management modal
Help:   "Pre-loaded models serve requests faster. More cache = faster start times."
Hover:  Show per-model cache size: "Llama 3: 5.1GB, Mistral 7B: 3.8GB, SDXL: 6.2GB"
```

**Row 4: Network Status**
```
Label:  "Network Status"
Value:  🟢 "Connected" OR 🔴 "Offline"
Status: Green (connected) OR Red (offline)
Uptime: "Last seen: 2m ago" OR "Offline for 4m"
Help:   "Connection status to DCP gateway. Offline = no jobs can be assigned."
CTA:    If offline > 5 min: [Troubleshoot] → Links to /help/daemon-offline
```

---

## Action Buttons

### Primary CTA
```
Text:    "Withdraw Earnings"
Style:   Solid button, brand color (blue)
Action:  Opens withdrawal flow modal
State:   Disabled if balance = 0 or < minimum ($10 equivalent)
Help:    "Transfer your SAR earnings to your bank account. Processed within 1-2 business days."
Tooltip: "Weekly payouts every Thursday at 2 PM UTC"
```

### Secondary CTA
```
Text:    "Manage Cached Models"
Style:   Outline button
Action:  Opens cache management modal (select/deselect models to cache)
State:   Always enabled
Help:    "Control which models to pre-load for faster serving"
```

### Tertiary CTA
```
Text:    "View Provider Logs"
Style:   Link button (text-only)
Action:  Navigate to /provider/logs
State:   Always enabled
Help:    "Debug daemon issues, view job execution details, check error logs"
```

---

## Modal: Withdrawal Flow

### Step 1: Confirm Amount
```
Title:     "Withdraw Earnings"
Label:     "Amount"
Default:   Full balance (e.g., "8,450 SAR")
Input:     Text field, allow custom amount (min $10 equivalent)
Subtitle:  "Your bank account: Saudi Riyals (SAR)"
Help:      "Withdrawal fee: < 1% (typical: 25-50 SAR)"
CTA 1:     [Withdraw] (primary, blue)
CTA 2:     [Cancel] (secondary, gray)
```

### Step 2: Processing
```
Status:    ⏳ Processing...
Message:   "Your withdrawal request has been submitted. You'll receive a confirmation email shortly."
Timeline:  "Expected arrival: 1-2 business days"
CTA:       [Close]
```

### Step 3: Success
```
Status:    ✓ Complete
Message:   "Withdrawal of {amount} SAR submitted successfully!"
Details:   "- Withdrawal ID: WD-20260323-12847"
           "- Amount: 8,425 SAR (after 25 SAR fee)"
           "- Destination: Account ending in •••• 1234"
           "- Estimated arrival: 1-2 business days"
CTA 1:     [Done] (primary, closes modal)
CTA 2:     [View Status] (secondary, links to withdrawal history)
```

---

## Modal: Manage Cached Models

### Title
```
"Cached Models Management"
Subtitle: "Models are pre-loaded on your GPU for faster serving. You have 15GB cache space."
```

### Model Checklist
```
☑ Llama 3 8B (5.1GB) — Last used: 2 hours ago
☑ Mistral 7B (3.8GB) — Last used: 1 day ago
☑ SDXL (6.2GB) — Last used: 1 week ago
☐ Qwen 2.5 7B (6.1GB) — Not cached
☐ Nemotron Nano (1.2GB) — Not cached
```

### Status
```
"Using 15.1GB of 24GB (63%)"
Progress bar showing allocation
```

### CTA
```
[Save Changes] (blue)
[Cancel] (gray)
```

### After Save
```
Success message: "✓ Cache configuration updated. Models will be refreshed within 30 seconds."
```

---

## Loading States

### Dashboard Loading
```
Skeleton loaders for:
- Page header (title/subtitle)
- Summary cards (4 cards with placeholder bars)
- Job history table (5 empty rows)
- Metrics section (4 metric rows)

Animation: Gentle pulse effect
Duration: Typical load: 500-1500ms
Fallback: "⏳ Loading your dashboard..." text
```

### Card Value Loading
```
While refreshing a single metric:
- Summary card shows previous value (faded)
- Spinner icon in corner
- "Updating..." text
```

### Table Data Loading
```
While paginating or filtering:
- Previous data stays visible (faded)
- Loading bar shows progress
- "Fetching jobs..." message
```

---

## Error States

### Dashboard Load Error
```
Icon:       ❌ (large, centered)
Headline:   "Failed to Load Dashboard"
Body:       "Something went wrong. Please try again."
CTA 1:      [Retry] (primary, blue)
CTA 2:      [Contact Support] (secondary, gray)
Details:    Show error code for support: "Error: ERR_DASHBOARD_LOAD_FAILED"
```

### Card Metric Error
```
Icon:       ⚠️ (in card header)
Headline:   "Unable to Load Earnings"
Body:       "Temporarily unavailable. Last known value: 8,450 SAR"
CTA:        [Retry] (text link)
Auto-retry: After 10 seconds
```

### Withdrawal Error
```
Icon:       ❌ (modal center)
Headline:   "Withdrawal Failed"
Body:       "We couldn't process your withdrawal at this time. Please try again."
Details:    "Error: Insufficient balance / Bank verification failed / Network error"
CTA 1:      [Try Again] (primary, blue)
CTA 2:      [Contact Support] (secondary, gray)
```

### Network Timeout
```
Icon:       🔴 (in relevant section)
Headline:   "Connection Lost"
Body:       "Unable to reach the provider service. Check your internet connection."
Auto-retry: Attempts every 5 seconds
CTA:        [Retry Now] (text link)
Status:     Shows "Last updated: 2 min ago"
```

---

## Success Messages

### Withdrawal Submitted
```
Type:      Toast notification (top-right, auto-dismiss after 5 seconds)
Icon:      ✓ (green)
Message:   "Withdrawal of 8,425 SAR submitted successfully"
Persist:   Link to view status (clickable toast)
```

### Cache Updated
```
Type:      Toast notification
Icon:      ✓ (green)
Message:   "✓ Cache configuration updated. Refreshing models..."
Duration:  5 seconds
```

### Settings Saved
```
Type:      Inline (below Save button)
Icon:      ✓ (green)
Message:   "Settings saved successfully"
Duration:  3 seconds, fade out
```

---

## Help Text & Tooltips

### Help Icons
```
Placement: To the right of each label (?)
Hover:    Shows tooltip
Click:    Opens detailed help panel (modal)
Content:  1-2 sentences explaining the metric
```

### Tooltip Examples

**"Earned This Month"**
```
Your 75% share of all job fees completed this calendar month.
DCP takes 25% as a platform fee. Click to learn more about our pricing.
```

**"GPU Utilization"**
```
What percentage of your GPU is currently processing jobs.
Target 60-80% for optimal earnings while maintaining stability.
If too high (>90%), you may experience lag or job failures.
```

**"Uptime"**
```
Percentage of the past 7 days your provider was online and available for jobs.
Higher uptime = more earnings. Target >99% for best results.
```

**"Jobs in Progress"**
```
How many renter jobs are currently using your GPU.
Each job occupies a portion of your GPU memory.
Monitor logs to ensure jobs complete without errors.
```

---

## Accessibility Requirements

### Color Contrast
- All text meets WCAG AA standard (4.5:1 for normal text)
- Success (green): #4CAF50
- Warning (orange): #FF9800
- Error (red): #F44336
- Status indicators have text labels (not color alone)

### Icons + Text
- ✓ All icons paired with text labels
- ✓ No color as only differentiator (e.g., red card also says "Failed")
- ✓ Icon tooltips accessible via keyboard

### Keyboard Navigation
- ✓ All buttons/links keyboard accessible (Tab order)
- ✓ Modal dialogs trap focus
- ✓ Close buttons always present
- ✓ Escape key closes modals

### Screen Readers
- ✓ Card values announced with units (e.g., "8,450 SAR")
- ✓ Table headers properly marked
- ✓ Form fields have associated labels
- ✓ Status messages announced (ARIA live regions)

### Focus Indicators
- ✓ Clear focus ring on all interactive elements
- ✓ Minimum 2px focus outline
- ✓ Sufficient contrast on focused state

---

## Tone & Voice

### Overall Tone
- **Encouraging:** Celebrate earnings and progress
- **Supportive:** Help troubleshoot issues
- **Transparent:** No hidden fees or surprises
- **Action-oriented:** Clear next steps

### Example Phrases

✅ **Good:**
- "You're earning! Continue this pace to reach $1,000 this month."
- "Your uptime is excellent. Keep it up!"
- "Cached models are ready. Serve requests faster today."

❌ **Avoid:**
- "Your uptime is 95%. That's bad." (replace with positive framing)
- "You made less than yesterday." (focus on opportunities instead)

---

## Integration Notes

**Ready for:**
- Frontend component development (React/Vue)
- Copy placement in design specs
- QA testing (all states, all messages)
- Localization (English → Arabic RTL)

**Dependencies:**
- Backend API: `/api/provider/earnings` (summary cards)
- Backend API: `/api/provider/jobs` (job history table)
- Backend API: `/api/provider/metrics` (system health)
- Backend API: `/api/withdrawals` (withdrawal flow)
- Backend API: `/api/cache/models` (cached models management)

**Testing Checklist:**
- [ ] All states tested (loading, success, error, empty)
- [ ] All modals tested (withdrawal, cache management)
- [ ] Keyboard navigation verified
- [ ] Screen reader tested
- [ ] Responsive breakpoints (mobile, tablet, desktop)
- [ ] Arabic/RTL layout verified

---

**EOF — Ready for DCP-614 integration. Provide to frontend team immediately.**
