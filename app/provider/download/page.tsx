'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import { useLanguage } from '../../lib/i18n'
import {
  buildProviderInstallCommand,
  buildProviderTroubleshootingHref,
  getProviderInstallApiBase,
  ProviderNextActionState,
} from '../../lib/provider-install'

const DAEMON_VERSION = 'v3.3.0'

type OS = 'windows' | 'linux' | 'macos'

const OS_CARDS: {
  id: OS
  label: string
  icon: string
  primaryLabel: string
  description: string
}[] = [
  {
    id: 'windows',
    label: 'Windows',
    icon: '⊞',
    primaryLabel: 'Copy Install Command',
    description: 'PowerShell setup script with your provider API key.',
  },
  {
    id: 'linux',
    label: 'Linux',
    icon: '🐧',
    primaryLabel: 'Copy Install Command',
    description: 'Shell installer using the canonical providers/download/setup route.',
  },
  {
    id: 'macos',
    label: 'macOS',
    icon: '🍎',
    primaryLabel: 'Copy Install Command',
    description: 'Uses the same injected setup endpoint with macOS target.',
  },
]

const REQUIREMENTS = [
  { icon: '🎮', label: 'NVIDIA GPU', detail: 'RTX 2060 or better (8 GB+ VRAM)' },
  { icon: '🐳', label: 'Docker', detail: 'Docker Desktop (Windows/macOS) or Docker Engine (Linux)' },
  { icon: '🐍', label: 'Python 3.10+', detail: 'Python 3.10 or newer' },
  { icon: '💻', label: 'Operating System', detail: 'Windows 10/11 or Ubuntu 20.04+' },
]

export default function ProviderDownloadPage() {
  const { t } = useLanguage()
  const [copied, setCopied] = useState<OS | null>(null)
  const [providerKey, setProviderKey] = useState('')
  const [nextActionState, setNextActionState] = useState<ProviderNextActionState>('waiting')
  const installApiBase = useMemo(() => getProviderInstallApiBase(), [])
  const installCommands: Record<OS, string> = useMemo(
    () => ({
      windows: buildProviderInstallCommand('windows', installApiBase, providerKey),
      linux: buildProviderInstallCommand('linux', installApiBase, providerKey),
      macos: buildProviderInstallCommand('macos', installApiBase, providerKey),
    }),
    [installApiBase, providerKey]
  )
  const nextActionMap: Record<
    ProviderNextActionState,
    { label: string; desc: string; cta: string; href: string }
  > = {
    waiting: {
      label: t('register.provider.state.waiting.label'),
      desc: t('register.provider.state.waiting.desc'),
      cta: t('register.provider.state.waiting.cta'),
      href: '/docs/provider-guide',
    },
    heartbeat: {
      label: t('register.provider.state.heartbeat.label'),
      desc: t('register.provider.state.heartbeat.desc'),
      cta: t('register.provider.state.heartbeat.cta'),
      href: '/provider',
    },
    ready: {
      label: t('register.provider.state.ready.label'),
      desc: t('register.provider.state.ready.desc'),
      cta: t('register.provider.state.ready.cta'),
      href: '/provider',
    },
    paused: {
      label: t('register.provider.state.paused.label'),
      desc: t('register.provider.state.paused.desc'),
      cta: t('register.provider.state.paused.cta'),
      href: '/provider',
    },
    stale: {
      label: t('register.provider.state.stale.label'),
      desc: t('register.provider.state.stale.desc'),
      cta: t('register.provider.state.stale.cta'),
      href: '/docs/provider-guide',
    },
  }
  const nextAction = nextActionMap[nextActionState]
  const troubleshootingHref = buildProviderTroubleshootingHref(nextActionState)
  const stateOptions: ProviderNextActionState[] = ['waiting', 'heartbeat', 'ready', 'paused', 'stale']

  async function handleCopy(os: OS, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(os)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // fallback: select text
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#07070E', color: '#F0F0F0' }}>
      <Header />

      <main className="flex-1 px-4 py-16 max-w-4xl mx-auto w-full">
        {/* Hero */}
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
            style={{ background: 'rgba(245,165,36,0.12)', color: '#F5A524', border: '1px solid rgba(245,165,36,0.25)' }}
          >
            {t('provider.download.current_version')} {DAEMON_VERSION}
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#F0F0F0' }}>
            {t('provider.download.title')}
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: '#94A3B8' }}>
            {t('provider.download.subtitle')}
          </p>
          <p className="text-sm max-w-2xl mx-auto mt-3" style={{ color: '#94A3B8' }}>
            {t('provider.trust.runtime')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 text-left">
            <div className="rounded-lg p-3" style={{ background: 'rgba(245,165,36,0.08)', border: '1px solid rgba(245,165,36,0.22)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#F5A524' }}>{t('landing.diff_energy_title')}</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>{t('landing.diff_energy_desc')}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(245,165,36,0.08)', border: '1px solid rgba(245,165,36,0.22)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#F5A524' }}>{t('landing.diff_models_title')}</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>{t('landing.diff_models_desc')}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(245,165,36,0.08)', border: '1px solid rgba(245,165,36,0.22)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#F5A524' }}>{t('landing.diff_container_title')}</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>{t('landing.diff_container_desc')}</p>
            </div>
          </div>
        </div>

        {/* OS Cards */}
        <section className="mb-8">
          <div className="rounded-xl p-5" style={{ background: '#0D0D1A', border: '1px solid rgba(245,165,36,0.22)' }}>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#F0F0F0' }}>
              Provider API Key
            </label>
            <input
              value={providerKey}
              onChange={(event) => setProviderKey(event.target.value)}
              placeholder="dc1-provider-..."
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: '#07070E', color: '#F0F0F0', border: '1px solid rgba(255,255,255,0.12)' }}
            />
            <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
              Commands below are generated from canonical `/api/providers/download/setup` routes.
            </p>
          </div>
        </section>

        <section className="mb-8">
          <div className="rounded-xl p-5" style={{ background: '#0D0D1A', border: '1px solid rgba(245,165,36,0.22)' }}>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#F0F0F0' }}>
              {t('provider.download.state_selector_label')}
            </label>
            <select
              value={nextActionState}
              onChange={(event) => setNextActionState(event.target.value as ProviderNextActionState)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: '#07070E', color: '#F0F0F0', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {stateOptions.map((state) => (
                <option key={state} value={state}>
                  {nextActionMap[state].label}
                </option>
              ))}
            </select>
            <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
              {t('provider.download.state_selector_hint')}
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
          {OS_CARDS.map((card) => (
            <div
              key={card.id}
              className="rounded-xl p-6 flex flex-col gap-5"
              style={{
                background: '#0D0D1A',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-3">
                <span className="text-2xl" role="img" aria-hidden="true">{card.icon}</span>
                <span className="text-lg font-semibold" style={{ color: '#F0F0F0' }}>{card.label}</span>
              </div>

              {/* Command block (curl only) */}
              <div
                className="rounded-lg px-3 py-3 font-mono text-xs break-all"
                style={{ background: '#07070E', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {installCommands[card.id]}
              </div>
              <p className="text-xs" style={{ color: '#94A3B8' }}>{card.description}</p>

              {/* CTA */}
                <button
                  onClick={() => handleCopy(card.id, installCommands[card.id])}
                  className="mt-auto py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors"
                  style={{
                    background: copied === card.id ? 'rgba(34,197,94,0.15)' : 'rgba(245,165,36,0.12)',
                    color: copied === card.id ? '#22C55E' : '#F5A524',
                    border: copied === card.id ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(245,165,36,0.25)',
                  }}
                  aria-label={`Copy install command for ${card.label}`}
                >
                  {copied === card.id ? t('provider.download.copied') : card.primaryLabel}
                </button>
            </div>
          ))}
        </div>

        <div className="mb-14">
          <a
            href="/api/dc1/providers/download-windows-exe"
            download
            className="inline-flex px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: 'rgba(245,165,36,0.12)', color: '#F5A524', border: '1px solid rgba(245,165,36,0.25)' }}
          >
            Download Generic Windows Installer (.exe)
          </a>
        </div>

        <section className="mb-14">
          <div className="rounded-xl p-6" style={{ background: 'rgba(245,165,36,0.08)', border: '1px solid rgba(245,165,36,0.22)' }}>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#F0F0F0' }}>
              {t('billing.explainer.title')}
            </h2>
            <ul className="space-y-2 text-sm" style={{ color: '#94A3B8' }}>
              <li>{t('billing.explainer.step1')}</li>
              <li>{t('billing.explainer.step2')}</li>
              <li>{t('billing.explainer.step3')}</li>
            </ul>
            <p className="mt-3 text-xs" style={{ color: '#64748B' }}>{t('billing.explainer.note')}</p>
            <p className="mt-2 text-xs" style={{ color: '#64748B' }}>{t('billing.explainer.rail_status')}</p>
          </div>
        </section>

        <section className="mb-14">
          <div className="rounded-xl p-6" style={{ background: '#0D0D1A', border: '1px solid rgba(245,165,36,0.22)' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#F5A524' }}>{t('register.provider.next_action_title')}</p>
            <div className="rounded-lg border p-4" style={{ borderColor: 'rgba(245,165,36,0.3)', background: 'rgba(245,165,36,0.12)' }}>
              <p className="text-sm font-semibold" style={{ color: '#F5A524' }}>{nextAction.label}</p>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{nextAction.desc}</p>
              <Link
                href={nextAction.href}
                className="inline-flex mt-3 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(245,165,36,0.18)', color: '#F5A524', border: '1px solid rgba(245,165,36,0.35)' }}
              >
                {nextAction.cta}
              </Link>
              <Link
                href={troubleshootingHref}
                className="inline-flex mt-3 ms-0 sm:ms-3 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(148,163,184,0.12)', color: '#CBD5E1', border: '1px solid rgba(148,163,184,0.35)' }}
              >
                {t('register.provider.status_matrix.guide_cta')}
              </Link>
            </div>
          </div>
        </section>

        {/* System Requirements */}
        <section aria-labelledby="requirements-heading" className="mb-14">
          <h2
            id="requirements-heading"
            className="text-xl font-semibold mb-6"
            style={{ color: '#F0F0F0' }}
          >
            {t('provider.download.requirements')}
          </h2>
          <div
            className="rounded-xl divide-y"
            style={{ background: '#0D0D1A', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {REQUIREMENTS.map((req) => (
              <div
                key={req.label}
                className="flex items-start gap-4 px-6 py-4"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="text-xl flex-shrink-0 mt-0.5" role="img" aria-hidden="true">{req.icon}</span>
                <div>
                  <p className="font-medium text-sm mb-0.5" style={{ color: '#F0F0F0' }}>{req.label}</p>
                  <p className="text-sm" style={{ color: '#64748B' }}>{req.detail}</p>
                </div>
                <span
                  className="ml-auto flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}
                  aria-hidden="true"
                >
                  ✓
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Help */}
        <div
          className="rounded-xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{ background: 'rgba(245,165,36,0.06)', border: '1px solid rgba(245,165,36,0.18)' }}
        >
          <div>
            <p className="font-semibold text-sm mb-1" style={{ color: '#F5A524' }}>{t('provider.download.help_title')}</p>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              {t('provider.download.help_desc')}
            </p>
          </div>
          <a
            href="/support"
            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: '#F5A524', color: '#07070E' }}
          >
            {t('provider.download.get_support')}
          </a>
        </div>
      </main>

      <Footer />
    </div>
  )
}
