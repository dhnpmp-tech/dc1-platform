import { notFound } from 'next/navigation'
import fs from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'

// Dynamic Next.js route that mounts a page from the Claude Design handover bundle.
//
// Each page in the bundle is a self-contained HTML shell that loads its own fonts,
// CSS, React, Babel, and JSX. We serve the shell via a full-viewport iframe so the
// page runs byte-identical to how the design team built it. URL stays clean and
// routable; fidelity stays 1:1. Progressive migration: any individual page can be
// replaced with a native Next.js port (like /preview — see app/preview/page.tsx)
// without changing its URL.

const BUNDLE_ROOT = path.join(process.cwd(), 'public', 'preview-bundle')

// Whitelist of page shells reachable through this route. Anything not in this
// map 404s. Keys are URL-safe slugs; values are paths within the bundle.
const PAGES: Record<string, { file: string; title: string }> = {
  // Root / kit
  'redesign': { file: 'DCP Redesign.html', title: 'DCP — Redesign (primary landing)' },
  'redesign-v1': { file: 'DCP Redesign v1.html', title: 'DCP — Redesign v1 (reference)' },
  'kit': { file: 'DCP Kit.html', title: 'DCP Kit — design system reference' },

  // Public marketing
  'public': { file: 'public/Index.html', title: 'Public — hub' },
  'public/pricing': { file: 'public/Pricing.html', title: 'Public — Pricing' },
  'public/providers': { file: 'public/Providers.html', title: 'Public — Providers' },
  'public/status': { file: 'public/Status.html', title: 'Public — Status' },
  'public/about': { file: 'public/About.html', title: 'Public — About' },
  'public/contact': { file: 'public/Contact.html', title: 'Public — Contact' },

  // Docs
  'docs': { file: 'docs/docs-three-pane.html', title: 'Docs — three-pane app' },

  // Renter app
  'app': { file: 'app/Index.html', title: 'Renter app — hub' },
  'app/sitemap': { file: 'app/Site Map.html', title: 'Renter app — site map' },
  'app/auth': { file: 'app/Auth.html', title: 'Renter — Auth (signup / signin / OTP / recover)' },
  'app/setup': { file: 'app/Setup.html', title: 'Renter — Setup wizard' },
  'app/console': { file: 'app/Console.html', title: 'Renter — Console (dashboard)' },
  'app/playground': { file: 'app/Playground.html', title: 'Renter — Playground' },
  'app/models': { file: 'app/Models.html', title: 'Renter — Models' },
  'app/jobs': { file: 'app/Jobs.html', title: 'Renter — Jobs' },
  'app/audit': { file: 'app/Audit.html', title: 'Renter — Audit' },
  'app/usage': { file: 'app/Usage.html', title: 'Renter — Usage' },
  'app/settings': { file: 'app/Settings.html', title: 'Renter — Settings' },
  'app/wallet': { file: 'app/Wallet.html', title: 'Renter — Wallet' },
  'app/live-monitor': { file: 'app/Live Monitor.html', title: 'Renter — Live Monitor' },
  'app/compare-gpus': { file: 'app/Compare GPUs.html', title: 'Renter — Compare GPUs' },
  'app/cost-dashboard': { file: 'app/Cost Dashboard.html', title: 'Renter — Cost Dashboard' },

  // Provider app
  'provider': { file: 'app/Provider Index.html', title: 'Provider app — hub' },
  'provider/dashboard': { file: 'app/Provider Dashboard.html', title: 'Provider — Dashboard' },
  'provider/rigs': { file: 'app/Provider Rigs.html', title: 'Provider — Rigs' },
  'provider/jobs': { file: 'app/Provider Jobs.html', title: 'Provider — Jobs' },
  'provider/earnings': { file: 'app/Provider Earnings.html', title: 'Provider — Earnings' },
  'provider/wallet': { file: 'app/Provider Wallet.html', title: 'Provider — Wallet' },
  'provider/models': { file: 'app/Provider Models.html', title: 'Provider — Models' },
  'provider/reputation': { file: 'app/Provider Reputation.html', title: 'Provider — Reputation' },
  'provider/settings': { file: 'app/Provider Settings.html', title: 'Provider — Settings' },

  // Ops / admin
  'ops': { file: 'ops/Index.html', title: 'Ops console — hub' },
  'ops/overview': { file: 'ops/Overview.html', title: 'Ops — Overview' },
  'ops/fleet-map': { file: 'ops/Fleet Map.html', title: 'Ops — Fleet Map' },
  'ops/jobs-monitor': { file: 'ops/Jobs Monitor.html', title: 'Ops — Jobs Monitor' },
  'ops/customers': { file: 'ops/Customers.html', title: 'Ops — Customers' },
  'ops/providers': { file: 'ops/Providers.html', title: 'Ops — Providers' },
  'ops/pricing-control': { file: 'ops/Pricing Control.html', title: 'Ops — Pricing Control' },
  'ops/billing-payouts': { file: 'ops/Billing and Payouts.html', title: 'Ops — Billing & Payouts' },
  'ops/incidents': { file: 'ops/Incidents.html', title: 'Ops — Incidents' },
  'ops/on-call': { file: 'ops/On-Call.html', title: 'Ops — On-Call' },
  'ops/support-tickets': { file: 'ops/Support Tickets.html', title: 'Ops — Support Tickets' },
  'ops/compliance': { file: 'ops/Compliance.html', title: 'Ops — Compliance' },
  'ops/feature-flags': { file: 'ops/Feature Flags.html', title: 'Ops — Feature Flags' },
  'ops/models-catalog': { file: 'ops/Models Catalog.html', title: 'Ops — Models Catalog' },
  'ops/admin-audit-log': { file: 'ops/Admin Audit Log.html', title: 'Ops — Admin Audit Log' },

  // Deck
  'deck': { file: 'deck/DCP Deck - Editorial.html', title: 'Sales deck — editorial' },
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug: slug.split('/') }))
}

function resolveSlug(slug: string[] | undefined): { file: string; title: string } | null {
  const key = (slug ?? []).join('/')
  const entry = PAGES[key]
  if (!entry) return null
  // Harden against path traversal: resolved file must stay inside BUNDLE_ROOT.
  const resolved = path.resolve(BUNDLE_ROOT, entry.file)
  if (!resolved.startsWith(BUNDLE_ROOT + path.sep)) return null
  if (!fs.existsSync(resolved)) return null
  return entry
}

export async function generateMetadata(
  props: { params: Promise<{ slug: string[] }> },
): Promise<Metadata> {
  const { slug } = await props.params
  const entry = resolveSlug(slug)
  return {
    title: entry ? entry.title : 'DCP — Preview (page not found)',
    description: 'Preview of the DCP design handover bundle (Claude Design).',
  }
}

export default async function PreviewPage(
  props: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await props.params
  const entry = resolveSlug(slug)
  if (!entry) notFound()

  // Encode each segment so filenames with spaces (e.g. "Live Monitor.html") resolve.
  const iframeSrc = '/preview-bundle/' + entry.file.split('/').map(encodeURIComponent).join('/')

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0b1a',
      }}
    >
      <iframe
        src={iframeSrc}
        title={entry.title}
        style={{
          border: 0,
          width: '100vw',
          height: '100vh',
          display: 'block',
        }}
      />
      <a
        href="/preview/sitemap"
        style={{
          position: 'fixed',
          left: 12,
          bottom: 12,
          padding: '8px 14px',
          borderRadius: 999,
          background: 'rgba(10,11,26,0.82)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.14)',
          color: '#f5f3ee',
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          fontSize: 12,
          letterSpacing: '0.04em',
          textDecoration: 'none',
          zIndex: 10,
        }}
      >
        ← BACK TO SITEMAP
      </a>
    </div>
  )
}
