# DCP UX Competitive + Conversion Delta (Post-Implementation Audit)

Date: 2026-03-22 19:45 UTC  
Owner: UX Researcher / Competitive Analyst  
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit  
Guardrails: No fabricated pricing or savings claims, no bare-metal wording, recommendations aligned to container-based GPU compute.

## Executive Delta

Most previously recommended conversion fixes are now shipped in code (`app/page.tsx`, `app/support/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/docs/[[...slug]]/page.tsx`).

Remaining gaps are no longer about missing sections; they are about **decision friction and message consistency** between homepage intent chips, nav labels, marketplace trust semantics, and enterprise intake framing.

## Competitor Evidence (Official Sources, reviewed 2026-03-22)

| Competitor | Observed UX/Messaging Pattern | Source | DCP Implication |
|---|---|---|---|
| Vast.ai | Explicit 3-step acquisition flow and mode split (GPU Cloud, Serverless, Clusters) with real-time pricing framing. | https://vast.ai/ | Keep DCP role routing deterministic, with one “next best action” per role state. |
| RunPod | Pricing page leads with product-mode segmentation (Pods, Serverless, Instant/Reserved Clusters). | https://www.runpod.io/pricing | Reinforce mode clarity in nav labels and CTA microcopy, not only in docs. |
| Lambda | Dual CTA in pricing hero: immediate self-serve + sales-assisted enterprise branch. | https://lambda.ai/pricing | Keep enterprise branch visible at top navigation and in marketplace high-intent moments. |
| Akash | Marketplace + transparent GPU pricing language and container-oriented deployment docs. | https://akash.network/pricing/gpus/ , https://akash.network/docs/learn/core-concepts/gpu-deployments/ | Keep container runtime truth explicit near execution CTAs, not buried in docs. |
| Together.ai | Progression ladder clearly stated: serverless start, dedicated at scale. | https://www.together.ai/pricing | Strengthen DCP renter progression copy: browser start -> API/container repeatability -> enterprise capacity. |
| Replit | Plain-language deployment-type chooser tied to billing behavior. | https://docs.replit.com/billing/deployment-pricing , https://replit.com/pricing | Continue reducing cognitive load by mapping each route to billing/runtime behavior in one sentence. |

## DCP Segment Map (Conversion-Critical)

1. Renter (self-serve builder)
- Trigger: run first workload quickly.
- Anxiety: wrong route choice (playground vs marketplace vs docs).
- Best message: “Start in browser now; move to API/container for repeat jobs.”

2. Provider (solo/fleet)
- Trigger: monetize idle NVIDIA GPUs.
- Anxiety: post-registration uncertainty and recovery from stale heartbeat.
- Best message: “Install daemon, verify heartbeat, then routing eligibility follows state.”

3. Enterprise evaluator
- Trigger: procurement + rollout planning.
- Anxiety: where enterprise path starts and what information is needed.
- Best message: “Use enterprise intake for reserved capacity planning and security review.”

4. Arabic AI teams
- Trigger: Arabic-first model execution.
- Anxiety: support is marketing-only.
- Best message: “Arabic models are available with documented deployment paths.”

## What Is Already Shipped (Do Not Rebuild)

- Landing role-intent chips and role-specific path cards: `app/page.tsx`
- Support triage before generic contact form: `app/support/page.tsx`
- Renter first-job checklist and billing explainer: `app/renter/register/page.tsx`
- Provider post-register state machine + troubleshooting/support routing: `app/provider/register/page.tsx`
- Docs role router and enterprise intake links: `app/docs/[[...slug]]/page.tsx`

## Remaining Gaps (File-Mapped)

### P0

1. Header/footer enterprise CTA taxonomy drift
- Files: `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx`
- Gap: enterprise/support labels and source parameters vary by entry point, reducing attribution clarity and message consistency.
- Exact change:
  - Normalize one enterprise label string and one canonical support route contract.
  - Standardize `source=` query conventions across header/footer/hero/docs.
- Acceptance criteria:
  - Same enterprise label appears across nav/footer hero-adjacent entries.
  - Source tags are consistent and analytics-friendly.

2. Marketplace trust semantic consistency
- Files: `app/renter/marketplace/page.tsx`, `app/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Gap: strong data exists (heartbeat age, success rate, reliability), but user-facing “what this means” semantics are not consistently framed in conversion language.
- Exact change:
  - Add compact, repeated helper copy under provider cards:
    - heartbeat freshness meaning,
    - success-rate interpretation,
    - runtime settlement reminder.
- Acceptance criteria:
  - Every provider card exposes trust metrics + one-line interpretation.
  - No unsupported SLA or payout promises are introduced.

### P1

3. Landing hero-to-path coherence under intent switching
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Gap: intent chips are strong, but alternate CTA/helper lines can feel generic when switching to enterprise.
- Exact change:
  - Tighten helper copy for enterprise state to procurement language (not renter/provider fallback language).
  - Keep one primary action and one role-coherent secondary action.
- Acceptance criteria:
  - Enterprise intent state reads as enterprise-first end-to-end.

4. Cross-surface checklist naming parity (final pass)
- Files: `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/docs/quickstart/page.tsx`, `app/docs/provider-guide/page.tsx`, `app/lib/i18n.tsx`
- Gap: sequence exists everywhere, but naming style still varies slightly by page.
- Exact change:
  - Enforce one canonical step vocabulary across pages/docs.
- Acceptance criteria:
  - Same step names/order appear in renter/provider + docs counterparts.

### P2

5. Conversion event taxonomy cleanup
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/renter/marketplace/page.tsx`
- Gap: events are present, but event naming/property conventions are not yet documented as a shared schema.
- Exact change:
  - Add a short analytics naming contract doc and align event payload keys (`source_page`, `role`, `step`, `destination`).
- Acceptance criteria:
  - Funnel analysis can compare role journeys without per-page mapping hacks.

## Conversion Copy Recommendations (Safe, Ready to Ship)

- Renter helper line: “Start in-browser now; switch to API/container jobs for repeat workloads.”
- Provider helper line: “Daemon heartbeat confirms readiness; routing follows live status.”
- Enterprise helper line: “Use enterprise intake for reserved capacity planning and deployment review.”
- Trust line near execution CTAs: “Containerized GPU execution with runtime-based settlement.”

## Implementation Checklist

1. `P0` Enterprise CTA normalization
- Files: `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx`
- Suggested assignee: Frontend Developer
- Acceptance: single enterprise CTA language + canonical route params.

2. `P0` Marketplace trust-language layer
- Files: `app/renter/marketplace/page.tsx`, `app/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Suggested assignee: Frontend Developer + UX Writer
- Acceptance: trust metric interpretation appears at decision point on every provider card.

3. `P1` Intent-state copy coherence
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Suggested assignee: Frontend Developer
- Acceptance: enterprise intent no longer inherits renter/provider fallback phrasing.

4. `P1` Final checklist vocabulary parity
- Files: `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/docs/quickstart/page.tsx`, `app/docs/provider-guide/page.tsx`, `app/lib/i18n.tsx`
- Suggested assignee: Frontend Developer + UX Writer
- Acceptance: same step naming/order across all onboarding surfaces.

5. `P2` Shared analytics schema doc + alignment
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/renter/marketplace/page.tsx`, `docs/ux/`
- Suggested assignee: Frontend Developer / Analytics owner
- Acceptance: consistent event schema for cross-funnel reporting.

## Sources

- Vast.ai homepage: https://vast.ai/
- RunPod pricing: https://www.runpod.io/pricing
- Lambda pricing: https://lambda.ai/pricing
- Akash GPU pricing: https://akash.network/pricing/gpus/
- Akash GPU deployments docs: https://akash.network/docs/learn/core-concepts/gpu-deployments/
- Together.ai pricing: https://www.together.ai/pricing
- Replit deployment pricing docs: https://docs.replit.com/billing/deployment-pricing
- Replit pricing: https://replit.com/pricing
