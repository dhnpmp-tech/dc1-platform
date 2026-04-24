# Complete Page Inventory — DCP Platform

Every page included in this handoff bundle. All files are in the corresponding folders — this is the definitive list.

## Root / Primary

- `DCP Redesign.html` — Main public landing page (the "front door")
- `DCP Redesign v1.html` — Earlier landing variant (reference)
- `DCP Kit.html` + `DCP Kit.jsx` — Design system reference sheet (every primitive in one page)

## Public / Marketing (`public/`) — 6 pages

1. `Index.html` — Public-site hub (links to all public pages)
2. `Pricing.html` + `Pricing.jsx` — Rate card, workload calculator, competitor comparison, enterprise tiers
3. `Providers.html` + `Providers.jsx` — Provider recruitment, earnings calculator, FAQ
4. `Status.html` + `Status.jsx` — Operational status, uptime, incident history
5. `About.html` + `About.jsx` — Company narrative, team, investors
6. `Contact.html` + `Contact.jsx` — Inquiry form, Riyadh office
Shared: `_shell.jsx` (nav + footer wrapper)

## Documentation (`docs/`) — 22 content pages in one app

- `docs-three-pane.html` — Shell
- `DocsApp.jsx` — React app
- Content in `assets/docs-content.js` covering:
  1. Quickstart
  2. Authentication
  3. Base URLs & regions
  4. Errors & rate limits
  5. Chat completions (API reference)
  6. Embeddings (API reference)
  7. Images (API reference)
  8. Jobs — submit (API reference)
  9. Jobs — status (API reference)
  10. Jobs — list (API reference)
  11. Admin — dashboard (API reference)
  12. Admin — providers (API reference)
  13. Provider — register
  14. Provider — heartbeat
  15. SDKs — Python
  16. SDKs — TypeScript / Node
  17. SDKs — curl
  18. Guides — Arabic inference best practices
  19. Guides — fine-tuning
  20. Guides — batch jobs
  21. Compliance — CITC, SDAIA, ZATCA
  22. Changelog

## Renter App (`app/`) — 16 customer-facing screens

1. `Index.html` — App surface index
2. `Site Map.html` — Full sitemap visualization
3. `Auth.html` + `Auth.jsx` — Signup / Signin / OTP / Recover (4 variants on design canvas)
4. `Setup.html` + `Setup.jsx` — First-run onboarding wizard
5. `Console.html` + `Console.jsx` — Main dashboard (usage, budget, onboarding, activity)
6. `Playground.html` + `Playground.jsx` — Streaming chat with params + code view
7. `Models.html` + `Models.jsx` — Model index + detail (benchmarks, pricing, latency)
8. `Jobs.html` + `Jobs.jsx` — Batch jobs list + detail drawer
9. `Audit.html` + `Audit.jsx` — Filterable event log
10. `Usage.html` + `Usage.jsx` — Usage drilldown (trend, breakdown, heatmap)
11. `Settings.html` + `Settings.jsx` — Profile / Team / Billing / API keys
12. `Wallet.html` — Top-up, transactions, invoices
13. `Live Monitor.html` — Real-time request stream
14. `Compare GPUs.html` — GPU comparison matrix
15. `Cost Dashboard.html` — Cost analytics deep-dive

## Provider App (`app/Provider*`) — 9 provider-facing screens

1. `Provider Index.html` — Provider surface index
2. `Provider Dashboard.html` + `.jsx` — Earnings, rig health, active jobs
3. `Provider Rigs.html` + `.jsx` — Rig inventory (add/remove/monitor)
4. `Provider Jobs.html` + `.jsx` — Jobs running on this provider's rigs
5. `Provider Earnings.html` + `.jsx` — SAR earnings, payout history
6. `Provider Wallet.html` + `.jsx` — Wallet + IBAN withdrawals
7. `Provider Models.html` + `.jsx` — Hosted models
8. `Provider Reputation.html` + `.jsx` — SLA, uptime, ratings
9. `Provider Settings.html` + `.jsx` — Account, VAT, IBAN, notifications

## Ops / Admin Console (`ops/`) — 15 admin-facing screens

1. `Index.html` — Ops surface index
2. `Overview.html` — GMV, active jobs, fleet health, incidents
3. `Fleet Map.html` — Geographic map (Riyadh, Jeddah, Dammam, NEOM)
4. `Jobs Monitor.html` — Live job stream
5. `Customers.html` — Customer list + detail
6. `Providers.html` — Provider list + detail
7. `Pricing Control.html` — Rate card editor
8. `Billing and Payouts.html` — Invoicing + provider payouts
9. `Incidents.html` — Incident list + runbooks
10. `On-Call.html` — Rotation schedule
11. `Support Tickets.html` — Ticket queue
12. `Compliance.html` — CITC, SDAIA, ZATCA audit trails
13. `Feature Flags.html` — Flag console
14. `Models Catalog.html` — Catalog editor
15. `Admin Audit Log.html` — Privileged-action log

## Sales Deck (`deck/`) — 10 slides

- `DCP Deck - Editorial.html` — 10-slide editorial deck
- `deck-stage.js` — Slide-deck web component

Slides: Cover · Problem · Solution · Why Now · Market · Product · Traction · Go-to-Market · The Ask · Contact

## Design System (`assets/`) — shared across every surface

**Tokens & primitives**
- `dcp-kit.css` — design tokens, primitive styles (693 lines)
- `dcp-kit.jsx` — React primitives (663 lines)
- `dcp-kit.README.md` — kit reference doc

**Shells**
- `app-shell.css` + `app-shell.jsx` — Renter shell (sidebar + topbar)
- `provider-shell.css` + `provider-shell.jsx` — Provider shell
- `ops-shell.css` + `ops-shell.jsx` — Ops/admin shell

**Motion & polish**
- `app-polish.js` — Preloader, reveals, number-roll, magnetic CTAs

**i18n**
- `i18n.js` — EN/AR dictionary (all surfaces)
- `docs-content.js` — Docs-only EN/AR content
- `app-i18n-rtl.css` — RTL overrides

**Mock data** (shape spec for the real API)
- `data.js` — Legacy marketplace
- `data-public.js` — Public site
- `data-app.js` — Renter shared
- `data-renter.js` — Renter-specific
- `data-provider.js` — Provider
- `data-ops.js` — Ops shared
- `data-ops-admin.js` — Admin-only

**Brand assets**
- `dcp-logo.webp` — Wordmark
- `dcp-logo-square.jpeg` — Icon-mark

## Grand total

- **6** public marketing pages
- **22** documentation pages (one app)
- **16** renter / customer-facing screens
- **9** provider-facing screens
- **15** ops / admin-facing screens
- **10** sales-deck slides
- **1** design-system reference
- **~20** design-system / data / i18n / shell source files

**= 99 pages/screens/slides** across the full DCP surface, all on one unified design system.
