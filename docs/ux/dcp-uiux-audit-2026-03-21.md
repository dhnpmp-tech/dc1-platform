# DCP UI/UX Audit and Conversion Plan (2026-03-21)

Scope audited:
- Homepage (`app/page.tsx`)
- Onboarding (`app/provider/register/page.tsx`, `app/renter/register/page.tsx`)
- Auth (`app/login/page.tsx`)
- Job submission (`app/renter/playground/page.tsx`)
- Output retrieval (`app/renter/jobs/[id]/page.tsx`)

Product-reality guardrails used:
- Positioning stays container-based GPU compute.
- No unapproved hard pricing promises added.
- Keep current 75/25 split framing already in product copy.

## Executive Summary
DCP already has strong technical depth in the renter playground and provider setup, but conversion friction remains at two moments: account-to-first-job and job-to-confidence. Competitor products (RunPod, Vast.ai, Modal, Lambda Labs) reduce friction with guided presets, progressive disclosure, and stronger result provenance. DCP can close this gap without new backend primitives by reorganizing existing UI states and making costs/eligibility clearer before submit.

## Prioritized Findings

| Priority | Flow | Finding | User Impact | Business Impact |
|---|---|---|---|---|
| P0 | Job submission | Playground has high cognitive load on first visit (many controls visible at once; weak defaults guidance). | New renters hesitate or misconfigure jobs. | Lower first-job conversion; higher support load. |
| P0 | Auth -> job | Sign-in success routes to dashboards but not to intent-aware continuation (for example, return to selected provider/model from pre-login state). | Task interruption after login. | Funnel drop before first paid job. |
| P1 | Output retrieval | Job detail/log/result screens expose raw power but weak "decision summary" (cost, duration, output quality, next action). | Users struggle to decide retry vs rerun vs export. | Reduced repeat usage and slower spend growth. |
| P1 | Onboarding | Renter register collects use case and phone but backend registration payload ignores them. | Perceived form bloat and trust friction. | Lower completion rate on mobile. |
| P2 | Homepage | CTA hierarchy still broad (provider + renter + marketplace + earn), but limited role-based pathing. | Visitors spend time deciding where to start. | Reduced top-of-funnel conversion efficiency. |

## Competitor Pattern Benchmark (Applied, not copied)

1. RunPod-style quickstart pathing: "preset first, advanced later"
- DCP adaptation: default to a 60-second starter run in Playground with one-click preset cards (LLM chat, SD image gen, container template).

2. Vast.ai-style marketplace confidence cues
- DCP adaptation: show "best-fit provider" recommendation with rationale (VRAM fit, queue depth, recent uptime) before submit.

3. Modal/Lambda-style docs-to-execution continuity
- DCP adaptation: deep-link from docs examples into prefilled playground state (`model`, `jobType`, `template`).

4. Strong execution transparency pattern
- DCP adaptation: at completion, show a compact receipt block (duration, billed halala, provider used, retry count) above raw logs.

## Top 5 Implementation-Ready Improvements

### 1) First-Job Wizard in Playground (P0)
Objective:
- Reduce time-to-first-successful-job.

Implementation:
- File: `app/renter/playground/page.tsx`
- Add stepper at top for first-time users (detect via localStorage flag):
  1. Choose workload preset
  2. Confirm model/provider fit
  3. Submit and watch progress
- Collapse advanced controls behind "Advanced Settings" accordion until user expands.

Acceptance criteria:
- First-time user can submit with <=3 interactions after auth.
- Existing power-user controls remain available.

Impact hypothesis:
- +20% to +35% increase in first-job submit rate among new renters.

Instrumentation:
- Events: `playground_preset_selected`, `playground_advanced_expanded`, `job_submit_clicked`, `job_submit_success`.

### 2) Intent-Preserving Auth Continuation (P0)
Objective:
- Prevent funnel break between login and job submission.

Implementation:
- Files: `app/login/page.tsx`, `app/renter/playground/page.tsx`
- Before redirecting unauthenticated users, store pending intent (`provider`, `model`, `mode`, optional prompt length bucket).
- After successful renter login, route back to `/renter/playground` with restored state and highlight "ready to submit" banner.

Acceptance criteria:
- User selecting provider/model before login sees same selections restored post-login.

Impact hypothesis:
- -25% abandonment from auth wall to first submit.

Instrumentation:
- Events: `auth_wall_entered`, `auth_intent_restored`, `first_submit_after_login`.

### 3) Submission Readiness Panel (P1)
Objective:
- Make cost and eligibility transparent before submit.

Implementation:
- File: `app/renter/playground/page.tsx`
- Add fixed pre-submit panel showing:
  - Estimated cost range (halala/SAR)
  - Current queue estimate
  - Balance sufficiency state
  - Provider recommendation and fallback
- Disable submit with exact cause + direct CTA (for example `Top up balance`).

Acceptance criteria:
- No disabled submit button without explicit reason text and recovery action.

Impact hypothesis:
- -30% failed/abandoned submit attempts; +10% paid conversion from balance alerts.

Instrumentation:
- Events: `submit_blocked_reason`, `topup_cta_clicked_from_playground`, `submit_after_block_resolution`.

### 4) Result Summary + Next Best Action (P1)
Objective:
- Improve confidence and repeat usage after output generation.

Implementation:
- Files: `app/renter/jobs/[id]/page.tsx`, `app/renter/playground/page.tsx`
- Add "Job Summary" card above logs/output with:
  - Status, total duration, billed cost, model/image metadata, provider GPU
  - Action buttons: `Retry with same params`, `Run cheaper/faster variant`, `Export output`
- Keep raw logs as secondary tab.

Acceptance criteria:
- Completed jobs always show summary card without scrolling.

Impact hypothesis:
- +15% to +25% repeat-job rate within same session.

Instrumentation:
- Events: `job_summary_viewed`, `retry_from_summary`, `variant_run_clicked`, `output_exported`.

### 5) Onboarding Form Tightening + Data Integrity (P1)
Objective:
- Remove unnecessary friction and align captured data with persisted data.

Implementation:
- File: `app/renter/register/page.tsx`
- Option A (fast): visually mark non-persisted fields as optional profile enrichment and defer to post-signup profile step.
- Option B (preferred): send `useCase` and `phone` to backend if route supports extension; otherwise remove from initial form.
- Add immediate post-registration next-step checklist: "top up", "open playground", "run starter template".

Acceptance criteria:
- Registration form fields match backend-persisted payload or clearly indicate optional deferred metadata.

Impact hypothesis:
- +8% to +15% registration completion; faster activation to first job.

Instrumentation:
- Events: `register_field_focus`, `register_submit`, `register_success`, `post_signup_checklist_action`.

## Flow-Specific Notes

Homepage:
- Strength: Strong positioning and clear two-sided CTAs.
- Gap: Too many equal-weight links for first-time visitors.
- Recommendation: add role selector chips above CTAs ("I have GPUs" vs "I need compute") and dim non-selected path.

Provider onboarding:
- Strength: Good status-step visualization and installer guidance.
- Gap: step labels are useful, but there is no expected-time estimate per step.
- Recommendation: add expected-time hints and troubleshooting links per step state.

Auth:
- Strength: Supports email and API-key modes with proper normalized errors.
- Gap: admin flow shares page complexity with renter/provider.
- Recommendation: hide admin mode behind explicit switch link to reduce cognitive noise for primary cohorts.

Job submission:
- Strength: Feature-rich controls, queue insights, template support.
- Gap: first experience is dense and not strongly opinionated.
- Recommendation: progressive disclosure + presets + readiness panel.

Output retrieval:
- Strength: live logs and execution history are strong for advanced users.
- Gap: lacks high-level decision support for mainstream users.
- Recommendation: summary-first layout and recommended next action.

## Suggested Issue Breakdown (for immediate execution)
1. `feat(ux): first-job wizard + advanced accordion in playground`
2. `feat(ux): auth intent persistence and post-login continuation`
3. `feat(ux): submission readiness panel with explicit blocker reasons`
4. `feat(ux): job result summary card + next best actions`
5. `refactor(ux): renter register form field alignment with persisted data`

