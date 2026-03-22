# DCP UX Research Report: Competitor UX + Segment-to-Conversion Plan (2026-03-22 UTC)

Owner: UX Researcher / Competitive Analyst
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit
Guardrails: No fabricated pricing claims, no bare-metal language, recommendations aligned to container-based GPU execution

## 1) Evidence Snapshot (Primary Sources)

| Competitor | Observed UX/messaging pattern | Evidence (2026-03-22) | DCP implication |
|---|---|---|---|
| Vast.ai | Marketplace-first trust via pricing modes and billing semantics | Pricing page surfaces "On-Demand", "Interruptible", "Reserved", plus "Per-second billing" and "Prices set by supply and demand". | Keep DCP billing mechanics visible before registration and top-up decisions. |
| RunPod | Product ladder clarity (`Pods`, `Serverless`, `Clusters`) and fast CTA to start | Pricing nav and body explicitly segment modes and push `Get started` per mode. | Keep renter path split explicit: browser playground vs container job API path. |
| Lambda | Self-serve + sales-assisted path in one page with concrete procurement language | "Clear, straightforward pricing" + "Contact us for reserved capacity" + "Launch GPU instance". | Add explicit self-serve vs enterprise branch in DCP IA and top nav/hero CTAs. |
| Together.ai | Progressive adoption framing from serverless to dedicated | Pricing states "Most teams start with serverless inference and move to dedicated endpoints at scale." | DCP should narrate a first-job path then a scale path (templates/playground -> container jobs). |
| Akash | Strong deployment momentum language + container portability | Homepage emphasizes "Deploy Now", "1-Click Templates", and "If it runs in a container, it runs here." | DCP should keep container portability language near first CTA and docs entry points. |
| Replit | Friction-light plan ladder and role clarity | Pricing starts with clear tier ladder (`Starter`, `Core`, `Pro`, `Enterprise`) and immediate sign-up CTAs. | Reduce cognitive load in DCP nav labels and role-specific action copy. |

## 2) DCP Segment Map (Conversion-Oriented)

1. `Renter - startup/product teams`
- Job to be done: run first inference/training workload quickly.
- Objection: unclear first step and cost predictability.
- Message to prioritize: "Start in browser, then scale to container jobs; billing settles on actual runtime."

2. `Renter - enterprise/procurement`
- Job to be done: evaluate for production with governance confidence.
- Objection: trust/compliance and support escalation clarity.
- Message to prioritize: "PDPL-aware platform with explicit support/legal/status paths and enterprise contact route."

3. `Provider - single GPU owner/small operator`
- Job to be done: monetize idle NVIDIA GPU with low setup friction.
- Objection: uncertainty after registration (what next, when ready).
- Message to prioritize: "Register -> install daemon -> heartbeat -> eligible for jobs" with visible status states.

4. `Arabic AI teams (MENA)`
- Job to be done: build/deploy Arabic-first AI workloads.
- Objection: whether Arabic support is truly first-class.
- Message to prioritize: "Arabic model support is first-class (ALLaM, Falcon H1, JAIS, BGE-M3)" near top funnel.

## 3) Priority Recommendations (File-Mapped)

### P0: Conversion-critical

1. Homepage value hierarchy and path clarity
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Changes:
  - Keep hero hierarchy fixed as: Saudi energy-cost advantage -> Arabic AI model support -> containerized execution reality.
  - Tighten renter/provider split labels so first action is unambiguous.
- Acceptance criteria:
  - First-time visitor can choose renter vs provider path in <= 2 clicks.
  - Differentiators are visible above the fold in EN/AR.

2. Canonical billing explainer parity
- Files:
  - `app/page.tsx`
  - `app/renter/register/page.tsx`
  - `app/docs/quickstart/page.tsx`
  - `app/lib/i18n.tsx`
- Changes:
  - Reuse one billing block semantics everywhere users decide to register/pay:
    - estimate hold in halala
    - runtime settlement on actual usage
    - automatic unused balance return
- Acceptance criteria:
  - Billing language is semantically identical across landing, renter register, quickstart.

3. Provider onboarding certainty after registration
- Files:
  - `app/provider/register/page.tsx`
  - `app/provider/download/page.tsx`
  - `app/lib/i18n.tsx`
- Changes:
  - Add explicit "What happens next" panel with daemon/heartbeat timing and ready-state definition.
  - Add deterministic next-action per status step (`registered`, heartbeat seen, online/idle).
- Acceptance criteria:
  - Provider can identify next action without leaving registration success state.

### P1: Funnel completion and IA quality

4. Docs role entry + first-job track
- Files:
  - `app/docs/[[...slug]]/page.tsx`
  - `app/docs/quickstart/page.tsx`
  - `app/docs/provider-guide/page.tsx`
  - `app/docs/renter-guide/page.tsx`
- Changes:
  - Add role chooser at docs entry (Provider / Renter / API).
  - Standardize first-job checklist (register -> top up -> choose GPU -> submit -> monitor output).
- Acceptance criteria:
  - A renter reaches first-job checklist from docs in one click.

5. Nav IA by intent (not internal terminology)
- Files:
  - `app/components/layout/Header.tsx`
  - `app/components/layout/Footer.tsx`
  - `app/lib/i18n.tsx`
- Changes:
  - Prefer user-intent labels such as `Rent GPUs` and `Earn with GPUs`.
  - Keep enterprise/contact route visible but secondary.
- Acceptance criteria:
  - Nav labels describe user goal directly in EN/AR.

6. Support routing by role/use case
- Files:
  - `app/support/page.tsx`
  - `app/components/layout/Footer.tsx`
- Changes:
  - Add support entry tiles: Provider setup, job failures, billing questions, enterprise inquiry.
- Acceptance criteria:
  - Support page first viewport offers role-specific routing choices.

## 4) Conversion Copy Proposals (Safe, Capability-Aligned)

- Homepage subhead:
  - "Saudi-hosted GPU compute with first-class Arabic model support. Start in the browser, scale with container jobs."
- Billing explainer:
  - "Estimated cost is held in halala before run. Final settlement uses actual runtime, and unused balance is automatically returned."
- Provider onboarding line:
  - "Install daemon, send heartbeat, and become eligible for jobs once status is online."

## 5) Implementation Checklist (Research-to-Implementation)

1. `P0` Homepage hierarchy + path split
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Assignee role: Frontend Developer

2. `P0` Billing explainer parity block
- Files: `app/page.tsx`, `app/renter/register/page.tsx`, `app/docs/quickstart/page.tsx`, `app/lib/i18n.tsx`
- Assignee role: Frontend Developer

3. `P0` Provider post-registration certainty panel
- Files: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`, `app/lib/i18n.tsx`
- Assignee role: Frontend Developer

4. `P1` Docs role router + first-job track normalization
- Files: `app/docs/[[...slug]]/page.tsx`, `app/docs/quickstart/page.tsx`, `app/docs/provider-guide/page.tsx`, `app/docs/renter-guide/page.tsx`
- Assignee role: Frontend Developer

5. `P1` Intent-based nav labels
- Files: `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx`
- Assignee role: Frontend Developer

6. `P1` Support role triage
- Files: `app/support/page.tsx`, `app/components/layout/Footer.tsx`
- Assignee role: Frontend Developer

## Sources
- Vast pricing: https://vast.ai/pricing
- RunPod pricing: https://www.runpod.io/pricing
- Lambda pricing: https://lambda.ai/pricing
- Together pricing: https://www.together.ai/pricing
- Akash homepage: https://akash.network/
- Replit pricing: https://replit.com/pricing
