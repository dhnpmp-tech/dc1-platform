# DCP UX Competitive Segmentation + Conversion Delta (2026-03-22 18:30 UTC)

Owner: UX Researcher / Competitive Analyst  
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit + DCP conversion copy/onboarding/IA updates

## Snapshot
- DCP already ships strong role intent segmentation and trust anchors on landing/docs/provider/renter routes.
- Remaining conversion risk is not value proposition clarity; it is execution-path certainty after first click (especially renter quickstart and provider activation confidence).
- Recommendations below avoid fabricated pricing and keep DCP reality explicit: container-based GPU execution via Docker + daemon heartbeat workflows.

## Competitor Signals Re-verified (official sources)
| Competitor | Signal observed | Why it matters for conversion | Source |
|---|---|---|---|
| Vast.ai | Marketplace pricing model is explicit and operationally legible (live rates, on-demand/interruptible/reserved, per-second framing). | Reduces billing anxiety before sign-up. | https://vast.ai/pricing |
| RunPod | Mode-first pricing IA: Pods, Serverless, Instant Clusters, Reserved Clusters, Public Endpoints on one page. | Users self-select workload mode quickly without docs detours. | https://www.runpod.io/pricing |
| Lambda | Self-serve CTA and procurement CTA are paired in hero-level pricing surface (`Launch GPU instance` + `Talk to our team`). | Keeps enterprise buyers in the same funnel instead of forcing separate discovery. | https://lambda.ai/pricing |
| Akash | Homepage and quickstart emphasize deployment immediacy and marketplace framing (`Deploy On Console`, quick-start in under 10 minutes). | Minimizes first-run hesitation by making activation path concrete. | https://akash.network/ , https://akash.network/docs/getting-started/quick-start/ |
| Together.ai | Pricing IA ladders inference/compute paths and includes explicit serverless + dedicated options. | Encourages growth path thinking (start simple, scale later). | https://www.together.ai/pricing |
| Replit | Intent-first top-of-funnel with immediate build prompt plus deployment-type billing documentation. | Matches user intent early, then clarifies cost mechanics by workload type. | https://replit.com/ , https://docs.replit.com/billing/deployment-pricing |

Verification timestamp: 2026-03-22 (UTC)

## DCP Segment Map (Conversion Priorities)
1. Builder-start renters (individual devs, startup prototypers)
- Primary need: first successful job quickly, low setup uncertainty.
- Key page path: `/` -> `/renter/register` -> `/renter/playground` -> `/renter/jobs`.

2. Production renters (teams moving from test to repeatable workloads)
- Primary need: clear transition from browser testing to container/API jobs.
- Key page path: `/` -> `/docs/quickstart` -> `/docs/api-reference` -> `/renter/jobs`.

3. Enterprise/procurement buyers
- Primary need: trust and rollout path with obvious human escalation.
- Key page path: `/` or `/docs` -> `/support?category=enterprise`.

4. Provider operators (GPU owners)
- Primary need: confidence in activation state and next action after daemon install.
- Key page path: `/provider/register` -> `/provider/download` -> `/provider`.

## Highest-Impact Gaps (Current DCP)
1. Renter path split still feels page-driven, not task-driven.
- Landing exposes mode options, but renter register success does not show a single “recommended next action” button tied to account readiness.

2. Provider download state selector is informative but currently manual.
- It simulates states rather than reflecting detected live state, which can reduce trust for first-time providers.

3. Docs root readiness block exists, but conversion handoff to role-specific checklists can be stronger.
- “Available now vs roadmap” is clear, but checklist completion/progress proof is absent.

## Recommendations (file-mapped)
### P0
1. Add a canonical renter activation rail card with one primary CTA that changes by readiness state (`registered`, `funded`, `job_submitted`, `running`, `completed`).
- Files: `app/renter/register/page.tsx`, `app/renter/playground/page.tsx`, `app/renter/jobs/page.tsx`, `app/lib/i18n.tsx`
- Acceptance criteria:
  - Each state shows exactly one primary next action and one fallback help link.
  - EN/AR parity for labels and helper text.
  - No copy implies unsupported payment rails.

2. Convert provider next-step panel from manual selector to optional API-backed status probe with explicit fallback.
- Files: `app/provider/download/page.tsx`, `app/provider/page.tsx`, `backend/src/routes/providers.js` (read-only status endpoint if missing)
- Acceptance criteria:
  - If provider key is present, UI attempts state fetch; if unavailable, displays current manual mode with “status unavailable” notice.
  - No silent failure; state source is visible to user.

### P1
1. Add a lightweight “Path chooser” at top of quickstart docs (browser-first vs container/API-first) with explicit expected time-to-first-result.
- Files: `docs/quickstart.mdx`, `docs/ar/quickstart.mdx`, `app/docs/[[...slug]]/page.tsx`
- Acceptance criteria:
  - Both paths have 3-5 steps max.
  - Each path ends with concrete validation step (job output or heartbeat proof).

2. Add enterprise trust micro-panel on landing below CTA cluster (support SLA, security docs, procurement intake link).
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Acceptance criteria:
  - Panel includes only currently available trust artifacts.
  - CTA routes to `/support?category=enterprise`.

### P2
1. Add role-based progress instrumentation schema for activation drop-off diagnostics.
- Files: `app/page.tsx`, `app/renter/register/page.tsx`, `app/provider/download/page.tsx`
- Acceptance criteria:
  - Events include `role`, `step`, `state`, `source`.
  - Dashboard-ready event naming consistency (`dc1_analytics`).

## Implementation Checklist
- [ ] P0: Renter activation rail across register/playground/jobs.
- [ ] P0: Provider API-backed next-state panel with manual fallback.
- [ ] P1: Quickstart path chooser (EN/AR) with time-to-first-result framing.
- [ ] P1: Landing enterprise trust micro-panel tied to real support path.
- [ ] P2: Role/state instrumentation normalization.

Suggested assignees:
- Frontend Engineer (P0/P1 UI + instrumentation)
- Backend Engineer (provider status endpoint if needed)
- Copywriter + UX Researcher (EN/AR copy and checklist language)

## Notes
- Do not claim bare-metal execution; keep Docker/containerized GPU runtime wording.
- Do not add new pricing claims unless backed by live platform-controlled data.
- Keep Saudi energy advantage and Arabic-model support as headline differentiators, but pair with concrete next action in same viewport.
