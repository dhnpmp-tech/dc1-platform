# DCP UX Audit — Live Journey Friction, Drop-off Risks, and Quick Wins (2026-03-22 16:08 UTC)

Owner: UX Researcher / Competitive Analyst

## Scope
- Renter journey: signup -> playground -> submit -> monitor/results
- Provider journey: registration -> daemon install -> status -> earnings handoff
- Support page flow and escalation UX
- Mobile responsiveness risk scan on key flows

## Evidence and Method
- Live route checks (publicly reachable):
  - https://dcp.sa/
  - https://dcp.sa/renter/register
  - https://dcp.sa/renter/playground
  - https://dcp.sa/provider/register
  - https://dcp.sa/support
- Code-level verification for authenticated/interactive flows:
  - `app/renter/register/page.tsx`
  - `app/renter/playground/page.tsx`
  - `app/renter/jobs/page.tsx`
  - `app/renter/jobs/[id]/page.tsx`
  - `app/provider/register/page.tsx`
  - `app/provider/page.tsx`
  - `app/provider/download/page.tsx`
  - `app/support/page.tsx`
  - `app/components/layout/Header.tsx`
  - `app/components/layout/DashboardSidebar.tsx`
  - `app/components/layout/DashboardLayout.tsx`
- Competitor benchmark context reused from prior evidence-backed reports:
  - `docs/research/dcp-489-competitor-ux-refresh-2026-03-21.md`
  - `docs/research/dcp-532-onboarding-support-friction-validation-2026-03-22.md`

Note: this environment cannot capture visual browser screenshots for authenticated client-rendered screens. Findings reference route/code evidence directly.

## Findings (Ranked)

### P0-1: Support form can show a successful state even when API submission fails
- Evidence:
  - `app/support/page.tsx` posts to `/api/dc1/support/contact`.
  - On non-OK or catch, it sets `status='sent'` and launches `mailto:` fallback.
  - Backend route inventory under `backend/src/routes/` has no support route.
- Drop-off risk:
  - Users believe a ticket is submitted when it may not be persisted.
  - Trust breaks for enterprise and provider onboarding escalations.

### P0-2: Provider download page likely contains broken Linux/macOS install paths
- Evidence:
  - `app/provider/download/page.tsx` Linux command: `https://dcp.sa/api/dc1/providers/daemon/linux | bash`
  - macOS command: `https://dcp.sa/install-mac.sh | bash`
  - Canonical backend routes in instructions/code use `/providers/download/setup?key=...&os=...` and `/providers/download/daemon?key=...` patterns.
- Drop-off risk:
  - Provider acquisition fails after intent if install command is invalid or inconsistent.

### P0-3: Renter job detail still has significant hardcoded English and non-localized system copy
- Evidence:
  - `app/renter/jobs/[id]/page.tsx` includes hardcoded strings like `Cost Breakdown`, `Quoted Cost`, `Execution Attempts`, `Connecting...`, `Download full log`.
- Drop-off risk:
  - EN/AR parity breaks in critical post-payment monitoring stage.
  - Arabic-first users lose confidence after job submission.

### P1-1: Playground error state exposes stack traces to end users
- Evidence:
  - `app/renter/playground/page.tsx` `PlaygroundErrorBoundary` renders full `error.stack` and component stack.
- Drop-off risk:
  - Technical noise increases fear during first-job attempts.
  - Can leak implementation details while giving no recovery hierarchy.

### P1-2: Provider registration success state remains cognitively dense
- Evidence:
  - `app/provider/register/page.tsx` success flow combines API key, multiple install commands, reachability checks, status tracker, support routes, and next-action matrix in one long page.
- Drop-off risk:
  - Too many concurrent decisions before first heartbeat confirmation.

### P1-3: Renter dashboard unauthenticated gate forces API-key-only fallback instead of canonical login
- Evidence:
  - `app/renter/page.tsx` non-auth path renders local API key form directly.
  - Other flows already support `/login` email OTP with role-aware redirects.
- Drop-off risk:
  - Split auth mental model across renter entrypoints.
  - New users can hit a dead end if they do not already have a key.

### P2-1: Mobile dense tables and dual fixed bars create high scroll/space pressure
- Evidence:
  - `DashboardLayout` adds `mt-14` while `DashboardSidebar` adds fixed mobile topbar; content density is still high on `renter/jobs` tables and log panels.
  - Job list/detail pages rely on table-first patterns with many columns and action controls.
- Drop-off risk:
  - Reduced scannability for mobile-first operators and renters.

## Journey Notes

### Renter Journey
- Strengths:
  - Good post-register checklist and support routing in `app/renter/register/page.tsx`.
  - Canonicalization of legacy `/jobs` routes is in place (`app/jobs/page.tsx`, `app/jobs/[id]/monitor/page.tsx`).
- Friction points:
  - Auth inconsistency between renter surfaces.
  - Monitoring/output layer still partially English-only.
  - Error UX in playground is too developer-facing.

### Provider Journey
- Strengths:
  - State machine logic (`waiting/heartbeat/ready/paused/stale`) exists in `app/provider/register/page.tsx`.
  - Polling lifecycle cleanup is present.
- Friction points:
  - Install/download command consistency risk between provider pages.
  - Success-state information overload.

### Support Journey
- Strengths:
  - Category-prefill and scenario tiles align with role-intent.
- Friction points:
  - Submission transport truthfulness gap (API vs mail fallback).

## Mobile Responsiveness Risk Scan
- High risk:
  - `app/renter/jobs/[id]/page.tsx` log/history cards and job detail density on narrow screens.
  - `app/renter/jobs/page.tsx` table-first layout with many columns/actions.
- Medium risk:
  - Provider registration success page vertical overload and long command blocks.
- Lower risk:
  - Header + intent switcher generally responsive and clear (`app/components/layout/Header.tsx`).

## Top 5 Quick Wins (This Week)

1. `P0` Support submission truthfulness
- Impact: Very high
- Effort: Medium
- Change: split API success from fallback state; never show "sent" unless API accepted or user confirms external mail client action.

2. `P0` Fix provider download command correctness
- Impact: Very high
- Effort: Small
- Change: align Linux/macOS commands in `app/provider/download/page.tsx` with real backend endpoints and key-injection pattern.

3. `P0` Localize renter job detail and monitor strings
- Impact: High
- Effort: Medium
- Change: move remaining hardcoded strings in `app/renter/jobs/[id]/page.tsx` into `app/lib/i18n.tsx`.

4. `P1` Replace playground stack-trace UI with recovery-focused copy
- Impact: High
- Effort: Small/Medium
- Change: keep technical details internal (console/log only), show user-safe error category + next action CTA.

5. `P1` Progressive disclosure in provider success state
- Impact: High
- Effort: Medium
- Change: keep one next action visible by state; collapse diagnostics under "Advanced troubleshooting".

## Competitor-Pattern Alignment (Applied)
- Vast.ai / RunPod pattern: first decision should be explicit and low-ambiguity. DCP should keep one dominant next action per state.
- Lambda / Together pattern: trust + enterprise path should be explicit and truthful at support handoff points.
- Replit pattern: reduce setup anxiety with simple recovery paths; avoid exposing implementation stacks to first-run users.

## Implementation Checklist

### P0
1. File paths:
- `app/support/page.tsx`
- `backend/src/routes/support.js` (new)
- `backend/src/server.js`
- Change:
- Add real `POST /api/support/contact` route and distinguish `sent_api` vs `sent_fallback` states in UI.
- Acceptance criteria:
- UI never implies API ticket creation unless API returns success.
- JSON error convention respected: `{ "error": "..." }`.
- Suggested assignee: Backend Architect + Frontend Developer

2. File paths:
- `app/provider/download/page.tsx`
- `app/provider/register/page.tsx`
- Change:
- Unify install command URLs with canonical backend download endpoints and API key flow.
- Acceptance criteria:
- Linux/Windows/macOS commands are valid and testable from page copy.
- Suggested assignee: Frontend Developer

3. File paths:
- `app/renter/jobs/[id]/page.tsx`
- `app/lib/i18n.tsx`
- Change:
- Localize all remaining user-facing English strings in job detail/log/history panels.
- Acceptance criteria:
- EN/AR parity in job monitoring view.
- Suggested assignee: Frontend Developer

### P1
4. File paths:
- `app/renter/playground/page.tsx`
- Change:
- Replace stack-trace rendering with user-safe error messaging and recovery CTA hierarchy.
- Acceptance criteria:
- No raw stack shown in UI.
- Error state always offers actionable next step.
- Suggested assignee: Frontend Developer

5. File paths:
- `app/provider/register/page.tsx`
- Change:
- Make success view state-driven with progressive disclosure; default to one primary action.
- Acceptance criteria:
- First screen after registration has one dominant CTA tied to onboarding state.
- Suggested assignee: Frontend Developer

### P2
6. File paths:
- `app/renter/jobs/page.tsx`
- `app/renter/jobs/[id]/page.tsx`
- `app/components/layout/DashboardLayout.tsx`
- Change:
- Mobile-optimized list/cards and reduced-density detail sections for <768px.
- Acceptance criteria:
- No horizontal overflow in primary monitoring content on mobile.
- Key job status/actions remain visible without deep scrolling.
- Suggested assignee: Frontend Developer

