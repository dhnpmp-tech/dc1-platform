# DCP UX Audit — Key Flows Heartbeat 4 (2026-03-22)

Owner: UI/UX Specialist (Codex)
Date: 2026-03-22 UTC
Scope: Homepage, onboarding, auth, job submission, output retrieval

## Benchmark Anchors (competitor patterns to emulate)

1. Vast.ai quickstart-first onboarding reduces early branching and drives first run quickly.
2. Runpod’s explicit request lifecycle (submit -> status -> control -> logs) reduces post-submit uncertainty.
3. Replit/Together quickstarts keep first success path short, then expose advanced controls after activation.

Applied to DCP with product reality guardrails:
- Keep differentiator order fixed: Saudi energy-cost advantage -> Arabic AI support -> containerized GPU execution.
- No unapproved earnings or pricing promises.
- No bare-metal claims.

## New Code-Verified Findings

1. Homepage first-fold branch density is still high.
- File: `app/page.tsx`
- Current state: hero + mode strip + path chooser all compete in first decision zone.
- UX risk: delayed renter/provider commitment and higher bounce before registration intent.

2. Provider registration form still includes cross-persona path chooser before form completion.
- File: `app/provider/register/page.tsx`
- Current state: provider onboarding route includes renter/enterprise/Arabic docs lane cards above the registration form.
- UX risk: diversion away from core provider conversion step.

3. Login route supports role/method preselection but still presents high choice load in the default first view.
- File: `app/login/page.tsx`
- Current state: auth method and role radios are shown immediately for most entries.
- UX risk: slower first login completion, especially for redirected intents.

4. Playground readiness panel is strong but not fully task-driven in sequencing.
- File: `app/renter/playground/page.tsx`
- Current state: readiness checks, estimated cost, provider recommendation, and balance are present, but blockers are split between panel + separate primary-blocker alert.
- UX risk: duplicate cognitive parsing before submit.

5. Job detail actions are status-aware but completed-state CTA priority can be tighter for “run again” behavior.
- File: `app/renter/jobs/[id]/page.tsx`
- Current state: completed jobs show several equal visual-weight actions.
- UX risk: reduced second-job conversion from decision fatigue.

## Prioritized Recommendations

## P0 (direct conversion impact)

1. Collapse homepage first-fold to two primary persona CTAs only.
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Change: keep only renter + provider dominant actions above fold; move mode strip/path chooser below fold.
- Acceptance criteria: exactly two primary CTAs in first fold.
- KPI hypothesis: +10% to +18% landing -> registration CTR.

2. Remove path chooser from provider registration pre-form zone.
- Files: `app/provider/register/page.tsx`
- Change: move cross-lane chooser cards to footer or post-registration support area, not before form.
- Acceptance criteria: registration form is the only primary conversion target above fold.
- KPI hypothesis: +8% to +14% provider form starts; +6% to +10% form completion.

3. Convert login into intent-first defaults, choice-second pattern.
- Files: `app/login/page.tsx`
- Change: when `role` or `redirect` is present, render the inferred role/method as default path and tuck alternates in a secondary “switch method/account type” panel.
- Acceptance criteria: redirected users can submit credentials without changing role/method controls.
- KPI hypothesis: +6% to +12% successful first-attempt login.

## P1 (activation impact)

4. Merge submit blocker summary into readiness panel.
- Files: `app/renter/playground/page.tsx`
- Change: show one “Blocking checks” section at the top of readiness panel; primary blocker recovery button lives inside that same panel.
- Acceptance criteria: no separate duplicate blocker card under submit button.
- KPI hypothesis: +7% to +13% playground opened -> successful submit.

5. Promote one completed-state primary action on job detail.
- Files: `app/renter/jobs/[id]/page.tsx`
- Change: prioritize one CTA (`Retry same params` or `Run similar variant`) as visually primary, demote others to secondary/overflow.
- Acceptance criteria: completed-state action rail has one dominant CTA.
- KPI hypothesis: +8% to +14% job detail -> second job start within 30 minutes.

## P2 (trust/clarity)

6. Normalize onboarding and auth microcopy around expected next state.
- Files: `app/provider/register/page.tsx`, `app/login/page.tsx`, `app/lib/i18n.tsx`
- Change: unify “what happens next” language format (action + expected system response + fallback path).
- Acceptance criteria: same pattern across provider registration and login transitions.
- KPI hypothesis: -10% to -20% support tickets tagged onboarding/auth confusion.

## Implementation Checklist

1. Homepage first-fold simplification (P0)
- File path: `app/page.tsx`
- Exact change: keep two primary CTA cards in hero; move mode strip and path chooser sections below “How DCP works.”
- Suggested assignee: Frontend Developer.

2. Provider pre-form focus (P0)
- File path: `app/provider/register/page.tsx`
- Exact change: remove top-level path chooser block before form; relocate to optional “Explore other paths” section after successful registration.
- Suggested assignee: Frontend Developer.

3. Login intent-first rendering (P0)
- File path: `app/login/page.tsx`
- Exact change: if `role` query exists, pre-lock role until user clicks “switch account type.” Keep method toggle collapsed by default when redirect intent exists.
- Suggested assignee: Frontend Developer.

4. Readiness + blocker merge (P1)
- File path: `app/renter/playground/page.tsx`
- Exact change: integrate `primaryBlocker` state into readiness panel header and remove standalone blocker card under submit button.
- Suggested assignee: Frontend Developer.

5. Job-detail action hierarchy (P1)
- File path: `app/renter/jobs/[id]/page.tsx`
- Exact change: keep one primary button by status; move remaining actions into secondary row/menu.
- Suggested assignee: Frontend Developer.

6. Unified microcopy pattern (P2)
- File path: `app/lib/i18n.tsx`
- Exact change: add shared copy tokens for “next action / expected result / fallback”.
- Suggested assignee: Copywriter + Frontend Developer.

## Measurement Plan (14-day pre/post)

Primary metrics:
- Landing CTA click-through by persona.
- Provider register page view -> successful registration.
- Login start -> successful authenticated session.
- Playground open -> successful submit.
- Job detail view -> second submit in 30 minutes.

Secondary diagnostics:
- Support volume tagged `auth`, `onboarding`, `submission blockers`.
- Median time-to-first-job from renter registration.

## Guardrails

- Maintain truthful container-based execution messaging.
- No unapproved pricing or income outcome claims.
- Keep Saudi energy-cost advantage and Arabic model support as headline differentiators.
