'use client'

import { useState } from 'react'
import EarningsEstimate from './EarningsEstimate'

const API_BASE = '/api/dc1'

const GPU_MODELS = [
  { label: 'NVIDIA RTX 4090 (24 GB)', value: 'RTX 4090', vramMb: 24576 },
  { label: 'NVIDIA RTX 4080 (16 GB)', value: 'RTX 4080', vramMb: 16384 },
  { label: 'NVIDIA RTX 3090 (24 GB)', value: 'RTX 3090', vramMb: 24576 },
  { label: 'NVIDIA RTX 3080 (10 GB)', value: 'RTX 3080', vramMb: 10240 },
  { label: 'NVIDIA H100 SXM (80 GB)', value: 'H100', vramMb: 81920 },
  { label: 'NVIDIA H200 SXM (141 GB)', value: 'H200', vramMb: 144384 },
  { label: 'NVIDIA A100 (40 GB)', value: 'A100', vramMb: 40960 },
  { label: 'NVIDIA L40S (48 GB)', value: 'L40S', vramMb: 49152 },
  { label: 'Other', value: 'Other', vramMb: 0 },
]

const SUGGESTED_PRICES: Record<string, number> = {
  'RTX 4090': 0.267,
  'RTX 4080': 0.175,
  'RTX 3090': 0.120,
  'RTX 3080': 0.085,
  'H100': 1.421,
  'H200': 1.680,
  'A100': 0.840,
  'L40S': 0.540,
  'Other': 0.100,
}

interface ActivationWizardProps {
  detectedGpuModel?: string
  onSuccess: () => void
  onCancel: () => void
}

type Step = 1 | 2 | 3

export default function ActivationWizard({ detectedGpuModel, onSuccess, onCancel }: ActivationWizardProps) {
  const [step, setStep] = useState<Step>(1)
  const [gpuModel, setGpuModel] = useState(detectedGpuModel || '')
  const [customGpuModel, setCustomGpuModel] = useState('')
  const [vramMb, setVramMb] = useState(0)
  const [gpuCount, setGpuCount] = useState(1)
  const [runMode, setRunMode] = useState<'always-on' | 'scheduled'>('always-on')
  const [schedStart, setSchedStart] = useState('23:00')
  const [schedEnd, setSchedEnd] = useState('07:00')
  const [minPricePerHr, setMinPricePerHr] = useState(0.267)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedGpu = GPU_MODELS.find(g => g.value === gpuModel)
  const effectiveGpuModel = gpuModel === 'Other' ? customGpuModel : gpuModel
  const suggestedPrice = SUGGESTED_PRICES[gpuModel] ?? 0.100

  function handleGpuSelect(value: string) {
    setGpuModel(value)
    const gpu = GPU_MODELS.find(g => g.value === value)
    if (gpu && gpu.vramMb > 0) setVramMb(gpu.vramMb)
    setMinPricePerHr(SUGGESTED_PRICES[value] ?? 0.100)
  }

  async function submitGpuSpecs() {
    setError(null)
    const key = localStorage.getItem('dc1_provider_key')
    if (!key) { setError('Session expired. Please log in again.'); return }
    if (!effectiveGpuModel) { setError('Please select or enter your GPU model.'); return }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { gpu_model: effectiveGpuModel }
      if (vramMb > 0) body.vram_mb = vramMb
      if (gpuCount > 0) body.gpu_count = gpuCount
      body.supported_compute_types = ['inference', 'training', 'rendering']

      const res = await fetch(`${API_BASE}/providers/me/gpu-profile?key=${encodeURIComponent(key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // 409 means daemon already reported profile — use that data and continue
        if (res.status !== 409) {
          setError(err.error || 'Failed to save GPU specs.')
          return
        }
      }
      setStep(2)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitSchedule() {
    setError(null)
    const key = localStorage.getItem('dc1_provider_key')
    if (!key) { setError('Session expired. Please log in again.'); return }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/providers/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          run_mode: runMode,
          scheduled_start: schedStart,
          scheduled_end: schedEnd,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error || 'Failed to save schedule.')
        return
      }
      setStep(3)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitPricing() {
    setError(null)
    const key = localStorage.getItem('dc1_provider_key')
    if (!key) { setError('Session expired. Please log in again.'); return }

    setSubmitting(true)
    try {
      // Persist minimum price preference locally — backend pricing endpoint will be wired in DCP-770
      localStorage.setItem('dc1_provider_min_price_usd', String(minPricePerHr))

      // Final preferences submission to ensure schedule is committed
      await fetch(`${API_BASE}/providers/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          run_mode: runMode,
          scheduled_start: schedStart,
          scheduled_end: schedEnd,
        }),
      })
      onSuccess()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const stepLabels = ['GPU Specs', 'Schedule', 'Pricing']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dc1-void/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-dc1-border bg-dc1-surface-l1 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-dc1-border">
          <div>
            <h2 className="text-lg font-semibold text-dc1-text-primary">Activate Your GPU</h2>
            <p className="text-xs text-dc1-text-muted mt-0.5">Step {step} of 3 — {stepLabels[step - 1]}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="p-2 rounded-lg text-dc1-text-muted hover:text-dc1-text-primary hover:bg-dc1-surface-l2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-3">
          <div className="flex gap-1.5">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${s <= step ? 'bg-dc1-amber' : 'bg-dc1-surface-l3'}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {stepLabels.map((label, i) => (
              <span key={label} className={`text-xs ${i + 1 <= step ? 'text-dc1-amber' : 'text-dc1-text-muted'}`}>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-status-error/10 border border-status-error/30 text-status-error text-sm px-4 py-3">
              {error}
            </div>
          )}

          {/* Step 1: GPU Specs */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-dc1-text-secondary">
                Confirm your GPU so renters can book the right jobs for your hardware.
                {detectedGpuModel && (
                  <span className="block mt-1 text-status-info text-xs">
                    Auto-detected: <strong>{detectedGpuModel}</strong>
                  </span>
                )}
              </p>

              <div className="space-y-1.5">
                <label className="label">GPU Model</label>
                <select
                  value={gpuModel}
                  onChange={e => handleGpuSelect(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Select GPU model…</option>
                  {GPU_MODELS.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>

              {gpuModel === 'Other' && (
                <div className="space-y-1.5">
                  <label className="label">GPU Model Name</label>
                  <input
                    type="text"
                    value={customGpuModel}
                    onChange={e => setCustomGpuModel(e.target.value)}
                    placeholder="e.g. NVIDIA RTX 4070 Ti"
                    className="input w-full"
                    maxLength={80}
                  />
                </div>
              )}

              {gpuModel && gpuModel !== 'Other' && selectedGpu && (
                <div className="rounded-lg bg-dc1-surface-l2 p-3 flex items-center justify-between text-sm">
                  <span className="text-dc1-text-muted">VRAM</span>
                  <span className="text-dc1-text-primary font-medium">
                    {Math.round(selectedGpu.vramMb / 1024)} GB
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="label">Number of GPUs</label>
                <div className="flex gap-2">
                  {[1, 2, 4, 8].map(n => (
                    <button
                      key={n}
                      onClick={() => setGpuCount(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors min-h-[40px] ${
                        gpuCount === n
                          ? 'bg-dc1-amber/20 border-dc1-amber text-dc1-amber'
                          : 'border-dc1-border text-dc1-text-muted hover:border-dc1-border-light hover:text-dc1-text-secondary'
                      }`}
                    >
                      {n}×
                    </button>
                  ))}
                </div>
              </div>

              {gpuModel && (
                <EarningsEstimate gpuModel={effectiveGpuModel} compact />
              )}
            </div>
          )}

          {/* Step 2: Availability Schedule */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-dc1-text-secondary">
                Choose when your GPU is available to serve jobs. More availability = more earnings.
              </p>

              <div className="space-y-2">
                <label className="label">Availability Mode</label>
                <div className="space-y-2">
                  {([
                    { value: 'always-on', label: 'Always on', desc: 'Maximum earnings — GPU serves jobs 24/7' },
                    { value: 'scheduled', label: 'Scheduled hours', desc: 'Set specific hours (e.g. overnight when idle)' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setRunMode(opt.value)}
                      className={`w-full text-left rounded-xl border p-4 transition-all ${
                        runMode === opt.value
                          ? 'border-dc1-amber bg-dc1-amber/5'
                          : 'border-dc1-border bg-dc1-surface-l2 hover:border-dc1-border-light'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                          runMode === opt.value ? 'border-dc1-amber bg-dc1-amber' : 'border-dc1-text-muted'
                        }`}>
                          {runMode === opt.value && (
                            <div className="w-full h-full rounded-full bg-dc1-void scale-50" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-dc1-text-primary">{opt.label}</p>
                          <p className="text-xs text-dc1-text-muted">{opt.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {runMode === 'scheduled' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="label">Start time</label>
                    <input
                      type="time"
                      value={schedStart}
                      onChange={e => setSchedStart(e.target.value)}
                      className="input w-full"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="label">End time</label>
                    <input
                      type="time"
                      value={schedEnd}
                      onChange={e => setSchedEnd(e.target.value)}
                      className="input w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Minimum Job Price */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-dc1-text-secondary">
                Set the minimum price you'll accept per hour. Jobs below this rate won't be assigned to you.
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label">Minimum price (USD/hr)</label>
                  <span className="text-dc1-amber font-bold text-base">${minPricePerHr.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min={0.010}
                  max={gpuModel && SUGGESTED_PRICES[gpuModel] ? SUGGESTED_PRICES[gpuModel] * 2 : 2.0}
                  step={0.001}
                  value={minPricePerHr}
                  onChange={e => setMinPricePerHr(Number(e.target.value))}
                  className="w-full accent-dc1-amber"
                />
                <div className="flex justify-between text-xs text-dc1-text-muted">
                  <span>$0.010 (more jobs)</span>
                  <span>${(gpuModel && SUGGESTED_PRICES[gpuModel] ? SUGGESTED_PRICES[gpuModel] * 2 : 2.0).toFixed(3)} (higher rate)</span>
                </div>
              </div>

              <div className="rounded-lg bg-dc1-surface-l2 border border-dc1-border p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-dc1-text-muted">Suggested (DCP floor)</span>
                  <span className="text-dc1-amber font-medium">${suggestedPrice.toFixed(3)}/hr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dc1-text-muted">Your minimum</span>
                  <span className={`font-medium ${minPricePerHr <= suggestedPrice ? 'text-status-success' : 'text-status-warning'}`}>
                    ${minPricePerHr.toFixed(3)}/hr
                  </span>
                </div>
                {minPricePerHr > suggestedPrice * 1.5 && (
                  <p className="text-xs text-status-warning pt-1">
                    High minimum may reduce job volume. Consider staying near the DCP floor price.
                  </p>
                )}
              </div>

              <EarningsEstimate gpuModel={effectiveGpuModel} />
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-dc1-border pt-4">
          {step > 1 && (
            <button
              onClick={() => { setError(null); setStep(prev => (prev - 1) as Step) }}
              disabled={submitting}
              className="px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium text-dc1-text-secondary hover:text-dc1-text-primary border border-dc1-border hover:border-dc1-border-light transition-colors disabled:opacity-50"
            >
              Back
            </button>
          )}
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium text-dc1-text-muted hover:text-dc1-text-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={step === 1 ? submitGpuSpecs : step === 2 ? submitSchedule : submitPricing}
            disabled={submitting || (step === 1 && !gpuModel) || (step === 1 && gpuModel === 'Other' && !customGpuModel.trim())}
            className="btn btn-primary px-6 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving…' : step === 3 ? 'Activate GPU' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
