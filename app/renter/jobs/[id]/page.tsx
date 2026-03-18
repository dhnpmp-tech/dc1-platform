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
  actual_cost_halala: number
  actual_duration_minutes: number
  progress_phase: string
  params: string | null
}

interface JobOutput {
  type: string
  response?: string
  image_base64?: string
  format?: string
  model?: string
  tokens_generated?: number
  tokens_per_second?: number
  gen_time_s?: number
  total_time_s?: number
  device?: string
  width?: number
  height?: number
  steps?: number
  seed?: number
}

// Nav icons
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
const TemplatesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
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
const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)
const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const navItems = [
  { label: 'Dashboard', href: '/renter', icon: <HomeIcon /> },
  { label: 'Marketplace', href: '/renter/marketplace', icon: <MarketplaceIcon /> },
  { label: 'Templates', href: '/renter/templates', icon: <TemplatesIcon /> },
  { label: 'Playground', href: '/renter/playground', icon: <PlaygroundIcon /> },
  { label: 'My Jobs', href: '/renter/jobs', icon: <JobsIcon /> },
  { label: 'Billing', href: '/renter/billing', icon: <BillingIcon /> },
  { label: 'Analytics', href: '/renter/analytics', icon: <ChartIcon /> },
  { label: 'Settings', href: '/renter/settings', icon: <GearIcon /> },
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

export default function RenterJobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string
  const [job, setJob] = useState<JobDetail | null>(null)
  const [output, setOutput] = useState<JobOutput | null>(null)
  const [loading, setLoading] = useState(true)
  const [renterName, setRenterName] = useState('Renter')
  const [error, setError] = useState('')

  useEffect(() => {
    const apiKey = localStorage.getItem('dc1_renter_key')
    if (!apiKey) {
      router.push('/login')
      return
    }

    const fetchData = async () => {
      try {
        // Fetch renter name
        const meRes = await fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(apiKey)}`)
        if (!meRes.ok) {
          localStorage.removeItem('dc1_renter_key')
          router.push('/login')
          return
        }
        const meData = await meRes.json()
        setRenterName(meData.renter?.name || 'Renter')

        // Fetch job detail
        const jobRes = await fetch(`${API_BASE}/jobs/${jobId}`, {
          headers: { 'x-renter-key': apiKey },
        })
        if (!jobRes.ok) {
          setError('Job not found or access denied')
          return
        }
        const jobData = await jobRes.json()
        setJob(jobData.job || null)

        // Try to fetch output if job is completed
        if (jobData.job?.status === 'completed') {
          try {
            const outRes = await fetch(`${API_BASE}/jobs/${jobData.job.id}/output`, {
              headers: { Accept: 'application/json' },
            })
            if (outRes.ok) {
              const outData = await outRes.json()
              setOutput(outData)
            }
          } catch { /* output may not exist */ }
        }
      } catch (err) {
        console.error('Failed to load job:', err)
        setError('Failed to load job details')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [jobId, router])

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} role="renter" userName="Renter">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !job) {
    return (
      <DashboardLayout navItems={navItems} role="renter" userName={renterName}>
        <div className="space-y-4">
          <Link href="/renter/jobs" className="text-dc1-amber text-sm hover:underline">&larr; Back to Jobs</Link>
          <div className="card p-8 text-center">
            <p className="text-dc1-text-secondary">{error || 'Job not found'}</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const cost = (job.actual_cost_halala || 0) / 100
  let durationStr = '—'
  if (job.completed_at && job.submitted_at) {
    const secs = Math.round((new Date(job.completed_at).getTime() - new Date(job.submitted_at).getTime()) / 1000)
    durationStr = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`
  } else if (job.actual_duration_minutes) {
    durationStr = `${job.actual_duration_minutes} min`
  }

  let parsedParams: Record<string, unknown> | null = null
  try {
    if (job.params) parsedParams = JSON.parse(job.params)
  } catch { /* ignore */ }

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renterName}>
      <div className="space-y-6 max-w-3xl">
        {/* Back link */}
        <Link href="/renter/jobs" className="text-dc1-amber text-sm hover:underline">&larr; Back to Jobs</Link>

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
          <DetailRow label="Status" value={job.status} />
          {job.progress_phase && <DetailRow label="Progress" value={job.progress_phase.replace(/_/g, ' ')} />}
          <DetailRow label="Submitted" value={job.submitted_at ? new Date(job.submitted_at).toLocaleString() : '—'} />
          <DetailRow label="Started" value={job.started_at ? new Date(job.started_at).toLocaleString() : '—'} />
          <DetailRow label="Completed" value={job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'} />
          <DetailRow label="Duration" value={durationStr} />
          <DetailRow label="Cost" value={cost > 0 ? `${cost.toFixed(2)} SAR` : '—'} highlight />
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

        {/* Output */}
        {output && (
          <div className="card">
            <h2 className="section-heading mb-4">Output</h2>
            {output.type === 'text' && output.response && (
              <div className="space-y-3">
                <div className="bg-dc1-surface-l2 rounded-lg p-4">
                  <pre className="text-sm text-dc1-text-primary whitespace-pre-wrap break-words">{output.response}</pre>
                </div>
                {output.tokens_generated && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-dc1-surface-l2 rounded p-2 text-center">
                      <div className="text-dc1-text-primary font-semibold">{output.tokens_generated}</div>
                      <div className="text-dc1-text-muted">Tokens</div>
                    </div>
                    {output.tokens_per_second && (
                      <div className="bg-dc1-surface-l2 rounded p-2 text-center">
                        <div className="text-dc1-text-primary font-semibold">{output.tokens_per_second.toFixed(1)}</div>
                        <div className="text-dc1-text-muted">Tok/s</div>
                      </div>
                    )}
                    {output.gen_time_s && (
                      <div className="bg-dc1-surface-l2 rounded p-2 text-center">
                        <div className="text-dc1-text-primary font-semibold">{output.gen_time_s.toFixed(1)}s</div>
                        <div className="text-dc1-text-muted">Gen Time</div>
                      </div>
                    )}
                    <div className="bg-dc1-surface-l2 rounded p-2 text-center">
                      <div className="text-dc1-text-primary font-semibold">{output.model || '—'}</div>
                      <div className="text-dc1-text-muted">Model</div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {output.type === 'image' && output.image_base64 && (
              <div className="space-y-3">
                <img
                  src={`data:image/${output.format || 'png'};base64,${output.image_base64}`}
                  alt="Generated image"
                  className="rounded-lg max-w-full border border-dc1-border"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {output.width && output.height && (
                    <div className="bg-dc1-surface-l2 rounded p-2 text-center">
                      <div className="text-dc1-text-primary font-semibold">{output.width}x{output.height}</div>
                      <div className="text-dc1-text-muted">Resolution</div>
                    </div>
                  )}
                  {output.steps && (
                    <div className="bg-dc1-surface-l2 rounded p-2 text-center">
                      <div className="text-dc1-text-primary font-semibold">{output.steps}</div>
                      <div className="text-dc1-text-muted">Steps</div>
                    </div>
                  )}
                  {output.seed != null && (
                    <div className="bg-dc1-surface-l2 rounded p-2 text-center">
                      <div className="text-dc1-text-primary font-semibold font-mono">{output.seed}</div>
                      <div className="text-dc1-text-muted">Seed</div>
                    </div>
                  )}
                  {output.gen_time_s && (
                    <div className="bg-dc1-surface-l2 rounded p-2 text-center">
                      <div className="text-dc1-text-primary font-semibold">{output.gen_time_s.toFixed(1)}s</div>
                      <div className="text-dc1-text-muted">Gen Time</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {job.error && (
          <div className="card border-status-error/30 bg-status-error/5">
            <h2 className="section-heading text-status-error mb-2">Error</h2>
            <pre className="text-sm text-dc1-text-secondary whitespace-pre-wrap break-words">{job.error}</pre>
          </div>
        )}

        {/* Retry button for failed jobs */}
        {job.status === 'failed' && (
          <Link href="/renter/playground" className="btn btn-primary inline-block">
            Try Again in Playground
          </Link>
        )}
      </div>
    </DashboardLayout>
  )
}
