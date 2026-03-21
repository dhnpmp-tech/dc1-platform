# DCP-489: Competitor UX/Messaging Refresh + Conversion IA Updates

Date: 2026-03-21 (UTC)
Owner: UX Researcher / Competitive Analyst

## Scope and guardrails
- Benchmarked: Vast.ai, RunPod, Lambda, Akash, Together AI, Replit.
- Focus: conversion messaging, onboarding structure, and information architecture.
- Guardrails: no fabricated pricing/rates, no bare-metal claims, recommendations constrained to DCP's container-based execution reality.

## Evidence snapshot (official pages, verified 2026-03-21)

| Competitor | Observed UX/messaging pattern | Evidence (official source) | DCP implication |
|---|---|---|---|
| Vast.ai | Marketplace pricing transparency + explicit pricing modes | Pricing page metadata and page copy emphasize live market rates, `On-demand`, `Interruptible`, `Reserved`, and `Per-Second Billing`. https://vast.ai/pricing | Keep billing mechanics and mode clarity visible where conversion decisions happen (home + renter register + playground). |
| RunPod | Productized mode framing (`Pods`, `Serverless`, etc.) + strong cost anchor | Pricing page description: `GPU cloud computing at up to 80% less than hyperscalers` and mode-oriented pricing navigation. https://www.runpod.io/pricing | Keep DCP renter entry split explicit: browser-first playground vs API/container path. |
| Lambda | Enterprise procurement path blended with transparent on-demand entry | Pricing page: transparent on-demand language plus repeated `Talk to our team` for reserved commitments. https://lambda.ai/pricing | Preserve self-serve CTA while adding clear enterprise/contact path in IA. |
| Together AI | Progressive adoption ladder from free/serverless to dedicated/cluster | Pricing page description: `Start for free, scale on demand` across serverless/dedicated/cluster modes. https://www.together.ai/pricing | Optimize first-job success flow first, then expose advanced scale options progressively. |
| Akash | Marketplace + structural cost narrative as headline differentiator | Homepage: `Decentralized Compute Marketplace`; pricing section explains `global reverse auction` model and overhead framing. https://akash.network/ | DCP should headline structural Saudi energy-cost advantage earlier and more explicitly. |
| Replit | Low-friction outcome language and setup minimization | Homepage description: `Build and deploy software ... without spending a second on setup.` https://replit.com/ | Reduce onboarding friction language: emphasize immediate first run before advanced controls. |

## Updated DCP segment map (conversion-oriented)

| Segment | Primary trigger | Top objection | Message that converts | Primary page(s) |
|---|---|---|---|---|
| KSA startup renter | Need inference/training this week | Cost unpredictability | `Prepay estimate hold in halala, final runtime settlement, auto-refund unused hold.` | `/`, `/renter/register`, `/renter/playground` |
| Product/dev team renter | Wants first success quickly | Tooling complexity | `Start in browser, move to API/container when ready.` | `/`, `/docs/quickstart`, `/renter/playground` |
| Enterprise renter | Needs procurement confidence | Governance + support confidence | `Clear self-serve path plus enterprise contact/sales path.` | `/`, `/support`, `/docs` |
| Provider (GPU owner) | Wants safe monetization | Fear of uncontrolled machine usage | `What runs on your machine`, heartbeat/poll cadence, pause/resume control, earnings are estimates. | `/provider/register`, `/earn` |
| Infra-native team | Has existing Docker workloads | Portability risk | `Container-native execution path with explicit compatibility language.` | `/docs/quickstart`, `/docs/api`, `/renter/playground` |

## Recommended copy and IA changes

### P0
1. Clarify renter pathway in first viewport with single-sentence outcomes per path.
- Keep both paths visible: `Playground (browser, no setup)` and `Container Jobs (API + Docker image)`.
- Add one-line expected outcome per path (e.g., `Run your first job in minutes`).

2. Standardize billing clarity at all conversion moments.
- Use one canonical explainer block across home/register/playground.
- Preserve halala unit explanation and runtime settlement/refund language.

3. Add first-run readiness block on playground.
- Before submit: show balance sufficiency, cost estimate range, queue/reliability hint, and explicit blocker reasons with recovery CTA.

### P1
1. Add enterprise branch CTA near renter CTAs.
- Example: `Need reserved capacity or procurement support? Talk to us.`

2. Elevate structural differentiators above fold.
- Saudi energy-cost structural advantage.
- Arabic AI model support (ALLaM, Falcon, JAIS, BGE-M3) as platform positioning, not buried detail.

3. Make post-signup onboarding linear.
- One visual checklist after renter registration success and in quickstart docs, with deep links.

### P2
1. Add credibility strip with live signals near primary CTAs.
- Online provider count, GPU family coverage, last-updated timestamp.

2. Add a lightweight `why DCP vs alternatives` comparison section.
- Must remain factual and capability-based (no invented competitor claims).

## Implementation Checklist

| Priority | File path(s) | Exact change needed | Acceptance criteria | Suggested assignee |
|---|---|---|---|---|
| P0 | `app/page.tsx` | Ensure hero path chooser uses explicit labels + one-line outcome text under each renter path card. | Path cards are self-explanatory without scrolling; renter can choose path in one decision step. | Frontend Developer |
| P0 | `app/page.tsx`, `app/renter/register/page.tsx`, `app/renter/playground/page.tsx` | Reuse one canonical billing explainer string block (estimate hold -> runtime settlement -> auto-refund), including `100 halala = 1 SAR`. | Same billing block text appears in all 3 pages; no contradictory wording. | Frontend Developer |
| P0 | `app/renter/playground/page.tsx` | Add submission-readiness panel with explicit blocker reasons + recovery CTA (`Top up`, `Pick available provider`, etc.). | Submit is never disabled without reason; blocked state always includes an actionable CTA. | Frontend Developer |
| P1 | `app/page.tsx`, `app/support/page.tsx` (or existing support route) | Add enterprise/procurement branch CTA near renter CTAs with route to contact/support path. | Enterprise CTA visible above fold and links to working contact path. | Frontend Developer + DevRel |
| P1 | `app/page.tsx`, `app/lib/i18n.tsx` | Keep differentiator strip headline-level: Saudi energy advantage + Arabic model support; maintain EN/AR parity. | EN/AR both include both differentiators with no unsupported pricing claims. | Frontend Developer |
| P1 | `app/renter/register/page.tsx`, `app/docs/quickstart/page.tsx` | Ensure first-job checklist appears in both places with working deep links. | All checklist links route successfully; sequence matches actual product flow. | Frontend Developer + DevRel |
| P2 | `app/page.tsx`, `app/renter/marketplace/page.tsx` | Add/retain live reliability strip with timestamp and source-safe fallback behavior when API data is unavailable. | Strip renders without layout regression; fallback labels clearly identify stale/unavailable data. | Frontend Developer |
| P2 | `app/page.tsx`, `app/docs/quickstart/page.tsx` | Add compact factual comparison block (`Why DCP`) focused on energy geography + Arabic models + container workflow. | Block contains only verifiable capability statements; no fabricated rates or competitor claims. | DevRel + UX Researcher |

## Suggested instrumentation additions
- `landing_path_selected`
- `billing_explainer_viewed`
- `playground_submit_blocked_reason`
- `playground_block_recovery_cta_clicked`
- `enterprise_cta_clicked`
- `first_job_checklist_step_clicked`

## Source links
- https://vast.ai/pricing
- https://www.runpod.io/pricing
- https://lambda.ai/pricing
- https://www.together.ai/pricing
- https://akash.network/
- https://replit.com/
