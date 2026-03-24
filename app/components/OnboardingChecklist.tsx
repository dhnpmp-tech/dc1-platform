'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Storage keys ──────────────────────────────────────────────────────────────

const CHECKLIST_KEY = 'dcp_onboarding_checklist'

interface ChecklistState {
  apiKeyAdded: boolean
  walletToppedUp: boolean
  firstJobDeployed: boolean
  dismissed: boolean
}

function loadState(): ChecklistState {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { apiKeyAdded: false, walletToppedUp: false, firstJobDeployed: false, dismissed: false }
}

function saveState(state: ChecklistState) {
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

// ── Helpers to mark steps complete from outside this component ────────────────

export function markApiKeyAdded() {
  const s = loadState()
  saveState({ ...s, apiKeyAdded: true })
  window.dispatchEvent(new Event('dcp_checklist_update'))
}

export function markWalletToppedUp() {
  const s = loadState()
  saveState({ ...s, walletToppedUp: true })
  window.dispatchEvent(new Event('dcp_checklist_update'))
}

export function markFirstJobDeployed() {
  const s = loadState()
  saveState({ ...s, firstJobDeployed: true })
  window.dispatchEvent(new Event('dcp_checklist_update'))
}

// ── Step definition ───────────────────────────────────────────────────────────

interface Step {
  key: keyof Omit<ChecklistState, 'dismissed'>
  labelEn: string
  labelAr: string
  href: string
  ctaEn: string
  ctaAr: string
}

const STEPS: Step[] = [
  {
    key: 'apiKeyAdded',
    labelEn: 'Add your API key to your application',
    labelAr: 'أضف مفتاح API إلى تطبيقك',
    href: '/renter/settings',
    ctaEn: 'Go to Settings',
    ctaAr: 'اذهب إلى الإعدادات',
  },
  {
    key: 'walletToppedUp',
    labelEn: 'Top up wallet (minimum SAR 10)',
    labelAr: 'اشحن المحفظة (الحد الأدنى 10 ريال)',
    href: '/renter/billing',
    ctaEn: 'Top Up',
    ctaAr: 'اشحن الآن',
  },
  {
    key: 'firstJobDeployed',
    labelEn: 'Deploy your first model',
    labelAr: 'انشر نموذجك الأول',
    href: '/renter/marketplace',
    ctaEn: 'Browse Models',
    ctaAr: 'تصفح النماذج',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

interface OnboardingChecklistProps {
  /** ISO language code — 'ar' triggers RTL + Arabic labels */
  lang?: 'en' | 'ar'
  /** Balance in halala — used to auto-detect wallet top-up */
  balanceHalala?: number
  /** Number of jobs run — used to auto-detect first deployment */
  totalJobs?: number
  /** Whether a renter key is stored — used to auto-detect API key step */
  hasApiKey?: boolean
}

export default function OnboardingChecklist({
  lang = 'en',
  balanceHalala,
  totalJobs,
  hasApiKey,
}: OnboardingChecklistProps) {
  const isRTL = lang === 'ar'
  const [state, setState] = useState<ChecklistState>({
    apiKeyAdded: false,
    walletToppedUp: false,
    firstJobDeployed: false,
    dismissed: false,
  })

  // Load persisted state and auto-detect completed steps from props
  useEffect(() => {
    const persisted = loadState()

    const updated: ChecklistState = {
      ...persisted,
      apiKeyAdded: persisted.apiKeyAdded || hasApiKey === true,
      walletToppedUp: persisted.walletToppedUp || (balanceHalala != null && balanceHalala >= 1000),
      firstJobDeployed: persisted.firstJobDeployed || (totalJobs != null && totalJobs > 0),
    }

    // Persist any newly-detected completions
    if (
      updated.apiKeyAdded !== persisted.apiKeyAdded ||
      updated.walletToppedUp !== persisted.walletToppedUp ||
      updated.firstJobDeployed !== persisted.firstJobDeployed
    ) {
      saveState(updated)
    }

    setState(updated)
  }, [hasApiKey, balanceHalala, totalJobs])

  // Listen for external updates (from markApiKeyAdded, etc.)
  useEffect(() => {
    const handler = () => setState(loadState())
    window.addEventListener('dcp_checklist_update', handler)
    return () => window.removeEventListener('dcp_checklist_update', handler)
  }, [])

  const allComplete = state.apiKeyAdded && state.walletToppedUp && state.firstJobDeployed
  const completedCount = [state.apiKeyAdded, state.walletToppedUp, state.firstJobDeployed].filter(Boolean).length
  const totalCount = 3

  // Hide once dismissed
  if (state.dismissed) return null

  function dismiss() {
    const updated = { ...state, dismissed: true }
    saveState(updated)
    setState(updated)
  }

  return (
    <div
      className="bg-dc1-surface-l1 border border-dc1-border rounded-xl p-5 space-y-4"
      dir={isRTL ? 'rtl' : 'ltr'}
      aria-label={isRTL ? 'قائمة التأهيل' : 'Onboarding checklist'}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-dc1-text-primary">
              {isRTL ? 'ابدأ مع DCP' : 'Get started with DCP'}
            </h2>
            <p className="text-xs text-dc1-text-muted mt-0.5">
              {isRTL
                ? `${completedCount} من ${totalCount} مكتمل`
                : `${completedCount} of ${totalCount} complete`}
            </p>
          </div>
        </div>
        {allComplete && (
          <button
            onClick={dismiss}
            className="text-xs text-dc1-text-muted hover:text-dc1-text-secondary transition-colors px-2 py-1 rounded hover:bg-white/5 shrink-0"
            aria-label={isRTL ? 'إخفاء القائمة' : 'Dismiss checklist'}
          >
            {isRTL ? 'إخفاء' : 'Dismiss'}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden" role="progressbar" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={totalCount}>
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <ul className="space-y-2" role="list">
        {STEPS.map((step) => {
          const done = state[step.key]
          return (
            <li
              key={step.key}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                done ? 'opacity-60' : 'bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              {/* Checkbox */}
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  done
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-white/20'
                }`}
                aria-hidden="true"
              >
                {done && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                    <path d="M10 3L5 8.5 2 5.5l-1 1 4 4 6-7-1-1z" />
                  </svg>
                )}
              </div>

              {/* Label */}
              <span className={`flex-1 text-sm ${done ? 'line-through text-dc1-text-muted' : 'text-dc1-text-primary'}`}>
                {isRTL ? step.labelAr : step.labelEn}
              </span>

              {/* CTA link */}
              {!done && (
                <Link
                  href={step.href}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors shrink-0"
                >
                  {isRTL ? step.ctaAr : step.ctaEn} →
                </Link>
              )}
            </li>
          )
        })}
      </ul>

      {/* All done */}
      {allComplete && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-green-300 font-medium">
            {isRTL ? 'أحسنت! أنت جاهز للانطلاق.' : "You're all set! Ready to run GPU jobs."}
          </p>
        </div>
      )}
    </div>
  )
}
