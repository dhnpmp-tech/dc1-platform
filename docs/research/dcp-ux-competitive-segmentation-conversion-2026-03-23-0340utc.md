# DCP UX Competitive Segmentation + Conversion Recommendations (2026-03-23 03:40 UTC)

Owner: UX Researcher / Competitive Analyst (Codex)
Scope: competitor UX/messaging scan (Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit), DCP customer segmentation, and conversion-focused recommendations for copy, onboarding, and information architecture.

## Evidence Base (official pages checked 2026-03-23 UTC)

1. RunPod homepage: https://www.runpod.io/
- Product lanes are explicit in global nav and above fold (`Cloud GPUs`, `Serverless`, `Clusters`, `Hub`) with immediate `Sign Up/Get started` actions.

2. RunPod serverless pricing docs: https://docs.runpod.io/serverless/pricing
- Billing semantics are concrete early (pay-per-second, worker types, compute + storage cost components).

3. Vast.ai pricing docs: https://docs.vast.ai/documentation/instances/pricing
- Marketplace pricing model is explained directly (host-set prices, real-time market rates) before deep feature detail.

4. Vast.ai billing docs: https://docs.vast.ai/documentation/reference/billing
- Prepay-credits model and zero-balance behavior are explicit, reducing billing ambiguity pre-purchase.

5. Lambda pricing page: https://lambda.ai/pricing
- Strong dual CTA framing (`Launch GPU instance` for self-serve, `Talk to our team` for enterprise) and transparent table-led pricing.

6. Akash quick start: https://akash.network/docs/getting-started/quick-start/
- First-run onboarding is task-first and step-by-step, including explicit signup/payment/deploy sequence.

7. Together AI pricing: https://www.together.ai/pricing
- Pricing page maintains direct build CTA while exposing model-level pricing and workload lanes.

8. Replit pricing: https://replit.com/pricing
- Plan ladder is simple and role-oriented (Starter/Core/Pro/Enterprise) with clear CTAs by plan.

## DCP Segment Map (conversion priority)

1. P0: Self-serve renters (startups, product teams, independent builders in KSA/MENA)
- Success event: first completed job.
- Decision drivers: fast start, predictable billing semantics, clear workload path.

2. P0: Arabic-first AI builders (Arabic assistants, RAG, NLP teams)
- Success event: confidence that Arabic models are first-class and runnable now.
- Decision drivers: visible Arabic model inventory + quickstart path.

3. P0: GPU providers (NVIDIA owners)
- Success event: register -> install daemon -> heartbeat -> ready.
- Decision drivers: state-aware onboarding, zero ambiguity in next action.

4. P1: Enterprise evaluators (procurement/security/platform teams)
- Success event: enterprise intake + trust/compliance conversation started.
- Decision drivers: clear enterprise lane, trust docs, response expectations.

## Code-Verified Friction in Current DCP UX

1. Early multi-lane branching on landing reduces first-action clarity.
- File: `app/page.tsx`
- Evidence: both `modeStripItems` and `pathChooserLanes` are active in the top experience.

2. Provider registration includes cross-intent detours inside onboarding flow.
- File: `app/provider/register/page.tsx`
- Evidence: `pathChooserLanes` includes renter/enterprise/docs links in registration context.

3. Renter registration success mixes completion with broad lane switching.
- File: `app/renter/register/page.tsx`
- Evidence: `modeChecklist` + `pathChooserLanes` are presented in the same post-signup state.

4. Login focuses on auth method mechanics more than proof-near-action.
- File: `app/login/page.tsx`
- Evidence: helper rows explain destination/auth mode, but differentiator proof stack is not anchored near submit controls.

5. Support starts with category dropdown before urgent route shortcuts.
- File: `app/support/page.tsx`
- Evidence: category select is primary before quick one-click enterprise/billing/provider escalation paths.

## Prioritized Recommendations

### P0 — First-fold conversion compression (landing)
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Keep two dominant primary CTAs above fold: `Rent GPU` and `Provide GPU`.
  - Move `modeStripItems` and full lane chooser below first trust/proof block.
  - Keep proof hierarchy fixed in first fold:
    1. Saudi energy cost advantage
    2. Arabic model support (ALLaM 7B, Falcon H1, JAIS 13B, BGE-M3)
    3. Containerized GPU execution reliability
- Acceptance criteria:
  - Exactly two visually primary hero CTA buttons.
  - No fabricated pricing/savings numbers.
  - No bare-metal claims.
- Suggested assignee: Frontend Developer + Copywriter.

### P0 — State-pure provider onboarding
- Files:
  - `app/provider/register/page.tsx`
  - `app/lib/provider-install.ts`
- Exact change:
  - Ensure one dominant CTA per `nextActionState` (`waiting`, `heartbeat`, `stale`, `paused`, `ready`).
  - Move cross-intent lane chooser to low-emphasis footer links.
- Acceptance criteria:
  - One primary action per state, no competing primary CTAs.
  - Existing `/api/providers/me` status mapping remains unchanged.
- Suggested assignee: Frontend Developer.

### P0 — Proof-near-action on renter entry surfaces
- Files:
  - `app/login/page.tsx`
  - `app/renter/register/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Add compact proof strip above auth/register submit actions with fixed stack:
    - Saudi energy-cost advantage
    - Arabic model support
    - NVIDIA-enabled container execution
- Acceptance criteria:
  - Same proof semantics on login + register.
  - EN/AR copy parity through i18n keys.
- Suggested assignee: Frontend Developer + Copywriter.

### P1 — Marketplace decision primer before filters/grid
- Files:
  - `app/renter/marketplace/page.tsx`
  - `app/marketplace/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Insert a short “How to choose” block before filters/cards:
    - what the shown rate represents,
    - which workload each GPU class fits,
    - where Arabic-model-ready options are surfaced.
- Acceptance criteria:
  - Primer visible before filter controls.
  - No unsupported performance guarantees.
- Suggested assignee: Frontend Developer + Copywriter.

### P1 — Support top-level quick routes
- Files:
  - `app/support/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Add one-click chips at top: `Enterprise`, `Billing`, `Provider Incident`.
  - On click: preselect category and focus message textarea.
- Acceptance criteria:
  - Chips appear before category dropdown.
  - Existing `sent_api`/`sent_fallback` states unchanged.
- Suggested assignee: Frontend Developer.

### P2 — Docs IA for renter first-run completion
- Files:
  - `app/docs/[[...slug]]/page.tsx`
  - `docs/quickstart.mdx`
  - `docs/models/index.mdx`
- Exact change:
  - Add a renter quickstart module with explicit order:
    1. Create API key
    2. Pick provider/model
    3. Submit first job
    4. Inspect output
  - Add an Arabic models spotlight panel linking ALLaM/Falcon/JAIS/BGE pages.
- Acceptance criteria:
  - Quickstart path reachable in <=2 clicks from docs landing.
  - Arabic model pages linked from first docs viewport.
- Suggested assignee: Frontend Developer + DevRel + Copywriter.

## Recommended Reusable Copy Stack (EN/AR)

1. Headline proof: "Built for lower-cost AI compute in Saudi Arabia."
2. Capability proof: "Arabic AI models supported out of the box."
3. Runtime proof: "GPU workloads run in NVIDIA-enabled containers."
4. Action proof: "Start in minutes: register, run, and scale."

Note: copy intentionally avoids unverified numeric savings and avoids bare-metal wording.

## Implementation Checklist

1. P0 — Landing CTA compression and proof hierarchy.
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Acceptance: two dominant first-fold CTAs; proof order fixed; lane chooser demoted.
- Assignee: Frontend Developer + Copywriter.

2. P0 — Provider onboarding single-track CTA by state.
- Files: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`
- Acceptance: one dominant CTA per state.
- Assignee: Frontend Developer.

3. P0 — Login/register proof strip unification.
- Files: `app/login/page.tsx`, `app/renter/register/page.tsx`, `app/lib/i18n.tsx`
- Acceptance: localized proof strip appears near submit actions on both pages.
- Assignee: Frontend Developer + Copywriter.

4. P1 — Marketplace decision primer.
- Files: `app/renter/marketplace/page.tsx`, `app/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Acceptance: primer appears above filters/cards.
- Assignee: Frontend Developer + Copywriter.

5. P1 — Support quick-route chips.
- Files: `app/support/page.tsx`, `app/lib/i18n.tsx`
- Acceptance: enterprise/billing/provider incident chips are first interaction element.
- Assignee: Frontend Developer.

6. P2 — Docs first-run + Arabic models spotlight.
- Files: `app/docs/[[...slug]]/page.tsx`, `docs/quickstart.mdx`, `docs/models/index.mdx`
- Acceptance: first-run sequence and Arabic model path are top-level docs entry points.
- Assignee: Frontend Developer + DevRel + Copywriter.

## Guardrails

- Do not invent pricing, savings, or ROI claims.
- Do not claim bare-metal GPUs.
- Keep the differentiator order consistent: energy-cost advantage -> Arabic model support -> container reliability.
