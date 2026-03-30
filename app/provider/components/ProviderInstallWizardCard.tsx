'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildProviderInstallCommand,
  getProviderInstallApiBase,
  type InstallTarget,
} from '../../lib/provider-install'

type ProviderLiveSnapshot = {
  status: 'online' | 'offline'
  isPaused: boolean
  approvalStatus: 'pending' | 'approved' | 'rejected'
  lastHeartbeat: string
}

type PrereqKey = 'nvidia' | 'docker' | 'python' | 'network'

interface ProviderInstallWizardCardProps {
  apiKey: string
  initialSnapshot: ProviderLiveSnapshot
}

const HEARTBEAT_FRESH_SECONDS = 90
const WIZARD_STORAGE_KEY = 'dc1_provider_install_wizard_v1'

const OS_OPTIONS: Array<{ id: InstallTarget; label: string }> = [
  { id: 'linux', label: 'Linux' },
  { id: 'windows', label: 'Windows' },
  { id: 'macos', label: 'macOS' },
]

const PREREQUISITE_LABELS: Record<PrereqKey, string> = {
  nvidia: 'NVIDIA driver installed and GPU visible in nvidia-smi',
  docker: 'Docker is installed and daemon is running',
  python: 'Python 3.10+ is installed',
  network: 'Machine can reach api.dcp.sa over HTTPS',
}

const DEFAULT_PREREQUISITES: Record<PrereqKey, boolean> = {
  nvidia: false,
  docker: false,
  python: false,
  network: false,
}

function getHeartbeatAgeSeconds(lastHeartbeat: string): number | null {
  if (!lastHeartbeat) return null
  const timestamp = Date.parse(lastHeartbeat)
  if (Number.isNaN(timestamp)) return null
  return Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
}

function formatHeartbeatAge(age: number | null): string {
  if (age === null) return 'No heartbeat yet'
  if (age < 60) return `${age}s ago`
  const mins = Math.floor(age / 60)
  return `${mins}m ago`
}

function StatusPill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
        ok
          ? 'border-status-success/40 bg-status-success/15 text-status-success'
          : 'border-status-warning/40 bg-status-warning/15 text-status-warning'
      }`}
    >
      {text}
    </span>
  )
}

export default function ProviderInstallWizardCard({ apiKey, initialSnapshot }: ProviderInstallWizardCardProps) {
  const [selectedOs, setSelectedOs] = useState<InstallTarget>('linux')
  const [copied, setCopied] = useState(false)
  const [liveSnapshot, setLiveSnapshot] = useState<ProviderLiveSnapshot>(initialSnapshot)
  const [pollError, setPollError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('')
  const [prerequisites, setPrerequisites] = useState<Record<PrereqKey, boolean>>(DEFAULT_PREREQUISITES)

  const installApiBase = useMemo(() => getProviderInstallApiBase(), [])

  const installCommand = useMemo(
    () => buildProviderInstallCommand(selectedOs, installApiBase, apiKey),
    [apiKey, installApiBase, selectedOs]
  )

  const heartbeatAge = getHeartbeatAgeSeconds(liveSnapshot.lastHeartbeat)
  const heartbeatFresh = heartbeatAge !== null && heartbeatAge <= HEARTBEAT_FRESH_SECONDS
  const heartbeatDetected = heartbeatAge !== null
  const prerequisitesComplete = Object.values(prerequisites).every(Boolean)

  const readinessChecks = [
    {
      id: 'approval',
      label: 'Provider approval completed',
      ok: liveSnapshot.approvalStatus === 'approved',
      detail: liveSnapshot.approvalStatus === 'approved' ? 'Approved' : `Status: ${liveSnapshot.approvalStatus}`,
    },
    {
      id: 'heartbeat',
      label: 'Daemon heartbeat received',
      ok: heartbeatDetected,
      detail: formatHeartbeatAge(heartbeatAge),
    },
    {
      id: 'heartbeat-fresh',
      label: 'Heartbeat freshness (< 90s)',
      ok: heartbeatFresh,
      detail: formatHeartbeatAge(heartbeatAge),
    },
    {
      id: 'provider-online',
      label: 'Provider status online',
      ok: liveSnapshot.status === 'online',
      detail: `Status: ${liveSnapshot.status}`,
    },
    {
      id: 'provider-unpaused',
      label: 'Provider is not paused',
      ok: !liveSnapshot.isPaused,
      detail: liveSnapshot.isPaused ? 'Paused' : 'Active',
    },
  ]

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { selectedOs?: InstallTarget; prerequisites?: Partial<Record<PrereqKey, boolean>> }

      if (saved?.selectedOs && OS_OPTIONS.some((option) => option.id === saved.selectedOs)) {
        setSelectedOs(saved.selectedOs)
      }

      if (saved?.prerequisites) {
        setPrerequisites({
          ...DEFAULT_PREREQUISITES,
          ...saved.prerequisites,
        })
      }
    } catch {
      // Ignore malformed persisted state and continue with defaults.
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      WIZARD_STORAGE_KEY,
      JSON.stringify({
        selectedOs,
        prerequisites,
      })
    )
  }, [prerequisites, selectedOs])

  useEffect(() => {
    if (!apiKey) return

    let cancelled = false
    const API_BASE = '/api/dc1'

    const pollLiveStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/providers/me?key=${encodeURIComponent(apiKey)}`, {
          cache: 'no-store',
        })

        if (!res.ok) {
          throw new Error(`status ${res.status}`)
        }

        const data = await res.json()
        const provider = data?.provider || {}

        if (!cancelled) {
          setLiveSnapshot({
            status: provider.status === 'online' || provider.status === 'idle' ? 'online' : 'offline',
            isPaused: Boolean(provider.is_paused),
            approvalStatus: provider.approval_status || 'pending',
            lastHeartbeat: provider.last_heartbeat || '',
          })
          setPollError('')
          setLastUpdatedAt(new Date().toISOString())
        }
      } catch {
        if (!cancelled) {
          setPollError('Unable to refresh live readiness right now. Retrying...')
        }
      }
    }

    pollLiveStatus()
    const interval = setInterval(pollLiveStatus, 10000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [apiKey])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    setCopied(false)
  }, [selectedOs])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(installCommand)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const togglePrerequisite = (key: PrereqKey) => {
    setPrerequisites((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleResetChecklist = () => {
    setPrerequisites(DEFAULT_PREREQUISITES)
  }

  return (
    <section className="rounded-2xl border border-dc1-amber/25 bg-dc1-surface-l2 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-dc1-amber font-semibold mb-1">Provider Install Wizard</p>
          <h2 className="text-lg sm:text-xl font-bold text-dc1-text-primary">One-command setup with live readiness checks</h2>
          <p className="text-sm text-dc1-text-secondary mt-1">
            Complete prerequisites, run the OS command, and watch readiness update automatically from daemon heartbeat state.
          </p>
        </div>
        <StatusPill ok={readinessChecks.every((item) => item.ok)} text={readinessChecks.every((item) => item.ok) ? 'Ready for jobs' : 'Setup in progress'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc1-text-muted mb-3">1) Validate prerequisites</p>
          <div className="space-y-2.5">
            {(Object.keys(PREREQUISITE_LABELS) as PrereqKey[]).map((key) => (
              <label key={key} className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prerequisites[key]}
                  onChange={() => togglePrerequisite(key)}
                  className="mt-0.5 h-4 w-4 rounded border-dc1-border bg-dc1-surface-l2 text-dc1-amber focus:ring-dc1-amber"
                />
                <span className="text-sm text-dc1-text-secondary">{PREREQUISITE_LABELS[key]}</span>
              </label>
            ))}
          </div>
          <p className="text-xs mt-3 text-dc1-text-muted">
            {prerequisitesComplete ? 'All prerequisites confirmed.' : 'Confirm all four items before running installer.'}
          </p>
          <button
            type="button"
            onClick={handleResetChecklist}
            className="mt-3 rounded-lg border border-dc1-border px-3 py-1.5 text-xs font-medium text-dc1-text-secondary hover:text-dc1-text-primary min-h-[34px]"
          >
            Reset checklist
          </button>
        </div>

        <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-4 xl:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc1-text-muted mb-3">2) Copy your exact install command</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {OS_OPTIONS.map((os) => (
              <button
                key={os.id}
                type="button"
                onClick={() => setSelectedOs(os.id)}
                className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors min-h-[40px] ${
                  selectedOs === os.id
                    ? 'border-dc1-amber bg-dc1-amber/20 text-dc1-amber'
                    : 'border-dc1-border bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary'
                }`}
              >
                {os.label}
              </button>
            ))}
          </div>

          <pre className="overflow-x-auto rounded-lg border border-dc1-border bg-dc1-surface-l2 p-3 text-xs sm:text-sm text-dc1-text-primary font-mono leading-relaxed">
            <code>{installCommand}</code>
          </pre>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg bg-dc1-amber px-4 py-2 text-sm font-semibold text-dc1-void hover:brightness-110 min-h-[40px]"
            >
              {copied ? 'Copied command' : 'Copy command'}
            </button>
            <span className="text-xs text-dc1-text-muted">
              Uses canonical route: <code className="font-mono">/api/providers/download/setup?key=...&os=...</code>
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-4 mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc1-text-muted">3) Live readiness checklist (auto-refresh every 10s)</p>
          <span className="text-xs text-dc1-text-muted">
            {lastUpdatedAt ? `Last update: ${new Date(lastUpdatedAt).toLocaleTimeString()}` : 'Awaiting first refresh...'}
          </span>
        </div>

        {pollError && <p className="text-xs text-status-warning mb-2">{pollError}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {readinessChecks.map((check) => (
            <div key={check.id} className="rounded-lg border border-dc1-border bg-dc1-surface-l2 px-3 py-2.5 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-dc1-text-primary">{check.label}</p>
                <p className="text-xs text-dc1-text-muted mt-0.5">{check.detail}</p>
              </div>
              <span className={`text-sm font-semibold ${check.ok ? 'text-status-success' : 'text-status-warning'}`}>
                {check.ok ? 'Pass' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
