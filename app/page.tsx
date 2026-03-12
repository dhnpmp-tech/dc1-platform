'use client'

import Link from 'next/link'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'

const features = [
  {
    title: 'For GPU Providers',
    description: 'Monetize your idle GPU power. List your hardware, set your pricing, and earn automatically when renters submit jobs.',
    cta: 'Start Earning',
    href: '/provider/register',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
  },
  {
    title: 'For Renters',
    description: 'Access powerful GPUs on demand. Submit AI training jobs, run inference, and generate images at competitive prices.',
    cta: 'Rent GPUs',
    href: '/renter/register',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Transparent Pricing',
    description: 'Real-time pricing, clear job tracking, and guaranteed payouts. 75% goes directly to providers.',
    cta: 'View Marketplace',
    href: '/renter/marketplace',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
]

const stats = [
  { value: '500+', label: 'GPUs Available' },
  { value: '10K+', label: 'Jobs Completed' },
  { value: '99.9%', label: 'Uptime' },
  { value: '< 5s', label: 'Job Dispatch' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-dc1-amber/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-dc1-amber/10 border border-dc1-amber/20 text-dc1-amber text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-dc1-amber rounded-full animate-pulse" />
              GPU Compute Marketplace
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
              <span className="text-dc1-text-primary">Power,</span>{' '}
              <span className="text-gradient-amber">Digitalized</span>
            </h1>
            <p className="text-lg sm:text-xl text-dc1-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
              The transparent, reliable GPU compute marketplace. Connect providers with renters for AI training, inference, and high-performance computing.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/provider/register" className="btn btn-primary btn-lg w-full sm:w-auto">
                Become a Provider
              </Link>
              <Link href="/renter/register" className="btn btn-secondary btn-lg w-full sm:w-auto">
                Rent GPUs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-dc1-border bg-dc1-surface-l1/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-dc1-amber">{stat.value}</p>
                <p className="text-sm text-dc1-text-secondary mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-4">
            Built for the GPU Economy
          </h2>
          <p className="text-dc1-text-secondary max-w-2xl mx-auto">
            Whether you have spare GPU capacity or need compute power, DC1 connects you with the right match.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="card-hover group">
              <div className="w-12 h-12 rounded-lg bg-dc1-amber/10 flex items-center justify-center text-dc1-amber mb-4 group-hover:bg-dc1-amber/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-dc1-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-dc1-text-secondary mb-4 leading-relaxed">{feature.description}</p>
              <Link
                href={feature.href}
                className="inline-flex items-center gap-1 text-sm font-medium text-dc1-amber hover:text-dc1-amber-hover transition-colors"
              >
                {feature.cta}
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-dc1-surface-l1 border-y border-dc1-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold text-dc1-text-primary text-center mb-16">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Register', desc: 'Sign up as a provider or renter in under 2 minutes' },
              { step: '02', title: 'Connect', desc: 'Providers install our daemon; renters browse the marketplace' },
              { step: '03', title: 'Compute', desc: 'Submit jobs and let DC1 match you with the best GPU' },
              { step: '04', title: 'Earn / Pay', desc: 'Transparent billing with 75/25 split for providers' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-dc1-amber/10 border border-dc1-amber/30 flex items-center justify-center text-dc1-amber font-bold text-sm mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-dc1-text-primary mb-2">{item.title}</h3>
                <p className="text-sm text-dc1-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="card border-dc1-amber/20 text-center py-12 px-8 glow-amber">
          <h2 className="text-2xl sm:text-3xl font-bold text-dc1-text-primary mb-4">
            Ready to Power Your Compute?
          </h2>
          <p className="text-dc1-text-secondary max-w-xl mx-auto mb-8">
            Join the DC1 marketplace today. Start earning from your GPUs or access affordable compute power.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/provider/register" className="btn btn-primary btn-lg">Register as Provider</Link>
            <Link href="/renter/register" className="btn btn-outline btn-lg">Register as Renter</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
