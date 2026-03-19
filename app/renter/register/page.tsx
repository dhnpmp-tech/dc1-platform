'use client'

import { useState } from 'react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

interface RegistrationResult {
  renter_id: number
  api_key: string
  message: string
}

export default function RenterRegisterPage() {
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
      setError('You must consent to data processing to register')
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

  if (success && result) {
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
              <h2 className="text-3xl font-bold text-dc1-text-primary mb-2">Welcome to DC1!</h2>
              <p className="text-dc1-text-secondary mb-8">{result.message}</p>

              <div className="bg-dc1-surface-l3 border border-dc1-border rounded-lg p-6 mb-6 text-left">
                <p className="text-sm text-dc1-text-secondary mb-2">Your API Key</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono text-dc1-amber break-all">{result.api_key}</code>
                  <button
                    onClick={copyApiKey}
                    className="btn btn-secondary btn-sm"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <p className="text-sm text-status-warning bg-status-warning/5 border border-status-warning/20 rounded-lg p-4 mb-6">
                Keep this key secure. You'll need it to access the GPU marketplace and submit jobs.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a href="/renter" className="btn btn-primary flex-1">
                  Go to Dashboard
                </a>
                <a href="/" className="btn btn-secondary flex-1">
                  Back to Home
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
              Access GPU Compute Power
            </h1>
            <p className="text-xl text-dc1-text-secondary max-w-2xl mx-auto">
              Rent powerful GPUs for your AI training, inference, and scientific computing needs. Pay only for what you use.
            </p>
          </div>
        </section>

        {/* Registration Form */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="card bg-dc1-surface-l1 border border-dc1-border rounded-lg p-8">
            <h2 className="text-2xl font-bold text-dc1-text-primary mb-6">Register as a Renter</h2>

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
                  Full Name <span className="text-status-error">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="John Doe"
                  className="input"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="label">
                  Email <span className="text-status-error">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  className="input"
                />
              </div>

              {/* Company/Organization */}
              <div>
                <label htmlFor="organization" className="label">
                  Company/Organization <span className="text-dc1-text-muted">(Optional)</span>
                </label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  placeholder="Your Company Name"
                  className="input"
                />
              </div>

              {/* Use Case */}
              <div>
                <label htmlFor="useCase" className="label">
                  Primary Use Case <span className="text-status-error">*</span>
                </label>
                <select
                  id="useCase"
                  name="useCase"
                  value={formData.useCase}
                  onChange={handleChange}
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
                  Phone <span className="text-dc1-text-muted">(Optional)</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
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
                    I consent to DC1 collecting and processing my personal data (name, email, billing history, job history) as described in the{' '}
                    <a href="/privacy" className="text-dc1-amber hover:underline">Privacy Policy</a>.
                    {' '}I understand my data is processed on servers outside Saudi Arabia (Lithuania/US) and I consent to this cross-border transfer. I agree to the{' '}
                    <a href="/terms" className="text-dc1-amber hover:underline">Terms of Service</a>.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? 'Creating Account...' : 'Create Renter Account'}
              </button>

              <p className="text-center text-sm text-dc1-text-secondary">
                Already have an account?{' '}
                <a href="/renter" className="text-dc1-amber hover:underline">
                  Sign in here
                </a>
              </p>
            </form>
          </div>
        </section>

        {/* Features Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <h3 className="section-heading mb-8">What You Can Do</h3>
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
              <h4 className="text-lg font-semibold text-dc1-text-primary mb-2">Browse Marketplace</h4>
              <p className="text-sm text-dc1-text-secondary">
                Discover available GPUs from providers worldwide. Filter by model, performance, and price to find the perfect fit for your workload.
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
              <h4 className="text-lg font-semibold text-dc1-text-primary mb-2">Submit Jobs</h4>
              <p className="text-sm text-dc1-text-secondary">
                Easily submit your AI training and inference jobs. Monitor progress in real-time and get detailed metrics.
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
              <h4 className="text-lg font-semibold text-dc1-text-primary mb-2">Pay Per Use</h4>
              <p className="text-sm text-dc1-text-secondary">
                Transparent pricing with no long-term contracts. Pay only for the compute resources you actually use.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
