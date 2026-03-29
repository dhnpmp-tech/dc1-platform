'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildProviderInstallCommand, getProviderInstallApiBase, InstallTarget, normalizeProviderOs } from '../../lib/provider-install'

// ── Pricing data (March 2026, from docs/FOUNDER-STRATEGIC-BRIEF.md) ──────────
interface GpuSpec {
  model: string
  vram: string
  vramGb: number
  dcpFloor: number        // $/hr
  vastTypical: number     // $/hr, for discount display
  tdpW: number           // typical TDP in watts
}

const GPU_SPECS: GpuSpec[] = [
  { model: 'RTX 3090',  vram: '24 GB', vramGb: 24, dcpFloor: 0.105, vastTypical: 0.17, tdpW: 350 },
  { model: 'RTX 4080',  vram: '16 GB', vramGb: 16, dcpFloor: 0.131, vastTypical: 0.19, tdpW: 320 },
  { model: 'RTX 4090',  vram: '24 GB', vramGb: 24, dcpFloor: 0.267, vastTypical: 0.35, tdpW: 450 },
  { model: 'RTX 5090',  vram: '32 GB', vramGb: 32, dcpFloor: 0.394, vastTypical: 0.50, tdpW: 575 },
  { model: 'A100 SXM',  vram: '80 GB', vramGb: 80, dcpFloor: 0.786, vastTypical: 0.86, tdpW: 400 },
  { model: 'H100 SXM',  vram: '80 GB', vramGb: 80, dcpFloor: 1.421, vastTypical: 1.55, tdpW: 700 },
]

interface RegionRate {
  label: string
  ratePerKwh: number  // USD/kWh
}

const REGION_RATES: RegionRate[] = [
  { label: 'Saudi Arabia (CCSEZ)', ratePerKwh: 0.014 },
  { label: 'Saudi Arabia (Industrial)', ratePerKwh: 0.019 },
  { label: 'USA',                  ratePerKwh: 0.076 },
  { label: 'EU Average',           ratePerKwh: 0.178 },
  { label: 'United Kingdom',       ratePerKwh: 0.293 },
]

type Platform = InstallTarget

// ── Component ─────────────────────────────────────────────────────────────────
interface ProviderRegistrationWizardProps {
  /** Called after wizard completes (provider registered + daemon command shown) */
  onComplete?: (providerId: string) => void
}

interface GpuFormState {
  model: string
  gpuCount: number
  hoursPerDay: number
  regionLabel: string
}

interface RegistrationFormState {
  fullName: string
  email: string
  phone: string
  referralCode: string
  pdplConsent: boolean
}

const REGION_COUNTRY_CODE: Record<string, string> = {
  'Saudi Arabia (CCSEZ)': 'SA',
  'Saudi Arabia (Industrial)': 'SA',
  'USA': 'US',
  'EU Average': 'DE',
  'United Kingdom': 'GB',
}

export default function ProviderRegistrationWizard({ onComplete }: ProviderRegistrationWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1 state
  const [gpuForm, setGpuForm] = useState<GpuFormState>({
    model: 'RTX 4090',
    gpuCount: 1,
    hoursPerDay: 16,
    regionLabel: 'USA',
  })

  // Step 3 state
  const [regForm, setRegForm] = useState<RegistrationFormState>({
    fullName: '',
    email: '',
    phone: '',
    referralCode: '',
    pdplConsent: false,
  })
  const [referralStatus, setReferralStatus] = useState<'idle' | 'applied' | 'error'>('idle')
  const [referralMessage, setReferralMessage] = useState('')
  const [platform, setPlatform] = useState<Platform>('linux')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [providerId, setProviderId] = useState('')
  const [copied, setCopied] = useState(false)

  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current) }, [])

  // ── Derived earnings data ──────────────────────────────────────────────────
  const earnings = useMemo(() => {
    const gpu = GPU_SPECS.find(g => g.model === gpuForm.model) ?? GPU_SPECS[2]
    const region = REGION_RATES.find(r => r.label === gpuForm.regionLabel) ?? REGION_RATES[2]
    const UTILIZATION = 0.70
    const hoursPerMonth = gpuForm.hoursPerDay * 30
    const totalGpus = gpuForm.gpuCount

    const monthlyRevenue = gpu.dcpFloor * hoursPerMonth * totalGpus * UTILIZATION
    const kWhPerMonth = (gpu.tdpW / 1000) * hoursPerMonth * totalGpus
    const monthlyElecCost = kWhPerMonth * region.ratePerKwh
    const monthlyProfit = monthlyRevenue - monthlyElecCost
    const discount = Math.round((1 - gpu.dcpFloor / gpu.vastTypical) * 100)

    return {
      gpu,
      region,
      monthlyRevenue,
      monthlyElecCost,
      monthlyProfit,
      discount,
      annualProfit: monthlyProfit * 12,
    }
  }, [gpuForm])

  // ── Install command ────────────────────────────────────────────────────────
  const installCommand = useMemo(() => {
    if (!apiKey) return ''
    return buildProviderInstallCommand(platform, getProviderInstallApiBase(), apiKey)
  }, [apiKey, platform])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleGpuFormChange = useCallback(
    (field: keyof GpuFormState, value: string | number) => {
      setGpuForm(prev => ({ ...prev, [field]: value }))
    },
    [],
  )

  const handleRegFormChange = useCallback(
    (field: keyof RegistrationFormState, value: string | boolean) => {
      setRegForm(prev => ({ ...prev, [field]: value }))
    },
    [],
  )

  const handleRegSubmit = useCallback(async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const selectedGpu = GPU_SPECS.find(g => g.model === gpuForm.model) ?? GPU_SPECS[2]
      const countryCode = REGION_COUNTRY_CODE[gpuForm.regionLabel] ?? 'US'
      const res = await fetch('/api/dc1/providers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regForm.fullName,
          email: regForm.email,
          phone: regForm.phone || undefined,
          gpu_model: selectedGpu.model,
          vram_gb: selectedGpu.vramGb,
          location_country: countryCode,
          os: normalizeProviderOs(platform),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `Registration failed (${res.status})`)
      }
      const data = await res.json() as { apiKey?: string; api_key?: string; providerId?: string; provider_id?: string }
      const key = data.apiKey ?? data.api_key ?? ''
      const pid = data.providerId ?? data.provider_id ?? ''
      setApiKey(key)
      setProviderId(pid)

      // Apply referral code if provided
      if (regForm.referralCode.trim()) {
        try {
          const refRes = await fetch('/api/dc1/providers/apply-referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referral_code: regForm.referralCode.trim(),
              new_provider_id: data.providerId ?? data.provider_id,
            }),
          })
          if (refRes.ok) {
            const refData = await refRes.json() as { referrer_name: string; bonus_pct: number; duration_days: number }
            setReferralStatus('applied')
            setReferralMessage(`Referred by ${refData.referrer_name} — ${refData.bonus_pct}% bonus for ${refData.duration_days} days!`)
          } else {
            setReferralStatus('error')
            const refErr = await refRes.json().catch(() => ({})) as { error?: string }
            setReferralMessage(refErr.error || 'Could not apply referral code')
          }
        } catch {
          // Non-blocking — registration itself succeeded
        }
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [gpuForm, regForm, platform])

  const copyCommand = useCallback(async () => {
    if (!installCommand) return
    try {
      await navigator.clipboard.writeText(installCommand)
      setCopied(true)
      copiedTimer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }, [installCommand])

  const handleFinish = useCallback(() => {
    onComplete?.(providerId)
  }, [onComplete, providerId])

  // ── Progress bar ───────────────────────────────────────────────────────────
  const progressPct = ((step - 1) / 2) * 100 + 50 / 2 // rough centre-step feel: 25%, 50%, 100%
  const pct = step === 1 ? 33 : step === 2 ? 66 : 100

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-dc1-text-primary">
            {step === 1 && 'Step 1 of 3 — GPU Specifications'}
            {step === 2 && 'Step 2 of 3 — Earnings Preview'}
            {step === 3 && 'Step 3 of 3 — Connect Your GPU'}
          </span>
          <span className="text-dc1-text-muted">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-dc1-surface-l3">
          <div
            className="h-full rounded-full bg-dc1-amber transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Step 1 — GPU specs */}
      {step === 1 && (
        <div className="rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-6 shadow-lg space-y-5">
          <div>
            <h2 className="text-xl font-bold text-dc1-text-primary">Tell us about your GPU</h2>
            <p className="mt-1 text-sm text-dc1-text-secondary">
              We&apos;ll calculate your estimated monthly earnings before you sign up.
            </p>
          </div>

          {/* GPU model */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-dc1-text-secondary">GPU Model</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {GPU_SPECS.map(g => (
                <button
                  key={g.model}
                  type="button"
                  onClick={() => handleGpuFormChange('model', g.model)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    gpuForm.model === g.model
                      ? 'border-dc1-amber bg-dc1-amber/10 text-dc1-amber'
                      : 'border-dc1-border bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary hover:border-dc1-border-light'
                  }`}
                >
                  <span className="block font-semibold">{g.model}</span>
                  <span className="block text-xs opacity-70">{g.vram} VRAM</span>
                </button>
              ))}
            </div>
          </div>

          {/* GPU count */}
          <div className="space-y-1.5">
            <label htmlFor="gpu-count" className="block text-sm font-medium text-dc1-text-secondary">
              Number of GPUs
            </label>
            <input
              id="gpu-count"
              type="number"
              min={1}
              max={32}
              value={gpuForm.gpuCount}
              onChange={e => handleGpuFormChange('gpuCount', Math.max(1, Math.min(32, parseInt(e.target.value, 10) || 1)))}
              className="input w-32"
            />
          </div>

          {/* Hours per day */}
          <div className="space-y-1.5">
            <label htmlFor="hours-day" className="block text-sm font-medium text-dc1-text-secondary">
              Available hours / day
              <span className="ml-2 font-normal text-dc1-text-muted">(how long can you leave this running?)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                id="hours-day"
                type="range"
                min={1}
                max={24}
                value={gpuForm.hoursPerDay}
                onChange={e => handleGpuFormChange('hoursPerDay', parseInt(e.target.value, 10))}
                className="h-2 w-full cursor-pointer accent-dc1-amber"
              />
              <span className="w-16 shrink-0 rounded-lg border border-dc1-border bg-dc1-surface-l2 px-2 py-1 text-center text-sm font-semibold text-dc1-amber">
                {gpuForm.hoursPerDay}h
              </span>
            </div>
          </div>

          {/* Region */}
          <div className="space-y-1.5">
            <label htmlFor="region" className="block text-sm font-medium text-dc1-text-secondary">
              Your region
              <span className="ml-2 font-normal text-dc1-text-muted">(sets electricity cost)</span>
            </label>
            <select
              id="region"
              value={gpuForm.regionLabel}
              onChange={e => handleGpuFormChange('regionLabel', e.target.value)}
              className="input w-full sm:w-64"
            >
              {REGION_RATES.map(r => (
                <option key={r.label} value={r.label}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="btn-primary px-6 py-2.5"
            >
              See my earnings →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Earnings calculator */}
      {step === 2 && (
        <div className="rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-6 shadow-lg space-y-5">
          <div>
            <h2 className="text-xl font-bold text-dc1-text-primary">Your estimated earnings</h2>
            <p className="mt-1 text-sm text-dc1-text-secondary">
              Based on {gpuForm.gpuCount}× {gpuForm.model} · {gpuForm.hoursPerDay}h/day · 70% utilization · {gpuForm.regionLabel}
            </p>
          </div>

          {/* Headline profit */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-status-success/30 bg-status-success/10 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-status-success/70">Monthly Profit</p>
              <p className="mt-1 text-3xl font-bold text-status-success">
                ${Math.round(earnings.monthlyProfit).toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-dc1-text-muted">after electricity</p>
            </div>
            <div className="rounded-xl border border-dc1-amber/30 bg-dc1-amber/10 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-dc1-amber/70">Monthly Revenue</p>
              <p className="mt-1 text-3xl font-bold text-dc1-amber">
                ${Math.round(earnings.monthlyRevenue).toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-dc1-text-muted">gross (70% util)</p>
            </div>
            <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-dc1-text-muted">Annual Profit</p>
              <p className="mt-1 text-3xl font-bold text-dc1-text-primary">
                ${Math.round(earnings.annualProfit).toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-dc1-text-muted">projected</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-dc1-text-muted">Monthly Breakdown</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-dc1-text-secondary">DCP floor price</span>
                <span className="font-semibold text-dc1-amber">${earnings.gpu.dcpFloor.toFixed(3)}/hr</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dc1-text-secondary">Vs. Vast.ai</span>
                <span className="font-semibold text-status-success">−{earnings.discount}% cheaper for renters</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dc1-text-secondary">Electricity cost</span>
                <span className="text-dc1-text-primary">−${Math.round(earnings.monthlyElecCost)}/mo</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dc1-text-secondary">Electricity rate</span>
                <span className="text-dc1-text-muted">${earnings.region.ratePerKwh.toFixed(3)}/kWh</span>
              </div>
            </div>
          </div>

          {/* GPU count adjuster */}
          <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-dc1-text-muted">Adjust GPU count</p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => handleGpuFormChange('gpuCount', Math.max(1, gpuForm.gpuCount - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-dc1-border bg-dc1-surface-l3 text-dc1-text-primary hover:border-dc1-border-light"
              >
                −
              </button>
              <span className="w-20 text-center text-lg font-bold text-dc1-text-primary">
                {gpuForm.gpuCount} GPU{gpuForm.gpuCount !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => handleGpuFormChange('gpuCount', Math.min(32, gpuForm.gpuCount + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-dc1-border bg-dc1-surface-l3 text-dc1-text-primary hover:border-dc1-border-light"
              >
                +
              </button>
            </div>
          </div>

          <p className="text-xs text-dc1-text-muted">
            ⚠️ Projections based on 70% utilization at current DCP floor prices. Actual earnings depend on market demand.
          </p>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-secondary px-4 py-2"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="btn-primary px-6 py-2.5"
            >
              Connect my GPU →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Registration + connection */}
      {step === 3 && (
        <div className="rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-6 shadow-lg space-y-5">
          {!apiKey ? (
            <>
              <div>
                <h2 className="text-xl font-bold text-dc1-text-primary">Create your provider account</h2>
                <p className="mt-1 text-sm text-dc1-text-secondary">
                  Register to get your API key and daemon install command.
                </p>
              </div>

              {/* Earnings recap */}
              <div className="flex items-center gap-3 rounded-xl border border-dc1-amber/30 bg-dc1-amber/10 px-4 py-3">
                <span className="text-dc1-amber text-lg">💰</span>
                <span className="text-sm text-dc1-text-primary">
                  Your {gpuForm.gpuCount}× <strong>{gpuForm.model}</strong> could earn{' '}
                  <strong className="text-status-success">${Math.round(earnings.monthlyProfit).toLocaleString()}/mo</strong>
                </span>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="full-name" className="label">Full name</label>
                  <input
                    id="full-name"
                    type="text"
                    placeholder="Ahmed Al-Rashid"
                    value={regForm.fullName}
                    onChange={e => handleRegFormChange('fullName', e.target.value)}
                    className="input w-full"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="label">Email address</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={regForm.email}
                    onChange={e => handleRegFormChange('email', e.target.value)}
                    className="input w-full"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="label">
                    Phone number <span className="text-dc1-text-muted font-normal">(optional)</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="+966 5x xxx xxxx"
                    value={regForm.phone}
                    onChange={e => handleRegFormChange('phone', e.target.value)}
                    className="input w-full"
                    autoComplete="tel"
                  />
                </div>

                {/* Platform picker */}
                <div className="space-y-1.5">
                  <label className="label">Operating system</label>
                  <div className="flex gap-2">
                    {(['linux', 'windows', 'macos'] as Platform[]).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlatform(p)}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors capitalize ${
                          platform === p
                            ? 'border-dc1-amber bg-dc1-amber/10 text-dc1-amber'
                            : 'border-dc1-border bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary'
                        }`}
                      >
                        {p === 'macos' ? 'macOS' : p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Referral code */}
                <div className="space-y-1.5">
                  <label htmlFor="referral-code" className="label">
                    Referral Code <span className="text-dc1-text-muted font-normal">(optional)</span>
                  </label>
                  <input
                    id="referral-code"
                    type="text"
                    value={regForm.referralCode}
                    onChange={e => handleRegFormChange('referralCode', e.target.value.toUpperCase())}
                    placeholder="e.g. DCP-ABC123"
                    className="input w-full"
                    disabled={referralStatus === 'applied'}
                  />
                  {referralStatus === 'applied' && (
                    <p className="text-sm text-status-success">{referralMessage}</p>
                  )}
                  {referralStatus === 'error' && (
                    <p className="text-sm text-red-400">{referralMessage}</p>
                  )}
                  <p className="text-xs text-dc1-text-muted">
                    Have a referral code? Both you and the referrer earn bonus rewards.
                  </p>
                </div>

                {/* PDPL consent */}
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={regForm.pdplConsent}
                    onChange={e => handleRegFormChange('pdplConsent', e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-dc1-amber"
                  />
                  <span className="text-sm text-dc1-text-secondary">
                    I agree to the{' '}
                    <a href="/terms" className="text-dc1-amber hover:underline" target="_blank" rel="noreferrer">
                      Terms of Service
                    </a>{' '}
                    and consent to personal data processing under PDPL.
                  </span>
                </label>
              </div>

              {submitError && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                  {submitError}
                </p>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-secondary px-4 py-2"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={
                    submitting ||
                    !regForm.fullName.trim() ||
                    !regForm.email.trim() ||
                    !regForm.pdplConsent
                  }
                  onClick={handleRegSubmit}
                  className="btn-primary px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Registering…
                    </span>
                  ) : (
                    'Register & get API key'
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Post-registration: show install command */
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl border border-status-success/40 bg-status-success/10 px-4 py-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-success text-xs font-bold text-black">✓</span>
                <span className="text-sm font-semibold text-status-success">Account created — you&apos;re registered!</span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-dc1-text-primary">Install the DCP daemon</h2>
                <p className="mt-1 text-sm text-dc1-text-secondary">
                  Run this command on your machine to connect your GPU to the network.
                </p>
              </div>

              {/* API key */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-dc1-text-muted">Your API Key</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded-lg border border-dc1-border bg-dc1-surface-l2 px-4 py-2.5 text-sm text-dc1-amber font-mono break-all">
                    {apiKey}
                  </code>
                </div>
                <p className="text-xs text-dc1-text-muted">Keep this safe — it authenticates your provider node.</p>
              </div>

              {/* Platform picker */}
              <div className="flex gap-2">
                {(['linux', 'windows', 'macos'] as Platform[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      platform === p
                        ? 'border-dc1-amber bg-dc1-amber/10 text-dc1-amber'
                        : 'border-dc1-border bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary'
                    }`}
                  >
                    {p === 'macos' ? 'macOS' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>

              {/* Install command */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-dc1-text-muted">Install Command</p>
                <div className="rounded-lg border border-dc1-border bg-dc1-surface-l2 p-4">
                  <code className="block whitespace-pre-wrap break-all text-sm text-dc1-text-primary font-mono">
                    {installCommand}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={copyCommand}
                  className="btn-secondary px-4 py-2 text-sm"
                >
                  {copied ? '✓ Copied!' : 'Copy command'}
                </button>
              </div>

              {/* Next steps */}
              <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4 space-y-2">
                <p className="text-sm font-semibold text-dc1-text-primary">Next steps</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-dc1-text-secondary">
                  <li>Run the install command on your machine</li>
                  <li>The daemon will connect automatically</li>
                  <li>Visit your <a href="/provider/dashboard" className="text-dc1-amber hover:underline">provider dashboard</a> to track earnings</li>
                </ol>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleFinish}
                  className="btn-primary px-6 py-2.5"
                >
                  Go to dashboard →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
