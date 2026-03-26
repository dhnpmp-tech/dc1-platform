'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import { useLanguage } from '../../lib/i18n'
import {
  buildProviderTroubleshootingHref,
  buildProviderDaemonDownloadUrl,
  buildProviderInstallCommand,
  getProviderOnboardingStep,
  getProviderInstallApiBase,
  ProviderNextActionState,
} from '../../lib/provider-install'

const API_BASE = '/api/dc1'

interface RegistrationFormData {
  fullName: string
  email: string
  gpuModel: string
  vram: string
  locationCity: string
  locationCountry: string
  operatingSystem: string
  phone: string
  pdplConsent: boolean
}

const GPU_MODEL_VRAM: Record<string, string> = {
  'RTX 4090': '24',
  'RTX 4080': '16',
  'RTX 3090': '24',
  'H100': '80',
  'H200': '141',
  'Other': '',
}

interface StatusStep {
  step: number
  label: string
  status: 'pending' | 'in-progress' | 'completed'
}

type SupportCategory = 'provider' | 'bug'

export default function ProviderRegisterPage() {
  const { t, isRTL } = useLanguage()
  const searchParams = useSearchParams()

  // ── Referral code state ──────────────────────────────────────────────────
  const [referralCode, setReferralCode] = useState('')
  const [referralStatus, setReferralStatus] = useState<'idle' | 'applied' | 'error'>('idle')
  const [referralMessage, setReferralMessage] = useState('')

  // Pre-fill referral code from URL ?ref=CODE
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref && !referralCode) {
      setReferralCode(ref)
    }
  }, [searchParams, referralCode])

  const [formData, setFormData] = useState<RegistrationFormData>({
    fullName: '',
    email: '',
    gpuModel: '',
    vram: '',
    locationCity: '',
    locationCountry: '',
    operatingSystem: '',
    phone: '',
    pdplConsent: false,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [providerId, setProviderId] = useState('')
  const [statusSteps, setStatusSteps] = useState<StatusStep[]>([
    { step: 1, label: 'register.provider.step_registered', status: 'pending' },
    { step: 2, label: 'register.provider.step_daemon', status: 'pending' },
    { step: 3, label: 'register.provider.step_connected', status: 'pending' },
    { step: 4, label: 'register.provider.step_ready', status: 'pending' },
  ])
  const [showSuccess, setShowSuccess] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [nextActionState, setNextActionState] = useState<ProviderNextActionState>('waiting')
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingKeyRef = useRef<string | null>(null)
  const lastTrackedStateRef = useRef<ProviderNextActionState | null>(null)
  const pathChooserLanes = [
    {
      key: 'self_serve_renter',
      label: t('path_chooser.self_serve.label'),
      description: t('path_chooser.self_serve.desc'),
      href: '/renter/register?source=provider_register_path_chooser&lane=self_serve_renter',
    },
    {
      key: 'provider_onboarding',
      label: t('path_chooser.provider.label'),
      description: t('path_chooser.provider.desc'),
      href: '/provider/register?source=provider_register_path_chooser&lane=provider_onboarding',
    },
    {
      key: 'enterprise_intake',
      label: t('path_chooser.enterprise.label'),
      description: t('path_chooser.enterprise.desc'),
      href: '/support?category=enterprise&source=provider_register_path_chooser&lane=enterprise_intake#contact-form',
    },
    {
      key: 'arabic_model_docs',
      label: t('path_chooser.arabic.label'),
      description: t('path_chooser.arabic.desc'),
      href: '/docs?source=provider_register_path_chooser&lane=arabic_model_docs',
    },
  ]

  const trackProviderRegisterEvent = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') return
    const detail = {
      event,
      source_page: 'provider_register',
      role_intent: 'provider',
      surface: 'registration',
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
  }, [])

  const stopStatusPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    pollingKeyRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      stopStatusPolling()
    }
  }, [stopStatusPolling])

  // Validate form
  const validateForm = () => {
    if (!formData.fullName.trim()) {
      setError(t('register.provider.validation.full_name'))
      return false
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError(t('register.provider.validation.email'))
      return false
    }
    if (!formData.gpuModel) {
      setError(t('register.provider.validation.gpu'))
      return false
    }
    if (!formData.operatingSystem) {
      setError(t('register.provider.validation.os'))
      return false
    }
    if (!formData.pdplConsent) {
      setError(t('register.provider.validation.pdpl'))
      return false
    }
    return true
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE}/providers/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.fullName,
          email: formData.email,
          gpu_model: formData.gpuModel,
          vram_gb: formData.vram ? parseFloat(formData.vram) : undefined,
          location_city: formData.locationCity || undefined,
          location_country: formData.locationCountry || undefined,
          os: formData.operatingSystem,
          phone: formData.phone || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Registration failed')
      }

      const data = await response.json()
      setApiKey(data.api_key)
      setProviderId(String(data.provider_id))

      // Store provider key for dashboard access
      localStorage.setItem('dc1_provider_key', data.api_key)

      // Apply referral code if provided
      if (referralCode.trim()) {
        try {
          const refRes = await fetch(`${API_BASE}/providers/apply-referral`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referral_code: referralCode.trim(),
              new_provider_id: data.provider_id,
            }),
          })
          if (refRes.ok) {
            const refData = await refRes.json()
            setReferralStatus('applied')
            setReferralMessage(`Referred by ${refData.referrer_name} — ${refData.bonus_pct}% bonus for ${refData.duration_days} days!`)
          } else {
            const refErr = await refRes.json().catch(() => ({}))
            setReferralStatus('error')
            setReferralMessage((refErr as { error?: string }).error || 'Could not apply referral code')
          }
        } catch {
          setReferralStatus('error')
          setReferralMessage('Could not apply referral code')
        }
      }

      // Mark first step as completed
      setStatusSteps((prev) =>
        prev.map((s) => (s.step === 1 ? { ...s, status: 'completed' } : s))
      )
      setNextActionState('waiting')
      lastTrackedStateRef.current = null

      setShowSuccess(true)
      trackProviderRegisterEvent('provider_register_success', {
        surface: 'registration_form',
        destination: '/api/dc1/providers/register',
        step: 'submit_success',
        provider_id: data.provider_id,
        gpu_model: formData.gpuModel,
        os: formData.operatingSystem,
      })
      startStatusPolling(data.api_key)
    } catch (err) {
      trackProviderRegisterEvent('provider_register_failed', {
        surface: 'registration_form',
        destination: '/api/dc1/providers/register',
        step: 'submit_failure',
        error: err instanceof Error ? err.message : 'unknown_error',
      })
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Poll provider status via heartbeat
  const startStatusPolling = (key: string) => {
    if (pollingKeyRef.current === key && pollingIntervalRef.current) {
      return
    }

    stopStatusPolling()
    pollingKeyRef.current = key

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/providers/me?key=${encodeURIComponent(key)}`)
        if (!response.ok) return

        const data = await response.json()
        const provider = data.provider || {}

        // Determine current step based on provider status
        let currentStep = 1 // registered
        let nextAction: ProviderNextActionState = 'waiting'
        if (provider.status === 'online' || provider.status === 'idle') {
          currentStep = 4 // fully connected and ready
          nextAction = 'ready'
        } else if (provider.status === 'paused') {
          currentStep = 3
          nextAction = 'paused'
        } else if (provider.status === 'offline' || provider.status === 'disconnected') {
          currentStep = 2
          nextAction = 'stale'
        } else if (provider.last_heartbeat) {
          currentStep = 3 // connected (sent heartbeat)
          nextAction = 'heartbeat'
        } else if (provider.status === 'registered') {
          currentStep = 1 // just registered, waiting for daemon
          nextAction = 'waiting'
        }
        setNextActionState(nextAction)
        if (lastTrackedStateRef.current !== nextAction) {
          lastTrackedStateRef.current = nextAction
          trackProviderRegisterEvent('provider_onboarding_state_seen', {
            state: nextAction,
            surface: 'onboarding_status',
            destination: provider.status === 'online' || provider.status === 'idle' || provider.status === 'paused' ? '/provider/dashboard' : '/docs/provider-guide',
            step: getProviderOnboardingStep(nextAction),
            provider_status: provider.status || 'unknown',
            has_heartbeat: Boolean(provider.last_heartbeat),
          })
        }

        setStatusSteps((prev) =>
          prev.map((s) => {
            if (s.step < currentStep) return { ...s, status: 'completed' }
            if (s.step === currentStep) return { ...s, status: 'in-progress' }
            return s
          })
        )

        // Stop polling if all steps are completed
        if (currentStep >= 4) {
          setStatusSteps((prev) =>
            prev.map((s) => ({ ...s, status: 'completed' }))
          )
          stopStatusPolling()
        }
      } catch (err) {
        console.error('Failed to fetch status:', err)
      }
    }, 5000)
  }

  // Copy to clipboard
  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    trackProviderRegisterEvent('provider_register_copy_clicked', {
      surface: 'success_commands',
      destination: 'clipboard',
      step: 'copy_command',
      copy_target:
        index === 0
          ? 'api_key'
          : index === 1
            ? 'install_linux'
            : index === 2
              ? 'install_windows'
              : 'other',
    })
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'gpuModel' && value in GPU_MODEL_VRAM) {
        next.vram = GPU_MODEL_VRAM[value]
      }
      return next
    })
  }

  if (showSuccess && apiKey) {
    const installApiBase = getProviderInstallApiBase()
    const linuxInstallCommand = buildProviderInstallCommand('linux', installApiBase, apiKey)
    const windowsInstallCommand = buildProviderInstallCommand('windows', installApiBase, apiKey)
    const reachabilityCheckCommand = `curl -I ${buildProviderDaemonDownloadUrl(installApiBase, apiKey)}`
    const keyValidationCommand = `curl ${installApiBase}/providers/me?key=${encodeURIComponent(apiKey)}`
    const nextActionMap: Record<
      ProviderNextActionState,
      {
        label: string
        desc: string
        expectation: string
        nextSuccess: string
        cta: string
        href: string
      }
    > = {
      waiting: {
        label: t('register.provider.state.waiting.label'),
        desc: t('register.provider.state.waiting.desc'),
        expectation: t('register.provider.state.waiting.expectation'),
        nextSuccess: t('register.provider.state.waiting.next_success'),
        cta: t('register.provider.state.waiting.cta'),
        href: '/docs/provider-guide',
      },
      heartbeat: {
        label: t('register.provider.state.heartbeat.label'),
        desc: t('register.provider.state.heartbeat.desc'),
        expectation: t('register.provider.state.heartbeat.expectation'),
        nextSuccess: t('register.provider.state.heartbeat.next_success'),
        cta: t('register.provider.state.heartbeat.cta'),
        href: '/provider/dashboard',
      },
      ready: {
        label: t('register.provider.state.ready.label'),
        desc: t('register.provider.state.ready.desc'),
        expectation: t('register.provider.state.ready.expectation'),
        nextSuccess: t('register.provider.state.ready.next_success'),
        cta: t('register.provider.state.ready.cta'),
        href: '/provider/dashboard',
      },
      paused: {
        label: t('register.provider.state.paused.label'),
        desc: t('register.provider.state.paused.desc'),
        expectation: t('register.provider.state.paused.expectation'),
        nextSuccess: t('register.provider.state.paused.next_success'),
        cta: t('register.provider.state.paused.cta'),
        href: '/provider/dashboard',
      },
      stale: {
        label: t('register.provider.state.stale.label'),
        desc: t('register.provider.state.stale.desc'),
        expectation: t('register.provider.state.stale.expectation'),
        nextSuccess: t('register.provider.state.stale.next_success'),
        cta: t('register.provider.state.stale.cta'),
        href: '/docs/provider-guide',
      },
    }
    const nextAction = nextActionMap[nextActionState]
    const supportCategoryMap: Record<ProviderNextActionState, SupportCategory> = {
      waiting: 'provider',
      heartbeat: 'provider',
      ready: 'provider',
      paused: 'provider',
      stale: 'bug',
    }
    const buildSupportPrefillHref = (state: ProviderNextActionState): string =>
      `/support?category=${supportCategoryMap[state]}&source=provider_register&flow=onboarding&provider_state=${encodeURIComponent(
        state
      )}&provider_id=${encodeURIComponent(providerId)}#contact-form`
    const statusActionMatrix: Array<{
      state: ProviderNextActionState
      action: string
      href: string
      supportHref: string
    }> = [
      {
        state: 'waiting',
        action: t('register.provider.status_matrix.waiting.action'),
        href: buildProviderTroubleshootingHref('waiting'),
        supportHref: buildSupportPrefillHref('waiting'),
      },
      {
        state: 'heartbeat',
        action: t('register.provider.status_matrix.heartbeat.action'),
        href: buildProviderTroubleshootingHref('heartbeat'),
        supportHref: buildSupportPrefillHref('heartbeat'),
      },
      {
        state: 'stale',
        action: t('register.provider.status_matrix.stale.action'),
        href: buildProviderTroubleshootingHref('stale'),
        supportHref: buildSupportPrefillHref('stale'),
      },
      {
        state: 'paused',
        action: t('register.provider.status_matrix.paused.action'),
        href: buildProviderTroubleshootingHref('paused'),
        supportHref: buildSupportPrefillHref('paused'),
      },
      {
        state: 'ready',
        action: t('register.provider.status_matrix.ready.action'),
        href: buildProviderTroubleshootingHref('ready'),
        supportHref: buildSupportPrefillHref('ready'),
      },
    ]
    const supportPrefillHref = buildSupportPrefillHref(nextActionState)
    const troubleshootingGuideHref = buildProviderTroubleshootingHref(nextActionState)
    const showContextualSupport = nextActionState === 'stale' || nextActionState === 'paused'

    return (
      <>
        <Header />
        <main className="min-h-screen bg-dc1-void">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            {/* Success Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-success/10 mb-6">
                <svg
                  className="w-8 h-8 text-status-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-dc1-text-primary mb-4">
                {t('register.provider.success_title')}
              </h1>
              <p className="text-dc1-text-secondary text-lg">
                {t('register.provider.success_desc')}
              </p>
            </div>

            <div className="space-y-8">
              {/* API Key Card */}
              <div className="card">
                <h2 className="text-xl font-semibold text-dc1-text-primary mb-4 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-dc1-amber/20 text-dc1-amber font-bold text-sm">
                    1
                  </span>
                  {t('register.provider.api_key_title')}
                </h2>
                <p className="text-dc1-text-secondary mb-4">
                  {t('register.provider.api_key_desc')}
                </p>
                <div className="relative bg-dc1-surface-l3 rounded-md border border-dc1-border p-4 font-mono text-sm">
                  <code className="text-dc1-amber break-all">{apiKey}</code>
                  <button
                    onClick={() => copyToClipboard(apiKey, 0)}
                    className="absolute top-3 right-3 p-2 rounded-md hover:bg-dc1-surface-l2 transition-colors"
                    title="Copy API key"
                  >
                    {copiedIndex === 0 ? (
                      <svg
                        className="w-5 h-5 text-status-success"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-dc1-text-secondary hover:text-dc1-text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Installation Instructions */}
              <div className="card">
                <h2 className="text-xl font-semibold text-dc1-text-primary mb-4 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-dc1-amber/20 text-dc1-amber font-bold text-sm">
                    2
                  </span>
                  {t('register.provider.install_title')}
                </h2>
                <p className="text-dc1-text-secondary mb-6">
                  {t('register.provider.install_desc')}
                </p>

                <div className="space-y-4">
                  {/* Linux Instructions */}
                  <div>
                    <h3 className="text-sm font-semibold text-dc1-text-primary mb-2">
                      Linux (Ubuntu/Debian)
                    </h3>
                    <div className="relative bg-dc1-surface-l3 rounded-md border border-dc1-border p-4 font-mono text-xs overflow-x-auto">
                      <code className="text-dc1-amber">{linuxInstallCommand}</code>
                      <button
                        onClick={() => copyToClipboard(linuxInstallCommand, 1)}
                        className="absolute top-3 right-3 p-2 rounded-md hover:bg-dc1-surface-l2 transition-colors"
                        title="Copy installation command"
                      >
                        {copiedIndex === 1 ? (
                          <svg
                            className="w-5 h-5 text-status-success"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 text-dc1-text-secondary hover:text-dc1-text-primary"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Windows Instructions */}
                  <div>
                    <h3 className="text-sm font-semibold text-dc1-text-primary mb-2">
                      Windows PowerShell
                    </h3>
                    <div className="relative bg-dc1-surface-l3 rounded-md border border-dc1-border p-4 font-mono text-xs overflow-x-auto">
                      <code className="text-dc1-amber">{windowsInstallCommand}</code>
                      <button
                        onClick={() => copyToClipboard(windowsInstallCommand, 2)}
                        className="absolute top-3 right-3 p-2 rounded-md hover:bg-dc1-surface-l2 transition-colors"
                        title="Copy installation command"
                      >
                        {copiedIndex === 2 ? (
                          <svg
                            className="w-5 h-5 text-status-success"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 text-dc1-text-secondary hover:text-dc1-text-primary"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Status Tracker */}
              <div className="card border-dc1-amber/20">
                <h2 className="text-xl font-semibold text-dc1-text-primary mb-4">{t('provider.trust.title')}</h2>
                <p className="text-dc1-text-secondary text-sm mb-4">
                  {t('provider.trust.description')}
                </p>
                <ul className="space-y-2 text-sm text-dc1-text-secondary">
                  <li className="flex items-start gap-2">
                    <span className="text-dc1-amber">•</span>
                    <span>{t('provider.trust.heartbeat')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-dc1-amber">•</span>
                    <span>{t('provider.trust.polling')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-dc1-amber">•</span>
                    <span>{t('provider.trust.pause_resume')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-dc1-amber">•</span>
                    <span>{t('provider.trust.runtime')}</span>
                  </li>
                </ul>
                <p className="mt-4 text-xs text-dc1-text-muted">
                  {t('provider.trust.earnings_estimate')}
                </p>
              </div>

              {/* Status Tracker */}
              <div className="card">
                <h2 className="text-xl font-semibold text-dc1-text-primary mb-6 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-dc1-amber/20 text-dc1-amber font-bold text-sm">
                    3
                  </span>
                  {t('register.provider.progress_title')}
                </h2>
                <div className="space-y-4">
                  {statusSteps.map((step, idx) => (
                    <div key={step.step} className="flex items-center gap-4">
                      <div className="relative flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                            step.status === 'completed'
                              ? 'bg-status-success text-white'
                              : step.status === 'in-progress'
                                ? 'bg-dc1-amber text-white animate-pulse'
                                : 'bg-dc1-surface-l2 text-dc1-text-secondary'
                          }`}
                        >
                          {step.status === 'completed' ? (
                            <svg
                              className="w-6 h-6"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            step.step
                          )}
                        </div>
                        {idx < statusSteps.length - 1 && (
                          <div
                            className={`w-1 h-8 mt-1 transition-all duration-300 ${
                              step.status === 'completed'
                                ? 'bg-status-success'
                                : 'bg-dc1-border'
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-dc1-text-primary">
                          {t(step.label)}
                        </h3>
                        <p className="text-sm text-dc1-text-secondary">
                          {step.status === 'completed'
                            ? t('register.provider.status_complete')
                            : step.status === 'in-progress'
                              ? t('register.provider.status_in_progress')
                              : t('register.provider.status_pending')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 rounded-md bg-status-info/5 border border-status-info/20">
                  <p className="text-sm text-status-info">
                    {t('register.provider.status_auto_update')}
                  </p>
                </div>
              </div>

              <div className="card border-dc1-amber/20">
                <h2 className="text-xl font-semibold text-dc1-text-primary mb-3">
                  {t('register.provider.next_action_title')}
                </h2>
                <div className="rounded-lg border border-dc1-amber/25 bg-dc1-amber/5 p-4">
                  <p className="text-xs text-dc1-text-muted mb-2">
                    Step: {getProviderOnboardingStep(nextActionState)}
                  </p>
                  <p className="text-xs uppercase tracking-[0.12em] text-dc1-amber font-semibold mb-2">
                    {t('register.provider.next_action_now')}
                  </p>
                  <p className="text-base font-semibold text-dc1-text-primary">{nextAction.label}</p>
                  <p className="text-sm text-dc1-text-secondary mt-1">{nextAction.desc}</p>
                  <div className="mt-3 space-y-2 text-xs text-dc1-text-secondary">
                    <p>
                      <span className="font-semibold text-dc1-text-primary">
                        {t('register.provider.state.expectation_label')}:
                      </span>{' '}
                      {nextAction.expectation}
                    </p>
                    <p>
                      <span className="font-semibold text-dc1-text-primary">
                        {t('register.provider.state.next_success_label')}:
                      </span>{' '}
                      {nextAction.nextSuccess}
                    </p>
                  </div>
                  <a
                    href={nextAction.href}
                    className="btn btn-primary mt-4 w-full sm:w-auto"
                    onClick={() =>
                      trackProviderRegisterEvent('provider_onboarding_next_action_clicked', {
                        state: nextActionState,
                        surface: 'next_action',
                        destination: nextAction.href,
                        step: getProviderOnboardingStep(nextActionState),
                        cta_type: 'primary',
                      })
                    }
                  >
                    {nextAction.cta}
                  </a>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-dc1-text-muted hover:text-dc1-amber">
                      {t('register.provider.advanced.show')}
                    </summary>
                    <div className="mt-2 space-y-1">
                      <a
                        href={troubleshootingGuideHref}
                        className="inline-flex text-xs text-dc1-text-muted hover:text-dc1-amber"
                        onClick={() =>
                          trackProviderRegisterEvent('provider_onboarding_next_action_clicked', {
                            state: nextActionState,
                            surface: 'next_action_secondary',
                            destination: troubleshootingGuideHref,
                            step: getProviderOnboardingStep(nextActionState),
                            cta_type: 'troubleshoot',
                          })
                        }
                      >
                        {t('register.provider.status_matrix.guide_cta')}
                      </a>
                      {showContextualSupport && (
                        <a
                          href={supportPrefillHref}
                          className="inline-flex text-xs text-dc1-text-muted hover:text-dc1-amber"
                          onClick={() =>
                            trackProviderRegisterEvent('provider_onboarding_next_action_clicked', {
                              state: nextActionState,
                              surface: 'next_action_secondary',
                              destination: supportPrefillHref,
                              step: getProviderOnboardingStep(nextActionState),
                              cta_type: 'support',
                            })
                          }
                        >
                          {t('register.provider.next_action_support_cta')}
                        </a>
                      )}
                    </div>
                  </details>
                </div>
              </div>

              <details className="card border-dc1-border group">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-dc1-text-primary">
                      {t('register.provider.advanced.title')}
                    </h2>
                    <p className="text-sm text-dc1-text-secondary">
                      {t('register.provider.advanced.subtitle')}
                    </p>
                  </div>
                  <span className="text-xs text-dc1-amber font-semibold group-open:hidden">
                    {t('register.provider.advanced.show')}
                  </span>
                  <span className="text-xs text-dc1-amber font-semibold hidden group-open:inline">
                    {t('register.provider.advanced.hide')}
                  </span>
                </summary>

                <div className="mt-5 space-y-6">
                  <div className="rounded-md border border-status-warning/30 bg-status-warning/5 p-4">
                    <p className="text-sm font-semibold text-dc1-text-primary mb-2">
                      {t('register.provider.install_checks.title')}
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-xs text-dc1-text-secondary font-mono">
                      <li>{t('register.provider.install_checks.endpoint')} {reachabilityCheckCommand}</li>
                      <li>{t('register.provider.install_checks.api_key')} {keyValidationCommand}</li>
                      <li>{t('register.provider.install_checks.daemon')}</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-dc1-text-primary mb-2">
                      {t('register.provider.status_matrix.title')}
                    </h3>
                    <p className="text-sm text-dc1-text-secondary mb-4">
                      {t('register.provider.status_matrix.subtitle')}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className={`border-b border-dc1-border text-dc1-text-muted ${isRTL ? 'text-right' : 'text-left'}`}>
                            <th className="py-2 pe-4 font-medium">{t('register.provider.status_matrix.column_status')}</th>
                            <th className="py-2 pe-4 font-medium">{t('register.provider.status_matrix.column_action')}</th>
                            <th className="py-2 pe-4 font-medium">{t('register.provider.status_matrix.column_guide')}</th>
                            <th className="py-2 font-medium">{t('register.provider.status_matrix.column_support')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statusActionMatrix.map((row) => (
                            <tr key={row.state} className="border-b border-dc1-border/60 align-top">
                              <td className="py-3 pe-4">
                                <span className="font-semibold text-dc1-text-primary">
                                  {nextActionMap[row.state].label}
                                </span>
                              </td>
                              <td className="py-3 pe-4 text-dc1-text-secondary">
                                <p>{row.action}</p>
                                <p className="mt-1 text-xs">
                                  <span className="font-medium text-dc1-text-primary">
                                    {t('register.provider.state.expectation_label')}:
                                  </span>{' '}
                                  {nextActionMap[row.state].expectation}
                                </p>
                                <p className="mt-1 text-xs">
                                  <span className="font-medium text-dc1-text-primary">
                                    {t('register.provider.state.next_success_label')}:
                                  </span>{' '}
                                  {nextActionMap[row.state].nextSuccess}
                                </p>
                              </td>
                              <td className="py-3">
                                <a
                                  href={row.href}
                                  className="text-dc1-amber font-medium hover:underline"
                                  onClick={() =>
                                    trackProviderRegisterEvent('provider_onboarding_matrix_guide_clicked', {
                                      state: row.state,
                                      surface: 'status_matrix',
                                      destination: row.href,
                                      step: getProviderOnboardingStep(row.state),
                                    })
                                  }
                                >
                                  {t('register.provider.status_matrix.guide_cta')}
                                </a>
                              </td>
                              <td className="py-3">
                                <a
                                  href={row.supportHref}
                                  className="text-dc1-text-primary font-medium hover:text-dc1-amber"
                                  onClick={() =>
                                    trackProviderRegisterEvent('provider_onboarding_matrix_support_clicked', {
                                      state: row.state,
                                      surface: 'status_matrix',
                                      destination: row.supportHref,
                                      step: getProviderOnboardingStep(row.state),
                                    })
                                  }
                                >
                                  {t('register.provider.status_matrix.support_cta')}
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </details>

              {/* Next Steps */}
              <div className="card border-dc1-amber/20">
                <h2 className="text-xl font-semibold text-dc1-text-primary mb-4">{t('register.provider.next_title')}</h2>
                <ul className="space-y-3">
                  <li className="flex gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-dc1-amber/20 text-dc1-amber text-sm font-semibold flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-dc1-text-secondary">
                      {t('register.provider.next_monitor')}{' '}
                      <a href="/provider/dashboard" className="text-dc1-amber hover:underline">
                        {t('register.provider.next_monitor_link')}
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-dc1-amber/20 text-dc1-amber text-sm font-semibold flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-dc1-text-secondary">
                      {t('register.provider.next_configure')}
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-dc1-amber/20 text-dc1-amber text-sm font-semibold flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-dc1-text-secondary">
                      {t('register.provider.next_jobs')}
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-dc1-amber/20 text-dc1-amber text-sm font-semibold flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-dc1-text-secondary">
                      {t('register.provider.next_docs')}{' '}
                      <a href="/docs" className="text-dc1-amber hover:underline">
                        {t('register.provider.next_docs_link')}
                      </a>{' '}
                      {t('register.provider.next_docs_suffix')}
                    </span>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-dc1-void">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-dc1-amber/10 to-dc1-void border-b border-dc1-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl font-bold text-dc1-text-primary mb-4">
                {t('register.provider.title')}
              </h1>
              <p className="text-lg text-dc1-text-secondary max-w-2xl mx-auto">
                {t('register.provider.subtitle')}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2 text-dc1-text-secondary">
                  <svg className="w-5 h-5 text-status-success" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{t('register.provider.transparent_pricing')}</span>
                </div>
                <div className="flex items-center gap-2 text-dc1-text-secondary">
                  <svg className="w-5 h-5 text-status-success" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{t('register.provider.easy_setup')}</span>
                </div>
                <div className="flex items-center gap-2 text-dc1-text-secondary">
                  <svg className="w-5 h-5 text-status-success" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{t('register.provider.instant_payouts')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className={`rounded-xl border border-dc1-border bg-dc1-surface-l1 p-5 ${isRTL ? 'text-right' : 'text-left'}`}>
            <h2 className="text-base font-semibold text-dc1-text-primary mb-1">{t('path_chooser.title')}</h2>
            <p className="text-xs text-dc1-text-secondary mb-3">{t('path_chooser.subtitle')}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pathChooserLanes.map((lane) => (
                <a key={lane.key} href={lane.href} className="rounded-lg border border-dc1-border bg-dc1-surface-l2 px-3 py-2 hover:border-dc1-amber transition-colors">
                  <p className="text-sm font-semibold text-dc1-text-primary">{lane.label}</p>
                  <p className="mt-1 text-xs text-dc1-text-secondary">{lane.description}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Earnings Transparency */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="card border-dc1-amber/20">
            <h2 className="text-xl font-bold text-dc1-text-primary mb-1">How provider earnings work</h2>
            <p className="text-dc1-text-secondary text-sm mb-6">
              Earnings are based on completed workload demand and machine availability, not fixed guarantees.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-dc1-border bg-dc1-surface-l2 p-4">
                <p className="text-sm font-semibold text-dc1-text-primary mb-2">What increases earnings</p>
                <ul className="space-y-2 text-sm text-dc1-text-secondary">
                  <li>Consistent daemon uptime and heartbeat health</li>
                  <li>Fast job acceptance and completion reliability</li>
                  <li>Popular GPU availability when demand is high</li>
                </ul>
              </div>
              <div className="rounded-lg border border-dc1-border bg-dc1-surface-l2 p-4">
                <p className="text-sm font-semibold text-dc1-text-primary mb-2">How to validate performance</p>
                <ul className="space-y-2 text-sm text-dc1-text-secondary">
                  <li>Track completed jobs and realized earnings in your dashboard</li>
                  <li>Review heartbeat status to avoid offline gaps</li>
                  <li>Use provider docs for optimization and troubleshooting</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-dc1-text-muted mt-4">
              DCP does not guarantee fixed income outcomes. Realized earnings vary by demand, uptime, and accepted jobs.
            </p>
          </div>
        </section>

        {/* Registration Form */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="card">
            <h2 className="text-2xl font-bold text-dc1-text-primary mb-2">
              {t('register.provider.form_title')}
            </h2>
            <p className="text-dc1-text-secondary mb-8">
              {t('register.provider.form_desc')}
            </p>

            {error && (
              <div className="alert alert-error mb-6">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="label">
                  {t('register.provider.full_name')}
                </label>
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder={t('register.provider.full_name_placeholder')}
                  className="input"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="label">
                  {t('register.provider.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder={t('register.provider.email_placeholder')}
                  className="input"
                  required
                />
              </div>

              {/* GPU Model */}
              <div>
                <label htmlFor="gpuModel" className="label">
                  {t('register.provider.gpu_model')}
                </label>
                <select
                  id="gpuModel"
                  name="gpuModel"
                  value={formData.gpuModel}
                  onChange={handleInputChange}
                  className="input"
                  required
                >
                  <option value="">{t('register.provider.gpu_model_placeholder')}</option>
                  <option value="RTX 4090">NVIDIA RTX 4090 (24 GB)</option>
                  <option value="RTX 4080">NVIDIA RTX 4080 (16 GB)</option>
                  <option value="RTX 3090">NVIDIA RTX 3090 (24 GB)</option>
                  <option value="H100">NVIDIA H100 (80 GB)</option>
                  <option value="H200">NVIDIA H200 (141 GB)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* VRAM (auto-filled from GPU model) */}
              <div>
                <label htmlFor="vram" className="label">
                  VRAM (GB)
                </label>
                <input
                  id="vram"
                  type="number"
                  name="vram"
                  value={formData.vram}
                  onChange={handleInputChange}
                  placeholder="Auto-filled from GPU model"
                  className="input"
                  min="1"
                  max="1000"
                />
                {formData.gpuModel && formData.vram && (
                  <p className="mt-1 text-xs text-dc1-text-muted">
                    Auto-detected from {formData.gpuModel}
                  </p>
                )}
              </div>

              {/* Location */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="locationCity" className="label">
                    City
                  </label>
                  <input
                    id="locationCity"
                    type="text"
                    name="locationCity"
                    value={formData.locationCity}
                    onChange={handleInputChange}
                    placeholder="Riyadh"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="locationCountry" className="label">
                    Country
                  </label>
                  <select
                    id="locationCountry"
                    name="locationCountry"
                    value={formData.locationCountry}
                    onChange={handleInputChange}
                    className="input"
                  >
                    <option value="">Select country</option>
                    <option value="SA">Saudi Arabia</option>
                    <option value="AE">United Arab Emirates</option>
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="NL">Netherlands</option>
                    <option value="SG">Singapore</option>
                    <option value="JP">Japan</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Operating System */}
              <div>
                <label htmlFor="operatingSystem" className="label">
                  {t('register.provider.os')}
                </label>
                <select
                  id="operatingSystem"
                  name="operatingSystem"
                  value={formData.operatingSystem}
                  onChange={handleInputChange}
                  className="input"
                  required
                >
                  <option value="">{t('register.provider.os_placeholder')}</option>
                  <option value="Windows 10/11">Windows 10/11</option>
                  <option value="Ubuntu 22.04">Ubuntu 22.04</option>
                  <option value="Ubuntu 20.04">Ubuntu 20.04</option>
                  <option value="Other Linux">Other Linux</option>
                </select>
              </div>

              {/* Phone (Optional) */}
              <div>
                <label htmlFor="phone" className="label">
                  {t('register.provider.phone_label')} <span className="text-dc1-text-muted">{t('register.provider.phone_optional')}</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+1 (555) 000-0000"
                  className="input"
                />
              </div>

              {/* Referral Code */}
              <div>
                <label className="label" htmlFor="referralCode">
                  Referral Code <span className="text-dc1-text-muted font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="referralCode"
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="e.g. DCP-ABC123"
                    className="input flex-1"
                    disabled={referralStatus === 'applied'}
                  />
                  {referralCode && referralStatus === 'idle' && (
                    <span className="flex items-center text-xs text-dc1-text-muted px-2">Applied at registration</span>
                  )}
                </div>
                {referralStatus === 'applied' && (
                  <p className="mt-1.5 text-sm text-status-success flex items-center gap-1.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-status-success text-[10px] font-bold text-black">✓</span>
                    {referralMessage}
                  </p>
                )}
                {referralStatus === 'error' && (
                  <p className="mt-1.5 text-sm text-red-400">{referralMessage}</p>
                )}
                <p className="mt-1 text-xs text-dc1-text-muted">
                  Have a referral code from another provider? Enter it here to earn bonus rewards.
                </p>
              </div>

              {/* PDPL Consent */}
              <div className="p-4 rounded-lg bg-dc1-surface-l2 border border-dc1-border">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="pdplConsent"
                    checked={formData.pdplConsent}
                    onChange={(e) => setFormData(prev => ({ ...prev, pdplConsent: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded border-dc1-border accent-dc1-amber flex-shrink-0"
                    required
                  />
                  <span className="text-sm text-dc1-text-secondary">
                    {t('register.provider.pdpl_text')}{' '}
                    <a href="/privacy" className="text-dc1-amber hover:underline">{t('register.provider.privacy_policy')}</a>.
                    {' '}{t('register.provider.pdpl_text2')}{' '}
                    <a href="/terms" className="text-dc1-amber hover:underline">{t('register.provider.terms')}</a>.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <p className="text-xs text-dc1-text-muted">
                Earnings shown in this flow are illustrative scenarios, not payout guarantees.
              </p>
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full btn-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t('register.provider.submitting')}
                  </>
                ) : (
                  t('register.provider.submit')
                )}
              </button>

              {/* Sign In Link */}
              <p className="text-center text-sm text-dc1-text-secondary">
                {t('register.provider.already_registered')}{' '}
                <a href="/login" className="text-dc1-amber hover:underline font-semibold">
                  {t('register.provider.sign_in')}
                </a>
              </p>
            </form>
          </div>

          {/* Additional Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="card text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-dc1-amber/20 mb-4">
                <svg className="w-6 h-6 text-dc1-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-dc1-text-primary mb-2">Fast Setup</h3>
              <p className="text-sm text-dc1-text-secondary">
                Install the daemon to join live matching and start receiving workloads as availability allows.
              </p>
            </div>

            <div className="card text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-dc1-amber/20 mb-4">
                <svg className="w-6 h-6 text-dc1-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-dc1-text-primary mb-2">Earn More</h3>
              <p className="text-sm text-dc1-text-secondary">
                Earnings are calculated from completed jobs based on marketplace pricing and utilization.
              </p>
            </div>

            <div className="card text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-dc1-amber/20 mb-4">
                <svg className="w-6 h-6 text-dc1-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-dc1-text-primary mb-2">Secure & Reliable</h3>
              <p className="text-sm text-dc1-text-secondary">
                HMAC-signed jobs, containerized execution, and provider pause/resume controls.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
