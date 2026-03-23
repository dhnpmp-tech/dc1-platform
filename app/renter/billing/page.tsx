'use client'

import { useState, useEffect } from 'react'
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
const PricingIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
  </svg>
)
const GpuCompareIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
)
const AnalyticsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  helpText?: string
  tooltip?: string
  warning?: string
  warningType?: 'info' | 'warning' | 'error'
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  helpText,
  tooltip,
  warning,
  warningType = 'info',
}) => {
  const [showTooltip, setShowTooltip] = useState(false)

  const warningBgColor = {
    info: 'bg-blue-50',
    warning: 'bg-yellow-50',
    error: 'bg-red-50',
  }

  const warningBorderColor = {
    info: 'border-blue-200',
    warning: 'border-yellow-200',
    error: 'border-red-200',
  }

  const warningTextColor = {
    info: 'text-blue-700',
    warning: 'text-yellow-700',
    error: 'text-red-700',
  }

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
      {warning && (
        <div className={`mt-2 p-2 rounded border ${warningBgColor[warningType]} ${warningBorderColor[warningType]}`}>
          <p className={`text-xs font-medium ${warningTextColor[warningType]}`}>
            {warningType === 'warning' && '⚠️ '}
            {warningType === 'error' && '❌ '}
            {warningType === 'info' && 'ℹ️ '}
            {warning}
          </p>
        </div>
      )}
    </div>
  )
}

export default function BillingPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  const navItems = [
    { label: t('nav.dashboard'), href: '/renter', icon: <HomeIcon /> },
    { label: t('nav.jobs'), href: '/renter/jobs', icon: <JobsIcon /> },
    { label: t('nav.marketplace'), href: '/renter/marketplace', icon: <MarketplaceIcon /> },
    { label: 'GPU Compare', href: '/renter/gpu-comparison', icon: <GpuCompareIcon /> },
    { label: 'Pricing', href: '/renter/pricing', icon: <PricingIcon /> },
    { label: 'Billing', href: '/renter/billing', icon: <BillingIcon /> },
    { label: t('nav.analytics'), href: '/renter/analytics', icon: <AnalyticsIcon /> },
    { label: t('nav.settings'), href: '/renter/settings', icon: <GearIcon /> },
  ]

  return (
    <DashboardLayout navItems={navItems} pageTitle="Billing & Usage">
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
                label="Total Spend (This Month)"
                value="2,450 SAR"
                subtitle="vs 1,890 SAR last month (+29%)"
                helpText="Sum of all inference jobs this calendar month"
                tooltip="Only billable jobs included (excludes failed/cancelled)"
              />
              <StatCard
                label="Available Credits"
                value="3,200 SAR"
                subtitle="From welcome credit + top-ups"
                helpText="Credit expires 7 days after topup unless renewed"
                tooltip="Credits expire automatically. Manage your credits at any time."
              />
              <StatCard
                label="Tokens Processed"
                value="2.4M"
                subtitle="vs 1.8M last month (+33%)"
                helpText="Total input + output tokens across all models"
                tooltip="1M tokens ≈ 750 pages of text. Input tokens usually cheaper than output."
              />
              <StatCard
                label="Avg Cost per 1K Tokens"
                value="0.89 SAR"
                subtitle="Best rate: Mistral 7B (0.80 SAR/1K)"
                helpText="Weighted average across all models used"
                tooltip="Calculated from: (total_spend / total_tokens) × 1000. Choose cheaper models to lower your average."
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
                  <p>Loading usage data...</p>
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
                          Model
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-dc1-text-secondary uppercase tracking-wider">
                          Tokens
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
                      {[...Array(5)].map((_, i) => {
                        const statuses = [
                          { label: '✓ Complete', bg: 'bg-green-100', text: 'text-green-700' },
                          { label: '⏳ In Progress', bg: 'bg-blue-100', text: 'text-blue-700' },
                          { label: '✗ Failed', bg: 'bg-red-100', text: 'text-red-700' },
                          { label: '⊘ Cancelled', bg: 'bg-orange-100', text: 'text-orange-700' },
                        ]
                        const status = statuses[i % statuses.length]
                        return (
                          <tr key={i} className="hover:bg-dc1-bg-primary transition">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-dc1-text-secondary">
                              03/{22 - i}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-dc1-text-primary font-medium">
                              Llama 3 8B
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-dc1-text-secondary">
                              45,320
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-dc1-text-secondary">
                              2m 34s
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dc1-accent-primary">
                              40.4 SAR
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

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="#topup"
                className="px-4 py-2 bg-dc1-accent-primary text-white rounded-lg hover:opacity-90 transition font-medium"
              >
                Add Credits
              </Link>
              <Link
                href="/renter/settings"
                className="px-4 py-2 border border-dc1-border text-dc1-text-primary rounded-lg hover:bg-dc1-bg-secondary transition font-medium"
              >
                View API Keys
              </Link>
              <button
                onClick={() => alert('CSV export coming soon')}
                className="px-4 py-2 border border-dc1-border text-dc1-text-primary rounded-lg hover:bg-dc1-bg-secondary transition font-medium"
              >
                Download Invoice
              </button>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
