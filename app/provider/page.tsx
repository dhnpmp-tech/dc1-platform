'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../components/layout/DashboardLayout'
import StatusBadge from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'
import { useLanguage } from '../lib/i18n'

interface ProviderData {
  id: string
  name: string
  status: 'online' | 'offline'
  todayEarnings: number
  weekEarnings: number
  totalEarnings: number
  jobsCompleted: number
  gpuUptime: number
  gpuModel: string
  temperature: number
  gpuUsage: number
  vramUsage: number
  isPaused: boolean
  lastHeartbeat: string
  daemonVersion: string
  approvalStatus: 'pending' | 'approved' | 'rejected'
  rejectedReason: string
  activeJob?: {
    id: string
    jobType: string
    status: string
    startTime: string
  }
  recentJobs: Array<{
    id: string
    jobType: string
    duration: number
    earnings: number
    status: 'completed' | 'failed'
    completedAt: string
  }>
}

interface DaemonVersionInfo {
  version: string
  download_url: string
  changelog?: string
}

// SVG Icon components
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

// Provider nav items
const GpuIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 3a2 2 0 012-2h2a2 2 0 012 2M9 3h6" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M9 16h6M9 8h6" />
  </svg>
)

// Temperature gauge color
const getTempColor = (temp: number): string => {
  if (temp < 70) return 'bg-status-success'
  if (temp < 80) return 'bg-status-warning'
  return 'bg-status-error'
}

const compareVersions = (v1: string, v2: string): number => {
  const p1 = (v1 || '0').split('.').map((part) => Number(part) || 0)
  const p2 = (v2 || '0').split('.').map((part) => Number(part) || 0)
  const maxLen = Math.max(p1.length, p2.length)
  for (let i = 0; i < maxLen; i += 1) {
    const a = p1[i] || 0
    const b = p2[i] || 0
    if (a < b) return -1
    if (a > b) return 1
  }
  return 0
}

export default function ProviderDashboard() {
  const router = useRouter()
  const { t } = useLanguage()
  const [providerData, setProviderData] = useState<ProviderData | null>(null)
  const [latestDaemon, setLatestDaemon] = useState<DaemonVersionInfo | null>(null)
  const [providerApiKey, setProviderApiKey] = useState('')
  const [loading, setLoading] = useState(true)

  const getNavItems = () => [
    { label: t('nav.dashboard'), href: '/provider', icon: <HomeIcon /> },
    { label: t('nav.jobs'), href: '/provider/jobs', icon: <LightningIcon /> },
    { label: t('nav.earnings'), href: '/provider/earnings', icon: <CurrencyIcon /> },
    { label: t('nav.gpu_metrics'), href: '/provider/gpu', icon: <GpuIcon /> },
    { label: t('nav.settings'), href: '/provider/settings', icon: <GearIcon /> },
  ]
  const [togglingPause, setTogglingPause] = useState(false)
  const [dailyEarnings, setDailyEarnings] = useState<Array<{ day: string; earned_halala: number; completed: number }>>([])


  const handlePauseResume = async () => {
    if (!providerData) return
    const apiKey = localStorage.getItem('dc1_provider_key')
    if (!apiKey) return
    const API_BASE = '/api/dc1'
    const endpoint = providerData.isPaused ? 'resume' : 'pause'
    setTogglingPause(true)
    try {
      const res = await fetch(`${API_BASE}/providers/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: apiKey }),
      })
      if (res.ok) {
        const data = await res.json()
        setProviderData({
          ...providerData,
          isPaused: endpoint === 'pause',
          status: data.status === 'online' || data.status === 'idle' ? 'online' : 'offline',
        })
      }
    } catch (err) {
      console.error('Pause/resume failed:', err)
    } finally {
      setTogglingPause(false)
    }
  }

  useEffect(() => {
    const fetchLatestDaemonVersion = async () => {
      try {
        const API_BASE = '/api/dc1'
        const res = await fetch(`${API_BASE}/daemon/latest-version`)
        if (!res.ok) return
        const data = await res.json()
        if (!data?.version) return
        setLatestDaemon({
          version: String(data.version),
          download_url: String(data.download_url || '/api/dc1/providers/download/daemon'),
          changelog: typeof data.changelog === 'string' ? data.changelog : undefined,
        })
      } catch {
        // Non-blocking for dashboard rendering
      }
    }

    fetchLatestDaemonVersion()
  }, [])

  useEffect(() => {
    const API_BASE = '/api/dc1'

    const initializeDashboard = async () => {
      // Check for API key
      const apiKey = localStorage.getItem('dc1_provider_key')
      if (!apiKey) {
        router.push('/provider/register')
        return
      }
      setProviderApiKey(apiKey)

      try {
        // Fetch real provider data from VPS
        const res = await fetch(`${API_BASE}/providers/me?key=${encodeURIComponent(apiKey)}`)

        if (!res.ok) {
          // Invalid key — clear and redirect
          localStorage.removeItem('dc1_provider_key')
          router.push('/login')
          return
        }

        const data = await res.json()
        const provider = data.provider || {}

        // Map real data to ProviderData shape, filling gaps with defaults
        setProviderData({
          id: String(provider.id || ''),
          name: provider.name || 'Provider',
          status: provider.status === 'online' || provider.status === 'idle' ? 'online' : 'offline',
          isPaused: Boolean(provider.is_paused),
          lastHeartbeat: provider.last_heartbeat || '',
          daemonVersion: provider.daemon_version || '',
          approvalStatus: provider.approval_status || 'pending',
          rejectedReason: provider.rejected_reason || '',
          todayEarnings: (provider.today_earnings_halala || 0) / 100,
          weekEarnings: (provider.week_earnings_halala || 0) / 100,
          totalEarnings: (provider.total_earnings_halala || 0) / 100,
          jobsCompleted: provider.total_jobs || 0,
          gpuUptime: provider.uptime_percent || 0,
          gpuModel: provider.gpu_model || 'Unknown GPU',
          temperature: provider.gpu_temp || 0,
          gpuUsage: provider.gpu_usage || 0,
          vramUsage: provider.vram_usage || 0,
          activeJob: provider.active_job ? {
            id: provider.active_job.job_id,
            jobType: provider.active_job.job_type,
            status: provider.active_job.status,
            startTime: provider.active_job.started_at || '',
          } : undefined,
          recentJobs: (data.recent_jobs || []).map((j: any) => ({
            id: j.job_id || String(j.id),
            jobType: j.job_type || 'Unknown',
            duration: j.actual_duration_minutes || 0,
            earnings: (j.provider_earned_halala || 0) / 100,
            status: j.status === 'completed' ? 'completed' : 'failed',
            completedAt: j.completed_at || '',
          })),
        })
        // Fetch daily earnings for chart
        try {
          const dailyRes = await fetch(`${API_BASE}/providers/earnings-daily?key=${encodeURIComponent(apiKey)}&days=7`)
          if (dailyRes.ok) {
            const dailyData = await dailyRes.json()
            setDailyEarnings(dailyData.daily || [])
          }
        } catch { /* ignore chart data failure */ }
      } catch (error) {
        console.error('Failed to load provider data:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeDashboard()
    const interval = setInterval(initializeDashboard, 30000)
    return () => clearInterval(interval)
  }, [router])

  const daemonNeedsUpdate = Boolean(
    latestDaemon?.version &&
    (!providerData?.daemonVersion || compareVersions(providerData.daemonVersion, latestDaemon.version) < 0)
  )
  const daemonStatusLabel = daemonNeedsUpdate
    ? t('provider.daemon_update')
        .replace('{current}', providerData?.daemonVersion ? `v${providerData.daemonVersion}` : 'unknown')
        .replace('{latest}', latestDaemon?.version ? `v${latestDaemon.version}` : 'latest')
    : t('provider.daemon_current').replace('{version}', latestDaemon?.version ? `v${latestDaemon.version}` : (providerData?.daemonVersion ? `v${providerData.daemonVersion}` : '—'))

  const daemonDownloadUrl = (() => {
    if (!providerApiKey) return ''
    const base = latestDaemon?.download_url || '/api/dc1/providers/download/daemon'
    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}key=${encodeURIComponent(providerApiKey)}`
  })()

  if (loading) {
    return (
      <DashboardLayout navItems={getNavItems()} role="provider" userName="Provider">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-dc1-surface-l2 rounded skeleton" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-dc1-surface-l2 rounded skeleton" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!providerData) {
    return (
      <DashboardLayout navItems={getNavItems()} role="provider" userName="Provider">
        <div className="card">
          <p className="text-dc1-text-secondary">{t('provider.failed_load')}</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout navItems={getNavItems()} role="provider" userName={providerData.name}>
      <div className="space-y-8">
        {providerData.approvalStatus === 'pending' && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100 text-sm">
            {t('provider.pending_approval')}
          </div>
        )}
        {providerData.approvalStatus === 'rejected' && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-100 text-sm">
            {t('provider.rejected').replace('{reason}', providerData.rejectedReason || 'No reason provided')}
          </div>
        )}

        {/* Page Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold text-dc1-text-primary">{t('provider.dashboard')}</h1>
          <div className="flex items-center gap-3">
            <StatusBadge status={providerData.isPaused ? 'paused' : providerData.status} />
            <button
              onClick={handlePauseResume}
              disabled={togglingPause}
              className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                providerData.isPaused
                  ? 'bg-status-success/20 text-status-success hover:bg-status-success/30 border border-status-success/30'
                  : 'bg-status-warning/20 text-status-warning hover:bg-status-warning/30 border border-status-warning/30'
              }`}
            >
              {togglingPause ? t('provider.updating') : providerData.isPaused ? t('provider.resume_gpu') : t('provider.pause_gpu')}
            </button>
          </div>
        </div>

        {latestDaemon && (
          daemonNeedsUpdate ? (
            <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-status-warning">{daemonStatusLabel}</p>
              {daemonDownloadUrl && (
                <a
                  href={daemonDownloadUrl}
                  className="text-sm font-semibold text-dc1-amber hover:underline"
                >
                  Download Update
                </a>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-status-success/15 text-status-success border border-status-success/30">
              {daemonStatusLabel}
            </div>
          )
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label={t('provider.today_earnings')}
            value={`${providerData.todayEarnings.toFixed(2)} ${t('common.sar')}`}
            accent="amber"
            icon={<CurrencyIcon />}
          />
          <StatCard
            label={t('provider.this_week')}
            value={`${providerData.weekEarnings.toFixed(2)} ${t('common.sar')}`}
            accent="info"
            icon={<CurrencyIcon />}
          />
          <StatCard
            label={t('provider.total_earnings')}
            value={`${providerData.totalEarnings.toFixed(2)} ${t('common.sar')}`}
            accent="success"
            icon={<CurrencyIcon />}
          />
          <StatCard
            label={t('provider.jobs_completed')}
            value={providerData.jobsCompleted}
            accent="default"
            icon={<LightningIcon />}
          />
          <StatCard
            label={t('provider.gpu_uptime')}
            value={`${providerData.gpuUptime}%`}
            accent="info"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
        </div>

        {/* GPU Health Section */}
        <div className="card">
          <h2 className="section-heading mb-6">{t('provider.gpu_health')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* GPU Model */}
            <div>
              <p className="text-sm text-dc1-text-secondary mb-2">{t('provider.gpu_model')}</p>
              <p className="text-lg font-semibold text-dc1-text-primary">{providerData.gpuModel}</p>
            </div>

            {/* Temperature Gauge */}
            <div>
              <p className="text-sm text-dc1-text-secondary mb-2">{t('provider.temperature')}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2 bg-dc1-surface-l2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getTempColor(providerData.temperature)} transition-all`}
                      style={{ width: `${Math.min(providerData.temperature, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-dc1-text-primary w-12 text-right">
                  {providerData.temperature}°C
                </span>
              </div>
            </div>

            {/* Daemon Connection */}
            <div>
              <p className="text-sm text-dc1-text-secondary mb-2">{t('provider.daemon_status')}</p>
              {(() => {
                const hb = providerData.lastHeartbeat
                const isConnected = hb ? (Date.now() - new Date(hb).getTime()) < 120000 : false
                const isStale = hb ? (Date.now() - new Date(hb).getTime()) < 300000 : false
                return (
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-status-success animate-pulse' : isStale ? 'bg-status-warning' : 'bg-status-error'}`} />
                    <span className="text-sm font-medium text-dc1-text-primary">
                      {isConnected ? t('provider.connected') : isStale ? t('provider.stale') : t('provider.disconnected')}
                    </span>
                    {providerData.daemonVersion && (
                      <span className="text-xs text-dc1-text-muted ms-1">v{providerData.daemonVersion}</span>
                    )}
                  </div>
                )
              })()}
              {providerData.lastHeartbeat && (
                <p className="text-xs text-dc1-text-muted mt-1">
                  {t('provider.last_seen')}: {new Date(providerData.lastHeartbeat).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Usage Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-dc1-border">
            {/* GPU Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-dc1-text-secondary">{t('provider.gpu_usage')}</p>
                <span className="text-sm font-semibold text-dc1-text-primary">{providerData.gpuUsage}%</span>
              </div>
              <div className="h-2 bg-dc1-surface-l2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-dc1-amber transition-all"
                  style={{ width: `${providerData.gpuUsage}%` }}
                />
              </div>
            </div>

            {/* VRAM Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-dc1-text-secondary">{t('provider.vram_usage')}</p>
                <span className="text-sm font-semibold text-dc1-text-primary">{providerData.vramUsage}%</span>
              </div>
              <div className="h-2 bg-dc1-surface-l2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-status-info transition-all"
                  style={{ width: `${providerData.vramUsage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 7-Day Earnings Chart */}
        {dailyEarnings.length > 0 && (
          <div className="card">
            <h2 className="section-heading mb-4">{t('provider.last_7_days')}</h2>
            <div className="flex items-end gap-2 h-32">
              {(() => {
                const maxEarning = Math.max(...dailyEarnings.map(d => d.earned_halala), 1)
                return dailyEarnings.slice(0, 7).reverse().map(d => {
                  const pct = Math.max(4, (d.earned_halala / maxEarning) * 100)
                  const sar = (d.earned_halala / 100).toFixed(2)
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-dc1-amber font-medium">{sar}</span>
                      <div
                        className="w-full bg-gradient-to-t from-dc1-amber/60 to-dc1-amber rounded-t transition-all"
                        style={{ height: `${pct}%`, minHeight: '4px' }}
                      />
                      <span className="text-[10px] text-dc1-text-muted">
                        {new Date(d.day + 'T00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className="text-[9px] text-dc1-text-muted">{d.completed}j</span>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        )}

        {/* Current Job Section */}
        <div className="card">
          <h2 className="section-heading mb-4">{t('provider.current_job')}</h2>
          {providerData.activeJob ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm text-dc1-text-secondary mb-1">{t('provider.job_type')}</p>
                  <p className="text-lg font-semibold text-dc1-text-primary">{providerData.activeJob.jobType}</p>
                </div>
                <StatusBadge status="running" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-dc1-text-secondary mb-1">{t('provider.job_id')}</p>
                  <p className="text-sm font-mono text-dc1-amber">{providerData.activeJob.id}</p>
                </div>
                <div>
                  <p className="text-sm text-dc1-text-secondary mb-1">{t('provider.started')}</p>
                  <p className="text-sm text-dc1-text-primary">{providerData.activeJob.startTime}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-dc1-text-secondary">{t('provider.no_active_jobs')}</p>
            </div>
          )}
        </div>

        {/* Recent Activity Section */}
        <div className="card">
          <h2 className="section-heading mb-6">{t('provider.recent_activity')}</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('table.job_type')}</th>
                  <th>{t('table.duration')}</th>
                  <th>{t('table.earnings')}</th>
                  <th>{t('table.status')}</th>
                  <th>{t('table.completed')}</th>
                </tr>
              </thead>
              <tbody>
                {providerData.recentJobs.length > 0 ? providerData.recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.jobType}</td>
                    <td>{job.duration > 0 ? `${job.duration} ${t('common.min')}` : '<1 min'}</td>
                    <td className="font-semibold text-status-success">{job.earnings > 0 ? `${job.earnings.toFixed(2)} ${t('common.sar')}` : '—'}</td>
                    <td>
                      <StatusBadge
                        status={job.status === 'completed' ? 'completed' : 'failed'}
                        size="sm"
                      />
                    </td>
                    <td className="text-dc1-text-secondary">{job.completedAt ? new Date(job.completedAt).toLocaleString() : '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="text-center text-dc1-text-secondary py-6">{t('common.no_jobs_yet')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
