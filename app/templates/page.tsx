'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import TemplateCard, { type DockerTemplate } from '../components/TemplateCard'
import TemplateFilter, {
  FILTER_DEFAULTS,
  type CategoryKey,
  type FilterState,
  type VramKey,
  type ArabicKey,
  type SpeedKey,
} from '../components/TemplateFilter'
import DeployModal from '../components/DeployModal'

const API_BASE = '/api/dc1'

// ── Category classification (mirrors backend CATEGORY_TAG_MAP) ─────────────────
function getCategoryForTemplate(t: DockerTemplate): CategoryKey {
  const tags = (t.tags ?? []).map(x => x.toLowerCase())
  const id = t.id?.toLowerCase() ?? ''
  if (tags.includes('training') || id.includes('finetune') || id.includes('lora') || id.includes('qlora')) return 'training'
  if (tags.includes('embedding') || tags.includes('rag') || id.includes('embed') || id.includes('rerank')) return 'embedding'
  if (tags.includes('image') || id.includes('sdxl') || id.includes('stable-diffusion')) return 'image'
  if (id.includes('jupyter') || id.includes('notebook') || id.includes('python-scientific')) return 'notebook'
  return 'llm'
}

// ── Fuzzy search matching ─────────────────────────────────────────────────────
function matchesSearch(t: DockerTemplate, query: string): boolean {
  if (!query.trim()) return true
  const q = query.toLowerCase().trim()
  const haystack = [
    t.name,
    t.description,
    t.id,
    ...(t.tags ?? []),
    t.tier ?? '',
    t.job_type ?? '',
    t.min_vram_gb ? `${t.min_vram_gb}gb` : '',
  ].join(' ').toLowerCase()

  // Multi-word support: all words must match
  return q.split(/\s+/).every(word => haystack.includes(word))
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-dc1-surface-l2 border border-dc1-border rounded-xl p-5 flex flex-col gap-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-5 bg-dc1-surface-l3 rounded w-2/3" />
        <div className="h-5 bg-dc1-surface-l3 rounded-full w-16" />
      </div>
      <div className="h-3 bg-dc1-surface-l3 rounded w-full" />
      <div className="h-3 bg-dc1-surface-l3 rounded w-4/5" />
      <div className="h-10 bg-dc1-surface-l3 rounded-lg" />
      <div className="h-8 bg-dc1-surface-l3 rounded-lg" />
      <div className="h-9 bg-dc1-surface-l3 rounded-md" />
    </div>
  )
}

// ── URL param helpers ─────────────────────────────────────────────────────────
function filtersFromParams(params: URLSearchParams): FilterState {
  return {
    category: (params.get('category') as CategoryKey) ?? FILTER_DEFAULTS.category,
    vram: (params.get('vram') as VramKey) ?? FILTER_DEFAULTS.vram,
    arabic: (params.get('arabic') as ArabicKey) ?? FILTER_DEFAULTS.arabic,
    speed: (params.get('speed') as SpeedKey) ?? FILTER_DEFAULTS.speed,
    search: params.get('q') ?? FILTER_DEFAULTS.search,
  }
}

function paramsFromFilters(filters: FilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.category !== 'all') p.set('category', filters.category)
  if (filters.vram) p.set('vram', filters.vram)
  if (filters.arabic !== 'all') p.set('arabic', filters.arabic)
  if (filters.speed) p.set('speed', filters.speed)
  if (filters.search.trim()) p.set('q', filters.search.trim())
  return p
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TemplateCatalogPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [templates, setTemplates] = useState<DockerTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filters, setFilters] = useState<FilterState>(() => filtersFromParams(searchParams))
  const [deployTarget, setDeployTarget] = useState<DockerTemplate | null>(null)

  // Sync URL params when filters change (debounced for search)
  const updateFilters = useCallback((next: FilterState) => {
    setFilters(next)
    const p = paramsFromFilters(next)
    const qs = p.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }, [router])

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

  // ── Filter logic ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return templates.filter(t => {
      // Category
      if (filters.category !== 'all' && getCategoryForTemplate(t) !== filters.category) return false

      // VRAM
      if (filters.vram) {
        const minVram = parseInt(filters.vram, 10)
        if (!isNaN(minVram) && (t.min_vram_gb ?? 0) < minVram) return false
      }

      // Arabic
      if (filters.arabic === 'arabic') {
        const hasArabic = (t.tags ?? []).some(tag => tag.toLowerCase().includes('arabic'))
        if (!hasArabic) return false
      }

      // Speed tier
      if (filters.speed) {
        const tier = t.tier?.toLowerCase() ?? 'on-demand'
        if (filters.speed === 'instant' && tier !== 'instant') return false
        if (filters.speed === 'cached' && tier !== 'cached') return false
        if (filters.speed === 'on-demand' && (tier === 'instant' || tier === 'cached')) return false
      }

      // Search
      if (!matchesSearch(t, filters.search)) return false

      return true
    })
  }, [templates, filters])

  // ── Category counts for filter display ───────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryKey, number> = { all: templates.length, llm: 0, embedding: 0, image: 0, training: 0, notebook: 0 }
    for (const t of templates) {
      const cat = getCategoryForTemplate(t)
      counts[cat] = (counts[cat] ?? 0) + 1
    }
    return counts
  }, [templates])

  const arabicCount = useMemo(() =>
    templates.filter(t => (t.tags ?? []).some(tag => tag.toLowerCase().includes('arabic'))).length,
    [templates]
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* ── Hero section ── */}
        <section className="border-b border-dc1-border bg-gradient-to-b from-dc1-amber/5 to-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-4 text-sm">
              <Link href="/" className="text-dc1-text-muted hover:text-dc1-amber transition-colors">Home</Link>
              <span className="text-dc1-text-muted">/</span>
              <span className="text-dc1-text-primary font-medium">Templates</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-3">
              GPU Workload Templates
            </h1>
            <p className="text-dc1-text-secondary text-lg mb-6 max-w-2xl">
              {templates.length > 0 ? templates.length : '20'}+ pre-configured templates for LLM inference,
              Arabic RAG, image generation, fine-tuning, and more.
              One-click deploy on Saudi GPUs at up to 51% below hyperscaler prices.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-3 text-sm">
              {!loading && (
                <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
                  <span className="text-dc1-amber font-bold">{templates.length}</span>
                  <span className="text-dc1-text-secondary">templates available</span>
                </div>
              )}
              {arabicCount > 0 && (
                <div className="flex items-center gap-2 bg-dc1-amber/10 rounded-lg px-3 py-2 border border-dc1-amber/20">
                  <span className="text-dc1-amber">🌙</span>
                  <span className="text-dc1-amber font-medium">{arabicCount} Arabic AI templates</span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-dc1-surface-l1 rounded-lg px-3 py-2 border border-dc1-border">
                <span className="text-status-success font-bold">⚡</span>
                <span className="text-dc1-text-secondary">Instant-tier pre-warmed</span>
              </div>
              <div className="flex items-center gap-2 bg-status-success/10 rounded-lg px-3 py-2 border border-status-success/20">
                <span className="text-status-success font-bold">↓</span>
                <span className="text-status-success font-medium">Up to 51% below hyperscalers</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Content: sidebar + grid ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8 items-start">
            {/* Filter sidebar (desktop) / button (mobile) */}
            <TemplateFilter
              filters={filters}
              onChange={updateFilters}
              totalCount={templates.length}
              filteredCount={filtered.length}
              categoryCounts={categoryCounts}
            />

            {/* Template grid */}
            <div className="flex-1 min-w-0">
              {/* Mobile search bar */}
              <div className="lg:hidden mb-4 relative">
                <svg
                  className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dc1-text-muted pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search templates…"
                  value={filters.search}
                  onChange={e => updateFilters({ ...filters, search: e.target.value })}
                  className="input ps-9 w-full text-sm"
                />
              </div>

              {/* Result count + clear */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-dc1-text-muted" role="status" aria-live="polite">
                  {loading ? 'Loading…' : (
                    filtered.length === templates.length
                      ? `Showing all ${templates.length} templates`
                      : `Showing ${filtered.length} of ${templates.length} templates`
                  )}
                </p>
                {!loading && filtered.length < templates.length && (
                  <button
                    onClick={() => updateFilters(FILTER_DEFAULTS)}
                    className="text-xs text-dc1-amber hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {/* States */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {[...Array(9)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : error ? (
                <div className="text-center py-20 space-y-3">
                  <p className="text-dc1-text-secondary">Failed to load templates.</p>
                  <button onClick={() => window.location.reload()} className="btn btn-secondary btn-sm">
                    Retry
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-20 space-y-3">
                  <p className="text-2xl text-dc1-text-muted">🔍</p>
                  <p className="text-dc1-text-secondary">No templates match your filters.</p>
                  <button
                    onClick={() => updateFilters(FILTER_DEFAULTS)}
                    className="btn btn-outline btn-sm"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filtered.map(t => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      onDeploy={setDeployTarget}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="border-t border-dc1-border bg-dc1-surface-l1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
            <h2 className="text-2xl font-bold text-dc1-text-primary mb-3">
              Don't see what you need?
            </h2>
            <p className="text-dc1-text-secondary mb-6 max-w-lg mx-auto">
              Deploy any custom Docker container or contact us for enterprise Arabic AI deployments
              with PDPL compliance.
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

      {/* Deploy modal */}
      <DeployModal
        template={deployTarget}
        onClose={() => setDeployTarget(null)}
      />
    </div>
  )
}
