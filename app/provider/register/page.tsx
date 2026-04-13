'use client'

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
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
import { getProviderActivationNarrative } from '../../lib/provider-activation-narrative'

const API_BASE = '/api/dc1'

function normalizeOperatingSystemForApi(value: string): 'windows' | 'linux' | 'mac' | 'darwin' | null {
  const raw = value.trim().toLowerCase()
  if (!raw) return null

  if (raw === 'darwin') return 'darwin'

  if (raw === 'windows' || raw === 'windows 10' || raw === 'windows 11' || raw === 'windows 10/11') {
    return 'windows'
  }

  if (raw === 'linux' || raw === 'other linux' || raw.startsWith('ubuntu') || raw.includes('linux')) {
    return 'linux'
  }

  if (raw === 'mac' || raw === 'macos' || raw === 'mac os' || raw === 'mac os x' || raw === 'osx') {
    return 'mac'
  }

  return null
}

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

type RegistrationField =
  | 'fullName'
  | 'email'
  | 'gpuModel'
  | 'vram'
  | 'locationCountry'
  | 'operatingSystem'
  | 'pdplConsent'

type RegistrationErrors = Partial<Record<RegistrationField, string>>

const GPU_MODEL_VRAM: Record<string, string> = {
  // Consumer NVIDIA (our target market)
  'RTX 5090': '32',
  'RTX 4090': '24',
  'RTX 4080 SUPER': '16',
  'RTX 4070 Ti': '12',
  'RTX 4060 Ti': '8',
  'RTX 3090': '24',
  'RTX 3080': '10',
  'RTX 3070': '8',
  'RTX 3060 Ti': '8',
  'RTX A5000': '24',
  'RTX A6000': '48',
  // Apple Silicon
  'Apple M4 Max': '48',
  'Apple M4 Pro': '24',
  'Apple M4': '16',
  'Apple M3 Max': '36',
  'Apple M3 Pro': '18',
  'Apple M3': '16',
  'Apple M2 Max': '32',
  'Apple M2 Pro': '16',
  'Apple M2': '16',
  'Apple M1 Max': '32',
  'Apple M1 Pro': '16',
  'Apple M1': '16',
  // Enterprise
  'H100': '80',
  'H200': '141',
  'A100': '80',
  'Other': '',
}

interface StatusStep {
  step: number
  label: string
  status: 'pending' | 'in-progress' | 'completed'
}

type SupportCategory = 'provider' | 'bug'

type ProviderActivationState = 'not_started' | 'install_started' | 'heartbeat_received' | 'ready_for_jobs' | 'blocked'

interface ProviderActivationBlocker {
  code: string
  severity: 'soft' | 'hard' | string
  hint_key?: string
  hint_en?: string
  hint_ar?: string
}

interface ProviderActivationStatePayload {
  provider_id?: number
  activation_state?: ProviderActivationState
  blocker_codes?: string[]
  blockers?: ProviderActivationBlocker[]
  next_action?: {
    hint_key?: string
    hint_en?: string
    hint_ar?: string
  }
  signals?: {
    provider_status?: string
    heartbeat_age_seconds?: number | null
    heartbeat_fresh?: boolean
  }
}

interface ActivationConversionWindow {
  stage_counts: {
    registered: number
    installer_downloaded: number
    first_heartbeat: number
    online_within_24h: number
  }
  conversion_rates: {
    installer_download_rate: number | null
    first_heartbeat_rate: number | null
    online_within_24h_rate: number | null
  }
  blocker_taxonomy: Array<{
    code: string
    count: number
  }>
  sample_size: number
}

interface ActivationConversionPayload {
  windows?: {
    last_24h?: ActivationConversionWindow
    last_7d?: ActivationConversionWindow
  }
}

function mapActivationStateToNextActionState(payload: ProviderActivationStatePayload): ProviderNextActionState {
  const activationState = payload.activation_state
  const blockers = payload.blocker_codes || []

  if (activationState === 'ready_for_jobs') return 'ready'
  if (activationState === 'heartbeat_received') return 'heartbeat'
  if (activationState === 'blocked' && blockers.includes('provider_paused')) return 'paused'
  if (activationState === 'blocked') return 'stale'
  return 'waiting'
}

function mapActivationStateToStep(payload: ProviderActivationStatePayload): number {
  const activationState = payload.activation_state
  const blockers = payload.blocker_codes || []

  if (activationState === 'ready_for_jobs') return 4
  if (activationState === 'heartbeat_received') return 3
  if (activationState === 'install_started') return 2
  if (activationState === 'blocked' && blockers.includes('provider_paused')) return 3
  if (activationState === 'blocked') return 2
  return 1
}

function ProviderRegisterPageContent() {
  const { t, isRTL } = useLanguage()
  const activationNarrative = getProviderActivationNarrative(isRTL)
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
  const [fieldErrors, setFieldErrors] = useState<RegistrationErrors>({})
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
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
  const [activationStatePayload, setActivationStatePayload] = useState<ProviderActivationStatePayload | null>(null)
  const [conversionWindow, setConversionWindow] = useState<ActivationConversionWindow | null>(null)
  const [conversionUnavailable, setConversionUnavailable] = useState(false)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingKeyRef = useRef<string | null>(null)
  const lastTrackedStateRef = useRef<ProviderNextActionState | null>(null)
  const conversionTrackedRef = useRef(false)
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

  const fetchActivationConversion = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/providers/activation-conversion', {
        cache: 'no-store',
      })
      if (!response.ok) {
        setConversionUnavailable(true)
        setConversionWindow(null)
        return
      }
      const payload = (await response.json()) as ActivationConversionPayload
      const windowData = payload.windows?.last_24h || payload.windows?.last_7d || null
      setConversionWindow(windowData)
      setConversionUnavailable(false)
      if (!conversionTrackedRef.current && windowData) {
        conversionTrackedRef.current = true
        trackProviderRegisterEvent('provider_activation_conversion_contract_seen', {
          surface: 'activation_conversion_card',
          destination: '/api/admin/providers/activation-conversion',
          step: 'conversion_contract',
          sample_size: windowData.sample_size,
          registered: windowData.stage_counts.registered,
          installer_downloaded: windowData.stage_counts.installer_downloaded,
          first_heartbeat: windowData.stage_counts.first_heartbeat,
          online_within_24h: windowData.stage_counts.online_within_24h,
        })
      }
    } catch {
      setConversionUnavailable(true)
      setConversionWindow(null)
    }
  }, [trackProviderRegisterEvent])

  const fetchActivationState = useCallback(
    async (key: string) => {
      const response = await fetch(`${API_BASE}/providers/activation-state?key=${encodeURIComponent(key)}`, {
        cache: 'no-store',
      })
      if (!response.ok) return

      const payload = (await response.json()) as ProviderActivationStatePayload
      setActivationStatePayload(payload)

      const nextAction = mapActivationStateToNextActionState(payload)
      const currentStep = mapActivationStateToStep(payload)
      setNextActionState(nextAction)
      if (lastTrackedStateRef.current !== nextAction) {
        lastTrackedStateRef.current = nextAction
        trackProviderRegisterEvent('provider_onboarding_state_seen', {
          state: nextAction,
          surface: 'onboarding_status',
          destination:
            nextAction === 'ready' || nextAction === 'heartbeat' || nextAction === 'paused'
              ? '/provider/dashboard'
              : '/docs/provider-guide',
          step: getProviderOnboardingStep(nextAction),
          activation_state: payload.activation_state || 'unknown',
          blocker_codes: payload.blocker_codes || [],
          heartbeat_age_seconds: payload.signals?.heartbeat_age_seconds ?? null,
          provider_status: payload.signals?.provider_status || 'unknown',
        })
      }

      setStatusSteps((prev) =>
        prev.map((s) => {
          if (s.step < currentStep) return { ...s, status: 'completed' }
          if (s.step === currentStep) return { ...s, status: 'in-progress' }
          return s
        })
      )

      if (currentStep >= 4) {
        setStatusSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })))
        stopStatusPolling()
      }
    },
    [stopStatusPolling, trackProviderRegisterEvent]
  )

  useEffect(() => {
    return () => {
      stopStatusPolling()
    }
  }, [stopStatusPolling])

  const emailPattern = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, [])

  const validateField = useCallback(
    (field: RegistrationField, value: RegistrationFormData[RegistrationField], snapshot: RegistrationFormData): string => {
      switch (field) {
        case 'fullName':
          return String(value).trim() ? '' : t('register.provider.validation.full_name')
        case 'email':
          return emailPattern.test(String(value).trim()) ? '' : t('register.provider.validation.email')
        case 'gpuModel':
          return String(value) ? '' : t('register.provider.validation.gpu')
        case 'vram':
          if (snapshot.gpuModel !== 'Other') return ''
          if (!String(value).trim()) return t('register.provider.validation.vram')
          return Number(value) > 0 ? '' : t('register.provider.validation.vram_positive')
        case 'locationCountry':
          return String(value) ? '' : t('register.provider.validation.locationCountry')
        case 'operatingSystem':
          return String(value) ? '' : t('register.provider.validation.os')
        case 'pdplConsent':
          return value ? '' : t('register.provider.validation.pdpl')
        default:
          return ''
      }
    },
    [emailPattern, t]
  )

  const validateForm = useCallback(() => {
    const nextErrors: RegistrationErrors = {
      fullName: validateField('fullName', formData.fullName, formData),
      email: validateField('email', formData.email, formData),
      gpuModel: validateField('gpuModel', formData.gpuModel, formData),
      vram: validateField('vram', formData.vram, formData),
      locationCountry: validateField('locationCountry', formData.locationCountry, formData),
      operatingSystem: validateField('operatingSystem', formData.operatingSystem, formData),
      pdplConsent: validateField('pdplConsent', formData.pdplConsent, formData),
    }

    const filteredErrors = Object.fromEntries(
      Object.entries(nextErrors).filter(([, value]) => value)
    ) as RegistrationErrors

    setFieldErrors(filteredErrors)

    const firstError = Object.values(filteredErrors)[0]
    if (firstError) {
      setError(firstError)
      return false
    }

    setError('')
    return true
  }, [formData, validateField])

  const customVramReady = formData.gpuModel !== 'Other' || Number(formData.vram) > 0

  const readinessChecklist = useMemo(
    () => [
      {
        id: 'identity',
        label: t('register.provider.readiness.identity_label'),
        helper: t('register.provider.readiness.identity_helper'),
        complete: Boolean(formData.fullName.trim()) && emailPattern.test(formData.email.trim()),
      },
      {
        id: 'hardware',
        label: t('register.provider.readiness.hardware_label'),
        helper: t('register.provider.readiness.hardware_helper'),
        complete: Boolean(formData.gpuModel) && customVramReady,
      },
      {
        id: 'runtime',
        label: t('register.provider.readiness.runtime_label'),
        helper: t('register.provider.readiness.runtime_helper'),
        complete: Boolean(formData.operatingSystem) && Boolean(formData.locationCountry) && formData.pdplConsent,
      },
    ],
    [customVramReady, formData, emailPattern, t]
  )

  const readinessCompleteCount = readinessChecklist.filter((item) => item.complete).length
  const readinessPercent = Math.round((readinessCompleteCount / readinessChecklist.length) * 100)
  const selectedGpuLabel = formData.gpuModel || t('register.provider.gpu_model_placeholder')
  const selectedOsLabel = formData.operatingSystem || t('register.provider.os_placeholder')
  const normalizedOperatingSystem = normalizeOperatingSystemForApi(formData.operatingSystem)
  const setupExpectation = normalizedOperatingSystem
    ? normalizedOperatingSystem === 'windows'
      ? t('register.provider.setup_expectation.windows')
      : normalizedOperatingSystem === 'mac' || normalizedOperatingSystem === 'darwin'
        ? t('register.provider.setup_expectation.mac')
        : t('register.provider.setup_expectation.linux')
    : t('register.provider.setup_expectation.default')
  const canSubmit = readinessCompleteCount === readinessChecklist.length && !isLoading

  useEffect(() => {
    if (!attemptedSubmit) return
    validateForm()
  }, [attemptedSubmit, formData, validateForm])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttemptedSubmit(true)
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
          os: normalizedOperatingSystem || formData.operatingSystem,
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
            setReferralMessage((refErr as { error?: string }).error || t('register.provider.referral.error_apply'))
          }
        } catch {
          setReferralStatus('error')
          setReferralMessage(t('register.provider.referral.error_apply'))
        }
      }

      // Mark first step as completed
      setStatusSteps((prev) =>
        prev.map((s) => (s.step === 1 ? { ...s, status: 'completed' } : s))
      )
      setNextActionState('waiting')
      lastTrackedStateRef.current = null

      setShowSuccess(true)
      void fetchActivationConversion()
      trackProviderRegisterEvent('provider_register_success', {
        surface: 'registration_form',
        destination: '/api/dc1/providers/register',
        step: 'submit_success',
        activation_funnel_stage: 'registered',
        activation_contract: 'provider_activation_state_v1',
        conversion_contract: 'provider_activation_conversion_v1',
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

    void fetchActivationState(key)

    pollingIntervalRef.current = setInterval(async () => {
      try {
        await fetchActivationState(key)
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
              : index === 3
                ? 'install_one_command'
                : 'other',
    })
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    const fieldName = name as keyof RegistrationFormData
    const nextForm = {
      ...formData,
      [fieldName]: value,
      ...(name === 'gpuModel' && value in GPU_MODEL_VRAM ? { vram: GPU_MODEL_VRAM[value] } : {}),
    }

    setFormData(nextForm)
    if (error) {
      setError('')
    }
    if (name === 'fullName' || name === 'email' || name === 'gpuModel' || name === 'vram' || name === 'locationCountry' || name === 'operatingSystem') {
      const registrationField = name as RegistrationField
      const shouldValidate = attemptedSubmit || Boolean(value) || Boolean(fieldErrors[registrationField])
      setFieldErrors((prev) => {
        const next = { ...prev }
        if (shouldValidate) {
          const message = validateField(registrationField, nextForm[registrationField], nextForm)
          if (message) {
            next[registrationField] = message
          } else {
            delete next[registrationField]
          }
        }
        if (registrationField === 'gpuModel' || registrationField === 'vram') {
          const vramMessage = validateField('vram', nextForm.vram, nextForm)
          if (vramMessage) {
            next.vram = vramMessage
          } else {
            delete next.vram
          }
        }
        return next
      })
    }
  }

  if (showSuccess && apiKey) {
    const installApiBase = getProviderInstallApiBase()
    const preferredInstallTarget =
      normalizedOperatingSystem === 'windows'
        ? 'windows'
        : normalizedOperatingSystem === 'mac' || normalizedOperatingSystem === 'darwin'
          ? 'macos'
          : 'linux'
    const oneCommandInstall = buildProviderInstallCommand(preferredInstallTarget, installApiBase, apiKey)
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
                    title={t('register.provider.copy_api_key')}
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

              <div className="card border-dc1-amber/30 bg-dc1-amber/5">
                <h2 className="text-xl font-semibold text-dc1-text-primary mb-4 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-dc1-amber/20 text-dc1-amber font-bold text-sm">
                    2
                  </span>
                  {isRTL ? 'أمر واحد للتشغيل' : 'One-command install'}
                </h2>
                <p className="text-dc1-text-secondary mb-3">
                  {isRTL
                    ? 'نستخدم نظام التشغيل الذي اخترته لتوليد أمر واحد قابل للنسخ والتشغيل مباشرة.'
                    : 'We use your selected operating system to generate one command you can copy and run immediately.'}
                </p>
                <p className="text-xs text-dc1-text-muted mb-4">
                  {isRTL
                    ? `النظام المحدد: ${formData.operatingSystem || 'Linux'}`
                    : `Selected OS: ${formData.operatingSystem || 'Linux'}`}
                </p>
                <div className="relative bg-dc1-surface-l3 rounded-md border border-dc1-amber/40 p-4 font-mono text-xs overflow-x-auto">
                  <code className="text-dc1-amber">{oneCommandInstall}</code>
                  <button
                    onClick={() => copyToClipboard(oneCommandInstall, 3)}
                    className="absolute top-3 right-3 p-2 rounded-md hover:bg-dc1-surface-l2 transition-colors"
                    title={isRTL ? 'نسخ الأمر' : 'Copy command'}
                  >
                    {copiedIndex === 3 ? (
                      <svg className="w-5 h-5 text-status-success" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-dc1-text-secondary hover:text-dc1-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    3
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
                      {t('register.provider.install_linux_title')}
                    </h3>
                    <div className="relative bg-dc1-surface-l3 rounded-md border border-dc1-border p-4 font-mono text-xs overflow-x-auto">
                      <code className="text-dc1-amber">{linuxInstallCommand}</code>
                      <button
                        onClick={() => copyToClipboard(linuxInstallCommand, 1)}
                        className="absolute top-3 right-3 p-2 rounded-md hover:bg-dc1-surface-l2 transition-colors"
                        title={t('register.provider.copy_install_command')}
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
                      {t('register.provider.install_windows_title')}
                    </h3>
                    <div className="relative bg-dc1-surface-l3 rounded-md border border-dc1-border p-4 font-mono text-xs overflow-x-auto">
                      <code className="text-dc1-amber">{windowsInstallCommand}</code>
                      <button
                        onClick={() => copyToClipboard(windowsInstallCommand, 2)}
                        className="absolute top-3 right-3 p-2 rounded-md hover:bg-dc1-surface-l2 transition-colors"
                        title={t('register.provider.copy_install_command')}
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

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className={`card border-dc1-amber/20 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <h2 className="text-xl font-semibold text-dc1-text-primary mb-2">
                    {isRTL ? 'بطاقة حالة التفعيل المباشرة' : 'Live activation state'}
                  </h2>
                  <p className="text-sm text-dc1-text-secondary mb-4">
                    {isRTL
                      ? 'تُقرأ هذه الحالة مباشرة من عقد `/providers/activation-state` بدون افتراضات محلية.'
                      : 'This card reads directly from the `/providers/activation-state` contract without synthetic local assumptions.'}
                  </p>
                  <p className="text-xs text-dc1-text-muted mb-1">
                    {isRTL ? 'الحالة' : 'Activation state'}
                  </p>
                  <p className="text-base font-semibold text-dc1-text-primary mb-3">
                    {activationStatePayload?.activation_state || (isRTL ? 'بانتظار أول قراءة' : 'Waiting for first contract read')}
                  </p>
                  <p className="text-xs text-dc1-text-muted mb-1">
                    {isRTL ? 'الإجراء التالي' : 'Next action'}
                  </p>
                  <p className="text-sm text-dc1-text-secondary">
                    {activationStatePayload?.next_action
                      ? isRTL
                        ? activationStatePayload.next_action.hint_ar || activationStatePayload.next_action.hint_en
                        : activationStatePayload.next_action.hint_en || activationStatePayload.next_action.hint_ar
                      : isRTL
                        ? 'لا توجد إشارة بعد. استمر بتشغيل الديمون وانتظر تحديث البيانات.'
                        : 'No hint yet. Keep the daemon running and wait for the next telemetry refresh.'}
                  </p>
                  <div className="mt-3 space-y-1 text-xs text-dc1-text-secondary">
                    {(activationStatePayload?.blockers || []).slice(0, 3).map((blocker) => (
                      <p key={blocker.code}>
                        <span className="font-semibold text-dc1-text-primary">{blocker.code}</span>
                        {' · '}
                        {isRTL ? blocker.hint_ar || blocker.hint_en : blocker.hint_en || blocker.hint_ar}
                      </p>
                    ))}
                  </div>
                </div>

                <div className={`card border-dc1-border ${isRTL ? 'text-right' : 'text-left'}`}>
                  <h2 className="text-xl font-semibold text-dc1-text-primary mb-2">
                    {isRTL ? 'بطاقة تحويل التفعيل (آخر 24 ساعة)' : 'Activation conversion contract (24h)'}
                  </h2>
                  <p className="text-sm text-dc1-text-secondary mb-4">
                    {isRTL
                      ? 'مصدرها عقد `/admin/providers/activation-conversion`. عند غياب الصلاحية نظهر حالة غير متاحة بدل أرقام مصطنعة.'
                      : 'Backed by `/admin/providers/activation-conversion`. If admin telemetry is unavailable, we show unavailable state instead of fabricated numbers.'}
                  </p>
                  {conversionWindow ? (
                    <div className="space-y-2 text-sm">
                      <p className="text-dc1-text-secondary">
                        <span className="font-semibold text-dc1-text-primary">{isRTL ? 'حجم العينة' : 'Sample size'}:</span>{' '}
                        {conversionWindow.sample_size}
                      </p>
                      <p className="text-dc1-text-secondary">
                        <span className="font-semibold text-dc1-text-primary">registered:</span>{' '}
                        {conversionWindow.stage_counts.registered}
                        {' • '}
                        <span className="font-semibold text-dc1-text-primary">installer_downloaded:</span>{' '}
                        {conversionWindow.stage_counts.installer_downloaded}
                      </p>
                      <p className="text-dc1-text-secondary">
                        <span className="font-semibold text-dc1-text-primary">first_heartbeat:</span>{' '}
                        {conversionWindow.stage_counts.first_heartbeat}
                        {' • '}
                        <span className="font-semibold text-dc1-text-primary">online_within_24h:</span>{' '}
                        {conversionWindow.stage_counts.online_within_24h}
                      </p>
                      <p className="text-xs text-dc1-text-muted">
                        installer_download_rate: {conversionWindow.conversion_rates.installer_download_rate ?? 'n/a'}% •
                        first_heartbeat_rate: {conversionWindow.conversion_rates.first_heartbeat_rate ?? 'n/a'}% •
                        online_within_24h_rate: {conversionWindow.conversion_rates.online_within_24h_rate ?? 'n/a'}%
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-dc1-text-secondary">
                      {conversionUnavailable
                        ? isRTL
                          ? 'بيانات التحويل غير متاحة حالياً في هذا البيئة.'
                          : 'Conversion telemetry is currently unavailable in this environment.'
                        : isRTL
                          ? 'جاري انتظار أول تحميل لعقد التحويل...'
                          : 'Waiting for conversion contract payload...'}
                    </p>
                  )}
                </div>
              </div>

              {/* Status Tracker */}
              <div className="card">
                <h2 className="text-xl font-semibold text-dc1-text-primary mb-6 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-dc1-amber/20 text-dc1-amber font-bold text-sm">
                    4
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

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className={`rounded-xl border border-dc1-amber/25 bg-dc1-amber/5 p-5 ${isRTL ? 'text-right' : 'text-left'}`}>
            <h2 className="text-lg font-bold text-dc1-text-primary">{activationNarrative.headline}</h2>
            <p className="mt-1 text-sm text-dc1-text-secondary">{activationNarrative.subheadline}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-dc1-border bg-dc1-surface-l1 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dc1-text-muted mb-2">
                  {isRTL ? 'القيمة الأساسية' : 'Core value'}
                </p>
                <ul className="space-y-1 text-sm text-dc1-text-secondary">
                  {activationNarrative.valuePoints.map((point) => (
                    <li key={point}>• {point}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-dc1-border bg-dc1-surface-l1 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dc1-text-muted mb-2">
                  {activationNarrative.assumptionsTitle}
                </p>
                <ul className="space-y-1 text-sm text-dc1-text-secondary">
                  {activationNarrative.assumptions.map((assumption) => (
                    <li key={assumption}>• {assumption}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {activationNarrative.ctaFlow.map((cta) => (
                <a key={cta.href} href={cta.href} className="rounded-lg border border-dc1-border bg-dc1-surface-l1 px-3 py-2 text-xs font-semibold text-dc1-text-primary hover:border-dc1-amber/40 transition-colors">
                  {cta.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Earnings Transparency */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="card border-dc1-amber/20">
            <h2 className="text-xl font-bold text-dc1-text-primary mb-1">{t('register.provider.earnings.title')}</h2>
            <p className="text-dc1-text-secondary text-sm mb-6">
              {t('register.provider.earnings.description')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-dc1-border bg-dc1-surface-l2 p-4">
                <p className="text-sm font-semibold text-dc1-text-primary mb-2">{t('register.provider.earnings.increase_title')}</p>
                <ul className="space-y-2 text-sm text-dc1-text-secondary">
                  <li>{t('register.provider.earnings.increase_item_1')}</li>
                  <li>{t('register.provider.earnings.increase_item_2')}</li>
                  <li>{t('register.provider.earnings.increase_item_3')}</li>
                </ul>
              </div>
              <div className="rounded-lg border border-dc1-border bg-dc1-surface-l2 p-4">
                <p className="text-sm font-semibold text-dc1-text-primary mb-2">{t('register.provider.earnings.validate_title')}</p>
                <ul className="space-y-2 text-sm text-dc1-text-secondary">
                  <li>{t('register.provider.earnings.validate_item_1')}</li>
                  <li>{t('register.provider.earnings.validate_item_2')}</li>
                  <li>{t('register.provider.earnings.validate_item_3')}</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-dc1-text-muted mt-4">
              {t('register.provider.earnings.disclaimer')}
            </p>
          </div>
        </section>

        {/* Registration Form */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-6 rounded-2xl border border-dc1-amber/20 bg-dc1-surface-l1 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dc1-amber">
                  {t('register.provider.readiness.title')}
                </p>
                <h2 className="mt-2 text-xl font-bold text-dc1-text-primary">
                  {t('register.provider.readiness.subtitle')}
                </h2>
                <p className="mt-1 text-sm text-dc1-text-secondary">
                  {t('register.provider.readiness.description')}
                </p>
              </div>
              <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 px-4 py-3 text-center sm:min-w-[144px]">
                <p className="text-xs uppercase tracking-[0.16em] text-dc1-text-muted">{t('register.provider.readiness.ready')}</p>
                <p className="mt-1 text-3xl font-bold text-dc1-text-primary">{readinessPercent}%</p>
                <p className="text-xs text-dc1-text-secondary">
                  {readinessCompleteCount} / {readinessChecklist.length} {t('register.provider.readiness.progress_suffix')}
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-dc1-surface-l3">
              <div className="h-full rounded-full bg-gradient-to-r from-dc1-amber to-status-success transition-all duration-300" style={{ width: `${readinessPercent}%` }} />
            </div>

            <div className="mt-5 grid gap-3">
              {readinessChecklist.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border px-4 py-3 transition-colors ${
                    item.complete
                      ? 'border-status-success/30 bg-status-success/10'
                      : 'border-dc1-border bg-dc1-surface-l2'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      item.complete
                        ? 'bg-status-success text-black'
                        : 'bg-dc1-surface-l3 text-dc1-text-muted'
                    }`}>
                      {item.complete ? '✓' : '•'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-dc1-text-primary">{item.label}</p>
                      <p className="mt-1 text-xs text-dc1-text-secondary">{item.helper}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-dc1-text-muted">{t('register.provider.readiness.summary_gpu')}</p>
                <p className="mt-2 text-sm font-semibold text-dc1-text-primary">{selectedGpuLabel}</p>
              </div>
              <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-dc1-text-muted">{t('register.provider.readiness.summary_installer')}</p>
                <p className="mt-2 text-sm font-semibold text-dc1-text-primary">{selectedOsLabel}</p>
              </div>
              <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-dc1-text-muted">{t('register.provider.readiness.summary_next_step')}</p>
                <p className="mt-2 text-sm font-semibold text-dc1-text-primary">{setupExpectation}</p>
              </div>
            </div>
          </div>

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

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
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
                  className={`input ${fieldErrors.fullName ? 'border-red-400 focus:border-red-400' : ''}`}
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
                  required
                />
                {fieldErrors.fullName ? (
                  <p id="fullName-error" className="mt-2 text-sm text-red-400">{fieldErrors.fullName}</p>
                ) : (
                  <p className="mt-2 text-xs text-dc1-text-muted">{t('register.provider.full_name_hint')}</p>
                )}
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
                  className={`input ${fieldErrors.email ? 'border-red-400 focus:border-red-400' : ''}`}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'email-error' : 'email-hint'}
                  required
                />
                {fieldErrors.email ? (
                  <p id="email-error" className="mt-2 text-sm text-red-400">{fieldErrors.email}</p>
                ) : (
                  <p id="email-hint" className="mt-2 text-xs text-dc1-text-muted">
                    {t('register.provider.email_hint')}
                  </p>
                )}
              </div>

              {/* GPU Model */}
              <div>
                <label htmlFor="gpuModel" className="label">
                  {t('register.provider.gpu_model')}
                </label>
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { value: 'RTX 4090', label: 'RTX 4090 (24 GB)', helper: '137-197 tok/s — best consumer GPU for inference' },
                    { value: 'RTX 3060 Ti', label: 'RTX 3060 Ti (8 GB)', helper: '107-139 tok/s — great entry-level provider' },
                    { value: 'Apple M4 Max', label: 'Apple M4 Max (48 GB)', helper: 'MLX engine — Apple Silicon native inference' },
                    { value: 'Apple M2', label: 'Apple M2 (16 GB)', helper: 'MLX engine — MacBook Air/Pro provider' },
                  ].map((gpu) => (
                    <button
                      key={gpu.value}
                      type="button"
                      onClick={() =>
                        handleInputChange({
                          target: { name: 'gpuModel', value: gpu.value },
                        } as React.ChangeEvent<HTMLSelectElement>)
                      }
                      className={`rounded-xl border px-4 py-3 ${isRTL ? 'text-right' : 'text-left'} transition-colors ${
                        formData.gpuModel === gpu.value
                          ? 'border-dc1-amber bg-dc1-amber/10'
                          : 'border-dc1-border bg-dc1-surface-l2 hover:border-dc1-amber/50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-dc1-text-primary">{gpu.label}</p>
                      <p className="mt-1 text-xs text-dc1-text-secondary">{gpu.helper}</p>
                    </button>
                  ))}
                </div>
                <select
                  id="gpuModel"
                  name="gpuModel"
                  value={formData.gpuModel}
                  onChange={handleInputChange}
                  className={`input ${fieldErrors.gpuModel ? 'border-red-400 focus:border-red-400' : ''}`}
                  aria-invalid={Boolean(fieldErrors.gpuModel)}
                  aria-describedby={fieldErrors.gpuModel ? 'gpuModel-error' : 'gpuModel-hint'}
                  required
                >
                  <option value="">{t('register.provider.gpu_model_placeholder')}</option>
                  <optgroup label="Consumer NVIDIA">
                    <option value="RTX 5090">RTX 5090 (32 GB) — 270 tok/s</option>
                    <option value="RTX 4090">RTX 4090 (24 GB) — 197 tok/s</option>
                    <option value="RTX 4080 SUPER">RTX 4080 SUPER (16 GB) — 139 tok/s</option>
                    <option value="RTX 4070 Ti">RTX 4070 Ti (12 GB)</option>
                    <option value="RTX 4060 Ti">RTX 4060 Ti (8 GB)</option>
                    <option value="RTX 3090">RTX 3090 (24 GB) — 172 tok/s</option>
                    <option value="RTX 3080">RTX 3080 (10 GB)</option>
                    <option value="RTX 3070">RTX 3070 (8 GB)</option>
                    <option value="RTX 3060 Ti">RTX 3060 Ti (8 GB) — 107 tok/s</option>
                  </optgroup>
                  <optgroup label="Apple Silicon (MLX)">
                    <option value="Apple M4 Max">M4 Max (48 GB unified)</option>
                    <option value="Apple M4 Pro">M4 Pro (24 GB unified)</option>
                    <option value="Apple M4">M4 (16 GB unified)</option>
                    <option value="Apple M3 Max">M3 Max (36 GB unified)</option>
                    <option value="Apple M3 Pro">M3 Pro (18 GB unified)</option>
                    <option value="Apple M3">M3 (16 GB unified)</option>
                    <option value="Apple M2 Max">M2 Max (32 GB unified)</option>
                    <option value="Apple M2 Pro">M2 Pro (16 GB unified)</option>
                    <option value="Apple M2">M2 (16 GB unified)</option>
                    <option value="Apple M1 Max">M1 Max (32 GB unified)</option>
                    <option value="Apple M1 Pro">M1 Pro (16 GB unified)</option>
                    <option value="Apple M1">M1 (16 GB unified)</option>
                  </optgroup>
                  <optgroup label="Professional / Enterprise">
                    <option value="RTX A5000">RTX A5000 (24 GB) — 137 tok/s</option>
                    <option value="RTX A6000">RTX A6000 (48 GB)</option>
                    <option value="H100">H100 (80 GB)</option>
                    <option value="H200">H200 (141 GB)</option>
                    <option value="A100">A100 (80 GB)</option>
                  </optgroup>
                  <option value="Other">Other</option>
                </select>
                {fieldErrors.gpuModel ? (
                  <p id="gpuModel-error" className="mt-2 text-sm text-red-400">{fieldErrors.gpuModel}</p>
                ) : (
                  <p id="gpuModel-hint" className="mt-2 text-xs text-dc1-text-muted">
                    {t('register.provider.gpu_model_hint')}
                  </p>
                )}
              </div>

              {/* VRAM (auto-filled from GPU model) */}
              <div>
                <label htmlFor="vram" className="label">
                  {t('register.provider.vram')}
                </label>
                <input
                  id="vram"
                  type="number"
                  name="vram"
                  value={formData.vram}
                  onChange={handleInputChange}
                  placeholder={formData.gpuModel === 'Other' ? t('register.provider.vram_placeholder_other') : t('register.provider.vram_placeholder_auto')}
                  className={`input ${fieldErrors.vram ? 'border-red-400 focus:border-red-400' : ''}`}
                  aria-invalid={Boolean(fieldErrors.vram)}
                  aria-describedby={fieldErrors.vram ? 'vram-error' : 'vram-hint'}
                  min="1"
                  max="1000"
                />
                {fieldErrors.vram ? (
                  <p id="vram-error" className="mt-2 text-sm text-red-400">{fieldErrors.vram}</p>
                ) : formData.gpuModel && formData.vram ? (
                  <p id="vram-hint" className="mt-2 text-xs text-dc1-text-muted">
                    {formData.gpuModel === 'Other' ? t('register.provider.vram_hint_other') : `${t('register.provider.vram_hint_auto_prefix')} ${formData.gpuModel}.`}
                  </p>
                ) : (
                  <p id="vram-hint" className="mt-2 text-xs text-dc1-text-muted">
                    {t('register.provider.vram_hint_default')}{' '}
                    <span className="font-semibold text-dc1-text-primary">{t('register.provider.gpu_other')}</span>.
                  </p>
                )}
              </div>

              {/* Location */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="locationCity" className="label">
                    {t('register.provider.location_city')}
                  </label>
                  <input
                    id="locationCity"
                    type="text"
                    name="locationCity"
                    value={formData.locationCity}
                    onChange={handleInputChange}
                    placeholder={t('register.provider.location_city_placeholder')}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="locationCountry" className="label">
                    {t('register.provider.location_country')}
                  </label>
                  <select
                    id="locationCountry"
                    name="locationCountry"
                    value={formData.locationCountry}
                    onChange={handleInputChange}
                    className={`input ${fieldErrors.locationCountry ? 'border-red-400 focus:border-red-400' : ''}`}
                    aria-invalid={Boolean(fieldErrors.locationCountry)}
                    aria-describedby={fieldErrors.locationCountry ? 'locationCountry-error' : 'locationCountry-hint'}
                  >
                    <option value="">{t('register.provider.location_country_placeholder')}</option>
                    <option value="SA">{t('register.provider.country.sa')}</option>
                    <option value="AE">{t('register.provider.country.ae')}</option>
                    <option value="US">{t('register.provider.country.us')}</option>
                    <option value="GB">{t('register.provider.country.gb')}</option>
                    <option value="DE">{t('register.provider.country.de')}</option>
                    <option value="FR">{t('register.provider.country.fr')}</option>
                    <option value="NL">{t('register.provider.country.nl')}</option>
                    <option value="SG">{t('register.provider.country.sg')}</option>
                    <option value="JP">{t('register.provider.country.jp')}</option>
                    <option value="Other">{t('register.provider.country.other')}</option>
                  </select>
                  {fieldErrors.locationCountry ? (
                    <p id="locationCountry-error" className="mt-2 text-sm text-red-400">{fieldErrors.locationCountry}</p>
                  ) : (
                    <p id="locationCountry-hint" className="mt-2 text-xs text-dc1-text-muted">
                      {t('register.provider.location_country_hint')}
                    </p>
                  )}
                </div>
              </div>

              {/* Operating System */}
              <div>
                <label htmlFor="operatingSystem" className="label">
                  {t('register.provider.os')}
                </label>
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { value: 'Ubuntu 22.04', label: 'Ubuntu 22.04', helper: t('register.provider.os_option.ubuntu_2204_helper') },
                    { value: 'Ubuntu 20.04', label: 'Ubuntu 20.04', helper: t('register.provider.os_option.ubuntu_2004_helper') },
                    { value: 'Windows 10/11', label: 'Windows 10/11', helper: t('register.provider.os_option.windows_helper') },
                    { value: 'Other Linux', label: 'Other Linux', helper: t('register.provider.os_option.other_linux_helper') },
                  ].map((os) => (
                    <button
                      key={os.value}
                      type="button"
                      onClick={() =>
                        handleInputChange({
                          target: { name: 'operatingSystem', value: os.value },
                        } as React.ChangeEvent<HTMLSelectElement>)
                      }
                      className={`rounded-xl border px-4 py-3 ${isRTL ? 'text-right' : 'text-left'} transition-colors ${
                        formData.operatingSystem === os.value
                          ? 'border-dc1-amber bg-dc1-amber/10'
                          : 'border-dc1-border bg-dc1-surface-l2 hover:border-dc1-amber/50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-dc1-text-primary">{os.label}</p>
                      <p className="mt-1 text-xs text-dc1-text-secondary">{os.helper}</p>
                    </button>
                  ))}
                </div>
                <select
                  id="operatingSystem"
                  name="operatingSystem"
                  value={formData.operatingSystem}
                  onChange={handleInputChange}
                  className={`input ${fieldErrors.operatingSystem ? 'border-red-400 focus:border-red-400' : ''}`}
                  aria-invalid={Boolean(fieldErrors.operatingSystem)}
                  aria-describedby={fieldErrors.operatingSystem ? 'operatingSystem-error' : 'operatingSystem-hint'}
                  required
                >
                  <option value="">{t('register.provider.os_placeholder')}</option>
                  <option value="Windows 10/11">Windows 10/11</option>
                  <option value="Ubuntu 22.04">Ubuntu 22.04</option>
                  <option value="Ubuntu 20.04">Ubuntu 20.04</option>
                  <option value="Other Linux">Other Linux</option>
                </select>
                {fieldErrors.operatingSystem ? (
                  <p id="operatingSystem-error" className="mt-2 text-sm text-red-400">{fieldErrors.operatingSystem}</p>
                ) : (
                  <p id="operatingSystem-hint" className="mt-2 text-xs text-dc1-text-muted">
                    {t('register.provider.os_hint')}
                  </p>
                )}
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
                  {t('register.provider.referral.label')} <span className="text-dc1-text-muted font-normal">{t('register.provider.phone_optional')}</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="referralCode"
                    type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder={t('register.provider.referral.placeholder')}
                  className="input flex-1"
                  disabled={referralStatus === 'applied'}
                  />
                  {referralCode && referralStatus === 'idle' && (
                    <span className="flex items-center text-xs text-dc1-text-muted px-2">{t('register.provider.referral.applied')}</span>
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
                  {t('register.provider.referral.hint')}
                </p>
              </div>

              {/* PDPL Consent */}
              <div className="p-4 rounded-lg bg-dc1-surface-l2 border border-dc1-border">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="pdplConsent"
                    checked={formData.pdplConsent}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setFormData(prev => ({ ...prev, pdplConsent: checked }))
                      if (attemptedSubmit) {
                        setFieldErrors((prev) => {
                          const next = { ...prev }
                          const message = validateField('pdplConsent', checked, { ...formData, pdplConsent: checked })
                          if (message) {
                            next.pdplConsent = message
                          } else {
                            delete next.pdplConsent
                          }
                          return next
                        })
                      }
                    }}
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
                {fieldErrors.pdplConsent && (
                  <p className="mt-3 text-sm text-red-400">{fieldErrors.pdplConsent}</p>
                )}
              </div>

              {/* Submit Button */}
              <p className="text-xs text-dc1-text-muted">
                {t('register.provider.earnings_disclaimer')}
              </p>
              {!canSubmit && (
                <div className="rounded-lg border border-dc1-border bg-dc1-surface-l2 px-4 py-3 text-sm text-dc1-text-secondary">
                  {t('register.provider.readiness.locked_hint')}
                </div>
              )}
              <button
                type="submit"
                disabled={!canSubmit}
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
                  canSubmit ? t('register.provider.submit') : t('register.provider.submit_locked')
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

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-dc1-void flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full" />
    </div>
  )
}

export default function ProviderRegisterPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProviderRegisterPageContent />
    </Suspense>
  )
}
