# DCP UX Competitive Segmentation + Conversion Recommendations (2026-03-23 03:16 UTC)

Owner: UX Researcher / Competitive Analyst (Codex)
Scope: competitor UX/messaging scan (Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit), DCP segment mapping, and conversion-focused copy/onboarding/IA actions aligned to container-based GPU compute.

## Evidence Base (Official Sources, checked 2026-03-23 UTC)

1. Vast.ai pricing: https://vast.ai/pricing
- Frames purchase intent around live marketplace billing mechanics (market rates and usage billing semantics visible near pricing CTA).

2. RunPod product/pricing surfaces: https://www.runpod.io/ and https://www.runpod.io/pricing
- Workload lanes are explicit early (Pods/Serverless/Clusters/Hub), reducing pre-signup decision friction.

3. Lambda homepage/pricing: https://lambda.ai/ and https://lambda.ai/pricing
- Self-serve launch path and enterprise/sales path are both explicit in first interactions.

4. Akash deploy surface: https://akash.network/deploy
- Action-first deploy framing and quick-start content are presented before deep narrative reading.

5. Together.ai homepage/pricing: https://www.together.ai/ and https://www.together.ai/pricing
- Start/build CTA flow appears before deep platform detail, preserving early momentum.

6. Replit homepage/pricing: https://replit.com/ and https://replit.com/pricing
- Outcome-first homepage prompt plus clear plan taxonomy (`Starter`, `Core`, `Pro`, `Enterprise`) minimizes plan confusion.

## Competitive UX Patterns DCP Should Mirror

1. One dominant first action per visitor intent.
2. Workload-first IA before organizational complexity.
3. Proof next to action (pricing method, trust, readiness).
4. Fast first success path (signup -> first workload) with minimal lane switching.

## DCP Target Segment Map (Conversion Priority)

1. P0 Self-serve renters (Saudi startups and product teams)
- Core conversion event: first successful job run.
- Messaging order: Saudi energy-cost advantage -> Arabic model support -> container execution reliability.
- Primary pages: `app/page.tsx`, `app/renter/register/page.tsx`, `app/login/page.tsx`, `app/renter/playground/page.tsx`.

2. P0 Arabic-first AI builders (NLP, RAG, assistants)
- Core conversion event: confidence that Arabic models are first-class and runnable now.
- Primary pages: `app/page.tsx`, `app/renter/marketplace/page.tsx`, `docs/models/*.mdx`, `docs/quickstart.mdx`.

3. P1 Enterprise evaluators (procurement/security stakeholders)
- Core conversion event: clear enterprise intake and trust path.
- Primary pages: `app/page.tsx`, `app/support/page.tsx`, `app/legal/privacy/page.tsx`, `app/terms/page.tsx`.

4. P0 GPU providers (NVIDIA owners)
- Core conversion event: register -> daemon install -> heartbeat -> ready.
- Primary pages: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`, `app/provider/page.tsx`.

## Code-Verified Friction in Current DCP Flow

1. Landing has multi-lane branching in early discovery surface.
- File: `app/page.tsx`
- Evidence: `modeStripItems` and `pathChooserLanes` are present alongside primary hero intent controls.

2. Provider registration includes cross-intent lane chooser during onboarding.
- File: `app/provider/register/page.tsx`
- Evidence: `pathChooserLanes` includes renter/enterprise/docs detours inside provider flow.

3. Renter registration success state still introduces broad lane switching.
- File: `app/renter/register/page.tsx`
- Evidence: success view includes `modeChecklist` and `pathChooserLanes` in same conversion window.

4. Login helper is informational but not conversion-proof-led.
- File: `app/login/page.tsx`
- Evidence: helper rows explain auth + destination, but proof stack is not anchored near primary submit action.

5. Support starts with broad category taxonomy before urgency routing.
- File: `app/support/page.tsx`
- Evidence: category selector is shown before top-level quick-route chips for enterprise/billing/provider incident.

## Prioritized Recommendations (Conversion + IA)

### P0: Landing first-fold intent compression
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Keep only two dominant CTAs above fold (`Rent GPU`, `Provide GPU`).
  - Move mode strip and multi-lane chooser below trust/proof content.
  - Keep differentiator order fixed: energy cost -> Arabic AI -> container reliability.
- Acceptance criteria:
  - Exactly two visually primary CTA controls in first fold.
  - No fabricated pricing/savings claims.
  - No bare-metal wording.
- Suggested assignee role: Frontend Developer + Copywriter.

### P0: Provider onboarding single-track progression
- Files:
  - `app/provider/register/page.tsx`
  - `app/lib/provider-install.ts`
- Exact change:
  - Keep one dominant CTA per `nextActionState` (`waiting`, `heartbeat`, `stale`, `paused`, `ready`).
  - Move cross-intent chooser to low-emphasis footer links.
- Acceptance criteria:
  - One primary action per provider state.
  - Existing `/api/providers/me` state mapping remains unchanged.
- Suggested assignee role: Frontend Developer.

### P0: Renter auth/register proof strip
- Files:
  - `app/login/page.tsx`
  - `app/renter/register/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Add a compact proof strip above submit CTA:
    - Saudi energy-cost advantage
    - Arabic model support (ALLaM 7B, Falcon H1, JAIS 13B, BGE-M3)
    - GPU-accelerated container execution
- Acceptance criteria:
  - Same proof stack semantics on both login and register surfaces.
  - i18n keys added for EN/AR copy parity.
- Suggested assignee role: Frontend Developer + Copywriter.

### P1: Marketplace outcome primer before comparison grid
- Files:
  - `app/renter/marketplace/page.tsx`
  - `app/marketplace/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Add pre-grid explainer block covering:
    - what displayed rate means,
    - how to choose provider by workload,
    - where Arabic-model-ready options are surfaced.
- Acceptance criteria:
  - Primer appears before filter controls and card list.
  - No unsupported latency/benchmark guarantees.
- Suggested assignee role: Frontend Developer + Copywriter.

### P1: Support quick-route chips at top of form
- Files:
  - `app/support/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Add one-click chips for `Enterprise`, `Billing`, `Provider Incident` that preselect category and focus message input.
- Acceptance criteria:
  - Route chips appear before category dropdown.
  - Existing truthful states (`sent_api`, `sent_fallback`) remain unchanged.
- Suggested assignee role: Frontend Developer.

## Recommended Copy Stack (Reuse Across Key Entry Surfaces)

1. Saudi energy-cost advantage (structural cost edge).
2. Arabic AI model support (ALLaM 7B, Falcon H1, JAIS 13B, BGE-M3).
3. Containerized GPU execution reliability (NVIDIA-enabled Docker runtime).
4. One clear next action by role.

## Implementation Checklist

1. P0: Landing first-fold CTA compression.
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Acceptance: two dominant above-fold CTAs; lower-priority lane chooser moved down-page.
- Assignee: Frontend Developer + Copywriter.

2. P0: Provider onboarding single-track CTA flow.
- Files: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`
- Acceptance: one primary CTA per provider state.
- Assignee: Frontend Developer.

3. P0: Proof strip standardization for renter entry auth/register.
- Files: `app/login/page.tsx`, `app/renter/register/page.tsx`, `app/lib/i18n.tsx`
- Acceptance: shared, localized proof strip near submit actions.
- Assignee: Frontend Developer + Copywriter.

4. P1: Marketplace pre-grid outcome primer.
- Files: `app/renter/marketplace/page.tsx`, `app/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Acceptance: primer visible before comparison/filter area.
- Assignee: Frontend Developer + Copywriter.

5. P1: Support quick-route chips.
- Files: `app/support/page.tsx`, `app/lib/i18n.tsx`
- Acceptance: enterprise/billing/provider incident selectable in one click.
- Assignee: Frontend Developer.

## Guardrails

- Do not invent pricing, earnings, savings, or ROI figures.
- Do not claim bare-metal execution.
- Keep differentiator hierarchy consistent:
  1. Saudi energy-cost advantage
  2. Arabic AI support
  3. Containerized GPU reliability
