# DCP Competitive IA + Conversion Teardown — Heartbeat 8 (2026-03-23)

Owner: UX Researcher / Competitive Analyst (Codex)
Date: 2026-03-23 UTC
Scope: Competitor conversion/IA patterns (official pages only), DCP code-verified UX gaps, and implementation-ready proposals.

## Evidence Snapshot (Official Sources, checked 2026-03-23)

1. Vast.ai (`https://vast.ai/`)
- Hero promise combines speed + pricing transparency in one block: “Instant GPUs. Transparent Pricing.” and a single “Get Started” CTA.
- Early “How It Works” sequence is explicit (Add Credit -> Search GPUs -> Deploy) and conversion-oriented.

2. Runpod (`https://www.runpod.io/`)
- Top nav and product taxonomy are workload-first (`Cloud GPUs`, `Serverless`, `Clusters`, `Hub`).
- Messaging repeatedly uses single-flow framing (“Go from idea to deployment in a single flow”) with repeated “Get started” CTA.

3. Lambda (`https://lambda.ai/`)
- Hero anchors one high-intent action (`Launch GPU instance`) beside enterprise route (`Talk to our team`).
- IA blends conversion + proof (`Pricing`, `LLM index`, `GPU benchmarks`, customer stories).

4. Akash (`https://akash.network/deploy/`)
- Deploy page is task-first: immediate console launch + docs path.
- Copy focuses on deployment control and status visibility rather than broad brand claims.

5. Together AI (`https://www.together.ai/`, `https://docs.together.ai/docs/quickstart`)
- Homepage keeps platform framing (“AI Native Cloud”) with direct build CTA.
- Docs quickstart defines a strict first-success ladder: account -> install -> first query.

6. Replit (`https://replit.com/`)
- Hero prompt asks intent directly (“What will you build?”), then provides concrete starter paths.
- Product framing stays outcome-first (“Turn ideas into apps in minutes”).

## DCP Code-Verified Gaps (Current)

1. Homepage still presents extra early choice load before commitment.
- File: `app/page.tsx`
- Evidence: `modeStripItems` and `pathChooserLanes` are still present in primary discovery flow.

2. Provider onboarding already has state modeling, but secondary routing still competes with next action.
- File: `app/provider/register/page.tsx`
- Evidence: strong `nextActionState` exists for `waiting|heartbeat|stale|paused|ready`, but status matrix/support routes remain prominent in the same view.

3. Login role helper exists, but pre-submit role outcome value can be more explicit.
- File: `app/login/page.tsx`
- Evidence: `helperRows` table is present; no short high-contrast role-outcome strip immediately tied to submit action.

4. Arabic-model proof exists in marketplace/docs, but proof framing is not normalized as one reusable conversion unit across all renter entry points.
- Files: `app/renter/marketplace/page.tsx`, `app/docs/quickstart/page.tsx`, `app/page.tsx`

## Conversion Heuristics To Apply In DCP

1. One hero, one primary action per intent
- Keep renter and provider as only first-fold actions on homepage.
- Defer diagnostic/alternate paths until after intent commitment.

2. First-success path in 3-4 steps
- Mirror quickstart-style sequence consistently: authenticate -> submit -> monitor -> fetch output.

3. Proof near action, not buried
- Place Saudi energy-cost advantage + Arabic AI support directly adjacent to primary CTA zones.

4. Enterprise trust lane without clutter
- Keep an always-available enterprise/support CTA, but avoid competing with activation CTA hierarchy.

## Implementation Checklist

1. P0 — Homepage decision simplification
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Keep exactly two first-fold primary CTAs (Renter, Provider).
  - Move `modeStripItems` + `pathChooserLanes` below primary trust proof block.
  - Preserve differentiator order: Saudi energy-cost advantage -> Arabic AI support -> containerized execution reliability.
- Acceptance criteria:
  - First fold has two primary actions only.
  - No fabricated pricing/ROI values.
  - No bare-metal claims.
- Suggested assignee: Frontend Developer + Copywriter

2. P0 — Provider onboarding action hierarchy cleanup
- Files:
  - `app/provider/register/page.tsx`
  - `app/lib/provider-install.ts`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Keep one dominant CTA per `nextActionState`.
  - Collapse matrix/support affordances under expandable “Need help?” panel for non-error states.
- Acceptance criteria:
  - `waiting`, `heartbeat`, `ready`, `paused`, `stale` each show one visually dominant next step.
  - Status transitions remain aligned with backend provider status semantics.
- Suggested assignee: Frontend Developer

3. P0 — Login conversion strip by role
- Files:
  - `app/login/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add a concise role outcome strip above submit button that updates with selected role.
- Acceptance criteria:
  - Distinct truthful value statement for renter/provider/admin.
  - No auth API contract changes.
- Suggested assignee: Frontend Developer + Copywriter

4. P1 — Reusable Arabic AI proof module
- Files:
  - `app/page.tsx`
  - `app/renter/marketplace/page.tsx`
  - `app/docs/quickstart/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Create shared proof block copy/component and reuse across discovery + docs surfaces.
- Acceptance criteria:
  - Consistent model-support messaging on all listed surfaces.
  - No unsupported performance/accuracy claims.
- Suggested assignee: Frontend Developer + Copywriter

5. P1 — Quickstart-first lifecycle reinforcement
- Files:
  - `app/docs/quickstart/page.tsx`
  - `app/docs/api/page.tsx`
  - `app/renter/playground/page.tsx`
- Exact changes:
  - Add fixed lifecycle rail linking auth, submit, monitor, and output retrieval.
- Acceptance criteria:
  - New renter can execute first workload path with minimal navigation hops.
- Suggested assignee: Docs Engineer + Frontend Developer

## Guardrails

- Do not publish invented pricing/savings/earnings figures.
- Do not claim bare-metal GPUs; DCP runs containerized GPU execution.
- Keep positioning order fixed:
  1. Saudi energy-cost advantage
  2. Arabic AI model support
  3. Container-based execution reliability
