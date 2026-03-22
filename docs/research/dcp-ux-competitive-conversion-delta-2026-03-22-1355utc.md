# DCP UX Research Delta: Competitor Messaging + Conversion IA (2026-03-22 13:55 UTC)

Owner: UX Researcher / Competitive Analyst  
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit  
Guardrails: no fabricated pricing, no bare-metal claims, containerized execution only

## Executive Summary
DCP already has strong role-path and trust-anchor coverage, but competitor patterns still outperform in three places: (1) first-screen action clarity, (2) mode-based IA labels, and (3) enterprise trust packaging. The highest-impact conversion work is to tighten first viewport copy and CTAs around one immediate action per role while preserving DCP's differentiators (Saudi energy advantage + Arabic AI model support).

## Evidence Snapshot (Official Sources)

| Competitor | Evidence | Conversion pattern to adopt at DCP |
|---|---|---|
| Vast.ai | Homepage emphasizes `Real-Time GPU Pricing` with `No list prices. No hidden fees.` and step flow (`Add Credit`, `Search GPUs`, `Deploy`). Source: https://vast.ai/ | Keep billing semantics and next-step checklist adjacent to first CTA (not lower on page). |
| RunPod | Homepage metadata and schema emphasize `serverless compute`, `instant multi-node clusters`, and `Pay only for what you use, billed by the millisecond`. Source: https://www.runpod.io/ | Keep mode-first IA labels visible early: browser playground vs container/API vs provider onboarding. |
| Together.ai | Inference page description: `serverless inference`, `no infrastructure to manage`, `no long-term commitments`. Source: https://www.together.ai/inference | Reduce perceived setup cost with explicit “no infra setup for first run” language on renter flow. |
| Lambda | Homepage includes CTA `Launch GPU instance`, and trust language `Secure by design`, `single-tenant`, `SOC 2 Type II`. Source: https://lambda.ai/ | Add visible enterprise trust panel near primary CTA and keep self-serve + enterprise CTAs together. |
| Akash | Homepage metadata: `Decentralized Compute Marketplace`; hero includes “Tap into global GPU power at a fraction of the cost” plus direct pricing path. Source: https://akash.network/ | Keep cost advantage headline-level and pair with immediate pricing/marketplace access. |
| Replit | Homepage headline: `Build apps and sites with AI`; description stresses `without spending a second on setup`; nav keeps `Pricing` + `Create account`. Source: https://replit.com/ | Preserve fast-start framing and ensure account creation always sits beside a clear value path. |

## DCP Segment Map (Conversion-Critical)

1. Renter (solo builder)
- Goal: first successful workload fast.
- Friction: too many valid paths post-registration.
- Needed message: “Run your first workload now, then scale to container jobs.”

2. Renter (team lead / evaluator)
- Goal: validate trust + operational fit.
- Friction: trust/legal/support signals are present but dispersed.
- Needed message: “Containerized execution, policy controls, and support path in one flow.”

3. Provider (single machine)
- Goal: become online and job-ready quickly.
- Friction: state transitions are visible but remediation pathways are weak.
- Needed message: “State -> exact next action -> verification done.”

4. Provider (small fleet)
- Goal: predictable uptime and earnings operations.
- Friction: troubleshooting logic is not centralized in one compact panel.
- Needed message: “Heartbeat health + deterministic actions by status.”

5. Arabic AI team (MENA)
- Goal: launch Arabic-model workloads with local economic advantage.
- Friction: differentiator exists but can still be buried after first fold depending on path.
- Needed message: “Saudi energy economics + Arabic model support as the opening promise.”

## DCP IA/Copy Gaps (Current Code Surfaces)

1. `app/components/layout/Header.tsx`
- Public nav does not explicitly expose mode semantics (`Playground`, `Container/API`, `Enterprise`).

2. `app/page.tsx`
- Hero is strong but still mixes proof and action across multiple regions; the first decision block can be tightened to one primary CTA per role with trust proof adjacent.

3. `app/renter/register/page.tsx`
- Success state includes checklist and CTA set, but it can more strongly enforce one “start first workload now” path.

4. `app/provider/register/page.tsx`
- Polling/status logic is solid; next-action panel should include explicit remediation links by status key.

5. `app/docs/[[...slug]]/page.tsx` and `app/docs/quickstart/page.tsx`
- Role-first docs entry exists; still missing “time-to-first-result” framing and enterprise trust path in same top row.

## Recommended Changes (Prioritized)

### P0

1. Tighten top-nav around conversion modes
- Files: `app/components/layout/Header.tsx`
- Change: Rename/adjust nav labels so renter flow exposes `Playground`, keep `Docs (API + Container)`, add direct `Enterprise/Support` entry.
- Why: competitor IA is mode-first, reducing decision latency.

2. Add first-screen trust + action bundle on homepage
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Change: In first viewport, keep one role selector, one primary CTA per role, and a compact trust strip: Saudi energy advantage, Arabic models, containerized execution, settlement semantics.
- Why: competitors place conversion + trust in one visual unit.

3. Provider remediation matrix linked from status panel
- Files: `app/provider/register/page.tsx`, `app/docs/provider-guide.mdx`
- Change: Map `waiting|heartbeat|stale|paused|ready` to concrete action and docs anchor links.
- Why: reduces support dependency and improves activation rate.

### P1

4. Renter registration success hierarchy hardening
- Files: `app/renter/register/page.tsx`
- Change: keep playground CTA as primary, demote dashboard visually, add short “first result in 3 steps” line above CTA group.
- Why: preserves momentum from signup to first completion.

5. Docs first row: role + trust + enterprise lane
- Files: `app/docs/[[...slug]]/page.tsx`, `app/docs/quickstart/page.tsx`
- Change: add explicit enterprise evaluator card with trust docs/support path while keeping renter/provider/API cards.
- Why: mirrors competitor self-serve + sales/trust dual-path pattern.

### P2

6. Marketplace cost-confidence microcopy standardization
- Files: `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`
- Change: normalize card copy order: compatibility -> heartbeat freshness -> estimated billing semantics.
- Why: aligns with “transparent pricing + deploy fast” expectation set by competitors.

## Implementation Checklist

1. `P0` Header mode-first IA
- File path: `app/components/layout/Header.tsx`
- Exact change: expose renter quick path (`Playground`) and explicit enterprise/support entry.
- Acceptance criteria: user can identify renter quickstart path from nav in one click.
- Suggested assignee role: Frontend Developer

2. `P0` Homepage conversion bundle above fold
- File paths: `app/page.tsx`, `app/lib/i18n.tsx`
- Exact change: co-locate role selector, CTA, and trust anchors in one above-fold block (EN/AR).
- Acceptance criteria: Saudi energy + Arabic model support + container execution + settlement semantics all visible before first scroll.
- Suggested assignee role: Frontend Developer

3. `P0` Provider status remediation matrix
- File paths: `app/provider/register/page.tsx`, `app/docs/provider-guide.mdx`
- Exact change: add status-to-action matrix with deep links.
- Acceptance criteria: provider can self-recover from `stale`/`waiting` states without support.
- Suggested assignee role: Frontend Developer

4. `P1` Renter post-signup action hierarchy
- File path: `app/renter/register/page.tsx`
- Exact change: strengthen first workload CTA hierarchy and reduce competing options.
- Acceptance criteria: first-job submission path stays <=2 clicks from success screen.
- Suggested assignee role: Frontend Developer

5. `P1` Docs enterprise lane
- File paths: `app/docs/[[...slug]]/page.tsx`, `app/docs/quickstart/page.tsx`
- Exact change: add enterprise trust/evaluation card next to existing role cards.
- Acceptance criteria: enterprise evaluator can reach trust+support path in one click from `/docs`.
- Suggested assignee role: Frontend Developer

6. `P2` Marketplace trust copy normalization
- File paths: `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`
- Exact change: standard microcopy structure for trust and billing semantics on cards.
- Acceptance criteria: both marketplace surfaces present identical trust field order.
- Suggested assignee role: Frontend Developer

## Sources
- https://vast.ai/
- https://www.runpod.io/
- https://www.together.ai/inference
- https://lambda.ai/
- https://akash.network/
- https://replit.com/
