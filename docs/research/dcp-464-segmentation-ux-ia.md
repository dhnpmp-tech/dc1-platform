# DCP-464: Customer Segmentation + Competitor UX Intelligence

Date: 2026-03-21 (UTC)  
Owner: UX Researcher / Competitive Analyst

## Scope and guardrails
- Focused on conversion UX/copy for DCP's real product: container-based GPU compute + browser playground + provider daemon onboarding.
- Avoided fabricated claims/pricing. Only used values visible on public competitor pages at time of review.

## Competitive UX snapshot (evidence-backed)

### Vast.ai
- Messaging pattern: marketplace economics and transparency first.
- UX pattern: pricing page is conversion-oriented with "Browse On-Demand/Interruptible" and "Calculate Cost".
- Pricing pattern shown on-page: on-demand + interruptible + reserved tiers, including "50%+ cheaper" interruptible and "Up to 50% Off" reserved.
- Evidence: https://vast.ai/pricing

### RunPod
- Messaging pattern: broad GPU coverage + scale language for teams.
- UX pattern: pricing is organized by product mode (`Pods` and `Serverless`) with direct "Get started" to console.
- Evidence shown on-page: "Thousands of GPUs across 30+ regions", "Community Cloud" vs "Secure Cloud", and serverless claim "Save 25% over other Serverless cloud providers on flex workers alone."
- Evidence: https://www.runpod.io/pricing

### Lambda
- Messaging pattern: enterprise clarity and structured procurement path.
- UX pattern: clear split between on-demand and reserved, with sales-assisted reserved flow.
- Evidence shown on-page: H100 on-demand listed at `$2.76/hr`, B200 at `$4.62/hr`, reserved options routed to "Talk to our team".
- Evidence: https://lambda.ai/pricing

### Together AI
- Messaging pattern: serverless-first motion with scale-up path to dedicated.
- UX pattern: product ladder is explicit (`Serverless Inference` -> `Dedicated Inference` + `GPU Clusters` + `Fine-Tuning`).
- Evidence shown on-page: "Most teams start with serverless inference and move to dedicated endpoints at scale." Includes token-based model pricing (example: Llama 4 Maverick input `$0.27` and output `$0.85` per 1M tokens).
- Evidence: https://www.together.ai/pricing

### Akash
- Messaging pattern: decentralized marketplace + sovereignty + cost delta.
- UX pattern: multiple entry points by user intent (deploy, templates, managed inference, provider monetization).
- Evidence shown on-page: "global reverse auction", "Docker Native", "Deployment Speed < 60 Seconds", and explicit H100 comparison (`$1.33/hr vs AWS $3.93/hr`).
- Evidence: https://akash.network/

### Replit (adjacent competitor for simplicity expectations)
- Messaging pattern: "build with AI" simplicity and tiered credits.
- UX pattern: low-friction pricing ladder with concrete plan outcomes.
- Evidence shown on-page: `Starter` free tier, `Replit Core` `$20/mo billed annually`, `Replit Pro` `$95/mo billed annually`, credit-driven value framing.
- Evidence: https://replit.com/pricing

## DCP target segment matrix

| Segment | Core job to be done | Buying trigger | Primary objection | What DCP should emphasize |
|---|---|---|---|---|
| Saudi AI startups (renter) | Launch inference/training quickly without long-term contracts | Need immediate GPU capacity with local context | "Will cost spike or be unpredictable?" | Real-time marketplace rates, pre-pay hold/refund flow, SAR billing clarity |
| SME product teams (renter) | Ship features with predictable path from testing to production | Need simple first run then scalable path | "Do we need infra specialists?" | 2-track onboarding: Playground first, then Container Jobs |
| Enterprise/regulated teams (renter) | Pilot AI workloads with governance and confidence | Need trust and control signals before spend | "Is this reliable and compliant?" | PDPL positioning, status/uptime transparency, support + legal discoverability |
| GPU owners / small data centers (provider) | Monetize idle NVIDIA GPUs | Want low setup friction and clear earnings | "How hard is setup and payout?" | Daemon install steps, earnings calculator, provider progress milestones |
| Power infra teams (both sides) | Bring container workloads without platform lock-in | Need Docker-native compatibility and APIs | "Will our existing stack port cleanly?" | "If it runs in Docker, it runs on DCP" style copy, docs-first route |

## Priority recommendations (conversion + IA)

## P0 (high impact, low/medium effort)
1. Clarify "two renter paths" above the fold.
   - Why: Together and RunPod make product modes explicit early; DCP has this content but it is not the primary conversion framing.
   - Change:
     - On landing hero, add compact switch cards: `Playground (fast start)` and `Container Jobs (API + Docker)`.
     - Add route-level CTAs with explicit outcomes.
   - File mapping:
     - `app/page.tsx`
     - `app/components/layout/Header.tsx`

2. Add transparent pricing explainer block on public pages.
   - Why: Vast/Lambda/Akash all lean hard on pricing clarity, which reduces hesitation.
   - Change:
     - Add a "How billing works" panel: quoted rate -> prepay hold -> actual settlement -> refund of unused hold.
     - Keep claims strictly tied to implemented billing (halala + 75/25 split).
   - File mapping:
     - `app/page.tsx`
     - `app/renter/register/page.tsx`
     - `app/docs/quickstart/page.tsx`

3. Rebuild nav IA around intent, not internal labels.
   - Why: Current header (`Compute`, `Supply`) is concise but ambiguous for first-time visitors.
   - Change:
     - Replace with: `Rent GPUs`, `Earn with GPUs`, `Marketplace`, `Docs`, `Support`.
     - Keep `Console Login` secondary and role-neutral.
   - File mapping:
     - `app/components/layout/Header.tsx`
     - `app/components/layout/Footer.tsx`

## P1 (medium impact, medium effort)
1. Provider onboarding trust stack.
   - Why: Provider conversion depends on confidence in setup + payout path.
   - Change:
     - On provider registration success screen, add explicit "What runs on your machine" block (daemon heartbeat interval, job polling interval, pause/resume control).
     - Add "Estimated monthly earnings = scenario, not guarantee" copy near calculator and registration CTA.
   - File mapping:
     - `app/provider/register/page.tsx`
     - `app/earn/page.tsx`

2. Renter quickstart funnel compression.
   - Why: Competitors reduce step ambiguity with direct "start now" flows.
   - Change:
     - Add a one-screen "first job checklist" with deep links:
       - Register -> Top up -> Browse providers -> Submit template job -> Watch status.
     - Add one prefilled `curl` job submit sample with placeholders.
   - File mapping:
     - `app/docs/page.tsx`
     - `app/docs/quickstart/page.tsx`
     - `app/renter/register/page.tsx`

3. Social proof and reliability framing.
   - Why: Akash/Together/Replit use trust indicators heavily around conversion points.
   - Change:
     - Add "live now" strip with count of online providers, supported GPU families, and latest status timestamp.
     - Link to `/status` and `/support` next to primary CTAs.
   - File mapping:
     - `app/page.tsx`
     - `app/renter/marketplace/page.tsx`

## Copy proposals (ready to implement)

Use these exact patterns to avoid over-claiming:
- Hero subhead:
  - "Run AI workloads on container-ready GPUs in minutes. Start in the browser, scale with Docker when ready."
- Billing explainer:
  - "You prepay an estimate in halala. Final cost is settled on actual runtime, and unused balance is returned automatically."
- Provider value line:
  - "Turn idle NVIDIA GPUs into SAR with a lightweight daemon and per-job payouts."
- Product path labels:
  - "Playground: no setup, browser-first"
  - "Container Jobs: bring your own image, API-driven"

## Information architecture proposal (public site)

Recommended top-level public IA:
- `/` (Positioning + two product paths)
- `/rent` (renter intent page -> register/docs/marketplace)
- `/earn` (provider intent page -> register/calculator/requirements)
- `/marketplace` (live GPU browse)
- `/docs` (quickstart + API + guides)
- `/support` (contact + FAQs + legal links)

Current-code implementation path:
- Keep existing routes; update labels and entry pages first.
- Add intent wrappers later if needed (`/rent`, `/earn`) to preserve current links.

## Execution checklist for product/design
- [ ] Update header/footer IA labels and destination priorities
- [ ] Add billing transparency module on landing + renter register
- [ ] Make "Playground vs Container Jobs" primary conversion choice near hero
- [ ] Add provider onboarding trust module on success state
- [ ] Add renter first-job checklist with deep links and API sample

## Sources
- Vast pricing: https://vast.ai/pricing
- RunPod pricing: https://www.runpod.io/pricing
- Lambda pricing: https://lambda.ai/pricing
- Together AI pricing: https://www.together.ai/pricing
- Akash homepage/pricing messaging: https://akash.network/
- Replit pricing: https://replit.com/pricing
