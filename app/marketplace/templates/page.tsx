'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import { useLanguage, type Language } from '../../lib/i18n'

const API_BASE = '/api/dc1'

type CategoryKey = 'all' | 'llm' | 'embedding' | 'image' | 'training' | 'notebook'

interface DockerTemplate {
  id: string
  name: string
  description: string
  image?: string
  job_type?: string
  min_vram_gb?: number
  estimated_price_sar_per_hour?: number
  tags?: string[]
  sort_order?: number
  difficulty?: 'easy' | 'medium' | 'advanced'
  tier?: string
  icon?: string
  params?: Record<string, unknown>
  model_name?: string
  tier_hint?: {
    tier?: string
    notes?: string
  }
  deploy_defaults?: {
    duration_minutes?: number
    pricing_class?: string
    job_type?: string
    params?: Record<string, unknown>
  }
}

const VRAM_SAVINGS_TIERS: { minVram: number; savingsPct: number }[] = [
  { minVram: 80, savingsPct: 40 },
  { minVram: 40, savingsPct: 33 },
  { minVram: 24, savingsPct: 28 },
  { minVram: 16, savingsPct: 24 },
  { minVram: 0, savingsPct: 24 },
]

const CATEGORY_EMOJI: Record<CategoryKey, string> = {
  all: '✦',
  llm: '🤖',
  embedding: '🔍',
  image: '🎨',
  training: '🎓',
  notebook: '📓',
}

const CATEGORY_LABELS: Record<Language, Record<CategoryKey, string>> = {
  en: {
    all: 'All Templates',
    llm: 'LLM / Inference',
    embedding: 'Embeddings & RAG',
    image: 'Image Generation',
    training: 'Training & Fine-tune',
    notebook: 'Notebooks & Dev',
  },
  ar: {
    all: 'كل القوالب',
    llm: 'نماذج لغوية / استدلال',
    embedding: 'تضمين و RAG',
    image: 'توليد الصور',
    training: 'تدريب وضبط دقيق',
    notebook: 'دفاتر وأدوات تطوير',
  },
}

const COPY = {
  en: {
    marketplace: 'Marketplace',
    templates: 'Templates',
    title: 'GPU Workload Templates',
    subtitle: 'Live template catalog from the backend contract. Deploy-ready paths keep your renter intent through auth.',
    available: 'templates available',
    arabicIncluded: 'Arabic-capable models included',
    instantTier: 'Instant-tier pre-warmed',
    search: 'Search templates...',
    minVram: 'Min VRAM (GB)',
    speed: 'Deployment speed',
    speedAll: '⚡ All speeds',
    speedInstant: '⚡ Instant (0-2s)',
    speedCached: '🚀 Cached (2-10s)',
    speedDemand: '⏱ On-Demand (10s+)',
    arabicOnly: 'Arabic only',
    reset: 'Reset',
    loading: 'Loading...',
    of: 'of',
    failed: 'Failed to load templates.',
    retry: 'Retry',
    noMatch: 'No templates match your filters.',
    clearFilters: 'Clear filters',
    vram: 'VRAM',
    type: 'Type',
    sarHr: 'SAR/hr',
    vastEquivalent: 'vs Vast.ai equivalent',
    estimated: '(est.)',
    cheaper: 'cheaper',
    hideParams: 'Hide',
    viewParams: 'View',
    params: 'parameters',
    deployNow: 'Deploy Now',
    dontSee: "Don't see what you need?",
    ctaDesc: 'Deploy any custom Docker container or contact us for enterprise Arabic AI deployments with PDPL compliance.',
    customDeploy: 'Custom Container Deploy',
    browseModels: 'Browse Model Catalog',
    easy: 'Easy',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    tierInstant: '⚡ Instant',
    tierCached: '🚀 Cached',
    tierDemand: 'On-Demand',
    arabicTag: 'Arabic',
  },
  ar: {
    marketplace: 'السوق',
    templates: 'القوالب',
    title: 'قوالب أحمال GPU',
    subtitle: 'كتالوج حي من عقد API الخلفي. مسارات النشر تحافظ على نية المستأجر أثناء تسجيل الدخول.',
    available: 'قالب متاح',
    arabicIncluded: 'يشمل نماذج تدعم العربية',
    instantTier: 'طبقة فورية مُسخنة مسبقاً',
    search: 'ابحث في القوالب...',
    minVram: 'الحد الأدنى للذاكرة (GB)',
    speed: 'سرعة النشر',
    speedAll: '⚡ كل السرعات',
    speedInstant: '⚡ فوري (0-2ث)',
    speedCached: '🚀 مخزن (2-10ث)',
    speedDemand: '⏱ عند الطلب (+10ث)',
    arabicOnly: 'العربية فقط',
    reset: 'إعادة ضبط',
    loading: 'جار التحميل...',
    of: 'من',
    failed: 'تعذر تحميل القوالب.',
    retry: 'إعادة المحاولة',
    noMatch: 'لا توجد قوالب مطابقة للفلاتر.',
    clearFilters: 'مسح الفلاتر',
    vram: 'الذاكرة',
    type: 'النوع',
    sarHr: 'ريال/ساعة',
    vastEquivalent: 'مقارنة بسعر Vast.ai',
    estimated: '(تقديري)',
    cheaper: 'أرخص',
    hideParams: 'إخفاء',
    viewParams: 'عرض',
    params: 'المعاملات',
    deployNow: 'انشر الآن',
    dontSee: 'لم تجد ما تحتاجه؟',
    ctaDesc: 'انشر أي حاوية Docker مخصصة أو تواصل معنا لنشر عربي مؤسسي متوافق مع PDPL.',
    customDeploy: 'نشر حاوية مخصصة',
    browseModels: 'تصفح كتالوج النماذج',
    easy: 'سهل',
    intermediate: 'متوسط',
    advanced: 'متقدم',
    tierInstant: '⚡ فوري',
    tierCached: '🚀 مخزن',
    tierDemand: 'عند الطلب',
    arabicTag: 'عربي',
  },
} as const

function getVramSavings(vramGb: number | undefined): { savingsPct: number } {
  const vram = vramGb ?? 0
  for (const tier of VRAM_SAVINGS_TIERS) {
    if (vram >= tier.minVram) return tier
  }
  return { savingsPct: 24 }
}

function getCategoryForTemplate(t: DockerTemplate): CategoryKey {
  const tags = (t.tags ?? []).map((x) => x.toLowerCase())
  const id = t.id?.toLowerCase() ?? ''
  if (tags.includes('training') || id.includes('finetune') || id.includes('lora') || id.includes('qlora')) return 'training'
  if (tags.includes('embedding') || tags.includes('rag') || id.includes('embed') || id.includes('rerank')) return 'embedding'
  if (tags.includes('image') || id.includes('sdxl') || id.includes('stable-diffusion') || id.includes('sd')) return 'image'
  if (id.includes('jupyter') || id.includes('notebook') || id.includes('python-scientific')) return 'notebook'
  if (tags.includes('llm') || tags.includes('inference') || id.includes('llm') || id.includes('vllm') || id.includes('ollama')) return 'llm'
  return 'llm'
}

function getDifficultyBadge(difficulty: string | undefined, language: Language) {
  const copy = COPY[language]
  if (difficulty === 'advanced') return { label: copy.advanced, cls: 'bg-status-error/10 text-status-error border-status-error/20' }
  if (difficulty === 'medium') return { label: copy.intermediate, cls: 'bg-dc1-amber/10 text-dc1-amber border-dc1-amber/20' }
  return { label: copy.easy, cls: 'bg-status-success/10 text-status-success border-status-success/20' }
}

function getTierBadge(tier: string | undefined, language: Language) {
  const copy = COPY[language]
  if (tier === 'instant') return { label: copy.tierInstant, cls: 'bg-status-success/10 text-status-success border-status-success/20' }
  if (tier === 'cached') return { label: copy.tierCached, cls: 'bg-status-info/10 text-status-info border-status-info/20' }
  return { label: copy.tierDemand, cls: 'bg-dc1-surface-l3 text-dc1-text-secondary border-dc1-border' }
}

function resolveTemplateModel(template: DockerTemplate): string {
  if (typeof template.model_name === 'string' && template.model_name.trim()) return template.model_name.trim()
  if (template.params && typeof template.params.model === 'string' && template.params.model.trim()) return template.params.model.trim()
  return ''
}

function normalizeTemplate(raw: Record<string, unknown>): DockerTemplate {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? raw.model_name ?? raw.id ?? ''),
    description: String(raw.description ?? raw.model_name ?? ''),
    image: typeof raw.image === 'string' ? raw.image : undefined,
    job_type: typeof raw.job_type === 'string' ? raw.job_type : undefined,
    min_vram_gb: Number.isFinite(Number(raw.min_vram_gb)) ? Number(raw.min_vram_gb) : undefined,
    estimated_price_sar_per_hour: Number.isFinite(Number(raw.estimated_price_sar_per_hour)) ? Number(raw.estimated_price_sar_per_hour) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map((x) => String(x)) : [],
    sort_order: Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : undefined,
    difficulty: ['easy', 'medium', 'advanced'].includes(String(raw.difficulty ?? ''))
      ? (String(raw.difficulty) as DockerTemplate['difficulty'])
      : undefined,
    tier: typeof raw.tier === 'string' ? raw.tier : undefined,
    icon: typeof raw.icon === 'string' ? raw.icon : undefined,
    params: raw.params && typeof raw.params === 'object' && !Array.isArray(raw.params)
      ? (raw.params as Record<string, unknown>)
      : undefined,
    model_name: typeof raw.model_name === 'string' ? raw.model_name : undefined,
    tier_hint: raw.tier_hint && typeof raw.tier_hint === 'object' && !Array.isArray(raw.tier_hint)
      ? (raw.tier_hint as DockerTemplate['tier_hint'])
      : undefined,
    deploy_defaults: raw.deploy_defaults && typeof raw.deploy_defaults === 'object' && !Array.isArray(raw.deploy_defaults)
      ? (raw.deploy_defaults as DockerTemplate['deploy_defaults'])
      : undefined,
  }
}

function SkeletonCard() {
  return (
    <div className="bg-dc1-surface-l2 border border-dc1-border rounded-xl p-5 flex flex-col gap-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-5 bg-dc1-surface-l3 rounded w-2/3" />
        <div className="h-5 bg-dc1-surface-l3 rounded-full w-16" />
      </div>
      <div className="h-3 bg-dc1-surface-l3 rounded w-full" />
      <div className="h-3 bg-dc1-surface-l3 rounded w-4/5" />
      <div className="flex gap-2 mt-1">
        <div className="h-5 bg-dc1-surface-l3 rounded-full w-12" />
        <div className="h-5 bg-dc1-surface-l3 rounded-full w-16" />
      </div>
      <div className="h-10 bg-dc1-surface-l3 rounded-lg mt-2" />
      <div className="h-9 bg-dc1-surface-l3 rounded-md" />
    </div>
  )
}

function TemplateCard({
  template,
  language,
  onDeploy,
}: {
  template: DockerTemplate
  language: Language
  onDeploy: (template: DockerTemplate) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const copy = COPY[language]
  const difficulty = getDifficultyBadge(template.difficulty, language)
  const tierBadge = getTierBadge(template.tier ?? template.tier_hint?.tier, language)
  const hasArabic = (template.tags ?? []).some((t) => t.toLowerCase().includes('arabic')) || template.id.toLowerCase().includes('arabic')
  const priceHr = template.estimated_price_sar_per_hour ?? null
  const { savingsPct } = getVramSavings(template.min_vram_gb)
  const vastEquivPrice = priceHr !== null ? priceHr / (1 - savingsPct / 100) : null

  return (
    <article className="bg-dc1-surface-l2 border border-dc1-border rounded-xl p-5 flex flex-col gap-3 hover:border-dc1-amber/30 hover:shadow-amber transition-all duration-200 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {template.icon && <span className="text-xl shrink-0">{template.icon}</span>}
          <h3 className="text-base font-bold text-dc1-text-primary leading-tight group-hover:text-dc1-amber transition-colors truncate">
            {template.name}
          </h3>
        </div>
        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ${tierBadge.cls}`}>
          {tierBadge.label}
        </span>
      </div>

      <p className="text-sm text-dc1-text-secondary leading-relaxed line-clamp-2">{template.description}</p>

      <div className="flex flex-wrap gap-1.5 items-center">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${difficulty.cls}`}>
          {difficulty.label}
        </span>
        {hasArabic && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-dc1-amber/10 text-dc1-amber border-dc1-amber/20">
            🌙 {copy.arabicTag}
          </span>
        )}
        {(template.tags ?? []).slice(0, 3).map((tag) => (
          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-dc1-surface-l3 text-dc1-text-muted border border-dc1-border">
            {tag}
          </span>
        ))}
      </div>

      <div className="bg-dc1-surface-l1 rounded-lg px-3 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs">
          {template.min_vram_gb && (
            <div>
              <span className="text-dc1-text-muted">{copy.vram}</span>
              <span className="ml-1 font-semibold text-dc1-text-primary">{template.min_vram_gb} GB</span>
            </div>
          )}
          {(template.job_type || template.deploy_defaults?.job_type) && (
            <div>
              <span className="text-dc1-text-muted">{copy.type}</span>
              <span className="ml-1 font-mono text-[10px] text-dc1-text-secondary">{template.job_type ?? template.deploy_defaults?.job_type}</span>
            </div>
          )}
        </div>
        {priceHr !== null && (
          <div className="text-right">
            <p className="text-lg font-extrabold text-dc1-amber leading-none">
              {priceHr.toFixed(2)}
              <span className="text-xs font-normal text-dc1-text-secondary ml-1">{copy.sarHr}</span>
            </p>
          </div>
        )}
      </div>

      {priceHr !== null && vastEquivPrice !== null && (
        <div className="rounded-lg border border-status-success/20 bg-status-success/5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-dc1-text-muted uppercase tracking-wide mb-0.5">{copy.vastEquivalent}</p>
              <p className="text-xs text-dc1-text-secondary">
                <span className="line-through">{vastEquivPrice.toFixed(2)} {copy.sarHr}</span>
                <span className="ml-1 text-dc1-text-muted text-[10px]">{copy.estimated}</span>
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-status-success/10 border border-status-success/30 text-status-success text-xs font-bold">
              ↓ {savingsPct}% {copy.cheaper}
            </span>
          </div>
        </div>
      )}

      {template.params && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs text-dc1-text-muted hover:text-dc1-text-primary transition-colors"
        >
          <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {expanded ? copy.hideParams : copy.viewParams} {copy.params}
        </button>
      )}
      {expanded && template.params && (
        <pre className="text-[10px] font-mono text-dc1-text-secondary bg-dc1-surface-l1 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap">
          {JSON.stringify(template.params, null, 2)}
        </pre>
      )}

      <button
        onClick={() => onDeploy(template)}
        className="btn btn-primary w-full text-center text-sm mt-auto"
      >
        {copy.deployNow}
      </button>
    </article>
  )
}

export default function MarketplaceTemplatesPage() {
  const router = useRouter()
  const { language, dir } = useLanguage()
  const copy = COPY[language]

  const [templates, setTemplates] = useState<DockerTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')
  const [search, setSearch] = useState('')
  const [filterVram, setFilterVram] = useState('')
  const [filterArabic, setFilterArabic] = useState(false)
  const [filterTier, setFilterTier] = useState<'all' | 'instant' | 'cached' | 'on-demand'>('all')

  const categories = useMemo(
    () => (['all', 'llm', 'embedding', 'image', 'training', 'notebook'] as CategoryKey[]).map((key) => ({
      key,
      emoji: CATEGORY_EMOJI[key],
      label: CATEGORY_LABELS[language][key],
    })),
    [language]
  )

  const trackTemplateEvent = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent('dc1_analytics', {
        detail: {
          event,
          source_page: 'public_marketplace_templates',
          role_intent: 'renter',
          surface: 'template_catalog',
          locale: language,
          ...payload,
        },
      })
    )
  }, [language])

  useEffect(() => {
    async function loadTemplates() {
      setLoading(true)
      setError(false)
      try {
        const [catalogRes, templatesRes] = await Promise.all([
          fetch(`${API_BASE}/templates/catalog`),
          fetch(`${API_BASE}/templates`),
        ])

        const catalogJson = catalogRes.ok ? await catalogRes.json() : null
        const templatesJson = templatesRes.ok ? await templatesRes.json() : null

        const catalogList = Array.isArray(catalogJson?.templates)
          ? (catalogJson.templates as Record<string, unknown>[]).map(normalizeTemplate)
          : []
        const baseList = Array.isArray(templatesJson?.templates)
          ? (templatesJson.templates as Record<string, unknown>[]).map(normalizeTemplate)
          : []

        let merged: DockerTemplate[] = []
        if (catalogList.length > 0) {
          const baseMap = new Map(baseList.map((template) => [template.id, template]))
          merged = catalogList.map((template) => {
            const base = baseMap.get(template.id)
            return {
              ...template,
              name: base?.name || template.name,
              description: base?.description || template.description || template.model_name || '',
              tags: base?.tags ?? template.tags ?? [],
              icon: base?.icon || template.icon,
              difficulty: base?.difficulty || template.difficulty,
              tier: base?.tier || template.tier || template.tier_hint?.tier,
              estimated_price_sar_per_hour: base?.estimated_price_sar_per_hour,
              params: base?.params || template.deploy_defaults?.params || template.params,
              job_type: base?.job_type || template.deploy_defaults?.job_type || template.job_type,
              min_vram_gb: base?.min_vram_gb ?? template.min_vram_gb,
            }
          })
        } else {
          merged = baseList
        }

        if (merged.length === 0) {
          throw new Error('No template data available')
        }

        setTemplates(merged)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadTemplates()
  }, [])

  useEffect(() => {
    if (loading || templates.length === 0) return
    trackTemplateEvent('template_catalog_viewed', {
      total_templates: templates.length,
      arabic_templates: templates.filter((template) => (template.tags ?? []).some((tag) => tag.toLowerCase().includes('arabic'))).length,
    })
  }, [loading, templates, trackTemplateEvent])

  const filtered = useMemo(() => {
    return templates.filter((template) => {
      if (activeCategory !== 'all' && getCategoryForTemplate(template) !== activeCategory) return false
      if (filterArabic && !(template.tags ?? []).some((tag) => tag.toLowerCase().includes('arabic'))) return false
      if (filterVram !== '') {
        const minVram = parseInt(filterVram, 10)
        if (!Number.isNaN(minVram) && (template.min_vram_gb ?? 0) < minVram) return false
      }
      if (filterTier !== 'all') {
        const tier = (template.tier ?? template.tier_hint?.tier ?? 'on-demand').toLowerCase()
        if (filterTier === 'instant' && tier !== 'instant') return false
        if (filterTier === 'cached' && tier !== 'cached') return false
        if (filterTier === 'on-demand' && tier !== 'on-demand' && tier !== '' && tier !== 'standard') return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${template.name} ${template.description} ${(template.tags ?? []).join(' ')} ${resolveTemplateModel(template)}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [templates, activeCategory, filterVram, filterArabic, filterTier, search])

  const createQuickstartHref = useCallback((template: DockerTemplate) => {
    const model = resolveTemplateModel(template)
    const params = new URLSearchParams({
      template: template.id,
      source: 'public_marketplace_templates',
    })
    if (model) params.set('model', model)

    const quickstartPath = `/renter/marketplace/templates?${params.toString()}`

    const hasRenterSession = typeof window !== 'undefined' && (
      Boolean(window.localStorage.getItem('dc1_renter_key')) ||
      Boolean(window.localStorage.getItem('dc1_api_key'))
    )

    if (hasRenterSession) return quickstartPath
    const loginParams = new URLSearchParams({
      role: 'renter',
      redirect: quickstartPath,
      source: 'public_marketplace_templates',
    })
    return `/login?${loginParams.toString()}`
  }, [])

  const handleDeployClick = useCallback((template: DockerTemplate) => {
    const destination = createQuickstartHref(template)
    trackTemplateEvent('template_deploy_clicked', {
      template_id: template.id,
      destination,
      has_model_intent: Boolean(resolveTemplateModel(template)),
    })
    router.push(destination)
  }, [createQuickstartHref, router, trackTemplateEvent])

  const handleCustomDeploy = useCallback(() => {
    const custom = templates.find((template) => template.id === 'custom-container')
    if (!custom) return
    handleDeployClick(custom)
  }, [templates, handleDeployClick])

  const resetFilters = () => {
    setSearch('')
    setFilterVram('')
    setFilterArabic(false)
    setFilterTier('all')
    setActiveCategory('all')
  }

  return (
    <div className="min-h-screen flex flex-col" dir={dir}>
      <Header />

      <main className="flex-1">
        <section className="border-b border-dc1-border bg-gradient-to-b from-dc1-amber/5 to-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center gap-2 mb-3">
              <Link href="/marketplace" className="text-sm text-dc1-text-muted hover:text-dc1-amber transition-colors">{copy.marketplace}</Link>
              <span className="text-dc1-text-muted">/</span>
              <span className="text-sm text-dc1-text-primary font-medium">{copy.templates}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-3">{copy.title}</h1>
            <p className="text-dc1-text-secondary text-lg mb-6 max-w-2xl">{copy.subtitle}</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
                <span className="text-dc1-amber font-bold">{templates.length}</span>
                <span className="text-dc1-text-secondary">{copy.available}</span>
              </div>
              <div className="flex items-center gap-2 bg-dc1-amber/10 rounded-lg px-3 py-2 border border-dc1-amber/20">
                <span className="text-dc1-amber font-bold">🌙</span>
                <span className="text-dc1-amber font-medium">{copy.arabicIncluded}</span>
              </div>
              <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
                <span className="text-status-success font-bold">⚡</span>
                <span className="text-dc1-text-secondary">{copy.instantTier}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-dc1-border bg-dc1-surface-l1/50 sticky top-0 z-10 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    activeCategory === cat.key
                      ? 'bg-dc1-amber text-white border-dc1-amber'
                      : 'bg-transparent text-dc1-text-secondary border-dc1-border hover:border-dc1-amber/40 hover:text-dc1-text-primary'
                  }`}
                >
                  <span className="me-1">{cat.emoji}</span>
                  {cat.label}
                  {cat.key !== 'all' && (
                    <span className="ms-1 opacity-60 text-xs">
                      ({templates.filter((template) => getCategoryForTemplate(template) === cat.key).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pb-3 items-center">
              <div className="relative flex-1 min-w-48">
                <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dc1-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder={copy.search}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input ps-9 w-full text-sm"
                />
              </div>
              <input
                type="number"
                min="0"
                step="4"
                placeholder={copy.minVram}
                value={filterVram}
                onChange={(e) => setFilterVram(e.target.value)}
                className="input text-sm w-36"
              />
              <select
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value as typeof filterTier)}
                className="input text-sm w-40"
                aria-label={copy.speed}
              >
                <option value="all">{copy.speedAll}</option>
                <option value="instant">{copy.speedInstant}</option>
                <option value="cached">{copy.speedCached}</option>
                <option value="on-demand">{copy.speedDemand}</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-dc1-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterArabic}
                  onChange={(e) => setFilterArabic(e.target.checked)}
                  className="rounded"
                />
                🌙 {copy.arabicOnly}
              </label>
              <button
                onClick={resetFilters}
                className="text-xs text-dc1-text-muted hover:text-dc1-amber transition-colors whitespace-nowrap"
              >
                {copy.reset}
              </button>
              <span className="text-xs text-dc1-text-muted whitespace-nowrap ms-auto">
                {loading ? copy.loading : `${filtered.length} ${copy.of} ${templates.length}`}
              </span>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-dc1-text-secondary mb-2">{copy.failed}</p>
              <button onClick={() => window.location.reload()} className="btn btn-secondary btn-sm mt-2">{copy.retry}</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-dc1-text-secondary mb-1">{copy.noMatch}</p>
              <button
                onClick={resetFilters}
                className="btn btn-outline btn-sm mt-3"
              >
                {copy.clearFilters}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  language={language}
                  onDeploy={handleDeployClick}
                />
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-dc1-border bg-dc1-surface-l1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
            <h2 className="text-2xl font-bold text-dc1-text-primary mb-3">{copy.dontSee}</h2>
            <p className="text-dc1-text-secondary mb-6 max-w-lg mx-auto">{copy.ctaDesc}</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <button onClick={handleCustomDeploy} className="btn btn-primary" disabled={templates.length === 0}>
                {copy.customDeploy}
              </button>
              <Link href="/marketplace/models" className="btn btn-secondary">
                {copy.browseModels}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
