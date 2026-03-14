'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/app/components/layout/DashboardLayout'
import StatCard from '@/app/components/ui/StatCard'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

// Nav icons
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

const halalaToSar = (h: number) => (h / 100).toFixed(2)

export default function FinanceDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [txns, setTxns] = useState<any[]>([])
  const [txnPage, setTxnPage] = useState(1)
  const [txnPagination, setTxnPagination] = useState<any>(null)
  const [error, setError] = useState('')
  const [recon, setRecon] = useState<any>(null)
  const [reconDays, setReconDays] = useState(7)

  useEffect(() => {
    const token = localStorage.getItem('dc1_admin_token')
    if (!token) { router.push('/login'); return }

    const headers = { 'x-admin-token': token }

    const load = async () => {
      try {
        const [sumRes, txnRes, reconRes] = await Promise.all([
          fetch(`${API_BASE}/admin/finance/summary`, { headers }),
          fetch(`${API_BASE}/admin/finance/transactions?page=${txnPage}&limit=15`, { headers }),
          fetch(`${API_BASE}/admin/finance/reconciliation?days=${reconDays}`, { headers }),
        ])
        if (!sumRes.ok || !txnRes.ok || !reconRes.ok) throw new Error('Failed to load')
        const sumData = await sumRes.json()
        const txnData = await txnRes.json()
        const reconData = await reconRes.json()
        setData(sumData)
        setTxns(txnData.transactions || [])
        setTxnPagination(txnData.pagination || null)
        setRecon(reconData)
      } catch (err: any) { setError(err.message) }
      finally { setLoading(false) }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [router, txnPage, reconDays])

  if (loading) return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="text-dc1-text-secondary">Loading finance data...</div>
    </DashboardLayout>
  )

  const at = data?.all_time || {}
  const td = data?.today || {}
  const wk = data?.this_week || {}
  const mo = data?.this_month || {}
  const rb = data?.renter_balances || {}
  const wd = data?.withdrawals || {}

  return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Finance Dashboard</h1>
          <p className="text-dc1-text-secondary">Revenue, payouts, and billing overview</p>
        </div>

        {error && <div className="card border-red-500/50 text-red-400 text-sm">{error}</div>}

        {/* Revenue Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Revenue" value={`${halalaToSar(at.total_revenue || 0)} SAR`} accent="success" icon={<CurrencyIcon />} />
          <StatCard label="DC1 Fees (25%)" value={`${halalaToSar(at.total_dc1_fees || 0)} SAR`} accent="amber" icon={<CurrencyIcon />} />
          <StatCard label="Provider Payouts (75%)" value={`${halalaToSar(at.total_provider_payouts || 0)} SAR`} accent="info" icon={<CurrencyIcon />} />
          <StatCard label="Completed Jobs" value={String(at.completed_jobs || 0)} accent="default" />
        </div>

        {/* Period Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <h3 className="text-sm font-medium text-dc1-text-secondary mb-3">Today</h3>
            <p className="text-2xl font-bold text-dc1-text-primary">{halalaToSar(td.revenue || 0)} SAR</p>
            <p className="text-xs text-dc1-text-muted mt-1">{td.jobs || 0} jobs · DC1 fee: {halalaToSar(td.dc1_fees || 0)} SAR</p>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-dc1-text-secondary mb-3">This Week</h3>
            <p className="text-2xl font-bold text-dc1-text-primary">{halalaToSar(wk.revenue || 0)} SAR</p>
            <p className="text-xs text-dc1-text-muted mt-1">{wk.jobs || 0} jobs · DC1 fee: {halalaToSar(wk.dc1_fees || 0)} SAR</p>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-dc1-text-secondary mb-3">This Month</h3>
            <p className="text-2xl font-bold text-dc1-text-primary">{halalaToSar(mo.revenue || 0)} SAR</p>
            <p className="text-xs text-dc1-text-muted mt-1">{mo.jobs || 0} jobs · DC1 fee: {halalaToSar(mo.dc1_fees || 0)} SAR</p>
          </div>
        </div>

        {/* Renter Balances + Withdrawals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="section-heading mb-4">Renter Balances</h2>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-dc1-text-secondary">Total Held</span><span className="text-dc1-text-primary font-semibold">{halalaToSar(rb.total_held || 0)} SAR</span></div>
              <div className="flex justify-between"><span className="text-dc1-text-secondary">Active Renters</span><span className="text-dc1-text-primary">{rb.total_renters || 0}</span></div>
              <div className="flex justify-between"><span className="text-dc1-text-secondary">Funded Accounts</span><span className="text-dc1-text-primary">{rb.funded_renters || 0}</span></div>
            </div>
          </div>
          <div className="card">
            <h2 className="section-heading mb-4">Withdrawals</h2>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-dc1-text-secondary">Pending</span><span className="text-dc1-amber font-semibold">{wd.pending_count || 0} ({(wd.pending_sar || 0).toFixed(2)} SAR)</span></div>
              <div className="flex justify-between"><span className="text-dc1-text-secondary">Approved</span><span className="text-dc1-text-primary">{(wd.approved_sar || 0).toFixed(2)} SAR</span></div>
              <div className="flex justify-between"><span className="text-dc1-text-secondary">Paid Out</span><span className="text-status-success">{(wd.paid_sar || 0).toFixed(2)} SAR</span></div>
            </div>
          </div>
        </div>

        {/* Daily Revenue Chart (simple bar viz) */}
        {data?.daily_revenue?.length > 0 && (
          <div className="card">
            <h2 className="section-heading mb-4">Daily Revenue (Last 14 Days)</h2>
            <div className="flex items-end gap-1 h-40">
              {data.daily_revenue.map((d: any) => {
                const maxRev = Math.max(...data.daily_revenue.map((x: any) => x.revenue || 1))
                const pct = maxRev > 0 ? ((d.revenue || 0) / maxRev) * 100 : 0
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-8 bg-dc1-surface-l2 border border-dc1-border px-2 py-1 rounded text-xs text-dc1-text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {d.day}: {halalaToSar(d.revenue)} SAR ({d.jobs} jobs)
                    </div>
                    <div
                      className="w-full bg-dc1-amber/80 rounded-t hover:bg-dc1-amber transition-colors"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    <span className="text-[10px] text-dc1-text-muted">{d.day?.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top Earners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="section-heading mb-4">Top Providers (by earnings)</h2>
            <div className="space-y-3">
              {(data?.top_providers || []).map((p: any, i: number) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-dc1-text-muted w-5">{i + 1}.</span>
                    <div>
                      <p className="text-sm font-medium text-dc1-text-primary">{p.name}</p>
                      <p className="text-xs text-dc1-text-muted">{p.gpu_model} · {p.job_count} jobs</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-status-success">{halalaToSar(p.total_earned)} SAR</span>
                </div>
              ))}
              {(!data?.top_providers?.length) && <p className="text-sm text-dc1-text-muted">No earnings yet</p>}
            </div>
          </div>
          <div className="card">
            <h2 className="section-heading mb-4">Top Renters (by spend)</h2>
            <div className="space-y-3">
              {(data?.top_renters || []).map((r: any, i: number) => (
                <div key={r.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-dc1-text-muted w-5">{i + 1}.</span>
                    <div>
                      <p className="text-sm font-medium text-dc1-text-primary">{r.name}</p>
                      <p className="text-xs text-dc1-text-muted">{r.email} · {r.job_count} jobs</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-dc1-amber">{halalaToSar(r.total_spent)} SAR</span>
                </div>
              ))}
              {(!data?.top_renters?.length) && <p className="text-sm text-dc1-text-muted">No spending yet</p>}
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="card">
          <h2 className="section-heading mb-4">Recent Transactions</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Type</th>
                  <th>Renter</th>
                  <th>Provider</th>
                  <th>Revenue</th>
                  <th>DC1 Fee</th>
                  <th>Provider Cut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t: any) => (
                  <tr key={t.id}>
                    <td className="font-mono text-xs text-dc1-amber">{t.job_id?.slice(0, 20) || t.id}</td>
                    <td className="text-sm">{t.job_type || '—'}</td>
                    <td className="text-sm">{t.renter_name || '—'}</td>
                    <td className="text-sm">{t.provider_name || '—'}</td>
                    <td className="text-sm font-semibold text-dc1-text-primary">{halalaToSar(t.actual_cost_halala || 0)}</td>
                    <td className="text-sm text-dc1-amber">{halalaToSar(t.dc1_fee_halala || 0)}</td>
                    <td className="text-sm text-status-success">{halalaToSar(t.provider_earned_halala || 0)}</td>
                    <td className="text-xs text-dc1-text-secondary">{t.completed_at ? new Date(t.completed_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
                {txns.length === 0 && <tr><td colSpan={8} className="text-center text-dc1-text-muted py-6">No transactions yet</td></tr>}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {txnPagination && txnPagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-dc1-border">
              <span className="text-sm text-dc1-text-secondary">
                Page {txnPagination.page} of {txnPagination.total_pages} ({txnPagination.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setTxnPage(p => Math.max(1, p - 1))}
                  disabled={txnPage <= 1}
                  className="px-3 py-1 text-sm rounded bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary disabled:opacity-30 border border-dc1-border"
                >
                  Previous
                </button>
                <button
                  onClick={() => setTxnPage(p => Math.min(txnPagination.total_pages, p + 1))}
                  disabled={txnPage >= txnPagination.total_pages}
                  className="px-3 py-1 text-sm rounded bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary disabled:opacity-30 border border-dc1-border"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Discrepancies Alert */}
        {data?.discrepancies?.length > 0 && (
          <div className="card border-red-500/30">
            <h2 className="section-heading text-red-400 mb-4">Billing Discrepancies</h2>
            <p className="text-sm text-dc1-text-secondary mb-3">Jobs where provider_earned + dc1_fee ≠ actual_cost:</p>
            <div className="space-y-2">
              {data.discrepancies.map((d: any) => (
                <div key={d.id} className="text-xs font-mono text-red-300">
                  {d.job_id}: cost={d.actual_cost_halala} | provider={d.provider_earned_halala} + dc1={d.dc1_fee_halala} = {(d.provider_earned_halala || 0) + (d.dc1_fee_halala || 0)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Financial Reconciliation */}
        {recon && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="section-heading">Financial Reconciliation</h2>
                <div className="flex gap-2">
                  {[7, 14, 30, 90].map(days => (
                    <button
                      key={days}
                      onClick={() => setReconDays(days)}
                      className={`px-3 py-1 text-sm rounded border ${
                        reconDays === days
                          ? 'bg-dc1-amber text-dc1-void border-dc1-amber'
                          : 'bg-dc1-surface-l2 text-dc1-text-secondary border-dc1-border hover:text-dc1-text-primary'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-dc1-text-muted mb-4">Period: {recon.since ? new Date(recon.since).toLocaleDateString() : 'N/A'} — last {recon.period_days} days</p>

              {/* Summary Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                <StatCard label="Total Jobs" value={String(recon.summary?.total_completed_jobs || 0)} accent="default" />
                <StatCard label="Total Billed" value={`${halalaToSar(recon.summary?.total_billed_halala || 0)} SAR`} accent="default" />
                <StatCard
                  label="Split Mismatches"
                  value={String(recon.summary?.split_mismatches || 0)}
                  accent={recon.summary?.split_mismatches > 0 ? 'error' : 'success'}
                />
                <StatCard
                  label="Missing Billing"
                  value={String(recon.summary?.missing_billing || 0)}
                  accent={recon.summary?.missing_billing > 0 ? 'error' : 'success'}
                />
                <StatCard
                  label="Provider Drift"
                  value={String(recon.summary?.provider_drift_count || 0)}
                  accent={recon.summary?.provider_drift_count > 0 ? 'error' : 'success'}
                />
                <StatCard
                  label="Renter Drift"
                  value={String(recon.summary?.renter_drift_count || 0)}
                  accent={recon.summary?.renter_drift_count > 0 ? 'error' : 'success'}
                />
              </div>

              {/* Provider Earnings Drift Table */}
              {recon.issues?.provider_earnings_drift?.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-dc1-text-secondary mb-3">Provider Earnings Drift</h3>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Provider</th>
                          <th>Email</th>
                          <th>Recorded (SAR)</th>
                          <th>Computed (SAR)</th>
                          <th>Drift (SAR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recon.issues.provider_earnings_drift.map((p: any) => (
                          <tr key={p.id}>
                            <td className="text-sm font-medium text-dc1-text-primary">{p.name}</td>
                            <td className="text-sm text-dc1-text-secondary">{p.email}</td>
                            <td className="text-sm">{halalaToSar(p.recorded_earnings_halala)}</td>
                            <td className="text-sm">{halalaToSar(p.computed_earnings_halala)}</td>
                            <td className="text-sm font-semibold" style={{ color: p.drift !== 0 ? '#ef4444' : '#10b981' }}>
                              {halalaToSar(p.drift)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Renter Spend Drift Table */}
              {recon.issues?.renter_spend_drift?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-dc1-text-secondary mb-3">Renter Spend Drift</h3>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Renter</th>
                          <th>Email</th>
                          <th>Recorded (SAR)</th>
                          <th>Computed (SAR)</th>
                          <th>Drift (SAR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recon.issues.renter_spend_drift.map((r: any) => (
                          <tr key={r.id}>
                            <td className="text-sm font-medium text-dc1-text-primary">{r.name}</td>
                            <td className="text-sm text-dc1-text-secondary">{r.email}</td>
                            <td className="text-sm">{halalaToSar(r.recorded_spent)}</td>
                            <td className="text-sm">{halalaToSar(r.computed_spent)}</td>
                            <td className="text-sm font-semibold" style={{ color: r.drift !== 0 ? '#ef4444' : '#10b981' }}>
                              {halalaToSar(r.drift)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
