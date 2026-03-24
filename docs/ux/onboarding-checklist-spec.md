---
title: Onboarding Checklist Component Spec
description: Persistent checklist widget for new renter setup completion
issue: DCP-812
date: 2026-03-24
status: implementation-ready
---

# Onboarding Checklist Component Spec

**Component:** `<OnboardingChecklist />`
**Purpose:** Persistent widget showing new renters their setup progress — makes invisible progress visible, drives JTBD conversion.
**Target:** Renters with 0 completed jobs who are <48 hours old
**Success Metric:** >70% of new renters complete all 3 items within 24 hours

---

## Component Overview

### Placement
- **Locations:** Top-right corner of dashboard (above the fold, always visible)
- **Sticky:** Position: sticky on scroll
- **Z-Index:** 40 (below modals, above content)
- **Responsive:** Collapses to icon-only on mobile (<640px)

### States
1. **Expanded** (default) — All 3 checklist items visible
2. **Collapsed** — Icon only, expandable on click
3. **Completed** — All items checked, "Dismiss" button shows

---

## Visual Design

### Expanded State
```
┌──────────────────────────────────────┐
│  ✅ Complete Your Setup       [↓]   │
├──────────────────────────────────────┤
│                                      │
│  ☐ Add API Key to Your App          │
│    "Get started in your code"        │
│    [View Guide →]                   │
│                                      │
│  ☐ Top Up Wallet                    │
│    "Minimum SAR 10 to deploy"       │
│    [Add Credit →]                   │
│                                      │
│  ☑ Deploy Your First Model          │
│    "Congratulations! Job complete"  │
│    [View Job →]                     │
│                                      │
│  Progress: 1 of 3 items complete    │
│                                      │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← 33% progress bar
│                                      │
│                      [DISMISS GUIDE] │
│                                      │
└──────────────────────────────────────┘
```

### Collapsed State (Mobile <640px)
```
┌──────┐
│ ✔ 1/3 │  ← Icon-only, tap to expand
└──────┘
```

---

## Component Specs

### Props

```typescript
interface OnboardingChecklistProps {
  userId: string;
  completedItems: "api_key" | "wallet" | "first_job"[];
  isNewRenter: boolean;  // User age < 48 hours
  onDismiss: () => void;
  onItemClick?: (item: string) => void;
}
```

### Data Structure

```typescript
interface OnboardingStep {
  id: "api_key" | "wallet" | "first_job";
  title: string;
  subtitle: string;
  icon: "key" | "wallet" | "rocket";
  completed: boolean;
  ctaLabel: string;
  ctaLink: string;
  order: number;
}

const STEPS: OnboardingStep[] = [
  {
    id: "api_key",
    title: "Add API Key to Your App",
    subtitle: "Get started in your code",
    icon: "key",
    completed: false,
    ctaLabel: "View Guide",
    ctaLink: "/setup/api-key",
    order: 1,
  },
  {
    id: "wallet",
    title: "Top Up Wallet",
    subtitle: "Minimum SAR 10 to deploy",
    icon: "wallet",
    completed: false,
    ctaLabel: "Add Credit",
    ctaLink: "/wallet/topup",
    order: 2,
  },
  {
    id: "first_job",
    title: "Deploy Your First Model",
    subtitle: "Congratulations! Job complete",
    icon: "rocket",
    completed: false,
    ctaLabel: "View Job",
    ctaLink: "/jobs/latest",
    order: 3,
  },
];
```

---

## Styling & Layout

### Container
- **Width:** 340px (expanded desktop), full-width-16px (mobile)
- **Background:** #FFFFFF (white card)
- **Border:** 1px solid #E5E7EB (light gray)
- **Border-radius:** 8px
- **Padding:** 20px (desktop), 16px (mobile)
- **Box-shadow:** 0 4px 6px rgba(0, 0, 0, 0.07)
- **Position:** sticky, top: 80px (below navbar)

### Header
- **Flex:** space-between alignment (title left, collapse icon right)
- **Title:** Poppins 600, 16px, #1F2937 (dark gray)
- **Icon:** Chevron-down (↓), 20px, #6B7280, clickable to collapse

### Checklist Items
```
Item Container:
  - Display: flex (vertical)
  - Gap: 16px between items
  - Padding-bottom: 12px on each (separator)
  - Border-bottom: 1px #E5E7EB (except last)

Checkbox + Content:
  - Checkbox: 20px × 20px, #2563EB when checked
  - Title: Poppins 500, 14px, #1F2937
  - Subtitle: Poppins 400, 13px, #6B7280
  - CTA Link: #2563EB, underlined, 13px
  - Strikethrough on completed items
```

### Progress Bar
- **Height:** 6px
- **Background:** #E5E7EB (light)
- **Fill:** #10B981 (green)
- **Width:** (completed / 3) * 100%
- **Margin:** 12px 0

### Footer
- **Text:** "Progress: X of 3 items complete" (Poppins 400, 12px, #6B7280)
- **Button:** [DISMISS GUIDE] (Poppins 500, 13px, #2563EB, text-button style)
- **Text-align:** center

---

## Interactive Behavior

### Expand/Collapse
- **Trigger:** Click [↓] icon in header
- **Animation:** Slide-down (150ms) on expand, slide-up on collapse
- **State:** Persist in localStorage (remember user preference)

### Item Interactions
- **Click Title/Subtitle:** Do nothing (not clickable)
- **Click CTA Link:** Navigate to destination (e.g., /setup/api-key)
- **Analytics:** Log `checklist_item_clicked` event with item_id

### Completion Detection
- **API Key:** Detect via `GET /api/auth/keys` (at least 1 key generated)
- **Wallet:** Detect via `GET /api/wallet/balance` (balance >= SAR 10)
- **First Job:** Detect via `GET /api/jobs` (at least 1 job with status=completed)

### Real-time Updates
- **Poll interval:** Check completion status every 10 seconds
- **Animation:** Checkmark fill animation when item completes (150ms)
- **Sound:** Optional subtle "ding" on completion (muted by default)

### Dismissal
- **Trigger:** Click [DISMISS GUIDE]
- **Behavior:** Only show if all 3 items NOT complete
- **If incomplete:** Show "Are you sure?" modal before dismissing
  - Copy: "You still have X items left. Keep going!"
  - Buttons: [Continue] [Dismiss Anyway]
- **If complete:** Dismiss immediately with toast "Setup complete! 🎉"
- **Storage:** Save dismissal preference in localStorage (key: `checklist_dismissed_{userId}`)

---

## Responsive Design

### Desktop (>1024px)
- 340px fixed-width card
- Right-aligned on dashboard
- Sticky on scroll

### Tablet (640-1024px)
- 320px card
- Right-aligned, may overlap content if narrow
- Sticky on scroll

### Mobile (<640px)
- Collapsed by default (icon only: "✔ 1/3")
- Expand on tap (full-width overlay or slide-up)
- Overlay: Covers dashboard, 80% viewport height
- Dismiss: [X] close button + [DISMISS GUIDE] button
- No sticky positioning (takes too much space)

---

## Accessibility

### WCAG AA Compliance
- **Color Contrast:** All text >= 4.5:1 ratio
- **Focus Visible:** All interactive elements (links, buttons, expand icon) have visible focus outline
- **Keyboard Navigation:**
  - Tab to cycle through links
  - Enter to click links
  - Escape to collapse/dismiss
- **Screen Reader:**
  - List semantic: `<ul><li>` for checklist items
  - Checkbox ARIA: `role="checkbox"` with `aria-checked="true/false"`
  - Status updates: Use `aria-live="polite"` for progress updates
  - Link text: Descriptive ("View Guide", not "Click Here")

### Mobile Accessibility
- **Touch targets:** 44px minimum for all buttons/links
- **Click area:** Entire item row is clickable (not just CTA)
- **Feedback:** Visual + haptic (optional) on completion

---

## Animation & Interaction

### Expand/Collapse
```css
transition: max-height 150ms ease-in-out, opacity 150ms ease-in-out;
```

### Item Completion
```css
/* Checkmark animation */
@keyframes checkmark-fill {
  0% { stroke-dashoffset: 100; }
  100% { stroke-dashoffset: 0; }
}

/* Text strikethrough */
@keyframes strikethrough-fade {
  0% { opacity: 1; text-decoration: none; }
  100% { opacity: 0.6; text-decoration: line-through; }
}
```

### Progress Bar
```css
transition: width 300ms ease-in-out;
```

---

## Data Flow & State Management

### Initial State
```typescript
{
  expanded: true,
  completed: {
    api_key: false,
    wallet: false,
    first_job: false,
  },
  loading: false,
  dismissed: false,
}
```

### Completion Check
```typescript
// Check every 10 seconds
useEffect(() => {
  const interval = setInterval(() => {
    checkApiKey();  // GET /api/auth/keys
    checkWallet();  // GET /api/wallet/balance
    checkFirstJob(); // GET /api/jobs?limit=1
  }, 10000);
  return () => clearInterval(interval);
}, []);
```

### Event Tracking
```typescript
// Analytics
{
  event: "checklist_item_clicked",
  item_id: "api_key" | "wallet" | "first_job",
  timestamp: Date,
  userId: string,
}

{
  event: "checklist_item_completed",
  item_id: string,
  time_to_complete: number_seconds,
  userId: string,
}

{
  event: "checklist_dismissed",
  completed_items: number,
  userId: string,
}
```

---

## Success Criteria

### Engagement Metrics
- [ ] Checklist view rate: >80% (users see the widget)
- [ ] CTA click rate: >60% (users click links from checklist)
- [ ] Completion rate: >70% (users complete all 3 items)
- [ ] Time to completion: Median 45 minutes (from first app open)

### Business Metrics
- [ ] JTBD conversion lift: +15-20% (checklist drives first job deployment)
- [ ] Renter retention (7-day active): >65% (checklist keeps users engaged)
- [ ] Support ticket reduction: -10% (clear guidance reduces confusion)

### Quality Metrics
- [ ] Accessibility audit: WCAG AA pass (automated + manual)
- [ ] Performance: <100ms render time (fast, not janky)
- [ ] Mobile responsiveness: Passes at all breakpoints
- [ ] Animations: 60fps (smooth, not stuttering)

---

## Implementation Checklist

### Frontend Component
- [ ] Create `/app/components/OnboardingChecklist.tsx`
- [ ] Import from design system (colors, spacing, typography)
- [ ] Implement expand/collapse toggle
- [ ] Add checkbox styling (checked/unchecked states)
- [ ] Implement progress bar (0-100%)
- [ ] Add animations (expand/collapse, checkmark fill)
- [ ] Implement responsive design (<640px, 640-1024px, >1024px)
- [ ] Test keyboard navigation (Tab, Enter, Escape)
- [ ] Add ARIA labels for screen readers
- [ ] Implement localStorage persistence (expand/dismiss state)

### Backend Integration
- [ ] Create `/api/onboarding/status` endpoint (GET)
  - Returns: { api_key: bool, wallet: bool, first_job: bool }
  - Auth: Required (JWT)
  - Response time: <100ms (cache for 10 sec)
- [ ] Wire detection logic:
  - API key: `SELECT COUNT(*) FROM api_keys WHERE user_id=?`
  - Wallet: `SELECT balance FROM wallets WHERE user_id=?` (>= 10)
  - First job: `SELECT COUNT(*) FROM jobs WHERE user_id=? AND status='completed'`

### Analytics
- [ ] Track `checklist_item_clicked` events
- [ ] Track `checklist_item_completed` events
- [ ] Track `checklist_dismissed` events
- [ ] Report metrics to dashboard (view rate, CTA rate, completion rate)

### Testing
- [ ] Unit tests: State transitions, completion detection
- [ ] Integration tests: API calls, analytics events
- [ ] E2E tests: Full user journey (expand → click CTA → check completion)
- [ ] Accessibility tests: Keyboard nav, screen reader, contrast
- [ ] Mobile tests: Touch targets, responsive layout at 320px/480px
- [ ] Performance: <100ms render, 60fps animations

### Deployment
- [ ] Feature flag: `SHOW_ONBOARDING_CHECKLIST` (gradual rollout)
- [ ] Show to: Users with age < 48 hours + jobs_completed == 0
- [ ] Monitor: Crash rate, performance, analytics events
- [ ] Rollback plan: Disable feature flag if issues detected

---

## Code Examples

### React Component Structure
```typescript
export const OnboardingChecklist = ({ userId }) => {
  const [expanded, setExpanded] = useState(true);
  const [completed, setCompleted] = useState({
    api_key: false,
    wallet: false,
    first_job: false,
  });
  const [dismissed, setDismissed] = useState(
    localStorage.getItem(`checklist_dismissed_${userId}`) === "true"
  );

  useEffect(() => {
    checkCompletionStatus();
    const interval = setInterval(checkCompletionStatus, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  const checkCompletionStatus = async () => {
    const response = await fetch("/api/onboarding/status", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    setCompleted(data);
    trackCompletions(data);
  };

  const handleDismiss = () => {
    localStorage.setItem(`checklist_dismissed_${userId}`, "true");
    setDismissed(true);
    trackEvent("checklist_dismissed", { completed_items: Object.values(completed).filter(Boolean).length });
  };

  if (dismissed) return null;

  return (
    <Card className="checklist-container">
      <Header expanded={expanded} onToggle={() => setExpanded(!expanded)} />
      {expanded && (
        <>
          <ItemList completed={completed} userId={userId} />
          <ProgressBar completed={completed} />
          <DismissButton onDismiss={handleDismiss} />
        </>
      )}
    </Card>
  );
};
```

### API Endpoint
```typescript
// GET /api/onboarding/status
export const getOnboardingStatus = async (req, res) => {
  const userId = req.user.id;

  const apiKeyCount = await db.query(
    "SELECT COUNT(*) as count FROM api_keys WHERE user_id = ?",
    [userId]
  );
  const walletBalance = await db.query(
    "SELECT balance FROM wallets WHERE user_id = ?",
    [userId]
  );
  const jobsCount = await db.query(
    "SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = 'completed'",
    [userId]
  );

  res.json({
    api_key: apiKeyCount[0].count > 0,
    wallet: walletBalance[0]?.balance >= 10,
    first_job: jobsCount[0].count > 0,
  });
};
```

---

## Design System Reference

### Colors
- Primary: #2563EB (links, CTA)
- Success: #10B981 (progress bar, checked)
- Text: #1F2937 (titles), #6B7280 (subtitles)
- Border: #E5E7EB (dividers)
- Background: #FFFFFF (card)

### Typography
- Family: Poppins
- Title: 600 weight, 16px
- Body: 400 weight, 14px
- Secondary: 400 weight, 13px

### Spacing
- Card padding: 20px (desktop), 16px (mobile)
- Item gap: 16px
- Progress margin: 12px 0

---

## Status

✅ **IMPLEMENTATION-READY**

Complete component spec with:
- Visual mockups (expanded, collapsed, mobile)
- React component structure
- Backend API requirements
- Analytics tracking
- Accessibility compliance
- Responsive design
- Implementation checklist

**Estimated Frontend Effort:** 8-12 hours

**Estimated Backend Effort:** 2-3 hours (API endpoint + detection logic)

---

*Created by UI/UX Specialist (DCP-812)*
*Date: 2026-03-24*
*Status: Implementation-Ready*
