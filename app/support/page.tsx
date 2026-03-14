'use client';

import { useState } from 'react';
import Link from 'next/link'
import Footer from '@/app/components/layout/Footer'

const supportChannels = [
  { title: 'Email Support', description: 'For account issues, billing questions, and general inquiries.', contact: 'support@dc1st.com', icon: '✉' },
  { title: 'Abuse Reports', description: 'Report policy violations or suspicious activity.', contact: 'abuse@dc1st.com', icon: '⚠' },
  { title: 'Privacy Requests', description: 'Data access, correction, or deletion requests.', contact: 'privacy@dc1st.com', icon: '🔒' },
]

const faqs = [
  { q: 'How do I get my API key?', a: 'Your API key is generated automatically when you register as a provider or renter. It is shown once on the registration success screen — save it securely.' },
  { q: 'I lost my API key. How do I recover it?', a: 'Contact support@dc1st.com with your registered email address. We will verify your identity and issue a new key.' },
  { q: 'My daemon shows as offline. What should I do?', a: 'Ensure the Python process is running (check with `ps aux | grep dc1_daemon`). Verify your internet connection and that no firewall blocks outbound HTTPS.' },
  { q: 'How is billing calculated?', a: 'LLM inference is billed at 15 halala/minute, image generation at 20 halala/minute. Providers receive 75% and DC1 retains 25%.' },
  { q: 'Can I use DC1 for cryptocurrency mining?', a: 'No. Cryptocurrency mining is prohibited under our Acceptable Use Policy and will result in account termination.' },
]

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', category: 'general', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const API = typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? '/api/dc1' : 'http://76.13.179.86:8083/api';
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
        window.location.href = `mailto:support@dc1st.com?subject=[${form.category}] Support Request from ${form.name}&body=${encodeURIComponent(form.message)}`;
      }
    } catch {
      // Fallback to mailto if API unreachable
      setStatus('sent');
      window.location.href = `mailto:support@dc1st.com?subject=[${form.category}] Support Request from ${form.name}&body=${encodeURIComponent(form.message)}`;
    }
  };

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold text-dc1-text-primary mb-6">Send Us a Message</h2>
      {status === 'sent' ? (
        <div className="card text-center py-8">
          <div className="text-3xl mb-3">✅</div>
          <p className="text-dc1-text-primary font-semibold mb-1">Message sent!</p>
          <p className="text-sm text-dc1-text-secondary">We&apos;ll get back to you within 24 hours.</p>
          <button onClick={() => setStatus('idle')} className="mt-4 text-sm text-dc1-amber hover:underline">Send another message</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-dc1-text-secondary mb-1">Name</label>
              <input
                type="text" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-3 py-2 text-sm text-dc1-text-primary placeholder-dc1-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-dc1-amber"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm text-dc1-text-secondary mb-1">Email</label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-3 py-2 text-sm text-dc1-text-primary placeholder-dc1-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-dc1-amber"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-dc1-text-secondary mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-3 py-2 text-sm text-dc1-text-primary focus:outline-none focus:ring-1 focus:ring-dc1-amber"
            >
              <option value="general">General Inquiry</option>
              <option value="account">Account Issue</option>
              <option value="billing">Billing Question</option>
              <option value="provider">Provider Support</option>
              <option value="renter">Renter Support</option>
              <option value="bug">Bug Report</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-dc1-text-secondary mb-1">Message</label>
            <textarea
              required value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={5}
              className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-3 py-2 text-sm text-dc1-text-primary placeholder-dc1-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-dc1-amber resize-none"
              placeholder="Describe your issue or question..."
            />
          </div>
          <button
            type="submit"
            disabled={status === 'sending'}
            className="bg-dc1-amber text-dc1-void px-6 py-2 rounded-lg font-semibold text-sm hover:bg-dc1-amber/90 transition-colors disabled:opacity-50"
          >
            {status === 'sending' ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-dc1-void">
      <header className="bg-dc1-surface-l1 border-b border-dc1-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="https://dc1st.com/assets/dc1-logo-Z67caTEl.webp" alt="DC1" className="h-8 w-auto" />
            <span className="text-lg font-bold text-dc1-text-primary">DC1</span>
          </Link>
          <Link href="/login" className="text-sm text-dc1-amber hover:underline">Sign In</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Support</h1>
        <p className="text-dc1-text-secondary mb-10">Get help with the DC1 platform.</p>

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
        <ContactForm />

        {/* FAQ */}
        <h2 className="text-2xl font-bold text-dc1-text-primary mb-6">Frequently Asked Questions</h2>
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
