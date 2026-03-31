'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '../../../components/layout/Header'
import Footer from '../../../components/layout/Footer'
import { useLanguage } from '../../../lib/i18n'

type LocaleCopy = {
  badge: string
  title: string
  subtitle: string
  firstCallTitle: string
  firstCallHint: string
  troubleTitle: string
  troubleItems: Array<{ key: string; title: string; body: string }>
  copyLabel: string
  copiedLabel: string
  nextTitle: string
  nextCta: string
}

const EN_COPY: LocaleCopy = {
  badge: 'OPENROUTER 60S QUICKSTART',
  title: 'Make your first `/v1/chat/completions` call in 60 seconds',
  subtitle: 'Use your renter key with the OpenRouter-compatible endpoint, verify a successful JSON response, then move to production templates.',
  firstCallTitle: 'First call',
  firstCallHint: 'Replace `YOUR_RENTER_KEY` then run this exact request.',
  troubleTitle: 'Troubleshooting',
  troubleItems: [
    {
      key: 'auth',
      title: '401 / invalid key',
      body: 'Confirm your key starts with `dcp-renter-` and send it in `Authorization: Bearer <key>`.',
    },
    {
      key: 'quota',
      title: '402 / insufficient balance',
      body: 'Top up your renter wallet before retrying. Settlement remains usage-based.',
    },
    {
      key: 'model',
      title: '404 / model not found',
      body: 'Use a currently published model id from the DCP model catalog before submitting the request.',
    },
  ],
  copyLabel: 'Copy cURL',
  copiedLabel: 'Copied',
  nextTitle: 'Next step',
  nextCta: 'Open full quickstart',
}

const AR_COPY: LocaleCopy = {
  badge: 'دليل OpenRouter خلال 60 ثانية',
  title: 'نفّذ أول طلب `/v1/chat/completions` خلال 60 ثانية',
  subtitle: 'استخدم مفتاح المستأجر مع نقطة النهاية المتوافقة مع OpenRouter، ثم تأكد من استجابة JSON الصحيحة قبل الانتقال للتكامل الإنتاجي.',
  firstCallTitle: 'أول طلب',
  firstCallHint: 'استبدل `YOUR_RENTER_KEY` ثم نفّذ الطلب كما هو.',
  troubleTitle: 'استكشاف الأخطاء',
  troubleItems: [
    {
      key: 'auth',
      title: '401 / مفتاح غير صالح',
      body: 'تأكد أن المفتاح يبدأ بـ `dcp-renter-` وأنه مرسَل في `Authorization: Bearer <key>`.',
    },
    {
      key: 'quota',
      title: '402 / الرصيد غير كافٍ',
      body: 'اشحن محفظة المستأجر ثم أعد المحاولة. التسوية تبقى حسب الاستخدام الفعلي.',
    },
    {
      key: 'model',
      title: '404 / النموذج غير موجود',
      body: 'استخدم معرّف نموذج منشور حاليًا في كتالوج نماذج DCP قبل إرسال الطلب.',
    },
  ],
  copyLabel: 'نسخ cURL',
  copiedLabel: 'تم النسخ',
  nextTitle: 'الخطوة التالية',
  nextCta: 'فتح الدليل الكامل',
}

const FIRST_CALL_SNIPPET = `curl https://api.dcp.sa/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_RENTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "meta-llama/Llama-3-8B-Instruct",
    "messages": [
      {"role": "user", "content": "Return a one-line hello from DCP."}
    ],
    "temperature": 0.2,
    "max_tokens": 64
  }'`

export default function OpenRouter60sQuickstartPage() {
  const { language } = useLanguage()
  const isRTL = language === 'ar'
  const copy = isRTL ? AR_COPY : EN_COPY
  const [copied, setCopied] = useState(false)

  const trackEvent = (event: string, payload: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') return
    const detail = {
      event,
      source_page: 'openrouter_60s_quickstart',
      language,
      ...payload,
    }
    window.dispatchEvent(new CustomEvent('dc1_analytics', { detail }))
  }

  const troubleList = useMemo(() => copy.troubleItems, [copy.troubleItems])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(FIRST_CALL_SNIPPET)
    setCopied(true)
    trackEvent('openrouter_quickstart_code_copied', {
      surface: 'first_call_snippet',
      destination: 'clipboard',
      step: 'copy',
    })
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="min-h-screen bg-dc1-void" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-6 sm:p-8">
          <p className={`text-xs uppercase tracking-[0.14em] text-dc1-amber ${isRTL ? 'text-right' : ''}`}>{copy.badge}</p>
          <h1 className={`mt-2 text-3xl font-bold text-dc1-text-primary sm:text-4xl ${isRTL ? 'text-right' : ''}`}>{copy.title}</h1>
          <p className={`mt-3 text-sm text-dc1-text-secondary sm:text-base ${isRTL ? 'text-right' : ''}`}>{copy.subtitle}</p>
        </section>

        <section className="mt-6 rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-6 sm:p-8">
          <h2 className={`text-lg font-semibold text-dc1-text-primary ${isRTL ? 'text-right' : ''}`}>{copy.firstCallTitle}</h2>
          <p className={`mt-2 text-xs text-dc1-text-secondary ${isRTL ? 'text-right' : ''}`}>{copy.firstCallHint}</p>
          <div className="relative mt-3">
            <pre dir="ltr" className="overflow-x-auto rounded-lg border border-dc1-border bg-dc1-surface-l2 p-3 pr-28 text-left text-xs text-dc1-text-secondary leading-relaxed whitespace-pre-wrap break-words">
              {FIRST_CALL_SNIPPET}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute right-2 top-2 rounded border border-dc1-border bg-dc1-surface-l3 px-2 py-1 text-xs text-dc1-text-muted transition hover:text-dc1-amber"
            >
              {copied ? copy.copiedLabel : copy.copyLabel}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-6 sm:p-8">
          <h2 className={`text-lg font-semibold text-dc1-text-primary ${isRTL ? 'text-right' : ''}`}>{copy.troubleTitle}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {troubleList.map((item) => (
              <button
                key={item.key}
                className={`rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4 text-left transition-colors hover:border-dc1-amber ${isRTL ? 'text-right' : ''}`}
                onClick={() =>
                  trackEvent('openrouter_quickstart_troubleshooting_opened', {
                    surface: 'troubleshooting_panel',
                    destination: item.key,
                    step: 'open_issue',
                  })
                }
              >
                <p className="text-sm font-semibold text-dc1-text-primary">{item.title}</p>
                <p className="mt-2 text-xs leading-relaxed text-dc1-text-secondary">{item.body}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-dc1-amber/30 bg-dc1-amber/10 p-5">
          <p className={`text-sm font-semibold text-dc1-text-primary ${isRTL ? 'text-right' : ''}`}>{copy.nextTitle}</p>
          <Link
            href="/docs/quickstart?source=openrouter_60s_quickstart"
            className="btn btn-primary btn-sm mt-3"
            onClick={() =>
              trackEvent('openrouter_quickstart_next_clicked', {
                surface: 'next_step',
                destination: '/docs/quickstart',
                step: 'open_full_quickstart',
              })
            }
          >
            {copy.nextCta}
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  )
}
