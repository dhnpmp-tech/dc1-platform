# DCP UX Competitive + Segmentation Conversion Brief (2026-03-22 20:26 UTC)

Owner: UX Researcher / Competitive Analyst  
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit + live DCP surface audit (`app/page.tsx`, support, register, marketplace, docs shell).

Guardrails: no fabricated pricing/savings claims; no bare-metal wording; recommendations aligned to container-based GPU execution.

## Executive Summary

DCP now matches competitor baseline patterns on role-based onboarding and support triage, but conversion friction remains in two places:

1. Enterprise CTA taxonomy is inconsistent across header/footer/docs entry points.
2. Marketplace trust metrics are present but their meaning is not explained consistently at decision time.

Both are fixable without new backend capabilities.

## Evidence (Competitor Patterns)

- Vast.ai: acquisition flow and mode split are explicit above the fold (marketplace + pricing clarity). Source: https://vast.ai/
- RunPod: product modes are primary IA (Pods, Serverless, Clusters), reducing first-click ambiguity. Source: https://www.runpod.io/pricing
- Lambda: self-serve and enterprise procurement are equally visible in acquisition surfaces. Source: https://lambda.ai/pricing
- Akash: container-native portability message is explicit and repeated. Sources: https://akash.network/ and https://akash.network/docs/learn/core-concepts/gpu-deployments/
- Together.ai: clear progression from easy start to dedicated scale. Source: https://www.together.ai/pricing
- Replit: mode/billing chooser language is plain and decision-oriented. Source: https://docs.replit.com/billing/deployment-pricing

## Evidence (Current DCP UX Audit)

- `app/page.tsx`: role intent and progression copy are present and conversion-oriented.
- `app/support/page.tsx`: triage-first IA and truthful API/fallback state messaging are present.
- `app/renter/register/page.tsx` and `app/provider/register/page.tsx`: onboarding ladders and first-task guidance are present.
- `app/docs/[[...slug]]/page.tsx`: docs root has role cards and enterprise intake lane.
- Remaining drift:
  - `app/components/layout/Header.tsx` uses source-tagged enterprise/support routing.
  - `app/components/layout/Footer.tsx` uses mostly unsourced support links and mixed taxonomy.
  - `app/renter/marketplace/page.tsx` and `app/marketplace/page.tsx` show trust metrics, but interpretation copy is uneven.

## DCP Segment Map (Conversion-Critical)

1. Renter (self-serve builder)
- Trigger: run first workload quickly.
- Objection: route confusion (playground vs marketplace vs docs).
- Winning message: "Start in browser now, then move to API/container for repeat workloads."

2. Provider (solo/fleet)
- Trigger: monetize idle NVIDIA GPUs.
- Objection: post-registration uncertainty.
- Winning message: "Install daemon, confirm heartbeat, then become routing-eligible."

3. Enterprise evaluator
- Trigger: procurement + risk review.
- Objection: unclear intake path and ownership.
- Winning message: "Use enterprise intake for reserved capacity planning and deployment review."

4. Arabic AI team (MENA)
- Trigger: Arabic model execution without workaround stack.
- Objection: fear that support is marketing-only.
- Winning message: "Arabic model paths are documented and routable in container-based workflows."

## Priority Recommendations (File-Mapped)

### P0

1. Normalize enterprise CTA taxonomy + source tags
- Files: `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx`
- Change:
  - One canonical enterprise/support label family.
  - Add consistent `source=` tags across footer support links.
- Acceptance criteria:
  - Enterprise/support labels are semantically consistent in header/footer/docs.
  - Analytics attribution can compare nav/footer/hero intake paths without remapping.

2. Add trust-interpretation helper copy to marketplace cards
- Files: `app/renter/marketplace/page.tsx`, `app/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Change:
  - Under trust metrics, add one-line interpretation:
    - heartbeat age = recency signal,
    - success rate = historical reliability signal,
    - runtime settlement reminder.
- Acceptance criteria:
  - Each provider card has metrics + plain-language meaning.
  - No unsupported SLA/payout promises.

### P1

3. Analytics event schema parity for conversion steps
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/renter/marketplace/page.tsx`
- Change:
  - Standardize payload keys (`source_page`, `role`, `step`, `destination`).
- Acceptance criteria:
  - Funnel comparisons across roles/pages do not require custom key translation.

4. Final copy parity pass for enterprise intent state
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Change:
  - Ensure enterprise helper and secondary CTA text never inherit renter/provider wording during intent switch.
- Acceptance criteria:
  - Enterprise state reads procurement-first end-to-end.

## Implementation Checklist

1. P0 enterprise CTA normalization
- Suggested assignee: Frontend Developer
- Pages/components: header + footer + i18n

2. P0 marketplace trust interpretation
- Suggested assignee: Frontend Developer + UX Writer
- Pages/components: renter marketplace + public marketplace + i18n

3. P1 analytics schema parity
- Suggested assignee: Frontend Developer / Analytics owner
- Pages/components: landing + support + register + marketplace

4. P1 enterprise intent copy parity
- Suggested assignee: Frontend Developer + Copywriter
- Pages/components: landing + i18n
