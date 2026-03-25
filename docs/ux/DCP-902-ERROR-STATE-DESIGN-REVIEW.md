# DCP-902: Error State Design Review
**Task:** DCP-904 Phase 1 Support — Error State Design Coordination
**Coordinator:** UI/UX Specialist
**Frontend Developer:** [DCP-902 assignee]
**Status:** Ready for CR Integration

---

## Objective
Ensure all renter-facing error states are user-friendly, match the design system, and provide clear recovery paths during Phase 1 testing.

---

## Current Error State Inventory

### 1. Authentication Errors

#### 1.1 Missing Credentials
**Location:** `/app/renter/page.tsx` → line 139
```jsx
authReason = 'missing_credentials'
// Redirects to: /login?role=renter&redirect=/renter&reason=missing_credentials
```
**Current UX:** Redirects to login page
**Design Issues:**
- [ ] Login page error message unclear
- [ ] Should show helpful message ("API key required", "Session expired")

**Proposed Fix:**
```jsx
// Show inline message before redirect
<div className="card p-6 max-w-md text-center space-y-3">
  <h2 className="text-lg font-semibold text-status-error">Authentication Required</h2>
  <p className="text-sm text-dc1-text-secondary">
    Your session has expired. Please log in again.
  </p>
  <button className="btn btn-primary text-sm">Sign In Again</button>
</div>
```

#### 1.2 Invalid Credentials
**Location:** `/app/renter/page.tsx` → line 181
```jsx
authReason = 'invalid_credentials'
// Renders login redirect with error
```
**Current UX:** Generic redirect to login
**Design Issues:**
- [ ] Not specific about what was invalid (API key vs session)
- [ ] No recovery suggestion

**Proposed Fix:**
Add message variant: "Your API key is invalid or has been revoked. Create a new one in settings."

#### 1.3 Expired Session
**Location:** `/app/renter/page.tsx` → line 178
```jsx
authReason = 'expired_session'
```
**Current UX:** Treated like invalid credentials
**Design Issues:**
- [ ] Different from invalid — should suggest refresh vs re-login
- [ ] No timeout warning before expiry

**Proposed Fix:**
- Add toast warning 5 minutes before session expiry
- Show specific message: "Session timed out (30 min inactivity). Sign in again."

---

### 2. Marketplace & Model Errors

#### 2.1 Failed Model Load
**Location:** `/app/renter/marketplace/page.tsx` (needs review)
**Current UX:** Unknown — likely no error boundary
**Design Issues:**
- [ ] No error state designed
- [ ] Users see blank page or confusing state

**Proposed Fix:**
Create error card:
```jsx
<div className="card p-8 text-center space-y-3 bg-dc1-surface-l2">
  <svg className="w-12 h-12 mx-auto text-status-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <h3 className="text-lg font-semibold text-status-error">Failed to Load Models</h3>
  <p className="text-sm text-dc1-text-secondary">
    We couldn't load the model catalog. Please check your connection or try again.
  </p>
  <div className="flex gap-2 justify-center">
    <button onClick={refetch} className="btn btn-primary text-sm">Retry</button>
    <button onClick={() => router.back()} className="btn btn-outline text-sm">Go Back</button>
  </div>
</div>
```

#### 2.2 API Timeout
**Location:** Marketplace, Model Detail, Deploy endpoints
**Current UX:** Likely hangs or generic error
**Design Issues:**
- [ ] No timeout indication
- [ ] Users don't know if request succeeded or failed

**Proposed Fix:**
- Set 10-second timeout on all API calls
- Show spinner with "Loading..." for first 2 sec
- After 2 sec show "Taking longer than usual..."
- After 10 sec show error with retry button

#### 2.3 No Results (Empty State)
**Location:** Template/Model search with no results
**Current UX:** Unknown
**Design Issues:**
- [ ] Empty state might be confusing vs error
- [ ] No suggestions for next steps

**Proposed Fix:**
```jsx
<div className="card p-12 text-center space-y-4">
  <div className="text-4xl">🔍</div>
  <h3 className="text-lg font-semibold text-dc1-text-primary">No Results</h3>
  <p className="text-sm text-dc1-text-secondary">
    Try different search terms or remove filters.
  </p>
  <button onClick={clearFilters} className="btn btn-secondary text-sm">
    Clear Filters
  </button>
</div>
```

---

### 3. Job Submission Errors

#### 3.1 Provider Unavailable
**Location:** `/components/jobs/JobSubmitForm.tsx`
**Current UX:** Unknown
**Design Issues:**
- [ ] User selects provider, submits job, then gets error
- [ ] Confusing: "Provider unavailable" — is it offline? Out of VRAM?

**Proposed Fix:**
- Real-time provider status in UI (green/red dot)
- On submission error: "This GPU is no longer available. Choose another."
- Show available GPUs in error message

#### 3.2 Insufficient GPU VRAM
**Location:** Job submission validation
**Current UX:** Unknown
**Design Issues:**
- [ ] User might not know what VRAM requirement is
- [ ] Error message likely too technical

**Proposed Fix:**
```
"This model requires 24 GB VRAM, but the selected GPU has only 16 GB.
Choose a GPU with more memory."
+ Show matching GPUs in suggestion
```

#### 3.3 Insufficient Balance
**Location:** `/app/renter/billing/confirm/page.tsx`
**Current UX:** Likely blocks submission
**Design Issues:**
- [ ] Should be caught before form submission
- [ ] Error message should suggest top-up amount

**Proposed Fix:**
- Calculate required balance on job detail page
- Show balance warning if insufficient (amber color)
- On submission: "Your balance (X SAR) is too low. Required: Y SAR. Top up now?"
- Provide quick link to billing page

---

### 4. Settings & Profile Errors

#### 4.1 Settings Load Error
**Location:** `/app/renter/settings/error.tsx`
```jsx
'use client'
export default function RenterSettingsError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="card p-6 max-w-md text-center space-y-3">
        <h2 className="text-lg font-semibold text-status-error">Renter settings failed to load</h2>
        <p className="text-sm text-dc1-text-secondary">Please retry. If the issue continues, check API auth/session state.</p>
        <button onClick={reset} className="btn btn-primary text-sm">Retry</button>
      </div>
    </div>
  )
}
```
**Current UX:** Basic error boundary with retry
**Design Issues:**
- [ ] "Check API auth/session state" is too technical for users
- [ ] No context about what went wrong

**Proposed Fix:**
```jsx
<h2 className="text-lg font-semibold text-status-error">Settings Unavailable</h2>
<p className="text-sm text-dc1-text-secondary">
  We're having trouble loading your settings. This is usually temporary.
</p>
<div className="flex gap-2 justify-center">
  <button onClick={reset} className="btn btn-primary text-sm">Try Again</button>
  <button onClick={() => router.back()} className="btn btn-outline text-sm">Go Back</button>
</div>
```

#### 4.2 API Key Copy/Generation Error
**Location:** Settings page (needs implementation)
**Current UX:** Unknown
**Design Issues:**
- [ ] Copying API key to clipboard might fail
- [ ] User might not see success/failure feedback

**Proposed Fix:**
- Show toast notification: "Copied to clipboard" (2 sec)
- On failure: "Failed to copy. Please try again." (red, auto-dismiss)
- Provide manual copy option (select text)

---

### 5. Billing & Payment Errors

#### 5.1 Payment Failed
**Location:** `/app/renter/billing/confirm/page.tsx`
**Current UX:** Unknown
**Design Issues:**
- [ ] Payment errors are critical — needs clear messaging
- [ ] User should know if money was charged

**Proposed Fix:**
- Show error with 3 sections:
  1. **What happened:** "Your payment was declined by Moyasar"
  2. **Why:** "Common reasons: insufficient funds, card expired, etc."
  3. **Next steps:** "Try another payment method or contact support"

#### 5.2 Duplicate Payment Warning
**Location:** During payment confirmation
**Current UX:** No warning visible?
**Design Issues:**
- [ ] User might submit twice if page is slow
- [ ] No indication that payment is processing

**Proposed Fix:**
- Disable submit button while processing
- Show loading state with message: "Processing payment... do not close this page"
- Add timeout recovery: "Payment might have succeeded. Check your balance."

---

## Design System Alignment

### Error Message Styling
All error messages should follow this pattern:

```jsx
<div className="card p-4 bg-status-error/5 border border-status-error/20 rounded-lg">
  <div className="flex gap-3">
    <svg className="w-5 h-5 text-status-error shrink-0" fill="currentColor">
      <path d="M10 14l4.35-4.35m0 0L14 6.3M14.35 9.65l4.35-4.35m0 0L18.7 6.3M6.3 14.35l4.35 4.35" />
    </svg>
    <div className="flex-1">
      <h3 className="font-semibold text-status-error text-sm">Error Title</h3>
      <p className="text-dc1-text-secondary text-xs mt-1">Error description with next steps</p>
    </div>
  </div>
</div>
```

### Success Message Styling
```jsx
<div className="card p-4 bg-status-success/5 border border-status-success/20 rounded-lg">
  <div className="flex gap-3">
    <svg className="w-5 h-5 text-status-success shrink-0" fill="currentColor">
      <path d="M10 16.5l-4-4m0 0l-2 2m2-2l2-2" />
    </svg>
    <div>
      <h3 className="font-semibold text-status-success text-sm">Success</h3>
      <p className="text-dc1-text-secondary text-xs mt-1">What was completed</p>
    </div>
  </div>
</div>
```

### Warning Message Styling
```jsx
<div className="card p-4 bg-dc1-amber/5 border border-dc1-amber/20 rounded-lg">
  <div className="flex gap-3">
    <svg className="w-5 h-5 text-dc1-amber shrink-0">...</svg>
    <div>
      <h3 className="font-semibold text-dc1-amber text-sm">Warning</h3>
      <p className="text-dc1-text-secondary text-xs mt-1">What to watch out for</p>
    </div>
  </div>
</div>
```

---

## RTL Layout Compatibility

All error components must work in Arabic RTL:
- [ ] Icons positioned correctly on RTL (left vs right)
- [ ] Text alignment flips properly
- [ ] Button order makes sense in RTL

**Test with:** `/app/ar/...` routes (Arabic prefix)

---

## Accessibility Requirements

All error states must:
- [ ] Use semantic HTML (`<aside role="alert">` for errors)
- [ ] Include meaningful icon descriptions (aria-label)
- [ ] Have sufficient color contrast (WCAG AA)
- [ ] Be keyboard navigable (Tab to retry/dismiss buttons)
- [ ] Announce changes to screen readers

---

## Implementation Checklist

**Frontend Developer (DCP-902) should:**
- [ ] Create ErrorCard component with variants (error, warning, success)
- [ ] Implement error boundaries on all renter pages
- [ ] Add timeout handling to API calls
- [ ] Create toast notifications for quick feedback
- [ ] Implement field-level validation feedback
- [ ] Test all error paths during Phase 1 QA

**UI/UX Specialist (DCP-904) should:**
- [ ] Review implementation for UX clarity
- [ ] Test error recovery paths with users
- [ ] Verify design system consistency
- [ ] Report friction points in Phase 1 monitoring

---

## Phase 1 Testing Scenarios

**Day 4:** Basic error states (auth, timeouts, not found)
**Day 5:** Complex errors (job failures, payment issues)
**Day 6:** Error recovery and user comprehension

---

## Success Criteria
- ✅ All error messages are clear and actionable
- ✅ Users can recover from errors without support
- ✅ No users report confusion about error messages
- ✅ Design system consistency verified
- ✅ RTL layout works correctly
- ✅ Accessibility requirements met

---

**Prepared by:** UI/UX Specialist
**Date:** 2026-03-25
**Linked to:** DCP-902 (Frontend), DCP-904 (Phase 1 Support)
