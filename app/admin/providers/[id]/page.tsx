'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/app/components/layout/DashboardLayout'
import StatCard from '@/app/components/ui/StatCard'
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
const CurrencyIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>)
const WalletIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>)

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: <HomeIcon /> },
  { label: 'Providers', href: '/admin/providers', icon: <ServerIcon /> },
  { label: 'Renters', href: '/admin/renters', icon: <UsersIcon /> },
  { label: 'Jobs', href: '/admin/jobs', icon: <BriefcaseIcon /> },
  { label: 'Finance', href: '/admin/finance', icon: <CurrencyIcon /> },
  { label: 'Withdrawals', href: '/admin/withdrawals', icon: <WalletIcon /> },
  { label: 'Security', href: '/admin/security', icon: <ShieldIcon /> },
  { label: 'Fleet Health', href: '/admin/fleet', icon: <CpuIcon /> },
]

export default function ProviderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'jobs' | 'heartbeats' | 'recovery'>('overview')
  const [actionLoading, setActionLoading] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') : null

  useEffect(() => {
    if (!token) { router.push('/login'); return }
    fetchDetail()
  }, [id])

  const fetchDetail = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/providers/${id}`, { headers: { 'x-admin-token': token! } })
      if (res.status === 401) { localStorage.removeItem('dc1_admin_token'); router.push('/login'); return }
      if (res.status === 404) { setData(null); setLoading(false); return }
      setData(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleAction = async (action: 'suspend' | 'unsuspend') => {
    setActionLoading(true)
    try {
      await fetch(`${API_BASE}/admin/providers/${id}/${action}`, {
        method: 'POST', headers: { 'x-admin-token': token!, 'Content-Type': 'application/json' },
      })
      await fetchDetail()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  const formatTime = (iso: string) => {
    if (!iso) return 'Never'
    return new Date(iso).toLocaleDateString() + ' ' + new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <DashboardLayout navItems={navItems} role="admin" userName="Admin"><div className="text-dc1-text-secondary">Loading...</div></DashboardLayout>
  if (!data) return <DashboardLayout navItems={navItems} role="admin" userName="Admin"><div className="text-red-400">Provider not found</div></DashboardLayout>

  const p = data.provider
  const uptime = data.uptime || {}
  const metrics = data.metrics_24h || {}
  const jobs = data.jobs || []
  const heartbeats = data.heartbeat_log || []
  const disconnects = data.disconnects || []

  return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/admin/providers" className="text-dc1-text-secondary text-sm hover:text-dc1-amber mb-2 inline-block">&larr; Back to Providers</Link>
          <h1 className="text-3xl font-bold text-dc1-text-primary">{p.name}</h1>
          <p className="text-dc1-text-secondary">{p.email} &middot; {p.gpu_model || p.gpu_name_detected || 'No GPU'}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={p.status === 'suspended' ? 'warning' : p.is_online ? 'online' : 'offline'}
            label={p.status === 'suspended' ? 'Suspended' : p.is_online ? 'Online' : 'Offline'} />
          {p.status === 'suspended' ? (
            <button onClick={() => handleAction('unsuspend')} disabled={actionLoading}
              className="px-3 py-1.5 rounded text-sm bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-50">
              {actionLoading ? '...' : 'Reactivate'}
            </button>
          ) : (
            <button onClick={() => handleAction('suspend')} disabled={actionLoading}
              className="px-3 py-1.5 rounded text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50">
              {actionLoading ? '...' : 'Suspend'}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Uptime 24h" value={`${uptime.hours_24 ?? '—'}%`} accent="success" />
        <StatCard label="Uptime 7d" value={`${uptime.days_7 ?? '—'}%`} accent="info" />
        <StatCard label="Total Jobs" value={String(p.total_jobs || 0)} accent="default" />
        <StatCard label="Earnings" value={`${((p.total_earnings || 0) / 100).toFixed(2)} SAR`} accent="amber" />
      </div>

      {/* GPU Metrics */}
      <div className="card mb-6">
        <h2 className="section-heading mb-4">GPU Metrics (24h)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-dc1-surface-l2 rounded-lg p-3">
            <p className="text-xs text-dc1-text-muted">Avg Utilization</p>
            <p className="text-xl font-bold text-dc1-text-primary">{metrics.avg_util ? `${Math.round(metrics.avg_util)}%` : '—'}</p>
          </div>
          <div className="bg-dc1-surface-l2 rounded-lg p-3">
            <p className="text-xs text-dc1-text-muted">Avg Temperature</p>
            <p className="text-xl font-bold text-dc1-text-primary">{metrics.avg_temp ? `${Math.round(metrics.avg_temp)}°C` : '—'}</p>
          </div>
          <div className="bg-dc1-surface-l2 rounded-lg p-3">
            <p className="text-xs text-dc1-text-muted">Max Temperature</p>
            <p className="text-xl font-bold text-dc1-text-primary">{metrics.max_temp ? `${Math.round(metrics.max_temp)}°C` : '—'}</p>
          </div>
          <div className="bg-dc1-surface-l2 rounded-lg p-3">
            <p className="text-xs text-dc1-text-muted">Avg Power</p>
            <p className="text-xl font-bold text-dc1-text-primary">{metrics.avg_power ? `${Math.round(metrics.avg_power)}W` : '—'}</p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="card mb-6">
        <h2 className="section-heading mb-4">Account Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between py-1 border-b border-dc1-border/30"><span className="text-dc1-text-muted">ID</span><span className="text-dc1-text-primary">{p.id}</span></div>
          <div className="flex justify-between py-1 border-b border-dc1-border/30"><span className="text-dc1-text-muted">OS</span><span className="text-dc1-text-primary">{p.os || '—'}</span></div>
          <div className="flex justify-between py-1 border-b border-dc1-border/30"><span className="text-dc1-text-muted">GPU VRAM</span><span className="text-dc1-text-primary">{p.gpu_vram_mib ? `${Math.round(p.gpu_vram_mib / 1024)} GB` : p.vram_gb ? `${p.vram_gb} GB` : '—'}</span></div>
          <div className="flex justify-between py-1 border-b border-dc1-border/30"><span className="text-dc1-text-muted">Driver</span><span className="text-dc1-text-primary">{p.gpu_driver || '—'}</span></div>
          <div className="flex justify-between py-1 border-b border-dc1-border/30"><span className="text-dc1-text-muted">IP</span><span className="text-dc1-text-primary font-mono">{p.provider_ip || '—'}</span></div>
          <div className="flex justify-between py-1 border-b border-dc1-border/30"><span className="text-dc1-text-muted">Hostname</span><span className="text-dc1-text-primary">{p.provider_hostname || '—'}</span></div>
          <div className="flex justify-between py-1 border-b border-dc1-border/30"><span className="text-dc1-text-muted">Run Mode</span><span className="text-dc1-text-primary">{p.run_mode || '—'}</span></div>
          <div className="flex justify-between py-1 border-b border-dc1-border/30"><span className="text-dc1-text-muted">Registered</span><span className="text-dc1-text-primary">{formatTime(p.created_at)}</span></div>
          <div className="flex justify-between py-1 border-b border-dc1-border/30"><span className="text-dc1-text-muted">Last Heartbeat</span><span className="text-dc1-text-primary">{p.minutes_since_heartbeat !== null ? `${p.minutes_since_heartbeat}m ago` : 'Never'}</span></div>
          <div className="flex justify-between py-1 border-b border-dc1-border/30"><span className="text-dc1-text-muted">Heartbeats 24h</span><span className="text-dc1-text-primary">{uptime.heartbeats_24h ?? '—'}</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['overview', 'jobs', 'heartbeats', 'recovery'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${tab === t ? 'bg-dc1-amber text-black' : 'bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'jobs' && (
        <div className="card">
          <h2 className="section-heading mb-4">Recent Jobs ({jobs.length})</h2>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Job ID</th><th>Type</th><th>Status</th><th>Cost</th><th>Created</th></tr></thead>
              <tbody>
                {jobs.map((j: any) => (
                  <tr key={j.id}>
                    <td className="font-mono text-sm">{(j.job_id || j.id).toString().slice(0, 12)}</td>
                    <td className="text-sm">{j.job_type || '—'}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded ${j.status === 'completed' ? 'bg-green-600/20 text-green-400' : j.status === 'failed' ? 'bg-red-600/20 text-red-400' : 'bg-blue-600/20 text-blue-400'}`}>{j.status}</span></td>
                    <td className="text-sm">{j.cost_halala ? `${(j.cost_halala / 100).toFixed(2)} SAR` : '—'}</td>
                    <td className="text-xs text-dc1-text-secondary">{formatTime(j.created_at)}</td>
                  </tr>
                ))}
                {jobs.length === 0 && <tr><td colSpan={5} className="text-dc1-text-muted text-sm">No jobs</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'heartbeats' && (
        <div className="card">
          <h2 className="section-heading mb-4">Recent Heartbeats ({heartbeats.length})</h2>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Time</th><th>GPU Util</th><th>Temp</th><th>Power</th><th>VRAM Used</th></tr></thead>
              <tbody>
                {heartbeats.map((h: any, i: number) => (
                  <tr key={i}>
                    <td className="text-xs text-dc1-text-secondary">{formatTime(h.received_at)}</td>
                    <td className="text-sm">{h.gpu_util_pct != null ? `${h.gpu_util_pct}%` : '—'}</td>
                    <td className="text-sm">{h.gpu_temp_c != null ? `${h.gpu_temp_c}°C` : '—'}</td>
                    <td className="text-sm">{h.gpu_power_w != null ? `${Math.round(h.gpu_power_w)}W` : '—'}</td>
                    <td className="text-sm">{h.gpu_mem_used_mib != null ? `${Math.round(h.gpu_mem_used_mib)} MiB` : '—'}</td>
                  </tr>
                ))}
                {heartbeats.length === 0 && <tr><td colSpan={5} className="text-dc1-text-muted text-sm">No heartbeats</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'recovery' && (
        <div className="card">
          <h2 className="section-heading mb-4">Recovery Events ({disconnects.length})</h2>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Time</th><th>State</th><th>Details</th></tr></thead>
              <tbody>
                {disconnects.map((d: any, i: number) => (
                  <tr key={i}>
                    <td className="text-xs text-dc1-text-secondary">{formatTime(d.timestamp)}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded ${d.state === 'WARNING' ? 'bg-yellow-600/20 text-yellow-400' : d.state === 'FAILOVER' ? 'bg-red-600/20 text-red-400' : 'bg-blue-600/20 text-blue-400'}`}>{d.state}</span></td>
                    <td className="text-sm text-dc1-text-secondary">{d.details || '—'}</td>
                  </tr>
                ))}
                {disconnects.length === 0 && <tr><td colSpan={3} className="text-dc1-text-muted text-sm">No recovery events</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'overview' && (
        <div className="card">
          <h2 className="section-heading mb-4">Provider Summary</h2>
          <p className="text-dc1-text-secondary text-sm">
            {p.name} has been registered since {formatTime(p.created_at)}, running {p.gpu_model || 'unknown GPU'} on {p.os || 'unknown OS'}.
            {uptime.hours_24 != null && ` 24h uptime: ${uptime.hours_24}%.`}
            {p.total_jobs ? ` Completed ${p.total_jobs} jobs earning ${((p.total_earnings || 0) / 100).toFixed(2)} SAR.` : ' No jobs completed yet.'}
          </p>
        </div>
      )}
    </DashboardLayout>
  )
}
