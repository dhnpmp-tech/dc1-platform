'use client'

export interface ProviderInstallTelemetryPayload {
  source_page: string
  surface: string
  destination: string
  locale?: string
  cta_tier?: 'primary' | 'secondary'
  next_action_state?: string
  os_target?: string
  has_provider_key?: boolean
  step?: string
  error_state?: string
  [key: string]: unknown
}

export function trackProviderInstallEvent(
  event: string,
  payload: ProviderInstallTelemetryPayload
) {
  if (typeof window === 'undefined') return

  const detail = { event, ...payload }
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
