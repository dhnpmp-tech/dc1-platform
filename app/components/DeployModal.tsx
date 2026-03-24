'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DockerTemplate } from './TemplateCard'

const API_BASE = '/api/dc1'

// ── GPU tier options (matched to VRAM requirements from strategic brief) ────────
interface GpuOption {
  label: string
  vramGb: number
  pricePerHr: number  // SAR
  latency: string
  providersOnline?: number
}

function getGpuOptions(minVramGb: number): GpuOption[] {
  const ALL_GPU_OPTIONS: GpuOption[] = [
    { label: 'RTX 4090 — 8 GB',  vramGb: 8,  pricePerHr: 5.0,  latency: '~2s'  },
    { label: 'RTX 4090 — 24 GB', vramGb: 24, pricePerHr: 9.0,  latency: '~5s'  },
    { label: 'A100 — 40 GB',     vramGb: 40, pricePerHr: 28.0, latency: '~10s' },
    { label: 'H100 — 80 GB',     vramGb: 80, pricePerHr: 65.0, latency: '~15s' },
  ]
  return ALL_GPU_OPTIONS.filter(o => o.vramGb >= (minVramGb ?? 0))
}

type Step = 'gpu' | 'confirm' | 'submitting' | 'success' | 'error'

interface DeployModalProps {
  template: DockerTemplate | null
  onClose: () => void
}

function formatCost(pricePerHr: number, durationMin: number) {
  return ((pricePerHr * durationMin) / 60).toFixed(2)
}

export default function DeployModal({ template, onClose }: DeployModalProps) {
  const router = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState<Step>('gpu')
  const [selectedGpuIdx, setSelectedGpuIdx] = useState(0)
  const [durationMin, setDurationMin] = useState(30)
  const [jobId, setJobId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const gpuOptions = template ? getGpuOptions(template.min_vram_gb ?? 0) : []
  const singleGpuOption = gpuOptions.length === 1

  // Reset state when template changes
  useEffect(() => {
    setStep(singleGpuOption ? 'confirm' : 'gpu')
    setSelectedGpuIdx(0)
    setDurationMin(30)
    setJobId(null)
    setErrorMsg(null)
  }, [template?.id, singleGpuOption])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!template) return null

  const selectedGpu = gpuOptions[selectedGpuIdx] ?? gpuOptions[0]
  const estimatedCost = selectedGpu ? formatCost(selectedGpu.pricePerHr, durationMin) : '—'

  // ── Submit job ───────────────────────────────────────────────────────────────
  async function handleDeploy() {
    if (!template) return

    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('dc1_renter_key') : null
    if (!apiKey) {
      // Not logged in — redirect to register with template pre-fill
      router.push(`/renter/register?template=${template.id}&source=template_catalog`)
      return
    }

    setStep('submitting')
    try {
      const res = await fetch(`${API_BASE}/jobs/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          template_id: template.id,
          duration_minutes: durationMin,
          gpu_requirements: selectedGpu ? { min_vram_gb: selectedGpu.vramGb } : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? `Server error (${res.status})`)
        setStep('error')
        return
      }

      setJobId(data.job_id ?? data.id ?? null)
      setStep('success')
    } catch {
      setErrorMsg('Network error — please try again.')
      setStep('error')
    }
  }

  // ── Step indicator ───────────────────────────────────────────────────────────
  const totalSteps = singleGpuOption ? 1 : 2
  const currentStep = step === 'gpu' ? 1 : 2

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Deploy ${template.name}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-dc1-surface-l2 border border-dc1-border rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dc1-border">
          <div className="flex items-center gap-2">
            {template.icon && <span className="text-lg" aria-hidden="true">{template.icon}</span>}
            <h2 className="text-base font-bold text-dc1-text-primary">{template.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-dc1-surface-l3 transition-colors text-dc1-text-muted hover:text-dc1-text-primary"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar (only for multi-step) */}
        {!singleGpuOption && step !== 'submitting' && step !== 'success' && step !== 'error' && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 text-xs text-dc1-text-muted mb-1">
              <span>Step {currentStep} of {totalSteps}</span>
            </div>
            <div className="h-1 bg-dc1-surface-l3 rounded-full">
              <div
                className="h-1 bg-dc1-amber rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5">
          {/* ── Step: GPU selection ── */}
          {step === 'gpu' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-dc1-text-primary">Select GPU tier</p>
              <div className="space-y-2">
                {gpuOptions.map((opt, idx) => (
                  <label
                    key={opt.label}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedGpuIdx === idx
                        ? 'border-dc1-amber bg-dc1-amber/5'
                        : 'border-dc1-border bg-dc1-surface-l1 hover:border-dc1-amber/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="gpu"
                      checked={selectedGpuIdx === idx}
                      onChange={() => setSelectedGpuIdx(idx)}
                      className="accent-dc1-amber"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dc1-text-primary">{opt.label}</p>
                      <p className="text-xs text-dc1-text-muted">Cold-start: {opt.latency}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-dc1-amber">{opt.pricePerHr.toFixed(2)} SAR/hr</p>
                    </div>
                  </label>
                ))}
              </div>

              {gpuOptions.length === 0 && (
                <p className="text-sm text-dc1-text-muted text-center py-4">
                  No GPU tiers available for this template.
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="btn btn-outline flex-1">Cancel</button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={gpuOptions.length === 0}
                  className="btn btn-primary flex-1"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Confirm ── */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-dc1-text-primary">Review &amp; Deploy</p>

              {/* Summary */}
              <div className="bg-dc1-surface-l1 rounded-xl border border-dc1-border divide-y divide-dc1-border">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-dc1-text-muted">Template</span>
                  <span className="text-sm font-medium text-dc1-text-primary">{template.name}</span>
                </div>
                {selectedGpu && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-dc1-text-muted">GPU</span>
                    <span className="text-sm font-medium text-dc1-text-primary">{selectedGpu.label}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-dc1-text-muted">Duration</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDurationMin(m => Math.max(5, m - 5))}
                      className="w-7 h-7 rounded-lg border border-dc1-border bg-dc1-surface-l2 flex items-center justify-center text-dc1-text-primary hover:border-dc1-amber/40 transition-colors"
                      aria-label="Decrease duration"
                    >−</button>
                    <span className="text-sm font-medium text-dc1-text-primary w-16 text-center">{durationMin} min</span>
                    <button
                      onClick={() => setDurationMin(m => Math.min(480, m + 5))}
                      className="w-7 h-7 rounded-lg border border-dc1-border bg-dc1-surface-l2 flex items-center justify-center text-dc1-text-primary hover:border-dc1-amber/40 transition-colors"
                      aria-label="Increase duration"
                    >+</button>
                  </div>
                </div>
                {selectedGpu && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-dc1-text-muted">Rate</span>
                    <span className="text-sm font-medium text-dc1-amber">{selectedGpu.pricePerHr.toFixed(2)} SAR/hr</span>
                  </div>
                )}
              </div>

              {/* Total cost */}
              {selectedGpu && (
                <div className="bg-dc1-amber/5 border border-dc1-amber/20 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-dc1-text-primary">Estimated total</span>
                  <span className="text-xl font-extrabold text-dc1-amber">{estimatedCost} SAR</span>
                </div>
              )}

              <p className="text-[11px] text-dc1-text-muted text-center">
                You can stop the job anytime. Billing stops when the job ends.
              </p>

              <div className="flex gap-3 pt-1">
                {!singleGpuOption && (
                  <button onClick={() => setStep('gpu')} className="btn btn-outline flex-1">← Back</button>
                )}
                {singleGpuOption && (
                  <button onClick={onClose} className="btn btn-outline flex-1">Cancel</button>
                )}
                <button onClick={handleDeploy} className="btn btn-primary flex-1">
                  ✓ Deploy Now
                </button>
              </div>
            </div>
          )}

          {/* ── Submitting ── */}
          {step === 'submitting' && (
            <div className="py-8 text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-10 h-10 border-2 border-dc1-amber border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm font-medium text-dc1-text-primary">Submitting deployment…</p>
              <p className="text-xs text-dc1-text-muted">Allocating GPU from provider pool</p>
            </div>
          )}

          {/* ── Success ── */}
          {step === 'success' && (
            <div className="py-6 text-center space-y-4">
              <div className="text-4xl">✅</div>
              <div>
                <p className="text-base font-bold text-dc1-text-primary">Deployment submitted!</p>
                <p className="text-sm text-dc1-text-muted mt-1">Ready in ~30 seconds</p>
              </div>
              {jobId && (
                <div className="bg-dc1-surface-l1 rounded-lg border border-dc1-border px-4 py-2.5 text-left">
                  <p className="text-[10px] text-dc1-text-muted uppercase tracking-wide mb-1">Job ID</p>
                  <p className="text-sm font-mono text-dc1-text-primary truncate">{jobId}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="btn btn-outline flex-1">Deploy Another</button>
                <button
                  onClick={() => router.push(jobId ? `/renter/jobs/${jobId}` : '/renter/jobs')}
                  className="btn btn-primary flex-1"
                >
                  View Job →
                </button>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <div className="py-6 space-y-4">
              <div className="bg-status-error/10 border border-status-error/20 rounded-xl px-4 py-3 text-center">
                <p className="text-sm font-semibold text-status-error mb-1">Deployment failed</p>
                <p className="text-xs text-dc1-text-secondary">{errorMsg}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="btn btn-outline flex-1">Cancel</button>
                <button
                  onClick={() => setStep(singleGpuOption ? 'confirm' : 'gpu')}
                  className="btn btn-primary flex-1"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
