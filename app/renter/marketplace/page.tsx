'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/app/components/layout/DashboardLayout'
import StatusBadge from '@/app/components/ui/StatusBadge'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

interface Provider {
  id: number
  name: string
  gpu_model: string
  vram_gb: number
  vram_mib: number
  status: string
  location: string
  reliability_score: number
  cached_models: string[]
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

const navItems = [
  { label: 'Dashboard', href: '/renter', icon: <HomeIcon /> },
  { label: 'Marketplace', href: '/renter/marketplace', icon: <MarketplaceIcon /> },
  { label: 'Playground', href: '/renter/playground', icon: <PlaygroundIcon /> },
  { label: 'My Jobs', href: '/renter/jobs', icon: <JobsIcon /> },
  { label: 'Billing', href: '/renter/billing', icon: <BillingIcon /> },
]

export default function MarketplacePage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [renterName, setRenterName] = useState('Renter')

  useEffect(() => {
    // Get renter name for sidebar
    const key = typeof window !== 'undefined' ? localStorage.getItem('dc1_renter_key') : null
    if (key) {
      fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(key)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.renter?.name) setRenterName(d.renter.name) })
        .catch(() => {})
    }

    const fetchProviders = async () => {
      try {
        const res = await fetch(`${API_BASE}/renters/available-providers`)
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

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renterName}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-dc1-text-primary mb-1">GPU Marketplace</h1>
            <p className="text-dc1-text-secondary text-sm">
              {providers.length} GPU{providers.length !== 1 ? 's' : ''} online — refreshes every 15 seconds
            </p>
          </div>
          <input
            type="text"
            placeholder="Filter by GPU model..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input max-w-xs"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-dc1-text-secondary mb-4">
              {providers.length === 0 ? 'No GPUs are currently online.' : 'No GPUs match your filter.'}
            </p>
            <p className="text-sm text-dc1-text-muted">Check back soon — providers come online throughout the day.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <div key={p.id} className="card hover:border-dc1-amber/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-dc1-text-primary">{p.gpu_model || 'Unknown GPU'}</h3>
                  <StatusBadge status="online" size="sm" pulse />
                </div>
                <div className="space-y-2 text-sm text-dc1-text-secondary">
                  <div className="flex justify-between">
                    <span>Provider</span>
                    <span className="text-dc1-text-primary">{p.name}</span>
                  </div>
                  {p.vram_gb > 0 && (
                    <div className="flex justify-between">
                      <span>VRAM</span>
                      <span className="text-dc1-text-primary">{p.vram_gb} GB</span>
                    </div>
                  )}
                  {p.location && (
                    <div className="flex justify-between">
                      <span>Location</span>
                      <span className="text-dc1-text-primary">{p.location}</span>
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
                  <div className="flex justify-between">
                    <span>LLM Rate</span>
                    <span className="text-dc1-amber font-medium">15 halala/min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Image Gen Rate</span>
                    <span className="text-dc1-amber font-medium">20 halala/min</span>
                  </div>
                </div>

                {/* Cached Models */}
                {p.cached_models && p.cached_models.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-dc1-border/50">
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

                <div className="mt-4 pt-3 border-t border-dc1-border">
                  <Link href={`/renter/playground?provider=${p.id}`} className="btn btn-primary w-full text-center text-sm">
                    Use This GPU
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
