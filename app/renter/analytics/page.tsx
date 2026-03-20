'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatCard from '../../components/ui/StatCard'

const API_BASE = '/api/dc1'

interface RenterInfo {
  name: string
  balance_halala: number
  total_spent_halala: number
  total_jobs: number
  created_at: string
}

interface Job {
  id: number
  job_id: string
  job_type: string
  status: string
  submitted_at: string
  completed_at: string
  actual_cost_halala: number
}

// Nav icons (same as other renter pages)
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
const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

const navItems = [
  { label: 'Dashboard', href: '/renter', icon: <HomeIcon /> },
  { label: 'Marketplace', href: '/renter/marketplace', icon: <MarketplaceIcon /> },
  { label: 'Playground', href: '/renter/playground', icon: <PlaygroundIcon /> },
  { label: 'My Jobs', href: '/renter/jobs', icon: <JobsIcon /> },
  { label: 'Billing', href: '/renter/billing', icon: <BillingIcon /> },
  { label: 'Analytics', href: '/renter/analytics', icon: <ChartIcon /> },
  { label: 'Settings', href: '/renter/settings', icon: <GearIcon /> },
]

type DateRange = 'this_month' | 'last_month' | 'custom'

export default function RenterAnalyticsPage() {
  const router = useRouter()
  const [renter, setRenter] = useState<RenterInfo | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [downloadingReport, setDownloadingReport] = useState(false)

  useEffect(() => {
    const key = localStorage.getItem('dc1_renter_key')
    if (!key) {
      router.push('/login')
      return
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(key)}`)
        if (!res.ok) {
          localStorage.removeItem('dc1_renter_key')
          router.push('/login')
          return
        }
        const data = await res.json()
        setRenter(data.renter || null)
        setJobs(data.recent_jobs || [])
      } catch (err) {
        console.error('Failed to load analytics:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [router])

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} role="renter" userName="Renter">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (!renter) {
    return (
      <DashboardLayout navItems={navItems} role="renter" userName="Renter">
        <div className="card p-8 text-center">
          <p className="text-dc1-text-secondary">Failed to load analytics</p>
        </div>
      </DashboardLayout>
    )
  }

  const downloadReport = async () => {
    const key = localStorage.getItem('dc1_renter_key')
    if (!key || downloadingReport) return
    setDownloadingReport(true)
    try {
      const now = new Date()
      let from = ''
      let to = ''
      if (dateRange === 'this_month') {
        from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        to = now.toISOString().split('T')[0]
      } else if (dateRange === 'last_month') {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const last = new Date(now.getFullYear(), now.getMonth(), 0)
        from = first.toISOString().split('T')[0]
        to = last.toISOString().split('T')[0]
      } else {
        from = customFrom
        to = customTo
      }
      const params = new URLSearchParams({ key, format: 'csv' })
      if (from) params.set('from_date', from)
      if (to) params.set('to_date', to)
      const res = await fetch(`${API_BASE}/renters/me/jobs/export?${params}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dcp-report-${from || 'all'}-to-${to || 'all'}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Report download failed:', err)
    } finally {
      setDownloadingReport(false)
    }
  }

  // Compute analytics
  const totalSpent = (renter.total_spent_halala || 0) / 100
  const balance = (renter.balance_halala || 0) / 100
  const completedJobs = jobs.filter(j => j.status === 'completed')
  const failedJobs = jobs.filter(j => j.status === 'failed')
  const successRate = jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0

  // Job type breakdown
  const jobTypeMap: Record<string, { count: number; cost: number }> = {}
  for (const j of jobs) {
    const type = j.job_type || 'unknown'
    if (!jobTypeMap[type]) jobTypeMap[type] = { count: 0, cost: 0 }
    jobTypeMap[type].count++
    jobTypeMap[type].cost += (j.actual_cost_halala || 0) / 100
  }

  // Daily spending (last 7 days)
  const dayMap: Record<string, number> = {}
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    dayMap[key] = 0
  }
  for (const j of completedJobs) {
    if (j.completed_at) {
      const day = j.completed_at.split('T')[0]
      if (day in dayMap) {
        dayMap[day] += (j.actual_cost_halala || 0) / 100
      }
    }
  }
  const dailyData = Object.entries(dayMap).map(([day, spent]) => ({ day, spent }))
  const maxDailySpent = Math.max(...dailyData.map(d => d.spent), 0.01)

  // Average job cost
  const avgCost = completedJobs.length > 0
    ? completedJobs.reduce((sum, j) => sum + (j.actual_cost_halala || 0), 0) / completedJobs.length / 100
    : 0

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renter.name}>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-dc1-text-primary">Usage Analytics</h1>
            <p className="text-dc1-text-secondary text-sm mt-1">Track your GPU usage and spending patterns</p>
          </div>

          {/* Download Report */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as DateRange)}
              className="input text-sm min-h-[44px] px-3 py-2"
              aria-label="Report date range"
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
            {dateRange === 'custom' && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="input text-sm min-h-[44px] px-3 py-2"
                  aria-label="From date"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="input text-sm min-h-[44px] px-3 py-2"
                  aria-label="To date"
                />
              </>
            )}
            <button
              onClick={downloadReport}
              disabled={downloadingReport || (dateRange === 'custom' && (!customFrom || !customTo))}
              className="btn btn-secondary min-h-[44px] px-4 flex items-center gap-2 disabled:opacity-50"
              aria-label="Download report as CSV"
            >
              {downloadingReport ? (
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" aria-hidden="true" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              Download Report
            </button>
          </div>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Spent" value={`${totalSpent.toFixed(2)} SAR`} accent="amber" />
          <StatCard label="Success Rate" value={`${successRate}%`} accent="success" />
          <StatCard label="Avg Job Cost" value={`${avgCost.toFixed(2)} SAR`} accent="default" />
          <StatCard label="Balance" value={`${balance.toFixed(2)} SAR`} accent="info" />
        </div>

        {/* Daily Spending Chart */}
        <div className="card">
          <h2 className="section-heading mb-4">Daily Spending (Last 7 Days)</h2>
          {dailyData.every(d => d.spent === 0) ? (
            <p className="text-dc1-text-muted text-sm">No spending data in the last 7 days.</p>
          ) : (
            <div className="flex items-end gap-3 h-36">
              {dailyData.map(d => {
                const pct = Math.max(4, (d.spent / maxDailySpent) * 100)
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-dc1-amber font-medium">{d.spent.toFixed(2)}</span>
                    <div
                      className="w-full bg-gradient-to-t from-dc1-amber/60 to-dc1-amber rounded-t transition-all"
                      style={{ height: `${pct}%`, minHeight: '4px' }}
                    />
                    <span className="text-[10px] text-dc1-text-muted">
                      {new Date(d.day + 'T00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Job Type Breakdown */}
        <div className="card">
          <h2 className="section-heading mb-4">Usage by Job Type</h2>
          {Object.keys(jobTypeMap).length === 0 ? (
            <p className="text-dc1-text-muted text-sm">No jobs to analyze yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(jobTypeMap)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([type, data]) => {
                  const pct = jobs.length > 0 ? Math.round((data.count / jobs.length) * 100) : 0
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-dc1-text-primary font-medium">
                          {type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-dc1-text-muted">
                          {data.count} jobs — {data.cost.toFixed(2)} SAR
                        </span>
                      </div>
                      <div className="h-2 bg-dc1-surface-l2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-dc1-amber/80 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {/* Job Status Breakdown */}
        <div className="card">
          <h2 className="section-heading mb-4">Job Outcomes</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-dc1-surface-l2 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-status-success">{completedJobs.length}</div>
              <div className="text-xs text-dc1-text-muted mt-1">Completed</div>
            </div>
            <div className="bg-dc1-surface-l2 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-status-error">{failedJobs.length}</div>
              <div className="text-xs text-dc1-text-muted mt-1">Failed</div>
            </div>
            <div className="bg-dc1-surface-l2 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-dc1-text-primary">{jobs.length - completedJobs.length - failedJobs.length}</div>
              <div className="text-xs text-dc1-text-muted mt-1">Other</div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
