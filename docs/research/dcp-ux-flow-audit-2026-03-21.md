# DCP UX Flow Audit (Homepage, Onboarding, Auth, Job Submit, Output Retrieval)

Date: 2026-03-21 UTC  
Owner: UI/UX Specialist (Codex)

## Scope
- Evaluated core flows in code:
  - `app/page.tsx` (homepage)
  - `app/provider/register/page.tsx` (provider onboarding)
  - `app/renter/register/page.tsx` (renter onboarding)
  - `app/login/page.tsx` (auth)
  - `components/jobs/JobSubmitForm.tsx` + `app/jobs/submit/page.tsx` (job submission)
  - `app/renter/jobs/[id]/page.tsx` + `app/renter/playground/page.tsx` (output retrieval / monitoring)
- Benchmarked UX patterns against competitor public pages (Vast, RunPod, Lambda, Together, Akash, Replit).
- Guardrail: messaging aligned to current product reality (container-based GPU compute, browser playground, no unsupported pricing guarantees).

## Competitive UX patterns (what repeatedly works)
1. Product-mode clarity at top of funnel (fast path vs advanced path)
   - RunPod splits experience into Pods / Serverless / Clusters with immediate "Get started" actions.
   - Together explicitly ladders Serverless → Dedicated.
2. Pricing transparency at decision points
   - Vast and RunPod expose pricing structures early and prominently.
   - Lambda separates on-demand vs reserved clearly.
3. Low-friction first run and plan progression
   - Replit-style progression (start free, then scale) reduces early commitment anxiety.
4. Strong runtime confidence signals
   - Competitors surface availability/performance framing near conversion moments.

## Current funnel issues found in DCP code
1. Homepage intent split exists but is too late in flow.
   - The "Two Ways to Use GPU Compute" section appears below hero, not as primary decision control.
2. Auth/session persistence is inconsistent between flows.
   - Login stores renter key in `localStorage`, while submit flow reads only `sessionStorage`.
3. Submission flow has trust friction.
   - `ratePerHourSar` is hardcoded (`0.38`) in matching GPU cards instead of backend-driven price data.
4. Output retrieval has strong log stream but weak guided next actions.
   - Good live logs, but limited "what to do next" branch (retry/template/export/share endpoint) after completion/failure.
5. Nav wording is internal and ambiguous for new users.
   - "Compute" and "Supply" are less explicit than renter/provider intent labels.

## Prioritized recommendations (implementation-ready)

### P0 — Do now (high impact, low/medium effort)
1. Make renter path choice the first hero decision
- Change:
  - Add two side-by-side hero cards immediately under H1:
    - `Playground (browser-first)`
    - `Container Jobs (bring your Docker image)`
  - Keep provider CTA as secondary row.
- Files:
  - `app/page.tsx`
- Impact hypothesis:
  - +12% to +20% click-through from homepage to renter activation routes (`/renter/register`, `/renter/playground`).
- Metrics:
  - `hero_cta_click_rate`, `renter_register_start_rate`, `playground_entry_rate`.

2. Fix auth persistence mismatch across login and submit flows
- Change:
  - Standardize renter key read/write to both `localStorage` and `sessionStorage` in auth and submit paths.
  - On login success, persist both stores; on logout, clear both.
- Files:
  - `app/login/page.tsx`
  - `components/jobs/JobSubmitForm.tsx`
  - `app/renter/page.tsx` (consistency check)
- Impact hypothesis:
  - -25% to -40% drop in "Authentication Required" interruptions on submit page for already logged-in users.
- Metrics:
  - `job_submit_auth_gate_shown`, `job_submit_abandon_before_post`, `login_to_submit_conversion`.

3. Replace hardcoded submit pricing with backend-provided values
- Change:
  - Extend `/api/renters/available-providers` payload with authoritative price fields if missing.
  - Render those values in submit matching GPU list and cost estimate panel.
- Files:
  - `components/jobs/JobSubmitForm.tsx`
  - `backend/src/routes/renters.js` (if field expansion needed)
- Impact hypothesis:
  - +8% to +15% job submit completion due to higher price trust.
- Metrics:
  - `submit_form_complete_rate`, `pricing_tooltip_open_rate`, `submit_error_rate_budget`.

### P1 — Next sprint (medium impact, medium effort)
1. Add billing clarity module in onboarding + submit
- Change:
  - Reusable "How billing works" block:
    - quote estimate in halala
    - hold at submission
    - settle on actual runtime
    - auto-refund unused hold
  - Link to billing docs.
- Files:
  - `app/page.tsx`
  - `app/renter/register/page.tsx`
  - `app/jobs/submit/page.tsx` and/or `components/jobs/JobSubmitForm.tsx`
- Impact hypothesis:
  - -15% pre-submit abandonment where users hesitate on pricing uncertainty.
- Metrics:
  - `billing_info_expand_rate`, `submit_after_billing_info_view`, `register_to_first_job_time`.

2. Rename public nav labels to explicit intent
- Change:
  - `Compute` → `Rent GPUs`
  - `Supply` → `Earn with GPUs`
  - Keep `Docs`, add `Marketplace` and `Support` at desktop widths.
- Files:
  - `app/components/layout/Header.tsx`
  - `app/components/layout/Footer.tsx`
- Impact hypothesis:
  - +10% nav-driven conversion from first-time visitors.
- Metrics:
  - `nav_click_distribution`, `first_session_route_depth`, `bounce_rate_home`.

3. Add first-job guided checklist after renter registration success
- Change:
  - On success card add checklist:
    - Save API key
    - Open playground OR submit container job
    - Track status page
  - Deep links to exact next screens.
- Files:
  - `app/renter/register/page.tsx`
- Impact hypothesis:
  - +15% to +25% first-session activation (first job within same day).
- Metrics:
  - `renter_register_to_first_job_24h`, `success_screen_cta_click_rate`.

### P2 — Polish and retention (medium impact, medium/high effort)
1. Outcome-driven completion panel in job detail
- Change:
  - For completed jobs: actions for `Download output`, `Copy endpoint`, `Re-run with edits`, `Save as template`.
  - For failed jobs: primary `Retry` plus contextual error guidance.
- Files:
  - `app/renter/jobs/[id]/page.tsx`
  - `app/renter/playground/page.tsx`
- Impact hypothesis:
  - +10% repeat usage per active renter.
- Metrics:
  - `job_detail_action_click_rate`, `retry_rate`, `second_job_within_7d`.

2. Provider onboarding trust module
- Change:
  - On provider success page, add explicit "what daemon does" + heartbeat interval + pause/resume control and payout caveat language.
- Files:
  - `app/provider/register/page.tsx`
  - `app/earn/page.tsx`
- Impact hypothesis:
  - +8% provider setup completion (registration → first heartbeat).
- Metrics:
  - `provider_register_to_first_heartbeat`, `provider_setup_dropoff_step2/3`.

## Code anchors (for quick implementation)
- Hero CTA structure + path split location: `app/page.tsx`
- Ambiguous public nav labels: `app/components/layout/Header.tsx`
- Auth persistence mismatch:
  - login writes localStorage: `app/login/page.tsx`
  - submit flow reads sessionStorage only: `components/jobs/JobSubmitForm.tsx`
- Hardcoded submit pricing signal: `components/jobs/JobSubmitForm.tsx` (`ratePerHourSar: 0.38`)
- Output log streaming foundation to extend: `app/renter/jobs/[id]/page.tsx`

## Suggested KPI dashboard (minimum)
- `home_to_register_ctr`
- `register_to_first_job_24h`
- `job_submit_completion_rate`
- `auth_gate_interrupt_rate`
- `job_detail_reuse_actions_rate`

## Sources
- Vast pricing docs: https://docs.vast.ai/documentation/instances/pricing
- RunPod pricing: https://www.runpod.io/pricing
- Lambda pricing: https://lambda.ai/pricing
- Together pricing: https://www.together.ai/pricing
- Akash homepage: https://akash.network/
- Replit pricing: https://replit.com/pricing
