'use client'

import Link from 'next/link'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import { useLanguage } from '../../lib/i18n'

// ── Copy ────────────────────────────────────────────────────────────────────

const copy = {
  en: {
    hero: {
      eyebrow: 'Arabic RAG-as-a-Service',
      headline: 'Arabic RAG. In-Kingdom. PDPL-Compliant.',
      subheadline:
        '46–51% cheaper than hyperscalers. Zero data leaves Saudi borders. Models trained on Arabic corpora — not translated.',
      cta_primary: 'Deploy Arabic RAG',
      cta_secondary: 'Contact Sales',
    },
    pipeline: {
      title: 'The Arabic RAG Pipeline',
      subtitle:
        'Three specialist models, one coherent retrieval stack. Built for Arabic text — not retrofitted.',
      steps: [
        {
          label: 'BGE-M3 Embeddings',
          description:
            'Multilingual embedder optimised for Arabic morphology. Converts documents and queries into dense vectors that respect Arabic root-based semantics.',
          badge: 'Embed',
          color: 'from-sky-500/20 to-sky-500/5',
          border: 'border-sky-500/30',
          icon: '⊙',
        },
        {
          label: 'BGE Reranker',
          description:
            'Cross-encoder reranker re-scores top-K candidates for precision. Eliminates false positives before reaching the LLM — critical for Arabic legal and regulatory text.',
          badge: 'Rerank',
          color: 'from-violet-500/20 to-violet-500/5',
          border: 'border-violet-500/30',
          icon: '⇅',
        },
        {
          label: 'ALLaM 7B / JAIS 13B',
          description:
            'Arabic-native LLMs fine-tuned on Saudi regulatory, legal, and financial corpora. Generate accurate, grounded answers in Arabic without translation overhead.',
          badge: 'Generate',
          color: 'from-dc1-amber/20 to-dc1-amber/5',
          border: 'border-dc1-amber/30',
          icon: '✦',
        },
      ],
    },
    usecases: [
      {
        id: 'government',
        icon: '🏛️',
        audience: 'Government',
        title: 'Policy Document Intelligence',
        pitch:
          'Search years of ministerial circulars, regulatory archives, and policy precedents in seconds — in Arabic, in-kingdom.',
        bullets: [
          'Instant recall across ministry archives and regulatory guidance',
          'Bilingual query: ask in Arabic, surface English and Arabic results',
          'PDPL-native: data never leaves Saudi borders',
          'Zero translation loss on Arabic regulatory language',
        ],
        savings: '46–51%',
        vs: 'AWS / Azure',
        example:
          'A government department running 8×H100 GPUs for continuous policy analysis spends $42,048/yr on AWS. On DC1: $20,376/yr — saving $21,672/yr with zero data sovereignty risk.',
        cta: 'Government brief →',
      },
      {
        id: 'legal',
        icon: '⚖️',
        audience: 'Legal',
        title: 'Arabic Case Law Search',
        pitch:
          'Private, confidential case law search across Saudi court decisions, Sharia compliance, and contract archives — without routing data offshore.',
        bullets: [
          '70% faster case research vs. manual digging',
          'Sharia-aware models: Falcon H1, JAIS trained on Islamic jurisprudence',
          'Client confidentiality: zero data leaves your network',
          '39–46% savings vs. LexisNexis / Westlaw',
        ],
        savings: '39–46%',
        vs: 'LexisNexis / Westlaw',
        example:
          'A 50-lawyer firm on LexisNexis + Westlaw spends ~$500K/yr on licenses. DC1 private instance: ~$150K/yr — saving $350K/yr with Arabic-native accuracy.',
        cta: 'Legal brief →',
      },
      {
        id: 'fintech',
        icon: '🏦',
        audience: 'Fintech',
        title: 'KYC + SAMA Compliance',
        pitch:
          'Process Arabic KYC documents, financial statements, and SAMA filings at 95%+ accuracy — all in-kingdom, all private.',
        bullets: [
          '95%+ accuracy on Arabic identity documents (vs 75–85% for Western tools)',
          'Batch 1,000+ documents/hour — no per-transaction fees',
          'SAMA-compliant architecture, full audit trail',
          '45–51% cheaper than AWS + KYC vendors',
        ],
        savings: '45–51%',
        vs: 'AWS + KYC vendors',
        example:
          'A Saudi fintech processing 50K KYC documents/month spends $150K/yr on AWS + Veriff. On DC1: $36K/yr — saving $114K/yr with zero offshore data routing.',
        cta: 'Fintech brief →',
      },
    ],
    pricing: {
      title: 'DCP vs. Hyperscalers',
      subtitle: 'Same Arabic inference capability. Less than half the price.',
      note: 'All prices per GPU-hour. DCP prices based on RTX 4090 floor rate ($0.267/hr). Hyperscaler rates are published list prices.',
      columns: ['Provider', 'GPU-Hour (USD)', 'Arabic Support', 'Data Residency', 'PDPL Status'],
      rows: [
        {
          provider: 'DCP',
          rate: '$0.27–$1.20',
          arabic: '✅ Native (ALLaM, JAIS, Falcon H1)',
          residency: '🇸🇦 In-kingdom',
          pdpl: '✅ Compliant by design',
          highlight: true,
        },
        {
          provider: 'Azure OpenAI',
          rate: '$3.00–$32.00',
          arabic: '⚠️ Translated / GPT-4',
          residency: '🌍 Offshore',
          pdpl: '❌ Risk',
          highlight: false,
        },
        {
          provider: 'AWS Bedrock',
          rate: '$1.50–$28.00',
          arabic: '⚠️ Translated / Claude',
          residency: '🌍 Offshore',
          pdpl: '❌ Risk',
          highlight: false,
        },
        {
          provider: 'GCP Vertex AI',
          rate: '$2.00–$30.00',
          arabic: '⚠️ Translated / Gemini',
          residency: '🌍 Offshore',
          pdpl: '❌ Risk',
          highlight: false,
        },
      ],
    },
    deploy: {
      title: 'Deploy in 4 Weeks',
      steps: [
        { week: 'Week 1', label: 'Register GPUs', desc: 'Register hardware, benchmark GPU, pull Arabic models to warm cache.' },
        { week: 'Week 2', label: 'Build Pipeline', desc: 'Deploy BGE-M3 + BGE-reranker + ALLaM/JAIS stack. Ingest your document corpus.' },
        { week: 'Week 3', label: 'Pilot', desc: 'Go live with internal users. Test retrieval accuracy on real queries.' },
        { week: 'Week 4+', label: 'Scale', desc: 'Expand to full user base, integrate with existing systems, add document sets.' },
      ],
    },
    cta_block: {
      headline: 'Ready to deploy Arabic RAG in-kingdom?',
      sub: 'One-click deployment. No hyperscaler lock-in. PDPL-compliant from day one.',
      cta_primary: 'Deploy Arabic RAG',
      cta_secondary: 'Contact Sales',
    },
  },
  ar: {
    hero: {
      eyebrow: 'خدمة الذكاء الاصطناعي العربي RAG',
      headline: 'معالجة المستندات العربية داخل المملكة. متوافقة مع نظام PDPL.',
      subheadline:
        'أرخص بنسبة 46–51% مقارنةً بالخدمات السحابية الكبرى. لا تغادر بياناتك الحدود السعودية أبداً. نماذج مدرَّبة على النصوص العربية — لا ترجمة.',
      cta_primary: 'نشر Arabic RAG',
      cta_secondary: 'تواصل مع المبيعات',
    },
    pipeline: {
      title: 'مسار معالجة Arabic RAG',
      subtitle: 'ثلاثة نماذج متخصصة، مكوّنة بسلاسة للاسترجاع العربي الدقيق.',
      steps: [
        {
          label: 'BGE-M3 التضمينات',
          description: 'نموذج تضمين متعدد اللغات مُحسَّن لمورفولوجيا اللغة العربية، يحوّل المستندات والاستفسارات إلى متجهات كثيفة تُراعي دلالات الجذر العربي.',
          badge: 'تضمين',
          color: 'from-sky-500/20 to-sky-500/5',
          border: 'border-sky-500/30',
          icon: '⊙',
        },
        {
          label: 'BGE إعادة الترتيب',
          description: 'نموذج تقاطعي يُعيد ترتيب أفضل النتائج لضمان الدقة، مما يُقلّل النتائج الزائفة قبل الوصول إلى نموذج اللغة — ضروري للنصوص القانونية والتنظيمية العربية.',
          badge: 'إعادة ترتيب',
          color: 'from-violet-500/20 to-violet-500/5',
          border: 'border-violet-500/30',
          icon: '⇅',
        },
        {
          label: 'ALLaM 7B / JAIS 13B',
          description: 'نماذج لغوية عربية متخصصة مدرَّبة على مجموعات بيانات سعودية تنظيمية وقانونية ومالية، تُنتج إجابات دقيقة باللغة العربية دون تكلفة الترجمة.',
          badge: 'توليد',
          color: 'from-dc1-amber/20 to-dc1-amber/5',
          border: 'border-dc1-amber/30',
          icon: '✦',
        },
      ],
    },
    usecases: [
      {
        id: 'government',
        icon: '🏛️',
        audience: 'الجهات الحكومية',
        title: 'الذكاء في المستندات الحكومية',
        pitch: 'ابحث في سنوات من التعاميم الوزارية والأرشيف التنظيمي والسوابق السياسية في ثوانٍ — بالعربية، داخل المملكة.',
        bullets: [
          'استدعاء فوري عبر أرشيف الوزارات والتوجيهات التنظيمية',
          'استفسار ثنائي اللغة: اسأل بالعربية، واحصل على نتائج عربية وإنجليزية',
          'متوافق مع PDPL: البيانات لا تغادر الحدود السعودية',
          'صفر خسائر في الترجمة للغة التنظيمية العربية',
        ],
        savings: '46–51%',
        vs: 'AWS / Azure',
        example: 'قسم حكومي يستخدم 8×H100 للتحليل المستمر للسياسات ينفق 42,048 دولار/سنة على AWS. على DC1: 20,376 دولار/سنة — وفر 21,672 دولار/سنة مع صفر مخاطر على السيادة البيانية.',
        cta: 'الملف الحكومي ←',
      },
      {
        id: 'legal',
        icon: '⚖️',
        audience: 'القطاع القانوني',
        title: 'البحث في السوابق القضائية العربية',
        pitch: 'بحث قانوني سري في أحكام المحاكم السعودية والامتثال الشرعي وأرشيف العقود — دون إرسال البيانات خارج المملكة.',
        bullets: [
          'أسرع بـ70% في البحث عن السوابق القضائية مقارنةً بالبحث اليدوي',
          'نماذج واعية بالشريعة: Falcon H1 وJAIS مدرَّبان على الفقه الإسلامي',
          'سرية المعلومات: لا تغادر البيانات شبكتك',
          'وفر 39–46% مقارنةً بـ LexisNexis / Westlaw',
        ],
        savings: '39–46%',
        vs: 'LexisNexis / Westlaw',
        example: 'مكتب محاماة من 50 محامياً ينفق ~500,000 دولار/سنة على التراخيص. نسخة DC1 الخاصة: ~150,000 دولار/سنة — توفير 350,000 دولار/سنة بدقة عربية أصيلة.',
        cta: 'الملف القانوني ←',
      },
      {
        id: 'fintech',
        icon: '🏦',
        audience: 'التقنية المالية',
        title: 'KYC + الامتثال لمتطلبات ساما',
        pitch: 'معالجة وثائق KYC العربية والبيانات المالية وملفات ساما بدقة تتجاوز 95% — داخل المملكة بالكامل، وبخصوصية تامة.',
        bullets: [
          'دقة تتجاوز 95% في معالجة الهويات العربية (مقارنةً بـ75–85% للأدوات الغربية)',
          'معالجة دفعية لأكثر من 1,000 وثيقة/ساعة — بدون رسوم لكل معاملة',
          'بنية متوافقة مع ساما، مع سجل تدقيق متكامل',
          'أرخص بـ45–51% مقارنةً بـAWS + موردي KYC',
        ],
        savings: '45–51%',
        vs: 'AWS + موردي KYC',
        example: 'شركة FinTech سعودية تعالج 50,000 وثيقة KYC/شهر تنفق 150,000 دولار/سنة على AWS + Veriff. على DC1: 36,000 دولار/سنة — توفير 114,000 دولار/سنة مع صفر إرسال للبيانات خارج المملكة.',
        cta: 'الملف المالي ←',
      },
    ],
    pricing: {
      title: 'DCP مقابل الخدمات السحابية الكبرى',
      subtitle: 'نفس قدرات الاستدلال العربي. بأقل من نصف السعر.',
      note: 'جميع الأسعار لكل ساعة GPU. أسعار DCP مبنية على سعر RTX 4090 الأساسي (0.267 دولار/ساعة). أسعار الخدمات السحابية هي الأسعار المعلنة رسمياً.',
      columns: ['المزود', 'سعر GPU/ساعة (USD)', 'دعم العربية', 'موقع البيانات', 'حالة PDPL'],
      rows: [
        {
          provider: 'DCP',
          rate: '$0.27–$1.20',
          arabic: '✅ أصيل (ALLaM, JAIS, Falcon H1)',
          residency: '🇸🇦 داخل المملكة',
          pdpl: '✅ متوافق بالتصميم',
          highlight: true,
        },
        {
          provider: 'Azure OpenAI',
          rate: '$3.00–$32.00',
          arabic: '⚠️ مترجم / GPT-4',
          residency: '🌍 خارج المملكة',
          pdpl: '❌ مخاطرة',
          highlight: false,
        },
        {
          provider: 'AWS Bedrock',
          rate: '$1.50–$28.00',
          arabic: '⚠️ مترجم / Claude',
          residency: '🌍 خارج المملكة',
          pdpl: '❌ مخاطرة',
          highlight: false,
        },
        {
          provider: 'GCP Vertex AI',
          rate: '$2.00–$30.00',
          arabic: '⚠️ مترجم / Gemini',
          residency: '🌍 خارج المملكة',
          pdpl: '❌ مخاطرة',
          highlight: false,
        },
      ],
    },
    deploy: {
      title: 'النشر في 4 أسابيع',
      steps: [
        { week: 'الأسبوع 1', label: 'تسجيل GPUs', desc: 'تسجيل الأجهزة، قياس أداء GPU، تحميل النماذج العربية مسبقاً.' },
        { week: 'الأسبوع 2', label: 'بناء المسار', desc: 'نشر مكدس BGE-M3 + BGE-reranker + ALLaM/JAIS. استيعاب مجموعة وثائقك.' },
        { week: 'الأسبوع 3', label: 'التجريب', desc: 'إطلاق تجريبي للمستخدمين الداخليين. اختبار دقة الاسترجاع على استفسارات حقيقية.' },
        { week: 'الأسبوع 4+', label: 'التوسع', desc: 'التوسع لقاعدة المستخدمين الكاملة، التكامل مع الأنظمة القائمة، إضافة مجموعات وثائق جديدة.' },
      ],
    },
    cta_block: {
      headline: 'مستعد لنشر Arabic RAG داخل المملكة؟',
      sub: 'نشر بنقرة واحدة. بلا قيود على الموردين. متوافق مع PDPL من اليوم الأول.',
      cta_primary: 'نشر Arabic RAG',
      cta_secondary: 'تواصل مع المبيعات',
    },
  },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ArabicRagPage() {
  const { language, isRTL } = useLanguage()
  const c = copy[language as 'en' | 'ar'] ?? copy.en

  return (
    <div
      className="min-h-screen bg-dc1-void text-dc1-text-primary"
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={language}
    >
      <Header />
      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-dc1-void pt-20 pb-24 sm:pt-28 sm:pb-32">
          {/* background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-dc1-amber/5 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-dc1-amber bg-dc1-amber/10 border border-dc1-amber/20 px-4 py-1.5 rounded-full mb-8">
              <span>✦</span>
              {c.hero.eyebrow}
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-dc1-text-primary leading-tight mb-6">
              {c.hero.headline}
            </h1>
            <p className="text-lg sm:text-xl text-dc1-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
              {c.hero.subheadline}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/marketplace/templates"
                className="px-8 py-3.5 bg-dc1-amber text-dc1-void font-semibold rounded-lg hover:bg-dc1-amber-hover transition-colors shadow-lg shadow-dc1-amber/20"
              >
                {c.hero.cta_primary}
              </Link>
              <a
                href="mailto:enterprise@dcp.sa"
                className="px-8 py-3.5 border border-dc1-border text-dc1-text-primary font-medium rounded-lg hover:border-dc1-border-light hover:text-dc1-amber transition-colors"
              >
                {c.hero.cta_secondary}
              </a>
            </div>
          </div>
        </section>

        {/* ── Pipeline diagram ── */}
        <section className="py-20 bg-dc1-section-blue">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-dc1-text-primary mb-3">{c.pipeline.title}</h2>
              <p className="text-dc1-text-secondary max-w-xl mx-auto">{c.pipeline.subtitle}</p>
            </div>

            {/* pipeline flow */}
            <div className="flex flex-col lg:flex-row items-stretch gap-0 lg:gap-0">
              {c.pipeline.steps.map((step, idx) => (
                <div key={step.label} className="flex flex-col lg:flex-row items-stretch flex-1">
                  {/* card */}
                  <div
                    className={`flex-1 bg-gradient-to-b ${step.color} border ${step.border} rounded-2xl p-6 flex flex-col`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">{step.icon}</span>
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border ${step.border} bg-dc1-void/50`}
                      >
                        {step.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-dc1-text-primary mb-2">{step.label}</h3>
                    <p className="text-sm text-dc1-text-secondary leading-relaxed flex-1">{step.description}</p>
                  </div>
                  {/* connector arrow */}
                  {idx < c.pipeline.steps.length - 1 && (
                    <div className="flex items-center justify-center lg:px-3 py-3 lg:py-0">
                      <span className="text-dc1-text-muted text-xl lg:rotate-0 rotate-90">→</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Use case sections ── */}
        {c.usecases.map((uc, idx) => (
          <section
            key={uc.id}
            id={uc.id}
            className={`py-20 ${idx % 2 === 0 ? 'bg-dc1-void' : 'bg-dc1-surface-l1'}`}
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className={`grid lg:grid-cols-2 gap-12 items-start ${idx % 2 !== 0 ? 'lg:grid-flow-dense' : ''}`}>
                {/* text */}
                <div className={idx % 2 !== 0 ? 'lg:col-start-2' : ''}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-dc1-amber mb-3">
                    {uc.icon} {uc.audience}
                  </p>
                  <h2 className="text-3xl font-bold text-dc1-text-primary mb-4">{uc.title}</h2>
                  <p className="text-lg text-dc1-text-secondary mb-6 leading-relaxed">{uc.pitch}</p>
                  <ul className="space-y-3 mb-8">
                    {uc.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-dc1-text-secondary">
                        <span className="text-dc1-amber mt-0.5 shrink-0">✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/marketplace/templates/arabic-rag?vertical=${uc.id}`}
                    className="inline-flex items-center gap-1 text-dc1-amber text-sm font-medium hover:underline"
                  >
                    {uc.cta}
                  </Link>
                </div>

                {/* savings card */}
                <div className={idx % 2 !== 0 ? 'lg:col-start-1 lg:row-start-1' : ''}>
                  <div className="bg-dc1-surface-l2 border border-dc1-border rounded-2xl p-6">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-5xl font-bold text-dc1-amber">{uc.savings}</span>
                      <span className="text-dc1-text-secondary text-sm">cheaper vs {uc.vs}</span>
                    </div>
                    <p className="text-xs text-dc1-text-muted mb-6">Based on published list prices</p>
                    <div className="bg-dc1-surface-l3 rounded-lg p-4">
                      <p className="text-xs text-dc1-text-muted uppercase tracking-wide mb-2 font-semibold">Example</p>
                      <p className="text-sm text-dc1-text-secondary leading-relaxed">{uc.example}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}

        {/* ── Pricing comparison table ── */}
        <section className="py-20 bg-dc1-section-blue">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-dc1-text-primary mb-3">{c.pricing.title}</h2>
              <p className="text-dc1-text-secondary max-w-xl mx-auto">{c.pricing.subtitle}</p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-dc1-border">
              <table className="w-full">
                <thead>
                  <tr className="bg-dc1-surface-l2 border-b border-dc1-border">
                    {c.pricing.columns.map((col) => (
                      <th
                        key={col}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-dc1-text-muted ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.pricing.rows.map((row) => (
                    <tr
                      key={row.provider}
                      className={`border-b border-dc1-border last:border-0 transition-colors ${
                        row.highlight
                          ? 'bg-dc1-amber/5 hover:bg-dc1-amber/10'
                          : 'bg-dc1-void hover:bg-dc1-surface-l1'
                      }`}
                    >
                      <td className="px-4 py-4">
                        <span
                          className={`font-semibold text-sm ${row.highlight ? 'text-dc1-amber' : 'text-dc1-text-primary'}`}
                        >
                          {row.provider}
                        </span>
                      </td>
                      <td className={`px-4 py-4 text-sm ${row.highlight ? 'text-dc1-text-primary font-medium' : 'text-dc1-text-secondary'}`}>
                        {row.rate}
                      </td>
                      <td className="px-4 py-4 text-sm text-dc1-text-secondary">{row.arabic}</td>
                      <td className="px-4 py-4 text-sm text-dc1-text-secondary">{row.residency}</td>
                      <td className="px-4 py-4 text-sm text-dc1-text-secondary">{row.pdpl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-dc1-text-muted mt-4 text-center">{c.pricing.note}</p>
          </div>
        </section>

        {/* ── Deploy timeline ── */}
        <section className="py-20 bg-dc1-void">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-dc1-text-primary text-center mb-14">{c.deploy.title}</h2>
            <div className="relative">
              {/* vertical line */}
              <div className="absolute left-7 top-0 bottom-0 w-px bg-dc1-border hidden sm:block" />
              <div className="space-y-8">
                {c.deploy.steps.map((step, idx) => (
                  <div key={step.week} className="relative flex gap-6 items-start">
                    {/* circle */}
                    <div className="relative z-10 flex-shrink-0 w-14 h-14 rounded-full bg-dc1-surface-l2 border border-dc1-border flex items-center justify-center">
                      <span className="text-dc1-amber font-bold text-lg">{idx + 1}</span>
                    </div>
                    <div className="pt-3">
                      <p className="text-xs uppercase tracking-wide text-dc1-amber font-semibold mb-0.5">{step.week}</p>
                      <h3 className="text-base font-semibold text-dc1-text-primary mb-1">{step.label}</h3>
                      <p className="text-sm text-dc1-text-secondary">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-24 bg-dc1-surface-l1">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-4">{c.cta_block.headline}</h2>
            <p className="text-lg text-dc1-text-secondary mb-10">{c.cta_block.sub}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/marketplace/templates"
                className="px-8 py-3.5 bg-dc1-amber text-dc1-void font-semibold rounded-lg hover:bg-dc1-amber-hover transition-colors shadow-lg shadow-dc1-amber/20"
              >
                {c.cta_block.cta_primary}
              </Link>
              <a
                href="mailto:enterprise@dcp.sa"
                className="px-8 py-3.5 border border-dc1-border text-dc1-text-primary font-medium rounded-lg hover:border-dc1-border-light hover:text-dc1-amber transition-colors"
              >
                {c.cta_block.cta_secondary}
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
