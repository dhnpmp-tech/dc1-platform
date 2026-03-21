# DCP UI/UX Delta Audit — 2026-03-21 (Heartbeat)

Owner: UI/UX Specialist (Codex)
Scope: Homepage, onboarding, auth, job submission, output retrieval.

## Context and Benchmark
- Code-reviewed current flows in:
  - `app/page.tsx`
  - `app/provider/register/page.tsx`
  - `app/renter/register/page.tsx`
  - `app/login/page.tsx`
  - `app/jobs/submit/page.tsx`
  - `components/jobs/JobSubmitForm.tsx`
  - `components/jobs/JobMonitor.tsx`
  - `app/renter/jobs/[id]/page.tsx`
- Benchmarked against repeatedly effective competitor UX patterns already documented in project research:
  - Vast: clear mode/billing framing (on-demand/reserved/interruptible)
  - RunPod: explicit mode split and direct start path
  - Lambda: self-serve plus enterprise path separation

## Priority Findings (Delta)

### P0 — Auth persistence mismatch breaks submit flow continuity
- Problem:
  - `app/login/page.tsx` stores renter key in `localStorage` (`dc1_renter_key`).
  - `components/jobs/JobSubmitForm.tsx` reads only `sessionStorage` for the same key.
  - Result: users can log in successfully, then still hit "Authentication Required" in job submit.
- UX impact:
  - Adds unnecessary re-auth step at a high-intent conversion moment.
- Impact hypothesis:
  - Reduce submit-flow drop-off by 10-20% for renter sessions that arrive from `/login`.

### P0 — Legacy `/jobs/*` path competes with renter-native journey
- Problem:
  - Submit flow redirects to `/jobs/{id}/monitor` (legacy monitor surface), while renter dashboard uses `/renter/jobs/{id}`.
  - Two parallel IA paths increase user confusion and split analytics.
- UX impact:
  - Weakens mental model and complicates support/debug instructions.
- Impact hypothesis:
  - Increase successful first output retrieval rate by 8-15% by consolidating to a single renter job-detail path.

### P1 — Visual/system inconsistency in job submission and monitor surfaces
- Problem:
  - `app/jobs/submit/page.tsx` and `components/jobs/JobSubmitForm.tsx` still use legacy styling tokens (`#FFD700`, `#1a1a1a`) and non-dashboard shell.
  - Renter pages use shared `DashboardLayout` and design tokens.
- UX impact:
  - Context switch reduces trust and makes product feel stitched together.
- Impact hypothesis:
  - Improve task confidence and reduce support tickets about "wrong page" by 5-10%.

### P1 — Provider onboarding install reliability risk
- Problem:
  - Success page install command hardcodes `https://api.dcp.sa/...` in `app/provider/register/page.tsx`.
  - If API domain setup is incomplete or differs by environment, first-run install can fail.
- UX impact:
  - High-friction failure in provider activation funnel.
- Impact hypothesis:
  - Improve provider activation completion (register -> first heartbeat) by 10-25%.

### P2 — Missing explicit next-step CTA after submit for renter-native route
- Problem:
  - Job submit currently hard-redirects; no persistent success state with explicit options (view logs vs back to jobs).
- UX impact:
  - Users lose orientation after submission.
- Impact hypothesis:
  - Reduce "where is my result" confusion and increase logs-tab engagement by 10%.

## Implementation Checklist

| Priority | File(s) | Exact Change | Acceptance Criteria | Suggested Assignee |
|---|---|---|---|---|
| P0 | `components/jobs/JobSubmitForm.tsx` | Read renter key from `localStorage` first, then `sessionStorage` fallback; on success, persist to both stores. | Renter who logs in via `/login` reaches submit form without extra login prompt. | Frontend Developer |
| P0 | `components/jobs/JobSubmitForm.tsx` | Replace post-submit redirect to `/jobs/{id}/monitor` with `/renter/jobs/{id}` when renter context exists. | New submissions consistently land on renter job detail page. | Frontend Developer |
| P0 | `app/jobs/[id]/monitor/page.tsx`, `app/jobs/submit/page.tsx` | Add canonical redirects to renter-native equivalents (or deprecate route with clear redirect logic). | No duplicate user journey for output retrieval in renter flow. | Frontend Developer |
| P1 | `app/jobs/submit/page.tsx`, `components/jobs/JobSubmitForm.tsx` | Migrate to shared dashboard shell/tokens (`DashboardLayout`, `dc1-*` tokens), remove legacy hardcoded palette. | Submit page visually aligns with renter dashboard and passes mobile checks. | Frontend Developer |
| P1 | `app/provider/register/page.tsx` | Generate install endpoint from runtime API base/env (with fallback) instead of hardcoded `api.dcp.sa`; add explicit error/help note if unreachable. | Provider copy command matches active backend environment and is testable. | Founding Engineer |
| P2 | `components/jobs/JobSubmitForm.tsx` | Add compact success handoff state before redirect (job id, next actions: View logs, Back to jobs). | Users have explicit next-step choices immediately after submission. | Frontend Developer |

## Measurement Plan
- Funnel events to compare before/after:
  - `login_success -> submit_page_auth_ok -> job_submitted -> job_detail_viewed`
- Core metrics:
  - Auth re-prompt rate on submit page
  - Time from job submit to first job-detail view
  - Provider register-to-heartbeat activation rate

