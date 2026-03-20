'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'

// ── Copy button ────────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded border border-dc1-border bg-dc1-surface-l3 px-2 py-1 text-xs text-dc1-text-muted transition hover:text-dc1-amber"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative mt-3">
      <pre className="overflow-x-auto rounded-lg border border-dc1-border bg-dc1-surface-l2 p-3 pr-16 text-xs leading-relaxed text-dc1-text-secondary">
        {code}
      </pre>
      <CopyButton text={code} />
    </div>
  )
}

// ── Data ───────────────────────────────────────────────────────────────────────
const REGISTER_CODE = `curl -X POST https://dcp.sa/api/dc1/renters/register \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@example.com", "name": "Your Name"}'`

const SUBMIT_CODE = `curl -X POST https://dcp.sa/api/dc1/jobs/submit \\
  -H "x-renter-key: YOUR_RENTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider_id": 42,
    "job_type": "llm_inference",
    "duration_minutes": 10,
    "params": {
      "model": "meta-llama/Llama-3-8B",
      "prompt": "Explain transformers in one paragraph"
    }
  }'`

const quickstartSteps = [
  {
    number: 1,
    title: 'Create your account',
    description: 'Register a renter account to get started. You\'ll receive an API key — copy it from the dashboard.',
    code: REGISTER_CODE,
    link: { label: 'Register at dcp.sa/renter/register', href: '/renter/register' },
  },
  {
    number: 2,
    title: 'Copy your API key',
    description: 'Your renter API key is shown once after registration. Store it securely — it authenticates every API call.',
    link: { label: 'View your dashboard', href: '/renter' },
  },
  {
    number: 3,
    title: 'Submit your first job',
    description: 'Browse the marketplace for an available GPU, then submit an inference job with your renter key:',
    code: SUBMIT_CODE,
  },
]

const sdks = [
  {
    title: 'JavaScript / TypeScript',
    package: 'dc1-renter-sdk',
    registry: 'npm',
    href: 'https://www.npmjs.com/package/dc1-renter-sdk',
    install: 'npm install dc1-renter-sdk',
    description: 'Node.js client for renter job submission, marketplace, and balance APIs.',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 0h24v24H0V0zm19.2 9.6v4.8H16.8V9.6H14.4v7.2h7.2V9.6H19.2zM9.6 9.6v4.8H7.2v-4.8H4.8v7.2H12V9.6H9.6z" />
      </svg>
    ),
  },
  {
    title: 'Python',
    package: 'dc1_provider',
    registry: 'PyPI',
    href: 'https://pypi.org/project/dc1_provider/',
    install: 'pip install dc1_provider',
    description: 'Python SDK for provider registration, daemon integration, and earnings APIs.',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.912S0 5.789 0 11.969c0 6.18 3.403 5.96 3.403 5.96h2.031v-2.867s-.109-3.402 3.345-3.402h5.766s3.234.052 3.234-3.126V3.126S18.28 0 11.914 0zM8.708 1.81a1.044 1.044 0 1 1 0 2.088 1.044 1.044 0 0 1 0-2.088zM12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752H12v-.826h8.109S24 18.211 24 12.031c0-6.18-3.403-5.96-3.403-5.96H18.566v2.867s.109 3.402-3.345 3.402H9.455S6.22 12.288 6.22 15.466v5.408S5.72 24 12.086 24zm3.206-1.81a1.044 1.044 0 1 1 0-2.088 1.044 1.044 0 0 1 0 2.088z" />
      </svg>
    ),
  },
]

const resources = [
  {
    title: 'API Reference',
    description: 'Full documentation for all REST endpoints — providers, renters, jobs, and admin.',
    href: '/docs/api',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    label: 'View API Reference →',
  },
  {
    title: 'OpenAPI Specification',
    description: 'Machine-readable OpenAPI 3.1 spec. Import into Postman, Insomnia, or any HTTP client.',
    href: '/docs/openapi.yaml',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    label: 'Download OpenAPI spec →',
  },
  {
    title: 'Support',
    description: 'Get help from the team. Report issues, ask questions, or request a feature.',
    href: '/support',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    label: 'Contact Support →',
  },
]

const docsNav = [
  { label: 'Quickstart', href: '/docs/quickstart' },
  { label: 'Provider Guide', href: '/docs/provider-guide' },
  { label: 'Renter Guide', href: '/docs/renter-guide' },
  { label: 'API Reference', href: '/docs/api' },
]

// ── Page ───────────────────────────────────────────────────────────────────────
export default function DocsLandingPage() {
  return (
    <div className="min-h-screen bg-dc1-void">
      <Header />

      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Hero */}
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-dc1-amber">
            Documentation
          </p>
          <h1 className="text-4xl font-bold text-dc1-text-primary sm:text-5xl">
            DCP Developer Docs
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-dc1-text-secondary">
            Everything you need to submit compute jobs, run GPU providers, and integrate with the DCP API.
          </p>

          {/* Quick nav */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {docsNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-dc1-border bg-dc1-surface-l1 px-4 py-2 text-sm text-dc1-text-secondary transition hover:border-dc1-amber/40 hover:text-dc1-amber"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Section 1: Quickstart ─────────────────────────────────────────── */}
        <section className="mb-14">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-dc1-amber/15 text-sm font-bold text-dc1-amber">
              1
            </div>
            <h2 className="text-xl font-semibold text-dc1-text-primary">Quickstart</h2>
            <span className="rounded-full border border-dc1-border bg-dc1-surface-l2 px-2.5 py-0.5 text-xs text-dc1-text-muted">
              ~5 minutes
            </span>
          </div>

          <div className="space-y-4">
            {quickstartSteps.map((step) => (
              <div
                key={step.number}
                className="rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-5 sm:p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dc1-surface-l3 text-sm font-semibold text-dc1-text-muted">
                    {step.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-dc1-text-primary">{step.title}</h3>
                    <p className="mt-1 text-sm text-dc1-text-secondary">{step.description}</p>
                    {step.code && <CodeBlock code={step.code} />}
                    {step.link && (
                      <Link
                        href={step.link.href}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm text-dc1-amber hover:underline underline-offset-2"
                      >
                        {step.link.label}
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Link
              href="/docs/quickstart"
              className="inline-flex items-center gap-2 text-sm font-medium text-dc1-amber hover:underline underline-offset-2"
            >
              Full quickstart guide →
            </Link>
          </div>
        </section>

        {/* ── Section 2: SDKs ───────────────────────────────────────────────── */}
        <section className="mb-14">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-dc1-amber/15 text-sm font-bold text-dc1-amber">
              2
            </div>
            <h2 className="text-xl font-semibold text-dc1-text-primary">SDKs</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sdks.map((sdk) => (
              <a
                key={sdk.package}
                href={sdk.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-5 transition hover:border-dc1-amber/40"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-dc1-amber">{sdk.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-dc1-text-primary group-hover:text-dc1-amber transition-colors">
                      {sdk.title}
                    </p>
                    <p className="text-xs text-dc1-text-muted">
                      {sdk.registry} — <code className="font-mono">{sdk.package}</code>
                    </p>
                  </div>
                </div>
                <p className="mb-3 text-sm text-dc1-text-secondary">{sdk.description}</p>
                <div className="relative">
                  <pre className="overflow-x-auto rounded-lg border border-dc1-border bg-dc1-surface-l2 px-3 py-2 pr-14 text-xs text-dc1-text-secondary">
                    {sdk.install}
                  </pre>
                  <CopyButton text={sdk.install} />
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ── Sections 3–5: Resources grid ─────────────────────────────────── */}
        <section>
          <h2 className="mb-6 text-xl font-semibold text-dc1-text-primary">Resources</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {resources.map((resource) => (
              <Link
                key={resource.href}
                href={resource.href}
                className="group rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-5 transition hover:border-dc1-amber/40"
              >
                <div className="mb-3 text-dc1-amber group-hover:scale-105 transition-transform">
                  {resource.icon}
                </div>
                <h3 className="mb-2 text-base font-semibold text-dc1-text-primary group-hover:text-dc1-amber transition-colors">
                  {resource.title}
                </h3>
                <p className="mb-4 text-sm text-dc1-text-secondary leading-relaxed">
                  {resource.description}
                </p>
                <span className="text-xs font-medium text-dc1-amber">
                  {resource.label}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
