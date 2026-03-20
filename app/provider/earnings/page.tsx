'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { useLanguage } from '../../lib/i18n'

const API_BASE = '/api/dc1'

interface EarningsData {
  total_earned_sar: number
  pending_withdrawal_sar: number
  withdrawn_sar: number
  available_sar: number
  total_jobs: number
}

interface DailyEarning {
  day: string
  jobs: number
  completed: number
  failed: number
  earned_halala: number
  earned_sar: string
  total_minutes: number
}

interface HistoryJob {
  id: number
  job_id: string
  job_type: string
  status: string
  submitted_at: string
  started_at: string
  completed_at: string
  error: string | null
  provider_earned_halala: number
  dc1_fee_halala: number
  actual_cost_halala: number
  actual_duration_minutes: number
  earned_sar: string
  cost_sar: string
  renter_name: string
}

interface JobStats {
  total_jobs: number
  completed_jobs: number
  failed_jobs: number
  total_earned_sar: string
  success_rate: number
}

interface Withdrawal {
  withdrawal_id: string
  amount_sar: number
  payout_method: string
  status: string
  requested_at: string
  processed_at: string | null
}

interface DaemonInfo {
  version: string
  hostname: string
  os: string
  python: string
  last_seen?: string
  gpu_name?: string
  gpu_vram_mib?: number
  free_vram_mib?: number
  gpu_temp_c?: number
  gpu_util_pct?: number
  driver_version?: string
  provider_status?: string
  last_heartbeat?: string
}

interface DaemonEvent {
  id: number
  event_type: string
  severity: string
  daemon_version: string
  job_id: string | null
  hostname: string
  details: string
  event_timestamp: string
}

// SVG Icon components (matching provider nav)
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 5v14a1 1 0 001 1h12a1 1 0 001-1V5m-9 9h4" />
  </svg>
)
const LightningIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)
const CurrencyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const GpuIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 3a2 2 0 012-2h2a2 2 0 012 2M9 3h6" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M9 16h6M9 8h6" />
  </svg>
)

const navItems = [
  { label: 'Dashboard', href: '/provider', icon: <HomeIcon /> },
  { label: 'Jobs', href: '/provider/jobs', icon: <LightningIcon /> },
  { label: 'Earnings', href: '/provider/earnings', icon: <CurrencyIcon /> },
  { label: 'GPU Metrics', href: '/provider/gpu', icon: <GpuIcon /> },
  { label: 'Settings', href: '/provider/settings', icon: <GearIcon /> },
]

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-dc1-text-muted text-sm">{label}</span>
      <span className="text-dc1-text-primary font-mono text-xs">{value}</span>
    </div>
  )
}

export default function EarningsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [providerName, setProviderName] = useState('Provider')
  const [tab, setTab] = useState<'overview' | 'jobs' | 'daemon' | 'withdrawals'>('overview')
  const [earnings, setEarnings] = useState<EarningsData | null>(null)
  const [daily, setDaily] = useState<DailyEarning[]>([])
  const [jobs, setJobs] = useState<HistoryJob[]>([])
  const [jobStats, setJobStats] = useState<JobStats | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [daemonInfo, setDaemonInfo] = useState<DaemonInfo | null>(null)
  const [daemonEvents, setDaemonEvents] = useState<DaemonEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const key = localStorage.getItem('dc1_provider_key')
    if (!key) {
      router.push('/login')
      return
    }

    setLoading(true)
    try {
      // Get provider name
      const meRes = await fetch(`${API_BASE}/providers/me?key=${encodeURIComponent(key)}`)
      if (!meRes.ok) {
        localStorage.removeItem('dc1_provider_key')
        router.push('/login')
        return
      }
      const meData = await meRes.json()
      setProviderName(meData.provider?.name || 'Provider')

      const [eRes, dRes, jRes, wRes, logRes] = await Promise.all([
        fetch(`${API_BASE}/providers/earnings?key=${encodeURIComponent(key)}`),
        fetch(`${API_BASE}/providers/earnings-daily?key=${encodeURIComponent(key)}&days=30`),
        fetch(`${API_BASE}/providers/job-history?key=${encodeURIComponent(key)}&limit=50`),
        fetch(`${API_BASE}/providers/withdrawal-history?key=${encodeURIComponent(key)}`),
        fetch(`${API_BASE}/providers/daemon-logs?key=${encodeURIComponent(key)}&limit=30`),
      ])
      if (eRes.ok) setEarnings(await eRes.json())
      if (dRes.ok) { const d = await dRes.json(); setDaily(d.daily || []) }
      if (jRes.ok) {
        const j = await jRes.json()
        setJobs(j.jobs || [])
        setJobStats({ total_jobs: j.total_jobs, completed_jobs: j.completed_jobs, failed_jobs: j.failed_jobs, total_earned_sar: j.total_earned_sar, success_rate: j.success_rate })
      }
      if (wRes.ok) { const w = await wRes.json(); setWithdrawals(w.withdrawals || []) }
      if (logRes.ok) {
        const l = await logRes.json()
        setDaemonInfo(l.daemon_info || null)
        setDaemonEvents(l.events || [])
      }
    } catch (err) {
      console.error('Fetch error:', err)
    }
    setLoading(false)
  }, [router])

  const handleWithdraw = useCallback(async () => {
    const key = localStorage.getItem('dc1_provider_key')
    if (!key) return
    setWithdrawLoading(true)
    setWithdrawError(null)
    try {
      const res = await fetch(`${API_BASE}/providers/withdraw?key=${encodeURIComponent(key)}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Request failed (${res.status})`)
      }
      setShowWithdrawModal(false)
      setWithdrawSuccess(true)
      setTimeout(() => setWithdrawSuccess(false), 6000)
      await fetchAll()
    } catch (err: any) {
      setWithdrawError(err.message || 'Withdrawal request failed.')
    }
    setWithdrawLoading(false)
  }, [fetchAll])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 60000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const maxDailyEarning = Math.max(...daily.map(d => d.earned_halala), 1)

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} role="provider" userName="Provider">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout navItems={navItems} role="provider" userName={providerName}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-dc1-text-primary">Earnings & History</h1>
            <p className="text-dc1-text-secondary text-sm mt-1">Track your GPU earnings, job history, and daemon status</p>
          </div>
          <button onClick={fetchAll} className="btn btn-secondary text-sm">
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        {earnings && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Available" value={`${earnings.available_sar.toFixed(2)} SAR`} accent="amber" />
            <StatCard label="Total Earned" value={`${earnings.total_earned_sar.toFixed(2)} SAR`} accent="success" />
            <StatCard label="Withdrawn" value={`${earnings.withdrawn_sar.toFixed(2)} SAR`} accent="default" />
            <StatCard label="Jobs Done" value={String(earnings.total_jobs)} accent="info" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-dc1-surface-l2 rounded-xl p-1">
          {(['overview', 'jobs', 'daemon', 'withdrawals'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                tab === t ? 'bg-dc1-amber/10 text-dc1-amber' : 'text-dc1-text-muted hover:text-dc1-text-secondary'
              }`}
            >
              {t === 'overview' ? 'Earnings' : t === 'jobs' ? 'Job History' : t === 'daemon' ? 'Daemon' : 'Withdrawals'}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Daily chart */}
            <div className="card">
              <h3 className="text-sm text-dc1-text-secondary mb-4">Daily Earnings (Last 30 Days)</h3>
              {daily.length === 0 ? (
                <p className="text-dc1-text-muted text-sm">No earnings data yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {daily.slice(0, 14).map(d => (
                    <div key={d.day} className="flex items-center gap-3 text-xs">
                      <span className="text-dc1-text-muted w-20 shrink-0">{new Date(d.day + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <div className="flex-1 h-5 bg-dc1-surface-l2 rounded overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-dc1-amber/80 to-dc1-amber rounded"
                          style={{ width: `${Math.max(2, (d.earned_halala / maxDailyEarning) * 100)}%` }}
                        />
                      </div>
                      <span className="text-dc1-amber w-16 text-right">{d.earned_sar} SAR</span>
                      <span className="text-dc1-text-muted w-12 text-right">{d.completed}j</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            {jobStats && (
              <div className="grid grid-cols-3 gap-4">
                <div className="card text-center">
                  <div className="text-2xl font-bold text-status-success">{jobStats.success_rate}%</div>
                  <div className="text-xs text-dc1-text-muted mt-1">Success Rate</div>
                </div>
                <div className="card text-center">
                  <div className="text-2xl font-bold text-status-info">{jobStats.completed_jobs}</div>
                  <div className="text-xs text-dc1-text-muted mt-1">Completed</div>
                </div>
                <div className="card text-center">
                  <div className="text-2xl font-bold text-status-error">{jobStats.failed_jobs}</div>
                  <div className="text-xs text-dc1-text-muted mt-1">Failed</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Job History */}
        {tab === 'jobs' && (
          <div className="table-container">
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-dc1-text-muted">No jobs yet.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Renter</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>You Earned</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id}>
                      <td className="text-sm text-dc1-text-secondary">
                        {j.completed_at ? new Date(j.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="text-sm text-status-info">{(j.job_type || '').replace(/_/g, ' ')}</td>
                      <td className="text-sm text-dc1-text-secondary">{j.renter_name || '—'}</td>
                      <td className="text-sm text-dc1-text-secondary">{j.actual_duration_minutes ? `${j.actual_duration_minutes} min` : '—'}</td>
                      <td>
                        <StatusBadge status={j.status as any} size="sm" />
                        {j.error && <p className="text-xs text-status-error mt-1 truncate max-w-[150px]">{j.error}</p>}
                      </td>
                      <td className="text-dc1-amber font-semibold">
                        {j.status === 'completed' ? `${j.earned_sar} SAR` : '—'}
                      </td>
                      <td className="text-sm text-dc1-text-muted">{j.cost_sar} SAR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Daemon */}
        {tab === 'daemon' && (
          <div className="space-y-4">
            {/* Live Daemon Info Card */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="section-heading">Daemon Information</h3>
                {daemonInfo?.provider_status && (
                  <StatusBadge status={daemonInfo.provider_status as any} size="sm" />
                )}
              </div>
              {daemonInfo ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow label="Daemon Version" value={daemonInfo.version || '—'} />
                    <InfoRow label="Hostname" value={daemonInfo.hostname || '—'} />
                    <InfoRow label="OS" value={daemonInfo.os || '—'} />
                    <InfoRow label="Python" value={daemonInfo.python || '—'} />
                    <InfoRow label="Last Heartbeat" value={daemonInfo.last_heartbeat ? new Date(daemonInfo.last_heartbeat).toLocaleString() : '—'} />
                    <InfoRow label="GPU Driver" value={daemonInfo.driver_version || '—'} />
                  </div>
                  {/* GPU stats from live heartbeat */}
                  {daemonInfo.gpu_name && (
                    <div className="border-t border-dc1-border pt-3">
                      <h4 className="text-xs text-dc1-amber/60 mb-2">GPU Status (Live)</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <InfoRow label="GPU" value={daemonInfo.gpu_name} />
                        <InfoRow label="VRAM" value={daemonInfo.gpu_vram_mib ? `${daemonInfo.free_vram_mib || 0} / ${daemonInfo.gpu_vram_mib} MiB free` : '—'} />
                        <InfoRow label="Temperature" value={daemonInfo.gpu_temp_c != null ? `${daemonInfo.gpu_temp_c}°C` : '—'} />
                        <InfoRow label="Utilization" value={daemonInfo.gpu_util_pct != null ? `${daemonInfo.gpu_util_pct}%` : '—'} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-dc1-text-muted text-sm">No heartbeat received yet. Start the daemon to see info here.</p>
              )}
            </div>

            {/* Event Log */}
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-dc1-border">
                <h3 className="section-heading">Recent Daemon Events</h3>
              </div>
              {daemonEvents.length === 0 ? (
                <div className="p-6 text-center text-dc1-text-muted text-sm">No events logged yet.</div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {daemonEvents.map(ev => (
                    <div key={ev.id} className="px-6 py-3 border-b border-dc1-border/50 hover:bg-dc1-surface-l2 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          ev.severity === 'error' || ev.severity === 'critical' ? 'bg-status-error' :
                          ev.severity === 'warning' ? 'bg-status-warning' : 'bg-status-success'
                        }`} />
                        <span className="text-xs font-medium text-dc1-text-primary">{ev.event_type}</span>
                        <StatusBadge status={ev.severity === 'error' || ev.severity === 'critical' ? 'failed' : ev.severity === 'warning' ? 'paused' : 'online'} size="sm" />
                        {ev.daemon_version && <span className="text-[10px] text-dc1-text-muted">v{ev.daemon_version}</span>}
                        <span className="text-[10px] text-dc1-text-muted ml-auto">{ev.event_timestamp ? new Date(ev.event_timestamp).toLocaleString() : ''}</span>
                      </div>
                      {ev.details && (
                        <pre className="text-[11px] text-dc1-text-muted mt-1 whitespace-pre-wrap break-words max-h-16 overflow-hidden">{ev.details.substring(0, 300)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Withdrawals */}
        {tab === 'withdrawals' && (
          <div className="space-y-4">
            {/* Success banner */}
            {withdrawSuccess && (
              <div className="rounded-xl px-4 py-3 bg-status-success/10 border border-status-success/30 text-status-success text-sm flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('provider.withdraw.success')}
              </div>
            )}

            {/* Balance card */}
            {earnings && (
              <div className="card bg-gradient-to-r from-dc1-amber/10 to-transparent border-dc1-amber/20">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="text-dc1-text-secondary text-sm">Available for Withdrawal</div>
                    <div className="text-3xl font-bold text-dc1-amber mt-1">{earnings.available_sar.toFixed(2)} SAR</div>
                    <div className="text-xs text-dc1-text-muted mt-1">Min withdrawal: 10 SAR</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {earnings.pending_withdrawal_sar > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-status-warning">
                          {t('provider.withdraw.pending').replace('{amount}', earnings.pending_withdrawal_sar.toFixed(2))}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => { setWithdrawError(null); setShowWithdrawModal(true) }}
                      disabled={earnings.available_sar <= 0}
                      className="btn btn-primary text-sm min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t('provider.withdraw.button')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Withdrawal History */}
            <div className="table-container">
              <div className="px-4 py-3 border-b border-dc1-border">
                <h3 className="section-heading">Withdrawal History</h3>
              </div>
              {withdrawals.length === 0 ? (
                <div className="p-6 text-center text-dc1-text-muted text-sm">No withdrawals yet.</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map(w => (
                      <tr key={w.withdrawal_id}>
                        <td className="text-sm text-dc1-text-secondary">{new Date(w.requested_at).toLocaleDateString()}</td>
                        <td className="text-dc1-amber font-semibold">{w.amount_sar.toFixed(2)} SAR</td>
                        <td className="text-sm text-dc1-text-secondary">{(w.payout_method || '').replace(/_/g, ' ')}</td>
                        <td><StatusBadge status={w.status === 'completed' ? 'completed' : w.status === 'pending' ? 'pending' : 'failed'} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Withdrawal confirmation modal */}
        {showWithdrawModal && earnings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-dc1-surface-l1 border border-dc1-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
              <h2 className="text-lg font-bold text-dc1-text-primary mb-2">Confirm Withdrawal</h2>
              <p className="text-dc1-text-secondary text-sm mb-6">
                {t('provider.withdraw.confirm').replace('{amount}', earnings.available_sar.toFixed(2))}
              </p>
              {withdrawError && (
                <div className="mb-4 rounded-lg px-3 py-2 bg-status-error/10 border border-status-error/30 text-status-error text-xs">
                  {withdrawError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  disabled={withdrawLoading}
                  className="btn btn-secondary flex-1 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawLoading}
                  className="btn btn-primary flex-1 text-sm"
                >
                  {withdrawLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                      Processing…
                    </span>
                  ) : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
