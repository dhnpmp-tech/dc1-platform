'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatCard from '../../components/ui/StatCard'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

export default function BillingPage() {
  const router = useRouter()
  const [renter, setRenter] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [rotateConfirm, setRotateConfirm] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [topupAmount, setTopupAmount] = useState('')
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupSuccess, setTopupSuccess] = useState(false)
  const [topupError, setTopupError] = useState('')

  useEffect(() => {
    const key = localStorage.getItem('dc1_renter_key')
    if (!key) { router.push('/login'); return }
    setApiKey(key)

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

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRotateKey = async () => {
    setRotating(true)
    try {
      const res = await fetch(`${API_BASE}/renters/rotate-key`, {
        method: 'POST',
        headers: { 'x-renter-key': apiKey },
      })
      if (!res.ok) throw new Error('Failed to rotate key')
      const data = await res.json()
      const newKey = data.api_key
      localStorage.setItem('dc1_renter_key', newKey)
      setApiKey(newKey)
      setShowKey(true)
      setRotateConfirm(false)
    } catch (err) {
      console.error('Key rotation failed:', err)
      alert('Failed to rotate API key. Please try again.')
    } finally {
      setRotating(false)
    }
  }

  const handleTopup = async () => {
    const amountSar = parseFloat(topupAmount)
    if (!amountSar || amountSar <= 0) return
    setTopupLoading(true)
    setTopupSuccess(false)
    setTopupError('')
    try {
      const amountHalala = Math.round(amountSar * 100)
      const res = await fetch(`${API_BASE}/payments/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-renter-key': apiKey },
        body: JSON.stringify({ amount_halala: amountHalala }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setTopupError(err.error || 'Top-up failed. Please try again.')
        return
      }
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        setTopupError('No checkout URL returned. Please try again.')
      }
    } catch (err) {
      console.error('Top-up failed:', err)
      setTopupError('Top-up failed. Please try again.')
    } finally {
      setTopupLoading(false)
    }
  }

  const navItems = [
    { label: 'Dashboard', href: '/renter', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M9 21h6a2 2 0 002-2V9l-7-4-7 4v10a2 2 0 002 2z" /></svg> },
    { label: 'Marketplace', href: '/renter/marketplace', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
    { label: 'Playground', href: '/renter/playground', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
    { label: 'My Jobs', href: '/renter/jobs', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
    { label: 'Billing', href: '/renter/billing', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { label: 'Analytics', href: '/renter/analytics', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
    { label: 'Settings', href: '/renter/settings', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
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

      {/* Add Funds */}
      <div className="card mb-8">
        <h2 className="section-heading mb-4">Add Funds</h2>
        <p className="text-sm text-dc1-text-secondary mb-4">Top up your account balance to run GPU jobs.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {[5, 10, 25, 50].map(amt => (
                <button
                  key={amt}
                  onClick={() => setTopupAmount(String(amt))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    topupAmount === String(amt)
                      ? 'border-dc1-amber bg-dc1-amber/10 text-dc1-amber'
                      : 'border-dc1-border bg-dc1-surface-l2 text-dc1-text-secondary hover:border-dc1-amber/30'
                  }`}
                >
                  {amt} SAR
                </button>
              ))}
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="Custom"
                value={topupAmount}
                onChange={e => setTopupAmount(e.target.value)}
                className="input w-28"
              />
            </div>
          </div>
          <button
            onClick={handleTopup}
            disabled={topupLoading || !topupAmount || parseFloat(topupAmount) <= 0}
            className="btn btn-primary px-6 disabled:opacity-50"
          >
            {topupLoading ? 'Processing...' : 'Add Funds'}
          </button>
        </div>
        {topupSuccess && (
          <p className="text-sm text-status-success mt-3 font-medium">Redirecting to payment...</p>
        )}
        {topupError && (
          <p className="text-sm text-status-error mt-3">{topupError}</p>
        )}
        <p className="text-xs text-dc1-text-muted mt-3">Secure payment via Moyasar. You will be redirected to complete payment.</p>
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
                <tr><th>Job ID</th><th>Type</th><th>Status</th><th>Cost</th><th>Submitted</th><th>Completed</th></tr>
              </thead>
              <tbody>
                {jobs.map((job: any) => (
                  <tr key={job.id}>
                    <td className="font-mono text-sm text-dc1-amber">{job.job_id || `#${job.id}`}</td>
                    <td className="text-sm">{job.job_type === 'image_generation' ? 'Image Gen' : job.job_type === 'llm_inference' ? 'LLM' : job.job_type}</td>
                    <td className="text-sm">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        job.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                        job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>{job.status}</span>
                    </td>
                    <td className="text-sm font-medium">{job.actual_cost_halala ? `${(job.actual_cost_halala / 100).toFixed(2)} SAR` : '—'}</td>
                    <td className="text-sm text-dc1-text-secondary">{job.submitted_at ? new Date(job.submitted_at).toLocaleDateString() : '—'}</td>
                    <td className="text-sm text-dc1-text-secondary">{job.completed_at ? new Date(job.completed_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* API Key Management */}
      <div className="card mt-8">
        <h2 className="section-heading mb-4">API Key</h2>
        <p className="text-sm text-dc1-text-secondary mb-3">Your API key authenticates requests to the DC1 platform.</p>
        <div className="flex items-center gap-2 mb-4">
          <code className="flex-1 text-sm font-mono text-dc1-amber bg-dc1-surface-l3 border border-dc1-border rounded-lg p-3 break-all">
            {showKey ? apiKey : '••••••••••••••••••••••••••••••••'}
          </code>
          <div className="flex flex-col gap-2">
            <button onClick={() => setShowKey(!showKey)} className="px-3 py-1.5 rounded text-sm bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary border border-dc1-border">
              {showKey ? 'Hide' : 'Show'}
            </button>
            <button onClick={copyApiKey} className="px-3 py-1.5 rounded text-sm bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary border border-dc1-border">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        {!rotateConfirm ? (
          <button onClick={() => setRotateConfirm(true)} className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">
            Rotate API Key
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-status-error">This will invalidate your current key. Any integrations using it will stop working.</p>
            <div className="flex gap-2">
              <button onClick={handleRotateKey} disabled={rotating} className="px-3 py-1.5 rounded text-sm font-medium bg-status-error/20 text-status-error hover:bg-status-error/30 transition disabled:opacity-50">
                {rotating ? 'Rotating...' : 'Confirm Rotate'}
              </button>
              <button onClick={() => setRotateConfirm(false)} className="px-3 py-1.5 rounded text-sm text-dc1-text-secondary hover:text-dc1-text-primary transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
