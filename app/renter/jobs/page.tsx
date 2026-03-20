'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatusBadge from '../../components/ui/StatusBadge'
import { useLanguage } from '../../lib/i18n'

const API_BASE = '/api/dc1'

interface Job {
  id: number
  job_id: string
  job_type: string
  status: string
  submitted_at: string
  completed_at: string
  actual_cost_halala: number
  params?: string | null
  container_spec?: string | null
}

const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 11l4-4m0 0l4 4m-4-4V5" />
  </svg>
)
const MarketplaceIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
)
const JobsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)
const BillingIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m4 0h1M9 19h6a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)
const PlaygroundIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)
const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

interface RetryState {
  job: Job | null
  loading: boolean
  error: string
  requiredHalala: number | null
}

interface SaveTplState {
  job: Job | null
  name: string
  saving: boolean
  saved: boolean
}

export default function RenterJobsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [renterName, setRenterName] = useState('Renter')
  const [totalSpent, setTotalSpent] = useState(0)
  const [retry, setRetry] = useState<RetryState>({ job: null, loading: false, error: '', requiredHalala: null })
  const [exportingCsv, setExportingCsv] = useState(false)
  const [saveTpl, setSaveTpl] = useState<SaveTplState>({ job: null, name: '', saving: false, saved: false })

  const navItems = [
    { label: t('nav.dashboard'), href: '/renter', icon: <HomeIcon /> },
    { label: t('nav.marketplace'), href: '/renter/marketplace', icon: <MarketplaceIcon /> },
    { label: t('nav.playground'), href: '/renter/playground', icon: <PlaygroundIcon /> },
    { label: t('nav.jobs'), href: '/renter/jobs', icon: <JobsIcon /> },
    { label: t('nav.billing'), href: '/renter/billing', icon: <BillingIcon /> },
    { label: t('nav.analytics'), href: '/renter/analytics', icon: <ChartIcon /> },
    { label: t('nav.settings'), href: '/renter/settings', icon: <GearIcon /> },
  ]

  const fetchJobs = async (apiKey: string) => {
    try {
      const res = await fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(apiKey)}`)
      if (!res.ok) {
        localStorage.removeItem('dc1_renter_key')
        router.push('/login')
        return
      }
      const data = await res.json()
      setRenterName(data.renter?.name || 'Renter')
      setTotalSpent((data.renter?.total_spent_halala || 0) / 100)
      setJobs(data.recent_jobs || [])
    } catch (err) {
      console.error('Failed to load jobs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const apiKey = localStorage.getItem('dc1_renter_key')
    if (!apiKey) {
      router.push('/login')
      return
    }
    fetchJobs(apiKey)
    const interval = setInterval(() => fetchJobs(apiKey), 30000)
    return () => clearInterval(interval)
  }, [router])

  const openRetryModal = (job: Job) => {
    setRetry({ job, loading: false, error: '', requiredHalala: Number(job.actual_cost_halala || 0) })
  }

  const confirmRetry = async () => {
    const apiKey = localStorage.getItem('dc1_renter_key') || ''
    const { job } = retry
    if (!job) return

    setRetry(r => ({ ...r, loading: true, error: '' }))

    try {
      const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(String(job.id))}/retry?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'x-renter-key': apiKey },
      })
      if (res.status === 402) {
        const err = await res.json().catch(() => ({}))
        setRetry(r => ({
          ...r,
          loading: false,
          error: 'insufficient_balance',
          requiredHalala: Number(err.required_halala || r.requiredHalala || 0),
        }))
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setRetry(r => ({ ...r, loading: false, error: err.error || 'Failed to re-submit job' }))
        return
      }
      const data = await res.json()
      const newId = data.job?.id || data.id || null
      setRetry({ job: null, loading: false, error: '', requiredHalala: null })
      if (newId) {
        router.push(`/renter/jobs/${newId}`)
        return
      }
      fetchJobs(apiKey)
    } catch {
      setRetry(r => ({ ...r, loading: false, error: 'Network error. Please try again.' }))
    }
  }

  const exportCsv = async () => {
    const apiKey = localStorage.getItem('dc1_renter_key')
    if (!apiKey || exportingCsv) return
    setExportingCsv(true)
    try {
      const res = await fetch(`${API_BASE}/renters/me/jobs/export?key=${encodeURIComponent(apiKey)}&format=csv`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dcp-jobs-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('CSV export failed:', err)
    } finally {
      setExportingCsv(false)
    }
  }

  const openSaveTemplateModal = (job: Job) => {
    setSaveTpl({ job, name: '', saving: false, saved: false })
  }

  const confirmSaveTemplate = async () => {
    const apiKey = localStorage.getItem('dc1_renter_key') || ''
    const { job, name } = saveTpl
    if (!job || !name.trim()) return
    setSaveTpl(s => ({ ...s, saving: true }))
    let parsedParams: Record<string, unknown> = {}
    try { if (job.params) parsedParams = JSON.parse(job.params) } catch { /* ok */ }
    try {
      const res = await fetch(`${API_BASE}/renters/me/templates?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          job_type: job.job_type,
          model: parsedParams.model || job.job_type,
          resource_spec_json: JSON.stringify(parsedParams),
        }),
      })
      if (res.ok) {
        setSaveTpl(s => ({ ...s, saving: false, saved: true }))
        setTimeout(() => setSaveTpl({ job: null, name: '', saving: false, saved: false }), 2000)
      } else {
        setSaveTpl(s => ({ ...s, saving: false }))
      }
    } catch {
      setSaveTpl(s => ({ ...s, saving: false }))
    }
  }

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} role="renter" userName="Renter">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    )
  }

  const completedJobs = jobs.filter(j => j.status === 'completed').length
  const failedJobs = jobs.filter(j => j.status === 'failed').length
  const retryHoldSar = ((retry.requiredHalala || 0) / 100).toFixed(2)

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renterName}>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-dc1-text-primary">{t('nav.jobs')}</h1>
            <p className="text-dc1-text-secondary text-sm mt-1">
              {jobs.length} {jobs.length !== 1 ? t('dashboard.jobs_run') : t('dashboard.jobs_run')} — auto-refreshes every 30s
            </p>
          </div>
          <button
            onClick={exportCsv}
            disabled={exportingCsv || jobs.length === 0}
            className="btn btn-secondary min-h-[44px] px-4 flex items-center gap-2 self-start disabled:opacity-50"
            aria-label="Export job history as CSV"
          >
            {exportingCsv ? (
              <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" aria-hidden="true" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {t('renter.export_csv')}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-sm text-dc1-text-secondary">{t('dashboard.jobs_run')}</p>
            <p className="text-2xl font-bold text-dc1-text-primary">{jobs.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-dc1-text-secondary">{t('table.completed')}</p>
            <p className="text-2xl font-bold text-status-success">{completedJobs}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-dc1-text-secondary">{t('table.status')}</p>
            <p className="text-2xl font-bold text-status-error">{failedJobs}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-dc1-text-secondary">{t('dashboard.total_spent')}</p>
            <p className="text-2xl font-bold text-dc1-amber">{totalSpent.toFixed(2)} {t('common.sar')}</p>
          </div>
        </div>

        {/* Jobs Table */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{t('table.job_id')}</th>
                <th>{t('table.type')}</th>
                <th>{t('billing.submitted')}</th>
                <th>{t('table.completed')}</th>
                <th>{t('table.status')}</th>
                <th>{t('table.cost')}</th>
                <th className="sr-only">{t('table.action')}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length > 0 ? (
                jobs.map(j => {
                  const duration = j.completed_at && j.submitted_at
                    ? Math.round((new Date(j.completed_at).getTime() - new Date(j.submitted_at).getTime()) / 1000)
                    : 0
                  return (
                    <tr key={j.id}>
                      <td className="font-mono text-sm">
                        <Link href={`/renter/jobs/${j.id}`} className="text-dc1-amber hover:underline">
                          {(j.job_id || `#${j.id}`).slice(0, 16)}
                        </Link>
                      </td>
                      <td className="text-sm">
                        <div className="flex flex-col gap-1">
                          <span>{(j.job_type || '').replace(/_/g, ' ')}</span>
                          {j.container_spec && (() => {
                            try {
                              const spec = JSON.parse(j.container_spec)
                              if (spec.image_type) return (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-dc1-amber/15 text-dc1-amber border border-dc1-amber/25 w-fit font-mono">
                                  {spec.image_type}
                                </span>
                              )
                            } catch { /* skip */ }
                            return null
                          })()}
                        </div>
                      </td>
                      <td className="text-sm text-dc1-text-secondary">
                        {j.submitted_at
                          ? new Date(j.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="text-sm text-dc1-text-secondary">
                        {j.completed_at
                          ? `${duration}s`
                          : '—'}
                      </td>
                      <td><StatusBadge status={j.status as any} /></td>
                      <td className="text-dc1-amber font-semibold">
                        {j.actual_cost_halala
                          ? `${(j.actual_cost_halala / 100).toFixed(2)} SAR`
                          : '—'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {j.status === 'failed' && (
                            <button
                              onClick={() => openRetryModal(j)}
                              className="text-dc1-amber border border-dc1-amber/40 hover:bg-dc1-amber/10 rounded p-1.5 min-h-[32px] min-w-[32px] transition-colors inline-flex items-center justify-center"
                              aria-label={`Retry job ${j.job_id || j.id}`}
                              title="Retry Job"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5.64 18.36A9 9 0 103.5 12" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => openSaveTemplateModal(j)}
                            className="text-xs text-dc1-text-muted border border-white/10 hover:border-dc1-amber/40 hover:text-dc1-amber rounded px-2 py-1 min-h-[32px] transition-colors"
                            aria-label={`Save job ${j.job_id || j.id} as template`}
                            title="Save as Template"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-dc1-text-secondary">
                    {t('common.no_jobs_yet')}.{' '}
                    <a href="/renter/playground" className="text-dc1-amber hover:underline">{t('renter.open_playground')}</a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retry Confirmation Modal */}
      {retry.job && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="retry-modal-title"
        >
          <div className="card w-full max-w-md p-6 space-y-5">
            <h2 id="retry-modal-title" className="text-lg font-bold text-dc1-text-primary">
              {t('renter.retry_job')}
            </h2>
            <p className="text-dc1-text-secondary text-sm">
              {t('renter.retry_confirm').replace('{amount}', retryHoldSar)}
            </p>
            <div className="bg-dc1-surface-l2 rounded-lg px-4 py-3 text-sm font-mono text-dc1-text-secondary">
              <span className="text-dc1-text-muted">Type: </span>{(retry.job.job_type || '').replace(/_/g, ' ')}
              <br />
              <span className="text-dc1-text-muted">Original ID: </span>{retry.job.job_id || `#${retry.job.id}`}
            </div>

            {retry.error === 'insufficient_balance' ? (
              <div className="bg-status-error/10 border border-status-error/30 rounded-lg px-4 py-3 text-sm text-status-error">
                Insufficient balance. Please{' '}
                <Link href="/renter/billing" className="underline font-semibold">top up your balance</Link>{' '}
                first.
              </div>
            ) : retry.error ? (
              <div className="bg-status-error/10 border border-status-error/30 rounded-lg px-4 py-3 text-sm text-status-error">
                {retry.error}
              </div>
            ) : null}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRetry({ job: null, loading: false, error: '', requiredHalala: null })}
                disabled={retry.loading}
                className="btn btn-secondary min-h-[44px] px-4"
              >
                {t('common.retry')}
              </button>
              <button
                onClick={confirmRetry}
                disabled={retry.loading}
                className="btn btn-primary min-h-[44px] px-5 flex items-center gap-2"
              >
                {retry.loading && (
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                )}
                {retry.loading ? t('common.loading') : t('renter.retry_job')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {saveTpl.job && !saveTpl.saved && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-tpl-modal-title"
        >
          <div className="card w-full max-w-sm p-6 space-y-4">
            <h2 id="save-tpl-modal-title" className="text-lg font-bold text-dc1-text-primary">{t('renter.save_template')}</h2>
            <p className="text-dc1-text-secondary text-sm">{t('renter.template_name')}</p>
            <div className="bg-dc1-surface-l2 rounded-lg px-4 py-3 text-sm font-mono text-dc1-text-secondary">
              <span className="text-dc1-text-muted">Type: </span>{(saveTpl.job.job_type || '').replace(/_/g, ' ')}
            </div>
            <input
              type="text"
              placeholder="e.g. Arabic Summariser"
              className="w-full bg-dc1-surface-l2 border border-white/10 rounded-lg px-4 py-3 text-dc1-text-primary placeholder-dc1-text-muted focus:outline-none focus:border-dc1-amber/60 transition text-sm"
              value={saveTpl.name}
              onChange={e => setSaveTpl(s => ({ ...s, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') confirmSaveTemplate() }}
              autoFocus
              maxLength={120}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSaveTpl({ job: null, name: '', saving: false, saved: false })}
                disabled={saveTpl.saving}
                className="btn btn-secondary min-h-[44px] px-4"
              >
                {t('common.retry')}
              </button>
              <button
                onClick={confirmSaveTemplate}
                disabled={saveTpl.saving || !saveTpl.name.trim()}
                className="btn btn-primary min-h-[44px] px-5 flex items-center gap-2"
              >
                {saveTpl.saving && <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
                {saveTpl.saving ? t('common.loading') : t('renter.save_template')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Success Toast */}
      {saveTpl.saved && (
        <div className="fixed bottom-6 right-6 z-50 bg-status-success/10 border border-status-success/30 rounded-lg px-4 py-3 flex items-center gap-2 text-status-success text-sm font-medium shadow-lg">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {t('renter.retry_success')}
        </div>
      )}
    </DashboardLayout>
  )
}
