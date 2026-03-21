# DCP-495: Conversion Gap Follow-up (Post-Implementation)

Date: 2026-03-21 (UTC)
Owner: UX Researcher / Competitive Analyst

## Scope
- Validate current DCP frontend state against previously recommended conversion improvements.
- Re-verify competitor messaging patterns from official pages on 2026-03-21.
- Identify remaining high-impact UX/messaging gaps with concrete file-level implementation steps.

## Evidence refresh (official pages, verified 2026-03-21)

| Competitor | Verified signal | Source |
|---|---|---|
| Vast.ai | Pricing page title emphasizes live marketplace rates and pricing modes (`on-demand`, `interruptible`, `reserved`). | https://vast.ai/pricing |
| RunPod | Pricing page content includes mode framing (`Pods`, `Serverless`) and `up to 80%` cost anchor language. | https://www.runpod.io/pricing |
| Lambda | Pricing page metadata emphasizes transparent on-demand + reserved enterprise capacity path. | https://lambda.ai/pricing |
| Together AI | Pricing page includes progressive ladder language (`Start for free`) and mode progression (`Serverless`, `Dedicated endpoints`, `Clusters`). | https://www.together.ai/pricing |
| Akash | Homepage title presents `Decentralized Compute Marketplace`. | https://akash.network/ |
| Replit | Homepage description emphasizes immediate setup minimization (`without spending a second on setup`). | https://replit.com/ |

## Current DCP implementation status (as-audited)

Implemented in current codebase:
- Explicit renter path cards in first viewport and role chips on home.
- Enterprise CTA near hero path chooser.
- Billing explainer modules on home/register/quickstart.
- Playground first-job wizard + progressive advanced settings.
- Auth-intent restore flow and first submit instrumentation.
- Submission readiness module with explicit blocker recovery CTA.
- Job detail summary with retry/variant/export actions.

Primary remaining gaps:

### P0 — EN/AR parity regression in conversion-critical blocks
Observation:
- Recently added conversion modules contain hardcoded English strings in key funnel surfaces (home + playground), while bilingual parity is required across core messaging.

Evidence in code:
- `app/page.tsx`: hardcoded English in billing explainer, model strip headline, usage-path section labels/content.
- `app/renter/playground/page.tsx`: hardcoded English for submission-readiness labels/blocker copy.

Risk:
- Arabic-first users see mixed-language journey at decision moments (path choice, billing confidence, pre-submit readiness), reducing trust and completion.

Recommendation:
- Move all conversion-critical strings introduced in recent sprint into `app/lib/i18n.tsx` and consume via `t(...)` on these pages.

### P0 — Analytics taxonomy drift for blocker events
Observation:
- Existing instrumentation emits `submit_blocked_reason` while rollout planning and issue specs used `playground_submit_blocked_reason` naming.

Evidence in code:
- `app/renter/playground/page.tsx` emits `submit_blocked_reason`.

Risk:
- Dashboard/reporting fragmentation and broken trend continuity across UX experiments.

Recommendation:
- Emit canonical event key (`playground_submit_blocked_reason`) and optionally dual-emit legacy key for one release to preserve continuity.

### P1 — Provider-intent chip does not fully switch content hierarchy
Observation:
- Selecting `I have GPUs` changes emphasis, but hero path cards remain renter-only; provider outcome path is still separated to button row.

Evidence in code:
- `app/page.tsx` hero card grid always renders renter-path cards (`Playground`, `Container Jobs`) and only changes opacity.

Risk:
- Provider visitors can still misread first viewport as renter-first product despite selecting provider intent.

Recommendation:
- Conditional hero card rendering by selected intent:
  - `renter`: current two renter cards
  - `provider`: two provider cards (`Register GPU`, `Install Daemon`) with explicit outcomes

### P1 — Canonical billing copy drift across pages
Observation:
- Billing explainer appears in all required pages, but wording variants differ slightly and are currently hardcoded in multiple files.

Evidence in code:
- `app/page.tsx`, `app/renter/register/page.tsx`, `app/docs/quickstart/page.tsx` each define standalone billing copy blocks.

Risk:
- Policy/legal phrasing drift over time and inconsistent user understanding of hold/settlement/refund behavior.

Recommendation:
- Centralize billing explainer copy in `app/lib/i18n.tsx` as shared keys used by all three pages.

## Implementation Checklist

| Priority | File path(s) | Exact change needed | Acceptance criteria | Suggested assignee |
|---|---|---|---|---|
| P0 | `app/page.tsx`, `app/renter/playground/page.tsx`, `app/lib/i18n.tsx` | Move all hardcoded conversion copy to i18n keys and wire EN/AR parity. | No hardcoded English in conversion modules on these pages; EN/AR output parity maintained. | Frontend Developer |
| P0 | `app/renter/playground/page.tsx` | Standardize blocker event to `playground_submit_blocked_reason` (optionally dual-emit legacy for one release). | Analytics pipeline receives canonical event name in staging/prod validation. | Frontend Developer + Analytics |
| P1 | `app/page.tsx`, `app/lib/i18n.tsx` | Render provider-specific hero cards when provider intent is selected, including explicit outcome text. | Provider-first visitor can identify provider onboarding path without scanning secondary CTAs. | Frontend Developer |
| P1 | `app/page.tsx`, `app/renter/register/page.tsx`, `app/docs/quickstart/page.tsx`, `app/lib/i18n.tsx` | Consolidate billing explainer into shared i18n block reused across all decision surfaces. | Copy matches exactly across all 3 pages and remains bilingual. | Frontend Developer + DevRel |

## Suggested follow-up issues
1. P0: `i18n parity hardening for conversion-critical copy (home + playground)`
2. P0: `analytics event taxonomy normalization for playground blockers`
3. P1: `provider-intent conditional hero cards`
4. P1: `canonical shared billing explainer keys across home/register/quickstart`
