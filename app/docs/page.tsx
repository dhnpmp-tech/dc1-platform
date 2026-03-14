import Link from 'next/link'
import Footer from '@/app/components/layout/Footer'

const docs = [
  {
    title: 'Provider Guide',
    description: 'Learn how to register your GPU, install the daemon, and start earning.',
    href: '/docs/provider-guide',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2m0 0v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4" />
      </svg>
    ),
  },
  {
    title: 'API Reference',
    description: 'Full documentation of the DC1 REST API for renters and providers.',
    href: '/docs/api',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    title: 'Renter Quickstart',
    description: 'Get started renting GPUs — from registration to your first inference job.',
    href: '/docs/renter-guide',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
]

export default function DocsPage() {
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
        <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Documentation</h1>
        <p className="text-dc1-text-secondary mb-10">Everything you need to get started with the DC1 GPU marketplace.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {docs.map((doc) => (
            <Link key={doc.href} href={doc.href} className="card group hover:border-dc1-amber/40 transition-colors">
              <div className="text-dc1-amber mb-4 group-hover:scale-110 transition-transform">{doc.icon}</div>
              <h2 className="text-lg font-semibold text-dc1-text-primary mb-2">{doc.title}</h2>
              <p className="text-sm text-dc1-text-secondary">{doc.description}</p>
            </Link>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}
