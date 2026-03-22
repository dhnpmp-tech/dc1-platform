# DCP UX Competitive + Segmentation Conversion Delta (2026-03-22 20:11 UTC)

Owner: UX Researcher / Competitive Analyst  
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit + current DCP surfaces (`app/page.tsx`, `app/docs/[[...slug]]/page.tsx`, `app/provider/register/page.tsx`, `app/renter/register/page.tsx`, `app/renter/marketplace/page.tsx`, `app/support/page.tsx`).

Guardrails: no fabricated savings/pricing claims, no bare-metal claims, recommendations aligned to container-based GPU execution.

## Executive Summary

DCP is now strong on role-first routing and truthful runtime-settlement language, but conversion friction still appears in two places that competitors handle more explicitly:

1. Product mode clarity: competitors name operating modes early (serverless, pods, deployments, enterprise), while DCP still requires more inference from users between marketplace, playground, docs, and support.
2. Segment proof packaging: DCP has Saudi energy + Arabic model advantages, but proof snippets are distributed across pages instead of being reused as one stable "proof block" per intent.

## Evidence Snapshot (Competitor UX/Messaging)

- Vast.ai emphasizes real-time GPU marketplace discovery and filtering behavior on acquisition surfaces. Source: https://vast.ai/
- RunPod makes mode architecture explicit at top level (Cloud GPUs / Serverless / Instant Clusters) and repeats container-flexibility messaging. Source: https://www.runpod.io/product/serverless
- Lambda keeps enterprise intake and self-serve paths visible together on pricing/acquisition pages. Source: https://lambda.ai/pricing
- Akash documents GPU deployments with explicit container requirements and deployment spec framing. Source: https://akash.network/docs/learn/core-concepts/gpu-deployments/
- Together.ai positions usage modes across fast start and larger-scale deployment lanes on pricing navigation. Source: https://www.together.ai/pricing
- Replit explains deployment/billing modes with plain-language “how billing works” and type-specific deployment guidance. Source: https://docs.replit.com/billing/deployment-pricing

## Evidence Snapshot (Current DCP UX)

- `app/page.tsx` already includes role-intent switching plus live telemetry and trust modules.
- `app/docs/[[...slug]]/page.tsx` contains renter/provider/enterprise role cards and strategic positioning copy.
- `app/provider/register/page.tsx` has clear state-based onboarding tracking and next-action logic.
- `app/renter/register/page.tsx` includes first-job checklist + support routing.
- `app/renter/marketplace/page.tsx` already includes trust interpretation strings and runtime settlement reminder.
- `app/support/page.tsx` supports category-driven support intake and source-aware analytics.

Gap still visible: intent-specific "what to do next" is implemented across pages, but IA wording and proof framing are not fully normalized into reusable segment bundles.

## DCP Segment Map (Conversion-Focused)

1. Renter (self-serve builders)
- Trigger: run first workload quickly with low coordination overhead.
- Primary objection: uncertain order between marketplace, playground, and docs.
- Winning copy frame: "Choose GPU in marketplace, launch in playground, settle by runtime."

2. Provider (single-node and fleet operators)
- Trigger: convert idle GPU capacity into predictable earnings.
- Primary objection: confidence drop between registration and first healthy heartbeat.
- Winning copy frame: "Register -> install daemon -> heartbeat -> routing eligibility."

3. Enterprise evaluator (procurement + platform)
- Trigger: controlled rollout with procurement and security review.
- Primary objection: ambiguous distinction between support inbox and enterprise intake.
- Winning copy frame: "Enterprise support = reserved planning + security review + rollout design."

4. Arabic AI teams (MENA product teams)
- Trigger: Arabic model readiness without stack customization risk.
- Primary objection: concern that Arabic support is marketing-only.
- Winning copy frame: "Arabic model paths are documented and deployable in container workflows."

## Recommendations

### P0: Normalize mode language across landing/docs/renter surfaces
- Files:
  - `app/page.tsx`
  - `app/docs/[[...slug]]/page.tsx`
  - `app/renter/register/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add a compact "Choose your mode" strip with stable labels (`Marketplace`, `Playground`, `Docs/API`, `Enterprise Support`) and one-line intent text.
  - Reuse the same labels in docs entry cards and renter-success checklist labels.
- Acceptance criteria:
  - Same four mode labels appear unchanged on landing + docs root + renter success flow.
  - Analytics payloads can compare mode clicks without post-hoc mapping.
- Suggested assignee role: Frontend Developer + UX Writer

### P0: Create reusable segment proof blocks (Saudi energy + Arabic models + container reality)
- Files:
  - `app/page.tsx`
  - `app/renter/marketplace/page.tsx`
  - `app/support/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Introduce one reusable proof block component pattern (copy-only is acceptable first pass) with three claims:
    - Saudi energy-cost structural advantage (no numeric claim)
    - Arabic model support (ALLaM 7B, Falcon H1, JAIS 13B, BGE-M3)
    - Container-based execution clarity (no bare-metal wording)
- Acceptance criteria:
  - All three claims appear together in consistent order across target pages.
  - No unsupported SLA, payout, or savings percentages added.
- Suggested assignee role: Frontend Developer + Copywriter

### P1: Tighten enterprise-vs-support distinction in support intake
- Files:
  - `app/support/page.tsx`
  - `app/components/layout/Header.tsx`
  - `app/components/layout/Footer.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Keep one primary enterprise CTA label family everywhere (`Enterprise Support`).
  - Add explicit helper text above contact form when `category=enterprise` to clarify scope (procurement/security/rollout planning).
- Acceptance criteria:
  - Header/footer/docs/support show the same enterprise CTA naming.
  - Enterprise-form prefill text differs clearly from general support wording.
- Suggested assignee role: Frontend Developer

### P1: Expose provider onboarding confidence signal after registration
- Files:
  - `app/provider/register/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add concise expected-timing helper copy per onboarding state (`waiting`, `heartbeat`, `stale`, `paused`, `ready`) to reduce drop-off during daemon setup.
- Acceptance criteria:
  - Each onboarding state card has one expectation line and one next-action line.
  - Existing state logic remains unchanged.
- Suggested assignee role: Frontend Developer + UX Writer

## Implementation Checklist

1. P0 Mode-language normalization
- File paths: `app/page.tsx`, `app/docs/[[...slug]]/page.tsx`, `app/renter/register/page.tsx`, `app/lib/i18n.tsx`
- Deliverable: one shared mode vocabulary and CTA taxonomy.
- Acceptance: all three surfaces use identical mode labels and event naming.
- Suggested assignee: Frontend Developer + UX Writer.

2. P0 Segment proof blocks
- File paths: `app/page.tsx`, `app/renter/marketplace/page.tsx`, `app/support/page.tsx`, `app/lib/i18n.tsx`
- Deliverable: consistent three-point proof block (Saudi energy + Arabic AI + container execution).
- Acceptance: appears on all listed pages with no fabricated pricing claims.
- Suggested assignee: Frontend Developer + Copywriter.

3. P1 Enterprise intake distinction
- File paths: `app/support/page.tsx`, `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx`
- Deliverable: unified enterprise label + enterprise-specific prefill/helper copy.
- Acceptance: enterprise route language is consistent and procurement-oriented.
- Suggested assignee: Frontend Developer.

4. P1 Provider onboarding confidence copy
- File paths: `app/provider/register/page.tsx`, `app/lib/i18n.tsx`
- Deliverable: expected-timing helper copy for each onboarding state.
- Acceptance: measurable reduction target can be instrumented from `provider_onboarding_state_seen` to `provider_ready` transitions.
- Suggested assignee: Frontend Developer + UX Writer.
