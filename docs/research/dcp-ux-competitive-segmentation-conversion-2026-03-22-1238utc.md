# DCP UX Research Report: Competitor UX/Messaging + Segment-Based Conversion Plan (2026-03-22 12:38 UTC)

Owner: UX Researcher / Competitive Analyst  
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit  
Guardrails: no fabricated pricing, no bare-metal claims, recommendations aligned to DCP containerized GPU execution

## Objective
Produce evidence-backed UX/messaging guidance that increases conversion across renter and provider onboarding while preserving technical accuracy for DCP's current product reality.

## Competitor Evidence Snapshot (Primary Sources)

| Competitor | Observed UX pattern | Evidence from public page | DCP implication |
|---|---|---|---|
| Vast.ai | Marketplace pricing mechanics are explicit at first click. | Vast pricing highlights "Per-second billing" and says rates are market-set via "Supply & Demand Pricing." Source: https://vast.ai/pricing | Keep billing mechanics visible before renter registration/top-up and in marketplace cards. |
| RunPod | Mode-first IA with clear product ladder. | Pricing navigation exposes `Pods`, `Serverless`, `Storage`, and `Networking` categories. Source: https://www.runpod.io/pricing | Keep DCP renter journeys split by intent (`Playground` vs `Container/API`) in first viewport. |
| Lambda | Procurement + self-serve are presented together. | Lambda pricing: "Clear, straightforward pricing" plus CTAs for "Launch GPU instance" and "Talk to our team." Source: https://lambda.ai/pricing | Keep self-serve CTA primary, enterprise contact visible secondary. |
| Akash | Deployment momentum language with template shortcuts. | Akash homepage shows "Deploy faster" and "1-Click Templates" for model environments. Source: https://akash.network/ | Move DCP's first-job checklist higher in renter flow to reduce setup ambiguity. |
| Together.ai | Scale-up path is explicit in pricing IA. | Pricing states teams move from serverless toward dedicated endpoints as they scale. Source: https://www.together.ai/pricing | DCP should narrate a staged path: browser test -> container jobs -> operational scale. |
| Replit | Segment-by-role pricing IA reduces decision friction. | Replit pricing includes a `Roles` section and headline "Choose the best plan for you." Source: https://replit.com/pricing | DCP should make role selection persistent across docs/support entry points. |

## DCP Segment Map (Targeted Messaging)

1. Renter - builder/startup engineer
- Job to be done: run a first workload quickly with predictable settlement.
- Friction: too many route choices after registration.
- Winning message: "Start in browser, then scale to container jobs with runtime settlement."

2. Renter - enterprise evaluator (procurement/ops)
- Job to be done: verify risk, controls, and escalation path before adoption.
- Friction: support/legal/enterprise routes are present but not tightly bundled as one evaluation path.
- Winning message: "Containerized execution + policy surfaces + enterprise contact in one branch."

3. Provider - solo operator
- Job to be done: register GPU and become job-eligible without support tickets.
- Friction: uncertainty in post-registration "what now" sequence.
- Winning message: "Register -> install daemon -> heartbeat -> online ready."

4. Provider - small fleet operator
- Job to be done: keep utilization high with operational confidence.
- Friction: readiness/trust telemetry not always surfaced consistently across entry pages.
- Winning message: "Live heartbeat and status-driven next actions."

5. Arabic AI team (MENA)
- Job to be done: deploy Arabic-first AI workloads in production-like flows.
- Friction: differentiator exists but should stay first-class across all top-funnel pages.
- Winning message: "Saudi energy advantage + Arabic model support (ALLaM/Falcon/JAIS/BGE-M3) in first screen."

## Current DCP UX Delta (Codebase Observations)

1. Homepage role intent is strong, but conversion proof remains spread across sections.
- File: `app/page.tsx`
- Observation: role chips and differentiators are present; cost mechanics and next-step certainty can still be tightened into one "decision + proof" strip.

2. Renter registration success checklist exists, but dashboard CTA competes with first-job completion CTA.
- File: `app/renter/register/page.tsx`
- Observation: first-job checklist is good; flow can prioritize `/renter/playground` directly for immediate activation.

3. Provider registration includes polling and status transitions, but troubleshooting links are not strongly grouped by failure mode.
- File: `app/provider/register/page.tsx`
- Observation: deterministic states exist (`waiting/heartbeat/ready/paused/stale`), but self-serve troubleshooting can be more explicit.

4. Docs landing is strong but not role-gated in first card row.
- File: `app/docs/[[...slug]]/page.tsx`
- Observation: docs map exists; add renter/provider/API path chooser to reduce first-click uncertainty.

5. Support page has category forms but can lead with scenario tiles before the generic form.
- File: `app/support/page.tsx`
- Observation: add "Provider install", "Job failed", "Billing", "Enterprise" tiles with deep links/prefills.

## Recommended Conversion Changes

### P0 (Immediate)

1. Enforce one canonical renter activation CTA after register.
- Files:
  - `app/renter/register/page.tsx`
- Change:
  - Make primary success CTA `/renter/playground?starter=1`; keep dashboard secondary.
- Acceptance criteria:
  - New renter can submit first test job in <=2 clicks after registration.
- Suggested assignee role: Frontend Developer

2. Add provider troubleshooting matrix in success state.
- Files:
  - `app/provider/register/page.tsx`
  - `app/docs/provider-guide/page.tsx`
- Change:
  - Add compact matrix mapping status (`waiting`, `heartbeat`, `stale`, `paused`) to exact next action and docs anchor.
- Acceptance criteria:
  - Provider can self-diagnose setup issues without leaving registration flow.
- Suggested assignee role: Frontend Developer

3. Add role-first docs entry blocks with checklist CTA.
- Files:
  - `app/docs/[[...slug]]/page.tsx`
  - `app/docs/quickstart/page.tsx`
- Change:
  - Add top-level role selector cards: `I am a renter`, `I am a provider`, `I am integrating API`, each with one primary checklist CTA.
- Acceptance criteria:
  - User reaches role-specific checklist from `/docs` in one click.
- Suggested assignee role: Frontend Developer

### P1 (Near-term)

4. Support IA by scenario before contact form.
- Files:
  - `app/support/page.tsx`
  - `app/components/layout/Footer.tsx`
- Change:
  - Introduce four scenario tiles with prefilled categories and anchor links to form state.
- Acceptance criteria:
  - Form submissions include meaningful pre-classification context.
- Suggested assignee role: Frontend Developer

5. Homepage "decision + proof" strip tightening.
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Change:
  - Keep first fold as: role decision, Saudi energy advantage, Arabic model support, containerized execution, billing semantics in one contiguous section.
- Acceptance criteria:
  - All four trust anchors visible before first scroll in EN/AR.
- Suggested assignee role: Frontend Developer

### P2 (Follow-up)

6. Marketplace card trust standardization.
- Files:
  - `app/renter/marketplace/page.tsx`
  - `app/marketplace/page.tsx`
- Change:
  - Normalize card-level fields: heartbeat freshness, success-rate label, compatibility tags, and last-updated timestamp placement.
- Acceptance criteria:
  - Marketplace-to-submit clickthrough improves after instrumentation window.
- Suggested assignee role: Frontend Developer

## Implementation Checklist

1. `P0` renter post-register activation priority
- File path: `app/renter/register/page.tsx`
- Exact change: primary CTA routes to `/renter/playground?starter=1`, dashboard becomes secondary CTA
- Acceptance criteria: first job submission path <=2 clicks from success screen
- Suggested assignee role: Frontend Developer

2. `P0` provider status-to-action troubleshooting matrix
- File paths: `app/provider/register/page.tsx`, `app/docs/provider-guide/page.tsx`
- Exact change: map each provider onboarding state to action + docs deep link
- Acceptance criteria: provider can recover from stale/no-heartbeat states without support ticket
- Suggested assignee role: Frontend Developer

3. `P0` docs role-gated entry cards
- File paths: `app/docs/[[...slug]]/page.tsx`, `app/docs/quickstart/page.tsx`
- Exact change: top-row role cards with direct checklist CTAs
- Acceptance criteria: role-specific first click path from docs homepage
- Suggested assignee role: Frontend Developer

4. `P1` support scenario triage tiles
- File paths: `app/support/page.tsx`, `app/components/layout/Footer.tsx`
- Exact change: scenario tiles that prefill support category and anchor to form
- Acceptance criteria: support categories are prefilled for role-specific inbound requests
- Suggested assignee role: Frontend Developer

5. `P1` homepage trust-anchor compression
- File paths: `app/page.tsx`, `app/lib/i18n.tsx`
- Exact change: cluster role + differentiators + billing explainer in contiguous first-fold section
- Acceptance criteria: trust anchors visible above fold in EN and AR
- Suggested assignee role: Frontend Developer

6. `P2` marketplace trust metadata normalization
- File paths: `app/renter/marketplace/page.tsx`, `app/marketplace/page.tsx`
- Exact change: standard field order for heartbeat freshness, success rate, compatibility badges, timestamp
- Acceptance criteria: card-level trust semantics are consistent across both marketplace surfaces
- Suggested assignee role: Frontend Developer

## Sources
- https://vast.ai/pricing
- https://www.runpod.io/pricing
- https://lambda.ai/pricing
- https://akash.network/
- https://www.together.ai/pricing
- https://replit.com/pricing
