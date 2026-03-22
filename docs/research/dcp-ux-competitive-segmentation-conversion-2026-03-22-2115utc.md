# DCP UX Competitive Analysis + Conversion Plan
Date: 2026-03-22 21:15 UTC  
Role: UX Researcher / Competitive Analyst

## Scope
Competitors reviewed: Vast.ai, Runpod, Lambda, Akash, Together.ai, Replit.

This brief focuses on conversion copy, onboarding flow, and information architecture updates for DCP's current container-based GPU marketplace reality (not bare-metal claims, no unapproved pricing claims).

## Evidence Summary (What competitors do repeatedly)
1. Fast first action above the fold
- Vast: immediate CTA + "How it works" in 3 steps with low-friction start language (add credit, search GPU, deploy).
- Runpod: clear product-mode split (on-demand pods, serverless, clusters) and direct "Get started" path.
- Together.ai: dual CTA pattern (self-serve start + contact sales), explicit progression from serverless to dedicated.
- Lambda: immediate self-serve launch plus enterprise route, with product tiers by scale (instances, clusters, superclusters).
- Replit: "idea to shipped" narrative with immediate prompt-driven action.
- Akash: explicit cost-comparison framing + immediate deploy CTA.

2. Packaging by operating mode, not by internal org structure
- Most competitors frame choices as modes: serverless, on-demand instance, dedicated cluster, enterprise.
- This lowers decision time vs feature-lists-first landing pages.

3. Pricing/transparency confidence blocks are near CTA
- Vast and Akash push marketplace economics and transparent pricing language close to first conversion action.
- Lambda/Together combine transparent starter options with enterprise handoff paths.

4. Explicit migration/start guides reduce activation friction
- Vast quickstart and tool docs are one click from nav.
- Together and Lambda keep docs and onboarding near primary conversion paths.

## DCP Segment Map (Conversion-first)
1. Segment A: Self-serve Renter (startup/indie teams)
- Job to be done: run inference/training quickly without procurement delays.
- Friction today: value proof and first-job steps are spread across landing/register/marketplace.
- Decision criteria: clear first action, confidence in execution reliability, predictable billing behavior.

2. Segment B: Provider (GPU owner / host)
- Job to be done: register hardware and reach "earning-ready" state quickly.
- Friction today: onboarding is functionally strong, but value hierarchy still competes with long-form details.
- Decision criteria: setup certainty, status visibility, transparent earnings logic.

3. Segment C: Enterprise Buyer (procurement + technical evaluator)
- Job to be done: validate risk, security posture, and support path before pilot.
- Friction today: trust + support proofs exist, but enterprise path is not consistently elevated as a first-class lane.
- Decision criteria: trust artifacts, escalation path, deployment model clarity.

4. Segment D: Arabic AI teams (regional ML teams)
- Job to be done: deploy Arabic-first models with clear supported stack.
- Friction today: Arabic model advantage is present but can be buried behind general docs navigation.
- Decision criteria: explicit model support, fast path from landing to runnable docs/examples.

## Strategic Messaging Direction (for DCP)
1. Hero hierarchy (top-to-bottom)
- Headline: Saudi energy cost advantage.
- Sub-headline: Arabic AI model readiness (ALLaM/Falcon/JAIS/BGE-M3).
- Third line: container-based NVIDIA execution + predictable settlement model.

2. CTA system
- Primary: self-serve renter start.
- Secondary: provider onboarding.
- Tertiary: enterprise contact.
- Persistent fourth lane: Arabic model docs.

3. IA principle
- Keep 4-lane chooser globally consistent across landing + register + marketplace + docs entry pages.
- Place "How DCP works" 3-step narrative directly above first high-intent action in renter/provider registration contexts.

## Recommended Changes by File/Page

### P0 (high impact, low ambiguity)
1. `app/page.tsx`
- Change: Restructure hero copy blocks so the first two proof statements are explicitly:
  - Saudi energy-cost structural advantage.
  - Arabic AI model support as first-class path.
- Change: Add compact "How DCP works" 3-step strip (Choose GPU -> Run container workload -> Settle usage) directly before the main CTA cluster.
- Acceptance criteria:
  - Both differentiators visible without scrolling on desktop.
  - 3-step strip visible before any long descriptive section.
  - No bare-metal language introduced.
- Suggested assignee role: Frontend Developer.

2. `app/renter/register/page.tsx`
- Change: Add a pre-form "First workload in 3 steps" panel with direct links to `/renter/marketplace`, `/jobs/submit`, and `/docs/quickstart`.
- Change: Add one short trust line near submit button clarifying containerized GPU execution and usage-based settlement.
- Acceptance criteria:
  - New users can identify the exact next step after API key creation in <5 seconds.
  - Copy uses existing billing/runtime terminology; no new financial claims.
- Suggested assignee role: Frontend Developer.

3. `app/renter/marketplace/page.tsx`
- Change: Elevate comparison helpers above GPU grid: sortable quick chips for "Arabic model ready", "Inference", "Training", "Lowest SAR/hr".
- Change: Add persistent side panel "Start here" with the exact next action for signed-out vs signed-in users.
- Acceptance criteria:
  - First action for each user state is one click away.
  - Existing provider metrics (uptime/heartbeat) remain visible.
- Suggested assignee role: Frontend Developer.

4. `app/support/page.tsx`
- Change: Add dedicated enterprise intake section near top with clear SLA/security/support routing options.
- Acceptance criteria:
  - Enterprise route discoverable from top viewport.
  - Category preselection persists in contact form route params.
- Suggested assignee role: Frontend Developer.

### P1 (copy and docs alignment)
5. `docs/quickstart.mdx` and `app/docs/quickstart/page.tsx`
- Change: Open with "Mode selection" (self-serve renter, provider, enterprise, Arabic models) before detailed steps.
- Change: Add "container execution reality" note early (NVIDIA container toolkit + Docker-based jobs).
- Acceptance criteria:
  - First screen explains mode choice before technical detail.
  - No bare-metal wording appears.
- Suggested assignee role: Technical Writer / Frontend Developer.

6. `docs/models/index.mdx` and `app/docs/[[...slug]]/page.tsx`
- Change: Add "Arabic AI quick launch" block linking ALLaM, Falcon, JAIS, BGE-M3 cards from top of models index.
- Acceptance criteria:
  - Arabic model set reachable in one click from models index top section.
- Suggested assignee role: Technical Writer.

### P2 (instrumentation and iterative conversion loop)
7. `app/lib/role-intent.ts` and event emitters in `app/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`
- Change: Normalize analytics event taxonomy around lane + mode + next_action.
- Acceptance criteria:
  - Every CTA includes consistent `source`, `lane`, `mode`, `step` fields.
  - Funnel drop-offs measurable across landing -> register -> first workload action.
- Suggested assignee role: Frontend Developer / Analytics Engineer.

## Implementation Checklist
1. P0 — Landing hero/message hierarchy update
- File paths: `app/page.tsx`
- Exact change: make differentiator hierarchy explicit; add 3-step "How DCP works" strip above primary conversion CTA group.
- Acceptance criteria: both differentiators above fold; no bare-metal claims.
- Suggested assignee: Frontend Developer.

2. P0 — Renter registration activation path
- File paths: `app/renter/register/page.tsx`
- Exact change: pre-form "First workload in 3 steps" panel + concise runtime/settlement trust sentence by submit.
- Acceptance criteria: clear post-key next step and preserved existing auth flow.
- Suggested assignee: Frontend Developer.

3. P0 — Marketplace first-action clarity
- File paths: `app/renter/marketplace/page.tsx`
- Exact change: quick filters for key intents + persistent "Start here" action panel based on auth state.
- Acceptance criteria: one-click next action for signed-out and signed-in paths.
- Suggested assignee: Frontend Developer.

4. P0 — Enterprise route prominence
- File paths: `app/support/page.tsx`
- Exact change: top-level enterprise intake band with support/SLA/security routing.
- Acceptance criteria: enterprise route visible without scroll.
- Suggested assignee: Frontend Developer.

5. P1 — Docs mode-first quickstart
- File paths: `docs/quickstart.mdx`, `app/docs/quickstart/page.tsx`
- Exact change: front-load mode selection + container-execution clarity note.
- Acceptance criteria: docs first screen explains route choices clearly.
- Suggested assignee: Technical Writer / Frontend Developer.

6. P1 — Arabic models discoverability
- File paths: `docs/models/index.mdx`, `app/docs/[[...slug]]/page.tsx`
- Exact change: top "Arabic AI quick launch" group linking ALLaM/Falcon/JAIS/BGE-M3.
- Acceptance criteria: one-click access to all four cards from models index top.
- Suggested assignee: Technical Writer.

7. P2 — Funnel analytics normalization
- File paths: `app/lib/role-intent.ts`, `app/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`
- Exact change: unify event schema (`lane`, `mode`, `source`, `step`, `next_action`).
- Acceptance criteria: complete event coverage across lane chooser + primary CTAs.
- Suggested assignee: Frontend Developer / Analytics Engineer.

## Sources
- Vast.ai home: https://vast.ai/ (accessed 2026-03-22)
- Vast.ai quickstart docs: https://docs.vast.ai/documentation/get-started/quickstart (accessed 2026-03-22)
- Runpod pricing: https://www.runpod.io/pricing (accessed 2026-03-22)
- Lambda cloud page: https://lambda.ai/cloud (accessed 2026-03-22)
- Lambda pricing: https://lambda.ai/pricing (accessed 2026-03-22)
- Akash home: https://akash.network/ (accessed 2026-03-22)
- Together.ai home: https://www.together.ai/ (accessed 2026-03-22)
- Together.ai pricing: https://www.together.ai/pricing (accessed 2026-03-22)
- Together dedicated inference docs: https://docs.together.ai/docs/dedicated-inference (accessed 2026-03-22)
- Replit home: https://replit.com/ (accessed 2026-03-22)
- Replit pricing: https://replit.com/pricing (accessed 2026-03-22)
- Replit Starter plan docs: https://docs.replit.com/billing/plans/starter-plan (accessed 2026-03-22)
