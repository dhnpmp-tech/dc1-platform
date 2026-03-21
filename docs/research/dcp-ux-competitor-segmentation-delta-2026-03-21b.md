# DCP UX Competitor + Segmentation Delta (2026-03-21, Heartbeat B)

Date: 2026-03-21 (UTC)
Owner: UX Researcher / Competitive Analyst

## Scope
- Re-verify competitor UX/messaging patterns from official pages.
- Re-map DCP conversion segments to current funnel surfaces.
- Produce implementation-ready recommendations with exact DCP file targets.

## Evidence refresh (official pages, verified 2026-03-21)

| Competitor | Current UX/messaging signal | Source |
|---|---|---|
| Vast.ai | Pricing page leads with marketplace framing (`Live Marketplace Rates`) and explicit modes (`On-Demand`, `Interruptible`, `Reserved`) plus per-second billing. | https://vast.ai/pricing |
| RunPod | Pricing organizes by product mode (`Pods`, `Serverless`) with strong savings anchor language and region scale framing. | https://www.runpod.io/pricing |
| Lambda | Pricing blends self-serve launch with enterprise procurement branch (`Talk to our team`) and reserved/on-demand plan visibility. | https://lambda.ai/pricing |
| Together AI | Pricing explicitly describes an adoption ladder: start serverless, move to dedicated at scale. | https://www.together.ai/pricing |
| Akash | Homepage still foregrounds structural marketplace identity (`premier decentralized compute marketplace`). | https://akash.network/ |
| Replit | Homepage leads with low-friction outcome language (`Turn ideas into apps in minutes`) and setup-minimizing platform promises. | https://replit.com/ |

## DCP segment map (conversion-oriented)

| Segment | Core job | Primary objection | Message that converts | Primary entry |
|---|---|---|---|---|
| KSA renter (startup) | Run first production-adjacent job quickly | Cost uncertainty | "Estimate hold in halala, runtime settlement, unused hold auto-return." | `/` -> `/renter/register` -> `/renter/playground` |
| Product/dev renter | Validate workload quickly | Tooling complexity | "Browser-first path, then API/container path when ready." | `/` -> `/docs/quickstart` |
| Enterprise renter | De-risk supplier selection | Procurement support confidence | "Self-serve available now, enterprise intake path visible at first decision points." | `/` + `/support?category=enterprise` |
| Provider (GPU owner) | Monetize safely | Workload control risk | "Containerized jobs + daemon heartbeat + pause/resume controls." | `/earn` -> `/provider/register` |
| Infra-native team | Reuse existing CI/container flow | Lock-in concern | "Container-native job spec and API-driven orchestration." | `/docs/quickstart` + `/docs/api` |

## Current DCP gaps (delta)

### P0: Footer positioning drift on every public page
Observation:
- Footer brand copy currently says `Decentralized Compute Platform...` and uses generalized global-marketplace phrasing.
- This weakens DCP's required primary positioning (Saudi energy-cost advantage + Arabic AI support) and mirrors competitor framing instead of differentiating it.

File evidence:
- `app/components/layout/Footer.tsx`

### P1: Enterprise path lacks explicit intake checklist on support page
Observation:
- `/support?category=enterprise` prefill exists, but no practical intake checklist (required context to include, expected response framing, procurement handoff details).
- Competitors with stronger enterprise conversion provide explicit contact branch confidence cues.

File evidence:
- `app/support/page.tsx`

### P1: Conversion-copy ownership still fragmented outside canonical i18n blocks
Observation:
- Key conversion pages still mix centralized i18n and page-local string maps. This increases drift risk across EN/AR over time.
- Home/playground have improved, but quickstart/register/support still have partial local ownership patterns.

File evidence:
- `app/docs/quickstart/page.tsx`
- `app/renter/register/page.tsx`
- `app/support/page.tsx`
- `app/lib/i18n.tsx`

## Implementation Checklist

| Priority | File path(s) | Exact change needed | Acceptance criteria | Suggested assignee |
|---|---|---|---|---|
| P0 | `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx` | Replace generic footer brand paragraph with DCP-specific differentiator copy (Saudi energy-cost structural advantage + Arabic AI model readiness + container-based execution) in EN/AR. | Footer messaging is aligned with platform positioning and available in both languages; no fabricated pricing figures; no bare-metal claims. | Frontend + Copywriter |
| P1 | `app/support/page.tsx`, `app/lib/i18n.tsx` | Add enterprise intake block under enterprise prefill banner: requested info checklist (workload type, expected usage window, compliance needs, preferred SLA/response window). | Enterprise visitor sees concrete next-step guidance before form submit; EN/AR parity preserved. | Frontend + UX |
| P1 | `app/docs/quickstart/page.tsx`, `app/renter/register/page.tsx`, `app/support/page.tsx`, `app/lib/i18n.tsx` | Consolidate conversion-critical strings into canonical i18n keys and reference shared blocks where repeated. | No contradictory EN/AR conversion copy across these pages during diff review; shared keys used for repeated copy. | Frontend + i18n reviewer |

## Notes
- All recommendations are constrained to DCP's container-based GPU execution model.
- No pricing/rate claims are introduced in this delta.
