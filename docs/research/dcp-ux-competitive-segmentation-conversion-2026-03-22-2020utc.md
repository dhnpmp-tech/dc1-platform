# DCP UX Competitive + Segmentation Conversion Delta (2026-03-22 20:20 UTC)

Owner: UX Researcher / Competitive Analyst

Scope reviewed:
- Competitors: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit
- DCP pages: `app/page.tsx`, `app/docs/[[...slug]]/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/renter/marketplace/page.tsx`, `app/support/page.tsx`

Guardrails applied: no fabricated pricing/savings claims for DCP, no bare-metal claims, recommendations align to container-based GPU execution.

## Executive Summary

DCP’s mode naming and proof blocks were improved in the latest updates (`DCP-567`, `DCP-568`), but two conversion-critical gaps remain:

1. Enterprise intake is still ambiguous at support form level (category prefill exists, but procurement/security/rollout scope is not explicitly framed before submit).
2. Provider onboarding states show status labels, but expectation timing and “what success looks like next” are not explicit enough to reduce drop-off between API key generation and first healthy heartbeat.

These are the highest-leverage remaining copy/IA fixes for signup-to-activation conversion.

## Competitor Evidence (Live Snapshot)

1. Vast.ai highlights clear multi-mode architecture (GPU Cloud, Serverless, Clusters) and an explicit 3-step activation flow (add credit -> search GPUs -> deploy).
- Source: https://vast.ai/

2. RunPod places mode options in primary nav with concise intent language: Cloud GPUs, Serverless, Clusters, Hub.
- Source: https://www.runpod.io/

3. Lambda pricing separates self-serve instance access from reserved/enterprise motions in the same acquisition surface.
- Source: https://lambda.ai/pricing

4. Together pricing presents mode progression explicitly (“serverless first, dedicated endpoints at scale”), reducing confusion about upgrade path.
- Source: https://www.together.ai/pricing

5. Replit deployment pricing explains billing by deployment mode in plain language (Autoscale / Reserved VM / Scheduled / Static).
- Source: https://docs.replit.com/billing/deployment-pricing

6. Akash GPU docs explicitly anchor runtime reality to NVIDIA container requirements and verification behavior.
- Source: https://akash.network/docs/learn/core-concepts/gpu-deployments/

## DCP Segment Map (Updated)

1. Self-serve renters
- Trigger: run first workload quickly.
- Current friction: route certainty between Marketplace / Playground / Docs is better, but “when to escalate to support” still depends on user judgment.
- Winning frame: self-serve first; clear support route by incident type.

2. Providers (single GPU + fleet)
- Trigger: monetize idle GPUs with minimal setup uncertainty.
- Current friction: state transitions exist, but expected wait windows are implicit.
- Winning frame: each onboarding state should include expected timing + next verification step.

3. Enterprise evaluators
- Trigger: procurement/security sign-off before rollout.
- Current friction: enterprise category exists, but the form does not forcefully signal enterprise intake scope before submission.
- Winning frame: enterprise support intake is for procurement/security/rollout planning, not generic troubleshooting.

4. Arabic AI teams
- Trigger: Arabic model readiness without integration ambiguity.
- Current friction: proof exists across pages, but docs-level enterprise CTA and support intake can better bridge model support -> deployment plan.
- Winning frame: Arabic model support plus container deployment path plus enterprise intake lane.

## Priority Recommendations

### P0: Enterprise intake clarity at submit moment
- Files:
  - `app/support/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add enterprise-only helper panel above the form submit button when `category=enterprise`.
  - Helper panel must list the three enterprise scopes explicitly: procurement review, security review, rollout planning.
  - Add one-line expected response framing for enterprise lane (without SLA promise).
- Acceptance criteria:
  - Enterprise category visibly changes form context before submit.
  - Enterprise helper text appears in EN+AR.
  - No SLA/time guarantees introduced.
- Suggested assignee role: Frontend Developer + UX Writer.

### P0: Provider onboarding expectation copy by state
- Files:
  - `app/provider/register/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - For each state (`waiting`, `heartbeat`, `stale`, `paused`, `ready`), add two short lines:
    - expected timing/verification cue
    - next success condition
  - Keep existing state machine logic unchanged.
- Acceptance criteria:
  - Every state card has explicit expectation + next-success copy.
  - Existing analytics event `provider_onboarding_state_seen` still fires unchanged.
- Suggested assignee role: Frontend Developer + UX Writer.

### P1: Support route certainty in renter post-signup success
- Files:
  - `app/renter/register/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add one short “use this support lane when…” descriptor for each support route button (billing/job/account) in success view.
- Acceptance criteria:
  - Route labels + descriptors are visible in EN+AR.
  - Existing click event names remain unchanged.
- Suggested assignee role: Frontend Developer.

## Implementation Checklist

1. `P0` Enterprise intake helper
- Files: `app/support/page.tsx`, `app/lib/i18n.tsx`
- Priority: `P0`
- Assignee: Frontend Developer + UX Writer
- Acceptance:
  - Enterprise-specific helper panel rendered when enterprise category is active.
  - Copy includes procurement/security/rollout scope with no guarantee claims.

2. `P0` Provider state expectation copy
- Files: `app/provider/register/page.tsx`, `app/lib/i18n.tsx`
- Priority: `P0`
- Assignee: Frontend Developer + UX Writer
- Acceptance:
  - Each onboarding state shows expectation timing + next-success cue.
  - No logic changes to registration or status polling.

3. `P1` Renter success support routing descriptors
- Files: `app/renter/register/page.tsx`, `app/lib/i18n.tsx`
- Priority: `P1`
- Assignee: Frontend Developer
- Acceptance:
  - Support buttons show intent descriptors.
  - Analytics payload schema for support route clicks remains unchanged.
