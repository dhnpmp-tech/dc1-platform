# DCP Competitive Segment + Funnel Messaging Report — Heartbeat 10 (2026-03-23)

Owner: UX Researcher / Competitive Analyst (Codex)
Date: 2026-03-23 UTC
Scope: Competitor UX/messaging patterns (official pages), DCP segment mapping, and conversion-focused copy/IA recommendations aligned with containerized GPU compute.

## Evidence Snapshot (Official Sources Checked 2026-03-23)

1. Vast.ai (`https://vast.ai/`)
- Leads with marketplace framing and transparent-pricing language.
- First-path activation is direct and utility-first rather than brand-heavy.

2. Runpod (`https://www.runpod.io/`)
- Nav taxonomy is workload/product-first (`Cloud GPUs`, `Serverless`, `Clusters`, `Hub`).
- Hero and mid-page repeat one activation path (`Get started`) and a clear workflow sequence.

3. Lambda (`https://lambda.ai/`, `https://docs.lambda.ai/public-cloud/on-demand/`)
- Front page keeps self-serve launch and sales-assisted route distinct.
- Conversion is supported by practical on-demand docs close to launch intent.

4. Akash (`https://akash.network/deploy/`)
- Deploy page is action-first (`Deploy Now`/console launch), followed by workflow resources.
- Emphasizes template-driven deploy flows and status visibility.

5. Together AI (`https://www.together.ai/`, `https://docs.together.ai/`)
- Strong platform positioning (`AI Native Cloud`) with immediate build CTA.
- Product IA separates inference/compute/model-shaping while still preserving a single start action.

6. Replit (`https://replit.com/`)
- Outcome-first onboarding language with immediate build intent prompts.
- Low-friction first action is prioritized over deep technical explanation.

## Competitor Pattern Matrix (What Repeats)

1. One dominant first action per intent
- All six surfaces prioritize a single forward action in hero or first nav layer.

2. Workload-first IA
- Navigation categories map to user jobs (inference, deploy, train, serverless), not internal org structure.

3. Tight first-success ladder
- Fast path is explicit: sign up -> launch/deploy -> run -> verify output.

4. Proof close to CTA
- Trust signals appear adjacent to activation buttons, not buried in later sections.

## DCP Target Segment Map (Priority Order)

1. Segment A (P0): Saudi startups shipping AI features
- Core decision trigger: first usable workload in minutes with predictable operating economics.
- Positioning lead: Saudi energy-cost advantage (structural), then simple launch path.
- Primary pages: `app/page.tsx`, `app/renter/register/page.tsx`, `app/renter/playground/page.tsx`, `app/login/page.tsx`.

2. Segment B (P0): Arabic-first AI builders
- Core decision trigger: confidence that Arabic model workflows are first-class.
- Positioning lead: Arabic AI model support after cost advantage.
- Primary pages: `app/page.tsx`, `app/renter/marketplace/page.tsx`, `app/docs/quickstart/page.tsx`, `app/docs/api/page.tsx`.

3. Segment C (P1): MENA enterprise evaluators
- Core decision trigger: clear support/escalation lane and platform-operability trust.
- Positioning lead: operational clarity and responsible platform messaging (no unverified SLA claims).
- Primary pages: `app/page.tsx`, `app/support/page.tsx`, `app/legal/privacy/page.tsx`, `app/terms/page.tsx`.

4. Segment D (P0 supply-side): NVIDIA GPU providers with idle capacity
- Core decision trigger: lowest-friction path from registration to first heartbeat and ready state.
- Positioning lead: explicit onboarding state machine with one next action.
- Primary pages: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`, `app/provider/page.tsx`.

## DCP Code-Verified Friction (Current Branch)

1. Homepage still presents extra early choice load
- File: `app/page.tsx`
- Evidence: `modeStripItems` and `pathChooserLanes` remain in the primary discovery surface.

2. Provider onboarding supports strong states, but still shows competing support/action surfaces
- File: `app/provider/register/page.tsx`
- Evidence: `nextActionState` is robust (`waiting|heartbeat|stale|paused|ready`) while status matrix/support lanes remain highly visible.

3. Login helper rows are informative but not conversion-dominant
- File: `app/login/page.tsx`
- Evidence: `helperRows` exists, but no compact role-outcome strip directly tied to submit action.

4. Submit redirect is efficient but lacks a first-success expectation cue
- File: `app/jobs/submit/page.tsx`
- Evidence: redirect shell shows generic title/message before handoff to `/renter/playground`.

## Conversion Recommendations (Actionable)

### P0 — Segment-led hero architecture (Renter/Provider only above fold)
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Keep exactly two primary CTA buttons in first fold: renter start and provider start.
  - Move `modeStripItems` and `pathChooserLanes` below a concise trust block.
  - Enforce message order: Saudi energy-cost advantage -> Arabic AI support -> containerized execution reliability.
- Acceptance criteria:
  - First fold has exactly two primary action buttons.
  - No fabricated pricing/savings claims.
  - No bare-metal claims.
- Suggested assignee role: Frontend Developer + Copywriter.

### P0 — Provider onboarding: one dominant next action per state
- Files:
  - `app/provider/register/page.tsx`
  - `app/lib/provider-install.ts`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Render one primary CTA per `nextActionState`.
  - Place troubleshooting/support under collapsed secondary section except `stale`/error states.
- Acceptance criteria:
  - `waiting`, `heartbeat`, `ready`, `paused`, `stale` each expose one visually dominant next step.
  - State mapping remains aligned with `/api/providers/me` fields.
- Suggested assignee role: Frontend Developer.

### P0 — Login conversion strip with role destination and value
- Files:
  - `app/login/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add dynamic strip above submit: role-specific destination plus one truthful outcome statement.
- Acceptance criteria:
  - Destination updates for renter/provider/admin selection.
  - No backend/auth API changes.
- Suggested assignee role: Frontend Developer + Copywriter.

### P1 — Renter first-success ladder across redirect + playground
- Files:
  - `app/jobs/submit/page.tsx`
  - `app/renter/playground/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add 3-step ladder in redirect shell and pinned playground onboarding rail until first completed job.
- Acceptance criteria:
  - New renter can follow one continuous path to first completed job.
  - Onboarding rail hides after first successful completion.
- Suggested assignee role: Frontend Developer.

### P1 — Unify Arabic AI proof module as reusable conversion block
- Files:
  - `app/page.tsx`
  - `app/renter/marketplace/page.tsx`
  - `app/docs/quickstart/page.tsx`
  - `app/docs/api/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Reuse one copy block naming supported Arabic-focused models and linking to workflow docs.
- Acceptance criteria:
  - Same proof text pattern appears across all listed surfaces.
  - No unsupported model-performance claims.
- Suggested assignee role: Frontend Developer + Copywriter + Docs Engineer.

### P2 — Enterprise trust lane normalization
- Files:
  - `app/page.tsx`
  - `app/support/page.tsx`
  - `app/legal/privacy/page.tsx`
  - `app/terms/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Standardize one enterprise-help CTA label and one canonical destination flow.
- Acceptance criteria:
  - Trust/legal/support surfaces use consistent CTA text and destination.
  - No promises beyond current platform capabilities.
- Suggested assignee role: Frontend Developer + Copywriter.

## Measurement Plan (Post-Implementation)

1. Hero CTA click-through by segment intent
- Event: `landing_primary_cta_click` (renter/provider)

2. Provider activation funnel
- Events: `provider_register_success` -> `provider_onboarding_state_seen(state=heartbeat|ready)`

3. Login completion by role
- Events: `login_submit(role, method)` -> `login_redirect_reached`

4. Renter first-job completion
- Events: first `playground_session_start` -> first `job_completed` within 24h

## Guardrails

- Never invent pricing, savings percentages, or earnings claims.
- Never claim bare-metal GPUs; DCP execution is containerized with NVIDIA Container Toolkit.
- Keep differentiator order fixed: Saudi energy-cost advantage -> Arabic AI support -> containerized reliability.
