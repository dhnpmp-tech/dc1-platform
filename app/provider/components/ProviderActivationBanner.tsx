'use client'

import { useState } from 'react'
import ActivationWizard from './ActivationWizard'

interface ProviderActivationBannerProps {
  gpuModel?: string
  onActivated?: () => void
}

export default function ProviderActivationBanner({ gpuModel, onActivated }: ProviderActivationBannerProps) {
  const [showWizard, setShowWizard] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [activated, setActivated] = useState(false)

  if (dismissed || activated) return null

  function handleSuccess() {
    setShowWizard(false)
    setActivated(true)
    onActivated?.()
  }

  return (
    <>
      <div className="rounded-xl border border-dc1-amber/30 bg-gradient-to-r from-dc1-amber/10 to-dc1-amber/5 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              {/* Pulsing dot */}
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-dc1-amber opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-dc1-amber" />
              </span>
              <span className="text-sm font-semibold text-dc1-amber">Your GPU is registered but not active</span>
            </div>
            <p className="text-sm text-dc1-text-secondary leading-relaxed">
              Complete activation in 3 quick steps — confirm GPU specs, set your schedule, and start earning SAR.
              {gpuModel && (
                <span className="block mt-0.5 text-xs text-dc1-text-muted">
                  Detected GPU: <span className="text-dc1-text-secondary">{gpuModel}</span>
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="p-2 rounded-lg text-dc1-text-muted hover:text-dc1-text-secondary hover:bg-dc1-surface-l2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={() => setShowWizard(true)}
              className="btn btn-primary px-5 min-h-[44px] text-sm whitespace-nowrap"
            >
              Activate GPU
            </button>
          </div>
        </div>

        {/* Step preview */}
        <div className="mt-4 flex gap-3 flex-wrap">
          {[
            { n: 1, label: 'Confirm GPU specs' },
            { n: 2, label: 'Set schedule' },
            { n: 3, label: 'Set min price' },
          ].map(step => (
            <div key={step.n} className="flex items-center gap-1.5 text-xs text-dc1-text-muted">
              <span className="w-5 h-5 rounded-full bg-dc1-surface-l2 border border-dc1-border flex items-center justify-center text-[10px] font-bold text-dc1-text-muted flex-shrink-0">
                {step.n}
              </span>
              {step.label}
            </div>
          ))}
        </div>
      </div>

      {showWizard && (
        <ActivationWizard
          detectedGpuModel={gpuModel}
          onSuccess={handleSuccess}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </>
  )
}
