'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/app/components/layout/DashboardLayout'
import StatCard from '@/app/components/ui/StatCard'
import StatusBadge from '@/app/components/ui/StatusBadge'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

const HomeIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M9 21h6a2 2 0 002-2V9l-7-4-7 4v10a2 2 0 002 2z" /></svg>)
const ServerIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12v4a2 2 0 002 2h10a2 2 0 002-2v-4" /></svg>)
const UsersIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>)
const BriefcaseIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>)
const ShieldIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>)
const CpuIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>)
const CurrencyIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>)
const WalletIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>)

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: <HomeIcon /> },
  { label: 'Providers', href: '/admin/providers', icon: <ServerIcon /> },
  { label: 'Renters', href: '/admin/renters', icon: <UsersIcon /> },
  { label: 'Jobs', href: '/admin/jobs', icon: <BriefcaseIcon /> },
  { label: 'Finance', href: '/admin/finance', icon: <CurrencyIcon /> },
  { label: 'Withdrawals', href: '/admin/withdrawals', icon: <WalletIcon /> },
  { label: 'Security', href: '/admin/security', icon: <ShieldIcon /> },
  { label: 'Fleet Health', href: '/admin/fleet', icon: <CpuIcon /> },
]

type WdStatus = 'pending' | 'approved' | 'completed' | 'rejected'

const statusMap: Record<WdStatus, 'pending' | 'active' | 'completed' | 'failed'> = {
  pending: 'pending',
  approved: 'active',
  completed: 'completed',
  rejected: 'failed',
}

export default function WithdrawalsPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectId, setRejectId] = useState<number | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') : null

  const fetchData = async () => {
    if (!token) { router.push('/login'); return }
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filter) params.set('status', filter)
      const res = await fetch(`${API_BASE}/admin/withdrawals?${params}`, { headers: { 'x-admin-token': token } })
      if (res.status === 401) { router.push('/login'); return }
      setData(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [page, filter])

  const handleAction = async (id: number, action: 'approve' | 'reject' | 'complete', body?: any) => {
    setActionLoading(id)
    try {
      await fetch(`${API_BASE}/admin/withdrawals/${id}/${action}`, {
        method: 'POST',
        headers: { 'x-admin-token': token!, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
      setRejectId(null)
      setRejectReason('')
      await fetchData()
    } catch (err) { console.error(err) }
    finally { setActionLoading(null) }
  }

  const s = data?.summary || {}
  const withdrawals = data?.withdrawals || []
  const pagination = data?.pagination

  return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Withdrawal Management</h1>
          <p className="text-dc1-text-secondary">Review and process provider payout requests</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Pending" value={`${s.pending_count || 0} (${(s.pending_total || 0).toFixed(2)} SAR)`} accent="amber" icon={<WalletIcon />} />
          <StatCard label="Approved" value={`${(s.approved_total || 0).toFixed(2)} SAR`} accent="info" />
          <StatCard label="Paid Out" value={`${(s.paid_total || 0).toFixed(2)} SAR`} accent="success" />
          <StatCard label="Rejected" value={`${(s.rejected_total || 0).toFixed(2)} SAR`} accent="error" />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {['', 'pending', 'approved', 'completed', 'rejected'].map(f => (
            <button key={f || 'all'} onClick={() => { setFilter(f); setPage(1) }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${filter === f ? 'bg-dc1-amber text-black' : 'bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary'}`}>
              {f ? f.charAt(0).toUpperCase() + f.slice(1) : 'All'}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? <div className="text-dc1-text-secondary">Loading...</div> : (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Provider</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w: any) => (
                    <tr key={w.id}>
                      <td className="font-mono text-xs text-dc1-amber">{w.withdrawal_id}</td>
                      <td>
                        <div className="font-medium text-sm">{w.provider_name}</div>
                        <div className="text-xs text-dc1-text-muted">{w.provider_email}</div>
                      </td>
                      <td className="font-semibold text-dc1-text-primary">{w.amount_sar?.toFixed(2)} SAR</td>
                      <td className="text-sm">{w.payout_method || 'bank_transfer'}</td>
                      <td><StatusBadge status={statusMap[w.status as WdStatus] || 'pending'} label={w.status} /></td>
                      <td className="text-xs text-dc1-text-secondary">{w.requested_at ? new Date(w.requested_at).toLocaleDateString() : '—'}</td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {w.status === 'pending' && (
                            <>
                              <button onClick={() => handleAction(w.id, 'approve')}
                                disabled={actionLoading === w.id}
                                className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-50">
                                {actionLoading === w.id ? '...' : 'Approve'}
                              </button>
                              <button onClick={() => setRejectId(rejectId === w.id ? null : w.id)}
                                className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30">
                                Reject
                              </button>
                            </>
                          )}
                          {w.status === 'approved' && (
                            <button onClick={() => handleAction(w.id, 'complete')}
                              disabled={actionLoading === w.id}
                              className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 disabled:opacity-50">
                              {actionLoading === w.id ? '...' : 'Mark Paid'}
                            </button>
                          )}
                          {w.notes && <span className="text-xs text-dc1-text-muted italic">{w.notes}</span>}
                        </div>
                        {rejectId === w.id && (
                          <div className="mt-2 flex gap-2">
                            <input type="text" placeholder="Reason..." value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              className="input text-xs flex-1" />
                            <button onClick={() => handleAction(w.id, 'reject', { reason: rejectReason })}
                              className="text-xs px-2 py-1 rounded bg-red-600 text-white">Confirm</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {withdrawals.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-dc1-text-muted py-8">No withdrawal requests</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.total_pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-dc1-border">
                <span className="text-sm text-dc1-text-secondary">
                  Page {pagination.page} of {pagination.total_pages} ({pagination.total} total)
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-3 py-1 text-sm rounded bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary disabled:opacity-30 border border-dc1-border">
                    Previous
                  </button>
                  <button onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))} disabled={page >= pagination.total_pages}
                    className="px-3 py-1 text-sm rounded bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary disabled:opacity-30 border border-dc1-border">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
