'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'

const API_BASE = '/api/dc1'

// ─── Icons ────────────────────────────────────────────────────────────────────
const HomeIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M9 21h6a2 2 0 002-2V9l-7-4-7 4v10a2 2 0 002 2z" /></svg>)
const ServerIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12v4a2 2 0 002 2h10a2 2 0 002-2v-4" /></svg>)
const UsersIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>)
const BriefcaseIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>)
const ShieldIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>)
const CpuIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>)
const ContainerIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>)
const CurrencyIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>)
const WalletIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>)

// ─── Types ────────────────────────────────────────────────────────────────────
type WdStatus = 'pending' | 'processing' | 'paid' | 'failed'

const statusBadgeMap: Record<WdStatus, 'pending' | 'active' | 'completed' | 'failed'> = {
  pending: 'pending',
  processing: 'active',
  paid: 'completed',
  failed: 'failed',
}

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
  provider_gpu_model: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function maskIban(iban: string): string {
  if (!iban) return '—'
  if (iban.length <= 8) return iban
  const head = iban.slice(0, 4)
  const tail = iban.slice(-4)
  const midLen = iban.length - 8
  const masked = '•'.repeat(midLen).replace(/(.{4})/g, '$1 ').trim()
  return `${head} ${masked} ${tail}`
}

function daysWaiting(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
}

function halalToSar(halala: number): string {
  return (halala / 100).toFixed(2)
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function WithdrawalsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [allFilter, setAllFilter] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<WithdrawalRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') : null

  const fetchData = useCallback(async () => {
    if (!token) { router.push('/login'); return }
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (tab === 'pending') params.set('status', 'pending')
      else if (allFilter) params.set('status', allFilter)
      const res = await fetch(`${API_BASE}/admin/withdrawals?${params}`, {
        headers: { 'x-admin-token': token },
      })
      if (res.status === 401) { router.push('/login'); return }
      setData(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [token, tab, allFilter, router])

  useEffect(() => {
    setLoading(true)
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handlePatch = async (id: string, status: string, adminNote?: string) => {
    setActionLoading(id)
    setErrorMsg('')
    try {
      const res = await fetch(`${API_BASE}/admin/withdrawals/${id}`, {
        method: 'PATCH',
        headers: { 'x-admin-token': token!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note: adminNote }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setErrorMsg(err.error || 'Action failed')
        return
      }
      setRejectModal(null)
      setRejectReason('')
      await fetchData()
    } catch (err) {
      console.error(err)
      setErrorMsg('Network error')
    } finally {
      setActionLoading(null)
    }
  }

  const s = data?.summary || {}
  const pendingCount: number = s.pending_count || 0
  const withdrawals: WithdrawalRequest[] = data?.withdrawals || []

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: <HomeIcon /> },
    { label: 'Providers', href: '/admin/providers', icon: <ServerIcon /> },
    { label: 'Renters', href: '/admin/renters', icon: <UsersIcon /> },
    { label: 'Jobs', href: '/admin/jobs', icon: <BriefcaseIcon /> },
    { label: 'Finance', href: '/admin/finance', icon: <CurrencyIcon /> },
    { label: 'Withdrawals', href: '/admin/withdrawals', icon: <WalletIcon />, badge: pendingCount > 0 },
    { label: 'Security', href: '/admin/security', icon: <ShieldIcon /> },
    { label: 'Fleet Health', href: '/admin/fleet', icon: <CpuIcon /> },
    { label: 'Containers', href: '/admin/containers', icon: <ContainerIcon /> },
  ]

  return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Withdrawal Management</h1>
          <p className="text-dc1-text-secondary">Review and process provider payout requests</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Pending"
            value={`${pendingCount} requests · ${halalToSar(s.pending_total_halala || 0)} SAR`}
            accent="amber"
            icon={<WalletIcon />}
          />
          <StatCard
            label="Paid This Month"
            value={`${halalToSar(s.paid_this_month_halala || 0)} SAR`}
            accent="success"
          />
          <StatCard
            label="Failed / Rejected"
            value={`${s.failed_count || 0} requests`}
            accent="error"
          />
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="px-4 py-3 rounded bg-red-600/15 border border-red-500/30 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-dc1-border">
          {(['pending', 'all'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setAllFilter('') }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-dc1-amber text-dc1-amber'
                  : 'border-transparent text-dc1-text-secondary hover:text-dc1-text-primary'
              }`}
            >
              {t === 'pending' ? (
                <span className="flex items-center gap-2">
                  Pending
                  {pendingCount > 0 && (
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-dc1-amber text-black font-bold">
                      {pendingCount}
                    </span>
                  )}
                </span>
              ) : 'All Withdrawals'}
            </button>
          ))}
        </div>

        {/* All withdrawals status filter */}
        {tab === 'all' && (
          <div className="flex gap-2 flex-wrap">
            {(['', 'pending', 'processing', 'paid', 'failed'] as const).map((f) => (
              <button
                key={f || 'all'}
                onClick={() => setAllFilter(f)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  allFilter === f
                    ? 'bg-dc1-amber text-black'
                    : 'bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary'
                }`}
              >
                {f ? f.charAt(0).toUpperCase() + f.slice(1) : 'All'}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-dc1-text-secondary">Loading...</div>
        ) : (
          <div className="card">
            <div className="overflow-x-auto">
              {tab === 'pending' ? (
                /* ── Pending tab ── */
                <table className="table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>GPU</th>
                      <th>Amount</th>
                      <th>IBAN</th>
                      <th>Requested</th>
                      <th>Waiting</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id}>
                        <td>
                          <div className="font-medium text-sm">{w.provider_name || '—'}</div>
                          <div className="text-xs text-dc1-text-muted">{w.provider_email || '—'}</div>
                        </td>
                        <td className="text-sm text-dc1-text-secondary">{w.provider_gpu_model || '—'}</td>
                        <td className="font-semibold text-dc1-text-primary">{halalToSar(w.amount_halala)} SAR</td>
                        <td className="font-mono text-xs text-dc1-text-secondary">{maskIban(w.iban)}</td>
                        <td className="text-xs text-dc1-text-secondary">
                          {w.created_at ? new Date(w.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          <span className={`text-xs font-medium ${daysWaiting(w.created_at) >= 3 ? 'text-red-400' : 'text-dc1-text-secondary'}`}>
                            {daysWaiting(w.created_at)}d
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handlePatch(w.id, 'processing')}
                              disabled={actionLoading === w.id}
                              className="text-xs px-2.5 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-50 font-medium"
                            >
                              {actionLoading === w.id ? '...' : 'Approve → Processing'}
                            </button>
                            <button
                              onClick={() => { setRejectModal(w); setRejectReason('') }}
                              className="text-xs px-2.5 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 font-medium"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {withdrawals.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-dc1-text-muted py-10">
                          No pending withdrawal requests
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                /* ── All withdrawals tab ── */
                <table className="table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Amount</th>
                      <th>IBAN</th>
                      <th>Status</th>
                      <th>Admin Note</th>
                      <th>Processed</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id}>
                        <td>
                          <div className="font-medium text-sm">{w.provider_name || '—'}</div>
                          <div className="text-xs text-dc1-text-muted">{w.provider_email || '—'}</div>
                        </td>
                        <td className="font-semibold text-dc1-text-primary">{halalToSar(w.amount_halala)} SAR</td>
                        <td className="font-mono text-xs text-dc1-text-secondary">{maskIban(w.iban)}</td>
                        <td>
                          <StatusBadge
                            status={statusBadgeMap[w.status] || 'pending'}
                            label={w.status}
                          />
                        </td>
                        <td className="text-xs text-dc1-text-muted max-w-xs truncate">
                          {w.admin_note || '—'}
                        </td>
                        <td className="text-xs text-dc1-text-secondary">
                          {w.processed_at ? new Date(w.processed_at).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          {w.status === 'processing' && (
                            <button
                              onClick={() => handlePatch(w.id, 'paid')}
                              disabled={actionLoading === w.id}
                              className="text-xs px-2.5 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 disabled:opacity-50 font-medium"
                            >
                              {actionLoading === w.id ? '...' : 'Mark as Paid'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {withdrawals.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-dc1-text-muted py-10">
                          No withdrawal requests
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dc1-surface-l1 border border-dc1-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-dc1-text-primary mb-1">Reject Withdrawal</h2>
            <p className="text-sm text-dc1-text-secondary mb-4">
              Rejecting <span className="font-mono text-dc1-amber">{halalToSar(rejectModal.amount_halala)} SAR</span> for{' '}
              <span className="font-medium text-dc1-text-primary">{rejectModal.provider_email}</span>.
              The balance will be refunded to their account.
            </p>
            <label className="block text-sm font-medium text-dc1-text-primary mb-2">
              Rejection reason <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Invalid IBAN format, please re-submit with correct details"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input w-full text-sm resize-none mb-4"
            />
            {errorMsg && (
              <p className="text-sm text-red-400 mb-3">{errorMsg}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); setErrorMsg('') }}
                className="px-4 py-2 text-sm rounded bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary border border-dc1-border"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectReason.trim()) { setErrorMsg('Rejection reason is required'); return }
                  handlePatch(rejectModal.id, 'failed', rejectReason.trim())
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
