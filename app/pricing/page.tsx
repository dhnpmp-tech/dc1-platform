'use client'

/**
 * Public /pricing page — per-token rate card.
 *
 * Mounts <ModelRateCard /> as the primary content. Designed for the public
 * marketing site, not the renter dashboard. Bilingual via useLanguage().
 */

import Link from 'next/link'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import { useLanguage } from '../lib/i18n'
import ModelRateCard from '../components/pricing/ModelRateCard'

export default function PublicPricingPage() {
  const { t, dir } = useLanguage()

  return (
    <div className="min-h-screen flex flex-col" dir={dir}>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-dc1-border bg-gradient-to-b from-dc1-amber/5 to-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dc1-amber/10 border border-dc1-amber/20 text-dc1-amber text-xs font-medium mb-5">
                {t('rate_card.draft_notice')}
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-dc1-text-primary mb-4 leading-tight">
                {t('pricing.page.title')}
              </h1>
              <p className="text-dc1-text-secondary text-lg mb-8 leading-relaxed">
                {t('pricing.page.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/renter/register" className="btn btn-primary btn-lg">
                  {t('pricing.page.cta')}
                </Link>
                <Link href="/marketplace" className="btn btn-secondary btn-lg">
                  {t('pricing.page.cta_secondary')}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Rate card */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <ModelRateCard variant="full" />
        </section>
      </main>

      <Footer />
    </div>
  )
}
