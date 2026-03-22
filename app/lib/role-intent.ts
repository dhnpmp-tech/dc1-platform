export type RoleIntent = 'renter' | 'provider' | 'enterprise'

const ROLE_INTENT_STORAGE_KEY = 'dc1_role_intent'

function dispatchRoleIntentEvent(event: string, payload: Record<string, unknown>) {
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

export function readRoleIntent(): RoleIntent | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(ROLE_INTENT_STORAGE_KEY)
  if (value === 'renter' || value === 'provider' || value === 'enterprise') {
    return value
  }
  return null
}

export function persistRoleIntent(
  intent: RoleIntent,
  {
    source,
    previousIntent,
    reason = 'persisted',
  }: {
    source: string
    previousIntent?: RoleIntent | null
    reason?: 'persisted' | 'overridden'
  }
) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROLE_INTENT_STORAGE_KEY, intent)

  dispatchRoleIntentEvent(reason === 'overridden' ? 'role_intent_overridden' : 'role_intent_persisted', {
    source,
    intent,
    previous_intent: previousIntent ?? 'none',
  })
}

export function trackRoleIntentApplied(
  intent: RoleIntent,
  {
    source,
    destination,
  }: {
    source: string
    destination: string
  }
) {
  dispatchRoleIntentEvent('role_intent_applied', {
    source,
    intent,
    destination,
  })
}

export function intentSupportCategory(intent: RoleIntent): 'renter' | 'provider' | 'enterprise' {
  if (intent === 'provider') return 'provider'
  if (intent === 'enterprise') return 'enterprise'
  return 'renter'
}
