'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/app/components/layout/DashboardLayout'
import StatusBadge from '@/app/components/ui/StatusBadge'
import StatCard from '@/app/components/ui/StatCard'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

const HomeIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M9 21h6a2 2 0 002-2V9l-7-4-7 4v10a2 2 0 002 2z" /></svg>)
const ServerIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12v4a2 2 0 002 2h10a2 2 0 002-2v-4" /></svg>)
const UsersIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>)
const BriefcaseIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>)
const ShieldIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>)
const CpuIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>)
const CurrencyIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>)

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: <HomeIcon /> },
  { label: 'Providers', href: '/admin/providers', icon: <ServerIcon /> },
  { label: 'Renters', href: '/admin/renters', icon: <UsersIcon /> },
  { label: 'Jobs', href: '/admin/jobs', icon: <BriefcaseIcon /> },
  { label: 'Finance', href: '/admin/finance', icon: <CurrencyIcon /> },
  { label: 'Security', href: '/admin/security', icon: <ShieldIcon /> },
  { label: 'Fleet Health', href: '/admin/fleet', icon: <CpuIcon /> },
]

export default function JobsPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') : null

  useEffect(() => {
    if (!token) { router.push('/login'); return }
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/jobs`, { headers: { 'x-admin-token': token! } })
      if (res.status === 401) { localStorage.removeItem('dc1_admin_token'); router.push('/login'); return }
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    } finally { setLoading(false) }
  }

  const handleCancel = async (id: string) => {
    setActionLoading(id)
    try {
      await fetch(`${API_BASE}/admin/jobs/${id}/cancel`, {
        method: 'POST',
        headers: { 'x-admin-token': token!, 'Content-Type': 'application/json' },
      })
      await fetchJobs()
    } catch (err) { console.error(err) }
    finally { setActionLoading(null) }
  }

  const jobs = data?.jobs || []
  const filtered = jobs.filter((j: any) => {
    if (filter !== 'all' && j.status !== filter) return false
    if (search) {
      const searchLower = search.toLowerCase()
      if (!j.provider_name?.toLowerCase().includes(searchLower) &&
          !j.renter_name?.toLowerCase().includes(searchLower) &&
          !j.job_id?.toLowerCase().includes(searchLower)) {
        return false
      }
    }
    return true
  })

  const getStatusBadgeType = (status: string): 'online' | 'offline' | 'active' | 'inactive' | 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'warning' => {
    switch (status) {
      case 'completed': return 'completed'
      case 'failed': return 'failed'
      case 'running': return 'running'
      case 'pending': return 'pending'
      case 'cancelled': return 'offline'
      case 'assigned': return 'active'
      default: return 'offline'
    }
  }

  const formatTime = (iso: string) => {
    if (!iso) return 'Never'
    return new Date(iso).toLocaleDateString() + ' ' + new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const truncateId = (id: string) => {
    if (!id) return '—'
    return id.length > 12 ? id.substring(0, 12) + '...' : id
  }

  const canCancel = (status: string) => {
    return status !== 'completed' && status !== 'cancelled'
  }

  const stats = [
    { label: 'Total Jobs', value: String(data?.total || 0), accent: 'default' as const },
    { label: 'Completed', value: String(data?.completed || 0), accent: 'success' as const },
    { label: 'Failed', value: String(data?.failed || 0), accent: 'error' as const },
    { label: 'Active', value: String((data?.pending || 0) + (data?.assigned || 0) + (data?.running || 0)), accent: 'info' as const },
    { label: 'Total Revenue', value: `${((data?.total_revenue_halala || 0) / 100).toFixed(2)} SAR`, accent: 'amber' as const },
  ]

  return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Job Control Center</h1>
        <p className="text-dc1-text-secondary">
          {data ? `${data.total} total jobs` : 'Loading...'}
        </p>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {stats.map((stat, idx) => (
            <StatCard key={idx} label={stat.label} value={stat.value} accent={stat.accent} />
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by provider, renter, or job ID..."
            className="input flex-1"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-2">
            {['all', 'pending', 'assigned', 'running', 'completed', 'failed', 'cancelled'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-dc1-amber text-black'
                    : 'bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-dc1-text-secondary">Loading jobs...</div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Type</th>
                  <th>Provider</th>
                  <th>Renter</th>
                  <th>Status</th>
                  <th>Cost (SAR)</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((j: any) => (
                  <tr key={j.job_id}>
                    <td className="font-mono text-sm text-dc1-amber">{truncateId(j.job_id)}</td>
                    <td className="text-sm">{j.job_type || '—'}</td>
                    <td className="text-sm">{j.provider_name || '—'}</td>
                    <td className="text-sm">{j.renter_name || '—'}</td>
                    <td>
                      <StatusBadge status={getStatusBadgeType(j.status)} label={j.status.charAt(0).toUpperCase() + j.status.slice(1)} />
                    </td>
                    <td className="text-sm">{j.cost_halala ? `${(j.cost_halala / 100).toFixed(2)}` : '—'}</td>
                    <td className="text-xs text-dc1-text-secondary">{formatTime(j.created_at)}</td>
                    <td>
                      {canCancel(j.status) ? (
                        <button
                          onClick={() => handleCancel(j.job_id)}
                          disabled={actionLoading === j.job_id}
                          className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50"
                        >
                          {actionLoading === j.job_id ? '...' : 'Cancel'}
                        </button>
                      ) : (
                        <span className="text-xs text-dc1-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-dc1-text-muted text-sm text-center">No jobs found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
