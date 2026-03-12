'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/app/components/layout/DashboardLayout'
import StatusBadge from '@/app/components/ui/StatusBadge'

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

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: <HomeIcon /> },
  { label: 'Providers', href: '/admin/providers', icon: <ServerIcon /> },
  { label: 'Renters', href: '/admin/renters', icon: <UsersIcon /> },
  { label: 'Jobs', href: '/admin/jobs', icon: <BriefcaseIcon /> },
  { label: 'Security', href: '/admin/security', icon: <ShieldIcon /> },
  { label: 'Fleet Health', href: '/admin/fleet', icon: <CpuIcon /> },
]

export default function ProvidersPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') : null

  useEffect(() => {
    if (!token) { router.push('/login'); return }
    fetchProviders()
  }, [])

  const fetchProviders = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/providers`, { headers: { 'x-admin-token': token! } })
      if (res.status === 401) { localStorage.removeItem('dc1_admin_token'); router.push('/login'); return }
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    } finally { setLoading(false) }
  }

  const handleSuspend = async (id: number, action: 'suspend' | 'unsuspend') => {
    setActionLoading(id)
    try {
      await fetch(`${API_BASE}/admin/providers/${id}/${action}`, {
        method: 'POST',
        headers: { 'x-admin-token': token!, 'Content-Type': 'application/json' },
      })
      await fetchProviders()
    } catch (err) { console.error(err) }
    finally { setActionLoading(null) }
  }

  const providers = data?.providers || []
  const filtered = providers.filter((p: any) => {
    if (filter === 'online' && !p.is_online) return false
    if (filter === 'offline' && (p.is_online || !p.last_heartbeat)) return false
    if (filter === 'suspended' && p.status !== 'suspended') return false
    if (search && !p.name?.toLowerCase().includes(search.toLowerCase()) && !p.email?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const formatTime = (iso: string) => {
    if (!iso) return 'Never'
    return new Date(iso).toLocaleDateString() + ' ' + new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Provider Management</h1>
        <p className="text-dc1-text-secondary">
          {data ? `${data.total} total — ${data.online} online, ${data.offline} offline` : 'Loading...'}
        </p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by name or email..."
            className="input flex-1"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-2">
            {['all', 'online', 'offline', 'suspended'].map(f => (
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
        <div className="text-dc1-text-secondary">Loading providers...</div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>GPU</th>
                  <th>Status</th>
                  <th>Uptime 24h</th>
                  <th>Jobs</th>
                  <th>Earnings</th>
                  <th>Last Seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/providers/${p.id}`} className="text-dc1-amber hover:underline font-medium">
                        {p.name}
                      </Link>
                      <div className="text-xs text-dc1-text-muted">{p.email}</div>
                    </td>
                    <td className="text-sm text-dc1-amber">{p.gpu_model || p.gpu_name_detected || '—'}</td>
                    <td>
                      <StatusBadge status={p.status === 'suspended' ? 'warning' : p.is_online ? 'online' : 'offline'}
                        label={p.status === 'suspended' ? 'Suspended' : p.is_online ? 'Online' : p.last_heartbeat ? 'Offline' : 'Registered'} />
                    </td>
                    <td className="text-sm">{p.uptime_24h !== null ? `${p.uptime_24h}%` : '—'}</td>
                    <td className="text-sm">{p.total_jobs || 0}</td>
                    <td className="text-sm">{p.total_earnings ? `${(p.total_earnings / 100).toFixed(2)} SAR` : '—'}</td>
                    <td className="text-xs text-dc1-text-secondary">{p.minutes_since_heartbeat !== null ? `${p.minutes_since_heartbeat}m ago` : 'Never'}</td>
                    <td>
                      {p.status === 'suspended' ? (
                        <button
                          onClick={() => handleSuspend(p.id, 'unsuspend')}
                          disabled={actionLoading === p.id}
                          className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-50"
                        >
                          {actionLoading === p.id ? '...' : 'Reactivate'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuspend(p.id, 'suspend')}
                          disabled={actionLoading === p.id}
                          className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50"
                        >
                          {actionLoading === p.id ? '...' : 'Suspend'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-dc1-text-muted text-sm text-center">No providers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
