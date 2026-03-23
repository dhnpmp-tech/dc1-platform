# DCP Competitive UX + Segmentation Report — Heartbeat 5 (2026-03-22)

Owner: UX Researcher / Competitive Analyst (Codex)  
Date: 2026-03-22 UTC  
Scope: Current competitor messaging/UX signals (official pages), DCP segment mapping, implementation-ready conversion recommendations.

## Evidence Snapshot (Reviewed 2026-03-22)

Official sources reviewed:
1. Vast.ai homepage — https://vast.ai/
2. Runpod homepage — https://www.runpod.io/
3. Lambda docs (on-demand getting started) — https://docs.lambda.ai/public-cloud/on-demand/getting-started/
4. Akash deploy page — https://akash.network/deploy
5. Together AI quickstart — https://docs.together.ai/docs/quickstart
6. Replit homepage — https://replit.com/

Observed UX/messaging patterns:
- Vast.ai: marketplace-style positioning and supply-demand framing for GPU capacity.
- Runpod: trust + scale framing above fold (developer count, end-to-end flow, rapid pod launch, serverless scaling).
- Lambda: onboarding and usage framed in operational steps with clear execution path.
- Akash: deploy-oriented workflow language (templates + deployment status) tied to operator mental model.
- Together AI: API quickstart framing optimized for "first successful call" speed.
- Replit: immediate outcome language (idea-to-app) with guided creation prompts and workflow acceleration claims.

## DCP Segment Map (Conversion Priority)

1. Saudi startup builders (primary)
- Desired outcome: submit first workload in minutes.
- Current friction: landing first fold still carries too many directional lanes for first decision.
- Core surfaces: `app/page.tsx`, `app/renter/register/page.tsx`, `app/renter/playground/page.tsx`.

2. Arabic AI teams in MENA (primary)
- Desired outcome: verify Arabic model readiness and deployability quickly.
- Current friction: Arabic-model support exists but is split across discovery surfaces.
- Core surfaces: `app/page.tsx`, `app/renter/marketplace/page.tsx`, `app/docs/quickstart/page.tsx`.

3. Enterprise evaluators (secondary)
- Desired outcome: trust, compliance confidence, and a deterministic support/escalation path.
- Current friction: enterprise intake exists but can compete with other intent paths.
- Core surfaces: `app/page.tsx`, `app/support/page.tsx`, `app/legal/privacy/page.tsx`.

4. Providers with idle NVIDIA GPUs (supply primary)
- Desired outcome: register, install daemon, send first heartbeat, confirm ready state.
- Current friction: post-registration guidance is richer than needed for a single next action.
- Core surfaces: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`.

## DCP UX Findings (Code-Verified)

1. Landing decision density remains high in first journey section.
- File: `app/page.tsx`
- Why it matters: competitor patterns favor one clear first commitment before showing additional pathways.

2. Provider registration still exposes multiple outbound lanes near activation flow.
- File: `app/provider/register/page.tsx`
- Why it matters: provider conversion depends on heartbeat completion, so state-to-action focus should dominate.

3. Login flow quality is strong, but post-login value framing can be made role-specific at entry.
- File: `app/login/page.tsx`
- Why it matters: clearer role outcomes reduce auth completion abandonment.

## Prioritized Recommendations

### P0 (direct conversion/activation)

1. Lock landing first fold to two primary commitments
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Change: keep renter/provider as primary CTAs; move broader mode/path chooser content below the first commitment block.
- Messaging order constraint: Saudi energy-cost advantage first, Arabic AI support second, container-execution clarity third.

2. Enforce one dominant CTA per provider onboarding state
- Files: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`
- Change: keep secondary diagnostics/support actions collapsed or tertiary until first heartbeat/ready milestones are met.

3. Add role-specific benefit strip on login
- Files: `app/login/page.tsx`, `app/lib/i18n.tsx`
- Change: show one short outcome line per role (renter/provider/admin) directly above auth actions.

### P1 (IA and copy lift)

4. Consolidate Arabic AI proof block on renter discovery
- Files: `app/renter/marketplace/page.tsx`, `app/page.tsx`, `app/lib/i18n.tsx`
- Change: introduce a reusable "Arabic AI Ready" module with model family names and quick links.

5. Compress quickstart narrative to one lifecycle strip
- Files: `app/docs/quickstart/page.tsx`, `app/docs/api/page.tsx`
- Change: present one canonical sequence: authenticate -> submit -> monitor -> fetch output.

6. Standardize enterprise escalation CTA language
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/legal/privacy/page.tsx`, `app/lib/i18n.tsx`
- Change: unify enterprise CTA label and destination; keep compliance reassurance adjacent.

### P2 (retention and trust continuity)

7. Improve post-auth continuation cues for renters
- Files: `app/login/page.tsx`, `app/renter/page.tsx`
- Change: after renter login, show one clear "next best action" card (playground submit or marketplace browse based on intent).

8. Add provider onboarding progress confidence microcopy
- Files: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`, `app/lib/i18n.tsx`
- Change: concise state-specific copy that confirms what is happening now and what success looks like next.

## Implementation Checklist

1. P0 — First-fold commitment simplification
- File paths: `app/page.tsx`, `app/lib/i18n.tsx`
- Exact changes:
  - Keep only two primary CTA buttons in hero commitment cluster.
  - Demote path/mode exploration cards below primary commitment section.
  - Ensure top-level proof order remains: energy-cost advantage -> Arabic AI support -> containerized execution.
- Acceptance criteria:
  - Exactly two primary first-fold CTA actions.
  - No unapproved pricing or earnings claims introduced.
  - No "bare-metal" claim language.
- Suggested assignee: Frontend Developer + Copywriter.

2. P0 — Provider activation focus
- File paths: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`
- Exact changes:
  - Map each provider onboarding state to one dominant CTA.
  - Keep troubleshooting/support links visually secondary until failure or timeout states.
- Acceptance criteria:
  - `waiting`, `heartbeat`, `stale`, `paused`, `ready` each display a single primary action.
  - State labels remain truthful to backend heartbeat status.
- Suggested assignee: Frontend Developer.

3. P0 — Login outcome framing by role
- File paths: `app/login/page.tsx`, `app/lib/i18n.tsx`
- Exact changes:
  - Add short role outcome copy directly near role selection/auth form.
  - Keep existing auth mechanics unchanged.
- Acceptance criteria:
  - Renter/provider/admin each has distinct, truthful outcome line.
  - No changes to auth API contracts.
- Suggested assignee: Frontend Developer + Copywriter.

4. P1 — Arabic AI proof module reuse
- File paths: `app/page.tsx`, `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Exact changes:
  - Add reusable section/component for Arabic model readiness proof and docs links.
- Acceptance criteria:
  - Arabic AI support appears consistently in discovery surfaces.
  - Copy remains non-fabricated and avoids unsupported performance claims.
- Suggested assignee: Frontend Developer.

5. P1 — Quickstart lifecycle compression
- File paths: `app/docs/quickstart/page.tsx`, `app/docs/api/page.tsx`
- Exact changes:
  - Move a complete API lifecycle snippet to top section.
- Acceptance criteria:
  - New reader can follow first successful workload path without page hopping.
- Suggested assignee: Docs + Frontend Developer.

6. P1 — Enterprise CTA normalization
- File paths: `app/page.tsx`, `app/support/page.tsx`, `app/legal/privacy/page.tsx`, `app/lib/i18n.tsx`
- Exact changes:
  - Use one enterprise CTA label and endpoint pattern across all trust surfaces.
- Acceptance criteria:
  - CTA copy and destination are consistent in all three surfaces.
- Suggested assignee: Frontend Developer + Copywriter.

## Measurement Plan (14-day before/after)

Primary:
- Landing CTA click-through by intent lane (renter/provider).
- Provider registration -> first heartbeat within 24h.
- Login completion rate by role.
- Playground open -> successful submit conversion.

Secondary:
- Support contacts tagged "auth confusion" or "onboarding unclear".
- Median time-to-first-job for renter cohort.

## Guardrails (Must Hold)

- Do not publish fabricated pricing, earnings, or savings percentages.
- Do not claim bare-metal execution; DCP workload execution is container-based with NVIDIA container runtime.
- Keep differentiator order consistent in top-level messaging:
  1) Saudi energy-cost advantage
  2) Arabic AI model support
  3) containerized execution reliability controls
