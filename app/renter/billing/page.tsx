'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useLanguage } from '../../lib/i18n'
import { getApiBase } from '../../../lib/api'

// ── SVG Icons ────────────────────────────────────────────────────────────────
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 11l4-4m0 0l4 4m-4-4V5" />
  </svg>
)
const JobsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)
const MarketplaceIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
)
const ModelsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
)
const PlaygroundIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)
const BillingIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m4 0h1M9 19h6a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)
const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  helpText?: string
  tooltip?: string
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  helpText,
  tooltip,
}) => {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      <div className="bg-dc1-bg-secondary rounded-lg border border-dc1-border p-6 hover:border-dc1-border-hover transition">
        <div className="flex items-start justify-between">
          <p className="text-dc1-text-secondary text-sm font-medium">{label}</p>
          {tooltip && (
            <div className="relative">
              <button
                className="text-dc1-text-muted hover:text-dc1-text-primary transition"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                title={tooltip}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
              {showTooltip && (
                <div className="absolute right-0 mt-2 w-48 p-2 bg-dc1-bg-primary border border-dc1-border rounded shadow-lg z-10 text-xs text-dc1-text-secondary">
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-2xl font-bold text-dc1-text-primary mt-2">{value}</p>
        {subtitle && <p className="text-sm text-dc1-text-muted mt-1">{subtitle}</p>}
        {helpText && <p className="text-xs text-dc1-text-muted mt-2 font-medium">{helpText}</p>}
      </div>
    </div>
  )
}

interface RenterData {
  name: string
  balance_halala: number
  total_spent_halala: number
  total_jobs: number
  recent_jobs: any[]
}

export default function BillingPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [renter, setRenter] = useState<RenterData | null>(null)
  const [renterName, setRenterName] = useState('')
  const API_BASE = getApiBase()

  const fetchRenterData = useCallback(async (key: string) => {
    try {
      const res = await fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(key)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.renter) {
          setRenter(data.renter)
          setRenterName(data.renter.name || 'Renter')
        }
      }
    } catch (err) {
      console.error('Failed to fetch renter data:', err)
    } finally {
      setLoading(false)
    }
  }, [API_BASE])

  useEffect(() => {
    const key = typeof window !== 'undefined' ? localStorage.getItem('dc1_renter_key') : null
    if (key) {
      fetchRenterData(key)
    } else {
      setLoading(false)
    }
  }, [fetchRenterData])

  const balance = renter ? (renter.balance_halala / 100).toFixed(2) : '0.00'
  const totalSpent = renter ? ((renter.total_spent_halala || 0) / 100).toFixed(2) : '0.00'
  const totalJobs = renter?.total_jobs || 0
  const recentJobs = renter?.recent_jobs || []

  const navItems = [
    { label: t('nav.dashboard'), href: '/renter', icon: <HomeIcon /> },
    { label: t('nav.marketplace'), href: '/renter/marketplace', icon: <MarketplaceIcon /> },
    { label: 'Models', href: '/renter/models', icon: <ModelsIcon /> },
    { label: t('nav.playground'), href: '/renter/playground', icon: <PlaygroundIcon /> },
    { label: t('nav.jobs'), href: '/renter/jobs', icon: <JobsIcon /> },
    { label: t('nav.billing'), href: '/renter/billing', icon: <BillingIcon /> },
    { label: t('nav.analytics'), href: '/renter/analytics', icon: <ChartIcon /> },
    { label: t('nav.settings'), href: '/renter/settings', icon: <GearIcon /> },
  ]

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renterName || undefined}>
      <div className="min-h-screen bg-dc1-bg-primary text-dc1-text-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">

            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-dc1-text-primary">Billing & Usage</h1>
              <p className="text-dc1-text-secondary mt-1">
                Track your compute spending, API usage, and credits
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                label="Account Balance"
                value={`${balance} SAR`}
                helpText="Available balance for running jobs"
                tooltip="Top up your balance to submit inference jobs"
              />
              <StatCard
                label="Total Spent"
                value={`${totalSpent} SAR`}
                helpText="Lifetime spending across all jobs"
                tooltip="Sum of all completed and billable job costs"
              />
              <StatCard
                label="Jobs Run"
                value={totalJobs}
                helpText="Total jobs submitted"
                tooltip="Includes completed, failed, and cancelled jobs"
              />
              <StatCard
                label="Recent Jobs"
                value={recentJobs.length}
                helpText="Jobs in recent history"
                tooltip="Recent job activity on your account"
              />
            </div>

            {/* Usage Table */}
            <div className="bg-dc1-bg-secondary rounded-lg border border-dc1-border overflow-hidden">
              <div className="px-6 py-4 border-b border-dc1-border">
                <h2 className="text-lg font-semibold text-dc1-text-primary">
                  Recent Usage
                </h2>
              </div>

              {loading ? (
                <div className="px-6 py-12 text-center text-dc1-text-muted">
                  <div className="animate-spin h-6 w-6 border-2 border-dc1-accent-primary border-t-transparent rounded-full mx-auto mb-3" />
                  <p>Loading usage data...</p>
                </div>
              ) : recentJobs.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-dc1-text-primary font-semibold">No inference jobs yet</p>
                  <p className="text-dc1-text-secondary mt-2">
                    Submit your first job from the Playground to see usage data here.
                  </p>
                  <Link
                    href="/renter/playground"
                    className="mt-4 inline-block text-dc1-accent-primary hover:underline font-medium"
                  >
                    Open Playground →
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-dc1-bg-primary border-b border-dc1-border">
                        <th className="px-6 py-3 text-left text-xs font-medium text-dc1-text-secondary uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-dc1-text-secondary uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-dc1-text-secondary uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-dc1-text-secondary uppercase tracking-wider">
                          Cost
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-dc1-text-secondary uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dc1-border">
                      {recentJobs.map((job: any, i: number) => {
                        const statusMap: Record<string, { label: string; bg: string; text: string }> = {
                          completed: { label: '✓ Complete', bg: 'bg-green-100', text: 'text-green-700' },
                          running: { label: '⏳ Running', bg: 'bg-blue-100', text: 'text-blue-700' },
                          queued: { label: '⏳ Queued', bg: 'bg-blue-100', text: 'text-blue-700' },
                          failed: { label: '✗ Failed', bg: 'bg-red-100', text: 'text-red-700' },
                          cancelled: { label: '⊘ Cancelled', bg: 'bg-orange-100', text: 'text-orange-700' },
                        }
                        const status = statusMap[job.status] || statusMap.completed
                        const costSar = job.actual_cost_halala ? (job.actual_cost_halala / 100).toFixed(2) : '—'
                        const date = job.submitted_at ? new Date(job.submitted_at).toLocaleDateString() : '—'
                        const duration = job.actual_duration_minutes
                          ? `${Math.floor(job.actual_duration_minutes)}m ${Math.round((job.actual_duration_minutes % 1) * 60)}s`
                          : '—'
                        return (
                          <tr key={job.id || i} className="hover:bg-dc1-bg-primary transition">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-dc1-text-secondary">
                              {date}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-dc1-text-primary font-medium">
                              {job.job_type || 'gpu_job'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-dc1-text-secondary">
                              {duration}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dc1-accent-primary">
                              {costSar !== '—' ? `${costSar} SAR` : '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-3 py-1 rounded-full ${status.bg} ${status.text} text-xs font-medium`}>
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* CTA Buttons & Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Primary Action */}
              <div className="bg-dc1-accent-primary bg-opacity-10 border border-dc1-accent-primary rounded-lg p-4">
                <p className="text-sm font-semibold text-dc1-accent-primary mb-2">💳 Add Funds</p>
                <p className="text-sm text-dc1-text-secondary mb-3">
                  Top up your account to continue running inference jobs
                </p>
                <Link
                  href="#topup"
                  className="inline-block px-4 py-2 bg-dc1-accent-primary text-white rounded-lg hover:opacity-90 transition font-medium text-sm"
                >
                  Add Credits Now
                </Link>
              </div>

              {/* Secondary Action */}
              <div className="bg-dc1-bg-secondary border border-dc1-border rounded-lg p-4">
                <p className="text-sm font-semibold text-dc1-text-primary mb-2">🔑 API Integration</p>
                <p className="text-sm text-dc1-text-secondary mb-3">
                  Manage your API keys and integrate DCP into your application
                </p>
                <Link
                  href="/renter/settings"
                  className="inline-block px-4 py-2 border border-dc1-border text-dc1-text-primary rounded-lg hover:bg-dc1-border transition font-medium text-sm"
                >
                  Manage Keys
                </Link>
              </div>

              {/* Tertiary Action */}
              <div className="bg-dc1-bg-secondary border border-dc1-border rounded-lg p-4">
                <p className="text-sm font-semibold text-dc1-text-primary mb-2">📄 Invoices</p>
                <p className="text-sm text-dc1-text-secondary mb-3">
                  Download invoices and billing reports for accounting
                </p>
                <button
                  disabled
                  title="Coming in next update"
                  className="inline-block px-4 py-2 border border-dc1-border text-dc1-text-muted rounded-lg opacity-50 cursor-not-allowed font-medium text-sm"
                >
                  Export Reports
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
