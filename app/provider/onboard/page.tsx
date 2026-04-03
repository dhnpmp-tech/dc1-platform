'use client'

import { useRouter } from 'next/navigation'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import ProviderRegistrationWizard from '../components/ProviderRegistrationWizard'
import { usePublicMetricsContract } from '../../lib/usePublicMetricsContract'

export default function ProviderOnboardPage() {
  const router = useRouter()
  const { snapshot } = usePublicMetricsContract()

  const registeredProviders = snapshot?.providersRegistered ?? null
  const snapshotAt = snapshot?.snapshotAt
    ? new Date(snapshot.snapshotAt).toLocaleString()
    : null
  const networkSnapshotCopy = registeredProviders !== null
    ? `Network snapshot: ${registeredProviders.toLocaleString()} providers registered${snapshotAt ? ` (updated ${snapshotAt})` : ''}.`
    : 'Network snapshot is temporarily unavailable. Setup still takes under 5 minutes.'

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
              {networkSnapshotCopy}
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
