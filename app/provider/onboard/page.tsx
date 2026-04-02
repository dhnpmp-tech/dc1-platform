'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import ProviderRegistrationWizard from '../components/ProviderRegistrationWizard'

interface ProviderAvailabilityItem {
  is_live?: boolean | null
  gpu_count?: number | null
}

export default function ProviderOnboardPage() {
  const router = useRouter()
  const [providersOnline, setProvidersOnline] = useState<number | null>(null)
  const [gpusOnline, setGpusOnline] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const deriveStats = (providers: ProviderAvailabilityItem[]) => {
      const hasLiveFlag = providers.some((p) => typeof p?.is_live === 'boolean')
      const liveProviders = hasLiveFlag ? providers.filter((p) => p?.is_live) : providers
      const providerCount = liveProviders.length
      const gpuCount = liveProviders.reduce((sum, provider) => {
        const parsed = Number(provider?.gpu_count)
        if (Number.isFinite(parsed) && parsed > 0) return sum + parsed
        return sum + 1
      }, 0)
      return { providerCount, gpuCount }
    }

    const parseProviders = (payload: unknown): ProviderAvailabilityItem[] => {
      if (Array.isArray(payload)) return payload as ProviderAvailabilityItem[]
      if (payload && typeof payload === 'object') {
        const asObject = payload as { providers?: unknown; data?: unknown }
        if (Array.isArray(asObject.providers)) return asObject.providers as ProviderAvailabilityItem[]
        if (Array.isArray(asObject.data)) return asObject.data as ProviderAvailabilityItem[]
      }
      return []
    }

    const loadLiveStats = async () => {
      const endpoints = ['/api/dc1/providers/public', '/api/dc1/providers/available']
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, { cache: 'no-store' })
          if (!response.ok) continue
          const data = await response.json()
          const providers = parseProviders(data)
          const { providerCount, gpuCount } = deriveStats(providers)
          if (!cancelled) {
            setProvidersOnline(providerCount)
            setGpusOnline(gpuCount)
          }
          return
        } catch {
          // Try the next endpoint.
        }
      }
    }

    void loadLiveStats()
    const interval = window.setInterval(loadLiveStats, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  return (
    <>
      <Header />
      <main className="min-h-screen bg-dc1-void px-4 py-12">
        <div className="mx-auto max-w-2xl">
          {/* Page header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-dc1-text-primary">
              Start earning with your GPU
            </h1>
            <p className="mt-2 text-dc1-text-secondary">
              {providersOnline !== null || gpusOnline !== null
                ? `${providersOnline ?? '—'} providers online${gpusOnline !== null ? ` | ${gpusOnline} GPUs online` : ''}. Setup takes under 5 minutes.`
                : 'Join the DCP network and start earning with your GPU. Setup takes under 5 minutes.'}
            </p>
          </div>

          <ProviderRegistrationWizard
            onComplete={(providerId) => {
              router.push(`/provider/dashboard?welcome=1&id=${encodeURIComponent(providerId)}`)
            }}
          />

          <p className="mt-6 text-center text-xs text-dc1-text-muted">
            Already have an account?{' '}
            <a href="/provider/register" className="text-dc1-amber hover:underline">
              Sign in to your provider dashboard
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
