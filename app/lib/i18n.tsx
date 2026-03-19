'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type Language = 'en' | 'ar'

export interface I18nContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  dir: 'ltr' | 'rtl'
  isRTL: boolean
}

// ── Translation dictionary ────────────────────────────────────────────────────
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav
    'nav.dashboard': 'Dashboard',
    'nav.marketplace': 'Marketplace',
    'nav.playground': 'Playground',
    'nav.jobs': 'My Jobs',
    'nav.billing': 'Billing',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Settings',
    'nav.templates': 'Templates',

    // Auth
    'auth.sign_in': 'Sign In',
    'auth.sign_out': 'Sign Out',
    'auth.api_key_placeholder': 'Enter your API key',
    'auth.welcome_back': 'Welcome Back',
    'auth.no_account': "Don't have an account?",
    'auth.register_here': 'Register here',

    // Dashboard
    'dashboard.title': 'Renter Dashboard',
    'dashboard.welcome': 'Welcome back',
    'dashboard.balance': 'Account Balance',
    'dashboard.total_spent': 'Total Spent',
    'dashboard.jobs_run': 'Jobs Run',
    'dashboard.online_gpus': 'Online GPUs',

    // Marketplace
    'marketplace.title': 'GPU Marketplace',
    'marketplace.filter_placeholder': 'Filter by GPU model...',
    'marketplace.no_gpus': 'No GPUs are currently online.',
    'marketplace.no_match': 'No GPUs match your filter.',
    'marketplace.use_gpu': 'Use This GPU',
    'marketplace.pricing': 'Pricing (SAR/hr)',
    'marketplace.llm_inference': 'LLM Inference',
    'marketplace.image_gen': 'Image Generation',
    'marketplace.training': 'Training',
    'marketplace.vram': 'VRAM',
    'marketplace.location': 'Location',
    'marketplace.reliability': 'Reliability',
    'marketplace.last_seen': 'Last seen',
    'marketplace.cached_models': 'Cached Models (instant start)',
    'marketplace.online': 'Online',
    'marketplace.offline': 'Offline',

    // Templates
    'templates.title': 'Job Templates',
    'templates.subtitle': 'Pre-built scripts to get started quickly',
    'templates.use_template': 'Use Template',
    'templates.llm_chat': 'LLM Chat Inference',
    'templates.llm_chat_desc': 'Run a single-turn chat completion with any supported model',
    'templates.image_gen': 'Image Generation',
    'templates.image_gen_desc': 'Generate images with Stable Diffusion or compatible models',
    'templates.batch_embed': 'Batch Embeddings',
    'templates.batch_embed_desc': 'Embed a list of texts using a sentence-transformer model',
    'templates.finetune': 'Fine-tune LLM',
    'templates.finetune_desc': 'Run a LoRA fine-tuning job on a base model with your dataset',
    'templates.estimated_cost': 'Estimated cost',
    'templates.per_run': 'per run',
    'templates.category_inference': 'Inference',
    'templates.category_generation': 'Generation',
    'templates.category_training': 'Training',
    'templates.category_embedding': 'Embedding',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.retry': 'Retry',
    'common.sar': 'SAR',
    'common.sar_hr': 'SAR/hr',
    'common.online': 'Online',
    'common.offline': 'Offline',
    'common.view_all': 'View All',
    'common.quick_actions': 'Quick Actions',
    'common.recent_jobs': 'Recent Jobs',
    'common.available_gpus': 'Available GPUs',
    'common.sort_reputation': 'Sort: Reputation',
    'common.sort_vram': 'Sort: VRAM ↓',
    'common.sort_price': 'Sort: Price ↑',
  },

  ar: {
    // Nav
    'nav.dashboard': 'لوحة التحكم',
    'nav.marketplace': 'السوق',
    'nav.playground': 'الملعب',
    'nav.jobs': 'وظائفي',
    'nav.billing': 'الفواتير',
    'nav.analytics': 'التحليلات',
    'nav.settings': 'الإعدادات',
    'nav.templates': 'القوالب',

    // Auth
    'auth.sign_in': 'تسجيل الدخول',
    'auth.sign_out': 'تسجيل الخروج',
    'auth.api_key_placeholder': 'أدخل مفتاح API الخاص بك',
    'auth.welcome_back': 'مرحباً بعودتك',
    'auth.no_account': 'ليس لديك حساب؟',
    'auth.register_here': 'سجل هنا',

    // Dashboard
    'dashboard.title': 'لوحة تحكم المستأجر',
    'dashboard.welcome': 'مرحباً بعودتك',
    'dashboard.balance': 'رصيد الحساب',
    'dashboard.total_spent': 'إجمالي الإنفاق',
    'dashboard.jobs_run': 'الوظائف المُنفَّذة',
    'dashboard.online_gpus': 'وحدات GPU المتصلة',

    // Marketplace
    'marketplace.title': 'سوق وحدات GPU',
    'marketplace.filter_placeholder': 'تصفية حسب طراز GPU...',
    'marketplace.no_gpus': 'لا توجد وحدات GPU متصلة حالياً.',
    'marketplace.no_match': 'لا توجد وحدات GPU تطابق الفلتر.',
    'marketplace.use_gpu': 'استخدم هذه الوحدة',
    'marketplace.pricing': 'الأسعار (ريال/ساعة)',
    'marketplace.llm_inference': 'استدلال نموذج اللغة',
    'marketplace.image_gen': 'توليد الصور',
    'marketplace.training': 'التدريب',
    'marketplace.vram': 'ذاكرة الفيديو',
    'marketplace.location': 'الموقع',
    'marketplace.reliability': 'الموثوقية',
    'marketplace.last_seen': 'آخر ظهور',
    'marketplace.cached_models': 'النماذج المخزنة (بداية فورية)',
    'marketplace.online': 'متصل',
    'marketplace.offline': 'غير متصل',

    // Templates
    'templates.title': 'قوالب الوظائف',
    'templates.subtitle': 'نصوص جاهزة للبدء بسرعة',
    'templates.use_template': 'استخدم القالب',
    'templates.llm_chat': 'استدلال محادثة LLM',
    'templates.llm_chat_desc': 'تشغيل إكمال محادثة أحادية الدور مع أي نموذج مدعوم',
    'templates.image_gen': 'توليد الصور',
    'templates.image_gen_desc': 'توليد صور باستخدام Stable Diffusion أو نماذج متوافقة',
    'templates.batch_embed': 'تضمين دفعي',
    'templates.batch_embed_desc': 'تضمين قائمة من النصوص باستخدام نموذج sentence-transformer',
    'templates.finetune': 'ضبط دقيق لنموذج LLM',
    'templates.finetune_desc': 'تشغيل وظيفة ضبط دقيق LoRA على نموذج أساسي مع مجموعة بياناتك',
    'templates.estimated_cost': 'التكلفة التقديرية',
    'templates.per_run': 'لكل تشغيل',
    'templates.category_inference': 'استدلال',
    'templates.category_generation': 'توليد',
    'templates.category_training': 'تدريب',
    'templates.category_embedding': 'تضمين',

    // Common
    'common.loading': 'جارٍ التحميل...',
    'common.error': 'حدث خطأ',
    'common.retry': 'إعادة المحاولة',
    'common.sar': 'ريال',
    'common.sar_hr': 'ريال/ساعة',
    'common.online': 'متصل',
    'common.offline': 'غير متصل',
    'common.view_all': 'عرض الكل',
    'common.quick_actions': 'إجراءات سريعة',
    'common.recent_jobs': 'الوظائف الأخيرة',
    'common.available_gpus': 'وحدات GPU المتاحة',
    'common.sort_reputation': 'ترتيب: السمعة',
    'common.sort_vram': 'ترتيب: الذاكرة ↓',
    'common.sort_price': 'ترتيب: السعر ↑',
  },
}

// ── Context ───────────────────────────────────────────────────────────────────
const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
  dir: 'ltr',
  isRTL: false,
})

// ── Provider ──────────────────────────────────────────────────────────────────
export function LanguageWrapper({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  // Persist language choice; restore on mount
  useEffect(() => {
    const stored = localStorage.getItem('dc1_language') as Language | null
    if (stored === 'ar' || stored === 'en') {
      setLanguageState(stored)
    }
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('dc1_language', lang)
  }, [])

  // Apply dir attribute and font to <html> and <body> when language changes
  useEffect(() => {
    const dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.setAttribute('dir', dir)
    document.documentElement.setAttribute('lang', language)
    if (language === 'ar') {
      document.documentElement.classList.add('font-tajawal')
      document.documentElement.classList.remove('font-inter')
      document.body.classList.add('font-tajawal')
      document.body.classList.remove('font-inter')
    } else {
      document.documentElement.classList.add('font-inter')
      document.documentElement.classList.remove('font-tajawal')
      document.body.classList.add('font-inter')
      document.body.classList.remove('font-tajawal')
    }
  }, [language])

  const t = useCallback(
    (key: string): string => {
      return translations[language][key] ?? translations['en'][key] ?? key
    },
    [language]
  )

  const value: I18nContextValue = {
    language,
    setLanguage,
    t,
    dir: language === 'ar' ? 'rtl' : 'ltr',
    isRTL: language === 'ar',
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useLanguage(): I18nContextValue {
  return useContext(I18nContext)
}

// ── Language Toggle Button ────────────────────────────────────────────────────
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage()

  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-dc1-border text-dc1-text-secondary hover:text-dc1-text-primary hover:border-dc1-border-light transition-colors ${className}`}
      aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
      title={language === 'en' ? 'عربي' : 'English'}
    >
      <span className="text-base leading-none">{language === 'en' ? '🇸🇦' : '🇬🇧'}</span>
      <span>{language === 'en' ? 'العربية' : 'English'}</span>
    </button>
  )
}
