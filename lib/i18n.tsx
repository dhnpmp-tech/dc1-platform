'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type Lang = 'en' | 'ar'

// ─── Translations ─────────────────────────────────────────────────────────────

const translations = {
  en: {
    nav: {
      compute: 'Compute',
      supply: 'Supply',
      docs: 'Docs',
      consoleLogin: 'Console Login',
      getEarlyAccess: 'Get Early Access',
    },
    hero: {
      badge: 'Decentralized Compute Platform',
      h1Line1: 'Borderless',
      h1Line2: 'GPU Compute',
      subtitle:
        'Rent GPU capacity from verified providers across Saudi Arabia. Pay in SAR. Run LLM inference, image generation, and Docker workloads in seconds.',
      ctaRenter: 'Request Early Access',
      ctaProvider: 'Become a Founding Provider',
    },
    foundingRates: {
      title: 'Founding Provider Rates',
      subtitle: 'Early providers lock in preferred rates. You keep 75% of every job.',
      colGpu: 'GPU Model',
      colVram: 'VRAM',
      colSar: 'SAR / hr',
      colStatus: 'Status',
      available: 'Available',
      comingSoon: 'Coming Soon',
    },
    twoPaths: {
      title: 'Choose Your Path',
      playground: {
        title: 'Playground',
        desc: 'Instant access, no setup required. Run LLM inference or image generation directly in the browser. Great for experimenting and prototyping.',
        tags: ['Instant', 'No Setup', 'Pay-as-you-go', 'Web UI'],
        cta: 'Open Playground →',
      },
      customJobs: {
        title: 'Custom Jobs',
        desc: 'Submit Docker containers or use pre-built templates. Full control over environment, dependencies, and resource allocation.',
        tags: ['Docker', 'Full Control', 'Custom Images', 'GPU Templates'],
        cta: 'Get API Access →',
      },
    },
    capabilities: {
      title: 'What You Can Run',
      subtitle: 'Every workload runs in GPU-isolated containers with HMAC-signed task specs.',
      items: [
        {
          title: 'LLM Inference',
          desc: 'Run open-source LLMs via vLLM or Ollama with OpenAI-compatible endpoints.',
        },
        {
          title: 'Image Generation',
          desc: 'Stable Diffusion, SDXL, ControlNet — GPU-accelerated image synthesis at scale.',
        },
        {
          title: 'Docker Workloads',
          desc: 'Bring your own container. Any CUDA workload runs in isolated GPU sandboxes.',
        },
        {
          title: 'Model Fine-tuning',
          desc: 'LoRA / QLoRA fine-tuning pipelines on demand. Pay only for GPU time used.',
        },
        {
          title: 'Batch Processing',
          desc: 'Queue hundreds of jobs and let DC1 dispatch them across the provider fleet.',
        },
        {
          title: 'AI Agents',
          desc: 'Run agentic workflows, LangChain pipelines, and multi-turn inference loops.',
        },
      ],
    },
    providerSteps: {
      title: 'Start Earning in 4 Steps',
      subtitle: 'Set up once, earn continuously. The daemon handles everything automatically.',
      steps: [
        { step: '01', label: 'Register', desc: 'Create a provider account and get your API key in seconds.' },
        { step: '02', label: 'Run Command', desc: 'One-line install script sets up the DC1 daemon on your machine.' },
        { step: '03', label: 'GPU Detected', desc: 'Daemon auto-detects your NVIDIA GPU specs and reports them.' },
        { step: '04', label: 'Start Earning', desc: 'Jobs are dispatched automatically. Earnings accrue in SAR.' },
      ],
      cta: 'Become a Founding Provider',
    },
    apiExample: {
      title: 'Simple API, Full Control',
      subtitle: 'Submit jobs with a single POST request. No SDKs required — just curl or your preferred HTTP client.',
      footer: 'Cost deducted from your SAR balance. View all endpoints in the',
      apiRef: 'API Reference',
    },
    features: {
      title: 'Built for Production',
      items: [
        {
          title: 'Saudi-Native SAR Payments',
          desc: 'Pay and earn in Saudi Riyals. Powered by Moyasar with mada, Visa, and Apple Pay support.',
        },
        {
          title: 'GPU-Isolated Containers',
          desc: 'Every job runs in a locked-down Docker container with no network access and CUDA passthrough.',
        },
        {
          title: 'Real-Time Monitoring',
          desc: 'Live GPU utilization charts, VRAM tracking, temperature graphs, and daemon heartbeats.',
        },
        {
          title: 'HMAC-Secured Jobs',
          desc: 'Task specs are signed and verified end-to-end. No unsigned workloads ever execute on hardware.',
        },
      ],
    },
    cta: {
      badge: 'Open for Founding Partners',
      title: 'Ready to Power\nGPU Compute in Saudi Arabia?',
      subtitle: 'Join DC1 as a founding provider or renter. Shape the first decentralized GPU marketplace built for the Kingdom.',
      ctaProvider: 'Become a Founding Provider',
      ctaRenter: 'Request Early Access',
    },
    footer: {
      tagline: 'Borderless GPU Compute.',
      platform: 'Decentralized Compute Platform',
      infrastructure: 'Infrastructure',
      developers: 'Developers',
      legal: 'Legal',
      providers: 'Providers',
      pricing: 'Pricing',
      status: 'Status',
      apiDocs: 'API Docs',
      providerGuide: 'Provider Guide',
      renterGuide: 'Renter Guide',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      acceptableUse: 'Acceptable Use',
    },
    common: {
      online: 'Online',
      offline: 'Offline',
      loading: 'Loading...',
      error: 'Error',
      pending: 'Pending',
      running: 'Running',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
      balance: 'Balance',
      earnings: 'Earnings',
      jobs: 'Jobs',
      settings: 'Settings',
      logout: 'Logout',
      dashboard: 'Dashboard',
      marketplace: 'Marketplace',
      billing: 'Billing',
      analytics: 'Analytics',
      playground: 'Playground',
      templates: 'Templates',
      topUp: 'Top Up',
      addFunds: 'Add Funds',
      withdraw: 'Withdraw',
    },
    jobStatus: {
      pending: 'Pending',
      assigned: 'Assigned',
      pulling: 'Pulling',
      running: 'Running',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
    },
  },

  ar: {
    nav: {
      compute: 'الحوسبة',
      supply: 'العرض',
      docs: 'التوثيق',
      consoleLogin: 'تسجيل الدخول',
      getEarlyAccess: 'احصل على وصول مبكر',
    },
    hero: {
      badge: 'منصة الحوسبة اللامركزية',
      h1Line1: 'حوسبة',
      h1Line2: 'GPU بلا حدود',
      subtitle:
        'استأجر طاقة GPU من مزودين معتمدين في المملكة العربية السعودية. ادفع بالريال. شغّل نماذج الذكاء الاصطناعي وتوليد الصور وأعباء Docker في ثوانٍ.',
      ctaRenter: 'طلب الوصول المبكر',
      ctaProvider: 'كن مزوداً مؤسساً',
    },
    foundingRates: {
      title: 'أسعار المزودين المؤسسين',
      subtitle: 'يحصل المزودون الأوائل على أسعار مفضلة. تحتفظ بـ 75٪ من كل مهمة.',
      colGpu: 'طراز GPU',
      colVram: 'ذاكرة VRAM',
      colSar: 'ريال / ساعة',
      colStatus: 'الحالة',
      available: 'متاح',
      comingSoon: 'قريباً',
    },
    twoPaths: {
      title: 'اختر مسارك',
      playground: {
        title: 'منطقة التجربة',
        desc: 'وصول فوري بدون إعداد. شغّل نماذج اللغة أو توليد الصور مباشرة في المتصفح. مثالي للتجريب والنماذج الأولية.',
        tags: ['فوري', 'بدون إعداد', 'ادفع حسب الاستخدام', 'واجهة ويب'],
        cta: 'افتح منطقة التجربة ←',
      },
      customJobs: {
        title: 'مهام مخصصة',
        desc: 'أرسل حاويات Docker أو استخدم قوالب جاهزة. تحكم كامل في البيئة والتبعيات وتخصيص الموارد.',
        tags: ['Docker', 'تحكم كامل', 'صور مخصصة', 'قوالب GPU'],
        cta: 'احصل على وصول API ←',
      },
    },
    capabilities: {
      title: 'ما يمكنك تشغيله',
      subtitle: 'تعمل كل أعباء العمل في حاويات معزولة GPU بمواصفات مهام موقّعة بـ HMAC.',
      items: [
        {
          title: 'استنتاج النماذج اللغوية',
          desc: 'شغّل النماذج اللغوية مفتوحة المصدر عبر vLLM أو Ollama بنقاط نهاية متوافقة مع OpenAI.',
        },
        {
          title: 'توليد الصور',
          desc: 'Stable Diffusion وSDXL وControlNet — تركيب صور مسرَّع بـ GPU على نطاق واسع.',
        },
        {
          title: 'أعباء Docker',
          desc: 'أحضر حاويتك الخاصة. تعمل أي أعباء CUDA في بيئات GPU معزولة.',
        },
        {
          title: 'ضبط النماذج',
          desc: 'خطوط أنابيب LoRA / QLoRA عند الطلب. ادفع فقط مقابل وقت GPU المستخدم.',
        },
        {
          title: 'المعالجة الدُّفعية',
          desc: 'أدرج مئات المهام ودع DC1 يوزعها على أسطول المزودين.',
        },
        {
          title: 'وكلاء الذكاء الاصطناعي',
          desc: 'شغّل سير عمل الوكلاء وخطوط LangChain وحلقات الاستنتاج متعددة الأدوار.',
        },
      ],
    },
    providerSteps: {
      title: 'ابدأ الكسب في 4 خطوات',
      subtitle: 'اضبط مرة واحدة، اكسب باستمرار. البرنامج يتولى كل شيء تلقائياً.',
      steps: [
        { step: '٠١', label: 'التسجيل', desc: 'أنشئ حساب مزود واحصل على مفتاح API في ثوانٍ.' },
        { step: '٠٢', label: 'تشغيل الأمر', desc: 'سكريبت تثبيت بسطر واحد يضبط برنامج DC1 على جهازك.' },
        { step: '٠٣', label: 'اكتشاف GPU', desc: 'يكتشف البرنامج مواصفات NVIDIA GPU الخاصة بك ويرسلها تلقائياً.' },
        { step: '٠٤', label: 'ابدأ الكسب', desc: 'تُوزَّع المهام تلقائياً. تتراكم الأرباح بالريال السعودي.' },
      ],
      cta: 'كن مزوداً مؤسساً',
    },
    apiExample: {
      title: 'API بسيط، تحكم كامل',
      subtitle: 'أرسل المهام بطلب POST واحد. لا حاجة لـ SDK — فقط curl أو عميل HTTP المفضل لديك.',
      footer: 'تُخصم التكلفة من رصيد الريال لديك. اطلع على جميع نقاط النهاية في',
      apiRef: 'مرجع API',
    },
    features: {
      title: 'مبنية للإنتاج',
      items: [
        {
          title: 'مدفوعات ريال سعودي أصيلة',
          desc: 'ادفع واكسب بالريال السعودي. مدعوم من Moyasar مع مدى وVisa وApple Pay.',
        },
        {
          title: 'حاويات معزولة GPU',
          desc: 'كل مهمة تعمل في حاوية Docker مقفلة بدون وصول شبكي مع تمرير CUDA.',
        },
        {
          title: 'مراقبة في الوقت الفعلي',
          desc: 'رسوم بيانية حية لاستخدام GPU وتتبع VRAM وبيانات درجة الحرارة ونبضات البرنامج.',
        },
        {
          title: 'مهام مؤمّنة بـ HMAC',
          desc: 'مواصفات المهام موقّعة ومتحققة من طرف إلى طرف. لا تُنفَّذ أي أعباء غير موقّعة على الأجهزة.',
        },
      ],
    },
    cta: {
      badge: 'مفتوح للشركاء المؤسسين',
      title: 'هل أنت مستعد لتشغيل\nحوسبة GPU في المملكة العربية السعودية؟',
      subtitle: 'انضم إلى DC1 كمزود أو مستأجر مؤسس. شكّل أول سوق GPU لامركزي مبني للمملكة.',
      ctaProvider: 'كن مزوداً مؤسساً',
      ctaRenter: 'طلب الوصول المبكر',
    },
    footer: {
      tagline: 'حوسبة GPU بلا حدود.',
      platform: 'منصة الحوسبة اللامركزية',
      infrastructure: 'البنية التحتية',
      developers: 'المطورون',
      legal: 'القانونية',
      providers: 'المزودون',
      pricing: 'الأسعار',
      status: 'الحالة',
      apiDocs: 'توثيق API',
      providerGuide: 'دليل المزود',
      renterGuide: 'دليل المستأجر',
      terms: 'شروط الخدمة',
      privacy: 'سياسة الخصوصية',
      acceptableUse: 'سياسة الاستخدام المقبول',
    },
    common: {
      online: 'متصل',
      offline: 'غير متصل',
      loading: 'جارٍ التحميل...',
      error: 'خطأ',
      pending: 'معلق',
      running: 'جارٍ التشغيل',
      completed: 'مكتمل',
      failed: 'فشل',
      cancelled: 'ملغى',
      balance: 'الرصيد',
      earnings: 'الأرباح',
      jobs: 'المهام',
      settings: 'الإعدادات',
      logout: 'تسجيل الخروج',
      dashboard: 'لوحة التحكم',
      marketplace: 'السوق',
      billing: 'الفوترة',
      analytics: 'التحليلات',
      playground: 'منطقة التجربة',
      templates: 'القوالب',
      topUp: 'شحن الرصيد',
      addFunds: 'إضافة أموال',
      withdraw: 'سحب',
    },
    jobStatus: {
      pending: 'معلق',
      assigned: 'مُسنَد',
      pulling: 'جارٍ التنزيل',
      running: 'جارٍ التشغيل',
      completed: 'مكتمل',
      failed: 'فشل',
      cancelled: 'ملغى',
    },
  },
} as const

export type Translations = typeof translations.en

// ─── Context ──────────────────────────────────────────────────────────────────

interface LanguageContextValue {
  lang: Lang
  t: Translations
  setLang: (lang: Lang) => void
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  t: translations.en,
  setLang: () => {},
  isRTL: false,
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem('dc1_lang') as Lang | null
    if (stored === 'ar' || stored === 'en') {
      setLangState(stored)
    }
  }, [])

  useEffect(() => {
    const isRTL = lang === 'ar'
    document.documentElement.lang = lang
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    document.body.style.fontFamily = isRTL
      ? "'IBM Plex Sans Arabic', 'Tajawal', sans-serif"
      : "'Inter', sans-serif"
  }, [lang])

  function setLang(newLang: Lang) {
    setLangState(newLang)
    localStorage.setItem('dc1_lang', newLang)
  }

  const isRTL = lang === 'ar'
  const t = translations[lang] as unknown as Translations

  return (
    <LanguageContext.Provider value={{ lang, t, setLang, isRTL }}>
      {children}
    </LanguageContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLanguage() {
  return useContext(LanguageContext)
}

/**
 * Translate a job status string using the current language.
 * Usage: const tStatus = useJobStatusLabel(); tStatus('running') → 'جارٍ التشغيل' (ar)
 */
export function useJobStatusLabel() {
  const { t } = useLanguage()
  return (status: string): string => {
    const key = status as keyof typeof t.jobStatus
    return t.jobStatus[key] ?? status
  }
}

// ─── Language Toggle Button ───────────────────────────────────────────────────

export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLanguage()
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-dc1-border text-xs font-semibold text-dc1-text-secondary hover:border-dc1-amber hover:text-dc1-amber transition-colors ${className}`}
      aria-label={lang === 'en' ? 'Switch to Arabic' : 'Switch to English'}
    >
      {lang === 'en' ? (
        <>
          <span className="font-arabic">ع</span>
          <span>عربي</span>
        </>
      ) : (
        <>
          <span>EN</span>
        </>
      )}
    </button>
  )
}
