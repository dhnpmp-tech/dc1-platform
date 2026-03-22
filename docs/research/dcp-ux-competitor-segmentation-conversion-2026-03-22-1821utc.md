# DCP UX Competitive Analysis + Segment-to-Conversion Plan (2026-03-22 18:21 UTC)

Owner: UX Researcher / Competitive Analyst

## Scope
- Competitor UX/messaging scan: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit
- DCP segment map for conversion copy, onboarding, and information architecture
- Implementation-ready recommendations constrained to current DCP product reality (container-based GPU compute)

## Evidence Snapshot (Official Pages, checked 2026-03-22 UTC)

| Competitor | Evidence observed | Conversion pattern to learn from | Source |
|---|---|---|---|
| Vast.ai | Emphasizes marketplace mechanics and pricing trust (`Real-Time GPU Pricing`, `No hidden fees`) | Put billing mechanics near first action, not deep in docs | https://vast.ai/ |
| RunPod | Mode-based pathing (`Cloud GPUs`, `Serverless`, and "Scale with Serverless when you're ready for production") | Reduce ambiguity by separating "quick start" vs "production path" early | https://www.runpod.io/ |
| Lambda | Pricing page combines transparent on-demand tables with enterprise lane (`Talk to our team`, reserved capacity) | Keep self-serve and procurement-assisted paths visible together | https://lambda.ai/pricing |
| Akash | Homepage leads with portability/decentralization (`decentralized compute marketplace`, `Deploy On Console`) | Lead with deployment portability and fast first success | https://akash.network/ |
| Together.ai | AI-native platform framing and explicit serverless/fine-tuning product language | Message a clear maturity ladder from initial inference to scaled workloads | https://www.together.ai/ |
| Replit | Intent-first copy (`What will you build?`, "Turn ideas into apps in minutes") and low-friction start CTA | Keep first interaction centered on user intent and immediate progress | https://replit.com/ |

## DCP Target Segment Map (Conversion-Oriented)

| Segment | Primary job-to-be-done | Main objection | Message that should win | Primary page(s) |
|---|---|---|---|---|
| Startup renter (KSA/MENA) | Launch first AI feature quickly | Cost uncertainty | "Prepay estimate in halala; final billing settles on actual runtime." | `/`, `/renter/register`, `/renter/playground` |
| SME product team | Go from experiment to repeatable container jobs | Setup complexity | "Start browser-first, move to API+container jobs when ready." | `/`, `/docs/quickstart`, `/renter/register` |
| Enterprise/procurement buyer | Validate platform trust before technical trial | Governance and support confidence | "Container-based execution + support/legal path + roadmap status transparency." | `/support`, `/docs/[[...slug]]`, `/enterprise` |
| GPU provider (individual/small fleet) | Monetize idle NVIDIA hardware | Install/payout confidence | "Guided daemon onboarding, explicit state tracking, clear earnings math assumptions." | `/provider/register`, `/provider/download`, `/earn` |
| Infra-native buyer | Port existing Dockerized workloads | Migration risk | "If it runs in a GPU container, DCP can run it with minimal adaptation." | `/docs/quickstart`, `/docs/api` |

## Priority Recommendations (File-Level)

### P0: Above-the-fold intent + trust clarity
1. Strengthen hero path framing into two renter modes: `Playground (browser-first)` and `Container Jobs (API + Docker image)` while keeping provider and enterprise intents explicit.
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Acceptance criteria: first viewport always shows role-intent choices with one-line outcome copy per path.

2. Standardize billing truth copy at decision surfaces.
- Files: `app/page.tsx`, `app/renter/register/page.tsx`, `app/docs/quickstart/page.tsx`, `app/lib/i18n.tsx`
- Acceptance criteria: includes estimate hold -> runtime settlement -> unused hold release language; no guaranteed savings claims.

3. Add a procurement-ready trust/status block in docs entry flow.
- Files: `app/docs/[[...slug]]/page.tsx`
- Acceptance criteria: clear split between available now vs roadmap milestones; links to roadmap and trust pages.

### P0: Provider onboarding conversion reliability
4. Ensure provider install commands and success-state guidance are unambiguous and state-driven.
- Files: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`, `app/lib/provider-install.ts`
- Acceptance criteria: one dominant next action by onboarding state (`waiting`, `heartbeat`, `ready`, `paused`, `stale`); commands align with canonical backend endpoints.

### P1: Information architecture and navigation intent
5. Keep public nav labels action-oriented for new traffic.
- Files: `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx`
- Acceptance criteria: labels map to renter intent, provider intent, marketplace, docs, and support without jargon.

6. Add "first successful job" checklist continuity after renter registration and quickstart docs.
- Files: `app/renter/register/page.tsx`, `app/docs/quickstart/page.tsx`
- Acceptance criteria: checklist steps deep-link to top-up, marketplace, starter job, monitor/results.

### P1: Messaging guardrails for all market-facing copy
7. Enforce claim-safe language across conversion pages.
- Files: `app/page.tsx`, `app/earn/page.tsx`, `app/support/page.tsx`, `docs/provider-pitch-en.md`, `docs/content/provider-acquisition-en.md`
- Acceptance criteria:
  - No fabricated pricing or savings percentages.
  - No "bare-metal" claims.
  - Roadmap items (Swarm/Page Agents/expanded model portfolio) always labeled as milestone-based availability.

## Recommended Copy Direction (Safe + Differentiated)
- Lead line order on key pages: Saudi structural energy-cost advantage -> Arabic AI model support -> container execution reality.
- Add explicit qualifier near all cost language: "final cost depends on workload profile, runtime, and current availability."
- Keep Arabic AI support concrete: ALLaM 7B, Falcon H1, JAIS 13B, BGE-M3.

## Implementation Checklist

### P0
1. `app/page.tsx`, `app/lib/i18n.tsx`
- Add/verify role-intent mode copy and billing-truth block near first CTA cluster.
- Suggested assignee: Frontend Developer

2. `app/docs/[[...slug]]/page.tsx`
- Add retail-readiness status module with links to roadmap/trust assets.
- Suggested assignee: Frontend Developer

3. `app/provider/register/page.tsx`, `app/provider/download/page.tsx`
- Tighten command consistency and onboarding next-action hierarchy.
- Suggested assignee: Frontend Developer

### P1
4. `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx`
- Refine public nav labels for intent clarity.
- Suggested assignee: Frontend Developer

5. `app/renter/register/page.tsx`, `app/docs/quickstart/page.tsx`
- Keep first-job checklist consistency across register and docs.
- Suggested assignee: Frontend Developer

6. `docs/provider-pitch-en.md`, `docs/content/provider-acquisition-en.md`, `app/support/page.tsx`
- Apply claim-safe copy guardrails.
- Suggested assignee: Copywriter + UX Researcher
