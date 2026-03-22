# DCP UX Competitive + Segmentation Conversion Brief (2026-03-22 18:51 UTC)

Owner: UX Researcher / Competitive Analyst  
Scope: competitor UX/messaging scan + DCP segment map + implementation-ready copy/onboarding/IA actions.

## Evidence Snapshot (Checked 2026-03-22 UTC)

| Competitor | Observed message pattern | UX conversion takeaway for DCP | Source |
|---|---|---|---|
| Vast.ai | Positions trust around pricing clarity and market dynamics (real-time pricing, no hidden-fee framing). | Place billing rules close to first CTA, not buried in docs/support. | https://vast.ai/ |
| RunPod | Explicit progression from fast start to production serverless scaling. | Keep renter journey split into `starter path` and `production path` with clear next actions. | https://www.runpod.io/ |
| Lambda | Procurement + self-serve coexist on pricing surfaces. | Keep enterprise contact visible alongside self-serve onboarding. | https://lambda.ai/pricing |
| Akash | Front-loads marketplace/decentralized compute positioning with immediate console action. | Lead with DCP core differentiators and keep a direct “start now” route above the fold. | https://akash.network/ |
| Together.ai | AI-native platform framing with serverless/fine-tuning pathways. | Present DCP renter maturity ladder: playground -> API jobs -> repeatable workloads. | https://www.together.ai/ |
| Replit | Intent-first prompt framing (“what will you build?”) and low-friction start language. | Use intent-led copy blocks before technical details to reduce first-click hesitation. | https://replit.com/ |

## DCP Segment Map (Conversion-Oriented)

| Segment | Primary job | Primary objection | Message angle that should convert | Best entry pages |
|---|---|---|---|---|
| Startup renter (KSA/MENA) | Ship first AI workload quickly | Cost ambiguity | Saudi energy-cost advantage + halala prepay estimate and runtime settlement clarity | `/`, `/renter/register`, `/renter/playground` |
| SME engineering team | Move from test to repeatable container jobs | Workflow complexity | Browser-first starter path + explicit API/container production path | `/docs/quickstart`, `/renter/register`, `/docs/api` |
| Enterprise/procurement | Validate risk, support, and governance | Trust/compliance uncertainty | PDPL-aware positioning + support/legal visibility + transparent roadmap status | `/support`, `/legal/*`, `/docs/[[...slug]]` |
| Provider (single GPU / small fleet) | Monetize idle NVIDIA capacity | Setup reliability + payout confidence | Guided daemon install + state-based onboarding + clear earnings math assumptions | `/provider/register`, `/provider/download`, `/earn` |
| Infra-native team | Port existing Dockerized jobs | Migration risk | “If it runs in GPU Docker containers, DCP can run it” with concrete API path | `/docs/quickstart`, `/docs/api`, `/renter/playground` |

## Priority Recommendations Mapped to Existing Files

### P0 (Launch-Critical)

1. Make intent pathing explicit in hero and first CTA cluster.  
Files: `app/page.tsx`, `app/lib/i18n.tsx`  
Change: keep renter/provider/enterprise intent switch, but tighten value line per intent to one outcome sentence each.  
Acceptance: first viewport always includes intent choice + outcome + matching CTA.

2. Standardize billing truth copy on high-intent renter surfaces.  
Files: `app/page.tsx`, `app/renter/register/page.tsx`, `app/docs/quickstart/page.tsx`, `app/lib/i18n.tsx`  
Change: use one canonical pattern: estimate hold in halala -> runtime settlement -> unused hold release.  
Acceptance: same billing explanation appears across all three flows with no contradictory phrasing.

3. Add enterprise trust lane near self-serve entry points.  
Files: `app/components/layout/Header.tsx`, `app/support/page.tsx`, `app/docs/[[...slug]]/page.tsx`  
Change: keep enterprise CTA visible and route to prefilled support categories with source tagging.  
Acceptance: enterprise path is one click from landing/docs and has clear contact action.

4. Enforce provider onboarding next-action hierarchy by machine state.  
Files: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`, `app/lib/provider-install.ts`  
Change: ensure UI always displays one dominant action for `waiting`, `heartbeat`, `ready`, `paused`, `stale`.  
Acceptance: each state maps to a single primary CTA and state-specific troubleshooting link.

### P1 (Conversion Lift)

5. Keep nav IA intent-first and low-jargon.  
Files: `app/components/layout/Header.tsx`, `app/components/layout/Footer.tsx`, `app/lib/i18n.tsx`  
Change: verify labels are action-oriented for first-time users (rent, run, integrate, earn, support).  
Acceptance: nav labels map cleanly to renter/provider/enterprise tasks.

6. Align “first successful job” checklist across register + docs.  
Files: `app/renter/register/page.tsx`, `app/docs/quickstart/page.tsx`  
Change: same 5-step checklist order and destination links in both pages.  
Acceptance: no step order mismatch; links resolve to active routes.

7. Apply strict claim-safe messaging guardrails on public pages.  
Files: `app/page.tsx`, `app/earn/page.tsx`, `app/support/page.tsx`, `docs/provider-pitch-en.md`, `docs/content/provider-acquisition-en.md`  
Change: keep two differentiators prominent (Saudi energy-cost advantage, Arabic AI model support) while avoiding fabricated savings/pricing claims and avoiding “bare-metal” claims.  
Acceptance: public copy remains consistent with container-based GPU execution reality.

## Copy Guardrails (Mandatory)

- Lead with DCP differentiators in this order on public pages:  
Saudi energy-cost advantage -> Arabic AI model support -> container-based GPU execution.
- Never state fixed savings percentages or unapproved pricing figures.
- Never describe DCP as bare-metal infrastructure.
- When mentioning cost, add qualifier: workload profile, runtime, and availability affect final spend.

## Implementation Checklist

1. `app/page.tsx` + `app/lib/i18n.tsx` (P0)  
Owner: Frontend Developer + Copywriter  
Deliverable: tightened intent/value copy and canonical billing truth block.

2. `app/renter/register/page.tsx` + `app/docs/quickstart/page.tsx` (P0/P1)  
Owner: Frontend Developer  
Deliverable: synchronized first-job checklist and billing phrasing.

3. `app/provider/register/page.tsx` + `app/provider/download/page.tsx` + `app/lib/provider-install.ts` (P0)  
Owner: Frontend Developer  
Deliverable: deterministic state-to-action onboarding behavior.

4. `app/components/layout/Header.tsx` + `app/components/layout/Footer.tsx` + `app/support/page.tsx` (P0/P1)  
Owner: Frontend Developer  
Deliverable: enterprise/support lane visibility and action-first navigation labels.

5. `docs/provider-pitch-en.md` + `docs/content/provider-acquisition-en.md` + public page copy (P1)  
Owner: Copywriter  
Deliverable: claim-safe, differentiator-led messaging pass.
