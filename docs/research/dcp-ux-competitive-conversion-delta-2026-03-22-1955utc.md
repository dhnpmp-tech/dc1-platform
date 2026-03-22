# DCP UX Competitive Conversion Delta (Heartbeat Refresh)

Date: 2026-03-22 19:55 UTC
Owner: UX Researcher / Competitive Analyst
Scope: Vast.ai, RunPod, Lambda, Akash, Together AI, Replit
Guardrails: no fabricated pricing/savings claims, no bare-metal language, recommendations aligned to container-based GPU execution.

## Executive Summary

Core conversion surfaces are much stronger than baseline, but one high-impact friction remains:
- DCP still mixes "live telemetry" and "trust-policy statements" in the same stat strip and CTA neighborhoods, which weakens decision confidence for first-time renters and enterprise evaluators.

This update proposes only net-new deltas that are not already shipped in the latest UX implementation wave.

## Competitor Evidence Snapshot (official pages/docs, reviewed 2026-03-22)

1. Vast.ai
- Evidence: "Vast.ai Documentation - Affordable GPU Cloud Marketplace" and repeated marketplace/instances/pricing taxonomy in docs navigation.
- Source: https://docs.vast.ai/
- Conversion implication: clear mode taxonomy reduces route confusion.

2. RunPod
- Evidence: pricing/docs surfaces consistently reinforce product modes including Pods and Serverless (plus cluster language on pricing pages).
- Sources: https://www.runpod.io/pricing , https://docs.runpod.io/
- Conversion implication: repeated mode vocabulary improves user path commitment.

3. Lambda
- Evidence: pricing surface is explicitly cloud-GPU commerce oriented (title: "AI Cloud Pricing | GPU Compute & AI Infrastructure") with enterprise branch emphasis.
- Source: https://lambda.ai/pricing
- Conversion implication: enterprise branch should be visible at high-intent moments, not only deep links.

4. Akash
- Evidence: dedicated GPU pricing page + "GPU Deployments" docs page; docs repeatedly pair GPU deployment and provider concepts.
- Sources: https://akash.network/pricing/gpus/ , https://akash.network/docs/learn/core-concepts/gpu-deployments/
- Conversion implication: deployment model is made explicit close to pricing intent.

5. Together AI
- Evidence: docs and pricing consistently pair Serverless and Dedicated pathways.
- Sources: https://www.together.ai/pricing , https://docs.together.ai/
- Conversion implication: progression path (quick start -> dedicated) lowers uncertainty for scaling buyers.

6. Replit
- Evidence: deployment pricing documentation is a standalone billing concept route and pricing is treated as a first-class product decision lane.
- Source: https://docs.replit.com/billing/deployment-pricing
- Conversion implication: billing model explanations should be adjacent to action, not hidden in docs only.

## DCP Segment Delta (what still blocks conversion)

1. Renter (self-serve)
- Current blocker: mixed stat-strip semantics blur what is live vs policy.
- Impact: lower trust in card-level and hero-level decision cues.

2. Provider (solo/fleet)
- Current blocker: success-state next action is clear, but entry pathways can still feel split between docs and support.
- Impact: slower completion from registration success to stable heartbeat loop.

3. Enterprise evaluator
- Current blocker: enterprise intent exists, but supporting proof in hero/support flow can look generic instead of procurement-oriented.
- Impact: weaker enterprise-qualified lead conversion.

## Net-New Recommendations (file-mapped)

### P0

1. Split landing stat strip into two semantic groups (live telemetry vs platform guarantees)
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Change:
  - Keep only measurable live values in one strip (e.g., online GPUs, GPU family coverage, last-updated).
  - Move non-live trust statements (runtime settlement, containerized execution, Arabic AI support) into a separate "How DCP runs" trust module.
- Acceptance criteria:
  - No static policy claim appears in a block that visually implies live telemetry.
  - Last-updated timestamp appears with live stats.

2. Add enterprise-proof micropanel near enterprise CTA states
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/lib/i18n.tsx`
- Change:
  - Add concise enterprise-oriented checklist next to enterprise-intent CTA: procurement path, security review path, rollout planning path.
- Acceptance criteria:
  - Enterprise intent state contains procurement-specific proof points and one primary intake action.

### P1

3. Normalize source attribution schema keys across landing/support/register/marketplace analytics events
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/renter/marketplace/page.tsx`
- Change:
  - Standardize event payload keys: `source_page`, `role_intent`, `surface`, `destination`, `step`.
- Acceptance criteria:
  - Equivalent events across pages expose the same key names.
  - Funnel slicing works without page-specific mapping exceptions.

4. Provider success state: promote single dominant next action per state
- Files: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`
- Change:
  - For each provider onboarding state (`waiting`, `heartbeat`, `ready`, `paused`, `stale`), visually prioritize one primary action and demote alternates.
- Acceptance criteria:
  - Each state presents exactly one primary button and optional secondary links.

### P2

5. Add a concise cross-surface messaging contract doc for conversion copy
- Files: `docs/ux/conversion-messaging-contract.md` (new), references in `docs/quickstart/page.tsx` and `docs/provider-guide/page.tsx`
- Change:
  - Document canonical message primitives:
    - Saudi energy cost advantage (headline level)
    - Arabic AI model support (headline level)
    - containerized GPU execution + runtime settlement wording
- Acceptance criteria:
  - New UI copy uses canonical phrases from the contract.
  - No page reintroduces disallowed phrasing (fabricated pricing, bare-metal claims).

## Implementation Checklist

1. P0: semantic split for live telemetry vs trust-policy strip
- Assignee: Frontend Developer
- Files: `app/page.tsx`, `app/lib/i18n.tsx`

2. P0: enterprise-proof micropanel at high-intent entry points
- Assignee: Frontend Developer + UX Writer
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/lib/i18n.tsx`

3. P1: analytics key normalization pass
- Assignee: Frontend Developer + Analytics owner
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/renter/marketplace/page.tsx`

4. P1: provider state-action hierarchy tightening
- Assignee: Frontend Developer
- Files: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`

5. P2: messaging contract doc
- Assignee: UX Researcher / UX Writer
- Files: `docs/ux/conversion-messaging-contract.md`, doc references in quickstart/provider-guide pages

## Sources

- Vast.ai docs: https://docs.vast.ai/
- RunPod pricing: https://www.runpod.io/pricing
- RunPod docs: https://docs.runpod.io/
- Lambda pricing: https://lambda.ai/pricing
- Akash GPU pricing: https://akash.network/pricing/gpus/
- Akash GPU deployments docs: https://akash.network/docs/learn/core-concepts/gpu-deployments/
- Together AI pricing: https://www.together.ai/pricing
- Together AI docs: https://docs.together.ai/
- Replit deployment pricing docs: https://docs.replit.com/billing/deployment-pricing
