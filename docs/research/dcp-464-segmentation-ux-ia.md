# DCP-464: Customer Segmentation + Competitor UX Intelligence

Date: 2026-03-21 (UTC)
Owner: UX Researcher / Competitive Analyst

## Scope and guardrails
- Focus: conversion copy, onboarding flow, and information architecture for DCP's real product (container-based GPU jobs + browser playground + provider daemon).
- No fabricated claims or inferred pricing. Only public facts visible on official competitor pages on 2026-03-21.
- All recommendations are constrained to current DCP capabilities.

## Evidence snapshot (official sources, verified 2026-03-21)

| Competitor | UX/messaging pattern | Verified evidence | DCP implication |
|---|---|---|---|
| Vast.ai | Marketplace transparency and pricing-mode clarity | Pricing page explicitly separates `On-Demand`, `Interruptible`, `Reserved`; includes `Per-second billing`, `50%+ cheaper` interruptible claim, and `Up to 50% Off` reserved framing. | Keep DCP billing mechanics visible above fold: estimate hold, runtime settlement, automatic unused refund. |
| RunPod | Product-mode framing first (`Pods` vs `Serverless`) | Pricing page emphasizes mode selection and cloud choices (Community vs Secure), then conversion CTA. | Keep DCP's two tracks explicit at top-level: browser-first playground vs container jobs. |
| Lambda | Procurement clarity for enterprise | Pricing page shows on-demand values for B200/H100 and routes reserved pricing to sales (`Talk to our team`). | Separate self-serve path and sales-assisted/enterprise path in IA and CTA copy. |
| Together AI | Progressive adoption path | Pricing narrative positions serverless start and dedicated scale-up path. | Sequence renter onboarding: first successful job quickly, then "bring your own container" guidance. |
| Akash | Developer portability + sovereignty language | Homepage highlights `Docker Native`, `Deployment Speed < 60 Seconds`, and decentralized positioning. | Lead with portability proof: if workload is containerized, DCP can run it with minimal adaptation. |
| Replit | Low-friction plan ladder and simple action language | Pricing page presents straightforward plan ladder with clear paid tiers and immediate start CTA style. | Reduce cognitive load on DCP public pages: intent-based nav labels and action-first CTA text. |

## DCP target segment map

| Segment | Job-to-be-done | Trigger | Main objection | Conversion message to prioritize |
|---|---|---|---|---|
| KSA startups (renters) | Launch production inference/training without fixed contracts | Immediate GPU need, budget sensitivity | "Will costs be unpredictable?" | "Live rates, pay-as-you-go, runtime-settled billing in SAR/halala." |
| SME product teams (renters) | Get first AI feature live fast, then scale | Need speed without infra overhead | "Do we need ML infra specialists?" | "Start in browser, scale to container jobs when ready." |
| Enterprise/regulated teams (renters) | Pilot with governance and reliability signals | Compliance + procurement process | "Can this be trusted for regulated workloads?" | "PDPL-aware policies, transparent status, support/legal discoverability." |
| GPU owners / small data centers (providers) | Monetize idle NVIDIA GPUs | Existing hardware + income motivation | "Setup friction and payout confidence" | "Lightweight daemon, clear earnings math, step-by-step activation status." |
| Infra-native teams (both) | Run existing container workloads with minimal change | Existing Docker pipelines | "Will workloads port cleanly?" | "Container-native execution path with API-driven submission." |

## Priority recommendations (conversion + IA)

### P0 (high impact, low-medium effort)
1. Make renter path choice explicit in the first viewport.
- Why: Mode-first UX is consistent across RunPod/Together and lowers first-click ambiguity.
- Change: keep two cards but sharpen labels and outcomes:
- `Playground (browser, no setup)`
- `Container Jobs (API + Docker image)`
- File mapping:
- `app/page.tsx`

2. Add billing transparency module where users decide to register/pay.
- Why: Vast/Lambda reduce hesitation by clarifying cost mechanics at decision points.
- Change copy:
- "You prepay an estimate in halala. Final cost is settled on actual runtime. Unused hold is returned automatically."
- File mapping:
- `app/page.tsx`
- `app/renter/register/page.tsx`
- `app/docs/quickstart/page.tsx`

3. Rename top nav labels to user intent.
- Why: `Compute` and `Supply` are concise but less clear for new users.
- Change:
- `Rent GPUs`, `Earn with GPUs`, `Marketplace`, `Docs`, `Support`
- keep `Console Login` secondary.
- File mapping:
- `app/components/layout/Header.tsx`
- `app/components/layout/Footer.tsx`

### P1 (medium impact, medium effort)
1. Provider trust module on post-registration success state.
- Why: Provider conversion hinges on setup confidence and payout expectations.
- Change block: "What runs on your machine" (heartbeat interval, job polling cadence, pause/resume control) + "earnings are scenario estimates, not guarantees".
- File mapping:
- `app/provider/register/page.tsx`
- `app/earn/page.tsx`

2. Compress renter first-job onboarding into one guided checklist.
- Why: Competitors with high conversion reduce step ambiguity and keep momentum.
- Change: explicit 5-step list with deep links: register -> top up -> marketplace -> submit template job -> monitor output.
- File mapping:
- `app/docs/quickstart/page.tsx`
- `app/renter/register/page.tsx`

3. Add reliability context near marketplace and home CTAs.
- Why: Trust signals drive conversion for first-time marketplace users.
- Change: show live provider count, GPU family coverage, and last-updated timestamp near CTA cluster.
- File mapping:
- `app/page.tsx`
- `app/renter/marketplace/page.tsx`

## Copy proposals (safe for immediate implementation)
- Hero subhead:
- "Run container-ready AI workloads in minutes. Start in the browser, scale with Docker when ready."
- Billing explainer:
- "Estimated cost is held upfront in halala. Final billing uses actual runtime, and unused balance is auto-refunded."
- Provider value line:
- "Turn idle NVIDIA GPUs into SAR with a lightweight daemon and per-job earnings."
- Path labels:
- "Playground: browser-first, no setup"
- "Container Jobs: bring your own image, API-driven"

## IA recommendation (public site)

Recommended top-level IA:
- `/` Positioning + path chooser
- `/rent` renter intent entry (or equivalent nav target to `/renter/register`)
- `/earn` provider intent entry
- `/marketplace` live GPU browse
- `/docs` quickstart + API + guides
- `/support` contact/FAQ/legal handoff

Pragmatic rollout order:
1. Update nav labels and CTA text without route changes.
2. Add billing transparency and first-job checklist modules.
3. Introduce intent wrapper routes (`/rent`, `/earn`) only if analytics show nav confusion remains.

## Implementation checklist
- [ ] Update public nav labels in `Header`/`Footer`
- [ ] Add renter billing explainer module on home/register/quickstart
- [ ] Tighten path-choice card labels in hero area
- [ ] Add provider post-registration trust module
- [ ] Add renter first-job checklist with deep links
- [ ] Add live reliability strip near primary CTAs

## Sources (official)
- Vast pricing: https://vast.ai/pricing
- RunPod pricing: https://www.runpod.io/pricing
- Lambda pricing: https://lambda.ai/pricing
- Together AI pricing: https://www.together.ai/pricing
- Akash homepage: https://akash.network/
- Replit pricing: https://replit.com/pricing
