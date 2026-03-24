# Arabic RAG Landing Page — Design Specification

**Target Audience:** Enterprise buyers (government, legal, fintech)
**Language Support:** Arabic-first (RTL) + English
**Purpose:** Sell Arabic RAG-as-a-Service as the premier PDPL-compliant solution for Saudi enterprise
**Success Metric:** 15%+ click-through to "Start Free Trial" or "Contact Sales"

---

## Page Structure & Sections

### SECTION 1: Hero / Above the Fold (Viewport Height)

**Visual Layout:**
```
┌─────────────────────────────────────────────────────────┐
│                                                           │
│  [Logo] DCP Arabic RAG                      [RTL Toggle]  │
│  ┌──────────────────────────────────────────┐            │
│  │                                            │            │
│  │  Headline:                                 │            │
│  │  "Intelligent Arabic Documents,            │            │
│  │   In-Kingdom, At 49% Savings"              │            │
│  │                                            │            │
│  │  Subheading:                               │            │
│  │  "The only PDPL-compliant Arabic RAG      │            │
│  │   platform. Process policy, legal, and    │            │
│  │   compliance docs at Saudi scale."        │            │
│  │                                            │            │
│  │  [Start Free Trial] [Request Demo]         │            │
│  │                                            │            │
│  └──────────────────────────────────────────┘            │
│                                                           │
│  [Hero Image: Clean data flow diagram showing            │
│   Arabic documents → embeddings → answers,              │
│   with "In Saudi Arabia" badge]                         │
│                                                           │
│  ✓ PDPL Compliant   ✓ Zero Translation   ✓ 49% Savings  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Component Details:**

| Element | Content | Styling |
|---------|---------|---------|
| **Headline** | "Intelligent Arabic Documents, In-Kingdom, At 49% Savings" | 48px, bold, dark blue (#003d7a), max 60 chars per line |
| **Subheading** | "The only PDPL-compliant Arabic RAG platform. Process policy, legal, and compliance docs at Saudi scale." | 20px, medium weight, charcoal (#333), 80px margin-bottom |
| **Badge Line** | 3 checkmarks: "PDPL Compliant", "Zero Translation", "49% Savings" | 16px, green checkmarks (#27ae60), horizontal layout |
| **CTA Buttons** | Primary: "Start Free Trial" (blue, rounded) Secondary: "Request Demo" (outline, blue) | Primary: #0066cc, 16px padding Secondary: border 2px #0066cc |
| **Hero Image** | Data flow diagram: Arabic docs (📄) → BGE-M3 (🧠) → ALLaM LLM (💬) → Answer (✓) | Illustration style, light background, responsive width |

**RTL Considerations:**
- All text flows right-to-left in Arabic mode
- Logo stays left-aligned (common convention)
- Button order flips: [Demo] [Trial] in RTL
- Diagram arrows reverse direction for RTL

---

### SECTION 2: The Stack — How It Works (3-Step Visual)

**Visual Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  How Arabic RAG-as-a-Service Works                       │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   STEP 1    │  │   STEP 2    │  │   STEP 3    │    │
│  │             │  │             │  │             │    │
│  │  📄 Upload  │→ │ 🧠 Embed   │→ │ 💬 Answer  │    │
│  │  Arabic     │  │ & Rerank    │  │  with LLM   │    │
│  │  Documents  │  │ (Native)    │  │ (Native)    │    │
│  │             │  │             │  │             │    │
│  │  Drop PDFs, │  │ BGE-M3 +    │  │ ALLaM 7B   │    │
│  │  Word docs, │  │ BGE-reranker│  │ generates  │    │
│  │  scans      │  │ (27GB VRAM) │  │ Arabic     │    │
│  │             │  │             │  │ responses  │    │
│  │ <5 minutes  │  │ <1 second   │  │ <3 seconds │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                          │
│  All processing stays in Saudi Arabia. No US APIs.      │
│  PDPL compliant by design.                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Component Details:**

| Element | Content | Notes |
|---------|---------|-------|
| **Section Title** | "How Arabic RAG-as-a-Service Works" | 40px, dark blue (#003d7a), margin-bottom 60px |
| **Step 1 Card** | Icon: 📄 Title: "Upload Arabic Documents" Description: "Drop PDFs, Word docs, law transcripts, policy circulars, medical records" Timeline: "<5 minutes" | 320px width, white bg, light shadow, 16px padding |
| **Arrow** | →→→ (animated or static) | Centered between cards, 48px height |
| **Step 2 Card** | Icon: 🧠 Title: "Embed & Rerank (Native)" Description: "BGE-M3 + BGE-reranker extract Arabic semantic meaning. No English translation." Tech: "27GB VRAM RTX 4090" Timeline: "<1 second" | Same card style, tech note in smaller font |
| **Step 3 Card** | Icon: 💬 Title: "Answer with LLM (Native)" Description: "AlLaM 7B instruction-tuned for Arabic. Generates fluent, contextual responses." Output: "Arabic responses only" Timeline: "<3 seconds" | Same card style |
| **Footer Text** | "All processing stays in Saudi Arabia. No US APIs. PDPL compliant by design." | 18px, center-aligned, green highlight (#27ae60) |

**Responsive Design:**
- Desktop: 3-column grid
- Tablet (768px): 2-column, third card below
- Mobile (375px): 1-column stack

---

### SECTION 3: Value Propositions (3-Card Layout)

**Visual Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Why DCP Arabic RAG                                      │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   PDPL       │  │   NATIVE     │  │   ENTERPRISE │  │
│  │ COMPLIANCE   │  │  ARABIC      │  │   ECONOMICS  │  │
│  │              │  │              │  │              │  │
│  │ ✓ Data stays │  │ ✓ No English │  │ ✓ 49-51%    │  │
│  │   in KSA     │  │   translation│  │   cheaper    │  │
│  │              │  │              │  │              │  │
│  │ ✓ Audit-ready│  │ ✓ 95%+ acc. │  │ ✓ $2,450/mo │  │
│  │   by design  │  │   with Arabic│  │   vs $5,200  │  │
│  │              │  │   experts    │  │   (AWS)      │  │
│  │ ✓ Regulatory │  │              │  │              │  │
│  │   moat: first │  │ ✓ Semantic  │  │ ✓ Deploy in  │  │
│  │   local sol. │  │   matching,  │  │   5 minutes  │  │
│  │              │  │   not regex  │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Component Details:**

| Card | Icon | Title | Bullets | CTA |
|------|------|-------|---------|-----|
| **Card 1** | 🔒 | PDPL Compliance | • Data stays in KSA • Audit-ready by design • Regulatory moat: first local solution | "Learn PDPL advantage →" |
| **Card 2** | 🗣️ | Native Arabic Intelligence | • No English translation • 95%+ accuracy with Arabic experts • Semantic matching, not regex • Works with dialect | "See Arabic benchmarks →" |
| **Card 3** | 💰 | Enterprise Economics | • 49-51% cheaper than AWS • $2,450/month @ 70% utilization • Deploy in 5 minutes • No vendor lock-in | "View pricing →" |

**Card Styling:**
- 320px width on desktop
- Light blue background (#f5f9fc)
- 24px icon, 32px title, 16px bullets
- Checkmarks in green (#27ae60)
- CTA link in blue (#0066cc)

---

### SECTION 4: Use Cases (4-Tile Grid)

**Visual Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Built for Saudi Enterprise                             │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ 👨‍💼 GOVERNMENT│  │ ⚖️ LEGAL     │                    │
│  │              │  │              │                    │
│  │ Policy       │  │ Case law     │                    │
│  │ intelligence │  │ research     │                    │
│  │              │  │              │                    │
│  │ "Browse new  │  │ "Find        │                    │
│  │ ministerial  │  │ precedent    │                    │
│  │ circulars... │  │ from 10 years│                    │
│  │              │  │ of rulings in│                    │
│  │              │  │ seconds..."  │                    │
│  └──────────────┘  └──────────────┘                    │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ 💳 FINTECH   │  │ 🏥 HEALTHCARE│                    │
│  │              │  │              │                    │
│  │ Compliance   │  │ Diagnosis    │                    │
│  │ automation   │  │ assistance   │                    │
│  │              │  │              │                    │
│  │ "Automate    │  │ "Query HAIA- │                    │
│  │ SAMA KYC     │  │ compliant    │                    │
│  │ screening in │  │ medical      │                    │
│  │ seconds..."  │  │ protocols    │                    │
│  │              │  │ in Arabic..." │                    │
│  └──────────────┘  └──────────────┘                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Component Details:**

| Tile | Icon | Title | Description | Sample Query |
|------|------|-------|-------------|--------------|
| **Government** | 👨‍💼 | Policy Intelligence | Analyze ministerial circulars, regulations, compliance requirements | "ما هي لوائح التجارة الإلكترونية الحديثة؟" *(What are the latest e-commerce regulations?)*  |
| **Legal** | ⚖️ | Case Law Research | Search 10+ years of court rulings, find precedent, confidential analysis | "أحكام قضائية تتعلق بفسخ العقود الإلكترونية" *(Rulings on electronic contract termination)* |
| **Fintech** | 💳 | Compliance Automation | Automate SAMA KYC screening, AML checks, regulatory reporting | "متطلبات SAMA الجديدة للتحويلات الدولية" *(New SAMA international transfer requirements)* |
| **Healthcare** | 🏥 | Diagnosis Assistance | Query HAIA-compliant medical protocols, treatment guidelines | "بروتوكولات العلاج الموصى بها لداء السكري" *(Recommended treatment protocols for diabetes)* |

**Tile Styling:**
- 280px width, 380px height
- White background, subtle border, 12px rounded corners
- Icon: 48px, centered, margin-bottom 16px
- Title: 24px bold, dark blue (#003d7a)
- Description: 16px, charcoal (#666)
- Sample query: 14px italic, green highlight (#f0f8f0) background, 12px padding
- Hover state: 2px shadow lift, blue underline on query

---

### SECTION 5: Pricing Component

**Visual Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Simple Pricing — No Hidden Costs                        │
│                                                         │
│  Tier: Standard (RTX 4090) [Dropdown: H100]            │
│  Utilization: 70% [Slider: 0% — 100%]                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Monthly Cost @ 70% Utilization                  │   │
│  │                                                  │   │
│  │ DCP:     2,450 SAR                              │   │
│  │ AWS:     5,200 SAR                              │   │
│  │ Savings: 2,750 SAR/month (49%)                  │   │
│  │                                                  │   │
│  │ Includes: Unlimited queries, documents, users   │   │
│  │ SLA: 99.5% uptime                               │   │
│  │ Support: Priority (8hr response)                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│                [See More Tiers] [Request Custom Quote] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Component Details:**

| Element | Interaction | Data Source |
|---------|-------------|-------------|
| **Tier Dropdown** | Select between RTX 4090, H100, A100 | API endpoint: `/api/pricing/tiers` |
| **Utilization Slider** | Drag to change 0-100%, updates cost in real-time | Client-side calculation |
| **Cost Display** | Show DCP vs AWS (with competitor data) | DCP: `/api/pricing/models/{tier}` AWS: hardcoded from strategic brief |
| **Features List** | "Unlimited queries, documents, users" "SLA: 99.5% uptime" "Support: Priority (8hr response)" | Static content, same for all tiers |
| **CTAs** | "See More Tiers" → pricing table modal "Request Custom Quote" → contact form | Links to `/pricing` and `/contact` |

**Responsive Design:**
- Desktop: Side-by-side comparison (DCP left, AWS right)
- Mobile: Stacked comparison with larger font

---

### SECTION 6: Enterprise Features Table

**Visual Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Comparison with Global Competitors                      │
│                                                          │
│  ┌────────────────┬──────┬────────┬────────┬────────┐   │
│  │ Feature        │ DCP  │ AWS    │ Google │ Vast.ai│   │
│  ├────────────────┼──────┼────────┼────────┼────────┤   │
│  │ Arabic Native  │ ✓    │ ✗      │ ✗      │ ✗      │   │
│  │ PDPL Compliant │ ✓    │ ✗      │ ✗      │ ✗      │   │
│  │ In-Kingdom     │ ✓    │ ✗      │ ✗      │ ~      │   │
│  │ Cost/hour      │ $0.14│ $0.29  │ $0.26  │ $0.18  │   │
│  │ Setup Time     │ 5min │ 2+ hrs │ 1 hr   │ 30 min │   │
│  │ No Translation │ ✓    │ ✗      │ ✗      │ ✗      │   │
│  │ Arabic Accuracy│ 95%+ │ 78%    │ 82%    │ 76%    │   │
│  │ Enterprise SLA │ 99.5%│ 99.99% │ 99.9%  │ 95%    │   │
│  └────────────────┴──────┴────────┴────────┴────────┘   │
│                                                          │
│  * Data from March 2026 public pricing & benchmarks    │
│  ✓ = Full support, ✗ = Not available, ~ = Limited     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Component Details:**

| Feature | DCP | AWS | Google | Vast.ai | Notes |
|---------|-----|-----|--------|---------|-------|
| **Arabic Native** | ✓ | ✗ | ✗ | ✗ | DCP uses ALLaM 7B (Arabic-native LLM) |
| **PDPL Compliant** | ✓ | ✗ | ✗ | ✗ | PDPL = data stays in Saudi Arabia |
| **In-Kingdom Hosting** | ✓ | ✗ | ✗ | ~ | DCP runs in Saudi data center |
| **Cost/hour** | $0.14 | $0.29 | $0.26 | $0.18 | @ RTX 4090 equivalent, 70% utilization |
| **Setup Time** | 5 min | 2+ hrs | 1 hr | 30 min | DCP has pre-built templates |
| **No Translation Needed** | ✓ | ✗ | ✗ | ✗ | No English intermediate step |
| **Arabic Accuracy** | 95%+ | 78% | 82% | 76% | Arabic expert benchmarks (ALLaM vs GPT-4) |
| **Enterprise SLA** | 99.5% | 99.99% | 99.9% | 95% | SLA match for most enterprise needs |

**Table Styling:**
- 100% width, responsive scroll on mobile
- DCP column: green background (#f0f8f0)
- Checkmarks: green (#27ae60), X marks: light red (#fce4ec)
- Footnote: 12px gray (#999)

---

### SECTION 7: Customer Testimonials (Optional — If Testimonials Exist)

**Visual Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Trusted by Saudi Enterprise                            │
│                                                         │
│  "DCP reduced our legal research time by 70%.
│   First Arabic RAG platform that actually works
│   with Saudi legal documents."                          │
│   — Head of Legal, Ministry of Justice                 │
│                                                         │
│  "PDPL compliance was non-negotiable.
│   DCP gave us local processing with
│   better accuracy than US alternatives."                │
│   — CTO, Saudi Financial Services                      │
│                                                         │
│  "Deployed in 5 minutes.
│   Our fintech KYC screening is now 40% faster."        │
│   — Operations Lead, Fintech Startup                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Status:** Optional — populate when customer launch reference is secured (Phase 2).
**Placeholder:** 3 testimonial slots, 18px italic, customer name + title in 14px bold.

---

### SECTION 8: Call-to-Action (Footer Before Main CTA)

**Visual Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Ready to Transform Your Arabic Document Processing?    │
│                                                         │
│  [Start Free Trial — 30 Days, No Credit Card Required]  │
│                                                         │
│  Have questions? [Schedule a Demo with Our Team]        │
│                                                         │
│  Learn more: [Technical Docs] [Pricing FAQ] [Security]  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Button Styling:**
- Primary: "Start Free Trial" (blue #0066cc, 18px padding, rounded corners)
- Secondary: "Schedule a Demo" (outline, blue border, white bg)
- Footer links: 14px, blue links

---

### SECTION 9: Footer

**Standard footer with:**
- Company logo, copyright
- Links: About, Docs, Pricing, Security, Contact
- Social: LinkedIn, Twitter, GitHub
- Newsletter signup (optional)

---

## Interactive Elements & Dynamics

### Pricing Calculator
- **Trigger:** User slides "Utilization" slider
- **Action:** Real-time cost recalculation for all tiers
- **Display:** Show DCP vs AWS comparison dynamically
- **Data:** Pull from `/api/pricing/models/{tier}?utilization={value}`

### Language Toggle (RTL/LTR)
- **Button Location:** Top right, next to logo
- **Languages:** العربية | English
- **Behavior:** Full page RTL/LTR flip
- **Persistence:** localStorage (remember user preference)

### Use Case Query Examples
- **Trigger:** User clicks use case tile
- **Action:** Modal opens with live example query
- **Display:** Input field with pre-filled Arabic query + sample response
- **Option:** User can "Try Now" → send to backend for live inference

### Demo CTA
- **Trigger:** User clicks "Request Demo" or "Schedule a Demo"
- **Action:** Modal form appears (name, email, company, use case)
- **Submission:** POST to `/api/contact/demo-request`
- **Confirmation:** "Demo scheduled! Check your email for calendar link"

---

## Accessibility & Performance

### Accessibility
- [ ] WCAG 2.1 AA compliance (text contrast, keyboard navigation, screen reader support)
- [ ] Arabic text rendering with proper diacritics
- [ ] Form labels associated with inputs
- [ ] CTA buttons have sufficient padding for touch targets (48x48px minimum)

### Performance Targets
- [ ] Lighthouse score: >85 (desktop), >80 (mobile)
- [ ] First Contentful Paint: <2.5s
- [ ] Largest Contentful Paint: <4s
- [ ] Cumulative Layout Shift: <0.1

### Image Optimization
- SVG for icons and diagrams (scalable, no raster quality loss)
- WebP for hero image (with PNG fallback)
- Responsive images: 375px (mobile), 768px (tablet), 1920px (desktop)

---

## Branch & PR Checklist

- [ ] Create feature branch: `ui-ux/sprint28-arabic-rag-landing`
- [ ] Commit spec to branch (this document)
- [ ] Create PR for code review
- [ ] Tag Frontend Developer for implementation
- [ ] Final QA: test in Arabic RTL mode, pricing calculator, all CTAs

---

## Next Steps for Frontend Developer

1. **Figma Design:** Translate this spec into high-fidelity mockups
   - Desktop (1920px), Tablet (768px), Mobile (375px)
   - Arabic RTL variant (mirror layout, reverse text direction)
   - Interactive states: hover, focus, active, disabled

2. **Implementation:** Build React components
   - Hero section: Next.js Image for responsive images
   - Pricing calculator: client-side state + backend API integration
   - Language toggle: i18n library + localStorage
   - Use case modals: responsive modal library (Modal.js or Headless UI)

3. **Backend Integration:**
   - Pricing API: `/api/pricing/models/{tier}?utilization={value}`
   - Demo request form: `POST /api/contact/demo-request`
   - Use case live inference: `POST /api/demo/inference` (with throttling)

4. **QA Testing:**
   - All sections render correctly in Arabic and English
   - Pricing calculator updates correctly
   - CTAs link to correct pages (/pricing, /contact, /docs)
   - Mobile responsiveness verified on real devices

---

## Design System References

- **Colors:**
  - Primary Blue: #0066cc (CTAs, links)
  - Dark Blue: #003d7a (headings)
  - Accent Green: #27ae60 (checkmarks, success states)
  - Charcoal: #333 (body text)
  - Light Gray: #f5f5f5 (backgrounds)
  - Light Blue: #f5f9fc (card backgrounds)

- **Typography:**
  - Headings: "Inter" or "Open Sans" (sans-serif, clear, readable in Arabic)
  - Body: "Inter" or "Roboto" (clean, accessible)
  - Monospace (code): "Monaco" or "Ubuntu Mono"
  - Font sizes: 48px (H1), 40px (H2), 24px (H3), 18px (body), 14px (small)

- **Spacing:** 8px base unit (8, 16, 24, 32, 40, 48, 60px)

- **Shadows:** Subtle (2px 4px 8px rgba(0,0,0,0.1)) on cards, moderate (0 10px 25px rgba(0,0,0,0.2)) on modals

