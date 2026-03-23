# DCP UX Competitive Snapshot + Conversion Actions
Date: 2026-03-22 21:56 UTC
Owner: UX Researcher / Competitive Analyst

## Scope
- Competitor UX/messaging scan: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit.
- DCP segment map and conversion-focused recommendations for copy, onboarding, and IA.
- Guardrails: no fabricated pricing claims, no bare-metal claims, align with container-based GPU execution.

## Evidence Signals (public pages observed 2026-03-22)
- Vast.ai frames marketplace economics and fast activation directly in top nav and hero (`Rent GPUs`, `Pricing`, `How It Works`). Source: https://vast.ai/
- RunPod explicitly names product mode at entry (`Serverless GPU for AI Workloads`). Source: https://www.runpod.io/product/serverless
- Lambda keeps procurement and pricing clarity directly accessible (`AI Cloud Pricing`). Source: https://lambda.ai/pricing
- Akash leads with marketplace framing (`Decentralized Compute Marketplace`). Source: https://akash.network/
- Together.ai presents full-stack mode packaging (`inference`, `fine-tuning`, `GPU clusters`). Source: https://www.together.ai/
- Replit emphasizes fast build/deploy outcome in the hero line. Source: https://replit.com/

## DCP Segment Map (conversion-focused)
1. Self-serve renter (startup/dev team)
- Job to be done: run first workload quickly and predictably.
- Primary friction: too many equal-weight actions before first run.
- Winning frame: one primary CTA + clear first-run sequence + runtime settlement clarity.

2. Provider (single GPU / small fleet)
- Job to be done: register, install daemon, verify heartbeat, start receiving jobs.
- Primary friction: confidence drop between registration and first healthy routing state.
- Winning frame: state-based next action + expectation timing + troubleshooting links.

3. Enterprise buyer
- Job to be done: validate procurement/security rollout path quickly.
- Primary friction: support entry must preserve intent and shorten intake path.
- Winning frame: visible enterprise lane + scoped intake options + proof points near CTA.

4. Arabic AI team
- Job to be done: find Arabic model path immediately and launch with confidence.
- Primary friction: Arabic-first model path can still get diluted in mixed generic flows.
- Winning frame: persistent Arabic model lane and one-click model-launch handoff.

## Current DCP Delta (from code review)
- Strong: landing/docs/register surfaces already include mode labels and differentiator proof blocks.
- Strong: provider onboarding has state-specific expectation/next-success copy in i18n.
- Remaining gap A (high impact): `/renter/marketplace` contains hardcoded English action labels (`Quick intent actions`, `Arabic model ready`, `Start here`, etc.), which breaks EN/AR conversion parity.
- Remaining gap B (high impact): docs index (`/docs`) renders mixed bilingual blocks in one flow; this creates scanning overhead vs competitor-style mode-first, language-clean entry.
- Remaining gap C (medium impact): landing still presents multiple top-level feature cards (`/privacy`, `/docs`, `/renter/register`) with near-equal emphasis, which weakens first-action clarity.

## Recommended Changes
1. Enforce language-safe conversion microcopy in renter marketplace.
- Replace hardcoded strings with i18n keys for quick-intent chips and start-here panel.
- Keep Arabic model lane explicit in both locales.

2. Tighten docs entry IA by locale-first rendering.
- Keep shared mode model, but render locale-specific copy blocks (EN only on EN, AR only on AR).
- Preserve direct mode links (Marketplace, Playground, Docs/API, Enterprise Support).

3. Sharpen landing action hierarchy.
- Keep Saudi energy-cost advantage and Arabic model support headline-level.
- Promote one primary conversion action (renter start) and demote non-conversion informational cards below first action cluster.

## Implementation Checklist

- P0
  - File paths: `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`
  - Exact changes needed: move all hardcoded conversion strings in marketplace quick-intent and start-here modules into i18n keys (EN/AR), including chip labels and start-state CTA helper text.
  - Acceptance criteria: no user-facing hardcoded English conversion copy remains in these modules; Arabic locale shows equivalent intent labels and CTA helper text.
  - Suggested assignee role: Frontend Developer

- P0
  - File paths: `app/docs/[[...slug]]/page.tsx`, `app/lib/i18n.tsx`
  - Exact changes needed: for docs root (`/docs`), avoid mixed bilingual paragraphs in the same block; render locale-targeted copy and keep the same mode-card structure/ordering.
  - Acceptance criteria: EN session sees EN-first copy only; AR session sees AR-first copy only; mode cards and CTA destinations remain identical across locales.
  - Suggested assignee role: Frontend Developer + UX

- P1
  - File paths: `app/page.tsx`, `app/lib/i18n.tsx`
  - Exact changes needed: rebalance first-screen CTA hierarchy so one primary renter action is visually dominant; move secondary informational cards (`privacy`, generic docs) lower in scan order.
  - Acceptance criteria: first viewport has one dominant primary CTA and one secondary path; differentiator line order remains: Saudi energy advantage -> Arabic AI support -> containerized execution.
  - Suggested assignee role: Frontend Developer + Copywriter

- P2
  - File paths: `app/page.tsx`, `app/renter/register/page.tsx`, `app/renter/marketplace/page.tsx`
  - Exact changes needed: normalize conversion event naming for mode selection and first-run CTAs so funnels are comparable across surfaces.
  - Acceptance criteria: consistent event schema (`role_intent`, `surface`, `destination`, `step`) for mode/path chooser and first-run actions on all three pages.
  - Suggested assignee role: Frontend Developer + Analytics

## Messaging Guardrails (must remain enforced)
- Keep headline differentiators: Saudi energy-cost structural advantage and Arabic AI model support.
- Keep runtime wording truthful: container-based GPU execution (Docker + NVIDIA toolkit).
- No fabricated pricing/savings claims and no bare-metal claims.
