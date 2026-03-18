'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '../../components/layout/DashboardLayout'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

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
const TemplatesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
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

interface Template {
  id: string
  name: string
  description: string
  image: string
  job_type: string
  env_vars: { key: string; label: string; default: string; required: boolean }[]
  params: Record<string, unknown>
  min_vram_gb: number
  estimated_price_sar_per_hour: number
  tags: string[]
  icon: string
  difficulty: 'easy' | 'intermediate' | 'advanced'
}

interface Provider {
  id: number
  name: string
  gpu_model: string
  vram_gb: number
  status: string
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'text-green-400 bg-green-400/10',
  intermediate: 'text-yellow-400 bg-yellow-400/10',
  advanced: 'text-red-400 bg-red-400/10',
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null)
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [customParams, setCustomParams] = useState<Record<string, string>>({})
  const [activeTag, setActiveTag] = useState<string>('all')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [renterKey, setRenterKey] = useState('')

  const navItems = [
    { label: 'Dashboard', href: '/renter', icon: <HomeIcon /> },
    { label: 'Marketplace', href: '/renter/marketplace', icon: <MarketplaceIcon /> },
    { label: 'Templates', href: '/renter/templates', icon: <TemplatesIcon /> },
    { label: 'Jobs', href: '/renter/jobs', icon: <JobsIcon /> },
    { label: 'Playground', href: '/renter/playground', icon: <PlaygroundIcon /> },
    { label: 'Billing', href: '/renter/billing', icon: <BillingIcon /> },
    { label: 'Analytics', href: '/renter/analytics', icon: <ChartIcon /> },
    { label: 'Settings', href: '/renter/settings', icon: <GearIcon /> },
  ]

  useEffect(() => {
    const key = localStorage.getItem('dc1_renter_key')
    if (!key) { router.push('/login'); return }
    setRenterKey(key)
    fetchTemplates()
    fetchProviders(key)
  }, [router])

  async function fetchTemplates() {
    try {
      const r = await fetch(`${API_BASE}/templates`)
      if (r.ok) {
        const data = await r.json()
        setTemplates(data.templates || [])
      }
    } catch {
      // Use fallback static templates if API unavailable
    }
  }

  async function fetchProviders(key: string) {
    try {
      const r = await fetch(`${API_BASE}/providers/available`)
      if (r.ok) {
        const data = await r.json()
        setProviders(data.providers || [])
      }
    } catch { /* ignore */ }
  }

  function selectTemplate(t: Template) {
    setSelectedTemplate(t)
    setSelectedProvider(null)
    setError('')
    setSuccess('')
    // Pre-fill param defaults
    const defaults: Record<string, string> = {}
    t.env_vars?.forEach(ev => { defaults[ev.key] = ev.default })
    setCustomParams(defaults)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitJob() {
    if (!selectedTemplate || !selectedProvider) {
      setError('Select a template and a provider first.')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      // Build params from template defaults + user overrides
      let params: Record<string, unknown> = { ...(selectedTemplate.params || {}) }
      // Apply customParams on top
      selectedTemplate.env_vars?.forEach(ev => {
        const val = customParams[ev.key]
        if (val !== undefined) {
          // Try to coerce numbers
          const num = Number(val)
          params[ev.key.toLowerCase()] = isNaN(num) || val === '' ? val : num
        }
      })
      // For custom_container: pass image_override from DOCKER_IMAGE param
      if (selectedTemplate.id === 'custom-container' && customParams['DOCKER_IMAGE']) {
        params['image_override'] = customParams['DOCKER_IMAGE']
      }

      const body = {
        provider_id: selectedProvider,
        job_type: selectedTemplate.job_type,
        duration_minutes: durationMinutes,
        params,
      }
      const r = await fetch(`${API_BASE}/jobs/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-renter-key': renterKey },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (r.ok) {
        setSuccess(`Job submitted! ID: ${data.job_id}`)
        setSelectedTemplate(null)
      } else {
        setError(data.error || 'Submission failed')
      }
    } catch (e) {
      setError('Network error — could not submit job')
    } finally {
      setSubmitting(false)
    }
  }

  const allTags = ['all', ...Array.from(new Set(templates.flatMap(t => t.tags || [])))]
  const visibleTemplates = activeTag === 'all'
    ? templates
    : templates.filter(t => t.tags?.includes(activeTag))

  const estimatedCost = ((selectedTemplate?.estimated_price_sar_per_hour ?? 0) * durationMinutes / 60).toFixed(2)

  return (
    <DashboardLayout navItems={navItems} title="Compute Templates">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Compute Templates</h1>
          <p className="text-dc1-text-muted mt-1">
            Launch GPU workloads instantly with pre-configured Docker templates.
          </p>
        </div>

        {/* Submission panel — shown when template selected */}
        {selectedTemplate && (
          <div className="bg-dc1-surface-l2 border border-dc1-amber/30 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedTemplate.icon}</span>
                <div>
                  <h2 className="text-white font-semibold text-lg">{selectedTemplate.name}</h2>
                  <p className="text-dc1-text-muted text-sm">{selectedTemplate.description}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="text-dc1-text-muted hover:text-white text-sm"
              >
                ✕ Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Provider picker */}
              <div>
                <label className="block text-sm font-medium text-dc1-text-secondary mb-1">
                  Provider GPU
                </label>
                <select
                  className="w-full bg-dc1-surface-l1 border border-white/10 text-white rounded-lg px-3 py-2 text-sm"
                  value={selectedProvider ?? ''}
                  onChange={e => setSelectedProvider(Number(e.target.value))}
                >
                  <option value="">Select a provider…</option>
                  {providers
                    .filter(p => !selectedTemplate.min_vram_gb || (p.vram_gb || 0) >= selectedTemplate.min_vram_gb)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.gpu_model} ({p.vram_gb} GB VRAM)
                      </option>
                    ))}
                </select>
                {selectedTemplate.min_vram_gb > 0 && (
                  <p className="text-xs text-dc1-text-muted mt-1">
                    Requires ≥ {selectedTemplate.min_vram_gb} GB VRAM
                  </p>
                )}
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-dc1-text-secondary mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(Number(e.target.value))}
                  className="w-full bg-dc1-surface-l1 border border-white/10 text-white rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-xs text-dc1-amber mt-1">
                  Estimated cost: SAR {estimatedCost}
                </p>
              </div>
            </div>

            {/* Template-specific params */}
            {selectedTemplate.env_vars && selectedTemplate.env_vars.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-dc1-text-secondary mb-2">Parameters</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedTemplate.env_vars.map(ev => (
                    <div key={ev.key}>
                      <label className="block text-xs text-dc1-text-muted mb-1">
                        {ev.label}
                        {ev.required && <span className="text-dc1-amber ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={customParams[ev.key] ?? ev.default}
                        onChange={e => setCustomParams(p => ({ ...p, [ev.key]: e.target.value }))}
                        placeholder={ev.default}
                        className="w-full bg-dc1-surface-l1 border border-white/10 text-white rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={submitJob}
              disabled={submitting || !selectedProvider}
              className="w-full bg-dc1-amber text-black font-semibold py-2.5 rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting…' : `Launch ${selectedTemplate.name}`}
            </button>
          </div>
        )}

        {/* Success banner */}
        {success && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm flex items-center justify-between">
            <span>{success}</span>
            <Link href="/renter/jobs" className="underline ml-2 hover:text-green-300">
              View Jobs →
            </Link>
          </div>
        )}

        {/* Tag filter */}
        <div className="flex gap-2 flex-wrap">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                activeTag === tag
                  ? 'bg-dc1-amber text-black'
                  : 'bg-dc1-surface-l2 text-dc1-text-muted hover:text-white'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Template grid */}
        {visibleTemplates.length === 0 ? (
          <div className="bg-dc1-surface-l2 rounded-xl p-12 text-center text-dc1-text-muted">
            No templates found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleTemplates.map(t => (
              <div
                key={t.id}
                className={`bg-dc1-surface-l2 rounded-xl p-5 border cursor-pointer transition-all hover:border-dc1-amber/40 hover:bg-dc1-surface-l1 ${
                  selectedTemplate?.id === t.id
                    ? 'border-dc1-amber'
                    : 'border-white/5'
                }`}
                onClick={() => selectTemplate(t)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <h3 className="text-white font-semibold">{t.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${DIFFICULTY_COLORS[t.difficulty] || 'text-gray-400 bg-gray-400/10'}`}>
                        {t.difficulty}
                      </span>
                    </div>
                  </div>
                  <span className="text-dc1-amber text-sm font-medium whitespace-nowrap">
                    SAR {t.estimated_price_sar_per_hour}/hr
                  </span>
                </div>
                <p className="text-dc1-text-muted text-sm mb-3 line-clamp-2">
                  {t.description}
                </p>
                <div className="flex items-center justify-between text-xs text-dc1-text-muted">
                  <span>Min {t.min_vram_gb} GB VRAM</span>
                  <div className="flex gap-1 flex-wrap">
                    {(t.tags || []).slice(0, 3).map(tag => (
                      <span key={tag} className="bg-white/5 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
