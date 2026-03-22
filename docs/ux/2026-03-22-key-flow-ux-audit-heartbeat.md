# DCP UX Audit — Key Flow Heartbeat (2026-03-22)

Owner: UI/UX Specialist (Codex)
Date: 2026-03-22 UTC
Scope: Homepage, onboarding, auth, job submission, output retrieval

## Benchmark Snapshot (Top Competitor Patterns)

Validated on 2026-03-22 from official docs:

1. Vast.ai quickstart uses a strict first-run checklist: `Sign Up & Add Credit -> Prepare to Connect -> Pick a Template & Find a Machine -> Manage or End`.
Source: https://docs.vast.ai/documentation/get-started/quickstart

2. Runpod endpoint UX clearly separates sync vs async and exposes lifecycle operations (`/run`, `/runsync`, `/status`, `/stream`, `/retry`, `/cancel`) in one place.
Source: https://docs.runpod.io/serverless/endpoints/send-requests

3. Replicate makes output monitoring legible with explicit SSE event taxonomy (`output`, `error`, `done`) and terminal states.
Source: https://replicate.com/docs/topics/predictions/streaming

4. Lambda keeps activation centered on one control plane action path from `Instances page` to `Launch in the Cloud IDE`.
Source: https://docs.lambda.ai/public-cloud/on-demand/getting-started/

## Flow Audit (Current DCP)

### 1) Homepage (`app/page.tsx`)

Observed:
- Strong content depth, but first viewport has many parallel choices and dense blocks.
- Differentiators (Saudi energy-cost advantage + Arabic model support) are present in ecosystem copy but not consistently locked as first-screen decision framing.

UX risk:
- Cognitive branching before user commits to renter vs provider path.

### 2) Onboarding (`app/renter/register/page.tsx`, `app/provider/register/page.tsx`)

Observed:
- Both flows collect data and show API key success states.
- Provider post-submit state still exposes multiple actions/diagnostics at once.

UX risk:
- Provider drop-off between registration and first heartbeat due to command + status complexity.

### 3) Auth (`app/login/page.tsx`)

Observed:
- Supports API key and OTP with role switching.
- Path is functional but role/method combinations still create choice friction for first-time users.

UX risk:
- First-login abandonment from decision overload when user is unsure which mode to choose.

### 4) Job Submission (`app/jobs/submit/page.tsx`, `app/renter/playground/page.tsx`)

Observed:
- Canonical redirect to playground is correct.
- Playground is powerful, but final submit confidence block can be clearer at point-of-action.

UX risk:
- Users submit with uncertain expectations about hold, model-provider fit, and completion path.

### 5) Output Retrieval (`app/renter/jobs/page.tsx`, `app/renter/jobs/[id]/page.tsx`)

Observed:
- Strong technical surfaces: live logs (SSE), history, retry, save-template.
- Some UX copy/state framing is still implementation-oriented instead of intent-oriented.

UX risk:
- Users can see activity but may not immediately know best “next action” after completion/failure.

## Prioritized Recommendations

## P0

1. Hero decision simplification + differentiator lock
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Change: first fold should show two dominant CTAs only (Renter, Provider), with one subheadline that explicitly leads with Saudi energy-cost advantage + Arabic AI model support and confirms container-based GPU execution.
- Impact hypothesis: +10% to +18% landing-to-registration CTR.

2. Provider onboarding progressive next action
- Files: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`
- Change: only one dominant “next required action” at each stage (install -> heartbeat -> ready); collapse troubleshooting/advanced details.
- Impact hypothesis: +12% to +20% provider register-to-first-heartbeat conversion.

3. Playground pre-submit confidence strip
- Files: `app/renter/playground/page.tsx`, `app/lib/i18n.tsx`
- Change: add compact checklist above submit button (auth valid, provider online, model compatibility, estimated hold visibility, expected output type).
- Impact hypothesis: +8% to +15% submit success from users who start configuring jobs.

## P1

4. Auth mode reduction for first-time users
- Files: `app/login/page.tsx`, `app/lib/i18n.tsx`
- Change: default role-aware path from query params/intent, preselect one method, keep alternates as secondary options.
- Impact hypothesis: +6% to +12% first-attempt sign-in completion.

5. Output state to action mapping
- Files: `app/renter/jobs/[id]/page.tsx`, `app/lib/i18n.tsx`
- Change: for `completed`, prioritize `Run variation` and `Save as template`; for `failed`, prioritize `Retry with suggested adjustment` and support route.
- Impact hypothesis: +8% to +14% second-job starts from detail page.

6. Submission redirect continuity
- Files: `app/jobs/submit/page.tsx`
- Change: replace hardcoded redirect-shell colors with DCP token classes to preserve trust continuity during route handoff.
- Impact hypothesis: +3% to +6% reduction in drop during submit handoff.

## P2

7. Jobs list action hierarchy tuning
- Files: `app/renter/jobs/page.tsx`
- Change: promote highest-likelihood action by status (view output for completed, retry for failed, open logs for running).
- Impact hypothesis: +5% to +9% task completion speed in jobs dashboard.

8. Unified first-job tour cue
- Files: `app/renter/register/page.tsx`, `app/login/page.tsx`, `app/renter/playground/page.tsx`
- Change: persistent lightweight “Step 1/2/3” cue from registration -> auth -> first successful output.
- Impact hypothesis: +7% to +13% first-session activation (first successful completed job).

## Measurement Plan (14-day pre/post)

Primary funnel metrics:
- Landing CTA CTR (renter, provider separately)
- Provider register -> first heartbeat within same day
- Login attempt -> successful authenticated session
- Playground open -> job submit success
- Job detail open -> second job within 30 minutes

Quality/support metrics:
- Support tickets tagged auth confusion
- Support tickets tagged submit ambiguity
- Support tickets tagged output interpretation

Instrumentation notes:
- Reuse existing `dc1_analytics` event bus and add explicit events for pre-submit checklist pass/fail states.

## Implementation Checklist

1. P0 — Homepage fold simplification
- File path: `app/page.tsx`
- Exact change: reduce first-fold CTAs to two primary buttons; move secondary paths below fold as secondary cards.
- Acceptance criteria: first viewport shows exactly two primary intent CTAs; differentiator sentence includes Saudi energy cost + Arabic model support + container-based execution statement.
- Suggested assignee role: Frontend Developer

2. P0 — Provider progressive onboarding state
- File paths: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`
- Exact change: map each provider status to one dominant action card and hide advanced diagnostics under expandable section.
- Acceptance criteria: at any state, only one primary next action button is visible; advanced details collapsed by default.
- Suggested assignee role: Frontend Developer

3. P0 — Playground pre-submit strip
- File path: `app/renter/playground/page.tsx`
- Exact change: render a 4-5 item readiness strip directly above submit with explicit pass/fail indicators.
- Acceptance criteria: submit action shows readiness states before click; failed required checks block submit and explain remediation inline.
- Suggested assignee role: Frontend Developer

4. P1 — Auth default-path optimization
- File path: `app/login/page.tsx`
- Exact change: infer default role/method from intent params and stored role-intent; demote alternative login modes.
- Acceptance criteria: first-time flow presents one recommended login path; alternatives remain accessible but secondary.
- Suggested assignee role: Frontend Developer

5. P1 — Output next-action rail
- File path: `app/renter/jobs/[id]/page.tsx`
- Exact change: add status-conditioned action rail at top of detail content.
- Acceptance criteria: completed jobs show run-again/template actions; failed jobs show retry/support actions; running jobs emphasize logs.
- Suggested assignee role: Frontend Developer

6. P1 — Redirect shell token consistency
- File path: `app/jobs/submit/page.tsx`
- Exact change: replace hardcoded background/text hex values with existing DCP theme classes.
- Acceptance criteria: visual shell uses DCP token classes only.
- Suggested assignee role: Frontend Developer

7. P2 — Jobs list action prioritization
- File path: `app/renter/jobs/page.tsx`
- Exact change: reorder per-row CTA by job status and reduce low-value actions in primary slot.
- Acceptance criteria: each row has one dominant context-appropriate action.
- Suggested assignee role: Frontend Developer

8. P2 — First-job journey cue
- File paths: `app/renter/register/page.tsx`, `app/login/page.tsx`, `app/renter/playground/page.tsx`
- Exact change: add shared micro-stepper text component and preserve progress context across routes.
- Acceptance criteria: users can always see current journey step until first successful job completion.
- Suggested assignee role: Frontend Developer

## Product Reality Guardrails

- Keep all claims aligned with DCP reality: GPU-accelerated Docker container execution via NVIDIA Container Toolkit.
- Do not introduce unapproved pricing claims.
- Keep differentiator hierarchy explicit in first-screen messaging: Saudi energy-cost advantage first, Arabic AI support second.
