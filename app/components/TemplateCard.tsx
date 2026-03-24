'use client'

import { useMemo } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface DockerTemplate {
  id: string
  name: string
  description: string
  image?: string
  job_type?: string
  min_vram_gb?: number
  estimated_price_sar_per_hour?: number
  tags?: string[]
  sort_order?: number
  difficulty?: 'easy' | 'medium' | 'advanced'
  tier?: string
  icon?: string
  params?: Record<string, unknown>
  env_vars?: Array<{ key: string; label: string; default: string; required?: boolean }>
  category?: string
}

interface TemplateCardProps {
  template: DockerTemplate
  onDeploy: (template: DockerTemplate) => void
}

// ── Competitive pricing (from FOUNDER-STRATEGIC-BRIEF.md) ─────────────────────
const VRAM_SAVINGS: { minVram: number; savingsPct: number; gpuLabel: string }[] = [
  { minVram: 80, savingsPct: 40, gpuLabel: 'H100 80GB' },
  { minVram: 40, savingsPct: 33, gpuLabel: 'A100 40GB' },
  { minVram: 24, savingsPct: 28, gpuLabel: 'RTX 4090' },
  { minVram: 16, savingsPct: 24, gpuLabel: 'RTX 4080' },
  { minVram: 0,  savingsPct: 24, gpuLabel: 'GPU' },
]

function getVramInfo(vramGb: number | undefined) {
  const vram = vramGb ?? 0
  for (const tier of VRAM_SAVINGS) {
    if (vram >= tier.minVram) return tier
  }
  return { savingsPct: 24, gpuLabel: 'GPU' }
}

function getTierDisplay(tier?: string) {
  if (tier === 'instant') return { label: '⚡ Instant', latency: '~2s', cls: 'bg-status-success/10 text-status-success border-status-success/20' }
  if (tier === 'cached') return { label: '🚀 Cached', latency: '~10s', cls: 'bg-status-info/10 text-status-info border-status-info/20' }
  return { label: '⏱ On-Demand', latency: '30s+', cls: 'bg-dc1-surface-l3 text-dc1-text-secondary border-dc1-border' }
}

function getDifficultyDisplay(difficulty?: string) {
  if (difficulty === 'advanced') return { label: 'Advanced', cls: 'bg-status-error/10 text-status-error border-status-error/20' }
  if (difficulty === 'medium') return { label: 'Intermediate', cls: 'bg-dc1-amber/10 text-dc1-amber border-dc1-amber/20' }
  return { label: 'Easy', cls: 'bg-status-success/10 text-status-success border-status-success/20' }
}

export default function TemplateCard({ template, onDeploy }: TemplateCardProps) {
  const hasArabic = useMemo(() =>
    (template.tags ?? []).some(t => t.toLowerCase().includes('arabic')),
    [template.tags]
  )

  const tierDisplay = getTierDisplay(template.tier)
  const diffDisplay = getDifficultyDisplay(template.difficulty)
  const { savingsPct, gpuLabel } = getVramInfo(template.min_vram_gb)

  const priceHr = template.estimated_price_sar_per_hour ?? null
  const vastEquivPrice = priceHr !== null ? priceHr / (1 - savingsPct / 100) : null

  const descTruncated = template.description.length > 85
    ? template.description.slice(0, 82) + '…'
    : template.description

  return (
    <article
      className="bg-dc1-surface-l2 border border-dc1-border rounded-xl p-5 flex flex-col gap-3 hover:border-dc1-amber/40 hover:shadow-amber transition-all duration-200 group cursor-default"
    >
      {/* Header: icon + name + tier badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {template.icon && (
            <span className="text-xl shrink-0" aria-hidden="true">{template.icon}</span>
          )}
          <h3 className="text-base font-semibold text-dc1-text-primary leading-tight group-hover:text-dc1-amber transition-colors truncate">
            {template.name}
          </h3>
        </div>
        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ${tierDisplay.cls}`}>
          {tierDisplay.label}
        </span>
      </div>

      {/* Arabic AI badge */}
      {hasArabic && (
        <div className="flex">
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium bg-dc1-amber/10 text-dc1-amber border-dc1-amber/30">
            🌙 Arabic AI
          </span>
        </div>
      )}

      {/* Description */}
      <p className="text-sm text-dc1-text-secondary leading-relaxed">{descTruncated}</p>

      {/* GPU + latency specs */}
      <div className="bg-dc1-surface-l1 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {template.min_vram_gb && (
            <div>
              <span className="text-dc1-text-muted">VRAM</span>
              <span className="ml-1 font-semibold text-dc1-text-primary">{template.min_vram_gb} GB</span>
              <span className="ml-1 text-[10px] text-dc1-text-muted">({gpuLabel})</span>
            </div>
          )}
          <div>
            <span className="text-dc1-text-muted">Cold-start</span>
            <span className="ml-1 font-medium text-dc1-text-primary">{tierDisplay.latency}</span>
          </div>
        </div>
        {priceHr !== null && (
          <div className="text-right shrink-0">
            <p className="text-lg font-extrabold text-dc1-amber leading-none">
              {priceHr.toFixed(2)}
              <span className="text-xs font-normal text-dc1-text-secondary ml-1">SAR/hr</span>
            </p>
          </div>
        )}
      </div>

      {/* Competitive savings */}
      {priceHr !== null && vastEquivPrice !== null && (
        <div className="rounded-lg border border-status-success/20 bg-status-success/5 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-dc1-text-muted uppercase tracking-wide mb-0.5">vs Vast.ai equivalent</p>
              <p className="text-xs text-dc1-text-secondary">
                <span className="line-through">{vastEquivPrice.toFixed(2)} SAR/hr</span>
                <span className="ml-1 text-[10px] text-dc1-text-muted">(est.)</span>
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-status-success/10 border border-status-success/30 text-status-success text-xs font-bold">
              ↓ {savingsPct}% cheaper
            </span>
          </div>
        </div>
      )}

      {/* Difficulty badge + tags */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${diffDisplay.cls}`}>
          {diffDisplay.label}
        </span>
        {(template.tags ?? []).filter(t => !t.toLowerCase().includes('arabic')).slice(0, 3).map(tag => (
          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-dc1-surface-l3 text-dc1-text-muted border border-dc1-border">
            {tag}
          </span>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => onDeploy(template)}
        className="btn btn-primary w-full text-center text-sm mt-auto"
      >
        → Configure &amp; Deploy
      </button>
    </article>
  )
}
