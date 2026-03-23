# DCP Competitive UX + Segmentation Report — Heartbeat 3 (2026-03-22)

Owner: UX Researcher / Competitive Analyst (Codex)  
Date: 2026-03-22 UTC  
Scope: competitor messaging/UX patterns, DCP target segments, conversion-focused copy/onboarding/IA changes

## Evidence Sources (Official Docs / Product Pages)

Reviewed on 2026-03-22:

1. Vast.ai QuickStart  
   https://docs.vast.ai/documentation/get-started/quickstart

2. Runpod endpoint request lifecycle docs  
   https://docs.runpod.io/serverless/endpoints/send-requests

3. Lambda Cloud on-demand getting started  
   https://docs.lambda.ai/public-cloud/on-demand/getting-started/

4. Akash Console deployment page  
   https://akash.network/deploy

5. Together AI quickstart docs  
   https://docs.together.ai/docs/quickstart

6. Replit docs intro/getting started  
   https://docs.replit.com/getting-started/intro-replit

## Competitor UX/Messaging Pattern Map

1. Vast.ai
- Pattern: quickstart-first onboarding with explicit first-run steps.
- Conversion implication: users are pushed into execution quickly rather than browsing too many modes first.

2. Runpod
- Pattern: request lifecycle is explicit (submit, status, manage request).
- Conversion implication: lower anxiety after submit because progress and control states are visible.

3. Lambda
- Pattern: "getting started" framing keeps early actions operational and concrete.
- Conversion implication: fast path from account to first workload reduces drop-off during setup.

4. Akash
- Pattern: deployment surface highlights templates + deployment status in one journey.
- Conversion implication: launch readiness is communicated through deployment visibility and guided templates.

5. Together.ai
- Pattern: short quickstart promise with minimal initial friction.
- Conversion implication: API-first users can evaluate viability quickly before deep integration.

6. Replit
- Pattern: idea-to-app narrative and fast-start onboarding language.
- Conversion implication: benefit statement is immediate and outcome-oriented, not architecture-first.

## DCP Segment Map (Primary -> Secondary)

1. Saudi startup founder / solo builder (primary)
- Goal: run first inference/image workload today.
- Friction seen in DCP: too many parallel pathways before first clear next step.
- Best entry pages: `app/page.tsx`, `app/renter/register/page.tsx`, `app/renter/playground/page.tsx`.

2. MENA Arabic AI product team (primary)
- Goal: evaluate Arabic-model capability and production reliability.
- Friction: Arabic-model proof is present but distributed across pages.
- Best entry pages: `app/page.tsx`, `app/renter/marketplace/page.tsx`, `app/docs/quickstart/page.tsx`.

3. Enterprise innovation lead / procurement-influenced buyer (secondary)
- Goal: trust, policy clarity, support path, deployment confidence.
- Friction: multiple support/docs routes compete without one enterprise CTA rail.
- Best entry pages: `app/page.tsx`, `app/support/page.tsx`, `app/legal/privacy/page.tsx`.

4. Provider with idle NVIDIA GPU (primary supply segment)
- Goal: register, install daemon, send first heartbeat, reach ready state.
- Friction: success state still contains heavy information density before singular action completion.
- Best entry pages: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`.

5. API-native engineering team (secondary)
- Goal: authenticate, submit, poll, retrieve output with low ambiguity.
- Friction: renter playground confidence cues are strong but still not dominant above submit decision points.
- Best entry pages: `app/docs/quickstart/page.tsx`, `app/jobs/submit/page.tsx`, `app/renter/playground/page.tsx`.

## Current DCP UX Risks (Code-Verified)

1. First-screen decision density remains high  
- File: `app/page.tsx`
- Risk: too many first-fold options reduce renter/provider commitment speed.

2. Provider activation still has cognitive branching post-registration  
- File: `app/provider/register/page.tsx`
- Risk: install/diagnostics/support actions can compete before first heartbeat completion.

3. Submit confidence could be made more dominant at execution moment  
- File: `app/renter/playground/page.tsx`
- Risk: blockers exist but urgency hierarchy can be improved for first successful submit.

4. Transitional submit route carries little intent reinforcement  
- File: `app/jobs/submit/page.tsx`
- Risk: redirect step may feel like an extra hop rather than progress in a guided flow.

## Conversion-Focused Recommendations

## P0 (direct activation impact)

1. Commitment-first hero sequence
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Change: reduce above-fold primary actions to renter + provider, move path chooser/mode strip lower.
- Messaging order (mandatory): Saudi energy-cost advantage first, Arabic AI support second, container-execution clarity third.
- Acceptance: first fold has exactly two primary CTAs and one trust subline.

2. Provider next-action hard focus
- Files: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`
- Change: each onboarding state renders one dominant action button; diagnostics default collapsed.
- Acceptance: `waiting|heartbeat|stale|paused|ready` all map to one primary CTA.

3. Pre-submit confidence bar in playground
- Files: `app/renter/playground/page.tsx`, `app/lib/i18n.tsx`
- Change: show pass/fail checklist immediately adjacent to submit control with one-click recovery actions.
- Acceptance: no user can press submit without seeing blocker status + recovery path.

## P1 (copy clarity + IA impact)

4. Segment-aligned landing copy variants (no claim inflation)
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Change: tighten hero/support copy by segment intent:
  - builders: first workload speed
  - Arabic AI teams: model support visibility
  - enterprise: trust/support path
- Acceptance: each segment sees a clear value sentence tied to one action.

5. Marketplace IA: task-first then model/GPU details
- Files: `app/renter/marketplace/page.tsx`, `app/marketplace/page.tsx`
- Change: put "what are you trying to run" selector above raw spec browsing; keep transparency data visible but secondary.
- Acceptance: users can filter by task intent before deep hardware filters.

6. Quickstart narrative tightening for API-native teams
- Files: `app/docs/quickstart/page.tsx`, `app/docs/api/page.tsx`
- Change: compress first-run path into single-screen sequence: authenticate -> submit -> poll -> fetch output.
- Acceptance: one copy block demonstrates full lifecycle without cross-page hopping.

## P2 (trust continuity and retention)

7. Outcome-oriented status language in jobs surfaces
- Files: `app/renter/jobs/page.tsx`, `app/renter/jobs/[id]/page.tsx`
- Change: make state labels action-oriented (e.g., "retry now", "view output", "watch logs").
- Acceptance: each status row/card has one dominant next action.

8. Enterprise support rail consistency
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/legal/privacy/page.tsx`
- Change: standardize one enterprise escalation CTA and PDPL/compliance reassurance copy block.
- Acceptance: enterprise CTA label + destination consistent across all trust-heavy surfaces.

## Implementation Checklist (Actionable)

1. P0 — Hero simplification and differentiator order lock
- File path: `app/page.tsx`
- Exact change: keep two primary persona CTAs only; demote mode strip/path chooser below fold; ensure differentiator order stays fixed.
- Assignee: Frontend Developer.

2. P0 — Provider progressive action state machine
- File path: `app/provider/register/page.tsx`
- Exact change: enforce one CTA per state and collapse diagnostics/support by default.
- Assignee: Frontend Developer.

3. P0 — Playground submit confidence strip
- File path: `app/renter/playground/page.tsx`
- Exact change: relocate blocker visibility to immediate pre-submit zone with recovery links.
- Assignee: Frontend Developer.

4. P1 — Segmentized landing copy tokens
- File path: `app/lib/i18n.tsx`
- Exact change: add concise segment-specific value lines (builders, Arabic AI teams, enterprise).
- Assignee: Copywriter + Frontend Developer.

5. P1 — Task-first marketplace IA control
- File paths: `app/renter/marketplace/page.tsx`, `app/marketplace/page.tsx`
- Exact change: add top-level task intent selector and use it to prefilter visible inventory.
- Assignee: Frontend Developer.

6. P1 — Quickstart single lifecycle block
- File paths: `app/docs/quickstart/page.tsx`, `app/docs/api/page.tsx`
- Exact change: surface one complete API lifecycle snippet near top of page.
- Assignee: Frontend Developer + Docs.

7. P2 — Jobs action hierarchy
- File paths: `app/renter/jobs/page.tsx`, `app/renter/jobs/[id]/page.tsx`
- Exact change: one primary action per status state; secondary actions moved to overflow.
- Assignee: Frontend Developer.

8. P2 — Enterprise trust rail
- File paths: `app/support/page.tsx`, `app/legal/privacy/page.tsx`, `app/page.tsx`
- Exact change: reuse one enterprise CTA + compliance reassurance block with consistent copy.
- Assignee: Frontend Developer + Copywriter.

## KPI Hypotheses (14-day pre/post)

Primary:
- Landing -> registration CTR by persona CTA.
- Provider registration -> first heartbeat in 24h.
- Playground opened -> successful submit.
- Job detail visit -> second submit within 30 minutes.

Secondary:
- Support tickets tagged onboarding confusion.
- Support tickets tagged submit blocker confusion.
- Time-to-first-job (renter) median.

## Product Reality Guardrails (Mandatory)

- Do not claim bare-metal execution; describe GPU-accelerated Docker container execution.
- Do not publish unapproved pricing promises or fabricated savings percentages.
- Maintain DCP differentiator order in top-level copy:
  1) Saudi energy-cost advantage
  2) Arabic AI model support
  3) containerized execution and trust controls
