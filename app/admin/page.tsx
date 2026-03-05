'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Provider {
  id: number
  name: string
  email: string
  gpu_model: string
  gpu_name_detected: string | null
  gpu_vram_mib: number | null
  vram_gb: number | null
  gpu_driver: string | null
  gpu_compute: string | null
  gpu_count: number
  os: string
  status: 'online' | 'offline' | 'registered'
  is_online: boolean
  minutes_since_heartbeat: number | null
  last_heartbeat: string | null
  provider_ip: string | null
  provider_hostname: string | null
  total_earnings: number
  total_jobs: number
  uptime_percent: number | null
  is_paused: number
  run_mode: string | null
  created_at: string
  gpu_status: {
    gpu_util_pct?: number
    temp_c?: number
    power_w?: number
    free_vram_mib?: number
  } | null
}

interface DashboardData {
  dashboard: {
    stats: { total_providers: number; online_now: number; offline: number; timestamp: string }
    gpu_breakdown: { gpu_model: string; count: number }[]
    recent_signups: Provider[]
    recent_heartbeats: Provider[]
  } | null
  fleet: {
    totalProviders: number
    onlineProviders: number
    totalGpus: number
    totalVramGib: number
    avgUtilizationPct: number
    gpuDistribution: { model: string; count: number; total_vram_gib: number; avg_util_pct: number }[]
  } | null
  reconciliation: {
    totalCollectedHalala: number
    totalPaidHalala: number
    dc1MarginHalala: number
    discrepanciesCount: number
    jobsChecked: number
  } | null
  activeJobs: {
    id: number
    job_id: string
    provider_id: number
    job_type: string
    status: string
    submitted_at: string
    started_at: string | null
    duration_minutes: number
    cost_halala: number
  }[] | null
  fetchedAt: string
}

interface ProvidersData {
  total: number
  online: number
  offline: number
  registered: number
  providers: Provider[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function halalToSar(h: number): string {
  return (h / 100).toFixed(2)
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function statusColor(status: string, isOnline: boolean): string {
  if (isOnline) return 'text-green-400'
  if (status === 'offline') return 'text-amber-400'
  return 'text-gray-500'
}

function statusBg(status: string, isOnline: boolean): string {
  if (isOnline) return 'bg-green-900/30 text-green-400 border border-green-500/30'
  if (status === 'offline') return 'bg-amber-900/30 text-amber-400 border border-amber-500/30'
  return 'bg-gray-800 text-gray-500 border border-gray-700'
}

function statusDot(isOnline: boolean, offline: boolean): string {
  if (isOnline) return 'bg-green-400 animate-pulse'
  if (offline) return 'bg-amber-400'
  return 'bg-gray-600'
}

function utilizationColor(pct: number | null): string {
  if (pct === null) return 'text-gray-500'
  if (pct >= 70) return 'text-green-400'
  if (pct >= 30) return 'text-amber-400'
  return 'text-red-400'
}

function utilizationBg(pct: number | null): string {
  if (pct === null) return 'from-gray-500/10'
  if (pct >= 70) return 'from-green-500/10'
  if (pct >= 30) return 'from-amber-500/10'
  return 'from-red-500/10'
}

function gpuLabel(p: Provider): string {
  return p.gpu_name_detected || p.gpu_model || 'Unknown GPU'
}

function vramLabel(p: Provider): string {
  if (p.gpu_vram_mib && p.gpu_vram_mib > 0) return `${Math.round(p.gpu_vram_mib / 1024)}GB`
  if (p.vram_gb) return `${p.vram_gb}GB`
  return '—'
}

function jobTypeColor(type: string): string {
  const map: Record<string, string> = {
    'llm-inference': 'text-purple-400 bg-purple-900/20 border-purple-500/30',
    'training': 'text-blue-400 bg-blue-900/20 border-blue-500/30',
    'rendering': 'text-cyan-400 bg-cyan-900/20 border-cyan-500/30',
  }
  return map[type] || 'text-gray-400 bg-gray-800 border-gray-700'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, colorClass, bgClass, pulse
}: {
  label: string
  value: string | number
  sub?: string
  colorClass: string
  bgClass: string
  pulse?: boolean
}) {
  return (
    <div className={`bg-gradient-to-br ${bgClass} to-transparent border border-white/10 rounded-xl p-5`}>
      <p className="text-gray-400 text-xs font-semibold tracking-widest uppercase mb-2">{label}</p>
      <div className="flex items-center gap-2">
        {pulse && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
        <h3 className={`text-3xl font-bold ${colorClass}`}>{value}</h3>
      </div>
      {sub && <p className="text-xs text-gray-500 mt-2">{sub}</p>}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [provData, setProvData] = useState<ProvidersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [backendAlive, setBackendAlive] = useState<boolean | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        fetch('/api/admin/dashboard').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/providers').then(r => r.ok ? r.json() : null),
      ])
      setDashData(d)
      setProvData(p)
      setBackendAlive(!!d && !!d.dashboard)
    } catch {
      setBackendAlive(false)
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
      setSecondsAgo(0)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const poll = setInterval(fetchAll, 30000)
    return () => clearInterval(poll)
  }, [fetchAll])

  // Live "X sec ago" counter
  useEffect(() => {
    const t = setInterval(() => setSecondsAgo(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [lastRefresh])

  // ─── Derived stats ────────────────────────────────────────────────────────

  const stats = dashData?.dashboard?.stats
  const fleet = dashData?.fleet
  const recon = dashData?.reconciliation
  const activeJobs = dashData?.activeJobs || []
  const providers = provData?.providers || []

  const totalProviders = stats?.total_providers ?? providers.length
  const onlineNow = stats?.online_now ?? providers.filter(p => p.is_online).length
  const registeredOnly = providers.filter(p => !p.last_heartbeat).length

  const avgUtil = fleet?.avgUtilizationPct ?? null
  const totalVram = fleet?.totalVramGib ?? 0

  const collectedSar = recon ? parseFloat(halalToSar(recon.totalCollectedHalala)) : 0
  const dc1MarginSar = recon ? parseFloat(halalToSar(recon.dc1MarginHalala)) : 0
  const dc1MarginPct = collectedSar > 0 ? Math.round((dc1MarginSar / collectedSar) * 100) : 25

  const onlineProviders = providers.filter(p => p.is_online)
  const offlineProviders = providers.filter(p => !p.is_online && p.last_heartbeat)
  const hasAlert = !backendAlive || (onlineNow === 0 && totalProviders > 0) || (recon?.discrepanciesCount ?? 0) > 0

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-dc-black flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-dc-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading admin dashboard…</p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-dc-black text-white">

      {/* ── Nav ── */}
      <nav className="bg-gray-950 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-white font-bold text-lg tracking-tight">DC1</Link>
          <h1 className="text-gray-200 text-base font-semibold">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {lastRefresh ? `Updated ${secondsAgo}s ago` : 'Loading…'}
            </span>
            <button
              onClick={fetchAll}
              className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1 rounded-md transition-colors"
            >
              ↻ Refresh
            </button>
            <span className="text-xs bg-red-900/40 text-red-400 border border-red-500/30 px-3 py-1 rounded-full font-semibold">
              ADMIN
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Alert Banner ── */}
        {hasAlert && (
          <div className={`rounded-xl border px-5 py-3 flex items-start gap-3 ${
            !backendAlive
              ? 'bg-red-900/20 border-red-500/40 text-red-300'
              : 'bg-amber-900/20 border-amber-500/40 text-amber-300'
          }`}>
            <span className="text-lg mt-0.5">{!backendAlive ? '🔴' : '⚠️'}</span>
            <div className="text-sm">
              {!backendAlive && <p className="font-semibold">Backend unreachable — VPS may need <code className="bg-black/30 px-1 rounded">git pull && pm2 restart all</code></p>}
              {backendAlive && onlineNow === 0 && totalProviders > 0 && (
                <p className="font-semibold">No providers online — {totalProviders} registered, 0 active. Ask providers to start their daemon.</p>
              )}
              {backendAlive && (recon?.discrepanciesCount ?? 0) > 0 && (
                <p className="font-semibold">{recon!.discrepanciesCount} billing discrepanc{recon!.discrepanciesCount === 1 ? 'y' : 'ies'} found — review reconciliation.</p>
              )}
            </div>
          </div>
        )}

        {/* ── KPI Hero Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPICard
            label="Fleet Online"
            value={`${onlineNow}/${totalProviders}`}
            sub={registeredOnly > 0 ? `${registeredOnly} registered, never connected` : `${offlineProviders.length} offline`}
            colorClass={onlineNow > 0 ? 'text-green-400' : 'text-amber-400'}
            bgClass={onlineNow > 0 ? 'from-green-500/10' : 'from-amber-500/10'}
            pulse={onlineNow > 0}
          />
          <KPICard
            label="GPU Utilization"
            value={avgUtil !== null ? `${avgUtil}%` : 'N/A'}
            sub={avgUtil !== null
              ? avgUtil >= 70 ? '✅ Target met (≥70%)' : avgUtil >= 30 ? '⚠️ Below target (need 70%+)' : '🔴 Critical — nearly idle'
              : 'No live providers'}
            colorClass={utilizationColor(avgUtil)}
            bgClass={utilizationBg(avgUtil)}
          />
          <KPICard
            label="Active Jobs"
            value={activeJobs.length}
            sub={activeJobs.length > 0
              ? activeJobs.map(j => j.job_type).join(', ')
              : 'No jobs running'}
            colorClass={activeJobs.length > 0 ? 'text-purple-400' : 'text-gray-500'}
            bgClass={activeJobs.length > 0 ? 'from-purple-500/10' : 'from-gray-500/5'}
            pulse={activeJobs.length > 0}
          />
          <KPICard
            label="Revenue (SAR)"
            value={`﷼${collectedSar.toFixed(2)}`}
            sub={recon ? `${recon.jobsChecked} job${recon.jobsChecked === 1 ? '' : 's'} processed` : 'No jobs yet'}
            colorClass="text-dc-gold"
            bgClass="from-yellow-500/10"
          />
          <KPICard
            label="DC1 Margin"
            value={`${dc1MarginPct}%`}
            sub={dc1MarginSar > 0 ? `﷼${dc1MarginSar.toFixed(2)} earned` : '25% split (standard)'}
            colorClass="text-dc-cyan"
            bgClass="from-cyan-500/10"
          />
        </div>

        {/* ── Provider Fleet ── */}
        <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-white font-bold text-lg">
              Provider Fleet
              <span className="ml-2 text-xs text-gray-500 font-normal">{totalProviders} total</span>
            </h2>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400" />Online ({onlineNow})</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />Offline ({offlineProviders.length})</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-600" />Registered ({registeredOnly})</span>
            </div>
          </div>

          {providers.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500 text-sm">
              {backendAlive ? 'No providers registered yet.' : 'Could not reach backend.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Provider</th>
                    <th className="px-4 py-3 text-left">GPU</th>
                    <th className="px-4 py-3 text-left">VRAM</th>
                    <th className="px-4 py-3 text-left">Util%</th>
                    <th className="px-4 py-3 text-left">Temp</th>
                    <th className="px-4 py-3 text-left">Last Heartbeat</th>
                    <th className="px-4 py-3 text-left">Earnings</th>
                    <th className="px-4 py-3 text-left">Jobs</th>
                    <th className="px-4 py-3 text-left">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {providers.map((p) => {
                    const isOffline = !p.is_online && !!p.last_heartbeat
                    const gpuUtil = p.gpu_status?.gpu_util_pct ?? null
                    const temp = p.gpu_status?.temp_c ?? null
                    return (
                      <tr key={p.id} className={`hover:bg-white/5 transition-colors ${p.is_online ? 'bg-green-900/5' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot(p.is_online, isOffline)}`} />
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusBg(p.status, p.is_online)}`}>
                              {p.is_online ? 'ONLINE' : isOffline ? 'OFFLINE' : 'REGISTERED'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{p.name || '—'}</p>
                          <p className="text-gray-500 text-xs">{p.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-200 font-medium">{gpuLabel(p)}</p>
                          <p className="text-gray-500 text-xs">{p.gpu_driver ? `Driver ${p.gpu_driver}` : p.os || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{vramLabel(p)}</td>
                        <td className="px-4 py-3">
                          {gpuUtil !== null && p.is_online ? (
                            <div className="flex flex-col gap-1">
                              <span className={`font-semibold ${utilizationColor(gpuUtil)}`}>{gpuUtil}%</span>
                              <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${gpuUtil >= 70 ? 'bg-green-400' : gpuUtil >= 30 ? 'bg-amber-400' : 'bg-red-400'}`}
                                  style={{ width: `${Math.min(gpuUtil, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {temp !== null && p.is_online ? (
                            <span className={temp > 85 ? 'text-red-400 font-bold' : temp > 75 ? 'text-amber-400' : 'text-green-400'}>
                              {temp}°C
                            </span>
                          ) : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {p.last_heartbeat ? (
                            <div>
                              <p className={`${p.is_online ? 'text-green-400' : 'text-gray-500'} font-medium`}>
                                {relativeTime(p.last_heartbeat)}
                              </p>
                              {p.provider_hostname && (
                                <p className="text-gray-600 text-xs">{p.provider_hostname}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs italic">Never connected</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-dc-gold font-semibold">
                            ﷼{halalToSar(p.total_earnings || 0)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{p.total_jobs || 0}</td>
                        <td className="px-4 py-3">
                          {p.is_paused ? (
                            <span className="text-xs text-amber-400 bg-amber-900/20 border border-amber-500/30 px-2 py-0.5 rounded-full">
                              PAUSED
                            </span>
                          ) : p.run_mode ? (
                            <span className="text-xs text-gray-400 capitalize">{p.run_mode}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Bottom Row: GPU Distribution + Active Jobs + Billing ── */}
        <div className="grid md:grid-cols-3 gap-4">

          {/* GPU Distribution */}
          <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-white font-bold">GPU Fleet Mix</h2>
              <p className="text-gray-500 text-xs mt-0.5">{totalVram ? `${totalVram} GB total VRAM` : 'No fleet data'}</p>
            </div>
            <div className="p-5 space-y-3">
              {fleet?.gpuDistribution && fleet.gpuDistribution.length > 0 ? (
                fleet.gpuDistribution.map((g, i) => {
                  const pct = fleet.totalGpus > 0 ? Math.round((g.count / fleet.totalGpus) * 100) : 0
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-200 font-medium truncate max-w-[60%]">{g.model || 'Unknown'}</span>
                        <span className="text-gray-400">{g.count} GPU{g.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-dc-gold/70 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                      </div>
                      {g.total_vram_gib > 0 && (
                        <p className="text-xs text-gray-600 mt-0.5">{g.total_vram_gib} GB VRAM total</p>
                      )}
                    </div>
                  )
                })
              ) : (
                <p className="text-gray-500 text-sm text-center py-6">No GPU data yet</p>
              )}
            </div>
          </div>

          {/* Active Jobs */}
          <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-white font-bold">Active Jobs</h2>
              {activeJobs.length > 0 && (
                <span className="text-xs text-purple-400 bg-purple-900/30 border border-purple-500/30 px-2 py-0.5 rounded-full animate-pulse">
                  {activeJobs.length} running
                </span>
              )}
            </div>
            <div className="divide-y divide-white/5">
              {activeJobs.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-500 text-sm">
                  No active jobs<br />
                  <Link href="/jobs/submit" className="text-dc-gold text-xs hover:underline mt-2 inline-block">
                    Submit a test job →
                  </Link>
                </div>
              ) : (
                activeJobs.map(job => {
                  const elapsedMin = job.started_at
                    ? Math.floor((Date.now() - new Date(job.started_at).getTime()) / 60000)
                    : 0
                  const liveCostSar = (elapsedMin * 10 / 100).toFixed(2)
                  return (
                    <div key={job.id} className="px-5 py-4">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${jobTypeColor(job.job_type)}`}>
                          {job.job_type}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          job.status === 'running'
                            ? 'text-green-400 bg-green-900/20 border border-green-500/20'
                            : 'text-amber-400 bg-amber-900/20 border border-amber-500/20'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1.5">
                        Provider #{job.provider_id} · {job.duration_minutes}min
                      </p>
                      <div className="flex justify-between mt-2 text-xs">
                        <span className="text-gray-500">Running {elapsedMin}m</span>
                        <span className="text-dc-gold font-semibold">﷼{liveCostSar}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Billing Summary */}
          <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-white font-bold">Billing Summary</h2>
              <p className="text-gray-500 text-xs mt-0.5">
                {recon ? `${recon.jobsChecked} jobs reconciled` : 'No billing data'}
              </p>
            </div>
            <div className="p-5 space-y-4">
              {recon ? (
                <>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-gray-400 text-sm">Total Collected</span>
                    <span className="text-white font-bold">﷼{halalToSar(recon.totalCollectedHalala)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-gray-400 text-sm">Provider Payouts</span>
                    <span className="text-green-400 font-semibold">﷼{halalToSar(recon.totalPaidHalala)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-gray-400 text-sm">DC1 Revenue</span>
                    <span className="text-dc-gold font-bold">﷼{halalToSar(recon.dc1MarginHalala)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400 text-sm">Split</span>
                    <span className="text-gray-300 text-sm">
                      {Math.round(((recon.totalCollectedHalala - recon.dc1MarginHalala) / Math.max(recon.totalCollectedHalala, 1)) * 100)}% providers /
                      {' '}{Math.round((recon.dc1MarginHalala / Math.max(recon.totalCollectedHalala, 1)) * 100)}% DC1
                    </span>
                  </div>
                  {recon.discrepanciesCount > 0 && (
                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-2 text-xs text-amber-400">
                      ⚠️ {recon.discrepanciesCount} billing discrepanc{recon.discrepanciesCount === 1 ? 'y' : 'ies'} detected
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center text-gray-500 text-sm">
                  {backendAlive ? 'No completed jobs yet' : 'Backend offline'}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Recent Activity ── */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Recent Heartbeats */}
          <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-white font-bold">Recent Provider Activity</h2>
            </div>
            <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
              {(dashData?.dashboard?.recent_heartbeats || []).length === 0 ? (
                <p className="px-5 py-8 text-center text-gray-500 text-sm">No heartbeats yet</p>
              ) : (
                dashData!.dashboard!.recent_heartbeats.map((h, i) => (
                  <div key={i} className="px-5 py-3 flex justify-between items-center hover:bg-white/5">
                    <div>
                      <p className="text-white text-sm font-medium">{h.name || h.id}</p>
                      <p className="text-gray-500 text-xs">{h.gpu_model || 'GPU unknown'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-xs">{relativeTime(h.last_heartbeat)}</p>
                      {h.provider_ip && (
                        <p className="text-gray-600 text-xs">{h.provider_ip}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* New Signups */}
          <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-white font-bold">New Provider Signups</h2>
            </div>
            <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
              {(dashData?.dashboard?.recent_signups || []).length === 0 ? (
                <p className="px-5 py-8 text-center text-gray-500 text-sm">No signups yet</p>
              ) : (
                dashData!.dashboard!.recent_signups.map((s, i) => (
                  <div key={i} className="px-5 py-3 hover:bg-white/5">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white text-sm font-medium">{s.name || '—'}</p>
                        <p className="text-gray-500 text-xs">{s.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs">{relativeTime(s.created_at)}</p>
                        <p className="text-gray-600 text-xs">{s.gpu_model || '—'}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="flex justify-between items-center py-3 text-xs text-gray-600 border-t border-white/5">
          <span>DC1 Admin · {backendAlive ? '🟢 Backend connected' : '🔴 Backend offline'}</span>
          <span>Auto-refresh every 30s · {lastRefresh?.toLocaleTimeString() || '—'}</span>
        </div>

      </div>
    </main>
  )
}
