'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import { useLanguage } from '../../lib/i18n'

const API_BASE = '/api/dc1'

interface RegistrationResult {
  renter_id: number
  api_key: string
  message: string
}

export default function RenterRegisterPage() {
  const { t, language } = useLanguage()
  const isRTL = language === 'ar'
  const billingExplainerRef = useRef<HTMLDivElement | null>(null)
  const hasTrackedBillingExplainerView = useRef(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    useCase: 'AI Training',
    phone: '',
    pdplConsent: false,
  })

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [result, setResult] = useState<RegistrationResult | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const trackRegisterEvent = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') return
    const detail = { event, source: 'renter_register', ...payload }
    window.dispatchEvent(new CustomEvent('dc1_analytics', { detail }))
    const win = window as typeof window & {
      dataLayer?: Array<Record<string, unknown>>
      gtag?: (...args: unknown[]) => void
    }
    if (Array.isArray(win.dataLayer)) {
      win.dataLayer.push(detail)
    }
    if (typeof win.gtag === 'function') {
      win.gtag('event', event, detail)
    }
  }, [])

  const useCaseOptions = [
    'AI Training',
    'Inference',
    'Image Generation',
    'Scientific Computing',
    'Other',
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!formData.pdplConsent) {
      setError(t('register.renter.pdpl_error'))
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`${API_BASE}/renters/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          organization: formData.organization.trim() || undefined,
          use_case: formData.useCase.trim() || undefined,
          phone: formData.phone.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Registration failed')
      }

      const data = await res.json()
      setResult(data)
      setSuccess(true)
      localStorage.setItem('dc1_renter_key', data.api_key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const copyApiKey = () => {
    if (!result) return
    navigator.clipboard.writeText(result.api_key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const loginWithKey = () => {
    if (!result) return
    localStorage.setItem('dc1_renter_key', result.api_key)
    window.location.href = '/renter'
  }

  useEffect(() => {
    const node = billingExplainerRef.current
    if (!node || hasTrackedBillingExplainerView.current || success) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (hasTrackedBillingExplainerView.current) return
        if (entries.some((entry) => entry.isIntersecting)) {
          hasTrackedBillingExplainerView.current = true
          trackRegisterEvent('billing_explainer_viewed', { page: 'renter_register' })
          observer.disconnect()
        }
      },
      { threshold: 0.35 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [success, trackRegisterEvent])

  if (success && result) {
    const firstJobChecklist = isRTL
      ? [
          { label: 'سجّلت الحساب', href: '/renter/register' },
          { label: 'اشحن المحفظة', href: '/renter/billing' },
          { label: 'اختر GPU من السوق', href: '/renter/marketplace' },
          { label: 'أرسل وظيفة تجريبية', href: '/renter/playground?starter=1' },
          { label: 'راقب المخرجات والسجلات', href: '/renter/jobs' },
        ]
      : [
          { label: 'Register account', href: '/renter/register' },
          { label: 'Top up wallet', href: '/renter/billing' },
          { label: 'Choose GPU in marketplace', href: '/renter/marketplace' },
          { label: 'Submit starter job', href: '/renter/playground?starter=1' },
          { label: 'Monitor output and logs', href: '/renter/jobs' },
        ]

    return (
      <>
        <Header />
        <main className="min-h-screen bg-dc1-void flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-2xl">
            <div className="card bg-dc1-surface-l1 border border-dc1-border rounded-lg p-8 text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-status-success/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h2 className="text-3xl font-bold text-dc1-text-primary mb-2">{t('register.renter.success_title')}</h2>
              <p className="text-dc1-text-secondary mb-8">{result.message}</p>

              <div className="bg-dc1-surface-l3 border border-dc1-border rounded-lg p-6 mb-6 text-left">
                <p className="text-sm text-dc1-text-secondary mb-2">{t('register.renter.api_key_title')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono text-dc1-amber break-all">{result.api_key}</code>
                  <button
                    onClick={copyApiKey}
                    className="btn btn-secondary btn-sm"
                  >
                    {copied ? t('register.renter.copied') : t('register.renter.copy')}
                  </button>
                </div>
              </div>

              <p className="text-sm text-status-warning bg-status-warning/5 border border-status-warning/20 rounded-lg p-4 mb-6">
                {t('register.renter.key_security')}
              </p>

              <div className={`bg-dc1-surface-l2 border border-dc1-border rounded-lg p-5 mb-6 ${isRTL ? 'text-right' : 'text-left'}`}>
                <h3 className="text-base font-semibold text-dc1-text-primary mb-3">
                  {isRTL ? 'قائمة أول وظيفة للمستأجر' : 'Renter first-job checklist'}
                </h3>
                <ol className="space-y-2 text-sm text-dc1-text-secondary">
                  {firstJobChecklist.map((item, index) => (
                    <li key={item.href} className={`flex items-center justify-between gap-3 rounded-lg border border-dc1-border bg-dc1-surface-l3 px-3 py-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span>
                        {index + 1}. {item.label}
                      </span>
                      <a
                        href={item.href}
                        onClick={() =>
                          trackRegisterEvent('first_job_checklist_step_clicked', {
                            page: 'renter_register_success',
                            step_index: index + 1,
                            step_label: item.label,
                            destination: item.href,
                          })
                        }
                        className="text-xs font-medium text-dc1-amber hover:underline"
                      >
                        {isRTL ? 'افتح' : 'Open'}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a href="/renter" className="btn btn-primary flex-1">
                  {t('register.renter.go_dashboard')}
                </a>
                <a href="/" className="btn btn-secondary flex-1">
                  {t('register.renter.back_home')}
                </a>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-dc1-void py-12">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-dc1-text-primary mb-4">
              {t('register.renter.title')}
            </h1>
            <p className="text-xl text-dc1-text-secondary max-w-2xl mx-auto">
              {t('register.renter.subtitle_main')}
            </p>
          </div>
        </section>

        {/* Billing transparency */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div ref={billingExplainerRef} className="rounded-xl border border-dc1-amber/25 bg-dc1-amber/5 p-6">
            <h2 className="text-lg font-semibold text-dc1-text-primary mb-3">How DCP Billing Works</h2>
            <ul className="space-y-2 text-sm text-dc1-text-secondary">
              <li>1. We place a prepay estimate hold in halala before your job starts.</li>
              <li>2. Final cost settles on actual runtime, not the initial estimate.</li>
              <li>3. Any unused hold is automatically refunded in halala after completion.</li>
            </ul>
            <p className="mt-3 text-xs text-dc1-text-muted">100 halala = 1 SAR.</p>
          </div>
        </section>

        {/* Registration Form */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="card bg-dc1-surface-l1 border border-dc1-border rounded-lg p-8">
            <h2 className="text-2xl font-bold text-dc1-text-primary mb-6">{t('register.renter.form_title')}</h2>

            {error && (
              <div className="alert-error mb-6">
                <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div>
                <label htmlFor="name" className="label">
                  {t('register.renter.full_name')} <span className="text-status-error">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder={t('register.renter.full_name_placeholder')}
                  className="input"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="label">
                  {t('register.renter.email')} <span className="text-status-error">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder={t('register.renter.email_placeholder')}
                  className="input"
                />
              </div>

              {/* Company/Organization */}
              <div>
                <label htmlFor="organization" className="label">
                  {t('register.renter.organization')}
                </label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  placeholder={t('register.renter.org_placeholder_text')}
                  className="input"
                />
              </div>

              {/* Use Case */}
              <div>
                <label htmlFor="useCase" className="label">
                  {t('register.renter.use_case')} <span className="text-status-error">*</span>
                </label>
                <select
                  id="useCase"
                  name="useCase"
                  value={formData.useCase}
                  onChange={handleChange}
                  required
                  className="input"
                >
                  {useCaseOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="label">
                  {t('register.renter.phone')} <span className="text-dc1-text-muted">{t('register.renter.optional')}</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder={t('register.renter.phone_placeholder')}
                  className="input"
                />
              </div>

              {/* PDPL Consent */}
              <div className="p-4 rounded-lg bg-dc1-surface-l2 border border-dc1-border">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="pdplConsent"
                    checked={formData.pdplConsent}
                    onChange={(e) => setFormData(prev => ({ ...prev, pdplConsent: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded border-dc1-border accent-dc1-amber flex-shrink-0"
                    required
                  />
                  <span className="text-sm text-dc1-text-secondary">
                    {t('register.renter.pdpl_text')}{' '}
                    <a href="/privacy" className="text-dc1-amber hover:underline">{t('register.renter.privacy_policy')}</a>.
                    {' '}{t('register.renter.pdpl_text2')}{' '}
                    <a href="/terms" className="text-dc1-amber hover:underline">{t('register.renter.terms')}</a>.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? t('register.renter.submitting') : t('register.renter.submit')}
              </button>

              <p className="text-center text-sm text-dc1-text-secondary">
                {t('register.renter.already_registered')}{' '}
                <a href="/renter" className="text-dc1-amber hover:underline">
                  {t('register.renter.sign_in')}
                </a>
              </p>
            </form>
          </div>
        </section>

        {/* Features Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <h3 className="section-heading mb-8">{t('register.renter.what_you_can_do')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Browse Marketplace */}
            <div className="card-hover">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-dc1-amber/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-dc1-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
              </div>
              <h4 className="text-lg font-semibold text-dc1-text-primary mb-2">{t('register.renter.browse_title')}</h4>
              <p className="text-sm text-dc1-text-secondary">
                {t('register.renter.browse_desc')}
              </p>
            </div>

            {/* Card 2: Submit Jobs */}
            <div className="card-hover">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-dc1-amber/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-dc1-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <h4 className="text-lg font-semibold text-dc1-text-primary mb-2">{t('register.renter.submit_title')}</h4>
              <p className="text-sm text-dc1-text-secondary">
                {t('register.renter.submit_desc')}
              </p>
            </div>

            {/* Card 3: Pay Per Use */}
            <div className="card-hover">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-dc1-amber/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-dc1-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <h4 className="text-lg font-semibold text-dc1-text-primary mb-2">{t('register.renter.pay_title')}</h4>
              <p className="text-sm text-dc1-text-secondary">
                {t('register.renter.pay_desc')}
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
