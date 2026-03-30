'use client'

import Link from 'next/link'
import { Space_Grotesk } from 'next/font/google'
import { useState, useEffect, useRef } from 'react'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import { useLanguage } from './lib/i18n'
import { persistRoleIntent, readRoleIntent, RoleIntent, trackRoleIntentApplied } from './lib/role-intent'

const RELIABILITY_POLL_MS = 30_000
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'] })

interface AvailabilityProvider {
  gpu_model?: string | null
  is_live?: boolean | null
}

function extractGpuFamily(gpuModel: string | null | undefined): string {
  const model = String(gpuModel || '').toUpperCase()
  if (!model) return 'Unknown'
  if (model.includes('H200')) return 'H200'
  if (model.includes('H100')) return 'H100'
  if (model.includes('A100')) return 'A100'
  if (model.includes('A40')) return 'A40'
  if (model.includes('L40')) return 'L40'
  if (model.includes('4090')) return 'RTX 4090'
  if (model.includes('3090')) return 'RTX 3090'
  if (model.includes('A6000')) return 'RTX A6000'
  if (model.includes('A5000')) return 'RTX A5000'
  if (model.includes('RTX')) return 'RTX'
  return model.split(/[\s/-]+/).slice(0, 2).join(' ') || 'Unknown'
}

function formatReliabilityTimestamp(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
}

interface DetailedHealth {
  providers: { registered: number; online: number }
}

function LaunchBanner({ health }: { health: DetailedHealth | null }) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('dcp-launch-banner-dismissed') === '1') {
      setDismissed(true)
    }
  }, [])

  const dismiss = () => {
    setDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('dcp-launch-banner-dismissed', '1')
    }
  }

  const registered = health?.providers?.registered ?? 0
  const online = health?.providers?.online ?? 0
  const showBanner = !dismissed && online === 0 && registered >= 40

  if (!showBanner) return null

  return (
    <div className="relative bg-dc1-amber/10 border-b border-dc1-amber/30 px-4 py-3 text-center">
      <p className="text-sm text-dc1-text-primary">
        <span className="font-semibold text-dc1-amber">DCP Phase 1 is live</span>
        {' — '}
        {registered} providers joining. Be first to deploy Arabic AI in-Kingdom.{' '}
        <Link href="/models" className="font-semibold text-dc1-amber underline hover:text-dc1-amber/80">
          Start Building →
        </Link>
      </p>
      <button
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-dc1-text-muted hover:text-dc1-text-primary"
        aria-label="Dismiss banner"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function ProviderCountWidget({ health }: { health: DetailedHealth | null }) {
  const online = health?.providers?.online ?? null
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={`inline-block h-2 w-2 rounded-full transition-colors ${
          online === null ? 'bg-dc1-text-muted/40 animate-pulse' : online > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-dc1-text-muted/40'
        }`}
      />
      <span className={`font-bold tabular-nums transition-all ${online !== null && online > 0 ? 'text-emerald-400' : 'text-dc1-text-muted'}`}>
        {online ?? '—'}
      </span>
      <span className="text-dc1-text-secondary">providers online</span>
    </span>
  )
}

export default function HomePage() {
  const { t } = useLanguage()
  const [heroRevealed, setHeroRevealed] = useState(false)
  const [liveGpuCount, setLiveGpuCount] = useState<number | null>(null)
  const [gpuFamilyCoverage, setGpuFamilyCoverage] = useState<number | null>(null)
  const [reliabilityUpdatedAt, setReliabilityUpdatedAt] = useState<Date | null>(null)
  const [selectedIntent, setSelectedIntent] = useState<RoleIntent>('renter')
  const [detailedHealth, setDetailedHealth] = useState<DetailedHealth | null>(null)
  const billingExplainerRef = useRef<HTMLDivElement | null>(null)
  const hasTrackedBillingExplainerView = useRef(false)

  const trackLandingEvent = (event: string, payload: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') return
    const detail = {
      event,
      source_page: 'landing',
      role_intent: selectedIntent,
      surface: 'landing_page',
      destination: 'none',
      step: 'view',
      ...payload,
    }
    window.dispatchEvent(new CustomEvent('dc1_analytics', { detail }))
    const win = window as typeof window & {
      dataLayer?: Array<Record<string, unknown>>
      gtag?: (...args: unknown[]) => void
    }
    if (Array.isArray(win.dataLayer)) {
      win.dataLayer.push(detail)
    }
    if (typeof win.gtag === 'function') {
      win.gtag('event', event, detail)
    }
  }

  const updateIntent = (intent: RoleIntent, source: string, selectionType: string) => {
    const previousIntent = selectedIntent
    setSelectedIntent(intent)
    persistRoleIntent(intent, {
      source,
      previousIntent,
      reason: previousIntent && previousIntent !== intent ? 'overridden' : 'persisted',
    })
    trackLandingEvent('landing_path_selected', {
      role_intent: intent,
      surface: source,
      destination: 'intent_selection',
      step: selectionType,
    })
  }

  const features = [
    {
      title: t('landing.feat_payg_title'),
      description: t('landing.feat_payg_desc'),
      cta: t('landing.feat_payg_cta'),
      href: '/renter/register',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: t('landing.feat_pdpl_title'),
      description: t('landing.feat_pdpl_desc'),
      cta: t('landing.feat_pdpl_cta'),
      href: '/privacy',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: 'OpenAI-Compatible API',
      description: 'Drop-in replacement for OpenAI API. Use your existing code with Arabic AI models hosted in Saudi Arabia.',
      cta: t('landing.feat_vllm_cta'),
      href: '/docs',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
  ]

  useEffect(() => {
    const storedIntent = readRoleIntent()
    if (storedIntent) {
      setSelectedIntent(storedIntent)
      trackRoleIntentApplied(storedIntent, { source: 'landing', destination: 'hero_paths' })
    }

    const fetchReliability = async () => {
      try {
        const res = await fetch('/api/dc1/providers/available')
        if (!res.ok) return

        const payload = await res.json()
        const providers: AvailabilityProvider[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.providers)
            ? payload.providers
            : []

        const hasLiveFlag = providers.some((p) => typeof p?.is_live === 'boolean')
        const liveCount = hasLiveFlag
          ? providers.filter((p) => p?.is_live).length
          : providers.length
        const families = new Set(
          providers
            .map((p) => extractGpuFamily(p?.gpu_model))
            .filter((family) => family !== 'Unknown')
        )

        setLiveGpuCount(liveCount)
        setGpuFamilyCoverage(families.size)
        setReliabilityUpdatedAt(new Date())
      } catch {
        // Keep last successful values visible.
      }
    }

    fetchReliability()
    const interval = setInterval(fetchReliability, RELIABILITY_POLL_MS)

    const fetchDetailedHealth = async () => {
      try {
        const res = await fetch('/api/dc1/health/detailed', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        setDetailedHealth(data)
      } catch {
        // silently keep last value
      }
    }

    fetchDetailedHealth()
    const healthInterval = setInterval(fetchDetailedHealth, 60_000)

    return () => {
      clearInterval(interval)
      clearInterval(healthInterval)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setHeroRevealed(true), 30)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const node = billingExplainerRef.current
    if (!node || hasTrackedBillingExplainerView.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (hasTrackedBillingExplainerView.current) return
        if (entries.some((entry) => entry.isIntersecting)) {
          hasTrackedBillingExplainerView.current = true
          trackLandingEvent('billing_explainer_viewed', {
            surface: 'billing_explainer',
            destination: 'onscreen',
            step: 'view',
          })
          observer.disconnect()
        }
      },
      { threshold: 0.35 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const trustPolicies = [
    {
      title: t('landing.trust_settlement_title'),
      description: t('landing.trust_settlement_desc'),
    },
    {
      title: t('landing.trust_execution_title'),
      description: t('landing.trust_execution_desc'),
    },
    {
      title: t('landing.trust_models_title'),
      description: t('landing.trust_models_desc'),
    },
  ]
  const segmentProofItems = [
    t('proof.segment.item_energy'),
    t('proof.segment.item_models'),
    t('proof.segment.item_execution'),
  ]
  const pathChooserLanes = [
    {
      key: 'build_on_dcp',
      label: 'Build on DCP',
      description: 'Launch inference quickly with Arabic-ready models, API access, and clear per-token settlement.',
      href: '/renter/register?source=landing_path_chooser&lane=build_on_dcp',
      cta: 'Start as Renter',
    },
    {
      key: 'earn_as_provider',
      label: 'Earn as Provider',
      description: 'Register your GPU, stay online with heartbeat reporting, and receive workload-based earnings.',
      href: '/provider/register?source=landing_path_chooser&lane=earn_as_provider',
      cta: 'Start as Provider',
    },
  ]
  const howDcpWorksSteps = [
    {
      key: 'choose_model',
      title: 'Choose Model',
      description: 'Select from Arabic AI models (ALLaM, JAIS, Falcon) or global models via OpenAI-compatible API.',
    },
    {
      key: 'call_inference_api',
      title: 'Call Inference API',
      description: 'Send requests to your model endpoint. Saudi data residency, per-token billing, zero ops.',
    },
    {
      key: 'settle_usage',
      title: 'Track & Settle',
      description: 'Monitor usage and costs in real-time. Pay per token with SAR billing.',
    },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <LaunchBanner health={detailedHealth} />

      {/* Hero */}
      <section className="relative min-h-[72dvh] overflow-hidden border-b border-dc1-border/80 md:min-h-[86dvh]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(245,165,36,0.16),transparent_38%),radial-gradient(circle_at_88%_12%,rgba(245,165,36,0.08),transparent_30%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-dc1-amber/10 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-dc1-void to-transparent" />

        <div className="relative mx-auto grid max-w-[1240px] gap-8 px-4 py-10 sm:px-6 md:py-20 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] lg:gap-12 lg:px-8">
          <div>
            <div
              className={`mb-6 inline-flex items-center gap-2 rounded-full border border-dc1-amber/25 bg-dc1-amber/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dc1-amber transition-all duration-300 ${
                heroRevealed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
              }`}
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-dc1-amber" />
              Inference API Marketplace
            </div>
            <h1
              className={`${spaceGrotesk.className} max-w-[14ch] text-4xl font-semibold leading-[0.95] tracking-[-0.03em] text-dc1-amber transition-all delay-75 duration-500 sm:text-5xl lg:text-6xl ${
                heroRevealed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
              }`}
            >
              {t('landing.hero_title')}
            </h1>
            <p
              className={`mt-5 max-w-2xl text-base leading-relaxed text-dc1-text-secondary transition-all delay-100 duration-500 sm:text-lg ${
                heroRevealed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
              }`}
            >
              {t('landing.hero_desc')}
            </p>
            <p
              className={`mt-4 hidden max-w-2xl text-sm leading-relaxed text-dc1-text-secondary/90 transition-all delay-150 duration-500 sm:block ${
                heroRevealed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
              }`}
            >
              OpenAI-compatible inference with Arabic model support, Saudi data residency, and per-token billing on Saudi energy-powered GPU infrastructure.
            </p>

            <div className={`mt-7 flex flex-col gap-3 transition-all delay-200 duration-500 sm:flex-row ${heroRevealed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
              <Link
                href="/renter/register?source=landing_first_fold&intent=renter"
                onClick={() => {
                  updateIntent('renter', 'landing_first_fold', 'primary_cta')
                  trackLandingEvent('landing_primary_cta_clicked', {
                    role_intent: 'renter',
                    surface: 'hero_primary_cta',
                    destination: '/renter/register?source=landing_first_fold&intent=renter',
                    step: 'primary_cta',
                  })
                }}
                className="btn btn-primary btn-lg w-full transition-transform duration-200 hover:-translate-y-[1px] sm:w-auto"
              >
                {t('landing.cta_renter')}
              </Link>
              <Link
                href="/provider/register?source=landing_first_fold&intent=provider"
                onClick={() => {
                  updateIntent('provider', 'landing_first_fold', 'primary_cta')
                  trackLandingEvent('landing_primary_cta_clicked', {
                    role_intent: 'provider',
                    surface: 'hero_primary_cta',
                    destination: '/provider/register?source=landing_first_fold&intent=provider',
                    step: 'primary_cta',
                  })
                }}
                className="btn btn-secondary btn-lg w-full transition-transform duration-200 hover:-translate-y-[1px] sm:w-auto"
              >
                {t('landing.cta_provider')}
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-dc1-text-muted">
              <ProviderCountWidget health={detailedHealth} />
              <span className="hidden h-1 w-1 rounded-full bg-dc1-text-muted sm:inline-block" />
              <span className="hidden sm:inline">
                {t('landing.cta_alt_prefix')}{' '}
                <Link href="/support?category=enterprise&source=landing-first-fold" className="font-semibold text-dc1-amber hover:text-dc1-amber/80">
                  {t('landing.cta_enterprise')}
                </Link>
              </span>
            </div>

            <p className="mt-6 hidden text-sm text-dc1-text-secondary sm:block">
              {t('landing.already_account')}{' '}
              <Link href="/login" className="font-semibold text-dc1-amber underline underline-offset-2 hover:text-dc1-amber/80">
                {t('landing.sign_in_here')}
              </Link>
            </p>
          </div>

          <div className={`space-y-4 transition-all delay-300 duration-500 ${heroRevealed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
            <div className="rounded-2xl border border-dc1-border bg-dc1-surface-l1/90 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc1-amber">{t('landing.reliability_strip_label')}</p>
              <div className="mt-3 divide-y divide-dc1-border rounded-xl border border-dc1-border bg-dc1-surface-l2">
                <div className="flex items-center justify-between px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-dc1-text-secondary">{t('landing.reliability_live_providers')}</p>
                  <p className="text-xl font-bold text-dc1-text-primary">{liveGpuCount ?? '—'}</p>
                </div>
                <div className="flex items-center justify-between px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-dc1-text-secondary">{t('landing.reliability_gpu_families')}</p>
                  <p className="text-xl font-bold text-dc1-text-primary">{gpuFamilyCoverage ?? '—'}</p>
                </div>
                <div className="flex items-center justify-between px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-dc1-text-secondary">{t('landing.live_stat_last_updated')}</p>
                  <p className="text-xs font-semibold text-dc1-text-primary">
                    {reliabilityUpdatedAt ? formatReliabilityTimestamp(reliabilityUpdatedAt) : t('landing.reliability_unavailable')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-dc1-border bg-dc1-surface-l1/90 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc1-amber">How DCP works</p>
              <div className="mt-3 space-y-2">
                {howDcpWorksSteps.map((item, index) => (
                  <div key={item.key} className="flex gap-3 rounded-lg border border-dc1-border bg-dc1-surface-l2 p-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dc1-amber/35 bg-dc1-amber/10 text-xs font-semibold text-dc1-amber">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-dc1-text-primary">{item.title}</p>
                      <p className="mt-0.5 text-xs text-dc1-text-secondary">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc1-amber">Choose your path</p>
          <p className="mt-2 max-w-2xl text-sm text-dc1-text-secondary">Pick one lane to start quickly. You can switch roles later from your account.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {pathChooserLanes.map((lane) => (
            <Link
              key={lane.key}
              href={lane.href}
              className="flex min-h-[220px] flex-col rounded-xl border border-dc1-border bg-dc1-surface-l1 p-5 transition-all hover:-translate-y-0.5 hover:border-dc1-amber/40"
            >
              <p className="text-lg font-medium text-dc1-text-primary">{lane.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-dc1-text-secondary">{lane.description}</p>
              <span className="mt-auto pt-6 text-sm font-semibold text-dc1-amber">{lane.cta} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-4 pb-10 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-dc1-amber/30 bg-dc1-amber/10 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc1-amber">{t('proof.segment.title')}</p>
          <ul className="mt-2 grid list-disc gap-1 ps-5 text-sm text-dc1-text-secondary sm:grid-cols-3 sm:gap-3 sm:list-none sm:ps-0">
            {segmentProofItems.map((item) => (
              <li key={item} className="sm:before:me-2 sm:before:content-['•']">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
      {/* Trust policy module */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1/70 p-6">
          <h2 className="text-xl font-semibold text-dc1-text-primary mb-2">{t('landing.trust_module_title')}</h2>
          <p className="text-sm text-dc1-text-secondary mb-4">{t('landing.trust_module_intro')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trustPolicies.map((item) => (
              <div key={item.title} className="rounded-lg border border-dc1-border bg-dc1-surface-l2 p-4 text-left">
                <p className="text-sm font-semibold text-dc1-text-primary mb-1">{item.title}</p>
                <p className="text-xs text-dc1-text-secondary">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Billing transparency */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div ref={billingExplainerRef} className="rounded-xl border border-dc1-amber/25 bg-dc1-amber/5 p-6">
          <h2 className="text-xl font-semibold text-dc1-text-primary mb-3">{t('billing.explainer.title')}</h2>
          <ul className="space-y-2 text-sm text-dc1-text-secondary">
            <li>{t('billing.explainer.step1')}</li>
            <li>{t('billing.explainer.step2')}</li>
            <li>{t('billing.explainer.step3')}</li>
          </ul>
          <p className="mt-3 text-xs text-dc1-text-muted">{t('billing.explainer.note')}</p>
          <p className="mt-2 text-xs text-dc1-text-muted">{t('billing.explainer.rail_status')}</p>
        </div>
      </section>

      {/* Supported Models – scrolling marquee */}
      <section className="py-16 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dc1-amber text-center">
            Saudi-ready AI workloads with Arabic model support
          </p>
        </div>
        <div className="relative w-full">
          <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-40 bg-gradient-to-r from-[#0d1117] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-40 bg-gradient-to-l from-[#0d1117] to-transparent z-10 pointer-events-none" />
          <div className="flex animate-marquee">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex items-center gap-14 sm:gap-20 px-7 sm:px-10 shrink-0">
                {[
                  { src: '/logos/meta-text.png', alt: 'Meta' },
                  { src: '/logos/falcon-purple.svg', alt: 'Falcon LLM' },
                  { src: '/logos/mistral-text.png', alt: 'Mistral AI' },
                  { src: '/logos/inception-full.png', alt: 'Inception' },
                  { src: '/logos/qwen-text.png', alt: 'Qwen' },
                  { src: '/logos/tii-text.png', alt: 'TII' },
                  { src: '/logos/stability-text.png', alt: 'Stability AI' },
                  { src: '/logos/microsoft-text.png', alt: 'Microsoft' },
                  { src: '/logos/huggingface-text.png', alt: 'Hugging Face' },
                  { src: '/arabic-ai-logos/allam-humain.png', alt: 'ALLaM' },
                ].map((logo, i) => (
                  <img
                    key={`${copy}-${i}`}
                    src={logo.src}
                    alt={logo.alt}
                    className="h-7 sm:h-9 w-auto object-contain brightness-0 invert opacity-50 hover:opacity-90 transition-opacity duration-300 shrink-0"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Pricing section removed — rates not yet finalized */}

      {/* Usage Paths */}
      <section className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <div className="text-center mb-12">
          <h2 className={`${spaceGrotesk.className} text-3xl font-semibold tracking-[-0.02em] text-dc1-text-primary sm:text-[2.1rem] mb-4`}>
            Choose your workflow
          </h2>
          <p className="text-dc1-text-secondary max-w-2xl mx-auto">
            Validate quickly in-browser, then move to API-driven container jobs for repeatable integration.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-10">
          {/* Playground */}
          <div className="lg:col-span-6 bg-dc1-surface-l2 border border-dc1-border rounded-lg p-8 transition-all duration-200 hover:border-dc1-border-light hover:shadow-md group">
            <div className="w-12 h-12 rounded-lg bg-dc1-amber/10 flex items-center justify-center text-dc1-amber mb-6 group-hover:bg-dc1-amber/20 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-dc1-text-primary mb-2">Browser Playground</h3>
            <p className="text-sm text-dc1-text-secondary mb-6 leading-relaxed">
              Verify a first workload from your browser with minimal setup. Pick a model, review output quality, and decide when it is production-ready.
            </p>
            <ul className="space-y-2 mb-8">
              {[
                'No local install required',
                'Routing checks policy and compatibility before assignment',
                'Pre-run estimate is shown before execution',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-dc1-text-secondary">
                  <span className="w-1.5 h-1.5 bg-dc1-amber rounded-full flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/renter/register" className="btn btn-primary btn-sm">
              Try the playground
            </Link>
          </div>

          {/* Custom Jobs */}
          <div className="lg:col-span-4 bg-dc1-surface-l2 border border-dc1-border rounded-lg p-8 transition-all duration-200 hover:border-dc1-border-light hover:shadow-md group">
            <div className="w-12 h-12 rounded-lg bg-dc1-amber/10 flex items-center justify-center text-dc1-amber mb-6 group-hover:bg-dc1-amber/20 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-dc1-text-primary mb-2">Container Jobs</h3>
            <p className="text-sm text-dc1-text-secondary mb-6 leading-relaxed">
              Run repeatable, policy-aligned container jobs for training, fine-tuning, or batch workloads using an API-first flow.
            </p>
            <ul className="space-y-2 mb-8">
              {[
                'Approved container runtimes from the DCP catalog',
                'GPU-scoped execution within isolated workspaces',
                'Submit and track jobs via REST API',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-dc1-text-secondary">
                  <span className="w-1.5 h-1.5 bg-dc1-amber rounded-full flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/docs" className="btn btn-secondary btn-sm">
              View API docs
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-4">
            {t('landing.features_title')}
          </h2>
          <p className="text-dc1-text-secondary max-w-2xl mx-auto">
            {t('landing.features_desc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="bg-dc1-surface-l2 border border-dc1-border rounded-lg p-6 transition-all duration-200 hover:border-dc1-border-light hover:shadow-md hover:-translate-y-0.5 group">
              <div className="w-12 h-12 rounded-lg bg-dc1-amber/10 flex items-center justify-center text-dc1-amber mb-4 group-hover:bg-dc1-amber/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-dc1-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-dc1-text-secondary mb-4 leading-relaxed">{feature.description}</p>
              <Link
                href={feature.href}
                className="inline-flex items-center gap-1 text-sm font-medium text-dc1-amber hover:text-dc1-amber-hover transition-colors"
              >
                {feature.cta}
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-dc1-surface-l1 border-y border-dc1-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold text-dc1-text-primary text-center mb-16">{t('landing.how_title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '01', title: t('landing.how_step1_title'), desc: t('landing.how_step1_desc') },
              { step: '02', title: t('landing.how_step2_title'), desc: t('landing.how_step2_desc') },
              { step: '03', title: t('landing.how_step3_title'), desc: t('landing.how_step3_desc') },
              { step: '04', title: t('landing.how_step4_title'), desc: t('landing.how_step4_desc') },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-dc1-amber/10 border border-dc1-amber/30 flex items-center justify-center text-dc1-amber font-bold text-sm mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-dc1-text-primary mb-2">{item.title}</h3>
                <p className="text-sm text-dc1-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Provider Setup Demo */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-4">
            {t('landing.setup_title')}
          </h2>
          <p className="text-dc1-text-secondary max-w-2xl mx-auto">
            {t('landing.setup_desc')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            {[
              {
                step: '1',
                title: t('landing.setup_step1_title'),
                desc: t('landing.setup_step1_desc'),
              },
              {
                step: '2',
                title: t('landing.setup_step2_title'),
                desc: t('landing.setup_step2_desc'),
                code: '# Linux / macOS\ncurl -sSL "https://dcp.sa/api/dc1/providers/download/setup?key=YOUR_PROVIDER_KEY&os=linux" | bash',
              },
              {
                step: '3',
                title: t('landing.setup_step3_title'),
                desc: t('landing.setup_step3_desc'),
              },
              {
                step: '4',
                title: t('landing.setup_step4_title'),
                desc: t('landing.setup_step4_desc'),
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-dc1-amber flex items-center justify-center text-dc1-void font-bold text-sm">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-dc1-text-primary mb-1">{item.title}</h3>
                  <p className="text-sm text-dc1-text-secondary mb-2">{item.desc}</p>
                  {item.code && (
                    <pre className="bg-dc1-surface-l1 border border-dc1-border rounded-lg px-4 py-3 text-xs text-dc1-amber font-mono overflow-x-auto max-w-full whitespace-pre-wrap break-all">
                      {item.code}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="card border-dc1-amber/20">
            <p className="text-xs text-dc1-text-muted mb-3 font-mono uppercase tracking-wider">Windows (PowerShell)</p>
            <pre className="text-xs text-dc1-amber font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">{`# Run as Administrator
Invoke-WebRequest \`
  -Uri "https://dcp.sa/api/dc1/providers/download/setup?key=YOUR_PROVIDER_KEY&os=windows" \`
  -OutFile setup.ps1
.\\setup.ps1`}</pre>
            <div className="mt-4 pt-4 border-t border-dc1-border">
              <p className="text-xs text-dc1-text-muted mb-2">After install, your terminal shows:</p>
              <pre className="text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap break-words max-w-full">{`✓ GPU detected: RTX 4090 (24 GB)
✓ Daemon connected and reporting heartbeat
✓ Connected to DCP — heartbeat active for compatible workload routing`}</pre>
            </div>
          </div>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-4">
            {t('landing.run_title')}
          </h2>
          <p className="text-dc1-text-secondary max-w-2xl mx-auto">
            {t('landing.run_desc')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: t('landing.run_llm_title'),
              desc: t('landing.run_llm_desc'),
              tags: ['ALLaM', 'Falcon', 'Llama 3', 'JAIS'],
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              ),
            },
            {
              title: t('landing.run_sd_title'),
              desc: t('landing.run_sd_desc'),
              tags: ['SDXL', 'ControlNet', 'DreamBooth'],
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ),
            },
            {
              title: t('landing.run_pytorch_title'),
              desc: t('landing.run_pytorch_desc'),
              tags: ['LoRA', 'QLoRA', 'PyTorch'],
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ),
            },
            {
              title: t('landing.run_jupyter_title'),
              desc: t('landing.run_jupyter_desc'),
              tags: ['ALLaM 7B', 'Falcon H1', 'JAIS 13B', 'BGE-M3'],
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              ),
            },
            {
              title: t('landing.run_docker_title'),
              desc: t('landing.run_docker_desc'),
              tags: ['Docker', 'CUDA', 'Custom'],
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              ),
            },
            {
              title: t('landing.run_cuda_title'),
              desc: t('landing.run_cuda_desc'),
              tags: ['CUDA', 'Batch', 'HPC'],
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              ),
            },
          ].map((item) => (
            <div key={item.title} className="bg-dc1-surface-l2 border border-dc1-border rounded-lg p-6 transition-all duration-200 hover:border-dc1-border-light hover:shadow-md hover:-translate-y-0.5 group">
              <div className="w-10 h-10 rounded-lg bg-dc1-amber/10 flex items-center justify-center text-dc1-amber mb-4 group-hover:bg-dc1-amber/20 transition-colors">
                {item.icon}
              </div>
              <h3 className="text-base font-semibold text-dc1-text-primary mb-2">{item.title}</h3>
              <p className="text-sm text-dc1-text-secondary mb-4 leading-relaxed">{item.desc}</p>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded text-xs font-mono bg-dc1-surface-l2 text-dc1-text-muted border border-dc1-border">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Official SDKs */}
      <section className="bg-dc1-surface-l1 border-y border-dc1-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-dc1-amber/10 border border-dc1-amber/20 text-dc1-amber text-sm font-medium mb-6">
                {t('landing.vscode_badge')}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-6">
                {t('landing.vscode_title')}
              </h2>
              <p className="text-dc1-text-secondary mb-6 leading-relaxed">
                {t('landing.vscode_desc')}
              </p>
              <ul className="space-y-3 text-sm text-dc1-text-secondary mb-8">
                {[
                  t('landing.vscode_feature1'),
                  t('landing.vscode_feature2'),
                  t('landing.vscode_feature3'),
                  t('landing.vscode_feature4'),
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-dc1-amber/10 border border-dc1-amber/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-dc1-amber" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/docs" className="inline-flex items-center gap-2 btn btn-secondary btn-sm">
                {t('landing.vscode_docs')}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="card border-dc1-amber/20 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="text-xs text-dc1-text-muted font-mono ml-2">terminal</span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-dc1-text-muted font-mono mb-1"># Python — provider SDK</p>
                  <pre className="bg-dc1-surface-l2 rounded px-3 py-2 border border-dc1-border text-xs text-dc1-amber font-mono max-w-full overflow-x-auto whitespace-pre-wrap"># Check the latest SDK package name in /docs/sdk-guides</pre>
                </div>
                <div>
                  <p className="text-xs text-dc1-text-muted font-mono mb-1"># Node.js — renter SDK</p>
                  <pre className="bg-dc1-surface-l2 rounded px-3 py-2 border border-dc1-border text-xs text-dc1-amber font-mono max-w-full overflow-x-auto whitespace-pre-wrap"># Check the latest SDK package name in /docs/sdk-guides</pre>
                </div>
              </div>
              <div className="border-t border-dc1-border pt-4">
                <p className="text-xs text-dc1-text-muted font-mono mb-2">Quick start:</p>
                <pre className="text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap">{`from dcp_provider import DCPProvider

provider = DCPProvider(api_key="your-key")
provider.register_gpu()
provider.start()  # initialize, heartbeat, and run assigned container workloads`}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Programmatic Integration */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-dc1-amber/10 border border-dc1-amber/20 text-dc1-amber text-sm font-medium mb-6">
              {t('landing.api_badge')}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-6">
              {t('landing.api_title')}
            </h2>
            <p className="text-dc1-text-secondary mb-6 leading-relaxed">
              {t('landing.api_desc')}
            </p>
            <ul className="space-y-3 text-sm text-dc1-text-secondary">
              {[
                t('landing.api_feature1'),
                t('landing.api_feature2'),
                t('landing.api_feature3'),
                t('landing.api_feature4'),
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-dc1-amber/10 border border-dc1-amber/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-dc1-amber" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="card border-dc1-amber/20">
            <p className="text-xs text-dc1-text-muted mb-3 font-mono uppercase tracking-wider">Submit a job</p>
            <pre className="text-xs text-dc1-amber font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">{`curl -X POST https://dcp.sa/api/dc1/jobs/submit \\
  -H "Content-Type: application/json" \\
  -H "x-renter-key: dcp-renter-..." \\
  -d '{
    "provider_id": 26,
    "job_type": "llm_inference",
    "duration_minutes": 5,
    "container_spec": {
      "image_type": "vllm-serve"
    },
    "params": {
      "model": "ALLaM-7B-Instruct",
      "prompt": "Hello world"
    }
  }'`}</pre>
            <div className="mt-4 pt-4 border-t border-dc1-border">
              <p className="text-xs text-dc1-text-muted mb-2">Response:</p>
              <pre className="text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap break-words max-w-full">{`{
  "job_id": "job-abc123",
  "status": "queued",
  "status_detail": "queued"
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="card border-dc1-amber/20 text-center py-12 px-8 glow-amber">
          <h2 className="text-2xl sm:text-3xl font-bold text-dc1-text-primary mb-4">
            {t('landing.cta_title')}
          </h2>
          <p className="text-dc1-text-secondary max-w-xl mx-auto mb-8">
            {t('landing.cta_desc')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/renter/register" className="btn btn-primary btn-lg w-full sm:w-auto">
              {t('landing.cta_register_renter')}
            </Link>
            <Link href="/provider/register" className="btn btn-secondary btn-lg w-full sm:w-auto">
              {t('landing.cta_register_provider')}
            </Link>
          </div>
          <div className="mt-6">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors"
            >
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              {t('landing.cta_browse')}
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
