'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/app/components/layout/DashboardLayout'
import StatCard from '@/app/components/ui/StatCard'
import StatusBadge from '@/app/components/ui/StatusBadge'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

interface NavItem { label: string; href: string; icon: React.ReactNode }

export default function AdminDashboard() {
  const router = useRouter()
  const [isAuthed, setIsAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [gpuBreakdown, setGpuBreakdown] = useState<any[]>([])
  const [recentSignups, setRecentSignups] = useState<any[]>([])
  const [recentHeartbeats, setRecentHeartbeats] = useState<any[]>([])

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') : null
    if (!token) { router.push('/login'); return }
    setIsAuthed(true)

    const fetchDashboard = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/dashboard`, {
          headers: { 'x-admin-token': token },
        })
        if (!res.ok) {
          if (res.status === 401) { localStorage.removeItem('dc1_admin_token'); router.push('/login'); return }
          throw new Error('Failed to load dashboard')
        }
        const data = await res.json()
        setStats(data.stats)
        setGpuBreakdown(data.gpu_breakdown || [])
        setRecentSignups(data.recent_signups || [])
        setRecentHeartbeats(data.recent_heartbeats || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 30000)
    return () => clearInterval(interval)
  }, [router])

  if (!isAuthed) return <div className="flex items-center justify-center min-h-screen text-dc1-text-secondary">Loading...</div>

  const HomeIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M9 21h6a2 2 0 002-2V9l-7-4-7 4v10a2 2 0 002 2z" /></svg>)
  const ServerIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12v4a2 2 0 002 2h10a2 2 0 002-2v-4" /></svg>)
  const UsersIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>)
  const BriefcaseIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>)
  const ShieldIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>)
  const CpuIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>)
  const BoltIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>)
  const CurrencyIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>)

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/admin', icon: <HomeIcon /> },
    { label: 'Providers', href: '/admin/providers', icon: <ServerIcon /> },
    { label: 'Renters', href: '/admin/renters', icon: <UsersIcon /> },
    { label: 'Jobs', href: '/admin/jobs', icon: <BriefcaseIcon /> },
    { label: 'Finance', href: '/admin/finance', icon: <CurrencyIcon /> },
    { label: 'Security', href: '/admin/security', icon: <ShieldIcon /> },
    { label: 'Fleet Health', href: '/admin/fleet', icon: <CpuIcon /> },
  ]

  const formatTime = (iso: string) => {
    if (!iso) return 'Never'
    const d = new Date(iso)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const totalGpus = gpuBreakdown.reduce((sum: number, g: any) => sum + g.count, 0)

  return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Admin Dashboard</h1>
        <p className="text-dc1-text-secondary">Live platform overview</p>
      </div>

      {error && <div className="card mb-6 border-red-500/50 text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="text-dc1-text-secondary">Loading dashboard data...</div>
      ) : (
        <>
          {/* Provider Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <StatCard label="Total Providers" value={String(stats?.total_providers || 0)} accent="default" />
            <StatCard label="Online Now" value={String(stats?.online_now || 0)} accent="success" />
            <StatCard label="Total Renters" value={String(stats?.total_renters || 0)} accent="info" />
            <StatCard label="Active Jobs" value={String(stats?.active_jobs || 0)} accent="amber" />
          </div>

          {/* Revenue Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Revenue" value={`${((stats?.total_revenue_halala || 0) / 100).toFixed(2)} SAR`} accent="success" />
            <StatCard label="DC1 Fees" value={`${((stats?.total_dc1_fees_halala || 0) / 100).toFixed(2)} SAR`} accent="amber" />
            <StatCard label="Today Revenue" value={`${((stats?.today_revenue_halala || 0) / 100).toFixed(2)} SAR`} accent="info" />
            <StatCard label="Jobs Completed" value={String(stats?.completed_jobs || 0)} accent="default" />
          </div>

          {/* GPU Fleet */}
          <div className="card mb-8">
            <h2 className="section-heading mb-6">GPU Fleet Breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gpuBreakdown.map((g: any) => (
                <div key={g.gpu_model} className="bg-dc1-surface-l2 rounded-lg p-4 border border-dc1-border/50 hover:border-dc1-amber/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-dc1-text-secondary mb-1">{g.gpu_model || 'Unknown'}</p>
                      <p className="text-2xl font-bold text-dc1-text-primary">{g.count}</p>
                      <p className="text-xs text-dc1-text-muted mt-1">providers</p>
                    </div>
                    <div className="w-12 h-12 bg-dc1-amber/10 rounded-lg flex items-center justify-center text-dc1-amber">
                      <BoltIcon />
                    </div>
                  </div>
                </div>
              ))}
              {gpuBreakdown.length === 0 && <p className="text-dc1-text-muted text-sm col-span-3">No GPU data yet</p>}
            </div>
          </div>

          {/* Recent Signups */}
          <div className="card mb-8">
            <h2 className="section-heading mb-6">Recent Provider Signups</h2>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>GPU Model</th><th>OS</th><th>Joined</th></tr>
                </thead>
                <tbody>
                  {recentSignups.map((p: any) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-sm">{p.email}</td>
                      <td className="text-sm text-dc1-amber">{p.gpu_model || '—'}</td>
                      <td className="text-sm">{p.os || '—'}</td>
                      <td className="text-sm text-dc1-text-secondary">{formatTime(p.created_at)}</td>
                    </tr>
                  ))}
                  {recentSignups.length === 0 && <tr><td colSpan={5} className="text-dc1-text-muted text-sm">No signups yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Heartbeats */}
          <div className="card">
            <h2 className="section-heading mb-6">Recent Daemon Heartbeats</h2>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Provider</th><th>GPU</th><th>IP</th><th>Hostname</th><th>Last Seen</th></tr>
                </thead>
                <tbody>
                  {recentHeartbeats.map((h: any) => (
                    <tr key={h.id}>
                      <td className="font-medium">{h.name}</td>
                      <td className="text-sm text-dc1-amber">{h.gpu_model || '—'}</td>
                      <td className="text-sm font-mono">{h.provider_ip || '—'}</td>
                      <td className="text-sm">{h.provider_hostname || '—'}</td>
                      <td className="text-sm text-dc1-text-secondary">{formatTime(h.last_heartbeat)}</td>
                    </tr>
                  ))}
                  {recentHeartbeats.length === 0 && <tr><td colSpan={5} className="text-dc1-text-muted text-sm">No heartbeats yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
