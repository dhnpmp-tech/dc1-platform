# DCP UX + Competitive Conversion Delta (2026-03-22)

## Scope
- Competitors reviewed: Vast.ai, Runpod, Lambda, Akash, Together.ai, Replit
- Goal: conversion-focused copy, onboarding, and IA recommendations for DCP
- Constraints enforced: no fabricated pricing/claims, no bare-metal claims, container-based GPU reality only

## Evidence Snapshot (Primary Sources)
- Vast.ai: marketplace-first buying UX, price/filter-led discovery expectations
  - Source: https://docs.vast.ai/documentation/instances/pricing
- Runpod: serverless execution positioning and fast path to run workloads
  - Source: https://www.runpod.io/product/serverless
- Lambda: launch/monitor/manage lifecycle clarity for cloud GPU instances
  - Source: https://docs.lambda.ai/public-cloud/console/
- Akash: deployment-first and marketplace framing for provider-supplied compute
  - Source: https://akash.network/deploy/
- Together.ai: model-first product presentation and clear inference pathing
  - Source: https://www.together.ai/pricing
- Replit: low-friction onboarding and immediate action orientation
  - Source: https://replit.com/pricing

## Segment Map (DCP)
1. Provider operators (single GPU owners, small labs)
- Conversion driver: setup confidence + earnings visibility + reliability trust
- Current friction: post-registration expectations are not always explicit enough

2. Renter builders (startups, AI teams, app devs)
- Conversion driver: first successful job fast, clear job-state semantics
- Current friction: competing paths across docs/playground/job pages can dilute intent

3. Arabic AI teams (MENA regional focus)
- Conversion driver: confidence that Arabic model support is first-class and intentional
- Current friction: differentiator appears, but not always top-of-funnel and role-specific

4. Ops/security-conscious evaluators
- Conversion driver: clear execution model, observability language, deterministic next steps
- Current friction: support/docs/onboarding architecture is usable but can be tighter

## DCP Positioning Requirements (must stay headline-level)
- Saudi energy-cost advantage as a structural cost narrative
- Arabic AI model-first support (ALLaM, Falcon H1, JAIS, BGE-M3)
- Explicitly containerized GPU compute (NVIDIA Container Toolkit), never "bare-metal"

## UX/IA Recommendations Mapped to Existing Pages

### P0 (highest conversion impact)
1. Homepage role split + primary value hierarchy
- Files:
  - /home/node/dc1-platform/app/page.tsx
  - /home/node/dc1-platform/app/components/layout/Header.tsx
- Exact changes:
  - Add two explicit top CTAs: provider path and renter path
  - Move Saudi-cost + Arabic-model thesis above fold
  - Add single-line execution clarity: containerized GPU jobs
- Acceptance criteria:
  - New user can reach a role-specific first action in <=2 clicks
  - Differentiator copy is visible before first major scroll
- Suggested assignee role: Frontend Developer

2. Provider onboarding outcome certainty
- Files:
  - /home/node/dc1-platform/app/provider/register/page.tsx
  - /home/node/dc1-platform/app/provider/download/page.tsx
- Exact changes:
  - Add "what happens next" sequence after registration
  - Add install success/failure states with next actions
  - Clarify daemon + heartbeat expectations in plain language
- Acceptance criteria:
  - Provider can state expected next state without leaving page
  - Fewer support escalations for first-time install confusion
- Suggested assignee role: Frontend Developer

3. Renter first-job clarity
- Files:
  - /home/node/dc1-platform/app/renter/playground/page.tsx
  - /home/node/dc1-platform/components/jobs/JobSubmitForm.tsx
- Exact changes:
  - Add concise job-state glossary (queued/running/completed/failed)
  - Add direct "next action" per state
  - Keep one canonical first-job path
- Acceptance criteria:
  - First-time renters complete a test job with no page-hopping ambiguity
- Suggested assignee role: Frontend Developer

### P1 (strong follow-through impact)
4. Docs IA normalization by role
- Files:
  - /home/node/dc1-platform/app/docs/quickstart/page.tsx
  - /home/node/dc1-platform/app/docs/provider-guide/page.tsx
  - /home/node/dc1-platform/app/docs/renter-guide/page.tsx
  - /home/node/dc1-platform/app/docs/[[...slug]]/page.tsx
- Exact changes:
  - Make docs entry role-aware (provider vs renter)
  - Remove duplicate/conflicting first-run instructions
  - Add common glossary for containerized job execution terms
- Acceptance criteria:
  - Role-specific quickstart is unambiguous and linear
- Suggested assignee role: Frontend Developer

5. Support triage by role/use-case
- Files:
  - /home/node/dc1-platform/app/support/page.tsx
  - /home/node/dc1-platform/app/components/layout/Footer.tsx
- Exact changes:
  - Introduce role-based support pathways (provider install, job failures, billing questions)
  - Add direct links from footer to role-specific support anchors
- Acceptance criteria:
  - Reduced generic support requests lacking actionable context
- Suggested assignee role: Frontend Developer

### P2 (quality and retention)
6. Marketplace and job-route consistency
- Files:
  - /home/node/dc1-platform/app/marketplace/page.tsx
  - /home/node/dc1-platform/app/jobs/submit/page.tsx
  - /home/node/dc1-platform/app/renter/jobs/page.tsx
- Exact changes:
  - Harmonize wording and route intent so submission flow is clearly canonical
  - Add clear trust/status labels where users choose providers
- Acceptance criteria:
  - Fewer duplicate entry-path confusions in renter journey analytics
- Suggested assignee role: Frontend Developer

## Risks to Avoid
- Do not publish fixed pricing claims or implied guaranteed earnings
- Do not imply instant payouts/assignment guarantees unless backend guarantees exist
- Do not use "bare-metal" terminology

## Implementation Checklist
1. `P0` — Homepage and role split conversion pass
- Files: `app/page.tsx`, `app/components/layout/Header.tsx`
- Changes: role CTAs, value hierarchy, containerized execution line
- Acceptance: role-specific first action <=2 clicks
- Suggested assignee: Frontend Developer

2. `P0` — Provider onboarding certainty pass
- Files: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`
- Changes: next-state contract, install result states, heartbeat expectations
- Acceptance: reduced install confusion/support loops
- Suggested assignee: Frontend Developer

3. `P0` — Renter first-job confidence pass
- Files: `app/renter/playground/page.tsx`, `components/jobs/JobSubmitForm.tsx`
- Changes: job-state glossary + next-action mapping
- Acceptance: successful first test job without path ambiguity
- Suggested assignee: Frontend Developer

4. `P1` — Docs role IA cleanup
- Files: `app/docs/quickstart/page.tsx`, `app/docs/provider-guide/page.tsx`, `app/docs/renter-guide/page.tsx`, `app/docs/[[...slug]]/page.tsx`
- Changes: role-specific quickstarts, deduplicate instructions
- Acceptance: linear docs path per segment
- Suggested assignee: Frontend Developer

5. `P1` — Support routing by role
- Files: `app/support/page.tsx`, `app/components/layout/Footer.tsx`
- Changes: role/use-case support entry points
- Acceptance: fewer non-actionable support tickets
- Suggested assignee: Frontend Developer

6. `P2` — Marketplace/job-path consistency
- Files: `app/marketplace/page.tsx`, `app/jobs/submit/page.tsx`, `app/renter/jobs/page.tsx`
- Changes: canonical path language and status/trust consistency
- Acceptance: lower path fragmentation in renter flow
- Suggested assignee: Frontend Developer
