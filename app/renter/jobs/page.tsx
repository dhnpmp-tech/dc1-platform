'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatusBadge from '../../components/ui/StatusBadge'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

interface Job {
  id: number
  job_id: string
  job_type: string
  status: string
  submitted_at: string
  completed_at: string
  actual_cost_halala: number
}

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

const navItems = [
  { label: 'Dashboard', href: '/renter', icon: <HomeIcon /> },
  { label: 'Marketplace', href: '/renter/marketplace', icon: <MarketplaceIcon /> },
  { label: 'Playground', href: '/renter/playground', icon: <PlaygroundIcon /> },
  { label: 'My Jobs', href: '/renter/jobs', icon: <JobsIcon /> },
  { label: 'Billing', href: '/renter/billing', icon: <BillingIcon /> },
]

export default function RenterJobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [renterName, setRenterName] = useState('Renter')
  const [totalSpent, setTotalSpent] = useState(0)

  useEffect(() => {
    const apiKey = localStorage.getItem('dc1_renter_key')
    if (!apiKey) {
      router.push('/login')
      return
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(apiKey)}`)
        if (!res.ok) {
          localStorage.removeItem('dc1_renter_key')
          router.push('/login')
          return
        }
        const data = await res.json()
        setRenterName(data.renter?.name || 'Renter')
        setTotalSpent((data.renter?.total_spent_halala || 0) / 100)
        setJobs(data.recent_jobs || [])
      } catch (err) {
        console.error('Failed to load jobs:', err)
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

  const completedJobs = jobs.filter(j => j.status === 'completed').length
  const failedJobs = jobs.filter(j => j.status === 'failed').length

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renterName}>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-dc1-text-primary">My Jobs</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-sm text-dc1-text-secondary">Total Jobs</p>
            <p className="text-2xl font-bold text-dc1-text-primary">{jobs.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-dc1-text-secondary">Completed</p>
            <p className="text-2xl font-bold text-status-success">{completedJobs}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-dc1-text-secondary">Failed</p>
            <p className="text-2xl font-bold text-status-error">{failedJobs}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-dc1-text-secondary">Total Spent</p>
            <p className="text-2xl font-bold text-dc1-amber">{totalSpent.toFixed(2)} SAR</p>
          </div>
        </div>

        {/* Jobs Table */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Type</th>
                <th>Submitted</th>
                <th>Completed</th>
                <th>Status</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length > 0 ? (
                jobs.map(j => {
                  const duration = j.completed_at && j.submitted_at
                    ? Math.round((new Date(j.completed_at).getTime() - new Date(j.submitted_at).getTime()) / 1000)
                    : 0
                  return (
                    <tr key={j.id}>
                      <td className="font-mono text-sm">{(j.job_id || `#${j.id}`).slice(0, 16)}</td>
                      <td className="text-sm">{(j.job_type || '').replace(/_/g, ' ')}</td>
                      <td className="text-sm text-dc1-text-secondary">
                        {j.submitted_at
                          ? new Date(j.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="text-sm text-dc1-text-secondary">
                        {j.completed_at
                          ? `${duration}s`
                          : '—'}
                      </td>
                      <td><StatusBadge status={j.status as any} /></td>
                      <td className="text-dc1-amber font-semibold">
                        {j.actual_cost_halala
                          ? `${(j.actual_cost_halala / 100).toFixed(2)} SAR`
                          : '—'}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-dc1-text-secondary">
                    No jobs yet. Head to the{' '}
                    <a href="/renter/playground" className="text-dc1-amber hover:underline">GPU Playground</a>
                    {' '}to run your first job!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
