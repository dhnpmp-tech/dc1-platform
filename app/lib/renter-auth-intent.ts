'use client'

export type RenterJobType = 'llm_inference' | 'image_generation' | 'vllm_serve'

export interface RenterAuthIntent {
  providerId?: number
  model?: string
  mode?: RenterJobType
  template?: string
  jobType?: RenterJobType
  source?: string
  restoredAt?: string
}

export const PENDING_AUTH_INTENT_KEY = 'dc1_pending_auth_intent'
export const RESTORED_AUTH_INTENT_KEY = 'dc1_restored_auth_intent'

function normalizeIntent(intent: RenterAuthIntent): RenterAuthIntent {
  const next: RenterAuthIntent = {
    providerId: intent.providerId != null && Number.isFinite(intent.providerId) ? intent.providerId : undefined,
    model: intent.model?.trim() || undefined,
    mode: intent.mode,
    template: intent.template?.trim() || undefined,
    jobType: intent.jobType,
    source: intent.source?.trim() || undefined,
    restoredAt: intent.restoredAt,
  }
  return next
}

function appendIntentParams(params: URLSearchParams, intent: RenterAuthIntent) {
  if (intent.providerId != null && Number.isFinite(intent.providerId)) params.set('provider', String(intent.providerId))
  if (intent.model) params.set('model', intent.model)
  if (intent.mode) params.set('mode', intent.mode)
  if (intent.template) params.set('template', intent.template)
  if (intent.jobType) params.set('job_type', intent.jobType)
  if (intent.source) params.set('source', intent.source)
}

export function setPendingRenterAuthIntent(intent: RenterAuthIntent): void {
  if (typeof window === 'undefined') return
  const normalized = normalizeIntent(intent)
  sessionStorage.setItem(PENDING_AUTH_INTENT_KEY, JSON.stringify(normalized))
}

export function getPendingRenterAuthIntent(): RenterAuthIntent | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(PENDING_AUTH_INTENT_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as RenterAuthIntent
    return normalizeIntent(parsed)
  } catch {
    sessionStorage.removeItem(PENDING_AUTH_INTENT_KEY)
    return null
  }
}

export function consumePendingRenterAuthIntent(): RenterAuthIntent | null {
  const intent = getPendingRenterAuthIntent()
  if (typeof window !== 'undefined') sessionStorage.removeItem(PENDING_AUTH_INTENT_KEY)
  return intent
}

export function consumeRestoredRenterAuthIntent(): RenterAuthIntent | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(RESTORED_AUTH_INTENT_KEY)
  if (!raw) return null
  try {
    return normalizeIntent(JSON.parse(raw) as RenterAuthIntent)
  } catch {
    return null
  } finally {
    sessionStorage.removeItem(RESTORED_AUTH_INTENT_KEY)
  }
}

export function setRestoredRenterAuthIntent(intent: RenterAuthIntent): void {
  if (typeof window === 'undefined') return
  const normalized = normalizeIntent(intent)
  sessionStorage.setItem(RESTORED_AUTH_INTENT_KEY, JSON.stringify({ ...normalized, restoredAt: new Date().toISOString() }))
}

export function withRenterIntentInPath(path: string, intent: RenterAuthIntent): string {
  const normalized = normalizeIntent(intent)
  if (!path) return '/renter/playground'
  const [base, query = ''] = path.split('?', 2)
  const params = new URLSearchParams(query)
  appendIntentParams(params, normalized)
  const nextQuery = params.toString()
  return nextQuery ? `${base}?${nextQuery}` : base
}

export function buildRenterPlaygroundPath(intent: RenterAuthIntent): string {
  return withRenterIntentInPath('/renter/playground', intent)
}

export function buildRenterLoginRedirect(redirectPath: string, source?: string): string {
  const params = new URLSearchParams({
    role: 'renter',
    method: 'email',
    redirect: redirectPath,
  })
  if (source) params.set('source', source)
  return `/login?${params.toString()}`
}
