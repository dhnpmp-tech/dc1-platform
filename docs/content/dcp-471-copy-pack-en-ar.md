# DCP-471: P0 Messaging Copy Pack (EN/AR)

Date: 2026-03-21 (UTC)  
Owner: Copywriter / Content Strategist

## Guardrails
- No fabricated pricing or savings percentages.
- No bare-metal wording.
- Product description must stay accurate: GPU-accelerated Docker containers with NVIDIA Container Toolkit.
- Keep claims verifiable and implementation-ready.

## Copy Matrix (Paste-Ready)

### Block A: Homepage hero (`app/page.tsx`)

#### EN
- Headline:
  - `Build AI where energy economics and language fit your market.`
- Subhead:
  - `DCP helps teams run GPU workloads on container-based infrastructure in Saudi Arabia, with first-class support for Arabic AI models.`
- Primary CTA:
  - `Start Building`
- Secondary CTA:
  - `Explore Arabic Models`
- Helper line:
  - `Runs in GPU-accelerated Docker containers, not bare-metal provisioning.`

#### AR
- Headline:
  - `طوّر حلول الذكاء الاصطناعي حيث تتوافق كفاءة الطاقة مع سوقك.`
- Subhead:
  - `تساعد DCP الفرق على تشغيل أحمال GPU عبر بنية حاويات داخل السعودية، مع دعم أساسي لنماذج الذكاء الاصطناعي العربية.`
- Primary CTA:
  - `ابدأ الآن`
- Secondary CTA:
  - `استكشف النماذج العربية`
- Helper line:
  - `التشغيل يتم عبر حاويات Docker مع تسريع GPU، وليس عبر bare-metal.`

### Block B: Homepage differentiator strip (`app/page.tsx`)

#### EN
- Item 1 title:
  - `Saudi Energy Advantage`
- Item 1 body:
  - `Deploy workloads in a market with structurally low energy costs, supporting long-term compute economics.`
- Item 2 title:
  - `Arabic AI, First-Class`
- Item 2 body:
  - `Run Arabic-focused models including ALLaM 7B, Falcon H1, JAIS 13B, and BGE-M3.`
- Item 3 title:
  - `Container-Native Execution`
- Item 3 body:
  - `Bring Docker-based workloads to GPU infrastructure without changing your core runtime model.`

#### AR
- Item 1 title:
  - `ميزة الطاقة في السعودية`
- Item 1 body:
  - `شغّل أحمالك في سوق يتميز بانخفاض هيكلي في تكلفة الطاقة لدعم اقتصاديات تشغيل طويلة المدى.`
- Item 2 title:
  - `دعم عربي من الدرجة الأولى`
- Item 2 body:
  - `شغّل نماذج عربية مثل ALLaM 7B وFalcon H1 وJAIS 13B وBGE-M3.`
- Item 3 title:
  - `تنفيذ أصيل بالحاويات`
- Item 3 body:
  - `انقل أحمالك المبنية على Docker إلى بنية GPU دون تغيير نموذج التشغيل الأساسي لديك.`

### Block C: Provider value section (`app/earn/page.tsx`)

#### EN
- Section title:
  - `Monetize GPUs in a market built for AI demand`
- Section body:
  - `Join DCP as a provider and earn from containerized AI workloads routed to your NVIDIA GPU capacity.`
- Trust bullets:
  - `Daemon-based onboarding and heartbeat visibility`
  - `Pause/resume controls from provider workflows`
  - `Earnings tracking tied to completed workload execution`

#### AR
- Section title:
  - `حوّل قدرة GPU إلى دخل في سوق مصمم لطلب الذكاء الاصطناعي`
- Section body:
  - `انضم إلى DCP كمزوّد واربح من أحمال ذكاء اصطناعي تعمل عبر حاويات على سعة NVIDIA لديك.`
- Trust bullets:
  - `تهيئة عبر Daemon مع رؤية واضحة للنبضات`
  - `التحكم بالإيقاف والاستئناف ضمن تدفقات المزوّد`
  - `تتبّع الأرباح مرتبط بتنفيذ الأحمال المكتملة`

### Block D: Quickstart intro (`app/docs/quickstart/page.tsx`)

#### EN
- Intro headline:
  - `Quickstart for Arabic-ready, container-based GPU compute`
- Intro body:
  - `This guide walks you from account setup through workload submission, including model selection for Arabic AI use cases.`
- Note:
  - `DCP job execution runs in GPU-accelerated Docker containers.`

#### AR
- Intro headline:
  - `دليل سريع لتشغيل GPU بالحاويات مع جاهزية للنماذج العربية`
- Intro body:
  - `يرشدك هذا الدليل من إعداد الحساب إلى تنفيذ المهام، مع اختيار نماذج مناسبة لحالات استخدام الذكاء الاصطناعي العربي.`
- Note:
  - `تنفيذ المهام في DCP يتم عبر حاويات Docker مع تسريع GPU.`

### Block E: Tooltip / disclosure snippets (`app/page.tsx`, `app/docs/quickstart/page.tsx`)

#### EN
- Energy-cost tooltip:
  - `Lower regional energy cost is a structural market factor; actual workload cost depends on runtime, model, and GPU selection.`
- Model-support tooltip:
  - `Model availability can vary by online provider capacity and deployment status.`
- Infra disclosure:
  - `DCP provides container-based GPU execution and orchestration workflows.`

#### AR
- Energy-cost tooltip:
  - `انخفاض تكلفة الطاقة إقليميًا عامل هيكلي في السوق؛ التكلفة الفعلية تعتمد على زمن التشغيل والنموذج ونوع GPU.`
- Model-support tooltip:
  - `توافر النماذج قد يختلف حسب سعة المزوّدين المتصلين وحالة النشر.`
- Infra disclosure:
  - `توفر DCP تنفيذًا عبر حاويات GPU مع تدفقات تنسيق التشغيل.`

## Implementation Checklist

### P0
- File: `app/page.tsx`
  - Add Block A and Block B copy (EN/AR via existing i18n layer).
  - Acceptance: Hero and differentiator strip foreground Saudi energy advantage + Arabic model support without numeric savings claims.
- File: `app/docs/quickstart/page.tsx`
  - Replace intro and note with Block D copy.
  - Acceptance: Quickstart intro explicitly references Arabic-ready path and container-based execution.

### P1
- File: `app/earn/page.tsx`
  - Update provider section with Block C messaging.
  - Acceptance: Provider pitch focuses on credible monetization flow and operational transparency.

### P1 (if key-based localization needed)
- File: `app/lib/i18n.tsx`
  - Add keys for each block (hero, differentiator, quickstart intro, tooltips).
  - Acceptance: EN/AR variants render from `t()` calls; no hardcoded user-facing strings.

## Suggested Assignee Roles
- Frontend Developer: `app/page.tsx`, `app/earn/page.tsx`, `app/docs/quickstart/page.tsx`
- Frontend Developer or DevRel Engineer: `app/lib/i18n.tsx` key additions
