# DCP UX Conversion Delta (Post-Implementation Validation)
Date: 2026-03-22 21:16 UTC
Role: UX Researcher / Competitive Analyst

## Scope
Validation pass on implemented conversion recommendations across:
- `app/page.tsx`
- `app/renter/register/page.tsx`
- `app/renter/marketplace/page.tsx`
- `app/support/page.tsx`
- `docs/quickstart.mdx`
- `docs/models/index.mdx`
- `app/jobs/submit/page.tsx`

Reference benchmark context remains unchanged from prior study set: Vast.ai, Runpod, Lambda, Akash, Together.ai, Replit.

## What Is Already Strong
1. Four-lane path chooser is now consistently surfaced in core conversion pages (landing/register/marketplace).
2. Marketplace now includes intent-forward quick filters and a "Start here" action block.
3. Support flow correctly distinguishes API success vs fallback (no false persistence claim).
4. Quickstart docs now lead with role lanes and explicit containerized execution model.

## Remaining Conversion Gaps (Actionable)

### P0: Canonical submit-route consistency is still leaking legacy path
Evidence:
- `app/renter/register/page.tsx` first workload step links to `/jobs/submit`.
- `app/renter/marketplace/page.tsx` start-here CTA links/tracks `/jobs/submit`.
- `/jobs/submit` currently redirects to `/renter/playground`, so behavior works, but UX telemetry and information scent are split across old/new route labels.

Why this matters:
- Competitor onboarding patterns keep one explicit canonical first-run path. DCP still teaches two labels for the same action (legacy + canonical), increasing decision friction and analytics noise.

Recommendation:
- Update all user-facing onboarding CTAs and event destinations to canonical `/renter/playground` only.
- Keep `/jobs/submit` redirect for backward compatibility but stop presenting it in UI copy/links.

### P1: Arabic model quick-launch block is still missing at top of models index
Evidence:
- `docs/models/index.mdx` lists models in table form but does not provide a top "quick-launch" cluster for ALLaM/Falcon/JAIS/BGE-M3.

Why this matters:
- DCP differentiation requires Arabic AI support to be first-class and immediate, not discovered after scanning a long table.

Recommendation:
- Add a top section with four direct model-launch cards/links before the full catalog table.

### P2: Redirect interstitial design language is off-brand and non-localized
Evidence:
- `app/jobs/submit/page.tsx` uses hardcoded colors and hardcoded English redirect text.

Why this matters:
- It is a transitional surface still reachable from legacy links. Mismatched styling and non-localized copy reduce trust continuity.

Recommendation:
- Replace inline dark palette with design-token classes and i18n strings.

## Implementation Checklist
1. P0: Canonical submit path in renter conversion flow
- File paths:
  - `app/renter/register/page.tsx`
  - `app/renter/marketplace/page.tsx`
  - optional validation sweep: `app/jobs/page.tsx`
- Exact change:
  - Replace all user-facing `/jobs/submit` links with `/renter/playground`.
  - Update analytics `destination` fields to canonical path.
- Acceptance criteria:
  - No renter-facing CTA advertises `/jobs/submit`.
  - Legacy route remains redirect-only compatibility path.
- Suggested assignee role: Frontend Developer

2. P1: Arabic model quick-launch block at models index
- File paths:
  - `docs/models/index.mdx`
  - `app/docs/[[...slug]]/page.tsx` (if needed for render/anchor behavior)
- Exact change:
  - Add top "Arabic AI Quick Launch" section with direct links for ALLaM, Falcon, JAIS, BGE-M3.
- Acceptance criteria:
  - All four Arabic model links visible before catalog table.
  - One-click access to each model page from top section.
- Suggested assignee role: Technical Writer / Frontend Developer

3. P2: Redirect interstitial consistency
- File paths:
  - `app/jobs/submit/page.tsx`
  - `app/lib/i18n.tsx`
- Exact change:
  - Localize redirect message and replace hardcoded visual styles with DCP design tokens.
- Acceptance criteria:
  - Redirect message appears in EN/AR.
  - No hardcoded hex background in this page.
- Suggested assignee role: Frontend Developer
