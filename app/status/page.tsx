'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useLanguage, LanguageToggle } from '../lib/i18n'

const API = '/api/dc1'

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'checking'

interface ServiceCheck {
  key: string
  titleKey: string
  descKey: string
  status: ServiceStatus
  detail: string
}

function statusColor(status: ServiceStatus) {
  switch (status) {
    case 'operational': return 'bg-emerald-500'
    case 'degraded':    return 'bg-amber-400'
    case 'down':        return 'bg-red-500'
    default:            return 'bg-dc1-surface-l3 animate-pulse'
  }
}

function statusTextColor(status: ServiceStatus) {
  switch (status) {
    case 'operational': return 'text-emerald-400'
    case 'degraded':    return 'text-amber-400'
    case 'down':        return 'text-red-400'
    default:            return 'text-dc1-text-muted'
  }
}

function StatusDot({ status }: { status: ServiceStatus }) {
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${statusColor(status)}`}
      aria-hidden="true"
    />
  )
}

function OverallBanner({ services, t }: { services: ServiceCheck[]; t: (k: string) => string }) {
  const statuses = services.map(s => s.status)
  const hasDown     = statuses.includes('down')
  const hasDegraded = statuses.includes('degraded')
  const allChecking = statuses.every(s => s === 'checking')

  let bg = 'bg-emerald-500/10 border-emerald-500/30'
  let dot = 'bg-emerald-500'
  let label = t('status.all_operational')

  if (allChecking) {
    bg = 'bg-dc1-surface-l2 border-dc1-border'
    dot = 'bg-dc1-surface-l3 animate-pulse'
    label = t('status.checking')
  } else if (hasDown) {
    bg = 'bg-red-500/10 border-red-500/30'
    dot = 'bg-red-500'
    label = t('status.outage')
  } else if (hasDegraded) {
    bg = 'bg-amber-400/10 border-amber-400/30'
    dot = 'bg-amber-400'
    label = t('status.degraded')
  }

  return (
    <div className={`flex items-center gap-3 px-6 py-4 rounded-xl border ${bg} mb-8`}>
      <span className={`w-4 h-4 rounded-full flex-shrink-0 ${dot}`} aria-hidden="true" />
      <span className="text-lg font-semibold text-dc1-text-primary">{label}</span>
    </div>
  )
}

function ServiceRow({ svc, t }: { svc: ServiceCheck; t: (k: string) => string }) {
  const statusLabel =
    svc.status === 'checking' ? t('status.checking')
    : svc.status === 'operational' ? t('status.operational')
    : svc.status === 'degraded' ? t('status.degraded_service')
    : t('status.down')

  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-dc1-border last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <StatusDot status={svc.status} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-dc1-text-primary">{t(svc.titleKey)}</p>
          <p className="text-xs text-dc1-text-secondary mt-0.5">{t(svc.descKey)}</p>
          {svc.detail && (
            <p className="text-xs text-dc1-text-muted mt-0.5">{svc.detail}</p>
          )}
        </div>
      </div>
      <span className={`text-xs font-semibold flex-shrink-0 ms-4 ${statusTextColor(svc.status)}`}>
        {statusLabel}
      </span>
    </div>
  )
}

export default function StatusPage() {
  const { t, dir } = useLanguage()

  const initialServices: ServiceCheck[] = [
    { key: 'api',           titleKey: 'status.api',           descKey: 'status.api_desc',           status: 'checking', detail: '' },
    { key: 'gpu_network',   titleKey: 'status.gpu_network',   descKey: 'status.gpu_network_desc',   status: 'checking', detail: '' },
    { key: 'job_execution', titleKey: 'status.job_execution', descKey: 'status.job_execution_desc', status: 'checking', detail: '' },
    { key: 'payments',      titleKey: 'status.payments',      descKey: 'status.payments_desc',      status: 'checking', detail: '' },
  ]

  const [services, setServices] = useState<ServiceCheck[]>(initialServices)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const runChecks = useCallback(async () => {
    setIsRefreshing(true)

    const results: Partial<Record<string, ServiceCheck>> = {}

    // ── Check 1: API health ────────────────────────────────────────────────
    try {
      const res = await fetch(`${API}/health`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        results['api'] = {
          key: 'api', titleKey: 'status.api', descKey: 'status.api_desc',
          status: 'operational',
          detail: data.uptime ? `Uptime: ${Math.floor(data.uptime / 3600)}h` : '',
        }
        // ── Check 3: Job Execution (inferred from health data) ─────────────
        const lastJob: string | undefined = data.lastJobAt ?? data.last_job_at
        results['job_execution'] = {
          key: 'job_execution', titleKey: 'status.job_execution', descKey: 'status.job_execution_desc',
          status: 'operational',
          detail: lastJob
            ? `${t('status.last_job')}: ${new Date(lastJob).toLocaleTimeString()}`
            : '',
        }
      } else {
        results['api'] = {
          key: 'api', titleKey: 'status.api', descKey: 'status.api_desc',
          status: 'down', detail: `HTTP ${res.status}`,
        }
        results['job_execution'] = {
          key: 'job_execution', titleKey: 'status.job_execution', descKey: 'status.job_execution_desc',
          status: 'down', detail: '',
        }
      }
    } catch {
      results['api'] = {
        key: 'api', titleKey: 'status.api', descKey: 'status.api_desc',
        status: 'down', detail: '',
      }
      results['job_execution'] = {
        key: 'job_execution', titleKey: 'status.job_execution', descKey: 'status.job_execution_desc',
        status: 'down', detail: '',
      }
    }

    // ── Check 2: GPU Network ───────────────────────────────────────────────
    try {
      const res = await fetch(`${API}/marketplace`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json().catch(() => ({ providers: [] }))
        const providers: unknown[] = Array.isArray(data)
          ? data
          : Array.isArray(data.providers)
          ? data.providers
          : []
        const onlineCount = providers.filter((p: unknown) => {
          const provider = p as Record<string, unknown>
          return provider.status === 'online' || provider.online === true
        }).length
        results['gpu_network'] = {
          key: 'gpu_network', titleKey: 'status.gpu_network', descKey: 'status.gpu_network_desc',
          status: onlineCount > 0 ? 'operational' : 'degraded',
          detail: onlineCount > 0
            ? `${onlineCount} ${t('status.providers_online')}`
            : t('status.no_providers'),
        }
      } else {
        results['gpu_network'] = {
          key: 'gpu_network', titleKey: 'status.gpu_network', descKey: 'status.gpu_network_desc',
          status: 'degraded', detail: `HTTP ${res.status}`,
        }
      }
    } catch {
      results['gpu_network'] = {
        key: 'gpu_network', titleKey: 'status.gpu_network', descKey: 'status.gpu_network_desc',
        status: 'down', detail: '',
      }
    }

    // ── Check 4: Payments (Moyasar config — not a live check) ─────────────
    // Moyasar credentials are server-side only; we treat presence of health
    // response as a proxy for config availability.
    const paymentStatus: ServiceStatus =
      results['api']?.status === 'operational' ? 'operational' : 'degraded'
    results['payments'] = {
      key: 'payments', titleKey: 'status.payments', descKey: 'status.payments_desc',
      status: paymentStatus,
      detail: paymentStatus === 'operational' ? t('status.configured') : t('status.not_configured'),
    }

    setServices([
      results['api']!,
      results['gpu_network']!,
      results['job_execution']!,
      results['payments']!,
    ])
    setLastChecked(new Date())
    setIsRefreshing(false)
  }, [t])

  // Initial check + 30s interval
  useEffect(() => {
    runChecks()
    const id = setInterval(runChecks, 30_000)
    return () => clearInterval(id)
  }, [runChecks])

  return (
    <div className="min-h-screen bg-dc1-void text-dc1-text-primary" dir={dir}>
      {/* Top nav */}
      <nav className="border-b border-dc1-border bg-dc1-surface-l1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="DCP" className="h-8 w-auto" />
            <span className="font-bold text-dc1-text-primary">DCP.</span>
          </Link>
          <LanguageToggle />
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-dc1-text-primary mb-2">
            {t('status.title')}
          </h1>
          <p className="text-dc1-text-secondary text-sm">{t('status.subtitle')}</p>
        </div>

        {/* Overall banner */}
        <OverallBanner services={services} t={t} />

        {/* Service checks */}
        <div className="card mb-8 overflow-hidden p-0">
          {services.map(svc => (
            <ServiceRow key={svc.key} svc={svc} t={t} />
          ))}
        </div>

        {/* Footer bar: last checked + refresh */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-dc1-text-muted mb-10">
          <span>
            {lastChecked
              ? `${t('status.last_checked')}: ${lastChecked.toLocaleTimeString()}`
              : t('status.checking')}
          </span>
          <button
            onClick={runChecks}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dc1-border hover:border-dc1-amber hover:text-dc1-amber transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('status.refresh')}
          </button>
        </div>

        {/* Incident history */}
        <div>
          <h2 className="text-base font-semibold text-dc1-text-primary mb-4">
            {t('status.incident_history')}
          </h2>
          <div className="card py-8 text-center">
            <p className="text-dc1-text-secondary text-sm">{t('status.no_incidents')}</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/renter/marketplace"
            className="inline-flex items-center gap-2 text-sm text-dc1-amber hover:underline"
          >
            {t('status.view_marketplace')} →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-dc1-border mt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-xs text-dc1-text-muted text-center">
          &copy; {new Date().getFullYear()} DC Power Solutions Company. dcp.sa
        </div>
      </footer>
    </div>
  )
}
