'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'

const API_BASE = '/api/dc1'

// ── Types ──────────────────────────────────────────────────────────────────────
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
  env_vars?: Array<{ key: string; label: string; default: string; required?: boolean }>
  // Derived fields from renter/templates
  category?: string
  estimatedMinutes?: number
  rateHalalaPerMin?: number
  model?: string
}

// ── Competitive pricing savings by VRAM tier (from strategic brief) ────────────
// DCP is 23.7-51% below hyperscalers depending on GPU tier and workload type.
// These savings percentages are used to estimate competitor equivalent pricing.
const VRAM_SAVINGS_TIERS: { minVram: number; savingsPct: number; gpuLabel: string }[] = [
  { minVram: 80, savingsPct: 40, gpuLabel: 'H100' },
  { minVram: 40, savingsPct: 33, gpuLabel: 'A100' },
  { minVram: 24, savingsPct: 28, gpuLabel: 'RTX 4090' },
  { minVram: 16, savingsPct: 24, gpuLabel: 'RTX 4080' },
  { minVram: 0,  savingsPct: 24, gpuLabel: 'GPU' },
]

function getVramSavings(vramGb: number | undefined): { savingsPct: number; gpuLabel: string } {
  const vram = vramGb ?? 0
  for (const tier of VRAM_SAVINGS_TIERS) {
    if (vram >= tier.minVram) return tier
  }
  return { savingsPct: 24, gpuLabel: 'GPU' }
}

// ── Category metadata ──────────────────────────────────────────────────────────
type CategoryKey = 'all' | 'llm' | 'embedding' | 'image' | 'training' | 'notebook'

const CATEGORIES: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: 'all', label: 'All Templates', emoji: '✦' },
  { key: 'llm', label: 'LLM / Inference', emoji: '🤖' },
  { key: 'embedding', label: 'Embeddings & RAG', emoji: '🔍' },
  { key: 'image', label: 'Image Generation', emoji: '🎨' },
  { key: 'training', label: 'Training & Fine-tune', emoji: '🎓' },
  { key: 'notebook', label: 'Notebooks & Dev', emoji: '📓' },
]

function getCategoryForTemplate(t: DockerTemplate): CategoryKey {
  const tags = (t.tags ?? []).map(x => x.toLowerCase())
  const id = t.id?.toLowerCase() ?? ''
  if (tags.includes('training') || id.includes('finetune') || id.includes('lora') || id.includes('qlora')) return 'training'
  if (tags.includes('embedding') || tags.includes('rag') || id.includes('embed') || id.includes('rerank')) return 'embedding'
  if (tags.includes('image') || id.includes('sdxl') || id.includes('stable-diffusion') || id.includes('sd')) return 'image'
  if (id.includes('jupyter') || id.includes('notebook') || id.includes('python-scientific')) return 'notebook'
  if (tags.includes('llm') || tags.includes('inference') || id.includes('llm') || id.includes('vllm') || id.includes('ollama')) return 'llm'
  return 'llm'
}

function getDifficultyBadge(difficulty?: string) {
  if (difficulty === 'advanced') return { label: 'Advanced', cls: 'bg-status-error/10 text-status-error border-status-error/20' }
  if (difficulty === 'medium') return { label: 'Intermediate', cls: 'bg-dc1-amber/10 text-dc1-amber border-dc1-amber/20' }
  return { label: 'Easy', cls: 'bg-status-success/10 text-status-success border-status-success/20' }
}

function getTierBadge(tier?: string) {
  if (tier === 'instant') return { label: '⚡ Instant', cls: 'bg-status-success/10 text-status-success border-status-success/20' }
  if (tier === 'cached') return { label: '🚀 Cached', cls: 'bg-status-info/10 text-status-info border-status-info/20' }
  return { label: 'On-Demand', cls: 'bg-dc1-surface-l3 text-dc1-text-secondary border-dc1-border' }
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
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

// ── Template Card ─────────────────────────────────────────────────────────────
function TemplateCard({ template }: { template: DockerTemplate }) {
  const [expanded, setExpanded] = useState(false)
  const difficulty = getDifficultyBadge(template.difficulty)
  const tierBadge = getTierBadge(template.tier)
  const hasArabic = (template.tags ?? []).some(t => t.toLowerCase().includes('arabic'))
  const priceHr = template.estimated_price_sar_per_hour ?? null
  const { savingsPct } = getVramSavings(template.min_vram_gb)
  const vastEquivPrice = priceHr !== null ? priceHr / (1 - savingsPct / 100) : null

  const deployHref = `/renter/register?template=${template.id}&source=marketplace_templates`

  return (
    <article className="bg-dc1-surface-l2 border border-dc1-border rounded-xl p-5 flex flex-col gap-3 hover:border-dc1-amber/30 hover:shadow-amber transition-all duration-200 group">
      {/* Header */}
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

      {/* Description */}
      <p className="text-sm text-dc1-text-secondary leading-relaxed line-clamp-2">{template.description}</p>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${difficulty.cls}`}>
          {difficulty.label}
        </span>
        {hasArabic && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-dc1-amber/10 text-dc1-amber border-dc1-amber/20">
            🌙 Arabic
          </span>
        )}
        {(template.tags ?? []).slice(0, 3).map((tag) => (
          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-dc1-surface-l3 text-dc1-text-muted border border-dc1-border">
            {tag}
          </span>
        ))}
      </div>

      {/* Specs */}
      <div className="bg-dc1-surface-l1 rounded-lg px-3 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs">
          {template.min_vram_gb && (
            <div>
              <span className="text-dc1-text-muted">VRAM</span>
              <span className="ml-1 font-semibold text-dc1-text-primary">{template.min_vram_gb} GB</span>
            </div>
          )}
          {template.job_type && (
            <div>
              <span className="text-dc1-text-muted">Type</span>
              <span className="ml-1 font-mono text-[10px] text-dc1-text-secondary">{template.job_type}</span>
            </div>
          )}
        </div>
        {priceHr !== null && (
          <div className="text-right">
            <p className="text-lg font-extrabold text-dc1-amber leading-none">
              {priceHr.toFixed(2)}
              <span className="text-xs font-normal text-dc1-text-secondary ml-1">SAR/hr</span>
            </p>
          </div>
        )}
      </div>

      {/* Competitive pricing comparison */}
      {priceHr !== null && vastEquivPrice !== null && (
        <div className="rounded-lg border border-status-success/20 bg-status-success/5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-dc1-text-muted uppercase tracking-wide mb-0.5">vs Vast.ai equivalent</p>
              <p className="text-xs text-dc1-text-secondary">
                <span className="line-through">{vastEquivPrice.toFixed(2)} SAR/hr</span>
                <span className="ml-1 text-dc1-text-muted text-[10px]">(est.)</span>
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-status-success/10 border border-status-success/30 text-status-success text-xs font-bold">
              ↓ {savingsPct}% cheaper
            </span>
          </div>
        </div>
      )}

      {/* Expandable params */}
      {template.params && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-dc1-text-muted hover:text-dc1-text-primary transition-colors"
        >
          <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {expanded ? 'Hide' : 'View'} parameters
        </button>
      )}
      {expanded && template.params && (
        <pre className="text-[10px] font-mono text-dc1-text-secondary bg-dc1-surface-l1 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap">
          {JSON.stringify(template.params, null, 2)}
        </pre>
      )}

      {/* CTA */}
      <Link
        href={deployHref}
        className="btn btn-primary w-full text-center text-sm mt-auto"
      >
        Deploy Now
      </Link>
    </article>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketplaceTemplatesPage() {
  const [templates, setTemplates] = useState<DockerTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')
  const [search, setSearch] = useState('')
  const [filterVram, setFilterVram] = useState('')
  const [filterArabic, setFilterArabic] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/templates`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const list: DockerTemplate[] = Array.isArray(data?.templates) ? data.templates : []
        setTemplates(list)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (activeCategory !== 'all' && getCategoryForTemplate(t) !== activeCategory) return false
      if (filterArabic && !(t.tags ?? []).some(tag => tag.toLowerCase().includes('arabic'))) return false
      if (filterVram !== '') {
        const minVram = parseInt(filterVram, 10)
        if (!isNaN(minVram) && (t.min_vram_gb ?? 0) < minVram) return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${t.name} ${t.description} ${(t.tags ?? []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [templates, activeCategory, filterVram, filterArabic, search])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-dc1-border bg-gradient-to-b from-dc1-amber/5 to-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center gap-2 mb-3">
              <Link href="/marketplace" className="text-sm text-dc1-text-muted hover:text-dc1-amber transition-colors">Marketplace</Link>
              <span className="text-dc1-text-muted">/</span>
              <span className="text-sm text-dc1-text-primary font-medium">Templates</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-3">
              GPU Workload Templates
            </h1>
            <p className="text-dc1-text-secondary text-lg mb-6 max-w-2xl">
              20 pre-configured templates for LLM inference, Arabic RAG, image generation, fine-tuning, and more.
              One-click deploy on Saudi GPUs at up to 51% below hyperscaler prices.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
                <span className="text-dc1-amber font-bold">{templates.length}</span>
                <span className="text-dc1-text-secondary">templates available</span>
              </div>
              <div className="flex items-center gap-2 bg-dc1-amber/10 rounded-lg px-3 py-2 border border-dc1-amber/20">
                <span className="text-dc1-amber font-bold">🌙</span>
                <span className="text-dc1-amber font-medium">Arabic-capable models included</span>
              </div>
              <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
                <span className="text-status-success font-bold">⚡</span>
                <span className="text-dc1-text-secondary">Instant-tier pre-warmed</span>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs + Filters */}
        <section className="border-b border-dc1-border bg-dc1-surface-l1/50 sticky top-0 z-10 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Category tabs */}
            <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    activeCategory === cat.key
                      ? 'bg-dc1-amber text-white border-dc1-amber'
                      : 'bg-transparent text-dc1-text-secondary border-dc1-border hover:border-dc1-amber/40 hover:text-dc1-text-primary'
                  }`}
                >
                  <span className="mr-1">{cat.emoji}</span>
                  {cat.label}
                  {cat.key !== 'all' && (
                    <span className="ml-1 opacity-60 text-xs">
                      ({templates.filter(t => getCategoryForTemplate(t) === cat.key).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
            {/* Search + filters row */}
            <div className="flex flex-wrap gap-3 pb-3 items-center">
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
              <input
                type="number"
                min="0"
                step="4"
                placeholder="Min VRAM (GB)"
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
                🌙 Arabic only
              </label>
              <span className="text-xs text-dc1-text-muted whitespace-nowrap ms-auto">
                {loading ? 'Loading…' : `${filtered.length} of ${templates.length}`}
              </span>
            </div>
          </div>
        </section>

        {/* Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-dc1-text-secondary mb-2">Failed to load templates.</p>
              <button onClick={() => window.location.reload()} className="btn btn-secondary btn-sm mt-2">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-dc1-text-secondary mb-1">No templates match your filters.</p>
              <button
                onClick={() => { setSearch(''); setFilterVram(''); setFilterArabic(false); setActiveCategory('all') }}
                className="btn btn-outline btn-sm mt-3"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map(t => <TemplateCard key={t.id} template={t} />)}
            </div>
          )}
        </section>

        {/* CTA */}
        <section className="border-t border-dc1-border bg-dc1-surface-l1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
            <h2 className="text-2xl font-bold text-dc1-text-primary mb-3">
              Don't see what you need?
            </h2>
            <p className="text-dc1-text-secondary mb-6 max-w-lg mx-auto">
              Deploy any custom Docker container or contact us for enterprise Arabic AI deployments with PDPL compliance.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Link href="/renter/register?template=custom-container" className="btn btn-primary">
                Custom Container Deploy
              </Link>
              <Link href="/marketplace/models" className="btn btn-secondary">
                Browse Model Catalog
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
