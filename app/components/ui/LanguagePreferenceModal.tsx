'use client'

import { useEffect, useState } from 'react'
import { Language, useLanguage } from '../../lib/i18n'

const PREF_SEEN_KEY = 'dc1_lang_pref_seen'

function trackAnalytics(event: string, props: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dc1_analytics', { detail: { event, ...props } }))
  }
}

interface LanguagePreferenceModalProps {
  /** If true, skip the first-visit gate and always show (e.g. for settings). */
  forceShow?: boolean
  onDismiss?: () => void
}

export default function LanguagePreferenceModal({ forceShow, onDismiss }: LanguagePreferenceModalProps) {
  const { language, setLanguage } = useLanguage()
  const [visible, setVisible] = useState(false)
  const [selected, setSelected] = useState<Language>(language)

  useEffect(() => {
    if (forceShow) {
      setSelected(language)
      setVisible(true)
      return
    }
    if (typeof window === 'undefined') return
    const seen = localStorage.getItem(PREF_SEEN_KEY)
    if (!seen) {
      // Small delay so the page loads before the modal appears
      const timer = setTimeout(() => {
        setSelected(language)
        setVisible(true)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [forceShow, language])

  function confirm() {
    setLanguage(selected)
    localStorage.setItem(PREF_SEEN_KEY, '1')
    trackAnalytics('language_selected', { language: selected, source: 'onboarding_modal' })
    setVisible(false)
    onDismiss?.()
  }

  if (!visible) return null

  const isAr = selected === 'ar'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-dc1-void/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-modal-title"
    >
      <div className="bg-dc1-surface-l2 border border-dc1-border rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Title */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">🌍</div>
          <h2 id="lang-modal-title" className="text-xl font-bold text-dc1-text-primary mb-1">
            {isAr ? 'مرحباً بك في DCP' : 'Welcome to DCP'}
          </h2>
          <p className="text-sm text-dc1-text-secondary">
            {isAr ? 'اختر لغتك المفضلة' : 'Choose your preferred language'}
          </p>
        </div>

        {/* Language cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Arabic option */}
          <button
            type="button"
            onClick={() => setSelected('ar')}
            className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-dc1-amber ${
              selected === 'ar'
                ? 'border-dc1-amber bg-dc1-amber/10 text-dc1-text-primary'
                : 'border-dc1-border bg-dc1-surface-l1 text-dc1-text-secondary hover:border-dc1-amber/40 hover:bg-dc1-surface-l2'
            }`}
            aria-pressed={selected === 'ar'}
          >
            <span className="text-2xl">🇸🇦</span>
            <span className="text-lg font-bold leading-tight" dir="rtl" lang="ar">عربي</span>
            <span className="text-xs text-dc1-text-muted" dir="rtl" lang="ar">العربية</span>
            {selected === 'ar' && (
              <span className="text-dc1-amber text-xs font-semibold mt-1">✓</span>
            )}
          </button>

          {/* English option */}
          <button
            type="button"
            onClick={() => setSelected('en')}
            className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-dc1-amber ${
              selected === 'en'
                ? 'border-dc1-amber bg-dc1-amber/10 text-dc1-text-primary'
                : 'border-dc1-border bg-dc1-surface-l1 text-dc1-text-secondary hover:border-dc1-amber/40 hover:bg-dc1-surface-l2'
            }`}
            aria-pressed={selected === 'en'}
          >
            <span className="text-2xl">🇬🇧</span>
            <span className="text-lg font-bold leading-tight">English</span>
            <span className="text-xs text-dc1-text-muted">English</span>
            {selected === 'en' && (
              <span className="text-dc1-amber text-xs font-semibold mt-1">✓</span>
            )}
          </button>
        </div>

        {/* Confirm button */}
        <button
          type="button"
          onClick={confirm}
          className="btn btn-primary w-full text-center"
        >
          {selected === 'ar' ? 'اختيار' : 'Select Language'}
        </button>

        {/* Footer note */}
        <p className="text-xs text-dc1-text-muted text-center mt-4">
          {selected === 'ar'
            ? 'يمكنك التغيير في أي وقت من خلال شريط التنقل'
            : 'You can change this anytime using the language toggle in the header.'}
        </p>
      </div>
    </div>
  )
}
