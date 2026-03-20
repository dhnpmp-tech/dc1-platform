'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatCard from '../../components/ui/StatCard'

const API_BASE = '/api/dc1'

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

export default function FleetHealthPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [timePeriod, setTimePeriod] = useState(24)

  const token = typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') : null

  const timeOptions = [
    { label: '1h', hours: 1 },
    { label: '6h', hours: 6 },
    { label: '24h', hours: 24 },
    { label: '7d', hours: 168 },
    { label: '30d', hours: 720 },
  ]

  useEffect(() => {
    if (!token) { router.push('/login'); return }
    fetchFleetHealth()
    const interval = setInterval(fetchFleetHealth, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (token) fetchFleetHealth()
  }, [timePeriod])

  const fetchFleetHealth = async () => {
    try {
      const [daemonRes, healthRes] = await Promise.allSettled([
        fetch(`${API_BASE}/admin/daemon-health?hours=${timePeriod}`, {
          headers: { 'x-admin-token': token! }
        }),
        fetch(`${API_BASE}/admin/health`, {
          headers: { 'x-admin-token': token! }
        }),
      ])

      if (daemonRes.status === 'fulfilled') {
        const res = daemonRes.value
        if (res.status === 401) { localStorage.removeItem('dc1_admin_token'); router.push('/login'); return }
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      }

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const healthJson = await healthRes.value.json()
        setHealth(healthJson)
      }
    } catch (err) {
      console.error('Failed to fetch fleet health:', err)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    if (severity === 'critical' || severity === 'error') return 'text-red-400 bg-red-900/20'
    if (severity === 'warning') return 'text-yellow-400 bg-yellow-900/20'
    return 'text-blue-400 bg-blue-900/20'
  }

  const formatTime = (iso: string) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString() + ' ' + new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const summary = data?.summary || {}
  const versions = data?.versions || []
  const crashes = data?.crashes || []
  const recentEvents = data?.recent_events || []

  // Derive provider counts: prefer daemon-health summary, fall back to /health checks
  const providersOnline = summary.providers_online ?? health?.checks?.providers?.online ?? 0
  const providersTotal = summary.providers_total ?? health?.checks?.providers?.total ?? 0

  return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Fleet Health & Daemon Management</h1>
        <p className="text-dc1-text-secondary">
          {data ? `${data.period_hours}h period — Generated ${new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading...'}
        </p>
      </div>

      {/* Time Period Selector */}
      <div className="card mb-6">
        <div className="flex gap-2">
          {timeOptions.map(opt => (
            <button
              key={opt.hours}
              onClick={() => setTimePeriod(opt.hours)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                timePeriod === opt.hours
                  ? 'bg-dc1-amber text-black'
                  : 'bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* System Health Status Banner */}
      {health && (
        <div className={`card mb-6 border-l-4 ${
          health.status === 'healthy' ? 'border-l-green-500' :
          health.status === 'degraded' ? 'border-l-yellow-500' :
          'border-l-red-500'
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                health.status === 'healthy' ? 'bg-green-500' :
                health.status === 'degraded' ? 'bg-yellow-500' :
                'bg-red-500'
              }`}></div>
              <div>
                <h3 className="text-lg font-bold text-dc1-text-primary">
                  System Status: {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
                </h3>
                <p className="text-xs text-dc1-text-secondary">{new Date(health.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-dc1-surface-l2 rounded p-3">
              <div className="text-xs text-dc1-text-secondary mb-1">Database</div>
              <div className={`text-sm font-bold ${health.checks?.database === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                {health.checks?.database || 'unknown'}
              </div>
            </div>
            <div className="bg-dc1-surface-l2 rounded p-3">
              <div className="text-xs text-dc1-text-secondary mb-1">Providers Online</div>
              <div className="text-sm font-bold text-dc1-amber">{health.checks?.providers?.online ?? 0} / {health.checks?.providers?.total ?? 0}</div>
            </div>
            <div className="bg-dc1-surface-l2 rounded p-3">
              <div className="text-xs text-dc1-text-secondary mb-1">Active Jobs</div>
              <div className="text-sm font-bold text-dc1-text-primary">{health.checks?.jobs?.active ?? 0}</div>
            </div>
            <div className="bg-dc1-surface-l2 rounded p-3">
              <div className="text-xs text-dc1-text-secondary mb-1">Stuck Jobs</div>
              <div className={`text-sm font-bold ${(health.checks?.jobs?.stuck ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {health.checks?.jobs?.stuck ?? 0}
              </div>
            </div>
            <div className="bg-dc1-surface-l2 rounded p-3">
              <div className="text-xs text-dc1-text-secondary mb-1">Failed (1h)</div>
              <div className="text-sm font-bold text-dc1-text-primary">{health.checks?.errors?.failed_last_hour ?? 0}</div>
            </div>
            <div className="bg-dc1-surface-l2 rounded p-3">
              <div className="text-xs text-dc1-text-secondary mb-1">Critical Events</div>
              <div className={`text-sm font-bold ${(health.checks?.errors?.critical_events ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {health.checks?.errors?.critical_events ?? 0}
              </div>
            </div>
            <div className="bg-dc1-surface-l2 rounded p-3">
              <div className="text-xs text-dc1-text-secondary mb-1">Pending Withdrawals</div>
              <div className="text-sm font-bold text-dc1-text-primary">{health.checks?.withdrawals?.pending ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-dc1-text-secondary">Loading fleet health data...</div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Events" value={String(summary.total_events || 0)} accent="default" />
            <StatCard label="Total Crashes" value={String(summary.total_crashes || 0)} accent="error" />
            <StatCard label="Job Success Rate" value={summary.job_success_rate || 'N/A'} accent="success" />
            <StatCard label="Providers Online" value={`${providersOnline} / ${providersTotal}`} accent="amber" />
          </div>

          {/* Version Distribution */}
          <div className="card mb-8">
            <h2 className="text-xl font-bold text-dc1-text-primary mb-4">Version Distribution</h2>
            {versions.length === 0 ? (
              <p className="text-dc1-text-secondary">No version data available</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {versions.map((v: any, idx: number) => (
                  <div key={idx} className="bg-dc1-surface-l2 rounded-lg p-4">
                    <div className="text-dc1-text-secondary text-sm mb-1">Daemon Version</div>
                    <div className="text-lg font-bold text-dc1-text-primary mb-3">{v.daemon_version}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-dc1-amber">{v.provider_count}</span>
                      <span className="text-dc1-text-secondary text-sm">providers</span>
                    </div>
                    <div className="text-xs text-dc1-text-muted mt-2">Last seen: {formatTime(v.last_seen)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Crash Summary */}
          <div className="card mb-8">
            <h2 className="text-xl font-bold text-dc1-text-primary mb-4">Crash Summary</h2>
            {crashes.length === 0 ? (
              <p className="text-dc1-text-secondary">No crashes in this period</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Provider ID</th>
                      <th>Crash Count</th>
                      <th>Last Crash</th>
                      <th>Versions Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crashes.map((c: any, idx: number) => (
                      <tr key={idx}>
                        <td className="font-medium text-dc1-amber">{c.provider_id}</td>
                        <td className="text-sm">
                          <span className="bg-red-900/20 text-red-400 px-2 py-1 rounded">
                            {c.crash_count}
                          </span>
                        </td>
                        <td className="text-xs text-dc1-text-secondary">{formatTime(c.last_crash)}</td>
                        <td className="text-sm text-dc1-text-secondary">
                          {Array.isArray(c.versions_seen) ? c.versions_seen.join(', ') : c.versions_seen || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Events */}
          <div className="card">
            <h2 className="text-xl font-bold text-dc1-text-primary mb-4">Recent Events</h2>
            {recentEvents.length === 0 ? (
              <p className="text-dc1-text-secondary">No recent events</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Provider</th>
                      <th>Event Type</th>
                      <th>Severity</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.map((e: any) => (
                      <tr key={e.id}>
                        <td className="text-xs text-dc1-text-secondary">{formatTime(e.event_timestamp)}</td>
                        <td className="font-medium text-dc1-amber">{e.provider_id}</td>
                        <td className="text-sm">{e.event_type}</td>
                        <td>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(e.severity)}`}>
                            {e.severity.charAt(0).toUpperCase() + e.severity.slice(1)}
                          </span>
                        </td>
                        <td className="text-sm text-dc1-text-secondary truncate max-w-xs">{e.details || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
