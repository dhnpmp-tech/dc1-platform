'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatusBadge from '../../components/ui/StatusBadge'
import { useLanguage } from '../../lib/i18n'

const API_BASE = '/api/dc1'
const PAGE_SIZE = 50

interface Job {
  id: number
  job_id: string
  job_type: string
  status: string
  submitted_at: string
  started_at?: string | null
  completed_at?: string | null
  actual_cost_halala: number
  cost_halala?: number
  actual_duration_minutes?: number | null
  duration_minutes?: number | null
  progress_phase?: string | null
  error?: string | null
  provider_name?: string | null
  provider_gpu?: string | null
  prompt_tokens?: number | null
  completion_tokens?: number | null
  tokens_used?: number | null
  params?: string | null
  container_spec?: string | null
  refunded?: boolean
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDuration(job: Job): string {
  if (job.actual_duration_minutes) {
    const mins = job.actual_duration_minutes
    if (mins < 1) return `${Math.round(mins * 60)}s`
    return `${mins.toFixed(1)}m`
  }
  if (job.completed_at && job.submitted_at) {
    const secs = Math.round(
      (new Date(job.completed_at).getTime() - new Date(job.submitted_at).getTime()) / 1000
    )
    if (secs < 60) return `${secs}s`
    return `${(secs / 60).toFixed(1)}m`
  }
  return '—'
}

function formatTokens(job: Job): string {
  const total = (job.tokens_used ?? 0) || ((job.prompt_tokens ?? 0) + (job.completion_tokens ?? 0))
  if (!total) return '—'
  if (total >= 1000) return `${(total / 1000).toFixed(1)}K`
  return String(total)
}

function formatCost(job: Job): string {
  const halala = job.actual_cost_halala || job.cost_halala || 0
  if (!halala) return '—'
  return `${(halala / 100).toFixed(2)} SAR`
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getModelLabel(job: Job): string {
  if (job.params) {
    try {
      const p = JSON.parse(job.params)
      if (p.model) return String(p.model)
    } catch { /* ok */ }
  }
  return (job.job_type || '').replace(/_/g, ' ')
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyJobs() {
  return (
    <tr>
      <td colSpan={8}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">⚡</div>
          <h3 className="text-lg font-bold text-dc1-text-primary mb-2">No jobs yet</h3>
          <p className="text-dc1-text-secondary text-sm mb-6 max-w-xs">
            You haven't run any compute jobs. Browse the model catalog and deploy your first model.
          </p>
          <Link href="/renter/models" className="btn btn-primary">
            Browse Models →
          </Link>
        </div>
      </td>
    </tr>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RenterJobsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalSpentSar, setTotalSpentSar] = useState(0)
  const [balanceSar, setBalanceSar] = useState<number | null>(null)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [retryJobId, setRetryJobId] = useState<string | null>(null)
  const [retryLoading, setRetryLoading] = useState(false)
  const [retryError, setRetryError] = useState('')

  const navItems = [
    { label: t('nav.dashboard'), href: '/renter', icon: <HomeIcon /> },
    { label: t('nav.marketplace'), href: '/renter/marketplace', icon: <MarketplaceIcon /> },
    { label: 'Models', href: '/renter/models', icon: <PlaygroundIcon /> },
    { label: t('nav.jobs'), href: '/renter/jobs', icon: <JobsIcon /> },
    { label: t('nav.billing'), href: '/renter/billing', icon: <BillingIcon /> },
    { label: t('nav.analytics'), href: '/renter/analytics', icon: <ChartIcon /> },
    { label: t('nav.settings'), href: '/renter/settings', icon: <GearIcon /> },
  ]

  const fetchJobs = useCallback(async (apiKey: string, offset = 0, append = false) => {
    try {
      const res = await fetch(`${API_BASE}/jobs/history?limit=${PAGE_SIZE}`, {
        headers: { 'x-renter-key': apiKey },
      })
      if (res.status === 401) {
        localStorage.removeItem('dc1_renter_key')
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      const fetched: Job[] = data.jobs || []

      if (append) {
        setJobs(prev => [...prev, ...fetched])
      } else {
        setJobs(fetched)
        // Compute cumulative spend from all returned jobs
        const spent = fetched.reduce((sum: number, j: Job) => sum + ((j.actual_cost_halala || j.cost_halala || 0) / 100), 0)
        setTotalSpentSar(spent)
        if (data.balance_sar !== undefined) setBalanceSar(parseFloat(data.balance_sar))
      }
      // If we got a full page, there may be more
      setHasMore(fetched.length === PAGE_SIZE)
    } catch (err) {
      console.error('Failed to load jobs:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [router])

  useEffect(() => {
    const apiKey = localStorage.getItem('dc1_renter_key')
    if (!apiKey) {
      router.push('/login')
      return
    }
    fetchJobs(apiKey)
    const interval = setInterval(() => fetchJobs(apiKey), 30000)
    return () => clearInterval(interval)
  }, [router, fetchJobs])

  const loadMore = () => {
    const apiKey = localStorage.getItem('dc1_renter_key') || ''
    setLoadingMore(true)
    fetchJobs(apiKey, jobs.length, true)
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

  const retryJob = async (job: Job) => {
    const apiKey = localStorage.getItem('dc1_renter_key') || ''
    setRetryJobId(job.job_id || String(job.id))
    setRetryLoading(true)
    setRetryError('')
    try {
      const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(String(job.id))}/retry?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'x-renter-key': apiKey },
      })
      if (res.status === 402) {
        setRetryError('Insufficient balance. Please top up.')
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setRetryError(err.error || 'Retry failed')
        return
      }
      const data = await res.json()
      const newId = data.job?.id || data.id || null
      setRetryJobId(null)
      setRetryError('')
      if (newId) {
        router.push(`/renter/jobs/${newId}`)
        return
      }
      fetchJobs(apiKey)
    } catch {
      setRetryError('Network error. Please try again.')
    } finally {
      setRetryLoading(false)
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

  return (
    <DashboardLayout navItems={navItems} role="renter">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-dc1-text-primary">{t('nav.jobs')}</h1>
            <p className="text-dc1-text-secondary text-sm mt-1">
              {jobs.length} job{jobs.length !== 1 ? 's' : ''} loaded — auto-refreshes every 30s
            </p>
          </div>
          <button
            onClick={exportCsv}
            disabled={exportingCsv || jobs.length === 0}
            className="btn btn-secondary min-h-[44px] px-4 flex items-center gap-2 self-start disabled:opacity-50"
            aria-label="Export job history as CSV"
          >
            {exportingCsv ? (
              <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <p className="text-sm text-dc1-text-secondary">Failed</p>
            <p className="text-2xl font-bold text-status-error">{failedJobs}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-dc1-text-secondary">{t('dashboard.total_spent')}</p>
            <p className="text-2xl font-bold text-dc1-amber">{totalSpentSar.toFixed(2)} {t('common.sar')}</p>
            {balanceSar !== null && (
              <p className="text-xs text-dc1-text-muted mt-1">Balance: {balanceSar.toFixed(2)} SAR</p>
            )}
          </div>
        </div>

        {/* Retry error banner */}
        {retryError && (
          <div className="bg-status-error/10 border border-status-error/30 rounded-lg px-4 py-3 text-sm text-status-error flex items-center justify-between">
            <span>{retryError}</span>
            <button onClick={() => setRetryError('')} className="ml-4 text-status-error/70 hover:text-status-error">✕</button>
          </div>
        )}

        {/* Jobs Table */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{t('table.job_id')}</th>
                <th>Model / Template</th>
                <th>GPU</th>
                <th>{t('billing.submitted')}</th>
                <th>Duration</th>
                <th>Tokens</th>
                <th>{t('table.status')}</th>
                <th>{t('table.cost')}</th>
                <th className="sr-only">{t('table.action')}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length > 0 ? (
                jobs.map(j => {
                  const isRetrying = retryLoading && retryJobId === (j.job_id || String(j.id))
                  return (
                    <tr key={j.id}>
                      {/* Job ID */}
                      <td className="font-mono text-sm">
                        <Link href={`/renter/jobs/${j.id}`} className="text-dc1-amber hover:underline">
                          {(j.job_id || `#${j.id}`).slice(0, 16)}
                        </Link>
                        {j.refunded && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-status-info/10 text-status-info border border-status-info/20">
                            refunded
                          </span>
                        )}
                      </td>

                      {/* Model / Template */}
                      <td className="text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{getModelLabel(j)}</span>
                          {j.container_spec && (() => {
                            try {
                              const spec = JSON.parse(j.container_spec)
                              if (spec.image_type) return (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-dc1-amber/10 text-dc1-amber border border-dc1-amber/20 w-fit font-mono">
                                  {spec.image_type}
                                </span>
                              )
                            } catch { /* skip */ }
                            return null
                          })()}
                        </div>
                      </td>

                      {/* GPU */}
                      <td className="text-sm text-dc1-text-secondary">
                        {j.provider_gpu
                          ? <span className="font-mono text-xs bg-dc1-surface-l2 px-1.5 py-0.5 rounded border border-dc1-border">{j.provider_gpu}</span>
                          : '—'
                        }
                      </td>

                      {/* Submitted */}
                      <td className="text-sm text-dc1-text-secondary whitespace-nowrap">
                        {formatDate(j.submitted_at)}
                      </td>

                      {/* Duration */}
                      <td className="text-sm text-dc1-text-secondary">
                        {formatDuration(j)}
                      </td>

                      {/* Tokens */}
                      <td className="text-sm text-dc1-text-secondary">
                        {formatTokens(j)}
                      </td>

                      {/* Status */}
                      <td><StatusBadge status={j.status as Parameters<typeof StatusBadge>[0]['status']} /></td>

                      {/* Cost */}
                      <td className="text-dc1-amber font-semibold">
                        {formatCost(j)}
                      </td>

                      {/* Actions */}
                      <td>
                        {j.status === 'failed' && (
                          <button
                            onClick={() => retryJob(j)}
                            disabled={isRetrying}
                            className="text-dc1-amber border border-dc1-amber/40 hover:bg-dc1-amber/10 rounded p-1.5 min-h-[32px] min-w-[32px] transition-colors inline-flex items-center justify-center disabled:opacity-50"
                            aria-label={`Retry job ${j.job_id || j.id}`}
                            title="Retry Job"
                          >
                            {isRetrying ? (
                              <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5.64 18.36A9 9 0 103.5 12" />
                              </svg>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <EmptyJobs />
              )}
            </tbody>
          </table>
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="btn btn-secondary min-h-[44px] px-8 flex items-center gap-2"
            >
              {loadingMore ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Loading…
                </>
              ) : (
                'Load more jobs'
              )}
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
