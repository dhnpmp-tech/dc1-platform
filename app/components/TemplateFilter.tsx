'use client'

import { useCallback, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────
export type CategoryKey = 'all' | 'llm' | 'embedding' | 'image' | 'training' | 'notebook'
export type VramKey = '' | '8' | '16' | '24' | '40'
export type ArabicKey = 'all' | 'arabic'
export type SpeedKey = '' | 'instant' | 'cached' | 'on-demand'

export interface FilterState {
  category: CategoryKey
  vram: VramKey
  arabic: ArabicKey
  speed: SpeedKey
  search: string
}

export const FILTER_DEFAULTS: FilterState = {
  category: 'all',
  vram: '',
  arabic: 'all',
  speed: '',
  search: '',
}

interface TemplateFilterProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  totalCount: number
  filteredCount: number
  /** Counts per category key for displaying "(n)" labels */
  categoryCounts: Record<CategoryKey, number>
}

const CATEGORIES: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: 'all', label: 'All Templates', emoji: '✦' },
  { key: 'llm', label: 'LLM / Inference', emoji: '🤖' },
  { key: 'embedding', label: 'Embeddings & RAG', emoji: '🔍' },
  { key: 'image', label: 'Image Generation', emoji: '🎨' },
  { key: 'training', label: 'Training & Fine-tune', emoji: '🎓' },
  { key: 'notebook', label: 'Notebooks & Dev', emoji: '📓' },
]

const VRAM_OPTIONS: { value: VramKey; label: string }[] = [
  { value: '8', label: '8 GB+ (RTX 4090/4080)' },
  { value: '16', label: '16 GB+' },
  { value: '24', label: '24 GB+ (RTX 4090)' },
  { value: '40', label: '40 GB+ (A100/H100)' },
]

const SPEED_OPTIONS: { value: SpeedKey; label: string }[] = [
  { value: 'instant', label: '⚡ Instant (0-2s)' },
  { value: 'cached', label: '🚀 Cached (2-10s)' },
  { value: 'on-demand', label: '⏱ On-Demand (10s+)' },
]

// ── Collapsible section ────────────────────────────────────────────────────────
function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-dc1-border pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-xs font-semibold text-dc1-text-secondary uppercase tracking-wider mb-2 hover:text-dc1-text-primary transition-colors"
        aria-expanded={open}
      >
        {title}
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  )
}

// ── Checkbox option ────────────────────────────────────────────────────────────
function FilterOption({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2.5 py-1 cursor-pointer group">
      <div
        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
          checked
            ? 'bg-dc1-amber border-dc1-amber'
            : 'border-dc1-border bg-dc1-surface-l3 group-hover:border-dc1-amber/50'
        }`}
        onClick={onChange}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' || e.key === ' ' ? onChange() : undefined}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-sm text-dc1-text-secondary group-hover:text-dc1-text-primary transition-colors">
        {label}
      </span>
    </label>
  )
}

// ── Desktop sidebar ────────────────────────────────────────────────────────────
function SidebarContent({
  filters,
  onChange,
  totalCount,
  filteredCount,
  categoryCounts,
}: TemplateFilterProps) {
  const set = useCallback(<K extends keyof FilterState>(key: K, val: FilterState[K]) => {
    onChange({ ...filters, [key]: val })
  }, [filters, onChange])

  const activeFilterCount = (
    (filters.category !== 'all' ? 1 : 0) +
    (filters.vram !== '' ? 1 : 0) +
    (filters.arabic !== 'all' ? 1 : 0) +
    (filters.speed !== '' ? 1 : 0) +
    (filters.search.trim() ? 1 : 0)
  )

  const hasFilters = activeFilterCount > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dc1-text-muted pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search templates…"
          value={filters.search}
          onChange={e => set('search', e.target.value)}
          className="input ps-9 w-full text-sm"
          aria-label="Search templates"
        />
      </div>

      {/* Count display */}
      <p className="text-xs text-dc1-text-muted">
        {filters.search || hasFilters
          ? `Showing ${filteredCount} of ${totalCount} templates`
          : `Showing all ${totalCount} templates`
        }
      </p>

      {/* Category */}
      <FilterSection title="Category">
        {CATEGORIES.map(cat => (
          <FilterOption
            key={cat.key}
            checked={filters.category === cat.key}
            onChange={() => set('category', cat.key)}
            label={
              cat.key === 'all'
                ? `${cat.emoji} All Templates (${totalCount})`
                : `${cat.emoji} ${cat.label} (${categoryCounts[cat.key] ?? 0})`
            }
          />
        ))}
      </FilterSection>

      {/* GPU VRAM */}
      <FilterSection title="GPU VRAM">
        {VRAM_OPTIONS.map(opt => (
          <FilterOption
            key={opt.value}
            checked={filters.vram === opt.value}
            onChange={() => set('vram', filters.vram === opt.value ? '' : opt.value)}
            label={opt.label}
          />
        ))}
      </FilterSection>

      {/* Arabic Capability */}
      <FilterSection title="Arabic Capability">
        <FilterOption
          checked={filters.arabic === 'all'}
          onChange={() => set('arabic', 'all')}
          label="All languages"
        />
        <FilterOption
          checked={filters.arabic === 'arabic'}
          onChange={() => set('arabic', filters.arabic === 'arabic' ? 'all' : 'arabic')}
          label="🌙 Arabic AI models"
        />
      </FilterSection>

      {/* Deployment Speed */}
      <FilterSection title="Deployment Speed">
        {SPEED_OPTIONS.map(opt => (
          <FilterOption
            key={opt.value}
            checked={filters.speed === opt.value}
            onChange={() => set('speed', filters.speed === opt.value ? '' : opt.value)}
            label={opt.label}
          />
        ))}
      </FilterSection>

      {/* Reset */}
      {hasFilters && (
        <button
          onClick={() => onChange(FILTER_DEFAULTS)}
          className="btn btn-outline btn-sm w-full text-sm"
        >
          Reset filters
        </button>
      )}
    </div>
  )
}

// ── Mobile filter modal ────────────────────────────────────────────────────────
function MobileFilterModal({
  open,
  onClose,
  ...props
}: TemplateFilterProps & { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Filter templates"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative mt-auto bg-dc1-surface-l2 rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-dc1-text-primary">Filters</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-dc1-surface-l3 transition-colors" aria-label="Close filters">
            <svg className="w-5 h-5 text-dc1-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <SidebarContent {...props} />
        <button onClick={onClose} className="btn btn-primary w-full mt-5">
          Show {props.filteredCount} templates
        </button>
      </div>
    </div>
  )
}

// ── Public component ───────────────────────────────────────────────────────────
export default function TemplateFilter(props: TemplateFilterProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const activeFilterCount = (
    (props.filters.category !== 'all' ? 1 : 0) +
    (props.filters.vram !== '' ? 1 : 0) +
    (props.filters.arabic !== 'all' ? 1 : 0) +
    (props.filters.speed !== '' ? 1 : 0) +
    (props.filters.search.trim() ? 1 : 0)
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-24 bg-dc1-surface-l1 border border-dc1-border rounded-xl p-5">
          <h2 className="text-sm font-bold text-dc1-text-primary mb-4">Filter &amp; Search</h2>
          <SidebarContent {...props} />
        </div>
      </aside>

      {/* Mobile: filter button */}
      <div className="lg:hidden fixed bottom-6 end-4 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 bg-dc1-amber text-white px-4 py-2.5 rounded-full shadow-lg font-medium text-sm"
          aria-label={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-white text-dc1-amber rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile modal */}
      <MobileFilterModal
        {...props}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
    </>
  )
}
