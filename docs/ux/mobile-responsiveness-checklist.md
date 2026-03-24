# Mobile Responsiveness Checklist — Sprint 28

**Issue:** DCP-791
**Date:** 2026-03-24
**Reviewer:** UI/UX Specialist
**Context:** Saudi renter base is >70% mobile. 375px is representative mobile viewport.

---

## Overview

This checklist validates that the **3 critical renter flows** work flawlessly on a 375px viewport (iPhone SE / iPhone 12 mini dimensions):

1. **Deploy Flow** — Browse templates → Configure → Launch job
2. **Wallet Top-Up Flow** — View balance → Request top-up → Confirm payment
3. **Job History Flow** — View running jobs → Monitor progress → Redeploy past job

Each flow is tested for:
- ✅ Touch targets ≥ 44px (WCAG AA)
- ✅ Text readable without horizontal scroll
- ✅ RTL layout (Arabic) correct
- ✅ Forms fill-able on mobile keyboard
- ✅ Button/link clicks register smoothly

---

## Test Setup

**Environment:**
- Browser: Chrome DevTools (Device Emulation) or actual iPhone/Android device
- Viewport: **375px width × 812px height** (iPhone 12 mini / SE)
- Orientation: Portrait (primary), landscape (secondary)
- Network: Throttle to "Slow 4G" to catch performance issues

**Access Points:**
- Deploy: `/marketplace/templates` → Pick template → Click "Deploy Now"
- Wallet: `/renter/wallet` or `/renter` dashboard
- Jobs: `/renter/jobs`

---

## Flow 1: Deploy Template (Template Catalog → Registration)

### ✅ Checklist: Template Catalog Page (`/marketplace/templates`)

| Item | Status | Notes |
|------|--------|-------|
| Hero section text readable (no overflow) | ☐ | Check: heading "GPU Workload Templates" wraps properly |
| Category tabs scroll horizontally (not cut off) | ☐ | Test: swipe to see "Training", "Notebook" tabs |
| Category tab text is 14px+ (readable) | ☐ | Verify font size via DevTools |
| Search input is ≥ 44px tall | ☐ | Measure height: search box must be tappable |
| Search input placeholder is readable | ☐ | Text shouldn't be too small or faded |
| Filter buttons are ≥ 44px tall (VRAM, Arabic, Tier) | ☐ | Test: tap each filter button — should register first try |
| Card width is 100% - 16px padding (mobile-optimized) | ☐ | No side-scrolling within card |
| Card title text truncates properly (no overflow) | ☐ | Long template names should have ellipsis or wrap |
| Card image/icon is visible (not squished) | ☐ | Template icon should be clear, at least 32px |
| "VRAM", "Type" spec text is readable (not too small) | ☐ | Secondary specs must be 12px+ |
| Pricing section (SAR/hr) displays clearly | ☐ | Large price number must stand out even on small screen |
| Competitive savings badge ("↓ 28% cheaper") wraps properly | ☐ | Badge should not push card off-screen |
| "Deploy Now" button is ≥ 44px tall | ☐ | Button must be easily tappable, full width or nearly full |
| Button spacing (24px gap from card edge) maintained | ☐ | No cramped buttons |
| **RTL Test:** Switch to Arabic, tabs align right | ☐ | Tabs should mirror on right side |
| **RTL Test:** Card content flips (text right-aligned) | ☐ | Icon should be on right in RTL |
| **RTL Test:** "Deploy" button readable in Arabic | ☐ | Button text fits in ≥ 44px button |

**Success Criteria:**
- [ ] Can scroll through ≥ 5 templates without horizontal scrolling
- [ ] Can tap "Deploy Now" on first try (not missing)
- [ ] Can switch between categories smoothly
- [ ] All text readable at normal arm's-length distance

---

### ✅ Checklist: Template Registration Page (`/renter/register?template=[id]`)

| Item | Status | Notes |
|------|--------|-------|
| Page header/breadcrumb visible (not cut off) | ☐ | "Marketplace / Register" should fit |
| Template details card (name, VRAM, icon) displays | ☐ | Shows which template is being configured |
| Form fields (inputs, selects, checkboxes) are ≥ 44px tall | ☐ | Each form element must be tappable |
| Form labels are visible above inputs (not hidden) | ☐ | Labels should not float inside input |
| Input placeholders are readable (not too faded) | ☐ | Placeholder text should have good contrast |
| Text input focus state is visible (blue outline) | ☐ | When tapped, input should show clear focus ring |
| Mobile keyboard appears appropriately (no overlap) | ☐ | Keyboard should not cover form fields (test with actual device or browser keyboard) |
| Keyboard dismisses when tapping "Done" or outside | ☐ | UX should not feel stuck with open keyboard |
| Checkbox/radio targets are ≥ 44×44px | ☐ | Checkboxes often too small — test tappability |
| Select dropdown opens with readable options | ☐ | Dropdown items should be tappable (≥ 44px tall) |
| Scrollable content (long forms) can be scrolled smoothly | ☐ | No jank when scrolling long form |
| "Back" button (or cancel) is accessible (top left or similar) | ☐ | Should be easy to go back without scrolling |
| "Continue" / "Next" button is ≥ 44px tall and full-width | ☐ | Primary CTA should be prominent and easy to tap |
| Button is positioned at bottom (not hidden by keyboard) | ☐ | With keyboard open, can still see "Continue" |
| Success message (after submit) is clear and readable | ☐ | Confirmation message should be large and centered |
| **RTL Test:** Form labels align right | ☐ | In Arabic, labels should be on right side |
| **RTL Test:** Input direction is RTL (text appears right-aligned) | ☐ | Arabic text in inputs should flow right-to-left |
| **RTL Test:** Button text is centered and readable | ☐ | Button should not look broken in RTL |

**Success Criteria:**
- [ ] Can fill entire form without horizontal scrolling
- [ ] Can tap all form fields and buttons on first try
- [ ] Mobile keyboard does not overlap critical fields
- [ ] Can submit form by tapping "Continue" button

---

### ✅ Checklist: Job Confirmation Page (`/renter/jobs/[id]` or confirmation screen)

| Item | Status | Notes |
|------|--------|-------|
| Job details card (template name, GPU, VRAM) visible | ☐ | Shows what job is running |
| Job status badge (Running / Pending / Complete) is clear | ☐ | Status should be obvious at a glance |
| Job ID / hash is readable (with copy button if present) | ☐ | If copyable, copy button should be ≥ 44px or clearly tappable |
| Cost display (SAR/hr, estimated total) is readable | ☐ | Price must be clear and prominent |
| Progress bar (if present) is visible and fills naturally | ☐ | Should not be cut off or tiny |
| "Monitor Job" or "View Results" button is ≥ 44px tall | ☐ | Primary action button must be tappable |
| "Back to Dashboard" link is accessible (not too small) | ☐ | Secondary action should be readable (≥ 12px) |
| Scrollable content (job logs, output) scrolls smoothly | ☐ | No jank on long job output |
| Output text is readable at default zoom (not cut off) | ☐ | Code/logs should not need horizontal scroll for typical lines |
| **Landscape mode:** Layout adapts (content still readable) | ☐ | Test: rotate phone 90° → check layout adjusts |
| **RTL Test:** Status badge aligns correctly | ☐ | Badge position in Arabic should not look off |
| **RTL Test:** Job details text aligns right | ☐ | Job name and specs should be right-aligned in RTL |

**Success Criteria:**
- [ ] Can view job details without horizontal scrolling
- [ ] Can tap "Monitor Job" button easily
- [ ] Job output is readable (lines don't need side-scroll unless very long)

---

## Flow 2: Wallet Top-Up (Balance Check → Payment)

### ✅ Checklist: Wallet Dashboard Page (`/renter/wallet`)

| Item | Status | Notes |
|------|--------|-------|
| Wallet balance card (large, prominent) is visible | ☐ | Balance should be the hero of the page |
| Balance amount is large and readable (≥ 28px) | ☐ | Primary number should be clear |
| Currency (SAR) label is visible next to amount | ☐ | Should show "SAR 1,250" not just "1,250" |
| Top-up button is ≥ 44px tall and prominent (primary color) | ☐ | CTA must stand out |
| Transaction history list is scrollable (if long) | ☐ | History items should not overflow, should scroll smoothly |
| Transaction items (date, amount, type) are readable | ☐ | Date should be 12px+, amount 14px+ |
| Each transaction row is ≥ 44px tall (tappable for details) | ☐ | If clickable, should be easy to tap |
| Dividers between transactions are visible | ☐ | Visual separation helps scanning |
| "Empty state" message (if no transactions) is clear | ☐ | If no history yet, message should explain |
| Header/title "Wallet" or "Balance" is visible | ☐ | Page should be clearly identified |
| Back/navigation button is accessible (sticky or top) | ☐ | Should not need to scroll up to go back |
| Balance updates in real-time (if available) | ☐ | After paying, balance should refresh |
| **RTL Test:** Balance display aligns correctly | ☐ | Amount and currency should align right in Arabic |
| **RTL Test:** Transaction dates align right | ☐ | Dates should be right-aligned in RTL |

**Success Criteria:**
- [ ] Can see wallet balance at a glance (no scrolling needed)
- [ ] Can find and tap "Top-Up" button on first try
- [ ] Can scroll through transaction history smoothly
- [ ] All text is readable (no text too small)

---

### ✅ Checklist: Top-Up Payment Page (`/renter/wallet/topup`)

| Item | Status | Notes |
|------|--------|-------|
| Amount input field is ≥ 44px tall | ☐ | Number input must be tappable |
| Currency selector (if present) is ≥ 44px tall | ☐ | Dropdown should be easy to tap |
| Preset amounts (500 SAR, 1000 SAR, etc.) are tappable buttons (≥ 44px) | ☐ | Quick-select buttons should be prominent |
| Payment method selector is visible and readable | ☐ | "Credit Card", "Bank Transfer", etc. should be clear |
| Payment method options are ≥ 44px tall (tappable) | ☐ | Radio buttons or clickable cards should be easy to select |
| Card input fields (if credit card) are ≥ 44px tall | ☐ | Card number, CVV, expiry all tappable |
| Card input focus state is clear (blue outline) | ☐ | Should show which field is active |
| Mobile keyboard appears appropriately for number input | ☐ | Should show numeric keyboard, not full QWERTY |
| "Review" or "Continue" button is ≥ 44px tall | ☐ | CTA must be prominent and easy to tap |
| Button is positioned at bottom (fixed or float) | ☐ | Should not be hidden by keyboard when typing |
| Error messages (if validation fails) are readable and actionable | ☐ | Red text should be ≥ 12px, explain what's wrong |
| Confirmation message after payment is clear and celebratory | ☐ | Should feel successful, show new balance |
| Confirmation message is readable without scrolling | ☐ | Important info visible at glance |
| "Back" or "Done" button is accessible | ☐ | Should not trap user on confirmation screen |
| **RTL Test:** Amount field is right-aligned | ☐ | In Arabic, input should be RTL |
| **RTL Test:** Buttons text is readable in Arabic | ☐ | Button labels should fit and be clear |
| **RTL Test:** Error messages are right-aligned | ☐ | Red warning text should align right |

**Success Criteria:**
- [ ] Can enter top-up amount without horizontal scrolling
- [ ] Can select payment method and submit on first try
- [ ] Keyboard does not obscure form fields
- [ ] Confirmation message is clear and celebratory

---

## Flow 3: Job History & Redeploy (View Jobs → Reuse Template)

### ✅ Checklist: Job History Page (`/renter/jobs`)

| Item | Status | Notes |
|------|--------|-------|
| Page header "Job History" is visible | ☐ | Clear page identification |
| Filter/sort controls (date, status, template) are ≥ 44px tall | ☐ | Filter buttons should be tappable |
| Filter/sort doesn't take excessive vertical space on mobile | ☐ | Sticky header OK, but don't waste space |
| Job list cards are full-width (or nearly) | ☐ | No horizontal scroll needed to see jobs |
| Each job card is ≥ 80px tall (readable, tappable) | ☐ | Cards should show: template, date, status, cost |
| Job card text (template name) is readable (≥ 14px) | ☐ | Template name should be clear at a glance |
| Job card metadata (date, status) is visible (≥ 12px) | ☐ | Date, status badges should be readable |
| Status badge color is clear (Green = running, Blue = pending, Gray = done) | ☐ | Status should be obvious |
| Cost display (SAR/hr or total) is visible | ☐ | Users care about price — should be visible |
| Card click/tap registers smoothly (no dead zones) | ☐ | Should open job details easily |
| "Redeploy" button (if present) is ≥ 44px tall | ☐ | Quick redeploy should be accessible on card |
| Scrolling through job list is smooth (no jank) | ☐ | Should be performant even with 20+ jobs |
| Empty state (if no jobs) is helpful and clear | ☐ | Message should explain and link to templates |
| Pagination/load-more is accessible (if many jobs) | ☐ | "Load More" button should be ≥ 44px |
| **Landscape mode:** Layout adapts (2-column or wider card) | ☐ | Rotate phone, check readability |
| **RTL Test:** Job cards align right | ☐ | Card content should flip in Arabic |
| **RTL Test:** "Redeploy" button is right-aligned | ☐ | Button should position correctly in RTL |

**Success Criteria:**
- [ ] Can scan job list and find a job of interest
- [ ] Can tap on job to view details
- [ ] Can tap "Redeploy" without accidentally tapping adjacent elements

---

### ✅ Checklist: Job Details Page (`/renter/jobs/[id]`)

| Item | Status | Notes |
|------|--------|-------|
| Job header (template name, job ID) is visible | ☐ | Clear identification of which job |
| Status badge and timeline (if available) are visible | ☐ | User should see job progress at a glance |
| Timeline/progress bar (if present) is not cut off | ☐ | Should fit horizontally on mobile |
| Cost summary (total spent, hourly rate) is readable | ☐ | Important metrics should be prominent |
| Job logs/output container scrolls smoothly vertically | ☐ | Long output should be scrollable |
| Log lines are readable (no horizontal scroll needed for typical lines) | ☐ | Exception: very long lines (>80 chars) may need scroll, but common output should fit |
| Log text is ≥ 11px (readable in monospace) | ☐ | Code/logs should be legible |
| Zoom works (pinch-to-zoom on mobile) | ☐ | User can zoom in if text is small |
| "Redeploy" button is ≥ 44px tall and visible | ☐ | Should be easy to redeploy past job |
| "Stop" or "Cancel" button is ≥ 44px tall (if job running) | ☐ | User should be able to stop job easily |
| Buttons don't overlap (spacing maintained) | ☐ | Multiple buttons should not crowd |
| **Landscape mode:** Logs are more readable (wider) | ☐ | Landscape should make logs easier to read |
| **RTL Test:** Job details layout is RTL-correct | ☐ | Layout should mirror in Arabic |
| **RTL Test:** "Redeploy" button text is centered and readable | ☐ | Button label should fit |

**Success Criteria:**
- [ ] Can view job details and logs without excessive horizontal scrolling
- [ ] Can tap "Redeploy" button to relaunch job
- [ ] Job output is readable at normal font size (zoom allowed as fallback)

---

## Flow 3b: Quick-Redeploy Modal (Phase 2.0 Feature)

*If Quick-Redeploy feature is implemented:*

### ✅ Checklist: Quick-Redeploy Modal (`/renter/jobs` or `/renter/jobs/[id]`)

| Item | Status | Notes |
|------|--------|-------|
| Modal overlay (background) is visible but not distracting | ☐ | Semi-transparent dark overlay OK |
| Modal dialog is centered and takes ≤ 90% of screen width | ☐ | On 375px, should be ~330px wide max |
| Modal has close button (X) in top-right, ≥ 44×44px | ☐ | Easy to dismiss |
| Modal title ("Redeploy Job?") is readable | ☐ | Clear what's happening |
| Original job details (template, params) are visible | ☐ | Show what's being redeployed |
| Edit fields (if any) are ≥ 44px tall | ☐ | User can modify if needed |
| "Confirm" button is ≥ 44px tall and prominent | ☐ | CTA should be clear |
| "Cancel" button is ≥ 44px tall (secondary styling) | ☐ | Easy to back out |
| Button spacing is ≥ 8px (not cramped) | ☐ | Buttons should not touch |
| Modal scrolls if content exceeds viewport height | ☐ | Long job params should be scrollable inside modal |
| Modal closes smoothly (animation or instant) | ☐ | UX should feel responsive |
| **RTL Test:** Modal layout is RTL-correct | ☐ | Close button on left in RTL |
| **RTL Test:** Content inside modal is right-aligned | ☐ | Text and fields should align right |

**Success Criteria:**
- [ ] Modal appears on tap without lag
- [ ] Can modify job parameters if needed
- [ ] Can confirm redeploy or cancel easily
- [ ] Modal closes cleanly after action

---

## Portrait → Landscape Testing

Test each flow in both orientations:

| Flow | Portrait | Landscape |
|------|----------|-----------|
| Deploy Flow | ☐ | ☐ |
| Wallet Top-Up | ☐ | ☐ |
| Job History & Redeploy | ☐ | ☐ |

**Criteria:**
- [ ] Layout adapts smoothly (no rotation jank)
- [ ] Text remains readable
- [ ] Buttons remain tappable
- [ ] No content hidden due to rotation

---

## Performance & Responsiveness

### ✅ Checklist: Mobile Performance

| Item | Status | Notes |
|------|--------|-------|
| Page loads within 3 seconds on Slow 4G | ☐ | Use Chrome DevTools throttling to test |
| Images load progressively (lazy-load if long list) | ☐ | Template icons should load quickly |
| Form inputs respond immediately to taps (no lag) | ☐ | Should not feel sluggish |
| Scrolling is 60 FPS (smooth, no jank) | ☐ | Check DevTools Performance tab |
| Touch interactions register immediately (no 200ms delay) | ☐ | Should not feel laggy on mobile |
| Keyboard appears/dismisses quickly (≤ 500ms) | ☐ | UX should feel responsive |

**Tools:**
- Chrome DevTools: Device Emulation + Network Throttling
- Lighthouse: Performance audit
- Real device: iPhone/Android for actual feel

---

## Accessibility Bonus Checks

### ✅ Checklist: WCAG AA Mobile Compliance

| Item | Status | Notes |
|------|--------|-------|
| All buttons/links have ≥ 44px touch target (WCAG AA) | ☐ | Measure in DevTools |
| Text has ≥ 4.5:1 contrast ratio (WCAG AA) | ☐ | Use axe DevTools or Lighthouse |
| Focus indicators visible (1-2px outline) | ☐ | Tab through form, check focus ring |
| Form labels associated with inputs (aria-label or <label>) | ☐ | Screen readers should announce labels |
| Images have alt text (if present) | ☐ | Decorative = empty alt, functional = descriptive |
| Color not sole indicator (e.g., red for error + "Error" text) | ☐ | Status messages should have text, not just color |

---

## RTL / Arabic Testing Summary

### ✅ Checklist: Arabic Localization on Mobile

| Item | Status | Notes |
|------|--------|-------|
| Language toggle works (switch to العربية) | ☐ | Should flip entire UI to RTL |
| Text direction is RTL for all flows | ☐ | Deploy, Wallet, Jobs all RTL |
| Layout mirrors (left ↔ right) | ☐ | Images, buttons should flip |
| Number formatting is correct (Arabic numerals if desired) | ☐ | Should display "١٢٣" or "123" depending on setting |
| Currency symbol (ر.س or SAR) is correct | ☐ | Should display "1,250 ر.س" or "1,250 SAR" |
| Form input direction is RTL | ☐ | Typing in Arabic input should flow right-to-left |
| Button labels are readable in Arabic (text fitting) | ☐ | Some Arabic words are longer — buttons should fit |
| Error messages are readable and properly positioned | ☐ | Red warning text should align right |
| All form placeholders translated to Arabic | ☐ | Placeholder text should be in Arabic, not English |

---

## Reporting Issues Found

### Issue Template

If you find a mobile UX issue, report it with:

1. **Flow:** Deploy / Wallet / Jobs
2. **Page:** URL (e.g., `/marketplace/templates`)
3. **Issue:** What is broken (e.g., "Button is 36px tall, needs 44px")
4. **Device:** iPhone SE / Android 14 / DevTools 375px
5. **Screenshot:** Include DevTools screenshot or device screenshot
6. **Severity:** Critical (blocks flow) / High (bad UX) / Medium (minor) / Low (nice-to-have)

Example issue:
```
Flow: Deploy
Page: /renter/register?template=nemotron-nano
Issue: "Continue" button is 36px tall, too small to tap reliably
Device: DevTools 375px portrait
Severity: Critical
```

---

## Summary & Next Steps

### Checklist Status
- [ ] All Deploy Flow items checked
- [ ] All Wallet Flow items checked
- [ ] All Jobs Flow items checked
- [ ] Portrait → Landscape tested
- [ ] Performance tested on Slow 4G
- [ ] Accessibility (WCAG AA) validated
- [ ] Arabic/RTL localization tested

### Approval Gate
✅ **Checklist complete when:**
1. All 3 flows work flawlessly on 375px portrait
2. All buttons are ≥ 44px and tappable
3. No text overflow or horizontal scrolling (except for very long lines)
4. RTL/Arabic localization is correct
5. Performance is smooth (60 FPS scrolling, instant interactions)
6. Issues reported and assigned to fix owner

### Expected Outcome
A mobile-first renter experience that feels native and responsive, designed for Saudi users on 4G networks with occasional spotty connectivity.

---

**Prepared by:** UI/UX Specialist
**Date:** 2026-03-24
**Testing Owner:** QA Engineer (recommended for hands-on device testing)
**Timeline:** 1-2 days (can be done in parallel with other Sprint 28 work)
