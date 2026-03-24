# Phase 2: Arabic Market Personalization — UX Specification

**Issue:** DCP-xxx (Phase 2 Arabic Personalization UX Spec)
**Target Impact:** +40% Arab market acquisition & retention
**Timeline:** Sprint 28 (parallel with Quick-Redeploy, 5-7 days)
**Dependencies:** Phase 1 marketplace live, Phase 2.0 Quick-Redeploy MVP launched

---

## Executive Summary

Arabic Market Personalization makes DCP the first GPU marketplace optimized for Arabic-speaking users. Instead of a generic English-first marketplace, we activate:

1. **Onboarding Preference Flow** — First-time users choose Arabic or English (with smart defaults for Saudi/Middle East region)
2. **Language Toggle** — Persistent Arabic/English switcher in header
3. **Featured Arabic Models Carousel** — Homepage highlights ALLaM, Falcon H1, Qwen, Arabic RAG stack
4. **Arabic-Localized Content** — Product copy, help text, templates in Modern Standard Arabic (MSA)
5. **Regional Pricing Display** — Show prices in SAR with conversion note

**Target Users:** Arabic-speaking developers, data scientists, researchers in Saudi Arabia, UAE, Egypt, Jordan
**Measurement:** Arabic language adoption %, Saudi user conversion rate, Arab market MRR, repeat rate
**Business Impact:** $2.8K-$5.6K additional MRR from Arab market (Year 1), positioned as #1 Arabic GPU platform

---

## Phase 2.2 Scope (MVP)

### What's Included (Sprint 28)

✅ **Onboarding Preference Workflow**
- Location-based defaults (Saudi/UAE/Egypt/other → Arabic; US/EU → English)
- Simple 2-option modal on first signup: "عربي" vs "English"
- Persistent preference saved to user profile
- Can change anytime in settings

✅ **Language Toggle in Header**
- Visible Arabic/English button in top navigation
- Icon-based (🌍 with label, or AR/EN text)
- Live page reload (minimal API calls)
- Applies to entire marketplace UI

✅ **Featured Arabic Models Homepage Section**
- New carousel/grid section: "Arabic Models" or "نماذج عربية"
- 6 featured models: ALLaM-7B, Falcon H1-7B, Qwen 2.5-7B, Llama 3-8B (Arabic capable), BGE-M3 (embeddings), SDXL (Arabic prompts)
- Card design matches Phase 1 template cards
- Arabic capability badge (🌍 Arabic)
- Links to one-click deploy

✅ **Arabic UI Text**
- Header, navigation, key CTAs translated to MSA
- "Browse Models" → "استعرض النماذج"
- "Deploy" → "نشر"
- "Job History" → "سجل المهام"
- "Arabic RAG" → "استخراج المعلومات والإجابة بالعربية"
- Professional terminology (not slang)

✅ **Pricing Display in SAR**
- Option to show costs in SAR (Saudi Riyal) instead of USD
- Conversion rate display: "1 USD = 3.75 SAR"
- Example: "$0.25/min" → "0.94 SAR/min"
- Toggle in settings: "Show prices in SAR"

### What's Deferred to Phase 2.3+

❌ **Full Marketplace Localization** (Phase 2.3)
- Complete Arabic translation of all UI (100+ strings)
- RTL layout support (right-to-left text direction)
- Arabic numerals & date formats

❌ **Arabic Documentation & Help Center** (Phase 2.3)
- Full Arabic docs, API reference, tutorials
- In-product help text (tooltips, error messages)
- Blog in Arabic

❌ **Regional Payment Methods** (Phase 2.4)
- SADAD, Stripe local Saudi, Telr integration
- Regional invoicing in Arabic

---

## Design System

All components use existing `dc1-*` design tokens with Arabic support:

- **Colors:** `dc1-primary`, `dc1-accent-success` (for Arabic badge), `dc1-surface`, `dc1-text-primary`
- **Typography:**
  - English: `dc1-sans-serif` (Inter, 14px-18px)
  - Arabic: `dc1-sans-serif` with fallback to system Arabic fonts (Segoe, Tahoma, Arial)
  - Heading weight: 600-700
  - Body weight: 400-500
- **Spacing:** `dc1-spacing-md` (8px), `dc1-spacing-lg` (16px) — same for LTR/RTL
- **Icons:** Use language-agnostic icons (chevrons, stars, play buttons)
- **Language Badge:** 🌍 globe emoji + "Arabic Capable" text

---

## User Flows

### 1. Onboarding Language Selection

**Trigger:** First-time user signs up, lands on marketplace

**Flow:**

```
User Signs Up (existing flow)
    ↓
Detect Location (IP geolocation)
    ├─ Saudi Arabia, UAE, Egypt, Jordan → Default: Arabic
    ├─ North Africa (Morocco, Tunisia) → Default: Arabic
    └─ Other regions → Default: English
    ↓
Language Preference Modal (5 sec after login)
    ↓
User clicks "عربي" or "English"
    ↓
Preference saved to user.profile.language
    ↓
Marketplace reloads in selected language
    ↓
Homepage shows featured Arabic models carousel
```

**Modal Design:**

```
┌──────────────────────────────────────────────┐
│ Welcome to DCP                               │
├──────────────────────────────────────────────┤
│                                              │
│ Choose your preferred language:              │
│                                              │
│ ┌─────────────────┐  ┌─────────────────┐   │
│ │                 │  │                 │   │
│ │    عربي         │  │    English      │   │
│ │   (العربية)    │  │                 │   │
│ │                 │  │                 │   │
│ │   [Select]      │  │   [Select]      │   │
│ └─────────────────┘  └─────────────────┘   │
│                                              │
│ You can change this anytime in Settings.    │
│                                              │
│                            [Select Language] │
└──────────────────────────────────────────────┘
```

**Components:**
- **Title:** "Welcome to DCP" (English) or "مرحباً بك في DCP" (Arabic)
- **Description:** "Choose your preferred language" / "اختر لغتك المفضلة"
- **Options:** Two equal-sized cards with language name in native script
- **Button:** [Select] / [اختيار]
- **Footer Note:** "You can change anytime in Settings" / "يمكنك التغيير في الإعدادات"

**Interaction:**
- Hover: Highlight card with `dc1-primary` color
- Click: Save preference, reload page
- No "Skip" option (must select)
- Auto-select based on location (user can override)

---

### 2. Language Toggle in Header

**Location:** Top-right navigation bar, next to user profile menu

**Design:**

```
┌─────────────────────────────────────────────┐
│ 🔍 Search  [Features] [Pricing]  🌍 عربي  👤 │
└─────────────────────────────────────────────┘
```

**Components:**
- **Icon:** 🌍 globe emoji
- **Text:** "عربي" (Arabic) or "English" (toggles based on current language)
- **Dropdown Option (future):** Show both flags (🇸🇦 Arabic / 🇬🇧 English) when clicked
- **Action:** Click → reload page in opposite language, maintain scroll position

**Behavior:**
- User on marketplace homepage (Arabic) → clicks → reloads in English
- User on job history (English) → clicks → reloads in Arabic
- User's language preference saved to localStorage + user profile
- Sticky across pages (remembers choice)

**Mobile (< 768px):**
- Move to mobile menu (hamburger)
- Show as "Language: عربي" or "Language: English"

---

### 3. Featured Arabic Models Carousel (Homepage)

**Location:** Homepage, below "Popular Templates" section

**Content:**

6 featured models with Arabic badges and pricing:

| Model | Category | Price | Arabic Badge | Deploy Link |
|-------|----------|-------|--------------|------------|
| ALLaM-7B | LLM | $0.18/min | 🌍 Arabic Native | [Deploy] |
| Falcon H1-7B | LLM | $0.16/min | 🌍 Arabic Excellent | [Deploy] |
| Qwen 2.5-7B | LLM | $0.15/min | 🌍 Arabic Good | [Deploy] |
| Llama 3-8B | LLM | $0.20/min | 🌍 Arabic Good | [Deploy] |
| BGE-M3 | Embeddings | $0.08/min | 🌍 Arabic Capable | [Deploy] |
| SDXL | Image Gen | $0.12/min | 🌍 Arabic Prompts | [Deploy] |

**Visual Layout (Desktop):**

```
┌──────────────────────────────────────────────────────────────┐
│ Arabic Models                                  [← More →]    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                │
│ │ 🌍 ALLaM   │ │ 🌍 Falcon  │ │ 🌍 Qwen    │                │
│ │ 7B (Arabic)│ │ H1 (Arabic)│ │ 2.5 (Good) │                │
│ │            │ │            │ │            │                │
│ │ $0.18/min  │ │ $0.16/min  │ │ $0.15/min  │                │
│ │            │ │            │ │            │                │
│ │ [Deploy]   │ │ [Deploy]   │ │ [Deploy]   │                │
│ └────────────┘ └────────────┘ └────────────┘                │
│                                                               │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                │
│ │ 🌍 Llama 3 │ │ 🌍 BGE-M3  │ │ 🌍 SDXL    │                │
│ │ 8B (Good)  │ │ (Arabic)   │ │ (Prompts)  │                │
│ │            │ │            │ │            │                │
│ │ $0.20/min  │ │ $0.08/min  │ │ $0.12/min  │                │
│ │            │ │            │ │            │                │
│ │ [Deploy]   │ │ [Deploy]   │ │ [Deploy]   │                │
│ └────────────┘ └────────────┘ └────────────┘                │
│                                                               │
│ Featured for Arabic-speaking users. Optimized for Middle      │
│ East deployment. [Learn about Arabic RAG →]                  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Mobile (< 768px):**

```
┌──────────────────────────────────┐
│ Arabic Models      [← ▶]         │
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │ 🌍 ALLaM-7B (Arabic Native)   │ │
│ │ $0.18/min                    │ │
│ │ [Deploy]                     │ │
│ └──────────────────────────────┘ │
│ (Swipe or tap arrows to scroll)  │
└──────────────────────────────────┘
```

**Card Components:**
- **Header:** 🌍 badge + model name + Arabic capability level
- **Body:** Brief description (1 line)
- **Price:** Large, prominent (matches Phase 1 card design)
- **CTA Button:** "Deploy" / "نشر" — links to one-click deploy
- **Hover:** Card shadow & slight scale up

**Arabic Badge Levels:**
- 🌍 **Arabic Native** — ALLaM, Falcon H1 (trained on Arabic corpus)
- 🌍 **Arabic Excellent** — Qwen 2.5, Llama 3 (strong Arabic instruction-following)
- 🌍 **Arabic Good** — Mistral 7B, Llama 2 (acceptable Arabic performance)
- 🌍 **Arabic Capable** — BGE-M3 embeddings (supports Arabic text)
- 🌍 **Arabic Prompts** — SDXL, Stable Diffusion (can interpret Arabic text prompts)

---

### 4. Arabic UI Text (Key Translations)

**Header & Navigation:**

| English | Arabic (MSA) | Context |
|---------|-------------|---------|
| Browse Models | استعرض النماذج | Main navigation |
| Deploy | نشر | CTA button |
| Job History | سجل المهام | Sidebar link |
| Settings | الإعدادات | User menu |
| Logout | تسجيل الخروج | User menu |
| Search Templates | ابحث عن القوالب | Search bar |

**Marketplace Copy:**

| English | Arabic (MSA) | Context |
|---------|-------------|---------|
| Arabic Models | النماذج العربية | Section header |
| Optimized for Middle East | محسّنة للشرق الأوسط | Section description |
| Arabic Capable | قابلة للعربية | Badge |
| Deploy Model | نشر النموذج | Modal title |
| Confirm Deployment | تأكيد النشر | Button |
| Job Complete | اكتمل المهمة | Success message |

**Job History:**

| English | Arabic (MSA) | Context |
|---------|-------------|---------|
| No past jobs | لا توجد مهام سابقة | Empty state |
| Job Details | تفاصيل المهمة | Modal title |
| Running | قيد التشغيل | Status badge |
| Completed | اكتملت | Status badge |
| Failed | فشلت | Status badge |

**Translation Guidelines:**
- Use Modern Standard Arabic (Fusha/MSA), not dialects
- Prefer formal, professional terminology
- Avoid idioms or culturally specific phrases
- Right-aligned text (handled by CSS `direction: rtl`)
- No gender-specific pronouns (use neutral forms)

---

## Pricing Display in SAR

### Option 1: Toggle in Settings

**Settings Page Addition:**

```
┌─────────────────────────────────────┐
│ Preferences                         │
├─────────────────────────────────────┤
│                                     │
│ Language                            │
│ [عربي] [English]                   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Show prices in SAR              │ │
│ │ [Toggle OFF] ← [Toggle ON]  ✓   │ │
│ │                                 │ │
│ │ USD to SAR rate: 3.75 SAR = $1  │ │
│ │ (Updated daily)                 │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### Price Display Format

**USD (Default):**
```
Llama 3-8B Inference
RTX 4090 • $0.25/min
Est. cost: $18.75 (75 min)
```

**SAR (When Toggled):**
```
Llama 3-8B Inference
RTX 4090 • 0.94 SAR/min
Est. cost: 70.31 SAR (75 min)
(1 USD = 3.75 SAR)
```

**Implementation Notes:**
- Store toggle in `user.preferences.pricingCurrency`
- Convert on-the-fly: `displayPrice = usdPrice * 3.75`
- Update conversion rate daily (via API call to currency service or hardcoded with refresh endpoint)
- Show conversion rate in footer or info tooltip

---

## Analytics & Measurement

### Metrics to Track

**Adoption:**
- % of users selecting Arabic in onboarding (target: 35%+ from Saudi/UAE)
- % of Arabic language marketplace visits (target: 30%+ of total)
- Language toggle click rate

**Behavior:**
- Arab user conversion rate (signup → first deployment)
- Average cost per Arab user job
- Repeat rate for Arab users (vs. global baseline)
- Time to deploy (Arab users)

**Business:**
- Arab market MRR (revenue from Saudi/UAE/Egypt users)
- Provider revenue from Arab markets
- Arabic model usage rate (% of deployments using Arabic models)
- CAC (Customer Acquisition Cost) for Arab market

### Tracking Implementation

**Events to Log:**
- `user.onboarding.language_selected` — Arabic or English choice
- `ui.language_toggle_clicked` — User switched language
- `carousel.arabic_models.model_deployed` — Arab featured model clicked
- `user.pricing_currency.changed` — Toggled SAR display
- `model.deployed.language_preference` — Log user's language preference with each deployment

**Dashboards:**
- Weekly Arab market cohort analysis
- Monthly language adoption trend
- Arabic model usage breakdown

---

## Accessibility & Internationalization

### Arabic Text Rendering

- **Font Stack:**
  ```css
  body.lang-ar {
    font-family: 'Segoe UI', 'Arial', 'Tahoma', 'Traditional Arabic', sans-serif;
    font-size: 15px; /* Slightly larger for Arabic readability */
    line-height: 1.6;
    direction: rtl;
    text-align: right;
  }
  ```

- **Text Direction (RTL):**
  - Use CSS `direction: rtl` for Arabic mode
  - Flip margin/padding: `margin-left` ↔ `margin-right`
  - Flexbox & Grid automatically reverse in RTL
  - Icons should NOT flip (chevrons stay same)

- **Numbers:**
  - Keep Western numerals (0-9) for prices, timestamps
  - Option for Arabic-Indic numerals in Phase 2.3 (٠-٩)

### Keyboard Navigation

- Tab order works same in Arabic/English
- RTL doesn't affect tab order (left-to-right in both)
- Shortcuts remain same (Cmd+K, etc.)

### Screen Readers

- `lang="ar"` attribute on HTML element when Arabic mode active
- ARIA labels in Arabic when in Arabic mode
- Screen readers respect RTL direction automatically

---

## Responsive Design

### Desktop (> 1024px)

- Full carousel of 6 Arabic models
- Language toggle in header (text + icon)
- Side-by-side language options in modal

### Tablet (768–1024px)

- Show 3 Arabic models per row (scroll horizontally)
- Language toggle in header (icon only on narrow)
- Stacked modal on smaller tablets

### Mobile (< 768px)

- Single-column carousel (swipeable)
- Language toggle in hamburger menu
- Full-width language selection modal on signup

---

## Success Criteria for Implementation

✅ **Phase 2.2 (MVP):**
- [x] Onboarding language preference flow (location-based default)
- [x] Language toggle in header (Arabic ↔ English)
- [x] Featured Arabic Models carousel on homepage (6 models)
- [x] Key UI text translated to MSA (50+ strings)
- [x] SAR pricing toggle in settings
- [x] RTL support for Arabic text
- [x] Mobile responsive (carousel swipeable, menu adapted)
- [x] Analytics events tracked (adoption, behavior, business)

✅ **Phase 2.3 (Full Localization):**
- [ ] Complete Arabic translation (200+ strings)
- [ ] Full RTL layout (icons, buttons, margins all flipped)
- [ ] Arabic numerals option
- [ ] Arabic date formats (Hijri calendar option)
- [ ] Arabic help center & documentation

✅ **Phase 2.4 (Regional Payments):**
- [ ] SADAD payment integration
- [ ] Local invoicing in Arabic
- [ ] Regional support (Arabic-speaking support agents)

---

## Implementation Notes for Frontend Developer

### Component Structure

```typescript
// /app/marketplace/layout.tsx
<LanguageProvider>
  <Header>
    <LanguageToggle /> {/* عربي / English */}
  </Header>

  <Main lang={language}>
    <HomePage>
      <ArabicModelsCarousel /> {/* Featured 6 models */}
    </HomePage>
  </Main>
</LanguageProvider>

// /app/onboarding/language-selection.tsx
<LanguageSelectionModal>
  <Option label="عربي" value="ar" />
  <Option label="English" value="en" />
</LanguageSelectionModal>
```

### Data Requirements

From backend `/api/i18n` endpoint (new):
```json
{
  "languages": [
    {
      "code": "ar",
      "name": "عربي",
      "flag": "🇸🇦",
      "direction": "rtl"
    },
    {
      "code": "en",
      "name": "English",
      "flag": "🇬🇧",
      "direction": "ltr"
    }
  ],
  "translations": {
    "ar": {
      "header.browse_models": "استعرض النماذج",
      "header.deploy": "نشر",
      "carousel.arabic_models": "النماذج العربية"
    },
    "en": {
      "header.browse_models": "Browse Models",
      "header.deploy": "Deploy",
      "carousel.arabic_models": "Arabic Models"
    }
  }
}
```

From backend `/api/models?language=ar` (filtered):
```json
{
  "models": [
    {
      "id": "allam-7b",
      "name": "ALLaM-7B",
      "arabicCapability": "native",
      "arabicBadge": "🌍 Arabic Native",
      "priceUsd": 0.18,
      "priceSar": 0.675
    }
  ]
}
```

### UX Handoff Notes

1. **Language Persistence:** Save to `localStorage` AND user profile (account-level setting)
2. **Location Detection:** Use IP geolocation for onboarding default (library: `geoip-lite` or MaxMind)
3. **Currency Conversion:** Fetch exchange rates daily, cache for 24 hours
4. **RTL Layout:** Use CSS `direction: rtl` in body, leverage CSS Grid/Flexbox auto-reverse
5. **Translation Loading:** Load translation file for selected language (not inline)
6. **Font Loading:** Load Arabic font as web font (Google Fonts has Arabic variants)

---

## Related Documentation

- **Phase 1:** [DCP-665 Template Catalog UX](/docs/ux/template-catalog-ux-audit.md)
- **Phase 2 Roadmap:** [/docs/ux/PHASE-2-UX-ROADMAP.md](/docs/ux/PHASE-2-UX-ROADMAP.md)
- **Phase 2.0 Quick-Redeploy:** [/docs/ux/phase2-quick-redeploy-ux-spec.md](/docs/ux/phase2-quick-redeploy-ux-spec.md)
- **Arabic Model Portfolio:** [/infra/config/arabic-portfolio.json](/infra/config/arabic-portfolio.json)
- **Strategic Brief:** [/docs/FOUNDER-STRATEGIC-BRIEF.md](/docs/FOUNDER-STRATEGIC-BRIEF.md) (Arab market economics)

---

## Timeline & Resource Estimate

| Phase | Item | Effort | Timeline |
|-------|------|--------|----------|
| 2.2 MVP | Onboarding modal + language toggle | 4 hrs | Sprint 28 (3/24-3/31) |
| 2.2 MVP | Arabic models carousel + translations | 6 hrs | Sprint 28 |
| 2.2 MVP | SAR pricing toggle + RTL CSS | 3 hrs | Sprint 28 |
| 2.2 MVP | Testing & refinement | 2 hrs | Sprint 28 |
| **2.2 Total** | **MVP launch-ready** | **15 hrs** | **Sprint 28** |
| 2.3 | Full localization (200+ strings) | 12 hrs | Sprint 29 |
| 2.3 | RTL layout (buttons, icons, spacing) | 8 hrs | Sprint 29 |
| 2.4 | Regional payments & support | 20+ hrs | Q2 2026 |

**Frontend Developer Effort:** 15 hours (roughly 2 days full-time)
**Backend Support:** 4 hours (i18n endpoint, exchange rate service)
