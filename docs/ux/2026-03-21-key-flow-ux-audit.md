# DCP UX Audit — Key Flows (2026-03-21)

Owner: UI/UX Specialist (Codex)
Scope: Homepage, onboarding, auth, job submission, output retrieval

## Benchmark Inputs (Top Competitor Patterns)

1. Vast.ai instance creation flow is offer-first and explicit about machine search, template merge rules, and API/CLI parity. This reduces ambiguity before launch and makes advanced users confident in what is actually provisioned.
Source: https://docs.vast.ai/api-reference/instances/create-instance

2. Runpod’s serverless getting-started path is endpoint-first and outcome-oriented (create endpoint, then send inference requests). The UX pattern is guided sequence with immediate “first successful request” payoff.
Source: https://docs.runpod.io/serverless/vllm/get-started

3. CoreWeave’s get-started docs separate account activation, org/user setup, and environment setup into clear phases before workload execution. This clarifies dependencies and avoids failed setup loops.
Source: https://docs.coreweave.com/get-started

## Current-State Findings

### P0

1. Job submission has two fragmented experiences with inconsistent trust/visual language.
- Pages: `app/renter/playground/page.tsx`, `app/jobs/submit/page.tsx`, `components/jobs/JobSubmitForm.tsx`
- Problem: the legacy `/jobs/submit` flow uses a separate gray theme and standalone auth gate, while `/renter/playground` is the primary modern flow.
- Risk: users hit an older path and get contradictory interaction/branding patterns, lowering submission confidence.
- Impact hypothesis: unifying into one submission surface should reduce submission abandonment by 15-25% and reduce support tickets around “where do I submit jobs?”

2. Auth flow does not clearly communicate role-scoped outcomes before credential entry.
- Page: `app/login/page.tsx`
- Problem: role and method are selectable, but there is limited pre-submit explanation of what destination and permissions each combination unlocks.
- Risk: avoidable wrong-role attempts and bounced sessions.
- Impact hypothesis: role-outcome helper copy and post-submit destination preview should improve first-attempt login success by 10-18%.

### P1

3. Homepage hierarchy still diffuses the two core differentiators across many blocks.
- Page: `app/page.tsx`
- Problem: Saudi energy-cost advantage and Arabic-model support exist, but compete with many parallel cards, leading to diluted message salience.
- Risk: weaker positioning versus global GPU marketplaces at first impression.
- Impact hypothesis: stronger above-the-fold differentiation and a single primary decision path can improve renter CTA click-through by 12-20%.

4. Provider onboarding success state is command-heavy with limited progressive validation.
- Page: `app/provider/register/page.tsx`
- Problem: registration success presents multiple commands at once; validation state depends on polling, but guidance for “if this step fails” is sparse.
- Risk: installation drop-off and repeated copy/paste errors.
- Impact hypothesis: staged checklist + explicit failure recovery actions should improve heartbeat-detected completion by 10-15%.

5. Output retrieval is strong on logs but weak on “what to do next” after completion/failure.
- Page: `app/renter/jobs/[id]/page.tsx`
- Problem: rich technical output exists, but post-result actions (retry with modified params, save as template, rerun on alternate provider) are not prominent in outcome context.
- Risk: users leave after one run instead of iterating.
- Impact hypothesis: contextual next actions should increase second-job initiation rate by 8-14%.

### P2

6. Header navigation labels are generic and do not foreground DCP’s unique market position.
- Page: `app/components/layout/Header.tsx`
- Problem: nav reflects standard IA but misses high-intent Arabic AI entry and trust/infra clarity shortcuts.
- Impact hypothesis: adding one “Arabic AI Models” or “Why DCP” route in top nav can increase qualified exploration sessions by 5-10%.

## Flow-by-Flow Recommendations

## 1) Homepage

- Collapse early decision to one renter CTA and one provider CTA, with microcopy under each describing exact first outcome.
- Keep “container-based GPU compute” disclaimer adjacent to CTA area, not in a distant helper line.
- Bring Arabic models + Saudi energy advantage into the hero support line directly (single sentence with both points).
- Demote non-critical feature grid below proof/marketplace signal.

## 2) Onboarding (Provider + Renter)

- Convert success screens into explicit stepper with states: `Not started`, `In progress`, `Verified`.
- Add inline “if blocked, do this” fallback for each technical step (download, command run, heartbeat missing).
- Auto-highlight the exact next step only; keep advanced diagnostics collapsed.

## 3) Auth

- Add role/method matrix helper above the form:
  - Renter + Email OTP -> `/renter/playground`
  - Provider + Email OTP -> `/provider`
  - Admin + API key -> `/admin`
- Preserve current OTP flow, but surface expiration and resend expectations before code entry.

## 4) Job Submission

- Treat `/renter/playground` as canonical submission path; redirect legacy `/jobs/submit` traffic with rationale.
- Keep advanced JSON/task spec collapsed by default (already present), but add schema examples per job type.
- Show pre-flight check row before submit: `selected provider`, `estimated SAR`, `model fit`, `auth status`.

## 5) Output Retrieval

- Add an outcome action rail in job detail:
  - `Retry with same config`
  - `Save as template`
  - `Run on different GPU tier`
- For failed jobs, pin the first actionable remediation above raw logs.
- For successful jobs, pin “copy result / export artifact / rerun variation” above technical metadata.

## Implementation Checklist

### P0 — Unify submission path and reduce auth/submission confusion

1. File: `app/jobs/submit/page.tsx`
- Change: Replace current standalone page body with immediate route handoff to `/renter/playground` (preserve query params).
- Acceptance criteria:
  - Visiting `/jobs/submit` always lands on `/renter/playground`.
  - No separate legacy auth gate is rendered.
- Suggested assignee role: Frontend Developer

2. File: `components/jobs/JobSubmitForm.tsx`
- Change: Mark component as legacy and add a small deprecation banner if this route remains reachable internally.
- Acceptance criteria:
  - Users entering legacy surface see a clear path to canonical playground.
- Suggested assignee role: Frontend Developer

3. File: `app/login/page.tsx`
- Change: Add role-to-destination helper copy block above submit controls.
- Acceptance criteria:
  - All three role paths show destination and auth method expectations before submit.
- Suggested assignee role: Frontend Developer

### P1 — Strengthen differentiation and completion loops

4. File: `app/page.tsx`
- Change: Tighten hero support copy and CTA order to foreground Saudi energy economics + Arabic AI model support + container-based reality.
- Acceptance criteria:
  - Hero includes both differentiators in first viewport.
  - No bare-metal claims are introduced.
- Suggested assignee role: UI/UX Specialist + Frontend Developer

5. File: `app/provider/register/page.tsx`
- Change: Rework success state into single-next-step progression with conditional troubleshooting links.
- Acceptance criteria:
  - At each stage, one primary action is visually dominant.
  - Heartbeat wait state includes explicit fallback action.
- Suggested assignee role: Frontend Developer

6. File: `app/renter/jobs/[id]/page.tsx`
- Change: Add sticky “Next actions” strip keyed by job status.
- Acceptance criteria:
  - Completed jobs show rerun/template/export actions above fold.
  - Failed jobs show remediation CTA above log stream.
- Suggested assignee role: Frontend Developer

### P2 — Navigation and messaging refinements

7. File: `app/components/layout/Header.tsx`
- Change: Add one high-intent differentiator nav entry (for example `Arabic AI Models` -> `/marketplace`).
- Acceptance criteria:
  - Desktop and mobile nav both expose the new route.
  - No regression in current auth CTA visibility.
- Suggested assignee role: Frontend Developer

## Measurement Plan

Track for 14 days pre/post implementation:
- Landing -> renter register click-through rate
- Landing -> provider register click-through rate
- First-attempt login success rate by role
- Job submit start -> submit success conversion
- Job detail page -> second-job initiation rate

Success threshold:
- P0 items: >= 10% relative improvement in their primary metric
- P1 items: >= 8% relative improvement
- P2 items: directional improvement with no regression in core conversion funnels

## Product-Reality Guardrails

- Keep all messaging aligned with container-based GPU execution (NVIDIA Container Toolkit), not bare-metal claims.
- Do not introduce unapproved pricing claims.
- Keep Saudi energy-cost advantage and Arabic AI model support as top-level differentiators in high-visibility sections.
