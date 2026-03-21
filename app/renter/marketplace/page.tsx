'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatusBadge from '../../components/ui/StatusBadge'
import { useLanguage } from '../../lib/i18n'

const API_BASE = '/api/dc1'

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
  vram_mib: number | null
  gpu_count: number
  status: string
  is_live: boolean
  heartbeat_age_seconds: number | null
  location: string | null
  run_mode: string | null
  reliability_score: number | null
  reputation_score: number
  uptime_percent: number | null
  uptime_pct: number | null
  job_success_rate: number | null
  total_jobs_completed: number | null
  reputation_tier: 'new' | 'reliable' | 'top'
  cached_models: string[]
  driver_version: string | null
  compute_capability: string | null
  cuda_version: string | null
  cost_rates_halala_per_min: CostRates | null
}

interface Filters {
  minVram: number
  maxPriceSar: number
  gpuModels: string[]
  region: string
}

type SortOption = 'price-asc' | 'vram-desc' | 'availability' | 'reputation'
type MarketplaceTab = 'gpus' | 'models'

interface ModelRegistryEntry {
  model_id: string
  display_name: string
  family: string
  vram_gb: number
  quantization: string
  context_window: number
  use_cases: string[]
  min_gpu_vram_gb: number
  providers_online: number
  avg_price_sar_per_min: number
  status: 'available' | 'no_providers'
}

interface ModelCardFeedEntry {
  model_id: string
  summary?: {
    en?: string
    ar?: string
  }
  metrics?: {
    vram_required_gb?: number | null
    latency_ms?: {
      p50?: number | null
      p95?: number | null
      p99?: number | null
    }
    arabic_quality?: {
      arabic_mmlu_score?: number | null
      arabicaqa_score?: number | null
    }
    cost_per_1k_tokens_sar?: number | null
    cold_start_ms?: number | null
  }
}

// ── Constants ──────────────────────────────────────────────────────
const GPU_MODEL_OPTIONS = ['RTX 3090', 'RTX 4090', 'A100', 'H100', 'Other']
const REGION_OPTIONS = ['All Regions', 'KSA', 'UAE', 'Other']
const POLL_INTERVAL_MS = 30_000

// ── Helpers ────────────────────────────────────────────────────────
function halalaPriceToSarHr(halalPerMin: number): string {
  return ((halalPerMin * 60) / 100).toFixed(2)
}

function getDefaultRate(rates: CostRates | null): number {
  if (!rates) return 15
  return rates['llm-inference'] ?? rates.llm_inference ?? rates.default ?? 15
}

function getDefaultRateSarHr(rates: CostRates | null): number {
  return (getDefaultRate(rates) * 60) / 100
}

function formatAge(seconds: number | null): string {
  if (seconds === null) return 'unknown'
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

function formatLastUpdated(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function matchesGpuModelFilter(gpuModel: string, selected: string[]): boolean {
  if (selected.length === 0) return true
  const m = gpuModel?.toUpperCase() ?? ''
  for (const opt of selected) {
    if (opt === 'RTX 3090' && m.includes('3090')) return true
    if (opt === 'RTX 4090' && m.includes('4090')) return true
    if (opt === 'A100' && m.includes('A100')) return true
    if (opt === 'H100' && m.includes('H100')) return true
    if (opt === 'Other') {
      const isKnown = m.includes('3090') || m.includes('4090') || m.includes('A100') || m.includes('H100')
      if (!isKnown) return true
    }
  }
  return false
}

function matchesRegion(location: string | null, region: string): boolean {
  if (region === 'All Regions' || !region) return true
  if (!location) return region === 'Other'
  const loc = location.toUpperCase()
  if (region === 'KSA') return loc.includes('KSA') || loc.includes('SAUDI') || loc.includes('RIYADH') || loc.includes('JEDDAH') || loc.includes('MECCA') || loc.includes('DAMMAM')
  if (region === 'UAE') return loc.includes('UAE') || loc.includes('DUBAI') || loc.includes('ABU DHABI') || loc.includes('SHARJAH')
  // Other: not KSA and not UAE
  const isKSA = loc.includes('KSA') || loc.includes('SAUDI') || loc.includes('RIYADH') || loc.includes('JEDDAH')
  const isUAE = loc.includes('UAE') || loc.includes('DUBAI') || loc.includes('ABU DHABI')
  return !isKSA && !isUAE
}

function reputationTierRank(tier: Provider['reputation_tier']): number {
  if (tier === 'top') return 3
  if (tier === 'reliable') return 2
  return 1
}

function reputationTierBadgeClass(tier: Provider['reputation_tier']): string {
  if (tier === 'top') return 'bg-dc1-amber/20 text-dc1-amber border-dc1-amber/30'
  if (tier === 'reliable') return 'bg-status-success/15 text-status-success border-status-success/30'
  return 'bg-dc1-surface-l2 text-dc1-text-muted border-dc1-border'
}

function reputationTierLabel(tier: Provider['reputation_tier'], t: (key: string) => string): string {
  if (tier === 'top') return t('marketplace.reputation_top')
  if (tier === 'reliable') return t('marketplace.reputation_reliable')
  return t('marketplace.reputation_new')
}

function normalizeTag(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_/]+/g, '-')
}

function splitModelUseCases(useCases: string[]): { taskTypes: string[]; languages: string[] } {
  const languageSet = new Set<string>()
  const taskSet = new Set<string>()

  for (const raw of useCases || []) {
    const tag = normalizeTag(raw)
    if (!tag) continue
    if (tag.includes('arabic')) {
      languageSet.add('arabic')
      continue
    }
    if (tag.includes('english')) {
      languageSet.add('english')
      continue
    }
    if (tag.includes('multilingual')) {
      languageSet.add('multilingual')
      continue
    }
    taskSet.add(tag)
  }

  if (languageSet.size === 0) {
    languageSet.add('multilingual')
  }

  return { taskTypes: [...taskSet], languages: [...languageSet] }
}

function prettyTag(value: string): string {
  return value
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatMilliseconds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(1)} s`
}

// ── Icons ──────────────────────────────────────────────────────────
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
const PlaygroundIcon = () => (
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
const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)
const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.11 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
  </svg>
)
const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

const navItems = [
  { label: 'Dashboard', href: '/renter', icon: <HomeIcon /> },
  { label: 'Marketplace', href: '/renter/marketplace', icon: <MarketplaceIcon /> },
  { label: 'Playground', href: '/renter/playground', icon: <PlaygroundIcon /> },
  { label: 'My Jobs', href: '/renter/jobs', icon: <JobsIcon /> },
  { label: 'Billing', href: '/renter/billing', icon: <BillingIcon /> },
  { label: 'Analytics', href: '/renter/analytics', icon: <ChartIcon /> },
  { label: 'Settings', href: '/renter/settings', icon: <GearIcon /> },
]

// ── Filter Sidebar ─────────────────────────────────────────────────
function FilterSidebar({
  filters,
  onChange,
  matchCount,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  matchCount: number
}) {
  function toggleGpuModel(model: string) {
    const next = filters.gpuModels.includes(model)
      ? filters.gpuModels.filter(m => m !== model)
      : [...filters.gpuModels, model]
    onChange({ ...filters, gpuModels: next })
  }

  function resetFilters() {
    onChange({ minVram: 0, maxPriceSar: 50, gpuModels: [], region: 'All Regions' })
  }

  const hasActiveFilters =
    filters.minVram > 0 ||
    filters.maxPriceSar < 50 ||
    filters.gpuModels.length > 0 ||
    filters.region !== 'All Regions'

  return (
    <aside className="flex flex-col gap-5" aria-label="GPU filters">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dc1-text-primary uppercase tracking-wide">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs text-dc1-amber hover:underline"
          >
            Reset all
          </button>
        )}
      </div>

      {/* Match count */}
      <p className="text-xs text-dc1-text-muted -mt-2">
        {matchCount} provider{matchCount !== 1 ? 's' : ''} match
      </p>

      {/* Min VRAM */}
      <div>
        <label className="block text-xs font-medium text-dc1-text-secondary mb-2">
          Min VRAM — <span className="text-dc1-amber font-semibold">{filters.minVram === 0 ? 'Any' : `${filters.minVram} GB`}</span>
        </label>
        <input
          type="range"
          min={0}
          max={80}
          step={4}
          value={filters.minVram}
          onChange={e => onChange({ ...filters, minVram: Number(e.target.value) })}
          className="w-full accent-dc1-amber"
          aria-label="Minimum VRAM filter"
        />
        <div className="flex justify-between text-xs text-dc1-text-muted mt-1">
          <span>Any</span>
          <span>80 GB</span>
        </div>
      </div>

      {/* Max Price */}
      <div>
        <label className="block text-xs font-medium text-dc1-text-secondary mb-2">
          Max Price — <span className="text-dc1-amber font-semibold">{filters.maxPriceSar >= 50 ? 'Any' : `${filters.maxPriceSar} SAR/hr`}</span>
        </label>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={filters.maxPriceSar}
          onChange={e => onChange({ ...filters, maxPriceSar: Number(e.target.value) })}
          className="w-full accent-dc1-amber"
          aria-label="Maximum price filter"
        />
        <div className="flex justify-between text-xs text-dc1-text-muted mt-1">
          <span>0 SAR</span>
          <span>50+ SAR</span>
        </div>
      </div>

      {/* GPU Model */}
      <div>
        <p className="text-xs font-medium text-dc1-text-secondary mb-2">GPU Model</p>
        <div className="space-y-1.5">
          {GPU_MODEL_OPTIONS.map(model => (
            <label key={model} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.gpuModels.includes(model)}
                onChange={() => toggleGpuModel(model)}
                className="accent-dc1-amber w-3.5 h-3.5 rounded"
              />
              <span className="text-sm text-dc1-text-secondary group-hover:text-dc1-text-primary transition-colors">
                {model}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Region */}
      <div>
        <label className="block text-xs font-medium text-dc1-text-secondary mb-2" htmlFor="region-select">
          Region
        </label>
        <select
          id="region-select"
          value={filters.region}
          onChange={e => onChange({ ...filters, region: e.target.value })}
          className="input w-full text-sm"
        >
          {REGION_OPTIONS.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
    </aside>
  )
}

// ── GPU Card ───────────────────────────────────────────────────────
function GPUCard({ provider, t }: { provider: Provider; t: (key: string) => string }) {
  const llmRate = provider.cost_rates_halala_per_min?.['llm-inference']
    ?? provider.cost_rates_halala_per_min?.llm_inference
    ?? 15
  const imgRate = provider.cost_rates_halala_per_min?.image_generation ?? 20
  const trainRate = provider.cost_rates_halala_per_min?.training ?? 25

  return (
    <article
      className="card hover:border-dc1-amber/30 transition-colors flex flex-col"
      aria-label={`GPU: ${provider.gpu_model}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1 mr-2">
          <h3 className="text-base font-semibold text-dc1-text-primary leading-tight truncate">
            {provider.gpu_model || 'Unknown GPU'}
          </h3>
          <p className="text-xs text-dc1-text-muted mt-0.5 truncate">{provider.name}</p>
          <span className={`inline-flex mt-2 text-[10px] font-bold tracking-wide px-2 py-0.5 rounded border ${reputationTierBadgeClass(provider.reputation_tier)}`}>
            {reputationTierLabel(provider.reputation_tier, t)}
          </span>
        </div>
        <StatusBadge status={provider.is_live ? 'online' : 'offline'} size="sm" pulse={provider.is_live} />
      </div>

      {/* Specs grid */}
      <dl className="space-y-1.5 text-sm text-dc1-text-secondary mb-4 flex-1">
        {provider.vram_gb != null && provider.vram_gb > 0 && (
          <div className="flex justify-between">
            <dt>VRAM</dt>
            <dd className="text-dc1-text-primary font-medium">{provider.vram_gb} GB</dd>
          </div>
        )}
        {provider.gpu_count > 1 && (
          <div className="flex justify-between">
            <dt>GPUs</dt>
            <dd className="text-dc1-text-primary font-medium">{provider.gpu_count}×</dd>
          </div>
        )}
        {provider.compute_capability && (
          <div className="flex justify-between">
            <dt>Compute</dt>
            <dd className="text-dc1-text-primary">{provider.compute_capability}</dd>
          </div>
        )}
        {provider.cuda_version && (
          <div className="flex justify-between">
            <dt>CUDA</dt>
            <dd className="text-dc1-text-primary">{provider.cuda_version}</dd>
          </div>
        )}
        {provider.location && (
          <div className="flex justify-between">
            <dt>Location</dt>
            <dd className="text-dc1-text-primary">{provider.location}</dd>
          </div>
        )}
        {provider.reliability_score != null && provider.reliability_score > 0 && (
          <div className="flex justify-between">
            <dt>Reliability</dt>
            <dd className={`font-medium ${
              provider.reliability_score >= 90
                ? 'text-status-success'
                : provider.reliability_score >= 70
                ? 'text-dc1-amber'
                : 'text-status-error'
            }`}>
              {provider.reliability_score}%
            </dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt>{t('marketplace.uptime')}</dt>
          <dd className="text-dc1-text-primary font-medium">{(provider.uptime_pct ?? provider.uptime_percent ?? 0).toFixed(1)}%</dd>
        </div>
        <div className="flex justify-between">
          <dt>{t('marketplace.success_rate')}</dt>
          <dd className="text-dc1-text-primary font-medium">{(provider.job_success_rate ?? 0).toFixed(1)}%</dd>
        </div>
        {provider.heartbeat_age_seconds !== null && (
          <div className="flex justify-between">
            <dt>Last seen</dt>
            <dd className="text-dc1-text-muted text-xs">{formatAge(provider.heartbeat_age_seconds)}</dd>
          </div>
        )}
      </dl>

      {/* Pricing */}
      <div className="bg-dc1-surface-l2 rounded-md p-3 mb-3 space-y-1 text-sm">
        <p className="text-xs text-dc1-text-muted uppercase tracking-wide mb-2 font-semibold">Pricing (SAR/hr)</p>
        <div className="flex justify-between">
          <span className="text-dc1-text-secondary">LLM Inference</span>
          <span className="text-dc1-amber font-semibold">{halalaPriceToSarHr(llmRate)} SAR/hr</span>
        </div>
        <div className="flex justify-between">
          <span className="text-dc1-text-secondary">Image Gen</span>
          <span className="text-dc1-amber font-semibold">{halalaPriceToSarHr(imgRate)} SAR/hr</span>
        </div>
        <div className="flex justify-between">
          <span className="text-dc1-text-secondary">Training</span>
          <span className="text-dc1-amber font-semibold">{halalaPriceToSarHr(trainRate)} SAR/hr</span>
        </div>
      </div>

      {/* Cached models */}
      {provider.cached_models && provider.cached_models.length > 0 && (
        <div className="mb-3 pt-2 border-t border-dc1-border/50">
          <p className="text-xs text-dc1-text-muted mb-1.5">Cached models (instant start):</p>
          <div className="flex flex-wrap gap-1">
            {provider.cached_models.slice(0, 4).map((m, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded bg-status-success/10 text-status-success border border-status-success/20"
              >
                {m.split('/').pop()}
              </span>
            ))}
            {provider.cached_models.length > 4 && (
              <span className="text-xs px-2 py-0.5 rounded bg-dc1-surface-l2 text-dc1-text-muted">
                +{provider.cached_models.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="flex gap-2 mt-auto">
        <Link
          href={`/renter/marketplace/providers/${provider.id}`}
          className="btn text-sm flex-1 text-center bg-dc1-surface-l2 text-dc1-text-primary hover:bg-dc1-surface-l3 border border-dc1-border"
        >
          View Profile
        </Link>
        <Link
          href={`/renter/playground?provider=${provider.id}`}
          className="btn btn-primary text-sm flex-1 text-center"
        >
          Rent Now
        </Link>
      </div>
    </article>
  )
}

function ModelCard({
  model,
  benchmark,
  compared,
  onToggleCompare,
  t,
}: {
  model: ModelRegistryEntry
  benchmark: ModelCardFeedEntry | undefined
  compared: boolean
  onToggleCompare: (modelId: string) => void
  t: (key: string) => string
}) {
  const meta = splitModelUseCases(model.use_cases)
  const hasArabicSupport = meta.languages.includes('arabic')
  const coldStartMs = benchmark?.metrics?.cold_start_ms ?? null
  const latencyP95 = benchmark?.metrics?.latency_ms?.p95 ?? null
  const mmlu = benchmark?.metrics?.arabic_quality?.arabic_mmlu_score ?? null
  const aqa = benchmark?.metrics?.arabic_quality?.arabicaqa_score ?? null
  const benchmarkSummary = benchmark?.summary?.en

  return (
    <article className="card hover:border-dc1-amber/30 transition-colors flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-dc1-text-primary">{model.display_name}</h3>
          <p className="text-xs text-dc1-text-muted mt-1">{model.model_id}</p>
        </div>
        <StatusBadge status={model.status === 'available' ? 'online' : 'offline'} size="sm" pulse={model.status === 'available'} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {hasArabicSupport && (
          <span className="inline-flex w-fit text-xs px-2 py-1 rounded border border-dc1-amber/30 bg-dc1-amber/10 text-dc1-amber font-medium">
            {t('marketplace.arabic_support')}
          </span>
        )}
        {meta.languages.map((language) => (
          <span key={language} className="inline-flex w-fit text-xs px-2 py-1 rounded border border-dc1-border bg-dc1-surface-l2 text-dc1-text-secondary">
            {prettyTag(language)}
          </span>
        ))}
      </div>

      <dl className="mt-4 space-y-1.5 text-sm text-dc1-text-secondary flex-1">
        <div className="flex justify-between">
          <dt>Min VRAM</dt>
          <dd className="text-dc1-text-primary font-medium">{model.min_gpu_vram_gb} GB</dd>
        </div>
        <div className="flex justify-between">
          <dt>Quantization</dt>
          <dd className="text-dc1-text-primary font-medium">{model.quantization}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Context</dt>
          <dd className="text-dc1-text-primary font-medium">{model.context_window.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Providers online</dt>
          <dd className={`font-medium ${model.providers_online > 0 ? 'text-status-success' : 'text-dc1-text-muted'}`}>
            {model.providers_online}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Avg price</dt>
          <dd className="text-dc1-amber font-semibold">{model.avg_price_sar_per_min.toFixed(2)} SAR/min</dd>
        </div>
        <div className="flex justify-between">
          <dt>Cold start</dt>
          <dd className="text-dc1-text-primary font-medium">{formatMilliseconds(coldStartMs)}</dd>
        </div>
      </dl>

      <div className="mt-3 rounded-md border border-dc1-border bg-dc1-surface-l2 p-3 text-xs">
        <p className="text-dc1-text-primary font-semibold mb-2">Benchmark Snapshot</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-dc1-text-secondary">
          <span>P95 latency</span>
          <span className="text-dc1-text-primary text-right">{formatMilliseconds(latencyP95)}</span>
          <span>Arabic MMLU</span>
          <span className="text-dc1-text-primary text-right">{mmlu == null ? '—' : `${mmlu}%`}</span>
          <span>ArabicQA</span>
          <span className="text-dc1-text-primary text-right">{aqa == null ? '—' : `${aqa}%`}</span>
          <span>Cost / 1K tokens</span>
          <span className="text-dc1-text-primary text-right">
            {benchmark?.metrics?.cost_per_1k_tokens_sar == null ? '—' : `${benchmark.metrics.cost_per_1k_tokens_sar.toFixed(2)} SAR`}
          </span>
        </div>
        {benchmarkSummary && (
          <p className="mt-2 text-dc1-text-muted leading-relaxed">
            {benchmarkSummary}
          </p>
        )}
      </div>

      <div className="mt-3 mb-4 flex flex-wrap gap-1">
        {model.use_cases.map(useCase => (
          <span key={useCase} className="text-xs px-2 py-0.5 rounded bg-dc1-surface-l2 text-dc1-text-secondary border border-dc1-border">
            {useCase}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onToggleCompare(model.model_id)}
        className={`w-full text-sm rounded-md py-2 border transition-colors mb-2 ${
          compared
            ? 'border-dc1-amber/40 bg-dc1-amber/10 text-dc1-amber'
            : 'border-dc1-border bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary'
        }`}
      >
        {compared ? 'Remove from compare' : 'Add to compare'}
      </button>

      {model.providers_online > 0 ? (
        <div className="mt-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Link
            href={`/renter/playground?model=${encodeURIComponent(model.model_id)}`}
            className="btn text-center text-sm bg-dc1-surface-l2 text-dc1-text-primary hover:bg-dc1-surface-l3 border border-dc1-border"
          >
            Use in Playground
          </Link>
          <Link
            href={`/renter/playground?model=${encodeURIComponent(model.model_id)}&mode=vllm_serve`}
            className="btn btn-primary text-center text-sm"
          >
            One-click Deploy
          </Link>
        </div>
      ) : (
        <div className="mt-auto rounded-md border border-dc1-border bg-dc1-surface-l2 p-3 text-xs text-dc1-text-muted">
          {t('marketplace.no_providers_for_model')}
        </div>
      )}
    </article>
  )
}

// ── Main Page ──────────────────────────────────────────────────────
export default function MarketplacePage() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('gpus')
  const [providers, setProviders] = useState<Provider[]>([])
  const [models, setModels] = useState<ModelRegistryEntry[]>([])
  const [modelCards, setModelCards] = useState<Record<string, ModelCardFeedEntry>>({})
  const [loading, setLoading] = useState(true)
  const [modelsLoading, setModelsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [renterName, setRenterName] = useState('Renter')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('reputation')
  const [filters, setFilters] = useState<Filters>({
    minVram: 0,
    maxPriceSar: 50,
    gpuModels: [],
    region: 'All Regions',
  })
  const [modelSearch, setModelSearch] = useState('')
  const [modelTaskFilter, setModelTaskFilter] = useState('all')
  const [modelLanguageFilter, setModelLanguageFilter] = useState('all')
  const [modelMaxVram, setModelMaxVram] = useState(80)
  const [modelMaxPrice, setModelMaxPrice] = useState(10)
  const [compareModelIds, setCompareModelIds] = useState<string[]>([])
  const countdownRef = useRef<number>(POLL_INTERVAL_MS / 1000)
  const [countdown, setCountdown] = useState(POLL_INTERVAL_MS / 1000)

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/providers/available`)
      if (res.ok) {
        const data = await res.json()
        setProviders(data.providers || [])
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('Failed to load providers:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchModels = useCallback(async () => {
    try {
      const [modelsRes, cardsRes] = await Promise.all([
        fetch(`${API_BASE}/models`),
        fetch(`${API_BASE}/models/cards`),
      ])

      if (modelsRes.ok) {
        const data = await modelsRes.json()
        setModels(Array.isArray(data) ? data : [])
      }

      if (cardsRes.ok) {
        const cardsPayload = await cardsRes.json()
        const nextCards: Record<string, ModelCardFeedEntry> = {}
        for (const card of Array.isArray(cardsPayload?.cards) ? cardsPayload.cards : []) {
          if (card?.model_id) nextCards[card.model_id] = card
        }
        setModelCards(nextCards)
      }
    } catch (err) {
      console.error('Failed to load model registry:', err)
    } finally {
      setModelsLoading(false)
    }
  }, [])

  // Auth — get renter name
  useEffect(() => {
    const key = typeof window !== 'undefined' ? localStorage.getItem('dc1_renter_key') : null
    if (key) {
      fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(key)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.renter?.name) setRenterName(d.renter.name) })
        .catch(() => {})
    }
  }, [])

  // Poll every 30s + countdown ticker
  useEffect(() => {
    fetchProviders()
    fetchModels()

    const pollInterval = setInterval(() => {
      fetchProviders()
      fetchModels()
      countdownRef.current = POLL_INTERVAL_MS / 1000
    }, POLL_INTERVAL_MS)

    const tickInterval = setInterval(() => {
      countdownRef.current = Math.max(0, countdownRef.current - 1)
      setCountdown(countdownRef.current)
    }, 1000)

    return () => {
      clearInterval(pollInterval)
      clearInterval(tickInterval)
    }
  }, [fetchProviders, fetchModels])

  // ── Filter + Sort ────────────────────────────────────────────────
  const filtered = providers.filter(p => {
    const vramOk = filters.minVram === 0 || (p.vram_gb ?? 0) >= filters.minVram
    const priceSarHr = getDefaultRateSarHr(p.cost_rates_halala_per_min)
    const priceOk = filters.maxPriceSar >= 50 || priceSarHr <= filters.maxPriceSar
    const modelOk = matchesGpuModelFilter(p.gpu_model ?? '', filters.gpuModels)
    const regionOk = matchesRegion(p.location, filters.region)
    return vramOk && priceOk && modelOk && regionOk
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'reputation') {
      const tierDelta = reputationTierRank(b.reputation_tier) - reputationTierRank(a.reputation_tier)
      if (tierDelta !== 0) return tierDelta
      if (a.is_live !== b.is_live) return a.is_live ? -1 : 1
      return (b.reputation_score ?? 0) - (a.reputation_score ?? 0)
    }
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

  const taskTypeOptions = Array.from(new Set(models.flatMap(model => splitModelUseCases(model.use_cases).taskTypes))).sort((a, b) => a.localeCompare(b))
  const languageOptions = Array.from(new Set(models.flatMap(model => splitModelUseCases(model.use_cases).languages))).sort((a, b) => a.localeCompare(b))

  const filteredModels = models.filter((model) => {
    const query = modelSearch.trim().toLowerCase()
    const meta = splitModelUseCases(model.use_cases)
    const modelText = `${model.display_name} ${model.model_id} ${model.family}`.toLowerCase()
    const queryOk = !query || modelText.includes(query)
    const taskOk = modelTaskFilter === 'all' || meta.taskTypes.includes(modelTaskFilter)
    const languageOk = modelLanguageFilter === 'all' || meta.languages.includes(modelLanguageFilter)
    const vramOk = model.min_gpu_vram_gb <= modelMaxVram
    const priceOk = model.avg_price_sar_per_min <= modelMaxPrice
    return queryOk && taskOk && languageOk && vramOk && priceOk
  })

  const comparedModels = compareModelIds
    .map((modelId) => filteredModels.find((m) => m.model_id === modelId) || models.find((m) => m.model_id === modelId))
    .filter((model): model is ModelRegistryEntry => Boolean(model))

  function toggleCompareModel(modelId: string) {
    setCompareModelIds((prev) => {
      if (prev.includes(modelId)) return prev.filter((id) => id !== modelId)
      if (prev.length >= 4) return prev
      return [...prev, modelId]
    })
  }

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renterName}>
      <div className="space-y-5">
        {/* ── Page Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-dc1-text-primary">GPU Marketplace</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {activeTab === 'gpus' ? (
                <span className="text-sm text-dc1-text-secondary">
                  <span className="text-status-success font-semibold">{onlineCount}</span> online
                  {' · '}
                  <span className="text-dc1-text-muted">{providers.length} total</span>
                </span>
              ) : (
                <span className="text-sm text-dc1-text-secondary">
                  <span className="text-status-success font-semibold">{filteredModels.filter(m => m.status === 'available').length}</span> available
                  {' · '}
                  <span className="text-dc1-text-muted">{filteredModels.length}/{models.length} models</span>
                </span>
              )}
              {lastUpdated && (
                <span className="text-xs text-dc1-text-muted flex items-center gap-1">
                  <RefreshIcon />
                  Updated {formatLastUpdated(lastUpdated)}
                  {countdown > 0 && <span className="ml-1">(next in {countdown}s)</span>}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${activeTab === 'gpus' ? 'border-dc1-amber/40 bg-dc1-amber/10 text-dc1-amber' : 'border-dc1-border text-dc1-text-secondary hover:text-dc1-text-primary'}`}
              onClick={() => setActiveTab('gpus')}
            >
              GPUs
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${activeTab === 'models' ? 'border-dc1-amber/40 bg-dc1-amber/10 text-dc1-amber' : 'border-dc1-border text-dc1-text-secondary hover:text-dc1-text-primary'}`}
              onClick={() => setActiveTab('models')}
            >
              {t('marketplace.models_tab')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'gpus' && (
              <>
                {/* Mobile filter toggle */}
                <button
                  className="btn btn-outline text-sm flex items-center gap-1.5 sm:hidden"
                  onClick={() => setFiltersOpen(prev => !prev)}
                  aria-expanded={filtersOpen}
                  aria-controls="filter-panel"
                >
                  <FilterIcon />
                  Filters
                  {(filters.gpuModels.length > 0 || filters.minVram > 0 || filters.maxPriceSar < 50 || filters.region !== 'All Regions') && (
                    <span className="ml-1 bg-dc1-amber text-dc1-void text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      !
                    </span>
                  )}
                </button>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="input text-sm"
                  aria-label="Sort GPUs"
                >
                  <option value="reputation">Reputation: top tier first</option>
                  <option value="availability">Online first</option>
                  <option value="price-asc">Price: low → high</option>
                  <option value="vram-desc">VRAM: high → low</option>
                </select>
              </>
            )}
            {activeTab === 'models' && compareModelIds.length > 0 && (
              <button
                type="button"
                onClick={() => setCompareModelIds([])}
                className="px-3 py-1.5 rounded-lg text-sm border border-dc1-border text-dc1-text-secondary hover:text-dc1-text-primary transition-colors"
              >
                Clear compare ({compareModelIds.length})
              </button>
            )}
          </div>
        </div>

        {/* ── Layout: sidebar + cards ──────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Filter sidebar — desktop: always visible, mobile: toggle */}
          {activeTab === 'gpus' && (
            <div
              id="filter-panel"
              className={`
                w-full sm:w-56 sm:flex-shrink-0
                sm:block
                ${filtersOpen ? 'block' : 'hidden'}
                card p-4
              `}
            >
              <FilterSidebar
                filters={filters}
                onChange={setFilters}
                matchCount={filtered.length}
              />
            </div>
          )}

          {/* GPU cards / model cards */}
          <div className="flex-1 min-w-0">
            {activeTab === 'models' && (
              <div className="card mb-4">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-medium text-dc1-text-secondary mb-1.5">Search model</label>
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="Search by model id, family, or display name"
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dc1-text-secondary mb-1.5">Task type</label>
                    <select
                      value={modelTaskFilter}
                      onChange={(e) => setModelTaskFilter(e.target.value)}
                      className="input w-full text-sm"
                    >
                      <option value="all">All tasks</option>
                      {taskTypeOptions.map((taskType) => (
                        <option key={taskType} value={taskType}>{prettyTag(taskType)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dc1-text-secondary mb-1.5">Language</label>
                    <select
                      value={modelLanguageFilter}
                      onChange={(e) => setModelLanguageFilter(e.target.value)}
                      className="input w-full text-sm"
                    >
                      <option value="all">All languages</option>
                      {languageOptions.map((language) => (
                        <option key={language} value={language}>{prettyTag(language)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dc1-text-secondary mb-1.5">
                      Max VRAM requirement
                    </label>
                    <div className="input text-sm flex items-center justify-between gap-3">
                      <span>{modelMaxVram} GB</span>
                      <input
                        type="range"
                        min={4}
                        max={80}
                        step={4}
                        value={modelMaxVram}
                        onChange={(e) => setModelMaxVram(Number(e.target.value))}
                        className="w-28 accent-dc1-amber"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3 items-center">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-medium text-dc1-text-secondary mb-1.5">
                      Max price
                    </label>
                    <div className="input text-sm flex items-center justify-between gap-3">
                      <span>{modelMaxPrice.toFixed(2)} SAR/min</span>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        step={0.25}
                        value={modelMaxPrice}
                        onChange={(e) => setModelMaxPrice(Number(e.target.value))}
                        className="w-48 accent-dc1-amber"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-dc1-text-muted">
                    {filteredModels.length} matching model{filteredModels.length === 1 ? '' : 's'}
                    {' · '}
                    {comparedModels.length} selected for side-by-side compare
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'models' && comparedModels.length >= 2 && (
              <div className="card mb-4 overflow-x-auto">
                <h3 className="text-sm font-semibold text-dc1-text-primary mb-3">Model Comparison</h3>
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="border-b border-dc1-border">
                      <th className="text-left py-2 pr-3 text-dc1-text-muted">Metric</th>
                      {comparedModels.map((model) => (
                        <th key={model.model_id} className="text-left py-2 px-3 text-dc1-text-primary font-semibold">
                          {model.display_name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dc1-border">
                    {[
                      { label: 'Task types', value: (model: ModelRegistryEntry) => splitModelUseCases(model.use_cases).taskTypes.map(prettyTag).join(', ') || 'General' },
                      { label: 'Languages', value: (model: ModelRegistryEntry) => splitModelUseCases(model.use_cases).languages.map(prettyTag).join(', ') },
                      { label: 'Min VRAM', value: (model: ModelRegistryEntry) => `${model.min_gpu_vram_gb} GB` },
                      { label: 'Avg price', value: (model: ModelRegistryEntry) => `${model.avg_price_sar_per_min.toFixed(2)} SAR/min` },
                      { label: 'Providers online', value: (model: ModelRegistryEntry) => String(model.providers_online) },
                      { label: 'P95 latency', value: (model: ModelRegistryEntry) => formatMilliseconds(modelCards[model.model_id]?.metrics?.latency_ms?.p95 ?? null) },
                      { label: 'Cold start', value: (model: ModelRegistryEntry) => formatMilliseconds(modelCards[model.model_id]?.metrics?.cold_start_ms ?? null) },
                      { label: 'Arabic MMLU', value: (model: ModelRegistryEntry) => {
                        const score = modelCards[model.model_id]?.metrics?.arabic_quality?.arabic_mmlu_score
                        return score == null ? '—' : `${score}%`
                      } },
                    ].map((row) => (
                      <tr key={row.label}>
                        <td className="py-2 pr-3 text-dc1-text-muted">{row.label}</td>
                        {comparedModels.map((model) => (
                          <td key={model.model_id} className="py-2 px-3 text-dc1-text-primary">
                            {row.value(model)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2 pr-3 text-dc1-text-muted">Actions</td>
                      {comparedModels.map((model) => (
                        <td key={model.model_id} className="py-2 px-3">
                          <div className="flex gap-2">
                            <Link
                              href={`/renter/playground?model=${encodeURIComponent(model.model_id)}`}
                              className="px-2.5 py-1 text-xs rounded border border-dc1-border text-dc1-text-secondary hover:text-dc1-text-primary"
                            >
                              Playground
                            </Link>
                            <Link
                              href={`/renter/playground?model=${encodeURIComponent(model.model_id)}&mode=vllm_serve`}
                              className="px-2.5 py-1 text-xs rounded bg-dc1-amber text-dc1-void font-medium"
                            >
                              Deploy
                            </Link>
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'gpus' && loading ? (
              <div className="flex items-center justify-center py-20">
                <div
                  className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full"
                  aria-label="Loading GPUs"
                  role="status"
                />
              </div>
            ) : activeTab === 'gpus' && sorted.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-dc1-text-secondary mb-2">
                  {providers.length === 0
                    ? 'No GPUs are currently online.'
                    : 'No GPUs match your filters.'}
                </p>
                <p className="text-sm text-dc1-text-muted">
                  {providers.length === 0
                    ? 'Check back soon — providers come online throughout the day.'
                    : 'Try relaxing your filters.'}
                </p>
              </div>
            ) : activeTab === 'gpus' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sorted.map(p => (
                  <GPUCard key={p.id} provider={p} t={t} />
                ))}
              </div>
            ) : modelsLoading ? (
              <div className="flex items-center justify-center py-20">
                <div
                  className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full"
                  aria-label="Loading models"
                  role="status"
                />
              </div>
            ) : models.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-dc1-text-secondary mb-2">{t('marketplace.no_providers_for_model')}</p>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-dc1-text-secondary mb-2">No models match your catalog filters.</p>
                <p className="text-sm text-dc1-text-muted">Broaden task type, language, VRAM, or price limits.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredModels.map(model => (
                  <ModelCard
                    key={model.model_id}
                    model={model}
                    benchmark={modelCards[model.model_id]}
                    compared={compareModelIds.includes(model.model_id)}
                    onToggleCompare={toggleCompareModel}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
