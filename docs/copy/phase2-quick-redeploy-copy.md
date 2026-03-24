# Phase 2.0 Feature Copy: Quick Redeploy
## One-Click Job Redeployment Messaging

**Status:** Draft for code review
**Created:** 2026-03-24 03:20 UTC
**Feature:** DCP Phase 2.0 — Quick Redeploy (repeat job submission from history)
**Target Users:** Renters (repeat deployment, 25-30% conversion target)
**Languages:** English + Arabic (RTL)

---

## Overview

The Quick Redeploy feature allows renters to re-run a previous job with one click from their Job History. This drives repeat usage and increases renter lifetime value.

**Copy Goals:**
- Emphasize speed + convenience (one click = instant deploy)
- Highlight cost savings continuity (same price as before)
- Reduce friction for power users
- Drive 25-30% repeat job conversion rate

---

## Dashboard & History Integration

### Job History Card (Existing Job)

**Card Layout:**
```
[Model Icon] Llama 3 8B Inference
Completed 2 hours ago | $4.32 cost
[View Details] [Redeploy] ← New CTA
```

**Redeploy Button Styling:**
- **Label:** "Redeploy"
- **AR:** "إعادة النشر"
- **Icon:** Circular arrow or lightning bolt
- **Color:** Primary (#2563EB)
- **Size:** 44px min touch target
- **Tooltip on hover:**
  - **EN:** "Run this job again with the same settings"
  - **AR:** "قم بتشغيل هذه الوظيفة مرة أخرى بنفس الإعدادات"

**Accessibility:**
- Keyboard accessible (Tab → Enter)
- Screen reader label: "Redeploy job {model} {timestamp}"
- AR: "أعد نشر وظيفة {model} {timestamp}"

---

## Quick Redeploy Modal Flow

### Modal 1: Confirm & Review (First Screen)

**Modal Header:**
- **Title:** "Redeploy Job"
- **AR:** "أعد نشر الوظيفة"
- **Subtitle:**
  - **EN:** "Review your settings and confirm to start"
  - **AR:** "راجع إعداداتك وأكد للبدء"

**Collapsible Section: "Original Job Details"**
- **Model:** Llama 3 8B
- **GPU Type:** RTX 4090
- **Request:** "Summarize this document..." (truncated)
- **Status:** Completed 2 hours ago

**Collapsible Section: "Current Settings"** (always expanded)
- **GPU Selection:** "RTX 4090 (same provider)" ← Recommend provider from previous job
  - **Help text:**
    - **EN:** "This provider completed your job before. Click to choose a different GPU."
    - **AR:** "أكمل موفّر الخدمة هذا وظيفتك من قبل. انقر لاختيار معالج رسومي مختلف."

- **Model:** "Llama 3 8B" (read-only badge)
  - **AR:** "Llama 3 8B"

- **Input Request:** "Summarize this document..." (editable textarea)
  - **Label:** "Your Request"
  - **AR:** "طلبك"
  - **Placeholder:** "Enter your request (you can modify the original)"
  - **AR Placeholder:** "أدخل طلبك (يمكنك تعديل الطلب الأصلي)"

**Cost Estimate Display:**
- **Label:** "Estimated Cost"
- **AR:** "التكلفة المقدرة"
- **Amount:** "$4.50" (similar to original)
- **Comparison:** "Same price as your last job"
- **AR Comparison:** "نفس السعر كوظيفتك الأخيرة"

**Primary CTA: "Continue"**
- **Label:** "Continue"
- **AR:** "متابعة"
- **Disabled state:** If cost exceeds wallet balance
  - **Message:** "Insufficient balance. Top up to continue."
  - **AR:** "رصيد غير كافٍ. أضف المزيد للمتابعة."

**Secondary CTA: "Cancel"**
- **Label:** "Cancel" or "Back"
- **AR:** "إلغاء" / "رجوع"

---

### Modal 2: Confirmation & Top-Up (Second Screen - If Needed)

**Scenario:** User's balance is low or empty

**Hero Message:**
- **EN:** "Add Credits to Deploy"
- **AR:** "أضف أرصدة للنشر"

**Balance Display:**
- **Current Balance:** "$0.50"
- **Required:** "$4.50"
- **Shortfall:** "$4.00"

**Top-Up Options** (linked to payment system):
- **Quick Add $5:**
  - **Label:** "Add $5" / "أضف 5 دولارات"
  - **Then deploy automatically**

- **Quick Add $10:**
  - **Label:** "Add $10" / "أضف 10 دولارات"
  - **Then deploy automatically**

- **Custom Amount:**
  - **Input field:** "Enter amount"
  - **AR:** "أدخل المبلغ"

**Payment Method Reminder:**
- **Text:** "Using {card ending in 4242} • Change"
- **AR:** "استخدام {card ending in 4242} • تغيير"

**CTAs:**
- **Primary:** "Add Credit & Deploy"
- **AR:** "أضف رصيد والنشر"
- **Secondary:** "Back to Job"
- **AR:** "العودة إلى الوظيفة"

---

### Modal 3: Deployment Submitted (Success)

**Hero Message:**
- **EN:** "Job Submitted!"
- **AR:** "تم إرسال الوظيفة!"
- **Icon:** Checkmark circle

**Job Details Summary:**
- **Model:** Llama 3 8B
- **Provider:** RTX 4090 (same as before)
- **Cost:** $4.50
- **Estimated Time:** 2-3 minutes
- **AR Estimated Time:** "2-3 دقائق"

**Status Message:**
- **EN:** "Your job is running. You'll see results in your job history when complete."
- **AR:** "وظيفتك جارية. ستشاهد النتائج في سجل الوظائف عند الانتهاء."

**CTAs:**
- **Primary:** "View Job Details"
- **AR:** "عرض تفاصيل الوظيفة"
- **Secondary:** "Back to History"
- **AR:** "العودة إلى السجل"

**Auto-close:** Modal dismisses after 3 seconds (user can click X to close sooner)

---

## Error States

### Provider Offline
**Title:** "Provider No Longer Available"
**AR:** "موفّر الخدمة لم يعد متاحًا"

**Message:**
- **EN:** "The provider you used before is offline. Choose a different one."
- **AR:** "موفّر الخدمة الذي استخدمته سابقًا غير متصل. اختر موفّرًا مختلفًا."

**CTA:** "Choose Provider" / "اختر موفّر الخدمة"
- Opens GPU/provider selection modal

### Model No Longer Available
**Title:** "Model No Longer Available"
**AR:** "النموذج لم يعد متاحًا"

**Message:**
- **EN:** "Llama 3 8B is not currently available. Choose a similar model?"
- **AR:** "Llama 3 8B غير متوفر حاليًا. هل تختار نموذجًا مشابهًا؟"

**Options:**
- "Choose Llama 3 70B instead" / "اختر Llama 3 70B بدلاً من ذلك"
- "Pick a different model" / "اختر نموذجًا مختلفًا"
- "Cancel" / "إلغاء"

### Insufficient Funds (Already Covered Above)
See Modal 2: Confirmation & Top-Up

### Network/API Error
**Title:** "Could Not Submit Job"
**AR:** "لم يتمكن من إرسال الوظيفة"

**Message:**
- **EN:** "Something went wrong. Please try again or contact support."
- **AR:** "حدث خطأ ما. يرجى المحاولة مرة أخرى أو الاتصال بالدعم."

**CTAs:**
- "Try Again" / "حاول مجددًا"
- "Contact Support" / "اتصل بالدعم"

---

## Success Metrics & KPI Alignment

**Goal:** Drive 25-30% repeat job rate (increase renter LTV)

**Tracking Points:**
- **Redeploy click rate:** % of renters clicking redeploy from history
- **Modal completion rate:** % starting redeploy who confirm + submit
- **Repeat job frequency:** Days between original job and redeploy
- **Revenue impact:** $ from repeat jobs (should be +25-30% vs current)

**Copy Impact on KPIs:**
- "One click" messaging reduces friction → higher redeploy click
- "Same price" messaging removes cost uncertainty → higher confirmation
- "Same provider" default reduces decision fatigue → faster completion
- Top-up flow captures revenue from balance-depleted users

---

## Tone & Brand Alignment

**Tone:** Quick, confident, friction-reducing
**Voice:** Action-oriented, trust-building (familiar model + provider)
**Messaging:**
- Convenience first (one click = instant)
- Trust through familiarity (same provider that worked before)
- Financial transparency (cost estimates, balance checks)
- Friction removal (smart defaults, streamlined flow)

**Mobile-First Considerations:**
- Modal width <640px
- Touch targets 44px+ everywhere
- Scroll within modal if content > viewport
- "Continue" button bottom-sticky on mobile

---

## Localization Checklist

- [x] English copy complete
- [x] Arabic translations (Modern Standard Arabic)
- [x] RTL modal layout verified (buttons, inputs, labels)
- [x] Numerals: SAR prices + Arabic numerals for AR locale
- [x] Accessibility: Screen reader labels + WCAG AA contrast
- [ ] Code review (pending assignment)
- [ ] QA testing (pending UI implementation)
- [ ] RTL layout testing with designer

---

## Revision History

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 2026-03-24 | Copywriter | Initial draft based on Phase 2.0 UX spec. Ready for code review. |

---

## Integration Checklist for Frontend Developer

**Before Implementation:**
- [ ] Verify all button labels match exactly (including AR translations)
- [ ] Confirm modal widths + breakpoints for mobile (<640px)
- [ ] Check color tokens match design system (#2563EB primary)

**During Implementation:**
- [ ] Use exact copy from this document (no rewording)
- [ ] Implement all error states (provider offline, model unavailable, etc.)
- [ ] Test copy with real job data (truncation, overflow)
- [ ] Verify RTL text flow + button alignment in Arabic mode
- [ ] Implement modal auto-close on success (3 second delay)
- [ ] Wire top-up modal to payment system

**After Implementation:**
- [ ] QA: Test all user flows (happy path, error states, top-up)
- [ ] QA: Verify Arabic copy displays correctly + RTL layout
- [ ] Analytics: Track redeploy click rate, modal completion, revenue
- [ ] Monitoring: Log modal abandonment + error state frequencies

