'use client'

import { useState } from 'react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'

const DAEMON_VERSION = 'v3.4.0'

type OS = 'windows' | 'linux' | 'macos'

const OS_CARDS: {
  id: OS
  label: string
  icon: string
  downloadType: 'exe' | 'curl'
  primaryLabel: string
  primaryAction: string
  command?: string
}[] = [
  {
    id: 'windows',
    label: 'Windows',
    icon: '⊞',
    downloadType: 'exe',
    primaryLabel: 'Download Installer (.exe)',
    primaryAction: '/api/dc1/providers/daemon/windows',
  },
  {
    id: 'linux',
    label: 'Linux',
    icon: '🐧',
    downloadType: 'curl',
    primaryLabel: 'Copy Install Command',
    primaryAction: 'curl -sSL https://dcp.sa/api/dc1/providers/daemon/linux | bash',
    command: 'curl -sSL https://dcp.sa/api/dc1/providers/daemon/linux | bash',
  },
  {
    id: 'macos',
    label: 'macOS',
    icon: '',
    downloadType: 'curl',
    primaryLabel: 'Copy Install Command',
    primaryAction: 'curl -sSL https://dcp.sa/install-mac.sh | bash',
    command: 'curl -sSL https://dcp.sa/install-mac.sh | bash',
  },
]

const REQUIREMENTS = [
  { icon: '🎮', label: 'NVIDIA GPU', detail: 'RTX 2060 or better (8 GB+ VRAM)' },
  { icon: '🐳', label: 'Docker', detail: 'Docker Desktop (Windows/macOS) or Docker Engine (Linux)' },
  { icon: '🐍', label: 'Python 3.10+', detail: 'Python 3.10 or newer' },
  { icon: '💻', label: 'Operating System', detail: 'Windows 10/11 or Ubuntu 20.04+' },
]

export default function ProviderDownloadPage() {
  const [copied, setCopied] = useState<OS | null>(null)

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
            Current version: {DAEMON_VERSION}
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#F0F0F0' }}>
            DCP Provider Daemon
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: '#94A3B8' }}>
            Install the daemon on your GPU machine to start earning SAR from compute jobs on the DCP marketplace.
          </p>
        </div>

        {/* OS Cards */}
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
              {card.command && (
                <div
                  className="rounded-lg px-3 py-3 font-mono text-xs break-all"
                  style={{ background: '#07070E', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {card.command}
                </div>
              )}

              {/* CTA */}
              {card.downloadType === 'exe' ? (
                <a
                  href={card.primaryAction}
                  download
                  className="mt-auto text-center py-2.5 px-4 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
                  style={{ background: '#F5A524', color: '#07070E' }}
                >
                  {card.primaryLabel}
                </a>
              ) : (
                <button
                  onClick={() => handleCopy(card.id, card.command!)}
                  className="mt-auto py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors"
                  style={{
                    background: copied === card.id ? 'rgba(34,197,94,0.15)' : 'rgba(245,165,36,0.12)',
                    color: copied === card.id ? '#22C55E' : '#F5A524',
                    border: copied === card.id ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(245,165,36,0.25)',
                  }}
                  aria-label={`Copy install command for ${card.label}`}
                >
                  {copied === card.id ? '✓ Copied!' : card.primaryLabel}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* System Requirements */}
        <section aria-labelledby="requirements-heading" className="mb-14">
          <h2
            id="requirements-heading"
            className="text-xl font-semibold mb-6"
            style={{ color: '#F0F0F0' }}
          >
            System Requirements
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
            <p className="font-semibold text-sm mb-1" style={{ color: '#F5A524' }}>Need help getting started?</p>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              Our setup guide walks you through installation, daemon configuration, and your first compute job.
            </p>
          </div>
          <a
            href="/support"
            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: '#F5A524', color: '#07070E' }}
          >
            Get Support
          </a>
        </div>
      </main>

      <Footer />
    </div>
  )
}
