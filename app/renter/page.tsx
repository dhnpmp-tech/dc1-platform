'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

// Express backend for auth + writes only
const API_BASE = process.env.NEXT_PUBLIC_DC1_API || 'http://76.13.179.86:8083'

interface Machine {
  id: string
  name: string
  gpu_type: string
  gpu_vram_gb: number | null
  gpu_utilization_pct: number | null
  gpu_temperature_c: number | null
  status: string
  online: boolean
  location: string | null
  hourly_rate_sar: number | null
  last_heartbeat: string | null
  uptime_pct_30d: number | null
}

interface Rental {
  id: string
  job_name: string
  status: string
  started_at: string | null
  ended_at: string | null
  total_cost_sar: number | null
  tags: any
  machine_id: string
  machines?: { gpu_type: string }
}

interface RenterProfile {
  id: number
  name: string
  email: string
  organization: string | null
  balance_halala: number
  total_spent_halala: number
  total_jobs: number
}

export default function RenterDashboard() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [filteredMachines, setFilteredMachines] = useState<Machine[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [renter, setRenter] = useState<RenterProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [filter, setFilter] = useState({
    minVram: 0,
    maxPrice: 10,
    status: 'all',
  })

  // ─── Supabase reads (real-time) ──────────────────────────────────────────

  const loadMachines = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('machines')
      .select('*')
      .in('status', ['active', 'verified'])
      .order('online', { ascending: false })
      .order('last_heartbeat', { ascending: false })

    if (err) {
      console.error('Supabase machines error:', err)
      return
    }
    setMachines(data || [])
  }, [])

  const loadRentals = useCallback(async (renterEmail: string) => {
    // Look up renter's Supabase user ID by email
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('email', renterEmail)
      .limit(1)

    if (!users || users.length === 0) return

    const { data, error: err } = await supabase
      .from('rentals')
      .select('*, machines(gpu_type)')
      .eq('renter_id', users[0].id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (err) {
      console.error('Supabase rentals error:', err)
      return
    }
    setRentals(data || [])
  }, [])

  // ─── Express backend for auth ────────────────────────────────────────────

  const loadRenterProfile = useCallback(async (key: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/renters/me?key=${encodeURIComponent(key)}`)
      if (res.status === 404) {
        setError('API key not found. Register below to get started.')
        return false
      }
      if (!res.ok) throw new Error('Failed to load renter data')
      const data = await res.json()
      setRenter(data.renter)
      setIsAuthenticated(true)
      sessionStorage.setItem('dc1_renter_key', key)

      // Now load rentals from Supabase using the renter's email
      if (data.renter?.email) {
        await loadRentals(data.renter.email)
      }
      return true
    } catch (err: any) {
      console.error('Renter profile error:', err)
      setError('Could not load your profile. Is the backend running?')
      return false
    }
  }, [loadRentals])

  // ─── Apply filters ───────────────────────────────────────────────────────

  const applyFilters = useCallback((machineList: Machine[]) => {
    const filtered = machineList.filter((m) => {
      const vram = m.gpu_vram_gb || 0
      const rate = m.hourly_rate_sar || 0
      const matchesVram = vram >= filter.minVram
      const matchesPrice = rate <= filter.maxPrice
      const matchesStatus = filter.status === 'all' || (filter.status === 'online' ? m.online : !m.online)
      return matchesVram && matchesPrice && matchesStatus
    })
    setFilteredMachines(filtered)
  }, [filter])

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      await loadMachines()
      const savedKey = sessionStorage.getItem('dc1_renter_key')
      if (savedKey) {
        setApiKey(savedKey)
        await loadRenterProfile(savedKey)
      }
      setLoading(false)
    }
    init()

    // Real-time subscription: machine status changes
    const subscription = supabase
      .channel('renter-gpu-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, () => {
        loadMachines()
      })
      .subscribe()

    return () => { subscription.unsubscribe() }
  }, [loadMachines, loadRenterProfile])

  // Re-filter when machines or filter state changes
  useEffect(() => {
    applyFilters(machines)
  }, [machines, applyFilters])

  const handleLogin = async () => {
    if (!apiKey.trim()) return
    setError(null)
    setLoading(true)
    await loadRenterProfile(apiKey.trim())
    setLoading(false)
  }

  const handleFilterChange = (key: string, value: any) => {
    setFilter(prev => ({ ...prev, [key]: value }))
  }

  const formatSAR = (sar: number) => sar.toFixed(2)

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
        {/* API Key Login */}
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

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {isAuthenticated && renter && (
            <>
              <div className="bg-gradient-to-br from-dc-cyan/10 to-transparent border border-dc-cyan/30 rounded-lg p-6">
                <p className="text-gray-400 text-sm">Total Spent</p>
                <h2 className="text-3xl font-bold text-dc-cyan">
                  &#xFDFC;{formatSAR((renter.total_spent_halala || 0) / 100)}
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
            <h2 className="text-3xl font-bold text-green-400">
              {machines.filter(m => m.online).length}
            </h2>
            <p className="text-xs text-gray-500 mt-2">
              Online now &middot; {filteredMachines.length} matching filters &middot; updates in real-time
            </p>
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
              <label className="text-sm text-gray-400 mb-2 block">Max Price (SAR/hr)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={filter.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', parseFloat(e.target.value) || 10)}
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
                <option value="all">All</option>
                <option value="online">Online Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* GPU Marketplace */}
        {filteredMachines.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredMachines.map((machine) => (
              <div key={machine.id} className="bg-gray-900 rounded-lg border border-gray-700 hover:border-dc-cyan/50 overflow-hidden transition-all group">
                <div className="bg-gradient-to-r from-dc-cyan/20 to-transparent p-4 border-b border-gray-700">
                  <h3 className="text-lg font-bold text-white group-hover:text-dc-cyan transition">
                    {machine.gpu_type || 'Unknown GPU'}
                  </h3>
                  {machine.name && (
                    <p className="text-xs text-gray-400 mt-1">{machine.name}</p>
                  )}
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">VRAM</p>
                      <p className="text-lg font-bold text-dc-cyan">
                        {machine.gpu_vram_gb ? `${machine.gpu_vram_gb}GB` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Rate</p>
                      <p className="text-lg font-bold text-dc-gold">
                        &#xFDFC;{machine.hourly_rate_sar || '0.38'}/hr
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">GPU Load</p>
                      <p className="text-sm text-white">
                        {machine.gpu_utilization_pct != null ? `${machine.gpu_utilization_pct}%` : 'Idle'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Uptime (30d)</p>
                      <p className="text-sm text-white">
                        {machine.uptime_pct_30d != null ? `${Number(machine.uptime_pct_30d).toFixed(0)}%` : 'New'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      machine.online
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {machine.online ? 'Online' : 'Offline'}
                    </span>
                    {machine.location && (
                      <span className="text-xs text-gray-500">{machine.location}</span>
                    )}
                  </div>
                  <Link
                    href={`/jobs/submit?provider=${machine.id}&gpu=${encodeURIComponent(machine.gpu_type || '')}&vram=${machine.gpu_vram_gb || 0}`}
                    className={`block w-full font-bold py-2 rounded transition text-center ${
                      machine.online
                        ? 'bg-dc-cyan text-dc-black hover:bg-dc-cyan/90'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {machine.online ? 'Rent This GPU' : 'Currently Offline'}
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
            <h3 className="text-xl font-bold text-white mb-2">No GPUs match your filters</h3>
            <p className="text-gray-400 mb-6">Try adjusting the filters or check back soon — providers come online throughout the day.</p>
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

        {/* Recent Rentals (Supabase real-time) */}
        {isAuthenticated && (
          <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-dc-cyan text-xl font-bold">Recent Rentals</h2>
            </div>
            <div className="divide-y divide-gray-700">
              {rentals.length > 0 ? (
                rentals.slice(0, 10).map((rental) => {
                  const tags = typeof rental.tags === 'string' ? JSON.parse(rental.tags) : rental.tags;
                  return (
                    <div key={rental.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-800/50">
                      <div>
                        <p className="text-white font-semibold">
                          {tags?.job_type || 'Compute'} — {rental.machines?.gpu_type || 'GPU'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {rental.job_name} &middot; {rental.started_at ? new Date(rental.started_at).toLocaleDateString() : 'Pending'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          rental.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                          rental.status === 'running' ? 'bg-blue-900/30 text-blue-400' :
                          rental.status === 'cancelled' ? 'bg-red-900/30 text-red-400' :
                          'bg-yellow-900/30 text-yellow-400'
                        }`}>
                          {rental.status}
                        </span>
                        {rental.total_cost_sar != null && (
                          <p className="text-sm text-gray-400 mt-1">
                            &#xFDFC;{Number(rental.total_cost_sar).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-400">No rentals yet — submit your first job to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
