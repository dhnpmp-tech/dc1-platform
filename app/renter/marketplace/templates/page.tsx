'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { useLanguage, type Language } from '../../../lib/i18n'

const UI_COPY = {
  en: {
    title: 'GPU Template Catalog',
    subtitle: 'Ready-to-deploy templates for LLMs, fine-tuning, embeddings, and image generation.',
    back: 'Back to Marketplace',
    deployTemplate: 'Deploy Template',
    deployNow: 'Deploy Now',
    submitting: 'Submitting...',
    close: 'Close',
    cancel: 'Cancel',
    reviewAndDeploy: 'Review & Deploy',
    configure: 'Configure',
    review: 'Review',
    status: 'Status',
    duration: 'Duration',
    durationHelp: 'Billing is usage-based and starts when execution begins.',
    noFilters: 'No templates match your filters.',
    clearFilters: 'Clear filters',
    troubleshooting: 'Troubleshooting',
    templatePreview: 'Template Preview',
    estimatedCost: 'Estimated Cost',
    minVram: 'Min VRAM',
    dcpPrice: 'DCP Price',
    vsHyperscalers: 'vs hyperscalers',
    save: 'Save',
    successSubmitted: 'Deployment submitted!',
    successRedirect: 'Redirecting to live status...',
    viewLiveStatus: 'View Live Status',
    viewJobs: 'View Jobs',
    noProvider: 'No providers available right now.',
    noProviderAction: 'Join Waitlist',
    insufficientBalance: 'Insufficient balance. Add credits to continue.',
    addCredits: 'Add Credits',
    authRequired: 'Session expired. Please sign in again.',
    rateLimited: 'Too many deployment attempts. Please wait a minute and retry.',
    serverError: 'The deployment service is temporarily unavailable.',
    networkError: 'Network error. Please check your connection and retry.',
    genericError: 'Failed to submit deployment. Please try again.',
    templateCount: 'templates',
    arabicCapable: 'Arabic-capable',
    browseArabic: 'Browse Arabic AI',
    filtersLoading: 'Loading...',
    filtersSummary: (visible: number, total: number) => `${visible} of ${total} templates`,
    languageBadge: 'EN/AR Ready',
  },
  ar: {
    title: 'كتالوج قوالب GPU',
    subtitle: 'قوالب جاهزة للنشر لنماذج اللغة، الضبط الدقيق، التضمين، وتوليد الصور.',
    back: 'العودة إلى السوق',
    deployTemplate: 'نشر القالب',
    deployNow: 'انشر الآن',
    submitting: 'جارٍ الإرسال...',
    close: 'إغلاق',
    cancel: 'إلغاء',
    reviewAndDeploy: 'مراجعة ثم نشر',
    configure: 'الإعداد',
    review: 'المراجعة',
    status: 'الحالة',
    duration: 'المدة',
    durationHelp: 'تبدأ الفوترة حسب الاستخدام عند بدء التنفيذ.',
    noFilters: 'لا توجد قوالب مطابقة للفلاتر الحالية.',
    clearFilters: 'مسح الفلاتر',
    troubleshooting: 'استكشاف الأخطاء',
    templatePreview: 'معاينة القالب',
    estimatedCost: 'التكلفة التقديرية',
    minVram: 'الحد الأدنى للذاكرة',
    dcpPrice: 'سعر DCP',
    vsHyperscalers: 'مقارنة بالسحابات الكبرى',
    save: 'توفير',
    successSubmitted: 'تم إرسال النشر بنجاح!',
    successRedirect: 'جارٍ التحويل إلى حالة المهمة...',
    viewLiveStatus: 'عرض الحالة المباشرة',
    viewJobs: 'عرض المهام',
    noProvider: 'لا يوجد مزود متاح حالياً.',
    noProviderAction: 'الانضمام لقائمة الانتظار',
    insufficientBalance: 'الرصيد غير كافٍ. أضف رصيداً للمتابعة.',
    addCredits: 'إضافة رصيد',
    authRequired: 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.',
    rateLimited: 'محاولات نشر كثيرة جداً. انتظر دقيقة ثم أعد المحاولة.',
    serverError: 'خدمة النشر غير متاحة مؤقتاً.',
    networkError: 'خطأ في الشبكة. تحقق من الاتصال وأعد المحاولة.',
    genericError: 'تعذر إرسال النشر. حاول مرة أخرى.',
    templateCount: 'قالب',
    arabicCapable: 'يدعم العربية',
    browseArabic: 'تصفح قوالب العربية',
    filtersLoading: 'جارٍ التحميل...',
    filtersSummary: (visible: number, total: number) => `${visible} من ${total} قالب`,
    languageBadge: 'جاهز EN/AR',
  },
} as const

type CopyPack = (typeof UI_COPY)[Language]

function getCategoryLabel(id: TemplateCategory | 'all', language: Language): string {
  const labels: Record<TemplateCategory | 'all', { en: string; ar: string }> = {
    all: { en: 'All Templates', ar: 'كل القوالب' },
    'Arabic AI': { en: 'Arabic AI', ar: 'ذكاء اصطناعي عربي' },
    LLM: { en: 'LLM', ar: 'نماذج لغوية' },
    Training: { en: 'Training', ar: 'تدريب' },
    'Dev Tools': { en: 'Dev Tools', ar: 'أدوات المطور' },
    Image: { en: 'Image Gen', ar: 'توليد الصور' },
  }
  return labels[id][language]
}

// ── Nav icons ─────────────────────────────────────────────────────────────────
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 11l4-4m0 0l4 4m-4-4V5" />
  </svg>
)
const MarketplaceIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
)
const ModelsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)
const JobsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)
const BillingIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m4 0h1M9 19h6a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)
const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const PlaygroundIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)
const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

// Hyperscaler reference baseline (SAR/hr) used when template-specific benchmark data is not available.
const HYPERSCALER_SAR_PER_HR_FALLBACK = 14.0

interface Template {
  id: string
  name: string
  description: string
  icon?: string
  category: TemplateCategory
  min_vram_gb: number
  estimated_price_sar_per_hour: number
  hyperscaler_price_sar_per_hour?: number
  tags: string[]
  difficulty: 'easy' | 'medium' | 'advanced'
  is_arabic: boolean
  sort_order: number
}

type TemplateCategory = 'Arabic AI' | 'LLM' | 'Training' | 'Dev Tools' | 'Image'

const CATEGORIES: { id: TemplateCategory | 'all'; label: string; emoji: string }[] = [
  { id: 'all',       label: 'All Templates', emoji: '🗂️' },
  { id: 'Arabic AI', label: 'Arabic AI',     emoji: '🌙' },
  { id: 'LLM',       label: 'LLM',           emoji: '🤖' },
  { id: 'Training',  label: 'Training',      emoji: '🧠' },
  { id: 'Dev Tools', label: 'Dev Tools',     emoji: '🛠️' },
  { id: 'Image',     label: 'Image Gen',     emoji: '🎨' },
]

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy start',
  medium: 'Intermediate',
  advanced: 'Advanced',
}

const DIFFICULTY_CLASS: Record<string, string> = {
  easy: 'bg-status-success/10 text-status-success border-status-success/20',
  medium: 'bg-dc1-amber/10 text-dc1-amber border-dc1-amber/20',
  advanced: 'bg-status-error/10 text-status-error border-status-error/20',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function deriveCategory(id: string, tags: string[]): TemplateCategory {
  const lower = id.toLowerCase()
  const tagSet = tags.map(t => t.toLowerCase())
  if (lower.includes('arabic') || lower.includes('allam') || lower.includes('jais') ||
      tagSet.includes('arabic')) return 'Arabic AI'
  if (lower.includes('sdxl') || lower.includes('stable-diff') || tagSet.includes('image')) return 'Image'
  if (lower.includes('lora') || lower.includes('qlora') || lower.includes('finetune') ||
      tagSet.includes('training')) return 'Training'
  if (lower.includes('jupyter') || lower.includes('python-scientific') ||
      tagSet.includes('notebook')) return 'Dev Tools'
  return 'LLM'
}

function estimateHyperscalerPriceSarHr(template: Pick<Template, 'min_vram_gb' | 'category' | 'is_arabic'>): number {
  if (template.is_arabic) return 25
  if (template.category === 'Training') return template.min_vram_gb >= 24 ? 60 : 35
  if (template.category === 'Image') return 28
  if (template.min_vram_gb >= 80) return 150
  if (template.min_vram_gb >= 40) return 110
  if (template.min_vram_gb >= 24) return 40
  return HYPERSCALER_SAR_PER_HR_FALLBACK
}

function getSavingsPct(t: Template): number | null {
  const ref = t.hyperscaler_price_sar_per_hour ?? HYPERSCALER_SAR_PER_HR_FALLBACK
  if (t.estimated_price_sar_per_hour >= ref) return null
  return Math.round((1 - t.estimated_price_sar_per_hour / ref) * 100)
}

// ── Deploy Modal (inline — mirrors DCP-857 modal pattern) ─────────────────────
interface DeployModalState {
  template: Template | null
  step: 'configure' | 'review' | 'status'
  durationMinutes: number
  loading: boolean
  error: string
  troubleshoot: string[]
  jobId: string | null
}

function resolveDeployError(status: number, copy: CopyPack): { message: string; troubleshooting: string[] } {
  if (status === 503) {
    return {
      message: copy.noProvider,
      troubleshooting: ['Check back in 1-2 minutes.', 'Try a lower VRAM template.', 'Use the waitlist link for notification.'],
    }
  }
  if (status === 402) {
    return {
      message: copy.insufficientBalance,
      troubleshooting: ['Top up your renter wallet.', 'Try a lower-cost template.', 'Reduce duration and retry.'],
    }
  }
  if (status === 401 || status === 403) {
    return {
      message: copy.authRequired,
      troubleshooting: ['Sign in again.', 'Regenerate renter API key if needed.', 'Retry deployment from this catalog.'],
    }
  }
  if (status === 429) {
    return {
      message: copy.rateLimited,
      troubleshooting: ['Wait 60 seconds before retrying.', 'Avoid repeated rapid deploy clicks.', 'If persistent, contact support with timestamp.'],
    }
  }
  if (status >= 500) {
    return {
      message: copy.serverError,
      troubleshooting: ['Retry in a minute.', 'Use another template category.', 'Open renter jobs page to verify platform status.'],
    }
  }
  return {
    message: copy.genericError,
    troubleshooting: ['Retry once.', 'Refresh the page if issue persists.', 'Collect browser console logs for support.'],
  }
}

function DeployModal({ state, copy, isRTL, onClose, onChange, onConfirm }: {
  state: DeployModalState
  copy: CopyPack
  isRTL: boolean
  onClose: () => void
  onChange: (patch: Partial<DeployModalState>) => void
  onConfirm: () => void
}) {
  const router = useRouter()
  const t = state.template!
  const savingsPct = getSavingsPct(t)
  const estCostSar = ((t.estimated_price_sar_per_hour * state.durationMinutes) / 60).toFixed(2)
  const stepIndex = state.step === 'configure' ? 1 : state.step === 'review' ? 2 : 3

  // Auto-redirect after successful submit
  if (state.step === 'status' && state.jobId && state.jobId !== 'submitted') {
    setTimeout(() => router.push(`/renter/jobs/${state.jobId}`), 1200)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tmpl-deploy-title"
    >
      <div className="card w-full max-w-xl p-6 space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{t.icon}</span>
              <h2 id="tmpl-deploy-title" className="text-lg font-bold text-dc1-text-primary">{t.name}</h2>
            </div>
            <p className="text-xs text-dc1-text-muted">{t.category} • {t.min_vram_gb} GB VRAM min</p>
          </div>
          <button onClick={onClose} className="text-dc1-text-muted hover:text-dc1-text-primary p-1" aria-label={copy.close}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className={`px-2 py-1 rounded border ${stepIndex >= 1 ? 'bg-dc1-amber/10 border-dc1-amber/30 text-dc1-amber' : 'border-dc1-border text-dc1-text-muted'}`}>1. {copy.configure}</span>
          <span className={`px-2 py-1 rounded border ${stepIndex >= 2 ? 'bg-dc1-amber/10 border-dc1-amber/30 text-dc1-amber' : 'border-dc1-border text-dc1-text-muted'}`}>2. {copy.review}</span>
          <span className={`px-2 py-1 rounded border ${stepIndex >= 3 ? 'bg-dc1-amber/10 border-dc1-amber/30 text-dc1-amber' : 'border-dc1-border text-dc1-text-muted'}`}>3. {copy.status}</span>
        </div>

        {/* Pricing */}
        <div className="bg-dc1-surface-l2 rounded-lg px-4 py-3 text-xs grid grid-cols-2 gap-3">
          <div>
            <p className="text-dc1-text-muted uppercase tracking-wide text-[9px]">{copy.dcpPrice}</p>
            <p className="font-bold text-dc1-amber text-base">{t.estimated_price_sar_per_hour.toFixed(0)} <span className="text-xs font-normal text-dc1-text-muted">SAR/hr</span></p>
          </div>
          {t.hyperscaler_price_sar_per_hour && (
            <div>
              <p className="text-dc1-text-muted uppercase tracking-wide text-[9px]">{copy.vsHyperscalers}</p>
              <p className="font-semibold text-dc1-text-secondary line-through text-sm">{t.hyperscaler_price_sar_per_hour} SAR/hr</p>
            </div>
          )}
        </div>

        {/* Savings badge */}
        {savingsPct !== null && savingsPct > 0 && (
          <div className="bg-status-success/5 border border-status-success/20 rounded-lg px-4 py-2.5 flex items-center justify-between text-sm">
            <span className="text-dc1-text-muted">{copy.vsHyperscalers}</span>
            <span className="text-status-success font-bold">{copy.save} {savingsPct}%</span>
          </div>
        )}

        {t.is_arabic && (
          <div className="bg-dc1-amber/5 border border-dc1-amber/20 rounded-lg px-4 py-2.5 text-xs text-dc1-amber font-medium">
            🌙 Arabic-capable — PDPL-compliant, in-kingdom processing
          </div>
        )}

        {state.step === 'configure' && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-dc1-text-primary">
              {copy.duration}
              <select
                value={state.durationMinutes}
                onChange={(e) => onChange({ durationMinutes: Number(e.target.value), error: '', troubleshoot: [] })}
                className="input mt-1 min-h-[44px] w-full"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
                <option value={120}>120 min</option>
              </select>
            </label>
            <p className="text-xs text-dc1-text-secondary">{copy.durationHelp}</p>
          </div>
        )}

        {state.step === 'review' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-dc1-border bg-dc1-surface-l1 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-dc1-text-muted">{copy.estimatedCost}</span>
                <span className="font-bold text-dc1-amber">{estCostSar} SAR</span>
              </div>
            </div>
            <div className="rounded-lg border border-dc1-border bg-dc1-surface-l1 p-3">
              <p className="text-xs text-dc1-text-muted mb-2">{copy.templatePreview}</p>
              <pre dir="ltr" className="text-[11px] text-dc1-text-secondary bg-dc1-surface-l2 rounded p-2 overflow-x-auto">{JSON.stringify({ template_id: t.id, duration_minutes: state.durationMinutes }, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Error states */}
        {state.error && (
          <div className="bg-status-error/10 border border-status-error/30 rounded-lg px-4 py-3 text-sm text-status-error">
            <p className="font-semibold mb-1">{state.error}</p>
            {state.troubleshoot.length > 0 && (
              <div className="text-xs text-dc1-text-secondary">
                <p className="mb-1">{copy.troubleshooting}</p>
                <ul className="list-disc ps-5 space-y-0.5">
                  {state.troubleshoot.map((hint) => <li key={hint}>{hint}</li>)}
                </ul>
              </div>
            )}
            {state.error === copy.noProvider && (
              <Link href={`/renter/waitlist?template=${encodeURIComponent(t.id)}`} className="inline-block mt-2 btn btn-outline btn-sm text-dc1-amber border-dc1-amber/40">{copy.noProviderAction}</Link>
            )}
            {state.error === copy.insufficientBalance && (
              <Link href="/renter/billing" className="inline-block mt-2 btn btn-outline btn-sm text-status-error border-status-error/40">{copy.addCredits}</Link>
            )}
          </div>
        )}

        {/* Success */}
        {state.step === 'status' && state.jobId && (
          <div className="bg-status-success/10 border border-status-success/30 rounded-lg px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-status-success font-semibold">
              <span className="animate-spin h-4 w-4 border-2 border-status-success border-t-transparent rounded-full" />
              {copy.successSubmitted} {copy.successRedirect}
            </div>
            {state.jobId !== 'submitted' && (
              <Link href={`/renter/jobs/${state.jobId}`} className="text-xs text-status-success underline">{copy.viewLiveStatus}</Link>
            )}
          </div>
        )}

        {state.step === 'configure' && (
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} disabled={state.loading} className="btn btn-secondary min-h-[44px] px-4">{copy.cancel}</button>
            <button onClick={() => onChange({ step: 'review' })} disabled={state.loading} className="btn btn-primary min-h-[44px] px-5">
              {copy.reviewAndDeploy}
            </button>
          </div>
        )}

        {state.step === 'review' && (
          <div className="flex gap-3 justify-end">
            <button onClick={() => onChange({ step: 'configure' })} disabled={state.loading} className="btn btn-secondary min-h-[44px] px-4">{copy.configure}</button>
            <button onClick={onConfirm} disabled={state.loading} className="btn btn-primary min-h-[44px] px-5 flex items-center gap-2">
              {state.loading && <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
              {state.loading ? copy.submitting : copy.deployNow}
            </button>
          </div>
        )}

        {state.step === 'status' && state.jobId && (
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="btn btn-secondary min-h-[44px] px-4">{copy.close}</button>
            {state.jobId !== 'submitted' ? (
              <Link href={`/renter/jobs/${state.jobId}`} className="btn btn-primary min-h-[44px] px-5">{copy.viewLiveStatus}</Link>
            ) : (
              <Link href="/renter/jobs" className="btn btn-primary min-h-[44px] px-5">{copy.viewJobs}</Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Template Card ─────────────────────────────────────────────────────────────
function TemplateCard({ template, copy, onDeploy }: { template: Template; copy: CopyPack; onDeploy: (t: Template) => void }) {
  const savingsPct = getSavingsPct(template)

  return (
    <article className={`bg-dc1-surface-l2 border rounded-xl p-5 flex flex-col gap-3 hover:shadow-amber transition-all duration-200 group ${
      template.is_arabic ? 'border-dc1-amber/30 hover:border-dc1-amber/60' : 'border-dc1-border hover:border-dc1-amber/30'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{template.icon || '🚀'}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-dc1-text-primary group-hover:text-dc1-amber transition-colors leading-tight">
            {template.name}
          </h3>
          <p className="text-[10px] text-dc1-text-muted mt-0.5">{template.category}</p>
        </div>
        {template.is_arabic && (
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-dc1-amber/10 text-dc1-amber border border-dc1-amber/20 font-medium">
            🌙 Arabic
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-dc1-text-secondary leading-relaxed line-clamp-2">{template.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${DIFFICULTY_CLASS[template.difficulty]}`}>
          {DIFFICULTY_LABEL[template.difficulty]}
        </span>
        {template.tags.slice(0, 2).map(tag => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-dc1-surface-l3 text-dc1-text-muted border border-dc1-border">
            {tag}
          </span>
        ))}
      </div>

      {/* Specs */}
      <div className="bg-dc1-surface-l1 rounded-lg px-3 py-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-dc1-text-muted uppercase tracking-wide text-[9px]">Min VRAM</p>
          <p className="font-semibold text-dc1-text-primary">{template.min_vram_gb} GB</p>
        </div>
        <div>
          <p className="text-dc1-text-muted uppercase tracking-wide text-[9px]">DCP Price</p>
          <p className="font-extrabold text-dc1-amber">{template.estimated_price_sar_per_hour} <span className="text-[9px] font-normal text-dc1-text-muted">SAR/hr</span></p>
        </div>
      </div>

      {/* Savings */}
      {savingsPct !== null && savingsPct > 0 && (
        <div className="bg-status-success/5 border border-status-success/20 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs">
          <span className="text-dc1-text-muted">vs hyperscalers</span>
          <span className="text-status-success font-bold">Save {savingsPct}%</span>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => onDeploy(template)}
        className="btn btn-primary w-full text-sm mt-auto min-h-[44px]"
      >
        {copy.deployTemplate}
      </button>
    </article>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-dc1-surface-l2 border border-dc1-border rounded-xl p-5 flex flex-col gap-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-8 h-8 bg-dc1-surface-l3 rounded" />
        <div className="flex-1 space-y-1">
          <div className="h-4 bg-dc1-surface-l3 rounded w-3/4" />
          <div className="h-3 bg-dc1-surface-l3 rounded w-1/3" />
        </div>
      </div>
      <div className="h-8 bg-dc1-surface-l3 rounded" />
      <div className="h-12 bg-dc1-surface-l3 rounded-lg" />
      <div className="h-9 bg-dc1-surface-l3 rounded-md" />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TemplateCatalogPage() {
  const router = useRouter()
  const { t, language, dir, isRTL } = useLanguage()
  const copy = UI_COPY[language]

  const [category, setCategory] = useState<TemplateCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [maxVram, setMaxVram] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'advanced'>('all')
  const [deploy, setDeploy] = useState<DeployModalState>({
    template: null,
    step: 'configure',
    durationMinutes: 60,
    loading: false,
    error: '',
    troubleshoot: [],
    jobId: null,
  })
  const [apiTemplates, setApiTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [templatesError, setTemplatesError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dc1/templates')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const list: Record<string, unknown>[] = Array.isArray(data?.templates) ? data.templates : []
        const mapped: Template[] = list.map(raw => {
          const tags = Array.isArray(raw.tags) ? (raw.tags as string[]) : []
          const rawId = String(raw.id ?? '')
          const lowerId = rawId.toLowerCase()
          const isArabic = tags.some(tag => tag.toLowerCase().includes('arabic')) ||
            lowerId.includes('arabic') || lowerId.includes('allam') || lowerId.includes('jais')
          const category = deriveCategory(rawId, tags)
          const minVram = Number(raw.min_vram_gb ?? 8)
          const estimatedPrice = Number(raw.estimated_price_sar_per_hour ?? 0)
          return {
            id: rawId,
            name: String(raw.name ?? ''),
            description: String(raw.description ?? ''),
            icon: String(raw.icon ?? ''),
            category,
            min_vram_gb: minVram,
            estimated_price_sar_per_hour: estimatedPrice,
            hyperscaler_price_sar_per_hour: estimateHyperscalerPriceSarHr({
              min_vram_gb: minVram,
              category,
              is_arabic: isArabic,
            }),
            tags,
            difficulty: (['easy', 'medium', 'advanced'].includes(String(raw.difficulty ?? ''))
              ? String(raw.difficulty) : 'easy') as Template['difficulty'],
            is_arabic: isArabic,
            sort_order: Number(raw.sort_order ?? 99),
          }
        })
        setApiTemplates(mapped)
        setTemplatesError(mapped.length > 0 ? null : 'Template catalog is currently empty.')
      })
      .catch(() => {
        setTemplatesError('Failed to load template catalog from API.')
      })
      .finally(() => setLoadingTemplates(false))
  }, [])

  const activeTemplates = apiTemplates

  const navItems = [
    { label: t('nav.dashboard'), href: '/renter', icon: <HomeIcon /> },
    { label: t('nav.marketplace'), href: '/renter/marketplace', icon: <MarketplaceIcon /> },
    { label: 'Models', href: '/renter/models', icon: <ModelsIcon /> },
    { label: t('nav.playground'), href: '/renter/playground', icon: <PlaygroundIcon /> },
    { label: t('nav.jobs'), href: '/renter/jobs', icon: <JobsIcon /> },
    { label: t('nav.billing'), href: '/renter/billing', icon: <BillingIcon /> },
    { label: t('nav.analytics'), href: '/renter/analytics', icon: <ChartIcon /> },
    { label: t('nav.settings'), href: '/renter/settings', icon: <GearIcon /> },
  ]

  const filtered = useMemo(() => {
    return activeTemplates.filter(tmpl => {
      if (category !== 'all' && tmpl.category !== category) return false
      if (difficultyFilter !== 'all' && tmpl.difficulty !== difficultyFilter) return false
      if (maxVram !== '') {
        const v = parseInt(maxVram, 10)
        if (!isNaN(v) && tmpl.min_vram_gb > v) return false
      }
      if (maxPrice !== '') {
        const p = parseFloat(maxPrice)
        if (!isNaN(p) && tmpl.estimated_price_sar_per_hour > p) return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${tmpl.name} ${tmpl.description} ${tmpl.tags.join(' ')} ${tmpl.category}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort((a, b) => a.sort_order - b.sort_order)
  }, [activeTemplates, category, difficultyFilter, maxVram, maxPrice, search])

  const arabicCount = activeTemplates.filter(tt => tt.is_arabic).length

  const trackTemplateEvent = (event: string, payload: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') return
    const detail = {
      event,
      source_page: 'renter_template_catalog',
      role_intent: 'renter',
      surface: 'template_catalog',
      locale: language,
      ...payload,
    }
    window.dispatchEvent(new CustomEvent('dc1_analytics', { detail }))
  }

  useEffect(() => {
    trackTemplateEvent('template_catalog_viewed', {
      total_templates: activeTemplates.length,
      arabic_templates: arabicCount,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplates.length, arabicCount, language])

  const openDeploy = (tmpl: Template) => {
    const key = localStorage.getItem('dc1_renter_key') || localStorage.getItem('dc1_api_key')
    if (!key) {
      router.push('/login?role=renter&reason=missing_credentials')
      return
    }
    trackTemplateEvent('template_deploy_config_opened', {
      template_id: tmpl.id,
      category: tmpl.category,
      language,
    })
    setDeploy({
      template: tmpl,
      step: 'configure',
      durationMinutes: 60,
      loading: false,
      error: '',
      troubleshoot: [],
      jobId: null,
    })
  }

  const closeDeploy = () => setDeploy({
    template: null,
    step: 'configure',
    durationMinutes: 60,
    loading: false,
    error: '',
    troubleshoot: [],
    jobId: null,
  })

  const confirmDeploy = async () => {
    const tmpl = deploy.template
    if (!tmpl) return
    const apiKey = localStorage.getItem('dc1_renter_key') || localStorage.getItem('dc1_api_key') || ''
    trackTemplateEvent('template_deploy_submitted', {
      template_id: tmpl.id,
      duration_minutes: deploy.durationMinutes,
      locale: language,
    })
    setDeploy(d => ({ ...d, loading: true, error: '', troubleshoot: [] }))
    try {
      const res = await fetch(`/api/dc1/templates/${encodeURIComponent(tmpl.id)}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-renter-key': apiKey },
        body: JSON.stringify({ duration_minutes: deploy.durationMinutes }),
      })
      if (!res.ok) {
        const fallback = resolveDeployError(res.status, copy)
        const err = await res.json().catch(() => ({}))
        trackTemplateEvent('template_deploy_failed', {
          template_id: tmpl.id,
          status_code: res.status,
          locale: language,
        })
        setDeploy(d => ({
          ...d,
          loading: false,
          error: typeof err.error === 'string' && err.error.trim().length > 0 ? err.error : fallback.message,
          troubleshoot: fallback.troubleshooting,
        }))
        return
      }
      const data = await res.json()
      const jobId = data.jobId || data.job_id || data.id || 'submitted'
      trackTemplateEvent('template_deploy_succeeded', {
        template_id: tmpl.id,
        job_id: jobId,
        locale: language,
      })
      setDeploy(d => ({ ...d, loading: false, step: 'status', jobId }))
    } catch {
      trackTemplateEvent('template_deploy_failed', {
        template_id: tmpl.id,
        status_code: 'network_error',
        locale: language,
      })
      setDeploy(d => ({
        ...d,
        loading: false,
        error: copy.networkError,
        troubleshoot: ['Check internet connectivity.', 'Refresh and retry deployment.', 'Try again in 1 minute if API is under load.'],
      }))
    }
  }

  const clearFilters = () => {
    setCategory('all')
    setSearch('')
    setMaxVram('')
    setMaxPrice('')
    setDifficultyFilter('all')
  }

  const hasFilters = category !== 'all' || search.trim() || maxVram || maxPrice || difficultyFilter !== 'all'

  return (
    <DashboardLayout navItems={navItems} role="renter">
      <div className="space-y-6" dir={dir}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-dc1-text-primary">{copy.title}</h1>
            <p className="text-sm text-dc1-text-secondary mt-1">
              {copy.subtitle}
            </p>
          </div>
          <Link href="/renter/marketplace" className="btn btn-secondary btn-sm self-start sm:self-auto">
            {isRTL ? '→ ' : '← '}{copy.back}
          </Link>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
            <span className="text-dc1-amber font-bold">{activeTemplates.length}</span>
            <span className="text-dc1-text-secondary">{copy.templateCount}</span>
          </div>
          <div className="flex items-center gap-2 bg-dc1-amber/10 rounded-lg px-3 py-2 border border-dc1-amber/20">
            <span className="text-dc1-amber font-bold">🌙 {arabicCount}</span>
            <span className="text-dc1-amber font-medium">{copy.arabicCapable}</span>
          </div>
          <div className="flex items-center gap-2 bg-status-info/10 rounded-lg px-3 py-2 border border-status-info/30">
            <span className="text-status-info font-bold">↔</span>
            <span className="text-status-info font-medium">{copy.languageBadge}</span>
          </div>
          <div className="flex items-center gap-2 bg-status-success/10 rounded-lg px-3 py-2 border border-status-success/20">
            <span className="text-status-success font-bold">Save 35–65%</span>
            <span className="text-dc1-text-secondary">vs hyperscalers</span>
          </div>
          <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
            <span className="text-dc1-amber font-bold">From 5 SAR/hr</span>
          </div>
        </div>

        {/* Arabic RAG callout */}
        <div className="bg-dc1-amber/5 border border-dc1-amber/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-3xl">🌙</div>
          <div className="flex-1">
            <h3 className="font-bold text-dc1-text-primary mb-1">Complete Arabic AI Stack — PDPL-Compliant</h3>
            <p className="text-sm text-dc1-text-secondary">
              BGE-M3 embeddings + BGE reranker + ALLaM/JAIS/Qwen — full Arabic RAG pipeline on Saudi GPUs.
              No data leaves the Kingdom. 35–65% below AWS/Azure pricing.
            </p>
          </div>
          <button
            onClick={() => setCategory('Arabic AI')}
            className="btn btn-primary shrink-0 text-sm"
          >
            {copy.browseArabic}
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                category === cat.id
                  ? 'bg-dc1-amber text-dc1-bg border-dc1-amber'
                  : 'bg-dc1-surface-l1 text-dc1-text-secondary border-dc1-border hover:border-dc1-amber/40 hover:text-dc1-text-primary'
              }`}
            >
              <span>{cat.emoji}</span>
              {getCategoryLabel(cat.id, language)}
            </button>
          ))}
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap gap-3 items-center p-4 bg-dc1-surface-l1 rounded-xl border border-dc1-border">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dc1-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search templates…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input ps-9 w-full text-sm"
            />
          </div>
          {/* VRAM filter */}
          <input
            type="number"
            min="4"
            step="4"
            placeholder="Max VRAM (GB)"
            value={maxVram}
            onChange={e => setMaxVram(e.target.value)}
            className="input text-sm w-36 min-h-[44px]"
          />
          {/* Price filter */}
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Max price (SAR/hr)"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            className="input text-sm w-40 min-h-[44px]"
          />
          {/* Difficulty */}
          <select
            value={difficultyFilter}
            onChange={e => setDifficultyFilter(e.target.value as typeof difficultyFilter)}
            className="input text-sm w-auto min-h-[44px]"
          >
            <option value="all">All levels</option>
            <option value="easy">Easy start</option>
            <option value="medium">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          {/* Results count + clear */}
          <div className="ms-auto flex items-center gap-3">
            <span className="text-xs text-dc1-text-muted whitespace-nowrap">
              {loadingTemplates ? copy.filtersLoading : copy.filtersSummary(filtered.length, activeTemplates.length)}
            </span>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-dc1-amber hover:underline">
                {copy.clearFilters}
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        {loadingTemplates ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : activeTemplates.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl mb-3">⚠️</p>
            <p className="text-dc1-text-secondary mb-1">{templatesError ?? 'Template catalog unavailable.'}</p>
            <button onClick={() => window.location.reload()} className="btn btn-outline btn-sm mt-3">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl mb-3">🔍</p>
            <p className="text-dc1-text-secondary mb-1">{copy.noFilters}</p>
            <button onClick={clearFilters} className="btn btn-outline btn-sm mt-3">{copy.clearFilters}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(tmpl => (
              <TemplateCard key={tmpl.id} template={tmpl} copy={copy} onDeploy={openDeploy} />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <div className="border border-dc1-border rounded-2xl p-6 text-center bg-dc1-surface-l1">
          <p className="text-dc1-text-secondary text-sm mb-3">
            Need a custom setup? Browse live providers directly or bring your own container.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/renter/marketplace" className="btn btn-secondary btn-sm">Browse Providers</Link>
            <button
              onClick={() => {
                const customContainer = activeTemplates.find(t => t.id === 'custom-container')
                const fallback = activeTemplates[0]
                if (customContainer) openDeploy(customContainer)
                else if (fallback) openDeploy(fallback)
              }}
              disabled={activeTemplates.length === 0}
              className="btn btn-outline btn-sm"
            >
              📦 Custom Container
            </button>
          </div>
        </div>
      </div>

      {/* Deploy modal */}
      {deploy.template && (
        <DeployModal
          state={deploy}
          copy={copy}
          isRTL={isRTL}
          onClose={closeDeploy}
          onChange={(patch) => setDeploy((prev) => ({ ...prev, ...patch }))}
          onConfirm={confirmDeploy}
        />
      )}
    </DashboardLayout>
  )
}
