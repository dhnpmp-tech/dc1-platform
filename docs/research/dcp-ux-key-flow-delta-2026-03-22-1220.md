# DCP UI/UX Key Flow Delta Audit (2026-03-22 12:20 UTC)

Owner: UI/UX Specialist  
Scope: homepage -> auth -> onboarding -> job submit -> job output retrieval  
Benchmark set: RunPod, Vast.ai, Lambda (public UX surfaces referenced in prior DCP research docs)

## Executive Delta
Recent fixes improved path clarity, but three conversion-critical gaps remain:
1. Legacy `/jobs` surfaces still use session-only renter auth checks, while canonical auth is localStorage-first.
2. Legacy monitor route can still render a non-canonical UI instead of always handing off to `/renter/jobs/[id]`.
3. Legacy jobs/monitor pages are stylistically and language-wise inconsistent with DCP bilingual product surfaces.

These gaps primarily hurt post-auth continuity and output retrieval confidence.

## Competitive Pattern Reference
1. RunPod and Lambda keep one canonical execution path per persona (reduced branching after auth).
2. Vast.ai keeps post-submit state transitions explicit in one route family (pricing/monitor confidence).
3. Best-in-class surfaces avoid dual legacy/public monitor UIs once users are authenticated.

## Prioritized Recommendations

### P0-1: Canonicalize legacy job monitor handoff (auth continuity)
- Files:
  - `app/jobs/[id]/monitor/page.tsx`
  - `app/jobs/page.tsx`
- Current gap:
  - Both routes check `sessionStorage` for `dc1_renter_key`, but login/register store renter key in `localStorage`.
  - This can fail to detect authenticated renters and leave them on legacy pages.
- Exact change:
  1. Read renter key from `localStorage` first, with `sessionStorage` fallback.
  2. If renter key exists, always redirect to `/renter/jobs/[id]` (monitor) or `/renter/jobs` (jobs index).
  3. If admin token exists on `/jobs`, redirect to `/admin/jobs`; otherwise keep current public fallback behavior.
- Impact hypothesis:
  - Reduce authenticated renter dead-end views on legacy `/jobs*` by >=80% within one release.
- Suggested instrumentation:
  - `legacy_jobs_handoff_started`
  - `legacy_jobs_handoff_completed`
  - `legacy_jobs_handoff_failed`
- Suggested assignee role: Frontend Developer

### P0-2: Remove dual monitor UX for renters (single output retrieval path)
- Files:
  - `app/jobs/[id]/monitor/page.tsx`
  - `components/jobs/JobMonitor.tsx` (if legacy kept internally)
- Current gap:
  - `/jobs/[id]/monitor` can still render legacy `JobMonitor` page instead of canonical renter job detail.
- Exact change:
  1. Convert `/jobs/[id]/monitor` into redirect-only shell for renter traffic.
  2. Preserve legacy monitor component only for internal/admin contexts, not renter journey.
  3. Add explicit fallback copy + CTA to `/login?role=renter&redirect=/renter/jobs/{id}` for unauthenticated users.
- Impact hypothesis:
  - Increase output retrieval success (job detail page reached after submit) by 15-25%.
- Suggested instrumentation:
  - `job_monitor_redirected_to_renter_detail`
  - `job_monitor_login_required`
- Suggested assignee role: Frontend Developer

### P1-1: Align legacy `/jobs` pages with bilingual/i18n and design system
- Files:
  - `app/jobs/page.tsx`
  - `app/jobs/[id]/monitor/page.tsx`
  - `app/lib/i18n.tsx`
- Current gap:
  - Hardcoded English UI text and non-DCP visual styling persist in legacy routes.
- Exact change:
  1. Move user-facing strings into i18n keys with EN/AR parity.
  2. Replace legacy color tokens with DCP design tokens used in renter/admin dashboards.
  3. Add route-level note that these are compatibility paths, with canonical navigation links.
- Impact hypothesis:
  - Reduce confusion-driven bounce from legacy pages by 10-15%.
- Suggested instrumentation:
  - `legacy_jobs_notice_seen`
  - `legacy_jobs_canonical_cta_clicked`
- Suggested assignee role: Frontend Developer

## Implementation Checklist
1. `P0` auth continuity patch on legacy `/jobs*` routes.
- File paths: `app/jobs/page.tsx`, `app/jobs/[id]/monitor/page.tsx`
- Acceptance criteria: authenticated renter always lands on canonical renter jobs surfaces regardless of storage origin.

2. `P0` monitor route canonicalization.
- File paths: `app/jobs/[id]/monitor/page.tsx`, optional `components/jobs/JobMonitor.tsx`
- Acceptance criteria: no renter sees legacy monitor as primary output retrieval UI.

3. `P1` i18n + design alignment for compatibility routes.
- File paths: `app/jobs/page.tsx`, `app/jobs/[id]/monitor/page.tsx`, `app/lib/i18n.tsx`
- Acceptance criteria: no hardcoded user-facing English on these routes; EN/AR parity preserved.

## Guardrails
1. No bare-metal wording (execution is container-based).
2. No fabricated savings, pricing, or payout timing claims.
3. Keep Saudi energy advantage + Arabic AI model support as differentiators where marketing copy is touched.
