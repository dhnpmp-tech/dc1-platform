'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useLanguage } from '../../lib/i18n'

const API_BASE = '/api/dc1'

// ── Nav icon components ───────────────────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────────
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
  template_id?: string | null
}

type TaskFilter = 'all' | 'chat' | 'embedding' | 'reranking' | 'image'

// ── Helpers ───────────────────────────────────────────────────────────────────
function isArabicModel(model: ModelListItem): boolean {
  const id = model.model_id?.toLowerCase() ?? ''
  const family = model.family?.toLowerCase() ?? ''
  return (
    id.includes('allam') || id.includes('jais') || id.includes('arabic') ||
    family.includes('arabic') || family.includes('allam') || family.includes('jais') ||
    (model.use_cases ?? []).some(u => u.toLowerCase().includes('arabic'))
  )
}

function getTaskType(model: ModelListItem): string {
  const id = model.model_id?.toLowerCase() ?? ''
  const uses = (model.use_cases ?? []).map(u => u.toLowerCase())
  if (id.includes('embed') || uses.some(u => u.includes('embed'))) return 'embedding'
  if (id.includes('rerank') || uses.some(u => u.includes('rerank'))) return 'reranking'
  if (id.includes('sdxl') || id.includes('stable-diff') || uses.some(u => u.includes('image'))) return 'image'
  return 'chat'
}

function getTierBadge(tier?: string | null) {
  if (tier === 'tier_a') return { label: '⭐ Tier A', cls: 'bg-dc1-amber/10 text-dc1-amber border-dc1-amber/30' }
  if (tier === 'tier_b') return { label: '✦ Tier B', cls: 'bg-status-info/10 text-status-info border-status-info/30' }
  return null
}

function getPrewarmBadge(prewarm?: string | null) {
  if (prewarm === 'hot') return { label: '🔥 Hot', cls: 'bg-status-error/10 text-status-error border-status-error/20' }
  if (prewarm === 'warm') return { label: '♨ Warm', cls: 'bg-dc1-amber/10 text-dc1-amber border-dc1-amber/20' }
  return null
}

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
function ModelCard({ model }: { model: ModelListItem }) {
  const arabic = isArabicModel(model)
  const tierBadge = getTierBadge(model.tier)
  const prewarmBadge = getPrewarmBadge(model.prewarm_class)
  const taskType = getTaskType(model)
  const priceHr = model.avg_price_sar_per_min ? (model.avg_price_sar_per_min * 60).toFixed(2) : null
  const vram = model.min_gpu_vram_gb ?? model.vram_gb

  // Prefer linking to a matching template; fall back to model-based job submission
  const deployHref = model.template_id
    ? `/renter/register?template=${encodeURIComponent(model.template_id)}&source=renter_models`
    : `/renter/register?model=${encodeURIComponent(model.model_id)}&source=renter_models`

  return (
    <article className="bg-dc1-surface-l2 border border-dc1-border rounded-xl p-5 flex flex-col gap-3 hover:border-dc1-amber/30 hover:shadow-amber transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-dc1-text-primary group-hover:text-dc1-amber transition-colors leading-tight truncate">
            {model.display_name}
          </h3>
          <p className="text-xs text-dc1-text-muted font-mono mt-0.5 truncate">{model.model_id}</p>
        </div>
        {arabic && (
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium bg-dc1-amber/10 text-dc1-amber border-dc1-amber/20">
            🌙 Arabic
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
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-dc1-surface-l3 text-dc1-text-muted border border-dc1-border capitalize">
          {taskType}
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

      {/* Specs + Pricing */}
      <div className="bg-dc1-surface-l1 rounded-lg px-3 py-2.5 grid grid-cols-2 gap-2 text-xs">
        {vram && (
          <div>
            <p className="text-dc1-text-muted uppercase tracking-wide text-[9px]">VRAM</p>
            <p className="font-semibold text-dc1-text-primary">{vram} GB</p>
          </div>
        )}
        {model.context_window && (
          <div>
            <p className="text-dc1-text-muted uppercase tracking-wide text-[9px]">Context</p>
            <p className="font-semibold text-dc1-text-primary">{(model.context_window / 1000).toFixed(0)}K tokens</p>
          </div>
        )}
        {model.providers_online !== undefined && (
          <div>
            <p className="text-dc1-text-muted uppercase tracking-wide text-[9px]">Providers</p>
            <p className={`font-semibold ${(model.providers_online ?? 0) > 0 ? 'text-status-success' : 'text-dc1-text-muted'}`}>
              {model.providers_online ?? 0} online
            </p>
          </div>
        )}
        {priceHr !== null && (
          <div>
            <p className="text-dc1-text-muted uppercase tracking-wide text-[9px]">DCP Price</p>
            <p className="font-extrabold text-dc1-amber">
              {priceHr} <span className="text-[9px] font-normal text-dc1-text-muted">SAR/hr</span>
            </p>
          </div>
        )}
      </div>

      {/* Arabic savings callout */}
      {arabic && (
        <div className="bg-status-success/5 border border-status-success/20 rounded-lg px-3 py-2 text-xs">
          <span className="text-status-success font-semibold">Save up to 51%</span>
          <span className="text-dc1-text-muted ml-1">vs AWS Bedrock</span>
        </div>
      )}

      {/* CTA */}
      <Link
        href={deployHref}
        className="btn btn-primary w-full text-center text-sm mt-auto min-h-[44px] flex items-center justify-center"
      >
        Deploy Model
      </Link>
    </article>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RenterModelsPage() {
  const router = useRouter()
  const { t } = useLanguage()

  const [models, setModels] = useState<ModelListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [filterArabic, setFilterArabic] = useState(false)
  const [filterTask, setFilterTask] = useState<TaskFilter>('all')
  const [filterVram, setFilterVram] = useState('')
  const [filterTier, setFilterTier] = useState<'all' | 'tier_a' | 'tier_b'>('all')

  const navItems = [
    { label: t('nav.dashboard') || 'Dashboard', href: '/renter', icon: <HomeIcon /> },
    { label: t('nav.marketplace') || 'Marketplace', href: '/renter/marketplace', icon: <MarketplaceIcon /> },
    { label: 'Models', href: '/renter/models', icon: <ModelsIcon /> },
    { label: t('nav.jobs') || 'Jobs', href: '/renter/jobs', icon: <JobsIcon /> },
    { label: t('nav.billing') || 'Billing', href: '/renter/billing', icon: <BillingIcon /> },
    { label: t('nav.settings') || 'Settings', href: '/renter/settings', icon: <GearIcon /> },
  ]

  useEffect(() => {
    const key = localStorage.getItem('dc1_renter_key') || localStorage.getItem('dc1_api_key')
    if (!key) {
      router.push('/login?role=renter&reason=missing_credentials')
      return
    }

    fetch(`${API_BASE}/models`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const list: ModelListItem[] = Array.isArray(data) ? data : []
        setModels(list)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [router])

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
    <DashboardLayout navItems={navItems} role="renter">
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-dc1-text-primary">Arabic AI Model Catalog</h1>
            <p className="text-sm text-dc1-text-secondary mt-1">
              Deploy Arabic-capable LLMs, embeddings, and rerankers on Saudi GPUs.
            </p>
          </div>
          <Link href="/renter/marketplace" className="btn btn-secondary btn-sm self-start sm:self-auto">
            ← Back to Marketplace
          </Link>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
            <span className="text-dc1-amber font-bold">{loading ? '…' : models.length}</span>
            <span className="text-dc1-text-secondary">models available</span>
          </div>
          <div className="flex items-center gap-2 bg-dc1-amber/10 rounded-lg px-3 py-2 border border-dc1-amber/20">
            <span className="text-dc1-amber font-bold">🌙 {loading ? '…' : arabicCount}</span>
            <span className="text-dc1-amber font-medium">Arabic-capable</span>
          </div>
          <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
            <span className="text-dc1-amber font-bold">⭐ {loading ? '…' : tierACount}</span>
            <span className="text-dc1-text-secondary">Tier A (pre-warmed)</span>
          </div>
          <div className="flex items-center gap-2 bg-status-success/10 rounded-lg px-3 py-2 border border-status-success/20">
            <span className="text-status-success font-bold">Save 33–51%</span>
            <span className="text-dc1-text-secondary">vs AWS Bedrock</span>
          </div>
        </div>

        {/* Arabic RAG callout */}
        {!loading && !error && arabicCount > 0 && (
          <div className="bg-dc1-amber/5 border border-dc1-amber/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="text-3xl">🌙</div>
            <div className="flex-1">
              <h3 className="font-bold text-dc1-text-primary mb-1">One-Click Arabic RAG Pipeline</h3>
              <p className="text-sm text-dc1-text-secondary">
                Bundle BGE-M3 embeddings + BGE reranker + ALLaM/JAIS into a complete PDPL-compliant Arabic document retrieval stack.
              </p>
            </div>
            <Link href="/marketplace/templates?category=embedding" className="btn btn-primary shrink-0 text-sm">
              View Arabic RAG Templates
            </Link>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center p-4 bg-dc1-surface-l1 rounded-xl border border-dc1-border">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dc1-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search models…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input ps-9 w-full text-sm"
            />
          </div>
          <select
            value={filterTask}
            onChange={e => setFilterTask(e.target.value as TaskFilter)}
            className="input text-sm w-auto min-h-[44px]"
          >
            <option value="all">All Tasks</option>
            <option value="chat">Chat / Inference</option>
            <option value="embedding">Embeddings</option>
            <option value="reranking">Reranking</option>
            <option value="image">Image Generation</option>
          </select>
          <select
            value={filterTier}
            onChange={e => setFilterTier(e.target.value as 'all' | 'tier_a' | 'tier_b')}
            className="input text-sm w-auto min-h-[44px]"
          >
            <option value="all">All Tiers</option>
            <option value="tier_a">⭐ Tier A</option>
            <option value="tier_b">✦ Tier B</option>
          </select>
          <input
            type="number"
            min="0"
            step="8"
            placeholder="Min VRAM (GB)"
            value={filterVram}
            onChange={e => setFilterVram(e.target.value)}
            className="input text-sm w-36 min-h-[44px]"
          />
          <label className="flex items-center gap-2 text-sm text-dc1-text-secondary cursor-pointer select-none min-h-[44px]">
            <input
              type="checkbox"
              checked={filterArabic}
              onChange={e => setFilterArabic(e.target.checked)}
              className="rounded"
            />
            🌙 Arabic only
          </label>
          <span className="text-xs text-dc1-text-muted whitespace-nowrap ms-auto">
            {loading ? 'Loading…' : `${filtered.length} of ${models.length} models`}
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-dc1-text-secondary mb-2">Failed to load model catalog.</p>
            <button onClick={() => window.location.reload()} className="btn btn-secondary btn-sm mt-2">
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-dc1-text-secondary mb-1">No models match your filters.</p>
            <button
              onClick={() => { setSearch(''); setFilterArabic(false); setFilterTask('all'); setFilterTier('all'); setFilterVram('') }}
              className="btn btn-outline btn-sm mt-3"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(m => <ModelCard key={m.model_id} model={m} />)}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
