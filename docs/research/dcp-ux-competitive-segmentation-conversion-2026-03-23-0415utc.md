# DCP UX Competitive Segmentation + Conversion Recommendations (2026-03-23 04:15 UTC)

Owner: UX Researcher / Competitive Analyst (Codex)
Scope: competitor UX/messaging comparison (Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit), DCP segment mapping, and conversion-focused recommendations for copy, onboarding, and information architecture.

## Guardrails

- No fabricated pricing, savings, or earnings claims.
- No bare-metal GPU claims.
- Positioning order remains: Saudi energy-cost advantage -> Arabic AI support -> NVIDIA containerized execution.

## Evidence Base (re-validated 2026-03-23 UTC)

1. RunPod product lane architecture
- Sources:
  - https://www.runpod.io/
  - https://docs.runpod.io/serverless/pricing
- Observations:
  - Self-serve pathing is lane-first (Cloud GPUs, Serverless, clusters/hub concepts) and CTA-forward.
  - Billing semantics are explicit in docs (componentized charges and billing boundaries).

2. Vast marketplace + billing clarity
- Sources:
  - https://docs.vast.ai/documentation/instances/pricing
  - https://docs.vast.ai/documentation/reference/billing
- Observations:
  - Marketplace variability and pricing factors are explained early.
  - Prepaid-credit mechanics and low-balance consequences are explicit, reducing trust ambiguity.

3. Lambda dual-path CTA model
- Source:
  - https://lambda.ai/pricing
- Observations:
  - Distinct self-serve and enterprise routes are kept visible on the same commercial surface.

4. Akash step-sequenced onboarding
- Source:
  - https://akash.network/docs/getting-started/quick-start/
- Observations:
  - Quick-start flow is sequence-driven with prerequisites and an explicit first deployment outcome.

5. Together.ai maturity-lane pricing
- Source:
  - https://www.together.ai/pricing
- Observations:
  - Decision paths map to operational maturity (serverless vs dedicated/cluster routes).

6. Replit simple plan ladder + enterprise branch
- Source:
  - https://replit.com/pricing
- Observations:
  - Entry route stays low-friction while enterprise contact remains persistent.

## DCP Segment Map (conversion event focused)

1. P0 Self-serve renters (founders, developers, product teams)
- Primary conversion event: first successful workload output.
- Primary friction: route overload before first-run commitment.

2. P0 Arabic-first AI builders (NLP/RAG/app teams)
- Primary conversion event: confidence that Arabic models are runnable now.
- Primary friction: model-availability proof sometimes appears after navigation complexity.

3. P0 Providers (individual/small infra operators)
- Primary conversion event: register -> install -> heartbeat-ready.
- Primary friction: multi-lane distractions in onboarding context.

4. P1 Enterprise evaluators (procurement/security/platform)
- Primary conversion event: qualified enterprise intake started.
- Primary friction: enterprise lane can compete with (instead of support) self-serve conversion moments.

## Code-State Audit (repository-verified)

1. Landing decision stack still includes broad optional navigation in first fold context
- File: `app/page.tsx`
- Evidence: chooser content remains prominent in hero-area flow (`modeStripItems`, `pathChooserLanes`, details block).
- Conversion risk: too many choices before intent commitment.

2. Provider register page still surfaces cross-role chooser in onboarding journey
- File: `app/provider/register/page.tsx`
- Evidence: path chooser section rendered near top of registration flow.
- Conversion risk: install/heartbeat completion competes with role switching.

3. Renter register still combines first-workload guidance with full cross-role chooser
- File: `app/renter/register/page.tsx`
- Evidence: first workload section, path chooser, and checklist all appear in same conversion stack.
- Conversion risk: first-job launch diluted after signup.

4. Public + renter marketplace continue to surface path chooser near core decision surfaces
- Files: `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`
- Evidence: path chooser blocks are shown in upper content sections.
- Conversion risk: evaluation flow competes with lane switching.

5. Login lacks compact differentiator proof directly adjacent to submit action
- File: `app/login/page.tsx`
- Evidence: helper rows exist, but no concise proof strip near button area.
- Conversion risk: trust gap at credential entry moment.

## Conversion Recommendations (prioritized)

### P0.1 Landing: enforce two-action first commitment
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Changes:
  - Keep first-fold actions to two dominant CTAs (Rent GPU, Provide GPU).
  - Keep enterprise CTA visible but secondary text-link treatment.
  - Move broad chooser content lower or behind low-emphasis disclosure.
- Acceptance criteria:
  - Max two primary actions in first viewport.
  - Proof order remains policy-safe and stable.

### P0.2 Provider onboarding: one dominant action per state
- Files:
  - `app/provider/register/page.tsx`
  - `app/lib/provider-install.ts`
  - `app/lib/i18n.tsx`
- Changes:
  - Map each `nextActionState` to a single primary CTA.
  - Replace full lane chooser with compact "Other paths" disclosure/footer links.
- Acceptance criteria:
  - Exactly one primary action per provider onboarding state.
  - Polling/status behavior unchanged.

### P0.3 Renter registration success: first workload dominance
- Files:
  - `app/renter/register/page.tsx`
  - `app/lib/i18n.tsx`
- Changes:
  - Keep one primary action to first runnable path (`/renter/playground`).
  - Keep optional actions as secondary links/cards.
  - Collapse full path chooser into optional disclosure.
- Acceptance criteria:
  - Primary post-signup action always drives toward first run.
  - EN/AR parity for added copy keys.

### P1.1 Marketplace decision primer before chooser blocks
- Files:
  - `app/marketplace/page.tsx`
  - `app/renter/marketplace/page.tsx`
  - `app/lib/i18n.tsx`
- Changes:
  - Add short "How to choose" primer before path chooser sections:
    - how displayed rate should be interpreted,
    - workload-to-GPU matching heuristic,
    - where Arabic-ready model discovery starts.
  - Keep enterprise route available but visually secondary.
- Acceptance criteria:
  - Primer visible before major filter/card interactions.
  - No unsupported performance or cost guarantees.

### P1.2 Login proof-near-action strip
- Files:
  - `app/login/page.tsx`
  - `app/lib/i18n.tsx`
- Changes:
  - Add compact three-line trust strip directly above submit:
    - Saudi energy-cost advantage,
    - Arabic-model support,
    - NVIDIA containerized execution.
- Acceptance criteria:
  - Visible in API-key and OTP/email modes.
  - Copy is guardrail-safe and non-numeric.

## Implementation Checklist

1. P0: Landing first-fold action compression
- File paths: `app/page.tsx`, `app/lib/i18n.tsx`
- Priority: P0
- Exact change: reduce hero action density, demote lane chooser.
- Acceptance criteria: two primary CTAs above fold; policy-safe proof order.
- Suggested assignee role: Frontend Developer + Copywriter

2. P0: Provider onboarding action hierarchy
- File paths: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`
- Priority: P0
- Exact change: one primary CTA per onboarding state; collapse broad lane options.
- Acceptance criteria: one dominant action per state; no regression in readiness polling.
- Suggested assignee role: Frontend Developer

3. P0: Renter registration conversion hardening
- File paths: `app/renter/register/page.tsx`, `app/lib/i18n.tsx`
- Priority: P0
- Exact change: primary first-run CTA; route switching moved behind disclosure.
- Acceptance criteria: post-signup primary always points to first workload path.
- Suggested assignee role: Frontend Developer + Copywriter

4. P1: Marketplace decision primer + lane weighting
- File paths: `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Priority: P1
- Exact change: add chooser primer and keep enterprise route secondary to self-serve path.
- Acceptance criteria: primer appears before filters/cards.
- Suggested assignee role: Frontend Developer + Copywriter

5. P1: Login trust strip
- File paths: `app/login/page.tsx`, `app/lib/i18n.tsx`
- Priority: P1
- Exact change: insert compact trust stack near submit controls.
- Acceptance criteria: appears in both auth modes; no unsupported claims.
- Suggested assignee role: Frontend Developer + Copywriter

## Suggested KPI Readout After Implementation

- Landing: CTA click-through split (`/renter/register` vs `/provider/register`) and bounce reduction.
- Renter: register success -> first playground launch rate.
- Provider: register success -> heartbeat-ready completion rate.
- Marketplace: filter interaction -> playground launch rate.
- Login: submit conversion rate by mode (email/OTP vs API key).
