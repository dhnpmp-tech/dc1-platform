'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import ProviderOnboardingWizard from '../components/ProviderOnboardingWizard'

const SESSION_KEY = 'dcp_provider_credentials'

interface ProviderCredentials {
  providerId: string
  apiKey: string
}

function loadCredentials(params: URLSearchParams): ProviderCredentials | null {
  // 1. From URL params (deep-link after registration)
  const urlProviderId = params.get('providerId') ?? params.get('provider_id')
  const urlApiKey = params.get('apiKey') ?? params.get('api_key')
  if (urlProviderId && urlApiKey) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ providerId: urlProviderId, apiKey: urlApiKey }))
    } catch { /* ignore */ }
    return { providerId: urlProviderId, apiKey: urlApiKey }
  }

  // 2. From session storage (page refresh during wizard)
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ProviderCredentials
      if (parsed.providerId && parsed.apiKey) return parsed
    }
  } catch { /* ignore */ }

  return null
}

function WizardContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [credentials, setCredentials] = useState<ProviderCredentials | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const creds = loadCredentials(params)
    setCredentials(creds)
    setLoaded(true)
  }, [params])

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-dc1-amber border-t-transparent" />
      </div>
    )
  }

  if (!credentials) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-8 text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="text-xl font-bold text-dc1-text-primary mb-2">No provider credentials found</h2>
        <p className="text-sm text-dc1-text-secondary mb-6">
          You need a provider account to use this wizard. Register first to get your API key.
        </p>
        <a
          href="/provider/onboard"
          className="btn-primary inline-block px-6 py-2.5 text-sm"
        >
          Register as a provider →
        </a>
      </div>
    )
  }

  return (
    <ProviderOnboardingWizard
      providerId={credentials.providerId}
      apiKey={credentials.apiKey}
      onComplete={() => {
        try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
        router.push('/provider/dashboard?activated=1')
      }}
    />
  )
}

export default function ProviderWizardPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-dc1-void px-4 py-12">
        <div className="mx-auto max-w-2xl">
          {/* Page header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-dc1-text-primary">
              Activate your GPU
            </h1>
            <p className="mt-2 text-dc1-text-secondary">
              Complete setup in under 15 minutes and start earning.
            </p>
          </div>

          <Suspense
            fallback={
              <div className="flex items-center justify-center py-24">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-dc1-amber border-t-transparent" />
              </div>
            }
          >
            <WizardContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  )
}
