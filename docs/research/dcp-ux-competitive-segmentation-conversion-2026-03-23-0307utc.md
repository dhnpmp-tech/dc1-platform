# DCP UX Competitive Segmentation + Conversion Recommendations (2026-03-23 03:07 UTC)

Owner: UX Researcher / Competitive Analyst (Codex)
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit competitor UX/messaging comparison; DCP segment mapping; conversion-focused copy/onboarding/IA actions aligned to DCP container-based GPU compute reality.

## Evidence Base (Official Sources, checked 2026-03-23 UTC)

1. Vast.ai pricing page (`https://vast.ai/pricing`)
- Uses "Live Marketplace Rates" framing and surfaces usage-based billing cues near purchase intent.
- UX signal: clear pricing mechanics are visible close to first action.

2. RunPod homepage and pricing (`https://www.runpod.io/`, `https://www.runpod.io/pricing`)
- Workload/product lanes are visible early (Pods, Serverless, etc.) and optimized for quick entry into execution paths.
- UX signal: action taxonomy precedes deep narrative.

3. Lambda homepage and pricing (`https://lambda.ai/`, `https://lambda.ai/pricing`)
- Prominent self-serve launch CTA and clear pricing destination.
- UX signal: split between direct launch and evaluation/sales path is explicit.

4. Akash quickstart/deploy guidance (`https://akash.network/docs/getting-started/quick-start/`)
- Shows template-first deployment flow and progressive status feedback during deployment.
- UX signal: first deployment success is optimized via guided templates and state transparency.

5. Together.ai homepage and pricing (`https://www.together.ai/`, `https://www.together.ai/pricing`)
- Platform and model usage framing tied to immediate start/build actions.
- UX signal: conversion sequence is intent -> action -> deeper capability detail.

6. Replit homepage and pricing (`https://replit.com/`, `https://replit.com/pricing`)
- Outcome-first prompt on homepage and straightforward plan structure on pricing.
- UX signal: reduced decision friction by clarifying value and plan choices early.

## Cross-Competitor UX Patterns Relevant to DCP

1. Single dominant CTA per primary visitor intent.
2. Workload-first IA (what user wants to run) over org-centric IA.
3. Proof blocks close to action controls (pricing method, readiness, trust).
4. Fast first-success path (minimal branching before first meaningful action).

## DCP Target Segment Map (Conversion Priority)

1. P0 Self-serve renter builders (Saudi startups, product teams)
- Primary conversion event: first successful submitted job.
- Message order: Saudi energy-cost advantage -> Arabic model support -> container execution reliability.
- Entry pages: `app/page.tsx`, `app/renter/register/page.tsx`, `app/login/page.tsx`.
- Activation pages: `app/renter/playground/page.tsx`, `app/jobs/submit/page.tsx`, `app/renter/marketplace/page.tsx`.

2. P0 Arabic-first AI teams (NLP, retrieval, local assistants)
- Primary conversion event: confidence in Arabic model availability and practical run path.
- Message order: energy advantage first, then Arabic portfolio evidence.
- Entry pages: `app/page.tsx`, `app/renter/marketplace/page.tsx`.
- Validation pages: `app/docs/models/index.mdx`, `app/docs/quickstart/page.tsx`, `app/docs/api/page.tsx`.

3. P1 Enterprise evaluators (procurement/security stakeholders)
- Primary conversion event: trust contact submission with clear expectation.
- Entry pages: `app/page.tsx`, `app/support/page.tsx`.
- Validation pages: `app/legal/privacy/page.tsx`, `app/terms/page.tsx`, `app/status/page.tsx`.

4. P0 GPU providers (NVIDIA owners with idle capacity)
- Primary conversion event: register -> daemon install -> heartbeat -> ready state.
- Entry pages: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`.
- Activation pages: `app/provider/page.tsx`, `app/provider/dashboard/page.tsx`.

## Code-Verified Friction in Current DCP Pages

1. Landing page branches too early for first-time visitors.
- File: `app/page.tsx`
- Evidence: `modeStripItems` and `pathChooserLanes` are defined in the same discovery surface as hero actions.
- Risk: visitor intent fragmentation before commitment.

2. Provider registration contains cross-intent lane switching inside onboarding.
- File: `app/provider/register/page.tsx`
- Evidence: `pathChooserLanes` includes renter/enterprise/docs routes during provider flow.
- Risk: provider onboarding abandonment before daemon setup.

3. Renter registration success flow still presents broad lane chooser after signup.
- File: `app/renter/register/page.tsx`
- Evidence: post-success surfaces include mode checklist and `pathChooserLanes`.
- Risk: lower percentage reaching first workload submit.

4. Login helper table explains destinations but weakens role-specific value cue near submit action.
- File: `app/login/page.tsx`
- Evidence: helper rows are informational; no concise "why sign in now" proof strip directly tied to selected role.
- Risk: slower conversion from authentication view to action.

5. Support category list is wide before role-routed path is selected.
- File: `app/support/page.tsx`
- Evidence: generic categories shown upfront, enterprise helper appears only after category selection.
- Risk: enterprise and urgent paths are less obvious at top of form.

## Conversion Copy + IA Recommendations

### P0 — Landing First-Fold Intent Compression
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Keep two above-fold primary actions only: renter path and provider path.
  - Move mode strip and multi-lane chooser below trust/proof section.
  - Lock top message order: Saudi energy-cost advantage -> Arabic model support -> containerized execution reliability.
- Acceptance criteria:
  - Exactly two primary CTA controls in first fold.
  - No fabricated pricing, savings, or earnings claims.
  - No bare-metal language.
- Suggested assignee role: Frontend Developer + Copywriter.

### P0 — Provider Onboarding Single-Track Progression
- Files:
  - `app/provider/register/page.tsx`
  - `app/lib/provider-install.ts`
  - `app/lib/i18n.tsx`
- Exact change:
  - Preserve one dominant CTA per `nextActionState` (`waiting`, `heartbeat`, `stale`, `paused`, `ready`).
  - Relocate cross-intent lanes to low-emphasis footer links.
- Acceptance criteria:
  - One visually primary action per provider state.
  - Existing `/api/providers/me` state mapping unchanged.
- Suggested assignee role: Frontend Developer.

### P0 — Renter Authentication/Register Proof Strip
- Files:
  - `app/login/page.tsx`
  - `app/renter/register/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Add compact proof strip above submit CTA with three consistent points:
    - Saudi energy-cost advantage
    - Arabic model support (ALLaM 7B, Falcon H1, JAIS 13B, BGE-M3)
    - GPU-accelerated container execution
- Acceptance criteria:
  - Identical proof semantics on login and renter register.
  - Localized text supported through i18n keys.
- Suggested assignee role: Frontend Developer + Copywriter.

### P1 — Marketplace Outcome Primer Before Card Grid
- Files:
  - `app/renter/marketplace/page.tsx`
  - `app/marketplace/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Add an above-grid primer block explaining:
    - what displayed rate means,
    - how to choose by workload,
    - where Arabic-model-ready options appear.
- Acceptance criteria:
  - Primer visible before first filter/card set.
  - No unsupported benchmark/latency guarantees.
- Suggested assignee role: Frontend Developer + Copywriter.

### P1 — Enterprise Support Fast-Lane Routing
- Files:
  - `app/support/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Add top-of-form quick route chips (Enterprise, Billing, Provider Incident) that preselect category and focus message field.
  - Keep existing API/fallback behavior unchanged.
- Acceptance criteria:
  - Enterprise route can be selected in one click from top of page.
  - Existing status states (`sent_api`, `sent_fallback`) remain truthful.
- Suggested assignee role: Frontend Developer.

## Recommended Funnel Copy Stack (Use Across Key Surfaces)

1. Headline layer: Saudi energy-cost advantage for compute efficiency.
2. Proof layer: first-class Arabic model support (ALLaM 7B, Falcon H1, JAIS 13B, BGE-M3).
3. Reality layer: GPU workloads run in NVIDIA-enabled containers (not bare-metal claims).
4. Action layer: one next step by intent (rent GPU, provide GPU, enterprise contact).

## Implementation Checklist (Required Handoff Format)

1. P0: Landing first-fold CTA compression.
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Acceptance: two primary actions above fold; lane chooser moved below proof/trust.
- Assignee: Frontend Developer + Copywriter.

2. P0: Provider onboarding single-track CTA.
- Files: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`
- Acceptance: one primary action per `nextActionState`.
- Assignee: Frontend Developer.

3. P0: Renter login/register proof strip.
- Files: `app/login/page.tsx`, `app/renter/register/page.tsx`, `app/lib/i18n.tsx`
- Acceptance: shared localized proof strip above submit action.
- Assignee: Frontend Developer + Copywriter.

4. P1: Marketplace outcome primer.
- Files: `app/renter/marketplace/page.tsx`, `app/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Acceptance: primer appears before filters/cards; no fabricated numeric claims.
- Assignee: Frontend Developer + Copywriter.

5. P1: Support quick-route chips.
- Files: `app/support/page.tsx`, `app/lib/i18n.tsx`
- Acceptance: enterprise/billing/provider routes selectable from top of form in one click.
- Assignee: Frontend Developer.

## Guardrails

- Never invent pricing, earnings, ROI, or savings percentages.
- Never claim bare-metal GPUs.
- Preserve DCP differentiator order in conversion copy:
  1. Saudi energy-cost advantage
  2. Arabic AI model support
  3. Containerized GPU execution reliability
