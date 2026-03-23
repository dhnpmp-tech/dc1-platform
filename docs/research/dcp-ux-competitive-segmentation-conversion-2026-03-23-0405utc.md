# DCP UX Competitive Segmentation + Conversion Delta (2026-03-23 04:05 UTC)

Owner: UX Researcher / Competitive Analyst (Codex)
Scope: Validate implementation status of prior competitor-informed UX recommendations and define remaining conversion-critical work.

## Context

This delta follows prior benchmark and recommendation artifacts:
- `docs/research/dcp-ux-competitive-segmentation-conversion-2026-03-23-0349utc.md`
- `docs/research/competitive-positioning-retail-readiness-2026-q2.md`

No new pricing/performance claims are introduced. Guardrails preserved:
- No fabricated savings/pricing
- No bare-metal claims
- Keep differentiator order: Saudi energy advantage -> Arabic AI support -> containerized NVIDIA execution

## Code Audit Snapshot (repository)

### Still Open (P0/P1)

1. Landing first fold still has dual chooser stacks before commitment (P0)
- File: `app/page.tsx`
- Evidence: both `modeStripItems` and `pathChooserLanes` render in the hero decision region.
- Risk: high choice load before first intent commitment.

2. Provider onboarding still embeds multi-lane cross-role chooser (P0)
- File: `app/provider/register/page.tsx`
- Evidence: provider flow includes renter/enterprise/docs lanes (`pathChooserLanes`) during onboarding success context.
- Risk: provider install completion competes with context switching.

3. Renter register success still combines first-job flow with broad lane switching (P0)
- File: `app/renter/register/page.tsx`
- Evidence: first-job checklist co-exists with full `pathChooserLanes` block in success state.
- Risk: first-job conversion diluted after API key creation.

4. Marketplace pages still present lane switching above/near decision flow (P1)
- Files: `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`
- Evidence: path chooser lane blocks remain active.
- Risk: users evaluating GPU options are encouraged to role-switch before submission.

5. Login page still lacks compact proof-near-action stack (P1)
- File: `app/login/page.tsx`
- Evidence: helper rows are present, but no concise differentiator strip near submit controls.
- Risk: trust friction during credential entry for new users.

### Already Landed (keep)

1. Arabic model bridge block in renter marketplace is present (P1 complete)
- File: `app/renter/marketplace/page.tsx`
- Includes model discovery copy and docs/catalog CTAs.

2. Enterprise support helper scope in support form is present (P1 complete)
- File: `app/support/page.tsx`
- Includes procurement/security/rollout guidance with scoped enterprise helper copy.

3. i18n coverage for conversion primitives exists (partial)
- File: `app/lib/i18n.tsx`
- Includes keys for first-job checklist, Arabic model bridge, and enterprise helper scope.

## Segment-Driven Priority Map (unchanged)

1. P0: Self-serve renters -> first successful output
2. P0: Arabic-first AI builders -> confidence in immediate model path
3. P0: Providers -> registration to heartbeat-ready completion
4. P1: Enterprise evaluators -> clear intake and trust context

## Implementation Checklist

1. P0 — Reduce landing first-fold choice complexity
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Exact change:
  - Keep only two primary above-fold CTAs (`Rent GPU`, `Provide GPU`).
  - Move `modeStripItems` and `pathChooserLanes` below first proof and trust block.
- Acceptance criteria:
  - First viewport has max two primary intent actions.
  - Differentiator order remains policy-safe and stable.
- Suggested assignee: Frontend Developer + Copywriter

2. P0 — Provider onboarding single-track completion
- Files: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`
- Exact change:
  - Keep one dominant CTA per `nextActionState`.
  - Replace inline cross-role chooser with low-prominence “Other paths” disclosure.
- Acceptance criteria:
  - Onboarding success view has one primary action per state.
  - Polling and status transitions unchanged.
- Suggested assignee: Frontend Developer

3. P0 — Renter success page first-job dominance
- Files: `app/renter/register/page.tsx`, `app/lib/i18n.tsx`
- Exact change:
  - Preserve checklist but set one clear primary CTA (`Launch first run` -> `/renter/playground`).
  - Collapse cross-role lane block into disclosure/foldout.
- Acceptance criteria:
  - Primary success action always points to first submission path.
  - EN/AR parity maintained.
- Suggested assignee: Frontend Developer + Copywriter

4. P1 — Marketplace decision primer ahead of filters/cards
- Files: `app/marketplace/page.tsx`, `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Exact change:
  - Add short primer explaining rate interpretation, workload-to-GPU mapping, and Arabic-model-ready discovery path.
  - Keep enterprise CTA discoverable but visually secondary to self-serve flow.
- Acceptance criteria:
  - Primer visible before first filter interaction.
  - No unsupported performance guarantees.
- Suggested assignee: Frontend Developer + Copywriter

5. P1 — Login proof-near-action trust strip
- Files: `app/login/page.tsx`, `app/lib/i18n.tsx`
- Exact change:
  - Insert compact 3-point proof strip directly above submit action area:
    - Saudi energy-cost advantage
    - Arabic model support
    - Containerized GPU execution
- Acceptance criteria:
  - Visible in both email/OTP and API key modes.
  - Copy remains guardrail-safe.
- Suggested assignee: Frontend Developer + Copywriter

## Recommended Next Execution Order

1. Land P0 items 1-3 in one frontend batch for conversion impact.
2. Land P1 marketplace/login clarity in a second batch.
3. Re-run funnel audit after deploy: landing CTA click-through, renter register -> first job launch rate, provider register -> heartbeat-ready completion rate.
