'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useLanguage } from '../../lib/i18n'

const API_BASE = '/api'

// ── Nav Icons (matching provider nav pattern) ─────────────────────────────────
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
const FleetIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
)
const WithdrawIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
)

// ── Types ─────────────────────────────────────────────────────────────────────
interface EarningsData {
  total_earned_sar: number
  pending_withdrawal_sar: number
  withdrawn_sar: number
  available_sar: number
}

interface WithdrawalRequest {
  id: string
  provider_id: number
  amount_halala: number
  status: 'pending' | 'approved' | 'processing' | 'paid' | 'failed' | 'rejected'
  iban: string
  admin_note: string | null
  created_at: string
  processed_at: string | null
  updated_at: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function maskIban(iban: string): string {
  const clean = (iban || '').toUpperCase().replace(/\s+/g, '')
  if (clean.length <= 8) return clean
  return `${clean.slice(0, 4)}${'*'.repeat(Math.max(clean.length - 8, 4))}${clean.slice(-4)}`
}

function statusBadgeClass(status: WithdrawalRequest['status']): string {
  switch (status) {
    case 'pending': return 'bg-dc1-amber/10 text-dc1-amber border-dc1-amber/30'
    case 'approved':
    case 'processing': return 'bg-status-info/10 text-status-info border-status-info/30'
    case 'paid': return 'bg-status-success/10 text-status-success border-status-success/30'
    case 'failed':
    case 'rejected': return 'bg-status-error/10 text-status-error border-status-error/30'
    default: return 'bg-dc1-surface-l2 text-dc1-text-muted border-dc1-border'
  }
}

function statusLabel(status: WithdrawalRequest['status']): string {
  switch (status) {
    case 'pending': return 'Pending Review'
    case 'approved': return 'Approved'
    case 'processing': return 'Processing'
    case 'paid': return 'Paid'
    case 'failed': return 'Failed'
    case 'rejected': return 'Rejected'
    default: return status
  }
}

function formatDate(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Page Component ────────────────────────────────────────────────────────────
export default function WithdrawPage() {
  const router = useRouter()
  const { t, isRTL } = useLanguage()

  const navItems = [
    { label: t('nav.dashboard'), href: '/provider', icon: <HomeIcon /> },
    { label: t('nav.jobs'), href: '/provider/jobs', icon: <LightningIcon /> },
    { label: t('nav.earnings'), href: '/provider/earnings', icon: <CurrencyIcon /> },
    { label: t('nav.gpu_metrics'), href: '/provider/gpu', icon: <GpuIcon /> },
    { label: 'Fleet', href: '/provider/fleet', icon: <FleetIcon /> },
    { label: 'Withdraw', href: '/provider/withdraw', icon: <WithdrawIcon /> },
    { label: t('nav.settings'), href: '/provider/settings', icon: <GearIcon /> },
  ]

  // State
  const [providerName, setProviderName] = useState('Provider')
  const [earnings, setEarnings] = useState<EarningsData | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [amountSar, setAmountSar] = useState('')
  const [iban, setIban] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [city, setCity] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const key = localStorage.getItem('dc1_provider_key')
    if (!key) {
      router.push('/login?role=provider&method=apikey&reason=missing_credentials')
      return
    }

    try {
      const [meRes, earningsRes, withdrawalsRes] = await Promise.all([
        fetch(`${API_BASE}/providers/me?key=${encodeURIComponent(key)}`),
        fetch(`${API_BASE}/providers/earnings?key=${encodeURIComponent(key)}`),
        fetch(`${API_BASE}/providers/me/withdrawals?key=${encodeURIComponent(key)}`),
      ])

      if (!meRes.ok) {
        if (meRes.status === 401 || meRes.status === 403) {
          localStorage.removeItem('dc1_provider_key')
          router.push('/login?role=provider&method=apikey&reason=invalid_credentials')
        }
        return
      }

      const meData = await meRes.json()
      setProviderName(meData.provider?.name || 'Provider')

      if (earningsRes.ok) {
        setEarnings(await earningsRes.json())
      }

      if (withdrawalsRes.ok) {
        const wData = await withdrawalsRes.json()
        setWithdrawals(wData.withdrawals || [])
      }
    } catch (err) {
      console.error('Withdraw page fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Form Submission ───────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSuccessMessage(null)

    const key = localStorage.getItem('dc1_provider_key')
    if (!key) return

    // Validate amount
    const numAmount = Number(amountSar)
    if (!Number.isFinite(numAmount) || numAmount < 10) {
      setFormError('Minimum withdrawal amount is 10 SAR.')
      return
    }

    const amountHalala = Math.round(numAmount * 100)
    if (earnings && amountHalala > Math.round(earnings.available_sar * 100)) {
      setFormError('Requested amount exceeds available balance.')
      return
    }

    // Validate IBAN
    const normalizedIban = iban.trim().toUpperCase().replace(/\s+/g, '')
    if (!/^SA\d{22}$/.test(normalizedIban)) {
      setFormError('IBAN must be Saudi format: SA followed by 22 digits.')
      return
    }

    // Validate holder name
    if (!accountHolderName.trim()) {
      setFormError('Account holder name is required.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/providers/me/withdraw?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_halala: amountHalala,
          iban: normalizedIban,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Request failed (HTTP ${res.status})`)
      }

      setSuccessMessage('Withdrawal request submitted. Processing takes 1-3 business days.')
      setAmountSar('')
      setIban('')
      setAccountHolderName('')
      setCity('')

      // Refresh data
      await fetchData()
    } catch (err: any) {
      setFormError(err.message || 'Withdrawal request failed.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading State ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout navItems={navItems} role="provider" userName="Provider">
        <div className="space-y-6">
          <div className="h-8 w-56 bg-dc1-surface-l2 rounded skeleton" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <div key={i} className="h-24 bg-dc1-surface-l2 rounded-lg skeleton" />)}
          </div>
          <div className="h-64 bg-dc1-surface-l2 rounded-xl skeleton" />
        </div>
      </DashboardLayout>
    )
  }

  const availableSar = earnings?.available_sar ?? 0
  const totalEarnedSar = earnings?.total_earned_sar ?? 0
  const pendingSar = earnings?.pending_withdrawal_sar ?? 0
  const withdrawnSar = earnings?.withdrawn_sar ?? 0
  const canWithdraw = availableSar >= 10

  return (
    <DashboardLayout navItems={navItems} role="provider" userName={providerName}>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-dc1-text-primary">Withdraw Earnings</h1>
            <p className="text-sm text-dc1-text-muted mt-1">Request a bank transfer for your earned compute revenue.</p>
          </div>
          <Link href="/provider/earnings" className="text-sm text-dc1-amber hover:underline">Full earnings report</Link>
        </div>

        {/* Balance Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-5">
            <p className="text-xs text-dc1-text-muted mb-1">Available to Withdraw</p>
            <p className="text-2xl font-bold text-dc1-amber">{availableSar.toFixed(2)} SAR</p>
          </div>
          <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-5">
            <p className="text-xs text-dc1-text-muted mb-1">Total Earned</p>
            <p className="text-2xl font-bold text-dc1-text-primary">{totalEarnedSar.toFixed(2)} SAR</p>
          </div>
          <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-5">
            <p className="text-xs text-dc1-text-muted mb-1">Pending Withdrawals</p>
            <p className="text-2xl font-bold text-status-info">{pendingSar.toFixed(2)} SAR</p>
          </div>
          <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-5">
            <p className="text-xs text-dc1-text-muted mb-1">Total Withdrawn</p>
            <p className="text-2xl font-bold text-status-success">{withdrawnSar.toFixed(2)} SAR</p>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="rounded-xl border border-status-success/30 bg-status-success/10 p-4">
            <p className="text-sm text-status-success font-medium">{successMessage}</p>
          </div>
        )}

        {/* Withdrawal Form */}
        <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-6">
          <h2 className="text-lg font-semibold font-poppins text-dc1-text-primary mb-4">Request Withdrawal</h2>

          {!canWithdraw && (
            <div className="rounded-lg bg-dc1-amber/10 border border-dc1-amber/30 p-4 mb-4">
              <p className="text-sm text-dc1-amber">
                Minimum withdrawal is 10 SAR. Your available balance is {availableSar.toFixed(2)} SAR.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-dc1-text-secondary mb-1.5">
                Amount (SAR)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="10"
                  max={availableSar}
                  placeholder="10.00"
                  value={amountSar}
                  onChange={e => setAmountSar(e.target.value)}
                  disabled={!canWithdraw || submitting}
                  className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-4 py-3 text-dc1-text-primary placeholder-dc1-text-muted focus:outline-none focus:border-dc1-amber/60 transition disabled:opacity-50"
                />
                {canWithdraw && (
                  <button
                    type="button"
                    onClick={() => setAmountSar(availableSar.toFixed(2))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dc1-amber hover:underline"
                  >
                    Max
                  </button>
                )}
              </div>
              <p className="text-xs text-dc1-text-muted mt-1">
                Minimum 10 SAR. Available: {availableSar.toFixed(2)} SAR
              </p>
            </div>

            {/* IBAN */}
            <div>
              <label className="block text-sm font-medium text-dc1-text-secondary mb-1.5">
                IBAN (Saudi)
              </label>
              <input
                type="text"
                placeholder="SA0000000000000000000000"
                maxLength={24}
                value={iban}
                onChange={e => setIban(e.target.value.toUpperCase())}
                disabled={!canWithdraw || submitting}
                className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-4 py-3 text-dc1-text-primary placeholder-dc1-text-muted font-mono focus:outline-none focus:border-dc1-amber/60 transition disabled:opacity-50"
              />
              <p className="text-xs text-dc1-text-muted mt-1">
                SA + 22 digits (e.g. SA0380000000608010167519)
              </p>
            </div>

            {/* Account Holder Name */}
            <div>
              <label className="block text-sm font-medium text-dc1-text-secondary mb-1.5">
                Account Holder Name
              </label>
              <input
                type="text"
                placeholder="Full name as on bank account"
                value={accountHolderName}
                onChange={e => setAccountHolderName(e.target.value)}
                disabled={!canWithdraw || submitting}
                className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-4 py-3 text-dc1-text-primary placeholder-dc1-text-muted focus:outline-none focus:border-dc1-amber/60 transition disabled:opacity-50"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-medium text-dc1-text-secondary mb-1.5">
                City (optional)
              </label>
              <input
                type="text"
                placeholder="Riyadh"
                value={city}
                onChange={e => setCity(e.target.value)}
                disabled={!canWithdraw || submitting}
                className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-4 py-3 text-dc1-text-primary placeholder-dc1-text-muted focus:outline-none focus:border-dc1-amber/60 transition disabled:opacity-50"
              />
            </div>

            {/* Error */}
            {formError && (
              <div className="rounded-lg bg-status-error/10 border border-status-error/30 p-3">
                <p className="text-sm text-status-error">{formError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canWithdraw || submitting || !amountSar || !iban || !accountHolderName.trim()}
              className="w-full sm:w-auto px-6 py-3 rounded-lg font-semibold text-sm bg-dc1-amber text-dc1-void hover:bg-dc1-amber/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {submitting ? 'Submitting...' : 'Request Withdrawal'}
            </button>
          </form>
        </div>

        {/* Withdrawal History */}
        <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-6">
          <h2 className="text-lg font-semibold font-poppins text-dc1-text-primary mb-4">Withdrawal History</h2>

          {withdrawals.length === 0 ? (
            <div className="py-10 text-center text-dc1-text-muted text-sm">
              No withdrawal requests yet.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dc1-border">
                      <th className="text-left py-2 px-2 text-xs font-medium text-dc1-text-muted">Date</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-dc1-text-muted">Amount</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-dc1-text-muted">IBAN</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-dc1-text-muted">Status</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-dc1-text-muted">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dc1-border/40">
                    {withdrawals.map(w => (
                      <tr key={w.id} className="hover:bg-dc1-surface-l2 transition-colors">
                        <td className="py-3 px-2 text-dc1-text-secondary whitespace-nowrap">
                          {formatDate(w.created_at)}
                        </td>
                        <td className="py-3 px-2 font-mono text-dc1-amber font-medium">
                          {(w.amount_halala / 100).toFixed(2)} SAR
                        </td>
                        <td className="py-3 px-2 font-mono text-dc1-text-secondary text-xs">
                          {maskIban(w.iban)}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass(w.status)}`}>
                            {statusLabel(w.status)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-xs text-dc1-text-muted max-w-[200px] truncate">
                          {w.admin_note || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {withdrawals.map(w => (
                  <div key={w.id} className="rounded-lg bg-dc1-surface-l2 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono text-dc1-amber font-medium">
                        {(w.amount_halala / 100).toFixed(2)} SAR
                      </span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass(w.status)}`}>
                        {statusLabel(w.status)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-dc1-text-muted">
                      <span>{formatDate(w.created_at)}</span>
                      <span className="font-mono">{maskIban(w.iban)}</span>
                    </div>
                    {w.admin_note && (
                      <p className="text-xs text-dc1-text-muted border-t border-dc1-border/30 pt-2">{w.admin_note}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </DashboardLayout>
  )
}
