# Phase 2: Quick-Redeploy Feature — UX Specification

**Issue:** DCP-xxx (Phase 2 Quick-Redeploy UX Spec)
**Target Impact:** +25-30% repeat job rate (users rerun same jobs 70% faster)
**Timeline:** Sprint 28 (5-7 days)
**Dependency:** Phase 1 marketplace live with DCP-524 deployment

---

## Executive Summary

Quick-Redeploy eliminates friction from job resubmission. Instead of:
1. Browse templates / find the model again
2. Click deploy
3. Fill parameters (3-5 min)
4. Confirm & launch (1 min)

Users will:
1. View past job in "Job History"
2. Click "Redeploy" one-click button
3. Job runs with same params (30 sec)

**Target Users:** Data scientists, researchers, batch processors, developers testing inference
**Measurement:** Track "Redeploy" clicks, compare rerun time vs new job time, measure repeat rate delta

---

## Design System

All components use existing `dc1-*` design tokens:

- **Colors:** `dc1-primary` (action), `dc1-secondary` (secondary), `dc1-surface` (card bg), `dc1-text-primary`, `dc1-text-secondary`
- **Typography:** `dc1-sans-serif` (Inter/system), `dc1-mono` (monospace for params)
- **Spacing:** `dc1-spacing-sm` (4px), `dc1-spacing-md` (8px), `dc1-spacing-lg` (16px), `dc1-spacing-xl` (24px)
- **Radius:** `dc1-radius-sm` (4px), `dc1-radius-md` (8px)
- **Shadow:** `dc1-shadow-sm`, `dc1-shadow-md`

---

## User Flows

### 1. Access Point: Job History / Past Deployments

**Location:** User dashboard → "Job History" tab or "Past Deployments" section (TBD with Frontend)

**Components:**
- List of past jobs (paginated, 10/page)
- Columns: [Template Name] [Date] [Status] [GPU] [Cost] [Action Buttons]
- Action buttons: [View Details] [Redeploy] [Delete/Archive]

**Visual Hierarchy:**
```
┌─────────────────────────────────────────────────┐
│ Past Deployments                                │
├─────────────────────────────────────────────────┤
│ 1. Llama-3-8B Inference (Mar 22)   [Completed]  │
│    RTX 4090 • 2.5 hrs • $18.75                  │
│    [View] [Redeploy] [Archive]                  │
│                                                 │
│ 2. SDXL Image Gen (Mar 21)         [Completed]  │
│    H100 PCIe • 45 min • $12.50                  │
│    [View] [Redeploy] [Archive]                  │
│                                                 │
│ 3. Arabic RAG (Mar 20)             [Completed]  │
│    RTX 4090 • 3.2 hrs • $24.00                  │
│    [View] [Redeploy] [Archive]                  │
└─────────────────────────────────────────────────┘
```

**Interaction:**
- Hover over row: highlight background with `dc1-surface` + shadow
- Click [Redeploy]: trigger quick-deploy modal (below)
- Click [View Details]: show full job params + logs (existing flow)
- Click [Archive]: soft-delete from history (optional Phase 2.2)

---

### 2. Quick-Redeploy Modal Flow

**Modal Title:** "Redeploy: [Template Name]"
**Width:** 500px (tablet friendly)
**Backdrop:** Dark overlay (40% opacity)

#### Step 1: Confirm & Redeploy

**Display:**
```
┌──────────────────────────────────────────────┐
│ ✕                                            │
│ Redeploy: Llama-3-8B Inference               │
├──────────────────────────────────────────────┤
│                                              │
│ 📋 Job Configuration                         │
│ ─────────────────────────────────────────── │
│                                              │
│ Template: Llama-3-8B Inference               │
│ GPU: RTX 4090 (24GB)                         │
│ Model: Llama 3 8B                            │
│ Max Tokens: 2048                             │
│ Temperature: 0.7                             │
│ Price: $0.25/min                             │
│                                              │
│ 💾 Saved Parameters                          │
│ ─────────────────────────────────────────── │
│ Previous cost: $18.75 (2.5 hrs)              │
│ Estimated cost: $6.25–$12.50 (25-50 min)   │
│                                              │
│ ⚠️  Modify Settings? [Advanced Options →]   │
│                                              │
│ [Cancel]  [Redeploy Now]                    │
└──────────────────────────────────────────────┘
```

**Components:**
- **Header:** Template name + icon + close button
- **Config Summary:** Non-editable display of GPU, model, key params (read-only)
- **Cost Estimate:** Show previous cost + estimated new cost range
- **Advanced Toggle:** "[Advanced Options →]" link to edit params (Phase 2.1 feature)
- **Buttons:**
  - [Cancel] — close modal
  - [Redeploy Now] — CTA button, triggers deployment

**Typography:**
- Template name: `dc1-text-lg` bold
- Labels: `dc1-text-sm` secondary
- Values: `dc1-text-md` mono (for technical params)

---

#### Step 2: Deployment In Progress

**Auto-show after [Redeploy Now] click:**

```
┌──────────────────────────────────────────────┐
│ ✕                                            │
│ Deploying: Llama-3-8B Inference              │
├──────────────────────────────────────────────┤
│                                              │
│ ⏳ Initializing deployment...                │
│ ────────────────────────────────────────── │
│ [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 25%  │
│                                              │
│ Status updates:                              │
│ ✓ GPU allocated (RTX 4090)                   │
│ ✓ Model loaded (18 sec)                      │
│ ⏳ Starting inference server...              │
│                                              │
│ Job ID: job-abc123def456                     │
│                                              │
│           [View Job Details]                 │
│                                              │
│ Cancel deployment? [Stop]                    │
└──────────────────────────────────────────────┘
```

**Components:**
- **Progress Bar:** Indeterminate or time-based (if historical avg known)
- **Status Log:** Bulleted list of recent steps, max 4 visible
  - ✓ for completed
  - ⏳ for in-progress
  - ✕ for failed (if error occurs)
- **Job ID:** Monospace, selectable for copy
- **View Details Button:** Opens job dashboard in new tab (Phase 1 feature)
- **Stop Button:** Red danger button to cancel (shows confirmation toast)

**Auto-dismiss:** After job reaches "running" state, show:
```
┌──────────────────────────────────────────────┐
│ ✅ Job Started Successfully!                 │
│                                              │
│ Job ID: job-abc123def456                     │
│ Status: Running                              │
│ GPU: RTX 4090 • $0.25/min                   │
│                                              │
│       [View Job] [Back to History] [Close]  │
└──────────────────────────────────────────────┘
```

**Auto-close after 5 sec if user doesn't interact.**

---

#### Step 3: Error State

**If deployment fails:**

```
┌──────────────────────────────────────────────┐
│ ✕                                            │
│ Deployment Failed                            │
├──────────────────────────────────────────────┤
│                                              │
│ ❌ GPU not available                         │
│                                              │
│ Reason: RTX 4090 temporarily unavailable.    │
│ Try: [1] Select different GPU [2] Retry     │
│      in 5 minutes [3] Contact support       │
│                                              │
│ Error Code: GPU_UNAVAILABLE_TEMPORARY        │
│ Timestamp: 2026-03-23 20:15:33 UTC          │
│                                              │
│ [Select Different GPU] [Try Again] [Close]  │
└──────────────────────────────────────────────┘
```

**Error Types & Messages:**
| Error | Message | CTA |
|-------|---------|-----|
| GPU_UNAVAILABLE_TEMPORARY | "RTX 4090 temporarily unavailable" | Retry or Select Different GPU |
| GPU_UNAVAILABLE_RETIRED | "RTX 4090 no longer offered" | Select Different GPU |
| INSUFFICIENT_BALANCE | "Insufficient credit balance ($5 needed, $2 available)" | Add Funds |
| REGION_UNAVAILABLE | "Template not available in selected region" | Select Different Region |
| MODEL_DEPRECATED | "Llama 3 8B no longer available" | Browse Similar Models |
| SERVER_ERROR | "Service temporarily unavailable" | Try Again or Contact Support |

---

## Advanced Options (Phase 2.1 — Later)

**Future enhancement:** Click "[Advanced Options →]" to edit parameters before redeploy:

```
┌──────────────────────────────────────────────┐
│ Advanced Options: Llama-3-8B Inference       │
├──────────────────────────────────────────────┤
│                                              │
│ GPU Selection:                               │
│ ○ RTX 4090 (prev) • $0.25/min               │
│ ○ RTX 4080 • $0.18/min (30% cheaper)        │
│ ○ H100 PCIe • $0.35/min (faster)            │
│                                              │
│ Model Parameters:                            │
│ Max Tokens: 2048 [slider]                    │
│ Temperature: 0.7 [slider]                    │
│ Top-P: 0.95 [slider]                        │
│                                              │
│ [Estimated Cost: $6.25–$12.50]              │
│                                              │
│ [Cancel] [Update & Redeploy]                │
└──────────────────────────────────────────────┘
```

**Scope:** Phase 2.1 or 2.2 (deferred from 2.0)

---

## Analytics & Measurement

### Metrics to Track

1. **Feature Adoption:**
   - % of users who access Job History per week
   - % of users who click "Redeploy" (goal: 40%+ of repeat users)
   - Redeploy CTR vs new job CTR

2. **Behavior:**
   - Avg time from "Redeploy click" to "job running" (target: <30 sec)
   - Rerun success rate (target: >95%)
   - Rerun frequency (goal: +25-30% vs no quick-redeploy baseline)

3. **Business:**
   - Revenue from repeat jobs (track separately)
   - Avg cost per redeploy vs new job
   - User retention (weekly active rerunners)

### Tracking Implementation

**Events to log:**
- `job.redeploy.viewed` — user views Quick-Redeploy modal
- `job.redeploy.started` — user clicks [Redeploy Now]
- `job.redeploy.success` — job reaches "running" state
- `job.redeploy.failed` — deployment failed with error code
- `job.redeploy.cancelled` — user clicked [Stop]
- `job.redeploy.advanced_options_opened` — user expanded advanced options (Phase 2.1)

---

## Accessibility & Mobile

### Keyboard Navigation

- **Tab order:** [Job list] → [Redeploy buttons] → [Modal controls] → [Cancel] → [Redeploy]
- **Enter key:** On [Redeploy] buttons or modal, trigger action
- **Esc key:** Close modal

### Mobile (< 768px)

- **Job History List:** Stack vertically, action buttons as secondary menu (⋮)
- **Modal:** Full-width, 90vh max-height, scrollable
- **Status Log:** Condensed to max 2 lines + "View All" link
- **Buttons:** Touch-friendly (48px min height)

### Screen Readers

- Modal labeled with `role="dialog"` aria-labelledby="modal-title"
- Status log announces updates via `aria-live="polite"`
- Buttons have descriptive labels: "Redeploy Llama-3-8B" not just "Redeploy"

---

## Responsive Design

### Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 768px | Full-width list, modal 90vw |
| Tablet | 768–1024px | 2-column layout (history + details) |
| Desktop | > 1024px | 3-column (sidebar + history + details) |

### Desktop Layout (> 1024px)

```
┌──────────────────────────────────────────────────┐
│                     DCP Marketplace               │
├────────────────────┬───────────────────────────┤
│ Sidebar            │ Job History               │
│ ─────────────────  │ ───────────────────────── │
│ Dashboard          │ 1. Llama-3-8B  [Redeploy] │
│ Job History ●      │ 2. SDXL Image  [Redeploy] │
│ Billing            │ 3. Arabic RAG  [Redeploy] │
│ Settings           │                           │
│                    │                           │
└────────────────────┴───────────────────────────┘
```

---

## Success Criteria for Implementation

✅ **Phase 2.0 (MVP):**
- [x] Job History list with past 20 jobs
- [x] [Redeploy] button on each job
- [x] Quick-Redeploy modal with config summary
- [x] One-click redeploy with same params
- [x] In-progress status + success confirmation
- [x] Error handling for common failures
- [x] Mobile responsive (full-width modal)
- [x] Analytics events tracked

✅ **Phase 2.1 (Iteration):**
- [ ] Advanced Options for param editing
- [ ] GPU selection override
- [ ] Pricing updates in real-time as params change

✅ **Phase 2.2 (Optimization):**
- [ ] Job archival / soft-delete
- [ ] Favorite/pin jobs for quick access
- [ ] Scheduled reruns (cron-like)

---

## Implementation Notes for Frontend Developer

### Component Structure

```typescript
// /app/marketplace/job-history/page.tsx
<JobHistory>
  <JobHistoryList jobs={jobs} />
    <JobRow job={job}>
      <JobRedployButton job={job} />
    </JobRow>
  </JobHistoryList>
  <QuickRedeployModal isOpen={isOpen} job={selectedJob} />
    <RedeployConfirm job={job} />
    <RedeployInProgress jobId={jobId} />
    <RedeploySuccess jobId={jobId} />
    <RedeployError error={error} />
  </QuickRedeployModal>
</JobHistory>
```

### Data Requirements

From backend `/api/jobs` endpoint:
```json
{
  "jobId": "job-abc123",
  "templateName": "Llama-3-8B Inference",
  "gpuModel": "RTX 4090",
  "gpuVram": 24,
  "params": {
    "maxTokens": 2048,
    "temperature": 0.7,
    "topP": 0.95
  },
  "costPerMin": 0.25,
  "previousDuration": 150,  // seconds
  "previousCost": 18.75,
  "status": "completed",
  "createdAt": "2026-03-22T15:30:00Z",
  "region": "us-east-1"
}
```

### UX Handoff Notes

1. **Validation:** Show estimated cost _before_ redeploy (prevents surprise bills)
2. **Status Updates:** Use WebSocket or polling for real-time status (no manual refresh)
3. **Error Recovery:** Always offer a clear next action (retry, different GPU, contact support)
4. **Loading Perception:** Show progress milestones, not just spinner (psychological < 1.5 sec)

---

## Related Documentation

- **Phase 1:** [DCP-665 Template Catalog UX](/docs/ux/template-catalog-ux-audit.md)
- **Phase 2 Roadmap:** [/docs/ux/PHASE-2-UX-ROADMAP.md](/docs/ux/PHASE-2-UX-ROADMAP.md)
- **Arabic Personalization:** [Phase 2 Roadmap - Item 3](/docs/ux/PHASE-2-UX-ROADMAP.md#3-arabic-market-personalization)
- **Advanced Scheduling:** [Future Phase 2 Feature](/docs/ux/PHASE-2-UX-ROADMAP.md#2-advanced-job-scheduling)
