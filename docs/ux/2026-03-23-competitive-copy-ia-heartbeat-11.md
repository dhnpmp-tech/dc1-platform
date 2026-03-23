# DCP Competitive UX + Copy IA Report — Heartbeat 11 (2026-03-23)

Owner: UX Researcher / Competitive Analyst (Codex)
Date: 2026-03-23 UTC
Scope: Fresh competitor messaging snapshot (Vast.ai, Runpod, Lambda, Akash, Together AI, Replit), DCP segment-to-page map, and conversion-focused copy/IA changes aligned with containerized GPU compute.

## Evidence Snapshot (Checked 2026-03-23 UTC)

Primary pages reviewed:
1. Vast.ai — `https://vast.ai/`
2. Runpod — `https://www.runpod.io/`
3. Lambda — `https://lambda.ai/`
4. Akash Deploy — `https://akash.network/deploy`
5. Together AI — `https://www.together.ai/`
6. Replit — `https://replit.com/`

Observed headline/meta patterns:
- Vast.ai emphasizes low-cost GPU rental and fast setup language.
- Runpod emphasizes broad AI/cloud infrastructure positioning.
- Lambda emphasizes AI cloud for training/inference and scale language.
- Akash deploy page emphasizes one-click templates and deployment-status visibility.
- Together AI emphasizes “AI native cloud” positioning.
- Replit emphasizes no-setup speed-to-build messaging.

Competitive UX pattern repeated across surfaces:
1. Strong single dominant CTA per primary intent.
2. Workload/outcome-first taxonomy (deploy, run, build) rather than company-structure taxonomy.
3. Proof and trust cues close to action controls.
4. Fast first-success path that avoids early branching overload.

## DCP Segment Map (Conversion Priority)

1. P0 Demand: Saudi startup teams shipping AI features
- Decision trigger: rapid first successful workload with predictable economics.
- Message order to lead: Saudi energy-cost advantage, then Arabic AI support.
- Pages: `app/page.tsx`, `app/renter/register/page.tsx`, `app/login/page.tsx`, `app/renter/playground/page.tsx`.

2. P0 Demand: Arabic-first AI builders
- Decision trigger: clear support for Arabic-focused model workflows.
- Message order: energy-cost advantage first, then Arabic model support.
- Pages: `app/page.tsx`, `app/renter/marketplace/page.tsx`, `app/docs/quickstart/page.tsx`, `app/docs/api/page.tsx`.

3. P1 Demand: Enterprise evaluators (MENA)
- Decision trigger: trust/compliance clarity and support path confidence.
- Pages: `app/page.tsx`, `app/support/page.tsx`, `app/legal/privacy/page.tsx`, `app/terms/page.tsx`.

4. P0 Supply: NVIDIA GPU providers with idle capacity
- Decision trigger: one clear next action from registration to heartbeat-ready.
- Pages: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`, `app/provider/page.tsx`.

## Code-Verified Friction (Current Workspace)

1. Homepage still carries early branching load.
- File: `app/page.tsx`
- Evidence: `modeStripItems` and `pathChooserLanes` are present in the discovery surface.

2. Provider registration mixes onboarding with cross-intent lane chooser.
- File: `app/provider/register/page.tsx`
- Evidence: `pathChooserLanes` includes renter/enterprise/docs branches inside provider onboarding.

3. Login has helper mapping but weak outcome emphasis near action.
- File: `app/login/page.tsx`
- Evidence: `helperRows` table exists, but no dominant role-specific value line immediately above submit.

## Conversion Recommendations

### P0 — Hero Copy and CTA Simplification (Renter + Provider only above fold)
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Keep exactly two primary hero actions above fold.
  - Move path chooser and mode strip below trust/proof content.
  - Hero message sequence: Saudi energy-cost advantage -> Arabic AI model support -> containerized execution reliability.
- Acceptance criteria:
  - First fold includes only renter/provider primary action buttons.
  - No fabricated pricing/savings/earnings percentages.
  - No bare-metal claims.
- Suggested assignee: Frontend Developer + Copywriter.

### P0 — Provider Onboarding Single-Action State UX
- Files:
  - `app/provider/register/page.tsx`
  - `app/lib/provider-install.ts`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Keep one dominant CTA per `nextActionState` (`waiting`, `heartbeat`, `stale`, `paused`, `ready`).
  - Move non-provider path chooser links out of onboarding success/status panel.
- Acceptance criteria:
  - Each onboarding state has one primary next-step button.
  - Status transitions still follow `/api/providers/me` fields.
- Suggested assignee: Frontend Developer.

### P0 — Login Role Outcome Strip
- Files:
  - `app/login/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add concise dynamic copy strip above submit that states role destination + immediate outcome.
  - Keep current auth API flows unchanged.
- Acceptance criteria:
  - Strip updates correctly for renter/provider/admin.
  - No backend contract changes.
- Suggested assignee: Frontend Developer + Copywriter.

### P1 — Reusable Arabic AI Proof Block
- Files:
  - `app/page.tsx`
  - `app/renter/marketplace/page.tsx`
  - `app/docs/quickstart/page.tsx`
  - `app/docs/api/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add one reusable copy block describing Arabic AI support (ALLaM 7B, Falcon H1, JAIS 13B, BGE-M3).
- Acceptance criteria:
  - Consistent wording across listed pages.
  - No unsupported benchmark/latency/accuracy claims.
- Suggested assignee: Frontend Developer + Copywriter + Docs Engineer.

### P1 — Enterprise Trust CTA Normalization
- Files:
  - `app/page.tsx`
  - `app/support/page.tsx`
  - `app/legal/privacy/page.tsx`
  - `app/terms/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Standardize enterprise-help CTA copy and destination route.
- Acceptance criteria:
  - Same CTA language and route across support/legal/trust surfaces.
- Suggested assignee: Frontend Developer + Copywriter.

## Implementation Checklist

1. P0: Reduce homepage to two first-fold actions (`app/page.tsx`, `app/lib/i18n.tsx`).
- Acceptance: first fold only renter/provider CTA pair.
- Assignee: Frontend Developer + Copywriter.

2. P0: Provider single-action state UX (`app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`).
- Acceptance: one primary CTA per onboarding state.
- Assignee: Frontend Developer.

3. P0: Login role-outcome strip (`app/login/page.tsx`, `app/lib/i18n.tsx`).
- Acceptance: dynamic truthful role outcome text near submit action.
- Assignee: Frontend Developer + Copywriter.

4. P1: Reusable Arabic AI proof module (`app/page.tsx`, `app/renter/marketplace/page.tsx`, `app/docs/quickstart/page.tsx`, `app/docs/api/page.tsx`, `app/lib/i18n.tsx`).
- Acceptance: uniform copy block on all listed surfaces.
- Assignee: Frontend Developer + Copywriter + Docs Engineer.

5. P1: Enterprise CTA normalization (`app/page.tsx`, `app/support/page.tsx`, `app/legal/privacy/page.tsx`, `app/terms/page.tsx`, `app/lib/i18n.tsx`).
- Acceptance: consistent CTA text and destination.
- Assignee: Frontend Developer + Copywriter.

## Guardrails

- Never invent pricing, ROI, or earnings figures.
- Never claim bare-metal GPUs; DCP uses containerized execution with NVIDIA Container Toolkit.
- Keep top-level differentiator order fixed:
  1. Saudi energy-cost advantage
  2. Arabic AI support
  3. Containerized execution reliability
