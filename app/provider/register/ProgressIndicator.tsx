'use client'

import { useLanguage } from '../../lib/i18n'

interface ProgressIndicatorProps {
  currentStep?: 1 | 2 | 3
}

const STEPS = [
  { id: 1, titleKey: 'register.provider.progress.step_1.title', descriptionKey: 'register.provider.progress.step_1.description' },
  { id: 2, titleKey: 'register.provider.progress.step_2.title', descriptionKey: 'register.provider.progress.step_2.description' },
  { id: 3, titleKey: 'register.provider.progress.step_3.title', descriptionKey: 'register.provider.progress.step_3.description' },
] as const

export default function ProgressIndicator({ currentStep = 1 }: ProgressIndicatorProps) {
  const { t, isRTL } = useLanguage()

  return (
    <div className={`mb-8 rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-5 sm:p-6 ${isRTL ? 'text-right' : 'text-left'}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dc1-text-muted">
        {t('register.provider.progress.title')}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step) => {
          const isComplete = currentStep > step.id
          const isCurrent = currentStep === step.id
          const markerClass = isComplete
            ? 'bg-status-success text-black'
            : isCurrent
              ? 'bg-dc1-amber text-black'
              : 'bg-dc1-surface-l3 text-dc1-text-muted'
          const cardClass = isComplete
            ? 'border-status-success/40 bg-status-success/10'
            : isCurrent
              ? 'border-dc1-amber/50 bg-dc1-amber/10'
              : 'border-dc1-border bg-dc1-surface-l2'

          return (
            <div key={step.id} className={`rounded-xl border p-4 transition-colors ${cardClass}`}>
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${markerClass}`}>
                  {isComplete ? '✓' : step.id}
                </span>
                <div>
                  <p className="text-sm font-semibold text-dc1-text-primary">{t(step.titleKey)}</p>
                  <p className="text-xs text-dc1-text-secondary">{t(step.descriptionKey)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
