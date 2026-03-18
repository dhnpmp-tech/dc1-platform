'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/app/components/layout/DashboardLayout'
import StatusBadge from '@/app/components/ui/StatusBadge'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

interface JobDetail {
  id: number
  job_id: string
  job_type: string
  status: string
  submitted_at: string
  started_at: string
  completed_at: string
  error: string | null
  provider_earned_halala: number
  dc1_fee_halala: number
  actual_cost_halala: number
  actual_duration_minutes: number
  renter_name: string
  progress_phase: string
  result: string | null
  params: string | null
}

// Nav icons
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

const GpuIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 3a2 2 0 012-2h2a2 2 0 012 2M9 3h6" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M9 16h6M9 8h6" />
  </svg>
)

const navItems = [
  { label: 'Dashboard', href: '/provider', icon: <HomeIcon /> },
  { label: 'Jobs', href: '/provider/jobs', icon: <LightningIcon /> },
  { label: 'Earnings', href: '/provider/earnings', icon: <CurrencyIcon /> },
  { label: 'GPU Metrics', href: '/provider/gpu', icon: <GpuIcon /> },
  { label: 'Settings', href: '/provider/settings', icon: <GearIcon /> },
]

function DetailRow({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-dc1-border/50 last:border-0">
      <span className="text-dc1-text-muted text-sm">{label}</span>
      <span className={`text-sm ${highlight ? 'text-dc1-amber font-semibold' : 'text-dc1-text-primary'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}

export default function ProviderJobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string
  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [providerName, setProviderName] = useState('Provider')
  const [error, setError] = useState('')

  useEffect(() => {
    const apiKey = localStorage.getItem('dc1_provider_key')
    if (!apiKey) {
      router.push('/login')
      return
    }

    const fetchData = async () => {
      try {
        // Fetch provider name
        const meRes = await fetch(`${API_BASE}/providers/me?key=${encodeURIComponent(apiKey)}`)
        if (!meRes.ok) {
          localStorage.removeItem('dc1_provider_key')
          router.push('/login')
          return
        }
        const meData = await meRes.json()
        setProviderName(meData.provider?.name || 'Provider')

        // Fetch job detail
        const jobRes = await fetch(`${API_BASE}/jobs/${jobId}`, {
          headers: { 'x-provider-key': apiKey },
        })
        if (!jobRes.ok) {
          setError('Job not found or access denied')
          return
        }
        const jobData = await jobRes.json()
        setJob(jobData.job || null)
      } catch (err) {
        console.error('Failed to load job:', err)
        setError('Failed to load job details')
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Auto-refresh for running jobs
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [jobId, router])

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} role="provider" userName="Provider">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !job) {
    return (
      <DashboardLayout navItems={navItems} role="provider" userName={providerName}>
        <div className="space-y-4">
          <Link href="/provider/jobs" className="text-dc1-amber text-sm hover:underline">&larr; Back to Jobs</Link>
          <div className="card p-8 text-center">
            <p className="text-dc1-text-secondary">{error || 'Job not found'}</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const earned = (job.provider_earned_halala || 0) / 100
  const fee = (job.dc1_fee_halala || 0) / 100
  const totalCost = (job.actual_cost_halala || 0) / 100

  let parsedParams: Record<string, unknown> | null = null
  try {
    if (job.params) parsedParams = JSON.parse(job.params)
  } catch { /* ignore */ }

  return (
    <DashboardLayout navItems={navItems} role="provider" userName={providerName}>
      <div className="space-y-6 max-w-3xl">
        {/* Back link */}
        <Link href="/provider/jobs" className="text-dc1-amber text-sm hover:underline">&larr; Back to Jobs</Link>

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dc1-text-primary">Job Detail</h1>
            <p className="text-dc1-text-muted text-sm font-mono mt-1">{job.job_id || `#${job.id}`}</p>
          </div>
          <StatusBadge status={job.status as any} />
        </div>

        {/* Job Info */}
        <div className="card">
          <h2 className="section-heading mb-4">Job Information</h2>
          <DetailRow label="Job Type" value={(job.job_type || '').replace(/_/g, ' ')} />
          <DetailRow label="Renter" value={job.renter_name || 'Anonymous'} />
          <DetailRow label="Status" value={job.status} />
          {job.progress_phase && <DetailRow label="Progress" value={job.progress_phase.replace(/_/g, ' ')} />}
          <DetailRow label="Submitted" value={job.submitted_at ? new Date(job.submitted_at).toLocaleString() : '—'} />
          <DetailRow label="Started" value={job.started_at ? new Date(job.started_at).toLocaleString() : '—'} />
          <DetailRow label="Completed" value={job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'} />
          <DetailRow label="Duration" value={job.actual_duration_minutes ? `${job.actual_duration_minutes} min` : '—'} />
        </div>

        {/* Earnings Breakdown */}
        <div className="card">
          <h2 className="section-heading mb-4">Earnings Breakdown</h2>
          <DetailRow label="Total Job Cost" value={`${totalCost.toFixed(2)} SAR`} />
          <DetailRow label="Your Earnings (75%)" value={`${earned.toFixed(2)} SAR`} highlight />
          <DetailRow label="DC1 Fee (25%)" value={`${fee.toFixed(2)} SAR`} />
        </div>

        {/* Job Parameters */}
        {parsedParams && (
          <div className="card">
            <h2 className="section-heading mb-4">Job Parameters</h2>
            {Object.entries(parsedParams).map(([key, value]) => (
              <DetailRow key={key} label={key.replace(/_/g, ' ')} value={String(value)} mono />
            ))}
          </div>
        )}

        {/* Error */}
        {job.error && (
          <div className="card border-status-error/30 bg-status-error/5">
            <h2 className="section-heading text-status-error mb-2">Error</h2>
            <pre className="text-sm text-dc1-text-secondary whitespace-pre-wrap break-words">{job.error}</pre>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
