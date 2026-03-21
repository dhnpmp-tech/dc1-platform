'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatusBadge from '../../components/ui/StatusBadge'
import { getApiBase, getRenterKey } from '../../../lib/api'
import { useLanguage } from '../../lib/i18n'

// ── SVG Icons ──────────────────────────────────────────────────────────────
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 5v14a1 1 0 001 1h12a1 1 0 001-1V5m-9 9h4" />
  </svg>
)
const LightningIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)
const CurrencyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)
const GpuCompareIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
)

// ── Types ───────────────────────────────────────────────────────────────────
interface ProviderEntry {
  id: number
  name: string
  gpu_model: string
  vram_gb: number | null
  vram_mib: number | null
  gpu_count: number
  driver_version: string | null
  compute_capability: string | null
  cuda_version: string | null
  status: string
  is_live: boolean
  heartbeat_age_seconds: number | null
  location: string | null
  run_mode: string | null
  reliability_score: number | null
  uptime_percent: number | null
  total_jobs_completed: number | null
  cached_models: string[]
  cost_rates_halala_per_min: Record<string, number>
}

type SortKey = 'vram' | 'reliability' | 'jobs' | 'cost'

// ── Helpers ─────────────────────────────────────────────────────────────────
function costSAR(halala: number): string {
  return (halala / 100).toFixed(2)
}

function UtilBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-dc1-text-muted">{label}</span>
        <span className="text-dc1-text-primary font-medium">{value}%</span>
      </div>
      <div className="h-1.5 bg-dc1-surface-l2 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function GpuComparisonPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [providers, setProviders] = useState<ProviderEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortKey>('vram')
  const [filterGpu, setFilterGpu] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const navItems = [
    { label: t('nav.dashboard'), href: '/renter', icon: <HomeIcon /> },
    { label: t('nav.jobs'), href: '/renter/jobs', icon: <LightningIcon /> },
    { label: t('nav.marketplace'), href: '/renter/marketplace', icon: <GpuCompareIcon /> },
    { label: t('renter.gpu_compare.nav'), href: '/renter/gpu-comparison', icon: <ChartIcon /> },
    { label: t('nav.billing'), href: '/renter/billing', icon: <CurrencyIcon /> },
    { label: t('nav.analytics'), href: '/renter/analytics', icon: <ChartIcon /> },
    { label: t('nav.settings'), href: '/renter/settings', icon: <GearIcon /> },
  ]

  useEffect(() => {
    const key = getRenterKey()
    if (!key) {
      router.push('/login')
      return
    }
    const base = getApiBase()
    const fetchProviders = async () => {
      try {
        const res = await fetch(`${base}/providers/available`, {
          headers: { 'x-renter-key': key },
        })
        if (res.ok) {
          const data = await res.json()
          setProviders(data.providers || [])
        }
      } catch (err) {
        console.error('Failed to fetch providers:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProviders()
    const interval = setInterval(fetchProviders, 30_000)
    return () => clearInterval(interval)
  }, [router])

  // Unique GPU models for filter
  const gpuModels = Array.from(new Set(providers.map(p => p.gpu_model).filter(Boolean))).sort()

  // Filter + sort
  const filtered = providers
    .filter(p => !filterGpu || p.gpu_model === filterGpu)
    .sort((a, b) => {
      if (sortBy === 'vram') return (b.vram_gb ?? 0) - (a.vram_gb ?? 0)
      if (sortBy === 'reliability') return (b.reliability_score ?? 0) - (a.reliability_score ?? 0)
      if (sortBy === 'jobs') return (b.total_jobs_completed ?? 0) - (a.total_jobs_completed ?? 0)
      if (sortBy === 'cost') {
        const aRate = a.cost_rates_halala_per_min?.llm_inference ?? 0
        const bRate = b.cost_rates_halala_per_min?.llm_inference ?? 0
        return aRate - bRate // cheapest first
      }
      return 0
    })

  const selected = filtered.filter(p => selectedIds.has(p.id))

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 4) next.add(id) // limit to 4
      return next
    })
  }

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} role="renter" userName="Renter">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-dc1-surface-l2 rounded skeleton" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-dc1-surface-l2 rounded skeleton" />)}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout navItems={navItems} role="renter" userName="Renter">
      <div className="space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-dc1-text-primary">{t('renter.gpu_compare.title')}</h1>
            <p className="text-dc1-text-secondary mt-1">
              {filtered.length} {t('renter.gpu_compare.providers_available')}
              {selectedIds.size > 0 && ` · ${selectedIds.size} selected for comparison`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode(v => v === 'grid' ? 'table' : 'grid')}
              className="px-3 py-2 text-sm bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary rounded-lg transition-colors"
            >
              {viewMode === 'grid' ? t('renter.gpu_compare.table_view') : t('renter.gpu_compare.grid_view')}
            </button>
          </div>
        </div>

        {/* Filters + Sort */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterGpu}
            onChange={e => setFilterGpu(e.target.value)}
            className="px-3 py-2 text-sm bg-dc1-surface-l2 border border-dc1-border text-dc1-text-primary rounded-lg focus:outline-none focus:border-dc1-amber"
          >
            <option value="">{t('renter.gpu_compare.all_gpu_models')}</option>
            {gpuModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <div className="flex gap-1 bg-dc1-surface-l2 p-1 rounded-lg">
            {([
              { key: 'vram' as SortKey, label: 'Most VRAM' },
              { key: 'reliability' as SortKey, label: 'Reliability' },
              { key: 'jobs' as SortKey, label: 'Experience' },
              { key: 'cost' as SortKey, label: 'Cheapest' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${
                  sortBy === key ? 'bg-dc1-amber text-dc1-void' : 'text-dc1-text-secondary hover:text-dc1-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-2 text-sm text-dc1-text-muted hover:text-dc1-text-primary transition-colors"
            >
              {t('renter.gpu_compare.clear_selection')}
            </button>
          )}
        </div>

        {/* Side-by-side comparison panel (when 2–4 selected) */}
        {selected.length >= 2 && (
          <div className="card">
            <h2 className="section-heading mb-4">{t('renter.gpu_compare.side_by_side')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dc1-border">
                    <th className="text-left py-2 pr-4 text-dc1-text-muted font-medium w-36">Spec</th>
                    {selected.map(p => (
                      <th key={p.id} className="text-left py-2 px-4 text-dc1-text-primary font-semibold">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-dc1-border">
                  {[
                    { label: 'GPU', fn: (p: ProviderEntry) => p.gpu_model || '—' },
                    { label: 'VRAM', fn: (p: ProviderEntry) => p.vram_gb ? `${p.vram_gb} GB` : '—' },
                    { label: 'GPU Count', fn: (p: ProviderEntry) => String(p.gpu_count) },
                    { label: 'CUDA', fn: (p: ProviderEntry) => p.cuda_version || '—' },
                    { label: 'Compute Cap', fn: (p: ProviderEntry) => p.compute_capability || '—' },
                    { label: 'Driver', fn: (p: ProviderEntry) => p.driver_version || '—' },
                    { label: 'Reliability', fn: (p: ProviderEntry) => p.reliability_score != null ? `${p.reliability_score}%` : '—' },
                    { label: 'Uptime', fn: (p: ProviderEntry) => p.uptime_percent != null ? `${p.uptime_percent}%` : '—' },
                    { label: 'Jobs done', fn: (p: ProviderEntry) => String(p.total_jobs_completed ?? 0) },
                    {
                      label: 'LLM cost/min',
                      fn: (p: ProviderEntry) => p.cost_rates_halala_per_min?.llm_inference
                        ? `${costSAR(p.cost_rates_halala_per_min.llm_inference)} SAR`
                        : '—',
                    },
                    {
                      label: 'Image cost/min',
                      fn: (p: ProviderEntry) => p.cost_rates_halala_per_min?.image_generation
                        ? `${costSAR(p.cost_rates_halala_per_min.image_generation)} SAR`
                        : '—',
                    },
                    { label: 'Location', fn: (p: ProviderEntry) => p.location || 'SA' },
                    { label: 'Status', fn: (p: ProviderEntry) => p.is_live ? 'Live' : 'Offline' },
                  ].map(({ label, fn }) => (
                    <tr key={label} className="hover:bg-dc1-surface-l2/50">
                      <td className="py-2 pr-4 text-dc1-text-muted">{label}</td>
                      {selected.map(p => (
                        <td key={p.id} className="py-2 px-4 text-dc1-text-primary">{fn(p)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tip when no providers selected */}
        {selected.length < 2 && filtered.length > 1 && (
          <p className="text-xs text-dc1-text-muted">
            {t('renter.gpu_compare.select_hint')}
          </p>
        )}

        {/* No providers */}
        {filtered.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-dc1-text-secondary">{t('renter.gpu_compare.no_match')}</p>
          </div>
        )}

        {/* Grid / Table */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => {
              const isSelected = selectedIds.has(p.id)
              const llmCostPerMin = p.cost_rates_halala_per_min?.llm_inference
              const imgCostPerMin = p.cost_rates_halala_per_min?.image_generation
              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`card cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'border-dc1-amber/60 ring-1 ring-dc1-amber/40'
                      : 'hover:border-dc1-border-light'
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-dc1-text-primary truncate">{p.name}</h3>
                        {p.is_live
                          ? <span className="flex items-center gap-1 text-xs text-status-success"><span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />Live</span>
                          : <span className="flex items-center gap-1 text-xs text-dc1-text-muted"><span className="w-1.5 h-1.5 rounded-full bg-dc1-surface-l3" />Offline</span>
                        }
                      </div>
                      <p className="text-sm text-dc1-text-secondary mt-0.5 truncate">{p.gpu_model}</p>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-dc1-amber flex items-center justify-center flex-shrink-0 ml-2">
                        <svg className="w-3 h-3 text-dc1-void" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Spec pills */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {p.vram_gb && (
                      <span className="px-2 py-0.5 text-xs bg-dc1-amber/10 text-dc1-amber rounded-full font-medium">
                        {p.vram_gb} GB VRAM
                      </span>
                    )}
                    {p.gpu_count > 1 && (
                      <span className="px-2 py-0.5 text-xs bg-dc1-surface-l2 text-dc1-text-secondary rounded-full">
                        ×{p.gpu_count} GPUs
                      </span>
                    )}
                    {p.cuda_version && (
                      <span className="px-2 py-0.5 text-xs bg-dc1-surface-l2 text-dc1-text-secondary rounded-full">
                        CUDA {p.cuda_version}
                      </span>
                    )}
                    {p.compute_capability && (
                      <span className="px-2 py-0.5 text-xs bg-dc1-surface-l2 text-dc1-text-secondary rounded-full">
                        CC {p.compute_capability}
                      </span>
                    )}
                    {p.location && (
                      <span className="px-2 py-0.5 text-xs bg-dc1-surface-l2 text-dc1-text-secondary rounded-full">
                        {p.location}
                      </span>
                    )}
                  </div>

                  {/* Quality bars */}
                  <div className="space-y-2 mb-4">
                    {p.reliability_score != null && (
                      <UtilBar value={p.reliability_score} color="#22c55e" label="Reliability" />
                    )}
                    {p.uptime_percent != null && (
                      <UtilBar value={p.uptime_percent} color="#38bdf8" label="Uptime" />
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="border-t border-dc1-border pt-3 flex justify-between items-center">
                    <div className="space-y-0.5">
                      {llmCostPerMin != null && (
                        <p className="text-xs text-dc1-text-muted">
                          LLM: <span className="text-dc1-text-primary font-medium">{costSAR(llmCostPerMin)} SAR/min</span>
                        </p>
                      )}
                      {imgCostPerMin != null && (
                        <p className="text-xs text-dc1-text-muted">
                          Image: <span className="text-dc1-text-primary font-medium">{costSAR(imgCostPerMin)} SAR/min</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-dc1-text-muted">{p.total_jobs_completed ?? 0} jobs</p>
                      {p.reliability_score != null && (
                        <p className="text-xs text-dc1-text-muted">{p.reliability_score}% reliable</p>
                      )}
                    </div>
                  </div>

                  {/* Cached models */}
                  {p.cached_models.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-dc1-border">
                      <p className="text-xs text-dc1-text-muted mb-1">Cached models:</p>
                      <div className="flex flex-wrap gap-1">
                        {p.cached_models.slice(0, 3).map(m => (
                          <span key={m} className="px-1.5 py-0.5 text-[10px] bg-dc1-surface-l3 text-dc1-text-muted rounded">
                            {m}
                          </span>
                        ))}
                        {p.cached_models.length > 3 && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-dc1-surface-l3 text-dc1-text-muted rounded">
                            +{p.cached_models.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          // Table view
          <div className="card overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>GPU</th>
                  <th>VRAM</th>
                  <th>CUDA</th>
                  <th>CC</th>
                  <th>Reliability</th>
                  <th>Jobs</th>
                  <th>LLM/min</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isSelected = selectedIds.has(p.id)
                  return (
                    <tr key={p.id} className={isSelected ? 'bg-dc1-amber/5' : undefined}>
                      <td className="font-medium text-dc1-text-primary">{p.name}</td>
                      <td className="text-dc1-text-secondary">{p.gpu_model || '—'}</td>
                      <td className="text-dc1-amber font-medium">{p.vram_gb ? `${p.vram_gb} GB` : '—'}</td>
                      <td>{p.cuda_version || '—'}</td>
                      <td>{p.compute_capability || '—'}</td>
                      <td>
                        {p.reliability_score != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-dc1-surface-l2 rounded-full overflow-hidden">
                              <div className="h-full bg-status-success rounded-full" style={{ width: `${p.reliability_score}%` }} />
                            </div>
                            <span className="text-xs">{p.reliability_score}%</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td>{p.total_jobs_completed ?? 0}</td>
                      <td className="text-dc1-text-primary">
                        {p.cost_rates_halala_per_min?.llm_inference
                          ? `${costSAR(p.cost_rates_halala_per_min.llm_inference)} SAR`
                          : '—'}
                      </td>
                      <td>
                        <StatusBadge status={p.is_live ? 'online' : 'offline'} size="sm" />
                      </td>
                      <td>
                        <button
                          onClick={() => toggleSelect(p.id)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            isSelected
                              ? 'bg-dc1-amber text-dc1-void'
                              : 'bg-dc1-surface-l2 text-dc1-text-secondary hover:bg-dc1-surface-l3'
                          }`}
                        >
                          {isSelected ? 'Deselect' : 'Compare'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-dc1-text-muted">
                      No providers available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* CTA */}
        {filtered.length > 0 && (
          <div className="text-center">
            <a
              href="/renter/marketplace"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-dc1-amber text-dc1-void font-semibold rounded-lg hover:bg-dc1-amber/90 transition-colors text-sm"
            >
              {t('renter.gpu_compare.browse_full_marketplace')}
            </a>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
