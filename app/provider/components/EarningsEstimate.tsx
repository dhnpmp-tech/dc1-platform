'use client'

import { useState, useEffect } from 'react'

const API_BASE = '/api/dc1'

// GPU earnings data from FOUNDER-STRATEGIC-BRIEF.md (70% utilization, SAR rates)
// RTX 4090: $0.267/hr × 24hr × 30d × 70% util = $134.84/mo → SAR 505 low end
// With variable demand: $145-315/mo USD = SAR 543-1181
const GPU_EARNINGS: Record<string, { lowUsd: number; highUsd: number; ratePerHr: number }> = {
  'RTX 4090':   { lowUsd: 145, highUsd: 315,  ratePerHr: 0.267 },
  'RTX 4080':   { lowUsd: 95,  highUsd: 195,  ratePerHr: 0.175 },
  'RTX 3090':   { lowUsd: 65,  highUsd: 130,  ratePerHr: 0.120 },
  'RTX 3080':   { lowUsd: 45,  highUsd: 95,   ratePerHr: 0.085 },
  'H100':       { lowUsd: 840, highUsd: 1421, ratePerHr: 1.421 },
  'H200':       { lowUsd: 980, highUsd: 1680, ratePerHr: 1.680 },
  'A100':       { lowUsd: 420, highUsd: 720,  ratePerHr: 0.840 },
  'L40S':       { lowUsd: 280, highUsd: 480,  ratePerHr: 0.540 },
}

const USD_TO_SAR = 3.75

function findGpuKey(gpuModel: string): string | null {
  if (!gpuModel) return null
  for (const key of Object.keys(GPU_EARNINGS)) {
    if (gpuModel.toUpperCase().includes(key.toUpperCase()) ||
        key.toUpperCase().includes(gpuModel.toUpperCase().replace('NVIDIA ', '').replace('GEFORCE ', ''))) {
      return key
    }
  }
  return null
}

interface EarningsEstimateProps {
  gpuModel?: string
  apiKey?: string
  compact?: boolean
}

export default function EarningsEstimate({ gpuModel, apiKey, compact = false }: EarningsEstimateProps) {
  const [resolvedGpu, setResolvedGpu] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const key = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('dc1_provider_key') : null)
    if (gpuModel) {
      setResolvedGpu(gpuModel)
      return
    }
    if (!key) return

    setLoading(true)
    fetch(`${API_BASE}/providers/me?key=${encodeURIComponent(key)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.provider?.gpu_model) {
          setResolvedGpu(data.provider.gpu_model)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [gpuModel, apiKey])

  const gpuKey = resolvedGpu ? findGpuKey(resolvedGpu) : null
  const earnings = gpuKey ? GPU_EARNINGS[gpuKey] : null

  if (loading) {
    return (
      <div className={`rounded-xl border border-dc1-border bg-dc1-surface-l1 ${compact ? 'p-4' : 'p-5'}`}>
        <div className="h-4 w-32 bg-dc1-surface-l2 rounded skeleton" />
        <div className="mt-2 h-8 w-24 bg-dc1-surface-l2 rounded skeleton" />
      </div>
    )
  }

  if (!earnings) {
    return (
      <div className={`rounded-xl border border-dc1-border bg-dc1-surface-l1 ${compact ? 'p-4' : 'p-5'}`}>
        <p className="text-xs text-dc1-text-muted mb-1">Estimated Monthly Earnings</p>
        <p className="text-sm text-dc1-text-secondary">
          {resolvedGpu ? `GPU "${resolvedGpu}" not in pricing table` : 'Set GPU model to see earnings estimate'}
        </p>
        <p className="text-xs text-dc1-text-muted mt-1">Based on 70% utilization at DCP floor prices</p>
      </div>
    )
  }

  const lowSar = Math.round(earnings.lowUsd * USD_TO_SAR)
  const highSar = Math.round(earnings.highUsd * USD_TO_SAR)

  if (compact) {
    return (
      <div className="rounded-xl border border-dc1-amber/20 bg-dc1-amber/5 p-4">
        <p className="text-xs text-dc1-text-muted mb-1">Est. Monthly Earnings ({gpuKey})</p>
        <p className="text-xl font-bold text-dc1-amber">
          SAR {lowSar.toLocaleString()}–{highSar.toLocaleString()}
        </p>
        <p className="text-xs text-dc1-text-muted mt-0.5">
          ${earnings.lowUsd}–${earnings.highUsd} USD · 70% utilization · {earnings.ratePerHr.toFixed(3)}/hr
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-dc1-amber/20 bg-dc1-amber/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dc1-text-primary">Earnings Estimate</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-dc1-amber/20 text-dc1-amber border border-dc1-amber/30 font-medium">
          {gpuKey}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-dc1-surface-l1 p-3">
          <p className="text-xs text-dc1-text-muted mb-1">Monthly (SAR)</p>
          <p className="text-lg font-bold text-dc1-amber">
            {lowSar.toLocaleString()}–{highSar.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-dc1-surface-l1 p-3">
          <p className="text-xs text-dc1-text-muted mb-1">Monthly (USD)</p>
          <p className="text-lg font-bold text-dc1-text-primary">
            ${earnings.lowUsd}–${earnings.highUsd}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-dc1-text-muted pt-1 border-t border-dc1-border/50">
        <span>DCP rate: ${earnings.ratePerHr.toFixed(3)}/hr</span>
        <span>70% utilization baseline</span>
      </div>

      <p className="text-xs text-dc1-text-muted">
        Estimates vary by demand. Saudi electricity rates make DCP providers highly profitable.
      </p>
    </div>
  )
}
