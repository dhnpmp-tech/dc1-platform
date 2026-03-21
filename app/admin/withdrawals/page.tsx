'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'

const API_BASE = '/api/dc1'

const HomeIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M9 21h6a2 2 0 002-2V9l-7-4-7 4v10a2 2 0 002 2z" /></svg>)
const ServerIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12v4a2 2 0 002 2h10a2 2 0 002-2v-4" /></svg>)
const UsersIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>)
const BriefcaseIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>)
const ShieldIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>)
const CpuIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>)
const ContainerIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>)
const CurrencyIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>)
const WalletIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>)

type WdStatus = 'pending' | 'processing' | 'paid' | 'failed'

interface WithdrawalRequest {
  id: string
  provider_id: number
  amount_halala: number
  status: WdStatus
  iban: string
  admin_note: string | null
  created_at: string
  processed_at: string | null
  provider_name: string | null
  provider_email: string | null
}

interface Summary {
  pending_count?: number
  pending_total_halala?: number
  paid_this_month_halala?: number
}

function halalToSar(halala: number): string {
  return (halala / 100).toFixed(2)
}

function maskIban(iban: string): string {
  if (!iban) return '—'
  if (iban.length <= 8) return iban
  const head = iban.slice(0, 4)
  const tail = iban.slice(-4)
  const masked = '*'.repeat(Math.max(iban.length - 8, 0))
  return `${head}${masked}${tail}`
}

function isWithinLast30Days(dateIso: string | null): boolean {
  if (!dateIso) return false
  const dateMs = new Date(dateIso).getTime()
  if (Number.isNaN(dateMs)) return false
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  return Date.now() - dateMs <= thirtyDaysMs
}

function statusLabel(status: WdStatus): string {
  if (status === 'paid') return 'Completed'
  if (status === 'failed') return 'Rejected'
  if (status === 'processing') return 'Processing'
  return 'Pending'
}

function statusBadge(status: WdStatus): 'pending' | 'active' | 'completed' | 'failed' {
  if (status === 'paid') return 'completed'
  if (status === 'failed') return 'failed'
  if (status === 'processing') return 'active'
  return 'pending'
}

export default function WithdrawalsPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary>({})
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRequest[]>([])
  const [historyWithdrawals, setHistoryWithdrawals] = useState<WithdrawalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<WithdrawalRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('dc1_admin_token')
    if (!stored) {
      router.push('/login')
      return
    }
    setToken(stored)
  }, [router])

  const fetchWithdrawals = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setErrorMsg('')

    try {
      const baseHeaders = { 'x-admin-token': token }

      const pendingParams = new URLSearchParams({ status: 'pending', limit: '100' })
      const paidParams = new URLSearchParams({ status: 'paid', limit: '100' })
      const failedParams = new URLSearchParams({ status: 'failed', limit: '100' })

      const [pendingRes, paidRes, failedRes] = await Promise.all([
        fetch(`${API_BASE}/admin/withdrawals?${pendingParams}`, { headers: baseHeaders }),
        fetch(`${API_BASE}/admin/withdrawals?${paidParams}`, { headers: baseHeaders }),
        fetch(`${API_BASE}/admin/withdrawals?${failedParams}`, { headers: baseHeaders }),
      ])

      if ([pendingRes, paidRes, failedRes].some((res) => res.status === 401)) {
        router.push('/login')
        return
      }

      if (!pendingRes.ok || !paidRes.ok || !failedRes.ok) {
        setErrorMsg('Failed to load withdrawals')
        return
      }

      const [pendingJson, paidJson, failedJson] = await Promise.all([
        pendingRes.json(),
        paidRes.json(),
        failedRes.json(),
      ])

      const pendingList: WithdrawalRequest[] = pendingJson?.withdrawals || []
      const paidList: WithdrawalRequest[] = paidJson?.withdrawals || []
      const failedList: WithdrawalRequest[] = failedJson?.withdrawals || []

      const history = [...paidList, ...failedList]
        .filter((item) => isWithinLast30Days(item.processed_at))
        .sort((a, b) => {
          const aTime = new Date(a.processed_at || a.created_at).getTime()
          const bTime = new Date(b.processed_at || b.created_at).getTime()
          return bTime - aTime
        })

      setPendingWithdrawals(pendingList)
      setSummary(pendingJson?.summary || {})
      setHistoryWithdrawals(history)
    } catch (error) {
      console.error(error)
      setErrorMsg('Network error while loading withdrawals')
    } finally {
      setLoading(false)
    }
  }, [router, token])

  useEffect(() => {
    fetchWithdrawals()
  }, [fetchWithdrawals])

  const handlePatch = useCallback(async (id: string, status: 'completed' | 'rejected', note?: string) => {
    if (!token) return

    setActionLoading(id)
    setErrorMsg('')

    try {
      const payload: { status: 'completed' | 'rejected'; note?: string } = { status }
      if (note) payload.note = note

      const response = await fetch(`${API_BASE}/admin/withdrawals/${id}`, {
        method: 'PATCH',
        headers: {
          'x-admin-token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.status === 401) {
        router.push('/login')
        return
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        setErrorMsg(errorBody.error || 'Failed to update withdrawal')
        return
      }

      setRejectModal(null)
      setRejectReason('')
      await fetchWithdrawals()
    } catch (error) {
      console.error(error)
      setErrorMsg('Network error while updating withdrawal')
    } finally {
      setActionLoading(null)
    }
  }, [fetchWithdrawals, router, token])

  const pendingCount = summary.pending_count || 0
  const pendingTotalHalala = summary.pending_total_halala || 0
  const paidThisMonthHalala = summary.paid_this_month_halala || 0

  const navItems = useMemo(() => [
    { label: 'Dashboard', href: '/admin', icon: <HomeIcon /> },
    { label: 'Providers', href: '/admin/providers', icon: <ServerIcon /> },
    { label: 'Renters', href: '/admin/renters', icon: <UsersIcon /> },
    { label: 'Jobs', href: '/admin/jobs', icon: <BriefcaseIcon /> },
    { label: 'Finance', href: '/admin/finance', icon: <CurrencyIcon /> },
    { label: 'Withdrawals', href: '/admin/withdrawals', icon: <WalletIcon />, badge: pendingCount > 0 },
    { label: 'Security', href: '/admin/security', icon: <ShieldIcon /> },
    { label: 'Fleet Health', href: '/admin/fleet', icon: <CpuIcon /> },
    { label: 'Containers', href: '/admin/containers', icon: <ContainerIcon /> },
  ], [pendingCount])

  return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Withdrawals</h1>
          <p className="text-dc1-text-secondary">Review pending provider withdrawals and approve payouts.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label="Total Pending"
            value={`${pendingCount} · ${halalToSar(pendingTotalHalala)} SAR`}
            accent="amber"
            icon={<WalletIcon />}
          />
          <StatCard
            label="Completed This Month"
            value={`${halalToSar(paidThisMonthHalala)} SAR`}
            accent="success"
          />
        </div>

        {errorMsg && (
          <div className="px-4 py-3 rounded bg-red-600/15 border border-red-500/30 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="card">
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-lg font-semibold text-dc1-text-primary">Pending Withdrawals</h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="px-6 pb-6 text-dc1-text-secondary">Loading...</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Provider Email</th>
                    <th>IBAN</th>
                    <th>Amount (SAR)</th>
                    <th>Requested</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingWithdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id}>
                      <td className="text-sm text-dc1-text-primary">{withdrawal.provider_email || '—'}</td>
                      <td className="font-mono text-xs text-dc1-text-secondary">{maskIban(withdrawal.iban)}</td>
                      <td className="font-semibold text-dc1-text-primary">{halalToSar(withdrawal.amount_halala)}</td>
                      <td className="text-xs text-dc1-text-secondary">
                        {withdrawal.created_at ? new Date(withdrawal.created_at).toLocaleString() : '—'}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePatch(withdrawal.id, 'completed')}
                            disabled={actionLoading === withdrawal.id}
                            className="text-xs px-2.5 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-50 font-medium"
                          >
                            {actionLoading === withdrawal.id ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => {
                              setRejectModal(withdrawal)
                              setRejectReason('')
                            }}
                            disabled={actionLoading === withdrawal.id}
                            className="text-xs px-2.5 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50 font-medium"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pendingWithdrawals.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-dc1-text-muted py-10">
                        No pending withdrawals
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-lg font-semibold text-dc1-text-primary">Completed & Rejected (Last 30 Days)</h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="px-6 pb-6 text-dc1-text-secondary">Loading...</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Provider Email</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Admin Note</th>
                  </tr>
                </thead>
                <tbody>
                  {historyWithdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id}>
                      <td className="text-sm text-dc1-text-primary">{withdrawal.provider_email || '—'}</td>
                      <td className="font-semibold text-dc1-text-primary">{halalToSar(withdrawal.amount_halala)} SAR</td>
                      <td>
                        <StatusBadge status={statusBadge(withdrawal.status)} label={statusLabel(withdrawal.status)} />
                      </td>
                      <td className="text-xs text-dc1-text-secondary">
                        {withdrawal.processed_at ? new Date(withdrawal.processed_at).toLocaleString() : '—'}
                      </td>
                      <td className="text-xs text-dc1-text-muted max-w-xs truncate">{withdrawal.admin_note || '—'}</td>
                    </tr>
                  ))}
                  {historyWithdrawals.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-dc1-text-muted py-10">
                        No completed or rejected withdrawals in the last 30 days
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dc1-surface-l1 border border-dc1-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-dc1-text-primary mb-1">Reject Withdrawal</h2>
            <p className="text-sm text-dc1-text-secondary mb-4">
              Enter a reason for rejecting this withdrawal request.
            </p>

            <label className="block text-sm font-medium text-dc1-text-primary mb-2">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Reason for rejection"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              className="input w-full text-sm resize-none mb-4"
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setRejectModal(null)
                  setRejectReason('')
                  setErrorMsg('')
                }}
                className="px-4 py-2 text-sm rounded bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary border border-dc1-border"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectReason.trim()) {
                    setErrorMsg('Rejection reason is required')
                    return
                  }
                  handlePatch(rejectModal.id, 'rejected', rejectReason.trim())
                }}
                disabled={actionLoading === rejectModal.id}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {actionLoading === rejectModal.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
