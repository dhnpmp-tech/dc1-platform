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
    gpu_vram_mib?: number
    daemon_version?: string
    python_version?: string
    os_info?: string
    compute_cap?: string
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

function halalToSar(h: number): string { return (h / 100).toFixed(2) }

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 0) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function connectionQuality(isOnline: boolean, lastHeartbeat: string | null): { label: string; color: string } {
  if (!lastHeartbeat) return { label: 'OFFLINE', color: 'text-red-400 bg-red-900/20 border-red-500/30' }
  const minAgo = (Date.now() - new Date(lastHeartbeat).getTime()) / 60000
  if (isOnline && minAgo < 1) return { label: 'LIVE', color: 'text-green-400 bg-green-900/20 border-green-500/30' }
  if (isOnline && minAgo < 5) return { label: 'HEALTHY', color: 'text-green-400 bg-green-900/20 border-green-500/30' }
  if (minAgo < 30) return { label: 'STALE', color: 'text-amber-400 bg-amber-900/20 border-amber-500/30' }
  return { label: 'OFFLINE', color: 'text-red-400 bg-red-900/20 border-red-500/30' }
}

function statusDot(isOnline: boolean, hasHb: boolean): string {
  if (isOnline) return 'bg-green-400 animate-pulse'
  if (hasHb) return 'bg-amber-400'
  return 'bg-gray-600'
}

function gpuLabel(p: Provider): string { return p.gpu_name_detected || p.gpu_model || 'Unknown GPU' }

function vramLabel(p: Provider): string {
  if (p.gpu_vram_mib && p.gpu_vram_mib > 0) return `${Math.round(p.gpu_vram_mib / 1024)}GB`
  if (p.vram_gb) return `${p.vram_gb}GB`
  return '—'
}

function tempColor(t: number | null | undefined): string {
  if (t == null) return 'text-gray-600'
  if (t > 85) return 'text-red-400 font-bold'
  if (t > 75) return 'text-amber-400'
  return 'text-green-400'
}

function jobTypeBadge(type: string): string {
  const map: Record<string, string> = {
    'llm-inference': 'text-purple-400 bg-purple-900/20 border-purple-500/30',
    'training': 'text-blue-400 bg-blue-900/20 border-blue-500/30',
    'rendering': 'text-cyan-400 bg-cyan-900/20 border-cyan-500/30',
  }
  return map[type] || 'text-gray-400 bg-gray-800 border-gray-700'
}

function jobStatusBadge(status: string): string {
  const map: Record<string, string> = {
    'running': 'text-green-400 bg-green-900/20 border-green-500/30',
    'completed': 'text-blue-400 bg-blue-900/20 border-blue-500/30',
    'failed': 'text-red-400 bg-red-900/20 border-red-500/30',
    'pending': 'text-amber-400 bg-amber-900/20 border-amber-500/30',
  }
  return map[status] || 'text-gray-400 bg-gray-800 border-gray-700'
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, colorClass, bgClass, pulse }: {
  label: string; value: string | number; sub?: string; colorClass: string; bgClass: string; pulse?: boolean
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

// ─── Provider Detail Modal ────────────────────────────────────────────────────

function ProviderModal({ id, onClose, onOpenJob }: { id: number; onClose: () => void; onOpenJob: (id: number | string) => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('connection')

  useEffect(() => {
    fetch(`/api/admin/providers/${id}`).then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl p-8"><div className="w-8 h-8 border-2 border-dc-gold border-t-transparent rounded-full animate-spin" /></div>
    </div>
  )

  if (!data || !data.provider) return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl p-8 text-red-400">Failed to load provider</div>
    </div>
  )

  const p = data.provider
  const gs = p.gpu_status || {}
  const tabs = ['connection', 'hardware', 'jobs', 'earnings']

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 sticky top-0 bg-gray-900 z-10">
          <div>
            <h2 className="text-white font-bold text-lg">{p.name || `Provider #${p.id}`}</h2>
            <p className="text-gray-500 text-sm">{p.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${p.is_online ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className={`text-xs px-2 py-1 rounded-full border font-medium ${p.is_online ? 'text-green-400 bg-green-900/20 border-green-500/30' : 'text-gray-400 bg-gray-800 border-gray-700'}`}>
              {p.is_online ? 'ONLINE' : 'OFFLINE'}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl ml-2">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-white/10">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === t ? 'bg-gray-800 text-white border-b-2 border-dc-gold' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Connection Tab */}
          {tab === 'connection' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-gray-500 text-xs uppercase mb-1">Last Heartbeat</p>
                  <p className="text-white font-semibold">{relativeTime(p.last_heartbeat)}</p>
                  <p className="text-gray-600 text-xs mt-1">{p.last_heartbeat || '—'}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-gray-500 text-xs uppercase mb-1">Uptime 24h</p>
                  <p className="text-white font-semibold">{data.uptime?.hours_24 ?? '—'}%</p>
                  <p className="text-gray-600 text-xs mt-1">{data.uptime?.heartbeats_24h ?? 0} heartbeats</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-gray-500 text-xs uppercase mb-1">Uptime 7d</p>
                  <p className="text-white font-semibold">{data.uptime?.days_7 ?? '—'}%</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-gray-500 text-xs uppercase mb-1">IP / Hostname</p>
                  <p className="text-white font-semibold text-xs">{p.provider_ip || '—'}</p>
                  <p className="text-gray-600 text-xs mt-1">{p.provider_hostname || '—'}</p>
                </div>
              </div>

              {/* Recent heartbeats table */}
              <div>
                <h3 className="text-gray-400 text-sm font-semibold mb-3">Recent Heartbeats</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-gray-500 uppercase">
                      <tr><th className="px-3 py-2 text-left">Time</th><th className="px-3 py-2">GPU Util%</th><th className="px-3 py-2">Temp</th><th className="px-3 py-2">Power</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(data.heartbeat_log || []).slice(0, 10).map((hb: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="px-3 py-2 text-gray-400">{relativeTime(hb.received_at)}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{hb.gpu_util_pct != null ? `${hb.gpu_util_pct}%` : '—'}</td>
                          <td className={`px-3 py-2 text-center ${tempColor(hb.gpu_temp_c)}`}>{hb.gpu_temp_c != null ? `${hb.gpu_temp_c}°C` : '—'}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{hb.gpu_power_w != null ? `${hb.gpu_power_w}W` : '—'}</td>
                        </tr>
                      ))}
                      {(!data.heartbeat_log || data.heartbeat_log.length === 0) && (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-600">No heartbeat data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Hardware Tab */}
          {tab === 'hardware' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  ['GPU Model', p.gpu_name_detected || p.gpu_model || '—'],
                  ['VRAM Total', p.gpu_vram_mib ? `${Math.round(p.gpu_vram_mib / 1024)} GB (${p.gpu_vram_mib} MiB)` : '—'],
                  ['VRAM Free', gs.free_vram_mib != null ? `${Math.round(gs.free_vram_mib / 1024)} GB (${gs.free_vram_mib} MiB)` : '—'],
                  ['Driver', p.gpu_driver || gs.driver_version || '—'],
                  ['Compute Cap', gs.compute_cap || p.gpu_compute || '—'],
                  ['GPU Util%', gs.gpu_util_pct != null ? `${gs.gpu_util_pct}%` : '—'],
                  ['Temperature', gs.temp_c != null ? `${gs.temp_c}°C` : '—'],
                  ['Power Draw', gs.power_w != null ? `${gs.power_w}W` : '—'],
                  ['OS Info', gs.os_info || p.os || '—'],
                  ['Python', gs.python_version || '—'],
                  ['Daemon Ver', gs.daemon_version || '—'],
                  ['Run Mode', p.run_mode || '—'],
                ].map(([label, val], i) => (
                  <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs uppercase mb-1">{label}</p>
                    <p className="text-white text-sm font-medium">{val}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-gray-500 text-xs uppercase mb-2">Protection Settings</h4>
                <div className="flex gap-6 text-sm">
                  <span className="text-gray-300">GPU Cap: <span className="text-white font-medium">{p.gpu_usage_cap_pct ?? 80}%</span></span>
                  <span className="text-gray-300">VRAM Reserve: <span className="text-white font-medium">{p.vram_reserve_gb ?? 1}GB</span></span>
                  <span className="text-gray-300">Temp Limit: <span className="text-white font-medium">{p.temp_limit_c ?? 85}°C</span></span>
                  <span className="text-gray-300">Paused: <span className="text-white font-medium">{p.is_paused ? 'Yes' : 'No'}</span></span>
                </div>
              </div>
            </div>
          )}

          {/* Jobs Tab */}
          {tab === 'jobs' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-500 text-xs uppercase">
                  <tr><th className="px-3 py-2 text-left">Job ID</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Duration</th><th className="px-3 py-2">Cost</th><th className="px-3 py-2">Submitted</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(data.jobs || []).map((j: any) => (
                    <tr key={j.id} className="hover:bg-white/5 cursor-pointer" onClick={() => onOpenJob(j.id)}>
                      <td className="px-3 py-2 text-gray-300 font-mono text-xs">{(j.job_id || String(j.id)).substring(0, 12)}</td>
                      <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full border ${jobTypeBadge(j.job_type)}`}>{j.job_type || '—'}</span></td>
                      <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full border ${jobStatusBadge(j.status)}`}>{j.status}</span></td>
                      <td className="px-3 py-2 text-center text-gray-400">{j.duration_minutes ? `${j.duration_minutes}m` : '—'}</td>
                      <td className="px-3 py-2 text-center text-dc-gold">﷼{halalToSar(j.cost_halala || 0)}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{relativeTime(j.submitted_at || j.created_at)}</td>
                    </tr>
                  ))}
                  {(!data.jobs || data.jobs.length === 0) && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-600">No jobs for this provider</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Earnings Tab */}
          {tab === 'earnings' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <p className="text-gray-500 text-xs uppercase mb-1">Total Earnings</p>
                  <p className="text-dc-gold text-2xl font-bold">﷼{halalToSar(p.total_earnings ? Math.round(p.total_earnings * 100) : 0)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <p className="text-gray-500 text-xs uppercase mb-1">Total Jobs</p>
                  <p className="text-white text-2xl font-bold">{p.total_jobs || 0}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <p className="text-gray-500 text-xs uppercase mb-1">Uptime</p>
                  <p className="text-white text-2xl font-bold">{data.uptime?.hours_24 ?? '—'}%</p>
                  <p className="text-gray-600 text-xs">24h</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Job Detail Modal ─────────────────────────────────────────────────────────

function JobModal({ id, onClose }: { id: number | string; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/jobs/${id}`).then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl p-8"><div className="w-8 h-8 border-2 border-dc-gold border-t-transparent rounded-full animate-spin" /></div>
    </div>
  )

  if (!data || !data.job) return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl p-8 text-red-400">Failed to load job</div>
    </div>
  )

  const j = data.job
  const b = data.billing || {}
  const prov = data.provider

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-bold">Job #{(j.job_id || String(j.id)).substring(0, 16)}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${jobTypeBadge(j.job_type)}`}>{j.job_type || '—'}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${jobStatusBadge(j.status)}`}>{j.status}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>
        <div className="p-6 space-y-6">
          {/* Provider info */}
          {prov && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-gray-500 text-xs uppercase mb-1">Provider</p>
              <p className="text-white font-medium">{prov.name} — {prov.gpu_name_detected || prov.gpu_model || 'Unknown GPU'}</p>
            </div>
          )}

          {/* Timeline */}
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
            <span className="bg-gray-800 px-3 py-1.5 rounded">Submitted<br/><span className="text-white">{j.submitted_at ? new Date(j.submitted_at).toLocaleString() : '—'}</span></span>
            <span className="text-gray-600">→</span>
            <span className="bg-gray-800 px-3 py-1.5 rounded">Started<br/><span className="text-white">{j.started_at ? new Date(j.started_at).toLocaleString() : '—'}</span></span>
            <span className="text-gray-600">→</span>
            <span className="bg-gray-800 px-3 py-1.5 rounded">Completed<br/><span className="text-white">{j.completed_at ? new Date(j.completed_at).toLocaleString() : '—'}</span></span>
          </div>

          {/* Duration */}
          <div className="flex gap-4 text-sm">
            <span className="text-gray-400">Duration: <span className="text-white font-medium">{b.duration_minutes || 0} min</span></span>
            {j.duration_minutes && <span className="text-gray-400">Est: <span className="text-white">{j.duration_minutes} min</span></span>}
          </div>

          {/* Billing */}
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
            <h3 className="text-gray-400 text-xs uppercase font-semibold mb-2">Billing Breakdown</h3>
            <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="text-dc-gold font-bold">﷼{b.cost_sar || '0.00'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Provider (75%)</span><span className="text-green-400">﷼{halalToSar(b.provider_cut_halala || 0)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">DC1 (25%)</span><span className="text-cyan-400">﷼{halalToSar(b.dc1_cut_halala || 0)}</span></div>
          </div>

          {/* GPU Requirements */}
          {j.gpu_requirements && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-gray-500 text-xs uppercase mb-1">GPU Requirements</p>
              <p className="text-white text-sm">{typeof j.gpu_requirements === 'object' ? JSON.stringify(j.gpu_requirements) : j.gpu_requirements}</p>
            </div>
          )}

          {/* Recovery Events */}
          {data.recovery_events && data.recovery_events.length > 0 && (
            <div>
              <h3 className="text-gray-400 text-sm font-semibold mb-2">Recovery Events</h3>
              <table className="w-full text-xs">
                <thead className="text-gray-500 uppercase"><tr><th className="px-2 py-1 text-left">Type</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Reason</th><th className="px-2 py-1">Time</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {data.recovery_events.map((e: any, i: number) => (
                    <tr key={i}><td className="px-2 py-1 text-gray-300">{e.event_type}</td><td className="px-2 py-1 text-center text-gray-300">{e.status}</td><td className="px-2 py-1 text-gray-400">{e.reason}</td><td className="px-2 py-1 text-gray-500">{relativeTime(e.timestamp)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
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
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<number | string | null>(null)

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

  useEffect(() => { fetchAll(); const poll = setInterval(fetchAll, 30000); return () => clearInterval(poll) }, [fetchAll])
  useEffect(() => { const t = setInterval(() => setSecondsAgo(s => s + 1), 1000); return () => clearInterval(t) }, [lastRefresh])

  const stats = dashData?.dashboard?.stats
  const fleet = dashData?.fleet
  const recon = dashData?.reconciliation
  const activeJobs = dashData?.activeJobs || []
  const providers = provData?.providers || []

  const totalProviders = stats?.total_providers ?? providers.length
  const onlineNow = stats?.online_now ?? providers.filter(p => p.is_online).length
  const registeredOnly = providers.filter(p => !p.last_heartbeat).length
  const offlineProviders = providers.filter(p => !p.is_online && p.last_heartbeat)

  const avgUtil = fleet?.avgUtilizationPct ?? null
  const totalVram = fleet?.totalVramGib ?? 0

  const collectedSar = recon ? parseFloat(halalToSar(recon.totalCollectedHalala)) : 0
  const dc1MarginSar = recon ? parseFloat(halalToSar(recon.dc1MarginHalala)) : 0
  const dc1MarginPct = collectedSar > 0 ? Math.round((dc1MarginSar / collectedSar) * 100) : 25

  const hasAlert = !backendAlive || (onlineNow === 0 && totalProviders > 0)

  if (loading) return (
    <div className="min-h-screen bg-dc-black flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-2 border-dc-gold border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 text-sm">Loading admin dashboard…</p>
    </div>
  )

  return (
    <main className="min-h-screen bg-dc-black text-white">
      {/* Modals */}
      {selectedProviderId !== null && (
        <ProviderModal id={selectedProviderId} onClose={() => setSelectedProviderId(null)} onOpenJob={(id) => setSelectedJobId(id)} />
      )}
      {selectedJobId !== null && (
        <JobModal id={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}

      {/* Nav */}
      <nav className="bg-gray-950 border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-white font-bold text-lg tracking-tight">DC1</Link>
          <h1 className="text-gray-200 text-base font-semibold flex items-center gap-2">
            Admin Dashboard
            <span className={`w-2 h-2 rounded-full ${backendAlive ? 'bg-green-400' : 'bg-red-400'}`} />
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{lastRefresh ? `Updated ${secondsAgo}s ago` : 'Loading…'}</span>
            <button onClick={fetchAll} className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1 rounded-md transition-colors">↻ Refresh</button>
            <span className="text-xs bg-red-900/40 text-red-400 border border-red-500/30 px-3 py-1 rounded-full font-semibold">ADMIN</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Alert Banner */}
        {hasAlert && (
          <div className={`rounded-xl border px-5 py-3 flex items-start gap-3 ${!backendAlive ? 'bg-red-900/20 border-red-500/40 text-red-300' : 'bg-amber-900/20 border-amber-500/40 text-amber-300'}`}>
            <span className="text-lg mt-0.5">{!backendAlive ? '🔴' : '⚠️'}</span>
            <div className="text-sm">
              {!backendAlive && <p className="font-semibold">Backend unreachable — VPS may need <code className="bg-black/30 px-1 rounded">git pull && pm2 restart all</code></p>}
              {backendAlive && onlineNow === 0 && totalProviders > 0 && <p className="font-semibold">No providers online — {totalProviders} registered, 0 active.</p>}
            </div>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPICard label="Fleet Online" value={`${onlineNow}/${totalProviders}`}
            sub={registeredOnly > 0 ? `${registeredOnly} never connected` : `${offlineProviders.length} offline`}
            colorClass={onlineNow > 0 ? 'text-green-400' : 'text-amber-400'} bgClass={onlineNow > 0 ? 'from-green-500/10' : 'from-amber-500/10'} pulse={onlineNow > 0} />
          <KPICard label="GPU Utilization" value={avgUtil !== null ? `${avgUtil}%` : 'N/A'} sub={avgUtil !== null && avgUtil >= 70 ? '✅ Target met' : 'Below target'}
            colorClass={avgUtil !== null && avgUtil >= 70 ? 'text-green-400' : avgUtil !== null && avgUtil >= 30 ? 'text-amber-400' : 'text-gray-500'}
            bgClass={avgUtil !== null ? 'from-green-500/10' : 'from-gray-500/5'} />
          <KPICard label="Active Jobs" value={activeJobs.length} sub={activeJobs.length > 0 ? activeJobs.map(j => j.job_type).join(', ') : 'No jobs running'}
            colorClass={activeJobs.length > 0 ? 'text-purple-400' : 'text-gray-500'} bgClass={activeJobs.length > 0 ? 'from-purple-500/10' : 'from-gray-500/5'} pulse={activeJobs.length > 0} />
          <KPICard label="Revenue (SAR)" value={`﷼${collectedSar.toFixed(2)}`} sub={recon ? `${recon.jobsChecked} jobs processed` : 'No jobs yet'} colorClass="text-dc-gold" bgClass="from-yellow-500/10" />
          <KPICard label="DC1 Margin" value={`${dc1MarginPct}%`} sub={dc1MarginSar > 0 ? `﷼${dc1MarginSar.toFixed(2)} earned` : '25% split'} colorClass="text-dc-cyan" bgClass="from-cyan-500/10" />
        </div>

        {/* Connection Health Table */}
        <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-white font-bold text-lg">Connection Health <span className="ml-2 text-xs text-gray-500 font-normal">{totalProviders} providers</span></h2>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400" />Online ({onlineNow})</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />Offline ({offlineProviders.length})</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-600" />Registered ({registeredOnly})</span>
            </div>
          </div>

          {providers.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500 text-sm">{backendAlive ? 'No providers registered yet.' : 'Could not reach backend.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Provider</th>
                    <th className="px-4 py-3 text-left">GPU</th>
                    <th className="px-4 py-3 text-left">Connection</th>
                    <th className="px-4 py-3 text-left">Last Heartbeat</th>
                    <th className="px-4 py-3 text-left">Uptime 24h</th>
                    <th className="px-4 py-3 text-left">GPU Util%</th>
                    <th className="px-4 py-3 text-left">Temp</th>
                    <th className="px-4 py-3 text-left">Earnings</th>
                    <th className="px-4 py-3 text-left"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {providers.map((p) => {
                    const hasHb = !!p.last_heartbeat
                    const cq = connectionQuality(p.is_online, p.last_heartbeat)
                    const gpuUtil = p.gpu_status?.gpu_util_pct ?? null
                    const temp = p.gpu_status?.temp_c ?? null
                    return (
                      <tr key={p.id} className={`hover:bg-white/5 transition-colors cursor-pointer ${p.is_online ? 'bg-green-900/5' : ''}`}
                        onClick={() => setSelectedProviderId(p.id)}>
                        <td className="px-4 py-3">
                          <span className={`w-2.5 h-2.5 rounded-full inline-block ${statusDot(p.is_online, hasHb)}`} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{p.name || '—'}</p>
                          <p className="text-gray-500 text-xs">{p.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-200">{gpuLabel(p)}</p>
                          <p className="text-gray-500 text-xs">{vramLabel(p)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cq.color}`}>{cq.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className={`${p.is_online ? 'text-green-400' : 'text-gray-500'} text-sm`}>{relativeTime(p.last_heartbeat)}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-400">—</td>
                        <td className="px-4 py-3">
                          {gpuUtil !== null && p.is_online ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-gray-200 font-medium">{gpuUtil}%</span>
                              <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${gpuUtil >= 70 ? 'bg-green-400' : gpuUtil >= 30 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.min(gpuUtil, 100)}%` }} />
                              </div>
                            </div>
                          ) : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {temp != null && p.is_online ? <span className={tempColor(temp)}>{temp}°C</span> : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-dc-gold font-semibold">﷼{halalToSar(p.total_earnings || 0)}</td>
                        <td className="px-4 py-3">
                          <button className="text-xs text-cyan-400 hover:text-cyan-300" onClick={e => { e.stopPropagation(); setSelectedProviderId(p.id) }}>Details →</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* GPU Fleet Mix + Active Jobs + Billing */}
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
                          <div className="h-full bg-dc-gold/70 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  )
                })
              ) : <p className="text-gray-500 text-sm text-center py-6">No GPU data yet</p>}
            </div>
          </div>

          {/* Active Jobs */}
          <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-white font-bold">Active Jobs</h2>
              {activeJobs.length > 0 && <span className="text-xs text-purple-400 bg-purple-900/30 border border-purple-500/30 px-2 py-0.5 rounded-full animate-pulse">{activeJobs.length} running</span>}
            </div>
            <div className="divide-y divide-white/5">
              {activeJobs.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-500 text-sm">No active jobs<br /><Link href="/jobs/submit" className="text-dc-gold text-xs hover:underline mt-2 inline-block">Submit a test job →</Link></div>
              ) : activeJobs.map(job => {
                const elapsed = job.started_at ? Math.floor((Date.now() - new Date(job.started_at).getTime()) / 60000) : 0
                return (
                  <div key={job.id} className="px-5 py-4 hover:bg-white/5 cursor-pointer" onClick={() => setSelectedJobId(job.id)}>
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${jobTypeBadge(job.job_type)}`}>{job.job_type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${jobStatusBadge(job.status)}`}>{job.status}</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-1.5">Provider #{job.provider_id} · {elapsed}m running</p>
                    <p className="text-dc-gold text-xs font-semibold mt-1">﷼{halalToSar(job.cost_halala || 0)}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Billing Summary */}
          <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-white font-bold">Billing Summary</h2>
              <p className="text-gray-500 text-xs mt-0.5">{recon ? `${recon.jobsChecked} jobs reconciled` : 'No billing data'}</p>
            </div>
            <div className="p-5 space-y-3">
              {recon ? (<>
                <div className="flex justify-between py-2 border-b border-white/5"><span className="text-gray-400 text-sm">Total Collected</span><span className="text-white font-bold">﷼{halalToSar(recon.totalCollectedHalala)}</span></div>
                <div className="flex justify-between py-2 border-b border-white/5"><span className="text-gray-400 text-sm">Provider Payouts</span><span className="text-green-400 font-semibold">﷼{halalToSar(recon.totalPaidHalala)}</span></div>
                <div className="flex justify-between py-2 border-b border-white/5"><span className="text-gray-400 text-sm">DC1 Revenue</span><span className="text-dc-gold font-bold">﷼{halalToSar(recon.dc1MarginHalala)}</span></div>
                <div className="flex justify-between py-2"><span className="text-gray-400 text-sm">Split</span><span className="text-gray-300 text-sm">75% / 25%</span></div>
              </>) : <div className="py-8 text-center text-gray-500 text-sm">{backendAlive ? 'No completed jobs yet' : 'Backend offline'}</div>}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10"><h2 className="text-white font-bold">Recent Provider Activity</h2></div>
            <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
              {(dashData?.dashboard?.recent_heartbeats || []).length === 0 ? (
                <p className="px-5 py-8 text-center text-gray-500 text-sm">No heartbeats yet</p>
              ) : dashData!.dashboard!.recent_heartbeats.map((h: any, i: number) => (
                <div key={i} className="px-5 py-3 flex justify-between items-center hover:bg-white/5">
                  <div><p className="text-white text-sm font-medium">{h.name || h.id}</p><p className="text-gray-500 text-xs">{h.gpu_model || '—'}</p></div>
                  <div className="text-right"><p className="text-gray-400 text-xs">{relativeTime(h.last_heartbeat)}</p>{h.provider_ip && <p className="text-gray-600 text-xs">{h.provider_ip}</p>}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10"><h2 className="text-white font-bold">New Provider Signups</h2></div>
            <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
              {(dashData?.dashboard?.recent_signups || []).length === 0 ? (
                <p className="px-5 py-8 text-center text-gray-500 text-sm">No signups yet</p>
              ) : dashData!.dashboard!.recent_signups.map((s: any, i: number) => (
                <div key={i} className="px-5 py-3 hover:bg-white/5">
                  <div className="flex justify-between items-center">
                    <div><p className="text-white text-sm font-medium">{s.name || '—'}</p><p className="text-gray-500 text-xs">{s.email}</p></div>
                    <div className="text-right"><p className="text-gray-400 text-xs">{relativeTime(s.created_at)}</p><p className="text-gray-600 text-xs">{s.gpu_model || '—'}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center py-3 text-xs text-gray-600 border-t border-white/5">
          <span>DC1 Admin · {backendAlive ? '🟢 Backend connected' : '🔴 Backend offline'}</span>
          <span>Auto-refresh every 30s · {lastRefresh?.toLocaleTimeString() || '—'}</span>
        </div>
      </div>
    </main>
  )
}
