'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/app/components/layout/DashboardLayout'
import StatCard from '@/app/components/ui/StatCard'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

export default function BillingPage() {
  const router = useRouter()
  const [renter, setRenter] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const key = localStorage.getItem('dc1_renter_key')
    if (!key) { router.push('/login'); return }

    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(key)}`)
        if (!res.ok) { localStorage.removeItem('dc1_renter_key'); router.push('/login'); return }
        const data = await res.json()
        setRenter(data.renter)
        setJobs(data.recent_jobs || [])
      } catch (err) {
        console.error('Billing fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [router])

  const navItems = [
    { label: 'Dashboard', href: '/renter', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M9 21h6a2 2 0 002-2V9l-7-4-7 4v10a2 2 0 002 2z" /></svg> },
    { label: 'Marketplace', href: '/renter/marketplace', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
    { label: 'Billing', href: '/renter/billing', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  ]

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} role="renter" userName="">
        <div className="text-dc1-text-secondary">Loading billing data...</div>
      </DashboardLayout>
    )
  }

  if (!renter) {
    return (
      <DashboardLayout navItems={navItems} role="renter" userName="">
        <div className="text-dc1-text-secondary">Unable to load billing data.</div>
      </DashboardLayout>
    )
  }

  const balance = (renter.balance_halala || 0) / 100
  const totalSpent = (renter.total_spent_halala || 0) / 100
  const totalJobs = renter.total_jobs || 0

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renter.name || 'Renter'}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Billing & Usage</h1>
        <p className="text-dc1-text-secondary">Track your compute spending and job history</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Balance" value={`${balance.toFixed(2)} SAR`} accent="amber" />
        <StatCard label="Total Spent" value={`${totalSpent.toFixed(2)} SAR`} accent="default" />
        <StatCard label="Total Jobs" value={String(totalJobs)} accent="info" />
      </div>

      {/* Rate card */}
      <div className="card mb-8">
        <h2 className="section-heading mb-4">Compute Rates</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-dc1-surface-l2 rounded-lg p-4 border border-dc1-border/50">
            <p className="text-sm text-dc1-text-secondary mb-1">LLM Inference</p>
            <p className="text-xl font-bold text-dc1-amber">15 halala/min</p>
            <p className="text-xs text-dc1-text-muted mt-1">0.15 SAR per minute</p>
          </div>
          <div className="bg-dc1-surface-l2 rounded-lg p-4 border border-dc1-border/50">
            <p className="text-sm text-dc1-text-secondary mb-1">Image Generation</p>
            <p className="text-xl font-bold text-dc1-amber">20 halala/min</p>
            <p className="text-xs text-dc1-text-muted mt-1">0.20 SAR per minute</p>
          </div>
        </div>
      </div>

      {/* Job history */}
      <div className="card">
        <h2 className="section-heading mb-4">Recent Jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-dc1-text-muted py-4">No jobs yet. <Link href="/renter" className="text-dc1-amber hover:underline">Submit your first job</Link> from the dashboard.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Job ID</th><th>Type</th><th>Status</th><th>Duration</th><th>Cost</th><th>Date</th></tr>
              </thead>
              <tbody>
                {jobs.map((job: any) => (
                  <tr key={job.id}>
                    <td className="font-mono text-sm text-dc1-amber">#{job.id}</td>
                    <td className="text-sm">{job.job_type === 'image_gen' ? 'Image Gen' : 'LLM'}</td>
                    <td className="text-sm">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        job.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                        job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>{job.status}</span>
                    </td>
                    <td className="text-sm text-dc1-text-secondary">{job.execution_time_ms ? `${(job.execution_time_ms / 1000).toFixed(1)}s` : '—'}</td>
                    <td className="text-sm font-medium">{job.total_cost_halala ? `${(job.total_cost_halala / 100).toFixed(2)} SAR` : '—'}</td>
                    <td className="text-sm text-dc1-text-secondary">{job.created_at ? new Date(job.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
