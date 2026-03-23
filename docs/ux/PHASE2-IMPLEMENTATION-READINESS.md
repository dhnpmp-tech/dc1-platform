# Phase 2 UX Implementation Readiness Brief

**Prepared by:** UI/UX Specialist
**Date:** 2026-03-23 20:50 UTC
**Status:** Ready for Frontend Developer handoff (awaiting code review approval)
**Target:** Sprint 28 parallel implementation (15 hrs each feature)

---

## Executive Summary

Two comprehensive UX specifications are in code review and ready for immediate Frontend implementation:

1. **Phase 2.0 Quick-Redeploy** — One-click job rerun (job history + redeploy modal)
2. **Phase 2.2 Arabic Personalization** — Language toggle + Arabic models + SAR pricing

**Combined Impact:** +25-30% repeat jobs + +40% Arab market acquisition = ~$2.8K-$5.6K additional Year 1 MRR

**Timeline to Launch:** Sprint 28 (7 days post-code-review-approval)

---

## Feature 1: Phase 2.0 Quick-Redeploy

### UX Spec Location
**File:** `/docs/ux/phase2-quick-redeploy-ux-spec.md` (412 lines)
**Branch:** `ui-specialist/phase2-quick-redeploy-spec` (commit: 389b32c)
**Status:** In code review (awaiting CR approval)

### Implementation Summary

**Components Needed:**
- `JobHistory` page component (list of past 20 jobs)
- `QuickRedeployModal` (3-step flow: Confirm → Deploy → Success/Error)
- `JobHistoryList` (rows with action buttons)
- `RedeployConfirm` (config summary display)
- `RedeployInProgress` (status tracking)
- `RedeployError` (error handling UI)

**Data Requirements:**
```json
GET /api/jobs
{
  "jobId": "job-abc123",
  "templateName": "Llama-3-8B Inference",
  "gpuModel": "RTX 4090",
  "params": { "maxTokens": 2048, "temperature": 0.7, "topP": 0.95 },
  "costPerMin": 0.25,
  "previousDuration": 150,
  "previousCost": 18.75,
  "status": "completed",
  "createdAt": "2026-03-22T15:30:00Z"
}

POST /api/jobs/{jobId}/redeploy
{ "params": {...same as original...} }
```

**Key UX Rules:**
- Show estimated cost BEFORE redeploy (prevents surprise bills)
- Use WebSocket/polling for real-time status (no manual refresh)
- Always offer recovery path for errors (retry, different GPU, contact support)
- Mobile: Full-width modal, swipe-friendly

**Success Metrics to Track:**
- `job.redeploy.viewed` — modal open rate
- `job.redeploy.started` — click rate
- `job.redeploy.success` — completion rate
- Average time from click to running (target: <30 sec)
- Repeat job frequency % increase (target: +25-30%)

**Frontend Effort:** ~15 hours (2 days)

---

## Feature 2: Phase 2.2 Arabic Personalization

### UX Spec Location
**File:** `/docs/ux/phase2-arabic-personalization-ux-spec.md` (598 lines)
**Branch:** `ui-specialist/phase2-arabic-personalization-spec` (commit: bf9dbf0)
**Status:** In code review (awaiting CR approval)

### Implementation Summary

**Components Needed:**
- `LanguagePreferenceModal` (onboarding, 2 options)
- `LanguageToggle` (header button, persistent)
- `ArabicModelsCarousel` (6 featured models)
- `LanguageProvider` (context for locale/RTL switching)
- SAR pricing toggle in Settings

**Data Requirements:**
```json
GET /api/i18n
{
  "languages": [
    { "code": "ar", "name": "عربي", "direction": "rtl" },
    { "code": "en", "name": "English", "direction": "ltr" }
  ],
  "translations": {
    "ar": { "header.browse_models": "استعرض النماذج", ... },
    "en": { "header.browse_models": "Browse Models", ... }
  }
}

GET /api/models?language=ar
{
  "models": [
    { "id": "allam-7b", "arabicCapability": "native", "arabicBadge": "🌍 Arabic Native" },
    ...
  ]
}
```

**Key UX Rules:**
- Location-based defaults (Saudi/UAE/Egypt → Arabic; US/EU → English)
- Persistent preference (localStorage + user profile)
- RTL layout (use CSS `direction: rtl`, Flexbox auto-reverse)
- SAR conversion: `displayPrice = usdPrice * 3.75`
- Responsive: Desktop carousel (6 cols), Tablet (3 cols), Mobile (1 col, swipeable)

**Success Metrics to Track:**
- `user.onboarding.language_selected` — adoption rate
- `ui.language_toggle_clicked` — toggle frequency
- `carousel.arabic_models.model_deployed` — featured model usage
- Arab user conversion rate (target: +40% vs baseline)
- Arab market MRR (track separately for visibility)

**Frontend Effort:** ~15 hours (2 days)

---

## Parallel Implementation Strategy (Sprint 28)

### Week 1: Parallel Development
- **Day 1-2:** Both features in parallel (no blocking dependencies)
- **Day 3:** Integration testing (language toggle affects redeploy modal)
- **Day 4-5:** Refinement, mobile testing, analytics verification
- **Day 6-7:** Polish, performance optimization, launch prep

### Implementation Order (Recommended)
1. **Day 1:** LanguageProvider + LanguageToggle (affects all pages)
2. **Day 1-2:** ArabicModelsCarousel (data-driven, straightforward)
3. **Day 2-3:** JobHistory + QuickRedeployModal (more complex state)
4. **Day 3:** Settings SAR toggle (data storage, persistence)
5. **Day 4:** Full integration + cross-feature testing

### Integration Points
- LanguageToggle must persist across navigation
- QuickRedeployModal inherits language context
- ArabicModelsCarousel shows in both EN/AR
- SAR pricing applies to redeploy cost display

---

## Design Tokens & Styling

### Colors (Use Existing `dc1-*` System)
```css
--dc1-primary: #0066cc;
--dc1-surface: #f5f5f5;
--dc1-text-primary: #1a1a1a;
--dc1-text-secondary: #666666;
--dc1-accent-success: #00aa44;
```

### Typography
**English:**
- Font: Inter / system sans-serif
- Sizes: 14px (body), 16px (labels), 20px (headings)
- Weight: 400 (body), 600 (headings)

**Arabic (RTL):**
- Font: Segoe UI, Arial, system Arabic fonts
- Sizes: 15px (larger for readability)
- Weight: 500 (body), 700 (headings)

### Spacing
- `--dc1-spacing-sm: 4px`
- `--dc1-spacing-md: 8px`
- `--dc1-spacing-lg: 16px`
- Same for LTR/RTL (CSS Flexbox handles reversal)

### Breakpoints
- Desktop: > 1024px
- Tablet: 768–1024px
- Mobile: < 768px

---

## API Endpoints Required

### Existing (Already Implemented)
- `GET /api/templates` — 20 templates, filtering works
- `GET /api/models` — 11 models with pricing
- `GET /api/health` — Infrastructure monitoring

### New Endpoints Needed
| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/jobs` | GET | Past job history (paginated) | Needs backend |
| `/api/jobs/{jobId}/redeploy` | POST | Redeploy with same params | Needs backend |
| `/api/i18n` | GET | Language & translation data | Needs backend |
| `/api/models?language=ar` | GET | Filter models by language | Needs backend |

**Backend Effort:** ~4-6 hours (coordinate with Backend Engineer)

---

## Testing Strategy

### Unit Tests
- LanguageProvider context switching
- SAR conversion calculation (usdPrice * 3.75)
- Redeploy cost estimation logic
- Arabic text rendering validation

### E2E Tests (QA Harness Ready)
- Onboarding language selection flow
- Language toggle persistence (across page nav)
- Quick-redeploy modal (all 3 steps + error states)
- ArabicModelsCarousel (swipe/click on mobile, click on desktop)
- SAR display correctness

### Mobile Testing
- Carousel swiping (iOS + Android)
- Modal full-screen behavior
- Touch targets (min 48px)
- RTL layout correctness (text direction, spacing, icons)

### Accessibility
- `lang="ar"` on HTML element
- ARIA labels in target language
- Screen reader testing (NVDA, JAWS, VoiceOver)
- Keyboard navigation (Tab order same in LTR/RTL)

---

## Launch Readiness Checklist

- [ ] Code review approved (waiting for CR)
- [ ] Merge to main
- [ ] Backend endpoints deployed
- [ ] Frontend implementation started (parallel)
- [ ] Daily integration testing
- [ ] Mobile testing on real devices
- [ ] Analytics events wired
- [ ] Performance profiling (Lighthouse 90+)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] QA sign-off
- [ ] Soft launch (10% traffic)
- [ ] Monitor metrics (repeat rate, Arab conversion)
- [ ] Full launch

---

## Metrics Dashboard (Post-Launch)

### Week 1 KPIs
- **Quick-Redeploy:**
  - Modal view rate (target: 40%+)
  - Redeploy completion rate (target: 95%+)
  - Avg time to deploy (target: <30 sec)

- **Arabic Personalization:**
  - Language adoption % (target: 35%+ from Saudi/UAE)
  - Arab user conversion (target: +40% vs baseline)
  - Featured model click rate (target: 25%+)

### Week 2-4 Impact
- Repeat job MRR increase (target: +25-30%)
- Arab market MRR growth (target: +$2.8K-$5.6K)
- Average order value (both segments)
- User retention (repeat rate vs new users)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| RTL layout breaks on existing components | Early mobile testing, use CSS Grid/Flexbox auto-reverse |
| Arabic font rendering issues | Load Google Fonts Arabic, test on real devices |
| Redeploy API inconsistency | Use same validation as original deploy endpoint |
| SAR exchange rate outdates | Cache for 24 hours, provide manual refresh endpoint |
| QA testing blocked on backend delays | Coordinate backend sprint, use mock APIs initially |

---

## Questions for Frontend Developer

1. **Job History pagination:** How many jobs per page? Load more vs pagination buttons?
2. **Redeploy async:** Use WebSocket or polling for status updates? Max polling interval?
3. **Language switching:** Full page reload or SPA client-side switch?
4. **SAR storage:** User preference in localStorage + profile, or just localStorage?
5. **Test data:** Need sample jobs/models for development, or use production API?

---

## Handoff Contacts

- **UX Spec Questions:** UI/UX Specialist (24ab4f1e-0d13-41a5-8810-0c05bbb9e648)
- **Backend API:** Backend Engineer (coordinate for `/api/jobs`, `/api/i18n`)
- **QA Integration:** QA Engineer (coordinate E2E test harness)
- **Analytics:** Product team (event tracking configuration)
- **Deployment:** DevOps (coordinate Phase 2 launch timing)

---

## Timeline Summary

| Phase | Date | Owner | Status |
|-------|------|-------|--------|
| Code Review | 2026-03-23 21:00 UTC | Code Reviewers | In progress |
| Merge to main | 2026-03-23 21:30 UTC | Code Reviewers | Pending |
| Backend API prep | 2026-03-24 | Backend Engineer | Not started |
| Frontend dev starts | 2026-03-24 | Frontend Developer | Not started |
| Integration testing | 2026-03-25 | Frontend + QA | Not started |
| Polish & refinement | 2026-03-26 | Frontend | Not started |
| Phase 2 Launch | 2026-03-27 | All teams | Target |

---

**Ready to coordinate. Awaiting code review approval.**
