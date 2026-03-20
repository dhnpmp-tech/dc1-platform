'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import { useLanguage } from '../lib/i18n'

// ── Types ──────────────────────────────────────────────────────────
interface CostRates {
  'llm-inference'?: number
  llm_inference?: number
  training?: number
  rendering?: number
  image_generation?: number
  vllm_serve?: number
  default?: number
  [key: string]: number | undefined
}

interface Provider {
  id: number
  name: string
  gpu_model: string
  vram_gb: number | null
  gpu_count: number
  status: string
  is_live: boolean
  heartbeat_age_seconds: number | null
  location: string | null
  reliability_score: number | null
  reputation_score: number
  uptime_percent: number | null
  total_jobs_completed: number | null
  cached_models: string[]
  compute_capability: string | null
  cuda_version: string | null
  cost_rates_halala_per_min: CostRates | null
}

// ── Helpers ────────────────────────────────────────────────────────
function getDefaultRate(rates: CostRates | null): number {
  if (!rates) return 15
  return rates['llm-inference'] ?? rates.llm_inference ?? rates.default ?? 15
}

function halalaPriceToSarMin(halalPerMin: number): string {
  return (halalPerMin / 100).toFixed(2)
}

function halalaPriceToSarHr(halalPerMin: number): string {
  return ((halalPerMin * 60) / 100).toFixed(2)
}

function formatAge(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m`
}

// ── Provider Card ──────────────────────────────────────────────────
function ProviderCard({ provider }: { provider: Provider }) {
  const { t } = useLanguage()
  const rate = getDefaultRate(provider.cost_rates_halala_per_min)
  const vram = provider.vram_gb ?? null
  const uptime = provider.uptime_percent ?? provider.reliability_score ?? null

  return (
    <article className="bg-dc1-surface-l2 border border-dc1-border rounded-xl p-5 flex flex-col gap-4 hover:border-dc1-amber/30 hover:shadow-amber transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-dc1-text-primary leading-tight truncate group-hover:text-dc1-amber transition-colors">
            {provider.gpu_model || t('marketplace.unknown')}
          </h3>
          <p className="text-xs text-dc1-text-muted mt-0.5 truncate">{provider.name}</p>
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
          provider.is_live
            ? 'bg-status-success/10 text-status-success border border-status-success/20'
            : 'bg-dc1-surface-l3 text-dc1-text-muted border border-dc1-border'
        }`}>
          {provider.is_live && <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />}
          {provider.is_live ? t('marketplace.online') : t('marketplace.offline')}
        </span>
      </div>

      {/* Specs */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {vram !== null && (
          <div>
            <dt className="text-dc1-text-muted text-xs uppercase tracking-wide">{t('marketplace.vram_label')}</dt>
            <dd className="text-dc1-text-primary font-semibold mt-0.5">{vram} GB</dd>
          </div>
        )}
        {provider.gpu_count > 0 && (
          <div>
            <dt className="text-dc1-text-muted text-xs uppercase tracking-wide">{t('marketplace.gpus_label')}</dt>
            <dd className="text-dc1-text-primary font-semibold mt-0.5">{provider.gpu_count}×</dd>
          </div>
        )}
        {uptime !== null && (
          <div>
            <dt className="text-dc1-text-muted text-xs uppercase tracking-wide">{t('marketplace.uptime_label')}</dt>
            <dd className={`font-semibold mt-0.5 ${
              uptime >= 90 ? 'text-status-success' : uptime >= 70 ? 'text-dc1-amber' : 'text-status-error'
            }`}>
              {uptime.toFixed(1)}%
            </dd>
          </div>
        )}
        {provider.location && (
          <div>
            <dt className="text-dc1-text-muted text-xs uppercase tracking-wide">{t('marketplace.region_label')}</dt>
            <dd className="text-dc1-text-primary font-semibold mt-0.5 truncate">{provider.location}</dd>
          </div>
        )}
      </dl>

      {/* Pricing */}
      <div className="bg-dc1-surface-l1 rounded-lg px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-dc1-text-muted mb-0.5">{t('marketplace.price_llm')}</p>
          <p className="text-lg font-extrabold text-dc1-amber">
            {halalaPriceToSarMin(rate)} <span className="text-xs font-normal text-dc1-text-secondary">{t('marketplace.sar_min')}</span>
          </p>
          <p className="text-xs text-dc1-text-muted">{halalaPriceToSarHr(rate)} {t('marketplace.sar_hr')}</p>
        </div>
        {provider.heartbeat_age_seconds !== null && (
          <p className="text-xs text-dc1-text-muted">{t('marketplace.last_seen')}: {formatAge(provider.heartbeat_age_seconds)}</p>
        )}
      </div>

      {/* Cached models */}
      {provider.cached_models && provider.cached_models.length > 0 && (
        <div>
          <p className="text-xs text-dc1-text-muted mb-1.5">{t('marketplace.cached_models_label')}</p>
          <div className="flex flex-wrap gap-1">
            {provider.cached_models.slice(0, 3).map((m, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-dc1-amber/5 text-dc1-amber border border-dc1-amber/20">
                {m.split('/').pop()}
              </span>
            ))}
            {provider.cached_models.length > 3 && (
              <span className="text-xs px-2 py-0.5 rounded bg-dc1-surface-l3 text-dc1-text-muted">
                +{provider.cached_models.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <Link
        href="/renter/register"
        className="mt-auto btn btn-primary w-full text-center text-sm"
        aria-label={`${t('marketplace.rent_now')} ${provider.gpu_model}`}
      >
        {t('marketplace.rent_now')}
      </Link>
    </article>
  )
}

// ── Skeleton Card ──────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-dc1-surface-l2 border border-dc1-border rounded-xl p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="h-4 bg-dc1-surface-l3 rounded w-3/4" />
          <div className="h-3 bg-dc1-surface-l3 rounded w-1/2 mt-2" />
        </div>
        <div className="h-5 bg-dc1-surface-l3 rounded-full w-16" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i}>
            <div className="h-3 bg-dc1-surface-l3 rounded w-1/2 mb-1" />
            <div className="h-4 bg-dc1-surface-l3 rounded w-3/4" />
          </div>
        ))}
      </div>
      <div className="bg-dc1-surface-l1 rounded-lg h-16" />
      <div className="h-9 bg-dc1-surface-l3 rounded-lg" />
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────
export default function MarketplacePage() {
  const { t, dir } = useLanguage()
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'price-asc' | 'vram-desc' | 'availability'>('availability')

  const fetchProviders = useCallback(async () => {
    try {
      // Try /providers/marketplace first, fall back to /providers/available
      let res = await fetch('/api/dc1/providers/marketplace')
      if (!res.ok) {
        res = await fetch('/api/dc1/providers/available')
      }
      if (res.ok) {
        const data = await res.json()
        const list: Provider[] = Array.isArray(data)
          ? data
          : data.providers ?? data.data ?? []
        setProviders(list)
        setError(false)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProviders()
    const interval = setInterval(fetchProviders, 30_000)
    return () => clearInterval(interval)
  }, [fetchProviders])

  // Filter
  const filtered = providers.filter(p => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (p.gpu_model ?? '').toLowerCase().includes(q) ||
      (p.location ?? '').toLowerCase().includes(q) ||
      (p.name ?? '').toLowerCase().includes(q)
    )
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'availability') {
      if (a.is_live !== b.is_live) return a.is_live ? -1 : 1
      return (b.reputation_score ?? 0) - (a.reputation_score ?? 0)
    }
    if (sortBy === 'price-asc') {
      return getDefaultRate(a.cost_rates_halala_per_min) - getDefaultRate(b.cost_rates_halala_per_min)
    }
    if (sortBy === 'vram-desc') {
      return (b.vram_gb ?? 0) - (a.vram_gb ?? 0)
    }
    return 0
  })

  const onlineCount = providers.filter(p => p.is_live).length

  return (
    <div className="min-h-screen flex flex-col" dir={dir}>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-dc1-border bg-gradient-to-b from-dc1-amber/5 to-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dc1-amber/10 border border-dc1-amber/20 text-dc1-amber text-xs font-medium mb-5">
                <span className="w-1.5 h-1.5 bg-status-success rounded-full animate-pulse" />
                {onlineCount > 0 ? `${onlineCount} ${t('marketplace.live_gpus_online')}` : t('marketplace.live_badge')}
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-dc1-text-primary mb-4 leading-tight">
                {t('marketplace.hero_title')}<br />
                <span className="text-dc1-amber">{t('marketplace.hero_on_demand')}</span>
              </h1>
              <p className="text-dc1-text-secondary text-lg mb-8 leading-relaxed">
                {t('marketplace.hero_desc')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/renter/register" className="btn btn-primary btn-lg">
                  {t('marketplace.get_started')}
                </Link>
                <Link href="/docs" className="btn btn-secondary btn-lg">
                  {t('marketplace.view_docs')}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Search + Filter bar */}
        <section className="border-b border-dc1-border bg-dc1-surface-l1/50 sticky top-0 z-10 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <svg
                className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dc1-text-muted pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={t('marketplace.search_placeholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input ps-9 w-full text-sm"
                aria-label={t('marketplace.search_placeholder')}
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="input text-sm w-full sm:w-auto"
              aria-label={t('common.sort_reputation')}
            >
              <option value="availability">{t('marketplace.sort_online')}</option>
              <option value="price-asc">{t('marketplace.sort_price')}</option>
              <option value="vram-desc">{t('marketplace.sort_vram')}</option>
            </select>
            <p className="text-xs text-dc1-text-muted whitespace-nowrap">
              {loading ? t('common.loading') : `${sorted.length} / ${providers.length} ${t('marketplace.providers_count')}`}
            </p>
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
              <p className="text-dc1-text-secondary mb-2">{t('marketplace.error_msg')}</p>
              <button
                onClick={fetchProviders}
                className="btn btn-secondary btn-sm mt-4"
              >
                {t('marketplace.try_again')}
              </button>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-dc1-text-secondary mb-1">
                {providers.length === 0
                  ? t('marketplace.no_gpus_online')
                  : t('marketplace.no_match_search')}
              </p>
              <p className="text-sm text-dc1-text-muted">
                {providers.length === 0
                  ? t('marketplace.check_back')
                  : t('marketplace.try_different')}
              </p>
              {search && (
                <button onClick={() => setSearch('')} className="btn btn-outline btn-sm mt-4">
                  {t('marketplace.clear_search')}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {sorted.map(p => (
                <ProviderCard key={p.id} provider={p} />
              ))}
            </div>
          )}
        </section>

        {/* Bottom CTA */}
        {!loading && !error && providers.length > 0 && (
          <section className="border-t border-dc1-border bg-dc1-surface-l1">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-dc1-text-primary mb-3">
                {t('marketplace.cta_title')}
              </h2>
              <p className="text-dc1-text-secondary mb-8 max-w-xl mx-auto">
                {t('marketplace.cta_desc')}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/renter/register" className="btn btn-primary btn-lg">
                  {t('marketplace.create_renter')}
                </Link>
                <Link href="/provider/register" className="btn btn-secondary btn-lg">
                  {t('marketplace.become_provider')}
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
