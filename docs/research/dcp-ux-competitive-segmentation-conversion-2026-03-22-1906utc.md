# DCP UX Competitive Analysis: Conversion Copy, Onboarding, and IA (Delta)

Date: 2026-03-22 19:06 UTC  
Owner: UX Researcher / Competitive Analyst  
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit  
Guardrails: No fabricated pricing claims; no bare-metal claims; recommendations aligned to container-based GPU compute.

## Executive Summary

Competitors are converging on three conversion patterns:
1. Clear product-mode segmentation (self-serve vs dedicated/enterprise) on first view.
2. Transparent billing semantics directly in the acquisition flow.
3. Role-specific first task CTA (developer quickstart, provider onboarding, enterprise contact).

DCP already has strong primitives (role intent, bilingual copy, marketplace pages), but conversion can improve by tightening above-the-fold outcome language, reducing support-form-first friction, and enforcing a single onboarding progression model across landing/register/docs/support.

## Evidence Snapshot (Official Sources)

| Competitor | Observed UX/Messaging Pattern | Evidence | DCP Implication |
|---|---|---|---|
| Vast.ai | Marketplace + real-time pricing + deploy flow are explicit above fold. | Vast homepage and pricing page highlight "Real-Time GPU Pricing", "Add Credit -> Search GPUs -> Deploy", and "On-demand/interruptible/reserved" modes. https://vast.ai/ , https://vast.ai/pricing | Keep DCP renter journey explicit as sequence, not just feature cards. |
| RunPod | Product-mode architecture is primary nav and pricing structure (Pods, Serverless, Clusters, Reserved). | RunPod pricing nav and sections separate Pods, Serverless, Instant/Reserved Clusters; includes "no setup, scaling, or idle costs" language. https://www.runpod.io/pricing | DCP should keep mode choice prominent: browser-first quickstart vs container/API vs enterprise reserved capacity intake. |
| Lambda | Clean split between self-serve launch and sales-assisted scale path. | Lambda pricing shows "Launch GPU instance" and "Talk to our team" in same hero, plus cluster scale framing. https://lambda.ai/pricing | Maintain dual CTA strategy on DCP: self-serve primary + enterprise procurement secondary. |
| Akash | Positioning ties open marketplace economics to container-native portability. | Akash homepage uses "decentralized compute marketplace", "Docker Native", "If it runs in a container, it runs here." https://akash.network/ | Keep DCP container reality explicit in hero/support/docs to set correct buyer expectations. |
| Together.ai | Progressive scaling ladder is explicit from serverless to dedicated endpoints/clusters. | Together pricing states teams start with serverless and move to dedicated at scale; side-by-side product taxonomy. https://www.together.ai/pricing | DCP should visually map "first job -> repeat jobs -> enterprise scale" with one canonical ladder. |
| Replit | Billing tied to workload type and deployment mode with plain-language chooser. | Replit docs present deployment-type chooser and billing semantics by mode. https://docs.replit.com/billing/deployment-pricing | DCP should align compute mode + billing semantics at each decision step to reduce uncertainty. |

## DCP Segment Map (Targeted for Conversion)

1. `Renter - self-serve builder`
- Trigger: run first workload quickly.
- Core anxiety: unclear first step and cost behavior.
- Best message: "Start in browser, then move to container/API when repeatability matters."

2. `Renter - enterprise/procurement`
- Trigger: evaluate for production and policy alignment.
- Core anxiety: support path, residency/compliance, rollout certainty.
- Best message: "Enterprise intake for reserved capacity, rollout planning, and PDPL-aware support."

3. `Provider - single GPU/small fleet`
- Trigger: monetize idle NVIDIA GPU.
- Core anxiety: what to do after API key issuance.
- Best message: "Register -> install daemon -> heartbeat -> eligible for routing."

4. `Arabic AI teams (MENA)`
- Trigger: Arabic model support without workaround stack.
- Core anxiety: Arabic support is marketing-only.
- Best message: "Arabic models are first-class in docs + marketplace decision flow."

## Current DCP UX Gaps (File-Mapped)

1. `app/page.tsx`
- Gap: path cards are present but outcome language is still partially feature-oriented.
- Risk: mode confusion at the first decision point.

2. `app/renter/register/page.tsx` + `app/provider/register/page.tsx`
- Gap: both have strong checklists/progression, but wording/ordering is not fully normalized as one platform model.
- Risk: cross-surface inconsistency between landing/docs/register.

3. `app/support/page.tsx`
- Gap: form remains dominant; triage exists through params/logic but not as strong card-first decision UI in first viewport.
- Risk: users submit generic tickets instead of role-specific routes.

4. `app/docs/[[...slug]]/page.tsx`
- Gap: role cards are strong on docs root, but onboarding ladder framing (first job -> repeatability -> scale) can be made more explicit and mirrored with landing/support copy.
- Risk: docs can feel broad before giving concrete "next best step" by segment.

## Recommendations

### P0

1. First-decision copy hardening on landing
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Exact change:
  - Add one-line outcome under each role path card.
  - Renter: "Run your first workload now; move to API/container for repeat jobs."
  - Provider: "Become routing-eligible once daemon heartbeat is online."
  - Enterprise: "Start procurement intake for reserved capacity and rollout planning."
- Why: mirrors competitor mode segmentation clarity without claiming unimplemented billing rails.

2. Canonical onboarding ladder parity
- Files: `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/docs/quickstart/page.tsx`, `app/docs/provider-guide/page.tsx`, `app/lib/i18n.tsx`
- Exact change:
  - Standardize step labels into one ladder vocabulary:
    - Register/Authenticate
    - Configure Runtime (top-up for renter, daemon install for provider)
    - Validate Readiness (marketplace compatibility or heartbeat online)
    - Execute/Monetize (submit first job or receive first routed job)
- Why: reduces mental context-switch across app and docs.

3. Support IA: route before form
- Files: `app/support/page.tsx`, `app/lib/i18n.tsx`
- Exact change:
  - Add top-of-page triage cards above contact form:
    - Provider setup
    - Job failure / output issue
    - Billing and wallet
    - Enterprise capacity planning
  - Preserve form as secondary action.
- Why: directs users to highest-intent path, improving conversion and support signal quality.

### P1

4. Marketplace and register copy alignment to mode reality
- Files: `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Exact change:
  - Add helper microcopy near CTA that states container/API progression and runtime settlement semantics.
- Why: reduces mismatch between "browse" vs "run" expectations.

5. Enterprise CTA consistency in shell nav/footer
- Files: `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx`
- Exact change:
  - Normalize enterprise CTA labels and query params so support intake entry is consistent from all nav surfaces.
- Why: matches competitor dual-path acquisition pattern.

6. Arabic-model proof points in high-intent moments
- Files: `app/page.tsx`, `app/renter/marketplace/page.tsx`, `app/docs/model-cards.mdx`
- Exact change:
  - Add compact "Arabic model ready" module with links to model cards.
- Why: reinforces DCP differentiator before user churn to alternatives.

### P2

7. Unified conversion instrumentation across steps
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/renter/marketplace/page.tsx`
- Exact change:
  - Standardize event names/properties for:
    - role selected
    - onboarding step advanced
    - support triage selected
    - first job submitted / first provider heartbeat online
- Why: enables funnel-level optimization by segment.

## Implementation Checklist

1. `P0` Landing outcome copy per role
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Suggested assignee: Frontend Developer
- Acceptance criteria:
  - Each role card has explicit outcome sentence.
  - EN/AR parity present.
  - No claims about unimplemented payment rails.

2. `P0` Canonical onboarding ladder normalization
- Files: `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/docs/quickstart/page.tsx`, `app/docs/provider-guide/page.tsx`, `app/lib/i18n.tsx`
- Suggested assignee: Frontend Developer + UX Writer
- Acceptance criteria:
  - Step names/order match across all listed files.
  - Renter/provider flows remain container-based and API-key-auth consistent.

3. `P0` Support triage-first IA
- Files: `app/support/page.tsx`, `app/lib/i18n.tsx`
- Suggested assignee: Frontend Developer
- Acceptance criteria:
  - Triage cards visible in first viewport before form.
  - Card click preselects category and preserves analytics fields.

4. `P1` Marketplace/register copy alignment
- Files: `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Suggested assignee: Frontend Developer + UX Writer
- Acceptance criteria:
  - CTA-adjacent microcopy reflects runtime settlement and mode progression.
  - No pricing figures are invented.

5. `P1` Enterprise CTA consistency
- Files: `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx`
- Suggested assignee: Frontend Developer
- Acceptance criteria:
  - Same enterprise label and target semantics across header/footer.
  - Query params maintain attribution source.

6. `P2` Analytics parity
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/renter/marketplace/page.tsx`
- Suggested assignee: Frontend Developer / Analytics owner
- Acceptance criteria:
  - Event schema shared and documented.
  - Role + source + step metadata present on all conversion events.

## Sources

- Vast.ai homepage: https://vast.ai/
- Vast.ai pricing: https://vast.ai/pricing
- RunPod pricing: https://www.runpod.io/pricing
- Lambda pricing: https://lambda.ai/pricing
- Akash homepage: https://akash.network/
- Together.ai pricing: https://www.together.ai/pricing
- Replit deployment pricing docs: https://docs.replit.com/billing/deployment-pricing
