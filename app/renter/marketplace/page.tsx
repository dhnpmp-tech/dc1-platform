'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatusBadge from '../../components/ui/StatusBadge'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

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
  total_jobs_completed: number | null
  cached_models: string[]
  driver_version: string | null
  compute_capability: string | null
  cost_rates_halala_per_min: CostRates | null
}

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
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

function halalaPriceToSarHr(halalPerMin: number): string {
  return ((halalPerMin * 60) / 100).toFixed(2)
}

function formatHeartbeatAge(seconds: number | null): string {
  if (seconds === null) return 'unknown'
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

export default function MarketplacePage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [sortBy, setSortBy] = useState<'reputation' | 'vram' | 'price'>('reputation')
  const [renterName, setRenterName] = useState('Renter')

  useEffect(() => {
    const key = typeof window !== 'undefined' ? localStorage.getItem('dc1_renter_key') : null
    if (key) {
      fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(key)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.renter?.name) setRenterName(d.renter.name) })
        .catch(() => {})
    }

    const fetchProviders = async () => {
      try {
        const res = await fetch(`${API_BASE}/providers/available`)
        if (res.ok) {
          const data = await res.json()
          setProviders(data.providers || [])
        }
      } catch (err) {
        console.error('Failed to load providers:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProviders()
    const interval = setInterval(fetchProviders, 15000)
    return () => clearInterval(interval)
  }, [])

  const filtered = providers.filter(
    (p) => !filter || p.gpu_model?.toLowerCase().includes(filter.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'vram') return (b.vram_gb ?? 0) - (a.vram_gb ?? 0)
    if (sortBy === 'price') {
      const aRate = a.cost_rates_halala_per_min?.['llm-inference'] ?? a.cost_rates_halala_per_min?.default ?? 10
      const bRate = b.cost_rates_halala_per_min?.['llm-inference'] ?? b.cost_rates_halala_per_min?.default ?? 10
      return aRate - bRate
    }
    return (b.reputation_score ?? 0) - (a.reputation_score ?? 0)
  })

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renterName}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-dc1-text-primary mb-1">GPU Marketplace</h1>
            <p className="text-dc1-text-secondary text-sm">
              {providers.length} GPU{providers.length !== 1 ? 's' : ''} online — refreshes every 15s
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Filter by GPU model..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input max-w-xs"
              aria-label="Filter GPUs by model"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'reputation' | 'vram' | 'price')}
              className="input"
              aria-label="Sort GPUs"
            >
              <option value="reputation">Sort: Reputation</option>
              <option value="vram">Sort: VRAM ↓</option>
              <option value="price">Sort: Price ↑</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full" aria-label="Loading" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-dc1-text-secondary mb-4">
              {providers.length === 0 ? 'No GPUs are currently online.' : 'No GPUs match your filter.'}
            </p>
            <p className="text-sm text-dc1-text-muted">Check back soon — providers come online throughout the day.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((p) => {
              const llmRate = p.cost_rates_halala_per_min?.['llm-inference'] ?? p.cost_rates_halala_per_min?.llm_inference ?? 15
              const imgRate = p.cost_rates_halala_per_min?.image_generation ?? 20
              const trainRate = p.cost_rates_halala_per_min?.training ?? 25

              return (
                <div
                  key={p.id}
                  className="card hover:border-dc1-amber/30 transition-colors flex flex-col"
                  role="article"
                  aria-label={`GPU: ${p.gpu_model}`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-dc1-text-primary leading-tight">
                        {p.gpu_model || 'Unknown GPU'}
                      </h3>
                      <p className="text-xs text-dc1-text-muted mt-0.5">{p.name}</p>
                    </div>
                    <StatusBadge status={p.is_live ? 'online' : 'offline'} size="sm" pulse={p.is_live} />
                  </div>

                  {/* Specs */}
                  <div className="space-y-1.5 text-sm text-dc1-text-secondary mb-4 flex-1">
                    {p.vram_gb != null && p.vram_gb > 0 && (
                      <div className="flex justify-between">
                        <span>VRAM</span>
                        <span className="text-dc1-text-primary font-medium">{p.vram_gb} GB</span>
                      </div>
                    )}
                    {p.gpu_count > 1 && (
                      <div className="flex justify-between">
                        <span>GPUs</span>
                        <span className="text-dc1-text-primary font-medium">{p.gpu_count}×</span>
                      </div>
                    )}
                    {p.location && (
                      <div className="flex justify-between">
                        <span>Location</span>
                        <span className="text-dc1-text-primary">{p.location}</span>
                      </div>
                    )}
                    {p.compute_capability && (
                      <div className="flex justify-between">
                        <span>CUDA CC</span>
                        <span className="text-dc1-text-primary">{p.compute_capability}</span>
                      </div>
                    )}
                    {p.reliability_score != null && p.reliability_score > 0 && (
                      <div className="flex justify-between">
                        <span>Reliability</span>
                        <span className={`font-medium ${p.reliability_score >= 90 ? 'text-status-success' : p.reliability_score >= 70 ? 'text-dc1-amber' : 'text-status-error'}`}>
                          {p.reliability_score}%
                        </span>
                      </div>
                    )}
                    {p.heartbeat_age_seconds !== null && (
                      <div className="flex justify-between">
                        <span>Last seen</span>
                        <span className="text-dc1-text-muted text-xs">{formatHeartbeatAge(p.heartbeat_age_seconds)}</span>
                      </div>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="bg-dc1-surface-l2 rounded-md p-3 mb-3 space-y-1 text-sm">
                    <p className="text-xs text-dc1-text-muted uppercase tracking-wide mb-2 font-semibold">Pricing (SAR/hr)</p>
                    <div className="flex justify-between">
                      <span className="text-dc1-text-secondary">LLM Inference</span>
                      <span className="text-dc1-amber font-semibold">{halalaPriceToSarHr(llmRate)} SAR/hr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dc1-text-secondary">Image Generation</span>
                      <span className="text-dc1-amber font-semibold">{halalaPriceToSarHr(imgRate)} SAR/hr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dc1-text-secondary">Training</span>
                      <span className="text-dc1-amber font-semibold">{halalaPriceToSarHr(trainRate)} SAR/hr</span>
                    </div>
                  </div>

                  {/* Cached Models */}
                  {p.cached_models && p.cached_models.length > 0 && (
                    <div className="mb-3 pt-2 border-t border-dc1-border/50">
                      <p className="text-xs text-dc1-text-muted mb-1.5">Cached Models (instant start):</p>
                      <div className="flex flex-wrap gap-1">
                        {p.cached_models.slice(0, 4).map((m, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded bg-status-success/10 text-status-success border border-status-success/20">
                            {m.split('/').pop()}
                          </span>
                        ))}
                        {p.cached_models.length > 4 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-dc1-surface-l2 text-dc1-text-muted">
                            +{p.cached_models.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  <Link
                    href={`/renter/playground?provider=${p.id}`}
                    className="btn btn-primary w-full text-center text-sm mt-auto"
                  >
                    Use This GPU
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
