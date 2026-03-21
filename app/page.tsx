'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import { useLanguage } from './lib/i18n'

const GPU_RATES: { model: string; rate: number }[] = []
const RELIABILITY_POLL_MS = 30_000

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

export default function HomePage() {
  const { t } = useLanguage()
  const [liveGpuCount, setLiveGpuCount] = useState<number | null>(null)
  const [gpuFamilyCoverage, setGpuFamilyCoverage] = useState<number | null>(null)
  const [reliabilityUpdatedAt, setReliabilityUpdatedAt] = useState<Date | null>(null)
  const [selectedIntent, setSelectedIntent] = useState<'renter' | 'provider'>('renter')


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
      title: t('landing.feat_vllm_title'),
      description: t('landing.feat_vllm_desc'),
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
    return () => clearInterval(interval)
  }, [])

  const stats = [
    { value: liveGpuCount !== null ? `${liveGpuCount}` : '1', label: t('landing.stat_gpus_online'), live: liveGpuCount !== null },
    { value: '75%', label: t('landing.stat_uptime'), live: false },
    { value: 'RTX 4090 · A100 · H100', label: t('landing.stat_min_rate'), live: false },
    { value: '7', label: t('landing.stat_platform'), live: false },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-dc1-amber/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-dc1-amber/10 border border-dc1-amber/20 text-dc1-amber text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-dc1-amber rounded-full animate-pulse" />
              {t('landing.hero_badge')}
            </div>
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight mb-6 text-dc1-amber">
              {t('landing.hero_title')}
            </h1>
            <p className="text-lg sm:text-xl text-dc1-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
              {t('landing.hero_desc')}
            </p>
            <div className="max-w-4xl mx-auto w-full">
              <div className="flex flex-wrap items-center justify-center gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => setSelectedIntent('renter')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedIntent === 'renter'
                      ? 'bg-dc1-amber text-dc1-void'
                      : 'bg-dc1-surface-l2 border border-dc1-border text-dc1-text-secondary hover:text-dc1-text-primary'
                  }`}
                >
                  I need compute
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIntent('provider')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedIntent === 'provider'
                      ? 'bg-dc1-amber text-dc1-void'
                      : 'bg-dc1-surface-l2 border border-dc1-border text-dc1-text-secondary hover:text-dc1-text-primary'
                  }`}
                >
                  I have GPUs
                </button>
              </div>

              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 text-left ${selectedIntent === 'provider' ? 'opacity-75' : ''}`}>
                <Link
                  href="/renter/register"
                  className={`rounded-xl p-5 border transition-all ${
                    selectedIntent === 'renter'
                      ? 'border-dc1-amber bg-dc1-amber/10 shadow-sm'
                      : 'border-dc1-border bg-dc1-surface-l2 hover:border-dc1-border-light'
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.12em] text-dc1-amber font-semibold mb-2">Renter path</p>
                  <h3 className="text-lg font-semibold text-dc1-text-primary mb-2">Playground (browser, no setup)</h3>
                  <p className="text-sm text-dc1-text-secondary">Start immediately in your browser with no Docker or CLI required.</p>
                </Link>
                <Link
                  href="/docs/quickstart"
                  className={`rounded-xl p-5 border transition-all ${
                    selectedIntent === 'renter'
                      ? 'border-dc1-amber/60 bg-dc1-surface-l2 hover:border-dc1-amber'
                      : 'border-dc1-border bg-dc1-surface-l2 hover:border-dc1-border-light'
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.12em] text-dc1-amber font-semibold mb-2">Renter path</p>
                  <h3 className="text-lg font-semibold text-dc1-text-primary mb-2">Container Jobs (API + Docker image)</h3>
                  <p className="text-sm text-dc1-text-secondary">Bring your image and submit container workloads through the API.</p>
                </Link>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-5">
                <Link
                  href="/provider/register"
                  className={`btn btn-lg w-full sm:w-auto ${
                    selectedIntent === 'provider' ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {t('landing.cta_provider')}
                </Link>
                <Link href="/earn" className="btn btn-secondary btn-lg w-full sm:w-auto">
                  {t('landing.earn_calc')}
                </Link>
              </div>
            </div>
            <p className="text-xs text-dc1-text-muted mt-4">{t('landing.hero_helper')}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 text-sm font-medium text-dc1-amber hover:text-dc1-amber/80 transition-colors"
              >
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                {t('landing.browse_live')}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/earn"
                className="inline-flex items-center gap-2 text-sm font-medium text-dc1-text-secondary hover:text-dc1-amber transition-colors"
              >
                {t('landing.earn_calc')}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="mt-5 mx-auto max-w-3xl rounded-xl border border-dc1-border bg-dc1-surface-l2/80 px-4 py-3 text-left">
              <p className="text-[11px] uppercase tracking-[0.14em] text-dc1-amber font-semibold mb-2">
                {t('landing.reliability_strip_label')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-dc1-text-secondary">
                <p>
                  <span className="text-dc1-text-primary font-semibold">{liveGpuCount ?? '—'}</span> {t('landing.reliability_live_providers')}
                </p>
                <p>
                  <span className="text-dc1-text-primary font-semibold">{gpuFamilyCoverage ?? '—'}</span> {t('landing.reliability_gpu_families')}
                </p>
                <p>
                  <span className="text-dc1-text-primary font-semibold">{reliabilityUpdatedAt ? formatReliabilityTimestamp(reliabilityUpdatedAt) : t('landing.reliability_unavailable')}</span>
                </p>
              </div>
            </div>
            <p className="text-dc1-text-secondary text-sm mt-6">
              {t('landing.already_account')}{' '}
              <Link href="/login" className="text-dc1-amber hover:text-dc1-amber/80 font-semibold underline underline-offset-2">
                {t('landing.sign_in_here')}
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Strategic differentiators */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 sm:-mt-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1/90 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dc1-amber mb-2">
              {t('landing.diff_energy_title')}
            </p>
            <p className="text-sm text-dc1-text-secondary leading-relaxed">
              {t('landing.diff_energy_desc')}
            </p>
          </div>
          <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1/90 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dc1-amber mb-2">
              {t('landing.diff_models_title')}
            </p>
            <p className="text-sm text-dc1-text-secondary leading-relaxed">
              {t('landing.diff_models_desc')}
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-dc1-border bg-dc1-surface-l1/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-2xl sm:text-3xl font-bold text-dc1-amber">{stat.value}</p>
                  {stat.live && (
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" title="Live count" />
                  )}
                </div>
                <p className="text-sm text-dc1-text-secondary mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Billing transparency */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-xl border border-dc1-amber/25 bg-dc1-amber/5 p-6">
          <h2 className="text-xl font-semibold text-dc1-text-primary mb-3">How DCP Billing Works</h2>
          <ul className="space-y-2 text-sm text-dc1-text-secondary">
            <li>1. We place a prepay estimate hold in halala before your job starts.</li>
            <li>2. Final cost uses actual runtime settlement, not the initial estimate.</li>
            <li>3. Any unused hold is automatically refunded in halala after completion.</li>
          </ul>
          <p className="mt-3 text-xs text-dc1-text-muted">100 halala = 1 SAR.</p>
        </div>
      </section>

      {/* Differentiator strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: t('landing.diff_energy_title'), body: t('landing.diff_energy_desc') },
            { title: t('landing.diff_models_title'), body: t('landing.diff_models_desc') },
            { title: t('landing.diff_container_title'), body: t('landing.diff_container_desc') },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-dc1-border bg-dc1-surface-l2 p-5">
              <h3 className="text-base font-semibold text-dc1-text-primary mb-2">{item.title}</h3>
              <p className="text-sm text-dc1-text-secondary leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing section removed — rates not yet finalized */}

      {/* Usage Paths */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-4">
            Two Ways to Rent GPUs
          </h2>
          <p className="text-dc1-text-secondary max-w-2xl mx-auto">
            Start in the browser for fast tests, then move to container jobs when you need repeatable workflows.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Playground */}
          <div className="bg-dc1-surface-l2 border border-dc1-border rounded-lg p-8 transition-all duration-200 hover:border-dc1-border-light hover:shadow-md group">
            <div className="w-12 h-12 rounded-lg bg-dc1-amber/10 flex items-center justify-center text-dc1-amber mb-6 group-hover:bg-dc1-amber/20 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-dc1-text-primary mb-2">Playground</h3>
            <p className="text-sm text-dc1-text-secondary mb-6 leading-relaxed">
              Rent GPUs for LLM inference and image generation directly from your browser. Pick a model, submit a prompt, and review output before scaling.
            </p>
            <ul className="space-y-2 mb-8">
              {[
                'Browser-based — no install needed',
                'Results in seconds to minutes',
                'Prepay estimate before run',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-dc1-text-secondary">
                  <span className="w-1.5 h-1.5 bg-dc1-amber rounded-full flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/renter/register" className="btn btn-primary btn-sm">
              Start renting GPUs
            </Link>
          </div>

          {/* Custom Jobs */}
          <div className="bg-dc1-surface-l2 border border-dc1-border rounded-lg p-8 transition-all duration-200 hover:border-dc1-border-light hover:shadow-md group">
            <div className="w-12 h-12 rounded-lg bg-dc1-amber/10 flex items-center justify-center text-dc1-amber mb-6 group-hover:bg-dc1-amber/20 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-dc1-text-primary mb-2">Container Jobs</h3>
            <p className="text-sm text-dc1-text-secondary mb-6 leading-relaxed">
              Bring your own Docker image for training, fine-tuning, batch processing, or any GPU workload. Container jobs run with NVIDIA Container Toolkit support.
            </p>
            <ul className="space-y-2 mb-8">
              {[
                'Any Docker image with CUDA support',
                'Container-based execution path',
                'Submit via REST API',
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
                code: '# Linux / macOS\ncurl -sSL https://dcp.sa/install.sh | bash',
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
                    <pre className="bg-dc1-surface-l1 border border-dc1-border rounded-lg px-4 py-3 text-xs text-dc1-amber font-mono overflow-x-auto">
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
  -Uri "https://dcp.sa/install.ps1" \`
  -OutFile install.ps1
.\\install.ps1 \`
  --key YOUR_PROVIDER_KEY`}</pre>
            <div className="mt-4 pt-4 border-t border-dc1-border">
              <p className="text-xs text-dc1-text-muted mb-2">After install, your terminal shows:</p>
              <pre className="text-xs text-green-400 font-mono leading-relaxed">{`✓ GPU detected: RTX 4090 (24 GB)
✓ Daemon v3.3.0 running
✓ Connected to DCP — ready for jobs`}</pre>
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
                  <pre className="bg-dc1-surface-l2 rounded px-3 py-2 border border-dc1-border text-xs text-dc1-amber font-mono">pip install dcp-provider</pre>
                </div>
                <div>
                  <p className="text-xs text-dc1-text-muted font-mono mb-1"># Node.js — renter SDK</p>
                  <pre className="bg-dc1-surface-l2 rounded px-3 py-2 border border-dc1-border text-xs text-dc1-amber font-mono">npm install dcp-renter-sdk</pre>
                </div>
              </div>
              <div className="border-t border-dc1-border pt-4">
                <p className="text-xs text-dc1-text-muted font-mono mb-2">Quick start:</p>
                <pre className="text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap">{`from dcp_provider import DCPProvider

provider = DCPProvider(api_key="your-key")
provider.register_gpu()
provider.start()  # auto-detect, heartbeat, earn`}</pre>
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
  -d '{
    "renter_key": "dcp-renter-...",
    "provider_id": 26,
    "job_type": "llm_inference",
    "model": "ALLaM-7B-Instruct",
    "prompt": "Hello world"
  }'`}</pre>
            <div className="mt-4 pt-4 border-t border-dc1-border">
              <p className="text-xs text-dc1-text-muted mb-2">Response:</p>
              <pre className="text-xs text-green-400 font-mono leading-relaxed">{`{
  "jobId": "job_abc123",
  "status": "queued",
  "estimatedStart": "< 5s"
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
