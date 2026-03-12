'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import DashboardLayout from '../components/layout/DashboardLayout'
import StatCard from '../components/ui/StatCard'
import StatusBadge from '../components/ui/StatusBadge'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

// ── Types ──────────────────────────────────────────────────────────
type JobType = 'llm_inference' | 'image_generation'

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

interface Provider {
  id: number
  name: string
  gpu_model: string
  vram_gb: number
  status: string
  cached_models?: string[]
}

interface JobResult {
  type: string
  prompt: string
  response?: string
  model: string
  tokens_generated?: number
  tokens_per_second?: number
  gen_time_s: number
  total_time_s: number
  device: string
  billing?: { actual_cost_halala: number; actual_cost_sar: string }
  image_base64?: string
  format?: string
  width?: number
  height?: number
  steps?: number
  seed?: number
}

interface ProofData {
  job_id: string
  provider_name: string
  provider_gpu: string
  provider_hostname: string
  status: string
  started_at: string
  completed_at: string
  actual_duration_minutes: number
  cost_halala: number
  provider_earned_halala: number
  dc1_fee_halala: number
  raw_log: string
}

type Phase = 'idle' | 'submitting' | 'polling' | 'done' | 'error'

// ── Constants ──────────────────────────────────────────────────────
const LLM_MODELS = [
  { id: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0', label: 'TinyLlama 1.1B Chat', vram: '~2 GB', speed: 'Fast' },
  { id: 'microsoft/phi-2', label: 'Microsoft Phi-2 (2.7B)', vram: '~5 GB', speed: 'Medium' },
  { id: 'mistralai/Mistral-7B-Instruct-v0.2', label: 'Mistral 7B Instruct', vram: '~14 GB', speed: 'Slow' },
] as const

const SD_MODELS = [
  { id: 'CompVis/stable-diffusion-v1-4', label: 'Stable Diffusion v1.4', vram: '~3.5 GB', speed: 'Fast' },
  { id: 'stable-diffusion-v1-5/stable-diffusion-v1-5', label: 'Stable Diffusion v1.5', vram: '~4 GB', speed: 'Fast' },
  { id: 'stabilityai/stable-diffusion-2-1', label: 'Stable Diffusion v2.1', vram: '~5 GB', speed: 'Medium' },
  { id: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'SDXL Base 1.0', vram: '~7 GB', speed: 'Slow' },
] as const

const COST_RATES: Record<JobType, number> = {
  llm_inference: 15,
  image_generation: 20,
}

// ── SVG Icon Components ────────────────────────────────────────────
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

// ── ProofRow Component ─────────────────────────────────────────────
function ProofRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-dc1-text-muted text-sm">{label}</span>
      <span className={`text-sm ${highlight ? 'text-dc1-amber font-medium' : 'text-dc1-text-secondary'}`}>{value}</span>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────
export default function RenterDashboard() {
  // ── Dashboard state ──────────────────────────────────────────────
  const [renter, setRenter] = useState<RenterInfo | null>(null)
  const [gpus, setGpus] = useState<GPU[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [authChecking, setAuthChecking] = useState(true)
  const [renterKey, setRenterKey] = useState('')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'playground'>('dashboard')

  // ── Playground state ─────────────────────────────────────────────
  const [jobType, setJobType] = useState<JobType>('llm_inference')
  const [llmModel, setLlmModel] = useState<string>(LLM_MODELS[0].id)
  const [prompt, setPrompt] = useState('')
  const [maxTokens, setMaxTokens] = useState(256)
  const [temperature, setTemperature] = useState(0.7)
  const [sdModel, setSdModel] = useState<string>(SD_MODELS[0].id)
  const [negativePrompt, setNegativePrompt] = useState('')
  const [pgSteps, setPgSteps] = useState(30)
  const [imgWidth, setImgWidth] = useState(512)
  const [imgHeight, setImgHeight] = useState(512)
  const [seed, setSeed] = useState(-1)
  const [pgProviderId, setPgProviderId] = useState<number | null>(null)
  const [pgProviders, setPgProviders] = useState<Provider[]>([])
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [pgJobId, setPgJobId] = useState<number | null>(null)
  const [pgJobStringId, setPgJobStringId] = useState<string>('')
  const [pollCount, setPollCount] = useState(0)
  const [pgResult, setPgResult] = useState<JobResult | null>(null)
  const [proof, setProof] = useState<ProofData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [showRawLog, setShowRawLog] = useState(false)
  const [progressPhase, setProgressPhase] = useState<string>('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // ── Auth ─────────────────────────────────────────────────────────
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
          localStorage.setItem('dc1_renter_key', key)
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
        const jobsData = data.recent_jobs?.map((j: any) => {
          let duration = 0
          if (j.completed_at && j.submitted_at) {
            duration = Math.round((new Date(j.completed_at).getTime() - new Date(j.submitted_at).getTime()) / 1000)
          }
          return {
            id: j.job_id || `#${j.id}`,
            job_type: j.job_type,
            status: j.status,
            cost: (j.actual_cost_halala || 0) / 100,
            duration,
            submitted_at: j.submitted_at,
          }
        }) || []
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

  // ── Playground: Fetch providers ──────────────────────────────────
  const fetchPlaygroundProviders = useCallback(async () => {
    setLoadingProviders(true)
    try {
      const res = await fetch(`${API_BASE}/renters/available-providers`)
      if (res.ok) {
        const data = await res.json()
        const online = (data.providers || []).filter((p: Provider) => p.status === 'online')
        setPgProviders(online)
        if (online.length > 0 && !pgProviderId) setPgProviderId(online[0].id)
      }
    } catch { /* ignore */ }
    finally { setLoadingProviders(false) }
  }, [pgProviderId])

  useEffect(() => {
    if (renter && activeTab === 'playground') fetchPlaygroundProviders()
  }, [renter, activeTab, fetchPlaygroundProviders])

  // ── Playground: Submit job ───────────────────────────────────────
  async function submitPlaygroundJob() {
    if (!prompt.trim() || !pgProviderId) return
    setPhase('submitting')
    setPgResult(null)
    setProof(null)
    setErrorMsg('')
    setPollCount(0)
    setProgressPhase('')

    const params = jobType === 'llm_inference'
      ? { model: llmModel, prompt: prompt.trim(), max_tokens: maxTokens, temperature }
      : {
          model: sdModel,
          prompt: prompt.trim(),
          negative_prompt: negativePrompt.trim() || undefined,
          steps: pgSteps,
          width: imgWidth,
          height: imgHeight,
          seed: seed >= 0 ? seed : undefined,
        }

    try {
      const res = await fetch(`${API_BASE}/jobs/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-renter-key': renterKey },
        body: JSON.stringify({
          provider_id: pgProviderId,
          job_type: jobType,
          duration_minutes: jobType === 'image_generation' ? 15 : 10,
          params,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Submission failed')

      setPgJobId(data.job.id)
      setPgJobStringId(data.job.job_id || '')
      setPhase('polling')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit')
      setPhase('error')
    }
  }

  // ── Playground: Poll for result ──────────────────────────────────
  useEffect(() => {
    if (phase !== 'polling' || !pgJobId) return

    async function poll() {
      setPollCount(c => c + 1)
      try {
        const jobCheck = await fetch(`${API_BASE}/jobs/${pgJobId}`, {
          headers: { 'x-renter-key': renterKey },
        })
        if (jobCheck.ok) {
          const jobData = await jobCheck.json()
          const job = jobData.job || {}
          if (job.progress_phase) setProgressPhase(job.progress_phase)
          if (job.status === 'failed') {
            setErrorMsg(job.error || 'Job failed on provider')
            setPhase('error')
            return
          }
        }

        const res = await fetch(`${API_BASE}/jobs/${pgJobId}/output`, {
          headers: { 'Accept': 'application/json' },
        })

        if (res.status === 202 || res.status === 204) return

        if (res.ok) {
          const data = await res.json()
          if ((data.type === 'text' && data.response) || (data.type === 'image' && data.image_base64)) {
            setPgResult(data)
            if (pgJobId) fetchProof(pgJobId)
            setPhase('done')
          }
        } else if (res.status === 404) {
          const jobRes = await fetch(`${API_BASE}/jobs/${pgJobId}`, {
            headers: { 'x-renter-key': renterKey },
          })
          if (jobRes.ok) {
            const data = await jobRes.json()
            if (data.job?.status === 'failed') {
              setErrorMsg(data.job.error || 'Job failed on provider')
              setPhase('error')
            }
          }
        }
      } catch { /* retry next interval */ }
    }

    poll()
    pollRef.current = setInterval(poll, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [phase, pgJobId, jobType])

  useEffect(() => {
    if (phase === 'polling' && pollCount > 300) {
      setErrorMsg('Job timed out — the provider may be busy or the model is still downloading.')
      setPhase('error')
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [phase, pollCount])

  async function fetchProof(id: number) {
    try {
      const res = await fetch(`${API_BASE}/jobs/${id}`, {
        headers: { 'x-renter-key': renterKey },
      })
      if (!res.ok) return
      const data = await res.json()
      const job = data.job || {}

      setProof({
        job_id: job.job_id || `#${job.id}`,
        provider_name: 'Restricted',
        provider_gpu: 'Restricted',
        provider_hostname: '',
        status: job.status,
        started_at: job.started_at || '',
        completed_at: job.completed_at || '',
        actual_duration_minutes: job.actual_duration_minutes || 0,
        cost_halala: job.actual_cost_halala || 0,
        provider_earned_halala: job.provider_earned_halala || 0,
        dc1_fee_halala: job.dc1_fee_halala || 0,
        raw_log: job.result || '',
      })

      verifyKey(renterKey)
    } catch { /* ignore */ }
  }

  function resetPlayground() {
    setPhase('idle')
    setPgResult(null)
    setProof(null)
    setPrompt('')
    setNegativePrompt('')
    setProgressPhase('')
  }

  function getProgressLabel(): string {
    if (phase === 'submitting') return 'Submitting...'
    if (phase !== 'polling') return ''
    const elapsed = `${pollCount * 3}s`
    if (progressPhase) {
      const labels: Record<string, string> = {
        downloading_model: 'Downloading model...',
        loading_model: 'Loading model to GPU...',
        generating: jobType === 'image_generation' ? 'Generating image...' : 'Running inference...',
        formatting: 'Formatting output...',
      }
      return `${labels[progressPhase] || progressPhase} (${elapsed})`
    }
    return jobType === 'image_generation'
      ? `Generating on GPU... (${elapsed})`
      : `Running on GPU... (${elapsed})`
  }

  // ── Navigation ───────────────────────────────────────────────────
  const navItems = [
    { label: 'Dashboard', href: '/renter', icon: <HomeIcon /> },
    { label: 'Marketplace', href: '/renter/marketplace', icon: <MarketplaceIcon /> },
    { label: 'Playground', href: '/renter/playground', icon: <PlaygroundIcon /> },
    { label: 'My Jobs', href: '/renter/jobs', icon: <JobsIcon /> },
    { label: 'Billing', href: '/renter/billing', icon: <BillingIcon /> },
  ]

  const isRunning = phase === 'polling' || phase === 'submitting'
  const rate = COST_RATES[jobType]

  // ── Loading state ────────────────────────────────────────────────
  if (authChecking) {
    return (
      <div className="min-h-screen bg-dc1-void flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full" />
      </div>
    )
  }

  // ── Login gate ───────────────────────────────────────────────────
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
            Don&apos;t have an account?{' '}
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

  // ── Main Dashboard ───────────────────────────────────────────────
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

        {/* Tab Toggle: Dashboard / Playground */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition ${
              activeTab === 'dashboard'
                ? 'bg-dc1-amber text-dc1-void'
                : 'bg-dc1-surface-l2 text-dc1-text-secondary border border-dc1-border hover:border-dc1-amber/30'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition ${
              activeTab === 'playground'
                ? 'bg-dc1-amber text-dc1-void'
                : 'bg-dc1-surface-l2 text-dc1-text-secondary border border-dc1-border hover:border-dc1-amber/30'
            }`}
          >
            GPU Playground
          </button>
        </div>

        {/* ═══ DASHBOARD TAB ═══ */}
        {activeTab === 'dashboard' && (
          <>
            {/* Available GPUs */}
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

            {/* Recent Jobs */}
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
                          <td className="text-dc1-amber font-semibold">{job.cost > 0 ? `${job.cost.toFixed(2)} SAR` : '—'}</td>
                          <td>{job.duration > 0 ? (job.duration >= 60 ? `${Math.floor(job.duration / 60)}m ${job.duration % 60}s` : `${job.duration}s`) : '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-dc1-text-secondary">
                          No jobs yet. Try the GPU Playground!
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
                <button onClick={() => setActiveTab('playground')} className="btn btn-primary flex-1">
                  Open GPU Playground
                </button>
                <a href="/renter/marketplace" className="btn btn-secondary flex-1">
                  Browse Marketplace
                </a>
                <a href="/renter/billing" className="btn btn-outline flex-1">
                  Manage Billing
                </a>
              </div>
            </section>
          </>
        )}

        {/* ═══ PLAYGROUND TAB ═══ */}
        {activeTab === 'playground' && (
          <div className="max-w-3xl">
            {/* Playground Header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-dc1-text-primary">GPU Playground</h2>
              <p className="text-dc1-text-secondary text-sm mt-1">
                Run LLM inference or generate images on real GPU hardware.
              </p>
              {renter.balance_halala != null && (
                <p className="text-dc1-amber text-sm font-medium mt-1">
                  Balance: {balance.toFixed(2)} SAR
                </p>
              )}
            </div>

            {/* Job Type Toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => { if (!isRunning) setJobType('llm_inference') }}
                disabled={isRunning}
                className={`flex-1 py-3 rounded-lg font-semibold text-sm transition ${
                  jobType === 'llm_inference'
                    ? 'bg-dc1-amber text-dc1-void'
                    : 'bg-dc1-surface-l2 text-dc1-text-secondary border border-dc1-border hover:border-dc1-amber/30'
                } disabled:opacity-60`}
              >
                LLM Inference
              </button>
              <button
                onClick={() => { if (!isRunning) setJobType('image_generation') }}
                disabled={isRunning}
                className={`flex-1 py-3 rounded-lg font-semibold text-sm transition ${
                  jobType === 'image_generation'
                    ? 'bg-purple-600 text-white'
                    : 'bg-dc1-surface-l2 text-dc1-text-secondary border border-dc1-border hover:border-purple-500/30'
                } disabled:opacity-60`}
              >
                Image Generation
              </button>
            </div>

            {/* Form */}
            <div className="card p-6 space-y-5 mb-6">
              {/* Model Selection */}
              <div>
                <label className="label">Model</label>
                {jobType === 'llm_inference' ? (
                  <select className="input" value={llmModel} onChange={e => setLlmModel(e.target.value)} disabled={isRunning}>
                    {LLM_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.label} — {m.vram} VRAM, {m.speed}</option>
                    ))}
                  </select>
                ) : (
                  <select className="input" value={sdModel} onChange={e => setSdModel(e.target.value)} disabled={isRunning}>
                    {SD_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.label} — {m.vram} VRAM, {m.speed}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Provider Selection */}
              <div>
                <label className="label">GPU Provider</label>
                {loadingProviders ? (
                  <div className="animate-pulse bg-dc1-surface-l2 rounded-lg h-12" />
                ) : pgProviders.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pgProviders.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPgProviderId(p.id)}
                        disabled={isRunning}
                        className={`text-left px-4 py-3 rounded-lg border transition ${
                          pgProviderId === p.id
                            ? 'border-dc1-amber bg-dc1-amber/10'
                            : 'border-dc1-border bg-dc1-surface-l2 hover:border-dc1-amber/30'
                        }`}
                      >
                        <div className="font-medium text-sm text-dc1-text-primary">{p.gpu_model}</div>
                        <div className="text-dc1-text-muted text-xs">{p.name} &bull; {p.vram_gb || '?'}GB VRAM</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-dc1-text-secondary text-sm py-3 px-4 bg-dc1-surface-l2 rounded-lg border border-dc1-border">
                    No online providers. Ask a provider to start their daemon.
                  </div>
                )}
              </div>

              {/* Prompt */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="label mb-0">Prompt</label>
                  <span className="text-xs text-dc1-text-muted">{prompt.length} / 10,000</span>
                </div>
                <textarea
                  rows={jobType === 'image_generation' ? 2 : 3}
                  placeholder={jobType === 'image_generation'
                    ? 'A futuristic city in Saudi Arabia at sunset, cyberpunk style, detailed, 4k'
                    : 'What is the capital of Saudi Arabia? Give a brief answer.'}
                  className="input resize-y"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  disabled={isRunning}
                />
              </div>

              {/* Image Gen specific fields */}
              {jobType === 'image_generation' && (
                <>
                  <div>
                    <label className="label">Negative Prompt <span className="text-dc1-text-muted">(optional)</span></label>
                    <input
                      type="text"
                      placeholder="blurry, low quality, distorted, watermark"
                      className="input"
                      value={negativePrompt}
                      onChange={e => setNegativePrompt(e.target.value)}
                      disabled={isRunning}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Steps: {pgSteps}</label>
                      <input type="range" min={5} max={50} step={5} className="w-full accent-purple-500 mt-2" value={pgSteps} onChange={e => setPgSteps(Number(e.target.value))} disabled={isRunning} />
                    </div>
                    <div>
                      <label className="label">Seed <span className="text-dc1-text-muted">(-1 = random)</span></label>
                      <input type="number" min={-1} max={2147483647} className="input" value={seed} onChange={e => setSeed(Number(e.target.value))} disabled={isRunning} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Width</label>
                      <select className="input" value={imgWidth} onChange={e => setImgWidth(Number(e.target.value))} disabled={isRunning}>
                        {[256, 384, 512, 640, 768, 1024].map(v => (
                          <option key={v} value={v}>{v}px</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Height</label>
                      <select className="input" value={imgHeight} onChange={e => setImgHeight(Number(e.target.value))} disabled={isRunning}>
                        {[256, 384, 512, 640, 768, 1024].map(v => (
                          <option key={v} value={v}>{v}px</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* LLM specific fields */}
              {jobType === 'llm_inference' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Max Tokens</label>
                    <input type="number" min={32} max={4096} className="input" value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))} disabled={isRunning} />
                  </div>
                  <div>
                    <label className="label">Temperature: {temperature.toFixed(1)}</label>
                    <input type="range" min={0.1} max={2.0} step={0.1} className="w-full accent-dc1-amber mt-2" value={temperature} onChange={e => setTemperature(Number(e.target.value))} disabled={isRunning} />
                  </div>
                </div>
              )}

              {/* Cost estimate */}
              <div className="flex justify-between text-xs text-dc1-text-muted px-1">
                <span>Est. cost: ~{rate} halala ({(rate / 100).toFixed(2)} SAR) per minute</span>
                <span>Rate: {rate} halala/min</span>
              </div>

              {/* Submit Button */}
              <button
                onClick={submitPlaygroundJob}
                disabled={isRunning || !prompt.trim() || !pgProviderId}
                className={`w-full py-3.5 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition text-lg ${
                  jobType === 'image_generation'
                    ? 'bg-purple-600 text-white hover:bg-purple-500'
                    : 'btn btn-primary'
                }`}
              >
                {isRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    {getProgressLabel()}
                  </span>
                ) : jobType === 'image_generation' ? 'Generate Image' : 'Run Inference'}
              </button>
            </div>

            {/* Error */}
            {phase === 'error' && (
              <div className="alert-error mb-6 p-5">
                <h3 className="font-semibold mb-1">Job Failed</h3>
                <p className="text-sm opacity-80">{errorMsg}</p>
                <button onClick={() => setPhase('idle')} className="mt-3 text-sm underline opacity-80 hover:opacity-100">Try Again</button>
              </div>
            )}

            {/* Result */}
            {pgResult && (
              <div className="space-y-4">
                {/* IMAGE Result */}
                {pgResult.type === 'image' && pgResult.image_base64 && (
                  <div className="card border-purple-500/20 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-purple-400 font-semibold text-sm">Generated Image</span>
                      <span className="text-dc1-text-muted text-xs ml-auto">
                        {pgResult.model?.split('/').pop()} &bull; {pgResult.width}x{pgResult.height} &bull; {pgResult.steps} steps
                      </span>
                    </div>
                    <div className="flex justify-center">
                      <img
                        src={`data:image/png;base64,${pgResult.image_base64}`}
                        alt={pgResult.prompt}
                        className="rounded-lg max-w-full border border-dc1-border"
                        style={{ maxHeight: '512px' }}
                      />
                    </div>
                    <p className="text-dc1-text-secondary text-xs mt-3 text-center italic">&ldquo;{pgResult.prompt}&rdquo;</p>
                    {pgResult.seed != null && pgResult.seed >= 0 && (
                      <p className="text-dc1-text-muted text-xs text-center mt-1">Seed: {pgResult.seed}</p>
                    )}
                    <div className="flex justify-center mt-4">
                      <a
                        href={`data:image/png;base64,${pgResult.image_base64}`}
                        download={`dc1-generated-${Date.now()}.png`}
                        className="btn btn-secondary btn-sm"
                      >
                        Download PNG
                      </a>
                    </div>
                  </div>
                )}

                {/* TEXT Result */}
                {pgResult.type === 'text' && pgResult.response && (
                  <div className="card border-dc1-amber/20 p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-dc1-amber" />
                      <span className="text-dc1-amber font-semibold text-sm">AI Response</span>
                      <span className="text-dc1-text-muted text-xs ml-auto">{pgResult.model?.split('/').pop()}</span>
                    </div>
                    <p className="text-dc1-text-primary leading-relaxed text-lg">{pgResult.response}</p>
                  </div>
                )}

                {/* Execution Proof */}
                <div className="card overflow-hidden">
                  <div className="px-6 py-4 border-b border-dc1-border flex items-center gap-2">
                    <svg className="w-4 h-4 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-sm text-dc1-text-primary">Execution Proof — Verified GPU Compute</span>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                      <ProofRow label="Job ID" value={proof?.job_id || `#${pgJobId}`} />
                      <ProofRow label="Status" value={proof?.status || 'completed'} highlight />
                      <ProofRow label="Provider" value={proof?.provider_name || '—'} />
                      <ProofRow label="GPU" value={proof?.provider_gpu || '—'} />
                      <ProofRow label="Device" value={pgResult.device?.toUpperCase() || '—'} highlight={pgResult.device === 'cuda'} />
                      <ProofRow label="Model" value={pgResult.model || '—'} />
                      {pgResult.type === 'text' && (
                        <>
                          <ProofRow label="Tokens Generated" value={String(pgResult.tokens_generated || 0)} />
                          <ProofRow label="Speed" value={`${pgResult.tokens_per_second || 0} tok/s`} highlight />
                        </>
                      )}
                      {pgResult.type === 'image' && (
                        <>
                          <ProofRow label="Dimensions" value={`${pgResult.width}x${pgResult.height}`} />
                          <ProofRow label="Steps" value={String(pgResult.steps || 0)} />
                          {pgResult.seed != null && <ProofRow label="Seed" value={String(pgResult.seed)} />}
                        </>
                      )}
                      <ProofRow label="Generation Time" value={`${pgResult.gen_time_s || 0}s`} />
                      <ProofRow label="Total Execution" value={`${pgResult.total_time_s || 0}s`} />
                      <ProofRow label="Cost" value={proof ? `${proof.cost_halala} halala (${(proof.cost_halala / 100).toFixed(2)} SAR)` : '—'} />
                      <ProofRow label="Provider Earned" value={proof ? `${proof.provider_earned_halala} halala (75%)` : '—'} />
                      <ProofRow label="DC1 Fee" value={proof ? `${proof.dc1_fee_halala} halala (25%)` : '—'} />
                    </div>
                  </div>
                </div>

                {/* Raw Log */}
                <div className="card overflow-hidden">
                  <button
                    onClick={() => setShowRawLog(!showRawLog)}
                    className="w-full px-6 py-3 flex items-center gap-2 text-sm text-dc1-text-secondary hover:text-dc1-text-primary transition"
                  >
                    <svg className={`w-3 h-3 transition-transform ${showRawLog ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Raw Daemon Log
                  </button>
                  {showRawLog && (
                    <div className="px-6 pb-4">
                      <pre className="bg-dc1-void rounded-lg p-4 text-xs text-status-success/80 font-mono overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {proof?.raw_log || pgResult?.response || 'No raw log available'}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Run Another */}
                <button
                  onClick={resetPlayground}
                  className={`w-full py-3 rounded-lg font-semibold border transition ${
                    jobType === 'image_generation'
                      ? 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'
                      : 'btn btn-outline'
                  }`}
                >
                  {jobType === 'image_generation' ? 'Generate Another Image' : 'Run Another Prompt'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
