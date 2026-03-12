'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/app/components/layout/DashboardLayout'
import StatCard from '@/app/components/ui/StatCard'
import StatusBadge from '@/app/components/ui/StatusBadge'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface Provider {
  id: string
  name: string
  email: string
  gpuCount: number
  joinsDate: string
}

interface Job {
  id: string
  provider: string
  renter: string
  gpu: string
  status: 'running' | 'completed' | 'pending' | 'failed'
  duration: string
}

interface FleetItem {
  model: string
  units: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [isAuthed, setIsAuthed] = useState(false)

  useEffect(() => {
    // Check authentication
    const token = typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') : null
    if (!token) {
      router.push('/login')
      return
    }

    // Get user data
    const userDataStr = typeof window !== 'undefined' ? localStorage.getItem('dc1_user_data') : null
    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr)
        setUserName(userData.userName || 'Admin')
      } catch (e) {
        setUserName('Admin')
      }
    }

    setIsAuthed(true)
  }, [router])

  if (!isAuthed) {
    return <div className="flex items-center justify-center min-h-screen text-dc1-text-secondary">Loading...</div>
  }

  // SVG Icons as components
  const HomeIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M9 21h6a2 2 0 002-2V9l-7-4-7 4v10a2 2 0 002 2z" />
    </svg>
  )

  const ServerIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2m0 0a2 2 0 002-2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2" />
    </svg>
  )

  const BoltIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )

  const LinkIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  )

  const BrainIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0m-9 5h.01M9 9h.01" />
    </svg>
  )

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/admin', icon: <HomeIcon /> },
    { label: 'Providers', href: '/admin/providers', icon: <ServerIcon /> },
    { label: 'Jobs', href: '/admin/jobs', icon: <BoltIcon /> },
    { label: 'Connections', href: '/admin/connections', icon: <LinkIcon /> },
    { label: 'Intelligence', href: '/admin/intelligence', icon: <BrainIcon /> },
  ]

  // Mock data
  const recentProviders: Provider[] = [
    { id: '1', name: 'TechMiner Corp', email: 'contact@techminer.com', gpuCount: 42, joinsDate: '2025-03-10' },
    { id: '2', name: 'DataFlow Systems', email: 'admin@dataflow.io', gpuCount: 18, joinsDate: '2025-03-09' },
    { id: '3', name: 'Neural Networks Ltd', email: 'ops@neural.ai', gpuCount: 55, joinsDate: '2025-03-08' },
    { id: '4', name: 'CloudPower Inc', email: 'support@cloudpower.co', gpuCount: 31, joinsDate: '2025-03-07' },
  ]

  const activeJobs: Job[] = [
    { id: 'JOB001', provider: 'TechMiner Corp', renter: 'ML Research Labs', gpu: 'RTX 4090', status: 'running', duration: '2h 45m' },
    { id: 'JOB002', provider: 'DataFlow Systems', renter: 'AI Startup XYZ', gpu: 'A100', status: 'running', duration: '1h 12m' },
    { id: 'JOB003', provider: 'Neural Networks Ltd', renter: 'Image Gen Studio', gpu: 'RTX 3090', status: 'completed', duration: '3h 22m' },
    { id: 'JOB004', provider: 'CloudPower Inc', renter: 'Data Analytics Co', gpu: 'RTX 4090', status: 'pending', duration: '0m' },
    { id: 'JOB005', provider: 'TechMiner Corp', renter: 'Training Hub', gpu: 'A100', status: 'running', duration: '5h 18m' },
  ]

  const fleetOverview: FleetItem[] = [
    { model: 'RTX 4090', units: 45 },
    { model: 'A100', units: 12 },
    { model: 'RTX 3090', units: 28 },
    { model: 'H100', units: 8 },
    { model: 'RTX 4080', units: 19 },
  ]

  const systemHealth = [
    { service: 'API Server', status: 'online' as const },
    { service: 'Database', status: 'online' as const },
    { service: 'Daemon Network', status: 'online' as const },
  ]

  return (
    <DashboardLayout navItems={navItems} role="admin" userName={userName}>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Admin Dashboard</h1>
        <p className="text-dc1-text-secondary">Platform overview and system management</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Providers"
          value="247"
          accent="default"
          trend={{ value: '+12 this week', positive: true }}
        />
        <StatCard
          label="Online GPUs"
          value="412"
          accent="success"
          trend={{ value: '+18 this week', positive: true }}
        />
        <StatCard
          label="Active Jobs"
          value="58"
          accent="info"
          trend={{ value: '+5 this week', positive: true }}
        />
        <StatCard
          label="Revenue Today"
          value="$4,240"
          accent="amber"
          trend={{ value: '+8.2%', positive: true }}
        />
      </div>

      {/* System Health */}
      <div className="card mb-8">
        <h2 className="section-heading mb-6">System Health</h2>
        <div className="space-y-3">
          {systemHealth.map((item) => (
            <div key={item.service} className="flex items-center justify-between p-3 bg-dc1-surface-l2 rounded-md">
              <span className="text-sm text-dc1-text-primary font-medium">{item.service}</span>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Signups */}
      <div className="card mb-8">
        <h2 className="section-heading mb-6">Recent Provider Signups</h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Provider Name</th>
                <th>Email</th>
                <th>GPU Count</th>
                <th>Join Date</th>
              </tr>
            </thead>
            <tbody>
              {recentProviders.map((provider) => (
                <tr key={provider.id}>
                  <td className="font-medium">{provider.name}</td>
                  <td className="text-sm">{provider.email}</td>
                  <td>
                    <span className="text-dc1-amber font-semibold">{provider.gpuCount}</span>
                  </td>
                  <td className="text-sm">{provider.joinsDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Jobs */}
      <div className="card mb-8">
        <h2 className="section-heading mb-6">Active & Recent Jobs</h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Provider</th>
                <th>Renter</th>
                <th>GPU Model</th>
                <th>Status</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {activeJobs.map((job) => (
                <tr key={job.id}>
                  <td className="font-mono text-sm text-dc1-amber">{job.id}</td>
                  <td className="text-sm">{job.provider}</td>
                  <td className="text-sm">{job.renter}</td>
                  <td className="text-sm font-medium">{job.gpu}</td>
                  <td>
                    <StatusBadge
                      status={job.status}
                      size="sm"
                      pulse={job.status === 'running'}
                    />
                  </td>
                  <td className="text-sm text-dc1-text-secondary">{job.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fleet Overview */}
      <div className="card">
        <h2 className="section-heading mb-6">GPU Fleet Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fleetOverview.map((item) => (
            <div
              key={item.model}
              className="bg-dc1-surface-l2 rounded-lg p-4 border border-dc1-border/50 hover:border-dc1-amber/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dc1-text-secondary mb-1">{item.model}</p>
                  <p className="text-2xl font-bold text-dc1-text-primary">{item.units}</p>
                  <p className="text-xs text-dc1-text-muted mt-1">units available</p>
                </div>
                <div className="text-right">
                  <div className="w-12 h-12 bg-dc1-amber/10 rounded-lg flex items-center justify-center">
                    <BoltIcon />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
