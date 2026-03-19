'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import { useLanguage } from '../../lib/i18n'

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded border border-dc1-border bg-dc1-surface-l3 px-2 py-1 text-xs text-dc1-text-muted transition hover:text-dc1-amber"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative mt-3">
      <pre className="overflow-x-auto rounded-lg border border-dc1-border bg-dc1-surface-l2 p-3 pr-16 text-xs text-dc1-text-secondary leading-relaxed">
        {code}
      </pre>
      <CopyButton text={code} />
    </div>
  )
}

// ── Step card ─────────────────────────────────────────────────────────────────
function StepCard({
  number,
  time,
  title,
  titleAr,
  children,
  isRTL,
}: {
  number: number
  time: string
  title: string
  titleAr: string
  children: React.ReactNode
  isRTL: boolean
}) {
  return (
    <div className="rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-5 sm:p-6">
      <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dc1-amber/15 text-sm font-bold text-dc1-amber">
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-base font-semibold text-dc1-text-primary">
              {isRTL ? titleAr : title}
            </h2>
            <span className="rounded-full border border-dc1-border bg-dc1-surface-l2 px-2 py-0.5 text-xs text-dc1-text-muted">
              {time}
            </span>
          </div>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ── Translations ──────────────────────────────────────────────────────────────
const copy = {
  en: {
    badge: 'QUICKSTART',
    heading: 'Run your first GPU job in 5 minutes',
    sub: 'From zero to a running PyTorch job on DCP. All you need is an email address.',
    stepTitles: [
      'Get your API key',
      'Top up your balance',
      'Browse available GPUs',
      'Submit a job',
      'Monitor job status',
    ],
    stepTimes: ['30 sec', '1 min', '30 sec', '2 min', '30 sec'],
    s1: {
      p1: 'Register a renter account at',
      p2: 'dcp.sa/renter/register',
      p3: '. You\'ll receive a renter API key — copy it from the dashboard.',
      note: 'Keep your key safe. It authenticates all API calls and is shown once.',
    },
    s2: {
      p1: 'Add SAR to your wallet. Use the dashboard at',
      p2: 'dcp.sa/renter/billing',
      p3: ', or call the API directly:',
      note: 'Billing uses halala internally. 100 halala = 1 SAR. 10 SAR = 1,000 halala.',
    },
    s3: {
      p1: 'Fetch the live GPU marketplace to find an available provider and its',
      code: 'id',
      p2: ':',
      note: 'Note the',
      code2: 'provider.id',
      p3: '— you need it for job submission.',
    },
    s4: {
      p1: 'Submit a PyTorch LLM inference job. Pass your renter key in the',
      code: 'x-renter-key',
      p2: 'header:',
      note: 'Cost is deducted as a pre-pay hold. Any unused halala is refunded when the job completes.',
    },
    s5: {
      p1: 'Poll the job endpoint until',
      code: 'status',
      p2: 'reaches',
      code2: 'done',
      p3: ', then fetch the output:',
      statuses: 'Status flow:',
      statusFlow: 'pending → queued → running → done',
      logsNote: 'Logs are available at',
    },
    next: 'What\'s next?',
    nextItems: [
      { label: 'Full API reference', href: '/docs/api' },
      { label: 'Renter guide', href: '/docs/renter-guide' },
      { label: 'Provider guide', href: '/docs/provider-guide' },
    ],
    toggleLang: 'عربي',
  },
  ar: {
    badge: 'دليل البدء السريع',
    heading: 'شغّل أول وظيفة GPU في 5 دقائق',
    sub: 'من الصفر إلى وظيفة PyTorch تعمل على DCP. كل ما تحتاجه هو بريد إلكتروني.',
    stepTitles: [
      'احصل على مفتاح API',
      'أضف رصيدًا لمحفظتك',
      'تصفّح وحدات GPU المتاحة',
      'أرسل وظيفة',
      'راقب حالة الوظيفة',
    ],
    stepTimes: ['٣٠ ثانية', 'دقيقة', '٣٠ ثانية', 'دقيقتان', '٣٠ ثانية'],
    s1: {
      p1: 'سجّل حساب مستأجر على',
      p2: 'dcp.sa/renter/register',
      p3: '. ستحصل على مفتاح API — انسخه من لوحة التحكم.',
      note: 'احتفظ بمفتاحك بأمان. يُستخدم لمصادقة جميع طلبات API ويُعرض مرةً واحدة فقط.',
    },
    s2: {
      p1: 'أضف ريالات سعودية إلى محفظتك. استخدم لوحة التحكم على',
      p2: 'dcp.sa/renter/billing',
      p3: '، أو استدعِ API مباشرةً:',
      note: 'يستخدم النظام الهللة داخليًا. ١٠٠ هللة = ١ ريال. ١٠ ريالات = ١٠٠٠ هللة.',
    },
    s3: {
      p1: 'استرجع سوق GPU المباشر للعثور على مزود متاح والحصول على',
      code: 'id',
      p2: ':',
      note: 'دوّن',
      code2: 'provider.id',
      p3: '— ستحتاجه عند إرسال الوظيفة.',
    },
    s4: {
      p1: 'أرسل وظيفة استدلال LLM باستخدام PyTorch. مرّر مفتاح المستأجر في ترويسة',
      code: 'x-renter-key',
      p2: ':',
      note: 'يُخصم التكلفة كاحتجاز مسبق. أي هللات غير مستخدمة تُعاد عند اكتمال الوظيفة.',
    },
    s5: {
      p1: 'استطلع نقطة نهاية الوظيفة حتى يصل',
      code: 'status',
      p2: 'إلى',
      code2: 'done',
      p3: '، ثم استرجع المخرجات:',
      statuses: 'تدفق الحالات:',
      statusFlow: 'pending → queued → running → done',
      logsNote: 'السجلات متاحة على',
    },
    next: 'ما التالي؟',
    nextItems: [
      { label: 'مرجع API الكامل', href: '/docs/api' },
      { label: 'دليل المستأجر', href: '/docs/renter-guide' },
      { label: 'دليل المزود', href: '/docs/provider-guide' },
    ],
    toggleLang: 'English',
  },
}

// ── Code snippets ─────────────────────────────────────────────────────────────
const TOPUP_CODE = `curl -X POST https://dcp.sa/api/dc1/renters/topup \\
  -H "x-renter-key: YOUR_RENTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount_sar": 10}'`

const TOPUP_RESPONSE = `{
  "success": true,
  "topped_up_halala": 1000,
  "new_balance_halala": 1000
}`

const BROWSE_CODE = `curl https://dcp.sa/api/dc1/marketplace`

const BROWSE_RESPONSE = `{
  "providers": [
    {
      "id": 42,
      "gpu_model": "RTX 4090",
      "vram_gb": 24,
      "price_llm_halala_per_hr": 1200,
      "price_training_halala_per_hr": 1800,
      "is_live": true,
      "location": "Riyadh"
    }
  ],
  "total": 1
}`

const SUBMIT_CODE = `curl -X POST https://dcp.sa/api/dc1/jobs/submit \\
  -H "x-renter-key: YOUR_RENTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider_id": 42,
    "job_type": "llm_inference",
    "duration_minutes": 10,
    "params": {
      "model": "meta-llama/Llama-3-8B",
      "prompt": "Explain transformers in one paragraph"
    }
  }'`

const SUBMIT_RESPONSE = `{
  "success": true,
  "job": {
    "job_id": "job-abc123",
    "status": "pending",
    "cost_halala": 200,
    "provider_id": 42
  }
}`

const POLL_CODE = `# Poll status
curl https://dcp.sa/api/dc1/jobs/job-abc123

# Fetch output (returns 202 while running, 200 when done)
curl https://dcp.sa/api/dc1/jobs/job-abc123/output`

const POLL_RESPONSE = `{
  "type": "text",
  "response": "Transformers are a neural network architecture...",
  "billing": {
    "actual_cost_halala": 188,
    "refunded_halala": 12
  }
}`

// ── Page ──────────────────────────────────────────────────────────────────────
export default function QuickstartPage() {
  const { language, setLanguage } = useLanguage()
  const isRTL = language === 'ar'
  const t = copy[language]

  return (
    <div className="min-h-screen bg-dc1-void" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero card */}
        <div className="rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-6 sm:p-8">
          <div className={`flex items-center justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <p className="text-xs uppercase tracking-[0.16em] text-dc1-amber">{t.badge}</p>
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="rounded border border-dc1-border bg-dc1-surface-l2 px-3 py-1 text-xs text-dc1-text-secondary transition hover:text-dc1-amber hover:border-dc1-amber/30"
            >
              {t.toggleLang}
            </button>
          </div>
          <h1 className={`mt-2 text-3xl font-bold text-dc1-text-primary sm:text-4xl ${isRTL ? 'text-right' : ''}`}>
            {t.heading}
          </h1>
          <p className={`mt-3 text-dc1-text-secondary ${isRTL ? 'text-right' : ''}`}>{t.sub}</p>

          {/* Step progress bar */}
          <div className={`mt-6 flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-center gap-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-dc1-amber/20 text-xs font-bold text-dc1-amber">
                  {n}
                </div>
                {n < 5 && <div className="h-px w-6 bg-dc1-border sm:w-10" />}
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="mt-6 space-y-4">

          {/* Step 1: Get API key */}
          <StepCard number={1} time={t.stepTimes[0]} title={t.stepTitles[0]} titleAr={copy.ar.stepTitles[0]} isRTL={isRTL}>
            <p className={`text-sm text-dc1-text-secondary ${isRTL ? 'text-right' : ''}`}>
              {t.s1.p1}{' '}
              <Link href="/renter/register" className="text-dc1-amber underline-offset-2 hover:underline">
                {t.s1.p2}
              </Link>
              {t.s1.p3}
            </p>
            <div className="mt-3 rounded-lg border border-dc1-amber/20 bg-dc1-amber/5 px-4 py-3 text-xs text-dc1-amber">
              {t.s1.note}
            </div>
          </StepCard>

          {/* Step 2: Top up */}
          <StepCard number={2} time={t.stepTimes[1]} title={t.stepTitles[1]} titleAr={copy.ar.stepTitles[1]} isRTL={isRTL}>
            <p className={`text-sm text-dc1-text-secondary ${isRTL ? 'text-right' : ''}`}>
              {t.s2.p1}{' '}
              <Link href="/renter/billing" className="text-dc1-amber underline-offset-2 hover:underline">
                {t.s2.p2}
              </Link>
              {t.s2.p3}
            </p>
            <CodeBlock code={TOPUP_CODE} />
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-dc1-text-muted">Response</p>
            <CodeBlock code={TOPUP_RESPONSE} />
            <div className="mt-3 rounded-lg border border-dc1-border bg-dc1-surface-l2 px-4 py-3 text-xs text-dc1-text-muted">
              {t.s2.note}
            </div>
          </StepCard>

          {/* Step 3: Browse GPUs */}
          <StepCard number={3} time={t.stepTimes[2]} title={t.stepTitles[2]} titleAr={copy.ar.stepTitles[2]} isRTL={isRTL}>
            <p className={`text-sm text-dc1-text-secondary ${isRTL ? 'text-right' : ''}`}>
              {t.s3.p1}{' '}
              <code className="rounded bg-dc1-surface-l3 px-1 py-0.5 text-dc1-amber">{t.s3.code}</code>
              {' '}{t.s3.p2}
            </p>
            <CodeBlock code={BROWSE_CODE} />
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-dc1-text-muted">Response</p>
            <CodeBlock code={BROWSE_RESPONSE} />
            <div className="mt-3 rounded-lg border border-dc1-border bg-dc1-surface-l2 px-4 py-3 text-xs text-dc1-text-muted">
              {t.s3.note}{' '}
              <code className="rounded bg-dc1-surface-l3 px-1 py-0.5 text-dc1-amber">{t.s3.code2}</code>
              {' '}{t.s3.p3}
            </div>
          </StepCard>

          {/* Step 4: Submit job */}
          <StepCard number={4} time={t.stepTimes[3]} title={t.stepTitles[3]} titleAr={copy.ar.stepTitles[3]} isRTL={isRTL}>
            <p className={`text-sm text-dc1-text-secondary ${isRTL ? 'text-right' : ''}`}>
              {t.s4.p1}{' '}
              <code className="rounded bg-dc1-surface-l3 px-1 py-0.5 text-dc1-amber">{t.s4.code}</code>
              {' '}{t.s4.p2}
            </p>
            <CodeBlock code={SUBMIT_CODE} />
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-dc1-text-muted">Response</p>
            <CodeBlock code={SUBMIT_RESPONSE} />
            <div className="mt-3 rounded-lg border border-dc1-amber/20 bg-dc1-amber/5 px-4 py-3 text-xs text-dc1-amber">
              {t.s4.note}
            </div>
          </StepCard>

          {/* Step 5: Monitor */}
          <StepCard number={5} time={t.stepTimes[4]} title={t.stepTitles[4]} titleAr={copy.ar.stepTitles[4]} isRTL={isRTL}>
            <p className={`text-sm text-dc1-text-secondary ${isRTL ? 'text-right' : ''}`}>
              {t.s5.p1}{' '}
              <code className="rounded bg-dc1-surface-l3 px-1 py-0.5 text-dc1-amber">{t.s5.code}</code>
              {' '}{t.s5.p2}{' '}
              <code className="rounded bg-dc1-surface-l3 px-1 py-0.5 text-emerald-400">{t.s5.code2}</code>
              {t.s5.p3}
            </p>
            <CodeBlock code={POLL_CODE} />
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-dc1-text-muted">Response</p>
            <CodeBlock code={POLL_RESPONSE} />
            <div className="mt-3 rounded-lg border border-dc1-border bg-dc1-surface-l2 px-4 py-3 text-xs text-dc1-text-muted">
              <span className="font-semibold text-dc1-text-secondary">{t.s5.statuses}</span>{' '}
              <code className="text-dc1-text-secondary">{t.s5.statusFlow}</code>
              <br />
              <span className="mt-1 block">
                {t.s5.logsNote}{' '}
                <code className="rounded bg-dc1-surface-l3 px-1 py-0.5 text-dc1-amber">GET /api/jobs/:id/logs</code>
              </span>
            </div>
          </StepCard>
        </div>

        {/* What's next */}
        <div className="mt-8 rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-6">
          <h2 className={`text-lg font-semibold text-dc1-text-primary ${isRTL ? 'text-right' : ''}`}>
            {t.next}
          </h2>
          <div className={`mt-4 flex flex-wrap gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {t.nextItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-lg border border-dc1-border bg-dc1-surface-l2 px-4 py-2 text-sm text-dc1-text-secondary transition hover:border-dc1-amber/30 hover:text-dc1-amber"
              >
                {item.label}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d={isRTL ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
