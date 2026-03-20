'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../components/layout/DashboardLayout'
import StatCard from '../components/ui/StatCard'
import StatusBadge from '../components/ui/StatusBadge'
import { useLanguage } from '../lib/i18n'

const API_BASE = '/api/dc1'

interface NavItem { label: string; href: string; icon: React.ReactNode }

interface PricingRate {
  gpu_model: string
  rate_halala: number
  updated_at: string
}

interface EditModal {
  open: boolean
  isNew: boolean
  gpu_model: string
  rate_sar: string
  saving: boolean
  error: string
}

interface AdminMetrics {
  queue: {
    pending_jobs: number
    running_jobs: number
    failed_last_1h: number
    avg_wait_seconds: number
  }
  providers: {
    online: number
    total_registered: number
    pending_approval: number
    avg_heartbeat_age_seconds: number
  }
  renters: {
    total_registered: number
    active_last_24h: number
    total_balance_halala: number
  }
  revenue: {
    today_halala: number
    this_week_halala: number
    this_month_halala: number
  }
  system: {
    uptime_seconds: number
    db_size_bytes: number
    node_version: string
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const { t, isRTL } = useLanguage()
  const [isAuthed, setIsAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [gpuBreakdown, setGpuBreakdown] = useState<any[]>([])
  const [recentSignups, setRecentSignups] = useState<any[]>([])
  const [recentHeartbeats, setRecentHeartbeats] = useState<any[]>([])

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'pricing' | 'health'>('overview')

  // Pricing state
  const [pricingRates, setPricingRates] = useState<PricingRate[]>([])
  const [pricingLoading, setPricingLoading] = useState(false)
  const [pricingError, setPricingError] = useState('')
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState('')
  const [modal, setModal] = useState<EditModal>({
    open: false, isNew: false, gpu_model: '', rate_sar: '', saving: false, error: '',
  })

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

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') || '' : ''

  const fetchPricing = useCallback(async () => {
    setPricingLoading(true)
    setPricingError('')
    try {
      const res = await fetch(`${API_BASE}/admin/pricing`, {
        headers: { 'x-admin-token': getToken() },
      })
      if (!res.ok) throw new Error('Failed to load pricing')
      const data = await res.json()
      setPricingRates(data.rates || [])
    } catch (err: any) {
      setPricingError(err.message)
    } finally {
      setPricingLoading(false)
    }
  }, [])

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true)
    setMetricsError('')
    try {
      const res = await fetch(`${API_BASE}/admin/metrics`, {
        headers: { 'x-admin-token': getToken() },
      })
      if (!res.ok) throw new Error('Failed to load system metrics')
      const data = await res.json()
      setMetrics(data)
    } catch (err: any) {
      setMetricsError(err.message)
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'pricing' && isAuthed) fetchPricing()
  }, [activeTab, isAuthed, fetchPricing])

  useEffect(() => {
    if (!(activeTab === 'health' && isAuthed)) return
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30000)
    return () => clearInterval(interval)
  }, [activeTab, isAuthed, fetchMetrics])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsaved])

  const openEdit = (rate: PricingRate) => {
    setModal({
      open: true, isNew: false,
      gpu_model: rate.gpu_model,
      rate_sar: (rate.rate_halala / 100).toFixed(2),
      saving: false, error: '',
    })
    setHasUnsaved(true)
  }

  const openAdd = () => {
    setModal({ open: true, isNew: true, gpu_model: '', rate_sar: '', saving: false, error: '' })
    setHasUnsaved(true)
  }

  const closeModal = () => {
    setModal(m => ({ ...m, open: false }))
    setHasUnsaved(false)
  }

  const saveRate = async () => {
    const rateHalala = Math.round(parseFloat(modal.rate_sar) * 100)
    if (isNaN(rateHalala) || rateHalala <= 0) {
      setModal(m => ({ ...m, error: 'Enter a valid positive rate.' }))
      return
    }
    setModal(m => ({ ...m, saving: true, error: '' }))
    try {
      const token = getToken()
      if (modal.isNew) {
        const res = await fetch(`${API_BASE}/admin/pricing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ gpu_model: modal.gpu_model, rate_halala: rateHalala }),
        })
        if (!res.ok) throw new Error('Failed to add rate')
      } else {
        const res = await fetch(`${API_BASE}/admin/pricing/${encodeURIComponent(modal.gpu_model)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ rate_halala: rateHalala }),
        })
        if (!res.ok) throw new Error('Failed to update rate')
      }
      await fetchPricing()
      closeModal()
    } catch (err: any) {
      setModal(m => ({ ...m, saving: false, error: err.message }))
    }
  }

  if (!isAuthed) return <div className="flex items-center justify-center min-h-screen text-dc1-text-secondary">{t('common.loading')}</div>

  const HomeIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M9 21h6a2 2 0 002-2V9l-7-4-7 4v10a2 2 0 002 2z" /></svg>)
  const ServerIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12v4a2 2 0 002 2h10a2 2 0 002-2v-4" /></svg>)
  const UsersIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>)
  const BriefcaseIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>)
  const ShieldIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>)
  const CpuIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>)
  const ContainerIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>)
  const BoltIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>)
  const CurrencyIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>)
  const WalletIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>)

  const navItems: NavItem[] = [
    { label: t('nav.dashboard'), href: '/admin', icon: <HomeIcon /> },
    { label: t('nav.providers'), href: '/admin/providers', icon: <ServerIcon /> },
    { label: t('nav.renters'), href: '/admin/renters', icon: <UsersIcon /> },
    { label: t('nav.jobs'), href: '/admin/jobs', icon: <BriefcaseIcon /> },
    { label: t('nav.finance'), href: '/admin/finance', icon: <CurrencyIcon /> },
    { label: t('nav.withdrawals'), href: '/admin/withdrawals', icon: <WalletIcon /> },
    { label: t('nav.security'), href: '/admin/security', icon: <ShieldIcon /> },
    { label: t('nav.fleet'), href: '/admin/fleet', icon: <CpuIcon /> },
    { label: t('nav.containers'), href: '/admin/containers', icon: <ContainerIcon /> },
  ]

  const formatTime = (iso: string) => {
    if (!iso) return t('admin.never')
    const d = new Date(iso)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const totalGpus = gpuBreakdown.reduce((sum: number, g: any) => sum + g.count, 0)

  const tabClass = (tab: 'overview' | 'pricing' | 'health') =>
    `px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-dc1-amber text-dc1-amber bg-dc1-surface-l2'
        : 'border-transparent text-dc1-text-secondary hover:text-dc1-text-primary'
    }`

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds < 60) return `${seconds || 0}s`
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = bytes
    let idx = 0
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024
      idx += 1
    }
    return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`
  }

  return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-dc1-text-primary mb-2">{t('admin.dashboard')}</h1>
        <p className="text-dc1-text-secondary">{t('admin.live_overview')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-dc1-border mb-6">
        <button className={tabClass('overview')} onClick={() => setActiveTab('overview')}>
          {t('admin.tab.overview')}
        </button>
        <button className={tabClass('pricing')} onClick={() => {
          if (hasUnsaved && !window.confirm(t('admin.pricing.unsavedWarning'))) return
          setActiveTab('pricing')
        }}>
          {t('admin.tab.pricing')}
        </button>
        <button className={tabClass('health')} onClick={() => {
          if (hasUnsaved && !window.confirm(t('admin.pricing.unsavedWarning'))) return
          setActiveTab('health')
        }}>
          {t('admin.tab.health')}
        </button>
      </div>

      {error && <div className="card mb-6 border-red-500/50 text-red-400 text-sm">{error}</div>}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        loading ? (
          <div className="text-dc1-text-secondary">{t('admin.loading')}</div>
        ) : (
          <>
            {/* Provider Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <StatCard label={t('admin.total_providers')} value={String(stats?.total_providers || 0)} accent="default" />
              <StatCard label={t('admin.online_now')} value={String(stats?.online_now || 0)} accent="success" />
              <StatCard label={t('admin.total_renters')} value={String(stats?.total_renters || 0)} accent="info" />
              <StatCard label={t('admin.active_jobs')} value={String(stats?.active_jobs || 0)} accent="amber" />
            </div>

            {/* Revenue Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <StatCard label={t('admin.total_revenue')} value={`${((stats?.total_revenue_halala || 0) / 100).toFixed(2)} ${t('common.sar')}`} accent="success" />
              <StatCard label={t('admin.dc1_fees')} value={`${((stats?.total_dc1_fees_halala || 0) / 100).toFixed(2)} ${t('common.sar')}`} accent="amber" />
              <StatCard label={t('admin.today_revenue')} value={`${((stats?.today_revenue_halala || 0) / 100).toFixed(2)} ${t('common.sar')}`} accent="info" />
              <StatCard label={t('provider.jobs_completed')} value={String(stats?.completed_jobs || 0)} accent="default" />
            </div>

            {/* GPU Fleet */}
            <div className="card mb-8">
              <h2 className="section-heading mb-6">{t('admin.gpu_fleet')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {gpuBreakdown.map((g: any) => (
                  <div key={g.gpu_model} className="bg-dc1-surface-l2 rounded-lg p-4 border border-dc1-border/50 hover:border-dc1-amber/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-dc1-text-secondary mb-1">{g.gpu_model || t('marketplace.unknown')}</p>
                        <p className="text-2xl font-bold text-dc1-text-primary">{g.count}</p>
                        <p className="text-xs text-dc1-text-muted mt-1">{t('admin.providers_count')}</p>
                      </div>
                      <div className="w-12 h-12 bg-dc1-amber/10 rounded-lg flex items-center justify-center text-dc1-amber">
                        <BoltIcon />
                      </div>
                    </div>
                  </div>
                ))}
                {gpuBreakdown.length === 0 && <p className="text-dc1-text-muted text-sm col-span-3">{t('admin.no_gpu_data')}</p>}
              </div>
            </div>

            {/* Recent Signups */}
            <div className="card mb-8">
              <h2 className="section-heading mb-6">{t('admin.recent_signups')}</h2>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr><th>{t('table.name')}</th><th>{t('table.email')}</th><th>{t('table.gpu_model')}</th><th>{t('table.os')}</th><th>{t('table.joined')}</th></tr>
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
                    {recentSignups.length === 0 && <tr><td colSpan={5} className="text-dc1-text-muted text-sm">{t('admin.no_signups')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Heartbeats */}
            <div className="card">
              <h2 className="section-heading mb-6">{t('admin.recent_heartbeats')}</h2>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr><th>{t('table.provider')}</th><th>{t('table.gpu')}</th><th>{t('table.ip')}</th><th>{t('table.hostname')}</th><th>{t('table.last_seen')}</th></tr>
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
                    {recentHeartbeats.length === 0 && <tr><td colSpan={5} className="text-dc1-text-muted text-sm">{t('admin.no_heartbeats')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* Pricing Tab */}
      {activeTab === 'pricing' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-heading">{t('admin.pricing.title')}</h2>
            <button
              onClick={openAdd}
              className="btn-amber px-4 py-2 text-sm font-medium rounded-lg"
            >
              + {t('admin.pricing.addBtn')}
            </button>
          </div>

          {pricingError && <div className="mb-4 text-red-400 text-sm">{pricingError}</div>}

          {pricingLoading ? (
            <div className="text-dc1-text-secondary text-sm">{t('admin.loading')}</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th className={isRTL ? 'text-right' : ''}>{t('admin.pricing.modelLabel')}</th>
                    <th className={isRTL ? 'text-right' : ''}>{t('admin.pricing.rateLabel')}</th>
                    <th className={isRTL ? 'text-right' : ''}>{t('admin.pricing.lastUpdated')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pricingRates.map((rate) => (
                    <tr key={rate.gpu_model}>
                      <td className={`font-medium ${isRTL ? 'text-right' : ''}`}>{rate.gpu_model}</td>
                      <td className={`text-dc1-amber font-mono ${isRTL ? 'text-right' : ''}`}>
                        {(rate.rate_halala / 100).toFixed(2)} {t('common.sar')}
                      </td>
                      <td className={`text-sm text-dc1-text-secondary ${isRTL ? 'text-right' : ''}`}>
                        {formatTime(rate.updated_at)}
                      </td>
                      <td className={isRTL ? 'text-left' : 'text-right'}>
                        <button
                          onClick={() => openEdit(rate)}
                          className="px-3 py-1 text-xs font-medium bg-dc1-amber/10 text-dc1-amber rounded hover:bg-dc1-amber/20 transition-colors"
                        >
                          {t('admin.pricing.editBtn')}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pricingRates.length === 0 && (
                    <tr><td colSpan={4} className="text-dc1-text-muted text-sm">{t('admin.pricing.noRates')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* System Health Tab */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {metricsError && <div className="card border-red-500/50 text-red-400 text-sm">{metricsError}</div>}

          {metricsLoading && !metrics ? (
            <div className="text-dc1-text-secondary text-sm">{t('admin.loading')}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label={t('admin.health.queue_depth')}
                  value={String((metrics?.queue.pending_jobs || 0) + (metrics?.queue.running_jobs || 0))}
                  accent="amber"
                />
                <div className="bg-dc1-surface-l1 border rounded-lg p-5 transition-all duration-200 border-dc1-border hover:border-dc1-border-light">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-sm text-dc1-text-secondary">{t('admin.health.providers_online')}</p>
                    {(metrics?.providers.pending_approval || 0) > 0 && (
                      <span className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 border border-red-600/30">
                        {t('admin.health.pending_approval_alert')}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-status-success">{metrics?.providers.online || 0}</p>
                </div>
                <StatCard
                  label={t('admin.health.today_revenue')}
                  value={`${((metrics?.revenue.today_halala || 0) / 100).toFixed(2)} ${t('common.sar')}`}
                  accent="success"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="section-heading">{t('admin.health.queue_title')}</h2>
                    {(metrics?.queue.failed_last_1h || 0) > 5 && (
                      <span className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 border border-red-600/30">
                        {t('admin.health.failures_alert')}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-dc1-surface-l2 border border-dc1-border/60 rounded-lg p-3">
                      <p className="text-dc1-text-secondary">{t('admin.health.pending_jobs')}</p>
                      <p className="text-xl font-semibold text-dc1-text-primary">{metrics?.queue.pending_jobs || 0}</p>
                    </div>
                    <div className="bg-dc1-surface-l2 border border-dc1-border/60 rounded-lg p-3">
                      <p className="text-dc1-text-secondary">{t('admin.health.running_jobs')}</p>
                      <p className="text-xl font-semibold text-status-info">{metrics?.queue.running_jobs || 0}</p>
                    </div>
                    <div className="bg-dc1-surface-l2 border border-dc1-border/60 rounded-lg p-3">
                      <p className="text-dc1-text-secondary">{t('admin.health.failed_last_1h')}</p>
                      <p className={`text-xl font-semibold ${(metrics?.queue.failed_last_1h || 0) > 5 ? 'text-red-400' : 'text-dc1-text-primary'}`}>
                        {metrics?.queue.failed_last_1h || 0}
                      </p>
                    </div>
                    <div className="bg-dc1-surface-l2 border border-dc1-border/60 rounded-lg p-3">
                      <p className="text-dc1-text-secondary">{t('admin.health.avg_wait')}</p>
                      <p className="text-xl font-semibold text-dc1-amber">{formatDuration(metrics?.queue.avg_wait_seconds || 0)}</p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h2 className="section-heading mb-4">{t('admin.health.system_title')}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="bg-dc1-surface-l2 border border-dc1-border/60 rounded-lg p-3">
                      <p className="text-dc1-text-secondary">{t('admin.health.pending_approval')}</p>
                      <p className={`text-xl font-semibold ${(metrics?.providers.pending_approval || 0) > 0 ? 'text-red-400' : 'text-status-success'}`}>
                        {metrics?.providers.pending_approval || 0}
                      </p>
                    </div>
                    <div className="bg-dc1-surface-l2 border border-dc1-border/60 rounded-lg p-3">
                      <p className="text-dc1-text-secondary">{t('admin.health.avg_heartbeat_age')}</p>
                      <p className="text-xl font-semibold text-dc1-text-primary">{formatDuration(metrics?.providers.avg_heartbeat_age_seconds || 0)}</p>
                    </div>
                    <div className="bg-dc1-surface-l2 border border-dc1-border/60 rounded-lg p-3">
                      <p className="text-dc1-text-secondary">{t('admin.health.service_uptime')}</p>
                      <p className="text-xl font-semibold text-dc1-text-primary">{formatDuration(metrics?.system.uptime_seconds || 0)}</p>
                    </div>
                    <div className="bg-dc1-surface-l2 border border-dc1-border/60 rounded-lg p-3">
                      <p className="text-dc1-text-secondary">{t('admin.health.db_size')}</p>
                      <p className="text-xl font-semibold text-dc1-text-primary">{formatBytes(metrics?.system.db_size_bytes || 0)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-dc1-text-muted mt-4">
                    {t('admin.health.node_version')}: {metrics?.system.node_version || '—'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Edit / Add Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dc1-surface-l1 border border-dc1-border rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-dc1-text-primary mb-4">
              {modal.isNew ? t('admin.pricing.addTitle') : t('admin.pricing.editTitle')}
            </h3>

            {modal.isNew && (
              <div className="mb-4">
                <label className="block text-sm text-dc1-text-secondary mb-1">
                  {t('admin.pricing.modelLabel')}
                </label>
                <input
                  type="text"
                  value={modal.gpu_model}
                  onChange={e => setModal(m => ({ ...m, gpu_model: e.target.value }))}
                  placeholder={t('admin.pricing.modelPlaceholder')}
                  className="input w-full"
                  dir="ltr"
                />
              </div>
            )}

            {!modal.isNew && (
              <p className="text-sm text-dc1-text-secondary mb-4 font-medium">{modal.gpu_model}</p>
            )}

            <div className="mb-4">
              <label className="block text-sm text-dc1-text-secondary mb-1">
                {t('admin.pricing.rateLabel')}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={modal.rate_sar}
                onChange={e => setModal(m => ({ ...m, rate_sar: e.target.value }))}
                className="input w-full"
                dir="ltr"
                placeholder="0.00"
              />
              <p className="text-xs text-dc1-text-muted mt-1">{t('common.sar')}/hr</p>
            </div>

            {modal.error && <p className="text-red-400 text-sm mb-4">{modal.error}</p>}

            <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={saveRate}
                disabled={modal.saving}
                className="flex-1 px-4 py-2 text-sm font-medium bg-dc1-amber text-dc1-void rounded-lg hover:bg-dc1-amber/90 transition-colors disabled:opacity-60"
              >
                {modal.saving ? t('admin.pricing.saving') : t('admin.pricing.saveBtn')}
              </button>
              <button
                onClick={closeModal}
                disabled={modal.saving}
                className="flex-1 px-4 py-2 text-sm font-medium bg-dc1-surface-l2 text-dc1-text-secondary rounded-lg hover:bg-dc1-surface-l3 transition-colors"
              >
                {t('admin.pricing.cancelBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
