# Handoff: DCP Platform — Full Product Surface

## Overview

DCP (Decentralized Compute Platform) is a Saudi Arabian GPU compute marketplace: renters consume inference / training compute, providers list rigs and earn, and an ops team runs the platform. This handoff covers the complete product surface in a single design language:

- **Public / marketing site** — Landing, Pricing, Providers, Status, About, Contact
- **Documentation site** — Three-pane shell, 22 pages, full EN/AR parity
- **Renter app** — Auth, Console (dashboard), Playground, Models, Jobs, Audit, Usage, Settings, Wallet, Setup, Live Monitor, Compare GPUs, Cost Dashboard
- **Provider app** — Dashboard, Rigs, Jobs, Earnings, Wallet, Models, Reputation, Settings
- **Ops / admin console** — Overview, Fleet Map, Jobs Monitor, Customers, Providers, Pricing Control, Billing & Payouts, Incidents, On-Call, Support Tickets, Compliance, Feature Flags, Models Catalog, Admin Audit Log
- **Sales deck** — 10-slide editorial deck
- **Design system** — Tokens, components, motion primitives, i18n

## About the Design Files

The files in this bundle are **design references created in HTML/JSX** — prototypes showing intended look and behavior, not production code to copy directly. They run via React 18 + Babel standalone in the browser, are heavily string-interpolated for i18n, and embed mock data inline.

The task is to **recreate these HTML designs in the target codebase's existing environment** — React/Next.js is the natural fit given the JSX structure, but SwiftUI / Flutter / Vue are equally valid if that matches the production stack. Use the codebase's existing component library, routing, state management, and data layer. The HTML files are the spec for layout, color, motion, copy, and interaction — not a shippable artifact.

If there is no existing codebase yet, we recommend **Next.js 14 (App Router) + TypeScript + Tailwind** for the web surface, with the design tokens ported 1:1 to a `tailwind.config.ts` file.

## Fidelity

**High-fidelity (hifi)** across the board. Every surface uses:

- Final colors (exact hex / oklch values — see Design Tokens below)
- Final typography (Libre Caslon Text for display, Inter for UI, Space Mono for code / metrics, IBM Plex Sans Arabic for RTL)
- Final spacing, border radii, shadows
- Final copy in both English and Arabic
- Final interaction states (hover, active, focus, disabled, loading, error, empty)

The only lofi areas are:
- Mock chart data (sparklines, heatmaps) — replace with real time-series
- Placeholder illustrations — none shipped; real imagery from brand team
- Mock API responses — see `assets/data-*.js` files for the expected shape

## Design Language — "Midnight Editorial"

The unifying aesthetic across every surface:

1. **Midnight ground** — `#0a0b1a` (`--bg`) with cream ink `#f5f3ee` (`--ink`)
2. **Editorial typography** — large serif display, uppercase eyebrow labels with letter-spacing, tight text-wrap: pretty, justified body copy on long-form pages
3. **Restrained color** — one warm accent (terracotta `#D97757`), one cool accent (teal `#4aa598`), state colors (success teal, warn amber, danger orange-red, info blue). Used sparingly — pills, data viz, focus rings.
4. **Surface hierarchy** — three levels only: page background, `surface` (slightly-raised card), `surface-2` (inner panel). No drop shadows on app surface; hairline borders (`--line` = `rgba(255,255,255,0.08)`).
5. **Motion** — subtle. 180ms ease for hover, 240ms for reveals, 900ms preloader. `prefers-reduced-motion` fully respected. No gratuitous parallax, no bouncing, no gradient washes.
6. **Data density** — tables are tight (36px row), numbers right-aligned, mono font for all metrics. Charts use direct labels, not legends.
7. **RTL parity** — every screen works in Arabic. Logical properties (`margin-inline-start`, `padding-inline-end`) throughout. Icons and chevrons mirror via `[dir="rtl"]` selectors. Mono font stays LTR for numbers even in RTL pages.

## Screens / Views

### Public site (`public/`)

Flat "editorial magazine" layout. Section-metadata strip above each section (01/02/03…), generous whitespace, long-form copy.

| File | Purpose | Key components |
|---|---|---|
| `Index.html` | Landing — hero + proof + marketplace teaser + model directory + API preview + provider invite + enterprise + footer | `<Hero>` with canvas noise map, `<MarketplaceTable>` (live tickers), `<ModelGrid>` (logo-grid of providers), `<ApiPreview>` (terminal + code tabs), `<ProviderStrip>`, `<EnterpriseBand>`, `<Footer>` |
| `Pricing.html` | Rate card + calculator + competitor table | `<PriceCalculator>` (workload slider + model picker, outputs monthly SAR), `<RateMatrix>` (per-GPU/per-model), `<CompareTable>` (vs AWS, Azure, Vast, RunPod), `<EnterpriseTiers>` |
| `Providers.html` | Provider recruitment — earnings calc + FAQ | `<EarningsCalc>` (GPU count × utilization × hourly rate), `<ProviderFAQ>`, `<OnboardingSteps>` |
| `Status.html` | Operational status — uptime + incident history | `<StatusHero>` (big green dot + 99.98% uptime), `<RegionGrid>` (per-region), `<IncidentTimeline>` |
| `About.html` | Company narrative — mission, team, investors | Editorial long-form, pull quotes, founder cards |
| `Contact.html` | Form + Riyadh office details | `<ContactForm>` (inquiry type → routes), `<OfficeCard>` with map |

### Docs site (`docs/`)

Three-pane: left nav rail (22 pages grouped into 5 sections) • center content • right TOC. Topbar with ⌘K search, EN/AR toggle, theme toggle.

| File | Purpose |
|---|---|
| `docs-three-pane.html` | Shell HTML — loads `DocsApp.jsx` |
| `DocsApp.jsx` | React app — renders sidebar, topbar, content, TOC; drives search modal; handles hash-based routing |

Content is in `assets/docs-content.js` — 22 pages covering Quickstart, Authentication, API Reference (chat, embeddings, images, jobs, admin), SDKs, Guides, Compliance. **All content is lifted from dcp.sa/docs** — do not regenerate.

### Renter app (`app/`)

Full product shell: collapsible left sidebar with org switcher • topbar with ⌘K, breadcrumb, help, user menu • main content.

| File | Purpose | Notes |
|---|---|---|
| `Index.html` | App surface index — links to every screen below |  |
| `Auth.html` + `Auth.jsx` | Signup / Signin / OTP / Recover — 4 variants on a design canvas | Nafath SSO first-class, 6-digit OTP box, phone +966 prefix |
| `Console.html` + `Console.jsx` | Dashboard — usage sparkline, budget bar, onboarding checklist, activity feed |  |
| `Playground.html` + `Playground.jsx` | Streaming chat + params + code view (Python/curl/TS/Node) | Model picker, region chip, system prompt, temp/top-p/max-tokens sliders |
| `Models.html` + `Models.jsx` | Index (card grid) + detail (hash `#id`) | Benchmarks (bar chart), context window, SAR pricing, latency distribution |
| `Jobs.html` + `Jobs.jsx` | Batch jobs list + detail drawer | Status pill, timeline, KV details, retry/cancel actions |
| `Audit.html` + `Audit.jsx` | Filterable event log | Actor kind filter rail, severity filter, day dividers, expandable rows |
| `Usage.html` + `Usage.jsx` | Usage drilldown — trend chart, model/key breakdown, 7×24 heatmap | Stacked area with tooltips, legend toggles, prior-period deltas |
| `Settings.html` + `Settings.jsx` | Profile / Team / Billing / API keys | Four tabs, Saudi-specific fields (VAT, Mada default payment) |
| `Wallet.html` | Top-up / transactions / invoices |  |
| `Setup.html` + `Setup.jsx` | First-run wizard |  |
| `Live Monitor.html` | Real-time request stream |  |
| `Compare GPUs.html` | GPU comparison matrix |  |
| `Cost Dashboard.html` | Cost analytics |  |

### Provider app (`app/Provider*.html`)

Same shell as renter, different nav + data model.

| File | Purpose |
|---|---|
| `Provider Index.html` | Provider surface index |
| `Provider Dashboard.jsx` | Earnings this month, rig health, active jobs |
| `Provider Rigs.jsx` | Rig inventory — add/remove, specs, utilization |
| `Provider Jobs.jsx` | Jobs currently running on this provider's rigs |
| `Provider Earnings.jsx` | SAR earnings chart, payout history |
| `Provider Wallet.jsx` | Wallet + withdrawal to IBAN |
| `Provider Models.jsx` | Models this provider hosts |
| `Provider Reputation.jsx` | SLA score, uptime, customer ratings |
| `Provider Settings.jsx` | Account, tax (VAT), IBAN, notifications |

### Ops console (`ops/`)

Internal-only admin surface. Different shell accent (subtle purple tint) to distinguish from renter/provider UIs.

| File | Purpose |
|---|---|
| `Index.html` | Ops surface index |
| `Overview.html` | GMV, active jobs, fleet health, incidents |
| `Fleet Map.html` | Geographic map of all provider rigs — Riyadh, Jeddah, Dammam, NEOM |
| `Jobs Monitor.html` | Live stream of all jobs |
| `Customers.html` | Customer list + account detail |
| `Providers.html` | Provider list + account detail |
| `Pricing Control.html` | Rate card editor |
| `Billing and Payouts.html` | Invoicing + provider payouts |
| `Incidents.html` | Incident list + runbook |
| `On-Call.html` | Rotation schedule |
| `Support Tickets.html` | Zendesk-style ticket queue |
| `Compliance.html` | CITC, SDAIA, ZATCA audit trails |
| `Feature Flags.html` | LaunchDarkly-style flag console |
| `Models Catalog.html` | Model catalog editor |
| `Admin Audit Log.html` | Privileged-action log |

### Sales deck (`deck/`)

| File | Purpose |
|---|---|
| `DCP Deck - Editorial.html` | 10-slide editorial deck — Cover, Problem, Solution, Why Now, Market, Product, Traction, Go-to-Market, The Ask, Contact |
| `deck-stage.js` | Slide-deck web component (auto-scale, keyboard nav, slide counter, print-to-PDF) |

## Interactions & Behavior

### Global patterns

- **⌘K / Ctrl-K** — opens command palette from any screen (both topbar and modal overlay)
- **Language toggle** — persists to `localStorage` under `dcp.lang`, applies `dir="rtl"` on `<html>` for Arabic, swaps font family via CSS vars
- **Org / team switcher** — dropdown in sidebar, changes context across all app pages
- **Tab navigation** — focus ring visible, tab order matches reading order (inverted for RTL)
- **Copy buttons** — on every code block, ticker value, API key; toast confirms "Copied"
- **Empty states** — all lists have purposeful empty states with a CTA (not just "no items")
- **Loading states** — skeleton rows for tables, spinner for single-item, pulse for charts
- **Error states** — inline field errors (red hairline + text below), page-level error banners at top
- **Preloader** — 900ms branded preloader first visit per session (session storage key `dcp.preloaded`), skipped subsequently

### Page-specific

- **Landing hero** — canvas noise map renders in the right column; respects `prefers-reduced-motion` by rendering a static SVG instead
- **Playground streaming** — tokens arrive at 40-80ms intervals; stop button aborts; params are live (no apply button)
- **Models detail** — benchmark bars animate in on reveal (one-shot, not on every scroll)
- **Jobs drawer** — slides in from right, 320ms ease-out; Esc dismisses; backdrop is `rgba(10,11,26,0.6)`
- **Audit filter rail** — checkboxes filter live; count pill updates immediately
- **Usage chart** — hover shows day tooltip (stacked breakdown by model); legend click toggles series
- **Docs ⌘K search** — fuzzy over page titles + section headings; arrow keys navigate results; Enter jumps to anchor

### Animations

- **Page reveal** — `[data-reveal]` elements fade + rise 10px over 320ms, staggered 60ms, one-shot
- **Number roll** — KPI values count from 0 to target over 600ms on first reveal
- **Magnetic CTAs** — primary buttons offset 2-3px toward cursor within 80px radius
- **Sidebar collapse** — 200ms ease-out, icons remain visible at 56px collapsed width
- **Hover** — card borders lift from `--line` to `rgba(255,255,255,0.14)` over 180ms

All motion respects `prefers-reduced-motion: reduce` — reveals become instant, number rolls show final value immediately, magnetic CTAs disable.

## State Management

Client-side state is minimal in the prototypes (React useState). For production:

- **Auth** — JWT in httpOnly cookie; Nafath SSO handled by existing IAM provider
- **User / org** — single context provider at app root; invalidate on org switch
- **API keys** — server-side encrypted at rest; client only sees prefix + creation metadata
- **Playground conversation** — session-only by default, with "Save to library" action
- **Usage / billing** — SWR/React Query with 60s refresh for dashboards, 5min for invoices
- **Feature flags** — client-fetched at session start, updated via websocket for live toggles

Data shapes are documented in the mock files:

- `assets/data.js` — legacy marketplace data
- `assets/data-public.js` — public-site data (pricing rates, FAQ, etc.)
- `assets/data-app.js` — renter shared data (user, org, team, keys, billing, usage)
- `assets/data-renter.js` — renter-specific data
- `assets/data-provider.js` — provider-specific data
- `assets/data-ops.js` — ops-shared data (models catalog, jobs, audit events)
- `assets/data-ops-admin.js` — admin-only data

## Design Tokens

All tokens live in `assets/dcp-kit.css` (the single source of truth). Port these 1:1 to the target codebase.

### Color — Midnight (default)

```css
--bg:           #0a0b1a;  /* page ground */
--surface:      #12142a;  /* card */
--surface-2:    #191c3a;  /* inner panel */
--ink:          #f5f3ee;  /* primary text */
--ink-dim:      rgba(245,243,238,0.72);
--ink-faint:    rgba(245,243,238,0.44);
--line:         rgba(255,255,255,0.08);
--line-strong:  rgba(255,255,255,0.14);

--orange:       #D97757;  /* terracotta accent (primary) */
--orange-2:     #E88A6E;
--teal:         #4aa598;  /* cool accent */
--teal-2:       #63bfb1;

--ok:           #4aa598;  /* success */
--warn:         #E8B75B;  /* warning */
--danger:       #DD5C4A;  /* error */
--info:         #6AA8D9;  /* info */
```

### Color — Paper (deck break-slides only)

```css
--bg:           #f5f3ee;  /* cream */
--surface:      #ffffff;
--ink:          #1a1d2e;  /* dark navy ink */
```

### Typography

```css
--display: 'Libre Caslon Text', 'Times New Roman', serif;
--sans:    'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--mono:    'Space Mono', 'SF Mono', Menlo, monospace;
--arabic:  'IBM Plex Sans Arabic', 'Tajawal', 'Noto Sans Arabic', sans-serif;

/* Scale */
--t-display-xl: clamp(48px, 6vw, 88px);   /* hero h1 */
--t-display-l:  clamp(36px, 4.5vw, 56px); /* section h2 */
--t-display-m:  clamp(28px, 3vw, 40px);   /* subsection */
--t-body-l:     18px;
--t-body:       15px;
--t-body-s:     13px;
--t-caption:    12px;
--t-eyebrow:    11px;  /* uppercase + 0.12em tracking */
```

### Spacing

4px base. `--s1` through `--s10` = 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.

### Radius

`--r-sm: 4px; --r-md: 8px; --r-lg: 12px; --r-xl: 20px; --r-full: 999px;`

### Shadows

Minimal — midnight theme mostly uses hairline borders. One shadow for modals / drawers:
```css
--shadow-modal: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
```

## Assets

Brand assets (in `assets/` and `uploads/`):

- `dcp-logo.webp` — wordmark
- `dcp-logo-square.jpeg` — icon-mark
- `dcp-logo-primary.webp` — primary lockup (from brand team)

Icons are inline SVG via `<Icon name="...">` component in `assets/dcp-kit.jsx`. ~40 icons, stroke-1.5, 20×20 viewBox. If the target codebase uses Lucide/Heroicons/Feather, substitute directly — the names align.

No illustrations are shipped. Placeholders are used where real imagery belongs — coordinate with brand team.

## Internationalization

Full EN/AR parity. Copy strings live in `assets/i18n.js` + `assets/docs-content.js` (docs only). RTL rules live in `assets/app-i18n-rtl.css`.

Every string has an Arabic counterpart. Numbers stay Arabic-Indic or Latin per screen context (UI uses Latin for tech metrics; marketing uses Arabic-Indic where culturally appropriate). Phone numbers are always `+966 5X XXX XXXX` format.

## Framework files

The design system is split across:

- `assets/dcp-kit.css` (693 lines) — design tokens + primitive component styles
- `assets/dcp-kit.jsx` (663 lines) — React primitives: `<Button>`, `<Badge>`, `<Chip>`, `<Icon>`, `<Card>`, `<Table>`, `<Select>`, `<Input>`, `<Modal>`, `<Tooltip>`, `<Tabs>`, `<Toast>`, etc.
- `assets/dcp-kit.README.md` — reference doc for the kit
- `assets/app-shell.css` + `app-shell.jsx` — shared renter shell (sidebar, topbar, main container)
- `assets/provider-shell.css` + `provider-shell.jsx` — provider shell
- `assets/ops-shell.css` + `ops-shell.jsx` — ops shell
- `assets/app-polish.js` — motion primitives (preloader, reveals, number-roll, magnetic CTAs)
- `assets/app-i18n-rtl.css` — RTL overrides

## Files in this bundle

Root:
- `README.md` — this file
- `DCP Redesign.html` — primary landing page
- `DCP Kit.html` + `DCP Kit.jsx` — design system reference sheet (renders every primitive)

Folders:
- `assets/` — design tokens, primitives, shells, mock data, i18n
- `public/` — public site pages
- `docs/` — documentation site
- `app/` — renter + provider app screens
- `ops/` — ops/admin console
- `deck/` — sales deck

## Recommended implementation order

1. **Port tokens** — copy `dcp-kit.css` values into the target codebase's theme config
2. **Build primitives** — map `<Button>`, `<Input>`, `<Badge>`, etc. to the target codebase's component library (or build them)
3. **Build shells** — app shell, provider shell, ops shell — these are the frames every page sits in
4. **Build screens in this order** — Landing → Auth → Console (renter dashboard) → Playground → Models → Usage → Settings → Jobs → Audit → Provider surfaces → Ops surfaces → Docs → Deck
5. **Wire data** — replace each `assets/data-*.js` import with a real API call, preserving the documented shape
6. **Add i18n** — pipe `i18n.js` strings into the target codebase's i18n library (next-intl, react-i18next, Vue I18n, etc.); add RTL support at the root layout

## Open questions for the team

- **Auth backend** — Nafath SSO integration details (IAM provider? custom?)
- **Payment rail** — Moyasar? HyperPay? Custom PSP? (affects Wallet + Settings/Billing)
- **Data residency** — all services in Saudi region (Riyadh, Jeddah)? Confirm cloud provider
- **Analytics** — PostHog / Mixpanel / custom? (affects Usage drilldown refresh cadence)
- **Deployment target** — SSR? SSG? CSR SPA? (affects routing & data-fetching strategy)

## Contact

This design was produced on the DCP design system v1. For questions, check the `dcp-kit.README.md` first, then reach out to the design team.
