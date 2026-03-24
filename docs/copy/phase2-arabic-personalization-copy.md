# Phase 2.2 Feature Copy: Arabic Personalization
## Language Preference & Featured Arabic Models

**Status:** Draft for code review
**Created:** 2026-03-24 03:25 UTC
**Feature:** DCP Phase 2.2 — Arabic Personalization (language toggle + featured Arab models)
**Target Users:** Arabic speakers (expand 40% into Arab market, MENA region)
**Languages:** English + Arabic (full RTL experience)
**Goal:** Position DCP as the premier Arabic AI platform with in-kingdom PDPL-compliant compute

---

## Overview

Phase 2.2 personalizes the platform for Arabic speakers by:
1. **Language Preference Toggle** — Header toggle to switch عربي ↔ English instantly
2. **Featured Arabic Models Carousel** — Highlight 6 top Arabic/multilingual models
3. **Arabic-Specific Pricing** — Show SAR pricing + cost savings vs hyperscalers
4. **Onboarding Flow Personalization** — Ask language preference on signup
5. **Arabic-Focused Positioning** — Emphasize PDPL compliance + in-kingdom compute

---

## 1. Language Preference Onboarding

### Signup Language Selection (New Renter Flow)

**Step: Language Preference**
- **Page Title:** "Welcome to DCP" / "أهلاً وسهلاً بك في DCP"
- **Subtitle:** "Choose your preferred language" / "اختر لغتك المفضلة"

**Language Options (Two Large Buttons):**

**Button 1: English (Default)**
- **Label:** "English"
- **Icon:** US flag or "EN"
- **Subtext:** "Use English throughout the platform"
- **Action:** Continue with EN locale

**Button 2: العربية (Arabic)**
- **Label:** "العربية" (Arabic text, RTL)
- **Icon:** Saudi/Arab flag or "عربي"
- **Subtext:** "استخدم العربية في جميع أنحاء المنصة" (Use Arabic throughout the platform)
- **Action:** Continue with AR locale, RTL layout

**Design Notes:**
- Equal prominence (same button size)
- Arabic button on the LEFT (RTL priority)
- Icons for accessibility (language-agnostic)
- Clear subtext in each language

**Accessibility:**
- Keyboard selectable (Tab → Enter)
- Screen reader: "Language selection, English" / "اختيار اللغة، العربية"

---

## 2. Header Language Toggle

### Location: Top Navigation Bar

**Toggle Component:**
- **Position:** Top right (EN mode) / Top left (AR mode)
- **Label:** "عربي" (when in English) / "English" (when in Arabic)
- **Icon:** Globe icon or language icon
- **Style:** Text link with subtle icon

**Behavior:**
- **Click:** Toggles locale instantly
- **Persistence:** Remember in user preferences (localStorage + backend)
- **Page Reload:** No page reload (use client-side locale switch)
- **URL:** Option to maintain query param `?lang=ar` or `?lang=en`

**Tooltip (Hover):**
- **EN:** "Switch to Arabic" / "Switch to English"
- **AR:** "استبدل بالعربية" / "استبدل بالإنجليزية"

**Animation:**
- Brief fade transition (200ms) for RTL layout flip
- Smooth transition for text direction change (writing-mode: horizontal-tb → ltr/rtl)

---

## 3. Featured Arabic Models Carousel

### Location: Dashboard / Model Marketplace (Prominent, Above Fold)

**Section Header:**
- **EN:** "Featured Arabic Models & LLMs"
- **AR:** "النماذج العربية المميزة ونماذج اللغة الضخمة"
- **Subheader (optional):** "Optimized for Middle Eastern language & PDPL compliance" / "محسّنة للغة الشرق الأوسط والامتثال PDPL"

### Carousel Structure

**Model Card (Each of 6 Models):**

**Card Layout:**
```
[Model Icon/Logo]
{Model Name}
{Capability Badge} (e.g., "Arabic Native", "Multilingual")
${Price}/hour vs Hyperscaler
[Deploy Now Button]
```

**6 Featured Models (In Order of Priority):**

#### 1. ALLaM 7B (Arabic SOTA)
- **EN Name:** "ALLaM 7B — Arabic Reasoning"
- **AR Name:** "ALLaM 7B — العقل العربي"
- **Badge:** "🔴 Arabic Native"
- **Pricing:** "$0.18/hour | 51% savings vs AWS Bedrock"
- **Description (EN):** "Meta's flagship Arabic LLM. Best for legal docs, financial reports, technical writing."
- **Description (AR):** "نموذج ALLaM الرائد من Meta. الأفضل للمستندات القانونية والتقارير المالية والكتابة التقنية."
- **Icon/Logo:** Meta logo + Arabic script
- **Highlight:** "Legal-grade accuracy for Saudi contracts"
- **AR Highlight:** "دقة موثوقة للعقود السعودية"

#### 2. Falcon H1 7B (Arabic-Optimized)
- **EN Name:** "Falcon H1 7B — Multilingual Powerhouse"
- **AR Name:** "Falcon H1 7B — قوة متعددة اللغات"
- **Badge:** "🌍 Multilingual"
- **Pricing:** "$0.19/hour | 48% savings vs GCP Vertex"
- **Description (EN):** "UAE AI Research's multilingual model. Excels at document understanding, translation, summarization."
- **Description (AR):** "نموذج الإمارات متعدد اللغات. متفوق في فهم المستندات والترجمة والتلخيص."
- **Icon/Logo:** Abu Dhabi/UAE emblem + globe
- **Highlight:** "Trained on Arabic, English, and 10+ MENA languages"
- **AR Highlight:** "مدرب على العربية والإنجليزية و 10+ لغات من منطقة الشرق الأوسط وشمال أفريقيا"

#### 3. JAIS 13B (Arabic-First)
- **EN Name:** "JAIS 13B — Advanced Arabic Reasoning"
- **AR Name:** "JAIS 13B — التفكير العربي المتقدم"
- **Badge:** "🔴 Arabic-First"
- **Pricing:** "$0.22/hour | 44% savings vs Claude API"
- **Description (EN):** "Arab AI JAIS. 13B parameters optimized for complex Arabic NLP tasks."
- **Description (AR):** "JAIS من Arab AI. 13 مليار معامل محسّن لمهام معالجة اللغة العربية المعقدة."
- **Icon/Logo:** JAIS branding
- **Highlight:** "Government-grade for legal & policy analysis"
- **AR Highlight:** "درجة حكومية لتحليل الأمور القانونية والسياسية"

#### 4. Llama 3 8B (Multilingual Baseline)
- **EN Name:** "Llama 3 8B — Fast & Reliable"
- **AR Name:** "Llama 3 8B — سريع وموثوق"
- **Badge:** "⚡ Lightning Fast"
- **Pricing:** "$0.12/hour | 60% savings vs Lambda Labs"
- **Description (EN):** "Meta's most capable small LLM. Strong Arabic support, blazing fast."
- **Description (AR):** "أكثر نماذج Meta كفاءة الصغيرة. دعم عربي قوي، سريع جداً."
- **Icon/Logo:** Meta logo
- **Highlight:** "Ideal for real-time chatbots & customer service"
- **AR Highlight:** "مثالي لروبوتات المحادثة والخدمة في الوقت الفعلي"

#### 5. Mistral 7B (Efficient & Capable)
- **EN Name:** "Mistral 7B — Efficient Open Model"
- **AR Name:** "Mistral 7B — نموذج مفتوح فعال"
- **Badge:** "💡 Efficient"
- **Pricing:** "$0.13/hour | 58% savings vs Together AI"
- **Description (EN):** "Mistral AI's open 7B. Excellent for summarization, Q&A, content generation in Arabic."
- **Description (AR):** "نموذج Mistral المفتوح 7B. ممتاز للتلخيص والأسئلة والأجوبة وتوليد المحتوى بالعربية."
- **Icon/Logo:** Mistral branding
- **Highlight:** "Best bang for buck on Arabic retrieval tasks"
- **AR Highlight:** "أفضل قيمة مقابل المال لمهام الاسترجاع العربية"

#### 6. BGE-M3 Embeddings (Arabic Retrieval)
- **EN Name:** "BGE-M3 Embeddings — Arabic RAG"
- **AR Name:** "BGE-M3 — استرجاع المعلومات العربي"
- **Badge:** "🔍 Retrieval"
- **Pricing:** "$0.05/hour | 70% savings vs Cohere Embed"
- **Description (EN):** "BAAI's multilingual embeddings. Perfect for Arabic document retrieval, semantic search, RAG."
- **Description (AR):** "التضمينات متعددة اللغات من BAAI. مثالية لاسترجاع المستندات العربية والبحث الدلالي."
- **Icon/Logo:** BAAI logo
- **Highlight:** "Power Arabic RAG for compliance-critical search"
- **AR Highlight:** "قوة استرجاع المعلومات العربي للبحث الحرج الامتثال"

### Carousel Navigation

**Previous / Next Buttons:**
- **Label:** "← Previous" / "Next →"
- **AR Label:** "← السابق" / "التالي →"
- **Keyboard Navigation:** Arrow keys (EN: right arrow next | AR: left arrow next [RTL])

**Indicator Dots:**
- **Position:** Below carousel
- **Active Dot Color:** #2563EB (primary)
- **Inactive:** #E5E7EB (gray)
- **Label:** "Model {current} of {total}" / "النموذج {current} من {total}"

**Auto-Scroll:**
- Carousel auto-advances every 5 seconds (user hover pauses)
- Smooth transition animation (300ms)

---

## 4. Arabic-Specific Pricing Display

### Integrated into Model Cards & Pricing Table

**Currency & Localization:**
- **EN:** USD ($) with hyperscaler comparisons
- **AR:** SAR (﷼) with hyperscaler comparisons (convert to SAR: 1 USD ≈ 3.75 SAR)

**Pricing Card Copy:**

**Example Card (ALLaM 7B):**
```
Price: $0.18/hour
Savings: 51% vs AWS Bedrock ($0.37/hour)

(Arabic Version)
السعر: 0.67 ﷼/ساعة
الادخار: 51% مقابل AWS Bedrock (1.38 ﷼/ساعة)
```

**ROI Message (Below Price):**
- **EN:** "Save up to $8,520/year vs AWS Bedrock"
- **AR:** "وفّر حتى 31,950 ﷼/سنة مقابل AWS Bedrock"
- **Calculation:** Hours per year (8760 hrs) × hourly savings

**Competitive Positioning:**
- **EN:** "vs hyperscaler pricing (updated {date})"
- **AR:** "مقابل أسعار الشركات الضخمة (محدث {date})"

---

## 5. Onboarding CTA: Arabic RAG Bundle

### Prominent Call-to-Action (After Language Selection)

**Hero Section (Arabic Mode):**
- **Headline (AR):** "استخدم قوة الذكاء الاصطناعي العربي"
- **Headline (EN):** "Power Your Arabic AI Pipeline"

**Subheading (AR):** "منصة الحوسبة السحابية الأولى في الشرق الأوسط المدعومة بـ PDPL"
**Subheading (EN):** "The #1 in-kingdom compute platform for Arabic AI, PDPL-compliant"

**Featured Bundle Card:**
- **Title (AR):** "حزمة الاسترجاع العربي"
- **Title (EN):** "Arabic RAG Bundle"
- **Description (AR):** "ALLaM + BGE-M3 + Falcon H1 = استرجاع معلومات عربي كامل"
- **Description (EN):** "ALLaM + BGE-M3 + Falcon H1 = Complete Arabic information retrieval"
- **Price:** "Starting at $0.45/hour" / "ابدأ من 1.69 ﷼/ساعة"
- **Use Cases (AR):**
  - "البحث في المستندات السعودية الضخمة"
  - "معالجة العقود والاتفاقيات بالعربية"
  - "إرجاع المعلومات من قاعدة البيانات"
- **Use Cases (EN):**
  - "Search massive Saudi document repositories"
  - "Process Arabic contracts & agreements"
  - "Retrieve info from custom databases"

**CTA Button:**
- **Label (AR):** "ابدأ الآن"
- **Label (EN):** "Get Started"
- **Action:** Launch template marketplace with Arabic RAG template highlighted

---

## 6. Dashboard Personalization Elements

### User Profile / Settings

**Language Setting Card:**
- **Label (AR):** "اللغة المفضلة"
- **Label (EN):** "Preferred Language"
- **Options:**
  - English (EN)
  - العربية (AR)
  - Español (future)
- **Toggle:** Instant switch with page RTL flip

**Regional Preference (Optional):**
- **Label (AR):** "المنطقة"
- **Label (EN):** "Region"
- **Options:**
  - Saudi Arabia (SAR pricing)
  - UAE (AED pricing)
  - Egypt (EGP pricing)
  - Other MENA countries
- **Impact:** Pricing display, featured models, support links

---

## 7. Marketing & Positioning Copy

### Featured Benefit Callout (Arabic Dashboard)

**Card Title (AR):** "لماذا DCP؟"
**Card Title (EN):** "Why DCP?"

**3 Benefit Callouts (AR):**

**1. Compliance**
- **Headline (AR):** "✓ متوافق مع PDPL"
- **Copy (AR):** "جميع البيانات تبقى في المملكة. آمن وموثوق للحكومة والقطاع المالي."
- **Headline (EN):** "✓ PDPL Compliant"
- **Copy (EN):** "All data stays in-kingdom. Secure for govt & finance."

**2. Speed**
- **Headline (AR):** "⚡ أسرع من الشركات الضخمة"
- **Copy (AR):** "RTX 4090 في دقائق. لا انتظار. نتائج فورية."
- **Headline (EN):** "⚡ Faster Than Hyperscalers"
- **Copy (EN):** "RTX 4090 in minutes. Instant results."

**3. Cost**
- **Headline (AR):** "💰 أرخص بـ 50%"
- **Copy (AR):** "وفّر آلاف الريالات شهريًا. نفس الجودة. أقل السعر."
- **Headline (EN):** "💰 50% Cheaper"
- **Copy (EN):** "Save thousands/month. Same quality. Lower price."

---

## 8. Error Messages & Support (Localized)

### Arabic-Specific Help Text

**Model Unavailable (AR):**
- "هذا النموذج متاح قريبًا. اختر ALLaM 7B أو Falcon H1 بدلاً من ذلك."
- "This model coming soon. Try ALLaM 7B or Falcon H1 instead." (EN)

**Currency Conversion Tooltip (AR):**
- "السعر بالدولار الأمريكي. السعر بالريال: {SAR_amount} ﷼"
- "Price in USD. Price in SAR: {SAR_amount} ﷼" (EN)

**Support Contact (AR):**
- "هل تحتاج إلى مساعدة؟ [تواصل معنا](https://support.dcp.sa/ar)"
- "Need help? [Contact us](https://support.dcp.sa)" (EN)

---

## Localization & RTL Checklist

- [x] Full Arabic translations (MSA)
- [x] RTL layout: Header toggle + carousel positioning
- [x] Numerals: Arabic numerals for AR locale (٠-٩)
- [x] Currency: SAR (﷼) + USD ($) display
- [x] Button alignment: RTL-flipped
- [x] Carousel navigation: Arrow keys (left/right depending on locale)
- [x] Text direction: CSS logical properties (margin-inline, padding-inline)
- [x] Font selection: Arabic font support (Segoe UI, Tahoma, Arabic Typesetting)
- [ ] QA testing (pending UI implementation)
- [ ] Designer review of RTL layout

---

## KPI & Success Metrics

**Goal:** Expand 40% into Arab market (MENA region)

**Tracking:**
- **Language Selection Rate:** % renters choosing Arabic onboarding
- **Language Toggle Usage:** % daily toggles (DAU * toggle frequency)
- **Arabic Model Deployment:** % jobs using ALLaM, JAIS, Falcon H1
- **Arab Market Revenue:** $MRR from MENA region (SAR/AED pricing)
- **Pricing Savings Messaging:** CTR on "save X% vs hyperscaler"

**Localization Success:**
- **RTL Layout Issues:** 0 layout bugs reported in Arabic mode
- **Arabic Content Quality:** User satisfaction score >4.5/5
- **Support Response Time (Arabic):** <2 hour response for Arabic support tickets

---

## Brand Voice (Arabic)

**Tone:** Professional, trustworthy, empowering
**Personality:**
- Not corporate (avoid bank-speak)
- Confident (we are THE Arabic AI platform)
- Helpful (make it easy for Arabic speakers)
- Forward-looking (future of MENA AI compute)

**Messaging Pillars:**
1. **PDPL Compliance** — Security & governance for institutions
2. **Cost Savings** — 50%+ vs hyperscalers
3. **Speed** — Minutes, not hours
4. **Arab Talent** — Supporting MENA AI innovation

---

## Revision History

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 2026-03-24 | Copywriter | Initial comprehensive draft. Ready for code review. |

