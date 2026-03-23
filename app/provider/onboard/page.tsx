'use client'

import { useRouter } from 'next/navigation'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import ProviderRegistrationWizard from '../components/ProviderRegistrationWizard'

export default function ProviderOnboardPage() {
  const router = useRouter()

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
              Join 43+ providers already on the DCP network. Setup takes under 5 minutes.
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
