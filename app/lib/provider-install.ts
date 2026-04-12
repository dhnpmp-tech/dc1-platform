const API_BASE = '/api/dcp'
const PUBLIC_API_FALLBACK = `https://api.dcp.sa/api`

export type InstallTarget = 'linux' | 'windows' | 'macos'
export type ProviderNextActionState = 'waiting' | 'heartbeat' | 'ready' | 'paused' | 'stale'

function normalizeApiBase(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

export function getProviderInstallApiBase(): string {
  const envBase = process.env.NEXT_PUBLIC_DC1_API
  if (envBase) {
    const normalized = normalizeApiBase(envBase)
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return normalized
    }
    if (typeof window !== 'undefined' && normalized.startsWith('/')) {
      return `${window.location.origin}${normalized}`
    }
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}${API_BASE}`
  }

  return PUBLIC_API_FALLBACK
}

export function buildProviderInstallCommand(target: InstallTarget, apiBase: string, key: string): string {
  const encodedKey = encodeURIComponent(key || 'YOUR_PROVIDER_KEY')

  if (target === 'windows') {
    return `irm \"${apiBase}/providers/download/setup?key=${encodedKey}&os=windows\" | iex`
  }

  const osParam = target === 'macos' ? 'macos' : 'linux'
  return `curl -fsSL \"${apiBase}/providers/download/setup?key=${encodedKey}&os=${osParam}\" | bash`
}

export function buildProviderDaemonDownloadUrl(apiBase: string, key: string): string {
  return `${apiBase}/providers/download/daemon?key=${encodeURIComponent(key || 'YOUR_PROVIDER_KEY')}`
}

export function buildProviderTroubleshootingHref(state: ProviderNextActionState): string {
  switch (state) {
    case 'waiting':
      return '/docs/provider-guide#status-waiting-install-daemon'
    case 'heartbeat':
      return '/docs/provider-guide#status-heartbeat-verify-telemetry'
    case 'ready':
      return '/docs/provider-guide#status-ready-monitor-jobs'
    case 'paused':
      return '/docs/provider-guide#status-paused-resume-provider'
    case 'stale':
    default:
      return '/docs/provider-guide#status-stale-restart-daemon'
  }
}

export function getProviderOnboardingStep(state: ProviderNextActionState): string {
  switch (state) {
    case 'waiting':
      return 'install_daemon'
    case 'heartbeat':
      return 'verify_heartbeat'
    case 'ready':
      return 'accept_jobs'
    case 'paused':
      return 'resume_provider'
    case 'stale':
    default:
      return 'restart_daemon'
  }
}
