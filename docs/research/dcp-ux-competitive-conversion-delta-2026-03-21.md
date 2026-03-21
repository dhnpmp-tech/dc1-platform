# DCP UX/Competitive Conversion Delta (2026-03-21)

Date: 2026-03-21 (UTC)
Owner: UX Researcher / Competitive Analyst

## Scope
- Re-validate competitor UX/messaging signals from official pages (Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit).
- Map DCP target customer segments to conversion jobs, objections, and copy angles.
- Produce implementation-ready recommendations for copy, onboarding, and IA using current DCP file structure.

## Evidence snapshot (official pages, verified 2026-03-21)

| Competitor | Verified UX/messaging signal | Source |
|---|---|---|
| Vast.ai | Pricing language emphasizes marketplace mode clarity (`On-Demand`, `Interruptible`, `Reserved`, `Per-Second Billing`). | https://vast.ai/pricing |
| RunPod | Pricing page is mode-first (`Pods`, `Serverless`) and uses a strong cost anchor (`up to 80%`). | https://www.runpod.io/pricing |
| Lambda | Blends transparent on-demand framing with enterprise/procurement branch (`Talk to our team`). | https://lambda.ai/pricing |
| Together AI | Progressive adoption ladder (`Start for free`, then `Serverless`, `Dedicated`, `Clusters`). | https://www.together.ai/pricing |
| Akash | Homepage foregrounds structural positioning (`Decentralized Compute Marketplace`, `Docker Native`). | https://akash.network/ |
| Replit | Outcome-first, low-friction promise (`Build and deploy software`, `without spending a second on setup`). | https://replit.com/ |

## DCP segment map (conversion-focused)

| Segment | Primary job-to-be-done | Main objection | Messaging that converts | Primary funnel entry |
|---|---|---|---|---|
| KSA startup renter | Launch inference/training fast on budget | Cost predictability | "Estimate hold in halala, runtime settlement, auto-refund for unused hold." | `/` -> `/renter/register` -> `/renter/playground` |
| Product/dev team renter | Get first successful run quickly | Setup complexity | "Start in browser playground, move to API/container flow when ready." | `/` -> `/renter/register` -> `/docs/quickstart` |
| Enterprise renter | Evaluate supplier for procurement/compliance | Trust + support path confidence | "Self-serve path plus explicit enterprise support/contact branch." | `/` + `/support?category=enterprise` |
| Provider (GPU owner) | Monetize idle NVIDIA hardware | Fear of unsafe/uncontrolled runtime | "Container job model + heartbeat/polling visibility + pause/resume control." | `/earn` -> `/provider/register` |
| Infra-native team | Reuse existing container workflow | Portability and lock-in risk | "Container-native execution and API-driven submission." | `/docs/quickstart` + `/docs/api` |

## Current DCP state (as-audited)

Strengths already implemented:
- Intent-based top nav (`Rent GPUs`, `Earn with GPUs`, `Marketplace`, `Docs`, `Support`).
- Intent switcher on home hero, including provider-specific path cards.
- Enterprise CTA branch from hero to support prefilled enterprise category.
- Billing explainer and first-job checklist present across key renter surfaces.
- Provider trust module exists on `/earn` and provider onboarding flow is explicit.

Remaining high-impact opportunities:
- Some footer and support-page brand copy still reads generic/decentralized and can undercut DCP's Saudi-energy + Arabic-model positioning.
- Public IA still has multiple renter entry routes with overlapping labels; intent hierarchy can be tightened.
- Comparison messaging is present but fragmented; one canonical "Why DCP" block would improve consistency.

## Recommendations

### P0 (ship first)
1. Canonical differentiator strip across top-conversion surfaces.
- Message order: (1) Saudi energy cost advantage (structural), (2) Arabic AI model support (ALLaM, Falcon, JAIS, BGE-M3), (3) container-native execution.
- Keep claims capability-based only; do not add unverified percentage/pricing claims.

2. Standardize conversion microcopy for renter path outcomes.
- Keep dual renter flows but unify one-line outcomes and labels across home/register/quickstart/playground.
- Ensure EN/AR parity for all conversion-critical blocks.

3. Replace generic/decentralized footer brand line with DCP-specific value proposition.
- Current footer text can misposition DCP as a generic decentralized network.

### P1
1. Add one compact "Why DCP vs alternatives" block in one canonical location and reuse snippets elsewhere.
- Focus on verifiable differences: Saudi energy geography, Arabic model portfolio, container workflow.

2. Tighten IA by introducing clearer intent wrappers in navigation labels (without route churn first).
- Example: keep current routes but present renter journey as `Register -> Top up -> Pick GPU -> Submit` in visible progression.

3. Strengthen enterprise conversion context on support entry.
- Add short procurement-specific expectations block (response SLA band, required intake details).

### P2
1. Add instrumentation for path intent and differentiator engagement consistency checks.
- Validate that provider-intent users choose provider CTAs, and renter-intent users complete first-job checklist.

## Implementation Checklist

| Priority | File path(s) | Exact change needed | Acceptance criteria | Suggested assignee |
|---|---|---|---|---|
| P0 | `app/page.tsx`, `app/lib/i18n.tsx` | Create/reuse a single headline-level differentiator block (Saudi energy advantage + Arabic model support + container execution) in EN/AR and place it near hero CTA cluster. | Block visible above fold on home, both languages complete, no fabricated pricing claims. | Frontend Developer + UX |
| P0 | `app/renter/register/page.tsx`, `app/docs/quickstart/page.tsx`, `app/renter/playground/page.tsx`, `app/lib/i18n.tsx` | Align renter path labels/outcomes and billing microcopy to canonical strings from i18n keys; remove drifted or duplicated wording. | Same terminology across pages; conversion copy parity in EN/AR. | Frontend Developer |
| P0 | `app/components/layout/Footer.tsx` | Replace generic brand paragraph with DCP-specific positioning (Saudi-based cost advantage + Arabic AI readiness) without numeric claims. | Footer messaging matches platform positioning and legal-safe language. | Frontend Developer + Copywriter |
| P1 | `app/page.tsx`, `app/docs/quickstart/page.tsx`, `app/lib/i18n.tsx` | Add a compact factual `Why DCP` comparison block and reuse text snippets. | One canonical block and no contradictory copy across surfaces. | UX + DevRel |
| P1 | `app/support/page.tsx`, `app/lib/i18n.tsx` | Add enterprise intake explainer near prefilled enterprise banner (what info to include, expected response window wording without hard SLA promises). | Enterprise visitors see specific next-step instructions before submitting form. | Frontend Developer + Support Ops |
| P2 | `app/page.tsx`, `app/renter/register/page.tsx`, `app/renter/playground/page.tsx` | Normalize event payload shape for `landing_path_selected`, `billing_explainer_viewed`, `first_job_checklist_step_clicked`, and blocker telemetry. | Analytics events share consistent field names and can be segmented by role/language/source. | Frontend Developer + Analytics |

## Notes on constraints
- Do not claim bare-metal GPU hosting; DCP execution is container-based with NVIDIA Container Toolkit.
- Do not invent competitor or DCP pricing figures in public copy.
- Keep differentiator claims factual, stable, and traceable to documented platform capabilities.
