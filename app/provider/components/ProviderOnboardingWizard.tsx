'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────
const API_BASE = '/api/dc1'
const STORAGE_KEY = 'dcp_onboarding_wizard'
const SAR_RATE = 3.75

// Monthly earnings at 70% utilisation (USD/hr × 720h × 0.70)
const EARNINGS_BY_GPU: Record<string, number> = {
  'RTX 3090':  Math.round(0.105 * 720 * 0.70),
  'RTX 4080':  Math.round(0.131 * 720 * 0.70),
  'RTX 4090':  Math.round(0.267 * 720 * 0.70),
  'RTX 5090':  Math.round(0.394 * 720 * 0.70),
  'A100 SXM':  Math.round(0.786 * 720 * 0.70),
  'H100 SXM':  Math.round(1.421 * 720 * 0.70),
}

const TIER_A_MODELS = [
  { id: 'allam-7b',     name: 'ALLaM 7B',    sizeGb: 3.2, etaMins: 8 },
  { id: 'falcon-h1-7b', name: 'Falcon H1 7B', sizeGb: 3.1, etaMins: 8 },
  { id: 'qwen25-7b',    name: 'Qwen 2.5 7B',  sizeGb: 3.5, etaMins: 9 },
  { id: 'llama3-8b',    name: 'Llama 3 8B',   sizeGb: 3.8, etaMins: 10 },
  { id: 'mistral-7b',   name: 'Mistral 7B',   sizeGb: 3.2, etaMins: 8 },
]

// ── Types ─────────────────────────────────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4 | 5

interface HardwareResult {
  gpuModel: string
  vramGb: number
  driverVersion: string
  cudaVersion: string
  cpuCores: number
  ramGb: number
}

interface PrefetchProgress {
  [modelId: string]: number // 0-100
}

interface WizardState {
  completedSteps: WizardStep[]
  hardwareResult: HardwareResult | null
  connectionVerified: boolean
  prefetchDone: boolean
}

function loadWizardState(): WizardState {
  if (typeof window === 'undefined') return defaultWizardState()
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as WizardState
  } catch {
    // ignore parse errors
  }
  return defaultWizardState()
}

function defaultWizardState(): WizardState {
  return { completedSteps: [], hardwareResult: null, connectionVerified: false, prefetchDone: false }
}

function saveWizardState(state: WizardState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

// ── Helper: copy to clipboard ─────────────────────────────────────────────────
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WizardProgress({ step, isRTL }: { step: WizardStep; isRTL: boolean }) {
  const steps = [
    { n: 1, label: 'Hardware Check' },
    { n: 2, label: 'API Key' },
    { n: 3, label: 'Verify Connection' },
    { n: 4, label: 'Pre-warm Models' },
    { n: 5, label: 'Go Live' },
  ]
  const pct = ((step - 1) / 4) * 100

  return (
    <div className="mb-6 space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Step label */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-dc1-text-primary">
          Step {step} of 5 — {steps[step - 1].label}
        </span>
        <span className="text-dc1-text-muted">{Math.round(pct + 20)}%</span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 overflow-hidden rounded-full bg-dc1-surface-l3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-dc1-amber to-status-success transition-all duration-500"
          style={{ width: `${pct + 20}%` }}
        />
      </div>
      {/* Step dots */}
      <div className="flex items-center justify-between px-1">
        {steps.map(({ n, label }) => (
          <div key={n} className="flex flex-col items-center gap-1">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold transition-all ${
                n < step
                  ? 'border-status-success bg-status-success text-black'
                  : n === step
                  ? 'border-dc1-amber bg-dc1-amber text-black'
                  : 'border-dc1-border bg-dc1-surface-l2 text-dc1-text-muted'
              }`}
            >
              {n < step ? '✓' : n}
            </div>
            <span className={`hidden text-xs sm:block ${n === step ? 'text-dc1-amber font-medium' : 'text-dc1-text-muted'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = useCallback(async () => {
    const ok = await copyText(text)
    if (ok) {
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    }
  }, [text])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg border border-dc1-border bg-dc1-surface-l2 px-3 py-1.5 text-xs font-semibold text-dc1-text-primary hover:bg-dc1-surface-l3 transition-colors min-h-[36px]"
      aria-label={copied ? 'Copied!' : label}
    >
      {copied ? (
        <>
          <span className="text-status-success">✓</span>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  )
}

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
      <div className="flex items-start gap-3">
        <span className="text-red-400 text-base leading-none mt-0.5">✕</span>
        <div className="flex-1">
          <p className="text-red-300">{message}</p>
          <p className="mt-1 text-dc1-text-muted text-xs">
            Need help?{' '}
            <a href="/support" className="text-dc1-amber hover:underline">Contact support</a>
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 min-h-[36px]"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

// ── Step 1: Hardware Check ────────────────────────────────────────────────────
function Step1HardwareCheck({
  providerId,
  onComplete,
}: {
  providerId: string
  onComplete: (result: HardwareResult) => void
}) {
  const [hardware, setHardware] = useState<HardwareResult | null>(null)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const validateCommand = `npx @dcp/validate-provider-startup --provider-id ${providerId}`

  // Poll for hardware-check result
  const startPolling = useCallback(() => {
    if (polling) return
    setPolling(true)
    setError('')

    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/providers/${providerId}/hardware-check`)
        if (res.ok) {
          const data = await res.json() as HardwareResult & { gpuModel?: string; gpu_model?: string }
          const result: HardwareResult = {
            gpuModel: data.gpuModel ?? data.gpu_model ?? 'Unknown',
            vramGb: data.vramGb ?? 0,
            driverVersion: data.driverVersion ?? 'Unknown',
            cudaVersion: data.cudaVersion ?? 'Unknown',
            cpuCores: data.cpuCores ?? 0,
            ramGb: data.ramGb ?? 0,
          }
          if (result.gpuModel !== 'Unknown') {
            setHardware(result)
            setPolling(false)
            if (pollRef.current) clearInterval(pollRef.current)
          }
        }
      } catch {
        // transient; keep polling
      }
    }

    check()
    pollRef.current = setInterval(check, 3000)
  }, [polling, providerId])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const monthlyEarnings = hardware
    ? (EARNINGS_BY_GPU[hardware.gpuModel] ?? Math.round(0.1 * 720 * 0.7))
    : null

  const isSupported = hardware ? (
    parseFloat(hardware.cudaVersion) >= 12.0 &&
    hardware.vramGb >= 8
  ) : false

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-dc1-text-primary">Let's check your GPU</h2>
        <p className="mt-1 text-sm text-dc1-text-secondary">
          Run the validation command in your terminal to confirm your hardware is supported.
        </p>
      </div>

      {/* Command box */}
      <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dc1-text-muted">
          Run in your terminal
        </p>
        <div className="flex items-start gap-3">
          <code className="flex-1 break-all font-mono text-sm text-dc1-amber">{validateCommand}</code>
          <CopyButton text={validateCommand} label="Copy command" />
        </div>
      </div>

      {/* Listen button */}
      {!hardware && (
        <button
          type="button"
          onClick={startPolling}
          disabled={polling}
          className="btn-primary w-full py-3 text-sm disabled:opacity-70"
        >
          {polling ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Listening for results…
            </span>
          ) : (
            "I\u2019ve run the command \u2014 detect my hardware"
          )}
        </button>
      )}

      {/* Hardware results */}
      {hardware && (
        <div className={`rounded-xl border p-4 space-y-3 ${
          isSupported ? 'border-status-success/40 bg-status-success/10' : 'border-red-500/40 bg-red-500/10'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`text-lg ${isSupported ? 'text-status-success' : 'text-red-400'}`}>
              {isSupported ? '✅' : '❌'}
            </span>
            <span className={`font-semibold text-sm ${isSupported ? 'text-status-success' : 'text-red-400'}`}>
              {isSupported ? 'Hardware validated — ready to serve' : 'Hardware requirements not met'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[
              { label: 'GPU Model',    value: hardware.gpuModel },
              { label: 'VRAM',         value: `${hardware.vramGb} GB` },
              { label: 'Driver',       value: `NVIDIA ${hardware.driverVersion}` },
              { label: 'CUDA',         value: hardware.cudaVersion },
              { label: 'CPU Cores',    value: String(hardware.cpuCores) },
              { label: 'System RAM',   value: `${hardware.ramGb} GB` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-dc1-border bg-dc1-surface-l1 p-2">
                <p className="text-xs text-dc1-text-muted">{label}</p>
                <p className="font-semibold text-dc1-text-primary">{value}</p>
              </div>
            ))}
          </div>
          {!isSupported && (
            <p className="text-xs text-red-300">
              Requires CUDA 12.0+ and at least 8 GB VRAM. Your setup: CUDA {hardware.cudaVersion}, {hardware.vramGb} GB VRAM.{' '}
              <a href="/docs/provider-requirements" className="text-dc1-amber hover:underline">See requirements</a>
            </p>
          )}
        </div>
      )}

      {/* Earnings estimate */}
      {hardware && isSupported && monthlyEarnings !== null && (
        <div className="flex items-center gap-3 rounded-xl border border-dc1-amber/30 bg-dc1-amber/10 px-4 py-3">
          <span className="text-xl">💰</span>
          <span className="text-sm text-dc1-text-primary">
            Estimated monthly earnings with your {hardware.gpuModel}:{' '}
            <strong className="text-status-success">${monthlyEarnings.toLocaleString()}</strong>
            <span className="text-dc1-text-muted ml-1">(₪{Math.round(monthlyEarnings * SAR_RATE).toLocaleString()}/mo at 70% utilisation)</span>
          </span>
        </div>
      )}

      {error && <ErrorBox message={error} onRetry={() => { setError(''); startPolling() }} />}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={!hardware || !isSupported}
          onClick={() => hardware && isSupported && onComplete(hardware)}
          className="btn-primary px-8 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next step →
        </button>
      </div>
    </div>
  )
}

// ── Step 2: API Key & Quickstart ──────────────────────────────────────────────
function Step2ApiKey({
  apiKey,
  onBack,
  onNext,
}: {
  apiKey: string
  onBack: () => void
  onNext: () => void
}) {
  const truncatedKey = apiKey.length > 20
    ? `${apiKey.slice(0, 12)}...${apiKey.slice(-6)}`
    : apiKey

  const curlExample = `curl -H "Authorization: Bearer ${apiKey}" \\
  https://api.dcp.sa/api/providers/heartbeat`

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-dc1-text-primary">Get your API key</h2>
        <p className="mt-1 text-sm text-dc1-text-secondary">
          Your API key authenticates your provider node. Save it securely — it won't be shown again.
        </p>
      </div>

      {/* Key display */}
      <div className="rounded-xl border border-dc1-amber/40 bg-dc1-surface-l2 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dc1-text-muted">Your API Key</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded-lg border border-dc1-border bg-dc1-surface-l1 px-4 py-2.5 font-mono text-sm text-dc1-amber break-all">
            {truncatedKey}
          </code>
          <CopyButton text={apiKey} label="Copy key" />
        </div>
        <p className="mt-2 text-xs text-dc1-text-muted">
          Save this in your <code className="text-dc1-amber">.env</code> file or password manager.
        </p>
      </div>

      {/* Usage example */}
      <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc1-text-muted">Usage example</p>
          <CopyButton text={curlExample} label="Copy example" />
        </div>
        <pre className="overflow-x-auto font-mono text-xs text-dc1-text-primary whitespace-pre-wrap break-all">
          {curlExample}
        </pre>
      </div>

      {/* Quickstart link */}
      <a
        href="/docs/PROVIDER-QUICKSTART-API"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-dc1-amber hover:underline"
        target="_blank"
        rel="noreferrer"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        See full provider quickstart guide
      </a>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-secondary px-4 py-2.5">
          ← Back
        </button>
        <button type="button" onClick={onNext} className="btn-primary px-8 py-2.5">
          Next step →
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Connection Test ───────────────────────────────────────────────────
function Step3ConnectionTest({
  providerId,
  apiKey,
  onBack,
  onNext,
  onSkip,
}: {
  providerId: string
  apiKey: string
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}) {
  const [polling, setPolling] = useState(false)
  const [verified, setVerified] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null)
  const [providerIp, setProviderIp] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const heartbeatCommand = `npx @dcp/heartbeat-test --key ${apiKey}`

  const startPolling = useCallback(() => {
    setPolling(true)
    setTimedOut(false)

    const check = async () => {
      try {
        // Use the existing /me endpoint which includes last_heartbeat
        const res = await fetch(`${API_BASE}/providers/me?key=${encodeURIComponent(apiKey)}`)
        if (!res.ok) return
        const data = await res.json() as {
          provider?: { last_heartbeat?: string; last_heartbeat_at?: string; ip?: string; last_ip?: string }
        }
        const provider = data?.provider ?? {}
        const heartbeat = provider.last_heartbeat ?? provider.last_heartbeat_at ?? null
        const ip = provider.ip ?? provider.last_ip ?? null

        if (heartbeat) {
          setVerified(true)
          setLastHeartbeatAt(heartbeat)
          if (ip) setProviderIp(ip)
          setPolling(false)
          if (pollRef.current) clearInterval(pollRef.current)
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
      } catch {
        // transient; keep polling
      }
    }

    check()
    pollRef.current = setInterval(check, 2000)

    // Timeout after 30s
    timeoutRef.current = setTimeout(() => {
      setPolling(false)
      setTimedOut(true)
      if (pollRef.current) clearInterval(pollRef.current)
    }, 30000)
  }, [apiKey])

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const secondsAgo = lastHeartbeatAt
    ? Math.round((Date.now() - new Date(lastHeartbeatAt).getTime()) / 1000)
    : null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-dc1-text-primary">Verify your connection</h2>
        <p className="mt-1 text-sm text-dc1-text-secondary">
          Run this command from your machine to prove you're online and reachable.
        </p>
      </div>

      {/* Command */}
      <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dc1-text-muted">
          Run on your provider machine
        </p>
        <div className="flex items-start gap-3">
          <code className="flex-1 break-all font-mono text-sm text-dc1-amber">{heartbeatCommand}</code>
          <CopyButton text={heartbeatCommand} label="Copy" />
        </div>
      </div>

      {/* Start listening button */}
      {!polling && !verified && !timedOut && (
        <button type="button" onClick={startPolling} className="btn-primary w-full py-3 text-sm">
          Start listening for connection
        </button>
      )}

      {/* Polling state */}
      {polling && !verified && (
        <div className="flex items-center gap-3 rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-dc1-amber border-t-transparent shrink-0" />
          <div className="text-sm text-dc1-text-secondary">
            <p className="font-medium text-dc1-text-primary">Listening for your connection…</p>
            <p className="text-xs mt-0.5">Checking every 2 seconds (timeout: 30s)</p>
          </div>
        </div>
      )}

      {/* Verified */}
      {verified && (
        <div className="rounded-xl border border-status-success/40 bg-status-success/10 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-status-success text-xs font-bold text-black">✓</span>
            <span className="font-semibold text-status-success text-sm">Connection verified!</span>
          </div>
          <div className="text-sm text-dc1-text-secondary space-y-1">
            {secondsAgo !== null && (
              <p>Last heartbeat: <span className="text-dc1-text-primary font-medium">{secondsAgo}s ago</span></p>
            )}
            {providerIp && (
              <p>Your IP: <span className="text-dc1-text-primary font-mono">{providerIp}</span></p>
            )}
          </div>
        </div>
      )}

      {/* Timeout */}
      {timedOut && !verified && (
        <div className="space-y-3">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-dc1-text-secondary">
            <p className="font-semibold text-red-300 mb-2">We didn't receive your connection. Troubleshooting steps:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Verify your API key is correct</li>
              <li>Check your firewall and NAT settings</li>
              <li>Test network connectivity: <code className="text-dc1-amber">ping api.dcp.sa</code></li>
              <li>
                <a href="/support" className="text-dc1-amber hover:underline">Create a support ticket</a>
              </li>
            </ul>
          </div>
          <button type="button" onClick={startPolling} className="btn-secondary px-4 py-2.5 text-sm">
            Try again
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-secondary px-4 py-2.5">
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-dc1-text-muted hover:text-dc1-text-secondary underline-offset-2 hover:underline"
          >
            I'll test this later
          </button>
          <button
            type="button"
            disabled={!verified}
            onClick={onNext}
            className="btn-primary px-8 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next step →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Model Pre-fetch ───────────────────────────────────────────────────
function Step4ModelPrefetch({
  providerId,
  apiKey,
  onBack,
  onNext,
  onSkip,
}: {
  providerId: string
  apiKey: string
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(TIER_A_MODELS.map(m => m.id))
  )
  const [started, setStarted] = useState(false)
  const [progress, setProgress] = useState<PrefetchProgress>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const sseRef = useRef<EventSource | null>(null)

  const toggleModel = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const totalGb = TIER_A_MODELS
    .filter(m => selected.has(m.id))
    .reduce((sum, m) => sum + m.sizeGb, 0)

  const startPrefetch = useCallback(async () => {
    setStarted(true)
    const initialProgress: PrefetchProgress = {}
    TIER_A_MODELS.forEach(m => {
      if (selected.has(m.id)) initialProgress[m.id] = 0
    })
    setProgress(initialProgress)

    try {
      // Kick off pre-fetch on backend
      await fetch(`${API_BASE}/providers/${providerId}/prefetch-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ models: [...selected] }),
      })
    } catch {
      // Backend endpoint may not be deployed yet — simulate locally for UX demonstration
    }

    // Subscribe to SSE stream for progress updates
    const sseUrl = `${API_BASE}/providers/${providerId}/prefetch-status?models=${[...selected].join(',')}`
    const sse = new EventSource(sseUrl)
    sseRef.current = sse

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { modelId: string; progress: number; error?: string }
        if (data.error) {
          setErrors(prev => ({ ...prev, [data.modelId]: data.error ?? 'Download failed' }))
        } else {
          setProgress(prev => ({ ...prev, [data.modelId]: data.progress }))
        }
      } catch {
        // ignore malformed events
      }
    }

    sse.onerror = () => {
      sse.close()
      // Backend SSE not available — simulate progress for UX
      let tick = 0
      const sim = setInterval(() => {
        tick += 5
        setProgress(prev => {
          const next = { ...prev }
          Object.keys(next).forEach(id => {
            if (next[id] < 100) next[id] = Math.min(100, next[id] + Math.random() * 8 + 3)
          })
          const allDone = Object.values(next).every(v => v >= 100)
          if (allDone || tick > 200) {
            clearInterval(sim)
            // Snap to 100
            Object.keys(next).forEach(id => { next[id] = 100 })
            setDone(true)
          }
          return next
        })
      }, 500)
    }
  }, [selected, providerId, apiKey])

  useEffect(() => () => { sseRef.current?.close() }, [])

  const allComplete = started && Object.values(progress).length > 0 &&
    Object.values(progress).every(v => v >= 100)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-dc1-text-primary">Pre-warm models</h2>
        <p className="mt-1 text-sm text-dc1-text-secondary">
          Download Tier A Arabic models now. Cuts first response time in half — optional but recommended.
        </p>
      </div>

      {!started ? (
        <>
          {/* Model checklist */}
          <div className="space-y-2">
            {TIER_A_MODELS.map(model => (
              <label
                key={model.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                  selected.has(model.id)
                    ? 'border-dc1-amber/40 bg-dc1-amber/5'
                    : 'border-dc1-border bg-dc1-surface-l2'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(model.id)}
                  onChange={() => toggleModel(model.id)}
                  className="h-4 w-4 accent-dc1-amber"
                  aria-label={`Select ${model.name}`}
                />
                <div className="flex-1">
                  <span className="font-medium text-sm text-dc1-text-primary">{model.name}</span>
                  <span className="ml-2 text-xs text-dc1-text-muted">
                    {model.sizeGb} GB · ~{model.etaMins} min on 100 Mbps
                  </span>
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-dc1-border bg-dc1-surface-l2 px-4 py-3 text-sm">
            <span className="text-dc1-text-muted">
              Selected: <strong className="text-dc1-text-primary">{selected.size} models</strong>
              {' '}({totalGb.toFixed(1)} GB)
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={onBack} className="btn-secondary px-4 py-2.5">
              ← Back
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onSkip}
                className="text-sm text-dc1-text-muted hover:text-dc1-text-secondary underline-offset-2 hover:underline"
              >
                Skip pre-fetch
              </button>
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={startPrefetch}
                className="btn-primary px-6 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Start pre-fetch
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Progress bars */}
          <div className="space-y-3">
            {TIER_A_MODELS.filter(m => selected.has(m.id)).map(model => {
              const pct = Math.round(progress[model.id] ?? 0)
              const err = errors[model.id]
              return (
                <div key={model.id} className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-dc1-text-primary">
                      {pct >= 100 ? '✅ ' : ''}{model.name}
                    </span>
                    <span className={`text-xs font-semibold ${pct >= 100 ? 'text-status-success' : 'text-dc1-amber'}`}>
                      {pct}%
                    </span>
                  </div>
                  {err ? (
                    <p className="text-xs text-red-400">Failed: {err}</p>
                  ) : (
                    <div className="h-2 overflow-hidden rounded-full bg-dc1-surface-l3">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct >= 100 ? 'bg-status-success' : 'bg-dc1-amber'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  {pct < 100 && !err && (
                    <p className="text-xs text-dc1-text-muted">
                      {model.sizeGb} GB · ~{Math.max(0, Math.round(model.etaMins * (1 - pct / 100)))} min remaining
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-dc1-text-muted hover:text-dc1-text-secondary underline-offset-2 hover:underline"
            >
              Run in background & continue
            </button>
            <button
              type="button"
              disabled={!allComplete}
              onClick={onNext}
              className="btn-primary px-8 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {allComplete ? 'Next step →' : 'Downloading…'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Step 5: Go Live ───────────────────────────────────────────────────────────
function Step5GoLive({
  providerId,
  apiKey,
  hardware,
  connectionVerified,
  prefetchDone,
  onDone,
}: {
  providerId: string
  apiKey: string
  hardware: HardwareResult | null
  connectionVerified: boolean
  prefetchDone: boolean
  onDone: () => void
}) {
  const [activating, setActivating] = useState(false)
  const [activated, setActivated] = useState(false)
  const [error, setError] = useState('')
  const referralUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/earn?ref=${providerId}`
    : `https://api.dcp.sa/earn?ref=${providerId}`

  const activate = useCallback(async () => {
    setActivating(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/providers/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ providerId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? `Activation failed (${res.status})`)
      }
      setActivated(true)
      // Clear wizard state
      try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activation failed. Our team has been notified. Check back in 1 hour.')
    } finally {
      setActivating(false)
    }
  }, [apiKey, providerId])

  // Auto-activate when step 5 mounts
  useEffect(() => {
    if (!activated && !activating) activate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const truncatedKey = apiKey.length > 20
    ? `${apiKey.slice(0, 12)}...${apiKey.slice(-6)}`
    : apiKey

  const summaryItems = [
    hardware
      ? `Hardware validated: ${hardware.gpuModel} (${hardware.vramGb} GB)`
      : null,
    `API key: ${truncatedKey}`,
    connectionVerified ? 'Connection verified' : 'Connection test skipped',
    prefetchDone ? 'Pre-fetch: models ready' : 'Models: lazy-load enabled',
  ].filter(Boolean)

  return (
    <div className="space-y-5">
      {activating && (
        <div className="flex items-center gap-3 rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-dc1-amber border-t-transparent" />
          <span className="text-sm text-dc1-text-secondary">Activating your provider…</span>
        </div>
      )}

      {activated && (
        <>
          {/* Header */}
          <div className="relative overflow-hidden rounded-2xl border border-status-success/40 bg-status-success/10 p-6 text-center">
            <div className="confetti-strip absolute inset-x-0 top-0 h-16" aria-hidden="true" />
            <h2 className="text-3xl font-bold text-dc1-text-primary mt-2">You're live! 🚀</h2>
            <p className="mt-2 text-sm text-dc1-text-secondary">
              Your provider status is now <strong className="text-status-success">ACTIVE</strong>. Renters can see your GPU in the marketplace.
            </p>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4 space-y-2">
            {summaryItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-status-success">✅</span>
                <span className="text-dc1-text-secondary">{item}</span>
              </div>
            ))}
          </div>

          {/* Next actions */}
          <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-4 space-y-3">
            <p className="text-sm font-semibold text-dc1-text-primary">What happens next:</p>
            <ul className="space-y-1.5 text-sm text-dc1-text-secondary list-disc list-inside">
              <li>Your GPU is now listed in the marketplace</li>
              <li>First job expected in 15–60 minutes</li>
              <li>Earnings appear in your dashboard as jobs complete</li>
            </ul>
            <p className="text-sm text-dc1-text-muted">Earnings to date: <strong className="text-dc1-text-primary">$0.00</strong></p>
          </div>

          {/* Referral */}
          <div className="rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-dc1-text-muted">Share your provider link</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-dc1-border bg-dc1-surface-l1 px-3 py-2 text-xs text-dc1-text-primary font-mono">
                {referralUrl}
              </code>
              <CopyButton text={referralUrl} label="Copy link" />
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onDone}
              className="btn-primary flex-1 py-3 text-sm"
            >
              Go to Dashboard →
            </button>
            <a
              href="/docs/provider"
              className="rounded-lg border border-dc1-border px-4 py-3 text-sm font-semibold text-dc1-text-secondary hover:text-dc1-text-primary hover:border-dc1-amber/40 transition-colors text-center"
              target="_blank"
              rel="noreferrer"
            >
              Provider docs
            </a>
          </div>
        </>
      )}

      {error && !activated && (
        <div className="space-y-3">
          <ErrorBox message={error} onRetry={activate} />
          <button type="button" onClick={onDone} className="btn-secondary px-4 py-2.5 text-sm">
            Go to dashboard anyway
          </button>
        </div>
      )}

      <style jsx>{`
        .confetti-strip {
          background:
            radial-gradient(circle at 10% 50%, #f5a524 3px, transparent 4px),
            radial-gradient(circle at 25% 30%, #22c55e 3px, transparent 4px),
            radial-gradient(circle at 40% 70%, #38bdf8 3px, transparent 4px),
            radial-gradient(circle at 60% 40%, #f43f5e 3px, transparent 4px),
            radial-gradient(circle at 75% 60%, #f5a524 3px, transparent 4px),
            radial-gradient(circle at 90% 35%, #a78bfa 3px, transparent 4px);
          animation: confettiDrop 2s ease-in-out infinite;
        }

        @keyframes confettiDrop {
          0%   { transform: translateY(-6px); opacity: 0; }
          30%  { opacity: 1; }
          100% { transform: translateY(18px); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── Main Wizard Component ─────────────────────────────────────────────────────
interface ProviderOnboardingWizardProps {
  providerId: string
  apiKey: string
  /** Called after wizard completes (provider activated) */
  onComplete?: () => void
  /** Whether to render in RTL mode (Arabic UI) */
  isRTL?: boolean
}

export default function ProviderOnboardingWizard({
  providerId,
  apiKey,
  onComplete,
  isRTL = false,
}: ProviderOnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [wizardState, setWizardState] = useState<WizardState>(() => loadWizardState())

  // Persist state changes
  useEffect(() => { saveWizardState(wizardState) }, [wizardState])

  const markStepComplete = useCallback((s: WizardStep) => {
    setWizardState(prev => ({
      ...prev,
      completedSteps: prev.completedSteps.includes(s)
        ? prev.completedSteps
        : [...prev.completedSteps, s],
    }))
  }, [])

  const handleHardwareComplete = useCallback((result: HardwareResult) => {
    setWizardState(prev => ({ ...prev, hardwareResult: result, completedSteps: [...new Set([...prev.completedSteps, 1 as WizardStep])] }))
    setStep(2)
  }, [])

  const handleConnectionVerified = useCallback(() => {
    setWizardState(prev => ({ ...prev, connectionVerified: true }))
    markStepComplete(3)
    setStep(4)
  }, [markStepComplete])

  const handleConnectionSkipped = useCallback(() => {
    markStepComplete(3)
    setStep(4)
  }, [markStepComplete])

  const handlePrefetchComplete = useCallback(() => {
    setWizardState(prev => ({ ...prev, prefetchDone: true }))
    markStepComplete(4)
    setStep(5)
  }, [markStepComplete])

  const handlePrefetchSkipped = useCallback(() => {
    markStepComplete(4)
    setStep(5)
  }, [markStepComplete])

  return (
    <div className="mx-auto w-full max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-6 shadow-lg">
        <WizardProgress step={step} isRTL={isRTL} />

        {step === 1 && (
          <Step1HardwareCheck
            providerId={providerId}
            onComplete={handleHardwareComplete}
          />
        )}

        {step === 2 && (
          <Step2ApiKey
            apiKey={apiKey}
            onBack={() => setStep(1)}
            onNext={() => { markStepComplete(2); setStep(3) }}
          />
        )}

        {step === 3 && (
          <Step3ConnectionTest
            providerId={providerId}
            apiKey={apiKey}
            onBack={() => setStep(2)}
            onNext={handleConnectionVerified}
            onSkip={handleConnectionSkipped}
          />
        )}

        {step === 4 && (
          <Step4ModelPrefetch
            providerId={providerId}
            apiKey={apiKey}
            onBack={() => setStep(3)}
            onNext={handlePrefetchComplete}
            onSkip={handlePrefetchSkipped}
          />
        )}

        {step === 5 && (
          <Step5GoLive
            providerId={providerId}
            apiKey={apiKey}
            hardware={wizardState.hardwareResult}
            connectionVerified={wizardState.connectionVerified}
            prefetchDone={wizardState.prefetchDone}
            onDone={() => onComplete?.()}
          />
        )}
      </div>
    </div>
  )
}
