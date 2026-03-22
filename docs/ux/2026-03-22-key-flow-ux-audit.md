# DCP UX Audit — Key Flows (2026-03-22)

Owner: UI/UX Specialist (Codex)
Scope: Homepage, onboarding, auth, job submission, and output retrieval
Date: 2026-03-22 (UTC)

## Benchmark Signals (Competitor Patterns)

1. Runpod guides users through endpoint creation with explicit deployment source selection, GPU configuration, and endpoint URL handoff in one flow.
Source: https://docs.runpod.io/serverless/endpoints/overview

2. Vast.ai QuickStart breaks first use into clear steps (`Sign Up & Add Credit` -> `Prepare to Connect` -> `Pick a Template & Find a Machine` -> `Manage or End`).
Source: https://docs.vast.ai/documentation/get-started/quickstart

3. Replicate documents a predictable output-stream lifecycle (`stream` URL, SSE events, terminal events), reducing ambiguity during job monitoring.
Source: https://replicate.com/docs/topics/predictions/streaming

4. Lambda onboarding docs center execution around a single console control plane (Instances page + Cloud IDE launch), which reduces navigation branching.
Source: https://docs.lambda.ai/public-cloud/on-demand/getting-started/

## Current-State Audit (DCP)

### What is already strong

- `app/jobs/submit/page.tsx` now redirects to the canonical renter playground flow.
- `app/login/page.tsx` includes a role/method/destination helper matrix.
- `app/renter/jobs/[id]/page.tsx` has retry/export/template actions and live log stream support.

### Highest-impact gaps

1. Homepage value hierarchy is still diffuse.
- `app/page.tsx` has many concurrent hero/support signals, and key differentiators can be diluted by secondary blocks.

2. Provider onboarding post-register state remains command-heavy.
- `app/provider/register/page.tsx` success state presents multiple commands/checks at once; advanced diagnostics are surfaced early.

3. Playground error UX can expose technical stack output.
- `app/renter/playground/page.tsx` error boundary prints raw error stack in user-facing UI.

4. Submission confidence cues are incomplete at decision moment.
- `app/renter/playground/page.tsx` has useful controls but lacks a compact “pre-flight summary row” just before submit (selected provider, model fit, hold estimate, auth state).

5. Output page still mixes localized and hardcoded English status/microcopy.
- `app/renter/jobs/[id]/page.tsx` stream states and several labels are hardcoded instead of i18n-backed.

## Prioritized Recommendations

## P0

1. Tighten homepage first-screen messaging hierarchy.
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Change: make one primary renter CTA and one provider CTA the first decision block; move differentiator sentence (Saudi energy advantage + Arabic AI support + container-based execution) directly under hero title.
- Impact hypothesis: +12% to +20% landing -> registration CTA click-through.

2. Replace raw crash detail with safe recovery UX in playground.
- Files: `app/renter/playground/page.tsx`, `app/lib/i18n.tsx`
- Change: keep technical error telemetry in console/logging only, show user-safe fallback copy with retry and “open support/docs” actions.
- Impact hypothesis: -20% to -35% session abandonment after runtime UI errors.

3. Add pre-submit “flight check” strip in playground.
- Files: `app/renter/playground/page.tsx`, optional shared component under `app/components/`
- Change: show ready/not-ready checks for provider selection, job type/model compatibility, estimated hold, and renter auth before submit button.
- Impact hypothesis: +8% to +15% submit success rate from started forms.

## P1

4. Convert provider success panel into progressive checklist with one dominant next action.
- Files: `app/provider/register/page.tsx`, `app/lib/i18n.tsx`
- Change: default to current required step only (register -> run installer -> verify heartbeat -> ready), collapse advanced diagnostics behind "Troubleshoot".
- Impact hypothesis: +10% to +18% provider onboarding completion (heartbeat seen within first session).

5. Localize remaining output-stream and action microcopy.
- Files: `app/renter/jobs/[id]/page.tsx`, `app/lib/i18n.tsx`
- Change: move hardcoded labels (`Connecting...`, `Live`, `Disconnected`, retry helper text) into i18n keys.
- Impact hypothesis: +5% to +10% improvement in non-English flow completion and lower confusion in bilingual support tickets.

6. Align hardcoded surface colors with DCP design tokens.
- Files: `app/jobs/submit/page.tsx`, `app/login/page.tsx`, `app/renter/playground/page.tsx`
- Change: replace one-off hex backgrounds with design-token classes to keep flow continuity.
- Impact hypothesis: +3% to +7% reduction in bounce across redirects between legacy compatibility routes and canonical flows.

## P2

7. Add explicit post-output "iterate next" rail for completed jobs.
- Files: `app/renter/jobs/[id]/page.tsx`
- Change: after completion, prioritize three intent actions in order: `Run variation`, `Save template`, `Run on higher GPU tier`.
- Impact hypothesis: +8% to +14% second-job initiation from completed job detail views.

8. Add onboarding progress breadcrumb from login to first runnable action.
- Files: `app/login/page.tsx`, `app/renter/playground/page.tsx`, `app/provider/register/page.tsx`
- Change: compact cross-flow breadcrumb in each entry surface to reduce context switching.
- Impact hypothesis: +6% to +10% improvement in first-session task completion.

## Implementation Checklist

### P0 (execute first)

1. `app/page.tsx` + `app/lib/i18n.tsx`
- Acceptance criteria:
  - Hero first viewport has one renter CTA + one provider CTA as primary actions.
  - Hero support line includes Saudi energy-cost advantage and Arabic model support.
  - Messaging states container-based execution (no bare-metal claim).

2. `app/renter/playground/page.tsx` + `app/lib/i18n.tsx`
- Acceptance criteria:
  - End-user error state does not render raw stack traces.
  - Retry action and support/docs handoff are visible in error boundary.

3. `app/renter/playground/page.tsx`
- Acceptance criteria:
  - Submit area shows provider/auth/model-fit/hold readiness checks.
  - Submit button remains disabled if mandatory checks fail.

### P1

4. `app/provider/register/page.tsx` + `app/lib/i18n.tsx`
- Acceptance criteria:
  - Only one recommended next action is visually dominant at each step.
  - Advanced diagnostics are collapsed by default.

5. `app/renter/jobs/[id]/page.tsx` + `app/lib/i18n.tsx`
- Acceptance criteria:
  - Stream status and job action copy is fully i18n-backed.
  - No hardcoded English state labels remain in core job-status surfaces.

6. `app/jobs/submit/page.tsx`, `app/login/page.tsx`, `app/renter/playground/page.tsx`
- Acceptance criteria:
  - Hardcoded hex colors are replaced by design tokens/classes.
  - Redirected users see consistent visual shell across flow steps.

### P2

7. `app/renter/jobs/[id]/page.tsx`
- Acceptance criteria:
  - Completed state displays iterate-next action rail above logs/metadata.

8. `app/login/page.tsx`, `app/renter/playground/page.tsx`, `app/provider/register/page.tsx`
- Acceptance criteria:
  - Each page shows a compact step breadcrumb with current step highlighted.

## Measurement Plan (14-day pre/post)

- Landing -> renter register CTA CTR
- Landing -> provider register CTA CTR
- Login success on first attempt by role
- Playground form started -> job submitted
- Provider register success -> first heartbeat received
- Job detail view -> second job started within 30 minutes

## Product-Reality Guardrails

- Keep claims aligned to container-based GPU compute (NVIDIA Container Toolkit), not bare-metal claims.
- Do not introduce unapproved pricing guarantees.
- Maintain differentiator priority in first-screen messaging: Saudi energy-cost advantage and Arabic AI model support.
