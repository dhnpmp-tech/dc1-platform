'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatCard from '../../components/ui/StatCard'
import { useLanguage } from '../../lib/i18n'

const API_BASE = '/api/dc1'

// ── Types ──────────────────────────────────────────────────────────

interface Renter {
  name: string
  email: string
  balance_halala: number
  api_key: string
  total_spent_halala?: number
  total_jobs?: number
}

interface Invoice {
  id: number
  job_id?: string | null
  invoice_at?: string | null
  created_at: string
  job_type: string
  provider_name?: string | null
  gpu_model?: string | null
  duration_minutes: number
  amount_halala: number
  amount_sar?: number
  status: string
}

interface Pagination {
  page: number
  limit: number
  total: number
}

interface RecentJob {
  id: number
  job_id?: string
  job_type: string
  status: string
  actual_cost_halala?: number
  submitted_at?: string
  completed_at?: string
}

// ── Icons ──────────────────────────────────────────────────────────

const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 11l4-4m0 0l4 4m-4-4V5" />
  </svg>
)
const MarketplaceIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
)
const PlaygroundIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)
const JobsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)
const BillingIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const AnalyticsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)
const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)


// ── Helpers ────────────────────────────────────────────────────────

function halalaToCurrency(halala: number): string {
  return (halala / 100).toFixed(2)
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function formatJobType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Loading Skeleton ───────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3" role="status" aria-label="Loading billing data">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-20 bg-dc1-surface-l2 rounded-lg" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 bg-dc1-surface-l2 rounded-md" />
      ))}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────

export default function BillingPage() {
  const { t } = useLanguage()

  const navItems = [
    { label: t('nav.dashboard'), href: '/renter', icon: <HomeIcon /> },
    { label: t('nav.marketplace'), href: '/renter/marketplace', icon: <MarketplaceIcon /> },
    { label: t('nav.playground'), href: '/renter/playground', icon: <PlaygroundIcon /> },
    { label: t('nav.jobs'), href: '/renter/jobs', icon: <JobsIcon /> },
    { label: t('nav.billing'), href: '/renter/billing', icon: <BillingIcon /> },
    { label: t('nav.analytics'), href: '/renter/analytics', icon: <AnalyticsIcon /> },
    { label: t('nav.settings'), href: '/renter/settings', icon: <SettingsIcon /> },
  ]
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [renter, setRenter] = useState<Renter | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0 })
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [rotateConfirm, setRotateConfirm] = useState(false)
  const [showTopupModal, setShowTopupModal] = useState(false)
  const [topupAmount, setTopupAmount] = useState('')
  const [topupMethod, setTopupMethod] = useState<'mada' | 'creditcard' | 'applepay'>('mada')
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupError, setTopupError] = useState('')

  // Read API key from localStorage on mount
  useEffect(() => {
    const key = typeof window !== 'undefined' ? localStorage.getItem('dc1_renter_key') : null
    setApiKey(key)
  }, [])

  useEffect(() => {
    if (apiKey === null) return
    if (!apiKey) {
      setLoading(false)
      return
    }

    async function fetchData() {
      try {
        const [profileRes, invRes] = await Promise.all([
          fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(apiKey!)}`),
          fetch(`${API_BASE}/renters/me/invoices?key=${encodeURIComponent(apiKey!)}&page=${pagination.page}&limit=${pagination.limit}`).catch(() => null),
        ])

        if (profileRes.ok) {
          const data = await profileRes.json()
          setRenter(data.renter ?? null)
          setRecentJobs(data.recent_jobs ?? [])
        }

        if (invRes && invRes.ok) {
          const invData = await invRes.json()
          setInvoices(invData.invoices ?? [])
          setPagination((prev) => ({
            ...prev,
            page: Number(invData?.pagination?.page || prev.page),
            limit: Number(invData?.pagination?.limit || prev.limit),
            total: Number(invData?.pagination?.total || 0),
          }))
        }
      } catch (err) {
        console.error('Billing fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [apiKey, pagination.page, pagination.limit])

  const copyApiKey = () => {
    if (!apiKey) return
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRotateKey = async () => {
    if (!apiKey) return
    setRotating(true)
    try {
      const res = await fetch(`${API_BASE}/renters/rotate-key`, {
        method: 'POST',
        headers: { 'x-renter-key': apiKey },
      })
      if (!res.ok) throw new Error('Failed to rotate key')
      const data = await res.json()
      const newKey = data.api_key
      localStorage.setItem('dc1_renter_key', newKey)
      setApiKey(newKey)
      setShowKey(true)
      setRotateConfirm(false)
    } catch {
      alert('Failed to rotate API key. Please try again.')
    } finally {
      setRotating(false)
    }
  }

  const handleTopup = async () => {
    if (!apiKey) return
    const amountSar = parseFloat(topupAmount)
    if (!amountSar || amountSar < 10 || amountSar > 1000) return
    setTopupLoading(true)
    setTopupError('')
    try {
      const amountHalala = Math.round(amountSar * 100)
      const res = await fetch(`${API_BASE}/payments/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-renter-key': apiKey },
        body: JSON.stringify({ amount_halala: amountHalala, payment_method: topupMethod }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setTopupError((err as { error?: string }).error || 'Top-up failed. Please try again.')
        return
      }
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        setTopupError('No checkout URL returned. Please try again.')
      }
    } catch {
      setTopupError('Top-up failed. Please try again.')
    } finally {
      setTopupLoading(false)
    }
  }

  const handleDownloadInvoiceCsv = (invoiceId: number) => {
    if (!apiKey) return
    const href = `${API_BASE}/renters/me/invoices/${invoiceId}/csv?key=${encodeURIComponent(apiKey)}`
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const handleDownloadAllCsv = () => {
    if (!apiKey) return
    const href = `${API_BASE}/renters/me/invoices/export.csv?key=${encodeURIComponent(apiKey)}`
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  // Compute summary stats for this month's invoices
  const now = new Date()
  const thisMonthInvoices = invoices.filter(inv => {
    const d = new Date(inv.created_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const invoiceTotalHalala = thisMonthInvoices.reduce((sum, inv) => sum + (inv.amount_halala ?? 0), 0)

  // ── No-account state ──
  if (!loading && apiKey !== null && !apiKey) {
    return (
      <DashboardLayout navItems={navItems} role="renter" userName="Renter">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-dc1-amber/10 flex items-center justify-center mb-5 text-dc1-amber">
            <BillingIcon />
          </div>
          <p className="text-dc1-text-secondary text-lg mb-2">{t('billing.no_account')}</p>
          <Link href="/login" className="btn btn-primary mt-4">
            {t('billing.go_to_login')}
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  // ── Loading state ──
  if (loading) {
    return (
      <DashboardLayout navItems={navItems} role="renter" userName="">
        <div className="mb-6">
          <div className="h-8 w-48 bg-dc1-surface-l2 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-dc1-surface-l2 rounded animate-pulse" />
        </div>
        <TableSkeleton />
      </DashboardLayout>
    )
  }

  const balance = (renter?.balance_halala ?? 0) / 100
  const totalSpent = (renter?.total_spent_halala ?? 0) / 100
  const totalJobs = renter?.total_jobs ?? 0
  const renterName = renter?.name || 'Renter'

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renterName}>
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-dc1-text-primary mb-1">{t('billing.title')}</h1>
          <p className="text-dc1-text-secondary">{t('billing.subtitle')}</p>
        </div>
        <div className="text-xs text-dc1-text-muted">
          {pagination.total > 0 ? `${pagination.total} invoices` : 'No invoices yet'}
        </div>
      </div>

      {/* ── Balance Card + Stats ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Balance card with Top Up CTA */}
        <div className="card p-5 flex flex-col justify-between border border-dc1-amber/20 bg-dc1-amber/5">
          <div>
            <p className="text-xs text-dc1-text-muted uppercase tracking-wide mb-1">{t('billing.balance')}</p>
            <p className="text-3xl font-bold text-dc1-amber">{balance.toFixed(2)} <span className="text-lg font-normal">{t('common.sar')}</span></p>
          </div>
          <button
            onClick={() => { setShowTopupModal(true); setTopupError(''); setTopupAmount(''); setTopupMethod('mada') }}
            className="btn btn-primary mt-4 w-full"
          >
            {t('billing.add_funds')}
          </button>
        </div>
        <StatCard label={t('billing.total_spent')} value={`${invoices.length > 0 ? halalaToCurrency(invoiceTotalHalala) : totalSpent.toFixed(2)} ${t('common.sar')}`} accent="default" />
        <StatCard label={t('billing.total_jobs')} value={String(invoices.length > 0 ? thisMonthInvoices.length : totalJobs)} accent="info" />
      </div>

      {/* ── Compute Rates ────────────────────────────────────────── */}
      <div className="card mb-8">
        <h2 className="section-heading mb-4">{t('billing.compute_rates')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-dc1-surface-l2 rounded-lg p-4 border border-dc1-border/50">
            <p className="text-sm text-dc1-text-secondary mb-1">{t('billing.llm_rate')}</p>
            <p className="text-xl font-bold text-dc1-amber">15 {t('billing.halala_per_min')}</p>
            <p className="text-xs text-dc1-text-muted mt-1">0.15 {t('common.sar')} {t('common.min')}</p>
          </div>
          <div className="bg-dc1-surface-l2 rounded-lg p-4 border border-dc1-border/50">
            <p className="text-sm text-dc1-text-secondary mb-1">{t('billing.img_rate')}</p>
            <p className="text-xl font-bold text-dc1-amber">20 {t('billing.halala_per_min')}</p>
            <p className="text-xs text-dc1-text-muted mt-1">0.20 {t('common.sar')} {t('common.min')}</p>
          </div>
        </div>
      </div>

      {/* ── Invoice History ──────────────────────────────────────── */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-heading">{t('billing.title')}</h2>
          {invoices.length > 0 && (
            <button
              onClick={handleDownloadAllCsv}
              className="btn btn-outline btn-sm inline-flex items-center gap-1.5"
            >
              <DownloadIcon />
              {t('billing.download_csv')}
            </button>
          )}
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-dc1-text-secondary mb-3">{t('billing.empty')}</p>
            <Link href="/renter/marketplace" className="btn btn-primary text-sm">
              {t('billing.go_to_marketplace')}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-dc1-border text-dc1-text-muted text-xs uppercase tracking-wide">
                  <th className="text-start pb-3 pr-4 font-medium">{t('billing.date')}</th>
                  <th className="text-start pb-3 pr-4 font-medium">{t('table.job_id')}</th>
                  <th className="text-start pb-3 pr-4 font-medium">{t('billing.job_type')}</th>
                  <th className="text-start pb-3 pr-4 font-medium">{t('billing.provider')}</th>
                  <th className="text-start pb-3 pr-4 font-medium">{t('table.status')}</th>
                  <th className="text-end pb-3 pr-4 font-medium">{t('billing.duration')}</th>
                  <th className="text-end pb-3 font-medium">{t('billing.cost')}</th>
                  <th className="text-end pb-3 font-medium">{t('billing.download_csv')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dc1-border/50">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-dc1-surface-l2/50 transition-colors">
                    <td className="py-3 pr-4 text-dc1-text-secondary whitespace-nowrap">
                      <div>{formatDate(inv.invoice_at || inv.created_at)}</div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-dc1-amber whitespace-nowrap">
                      {inv.job_id || '—'}
                    </td>
                    <td className="py-3 pr-4 text-dc1-text-primary font-medium">
                      {formatJobType(inv.job_type)}
                    </td>
                    <td className="py-3 pr-4 text-dc1-text-secondary">
                      {inv.provider_name || inv.gpu_model || '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        inv.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        inv.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                        inv.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-dc1-text-secondary text-end whitespace-nowrap">
                      {inv.duration_minutes} min
                    </td>
                    <td className="py-3 text-dc1-amber font-semibold text-end whitespace-nowrap">
                      {halalaToCurrency(inv.amount_halala)} SAR
                    </td>
                    <td className="py-3 text-end">
                      <button
                        onClick={() => handleDownloadInvoiceCsv(inv.id)}
                        className="btn btn-outline btn-sm inline-flex items-center gap-1"
                        aria-label={`Download invoice ${inv.id} CSV`}
                      >
                        <DownloadIcon />
                        CSV
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination.total > pagination.limit && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page <= 1}
              className="btn btn-outline btn-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-dc1-text-muted">
              Page {pagination.page} of {Math.max(1, Math.ceil(pagination.total / pagination.limit))}
            </span>
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
              className="btn btn-outline btn-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── Recent Jobs (fallback if no invoices endpoint yet) ───── */}
      {invoices.length === 0 && recentJobs.length > 0 && (
        <div className="card mb-8">
          <h2 className="section-heading mb-4">{t('billing.recent_jobs')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-dc1-border text-dc1-text-muted text-xs uppercase tracking-wide">
                  <th className="text-start pb-3 pr-4 font-medium">{t('table.job_id')}</th>
                  <th className="text-start pb-3 pr-4 font-medium">{t('table.type')}</th>
                  <th className="text-start pb-3 pr-4 font-medium">{t('table.status')}</th>
                  <th className="text-end pb-3 pr-4 font-medium">{t('table.cost')}</th>
                  <th className="text-end pb-3 font-medium">{t('billing.submitted')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dc1-border/50">
                {recentJobs.map(job => (
                  <tr key={job.id} className="hover:bg-dc1-surface-l2/50 transition-colors">
                    <td className="py-3 pr-4 font-mono text-sm text-dc1-amber">
                      {job.job_id || `#${job.id}`}
                    </td>
                    <td className="py-3 pr-4 text-dc1-text-secondary">
                      {formatJobType(job.job_type)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        job.status === 'running'   ? 'bg-blue-500/20 text-blue-400' :
                        job.status === 'failed'    ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-dc1-amber font-semibold text-end whitespace-nowrap">
                      {job.actual_cost_halala ? `${halalaToCurrency(job.actual_cost_halala)} SAR` : '—'}
                    </td>
                    <td className="py-3 text-dc1-text-secondary text-end whitespace-nowrap">
                      {job.submitted_at ? formatDate(job.submitted_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── API Key Management ───────────────────────────────────── */}
      <div className="card">
        <h2 className="section-heading mb-4">API Key</h2>
        <p className="text-sm text-dc1-text-secondary mb-3">Your API key authenticates requests to the DCP platform.</p>
        <div className="flex items-center gap-2 mb-4">
          <code className="flex-1 text-sm font-mono text-dc1-amber bg-dc1-surface-l3 border border-dc1-border rounded-lg p-3 break-all">
            {showKey ? (apiKey ?? '') : '••••••••••••••••••••••••••••••••'}
          </code>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowKey(!showKey)}
              className="px-3 py-1.5 rounded text-sm bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary border border-dc1-border transition-colors"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={copyApiKey}
              className="px-3 py-1.5 rounded text-sm bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary border border-dc1-border transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        {!rotateConfirm ? (
          <button
            onClick={() => setRotateConfirm(true)}
            className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors"
          >
            Rotate API Key
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-status-error">This will invalidate your current key. Any integrations using it will stop working.</p>
            <div className="flex gap-2">
              <button
                onClick={handleRotateKey}
                disabled={rotating}
                className="px-3 py-1.5 rounded text-sm font-medium bg-status-error/20 text-status-error hover:bg-status-error/30 transition disabled:opacity-50"
              >
                {rotating ? 'Rotating...' : 'Confirm Rotate'}
              </button>
              <button
                onClick={() => setRotateConfirm(false)}
                className="px-3 py-1.5 rounded text-sm text-dc1-text-secondary hover:text-dc1-text-primary transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ── Top Up Modal ─────────────────────────────────────────── */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="topup-title">
          <div className="w-full max-w-md rounded-xl border border-dc1-border bg-dc1-surface-l1 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 id="topup-title" className="text-lg font-semibold text-dc1-text-primary">{t('billing.add_funds')}</h2>
              <button
                onClick={() => setShowTopupModal(false)}
                className="text-dc1-text-muted hover:text-dc1-text-primary transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="text-xs text-dc1-text-muted uppercase tracking-wide block">Amount (SAR)</label>
              <div className="flex flex-wrap gap-2">
                {[10, 25, 50, 100].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(String(amt))}
                    className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium border transition ${
                      topupAmount === String(amt)
                        ? 'border-dc1-amber bg-dc1-amber/10 text-dc1-amber'
                        : 'border-dc1-border bg-dc1-surface-l2 text-dc1-text-secondary hover:border-dc1-amber/30'
                    }`}
                  >
                    {amt} SAR
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="10"
                max="1000"
                step="1"
                placeholder={t('billing.custom_amount')}
                value={topupAmount}
                onChange={e => setTopupAmount(e.target.value)}
                className="input w-full mt-1"
              />
              {topupAmount && (parseFloat(topupAmount) < 10 || parseFloat(topupAmount) > 1000) && (
                <p className="text-xs text-status-error">Amount must be between 10 and 1,000 SAR</p>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-xs text-dc1-text-muted uppercase tracking-wide block">Payment Method</label>
              <div className="space-y-2">
                {([
                  { id: 'mada', label: 'Mada', desc: 'Saudi debit card' },
                  { id: 'creditcard', label: 'Visa / Mastercard', desc: 'International credit card' },
                  { id: 'applepay', label: 'Apple Pay', desc: 'Pay with Touch ID or Face ID' },
                ] as const).map(method => (
                  <label
                    key={method.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${
                      topupMethod === method.id
                        ? 'border-dc1-amber bg-dc1-amber/5'
                        : 'border-dc1-border bg-dc1-surface-l2 hover:border-dc1-amber/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="topupMethod"
                      value={method.id}
                      checked={topupMethod === method.id}
                      onChange={() => setTopupMethod(method.id)}
                      className="accent-dc1-amber"
                    />
                    <div>
                      <div className="text-sm font-medium text-dc1-text-primary">{method.label}</div>
                      <div className="text-xs text-dc1-text-muted">{method.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {topupError && <p className="text-sm text-status-error">{topupError}</p>}

            <p className="text-xs text-dc1-text-muted">{t('billing.payment_note')}</p>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowTopupModal(false)}
                className="btn btn-outline flex-1"
                disabled={topupLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleTopup}
                disabled={topupLoading || !topupAmount || parseFloat(topupAmount) < 10 || parseFloat(topupAmount) > 1000}
                className="btn btn-primary flex-1 disabled:opacity-50"
              >
                {topupLoading ? t('billing.processing') : `Pay ${topupAmount ? parseFloat(topupAmount).toFixed(2) : '0.00'} SAR`}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
