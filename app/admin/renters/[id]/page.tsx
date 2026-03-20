'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import StatCard from '../../../components/ui/StatCard'
import StatusBadge from '../../../components/ui/StatusBadge'

const API_BASE = '/api/dc1'

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

interface Job {
  id: number; job_id: string; job_type: string; status: string
  submitted_at: string; completed_at?: string; cost_halala: number
  actual_cost_halala?: number; provider_id: number; error?: string
}

export default function RenterDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [renter, setRenter] = useState<any>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [creditModal, setCreditModal] = useState(false)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditReason, setCreditReason] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') : null

  useEffect(() => {
    if (!token) { router.push('/login'); return }
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/admin/renters/${id}`, { headers: { 'x-admin-token': token || '' } })
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setRenter(data.renter)
      setJobs(data.jobs || [])
      setStats(data.stats || {})
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleAction = async (action: 'suspend' | 'unsuspend') => {
    setActionLoading(true)
    try {
      await fetch(`${API_BASE}/admin/renters/${id}/${action}`, {
        method: 'POST', headers: { 'x-admin-token': token || '' }
      })
      fetchData()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  const handleCredit = async () => {
    const amt = parseFloat(creditAmount)
    if (!amt || amt <= 0) return
    setActionLoading(true)
    try {
      await fetch(`${API_BASE}/admin/renters/${id}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' },
        body: JSON.stringify({ amount_halala: Math.round(amt * 100), reason: creditReason || 'Admin credit' })
      })
      setCreditModal(false)
      setCreditAmount('')
      setCreditReason('')
      fetchData()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  const fmt = (iso: string) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString() + ' ' + new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getJobStatusType = (status: string) => {
    switch (status) {
      case 'completed': return 'completed'
      case 'running': return 'running'
      case 'pending': case 'queued': return 'pending'
      case 'failed': return 'failed'
      case 'cancelled': return 'inactive'
      default: return 'offline'
    }
  }

  if (loading) return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="text-dc1-text-secondary">Loading renter details...</div>
    </DashboardLayout>
  )

  if (!renter) return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="text-red-400">Renter not found</div>
    </DashboardLayout>
  )

  const r = renter

  return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/admin/renters" className="text-dc1-text-secondary text-sm hover:text-dc1-amber mb-2 inline-block">&larr; Back to Renters</Link>
          <h1 className="text-3xl font-bold text-dc1-text-primary">{r.name}</h1>
          <p className="text-dc1-text-secondary">{r.email} {r.organization ? `· ${r.organization}` : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={r.status === 'suspended' ? 'warning' as any : 'online' as any}
            label={r.status === 'suspended' ? 'Suspended' : 'Active'} />
          {r.status === 'suspended' ? (
            <button onClick={() => handleAction('unsuspend')} disabled={actionLoading}
              className="px-3 py-1.5 rounded text-sm bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-50">
              {actionLoading ? '...' : 'Reactivate'}
            </button>
          ) : (
            <button onClick={() => handleAction('suspend')} disabled={actionLoading}
              className="px-3 py-1.5 rounded text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50">
              {actionLoading ? '...' : 'Suspend'}
            </button>
          )}
          <button onClick={() => setCreditModal(true)}
            className="px-3 py-1.5 rounded text-sm bg-blue-600/20 text-blue-400 hover:bg-blue-600/30">
            Credit Balance
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Balance" value={`${((r.balance_halala || 0) / 100).toFixed(2)} SAR`} accent="amber" />
        <StatCard label="Total Jobs" value={String(stats?.total_jobs || 0)} accent="info" />
        <StatCard label="Completed" value={String(stats?.completed_jobs || 0)} accent="success" />
        <StatCard label="Total Spent" value={`${((stats?.total_spent_halala || 0) / 100).toFixed(2)} SAR`} accent="default" />
      </div>

      {/* Account Details */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-dc1-text-primary mb-3">Account Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-dc1-text-muted">ID</span><br/><span className="text-dc1-text-primary">{r.id}</span></div>
          <div><span className="text-dc1-text-muted">Email</span><br/><span className="text-dc1-text-primary">{r.email}</span></div>
          <div><span className="text-dc1-text-muted">Organization</span><br/><span className="text-dc1-text-primary">{r.organization || '—'}</span></div>
          <div><span className="text-dc1-text-muted">Registered</span><br/><span className="text-dc1-text-primary">{fmt(r.created_at)}</span></div>
          <div><span className="text-dc1-text-muted">Failed Jobs</span><br/><span className="text-red-400">{stats?.failed_jobs || 0}</span></div>
          <div><span className="text-dc1-text-muted">Success Rate</span><br/><span className="text-dc1-text-primary">
            {stats?.total_jobs > 0 ? `${((stats.completed_jobs / stats.total_jobs) * 100).toFixed(0)}%` : 'N/A'}
          </span></div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="card">
        <h3 className="text-lg font-semibold text-dc1-text-primary mb-3">Recent Jobs ({jobs.length})</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Cost</th>
                <th>Submitted</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j: Job) => (
                <tr key={j.id}>
                  <td className="text-sm font-mono">
                    <Link href={`/admin/jobs/${j.id}`} className="text-dc1-amber hover:underline">
                      {j.job_id?.slice(0, 20) || j.id}
                    </Link>
                  </td>
                  <td className="text-sm">{j.job_type}</td>
                  <td><StatusBadge status={getJobStatusType(j.status)} label={j.status} /></td>
                  <td className="text-sm">{((j.actual_cost_halala || j.cost_halala || 0) / 100).toFixed(2)} SAR</td>
                  <td className="text-sm text-dc1-text-secondary">{fmt(j.submitted_at)}</td>
                  <td className="text-sm text-red-400 max-w-xs truncate">{j.error || '—'}</td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr><td colSpan={6} className="text-dc1-text-muted text-sm text-center">No jobs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Modal */}
      {creditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-full max-w-md">
            <h3 className="text-lg font-semibold text-dc1-text-primary mb-4">Credit {r.name}</h3>
            <div className="mb-3">
              <label className="text-sm text-dc1-text-secondary block mb-1">Amount (SAR)</label>
              <input type="number" value={creditAmount} onChange={e => setCreditAmount(e.target.value)}
                className="w-full px-3 py-2 rounded bg-dc1-dark border border-dc1-border text-dc1-text-primary" placeholder="50" min="0" step="0.01" />
            </div>
            <div className="mb-4">
              <label className="text-sm text-dc1-text-secondary block mb-1">Reason (optional)</label>
              <input type="text" value={creditReason} onChange={e => setCreditReason(e.target.value)}
                className="w-full px-3 py-2 rounded bg-dc1-dark border border-dc1-border text-dc1-text-primary" placeholder="Admin credit" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreditModal(false)} className="px-4 py-2 rounded text-sm text-dc1-text-secondary hover:text-dc1-text-primary">Cancel</button>
              <button onClick={handleCredit} disabled={actionLoading || !creditAmount}
                className="px-4 py-2 rounded text-sm bg-dc1-amber text-dc1-dark font-medium disabled:opacity-50">
                {actionLoading ? '...' : 'Credit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
