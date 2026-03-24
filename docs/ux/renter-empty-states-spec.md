# Renter Job Dashboard — Empty States UX Spec

## Overview
Empty states guide renters toward their next action when the job history dashboard displays no content. Each state addresses a distinct user journey moment with contextual copy and clear CTAs.

---

## State 1: No Jobs Yet (New Renter)

**Context:** User signed up, completed onboarding, but never deployed a job.

### Visual Design
- **Illustration:** Simple GPU cluster or cloud computing metaphor (not AI-specific; signals "compute resources waiting for work")
- **Headline:** "Your compute journey starts here"
- **Subheading:** "Deploy a model, run inference, or run training—all on GPUs powered by Saudi renewable energy."

### Copy
```
Headline: "Your compute journey starts here"
Subheading: "Deploy a model, run inference, or run training—all on GPUs powered by Saudi renewable energy."
CTA Button: "Browse Models"
```

### Interaction
- **Primary CTA:** "Browse Models" button → navigates to `/marketplace` or template browse page
- **Secondary action:** Link to "View pricing" (shows hourly rates vs hyperscalers)
- **Tone:** Welcoming, energy-positive (emphasize Saudi renewable energy and cost advantage)

### Arabic Translation
```
Headline: "رحلتك الحسابية تبدأ هنا"
Subheading: "نشّر نموذج، شغّل الاستدلال، أو ادرّب — الكل على معالجات رسوميات مدعومة بالطاقة المتجددة السعودية."
CTA Button: "استعرض النماذج"
Secondary: "عرض التسعير"
```

### Design Notes
- Illustration should include energy icon (sun/lightning) to reinforce renewable narrative
- CTA button color: primary brand color
- RTL-aware layout: button and text aligned right in Arabic, left in English
- No "dismissible" close button—this is helpful, not an error

---

## State 2: No Models Match Filter

**Context:** Renter applied one or more filters (GPU type, price range, region, model name) and search returned zero results.

### Visual Design
- **Icon:** Funnel with "X" or empty search result icon
- **Headline:** "No models match your filters"
- **Subheading:** "Try adjusting your criteria to find GPUs that fit your needs"

### Copy
```
Headline: "No models match your filters"
Subheading: "Try adjusting your criteria to find GPUs that fit your needs"
CTA Button: "Clear Filters"
Secondary text: "View all available models"
```

### Interaction
- **Primary CTA:** "Clear Filters" button → resets all filters and shows full marketplace
- **Secondary action:** "View all available models" link → shows unfiltered results
- **Tone:** Reassuring (user did not waste effort; filters just constrained too much)

### Arabic Translation
```
Headline: "لا توجد نماذج تطابق عوامل التصفية لديك"
Subheading: "حاول تعديل معاييرك للعثور على معالجات رسوميات تناسب احتياجاتك"
CTA Button: "مسح عوامل التصفية"
Secondary: "عرض جميع النماذج المتاحة"
```

### Design Notes
- Show which filters are active (e.g., "Filtered by: RTX 4090, $0.15–$0.25/hr")
- "Clear Filters" is the main CTA
- Keep tone matter-of-fact, not apologetic
- No illustration needed—icon + text is sufficient

---

## State 3: Zero Balance

**Context:** Renter has no USDC credits in their wallet. They cannot deploy until they add funds.

### Visual Design
- **Icon:** Wallet or credit card with a "+" symbol
- **Headline:** "No credits to deploy"
- **Subheading:** "Add credits to your wallet and start running jobs in seconds."

### Copy
```
Headline: "No credits to deploy"
Subheading: "Add credits to your wallet and start running jobs in seconds."
CTA Button: "Add Credits"
Supporting text: "All jobs are pay-as-you-go. No subscriptions. Cancel anytime."
```

### Interaction
- **Primary CTA:** "Add Credits" button → navigates to `/wallet/deposit` or payment flow
- **Supporting text:** Emphasize pay-as-you-go model and flexibility (no lock-in)
- **Balance display:** Show current balance in wallet header (e.g., "Balance: $0.00")
- **Tone:** Friendly, not alarming; framing credits as "starting your journey," not "fixing a problem"

### Arabic Translation
```
Headline: "لا توجد رصيد للنشر"
Subheading: "أضف رصيداً إلى محفظتك وابدأ تشغيل الوظائف في ثوان."
CTA Button: "إضافة رصيد"
Supporting text: "جميع الوظائف بدفع حسب الاستخدام. لا توجد اشتراكات. ألغِ في أي وقت."
```

### Design Notes
- No illustration—icon + text sufficient
- CTA button color: primary brand color (draws attention without feeling urgent)
- Supporting text reassures about pay-as-you-go (addresses friction)
- Consider showing "Sample cost: Deploy RTX 4090 for 1 hour = $0.27" to set expectations

---

## State 4: Provider Offline

**Context:** Renter selected a specific model/template, but no active provider is currently serving it. Common during low-demand hours or when providers are updating.

### Visual Design
- **Icon:** Server/provider with a "pause" or "offline" indicator
- **Headline:** "This template isn't available right now"
- **Subheading:** "Providers are offline. Check back in a few minutes, or try a different template."

### Copy
```
Headline: "This template isn't available right now"
Subheading: "Providers are offline. Check back in a few minutes, or try a different template."
CTA Button: "Browse Other Models"
Secondary: "Join the waitlist"
Tertiary text: "Estimated back online: [timestamp from backend]"
```

### Interaction
- **Primary CTA:** "Browse Other Models" → returns to marketplace, suggests similar templates
- **Secondary CTA:** "Join waitlist" → optional notification when provider comes online (email or in-app)
- **Tertiary info:** Show estimated provider availability if backend provides it (e.g., "Expected in 15 minutes")
- **Tone:** Honest and reassuring (not a technical error; just timing)

### Arabic Translation
```
Headline: "هذا القالب غير متاح الآن"
Subheading: "موفرو الخوادم غير متصلين. عد بعد بضع دقائق، أو جرب قالباً مختلفاً."
CTA Button: "استعرض نماذج أخرى"
Secondary: "انضم إلى قائمة الانتظار"
Tertiary: "متوقع العودة للخط: [timestamp]"
```

### Design Notes
- Icon should clearly signal "offline" state (e.g., server with strikethrough or pause icon)
- Avoid language like "error" or "failed"—frame as availability, not failure
- Show estimated comeback time if available from backend (reduces anxiety)
- Secondary "Join waitlist" is lower prominence but important for user retention
- Consider showing 1–2 alternative templates that ARE available

---

## Implementation Checklist

### Frontend Developer
- [ ] Integrate empty state specs into renter job dashboard component
- [ ] Implement state detection logic (0 jobs, filter mismatch, zero balance, offline provider)
- [ ] Add Arabic RTL layout support for all empty states
- [ ] Test with and without illustrations (ensure text alone is sufficient if illustrations are delayed)
- [ ] Wire CTAs to correct navigation targets (`/marketplace`, `/wallet/deposit`, etc.)
- [ ] Add loading state (spinner) while checking job/balance/provider status

### Copy & Localization
- [ ] All English copy reviewed by Product/Marketing
- [ ] Arabic translations reviewed by native Arabic speaker for dialect and RTL compliance
- [ ] Ensure Likert scale questions and observation template use consistent tone

### QA
- [ ] Test all four empty states in English and Arabic
- [ ] Verify CTAs navigate to correct pages
- [ ] Test on mobile (ensure illustrations scale appropriately)
- [ ] Verify Arabic text renders correctly with proper RTL support

---

## Success Criteria

✅ Renter sees contextualized, actionable empty states instead of blank screens or generic "no data" messages

✅ Each state clearly explains why content is missing and what the renter can do next

✅ CTAs have high click-through rate (>40% observed in Phase 1 user testing)

✅ Arabic translations are culturally appropriate and RTL-aware

✅ Zero confusion or frustration in user testing sessions
