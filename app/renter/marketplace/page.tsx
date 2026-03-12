'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Footer from '@/app/components/layout/Footer'
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
  status: string
}

export default function MarketplacePage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
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
    <div className="min-h-screen bg-dc1-void">
      <header className="bg-dc1-surface-l1 border-b border-dc1-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="https://dc1st.com/assets/dc1-logo-Z67caTEl.webp" alt="DC1" className="h-8 w-auto" />
            <span className="text-lg font-bold text-dc1-text-primary">DC1</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/renter" className="text-sm text-dc1-text-secondary hover:text-dc1-amber">Dashboard</Link>
            <Link href="/login" className="text-sm text-dc1-amber hover:underline">Sign In</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">GPU Marketplace</h1>
            <p className="text-dc1-text-secondary">Browse available GPUs on the DC1 network</p>
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
          <div className="text-dc1-text-secondary">Loading available GPUs...</div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-dc1-text-secondary mb-4">
              {providers.length === 0 ? 'No GPUs are currently online.' : 'No GPUs match your filter.'}
            </p>
            <p className="text-sm text-dc1-text-muted">Check back soon — providers come online throughout the day.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <div className="flex justify-between">
                    <span>LLM Rate</span>
                    <span className="text-dc1-amber font-medium">15 halala/min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Image Gen Rate</span>
                    <span className="text-dc1-amber font-medium">20 halala/min</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-dc1-border">
                  <Link href={`/renter/playground?provider=${p.id}`} className="btn btn-primary w-full text-center text-sm">
                    Use This GPU
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-dc1-text-muted">
          {providers.length} GPU{providers.length !== 1 ? 's' : ''} online — refreshes every 15 seconds
        </div>
      </main>

      <Footer />
    </div>
  )
}
