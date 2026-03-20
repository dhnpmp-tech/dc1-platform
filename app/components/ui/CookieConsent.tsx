'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '../../lib/i18n'

type ConsentValue = 'accepted' | 'declined'

export default function CookieConsent() {
  const { language } = useLanguage()
  const [ready, setReady] = useState(false)
  const [consent, setConsent] = useState<ConsentValue | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('dcp_consent')
      if (stored === 'accepted' || stored === 'declined') {
        setConsent(stored)
      }
    } catch (_) {
      // Ignore localStorage errors and keep banner hidden.
    } finally {
      setReady(true)
    }
  }, [])

  const saveConsent = (next: ConsentValue) => {
    try {
      localStorage.setItem('dcp_consent', next)
    } catch (_) {
      // Ignore storage errors in private browsing modes.
    }
    setConsent(next)
  }

  if (!ready || consent) return null

  const title = language === 'ar' ? 'إشعار ملفات تعريف الارتباط' : 'Cookie Notice'
  const body = language === 'ar'
    ? 'نستخدم ملفات تعريف الارتباط الأساسية لتسجيل الدخول والأمان. لا نستخدم ملفات تتبع حالياً. يمكنك قبول أو رفض ملفات التحليلات (عند تفعيلها مستقبلاً).'
    : 'We use essential cookies for login and security. We do not currently use tracking cookies. You can accept or decline analytics cookies if enabled in the future.'
  const acceptLabel = language === 'ar' ? 'قبول' : 'Accept'
  const declineLabel = language === 'ar' ? 'رفض' : 'Decline'

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto max-w-5xl rounded-xl border border-dc1-border bg-dc1-surface-l1 p-4 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-dc1-text-primary">{title}</p>
            <p className="text-xs text-dc1-text-secondary" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              {body}
            </p>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <button
              onClick={() => saveConsent('declined')}
              className="btn btn-outline text-sm min-h-[40px] px-4"
            >
              {declineLabel}
            </button>
            <button
              onClick={() => saveConsent('accepted')}
              className="btn btn-primary text-sm min-h-[40px] px-4"
            >
              {acceptLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
