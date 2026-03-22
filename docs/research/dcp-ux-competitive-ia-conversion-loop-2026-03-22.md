# DCP UX Research + Competitive IA/Conversion Loop (2026-03-22 UTC)

Owner: UX Researcher / Competitive Analyst  
Scope competitors: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit  
Method: official homepage/pricing surfaces reviewed on 2026-03-22; recommendations constrained to shipped DCP reality (containerized GPU jobs, no fabricated pricing, no bare-metal claims).

## Evidence Highlights (Primary Sources)

1. Vast.ai leads with transparent market mechanics on pricing UX.
- "GPU Pricing - Live Marketplace Rates"
- "Prices set by supply and demand across 40+ data centers"
- "On-demand, interruptible, or reserved"
- Source: https://vast.ai/pricing

2. RunPod separates product modes early and ties each to buyer intent.
- "On-demand GPUs, deployed across 31 global regions"
- "Serverless Instant AI workloads-no setup, scaling, or idle costs"
- Source: https://www.runpod.io/pricing and https://www.runpod.io/

3. Lambda uses explicit procurement clarity and table-based pricing.
- "Clear, straightforward pricing"
- "Deploy ... instances in minutes with self-serve"
- Source: https://lambda.ai/pricing

4. Akash foregrounds marketplace differentiation + lower-cost thesis.
- "The Decentralized Cloud Built for AI's Next Frontier"
- "Tap into global GPU power at a fraction of the cost"
- Source: https://akash.network/ and https://akash.network/pricing/gpus

5. Together.ai uses a staged scale path from serverless to dedicated.
- "Most teams start with serverless inference and move to dedicated endpoints at scale"
- Product ladder visible in nav: serverless, dedicated model, dedicated container inference
- Source: https://www.together.ai/pricing

6. Replit pricing and IA are role/use-case segmented, reducing decision load.
- "Choose the best plan for you"
- Plan and role segmentation is explicit in first viewport
- Source: https://replit.com/pricing

## What Competitors Do Better in Conversion UX

1. Mode clarity before signup.
- Competitors expose deployment mode choices (on-demand/serverless/dedicated) before account friction.

2. Cost semantics in the first decision screen.
- Billing units and commitment terms are visible in primary pricing views.

3. Explicit enterprise branch.
- Contact-sales pathways are always visible without disrupting self-serve flows.

4. Single success path copy.
- First action and "what happens next" are deterministic per role.

## DCP Target Segment Map (Actionable)

1. Provider Solo Operator (1-2 GPUs)
- Primary intent: monetize idle GPU with minimal setup risk.
- Anxiety: daemon install uncertainty, first heartbeat confirmation, payout timing assumptions.
- Winning message: predictable onboarding sequence + transparent settlement mechanics.

2. Provider Small GPU Farm (3-20 GPUs)
- Primary intent: utilization + operational visibility.
- Anxiety: monitoring quality, job failure handling, scaling confidence.
- Winning message: reliability telemetry + clear incident/status workflow.

3. Renter Builder (startup / indie)
- Primary intent: run first inference/training job fast.
- Anxiety: unclear route between register/playground/jobs/docs and unclear state transitions.
- Winning message: one canonical "first job" path + status-to-action playbook.

4. Arabic AI Team (MENA enterprise/startup)
- Primary intent: production workflows for Arabic-first models.
- Anxiety: whether Arabic models are truly first-class and deployment-ready.
- Winning message: Arabic model support as headline promise + deployment examples in first scroll.

5. Enterprise Evaluator (security/ops lead)
- Primary intent: de-risk vendor selection.
- Anxiety: trust artifacts, controls, support paths, operational boundaries.
- Winning message: explicit container model + policy/security/support surfaces without sales call lock-in.

## Conversion and IA Recommendations (DCP-specific)

### P0

1. Landing page: compress into role-first decision + differentiator proof.
- Files:
  - `/home/node/dc1-platform/app/page.tsx`
  - `/home/node/dc1-platform/app/lib/i18n.tsx`
- Exact changes:
  - Keep two primary pathways above fold: `Run Jobs` (renter) and `Earn with GPUs` (provider).
  - Add one explicit architecture line near CTA: `Containerized GPU execution with NVIDIA Container Toolkit`.
  - Place Saudi energy-cost and Arabic AI support as first proof block below hero.
- Acceptance criteria:
  - First-time visitor can choose a path in <= 5 seconds.
  - Differentiators are visible without opening docs.
- Suggested assignee: Frontend Developer

2. Provider register success state: remove ambiguity in next actions.
- Files:
  - `/home/node/dc1-platform/app/provider/register/page.tsx`
  - `/home/node/dc1-platform/app/docs/provider-guide/page.tsx`
- Exact changes:
  - Add deterministic 4-step post-register card: Download daemon -> Run install command -> Confirm heartbeat -> Become job-eligible.
  - Add per-step troubleshooting links (network reachability, key validation, daemon logs).
- Acceptance criteria:
  - Provider can self-diagnose first-setup failure without leaving flow.
- Suggested assignee: Frontend Developer

3. Renter first-job path: enforce one canonical route.
- Files:
  - `/home/node/dc1-platform/app/renter/register/page.tsx`
  - `/home/node/dc1-platform/app/renter/playground/page.tsx`
  - `/home/node/dc1-platform/components/jobs/JobSubmitForm.tsx`
- Exact changes:
  - After registration, route CTA priority to `/renter/playground` first, dashboard second.
  - Add fixed status glossary inline: `queued -> running -> completed/failed` with next action per state.
- Acceptance criteria:
  - New renter can complete first test job without visiting more than 2 additional pages.
- Suggested assignee: Frontend Developer

### P1

4. Docs IA: role-gated entry that mirrors product flows.
- Files:
  - `/home/node/dc1-platform/app/docs/page.tsx`
  - `/home/node/dc1-platform/app/docs/quickstart/page.tsx`
  - `/home/node/dc1-platform/app/docs/renter-guide/page.tsx`
  - `/home/node/dc1-platform/app/docs/provider-guide/page.tsx`
- Exact changes:
  - Add `I am a renter` / `I am a provider` role selector with two linear checklists.
  - Reuse one billing explainer string bundle across renter pages/docs.
- Acceptance criteria:
  - Docs bounce from `/docs` to role guide decreases vs baseline.
- Suggested assignee: Frontend Developer

5. Support IA: route by role + issue type, not generic form.
- Files:
  - `/home/node/dc1-platform/app/support/page.tsx`
  - `/home/node/dc1-platform/app/components/layout/Footer.tsx`
- Exact changes:
  - Add support entry tiles: `Provider install`, `Job execution`, `Billing/settlement`, `Enterprise inquiry`.
  - Add direct footer deep links to those tiles.
- Acceptance criteria:
  - More support tickets arrive pre-classified by issue type.
- Suggested assignee: Frontend Developer

### P2

6. Marketplace trust signals for renter choice confidence.
- Files:
  - `/home/node/dc1-platform/app/renter/marketplace/page.tsx`
  - `/home/node/dc1-platform/app/marketplace/page.tsx`
- Exact changes:
  - Standardize provider card metadata: heartbeat freshness, job success rate label, model compatibility hints.
  - Show last-updated timestamp near availability stats.
- Acceptance criteria:
  - Higher click-through from marketplace card to job submission.
- Suggested assignee: Frontend Developer

## Messaging Rules to Keep (Non-Negotiable)

1. Do not publish fixed savings or earnings promises.
2. Do not use "bare-metal" wording; DCP execution is containerized.
3. Keep Saudi energy-cost advantage and Arabic AI support as headline differentiators.
4. Avoid payment gateway/payout implementation claims until shipped.

## Implementation Checklist

1. `P0` homepage role-first conversion pass.
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Changes: role-first CTA hierarchy, architecture clarity line, differentiator proof block
- Acceptance: role path selection is immediate and unambiguous
- Suggested assignee role: Frontend Developer

2. `P0` provider onboarding certainty pass.
- Files: `app/provider/register/page.tsx`, `app/docs/provider-guide/page.tsx`
- Changes: deterministic next-step sequence + troubleshoot links
- Acceptance: fewer provider setup drop-offs before first heartbeat
- Suggested assignee role: Frontend Developer

3. `P0` renter first-job canonical flow pass.
- Files: `app/renter/register/page.tsx`, `app/renter/playground/page.tsx`, `components/jobs/JobSubmitForm.tsx`
- Changes: single path + job state glossary and next actions
- Acceptance: first-job completion with minimal page hopping
- Suggested assignee role: Frontend Developer

4. `P1` docs role-gating pass.
- Files: `app/docs/page.tsx`, `app/docs/quickstart/page.tsx`, `app/docs/renter-guide/page.tsx`, `app/docs/provider-guide/page.tsx`
- Changes: role selector + linear checklist IA
- Acceptance: reduced docs navigation backtracking
- Suggested assignee role: Frontend Developer

5. `P1` support information architecture pass.
- Files: `app/support/page.tsx`, `app/components/layout/Footer.tsx`
- Changes: role/issue-type support routing
- Acceptance: increased structured support intake quality
- Suggested assignee role: Frontend Developer

6. `P2` marketplace trust-semantic pass.
- Files: `app/renter/marketplace/page.tsx`, `app/marketplace/page.tsx`
- Changes: standardized trust metadata and freshness cues
- Acceptance: improved marketplace-to-submit conversion
- Suggested assignee role: Frontend Developer

## Sources
- https://vast.ai/pricing
- https://www.runpod.io/
- https://www.runpod.io/pricing
- https://lambda.ai/pricing
- https://akash.network/
- https://akash.network/pricing/gpus
- https://www.together.ai/pricing
- https://replit.com/pricing
