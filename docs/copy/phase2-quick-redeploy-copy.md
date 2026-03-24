# Phase 2.0 Feature Copy: Quick Redeploy
## One-Click Job Redeployment Messaging

**Status:** Draft for code review
**Created:** 2026-03-24 03:20 UTC
**Feature:** DCP Phase 2.0 — Quick Redeploy (repeat job submission from history)
**Target Users:** Renters (repeat deployment, 25-30% conversion target)
**Languages:** English + Arabic (RTL)

---

## Modal Flow Overview

### Modal 1: Confirm & Review Settings
- Original job details (read-only)
- Current settings (editable: GPU selection, input request)
- Cost estimate + balance check
- "Continue" or "Cancel"

### Modal 2: Top-Up If Needed
- Current balance vs required amount
- Quick-add options ($5, $10, custom)
- "Add Credit & Deploy" or "Back"

### Modal 3: Success Confirmation
- Job submitted! Checkmark icon
- Job details summary
- "View Job Details" or "Back to History"
- Auto-close after 3 seconds

---

## Copy by Component

### Job History Card

**Redeploy Button:**
- **EN:** "Redeploy"
- **AR:** "إعادة النشر"
- **Tooltip:** "Run this job again with the same settings" / "قم بتشغيل هذه الوظيفة مرة أخرى بنفس الإعدادات"

### Modal Header (All Modals)

**Modal 1 - Title:** "Redeploy Job" / "أعد نشر الوظيفة"
**Subtitle:** "Review your settings and confirm to start" / "راجع إعداداتك وأكد للبدء"

**Modal 2 - Title:** "Add Credits to Deploy" / "أضف أرصدة للنشر"

**Modal 3 - Title:** "Job Submitted!" / "تم إرسال الوظيفة!"

### Original Job Details Section

**Section Label:** "Original Job Details"
**AR:** "تفاصيل الوظيفة الأصلية"

**Content:**
- Model: {model_name} [badge, read-only]
- GPU Type: {gpu_type} [read-only]
- Request: "{original_request}" [truncated, expandable]
- Status: "Completed {time_ago}"

### Current Settings Section

**GPU Selection:**
- **Label:** "GPU Selection"
- **AR:** "اختيار معالج الرسومات"
- **Default:** "{provider_name} (same provider as before)"
- **Help Text:** "This provider completed your job before. Click to choose a different GPU." / "أكمل موفّر الخدمة هذا وظيفتك من قبل. انقر لاختيار معالج رسومي مختلف."
- **Editable:** Click to change provider

**Model:**
- **Label:** "Model"
- **AR:** "النموذج"
- **Content:** "{model_name}" [badge, read-only]

**Input Request:**
- **Label:** "Your Request"
- **AR:** "طلبك"
- **Placeholder:** "Enter your request (you can modify the original)" / "أدخل طلبك (يمكنك تعديل الطلب الأصلي)"
- **Default:** Original request text, editable
- **Type:** Textarea

### Cost Estimate

**Label:** "Estimated Cost"
**AR:** "التكلفة المقدرة"
**Amount:** "${cost}" (e.g., "$4.50")
**Comparison:** "Same price as your last job" / "نفس السعر كوظيفتك الأخيرة"

### Balance Check (Modal 1)

**If Sufficient Balance:**
- No message (implicit: ready to proceed)

**If Insufficient Balance:**
- **Message:** "Insufficient balance. Top up to continue." / "رصيد غير كافٍ. أضف المزيد للمتابعة."
- **"Continue" button:** Disabled

### Balance Display (Modal 2)

**Current Balance:** "${balance}" (e.g., "$0.50")
**Required:** "${required}" (e.g., "$4.50")
**Shortfall:** "${shortfall}" (e.g., "$4.00")

**Quick-Add Options:**
- **"Add $5"** / "أضف 5 دولارات" → Adds $5, auto-deploys
- **"Add $10"** / "أضف 10 دولارات" → Adds $10, auto-deploys
- **"Custom Amount"** → Text input, user enters amount

**Payment Reminder:**
- "Using {card_ending} • Change" / "استخدام {card_ending} • تغيير"

### Success Screen (Modal 3)

**Heading:** "Job Submitted!" / "تم إرسال الوظيفة!"
**Icon:** Checkmark circle

**Details Summary:**
- Model: {model_name}
- Provider: {provider_name} ({gpu_type})
- Cost: ${cost}
- Estimated Time: 2-3 minutes

**Status Message:**
- "Your job is running. You'll see results in your job history when complete." / "وظيفتك جارية. ستشاهد النتائج في سجل الوظائف عند الانتهاء."

---

## Error State Messages

### Provider Offline

**Title:** "Provider No Longer Available" / "موفّر الخدمة لم يعد متاحًا"
**Message:** "The provider you used before is offline. Choose a different one." / "موفّر الخدمة الذي استخدمته سابقًا غير متصل. اختر موفّرًا مختلفًا."
**CTA:** "Choose Provider" / "اختر موفّر الخدمة"

### Model No Longer Available

**Title:** "Model No Longer Available" / "النموذج لم يعد متاحًا"
**Message:** "Llama 3 8B is not currently available. Choose a similar model?" / "Llama 3 8B غير متوفر حاليًا. هل تختار نموذجًا مشابهًا؟"
**Options:**
- "Choose Llama 3 70B instead" / "اختر Llama 3 70B بدلاً من ذلك"
- "Pick a different model" / "اختر نموذجًا مختلفًا"
- "Cancel" / "إلغاء"

### Network/API Error

**Title:** "Could Not Submit Job" / "لم يتمكن من إرسال الوظيفة"
**Message:** "Something went wrong. Please try again or contact support." / "حدث خطأ ما. يرجى المحاولة مرة أخرى أو الاتصل بالدعم."
**CTAs:** "Try Again" / "حاول مجددًا" | "Contact Support" / "اتصل بالدعم"

---

## Button & CTA Labels

| Context | English | Arabic |
|---------|---------|--------|
| Primary (Proceed) | "Continue" | "متابعة" |
| Primary (Submit) | "Add Credit & Deploy" | "أضف رصيد والنشر" |
| Primary (View) | "View Job Details" | "عرض تفاصيل الوظيفة" |
| Secondary | "Cancel" / "Back" | "إلغاء" / "رجوع" |
| Secondary (Link) | "Back to History" | "العودة إلى السجل" |
| Error Recovery | "Try Again" | "حاول مجددًا" |
| Help | "Contact Support" | "اتصل بالدعم" |

---

## Mobile Considerations

- Modal max-width: <640px
- All touch targets: 44px minimum
- Button full-width on mobile (<640px)
- Scroll within modal if content exceeds viewport
- Sticky "Continue" button at modal bottom on mobile

---

## Localization Notes

- **Arabic:** Modern Standard Arabic (MSA) with numeral support
- **RTL:** Modal buttons, labels, inputs all RTL-ready
- **Currency:** SAR prices + $ symbols
- **Numerals:** Arabic numerals for AR locale

---

## KPI Tracking

**Metric:** Repeat job conversion rate (target: 25-30%)
- Track: Redeploy button clicks
- Track: Modal open rate
- Track: Modal completion rate
- Track: Cost impact ($ from repeat jobs)
