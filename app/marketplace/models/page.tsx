'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import ProviderAvailabilityBadge from '../../components/marketplace/ProviderAvailabilityBadge'
import { useLanguage } from '../../lib/i18n'

const API_BASE = '/api/dc1'

// Known Arabic names for specific models (displayed as subtitle)
const ARABIC_MODEL_NAMES: Record<string, string> = {
  'allam-7b-instruct': 'عَلَّام — نموذج عربي متقدم',
  'allam-7b': 'عَلَّام',
  'jais-13b': 'جيس — نموذج عربي',
  'jais-13b-chat': 'جيس',
  'falcon-h1-7b': 'فالكون H1',
  'qwen2.5-7b-instruct': 'كيوين ٢.٥',
  'qwen25-7b': 'كيوين ٢.٥',
}

function getArabicSubtitle(modelId: string): string | null {
  const key = modelId.toLowerCase()
  for (const [id, name] of Object.entries(ARABIC_MODEL_NAMES)) {
    if (key.includes(id)) return name
  }
  // Generic fallback for any other Arabic model
  return null
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface ModelListItem {
  model_id: string
  display_name: string
  family?: string
  vram_gb?: number
  min_gpu_vram_gb?: number
  quantization?: string
  context_window?: number
  use_cases?: string[]
  providers_online?: number
  avg_price_sar_per_min?: number
  status?: string
  tier?: string | null
  prewarm_class?: string | null
  arabic_capability?: boolean   // from DCP-950: authoritative Arabic flag from backend
  arabic?: boolean              // alias returned by GET /api/dc1/models
}

// ── Competitive pricing table (SAR per hour, from strategic brief) ─────────────
// DCP is priced ~23.7% below Vast.ai; Arabic models save 33-51% vs hyperscalers
const HYPERSCALER_SAR_PER_HR: Record<string, { label: string; sar_per_hr: number; notes?: string }[]> = {
  'RTX 4090': [
    { label: 'Vast.ai', sar_per_hr: 1.31 },
    { label: 'RunPod', sar_per_hr: 1.27 },
    { label: 'AWS Bedrock', sar_per_hr: 0.0 },
  ],
  'A100 80GB': [
    { label: 'Vast.ai', sar_per_hr: 8.29 },
    { label: 'RunPod', sar_per_hr: 7.46 },
    { label: 'AWS Bedrock', sar_per_hr: 13.76 },
  ],
  'H100 80GB': [
    { label: 'Vast.ai', sar_per_hr: 13.12 },
    { label: 'RunPod', sar_per_hr: 12.34 },
    { label: 'AWS Bedrock', sar_per_hr: 30.75 },
  ],
}

// ── Pricing comparison banner ──────────────────────────────────────────────────
const PRICING_COMPARISON = [
  { gpu: 'RTX 4090', dcp_sar_hr: 1.00, vast_sar_hr: 1.31, savings_pct: 24 },
  { gpu: 'A100 80GB', dcp_sar_hr: 6.75, vast_sar_hr: 8.29, savings_pct: 19 },
  { gpu: 'H100 80GB', dcp_sar_hr: 9.37, vast_sar_hr: 13.12, savings_pct: 29 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function sarPerMinToHr(sarPerMin?: number): string {
  if (!sarPerMin) return '—'
  return (sarPerMin * 60).toFixed(2)
}

function isArabicModel(model: ModelListItem): boolean {
  // Prefer the authoritative backend flag (added in DCP-950)
  if (model.arabic_capability != null) return model.arabic_capability
  if (model.arabic != null) return model.arabic
  // Client-side fallback for older API responses
  const id = model.model_id?.toLowerCase() ?? ''
  const family = model.family?.toLowerCase() ?? ''
  return id.includes('allam') || id.includes('jais') || id.includes('arabic') ||
    id.includes('falcon-h1') || id.includes('falcon_h1') ||
    family.includes('arabic') || family.includes('allam') || family.includes('jais') ||
    (model.use_cases ?? []).some(u => u.toLowerCase().includes('arabic'))
}

function getTaskType(model: ModelListItem): string {
  const id = model.model_id?.toLowerCase() ?? ''
  const uses = (model.use_cases ?? []).map(u => u.toLowerCase())
  if (id.includes('embed') || uses.some(u => u.includes('embed'))) return 'embedding'
  if (id.includes('rerank') || uses.some(u => u.includes('rerank'))) return 'reranking'
  if (id.includes('sdxl') || id.includes('stable-diff') || uses.some(u => u.includes('image'))) return 'image'
  return 'chat'
}

function getTierBadge(tier?: string | null, isRTL = false) {
  if (tier === 'tier_a') return { label: isRTL ? '⭐ الفئة A' : '⭐ Tier A', cls: 'bg-dc1-amber/10 text-dc1-amber border-dc1-amber/30' }
  if (tier === 'tier_b') return { label: isRTL ? '✦ الفئة B' : '✦ Tier B', cls: 'bg-status-info/10 text-status-info border-status-info/30' }
  if (tier === 'tier_c') return { label: isRTL ? 'الفئة C' : 'Tier C', cls: 'bg-dc1-surface-l3 text-dc1-text-muted border-dc1-border' }
  return null
}

function getPrewarmBadge(prewarm?: string | null, isRTL = false) {
  if (prewarm === 'hot') return { label: isRTL ? '🔥 ساخن' : '🔥 Hot', cls: 'bg-status-error/10 text-status-error border-status-error/20' }
  if (prewarm === 'warm') return { label: isRTL ? '♨ دافئ' : '♨ Warm', cls: 'bg-dc1-amber/10 text-dc1-amber border-dc1-amber/20' }
  return null
}

function getTaskTypeLabel(taskType: string, isRTL: boolean) {
  if (!isRTL) return taskType
  if (taskType === 'chat') return 'محادثة'
  if (taskType === 'embedding') return 'تضمين'
  if (taskType === 'reranking') return 'إعادة ترتيب'
  if (taskType === 'image') return 'صور'
  return taskType
}

type TaskFilter = 'all' | 'chat' | 'embedding' | 'reranking' | 'image'

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-dc1-surface-l2 border border-dc1-border rounded-xl p-5 flex flex-col gap-3 animate-pulse">
      <div className="h-5 bg-dc1-surface-l3 rounded w-3/4" />
      <div className="h-3 bg-dc1-surface-l3 rounded w-1/2" />
      <div className="flex gap-2">
        <div className="h-5 bg-dc1-surface-l3 rounded-full w-16" />
        <div className="h-5 bg-dc1-surface-l3 rounded-full w-12" />
      </div>
      <div className="h-20 bg-dc1-surface-l3 rounded-lg" />
      <div className="h-9 bg-dc1-surface-l3 rounded-md" />
    </div>
  )
}

// ── Model Card ────────────────────────────────────────────────────────────────
function ModelCard({ model, isRTL }: { model: ModelListItem; isRTL: boolean }) {
  const arabic = isArabicModel(model)
  const arabicSubtitle = arabic ? getArabicSubtitle(model.model_id) : null
  const tierBadge = getTierBadge(model.tier, isRTL)
  const prewarmBadge = getPrewarmBadge(model.prewarm_class, isRTL)
  const taskType = getTaskType(model)
  const priceHr = model.avg_price_sar_per_min ? (model.avg_price_sar_per_min * 60).toFixed(2) : null
  const vram = model.min_gpu_vram_gb ?? model.vram_gb
  const providersOnline = model.providers_online ?? 0

  const deployHref = `/renter/register?model=${encodeURIComponent(model.model_id)}&source=marketplace_models`

  return (
    <article className="bg-dc1-surface-l2 border border-dc1-border rounded-xl p-5 flex flex-col gap-3 hover:border-dc1-amber/30 hover:shadow-amber transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-dc1-text-primary group-hover:text-dc1-amber transition-colors leading-tight truncate">
            {model.display_name}
          </h3>
          {arabicSubtitle ? (
            <p className="text-xs text-dc1-amber/70 mt-0.5 font-medium" dir="rtl" lang="ar">
              {arabicSubtitle}
            </p>
          ) : (
            <p className="text-xs text-dc1-text-muted font-mono mt-0.5 truncate">{model.model_id}</p>
          )}
        </div>
        {arabic && (
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium bg-dc1-amber/10 text-dc1-amber border-dc1-amber/20">
            🌙 {isRTL ? 'عربي' : 'Arabic'}
          </span>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {tierBadge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${tierBadge.cls}`}>
            {tierBadge.label}
          </span>
        )}
        {prewarmBadge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${prewarmBadge.cls}`}>
            {prewarmBadge.label}
          </span>
        )}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-dc1-surface-l3 text-dc1-text-muted border border-dc1-border">
          {getTaskTypeLabel(taskType, isRTL)}
        </span>
        {model.quantization && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-dc1-surface-l3 text-dc1-text-muted border border-dc1-border font-mono">
            {model.quantization}
          </span>
        )}
      </div>

      {/* Use cases */}
      {(model.use_cases ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {model.use_cases!.slice(0, 3).map((u, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-dc1-amber/5 text-dc1-amber border border-dc1-amber/15">
              {u}
            </span>
          ))}
        </div>
      )}

      {/* Provider availability badge */}
      <ProviderAvailabilityBadge count={providersOnline} showOfflineMessage />

      {/* Specs + Pricing */}
      <div className="bg-dc1-surface-l1 rounded-lg px-3 py-2.5 grid grid-cols-2 gap-2 text-xs">
        {vram && (
          <div>
            <p className="text-dc1-text-muted uppercase tracking-wide text-[9px]">{isRTL ? 'VRAM' : 'VRAM'}</p>
            <p className="font-semibold text-dc1-text-primary">{vram} {isRTL ? 'جيجابايت' : 'GB'}</p>
          </div>
        )}
        {model.context_window && (
          <div>
            <p className="text-dc1-text-muted uppercase tracking-wide text-[9px]">{isRTL ? 'السياق' : 'Context'}</p>
            <p className="font-semibold text-dc1-text-primary">{(model.context_window / 1000).toFixed(0)}K {isRTL ? 'رمز' : 'tokens'}</p>
          </div>
        )}
        {priceHr !== null && (
          <div className="col-span-2">
            <p className="text-dc1-text-muted uppercase tracking-wide text-[9px]">{isRTL ? 'سعر DCP' : 'DCP Price'}</p>
            <p className="font-extrabold text-dc1-amber">{priceHr} <span className="text-[9px] font-normal text-dc1-text-muted">{isRTL ? 'ريال/ساعة' : 'SAR/hr'}</span></p>
          </div>
        )}
      </div>

      {/* Savings vs AWS (if arabic) */}
      {arabic && (
        <div className="bg-status-success/5 border border-status-success/20 rounded-lg px-3 py-2 text-xs">
          <span className="text-status-success font-semibold">{isRTL ? 'وفّر حتى 51%' : 'Save up to 51%'}</span>
          <span className="text-dc1-text-muted ml-1">{isRTL ? 'مقارنةً بـ AWS Bedrock' : 'vs AWS Bedrock'}</span>
        </div>
      )}

      {/* CTA */}
      <Link href={deployHref} className="btn btn-primary w-full text-center text-sm mt-auto">
        {isRTL ? 'انشر النموذج' : 'Deploy Model'}
      </Link>
    </article>
  )
}

// ── Pricing Table ─────────────────────────────────────────────────────────────
function PricingComparisonBar({ isRTL }: { isRTL: boolean }) {
  return (
    <section className="border-b border-dc1-border bg-dc1-surface-l1/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <p className="text-xs font-semibold text-dc1-text-muted uppercase tracking-wider mb-3">
          {isRTL ? 'DCP مقابل المنافسين (ريال/ساعة)' : 'DCP vs Competitors (SAR/hr)'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PRICING_COMPARISON.map(row => (
            <div key={row.gpu} className="bg-dc1-surface-l2 rounded-xl border border-dc1-border p-4">
              <p className="text-sm font-bold text-dc1-text-primary mb-3">{row.gpu}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-dc1-amber">{isRTL ? 'DCP (السعودية)' : 'DCP (Saudi)'}</span>
                  <span className="font-extrabold text-dc1-amber">{row.dcp_sar_hr.toFixed(2)} {isRTL ? 'ريال' : 'SAR'}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-dc1-text-muted">
                  <span>Vast.ai</span>
                  <span className="line-through">{row.vast_sar_hr.toFixed(2)} {isRTL ? 'ريال' : 'SAR'}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-dc1-border flex items-center justify-between">
                  <span className="text-xs text-dc1-text-muted">{isRTL ? 'توفيرك' : 'Your savings'}</span>
                  <span className="text-sm font-bold text-status-success">-{row.savings_pct}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketplaceModelsPage() {
  const { isRTL } = useLanguage()
  const [models, setModels] = useState<ModelListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [filterArabic, setFilterArabic] = useState(false)
  const [filterTask, setFilterTask] = useState<TaskFilter>('all')
  const [filterVram, setFilterVram] = useState('')
  const [filterTier, setFilterTier] = useState<'all' | 'tier_a' | 'tier_b'>('all')
  const [liveProviderCount, setLiveProviderCount] = useState<number | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/models`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const list: ModelListItem[] = Array.isArray(data) ? data : []
        setModels(list)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))

    // Fetch live provider count independently — non-blocking
    fetch(`${API_BASE}/providers/online`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.count != null) setLiveProviderCount(data.count) })
      .catch(() => {/* silently ignore — badge still works from model data */})
  }, [])

  const filtered = useMemo(() => {
    return models.filter(m => {
      if (filterArabic && !isArabicModel(m)) return false
      if (filterTask !== 'all' && getTaskType(m) !== filterTask) return false
      if (filterTier !== 'all' && m.tier !== filterTier) return false
      if (filterVram !== '') {
        const minV = parseInt(filterVram, 10)
        const vram = m.min_gpu_vram_gb ?? m.vram_gb ?? 0
        if (!isNaN(minV) && vram < minV) return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${m.model_id} ${m.display_name} ${m.family ?? ''} ${(m.use_cases ?? []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [models, filterArabic, filterTask, filterTier, filterVram, search])

  const arabicCount = models.filter(isArabicModel).length
  const tierACount = models.filter(m => m.tier === 'tier_a').length

  return (
    <div className="min-h-screen flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-dc1-border bg-gradient-to-b from-dc1-amber/5 to-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center gap-2 mb-3">
              <Link href="/marketplace" className="text-sm text-dc1-text-muted hover:text-dc1-amber transition-colors">{isRTL ? 'السوق' : 'Marketplace'}</Link>
              <span className="text-dc1-text-muted">/</span>
              <span className="text-sm text-dc1-text-primary font-medium">{isRTL ? 'النماذج' : 'Models'}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-3">
              {isRTL ? 'كتالوج نماذج الذكاء الاصطناعي العربي' : 'Arabic AI Model Catalog'}
            </h1>
            <p className="text-dc1-text-secondary text-lg mb-6 max-w-2xl">
              {isRTL
                ? 'انشر نماذج اللغة والتضمين وإعادة الترتيب الداعمة للعربية على وحدات GPU داخل السعودية. حوسبة متوافقة مع PDPL وبأسعار طاقة محلية.'
                : 'Deploy Arabic-capable LLMs, embeddings, and rerankers on Saudi GPUs. PDPL-compliant, in-Kingdom compute — the only platform offering ALLaM, JAIS, and Falcon Arabic at local energy rates.'}
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
                <span className="text-dc1-amber font-bold">{loading ? '…' : models.length}</span>
                <span className="text-dc1-text-secondary">{isRTL ? 'نموذج متاح' : 'models available'}</span>
              </div>
              <div className="flex items-center gap-2 bg-dc1-amber/10 rounded-lg px-3 py-2 border border-dc1-amber/20">
                <span className="text-dc1-amber font-bold">🌙 {loading ? '…' : arabicCount}</span>
                <span className="text-dc1-amber font-medium">{isRTL ? 'يدعم العربية' : 'Arabic-capable'}</span>
              </div>
              <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
                <span className="text-dc1-amber font-bold">⭐ {loading ? '…' : tierACount}</span>
                <span className="text-dc1-text-secondary">{isRTL ? 'الفئة A (مسبقة التسخين)' : 'Tier A (pre-warmed)'}</span>
              </div>
              <div className="flex items-center gap-2 bg-status-success/10 rounded-lg px-3 py-2 border border-status-success/20">
                <span className="text-status-success font-bold">{isRTL ? 'وفّر 33–51%' : 'Save 33–51%'}</span>
                <span className="text-dc1-text-secondary">{isRTL ? 'مقارنةً بـ AWS Bedrock' : 'vs AWS Bedrock'}</span>
              </div>
              {liveProviderCount !== null && (
                <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
                  <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${liveProviderCount > 0 ? 'bg-status-success animate-pulse' : 'bg-dc1-text-muted/40'}`} />
                  <span className={`font-bold ${liveProviderCount > 0 ? 'text-status-success' : 'text-dc1-text-muted'}`}>{liveProviderCount}</span>
                  <span className="text-dc1-text-secondary">{isRTL ? 'مزود متصل الآن' : 'providers live now'}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Pricing comparison bar */}
        <PricingComparisonBar isRTL={isRTL} />

        {/* Filters */}
        <section className="border-b border-dc1-border bg-dc1-surface-l1/50 sticky top-0 z-10 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dc1-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={isRTL ? 'ابحث عن نموذج…' : 'Search models…'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input ps-9 w-full text-sm"
              />
            </div>
            <select
              value={filterTask}
              onChange={e => setFilterTask(e.target.value as TaskFilter)}
              className="input text-sm w-auto"
            >
              <option value="all">{isRTL ? 'كل المهام' : 'All Tasks'}</option>
              <option value="chat">{isRTL ? 'محادثة / استدلال' : 'Chat / Inference'}</option>
              <option value="embedding">{isRTL ? 'تضمين' : 'Embeddings'}</option>
              <option value="reranking">{isRTL ? 'إعادة ترتيب' : 'Reranking'}</option>
              <option value="image">{isRTL ? 'توليد صور' : 'Image Generation'}</option>
            </select>
            <select
              value={filterTier}
              onChange={e => setFilterTier(e.target.value as 'all' | 'tier_a' | 'tier_b')}
              className="input text-sm w-auto"
            >
              <option value="all">{isRTL ? 'كل الفئات' : 'All Tiers'}</option>
              <option value="tier_a">{isRTL ? '⭐ الفئة A' : '⭐ Tier A'}</option>
              <option value="tier_b">{isRTL ? '✦ الفئة B' : '✦ Tier B'}</option>
            </select>
            <input
              type="number"
              min="0"
              step="8"
              placeholder={isRTL ? 'الحد الأدنى VRAM (جيجابايت)' : 'Min VRAM (GB)'}
              value={filterVram}
              onChange={e => setFilterVram(e.target.value)}
              className="input text-sm w-36"
            />
            <label className="flex items-center gap-2 text-sm text-dc1-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterArabic}
                onChange={e => setFilterArabic(e.target.checked)}
                className="rounded"
              />
              🌙 {isRTL ? 'العربية فقط' : 'Arabic only'}
            </label>
            <span className="text-xs text-dc1-text-muted whitespace-nowrap ms-auto">
              {loading ? (isRTL ? 'جارٍ التحميل…' : 'Loading…') : isRTL ? `${filtered.length} من ${models.length} نموذج` : `${filtered.length} of ${models.length} models`}
            </span>
          </div>
        </section>

        {/* Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Arabic RAG callout */}
          {!loading && !error && (
            <div className="mb-8 bg-dc1-amber/5 border border-dc1-amber/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="text-3xl">🌙</div>
              <div className="flex-1">
                <h3 className="font-bold text-dc1-text-primary mb-1">{isRTL ? 'خط RAG عربي بنقرة واحدة' : 'One-Click Arabic RAG Pipeline'}</h3>
                <p className="text-sm text-dc1-text-secondary">
                  {isRTL
                    ? 'حزمة جاهزة تشمل BGE-M3 للتضمين + BGE لإعادة الترتيب + ALLaM/JAIS لبناء استرجاع مستندات عربي متكامل ومتوافق مع PDPL.'
                    : 'Bundle BGE-M3 embeddings + BGE reranker + ALLaM/JAIS into a complete PDPL-compliant Arabic document retrieval stack. Saudi government, legal, and financial services — no other provider offers this locally.'}
                </p>
              </div>
              <Link href="/marketplace/templates?category=embedding" className="btn btn-primary shrink-0 text-sm">
                {isRTL ? 'عرض قوالب RAG العربية' : 'View Arabic RAG Templates'}
              </Link>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-dc1-text-secondary mb-2">{isRTL ? 'تعذر تحميل كتالوج النماذج.' : 'Failed to load model catalog.'}</p>
              <button onClick={() => window.location.reload()} className="btn btn-secondary btn-sm mt-2">{isRTL ? 'إعادة المحاولة' : 'Retry'}</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-dc1-text-secondary mb-1">{isRTL ? 'لا توجد نماذج تطابق عوامل التصفية.' : 'No models match your filters.'}</p>
              <button
                onClick={() => { setSearch(''); setFilterArabic(false); setFilterTask('all'); setFilterTier('all'); setFilterVram('') }}
                className="btn btn-outline btn-sm mt-3"
              >
                {isRTL ? 'مسح عوامل التصفية' : 'Clear filters'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map(m => <ModelCard key={m.model_id} model={m} isRTL={isRTL} />)}
            </div>
          )}
        </section>

        {/* Hyperscaler comparison table */}
        {!loading && !error && (
          <section className="border-t border-dc1-border bg-dc1-surface-l1">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <h2 className="text-xl font-bold text-dc1-text-primary mb-2">{isRTL ? 'اقتصاديات الشراء' : 'Buyer Economics'}</h2>
              <p className="text-dc1-text-secondary text-sm mb-6">
                {isRTL
                  ? 'يعتمد DCP على طاقة سعودية منخفضة التكلفة (0.048 دولار/كيلوواط ساعة مقابل 0.27 في أوروبا)، وينتقل التوفير مباشرة للمستأجرين.'
                  : 'DCP runs on Saudi energy (0.048 USD/kWh vs EU 0.27 USD/kWh). Providers pass the savings to renters.'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-dc1-border">
                      <th className="text-left py-3 px-4 text-dc1-text-muted font-medium">{isRTL ? 'فئة GPU' : 'GPU Tier'}</th>
                      <th className="text-right py-3 px-4 text-dc1-amber font-medium">{isRTL ? 'DCP (ريال/ساعة)' : 'DCP (SAR/hr)'}</th>
                      <th className="text-right py-3 px-4 text-dc1-text-muted font-medium">Vast.ai</th>
                      <th className="text-right py-3 px-4 text-dc1-text-muted font-medium">RunPod</th>
                      <th className="text-right py-3 px-4 text-dc1-text-muted font-medium">AWS Bedrock</th>
                      <th className="text-right py-3 px-4 text-status-success font-medium">{isRTL ? 'التوفير' : 'You Save'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRICING_COMPARISON.map(row => (
                      <tr key={row.gpu} className="border-b border-dc1-border/50 hover:bg-dc1-surface-l2/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-dc1-text-primary">{row.gpu}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-dc1-amber">{row.dcp_sar_hr.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-dc1-text-muted">{row.vast_sar_hr.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-dc1-text-muted">
                          {row.gpu === 'RTX 4090' ? '1.27' : row.gpu === 'A100 80GB' ? '7.46' : '12.34'}
                        </td>
                        <td className="py-3 px-4 text-right text-dc1-text-muted">
                          {row.gpu === 'RTX 4090' ? '—' : row.gpu === 'A100 80GB' ? '13.76' : '30.75'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-status-success">-{row.savings_pct}%</td>
                      </tr>
                    ))}
                    <tr className="bg-dc1-amber/5">
                      <td colSpan={6} className="py-3 px-4 text-xs text-dc1-text-muted italic">
                        {isRTL
                          ? '* الأسعار بالريال السعودي (1 دولار ≈ 3.75 ريال). أسعار DCP الأساسية حتى مارس 2026. نشر النماذج العربية يوفّر 33–51% مقارنةً بـ AWS Bedrock.'
                          : '* Prices in SAR (1 USD ≈ 3.75 SAR). DCP floor prices as of March 2026. Arabic model deployments save 33–51% vs AWS Bedrock on-demand inference.'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="border-t border-dc1-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
            <h2 className="text-2xl font-bold text-dc1-text-primary mb-3">
              {isRTL ? 'جاهز لنشر الذكاء الاصطناعي العربي؟' : 'Ready to deploy Arabic AI?'}
            </h2>
            <p className="text-dc1-text-secondary mb-6 max-w-lg mx-auto">
              {isRTL
                ? 'أنشئ حساب مستأجر وانشر أول نموذج خلال دقائق. بدون التزام مسبق وبدفع حسب الدقيقة.'
                : 'Create a renter account and deploy your first model in minutes. No upfront commitment — pay per minute.'}
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Link href="/renter/register?source=model_catalog" className="btn btn-primary">
                {isRTL ? 'ابدأ النشر' : 'Start Deploying'}
              </Link>
              <Link href="/marketplace/templates" className="btn btn-secondary">
                {isRTL ? 'تصفح القوالب' : 'Browse Templates'}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
