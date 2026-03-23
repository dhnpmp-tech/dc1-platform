# DCP UX Competitive Delta (Conversion + IA)
Date: 2026-03-22 21:47 UTC  
Role: UX Researcher / Competitive Analyst

## Purpose
Refresh competitor UX/messaging evidence and map only the remaining high-impact DCP conversion changes. Recommendations stay aligned with DCP reality: containerized GPU execution (Docker + NVIDIA runtime), no bare-metal claims, and no fabricated DCP pricing claims.

## Evidence Snapshot (Official Surfaces)

| Competitor | Evidence (official page) | UX/Messaging pattern relevant to DCP |
|---|---|---|
| Vast.ai | Homepage nav + hero emphasizes `Cloud GPUs`, `Inference API`, and `Vast Enterprise` lanes. Source: https://vast.ai/ | Mode-first IA + visible enterprise lane next to self-serve lanes. |
| Runpod | Site nav exposes `Serverless`, `Pods`, and `Instant Clusters` in top-level structure. Source: https://www.runpod.io/ | Users choose operating mode first, not docs first. |
| Lambda | Homepage presents direct `Get Started` and `Contact Sales` paths. Source: https://www.lambda.ai/ | Self-serve + enterprise routes are both explicit above fold. |
| Akash | Homepage headlines cost framing + multiple entry lanes (`Deploy`, `Playground`, `Become Provider`). Source: https://akash.network/ | Cost narrative is paired with immediate action routes and role splits. |
| Together AI | Homepage/pricing/docs expose serverless and dedicated endpoint modes. Source: https://www.together.ai/ and https://docs.together.ai/docs/dedicated-inference | Clear progression from quick start to dedicated/scale route. |
| Replit | Replit AI hero repeats `Start building` + `Deploy right away`. Source: https://replit.com/ai | Fast time-to-first-success is aggressively foregrounded. |

## DCP Segment Map (Conversion-Critical)
1. Self-serve renter (startup/indie): wants first successful workload quickly with clear billing settlement language.
2. Provider (GPU owner): wants confidence that setup path leads to heartbeat-ready and earning-ready state.
3. Enterprise buyer: wants explicit intake lane (SLA/security/rollout) without searching through generic support.
4. Arabic AI teams: want immediate discoverability for ALLaM/Falcon/JAIS/BGE-oriented paths.

## Current-State Delta (What remains)

### Confirmed strengths already live
- Mode-first routing appears across landing/docs/support surfaces.
- Differentiator proof (Saudi energy + Arabic AI + container runtime language) is present in multiple entry pages.
- Support includes enterprise intake and route prefill behavior.

### Remaining conversion gaps
1. `app/renter/register/page.tsx`: success-state secondary CTA still routes to `/renter` (dashboard) rather than `/renter/marketplace`.
- Why it matters: post-signup intent is usually compare/choose compute first; dashboard is less action-forward for first job completion.

2. `app/renter/register/page.tsx`: top "First workload in 3 steps" block keeps three equal-weight cards before form completion.
- Why it matters: equal visual weight creates choice friction before registration conversion.

3. `app/support/page.tsx`: enterprise intake band copy is hardcoded English while the page otherwise relies on i18n.
- Why it matters: enterprise conversion for Arabic-first buyers is weakened by mixed localization quality.

4. `app/docs/[[...slug]]/page.tsx` (docs root state): strong mode strip exists, but "Start Quickstart" CTA is below readiness blocks.
- Why it matters: competitor pattern prioritizes immediate primary action above informational blocks.

## Recommendations (File-Mapped)

### P0
1. Registration success CTA sequencing
- File: `app/renter/register/page.tsx`
- Change: keep primary CTA as `/renter/playground?starter=1`; change secondary CTA destination from `/renter` to `/renter/marketplace`.
- Acceptance criteria:
  - Primary action remains first-job execution.
  - Secondary action supports provider/GPU selection.
  - Analytics event names remain consistent, only destination values change.

2. Enterprise support localization completion
- Files: `app/support/page.tsx`, `app/lib/i18n.tsx`
- Change: move hardcoded enterprise intake text (`Enterprise intake`, `SLA planning`, `Security review`, `Onboarding support`, descriptions) to i18n keys for EN+AR.
- Acceptance criteria:
  - No hardcoded English strings in enterprise intake band.
  - AR render is fully localized and readable RTL.

### P1
3. Reduce pre-registration choice friction
- File: `app/renter/register/page.tsx`
- Change: compress pre-form "First workload in 3 steps" to a single emphasized next action + expandable details.
- Acceptance criteria:
  - One visually dominant step before form.
  - Detailed steps remain accessible (accordion/toggle).

4. Promote docs primary CTA above readiness status block
- File: `app/docs/[[...slug]]/page.tsx`
- Change: move `Start Quickstart` CTA group above the "Retail Readiness Status" block on docs root.
- Acceptance criteria:
  - On desktop and mobile, primary action appears before readiness/roadmap details.

## Implementation Checklist
1. P0 — Renter success secondary CTA destination update
- File: `app/renter/register/page.tsx`
- Assignee role: Frontend Developer
- Verify: click path goes to `/renter/marketplace`; primary CTA remains playground.

2. P0 — Enterprise intake full i18n parity
- Files: `app/support/page.tsx`, `app/lib/i18n.tsx`
- Assignee role: Frontend Developer
- Verify: EN/AR parity for all enterprise intake labels/descriptions.

3. P1 — Pre-form choice compression in renter registration
- File: `app/renter/register/page.tsx`
- Assignee role: Frontend Developer
- Verify: reduced equal-weight pre-form cards and improved focus on registration submission.

4. P1 — Docs root CTA order optimization
- File: `app/docs/[[...slug]]/page.tsx`
- Assignee role: Frontend Developer
- Verify: `Start Quickstart` CTA appears before readiness block without layout regressions.

## Sources
- Vast.ai: https://vast.ai/
- Runpod: https://www.runpod.io/
- Lambda: https://www.lambda.ai/
- Akash Network: https://akash.network/
- Together AI: https://www.together.ai/
- Together Dedicated Inference docs: https://docs.together.ai/docs/dedicated-inference
- Replit AI: https://replit.com/ai
