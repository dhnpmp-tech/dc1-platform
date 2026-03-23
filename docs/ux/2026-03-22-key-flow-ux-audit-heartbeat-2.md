# DCP UX Audit — Key Flow Heartbeat 2 (2026-03-22)

Owner: UI/UX Specialist (Codex)
Date: 2026-03-22 UTC
Scope: Homepage, onboarding, auth, job submission, output retrieval

## Benchmark Snapshot (Competitor UX Patterns)

Reviewed against competitor docs and product surfaces on 2026-03-22:

1. Vast.ai quickstart uses a strict first-run sequence and reduces branch choices in early steps.
Source: https://docs.vast.ai/documentation/get-started/quickstart

2. Runpod endpoint UX keeps submit lifecycle explicit in one place (run, status, stream, retry, cancel) which lowers uncertainty after submit.
Source: https://docs.runpod.io/serverless/endpoints/send-requests

3. Replicate output streaming clearly communicates state transitions (stream updates, terminal done/error states) to reduce output ambiguity.
Source: https://replicate.com/docs/topics/predictions/streaming

4. Lambda Cloud keeps launch actions centralized so “start workload now” is always visible.
Source: https://docs.lambda.ai/public-cloud/on-demand/getting-started/

## Code-Verified Findings by Flow

### 1) Homepage (`app/page.tsx`)

Observed:
- Homepage contains strong trust and differentiator content but has many concurrent pathways before commitment.
- Path chooser, mode strip, trust modules, and explainer sections compete in the first scan sequence.

Risk:
- High-intent users may delay renter/provider commitment due to choice density.

### 2) Onboarding (`app/renter/register/page.tsx`, `app/provider/register/page.tsx`)

Observed:
- Registration success states are information-rich and technically complete.
- Provider success view surfaces commands, diagnostics, state matrix, and support links together.

Risk:
- Provider activation drops between "got key" and "first heartbeat" due to multi-action cognitive load.

### 3) Auth (`app/login/page.tsx`)

Observed:
- Auth supports OTP and API key, plus role selection.
- Users must still pick role + method up front even when intent is recoverable from route context.

Risk:
- First-time login friction, especially for renters redirected from submit/playground intent.

### 4) Job Submission (`app/renter/playground/page.tsx`, `app/jobs/submit/page.tsx`)

Observed:
- Submission guardrails exist (`submitBlockers`, readiness checks) and are technically strong.
- Readiness signal is present but not prioritized as a compact pre-submit confidence panel.
- Redirect shell (`/jobs/submit`) is functional and intentionally transitional.

Risk:
- Users may still feel uncertain about what blocks submission and what output they should expect.

### 5) Output Retrieval (`app/renter/jobs/page.tsx`, `app/renter/jobs/[id]/page.tsx`)

Observed:
- Strong capabilities: live logs, retry, save-template, export.
- Some post-result actions are evenly weighted instead of status-prioritized.

Risk:
- Slower “next step” decisions after success/failure reduces second-job conversion.

## Prioritized Recommendations

## P0 (direct conversion impact)

1. Reduce first-fold decision surface to one primary CTA per persona
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Recommendation: make first fold renter/provider commitment dominant; move secondary pathways below fold. Keep differentiator headline order fixed: Saudi energy cost advantage first, Arabic AI model support second, container-based execution clarification.
- Hypothesis: +10% to +18% landing -> registration CTR.

2. Convert provider success view into progressive single-action onboarding
- Files: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`
- Recommendation: show one required next action by state (`waiting`, `heartbeat`, `stale`, `paused`, `ready`) and collapse diagnostics by default.
- Hypothesis: +12% to +20% provider registration -> first heartbeat completion.

3. Promote explicit pre-submit confidence strip in playground
- Files: `app/renter/playground/page.tsx`, `app/lib/i18n.tsx`
- Recommendation: render mandatory readiness checks above submit with clear pass/fail and one-click recovery actions; keep blocker reason copy localized.
- Hypothesis: +8% to +15% submit success among users who open playground.

## P1 (activation and retention impact)

4. Role-intent aware auth defaulting
- Files: `app/login/page.tsx`, `app/lib/role-intent.ts`, `app/lib/i18n.tsx`
- Recommendation: preselect role/method from `redirect`, stored role intent, and auth wall context; keep alternatives secondary, not equal weight.
- Hypothesis: +6% to +12% first-attempt successful sign-in.

5. Status-conditioned next-action rail on job detail
- Files: `app/renter/jobs/[id]/page.tsx`, `app/lib/i18n.tsx`
- Recommendation: top rail should adapt by job status:
  - completed -> `Run variation`, `Save template`, `Export`
  - failed -> `Retry`, `Suggested fix`, `Contact support`
  - running -> `Live logs`, `Expected completion state`
- Hypothesis: +8% to +14% second-job starts from job detail.

6. Jobs list action hierarchy by status
- Files: `app/renter/jobs/page.tsx`
- Recommendation: elevate one dominant CTA per row based on status (completed=view output, failed=retry, running=open logs).
- Hypothesis: +5% to +9% faster task completion from jobs table.

## P2 (consistency and trust continuity)

7. Make transitional submit redirect fully tokenized and copy-consistent
- Files: `app/jobs/submit/page.tsx`, `app/lib/i18n.tsx`
- Recommendation: ensure transitional shell copy and visual tokens align with primary renter journey language and styling.
- Hypothesis: +3% to +6% fewer abandonments during `/jobs/submit -> /renter/playground` handoff.

8. Standardize post-registration journey cue across renter flow
- Files: `app/renter/register/page.tsx`, `app/login/page.tsx`, `app/renter/playground/page.tsx`
- Recommendation: shared micro-step indicator (Register -> Authenticate -> Submit -> Retrieve output) persisted until first completed job.
- Hypothesis: +7% to +13% first-session activation (first completed workload).

## Implementation Checklist (Actionable)

1. P0 — Homepage commitment-first fold
- File path: `app/page.tsx`
- Exact change: keep hero with two dominant persona actions; defer mode-strip/path chooser cards lower.
- Acceptance criteria: above-fold interaction offers exactly two primary choices; differentiator copy order preserved.
- Suggested assignee role: Frontend Developer.

2. P0 — Provider progressive onboarding
- File path: `app/provider/register/page.tsx`
- Exact change: state machine maps to one primary CTA and one collapsed “advanced diagnostics” block.
- Acceptance criteria: each provider state renders a single “next action” button; diagnostics hidden by default.
- Suggested assignee role: Frontend Developer.

3. P0 — Playground confidence strip
- File path: `app/renter/playground/page.tsx`
- Exact change: move readiness checks adjacent to submit CTA with fail reasons and direct recover actions.
- Acceptance criteria: required blockers are visible before submit; each blocker has explicit recovery affordance.
- Suggested assignee role: Frontend Developer.

4. P1 — Intent-aware login defaults
- File path: `app/login/page.tsx`
- Exact change: infer role/method from redirect context and stored intent; reduce initial controls shown.
- Acceptance criteria: redirected renter intent lands on renter-auth default without extra mode decisions.
- Suggested assignee role: Frontend Developer.

5. P1 — Job detail next-action rail
- File path: `app/renter/jobs/[id]/page.tsx`
- Exact change: inject status-driven action rail above detail tabs.
- Acceptance criteria: action priority differs by `completed`, `failed`, and `running` states.
- Suggested assignee role: Frontend Developer.

6. P1 — Jobs table primary action ranking
- File path: `app/renter/jobs/page.tsx`
- Exact change: show one primary action + optional overflow actions per row by status.
- Acceptance criteria: no row shows ambiguous equal-priority actions.
- Suggested assignee role: Frontend Developer.

7. P2 — Redirect continuity
- File path: `app/jobs/submit/page.tsx`
- Exact change: align message and visual semantics with renter playground flow language.
- Acceptance criteria: redirect page uses same journey language and DCP design tokens.
- Suggested assignee role: Frontend Developer.

8. P2 — Cross-flow journey cue
- File paths: `app/renter/register/page.tsx`, `app/login/page.tsx`, `app/renter/playground/page.tsx`
- Exact change: add shared lightweight journey indicator component.
- Acceptance criteria: indicator persists until first successful job completion.
- Suggested assignee role: Frontend Developer.

## Measurement Plan (14-day pre/post)

Primary metrics:
- Landing persona CTA click-through rate.
- Provider register -> first heartbeat within 24h.
- Login started -> authenticated session success.
- Playground open -> successful submit.
- Job detail view -> second submit within 30 minutes.

Secondary diagnostics:
- Support tickets tagged login confusion.
- Support tickets tagged submission blockers.
- Support tickets tagged output interpretation confusion.

Instrumentation note:
- Reuse existing `dc1_analytics` event bus; add explicit events for readiness-strip pass/fail and status-rail clicks.

## Product Reality Guardrails

- Keep claims accurate: GPU-accelerated Docker container execution via NVIDIA Container Toolkit.
- Do not add unapproved pricing claims.
- Keep first-screen differentiator order stable: Saudi energy-cost advantage first, Arabic AI support second.
