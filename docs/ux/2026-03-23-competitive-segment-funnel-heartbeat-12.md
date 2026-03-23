# DCP Competitive Segment + Funnel Messaging Report — Heartbeat 12 (2026-03-23)

Owner: UX Researcher / Competitive Analyst (Codex)
Date: 2026-03-23 UTC
Scope: Fresh competitor UX/messaging evidence, segment funnel mapping, and concrete conversion copy/IA changes for DCP (container-based GPU compute only).

## Evidence Snapshot (Official Sources, checked 2026-03-23 UTC)

1. Vast.ai pricing (`https://vast.ai/pricing`)
- Hero line: "GPU Pricing — Live Marketplace Rates".
- Positioning: "Prices set by supply and demand" and "Per-second billing".
- UX implication: pricing transparency and usage-based billing proof are surfaced near first action.

2. RunPod homepage + pricing (`https://www.runpod.io/`, `https://www.runpod.io/pricing`)
- Homepage nav exposes workload paths early: Pods, Serverless, Clusters, Hub.
- Messaging emphasizes instant workload starts and low operational friction.
- UX implication: workload-first IA reduces cognitive load before signup.

3. Lambda homepage + pricing (`https://lambda.ai/`, `https://lambda.ai/pricing`)
- Primary CTA: "Launch GPU instance" with secondary sales route.
- Pricing page headline: "AI cloud pricing" with "Clear, straightforward pricing".
- UX implication: dual path (self-serve vs sales) is explicit in first fold.

4. Akash deploy (`https://akash.network/deploy`)
- Deployment surface is action-first (console/deploy flow before deep reading).
- UX implication: fast path to first deployment is prioritized over long narrative.

5. Together AI homepage + pricing (`https://www.together.ai/`, `https://www.together.ai/pricing`)
- Platform-level framing with immediate build/start motions.
- UX implication: CTA-first funnel with model/platform context layered after action intent.

6. Replit homepage + pricing (`https://replit.com/`, `https://replit.com/pricing`)
- Homepage hero: "What will you build?" and "Turn ideas into apps in minutes — no coding needed".
- Pricing page tiers present immediate plan clarity (`Starter`, `Core`, `Pro`, `Enterprise`).
- UX implication: outcome-first prompt + simple tier framing accelerates first conversion.

## DCP Segment Funnel Map (Priority)

1. P0 Renter demand: Saudi startup teams shipping AI features
- Trigger: fast first successful job with predictable billing behavior.
- Message order: Saudi energy-cost advantage -> Arabic AI support -> container reliability.
- Entry pages: `app/page.tsx`, `app/renter/register/page.tsx`, `app/login/page.tsx`.
- Activation pages: `app/renter/playground/page.tsx`, `app/jobs/submit/page.tsx`.

2. P0 Renter demand: Arabic-first AI teams
- Trigger: confidence that Arabic model support is first-class and practical.
- Message order: energy-cost advantage first, Arabic model proof second.
- Entry pages: `app/page.tsx`, `app/renter/marketplace/page.tsx`.
- Validation pages: `app/docs/models/index.mdx`, `app/docs/quickstart/page.tsx`, `app/docs/api/page.tsx`.

3. P1 Enterprise evaluators (MENA)
- Trigger: clear trust path and clear escalation/support path.
- Entry pages: `app/page.tsx`, `app/support/page.tsx`.
- Validation pages: `app/legal/privacy/page.tsx`, `app/terms/page.tsx`.

4. P0 Supply: GPU providers (NVIDIA owners)
- Trigger: one obvious next action from register -> daemon install -> heartbeat -> ready.
- Entry pages: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`.
- Activation pages: `app/provider/page.tsx`, `app/provider/dashboard/page.tsx`.

## Current DCP Friction (Code-Verified)

1. Homepage first fold still carries optional branch complexity
- File: `app/page.tsx`
- Evidence: first-surface structures include `modeStripItems` and `pathChooserLanes` in addition to primary actions.
- Conversion risk: first-click intent dilution.

2. Provider register flow includes non-provider branch routing in same surface
- File: `app/provider/register/page.tsx`
- Evidence: `pathChooserLanes` embeds renter/enterprise/docs detours inside provider flow.
- Conversion risk: provider onboarding drop-off before daemon install.

3. Support page category taxonomy is broad before urgency routing
- File: `app/support/page.tsx`
- Evidence: multi-category selector appears before role-specific guided routing.
- Conversion risk: slower enterprise/incident triage path.

4. Marketplace proof hierarchy is strong on specs but weaker on outcome framing
- Files: `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`
- Evidence: detailed provider metrics are present, but first-view narrative does not consistently emphasize cost structure + Arabic model fit before comparison effort.

## Conversion Recommendations (Implementation-Ready)

### P0: First-Fold Intent Compression (Landing)
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Keep two dominant first-fold CTAs only (Renter, Provider).
  - Move `modeStripItems` and `pathChooserLanes` below first trust block.
  - Keep message order fixed: energy advantage -> Arabic AI -> container reliability.
- Acceptance criteria:
  - Exactly two primary CTA buttons above fold.
  - No fabricated pricing or savings percentages.
  - No bare-metal language.
- Suggested assignee: Frontend Developer + Copywriter.

### P0: Provider Onboarding Single-Track UX
- Files:
  - `app/provider/register/page.tsx`
  - `app/lib/provider-install.ts`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Keep one primary CTA per `nextActionState` (`waiting`, `heartbeat`, `stale`, `paused`, `ready`).
  - Move cross-intent lane chooser below onboarding completion or into footer links.
- Acceptance criteria:
  - One visually dominant next step per provider state.
  - Existing `/api/providers/me` state mapping unchanged.
- Suggested assignee: Frontend Developer.

### P0: Segment-Specific Proof Strip (Renter entry points)
- Files:
  - `app/renter/register/page.tsx`
  - `app/login/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add compact proof strip directly above submit CTA:
    - "Saudi energy-cost advantage"
    - "Arabic model support (ALLaM 7B, Falcon H1, JAIS 13B, BGE-M3)"
    - "GPU-accelerated Docker execution"
- Acceptance criteria:
  - Strip visible on renter register and renter login routes.
  - Copy is identical across both pages (localized variants allowed).
- Suggested assignee: Frontend Developer + Copywriter.

### P1: Marketplace Outcome Framing Block
- Files:
  - `app/marketplace/page.tsx`
  - `app/renter/marketplace/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add a top-of-list explainer block before filters/cards:
    - how price is shown,
    - how workload selection maps to provider filters,
    - where Arabic-model-ready options are found.
- Acceptance criteria:
  - Block appears before first GPU card grid.
  - No unsupported benchmark or latency claims.
- Suggested assignee: Frontend Developer + Copywriter.

### P1: Enterprise Trust Route Normalization
- Files:
  - `app/page.tsx`
  - `app/support/page.tsx`
  - `app/legal/privacy/page.tsx`
  - `app/terms/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Standardize one CTA label and one enterprise destination route (`/support?category=enterprise#contact-form`).
- Acceptance criteria:
  - Same CTA text/destination across all listed trust/legal surfaces.
  - No claims that imply implemented payment/payout systems beyond current state.
- Suggested assignee: Frontend Developer + Copywriter.

## Implementation Checklist

1. P0 — Landing first-fold intent compression (`app/page.tsx`, `app/lib/i18n.tsx`).
- Acceptance: two primary CTAs above fold and message sequence preserved.
- Assignee: Frontend Developer + Copywriter.

2. P0 — Provider onboarding single-track state UX (`app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`).
- Acceptance: one primary CTA per state.
- Assignee: Frontend Developer.

3. P0 — Renter proof strip near submit (`app/renter/register/page.tsx`, `app/login/page.tsx`, `app/lib/i18n.tsx`).
- Acceptance: consistent proof strip on both paths.
- Assignee: Frontend Developer + Copywriter.

4. P1 — Marketplace outcome framing block (`app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`).
- Acceptance: explainer block visible before filters/cards.
- Assignee: Frontend Developer + Copywriter.

5. P1 — Enterprise trust CTA normalization (`app/page.tsx`, `app/support/page.tsx`, `app/legal/privacy/page.tsx`, `app/terms/page.tsx`, `app/lib/i18n.tsx`).
- Acceptance: canonical enterprise CTA route used everywhere.
- Assignee: Frontend Developer + Copywriter.

## Guardrails

- Do not invent pricing/ROI/earnings claims.
- Do not claim bare-metal GPUs.
- Keep differentiator order fixed:
  1. Saudi energy-cost advantage
  2. Arabic AI model support
  3. Containerized execution reliability
