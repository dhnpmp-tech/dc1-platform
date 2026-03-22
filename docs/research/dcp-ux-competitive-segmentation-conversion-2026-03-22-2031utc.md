# DCP UX Competitive + Segmentation Conversion Brief (2026-03-22 20:31 UTC)

Owner: UX Researcher / Competitive Analyst  
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit + live DCP UX surfaces.

Guardrails followed:
- No fabricated pricing or unverified performance claims
- No bare-metal language (recommendations align to containerized GPU execution)
- Positioning anchored to Saudi energy-cost advantage + Arabic AI model support

## Executive Summary

DCP has strong role-intent mechanics already (landing intent chooser, renter/provider onboarding ladders, support category routing), but it still loses conversion against major competitors on three moments:

1. First-screen value hierarchy is still feature-led instead of differentiator-led.
2. Registration-to-first-workload onboarding is clear, but not segment-specific enough for enterprise and Arabic-model buyers.
3. IA exposes many routes, but does not consistently tell users which path to pick now vs later.

## Competitor UX Patterns (Evidence-Backed)

1. Vast.ai
- Pattern: low-friction self-serve + transparent marketplace framing + explicit 3-step onboarding.
- Evidence: homepage foregrounds instant deployment, real-time marketplace pricing framing, "Add Credit -> Search GPUs -> Deploy", and dual CTA (`Get Started` + `Contact Sales`).

2. RunPod
- Pattern: mode-first IA (Pods/Serverless/Clusters) and strong anti-friction language.
- Evidence: serverless page emphasizes instant workloads with no setup/idle burden and self-serve `Get started` entry from top nav.

3. Lambda
- Pattern: dual-lane conversion for self-serve and enterprise in the same primary nav.
- Evidence: cloud entry surfaces both `Create account` and `Talk to our team` paths.

4. Akash
- Pattern: clear marketplace identity and container portability expectation.
- Evidence: homepage labels itself as a decentralized compute marketplace and pushes `Console Login` immediately.

5. Together.ai
- Pattern: lifecycle ladder from quick-start inference to fine-tuning/enterprise scale.
- Evidence: top-level product architecture separates inference/fine-tuning/build with explicit scale-oriented progression.

6. Replit
- Pattern: segment-aware role navigation + "idea to shipped app" narrative with built-in infra assurance.
- Evidence: homepage includes role-specific tracks, enterprise control lane, and clear publish workflow messaging.

## DCP Segment Map (Conversion-Critical)

1. Self-serve renters (startup/indie builders)
- Trigger: run first workload quickly.
- Primary objection: too many route options (marketplace vs playground vs docs) before first success.
- Message priority: "Choose one first-job path now; move to API later."

2. Provider operators (single GPU + small fleet)
- Trigger: monetize idle NVIDIA hardware with predictable onboarding.
- Primary objection: uncertainty between registration success and reliable earning state.
- Message priority: "Register -> install daemon -> heartbeat -> routing-ready."

3. Enterprise evaluators (procurement/security)
- Trigger: need credible intake path for compliance and rollout planning.
- Primary objection: unclear distinction between support contact and enterprise onboarding lane.
- Message priority: "Enterprise path for procurement/security/rollout, with scoped response expectations."

4. Arabic AI product teams (MENA-first)
- Trigger: want Arabic model support without workaround stacks.
- Primary objection: uncertainty that Arabic support is operational, not only marketing copy.
- Message priority: "Arabic model lane is production-routable in containerized workflows."

## Current DCP UX Delta (Observed in Code)

Strengths already present:
- `app/page.tsx` has role-intent persistence and mode-strip links.
- `app/renter/register/page.tsx` has first-job checklist and support-route cards.
- `app/provider/register/page.tsx` has deterministic onboarding state ladder.
- `app/support/page.tsx` includes enterprise scope helper and fallback handling.
- `app/docs/quickstart/page.tsx` already states trust model and role path choices.

Remaining conversion gaps:
- Hero and above-the-fold blocks still understate DCP's two strategic differentiators compared to competitor-style headline positioning.
- Marketplace and register success flows do not explicitly direct Arabic-model seekers to a dedicated next step.
- Global IA still spreads similar journeys across multiple links without a canonical "start here by intent" pattern in every major surface.

## Recommendations (File-Mapped)

### P0 — Differentiator-First Above the Fold
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Change:
  - Update hero and first supporting block to lead with:
    - Saudi energy-cost structural advantage (without hard numeric claims)
    - Arabic AI model support (ALLaM/Falcon/JAIS/BGE model family lane)
    - Containerized execution trust framing
- Acceptance criteria:
  - First viewport contains both differentiators in EN + AR.
  - No unsupported price percentage or uptime guarantees.

### P0 — Canonical "Choose Your First Path" IA Across Key Entry Points
- Files:
  - `app/page.tsx`
  - `app/renter/register/page.tsx`
  - `app/provider/register/page.tsx`
  - `app/marketplace/page.tsx`
  - `app/renter/marketplace/page.tsx`
  - `app/lib/i18n.tsx`
- Change:
  - Add one consistent micro-IA block: `Self-serve renter`, `Provider onboarding`, `Enterprise intake`, `Arabic model docs`.
  - Reuse consistent labels/order across all listed pages.
- Acceptance criteria:
  - Same 4-lane structure appears in all entry pages.
  - Link destinations are source-tagged for analytics attribution.

### P1 — Arabic Model Conversion Assist in Marketplace + Registration Success
- Files:
  - `app/renter/register/page.tsx`
  - `app/renter/marketplace/page.tsx`
  - `app/docs/models/index.mdx`
  - `app/lib/i18n.tsx`
- Change:
  - Add "Need Arabic-first models?" helper CTA that routes users to model docs and/or filtered marketplace views.
- Acceptance criteria:
  - Arabic-model CTA is visible in renter success and marketplace trust panel.
  - CTA does not claim guaranteed availability; it frames compatibility guidance only.

### P1 — Enterprise Lane Consistency in Global Nav + Footer + Support
- Files:
  - `app/components/layout/Header.tsx`
  - `app/components/layout/Footer.tsx`
  - `app/support/page.tsx`
  - `app/lib/i18n.tsx`
- Change:
  - Normalize enterprise copy labels and route parameters for all top/bottom navigation entry points.
- Acceptance criteria:
  - Enterprise links use one naming system and one canonical support category flow.
  - No duplicated/conflicting enterprise labels across header/footer/support.

### P2 — Quickstart IA Compression for First-Time Renters
- Files:
  - `app/docs/quickstart/page.tsx`
  - `app/docs/renter-guide/page.tsx`
- Change:
  - Introduce a compact "First 15 minutes" starter lane above full step list.
- Acceptance criteria:
  - New users can choose a short path without losing access to full docs depth.

## Implementation Checklist

1. P0: Differentiator-first hero refresh
- Suggested assignee: Frontend Developer + Copywriter
- File paths: `app/page.tsx`, `app/lib/i18n.tsx`
- Done when: EN/AR hero clearly leads with energy advantage + Arabic AI + container trust, with no fabricated numbers.

2. P0: Unified 4-lane path chooser on all conversion entries
- Suggested assignee: Frontend Developer
- File paths: `app/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Done when: labels/order/destination parity is consistent and source-tagged.

3. P1: Arabic model CTA bridge from register/marketplace
- Suggested assignee: Frontend Developer + UX Writer
- File paths: `app/renter/register/page.tsx`, `app/renter/marketplace/page.tsx`, `app/docs/models/index.mdx`, `app/lib/i18n.tsx`
- Done when: clear Arabic-model next step exists in both places with truthful capability framing.

4. P1: Enterprise copy/route normalization
- Suggested assignee: Frontend Developer
- File paths: `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/support/page.tsx`, `app/lib/i18n.tsx`
- Done when: enterprise intake wording/links are consistent and analytics-friendly.

5. P2: Quickstart "First 15 minutes" compression
- Suggested assignee: DevRel Engineer + Frontend Developer
- File paths: `app/docs/quickstart/page.tsx`, `app/docs/renter-guide/page.tsx`
- Done when: short-start lane improves first-run clarity without removing deep docs.

## Source Links

- Vast.ai: https://vast.ai/
- RunPod Serverless: https://www.runpod.io/product/serverless
- Lambda Cloud: https://lambda.ai/cloud
- Akash Network: https://akash.network/
- Together.ai: https://www.together.ai/
- Replit: https://replit.com/
