'use client'

import Link from 'next/link'

// ── Shared layout ─────────────────────────────────────────────────────────────

interface EmptyStateWrapperProps {
  children: React.ReactNode
  className?: string
}

function EmptyStateWrapper({ children, className = '' }: EmptyStateWrapperProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-16 ${className}`}>
      {children}
    </div>
  )
}

// ── EmptyWallet ───────────────────────────────────────────────────────────────
// Shown when balance is 0 and renter tries to deploy

interface EmptyWalletProps {
  /** Current balance in halala (100 halala = 1 SAR) */
  balanceHalala?: number
  /** Minimum required halala for the next action */
  requiredHalala?: number
  isRTL?: boolean
}

export function EmptyWallet({ balanceHalala = 0, requiredHalala, isRTL = false }: EmptyWalletProps) {
  const balanceSAR = (balanceHalala / 100).toFixed(2)
  const requiredSAR = requiredHalala != null ? (requiredHalala / 100).toFixed(2) : null
  const minimumSAR = '10.00'

  return (
    <EmptyStateWrapper>
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-dc1-amber/10 border border-dc1-amber/20 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-dc1-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m4 0h1M9 19h6a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-dc1-text-primary mb-2">
        {isRTL ? 'رصيد المحفظة منخفض' : 'Wallet balance too low'}
      </h3>

      {/* Description */}
      <p className="text-sm text-dc1-text-secondary max-w-sm mb-1">
        {isRTL
          ? `رصيدك الحالي هو ${balanceSAR} ريال. أنت بحاجة إلى ${requiredSAR ?? minimumSAR} ريال على الأقل لتشغيل وظيفة.`
          : `Your current balance is ${balanceSAR} SAR. You need at least ${requiredSAR ?? minimumSAR} SAR to run a job.`}
      </p>
      <p className="text-xs text-dc1-text-muted mb-6">
        {isRTL
          ? 'أسعار DCP أقل بنسبة 33–51% مقارنة بالموفرين السحابيين الرئيسيين.'
          : 'DCP prices are 33–51% lower than major cloud providers.'}
      </p>

      {/* CTA */}
      <Link
        href="/renter/billing"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dc1-amber text-dc1-bg-primary font-semibold text-sm hover:opacity-90 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {isRTL ? 'اشحن المحفظة' : 'Top Up Wallet'}
      </Link>

      {/* Minimum note */}
      <p className="text-xs text-dc1-text-muted mt-3">
        {isRTL ? `الحد الأدنى للشحن: ${minimumSAR} ريال` : `Minimum top-up: ${minimumSAR} SAR`}
      </p>
    </EmptyStateWrapper>
  )
}

// ── NoProvidersAvailable ──────────────────────────────────────────────────────
// Shown when 0 providers are online

interface NoProvidersAvailableProps {
  providerCount?: number
  isRTL?: boolean
}

export function NoProvidersAvailable({ providerCount = 0, isRTL = false }: NoProvidersAvailableProps) {
  return (
    <EmptyStateWrapper>
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
        </svg>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-dc1-text-primary mb-2">
        {isRTL ? 'وحدات GPU تُعدّ للانطلاق' : 'GPUs are warming up'}
      </h3>

      {/* Description */}
      <p className="text-sm text-dc1-text-secondary max-w-sm mb-1">
        {isRTL
          ? 'لا يوجد موفرون نشطون في الوقت الحالي. هذا مؤقت — يُرجى العودة قريبًا.'
          : 'No active providers at the moment. This is temporary — check back shortly.'}
      </p>
      <p className="text-xs text-dc1-text-muted mb-6">
        {isRTL
          ? `الموفرون المسجلون: ${providerCount}. يتم تفعيلهم قريبًا.`
          : `${providerCount} registered provider${providerCount !== 1 ? 's' : ''} — activation in progress.`}
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <Link
          href="/renter/marketplace"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
        >
          {isRTL ? 'تصفح النماذج' : 'Browse Models'}
        </Link>
        <a
          href="mailto:support@dcp.sa"
          className="text-sm text-dc1-text-secondary hover:text-dc1-text-primary transition-colors"
        >
          {isRTL ? 'تواصل مع الدعم' : 'Contact support'}
        </a>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 mt-6 text-xs text-dc1-text-muted">
        <span className="w-2 h-2 rounded-full bg-dc1-amber/70 animate-pulse" aria-hidden="true" />
        {isRTL ? 'نتحقق من توفر الموفرين...' : 'Monitoring provider availability...'}
      </div>
    </EmptyStateWrapper>
  )
}

// ── NoJobsYet ─────────────────────────────────────────────────────────────────
// Shown on job history when no jobs have been run

interface NoJobsYetProps {
  isRTL?: boolean
}

export function NoJobsYet({ isRTL = false }: NoJobsYetProps) {
  return (
    <EmptyStateWrapper>
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-dc1-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-dc1-text-primary mb-2">
        {isRTL ? 'لم يتم تشغيل أي وظائف بعد' : 'No jobs run yet'}
      </h3>

      {/* Description */}
      <p className="text-sm text-dc1-text-secondary max-w-sm mb-6">
        {isRTL
          ? 'استعرض الكتالوج، اختر نموذجًا، وانشر أول وظيفة GPU في ثوانٍ.'
          : 'Browse the catalog, pick a model, and deploy your first GPU job in seconds.'}
      </p>

      {/* CTA */}
      <Link
        href="/renter/marketplace"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        {isRTL ? 'تصفح النماذج' : 'Browse Models'}
      </Link>

      {/* Secondary tips */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg text-left">
        {[
          {
            emoji: '⚡',
            titleEn: 'One-click deploy',
            titleAr: 'نشر بنقرة واحدة',
            descEn: 'Pick a template and your job starts in under 60 seconds.',
            descAr: 'اختر قالبًا وتبدأ وظيفتك في أقل من 60 ثانية.',
          },
          {
            emoji: '💰',
            titleEn: '33–51% cheaper',
            titleAr: '33–51% أرخص',
            descEn: 'Saudi energy rates beat US & EU cloud prices.',
            descAr: 'أسعار الطاقة السعودية تتفوق على أسعار السحابة الأمريكية والأوروبية.',
          },
          {
            emoji: '🌙',
            titleEn: 'Arabic AI models',
            titleAr: 'نماذج الذكاء الاصطناعي العربي',
            descEn: 'ALLaM, JAIS, Qwen 2.5 — Arabic-first inference.',
            descAr: 'ALLaM وJAIS وQwen 2.5 — استدلال عربي أولاً.',
          },
        ].map((tip) => (
          <div key={tip.titleEn} className={`bg-white/[0.02] border border-white/8 rounded-xl p-4 ${isRTL ? 'text-right' : 'text-left'}`}>
            <div className="text-xl mb-2">{tip.emoji}</div>
            <p className="text-xs font-semibold text-dc1-text-primary mb-1">
              {isRTL ? tip.titleAr : tip.titleEn}
            </p>
            <p className="text-xs text-dc1-text-muted leading-relaxed">
              {isRTL ? tip.descAr : tip.descEn}
            </p>
          </div>
        ))}
      </div>
    </EmptyStateWrapper>
  )
}
