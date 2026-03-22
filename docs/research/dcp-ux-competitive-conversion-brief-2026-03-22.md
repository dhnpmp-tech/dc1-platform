# DCP UX Competitive Brief: Conversion Copy, Onboarding, and IA

Date: 2026-03-22 UTC
Owner: UX Researcher / Competitive Analyst
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit
Guardrails: No fabricated pricing, no bare-metal claims, recommendations aligned to container-based GPU execution.

## Evidence Summary (Official Sources)

| Competitor | Notable UX pattern | Evidence | DCP translation |
|---|---|---|---|
| Vast.ai | Marketplace economics are explicit in acquisition flow (mode + billing framing). | https://vast.ai/pricing | Keep DCP billing semantics visible before registration and top-up decisions. |
| RunPod | Strong mode segmentation (pods/serverless/endpoints) with direct mode-level CTA. | https://www.runpod.io/pricing | Preserve two clear renter paths: browser-first quick start and API/container jobs. |
| Lambda | Self-serve + enterprise procurement coexist in one funnel. | https://lambda.ai/pricing | Keep self-serve primary CTA, but expose enterprise branch near top CTAs. |
| Together.ai | Progressive journey from early usage to dedicated scale paths. | https://www.together.ai/pricing | Show DCP ladder clearly: first job in browser, then repeatable container/API workflows. |
| Akash | Container portability and marketplace framing are headline-level. | https://akash.network/ | Keep container reality above fold and in docs root navigation cards. |
| Replit | Deployment docs emphasize deployment type clarity and billing model fit by workload. | https://docs.replit.com/billing/deployment-pricing | Improve role-based IA so users pick the right path quickly (renter/provider/enterprise). |

## DCP Segment Map (Conversion-Focused)

1. Renter (startup/product team)
- Trigger: run first workload quickly.
- Friction: uncertainty about cost and first step.
- Message: start in browser, then scale to API/container jobs; settlement is runtime-based.

2. Renter (enterprise/procurement)
- Trigger: production evaluation.
- Friction: trust, support, and procurement path visibility.
- Message: explicit enterprise route plus PDPL-aware documentation and support categories.

3. Provider (single GPU owner / small fleet)
- Trigger: monetize idle GPU safely.
- Friction: unclear next action after registration.
- Message: register -> install daemon -> heartbeat -> ready for routing, with state-based next action.

4. Arabic AI teams (MENA)
- Trigger: Arabic model execution fit.
- Friction: concern that Arabic support is secondary.
- Message: Arabic model support (ALLaM/Falcon/JAIS/BGE) appears in first viewport and docs entry.

## DCP Gap Snapshot (Current Pages)

- `app/page.tsx`: strong differentiators are present, but first-action outcome language can be more explicit per path card.
- `app/docs/[[...slug]]/page.tsx`: docs portal has good map cards; missing explicit role chooser that mirrors renter/provider/enterprise intent.
- `app/support/page.tsx`: enterprise prefill exists, but first viewport is contact-form-first rather than role/problem routing.
- `app/renter/register/page.tsx` and `app/provider/register/page.tsx`: onboarding checklists exist and are useful; should be normalized as a single canonical progression model across docs + app.

## Priority Recommendations

### P0

1. Path clarity copy at first decision point
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Change: each path card gets one explicit outcome line:
  - Renter path: "Run first workload now; move to API/container when ready."
  - Provider path: "Complete daemon heartbeat to become job-eligible."
- Acceptance criteria: user can choose renter/provider path in <=2 clicks without scrolling.

2. Canonical onboarding sequence parity
- Files: `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/docs/quickstart/page.tsx`, `app/lib/i18n.tsx`
- Change: standardize checklist semantics and ordering across all onboarding surfaces.
- Acceptance criteria: no contradictory step names or order across onboarding pages.

3. Support IA triage before form
- Files: `app/support/page.tsx`, `app/lib/i18n.tsx`
- Change: add top-of-page triage cards (`Provider Setup`, `Job Failure`, `Billing`, `Enterprise`) before generic form.
- Acceptance criteria: first viewport offers role/use-case routing, then form.

### P1

4. Docs role router module on docs home
- Files: `app/docs/[[...slug]]/page.tsx`
- Change: add prominent role routes for `Renter`, `Provider`, `Enterprise` with direct links to quickstart/provider guide/support?category=enterprise.
- Acceptance criteria: docs home exposes role router above documentation map.

5. Enterprise branch consistency in nav and footer
- Files: `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx`
- Change: add consistent enterprise CTA label and target route.
- Acceptance criteria: enterprise route is discoverable from top nav and footer in EN/AR parity.

6. Conversion instrumentation parity
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`
- Change: add analytics events for path select, role-triage click, and checklist completion step click.
- Acceptance criteria: events fire with source page + selected role/use case metadata.

## Conversion Copy Proposals (Safe)

- Hero support line: "Saudi-hosted GPU compute with first-class Arabic AI support. Start in-browser, then scale through container jobs."
- Renter path helper: "Estimate hold appears before run; final settlement uses actual runtime; unused hold is returned automatically."
- Provider path helper: "Daemon heartbeat confirms readiness. Routing eligibility starts once status is online or idle."

## Implementation Checklist

1. P0: first-decision path outcome lines
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Assignee: Frontend Developer
- Acceptance: renter/provider selection clarity in first viewport.

2. P0: onboarding step parity across app + docs
- Files: `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/docs/quickstart/page.tsx`, `app/lib/i18n.tsx`
- Assignee: Frontend Developer
- Acceptance: step sequence and terminology aligned.

3. P0: support triage cards before form
- Files: `app/support/page.tsx`, `app/lib/i18n.tsx`
- Assignee: Frontend Developer
- Acceptance: role/use-case cards appear above form and link correctly.

4. P1: docs home role router
- Files: `app/docs/[[...slug]]/page.tsx`
- Assignee: Frontend Developer
- Acceptance: role router visible above docs map.

5. P1: enterprise CTA consistency
- Files: `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx`
- Assignee: Frontend Developer
- Acceptance: enterprise route present in both nav/footer.

6. P1: analytics event parity
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`
- Assignee: Frontend Developer / Analytics owner
- Acceptance: events emitted with role/use-case context.

## Sources

- Vast: https://vast.ai/pricing
- RunPod: https://www.runpod.io/pricing
- Lambda: https://lambda.ai/pricing
- Together.ai: https://www.together.ai/pricing
- Akash: https://akash.network/
- Replit deployment billing docs: https://docs.replit.com/billing/deployment-pricing
