# Phase 1 Renter Billing Dashboard — UI Copy (SP25-004)
**Copywriter:** Copywriter Agent
**Status:** Production-Ready for Integration
**Date:** 2026-03-23
**Template:** docs/phase-1-ui-copy-template.md

---

## Dashboard Page Structure

### Page Header
```
Title:    "Billing & Usage"
Subtitle: "Track your compute spending, API usage, and credits"
```

---

## Summary Cards — Top Section

### Card 1: Total Spend (This Month)
```
Label:     "Total Spend"
Value:     "{amount} SAR" (e.g., "2,450 SAR")
Subtitle:  "vs {last_month} SAR last month ({change}%)"
           Example: "vs 1,890 SAR last month (+29%)"
Help text: "Sum of all inference jobs this calendar month"
Tooltip:   Hover to show: "Only billable jobs included (excludes failed/cancelled)"
```

---

### Card 2: Credits Remaining
```
Label:     "Available Credits"
Value:     "{amount} SAR" (e.g., "3,200 SAR")
Subtitle:  "From 50 SAR welcome credit + top-ups"
           Example: "From 3,250 SAR in credits"
Help text: "Credit expires 7 days after topup unless renewed"
Tooltip:   Hover to show: "Credits expire automatically. Manage your credits at any time."
Status:    Show warning if < 100 SAR remaining: "⚠️ Low balance"
```

---

### Card 3: API Usage (This Month)
```
Label:     "Tokens Processed"
Value:     "{count}M" (e.g., "2.4M" or "156K" for smaller numbers)
Subtitle:  "vs {last_month}M last month ({change}%)"
           Example: "vs 1.8M last month (+33%)"
Help text: "Total input + output tokens across all models"
Tooltip:   Hover to show: "1M tokens = ~750 pages of text. Input tokens usually cheaper than output."
```

---

### Card 4: Average Cost per 1K Tokens
```
Label:     "Avg Cost per 1K Tokens"
Value:     "{amount} SAR" (e.g., "0.89 SAR")
Subtitle:  "Best rate: {model} ({rate} SAR/1K)"
           Example: "Best rate: Mistral 7B (0.80 SAR/1K)"
Help text: "Weighted average across all models used"
Tooltip:   Hover to show: "Calculated from: (total_spend / total_tokens) * 1000. Choose cheaper models to lower your average."
```

---

## Usage Table

### Table Header Row
```
Column 1:  "Date"
Column 2:  "Model"
Column 3:  "Tokens"
Column 4:  "Duration"
Column 5:  "Cost"
Column 6:  "Status"
```

### Example Data Row
```
Column 1:  "03/23" (MM/DD format)
Column 2:  "Llama 3 8B" (model name from provider)
Column 3:  "45,320" (input + output tokens)
Column 4:  "2m 34s" (wall-clock time)
Column 5:  "40.4 SAR" (total cost for this job)
Column 6:  "✓ Complete" (green checkmark)
           OR "✗ Failed" (red X + reason in hover)
           OR "⊘ Cancelled" (orange slash)
           OR "⏳ In Progress" (animated hourglass)
```

### Table Row States

**Completed Job:**
```
Status: ✓ Complete
Icon:   Green checkmark
Color:  Light green background
Hover:  Show full timestamps (started, ended), throughput (tokens/sec)
CTA:    [View Logs] link (if available)
```

**Failed Job:**
```
Status: ✗ Failed
Icon:   Red X
Color:  Light red background
Reason: Show error (e.g., "Out of memory", "Provider offline")
Hover:  Full error message and troubleshooting link
CTA:    [View Error Details] → Opens detailed error modal
```

**Cancelled Job:**
```
Status: ⊘ Cancelled
Icon:   Orange slash
Color:  Light orange background
Reason: Show cancellation reason (e.g., "User cancelled", "Timeout")
Hover:  Show when cancelled and refund status
CTA:    None (informational only)
```

**In Progress Job:**
```
Status: ⏳ In Progress
Icon:   Animated hourglass
Color:  Light blue background
Progress: Live update (e.g., "45s elapsed, est. 30s remaining")
Progress bar: Visual indicator showing completion percentage
Hover:  Show live metrics (tokens processed so far, current throughput)
Billing: "Billing in real-time — costs shown above as job completes"
CTA:    [Cancel Job] button (if applicable)
```

### Empty State (No Usage Yet)
```
Icon:      🚀 (rocket, large)
Headline:  "No inference jobs yet"
Body:      "You haven't submitted any jobs this month. Get started with a simple inference request:"
CTA 1:     [View Quickstart Guide]  → Links to docs/quickstart.md
CTA 2:     [Browse Models]          → Links to marketplace/models
Helper:    "First 50 SAR is free with your welcome credit"
```

### Pagination/Sorting
```
Default view:    Last 50 jobs (30-day window, current month)
Load more:       "Load earlier jobs..." button at bottom
Sorting:         "Sort by: Latest, Most Expensive, Longest, Most Tokens"
Date filter:     "Last 7 days, Last 30 days, Custom range"
Model filter:    "Show all models / Filter by model"
Status filter:   "All jobs / Completed only / Failed only"
```

---

## Billing Summary Section

### Monthly Breakdown

**Subtitle:**
```
Text: "Spending by Model"
```

**Model Breakdown Table:**
```
Column 1: Model Name (e.g., "Llama 3 8B")
Column 2: Usage Count (e.g., "23 jobs")
Column 3: Total Tokens (e.g., "1.2M")
Column 4: Total Cost (e.g., "950 SAR")
Column 5: % of Total (e.g., "39%")

Example row visualization:
Llama 3 8B    | 23 jobs | 1.2M tokens | 950 SAR | ████░░░░ 39%
```

**Pie Chart Alternative:**
```
Visual representation of spending breakdown
Interactive: Click segment to drill down to jobs using that model
Legend shows: Model name, % of total, absolute cost
```

---

## Cost Estimation Section

### "Estimate Your Next Job" Calculator

**Subtitle:**
```
Text: "Plan your spending before submitting a job"
```

**Input Fields:**
```
1. Model Selection:
   Dropdown with all available models
   Shows: Model name, cost per 1K tokens, estimated load time

2. Input Tokens:
   Text field (numeric)
   Placeholder: "e.g., 2,000"
   Helper: "Typical OpenAI API request: 100-500 tokens"

3. Expected Output Tokens:
   Text field (numeric)
   Placeholder: "e.g., 500"
   Helper: "LLM-generated response, usually 20-40% of input"
```

**Estimated Cost Display:**
```
Bold headline: "Estimated Cost"
Value: "{amount} SAR"
Breakdown:
- Input: {input_tokens} tokens @ {rate}/1K = {input_cost} SAR
- Output: {output_tokens} tokens @ {rate}/1K = {output_cost} SAR
- Total: {total_cost} SAR

"Your available credits will cover this job."
OR "You'll need to add {shortfall} SAR in credits."
```

**CTA:**
```
[Submit Job] → Opens job submission interface
[Add Credits] → Links to billing page
```

---

## Action Buttons

### Primary CTA
```
Text:    "Add Credits"
Style:   Solid button, brand color (blue)
Action:  Opens credit top-up modal
State:   Always enabled
Help:    "Purchase credits to increase your spending limit"
```

### Secondary CTA
```
Text:    "View API Keys"
Style:   Outline button
Action:  Navigate to /account/api-keys
State:   Always enabled
Help:    "Manage your API keys for programmatic access"
```

### Tertiary CTA
```
Text:    "Download Invoice"
Style:   Link button (text-only)
Action:  Export current month's usage as CSV
State:   Disabled if no usage this month
Help:    "Export billing details for accounting or expense reports"
```

---

## Modal: Add Credits

### Step 1: Choose Amount
```
Title:     "Add Credits"
Label:     "Amount"
Input:     Currency field, SAR
Presets:   [100] [250] [500] [1000] buttons
Custom:    Checkbox to enter custom amount
Min:       50 SAR
Max:       50,000 SAR
Help:      "Credits are valid for 1 year from purchase"
```

### Step 2: Choose Payment Method
```
Options:
☐ Debit/Credit Card (VISA, Mastercard)
☐ Bank Transfer (Saudi IBAN)
☐ Stripe (if integrated)

Selected:  Show payment details form
Card:      Name, number, exp, CVV
Bank:      Account holder, IBAN, bank name
```

### Step 3: Review & Confirm
```
Summary:
- Amount: {amount} SAR
- Payment method: {method}
- Fee (if applicable): {fee} SAR
- Total: {total} SAR

Help text: "You will be charged {total} SAR. Credits never expire if used within 12 months."

CTA 1: [Confirm Purchase] (primary, blue)
CTA 2: [Cancel] (secondary, gray)
```

### Step 4: Processing
```
Status:    ⏳ Processing payment...
Message:   "Please wait while we verify your payment."
Timeout:   Show timeout message if > 30 seconds
```

### Step 5: Success
```
Status:    ✓ Payment Successful
Message:   "You've added {amount} SAR to your account"
Details:   "- Transaction ID: TXN-20260323-12847"
           "- Credits added: {amount} SAR"
           "- Available balance: {new_balance} SAR"
           "- Expires: {expiration_date}"
CTA 1:     [Continue] (primary, closes modal)
CTA 2:     [Download Receipt] (secondary)
```

### Failed Payment
```
Status:    ✗ Payment Failed
Message:   "We couldn't process your payment"
Error:     Show specific error (card declined, invalid account, etc.)
CTA 1:     [Try Again] (primary, blue)
CTA 2:     [Use Different Method] (secondary)
CTA 3:     [Contact Support] (tertiary, gray)
```

---

## Loading States

### Dashboard Loading
```
Skeleton loaders for:
- Page header (title/subtitle)
- Summary cards (4 cards with placeholder bars)
- Usage table (5 empty rows)
- Billing summary section
- Cost estimator

Animation: Gentle pulse effect
Duration: Typical load: 500-1500ms
Fallback: "⏳ Loading your dashboard..." text
```

### Table Data Refresh
```
While paginating or sorting:
- Previous data stays visible (faded)
- Loading spinner overlays table
- "Refreshing usage data..." message
```

### Card Value Update
```
While refreshing a metric:
- Previous value stays visible
- Spinner icon in corner
- "Updating..." subtitle
```

---

## Error States

### Dashboard Load Error
```
Icon:       ❌ (large, centered)
Headline:   "Failed to Load Dashboard"
Body:       "Something went wrong. Please try again."
Details:    "Error: ERR_DASHBOARD_LOAD_FAILED"
CTA 1:      [Retry] (primary, blue)
CTA 2:      [Contact Support] (secondary, gray)
```

### Payment Error
```
Icon:       ❌ (modal center)
Headline:   "Payment Failed"
Body:       "We couldn't process your payment"
Reason:     "Card declined / Invalid account / Network error"
CTA 1:      [Try Again] (primary, blue)
CTA 2:      [Use Different Method] (secondary)
CTA 3:      [Contact Support] (tertiary)
```

### API Load Timeout
```
Icon:       ⚠️ (warning)
Headline:   "Taking Longer Than Expected"
Body:       "Loading your usage data... Please wait or try again."
Auto-retry: After 10 seconds
CTA:        [Retry Now] (text link)
```

### Insufficient Credits
```
Icon:       ⚠️ (warning, in job submission context)
Headline:   "Insufficient Credits"
Body:       "You need {amount} SAR but have {balance} SAR available"
CTA 1:      [Add Credits] (primary, blue)
CTA 2:      [Cancel Job] (secondary)
```

---

## Success Messages

### Credits Added
```
Type:      Toast notification (top-right, auto-dismiss 5 seconds)
Icon:      ✓ (green)
Message:   "✓ {amount} SAR added to your account"
Persist:   Link to view balance
```

### Invoice Downloaded
```
Type:      Toast notification
Icon:      ✓ (green)
Message:   "✓ Invoice downloaded successfully"
Duration:  3 seconds, fade out
```

### Job Submitted Successfully
```
Type:      Toast notification or inline success state
Icon:      ✓ (green)
Message:   "✓ Job submitted successfully"
Details:   "Job ID: JOB-20260323-12847"
CTA:       [View Status] → Navigate to job details
```

---

## Help Text & Tooltips

### Help Icons
```
Placement: To the right of each label (?)
Hover:    Shows tooltip (2-second delay)
Click:    Opens detailed help panel
Content:  1-2 sentences explaining the metric
```

### Tooltip Examples

**"Total Spend"**
```
Sum of all completed inference jobs this calendar month.
Only successful jobs are included in this total.
Click for breakdown by model.
```

**"Available Credits"**
```
Credits you've purchased and have available to spend.
Credits expire 12 months after purchase if unused.
New user bonus: 50 SAR welcome credit (expires 7 days).
```

**"Tokens Processed"**
```
Total input + output tokens across all of your jobs.
Input tokens: your request to the model (usually cheaper).
Output tokens: model-generated response (usually more expensive).
```

**"Avg Cost per 1K Tokens"**
```
Weighted average of all models you used this month.
Llama models are usually cheaper than larger models.
Switch to cheaper models to lower your average cost.
```

**"Duration"**
```
Wall-clock time from job submission to completion.
Longer jobs (slow provider, large output) cost more.
Most inference jobs complete in 30-120 seconds.
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
- ✓ No color as only differentiator (e.g., red row also says "Failed")
- ✓ Icon tooltips accessible via keyboard
- ✓ Card status badges combine color + text

### Keyboard Navigation
- ✓ All buttons/links keyboard accessible (Tab order)
- ✓ Modal dialogs trap focus
- ✓ Close buttons always present
- ✓ Escape key closes modals
- ✓ Table rows navigable with arrow keys

### Screen Readers
- ✓ Card values announced with units (e.g., "2,450 SAR")
- ✓ Table headers properly marked
- ✓ Form fields have associated labels
- ✓ Status messages announced (ARIA live regions)
- ✓ Percentage breakdowns announced clearly

### Focus Indicators
- ✓ Clear focus ring on all interactive elements
- ✓ Minimum 2px focus outline
- ✓ Sufficient contrast on focused state

---

## Tone & Voice

### Overall Tone
- **Transparent:** Show exactly what you're paying for
- **Reassuring:** No hidden fees or surprises
- **Action-oriented:** Clear path to submit jobs or manage credits
- **Educational:** Help users understand costs and optimize

### Example Phrases

✅ **Good:**
- "Only pay for time your job actually runs"
- "Save up to 50% compared to other marketplaces"
- "Tokens are cheaper than you think—1M tokens is about 750 pages"
- "You're spending efficiently—good choice on model selection"

❌ **Avoid:**
- "Your bill is high." (replace with cost-saving suggestions)
- "You're using expensive models." (replace with "Try Mistral for savings")
- "Your credit is low." (replace with positive: "Time to refill credits")

---

## Pricing Transparency

### Cost Breakdown Always Visible
```
When showing a cost, always show:
- Input tokens @ rate = cost
- Output tokens @ rate = cost
- Total = cost

Never show just "40.4 SAR" without breakdown
```

### Cost Comparison
```
When user selects a model, show:
- This model: 0.89 SAR/1K tokens
- Cheaper alternative: Mistral 7B (0.80 SAR/1K) — 10% savings
- More powerful: GPT-4 equivalent (1.50 SAR/1K)
```

---

## Integration Notes

**Ready for:**
- Frontend component development (React/Vue)
- Copy placement in design specs
- QA testing (all states, all messages, all flows)
- Localization (English → Arabic RTL)

**Dependencies:**
- Backend API: `/api/billing/summary` (summary cards)
- Backend API: `/api/billing/usage` (usage table)
- Backend API: `/api/billing/models` (model pricing/breakdown)
- Backend API: `/api/credits/balance` (credits remaining)
- Backend API: `/api/credits/add` (credit top-up processing)
- Backend API: `/api/jobs/estimate` (cost estimation calculator)
- Backend API: `/api/invoices/download` (invoice export)

**Testing Checklist:**
- [ ] All summary cards tested with real data
- [ ] Usage table paginated, sorted, filtered
- [ ] Empty state tested (no usage)
- [ ] All modal flows tested (add credits, payment success/failure)
- [ ] Cost estimator tested with various models
- [ ] Error states tested (API timeouts, payment failures)
- [ ] Keyboard navigation verified
- [ ] Screen reader tested
- [ ] Responsive breakpoints (mobile, tablet, desktop)
- [ ] Arabic/RTL layout verified
- [ ] Copy shows real currency amounts (SAR)

**Edge Cases:**
- [ ] User with zero balance / zero usage
- [ ] User with expired credits
- [ ] User on free tier (no add credits option, or upgrade CTA)
- [ ] API timeout during job submission
- [ ] Failed payment mid-flow

---

**EOF — Ready for SP25-004 integration. Provide to frontend team immediately.**
