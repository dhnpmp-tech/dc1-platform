'use client'

import { useState } from 'react'
import Link from 'next/link'

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
  pricing?: {
    floor_sar_per_hr?: number
    floor_halala_per_min?: number
  }
}

// ── Competitive pricing savings by VRAM tier (from FOUNDER-STRATEGIC-BRIEF.md) ──
// DCP is 23.7-51% below hyperscalers depending on GPU tier.
const VRAM_SAVINGS_TIERS: { minVram: number; savingsPct: number; competitor: string }[] = [
  { minVram: 80, savingsPct: 40, competitor: 'Lambda Labs' },
  { minVram: 40, savingsPct: 33, competitor: 'CoreWeave' },
  { minVram: 24, savingsPct: 28, competitor: 'Vast.ai' },
  { minVram: 16, savingsPct: 24, competitor: 'Vast.ai' },
  { minVram: 0, savingsPct: 24, competitor: 'Vast.ai' },
]

function getVramSavings(vramGb?: number) {
  const vram = vramGb ?? 0
  for (const tier of VRAM_SAVINGS_TIERS) {
    if (vram >= tier.minVram) return tier
  }
  return { savingsPct: 24, competitor: 'Vast.ai' }
}

function getDifficultyBadge(difficulty?: string) {
  if (difficulty === 'advanced')
    return { label: 'Advanced', cls: 'bg-status-error/10 text-status-error border-status-error/20' }
  if (difficulty === 'medium')
    return { label: 'Intermediate', cls: 'bg-dc1-amber/10 text-dc1-amber border-dc1-amber/20' }
  return { label: 'Easy', cls: 'bg-status-success/10 text-status-success border-status-success/20' }
}

function getTierBadge(tier?: string) {
  if (tier === 'instant')
    return { label: '⚡ Instant', cls: 'bg-status-success/10 text-status-success border-status-success/20' }
  if (tier === 'cached')
    return { label: '🚀 Cached', cls: 'bg-status-info/10 text-status-info border-status-info/20' }
  return { label: 'On-Demand', cls: 'bg-dc1-surface-l3 text-dc1-text-secondary border-dc1-border' }
}

// ── Props ──────────────────────────────────────────────────────────────────────
export interface TemplateCardProps {
  template: DockerTemplate
  /**
   * If provided, the "Deploy Now" button calls this function instead of linking
   * to the registration page. Used in the authenticated renter dashboard.
   */
  onDeploy?: (template: DockerTemplate) => void
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function TemplateCard({ template, onDeploy }: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false)
  const difficulty = getDifficultyBadge(template.difficulty)
  const tierBadge = getTierBadge(template.tier)
  const hasArabic = (template.tags ?? []).some(t => t.toLowerCase().includes('arabic'))
  const priceHr = template.estimated_price_sar_per_hour ?? null
  const { savingsPct, competitor } = getVramSavings(template.min_vram_gb)
  const competitorEquivPrice = priceHr !== null ? priceHr / (1 - savingsPct / 100) : null

  const deployHref = `/renter/register?template=${template.id}&source=marketplace_templates`

  return (
    <article className="bg-dc1-surface-l2 border border-dc1-border rounded-xl p-5 flex flex-col gap-3 hover:border-dc1-amber/30 hover:shadow-amber transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {template.icon && <span className="text-xl shrink-0">{template.icon}</span>}
          <h3 className="text-base font-bold text-dc1-text-primary leading-tight group-hover:text-dc1-amber transition-colors truncate">
            {template.name}
          </h3>
        </div>
        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ${tierBadge.cls}`}>
          {tierBadge.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-dc1-text-secondary leading-relaxed line-clamp-2">{template.description}</p>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${difficulty.cls}`}>
          {difficulty.label}
        </span>
        {hasArabic && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-dc1-amber/10 text-dc1-amber border-dc1-amber/20">
            🌙 Arabic
          </span>
        )}
        {(template.tags ?? []).slice(0, 3).map(tag => (
          <span
            key={tag}
            className="text-[10px] px-2 py-0.5 rounded-full bg-dc1-surface-l3 text-dc1-text-muted border border-dc1-border"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Specs */}
      <div className="bg-dc1-surface-l1 rounded-lg px-3 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs">
          {template.min_vram_gb && (
            <div>
              <span className="text-dc1-text-muted">VRAM</span>
              <span className="ml-1 font-semibold text-dc1-text-primary">{template.min_vram_gb} GB</span>
            </div>
          )}
          {template.job_type && (
            <div>
              <span className="text-dc1-text-muted">Type</span>
              <span className="ml-1 font-mono text-[10px] text-dc1-text-secondary">{template.job_type}</span>
            </div>
          )}
        </div>
        {priceHr !== null && (
          <div className="text-right">
            <p className="text-lg font-extrabold text-dc1-amber leading-none">
              {priceHr.toFixed(2)}
              <span className="text-xs font-normal text-dc1-text-secondary ml-1">SAR/hr</span>
            </p>
          </div>
        )}
      </div>

      {/* Competitive pricing comparison */}
      {priceHr !== null && competitorEquivPrice !== null && (
        <div className="rounded-lg border border-status-success/20 bg-status-success/5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-dc1-text-muted uppercase tracking-wide mb-0.5">
                vs {competitor} equivalent
              </p>
              <p className="text-xs text-dc1-text-secondary">
                <span className="line-through">{competitorEquivPrice.toFixed(2)} SAR/hr</span>
                <span className="ml-1 text-dc1-text-muted text-[10px]">(est.)</span>
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-status-success/10 border border-status-success/30 text-status-success text-xs font-bold">
              ↓ {savingsPct}% cheaper
            </span>
          </div>
        </div>
      )}

      {/* Expandable params */}
      {template.params && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-dc1-text-muted hover:text-dc1-text-primary transition-colors"
        >
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {expanded ? 'Hide' : 'View'} parameters
        </button>
      )}
      {expanded && template.params && (
        <pre className="text-[10px] font-mono text-dc1-text-secondary bg-dc1-surface-l1 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap">
          {JSON.stringify(template.params, null, 2)}
        </pre>
      )}

      {/* CTA */}
      {onDeploy ? (
        <button onClick={() => onDeploy(template)} className="btn btn-primary w-full text-sm mt-auto">
          Deploy Now
        </button>
      ) : (
        <Link href={deployHref} className="btn btn-primary w-full text-center text-sm mt-auto">
          Deploy Now
        </Link>
      )}
    </article>
  )
}
