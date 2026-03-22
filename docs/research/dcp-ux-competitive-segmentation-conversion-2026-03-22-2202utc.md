# DCP UX Competitive Snapshot + Conversion Recommendations
Date: 2026-03-22 22:02 UTC  
Role: UX Researcher / Competitive Analyst

## Scope
Competitors reviewed: Vast.ai, Runpod, Lambda, Akash, Together.ai, Replit.

Goal: conversion-focused copy, onboarding, and IA recommendations aligned with DCP reality (containerized GPU execution via Docker + NVIDIA toolkit, no bare-metal claims, no fabricated pricing claims).

## Evidence Highlights (Official surfaces, March 2026)
1. Mode-first packaging dominates competitor IA
- Vast: GPU Cloud + Serverless + Clusters on one page.
- Runpod: Serverless + Pods + model endpoints as top-level concepts.
- Together: Serverless inference, dedicated inference, and GPU clusters.
- Lambda: self-serve GPU cloud plus enterprise-scale cluster options.
- Pattern: users choose operating mode first, then hardware/details.

2. Fast time-to-first-workload messaging is above the fold
- Competitors repeatedly use language equivalent to "deploy quickly" and "start now" before deep docs.
- Replit AI flow emphasizes immediate build/ship loop from prompt.

3. Enterprise lane is explicit, not hidden in support/legal
- Together/Lambda keep contact-sales and enterprise route visible near self-serve CTA.

4. Cost framing is paired with trust framing
- Vast/Akash use cost-efficiency framing in hero-level messaging.
- Runpod/Together pair cost/performance language with reliability and scaling primitives.

## DCP Segment Map (Who we are optimizing for)
1. Self-Serve Renter (startup/indie)
- JTBD: run first inference/training workload with minimal setup.
- Critical copy need: "what to click first" and "how billing settles" in one viewport.

2. Provider (GPU owner)
- JTBD: register hardware and reach earning-ready status quickly.
- Critical copy need: confidence in daemon setup + readiness state + payout model clarity.

3. Enterprise Buyer
- JTBD: validate security/support path for pilot.
- Critical IA need: enterprise route as a first-class lane from landing and support.

4. Arabic AI Team (regional ML teams)
- JTBD: quickly choose and launch Arabic-first models.
- Critical IA need: ALLaM/Falcon/JAIS/BGE path visible before generic catalog depth.

## Recommendations (Conversion-first, file-mapped)
### P0
1. Strengthen headline hierarchy on landing
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Change: ensure hero opens with (a) Saudi energy-cost structural advantage, (b) Arabic AI model support, then (c) containerized execution trust line.
- Why: aligns with strongest differentiation vs global competitors using generic "GPU cloud" positioning.
- Acceptance criteria:
  - Both differentiators visible above fold in EN + AR.
  - No bare-metal wording.
  - CTA labels remain mode-first (rent/provider/enterprise/docs).
- Suggested assignee: Frontend Developer

2. Reduce renter activation lag after key creation
- Files: `app/renter/register/page.tsx`, `app/lib/i18n.tsx`
- Change: keep success state focused on one primary next action (`/renter/playground`) and one secondary action (`/renter/marketplace`), demoting tertiary links visually.
- Why: competitors optimize for one immediate workload action; too many equal-weight links slows activation.
- Acceptance criteria:
  - One primary CTA visually dominant.
  - Existing trust/billing explainer preserved.
- Suggested assignee: Frontend Developer

3. Make enterprise intake unmistakable in support hero zone
- Files: `app/support/page.tsx`, `app/lib/i18n.tsx`
- Change: add a top-level enterprise intake card above general support cards with dedicated CTA and expected response flow copy.
- Why: enterprise route is currently present but not visually dominant.
- Acceptance criteria:
  - Enterprise option visible without scroll on desktop.
  - Category preselection remains preserved in route params.
- Suggested assignee: Frontend Developer

### P1
4. Promote mode-switch strip into docs entry points
- Files: `app/docs/page.tsx`, `docs/quickstart.mdx`, `app/docs/quickstart/page.tsx`
- Change: repeat the same 4-lane chooser at docs entry and quickstart top (renter, provider, enterprise, Arabic models).
- Why: competitor docs minimize dead-end reading by routing users into execution mode quickly.
- Acceptance criteria:
  - Same lane order/labels as landing.
  - Links include source/lane analytics params.
- Suggested assignee: Frontend Developer / Technical Writer

5. Add "proof ribbon" to marketplace top section
- Files: `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Change: compact trust ribbon above listing grid: live GPU count, heartbeat freshness, settlement reminder, Arabic model discovery link.
- Why: reinforces decision confidence near action surface; mirrors competitor trust+cost framing near conversion zones.
- Acceptance criteria:
  - Ribbon renders before provider cards.
  - Existing filters and reliability cards remain intact.
- Suggested assignee: Frontend Developer

## Copy Direction (guardrails)
- Do:
  - Lead with Saudi energy-cost advantage and Arabic AI support.
  - Keep container-runtime reality explicit (Docker + NVIDIA toolkit).
  - Use usage-based settlement wording already present in platform.
- Do not:
  - Invent specific savings percentages for DCP.
  - Claim bare-metal GPU provisioning.
  - Promise payment rails not yet implemented.

## Implementation Checklist
1. P0 — Landing differentiator hierarchy
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Exact change: hero copy order = energy advantage -> Arabic AI support -> containerized execution trust line.
- Acceptance: above-fold visibility in EN/AR, no bare-metal claims.
- Assignee: Frontend Developer.

2. P0 — Renter success-state CTA simplification
- Files: `app/renter/register/page.tsx`, `app/lib/i18n.tsx`
- Exact change: single dominant CTA to `/renter/playground`; secondary to `/renter/marketplace`.
- Acceptance: reduced CTA competition; preserved billing/trust copy.
- Assignee: Frontend Developer.

3. P0 — Enterprise support prominence
- Files: `app/support/page.tsx`, `app/lib/i18n.tsx`
- Exact change: enterprise-specific top card and route guidance above general support modules.
- Acceptance: enterprise lane visible without scroll; prefilled category remains functional.
- Assignee: Frontend Developer.

4. P1 — Docs mode-first routing
- Files: `app/docs/page.tsx`, `docs/quickstart.mdx`, `app/docs/quickstart/page.tsx`
- Exact change: consistent 4-lane chooser at docs entry and quickstart top.
- Acceptance: lane consistency with landing + tracking params.
- Assignee: Frontend Developer / Technical Writer.

5. P1 — Marketplace trust/proof ribbon
- Files: `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Exact change: top ribbon for live availability + settlement reminder + Arabic model link.
- Acceptance: appears above provider grid; no regression to existing filters/reliability modules.
- Assignee: Frontend Developer.

## Sources
- Vast.ai: https://vast.ai/
- Runpod overview/docs: https://docs.runpod.io/overview
- Runpod pricing: https://www.runpod.io/pricing
- Lambda (cloud/pricing): https://www.lambda.ai/
- Akash: https://akash.network/
- Together AI: https://www.together.ai/
- Together pricing: https://www.together.ai/pricing
- Replit AI: https://replit.com/ai
- Replit pricing: https://replit.com/pricing
