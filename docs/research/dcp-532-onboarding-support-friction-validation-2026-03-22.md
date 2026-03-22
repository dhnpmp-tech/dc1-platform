# DCP-532 — Onboarding & Support Friction Validation
Date: 2026-03-22 (UTC)
Owner role: UX Researcher / Competitive Analyst

## Scope
- Validate conversion friction in DCP onboarding and support flows.
- Benchmark UX/messaging patterns used by Vast.ai, Runpod, Lambda, Akash, Together.ai, and Replit.
- Propose measurable experiments and prioritized implementation order.

## Evidence Sources
### DCP product surfaces reviewed
- `app/page.tsx`
- `app/renter/register/page.tsx`
- `app/provider/register/page.tsx`
- `app/docs/quickstart/page.tsx`
- `app/support/page.tsx`
- `next.config.js`
- `backend/src/routes/*` (support route presence check)

### Competitor references (March 22, 2026 snapshots)
- Vast.ai: https://vast.ai/
- Runpod: https://www.runpod.io/
- Runpod docs overview: https://docs.runpod.io/overview
- Lambda: https://lambda.ai/
- Akash: https://akash.network/
- Together AI: https://www.together.ai/
- Replit Deployments: https://replit.com/deployments
- Replit deployment docs: https://docs.replit.com/cloud-services/deployments/custom-domains

## Findings — DCP Funnel Friction (Current State)
### P0-1: Support form reports success even when support API does not exist
- Evidence:
  - Frontend posts to `/api/dc1/support/contact` in `app/support/page.tsx`.
  - No matching backend support route exists under `backend/src/routes` for `support/contact`.
  - On non-OK response/catch, UI sets `status='sent'` and falls back to `mailto:`.
- User impact:
  - Creates false confidence that ticket was submitted.
  - Increases repeat contact and trust erosion for high-intent users.

### P0-2: Provider registration success state is overloaded (high cognitive load)
- Evidence:
  - `app/provider/register/page.tsx` success screen includes API key, two install commands, troubleshooting commands, status tracker, trust block, and action matrix in one long view.
- User impact:
  - New providers need one next action (install + verify heartbeat), but face many simultaneous instructions.
  - Likely to reduce step-2 completion (daemon install) after successful registration.

### P1-1: Renter register captures key but does not enforce first funded action
- Evidence:
  - `app/renter/register/page.tsx` success state has checklist and CTAs, but primary CTA is `playground` instead of funding gate.
  - Billing explainer is present, but no explicit "top up first" lock or decision CTA.
- User impact:
  - Users can attempt job flow before balance is ready; this introduces avoidable failure loops.

### P1-2: Inconsistent trust semantics across flows
- Evidence:
  - Landing and quickstart emphasize settlement model, but support path does not reiterate expected response windows or escalation paths.
  - Provider/renter onboarding has analytics events, but support submission path lacks explicit conversion telemetry for success vs fallback branch.
- User impact:
  - Weak continuity from discovery to issue resolution.
  - Harder to diagnose where high-intent users churn.

### P2-1: Entry-point segmentation exists but still role-crossing friction remains
- Evidence:
  - Landing and docs now include role chips/cards, but some CTAs still route users into broad pages where next steps compete.
- User impact:
  - Lower confidence for first-time users deciding between renter/provider paths.

## Competitor UX/Messaging Patterns (What Works)
### Vast.ai
- Uses "instant GPUs + transparent pricing" in hero and explicit 3-step onboarding (Add Credit → Search GPUs → Deploy).
- Low-friction initial funding cue (small starting credit) reduces ambiguity before first workload.
- Transferable to DCP: explicit first-run sequence with mandatory funding checkpoint.

### Runpod
- Strong flow framing: idea → spin up → build → deploy; clear distinction between Pods and Serverless.
- Docs nav surfaces quickstarts per product mode immediately.
- Transferable to DCP: mode-first pathing (playground vs API) before technical detail.

### Lambda
- Enterprise trust-forward framing (security/compliance + hardware clarity + strong CTA).
- Transferable to DCP: trust and compliance reassurance should appear in onboarding and support transitions, not only marketing pages.

### Akash
- Aggressive cost-comparison framing plus template-led deployment and provider monetization lane.
- Transferable to DCP: keep Saudi energy-cost advantage prominent and attach a concrete "deploy now" path from each claim block.

### Together AI
- Product architecture is explicit: serverless, dedicated, container inference, clusters, playground.
- Transferable to DCP: tighter IA around "what am I buying?" by workload mode and control level.

### Replit
- "Publish in a few clicks" positioning, then concrete deployment options (Autoscale / Reserved VM / Static) in docs.
- Transferable to DCP: pair simple promise language with precise mode choices and docs continuity.

## DCP Target Segment Map (Conversion-Oriented)
### Segment A: Startup ML builders (speed-first)
- Need: first result fast, minimal infra setup.
- Primary objection: unclear launch sequence.
- Winning message: Saudi-hosted low-cost compute + playground/API quickstart in minutes.

### Segment B: Arabic AI product teams (fit-first)
- Need: Arabic model support + predictable deployment path.
- Primary objection: model/runtime compatibility uncertainty.
- Winning message: Arabic model support is first-class with containerized execution path.

### Segment C: Enterprise/regulated teams (risk-first)
- Need: support reliability, compliance language, escalation confidence.
- Primary objection: support and operational trust.
- Winning message: deterministic support workflow + transparent settlement + operational controls.

### Segment D: GPU providers (earnings-and-reliability)
- Need: clear "after registration" next action and status recovery path.
- Primary objection: daemon install complexity, uncertainty when jobs start.
- Winning message: one-command install, heartbeat verification, and state-based action guidance.

## Prioritized Experiment Backlog
### Experiment 1 (P0): Honest support submission state + fallback transparency
- Hypothesis: Removing false success and exposing fallback path will increase trust and reduce repeat submissions.
- Change:
  - Distinguish API-success vs mailto-fallback states in support UI.
  - Add visible note when fallback is used.
- Primary KPI: support form completion-to-confirmation rate (true submission or explicit mail client launch).
- Guardrail: decrease in repeated submissions from same session within 10 minutes.

### Experiment 2 (P0): Provider success-state progressive disclosure
- Hypothesis: Showing only one required action at a time increases daemon-install completion.
- Change:
  - Collapse advanced troubleshooting under expandable sections.
  - Keep one primary CTA for current state (`waiting`, `heartbeat`, `stale`, `paused`, `ready`).
- Primary KPI: registration success → first heartbeat conversion rate.
- Guardrail: no increase in provider support contacts tagged install issues.

### Experiment 3 (P1): Renter "fund before first run" action hierarchy
- Hypothesis: Making wallet top-up the first post-registration action reduces failed first submits.
- Change:
  - Promote `/renter/billing` CTA as primary after registration until funded.
  - Keep playground CTA as secondary.
- Primary KPI: registration success → first top-up conversion.
- Guardrail: time-to-first-completed-job does not regress.

### Experiment 4 (P1): Support funnel telemetry normalization
- Hypothesis: Better event granularity surfaces root causes faster.
- Change:
  - Track submit attempt, API success, API failure, fallback-launch success, fallback-dismiss.
- Primary KPI: % of support attempts with complete event chain.
- Guardrail: no measurable increase in frontend error rate.

### Experiment 5 (P2): Role-path reinforcement above the fold on support and register pages
- Hypothesis: role-specific path prompts reduce navigation backtracking.
- Change:
  - Add lightweight role-specific helper cards linking directly to renter/provider/docs flow.
- Primary KPI: reduced cross-role bounce (provider users entering renter-only flow and vice versa).
- Guardrail: no drop in overall page engagement.

## Recommended Implementation Order
1. P0 — support state truthfulness (`/support`) and telemetry baseline.
2. P0 — provider success-state simplification (`/provider/register`).
3. P1 — renter post-register funding hierarchy (`/renter/register`).
4. P1 — cross-funnel trust continuity copy and analytics.
5. P2 — role-path reinforcement components.

## Implementation Checklist
### P0
- File: `app/support/page.tsx`
- Change: split `sent` into `sent_api` and `sent_fallback`; show explicit fallback messaging and user confirmation action.
- Acceptance criteria:
  - UI never implies API submission when API endpoint failed.
  - Distinct analytics events for API success and fallback path.
  - User can retry without page reload.
- Suggested assignee role: Frontend Developer

- File: `backend/src/routes/` (new `support.js`) and `backend/src/server.js`
- Change: add `POST /api/support/contact` with validation and JSON error convention.
- Acceptance criteria:
  - Returns `{ error: "..." }` on validation failures.
  - Returns success payload on accepted submissions.
  - Route wired in server and reachable via `/api/dc1/support/contact` rewrite.
- Suggested assignee role: Backend Architect

- File: `app/provider/register/page.tsx`
- Change: progressive disclosure on success state (primary next action visible; advanced checks collapsed).
- Acceptance criteria:
  - One primary CTA above fold based on `nextActionState`.
  - Advanced diagnostics are optional and collapsed by default.
  - Existing status polling behavior remains unchanged.
- Suggested assignee role: Frontend Developer

### P1
- File: `app/renter/register/page.tsx`
- Change: post-register CTA hierarchy prioritizes wallet funding until first positive balance.
- Acceptance criteria:
  - Primary CTA points to `/renter/billing` when balance not funded.
  - Secondary CTA keeps playground access.
  - Existing key storage/login flow remains intact.
- Suggested assignee role: Frontend Developer

- File: `app/support/page.tsx`, `app/provider/register/page.tsx`, `app/renter/register/page.tsx`
- Change: normalize conversion telemetry naming and payload schema.
- Acceptance criteria:
  - Consistent event naming convention across onboarding/support paths.
  - Events include role, page, state, and destination where relevant.
- Suggested assignee role: Frontend Developer

### P2
- File: `app/support/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`
- Change: add small role-helper modules to route users into canonical path quickly.
- Acceptance criteria:
  - Each page has at least one role-specific direct path CTA.
  - No contradictory claims about payment gateway/payout readiness.
- Suggested assignee role: Frontend Developer

## Notes / Constraints
- Do not introduce unsupported claims (no fabricated pricing/rates, no bare-metal claims).
- Preserve DCP positioning hierarchy in copy: Saudi energy advantage + Arabic AI model support + containerized execution reality.
- Keep billing language settlement-first and consistent with current platform behavior.
