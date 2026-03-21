'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Footer from '../components/layout/Footer'
import { useLanguage } from '../lib/i18n'

function ContactForm({ t, initialCategory }: { t: (key: string) => string; initialCategory: string }) {
  const [form, setForm] = useState({ name: '', email: '', category: initialCategory || 'general', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const categoryOptions = [
    { value: 'general', label: t('support.form.category.general') },
    { value: 'account', label: t('support.form.category.account') },
    { value: 'billing', label: t('support.form.category.billing') },
    { value: 'provider', label: t('support.form.category.provider') },
    { value: 'renter', label: t('support.form.category.renter') },
    { value: 'bug', label: t('support.form.category.bug') },
    { value: 'enterprise', label: t('support.form.category.enterprise') },
  ]

  useEffect(() => {
    const hasCategory = categoryOptions.some((option) => option.value === initialCategory)
    const nextCategory = hasCategory ? initialCategory : 'general'
    setForm((prev) => ({ ...prev, category: nextCategory }))
  }, [initialCategory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const API = '/api/dc1';
      const res = await fetch(`${API}/support/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus('sent');
        setForm({ name: '', email: '', category: 'general', message: '' });
      } else {
        // If endpoint doesn't exist yet, fall back to mailto
        setStatus('sent');
        window.location.href = `mailto:support@dcp.sa?subject=[${form.category}] Support Request from ${form.name}&body=${encodeURIComponent(form.message)}`;
      }
    } catch {
      // Fallback to mailto if API unreachable
      setStatus('sent');
      window.location.href = `mailto:support@dcp.sa?subject=[${form.category}] Support Request from ${form.name}&body=${encodeURIComponent(form.message)}`;
    }
  };

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold text-dc1-text-primary mb-6">{t('support.form.title')}</h2>
      {status === 'sent' ? (
        <div className="card text-center py-8">
          <div className="text-3xl mb-3">✅</div>
          <p className="text-dc1-text-primary font-semibold mb-1">{t('support.form.sent_title')}</p>
          <p className="text-sm text-dc1-text-secondary">{t('support.form.sent_subtitle')}</p>
          <button onClick={() => setStatus('idle')} className="mt-4 text-sm text-dc1-amber hover:underline">{t('support.form.send_another')}</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-dc1-text-secondary mb-1">{t('support.form.name')}</label>
              <input
                type="text" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-3 py-2 text-sm text-dc1-text-primary placeholder-dc1-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-dc1-amber"
                placeholder={t('support.form.name_placeholder')}
              />
            </div>
            <div>
              <label className="block text-sm text-dc1-text-secondary mb-1">{t('support.form.email')}</label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-3 py-2 text-sm text-dc1-text-primary placeholder-dc1-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-dc1-amber"
                placeholder={t('support.form.email_placeholder')}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-dc1-text-secondary mb-1">{t('support.form.category')}</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-3 py-2 text-sm text-dc1-text-primary focus:outline-none focus:ring-1 focus:ring-dc1-amber"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-dc1-text-secondary mb-1">{t('support.form.message')}</label>
            <textarea
              required value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={5}
              className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-3 py-2 text-sm text-dc1-text-primary placeholder-dc1-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-dc1-amber resize-none"
              placeholder={t('support.form.message_placeholder')}
            />
          </div>
          <button
            type="submit"
            disabled={status === 'sending'}
            className="bg-dc1-amber text-dc1-void px-6 py-2 rounded-lg font-semibold text-sm hover:bg-dc1-amber/90 transition-colors disabled:opacity-50"
          >
            {status === 'sending' ? t('support.form.sending') : t('support.form.submit')}
          </button>
        </form>
      )}
    </div>
  );
}

function SupportPageInner() {
  const { t, isRTL } = useLanguage()
  const searchParams = useSearchParams()
  const requestedCategory = (searchParams.get('category') || '').toLowerCase()
  const prefilledCategory = requestedCategory === 'enterprise' ? 'enterprise' : 'general'

  useEffect(() => {
    if (prefilledCategory !== 'enterprise') return
    const detail = {
      event: 'support_enterprise_prefill_loaded',
      source: searchParams.get('source') || 'direct',
      category: 'enterprise',
    }
    window.dispatchEvent(new CustomEvent('dc1_analytics', { detail }))
    const win = window as typeof window & { dataLayer?: Array<Record<string, unknown>> }
    if (Array.isArray(win.dataLayer)) {
      win.dataLayer.push(detail)
    }
  }, [prefilledCategory, searchParams])

  const supportChannels = [
    { title: t('support.channels.email.title'), description: t('support.channels.email.desc'), contact: 'support@dcp.sa', icon: '✉' },
    { title: t('support.channels.abuse.title'), description: t('support.channels.abuse.desc'), contact: 'abuse@dcp.sa', icon: '⚠' },
    { title: t('support.channels.privacy.title'), description: t('support.channels.privacy.desc'), contact: 'privacy@dcp.sa', icon: '🔒' },
  ]

  const faqs = [
    { q: t('support.faq.q1'), a: t('support.faq.a1') },
    { q: t('support.faq.q2'), a: t('support.faq.a2') },
    { q: t('support.faq.q3'), a: t('support.faq.a3') },
    { q: t('support.faq.q4'), a: t('support.faq.a4') },
    { q: t('support.faq.q5'), a: t('support.faq.a5') },
  ]

  return (
    <div className="min-h-screen bg-dc1-void" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="bg-dc1-surface-l1 border-b border-dc1-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.svg" alt="DCP" className="h-8 w-auto" />
            <span className="text-lg font-bold text-dc1-text-primary">DCP</span>
          </Link>
          <Link href="/login" className="text-sm text-dc1-amber hover:underline">{t('auth.sign_in')}</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">{t('support.page_title')}</h1>
        <p className="text-dc1-text-secondary mb-10">{t('support.page_subtitle')}</p>
        {prefilledCategory === 'enterprise' && (
          <div className="mb-8 space-y-3">
            <div className="rounded-xl border border-dc1-amber/30 bg-dc1-amber/10 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-dc1-amber font-semibold mb-1">
                {t('support.enterprise_prefill_label')}
              </p>
              <p className="text-sm text-dc1-text-secondary">{t('support.enterprise_prefill_desc')}</p>
            </div>
            <div className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-4">
              <p className="text-sm font-semibold text-dc1-text-primary mb-2">
                {t('support.enterprise_checklist_title')}
              </p>
              <p className="text-sm text-dc1-text-secondary mb-2">{t('support.enterprise_checklist_intro')}</p>
              <ul className="list-disc text-sm text-dc1-text-secondary ps-5 space-y-1">
                <li>{t('support.enterprise_checklist_item_use_case')}</li>
                <li>{t('support.enterprise_checklist_item_usage_volume')}</li>
                <li>{t('support.enterprise_checklist_item_compliance')}</li>
                <li>{t('support.enterprise_checklist_item_timeline')}</li>
              </ul>
            </div>
          </div>
        )}

        {/* Contact channels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {supportChannels.map((ch) => (
            <div key={ch.title} className="card">
              <div className="text-2xl mb-3">{ch.icon}</div>
              <h2 className="text-lg font-semibold text-dc1-text-primary mb-2">{ch.title}</h2>
              <p className="text-sm text-dc1-text-secondary mb-3">{ch.description}</p>
              <a href={`mailto:${ch.contact}`} className="text-sm text-dc1-amber hover:underline">{ch.contact}</a>
            </div>
          ))}
        </div>

        {/* Contact Form */}
        <ContactForm t={t} initialCategory={prefilledCategory} />

        {/* FAQ */}
        <h2 className="text-2xl font-bold text-dc1-text-primary mb-6">{t('support.faq.title')}</h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="card">
              <h3 className="text-base font-semibold text-dc1-text-primary mb-2">{faq.q}</h3>
              <p className="text-sm text-dc1-text-secondary">{faq.a}</p>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1117]" />}>
      <SupportPageInner />
    </Suspense>
  )
}
