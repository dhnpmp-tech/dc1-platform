# DCP UI/UX Heartbeat Deliverable — Key Flow Benchmark + Implementation Plan (2026-03-22 22:30 UTC)

Owner: UI/UX Specialist  
Scope audited in code: homepage, onboarding, auth, job submission, output retrieval

## Benchmark Inputs (Top Competitor UX Patterns)
- Runpod Pods docs: linear first-run sequence (choose pod -> deploy -> connect), template-led start, one primary action per stage.  
  Source: https://docs.runpod.io/pods/overview
- Vast.ai marketplace model: strong marketplace-first filtering and explicit supply-side attributes before action.  
  Source: https://vast.ai/
- Together AI docs/console pattern: fast path from model selection to first request with clear API/runtime handoff.  
  Source: https://docs.together.ai/

## Current DCP Delta (What still hurts conversion/trust)

### 1) Homepage has too many equal-weight CTAs in above-the-fold and near-fold blocks
- Observed in: `app/page.tsx`
- Problem: renter/provider/enterprise/docs/marketplace/earn/log-in actions are all visually strong, increasing decision friction.
- Competitor delta: Runpod/Together funnel users through one clear “start” action, then branch.
- Impact hypothesis: reducing primary CTA count to one per section should improve first-click-through to registration/playground by 8-15%.

### 2) Onboarding success states mix “next step” and “all options” without strong priority ordering
- Observed in: `app/renter/register/page.tsx`, `app/provider/register/page.tsx`
- Problem: post-register surfaces present multiple cards/routes with similar weight; first-job/install action is not dominant enough.
- Competitor delta: first-run pages prioritize exactly one continuation action, secondary links are de-emphasized.
- Impact hypothesis: stronger single-next-step hierarchy should improve register->first-action completion by 10-18%.

### 3) Auth page mode-role matrix is accurate but cognitively dense on first visit
- Observed in: `app/login/page.tsx`
- Problem: email/API key toggle + role radio + helper matrix appears at once; novice users parse auth mechanics before intent completion.
- Competitor delta: Together-style first prompt asks intent first, then shows only required auth fields.
- Impact hypothesis: progressive disclosure should reduce auth bounce by 6-12%.

### 4) Playground first-run path still reads as “power user” before first success
- Observed in: `app/renter/playground/page.tsx`
- Problem: dense form layout appears quickly; first-job presets exist but compete with advanced controls and rich surface area.
- Competitor delta: successful competitors keep a guided “first request” lane before exposing all controls.
- Impact hypothesis: a guided first-run lane should increase submit success rate on first session by 12-22%.

### 5) Output retrieval is strong technically but “share/export next actions” are not elevated for completed jobs
- Observed in: `app/renter/jobs/[id]/page.tsx`
- Problem: logs/history/output are comprehensive, but “what to do next” (retry template/save/share/new run) is secondary.
- Competitor delta: post-run states in leading tools emphasize immediate continuation actions.
- Impact hypothesis: elevating completion CTAs should improve repeat job submission within same session by 8-16%.

## Prioritized Implementation Checklist

### P0
1. Homepage CTA sequencing and hierarchy
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Exact changes:
  - Keep one primary CTA in hero per selected role intent.
  - Convert remaining hero CTAs to secondary text links.
  - In mode strip and path chooser, keep enterprise/docs links visually secondary to renter/provider start actions.
- Acceptance criteria:
  - Hero has one visually dominant CTA at any time.
  - EN/AR copy remains parity-complete (no hardcoded English).
  - Analytics includes event fields for primary vs secondary CTA clicks.
- Suggested assignee role: Frontend Developer

2. Onboarding success-state “single next action” treatment
- Files: `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/lib/i18n.tsx`
- Exact changes:
  - Add a top “Recommended next step” card/button directly under success header.
  - Demote all other actions into a secondary “More options” section.
  - Preserve truthful messaging (container-based GPU execution; no unapproved pricing claims).
- Acceptance criteria:
  - Success screens show exactly one recommended next action above secondary links.
  - Existing functionality remains accessible via secondary section.
- Suggested assignee role: Frontend Developer

### P1
3. Login progressive disclosure
- Files: `app/login/page.tsx`, `app/lib/i18n.tsx`
- Exact changes:
  - Step 1: select role/intent.
  - Step 2: show only relevant auth mode fields for selected role.
  - Collapse helper matrix into an expandable “How login works” details block.
- Acceptance criteria:
  - First viewport presents one decision (role), not full matrix.
  - No regression to admin API-key-only behavior.
- Suggested assignee role: Frontend Developer

4. Playground first-run guided lane
- Files: `app/renter/playground/page.tsx`, `app/lib/i18n.tsx`
- Exact changes:
  - Add explicit “Guided first run” mode enabled for users with no prior jobs.
  - Show only preset selection + prompt + submit in guided mode.
  - Keep advanced controls behind an explicit “Show advanced” transition.
- Acceptance criteria:
  - New users can complete a first job with <=3 primary interactions after auth.
  - Existing advanced workflow remains intact behind toggle.
- Suggested assignee role: Frontend Developer

### P2
5. Output completion next-action cluster
- Files: `app/renter/jobs/[id]/page.tsx`, `app/lib/i18n.tsx`
- Exact changes:
  - After completed status, elevate three follow-up actions above tabs: `Run again`, `Save as template`, `Open playground with model prefilled`.
  - Keep logs/history tabs for diagnostics as secondary.
- Acceptance criteria:
  - Completed jobs show continuation CTA cluster above detail tabs.
  - Continuation actions preserve renter auth context.
- Suggested assignee role: Frontend Developer

## Measurement Plan (must be tracked with existing analytics event bus)
- `landing_primary_cta_click_rate` (hero primary clicks / landing sessions)
- `register_to_first_action_rate` (success screen view -> recommended next-action click)
- `login_complete_rate` (login form started -> authenticated redirect)
- `playground_first_submit_rate` (first session authenticated -> first submit success)
- `job_detail_repeat_submit_rate` (completed job detail view -> new submit in same session)

## Guardrails (Product Reality Compliance)
- Do not claim bare-metal execution; keep container-runtime wording.
- Do not add or imply unapproved pricing/earnings numbers.
- Keep Saudi energy advantage + Arabic AI support as headline differentiators where messaging is updated.
