# DCP Key-Flow UX Conversion Audit — Heartbeat 9 (2026-03-23)

Owner: UI/UX Specialist (Codex)
Date: 2026-03-23 UTC
Scope: Homepage, provider onboarding, auth, job submission, output retrieval.

## Benchmark Snapshot (Official competitor surfaces checked 2026-03-23)

1. Vast.ai (`https://vast.ai/`)
- Keeps first fold focused on one clear activation promise and CTA.
- Shows transparent marketplace framing early (selection + pricing clarity).

2. Runpod (`https://docs.runpod.io/`, `https://landing.runpod.io/`)
- Uses workload-first IA (`Serverless`, `Pods`) and an explicit quickstart path.
- Repeats immediate-start cues (“deploy first GPU pod”) across hero and docs.

3. Lambda (`https://lambda.ai/welcome/ai-cloud`, `https://docs.lambda.ai/public-cloud/on-demand/`)
- Strong split between self-serve launch and enterprise sales route.
- Maintains direct launch action near first fold.

4. Akash (`https://akash.network/deploy/`, `https://akash.network/docs/getting-started/quick-start/`)
- Emphasizes one deployment action and a short guided first deployment flow.

5. Together AI (`https://www.together.ai/`, `https://docs.together.ai/docs/llama4-quickstart`)
- Keeps top-level “build now” conversion action paired with clear quickstart docs.
- Uses a strict first-success ladder (account -> key -> first request).

6. Replit (`https://replit.com/`)
- Intent-led first prompt and immediate start options with minimal gating friction.

## DCP Code-Verified Findings (Current)

1. Homepage still presents secondary choice architecture in the primary discovery region.
- File: `app/page.tsx`
- Evidence: `modeStripItems` and `pathChooserLanes` are still emphasized as parallel decision surfaces.

2. Provider onboarding has good state modeling but too many competing routes after registration.
- File: `app/provider/register/page.tsx`
- Evidence: strong `nextActionState` logic is mixed with additional path-chooser lanes in the same success flow.

3. Login helper is informative but not action-convergent.
- File: `app/login/page.tsx`
- Evidence: `helperRows` describe routes, but selected role does not produce one dominant outcome strip near submit.

4. Job submission route is now a redirect shell, which is good for consolidation, but handoff messaging is generic.
- File: `app/jobs/submit/page.tsx`
- Evidence: direct redirect to `/renter/playground` with neutral copy and no short expectation ladder.

5. Output retrieval is robust but split between playground and job-detail mental models.
- Files: `app/renter/playground/page.tsx`, `app/renter/jobs/[id]/page.tsx`, `app/jobs/[id]/monitor/page.tsx`
- Evidence: output and logs are available, but “where to get final artifact” depends on path and user memory.

## Prioritized Recommendations

### P0 — Simplify homepage first-fold decisioning
- Files:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Keep only two primary first-fold actions: renter start and provider start.
  - Demote `modeStripItems` and `pathChooserLanes` to a lower “Explore more paths” section.
  - Keep differentiator order fixed: Saudi energy-cost advantage -> Arabic AI support -> containerized execution reliability.
- Acceptance criteria:
  - First fold has exactly two primary action buttons.
  - No invented pricing or ROI claims.
  - No bare-metal wording.
- Impact hypothesis:
  - +12% to +20% improvement in hero CTA click-through due to reduced decision load.
- Measurement:
  - Compare `landing_path_selected` and renter/provider registration-start events pre/post (7-day windows).

### P0 — Enforce one dominant next action in provider onboarding success state
- Files:
  - `app/provider/register/page.tsx`
  - `app/lib/provider-install.ts`
  - `app/lib/i18n.tsx`
- Exact changes:
  - For each `nextActionState`, render one primary CTA and move all other options under “Need help?”.
  - Keep support and enterprise links available but visually secondary in non-error states.
- Acceptance criteria:
  - `waiting`, `heartbeat`, `stale`, `paused`, `ready` each show one dominant next step.
  - State transitions continue to map correctly to backend status semantics.
- Impact hypothesis:
  - +10% reduction in onboarding abandonment before first heartbeat.
- Measurement:
  - Track funnel: `provider_register_success` -> first `provider_onboarding_state_seen(state=heartbeat|ready)`.

### P0 — Add role-outcome conversion strip on login
- Files:
  - `app/login/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add dynamic “After sign in, you go to …” strip immediately above submit.
  - Strip updates by selected role + method and shows one next destination only.
- Acceptance criteria:
  - One clear destination shown per selected role/method.
  - No auth API changes.
- Impact hypothesis:
  - +8% successful sign-ins from reduced ambiguity.
- Measurement:
  - Instrument role/method submit-to-success conversion (`login_submit` -> redirect reached).

### P1 — Add first-success ladder to submit redirect and playground entry
- Files:
  - `app/jobs/submit/page.tsx`
  - `app/renter/playground/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Show 3-step ladder in redirect shell: authenticate -> choose template -> run job.
  - In playground, add short pinned onboarding rail until first completed job.
- Acceptance criteria:
  - New renter can submit a job without leaving primary path.
  - Ladder disappears after first completed job event.
- Impact hypothesis:
  - +15% first-job completion rate among new renter sessions.
- Measurement:
  - Session cohort metric: first playground visit -> first `status=completed` job within 24h.

### P1 — Unify output retrieval CTA language across playground and job detail
- Files:
  - `app/renter/playground/page.tsx`
  - `app/renter/jobs/[id]/page.tsx`
  - `app/jobs/[id]/monitor/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Standardize one label pattern: “View output” (in-app) and “Download output” (artifact).
  - Add a persistent breadcrumb hint from monitor handoff page to renter job detail output tab.
- Acceptance criteria:
  - Same wording for equivalent output actions across all renter job surfaces.
  - Legacy monitor route always points users to canonical output surface.
- Impact hypothesis:
  - -20% support tickets/questions about missing output location.
- Measurement:
  - Track clicks to output actions vs support route visits from job pages.

### P2 — Cross-flow proof module consistency
- Files:
  - `app/page.tsx`
  - `app/renter/marketplace/page.tsx`
  - `app/docs/quickstart/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Reuse a single proof block for Saudi energy-cost advantage and Arabic model support.
- Acceptance criteria:
  - Same proof language appears on all three surfaces.
  - No unsupported model-performance claims.
- Impact hypothesis:
  - +6% qualified renter activation from message consistency.
- Measurement:
  - Entry-page segmented conversion to renter registration and first job submit.

## Suggested Implementation Order

1. P0 homepage simplification + login role-outcome strip (highest conversion leverage).
2. P0 provider onboarding CTA hierarchy (activation quality and fewer dead-end clicks).
3. P1 submit/playground first-success ladder.
4. P1 output retrieval language and canonical handoff.
5. P2 proof module standardization.

## Guardrails

- Do not invent pricing, savings, or earnings numbers.
- Do not claim bare-metal GPU access.
- Keep platform reality explicit: container-based GPU execution.
- Keep message priority: Saudi energy-cost advantage -> Arabic AI support -> containerized reliability.
