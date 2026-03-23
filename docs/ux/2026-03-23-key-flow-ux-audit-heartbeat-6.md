# DCP Key-Flow UX Audit — Heartbeat 6 (2026-03-23)

Owner: UI/UX Specialist (Codex)  
Date: 2026-03-23 UTC  
Scope: Homepage, onboarding, auth, job submission, and output retrieval (code-verified).

## Benchmark Snapshot (Competitor UX Patterns)

Reference patterns used (from prior verified competitor scans):
- Vast.ai: marketplace-first discovery and filtering depth before account friction.
- Runpod: high-trust first fold with clear launch path and role-specific entry points.
- Lambda: stepwise onboarding that reduces cognitive load by exposing only the next action.
- Together AI: "first successful request" framing with compact quickstart path.

Implication for DCP:
- Keep first action singular by role.
- Keep trust proof visible but compact near CTAs.
- Optimize time-to-first-success (first registered account, first submitted job, first retrieved output).

## Code-Verified Findings

1. Landing first fold still carries multiple navigation constructs immediately after the primary CTAs.
- File: `app/page.tsx`
- Evidence: hero includes primary renter/provider CTAs, then both `modeStripItems` and `pathChooserLanes` appear high on page.
- Risk: higher decision latency for new users.

2. Provider onboarding has strong status logic but presents many optional routes during activation.
- File: `app/provider/register/page.tsx`
- Evidence: state tracking (`waiting`, `heartbeat`, `stale`, `paused`, `ready`) exists; path chooser lanes remain visible in registration surface.
- Risk: fewer providers completing daemon install -> first heartbeat.

3. Login is functionally robust but role-value framing remains tabular/helper oriented.
- File: `app/login/page.tsx`
- Evidence: `helperRows` describe auth mode + destination, but no dominant role-specific outcome statement near submit action.
- Risk: lower completion for first-time users selecting account type.

4. Playground submit flow has strong blocker handling, but blocker explanations are not elevated into a persistent preflight checklist.
- File: `app/renter/playground/page.tsx`
- Evidence: `submitBlockers` and analytics events exist; blockers appear mainly when submission is attempted.
- Risk: repeated failed submit attempts before correction.

5. Job detail/output retrieval is rich (overview/logs/history, export/copy), but the post-completion "next step" is weak.
- File: `app/renter/jobs/[id]/page.tsx`
- Evidence: tabs and export logic are present; no explicit guided branch after completion (retry with same params, save template, run in marketplace at scale).
- Risk: lower second-job conversion after first successful output.

## Prioritized Recommendations

### P0

1. Reduce first-fold decision density on landing.
- Keep only two dominant actions in first fold (`/renter/register`, `/provider/register`).
- Move `modeStripItems` and `pathChooserLanes` one section lower.
- Keep messaging order fixed: Saudi energy-cost advantage -> Arabic AI support -> container-based execution.

2. Enforce one dominant CTA per provider onboarding state.
- For each state (`waiting`, `heartbeat`, `stale`, `paused`, `ready`), render one primary next action and demote support links.

3. Add role-outcome promise line in login form area.
- Renter: submit first workload quickly.
- Provider: connect daemon and start earning after heartbeat.
- Admin: monitor operations and incidents.

### P1

4. Add visible preflight checklist in playground before submit.
- Persist top 3 blockers (auth key, online provider, model/provider compatibility) before user clicks submit.

5. Add post-output action rail on job detail.
- After completion, show one-click actions: retry same params, save as template, open playground prefilled.

6. Harmonize trust microcopy between landing and marketplace.
- Reuse concise proof language for reliability freshness and Arabic model readiness.

### P2

7. Add "time-to-first-success" progress meter across renter onboarding.
- Register -> login -> submit -> output retrieved.

8. Improve provider stale-state recovery copy.
- Add exact recovery instruction string for heartbeat stale/offline transitions.

## Measurable Impact Hypotheses

- H1: Landing first-fold simplification improves renter/provider CTA click-through by 8-15%.
- H2: State-specific provider CTA focus improves registration-to-first-heartbeat completion by 10-20%.
- H3: Login role-outcome copy improves successful auth completion by 5-10%.
- H4: Playground preflight checklist reduces blocked submit events by 20-30%.
- H5: Post-output action rail increases same-session second-job starts by 12-20%.

## Implementation Checklist

1. P0 — Landing first-fold simplification
- Specific file paths to modify:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes needed:
  - Keep only renter/provider primary CTA cluster in first fold.
  - Move mode strip and path chooser below trust/proof section.
  - Keep differentiator order in first fold copy.
- Acceptance criteria:
  - Exactly two primary first-fold CTA buttons.
  - No pricing/earnings fabrication.
  - No bare-metal wording; containerized execution language retained.
- Suggested assignee role: Frontend Developer + Copywriter.

2. P0 — Provider state-driven CTA focus
- Specific file paths to modify:
  - `app/provider/register/page.tsx`
  - `app/lib/provider-install.ts`
  - `app/lib/i18n.tsx`
- Exact changes needed:
  - Map each onboarding state to one dominant primary action button.
  - Keep diagnostics/troubleshooting links tertiary except error states.
- Acceptance criteria:
  - One primary CTA visible per provider state.
  - State transitions remain consistent with `/api/providers/me` status values.
- Suggested assignee role: Frontend Developer.

3. P0 — Login role-outcome framing
- Specific file paths to modify:
  - `app/login/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes needed:
  - Add concise outcome copy block that updates with selected role.
  - Keep current auth mechanics and endpoints unchanged.
- Acceptance criteria:
  - Role-specific outcome text updates correctly for renter/provider/admin.
  - Existing OTP/API key flows unaffected.
- Suggested assignee role: Frontend Developer + Copywriter.

4. P1 — Playground preflight checklist
- Specific file paths to modify:
  - `app/renter/playground/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes needed:
  - Surface blocker checks persistently before submit button.
  - Convert first blocker into clear remediation CTA.
- Acceptance criteria:
  - User can resolve blockers without firing submit.
  - `playground_submit_blocked_reason` event volume drops after release.
- Suggested assignee role: Frontend Developer.

5. P1 — Job detail post-output action rail
- Specific file paths to modify:
  - `app/renter/jobs/[id]/page.tsx`
  - `app/renter/playground/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes needed:
  - Add action rail shown on completed jobs with output.
  - Include deep link with prefilled parameters for replay.
- Acceptance criteria:
  - Completed jobs show at least 2 clear next-step actions.
  - Action clicks tracked in analytics events.
- Suggested assignee role: Frontend Developer.

6. P2 — Provider stale-state recovery microcopy
- Specific file paths to modify:
  - `app/provider/register/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes needed:
  - Add explicit stale-heartbeat remediation copy (service check, daemon restart, heartbeat wait window).
- Acceptance criteria:
  - Stale/offline states show actionable instructions without leaving page.
- Suggested assignee role: Frontend Developer + Copywriter.

## Guardrails

- Do not claim bare-metal GPU execution.
- Do not invent pricing, discounts, or earnings rates.
- Preserve DCP top-line positioning in this order:
  1. Saudi energy-cost advantage
  2. Arabic AI model support
  3. Containerized GPU execution reliability
