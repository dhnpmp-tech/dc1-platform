'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../components/layout/DashboardLayout'
import StatCard from '../components/ui/StatCard'
import StatusBadge from '../components/ui/StatusBadge'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

interface RenterInfo {
  id: number
  name: string
  email: string
  organization: string
  balance_halala: number
  api_key: string
  total_spent_halala?: number
  total_jobs?: number
}

interface GPU {
  id: number
  provider_id: number
  provider_name: string
  gpu_model: string
  vram_gb: number
  price_per_hour: number
  status: 'online' | 'offline'
}

interface Job {
  id: string
  job_type: string
  status: 'running' | 'completed' | 'pending' | 'failed'
  cost: number
  duration: number
  submitted_at: string
}

// SVG Icon Components
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

export default function RenterDashboard() {
  const [renter, setRenter] = useState<RenterInfo | null>(null)
  const [gpus, setGpus] = useState<GPU[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [authChecking, setAuthChecking] = useState(true)
  const [renterKey, setRenterKey] = useState('')

  // Check authentication
  useEffect(() => {
    const key = typeof window !== 'undefined' ? localStorage.getItem('dc1_renter_key') : null
    if (key) {
      setRenterKey(key)
      verifyKey(key)
    } else {
      setAuthChecking(false)
    }
  }, [])

  const verifyKey = async (key: string) => {
    setAuthChecking(true)
    try {
      const res = await fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(key)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.renter) {
          setRenter(data.renter)
          setRenterKey(key)
          // Fetch additional data
          fetchGPUs()
          fetchJobs(key)
        } else {
          setRenter(null)
          localStorage.removeItem('dc1_renter_key')
        }
      } else {
        setRenter(null)
        localStorage.removeItem('dc1_renter_key')
      }
    } catch (err) {
      console.error('Auth error:', err)
      setRenter(null)
    } finally {
      setAuthChecking(false)
    }
  }

  const fetchGPUs = async () => {
    try {
      const res = await fetch(`${API_BASE}/renters/available-providers`)
      if (res.ok) {
        const data = await res.json()
        const gpusData = data.providers?.map((p: any) => ({
          id: p.id,
          provider_id: p.id,
          provider_name: p.name,
          gpu_model: p.gpu_model,
          vram_gb: p.vram_gb,
          price_per_hour: 0.5,
          status: 'online' as const,
        })) || []
        setGpus(gpusData)
      }
    } catch (err) {
      console.error('Failed to fetch GPUs:', err)
    }
  }

  const fetchJobs = async (key: string) => {
    try {
      const res = await fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(key)}`)
      if (res.ok) {
        const data = await res.json()
        const jobsData = data.recent_jobs?.map((j: any) => ({
          id: j.job_id,
          job_type: j.job_type,
          status: j.status,
          cost: j.cost_halala / 100,
          duration: j.duration_minutes,
          submitted_at: j.submitted_at,
        })) || []
        setJobs(jobsData)
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('dc1_renter_key')
    setRenter(null)
    setRenterKey('')
    window.location.href = '/'
  }

  // Navigation items
  const navItems = [
    { label: 'Dashboard', href: '/renter', icon: <HomeIcon /> },
    { label: 'Marketplace', href: '/renter/marketplace', icon: <MarketplaceIcon /> },
    { label: 'My Jobs', href: '/renter/jobs', icon: <JobsIcon /> },
    { label: 'Billing', href: '/renter/billing', icon: <BillingIcon /> },
  ]

  if (authChecking) {
    return (
      <div className="min-h-screen bg-dc1-void flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!renter) {
    return (
      <div className="min-h-screen bg-dc1-void flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <svg className="w-16 h-16 text-dc1-amber mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-dc1-text-primary mb-2">Welcome Back</h1>
          <p className="text-dc1-text-secondary mb-8">
            Sign in with your API key to access your renter dashboard.
          </p>

          <form
            onSubmit={e => {
              e.preventDefault()
              const keyInput = (e.target as HTMLFormElement).querySelector('input')?.value
              if (keyInput) {
                verifyKey(keyInput)
              }
            }}
            className="space-y-4"
          >
            <input
              type="password"
              placeholder="Enter your API key"
              className="input"
              required
            />
            <button type="submit" className="btn btn-primary w-full">
              Sign In
            </button>
          </form>

          <p className="text-sm text-dc1-text-secondary mt-6">
            Don't have an account?{' '}
            <a href="/renter/register" className="text-dc1-amber hover:underline">
              Register here
            </a>
          </p>
        </div>
      </div>
    )
  }

  const balance = renter.balance_halala / 100
  const totalSpent = (renter.total_spent_halala || 0) / 100
  const totalJobs = renter.total_jobs || 0
  const onlineGPUs = gpus.filter(g => g.status === 'online').length

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renter.name}>
      <div className="space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Account Balance" value={`$${balance.toFixed(2)}`} accent="amber" />
          <StatCard label="Total Spent" value={`$${totalSpent.toFixed(2)}`} accent="default" />
          <StatCard label="Jobs Run" value={totalJobs.toString()} accent="default" />
          <StatCard label="Online GPUs" value={onlineGPUs.toString()} accent="success" />
        </div>

        {/* Available GPUs Section */}
        <section>
          <h2 className="section-heading mb-4">Available GPUs</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>GPU Model</th>
                  <th>VRAM</th>
                  <th>Price/Hour</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {gpus.length > 0 ? (
                  gpus.map(gpu => (
                    <tr key={gpu.id}>
                      <td className="font-medium">{gpu.provider_name}</td>
                      <td>{gpu.gpu_model}</td>
                      <td>{gpu.vram_gb}GB</td>
                      <td className="text-dc1-amber font-semibold">${gpu.price_per_hour.toFixed(2)}</td>
                      <td>
                        <StatusBadge status={gpu.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-dc1-text-secondary">
                      No GPUs available at the moment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Jobs Section */}
        <section>
          <h2 className="section-heading mb-4">Recent Jobs</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Cost</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length > 0 ? (
                  jobs.map(job => (
                    <tr key={job.id}>
                      <td className="font-mono text-sm">{job.id.slice(0, 8)}</td>
                      <td>{job.job_type}</td>
                      <td>
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="text-dc1-amber font-semibold">${job.cost.toFixed(2)}</td>
                      <td>{job.duration}m</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-dc1-text-secondary">
                      No jobs yet. Start by submitting a job!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="section-heading mb-4">Quick Actions</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="/renter/jobs/submit" className="btn btn-primary flex-1">
              Submit New Job
            </a>
            <a href="/renter/marketplace" className="btn btn-secondary flex-1">
              Browse Marketplace
            </a>
            <a href="/renter/billing" className="btn btn-outline flex-1">
              Manage Billing
            </a>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}
