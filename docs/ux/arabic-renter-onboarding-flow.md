# UX Spec: Arabic Renter Onboarding Flow

**Issue:** DCP-711
**Component:** Renter onboarding flow for Arabic-speaking users
**Status:** Draft — Ready for Frontend implementation
**Last Updated:** 2026-03-24

---

## 1. Overview

Arabic-speaking renters selecting Arabic language at signup/login need a tailored onboarding experience. The flow includes:

1. **Language Selection** (Step 0) — Arabic (عربي) / English toggle
2. **Arabic Model Showcase** — Featured models available in Arabic (ALLaM, JAIS, Qwen)
3. **First Deployment Tutorial** — Simplified first-time GPU deployment in Arabic

**Goal:** Reduce friction for Arabic-speaking users, showcase Arabic AI advantage, convert 40% of Arabic-speaking signups to first deployment within 7 days.

---

## 2. User Journey

```
Signup/Login
    ↓
[Step 0] Language Preference (عربي / English)
    ↓ (if Arabic selected)
[Step 1] Arabic Model Showcase
    ↓
[Step 2] First Deployment (Arabic AI Model)
    ↓
Dashboard (Arabic UI)
```

### 2.1 Step 0: Language Selection

**Where:** Signup/login form footer or language toggle
**Trigger:** New account OR first login OR header language toggle
**Interaction:** Click "عربي" or "English"

**Design Requirements:**
- **Layout:** Below the main form or in top-right header
- **Options:** Two buttons/radio options:
  - "عربي" (Arabic)
  - "English"
- **Default:** Auto-detect browser language preference (window.navigator.language). If Arabic locale (ar-*), default to عربي. Otherwise English.
- **Mobile:** 44px touch target, stacked vertically on < 640px
- **Persistence:** Store in localStorage (`dcp-language`). Respect for all future sessions.
- **Font:** Poppins 500 (non-Arabic), prefer "Traditional Arabic" or "Cascadia Code" for عربي text (serif alternative for readability)

**Wireframe:**
```
┌─────────────────┐
│  Signup Form    │
│                 │
│ [Email input]   │
│ [Password]      │
│ [Sign Up]       │
│                 │
│ Language:       │
│ [عربي] [English]│ ← Click "عربي" to enable Arabic flow
└─────────────────┘
```

---

### 2.2 Step 1: Arabic Model Showcase

**Trigger:** After Step 0 (Arabic selected) AND new account OR first login
**Position:** Modal or dedicated page after language selection
**Exit:** Click "Deploy First Model" CTA

**Content (RTL Layout):**
```
┌──────────────────────────────┐
│ اختر نموذج عربي    (Choose Arabic Model)  │
│ (في 30 ثانية)              (in 30 seconds) │
│                              │
│ [Model Card 1: ALLaM 7B]    │
│ Logo | "ALLaM 7B"            │
│ Arabic NLP (جودة عالية)     │
│ "مميز اليوم"  (Featured)     │
│ SAR 0.45 / ساعة (per hour)  │
│ [Deploy Now]                 │
│                              │
│ [Model Card 2: JAIS 13B]    │
│ Logo | "JAIS 13B"            │
│ Large Arabic LLM             │
│ SAR 0.89 / ساعة              │
│ [Deploy Now]                 │
│                              │
│ [Model Card 3: Qwen 2.5 7B] │
│ Logo | "Qwen 2.5 7B"         │
│ Multilingual (عربي + EN)     │
│ SAR 0.42 / ساعة              │
│ [Deploy Now]                 │
│                              │
│ [Browse All Models →]        │
└──────────────────────────────┘
```

**Component: ArabicModelCard**

```typescript
interface ArabicModelCard {
  modelName: string;           // "ALLaM 7B"
  modelId: string;             // "alm-alm7b"
  description_ar: string;      // "معالجة اللغة العربية المتقدمة"
  description_en: string;      // "Advanced Arabic NLP"
  badge?: string;              // "مميز اليوم" (Featured Today)
  pricePerHour: number;        // SAR value
  currency: string;            // "SAR"
  imageUrl: string;            // Model logo
  capabilities: string[];      // ["NLP", "RAG", "Chat"]
  onDeployClick: () => void;
}
```

**Design Details:**

| Aspect | Specification |
|--------|---------------|
| **Layout** | RTL (right-to-left) — text flows right, images align right |
| **Grid** | 1 column (mobile < 640px), 2 columns (tablet 640-1024px), 3 columns (desktop > 1024px) |
| **Cards** | 280px width, 320px height, 8px border radius, shadow: 0 2px 8px rgba(0,0,0,0.1) |
| **Font** | Headers: Poppins 600, 16px عربي text. Body: Poppins 400, 14px. |
| **Colors** | Primary: #2563EB (blue), Text: #1F2937 (dark), Prices: #10B981 (green) |
| **Button** | "Deploy Now" — 44px height, full card width, #2563EB, Poppins 600, 14px |
| **Price Display** | RTL: "ر.س 0.45 / ساعة" (SAR symbol on right) |
| **Mobile Spacing** | Padding: 16px; Card margins: 8px |

---

### 2.3 Step 2: First Deployment (Simplified Flow)

**Context:** User clicked "Deploy Now" on one of the Arabic models

**Flow:**
```
[Model Locked] "ALLaM 7B Selected"
    ↓
[GPU Selection] "Select GPU for Arabic NLP"
    • RTX 4090 (SAR 4.50 / hour) — RECOMMENDED
    • RTX 4080 (SAR 2.89 / hour)
    • H100 (SAR 8.99 / hour)
    ↓
[Confirm Deployment] "Ready to deploy?"
    Show: Model, GPU, Region, Cost/hour
    Buttons: [Cancel] [Deploy for Me]
    ↓
[Deploying...] Progress bar (30-60 sec)
    ↓
[Success] "يعمل الآن!"  (Now running!)
    Show: Model API endpoint, job ID, cost tracking
    [Go to Dashboard] button
```

**Component Specs:**

**DeploymentModal:**
- **Title:** عربي: "نشر نموذجك الأول" EN: "Deploy Your First Model"
- **Sections:**
  1. Model Summary (locked, read-only card showing selected model)
  2. GPU Selector (radio buttons, RTL layout, sorted by recommended first)
  3. Pricing Summary (static, SAR/hour, estimated hourly cost)
  4. Action Buttons ([Cancel] [Deploy]) — full width on mobile, side-by-side on desktop
- **Mobile:** Single column, 100vw width (with 16px padding)
- **Validation:** Ensure GPU selected before allowing Deploy

**Success Screen:**
```
┌─────────────────────────────┐
│ ✅ يعمل الآن!   (Now Running!) │
│                              │
│ Model: ALLaM 7B              │
│ GPU: RTX 4090                │
│ Region: Riyadh (KSA)         │
│ Status: 🟢 Active            │
│                              │
│ API Endpoint:                │
│ api.dcp.sa/job/abc123        │
│                              │
│ Rate: SAR 4.50/hour          │
│ Remaining: SAR 100.00        │
│                              │
│ [Copy Endpoint] [Dashboard]  │
└─────────────────────────────┘
```

---

## 3. Localization & RTL

### 3.1 Required Translations

| English | Arabic (Modern Standard) |
|---------|--------------------------|
| "Choose Arabic Model" | "اختر نموذج عربي" |
| "in 30 seconds" | "في 30 ثانية" |
| "Featured Today" | "مميز اليوم" |
| "Deploy Now" | "نشر الآن" |
| "Select GPU for Arabic NLP" | "اختر معالج GPU للغة العربية" |
| "RECOMMENDED" | "موصى به" |
| "Ready to deploy?" | "هل أنت مستعد للنشر؟" |
| "Now running!" | "يعمل الآن!" |
| "Go to Dashboard" | "انتقل إلى لوحة التحكم" |

### 3.2 CSS RTL Implementation

```css
/* Use CSS logical properties for RTL support */
.model-card {
  padding-inline: 16px;        /* replaces left/right padding */
  margin-inline: 8px;          /* replaces left/right margin */
  text-align: start;           /* auto-flips with direction */
}

html[lang="ar"] {
  direction: rtl;
  text-align: right;
}

html[lang="ar"] .model-card {
  /* Automatically flips — no need for separate RTL styles */
}

/* Numbers stay LTR */
.price {
  direction: ltr;              /* SAR 4.50/hour stays LTR */
  display: inline-block;
}
```

---

## 4. Data & Pricing

### 4.1 Featured Models

| Model | ID | Tier | Price (SAR/hr) | Recommended For |
|-------|-----|------|----------------|-----------------|
| **ALLaM 7B** | alm-alm7b | Tier A | 0.45 | General Arabic NLP, Chat |
| **JAIS 13B** | jais-jais13b | Tier B | 0.89 | Large context Arabic LLM |
| **Qwen 2.5 7B** | qwen-qwen25-7b | Tier A | 0.42 | Multilingual (عربي + EN) |

**Source:** `/infra/config/arabic-portfolio.json`

### 4.2 GPU + Pricing Matrix for First Deployment

| GPU | VRAM | Price (SAR/hr) | Tier | Recommendation |
|-----|------|----------------|------|-----------------|
| RTX 4090 | 24GB | 4.50 | Recommended | Best for ALLaM/JAIS |
| RTX 4080 | 16GB | 2.89 | Good | Budget-friendly for Qwen |
| H100 | 80GB | 8.99 | Premium | Enterprise use |

---

## 5. Analytics & KPIs

**Track the following events:**

| Event | Trigger | KPI Target |
|-------|---------|------------|
| `onboarding_language_selected` | User clicks عربي/English | 100% of signups |
| `arabic_model_showcase_viewed` | Step 1 modal loads | 80% Arabic selection → reach here |
| `arabic_model_selected` | User clicks "Deploy Now" | 25% → proceed to Step 2 |
| `first_deployment_completed` | Success screen shown | 15% of Arabic signups |

**Success Metric:** 40% of Arabic-speaking signups complete first deployment within 7 days.

---

## 6. Mobile Responsiveness

**Breakpoints:**

| Breakpoint | Model Cards | Layout |
|-----------|------------|--------|
| < 640px | 1 column | Stacked cards, full width with 16px padding |
| 640-1024px | 2 columns | Side-by-side cards |
| > 1024px | 3 columns | Row layout with fixed card width |

**Touch Targets:** All buttons 44-48px height (WCAG AA standard)

---

## 7. Accessibility

- **WCAG AA compliance** (minimum standard)
- **Labels:** All form inputs have explicit `<label>` tags with Arabic equivalents
- **Focus Visible:** Keyboard navigation shows clear focus ring (2px outline, #2563EB)
- **Contrast:** Text on background ≥ 4.5:1 (AA standard)
- **Language Tag:** `<html lang="ar">` when Arabic mode active
- **Screen Reader:** All buttons, images have `aria-label` in both languages

---

## 8. Error Handling

**Scenario: GPU Unavailable**
```
┌─────────────────────────────┐
│ ⚠️ GPU غير متاح   (Unavailable) │
│                              │
│ الـ RTX 4090 غير متاح حالياً │
│ (RTX 4090 not available)    │
│                              │
│ [Try RTX 4080 Instead]       │
│ [Browse Other Models]        │
└─────────────────────────────┘
```

**Scenario: Deployment Timeout**
```
┌─────────────────────────────┐
│ ❌ خطأ في النشر   (Deploy Error) │
│                              │
│ لم ينجح نشر النموذج           │
│ Code: DEPLOY_TIMEOUT         │
│                              │
│ [Retry] [Contact Support]    │
└─────────────────────────────┘
```

---

## 9. Implementation Checklist

- [ ] Create `components/onboarding/ArabicLanguageSelector.tsx`
- [ ] Create `components/onboarding/ArabicModelShowcase.tsx`
- [ ] Create `components/onboarding/ArabicModelCard.tsx`
- [ ] Create `components/deployment/FirstDeploymentModal.tsx`
- [ ] Wire to `/pages/onboarding.tsx`
- [ ] Add translations to `locales/ar.json` and `locales/en.json`
- [ ] Implement CSS logical properties in styles (RTL support)
- [ ] Add analytics events (Segment/Mixpanel)
- [ ] Test on iOS Safari, Android Chrome (60% of Arabic traffic)
- [ ] QA: Arabic text rendering, RTL layout, pricing display

---

## 10. Dependencies

- **Backend:** `/api/models` endpoint (DCP-641 — routing fix required for HuggingFace IDs like `meta-llama/Llama-2-7b`)
- **Config:** `/infra/config/arabic-portfolio.json` (model list + pricing)
- **Localization:** i18next or similar (supports Arabic pluralization rules)
- **Styling:** Tailwind CSS with `dir` attribute or CSS logical properties

---

## 11. Success Criteria

✅ **Complete when:**
1. All three model cards render correctly in RTL layout
2. Language toggle persists across sessions
3. First deployment modal submits and triggers backend job creation
4. Mobile responsive on < 640px width
5. Pricing displayed in SAR with Arabic numerals
6. Analytics events fire on all interactions
7. No console errors on Arabic text input/display

---

**Author:** UI/UX Specialist
**Target Sprint:** Sprint 27
**Status:** ✅ Ready for Frontend Implementation
