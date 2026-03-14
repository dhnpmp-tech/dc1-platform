'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../components/layout/DashboardLayout'
import StatusBadge from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'

// Mock data interface
interface ProviderData {
  id: string
  name: string
  status: 'online' | 'offline'
  todayEarnings: number
  totalEarnings: number
  jobsCompleted: number
  gpuUptime: number
  gpuModel: string
  temperature: number
  gpuUsage: number
  vramUsage: number
  activeJob?: {
    id: string
    jobType: string
    status: string
    startTime: string
  }
  recentJobs: Array<{
    id: string
    jobType: string
    duration: number
    earnings: number
    status: 'completed' | 'failed'
    completedAt: string
  }>
}

// SVG Icon components
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

// Provider nav items
const getNavItems = () => [
  { label: 'Dashboard', href: '/provider', icon: <HomeIcon /> },
  { label: 'Jobs', href: '/provider/jobs', icon: <LightningIcon /> },
  { label: 'Earnings', href: '/provider/earnings', icon: <CurrencyIcon /> },
  { label: 'Settings', href: '/provider/settings', icon: <GearIcon /> },
]

// Mock data generator
const generateMockData = (): ProviderData => ({
  id: 'provider-001',
  name: 'Alex Provider',
  status: 'online',
  todayEarnings: 152.50,
  totalEarnings: 4328.75,
  jobsCompleted: 287,
  gpuUptime: 94.8,
  gpuModel: 'NVIDIA RTX 4090',
  temperature: 68,
  gpuUsage: 78,
  vramUsage: 58,
  activeJob: {
    id: 'job-12345',
    jobType: 'Model Training',
    status: 'running',
    startTime: '2 hours ago'
  },
  recentJobs: [
    { id: 'job-5', jobType: 'Data Processing', duration: 45, earnings: 28.50, status: 'completed', completedAt: '1 hour ago' },
    { id: 'job-4', jobType: 'Model Inference', duration: 120, earnings: 42.00, status: 'completed', completedAt: '3 hours ago' },
    { id: 'job-3', jobType: 'GPU Rendering', duration: 90, earnings: 31.50, status: 'completed', completedAt: '5 hours ago' },
    { id: 'job-2', jobType: 'ML Training', duration: 180, earnings: 50.00, status: 'completed', completedAt: 'Yesterday' },
    { id: 'job-1', jobType: 'Data Analysis', duration: 60, earnings: 21.00, status: 'completed', completedAt: '2 days ago' },
  ]
})

// Temperature gauge color
const getTempColor = (temp: number): string => {
  if (temp < 70) return 'bg-status-success'
  if (temp < 80) return 'bg-status-warning'
  return 'bg-status-error'
}

export default function ProviderDashboard() {
  const router = useRouter()
  const [providerData, setProviderData] = useState<ProviderData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const API_BASE =
      typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? '/api/dc1'
        : 'http://76.13.179.86:8083/api'

    const initializeDashboard = async () => {
      // Check for API key
      const apiKey = localStorage.getItem('dc1_provider_key')
      if (!apiKey) {
        router.push('/provider/register')
        return
      }

      try {
        // Fetch real provider data from VPS
        const res = await fetch(`${API_BASE}/providers/me?key=${encodeURIComponent(apiKey)}`)

        if (!res.ok) {
          // Invalid key — clear and redirect
          localStorage.removeItem('dc1_provider_key')
          router.push('/login')
          return
        }

        const data = await res.json()
        const provider = data.provider || {}

        // Map real data to ProviderData shape, filling gaps with defaults
        setProviderData({
          id: String(provider.id || ''),
          name: provider.name || 'Provider',
          status: provider.status === 'online' || provider.status === 'idle' ? 'online' : 'offline',
          todayEarnings: (provider.today_earnings_halala || 0) / 100,
          totalEarnings: (provider.total_earnings_halala || 0) / 100,
          jobsCompleted: provider.total_jobs || 0,
          gpuUptime: provider.uptime_percent || 0,
          gpuModel: provider.gpu_model || 'Unknown GPU',
          temperature: provider.gpu_temp || 0,
          gpuUsage: provider.gpu_usage || 0,
          vramUsage: provider.vram_usage || 0,
          activeJob: provider.active_job ? {
            id: provider.active_job.job_id,
            jobType: provider.active_job.job_type,
            status: provider.active_job.status,
            startTime: provider.active_job.started_at || '',
          } : undefined,
          recentJobs: (data.recent_jobs || []).map((j: any) => ({
            id: j.job_id || String(j.id),
            jobType: j.job_type || 'Unknown',
            duration: j.actual_duration_minutes || 0,
            earnings: (j.provider_earned_halala || 0) / 100,
            status: j.status === 'completed' ? 'completed' : 'failed',
            completedAt: j.completed_at || '',
          })),
        })
      } catch (error) {
        console.error('Failed to load provider data:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeDashboard()
    const interval = setInterval(initializeDashboard, 30000)
    return () => clearInterval(interval)
  }, [router])

  if (loading) {
    return (
      <DashboardLayout navItems={getNavItems()} role="provider" userName="Provider">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-dc1-surface-l2 rounded skeleton" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-dc1-surface-l2 rounded skeleton" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!providerData) {
    return (
      <DashboardLayout navItems={getNavItems()} role="provider" userName="Provider">
        <div className="card">
          <p className="text-dc1-text-secondary">Failed to load provider data</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout navItems={getNavItems()} role="provider" userName={providerData.name}>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-3xl font-bold text-dc1-text-primary">Provider Dashboard</h1>
          <StatusBadge status={providerData.status} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Today's Earnings"
            value={`${providerData.todayEarnings.toFixed(2)} SAR`}
            accent="amber"
            icon={<CurrencyIcon />}
          />
          <StatCard
            label="Total Earnings"
            value={`${providerData.totalEarnings.toFixed(2)} SAR`}
            accent="success"
            icon={<CurrencyIcon />}
          />
          <StatCard
            label="Jobs Completed"
            value={providerData.jobsCompleted}
            accent="default"
            icon={<LightningIcon />}
          />
          <StatCard
            label="GPU Uptime"
            value={`${providerData.gpuUptime}%`}
            accent="info"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
        </div>

        {/* GPU Health Section */}
        <div className="card">
          <h2 className="section-heading mb-6">GPU Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* GPU Model */}
            <div>
              <p className="text-sm text-dc1-text-secondary mb-2">GPU Model</p>
              <p className="text-lg font-semibold text-dc1-text-primary">{providerData.gpuModel}</p>
            </div>

            {/* Temperature Gauge */}
            <div>
              <p className="text-sm text-dc1-text-secondary mb-2">Temperature</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2 bg-dc1-surface-l2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getTempColor(providerData.temperature)} transition-all`}
                      style={{ width: `${Math.min(providerData.temperature, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-dc1-text-primary w-12 text-right">
                  {providerData.temperature}°C
                </span>
              </div>
            </div>

            {/* Status Indicator */}
            <div>
              <p className="text-sm text-dc1-text-secondary mb-2">Status</p>
              <StatusBadge status="online" />
            </div>
          </div>

          {/* Usage Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-dc1-border">
            {/* GPU Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-dc1-text-secondary">GPU Usage</p>
                <span className="text-sm font-semibold text-dc1-text-primary">{providerData.gpuUsage}%</span>
              </div>
              <div className="h-2 bg-dc1-surface-l2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-dc1-amber transition-all"
                  style={{ width: `${providerData.gpuUsage}%` }}
                />
              </div>
            </div>

            {/* VRAM Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-dc1-text-secondary">VRAM Usage</p>
                <span className="text-sm font-semibold text-dc1-text-primary">{providerData.vramUsage}%</span>
              </div>
              <div className="h-2 bg-dc1-surface-l2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-status-info transition-all"
                  style={{ width: `${providerData.vramUsage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Current Job Section */}
        <div className="card">
          <h2 className="section-heading mb-4">Current Job</h2>
          {providerData.activeJob ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm text-dc1-text-secondary mb-1">Job Type</p>
                  <p className="text-lg font-semibold text-dc1-text-primary">{providerData.activeJob.jobType}</p>
                </div>
                <StatusBadge status="running" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-dc1-text-secondary mb-1">Job ID</p>
                  <p className="text-sm font-mono text-dc1-amber">{providerData.activeJob.id}</p>
                </div>
                <div>
                  <p className="text-sm text-dc1-text-secondary mb-1">Started</p>
                  <p className="text-sm text-dc1-text-primary">{providerData.activeJob.startTime}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-dc1-text-secondary">No active jobs</p>
            </div>
          )}
        </div>

        {/* Recent Activity Section */}
        <div className="card">
          <h2 className="section-heading mb-6">Recent Activity</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Job Type</th>
                  <th>Duration</th>
                  <th>Earnings</th>
                  <th>Status</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {providerData.recentJobs.length > 0 ? providerData.recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.jobType}</td>
                    <td>{job.duration > 0 ? `${job.duration} min` : '<1 min'}</td>
                    <td className="font-semibold text-status-success">{job.earnings > 0 ? `${job.earnings.toFixed(2)} SAR` : '—'}</td>
                    <td>
                      <StatusBadge
                        status={job.status === 'completed' ? 'completed' : 'failed'}
                        size="sm"
                      />
                    </td>
                    <td className="text-dc1-text-secondary">{job.completedAt ? new Date(job.completedAt).toLocaleString() : '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="text-center text-dc1-text-secondary py-6">No jobs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
