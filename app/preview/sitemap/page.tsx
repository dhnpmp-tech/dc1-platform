import Link from 'next/link'
import type { Metadata } from 'next'

// Review index for the Claude Design handover bundle. Groups every page in the
// bundle by surface, with a one-click link into each. Reviewers (Tareq, Nexus,
// Fadi) land here from the protected preview URL and browse the whole system.

export const metadata: Metadata = {
  title: 'DCP — Design Review · Sitemap',
  description:
    'Review index for the DCP redesign (Claude Design handover). Browse every page in the bundle.',
}

type Row = { slug: string; label: string; note?: string }
type Group = { title: string; blurb: string; rows: Row[] }

const GROUPS: Group[] = [
  {
    title: 'Primary',
    blurb:
      'Main landing page and the design-system kit. Start here.',
    rows: [
      { slug: 'redesign', label: 'Landing (main)', note: 'DCP Redesign.html' },
      { slug: 'redesign-v1', label: 'Landing — v1 reference', note: 'Earlier variant' },
      { slug: 'kit', label: 'Kit reference', note: 'Every primitive on one page' },
    ],
  },
  {
    title: 'Public marketing',
    blurb:
      'External-facing site. Editorial magazine layout, long-form copy, canvas-rendered hero.',
    rows: [
      { slug: 'public', label: 'Hub' },
      { slug: 'public/pricing', label: 'Pricing' },
      { slug: 'public/providers', label: 'Providers (recruitment)' },
      { slug: 'public/status', label: 'Status' },
      { slug: 'public/about', label: 'About' },
      { slug: 'public/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Documentation',
    blurb:
      'Three-pane docs app. 22 content pages lifted from dcp.sa/docs (Quickstart, API, SDKs, Guides, Compliance).',
    rows: [{ slug: 'docs', label: 'Docs — three-pane app' }],
  },
  {
    title: 'Renter app',
    blurb:
      'What paying customers see after sign-in. Console (dashboard), Playground (streaming chat), Models, Usage, Jobs, Audit, Settings, Wallet.',
    rows: [
      { slug: 'app', label: 'Hub' },
      { slug: 'app/sitemap', label: 'Site map' },
      { slug: 'app/auth', label: 'Auth — signup / signin / OTP / recover' },
      { slug: 'app/setup', label: 'Setup — first-run wizard' },
      { slug: 'app/console', label: 'Console (dashboard)' },
      { slug: 'app/playground', label: 'Playground' },
      { slug: 'app/models', label: 'Models' },
      { slug: 'app/jobs', label: 'Jobs' },
      { slug: 'app/audit', label: 'Audit' },
      { slug: 'app/usage', label: 'Usage' },
      { slug: 'app/settings', label: 'Settings' },
      { slug: 'app/wallet', label: 'Wallet' },
      { slug: 'app/live-monitor', label: 'Live Monitor' },
      { slug: 'app/compare-gpus', label: 'Compare GPUs' },
      { slug: 'app/cost-dashboard', label: 'Cost Dashboard' },
    ],
  },
  {
    title: 'Provider app',
    blurb:
      'Where GPU providers manage rigs, track earnings, and withdraw. Lands here after /setup completes.',
    rows: [
      { slug: 'provider', label: 'Hub' },
      { slug: 'provider/dashboard', label: 'Dashboard' },
      { slug: 'provider/rigs', label: 'Rigs' },
      { slug: 'provider/jobs', label: 'Jobs' },
      { slug: 'provider/earnings', label: 'Earnings' },
      { slug: 'provider/wallet', label: 'Wallet' },
      { slug: 'provider/models', label: 'Models' },
      { slug: 'provider/reputation', label: 'Reputation' },
      { slug: 'provider/settings', label: 'Settings' },
    ],
  },
  {
    title: 'Ops / admin console',
    blurb:
      'Internal surface for platform operations. Subtle purple tint distinguishes it from renter/provider UIs.',
    rows: [
      { slug: 'ops', label: 'Hub' },
      { slug: 'ops/overview', label: 'Overview' },
      { slug: 'ops/fleet-map', label: 'Fleet Map' },
      { slug: 'ops/jobs-monitor', label: 'Jobs Monitor' },
      { slug: 'ops/customers', label: 'Customers' },
      { slug: 'ops/providers', label: 'Providers' },
      { slug: 'ops/pricing-control', label: 'Pricing Control' },
      { slug: 'ops/billing-payouts', label: 'Billing & Payouts' },
      { slug: 'ops/incidents', label: 'Incidents' },
      { slug: 'ops/on-call', label: 'On-Call' },
      { slug: 'ops/support-tickets', label: 'Support Tickets' },
      { slug: 'ops/compliance', label: 'Compliance' },
      { slug: 'ops/feature-flags', label: 'Feature Flags' },
      { slug: 'ops/models-catalog', label: 'Models Catalog' },
      { slug: 'ops/admin-audit-log', label: 'Admin Audit Log' },
    ],
  },
  {
    title: 'Sales deck',
    blurb: '10-slide editorial deck. Keyboard arrows navigate.',
    rows: [{ slug: 'deck', label: 'Deck — editorial' }],
  },
]

const count = GROUPS.reduce((n, g) => n + g.rows.length, 0)

export default function SitemapPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0b1a',
        color: '#f5f3ee',
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        padding: '64px 32px 96px',
      }}
    >
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'rgba(245,243,238,0.56)',
            marginBottom: 12,
          }}
        >
          DCP · Design Review · Sitemap
        </div>
        <h1
          style={{
            fontFamily: "'Instrument Serif', 'Times New Roman', serif",
            fontSize: 'clamp(40px, 5vw, 64px)',
            lineHeight: 1.05,
            letterSpacing: '-0.01em',
            margin: 0,
            marginBottom: 16,
          }}
        >
          Every page in the redesign.
        </h1>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: 'rgba(245,243,238,0.72)',
            maxWidth: 720,
            margin: 0,
            marginBottom: 8,
          }}
        >
          {count} pages across seven surfaces — public marketing, docs, renter
          app, provider app, ops console, sales deck, and the design-system
          kit. Each link opens the full page inside this preview. Use the back
          link at the bottom-left of each page to return here.
        </p>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: 'rgba(245,243,238,0.44)',
            maxWidth: 720,
            margin: 0,
          }}
        >
          Source: Claude Design handover bundle (
          <code style={{ fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace", fontSize: 12 }}>
            DCP (4).zip
          </code>
          ) · Hosted behind Vercel Deployment Protection · Not production.
        </p>

        <div style={{ marginTop: 48, display: 'grid', gap: 40 }}>
          {GROUPS.map((group) => (
            <section key={group.title}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#ee7a3c',
                  marginBottom: 8,
                }}
              >
                {group.title} · {group.rows.length}
              </div>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'rgba(245,243,238,0.72)',
                  margin: 0,
                  marginBottom: 16,
                  maxWidth: 760,
                }}
              >
                {group.blurb}
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 1,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                {group.rows.map((row) => (
                  <li key={row.slug}>
                    <Link
                      href={`/preview/pages/${row.slug}`}
                      style={{
                        display: 'block',
                        padding: '14px 16px',
                        background: '#10122a',
                        color: '#f5f3ee',
                        textDecoration: 'none',
                        fontSize: 14,
                        lineHeight: 1.4,
                        transition: 'background 180ms ease',
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{row.label}</div>
                      {row.note ? (
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 11,
                            color: 'rgba(245,243,238,0.44)',
                            fontFamily:
                              "'JetBrains Mono', ui-monospace, Menlo, monospace",
                          }}
                        >
                          {row.note}
                        </div>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div
          style={{
            marginTop: 64,
            paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            fontSize: 12,
            color: 'rgba(245,243,238,0.44)',
            lineHeight: 1.7,
          }}
        >
          <div>
            Landing page port (yesterday) lives at{' '}
            <Link
              href="/preview"
              style={{ color: '#2dd4b6', textDecoration: 'none' }}
            >
              /preview
            </Link>{' '}
            — native Next.js route, 1,494 lines of TSX. Everything else on this
            index is mounted from the bundle as-is so design fidelity is 1:1;
            individual pages will be replaced with native ports surface-by-surface
            as the port progresses.
          </div>
        </div>
      </div>
    </main>
  )
}
