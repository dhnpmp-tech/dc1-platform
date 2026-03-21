# DCP Competitor UX + Segmentation Delta (2026-03-21 22:05 UTC)

Owner: UX Researcher / Competitive Analyst (Codex)
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit + DCP conversion copy/onboarding/IA

## Evidence Snapshot (Primary Sources)

1. **RunPod**: pricing-first IA with immediate `Get started` and explicit usage-billing framing across products.
- Sources:
  - https://www.runpod.io/pricing
  - https://docs.runpod.io/get-started/billing-information
  - https://docs.runpod.io/public-endpoints/overview

2. **Vast.ai**: marketplace transparency (real-time rates, supply-demand model) and clear 3-step onboarding flow.
- Sources:
  - https://vast.ai/
  - https://docs.vast.ai/documentation/pricing
  - https://docs.vast.ai/api-reference/billing

3. **Lambda**: high-clarity GPU-spec + $/GPU-hr tables with explicit effective pricing date and launch CTA.
- Sources:
  - https://lambda.ai/pricing
  - https://lambda.ai/service/gpu-cloud/pricing

4. **Together.ai**: low-friction “first API call” quickstart and clear key setup sequence.
- Sources:
  - https://docs.together.ai/docs/quickstart
  - https://www.together.ai/pricing
  - https://www.together.ai/data-center-locations

5. **Akash**: role-specific deployment workflows and beginner-path onboarding (`free trial`, `quick start`, wallet/no-wallet options).
- Sources:
  - https://akash.network/deploy/
  - https://akash.network/docs/getting-started/quick-start/
  - https://akash.network/docs/developers/deployment/
  - https://akash.network/docs/developers/deployment/akash-console/getting-started/

6. **Replit**: very explicit starter path (“build first app in minutes”) and plan/credit transparency.
- Sources:
  - https://replit.com/pricing
  - https://docs.replit.com/getting-started/quickstarts/ask-ai
  - https://docs.replit.com/billing/deployment-pricing

## Competitor Pattern Synthesis

1. **Most competitors collapse decision-making into one screen**: value proposition + start action + cost framing are visible together.
2. **First-success paths are explicit**: quickstart pages define step 1, step 2, first successful request/deploy.
3. **Pricing semantics are concrete**: billing units and caveats are visible before signup.
4. **Role-based entry points reduce cognitive load**: builders/operators/enterprise paths split early.

## DCP Segment Map (Conversion-Oriented)

1. **Saudi / MENA AI startup teams (Arabic-first product need)**
- Jobs-to-be-done: launch Arabic chat/search/classification quickly.
- Primary anxieties: model fit, production readiness, billing predictability.
- Message priority: Arabic model coverage + container execution clarity + predictable billing flow.

2. **Enterprise/regulated buyers (KSA procurement + compliance stakeholders)**
- Jobs-to-be-done: evaluate trust, controls, reliability, support readiness.
- Primary anxieties: legal/compliance fit, operational risk, maturity signals.
- Message priority: PDPL posture, operational controls, realistic capability language (no overclaiming).

3. **Global cost-sensitive builders comparing US/EU GPU clouds**
- Jobs-to-be-done: lower total compute cost and fast time-to-first-result.
- Primary anxieties: hidden fees, setup complexity, lock-in.
- Message priority: Saudi energy-cost structural advantage + transparent usage framing + fast first run.

4. **Saudi GPU providers (supply side)**
- Jobs-to-be-done: predictable setup and credible path to first earnings.
- Primary anxieties: setup fragility, unclear status progression, payout ambiguity.
- Message priority: installation certainty, status progression, transparent “what is live vs planned”.

## Current DCP Conversion Gaps (Codebase-Backed)

1. **Homepage trust block still mixes live and static trust stats**.
- File: `app/page.tsx`
- Evidence: `stats` includes static `75%` uptime and static GPU list while other values are dynamic.
- Risk: weak credibility against competitors with explicit billing/runtime detail.

2. **Provider and renter copy still contains payment/payout claims that may imply production readiness beyond current platform policy**.
- Files:
  - `app/lib/i18n.tsx`
  - `app/earn/page.tsx`
- Evidence: references to specific payout rails/timelines and top-up flows in localization copy while platform guidance says payment/payout implementation remains a gap.
- Risk: trust damage if users cannot complete promised financial workflows.

3. **First-success guidance is split across pages and not presented as a single “run your first workload” path from landing**.
- Files:
  - `app/page.tsx`
  - `app/renter/register/page.tsx`
  - `app/docs/quickstart/page.tsx`
- Risk: slower activation after signup versus competitor quickstart norms.

## Recommendations (Copy + Onboarding + IA)

1. **Merge value + action + trust proof above the fold on landing**.
- Put three immediate blocks in hero vicinity: `Start as Renter`, `Start as Provider`, `See Billing Flow`.
- Keep core positioning first: Saudi energy-cost advantage and Arabic model support.

2. **Create one canonical “First workload in 5-10 minutes” path for renters**.
- Route users from landing/register directly into guided sequence: register -> balance/top-up state -> choose provider -> run sample job -> view output.
- Keep this as a persistent rail on renter dashboard until first successful job.

3. **Normalize claim language to “available now” vs “planned”**.
- Replace any copy that implies fully shipped payment/payout rails when those are still in-progress.
- Use explicit neutral copy: “billing flow available in platform wallet; payout rails in rollout” (or approved equivalent).

4. **Add role-based navigation labels at the top information layer**.
- IA should expose separate tracks for Renter, Provider, Enterprise Procurement.
- Keep docs entry points aligned to each role.

5. **Expose billing semantics early and concretely**.
- Show billing unit (halala/SAR, usage unit, hold/settlement behavior) near primary CTAs.
- Add a short “How charges are calculated” disclosure with link to deeper docs.

## Implementation Checklist

| Priority | File path(s) | Exact change needed | Acceptance criteria | Suggested assignee |
|---|---|---|---|---|
| P0 | `app/page.tsx` | Replace mixed static trust stats with either fully dynamic telemetry-backed values or neutral labels that do not imply measured uptime. | No static pseudo-telemetry remains in hero trust stats; all displayed reliability values are either real-time or explicitly non-metric. | Frontend Developer |
| P0 | `app/lib/i18n.tsx`, `app/earn/page.tsx`, `app/renter/register/page.tsx` | Audit and rewrite payment/payout/top-up claims so copy reflects currently shipped capability only (no unlaunched rail promises). | No user-facing copy promises unavailable payout/payment rails; EN/AR parity maintained. | UX Copywriter + Frontend Developer |
| P0 | `app/page.tsx`, `app/docs/quickstart/page.tsx`, `app/renter/register/page.tsx`, `app/renter/page.tsx` | Introduce a single “first workload” guided path with explicit step order and persistent completion state until first successful job. | New users can complete first workload without navigation ambiguity; first successful job path measurable in analytics funnel. | Frontend Developer |
| P1 | `app/components/layout/Header.tsx`, `app/docs/[[...slug]]/page.tsx`, `app/docs/renter-guide/page.tsx`, `app/docs/provider-guide/page.tsx` | Add role-based IA entry points (Renter/Provider/Enterprise) with docs landing cards and direct quickstart links. | Top-nav and docs landing provide role paths with <2 clicks to relevant quickstart. | Frontend Developer |
| P1 | `app/renter/register/page.tsx`, `app/renter/billing/page.tsx`, `docs/pricing-guide.md` | Add concise billing semantics module near CTA: usage unit, hold/settlement behavior, and where to verify charges. | Users can identify how billing is calculated before first top-up/job submit; support tickets for billing confusion reduced. | Product + Frontend + Docs |
| P2 | `app/earn/page.tsx`, `app/provider/register/page.tsx`, `docs/provider-guide.mdx` | Create “first earnings readiness” mini-checklist (daemon online, heartbeat verified, eligible workload types). | Providers see transparent prerequisites before expecting earnings and fewer onboarding support escalations. | Frontend Developer + Docs |

## Product-Reality Guardrails

- Keep all messaging aligned with **GPU-accelerated container execution** (not bare-metal claims).
- Do not introduce unapproved financial figures or unshipped payment guarantees.
- Keep Saudi energy-cost advantage and Arabic AI support as top-level differentiators across hero and onboarding.
