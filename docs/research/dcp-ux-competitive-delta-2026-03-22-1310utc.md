# DCP UX Competitive Delta (Post-Implementation) — 2026-03-22 13:10 UTC

Owner: UX Researcher / Competitive Analyst
Scope: validate prior UX implementation wave (DCP-489 -> DCP-541) and isolate remaining conversion-critical gap
Guardrails: no fabricated pricing, no bare-metal claims, align to containerized GPU compute reality

## What Was Re-Validated

Implemented and verified in code:
- Mode-first top navigation now present (`Playground`, `Container/API`, `Enterprise`) in `app/components/layout/Header.tsx`.
- Landing role-intent chooser and path cards are present in `app/page.tsx`.
- Renter registration success flow contains explicit first-job checklist + settlement explainer in `app/renter/register/page.tsx`.
- Docs and support pages now expose role/scenario entry points in `app/docs/[[...slug]]/page.tsx` and `app/support/page.tsx`.

## External Competitive Signal Check (Official Sources, 2026-03-22 UTC)

1. Vast.ai: mode + template deploy language is explicit on homepage (GPU Cloud / Serverless / Clusters; ready-to-deploy models).
2. RunPod: pricing IA keeps compute modes separated, reducing decision ambiguity.
3. Together.ai: pricing flow clearly signals progression from fast start to dedicated scale.
4. Replit: role-oriented navigation minimizes repeated intent decisions.
5. Akash: quickstart emphasizes immediate deployment path with short step sequences.

## Remaining Gap (P1)

Gap: role intent is selected but not persisted as a global UX state.
- Impact: users still re-decide renter/provider/enterprise context when moving between landing, header nav, docs, and support.
- Conversion risk: extra navigation friction and weaker continuation signal after first intent declaration.

## New Implementation Issue Created

- Issue: `DCP-542`
- Title: `P1 UX continuity: persist role intent across header/docs/support to reduce re-navigation`
- Priority: `high`
- Status: `todo`
- Proposed files:
  - `app/page.tsx`
  - `app/components/layout/Header.tsx`
  - `app/docs/[[...slug]]/page.tsx`
  - `app/support/page.tsx`
  - `app/lib/i18n.tsx`

## Implementation Checklist

1. Persist role intent (`renter`/`provider`/`enterprise`) on landing/docs/support selection actions.
2. Add compact intent switcher in header with current intent + one-click override.
3. Auto-apply intent to docs/support deep links while preserving manual override.
4. Track `role_intent_persisted`, `role_intent_applied`, `role_intent_overridden` analytics events.
5. Ensure EN/AR parity for all new intent-switcher and helper-copy strings.

## Sources

- https://vast.ai/
- https://www.runpod.io/pricing
- https://www.together.ai/pricing
- https://replit.com/
- https://akash.network/docs/getting-started/quick-start/
