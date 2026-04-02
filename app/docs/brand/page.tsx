'use client'

import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'

export default function BrandPage() {
  return (
    <div className="min-h-screen flex flex-col bg-dc1-void">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-dc1-text-primary">Brand Guidelines</h1>
            <p className="text-dc1-text-secondary mt-1 text-sm">
              DCP Brand System v3.0 — Approved April 2026
            </p>
          </div>
          <a
            href="/docs/DCP-BRAND-GUIDELINES-v3.html"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary text-sm"
          >
            Open full page →
          </a>
        </div>
        <div className="rounded-xl border border-dc1-border overflow-hidden">
          <iframe
            src="/docs/DCP-BRAND-GUIDELINES-v3.html"
            className="w-full"
            style={{ height: '80vh', border: 'none' }}
            title="DCP Brand Guidelines v3.0"
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}
