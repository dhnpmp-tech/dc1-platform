'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/app/components/layout/DashboardLayout'
import StatusBadge from '@/app/components/ui/StatusBadge'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

const ITEMS_PER_PAGE = 12

// ── Types ─────────────────────────────────────────────────────────

interface GPUListing {
  id: number
  name: string
  gpu_model: string
  vram_gb: number
  vram_mib: number
  cuda_version?: string
  status: 'online' | 'offline'
  location?: string
  reliability_score?: number
  uptime_percent?: number
  price_per_hour_halala: number
  cached_models?: string[]
}

interface JobSubmitForm {
  duration_hours: number
  container_image: string
  job_type: 'llm_inference' | 'image_generation' | 'training' | 'custom'
  env_vars: string
}

type SortField = 'price_asc' | 'price_desc' | 'vram_desc' | 'availability' | 'reliability'

// ── SVG Icons ─────────────────────────────────────────────────────

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
const PlaygroundIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
)
const SortIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
  </svg>
)
const XIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)
const GpuIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" />
  </svg>
)
const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────

function getPriceForVram(vram_gb: number): number {
  // halala per hour — fixed rates until provider price controls are live
  if (vram_gb >= 80) return 3600
  if (vram_gb >= 40) return 2400
  if (vram_gb >= 24) return 1800
  if (vram_gb >= 16) return 1200
  return 900
}

function halalaToSar(halala: number): string {
  return (halala / 100).toFixed(2)
}

function normalizeProvider(p: any): GPUListing {
  const vram_gb = p.vram_gb ?? Math.round((p.vram_mib ?? 0) / 1024)
  return {
    id: p.id,
    name: p.name,
    gpu_model: p.gpu_model || 'Unknown GPU',
    vram_gb,
    vram_mib: p.vram_mib ?? vram_gb * 1024,
    cuda_version: p.cuda_version ?? p.resource_spec?.cuda_version,
    status: p.status === 'online' || p.last_seen_at ? 'online' : 'offline',
    location: p.location,
    reliability_score: p.reliability_score,
    uptime_percent: p.uptime_percent ?? p.reliability_score,
    price_per_hour_halala: p.price_per_hour_halala ?? getPriceForVram(vram_gb),
    cached_models: p.cached_models,
  }
}

// ── Nav ───────────────────────────────────────────────────────────

const navItems = [
  { label: 'Dashboard', href: '/renter', icon: <HomeIcon /> },
  { label: 'Marketplace', href: '/renter/marketplace', icon: <MarketplaceIcon /> },
  { label: 'Playground', href: '/renter/playground', icon: <PlaygroundIcon /> },
  { label: 'My Jobs', href: '/renter/jobs', icon: <JobsIcon /> },
  { label: 'Billing', href: '/renter/billing', icon: <BillingIcon /> },
  { label: 'Analytics', href: '/renter/analytics', icon: <ChartIcon /> },
  { label: 'Settings', href: '/renter/settings', icon: <GearIcon /> },
]

// ── Job Submit Modal ──────────────────────────────────────────────

const PRESET_IMAGES = [
  { label: 'Llama 3.1 (Ollama)', value: 'ollama/ollama:latest', type: 'llm_inference' as const },
  { label: 'Stable Diffusion XL', value: 'stabilityai/stable-diffusion-xl-base-1.0', type: 'image_generation' as const },
  { label: 'PyTorch Training', value: 'pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime', type: 'training' as const },
  { label: 'Custom Image', value: '', type: 'custom' as const },
]

const DURATION_PRESETS = [1, 2, 4, 8, 24]

function JobSubmitModal({
  gpu,
  renterKey,
  onClose,
  onSuccess,
}: {
  gpu: GPUListing
  renterKey: string
  onClose: () => void
  onSuccess: (jobId: string) => void
}) {
  const [form, setForm] = useState<JobSubmitForm>({
    duration_hours: 1,
    container_image: PRESET_IMAGES[0].value,
    job_type: 'llm_inference',
    env_vars: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [customImage, setCustomImage] = useState(false)

  const totalCostHalala = form.duration_hours * gpu.price_per_hour_halala
  const totalSar = halalaToSar(totalCostHalala)

  const handlePreset = (preset: typeof PRESET_IMAGES[0]) => {
    if (preset.value === '') {
      setCustomImage(true)
      setForm(f => ({ ...f, container_image: '', job_type: 'custom' }))
    } else {
      setCustomImage(false)
      setForm(f => ({ ...f, container_image: preset.value, job_type: preset.type }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renterKey) {
      setError('Please log in to submit a job.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/jobs/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-renter-key': renterKey,
        },
        body: JSON.stringify({
          provider_id: gpu.id,
          job_type: form.job_type,
          container_image: form.container_image,
          duration_minutes: form.duration_hours * 60,
          env_vars: form.env_vars
            ? Object.fromEntries(
                form.env_vars
                  .split('\n')
                  .filter(l => l.includes('='))
                  .map(l => {
                    const [k, ...v] = l.split('=')
                    return [k.trim(), v.join('=').trim()]
                  })
              )
            : {},
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Job submission failed')
      onSuccess(data.job_id || data.id || 'submitted')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dc1-void/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-dc1-surface-l1 border border-dc1-border rounded-xl w-full max-w-lg animate-slide-up shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dc1-border">
          <div>
            <h2 className="text-lg font-bold text-dc1-text-primary">Submit Job</h2>
            <p className="text-sm text-dc1-text-secondary mt-0.5">
              {gpu.gpu_model} · {gpu.vram_gb} GB VRAM
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-dc1-surface-l3 text-dc1-text-muted hover:text-dc1-text-primary transition-colors"
            aria-label="Close modal"
          >
            <XIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Step 1: Container Image */}
          <div>
            <label className="block text-sm font-medium text-dc1-text-secondary mb-2">
              1. Container Image
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {PRESET_IMAGES.map(p => (
                <button
                  key={p.value || 'custom'}
                  type="button"
                  onClick={() => handlePreset(p)}
                  className={`text-left px-3 py-2 rounded-md border text-xs transition-colors ${
                    (!customImage && form.container_image === p.value && p.value !== '') ||
                    (customImage && p.value === '')
                      ? 'border-dc1-amber bg-dc1-amber/10 text-dc1-amber'
                      : 'border-dc1-border bg-dc1-surface-l2 text-dc1-text-secondary hover:border-dc1-border-light'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {customImage ? (
              <input
                type="text"
                placeholder="docker.io/org/image:tag"
                value={form.container_image}
                onChange={e => setForm(f => ({ ...f, container_image: e.target.value }))}
                className="input text-sm"
                required
                autoFocus
              />
            ) : (
              <p className="text-xs text-dc1-text-muted font-mono mt-1 truncate">{form.container_image}</p>
            )}
          </div>

          {/* Step 2: Duration */}
          <div>
            <label className="block text-sm font-medium text-dc1-text-secondary mb-2">
              2. Duration
            </label>
            <div className="flex gap-2 flex-wrap items-center">
              {DURATION_PRESETS.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, duration_hours: h }))}
                  className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                    form.duration_hours === h
                      ? 'border-dc1-amber bg-dc1-amber/10 text-dc1-amber'
                      : 'border-dc1-border bg-dc1-surface-l2 text-dc1-text-secondary hover:border-dc1-border-light'
                  }`}
                >
                  {h}h
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={168}
                value={form.duration_hours}
                onChange={e =>
                  setForm(f => ({ ...f, duration_hours: Math.max(1, parseInt(e.target.value) || 1) }))
                }
                className="input w-20 text-sm text-center"
                aria-label="Custom duration in hours"
              />
            </div>
          </div>

          {/* Step 3: Env vars */}
          <div>
            <label className="block text-sm font-medium text-dc1-text-secondary mb-2">
              3. Environment Variables{' '}
              <span className="text-dc1-text-muted font-normal">(optional · KEY=value, one per line)</span>
            </label>
            <textarea
              value={form.env_vars}
              onChange={e => setForm(f => ({ ...f, env_vars: e.target.value }))}
              placeholder={'MODEL=llama3\nGPU_LAYERS=-1'}
              rows={3}
              className="input text-sm font-mono resize-none"
            />
          </div>

          {/* Cost summary */}
          <div className="bg-dc1-surface-l2 rounded-lg p-4 border border-dc1-border">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-dc1-text-secondary">Rate</span>
              <span className="text-dc1-text-primary">{halalaToSar(gpu.price_per_hour_halala)} SAR/hr</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-dc1-text-secondary">Duration</span>
              <span className="text-dc1-text-primary">
                {form.duration_hours} hour{form.duration_hours !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t border-dc1-border mt-2">
              <span className="text-dc1-text-primary text-sm">Estimated Total</span>
              <span className="text-dc1-amber text-lg">{totalSar} SAR</span>
            </div>
          </div>

          {error && (
            <div className="bg-status-error/10 border border-status-error/30 rounded-md px-4 py-3 text-sm text-status-error">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.container_image}
              className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Submitting…
                </>
              ) : (
                <>
                  <CheckIcon />
                  Confirm &amp; Submit
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Success Toast ─────────────────────────────────────────────────

function SuccessToast({ jobId, onDismiss }: { jobId: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-status-success/10 border border-status-success/40 rounded-lg px-5 py-4 shadow-xl animate-slide-up flex items-start gap-3 max-w-sm">
      <div className="text-status-success mt-0.5 shrink-0">
        <CheckIcon />
      </div>
      <div>
        <p className="text-dc1-text-primary font-semibold text-sm">Job submitted!</p>
        <p className="text-dc1-text-secondary text-xs mt-0.5">
          ID: <span className="font-mono">{String(jobId).slice(0, 12)}</span>
        </p>
        <Link href="/renter/jobs" className="text-dc1-amber text-xs hover:underline mt-1 inline-block">
          View in My Jobs →
        </Link>
      </div>
      <button
        onClick={onDismiss}
        className="text-dc1-text-muted hover:text-dc1-text-primary ml-auto -mt-0.5 shrink-0"
        aria-label="Dismiss"
      >
        <XIcon />
      </button>
    </div>
  )
}

// ── GPU Card ──────────────────────────────────────────────────────

function GPUCard({ gpu, onSelect }: { gpu: GPUListing; onSelect: (gpu: GPUListing) => void }) {
  const pricePerHourSar = parseFloat(halalaToSar(gpu.price_per_hour_halala))
  const isOnline = gpu.status === 'online'
  const uptime = gpu.uptime_percent ?? gpu.reliability_score

  return (
    <div
      className={`card flex flex-col gap-4 transition-all duration-200 ${
        isOnline
          ? 'hover:border-dc1-amber/40 hover:-translate-y-0.5 hover:shadow-amber'
          : 'opacity-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-dc1-surface-l2 rounded-md text-dc1-amber shrink-0">
            <GpuIcon />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-dc1-text-primary leading-tight truncate">
              {gpu.gpu_model}
            </h3>
            <p className="text-xs text-dc1-text-muted mt-0.5 truncate" title={gpu.name}>
              {gpu.name}
            </p>
          </div>
        </div>
        <StatusBadge status={isOnline ? 'online' : 'offline'} size="sm" pulse={isOnline} />
      </div>

      {/* Specs grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <p className="text-dc1-text-muted text-xs uppercase tracking-wide mb-0.5">VRAM</p>
          <p className="text-dc1-text-primary font-semibold">
            {gpu.vram_gb > 0 ? `${gpu.vram_gb} GB` : '—'}
          </p>
        </div>
        <div>
          <p className="text-dc1-text-muted text-xs uppercase tracking-wide mb-0.5">CUDA</p>
          <p className="text-dc1-text-primary font-semibold">{gpu.cuda_version ?? '—'}</p>
        </div>
        {gpu.location && (
          <div>
            <p className="text-dc1-text-muted text-xs uppercase tracking-wide mb-0.5">Location</p>
            <p className="text-dc1-text-primary font-semibold truncate">{gpu.location}</p>
          </div>
        )}
        {uptime != null && uptime > 0 && (
          <div>
            <p className="text-dc1-text-muted text-xs uppercase tracking-wide mb-0.5">Uptime</p>
            <p
              className={`font-semibold ${
                uptime >= 90
                  ? 'text-status-success'
                  : uptime >= 70
                  ? 'text-status-warning'
                  : 'text-status-error'
              }`}
            >
              {uptime}%
            </p>
          </div>
        )}
      </div>

      {/* Price */}
      <div className="bg-dc1-surface-l2 rounded-md px-4 py-3 flex items-center justify-between">
        <span className="text-dc1-text-muted text-xs uppercase tracking-wide">Price / hour</span>
        <span className="text-dc1-amber text-lg font-bold">{pricePerHourSar} SAR</span>
      </div>

      {/* Cached models */}
      {gpu.cached_models && gpu.cached_models.length > 0 && (
        <div>
          <p className="text-xs text-dc1-text-muted mb-1.5">Cached models (instant start):</p>
          <div className="flex flex-wrap gap-1">
            {gpu.cached_models.slice(0, 3).map((m, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded bg-status-success/10 text-status-success border border-status-success/20"
              >
                {m.split('/').pop()}
              </span>
            ))}
            {gpu.cached_models.length > 3 && (
              <span className="text-xs px-2 py-0.5 rounded bg-dc1-surface-l3 text-dc1-text-muted">
                +{gpu.cached_models.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <Link
          href={`/renter/playground?provider=${gpu.id}`}
          className="btn btn-secondary btn-sm flex-1 text-center text-xs"
        >
          Playground
        </Link>
        <button
          onClick={() => onSelect(gpu)}
          disabled={!isOnline}
          className="btn btn-primary btn-sm flex-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Job
        </button>
      </div>
    </div>
  )
}

// ── Filter Panel ──────────────────────────────────────────────────

interface Filters {
  search: string
  onlineOnly: boolean
  minVram: number
  maxPriceSar: number
  location: string
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  onlineOnly: false,
  minVram: 0,
  maxPriceSar: 999,
  location: '',
}

function FilterPanel({
  filters,
  onChange,
  locations,
  onReset,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  locations: string[]
  onReset: () => void
}) {
  const hasActive =
    !!filters.search ||
    filters.onlineOnly ||
    filters.minVram > 0 ||
    filters.maxPriceSar < 999 ||
    !!filters.location

  return (
    <div className="bg-dc1-surface-l1 border border-dc1-border rounded-lg p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-dc1-text-secondary text-sm font-medium">
          <FilterIcon />
          Filters
        </div>
        {hasActive && (
          <button onClick={onReset} className="text-xs text-dc1-amber hover:underline">
            Clear all
          </button>
        )}
      </div>

      {/* GPU model search */}
      <div>
        <label className="block text-xs text-dc1-text-muted uppercase tracking-wide mb-1.5">
          GPU Model
        </label>
        <input
          type="text"
          placeholder="e.g. RTX 4090, A100…"
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          className="input text-sm"
        />
      </div>

      {/* Online only toggle */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div className="relative shrink-0">
          <input
            type="checkbox"
            className="sr-only"
            checked={filters.onlineOnly}
            onChange={e => onChange({ ...filters, onlineOnly: e.target.checked })}
          />
          <div
            className={`w-9 h-5 rounded-full transition-colors ${
              filters.onlineOnly ? 'bg-dc1-amber' : 'bg-dc1-surface-l3'
            }`}
          />
          <div
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              filters.onlineOnly ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </div>
        <span className="text-sm text-dc1-text-secondary">Online only</span>
      </label>

      {/* Min VRAM */}
      <div>
        <label className="block text-xs text-dc1-text-muted uppercase tracking-wide mb-1.5">
          Min VRAM
        </label>
        <select
          value={filters.minVram}
          onChange={e => onChange({ ...filters, minVram: parseInt(e.target.value) })}
          className="input text-sm"
        >
          <option value={0}>Any</option>
          <option value={8}>8 GB+</option>
          <option value={16}>16 GB+</option>
          <option value={24}>24 GB+</option>
          <option value={40}>40 GB+</option>
          <option value={80}>80 GB+</option>
        </select>
      </div>

      {/* Max price slider */}
      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-xs text-dc1-text-muted uppercase tracking-wide">Max Price</label>
          <span className="text-xs text-dc1-text-secondary">
            {filters.maxPriceSar >= 999 ? 'Any' : `${filters.maxPriceSar} SAR/hr`}
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={50}
          step={5}
          value={Math.min(filters.maxPriceSar, 50)}
          onChange={e => {
            const v = parseInt(e.target.value)
            onChange({ ...filters, maxPriceSar: v >= 50 ? 999 : v })
          }}
          className="w-full accent-dc1-amber cursor-pointer"
        />
        <div className="flex justify-between text-xs text-dc1-text-muted mt-1">
          <span>5 SAR</span>
          <span>50+ SAR</span>
        </div>
      </div>

      {/* Location */}
      {locations.length > 0 && (
        <div>
          <label className="block text-xs text-dc1-text-muted uppercase tracking-wide mb-1.5">
            Location
          </label>
          <select
            value={filters.location}
            onChange={e => onChange({ ...filters, location: e.target.value })}
            className="input text-sm"
          >
            <option value="">All locations</option>
            {locations.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const all = Array.from({ length: totalPages }, (_, i) => i + 1)
  const visible = all.filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)

  return (
    <nav
      className="flex items-center justify-center gap-1 mt-8"
      aria-label="Pagination"
    >
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="btn btn-secondary btn-sm px-3 disabled:opacity-40"
        aria-label="Previous page"
      >
        ←
      </button>
      {visible.map((p, i) => {
        const prev = visible[i - 1]
        const hasGap = prev && p - prev > 1
        return (
          <span key={p} className="flex items-center gap-1">
            {hasGap && <span className="text-dc1-text-muted px-1">…</span>}
            <button
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`btn btn-sm px-3 min-w-[2.5rem] ${p === page ? 'btn-primary' : 'btn-secondary'}`}
            >
              {p}
            </button>
          </span>
        )
      })}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="btn btn-secondary btn-sm px-3 disabled:opacity-40"
        aria-label="Next page"
      >
        →
      </button>
    </nav>
  )
}

// ── Main Page ─────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [allGpus, setAllGpus] = useState<GPUListing[]>([])
  const [loading, setLoading] = useState(true)
  const [renterName, setRenterName] = useState('Renter')
  const [renterKey, setRenterKey] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortField>('availability')
  const [page, setPage] = useState(1)
  const [selectedGpu, setSelectedGpu] = useState<GPUListing | null>(null)
  const [successJobId, setSuccessJobId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const key = typeof window !== 'undefined' ? localStorage.getItem('dc1_renter_key') : null
    if (key) {
      setRenterKey(key)
      fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(key)}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d?.renter?.name) setRenterName(d.renter.name) })
        .catch(() => {})
    }

    const fetchGpus = async () => {
      try {
        // Try dedicated marketplace endpoint first (requires DCP-27 backend work)
        const res = await fetch(`${API_BASE}/providers/marketplace`)
        if (res.ok) {
          const data = await res.json()
          setAllGpus((data.providers ?? data.gpus ?? data).map(normalizeProvider))
          setLoading(false)
          return
        }
      } catch {}
      // Fallback to available-providers
      try {
        const res = await fetch(`${API_BASE}/renters/available-providers`)
        if (res.ok) {
          const data = await res.json()
          setAllGpus((data.providers || []).map(normalizeProvider))
        }
      } catch (err) {
        console.error('Failed to load GPUs:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchGpus()
    const interval = setInterval(fetchGpus, 30000)
    return () => clearInterval(interval)
  }, [])

  const locations = useMemo(
    () => [...new Set(allGpus.map(g => g.location).filter(Boolean) as string[])].sort(),
    [allGpus]
  )

  const filtered = useMemo(() => {
    let list = allGpus.filter(g => {
      if (filters.search && !g.gpu_model.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.onlineOnly && g.status !== 'online') return false
      if (filters.minVram > 0 && g.vram_gb < filters.minVram) return false
      if (filters.maxPriceSar < 999 && g.price_per_hour_halala / 100 > filters.maxPriceSar) return false
      if (filters.location && g.location !== filters.location) return false
      return true
    })

    switch (sort) {
      case 'price_asc':
        return [...list].sort((a, b) => a.price_per_hour_halala - b.price_per_hour_halala)
      case 'price_desc':
        return [...list].sort((a, b) => b.price_per_hour_halala - a.price_per_hour_halala)
      case 'vram_desc':
        return [...list].sort((a, b) => b.vram_gb - a.vram_gb)
      case 'reliability':
        return [...list].sort((a, b) => (b.uptime_percent ?? 0) - (a.uptime_percent ?? 0))
      default: // availability
        return [...list].sort((a, b) => {
          if (a.status === b.status) return 0
          return a.status === 'online' ? -1 : 1
        })
    }
  }, [allGpus, filters, sort])

  const handleFilterChange = useCallback((f: Filters) => {
    setFilters(f)
    setPage(1)
  }, [])

  const handleSortChange = useCallback((s: SortField) => {
    setSort(s)
    setPage(1)
  }, [])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  const onlineCount = allGpus.filter(g => g.status === 'online').length
  const hasActiveFilters =
    !!filters.search || filters.onlineOnly || filters.minVram > 0 || filters.maxPriceSar < 999 || !!filters.location

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renterName}>
      <div className="space-y-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-dc1-text-primary">GPU Marketplace</h1>
            <p className="text-dc1-text-secondary text-sm mt-1">
              {loading ? 'Loading…' : (
                <>
                  <span className="text-status-success font-medium">{onlineCount} online</span>
                  {' '}· {allGpus.length} total GPU{allGpus.length !== 1 ? 's' : ''} · refreshes every 30s
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile filter toggle */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className="lg:hidden btn btn-secondary btn-sm gap-2"
            >
              <FilterIcon />
              Filters
              {hasActiveFilters && (
                <span className="bg-dc1-amber text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  !
                </span>
              )}
            </button>

            {/* Sort select */}
            <div className="flex items-center gap-2 text-dc1-text-muted">
              <SortIcon />
              <select
                value={sort}
                onChange={e => handleSortChange(e.target.value as SortField)}
                className="input text-sm py-1.5"
                aria-label="Sort GPUs by"
              >
                <option value="availability">Availability first</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="vram_desc">VRAM: largest first</option>
                <option value="reliability">Most reliable</option>
              </select>
            </div>
          </div>
        </div>

        {/* Layout: sidebar + main */}
        <div className="flex gap-6 items-start">
          {/* Filters sidebar */}
          <aside className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-60 xl:w-64 shrink-0`}>
            <FilterPanel
              filters={filters}
              onChange={handleFilterChange}
              locations={locations}
              onReset={() => { setFilters(DEFAULT_FILTERS); setPage(1) }}
            />
          </aside>

          {/* GPU grid */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="animate-spin h-10 w-10 border-2 border-dc1-amber border-t-transparent rounded-full" />
                <p className="text-dc1-text-secondary text-sm">Loading GPUs…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="card text-center py-16 flex flex-col items-center gap-3">
                <div className="text-dc1-text-muted">
                  <GpuIcon />
                </div>
                <p className="text-dc1-text-secondary">
                  {allGpus.length === 0
                    ? 'No GPUs are currently online.'
                    : 'No GPUs match your filters.'}
                </p>
                <p className="text-sm text-dc1-text-muted">
                  {allGpus.length === 0
                    ? 'Providers come online throughout the day — check back soon.'
                    : 'Try broadening your search criteria.'}
                </p>
                {allGpus.length > 0 && (
                  <button
                    onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1) }}
                    className="btn btn-outline btn-sm"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-dc1-text-muted mb-4">
                  Showing {(page - 1) * ITEMS_PER_PAGE + 1}–
                  {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} GPU
                  {filtered.length !== 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paginated.map(gpu => (
                    <GPUCard key={gpu.id} gpu={gpu} onSelect={setSelectedGpu} />
                  ))}
                </div>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Job submission modal */}
      {selectedGpu && (
        <JobSubmitModal
          gpu={selectedGpu}
          renterKey={renterKey}
          onClose={() => setSelectedGpu(null)}
          onSuccess={jobId => {
            setSelectedGpu(null)
            setSuccessJobId(jobId)
          }}
        />
      )}

      {/* Success toast */}
      {successJobId && (
        <SuccessToast jobId={successJobId} onDismiss={() => setSuccessJobId(null)} />
      )}
    </DashboardLayout>
  )
}
