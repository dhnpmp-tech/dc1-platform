# DCP UX Competitive Segmentation + Conversion Recommendations (2026-03-23 03:49 UTC)

Owner: UX Researcher / Competitive Analyst (Codex)
Scope: competitor UX/messaging benchmark (Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit), DCP segment map, and conversion-focused implementation guidance for copy, onboarding, and IA.

## Evidence Base (verified 2026-03-23 UTC)

1. RunPod homepage — https://www.runpod.io/
- Navigation exposes clear product lanes (`Cloud GPUs`, `Serverless`, `Clusters`, `RunPod Hub`) and immediate self-serve action (`Get started` / `Sign Up`).
- Messaging repeatedly compresses journey into a single flow (`Spin up`, `Build`, `Iterate`, `Deploy`) with low-friction CTA placement.

2. RunPod serverless pricing — https://docs.runpod.io/serverless/pricing
- Billing semantics are explicit early: pay-per-second, billing start/stop boundaries, and separated cost components (compute, container disk, network volume).
- Worker mode differentiation is concrete (`Flex` vs `Active workers`) with behavior and pricing table.

3. Vast instances pricing — https://docs.vast.ai/documentation/instances/pricing
- Pricing model is framed as market-driven and variable by GPU class, reliability, geography, and marketplace conditions.
- Compute charging unit is stated directly (`per second`) and uncertainty factors are listed before deep detail.

4. Vast billing docs — https://docs.vast.ai/documentation/reference/billing
- Prepaid-credit model and zero-balance consequences are explicit (instance stop/deletion risk, storage charges, autobilling behavior).
- Billing page walkthrough clarifies transaction visibility and invoice export, reducing trust friction.

5. Lambda pricing — https://lambda.ai/pricing
- Strong dual-route CTAs (`Launch GPU instance` for self-serve, `Talk to our team` for enterprise/reserved).
- Pricing page combines transparent table-led self-serve rates with reserved-capacity sales path.

6. Akash quick start — https://akash.network/docs/getting-started/quick-start/
- Onboarding is task-sequenced (`Step 1` to `Step 9`) with explicit prerequisites and first deployment path.
- First-run success is anchored on a concrete deployment event and visible post-deploy actions (logs, usage, balance).

7. Together AI pricing — https://www.together.ai/pricing
- Product lanes are separated by operational maturity (`Serverless Inference` vs `Dedicated Inference` vs clusters).
- Pricing page maintains persistent build CTA while showing model-level and hardware-level pricing surfaces.

8. Replit pricing — https://replit.com/pricing
- Plan ladder is simple (`Starter`, `Core`, `Pro`, `Enterprise`) with clear self-serve and sales branches.
- Entry CTA remains low-friction (`Sign up`) while enterprise branch is always visible (`Contact sales`).

## DCP Segment Map (priority + conversion event)

1. P0: Self-serve renters (KSA/MENA builders, startups, product teams)
- Conversion event: first successful job output.
- Needs: immediate path clarity, billing semantics before submission, and low-friction login/re-entry.

2. P0: Arabic-first AI builders (Arabic NLP/RAG/app teams)
- Conversion event: confidence they can run Arabic models now.
- Needs: Arabic model proof near primary CTA, not only deep in docs.

3. P0: GPU providers (individual/pro-sumer and small infra operators)
- Conversion event: register -> daemon install -> heartbeat -> ready state.
- Needs: one dominant next action by state, minimal cross-intent distraction in onboarding.

4. P1: Enterprise evaluators (procurement/security/platform)
- Conversion event: enterprise intake initiated with clear trust expectations.
- Needs: explicit enterprise lane and response framing at top-level entry points.

## Code-Verified DCP Friction (current repository)

1. Landing first fold presents multiple competing routes before action commitment.
- File: `app/page.tsx`
- Evidence: both `modeStripItems` and `pathChooserLanes` are active in hero region.
- Risk: choice overload before user commits to renter/provider flow.

2. Provider registration still includes full multi-lane chooser inside onboarding context.
- File: `app/provider/register/page.tsx`
- Evidence: `pathChooserLanes` includes renter, enterprise, docs lanes while provider is mid-flow.
- Risk: drop-off during critical install/heartbeat setup sequence.

3. Renter registration success state mixes completion with broad route switching.
- File: `app/renter/register/page.tsx`
- Evidence: `modeChecklist` + `pathChooserLanes` co-exist on post-signup success surface.
- Risk: first-job intent diffuses into browsing behavior.

4. Marketplace IA still emphasizes cross-role path switching in decision surface.
- Files: `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`
- Evidence: path chooser lane block appears high in marketplace page architecture.
- Risk: renters evaluating GPUs are prompted to role-switch before submitting workload.

5. Login surface is functionally complete but differentiator proof is not tightly coupled to submit action.
- File: `app/login/page.tsx`
- Evidence: role/auth helper rows present, but no compact proof stack near submit controls.
- Risk: trust gap for first-time users entering credentials/API key.

## Prioritized Recommendations

### P0 — Compress first-fold choices on landing
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Change:
  - Keep exactly two dominant hero CTAs (`Rent GPU`, `Provide GPU`).
  - Move `modeStripItems` and expanded lane chooser below initial proof block.
  - Keep proof order fixed near CTA: Saudi energy-cost advantage -> Arabic model support -> containerized NVIDIA execution.
- Acceptance criteria:
  - Two primary above-fold actions only.
  - No unapproved numeric savings or earnings claims.
  - No bare-metal wording.

### P0 — Make provider onboarding state-pure
- Files:
  - `app/provider/register/page.tsx`
  - `app/lib/provider-install.ts`
- Change:
  - Keep one dominant CTA mapped to each `nextActionState` (`waiting`, `heartbeat`, `stale`, `paused`, `ready`).
  - Demote cross-role lanes to low-prominence footer links.
- Acceptance criteria:
  - One primary action per state.
  - Existing status polling semantics unchanged.

### P0 — Convert renter registration success into first-job launch path
- Files:
  - `app/renter/register/page.tsx`
  - `app/lib/i18n.tsx`
- Change:
  - Prioritize one primary CTA (`Launch first run`) with one secondary fallback (`Open playground`).
  - Collapse route chooser blocks behind a low-emphasis “Other paths” disclosure.
- Acceptance criteria:
  - Primary success action always points to first job submission.
  - EN/AR parity maintained through i18n keys.

### P1 — Add decision primer above marketplace filters
- Files:
  - `app/marketplace/page.tsx`
  - `app/renter/marketplace/page.tsx`
  - `app/lib/i18n.tsx`
- Change:
  - Insert a concise “How to choose” primer before filters/cards:
    - what displayed rate means,
    - how to map workload to GPU class,
    - where Arabic-model-ready options appear.
- Acceptance criteria:
  - Primer visible before filters.
  - No unsupported performance guarantees.

### P1 — Add proof-near-action strip on login
- Files:
  - `app/login/page.tsx`
  - `app/lib/i18n.tsx`
- Change:
  - Add compact 3-point trust strip above submit button:
    - Saudi energy-cost advantage,
    - Arabic model support,
    - containerized GPU execution.
- Acceptance criteria:
  - Visible in both email/OTP and API-key modes.
  - No fabricated pricing/performance claims.

### P2 — Enterprise lane clarity at high-intent pages
- Files:
  - `app/support/page.tsx`
  - `app/marketplace/page.tsx`
  - `app/renter/marketplace/page.tsx`
- Change:
  - Keep enterprise path available but visually secondary to self-serve action in renter/provider journeys.
  - Preserve direct enterprise CTA for procurement users.
- Acceptance criteria:
  - Enterprise lane stays discoverable.
  - Self-serve conversion path remains dominant in renter/provider contexts.

## Reusable Copy Stack (policy-safe)

1. "Lower-cost AI compute advantage from Saudi energy economics."
2. "Arabic-first model support (ALLaM, Falcon, JAIS, BGE-M3)."
3. "GPU workloads run in NVIDIA-enabled containers."
4. "Start quickly: register, run, monitor, and scale."

## Implementation Checklist

1. P0 landing CTA compression and proof hierarchy.
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Assignee: Frontend Developer + Copywriter.

2. P0 provider onboarding single-track state actions.
- Files: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`
- Assignee: Frontend Developer.

3. P0 renter registration success simplification.
- Files: `app/renter/register/page.tsx`, `app/lib/i18n.tsx`
- Assignee: Frontend Developer + Copywriter.

4. P1 marketplace decision primer.
- Files: `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Assignee: Frontend Developer + Copywriter.

5. P1 login proof-near-action trust strip.
- Files: `app/login/page.tsx`, `app/lib/i18n.tsx`
- Assignee: Frontend Developer + Copywriter.

6. P2 enterprise lane prominence tuning.
- Files: `app/support/page.tsx`, `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`
- Assignee: Frontend Developer.

## Guardrails

- Do not invent DCP pricing/savings/earnings values.
- Do not claim bare-metal GPUs; DCP execution is container-based with NVIDIA runtime.
- Keep differentiator order consistent: energy-cost advantage -> Arabic model support -> containerized execution reliability.
