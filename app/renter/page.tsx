'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_DC1_API || 'http://76.13.179.86:8083'

interface Provider {
  id: number
  name: string
  gpu_model: string
  vram_gb: number | null
  vram_mib: number | null
  status: string
  location: string | null
  reliability_score: number | null
}

interface Job {
  id: number
  job_id: string
  job_type: string
  status: string
  submitted_at: string
  completed_at: string | null
  actual_cost_halala: number | null
}

interface RenterProfile {
  id: number
  name: string
  email: string
  organization: string | null
  balance_halala: number
  total_spent_halala: number
  total_jobs: number
  created_at: string
}

export default function RenterDashboard() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([])
  const [renter, setRenter] = useState<RenterProfile | null>(null)
  const [recentJobs, setRecentJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [filter, setFilter] = useState({
    minVram: 0,
    maxVram: 100,
    status: 'all',
  })

  // Load available providers (public endpoint — no auth required)
  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/renters/available-providers`)
      if (!res.ok) throw new Error('Failed to load providers')
      const data = await res.json()
      setProviders(data.providers || [])
    } catch (err: any) {
      console.error('Provider fetch error:', err)
      setError('Could not connect to DC1 backend. Is the API running?')
    }
  }, [])

  // Load renter profile + recent jobs (requires API key)
  const loadRenterData = useCallback(async (key: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/renters/me?key=${encodeURIComponent(key)}`)
      if (res.status === 404) {
        setError('API key not found. Register below to get started.')
        return false
      }
      if (!res.ok) throw new Error('Failed to load renter data')
      const data = await res.json()
      setRenter(data.renter)
      setRecentJobs(data.recent_jobs || [])
      setIsAuthenticated(true)
      // Persist key for session
      sessionStorage.setItem('dc1_renter_key', key)
      return true
    } catch (err: any) {
      console.error('Renter data error:', err)
      setError('Could not load your profile. Check your API key.')
      return false
    }
  }, [])

  // Apply VRAM filters to provider list
  const applyFilters = useCallback((providerList: Provider[]) => {
    const filtered = providerList.filter((p) => {
      const vram = p.vram_gb || 0
      const matchesMinVram = vram >= filter.minVram
      const matchesMaxVram = vram <= filter.maxVram
      const matchesStatus = filter.status === 'all' || p.status === filter.status
      return matchesMinVram && matchesMaxVram && matchesStatus
    })
    setFilteredProviders(filtered)
  }, [filter])

  // On mount: load providers, check for saved key
  useEffect(() => {
    const init = async () => {
      await loadProviders()
      const savedKey = sessionStorage.getItem('dc1_renter_key')
      if (savedKey) {
        setApiKey(savedKey)
        await loadRenterData(savedKey)
      }
      setLoading(false)
    }
    init()
  }, [loadProviders, loadRenterData])

  // Re-filter when providers or filter changes
  useEffect(() => {
    applyFilters(providers)
  }, [providers, applyFilters])

  // Poll providers every 30s
  useEffect(() => {
    const interval = setInterval(loadProviders, 30000)
    return () => clearInterval(interval)
  }, [loadProviders])

  const handleLogin = async () => {
    if (!apiKey.trim()) return
    setError(null)
    setLoading(true)
    await loadRenterData(apiKey.trim())
    setLoading(false)
  }

  const handleFilterChange = (key: string, value: any) => {
    setFilter(prev => ({ ...prev, [key]: value }))
  }

  const formatSAR = (halala: number) => {
    return (halala / 100).toFixed(2)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dc-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-dc-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-dc-cyan text-xl">Loading Renter Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-dc-black">
      {/* Navigation */}
      <nav className="bg-gray-900 border-b border-dc-cyan/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-dc-cyan font-bold text-xl">DC1</Link>
          <h1 className="text-dc-cyan text-2xl font-bold">Renter Dashboard</h1>
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded-full">
                Authenticated
              </span>
            )}
            <Link
              href="/jobs/submit"
              className="bg-dc-cyan text-dc-black font-bold px-4 py-2 rounded hover:bg-dc-cyan/90 transition text-sm"
            >
              Submit a Job
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* API Key Login (if not authenticated) */}
        {!isAuthenticated && (
          <div className="bg-gray-900 rounded-lg border border-dc-cyan/30 p-6 mb-8">
            <h3 className="text-dc-cyan font-bold mb-2">Renter Login</h3>
            <p className="text-gray-400 text-sm mb-4">
              Enter your renter API key to view your profile and billing.
              Don&apos;t have one? <Link href="/renter/register" className="text-dc-cyan hover:underline">Register here</Link>.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="dc1-renter-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 font-mono text-sm focus:border-dc-cyan focus:outline-none"
              />
              <button
                onClick={handleLogin}
                className="bg-dc-cyan text-dc-black font-bold px-6 py-2 rounded hover:bg-dc-cyan/90 transition"
              >
                Login
              </button>
            </div>
            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          </div>
        )}

        {/* Stats (show renter data if authenticated, otherwise just provider count) */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {isAuthenticated && renter && (
            <>
              <div className="bg-gradient-to-br from-dc-cyan/10 to-transparent border border-dc-cyan/30 rounded-lg p-6">
                <p className="text-gray-400 text-sm">Total Spent</p>
                <h2 className="text-3xl font-bold text-dc-cyan">
                  &#xFDFC;{formatSAR(renter.total_spent_halala || 0)}
                </h2>
                <p className="text-xs text-gray-500 mt-2">Lifetime spending</p>
              </div>
              <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-lg p-6">
                <p className="text-gray-400 text-sm">Jobs Submitted</p>
                <h2 className="text-3xl font-bold text-white">{renter.total_jobs || 0}</h2>
                <p className="text-xs text-gray-500 mt-2">Total jobs</p>
              </div>
            </>
          )}
          <div className={`bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-lg p-6 ${!isAuthenticated ? 'md:col-span-3' : ''}`}>
            <p className="text-gray-400 text-sm">Available GPUs</p>
            <h2 className="text-3xl font-bold text-green-400">{filteredProviders.length}</h2>
            <p className="text-xs text-gray-500 mt-2">Online &amp; ready to rent</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 mb-8">
          <h3 className="text-dc-cyan font-bold mb-4">GPU Marketplace Filters</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Min VRAM (GB)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={filter.minVram}
                onChange={(e) => handleFilterChange('minVram', parseInt(e.target.value) || 0)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-dc-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Max VRAM (GB)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={filter.maxVram}
                onChange={(e) => handleFilterChange('maxVram', parseInt(e.target.value) || 100)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-dc-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Status</label>
              <select
                value={filter.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-dc-cyan focus:outline-none"
              >
                <option value="all">All Online</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>
        </div>

        {/* GPU Marketplace */}
        {filteredProviders.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredProviders.map((provider) => (
              <div key={provider.id} className="bg-gray-900 rounded-lg border border-gray-700 hover:border-dc-cyan/50 overflow-hidden transition-all group">
                <div className="bg-gradient-to-r from-dc-cyan/20 to-transparent p-4 border-b border-gray-700">
                  <h3 className="text-lg font-bold text-white group-hover:text-dc-cyan transition">
                    {provider.gpu_model || 'Unknown GPU'}
                  </h3>
                  {provider.name && (
                    <p className="text-xs text-gray-400 mt-1">{provider.name}</p>
                  )}
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">VRAM</p>
                      <p className="text-lg font-bold text-dc-cyan">
                        {provider.vram_gb ? `${provider.vram_gb}GB` : provider.vram_mib ? `${provider.vram_mib}MiB` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Reliability</p>
                      <p className="text-lg font-bold text-dc-gold">
                        {provider.reliability_score != null ? `${(provider.reliability_score * 100).toFixed(0)}%` : 'New'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-900/30 text-green-400">
                      {provider.status}
                    </span>
                    {provider.location && (
                      <span className="text-xs text-gray-500">{provider.location}</span>
                    )}
                  </div>
                  <Link
                    href={`/jobs/submit?provider=${provider.id}&gpu=${encodeURIComponent(provider.gpu_model || '')}&vram=${provider.vram_gb || 0}`}
                    className="block w-full bg-dc-cyan text-dc-black font-bold py-2 rounded hover:bg-dc-cyan/90 transition text-center"
                  >
                    Rent This GPU
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-12 mb-8 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h9a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0017.25 4.5h-9A2.25 2.25 0 006 6.75v10.5A2.25 2.25 0 008.25 19.5z" />
            </svg>
            <h3 className="text-xl font-bold text-white mb-2">No GPUs available right now</h3>
            <p className="text-gray-400 mb-6">Check back soon — providers come online throughout the day.</p>
            <div className="flex justify-center gap-4">
              <Link
                href="/provider-onboarding"
                className="text-dc-cyan hover:text-dc-cyan/80 text-sm underline transition"
              >
                Join as a provider
              </Link>
              <Link
                href="/jobs/submit"
                className="bg-dc-cyan text-dc-black font-bold px-6 py-2 rounded hover:bg-dc-cyan/90 transition text-sm"
              >
                Submit a Job
              </Link>
            </div>
          </div>
        )}

        {/* Recent Jobs (only if authenticated) */}
        {isAuthenticated && (
          <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-dc-cyan text-xl font-bold">Recent Jobs</h2>
            </div>
            <div className="divide-y divide-gray-700">
              {recentJobs.length > 0 ? (
                recentJobs.slice(0, 10).map((job) => (
                  <div key={job.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-800/50">
                    <div>
                      <p className="text-white font-semibold">{job.job_type}</p>
                      <p className="text-xs text-gray-500">
                        {job.job_id} &middot; {new Date(job.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        job.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                        job.status === 'running' ? 'bg-blue-900/30 text-blue-400' :
                        job.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                        job.status === 'cancelled' ? 'bg-gray-700 text-gray-400' :
                        'bg-yellow-900/30 text-yellow-400'
                      }`}>
                        {job.status}
                      </span>
                      {job.actual_cost_halala != null && (
                        <p className="text-sm text-gray-400 mt-1">
                          &#xFDFC;{formatSAR(job.actual_cost_halala)}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-400">No jobs yet — submit your first job to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
