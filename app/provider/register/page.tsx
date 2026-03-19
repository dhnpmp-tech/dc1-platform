'use client'

import { useState, useEffect } from 'react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

interface RegistrationFormData {
  fullName: string
  email: string
  gpuModel: string
  operatingSystem: string
  phone: string
  pdplConsent: boolean
}

interface StatusStep {
  step: number
  label: string
  status: 'pending' | 'in-progress' | 'completed'
}

export default function ProviderRegisterPage() {
  const [formData, setFormData] = useState<RegistrationFormData>({
    fullName: '',
    email: '',
    gpuModel: '',
    operatingSystem: '',
    phone: '',
    pdplConsent: false,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [providerId, setProviderId] = useState('')
  const [statusSteps, setStatusSteps] = useState<StatusStep[]>([
    { step: 1, label: 'Registered', status: 'pending' },
    { step: 2, label: 'Daemon Installed', status: 'pending' },
    { step: 3, label: 'Connected', status: 'pending' },
    { step: 4, label: 'Ready for Jobs', status: 'pending' },
  ])
  const [showSuccess, setShowSuccess] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Validate form
  const validateForm = () => {
    if (!formData.fullName.trim()) {
      setError('Full name is required')
      return false
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Valid email address is required')
      return false
    }
    if (!formData.gpuModel) {
      setError('GPU model is required')
      return false
    }
    if (!formData.operatingSystem) {
      setError('Operating system is required')
      return false
    }
    if (!formData.pdplConsent) {
      setError('You must consent to data processing to register')
      return false
    }
    return true
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE}/providers/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.fullName,
          email: formData.email,
          gpu_model: formData.gpuModel,
          os: formData.operatingSystem,
          phone: formData.phone || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Registration failed')
      }

      const data = await response.json()
      setApiKey(data.api_key)
      setProviderId(String(data.provider_id))

      // Store provider key for dashboard access
      localStorage.setItem('dc1_provider_key', data.api_key)

      // Mark first step as completed
      setStatusSteps((prev) =>
        prev.map((s) => (s.step === 1 ? { ...s, status: 'completed' } : s))
      )

      setShowSuccess(true)
      startStatusPolling(data.api_key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Poll provider status via heartbeat
  const startStatusPolling = (key: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/providers/me?key=${encodeURIComponent(key)}`)
        if (!response.ok) return

        const data = await response.json()
        const provider = data.provider || {}

        // Determine current step based on provider status
        let currentStep = 1 // registered
        if (provider.status === 'online' || provider.status === 'idle') {
          currentStep = 4 // fully connected and ready
        } else if (provider.last_heartbeat) {
          currentStep = 3 // connected (sent heartbeat)
        } else if (provider.status === 'registered') {
          currentStep = 1 // just registered, waiting for daemon
        }

        setStatusSteps((prev) =>
          prev.map((s) => {
            if (s.step < currentStep) return { ...s, status: 'completed' }
            if (s.step === currentStep) return { ...s, status: 'in-progress' }
            return s
          })
        )

        // Stop polling if all steps are completed
        if (currentStep >= 4) {
          setStatusSteps((prev) =>
            prev.map((s) => ({ ...s, status: 'completed' }))
          )
          clearInterval(interval)
        }
      } catch (err) {
        console.error('Failed to fetch status:', err)
      }
    }, 5000)

    return () => clearInterval(interval)
  }

  // Copy to clipboard
  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  if (showSuccess && apiKey) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-dc1-void">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            {/* Success Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-success/10 mb-6">
                <svg
                  className="w-8 h-8 text-status-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-dc1-text-primary mb-4">
                Registration Successful!
              </h1>
              <p className="text-dc1-text-secondary text-lg">
                Your provider account has been created. Follow the steps below to connect your
                hardware to DC1.
              </p>
            </div>

            <div className="space-y-8">
              {/* API Key Card */}
              <div className="card">
                <h2 className="text-xl font-semibold text-dc1-text-primary mb-4 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-dc1-amber/20 text-dc1-amber font-bold text-sm">
                    1
                  </span>
                  Your API Key
                </h2>
                <p className="text-dc1-text-secondary mb-4">
                  Save this API key securely. You'll use it to authenticate your daemon.
                </p>
                <div className="relative bg-dc1-surface-l3 rounded-md border border-dc1-border p-4 font-mono text-sm">
                  <code className="text-dc1-amber break-all">{apiKey}</code>
                  <button
                    onClick={() => copyToClipboard(apiKey, 0)}
                    className="absolute top-3 right-3 p-2 rounded-md hover:bg-dc1-surface-l2 transition-colors"
                    title="Copy API key"
                  >
                    {copiedIndex === 0 ? (
                      <svg
                        className="w-5 h-5 text-status-success"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-dc1-text-secondary hover:text-dc1-text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Installation Instructions */}
              <div className="card">
                <h2 className="text-xl font-semibold text-dc1-text-primary mb-4 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-dc1-amber/20 text-dc1-amber font-bold text-sm">
                    2
                  </span>
                  Install the Daemon
                </h2>
                <p className="text-dc1-text-secondary mb-6">
                  Run the appropriate command for your operating system:
                </p>

                <div className="space-y-4">
                  {/* Linux Instructions */}
                  <div>
                    <h3 className="text-sm font-semibold text-dc1-text-primary mb-2">
                      Linux (Ubuntu/Debian)
                    </h3>
                    <div className="relative bg-dc1-surface-l3 rounded-md border border-dc1-border p-4 font-mono text-xs overflow-x-auto">
                      <code className="text-dc1-amber">
                        curl -fsSL http://76.13.179.86:8083/api/providers/download/daemon?key={apiKey} -o dc1_daemon.py && python3 dc1_daemon.py
                      </code>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `curl -fsSL http://76.13.179.86:8083/api/providers/download/daemon?key=${apiKey} -o dc1_daemon.py && python3 dc1_daemon.py`,
                            1
                          )
                        }
                        className="absolute top-3 right-3 p-2 rounded-md hover:bg-dc1-surface-l2 transition-colors"
                        title="Copy installation command"
                      >
                        {copiedIndex === 1 ? (
                          <svg
                            className="w-5 h-5 text-status-success"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 text-dc1-text-secondary hover:text-dc1-text-primary"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Windows Instructions */}
                  <div>
                    <h3 className="text-sm font-semibold text-dc1-text-primary mb-2">
                      Windows PowerShell
                    </h3>
                    <div className="relative bg-dc1-surface-l3 rounded-md border border-dc1-border p-4 font-mono text-xs overflow-x-auto">
                      <code className="text-dc1-amber">
                        irm http://76.13.179.86:8083/api/providers/download/setup?key={apiKey}&os=windows | iex
                      </code>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `irm http://76.13.179.86:8083/api/providers/download/setup?key=${apiKey}&os=windows | iex`,
                            2
                          )
                        }
                        className="absolute top-3 right-3 p-2 rounded-md hover:bg-dc1-surface-l2 transition-colors"
                        title="Copy installation command"
                      >
                        {copiedIndex === 2 ? (
                          <svg
                            className="w-5 h-5 text-status-success"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 text-dc1-text-secondary hover:text-dc1-text-primary"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Tracker */}
              <div className="card">
                <h2 className="text-xl font-semibold text-dc1-text-primary mb-6 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-dc1-amber/20 text-dc1-amber font-bold text-sm">
                    3
                  </span>
                  Setup Progress
                </h2>
                <div className="space-y-4">
                  {statusSteps.map((step, idx) => (
                    <div key={step.step} className="flex items-center gap-4">
                      <div className="relative flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                            step.status === 'completed'
                              ? 'bg-status-success text-white'
                              : step.status === 'in-progress'
                                ? 'bg-dc1-amber text-white animate-pulse'
                                : 'bg-dc1-surface-l2 text-dc1-text-secondary'
                          }`}
                        >
                          {step.status === 'completed' ? (
                            <svg
                              className="w-6 h-6"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            step.step
                          )}
                        </div>
                        {idx < statusSteps.length - 1 && (
                          <div
                            className={`w-1 h-8 mt-1 transition-all duration-300 ${
                              step.status === 'completed'
                                ? 'bg-status-success'
                                : 'bg-dc1-border'
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-dc1-text-primary">
                          {step.label}
                        </h3>
                        <p className="text-sm text-dc1-text-secondary">
                          {step.status === 'completed'
                            ? 'Complete'
                            : step.status === 'in-progress'
                              ? 'In progress...'
                              : 'Pending'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 rounded-md bg-status-info/5 border border-status-info/20">
                  <p className="text-sm text-status-info">
                    The status will update automatically as your daemon connects and starts
                    accepting jobs. This typically takes 1-2 minutes.
                  </p>
                </div>
              </div>

              {/* Next Steps */}
              <div className="card border-dc1-amber/20">
                <h2 className="text-xl font-semibold text-dc1-text-primary mb-4">What's Next?</h2>
                <ul className="space-y-3">
                  <li className="flex gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-dc1-amber/20 text-dc1-amber text-sm font-semibold flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-dc1-text-secondary">
                      Monitor your daemon status in the{' '}
                      <a href="/provider/dashboard" className="text-dc1-amber hover:underline">
                        provider dashboard
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-dc1-amber/20 text-dc1-amber text-sm font-semibold flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-dc1-text-secondary">
                      Configure GPU pricing and availability settings
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-dc1-amber/20 text-dc1-amber text-sm font-semibold flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-dc1-text-secondary">
                      Start receiving jobs from renters on the platform
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-dc1-amber/20 text-dc1-amber text-sm font-semibold flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-dc1-text-secondary">
                      Check{' '}
                      <a href="/docs" className="text-dc1-amber hover:underline">
                        our documentation
                      </a>{' '}
                      for advanced configuration
                    </span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="/provider/dashboard"
                  className="btn btn-primary flex-1 text-center"
                >
                  Go to Dashboard
                </a>
                <a
                  href="/docs/provider-guide"
                  className="btn btn-secondary flex-1 text-center"
                >
                  Read Documentation
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
      <main className="min-h-screen bg-dc1-void">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-dc1-amber/10 to-dc1-void border-b border-dc1-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl font-bold text-dc1-text-primary mb-4">
                Monetize Your GPU Hardware
              </h1>
              <p className="text-lg text-dc1-text-secondary max-w-2xl mx-auto">
                Join the DC1 GPU compute marketplace and start earning by renting your idle
                GPU capacity to researchers, AI developers, and enterprises.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2 text-dc1-text-secondary">
                  <svg className="w-5 h-5 text-status-success" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Transparent pricing</span>
                </div>
                <div className="flex items-center gap-2 text-dc1-text-secondary">
                  <svg className="w-5 h-5 text-status-success" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Easy setup</span>
                </div>
                <div className="flex items-center gap-2 text-dc1-text-secondary">
                  <svg className="w-5 h-5 text-status-success" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Instant payouts</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Registration Form */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="card">
            <h2 className="text-2xl font-bold text-dc1-text-primary mb-2">
              Create Your Provider Account
            </h2>
            <p className="text-dc1-text-secondary mb-8">
              Fill in your details to get started. It takes less than 2 minutes to register.
            </p>

            {error && (
              <div className="alert alert-error mb-6">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="label">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  className="input"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="label">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="john@example.com"
                  className="input"
                  required
                />
              </div>

              {/* GPU Model */}
              <div>
                <label htmlFor="gpuModel" className="label">
                  GPU Model
                </label>
                <select
                  id="gpuModel"
                  name="gpuModel"
                  value={formData.gpuModel}
                  onChange={handleInputChange}
                  className="input"
                  required
                >
                  <option value="">Select a GPU model</option>
                  <option value="RTX 4090">NVIDIA RTX 4090</option>
                  <option value="RTX 3090">NVIDIA RTX 3090</option>
                  <option value="RTX 3080">NVIDIA RTX 3080</option>
                  <option value="A100">NVIDIA A100</option>
                  <option value="H100">NVIDIA H100</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Operating System */}
              <div>
                <label htmlFor="operatingSystem" className="label">
                  Operating System
                </label>
                <select
                  id="operatingSystem"
                  name="operatingSystem"
                  value={formData.operatingSystem}
                  onChange={handleInputChange}
                  className="input"
                  required
                >
                  <option value="">Select operating system</option>
                  <option value="Windows 10/11">Windows 10/11</option>
                  <option value="Ubuntu 22.04">Ubuntu 22.04</option>
                  <option value="Ubuntu 20.04">Ubuntu 20.04</option>
                  <option value="Other Linux">Other Linux</option>
                </select>
              </div>

              {/* Phone (Optional) */}
              <div>
                <label htmlFor="phone" className="label">
                  Phone Number <span className="text-dc1-text-muted">(optional)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+1 (555) 000-0000"
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
                    I consent to DC1 collecting and processing my personal data (name, email, IP address, GPU metrics) as described in the{' '}
                    <a href="/privacy" className="text-dc1-amber hover:underline">Privacy Policy</a>.
                    {' '}I understand my data is processed on servers outside Saudi Arabia (Lithuania/US) and I consent to this cross-border transfer. I agree to the{' '}
                    <a href="/terms" className="text-dc1-amber hover:underline">Terms of Service</a>.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full btn-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>

              {/* Sign In Link */}
              <p className="text-center text-sm text-dc1-text-secondary">
                Already have an account?{' '}
                <a href="/login" className="text-dc1-amber hover:underline font-semibold">
                  Sign In
                </a>
              </p>
            </form>
          </div>

          {/* Additional Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="card text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-dc1-amber/20 mb-4">
                <svg className="w-6 h-6 text-dc1-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-dc1-text-primary mb-2">Fast Setup</h3>
              <p className="text-sm text-dc1-text-secondary">
                Install the daemon in minutes and start earning immediately.
              </p>
            </div>

            <div className="card text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-dc1-amber/20 mb-4">
                <svg className="w-6 h-6 text-dc1-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-dc1-text-primary mb-2">Earn More</h3>
              <p className="text-sm text-dc1-text-secondary">
                Set your own prices and maximize revenue from idle hardware.
              </p>
            </div>

            <div className="card text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-dc1-amber/20 mb-4">
                <svg className="w-6 h-6 text-dc1-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-dc1-text-primary mb-2">Secure & Reliable</h3>
              <p className="text-sm text-dc1-text-secondary">
                Enterprise-grade security and 99.9% uptime SLA.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
