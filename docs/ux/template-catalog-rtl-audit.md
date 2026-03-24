# Template Catalog — Arabic RTL Audit & Localization Review

**Status:** READY FOR TEMPLATE CATALOG CODE REVIEW (DCP-827)
**Reviewer:** UI/UX Specialist
**Audit Date:** 2026-03-24 (prepared) / TBD (executed when DCP-827 in_review)

---

## Overview

When template catalog UI (DCP-827) enters code review, this document will be populated with findings from an Arabic RTL and localization audit. The audit ensures that:

1. **RTL Layout** — Template cards, buttons, filters, and navigation are correctly mirrored for Arabic
2. **Arabic Text Rendering** — Model names, descriptions, and labels display correctly with proper diacritics
3. **Translation Accuracy** — All Arabic copy matches DCP-679 UI copy standards and uses consistent terminology
4. **Localization Completeness** — No untranslated English strings visible, correct currency/regional settings
5. **Participant Confidence** — Arabic-speaking users feel comfortable and find the interface intuitive

---

## Pre-Audit Checklist

### Files & Dependencies
- [ ] DCP-827 (Template Catalog UI) branch: `[branch-name]`
- [ ] Commit hash for audit baseline: `[commit]`
- [ ] DCP-679 (UI Copy Sheet) reviewed: [link to approved copy]
- [ ] infra/config/arabic-portfolio.json available: [models to display]
- [ ] Test environment: `http://localhost:3000` or staging URL

### Audit Team
- [ ] UI/UX Specialist (audit lead)
- [ ] Arabic Localization Reviewer (native speaker or fluent reviewer)
- [ ] Frontend Developer (DCP-827 owner, for implementation notes)

---

## RTL Layout Audit

### Template Cards (Browse Page)

**Component:** `<TemplateCard>` — displays single model/template in grid

**Checklist:**
- [ ] Card container: properly mirrored for RTL (no left-aligned bias)
- [ ] Model image: positioned correctly (LTR: left, RTL: right)
- [ ] Model name + description: right-aligned in Arabic, left in English
- [ ] Pricing badge: positioned correctly (LTR: bottom-right, RTL: bottom-left)
- [ ] "Deploy" button: centered or aligned with RTL direction
- [ ] Capability icons: if present, order preserved in RTL
- [ ] Hover states: animations consistent in RTL (no unexpected direction shifts)

**Test Cases:**
```
1. Load template browse page in Arabic (ar-SA locale)
2. Verify card grid is mirrored left-to-right
3. Click on template card → verify text direction change smooth
4. Inspect RTL spacing: padding/margin consistent
5. Test on mobile (RTL cards should stack correctly)
```

**Findings:**
- [ ] No RTL issues found
- [ ] RTL issues (describe below):

---

### Filter Sidebar (Browse Page)

**Component:** Filter panel with checkboxes, dropdowns, text search

**Labels & Terminology (Arabic):**
- [ ] **"LLM / Language Models"** → "نماذج اللغة" ✓ (from DCP-679)
- [ ] **"Image Generation"** → "إنشاء الصور" ✓
- [ ] **"Fine-tuning / Training"** → "التدريب" ✓
- [ ] **"Embeddings"** → "التضمينات" ✓
- [ ] **"RAG (Retrieval-Augmented Generation)"** → "الاسترجاع المعزز" ✓
- [ ] **"Price Range"** → "نطاق السعر" ✓
- [ ] **"Provider Region"** → "منطقة الموفر" ✓
- [ ] **"GPU Type"** → "نوع وحدة معالجة الرسومات" ✓
- [ ] **"Arabic Capability"** → "القدرة على العربية" ✓

**RTL Checklist:**
- [ ] Filter labels: right-aligned in Arabic
- [ ] Checkboxes: positioned to the left of label (RTL standard)
- [ ] Dropdown arrows: pointing correctly (not mirrored incorrectly)
- [ ] Search input: placeholder text RTL-aware
- [ ] "Clear Filters" button: positioned correctly
- [ ] Collapse/expand icons: behave correctly in RTL

**Findings:**
- [ ] No issues
- [ ] Issues found (describe):

---

### Model Cards — Arabic Model Names & Descriptions

**Models to Verify (from infra/config/arabic-portfolio.json):**

#### Tier A (Core Arabic Models)
- [ ] **ALLaM 7B**
  - Display: "النموذج ألام 7 بي" (or standard name)
  - Description renders: ✓ or ❌ (note issues)
  - Diacritics present: ✓ or ❌

- [ ] **Falcon H1 7B**
  - Display: "فالكون H1 7 بي"
  - Diacritics: ✓ or ❌

- [ ] **Qwen 2.5 7B**
  - Display: "تشين 2.5 7 بي"
  - Diacritics: ✓ or ❌

- [ ] **Llama 3 8B**
  - Display: "لاما 3 8 بي"
  - Diacritics: ✓ or ❌

- [ ] **Mistral 7B**
  - Display: "ميسترال 7 بي"
  - Diacritics: ✓ or ❌

#### Tier B (Supporting Models)
- [ ] **JAIS 13B**
  - Display: "جايس 13 بي"
  - Diacritics: ✓ or ❌

- [ ] **BGE-M3 (Embeddings)**
  - Display: "BGE-M3 التضمينات المتعددة اللغات"
  - Diacritics: ✓ or ❌

- [ ] **BGE Reranker**
  - Display: "إعادة ترتيب BGE"
  - Diacritics: ✓ or ❌

- [ ] **SDXL (Image Generation)**
  - Display: "SDXL - إنشاء الصور"
  - Diacritics: ✓ or ❌

#### Capability Badges (Arabic)
- [ ] "Arabic Language Model" → "نموذج لغة عربية"
- [ ] "Multilingual" → "متعدد اللغات"
- [ ] "Code Generation" → "إنشاء الأكواد"
- [ ] "Vision" → "الرؤية"
- [ ] "Training" → "التدريب"

**Rendering Issues to Watch:**
- [ ] Text truncation (badge text cut off)
- [ ] Diacritic overlap or misalignment
- [ ] Font weight inconsistency
- [ ] Line height too tight for Arabic

**Findings:**
- [ ] All Arabic names render correctly
- [ ] Issues found (describe):

---

## Translation Quality & Terminology Consistency

### Copy Consistency with DCP-679 (UI Copy Sheet)

**Mapping to Verify:**
| UI Element | English (Source) | Arabic (Expected) | Status |
|------------|-----------------|-------------------|--------|
| Browse Models | "Browse Models" | "استعرض النماذج" | ✓ |
| Deploy | "Deploy" | "نشّر" | ✓ |
| Learn More | "Learn More" | "اعرف المزيد" | ✓ |
| Price per Hour | "Price per hour" | "السعر في الساعة" | ✓ |
| Comparison to Vast.ai | "XX% cheaper than Vast.ai" | "أرخص بـ XX% من Vast.ai" | ✓ |
| Add to Cart | "Add to Cart" | "أضفْ إلى السلة" | ✓ |

**Dialect Consistency:**
- [ ] Modern Standard Arabic (MSA) used consistently
- [ ] No mixing of formal/colloquial without clear UX reason
- [ ] Regional terms (Saudi vs. Egyptian vs. Levantine) documented
- [ ] Gender agreement correct for all nouns and adjectives

**Terminology Review:**
- [ ] Technical terms (GPU, vLLM, token, inference) handled consistently
- [ ] Financial terms (USDC, balance, fee) translated appropriately
- [ ] Brand terms (DCP, ALLaM, JAIS) left as-is or localized per spec

**Findings:**
- [ ] Copy consistent with DCP-679
- [ ] Discrepancies found (list):

---

## Localization Completeness

### String Coverage Audit

**Test:** Run interface in Arabic locale. Scan for untranslated English.

- [ ] No English strings visible on main pages
- [ ] English found in: [list locations if any]
- [ ] Fallback strings (if any): acceptable / should translate

### Regional Settings

- [ ] Currency displayed as USDC (not locale-specific currency)
- [ ] Date format: ISO 8601 (YYYY-MM-DD) for consistency
- [ ] Number formatting: commas/periods per Arabic locale or consistent global format
- [ ] Timezone: UTC displayed (avoid region-specific conversions)

**Findings:**
- [ ] All regional settings correct
- [ ] Issues found:

---

## Accessibility + Arabic-Specific Compliance

### Text Rendering Quality
- [ ] Font family supports Arabic: [specify font, e.g., "Cairo", "Tajawal"]
- [ ] Font size sufficient for comfortable reading (14px minimum for body text)
- [ ] Line height adequate (1.6+ recommended for Arabic)
- [ ] Contrast ratio ≥4.5:1 (WCAG AA)

### RTL Navigation Structure
- [ ] Logical tab order preserved in RTL (should still flow left-to-right in code)
- [ ] Screen reader handles RTL correctly (test with Arabic screen reader if available)
- [ ] Keyboard navigation: arrow keys behave intuitively in RTL
- [ ] Focus indicators visible and properly positioned

**Findings:**
- [ ] Accessibility compliant
- [ ] Issues found:

---

## P0 / P1 / P2 Classification

### P0 Issues (Stop-Ship Blockers)
Issues that completely break Arabic UX or make the interface unusable.

- [ ] No P0 issues found
- [ ] P0 issues:
  1. [Issue]: [Description] — Owner: [Frontend Dev / Copywriter]
  2. [Issue]: [Description] — Owner:

### P1 Issues (Launch Concerns)
Issues that confuse Arabic users or require workarounds, but don't fully break the feature.

- [ ] No P1 issues found
- [ ] P1 issues:
  1. [Issue]: [Description] — Owner:
  2. [Issue]: [Description] — Owner:

### P2 Issues (Next Release)
Polish and improvements for post-launch.

- [ ] No P2 issues found
- [ ] P2 issues:
  1. [Issue]: [Description] — Owner:

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| UI/UX Specialist | — | — | READY |
| Arabic Localization Reviewer | — | — | PENDING |
| Frontend Developer (DCP-827) | — | — | PENDING |

---

## Notes

- This template will be populated when DCP-827 (Template Catalog UI) enters code review
- Estimated audit time: 1–2 hours per component
- Findings will be communicated to Frontend Developer for real-time fixes or scheduled for next sprint
- Arabic-speaking participants in Phase 1 testing (DCP-773–DCP-775) will provide qualitative feedback on usability (captured in phase1-observation-template.md)

---

**Prepared by:** UI/UX Specialist
**Date:** 2026-03-24
**Status:** Template ready, awaiting DCP-827 in_review
