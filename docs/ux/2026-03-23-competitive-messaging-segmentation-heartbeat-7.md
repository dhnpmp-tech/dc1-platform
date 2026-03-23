# DCP Competitive UX + Segment Messaging Report — Heartbeat 7 (2026-03-23)

Owner: UX Researcher / Competitive Analyst (Codex)  
Date: 2026-03-23 UTC  
Scope: Competitor UX/messaging scan (official pages/docs), DCP segment mapping, and conversion-oriented recommendations aligned with container-based GPU execution.

## Evidence Snapshot (Reviewed 2026-03-23)

Official sources reviewed:
1. Vast.ai homepage — https://vast.ai/
2. Runpod homepage — https://www.runpod.io/
3. Lambda homepage + docs — https://lambda.ai/ and https://docs.lambda.ai/public-cloud/on-demand/getting-started/
4. Akash deploy page — https://akash.network/deploy
5. Together AI homepage + quickstart — https://www.together.ai/ and https://docs.together.ai/docs/quickstart
6. Replit homepage — https://replit.com/

Observed patterns from current public messaging:
- Vast.ai foregrounds low-cost GPU rental framing and marketplace utility language.
- Runpod foregrounds AI/cloud infrastructure positioning with clear launch framing.
- Lambda foregrounds AI cloud + operational scale, then supports conversion via explicit getting-started docs.
- Akash deploy surface emphasizes template-based deployment flow and deployment status visibility.
- Together AI pairs "AI native cloud" brand framing with quickstart-first onboarding in docs.
- Replit foregrounds speed-to-outcome messaging (build/deploy fast without setup overhead).

## DCP Segment Map (Priority by Revenue + Activation)

1. Saudi startup teams shipping AI features (Primary)
- Decision trigger: fastest path from sign-up to first successful workload.
- DCP message to lead: structural Saudi energy-cost advantage for lower ongoing compute economics.
- Primary surfaces: `app/page.tsx`, `app/renter/register/page.tsx`, `app/renter/playground/page.tsx`, `app/login/page.tsx`.

2. Arabic-first AI builders (Primary)
- Decision trigger: confidence that Arabic model workflows are first-class, not side notes.
- DCP message to lead after cost: Arabic AI model support (ALLaM 7B, Falcon H1, JAIS 13B, BGE-M3).
- Primary surfaces: `app/page.tsx`, `app/renter/marketplace/page.tsx`, `app/docs/quickstart/page.tsx`, `app/docs/api/page.tsx`.

3. Enterprise evaluators in MENA (Secondary, high ACV)
- Decision trigger: trust, governance, and deterministic escalation path.
- DCP message to lead: compliance-aware operations + predictable support lane (without fabricated SLA claims).
- Primary surfaces: `app/page.tsx`, `app/support/page.tsx`, `app/legal/privacy/page.tsx`, `app/terms/page.tsx`.

4. NVIDIA GPU providers with idle capacity (Supply-side primary)
- Decision trigger: low-friction onboarding to first heartbeat and ready status.
- DCP message to lead: simple daemon install + transparent onboarding state transitions.
- Primary surfaces: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`, `app/provider/page.tsx`.

## DCP UX/Messaging Gaps (Code-verified)

1. Landing page still asks for too many early choices.
- File: `app/page.tsx`
- Evidence: first journey includes both `modeStripItems` and `pathChooserLanes` near primary CTAs.
- Impact: higher decision latency before commitment.

2. Provider registration includes cross-intent path chooser during activation.
- File: `app/provider/register/page.tsx`
- Evidence: provider flow renders generic multi-lane chooser while user is still completing onboarding.
- Impact: reduced registration-to-heartbeat completion.

3. Login flow supports roles well, but role outcome value is not dominant near submit.
- File: `app/login/page.tsx`
- Evidence: helper table exists (`helperRows`) but no concise role-specific promise line above auth action.
- Impact: weaker first-time completion confidence.

4. Arabic AI support is present, but proof is not normalized as one reusable conversion block.
- Files: `app/page.tsx`, `app/renter/marketplace/page.tsx`, `app/docs/quickstart/page.tsx`
- Impact: differentiator can feel fragmented across discovery surfaces.

## Prioritized Recommendations

### P0 (Conversion-critical)

1. Reduce first-fold commitment to two primary actions.
- Files: `app/page.tsx`, `app/lib/i18n.tsx`
- Change: keep renter/provider primary CTAs only in hero commitment zone; move mode/path chooser sections lower.
- Message order constraint: Saudi energy-cost advantage -> Arabic AI support -> containerized execution clarity.

2. Make provider onboarding state machine single-action.
- Files: `app/provider/register/page.tsx`, `app/lib/provider-install.ts`, `app/lib/i18n.tsx`
- Change: map each state (`waiting`, `heartbeat`, `stale`, `paused`, `ready`) to one dominant CTA and demote all alternates.

3. Add role-specific outcome strip on login.
- Files: `app/login/page.tsx`, `app/lib/i18n.tsx`
- Change: dynamic one-line outcome by selected role directly above submit control.

### P1 (Message architecture + onboarding)

4. Create reusable "Arabic AI Ready" proof block.
- Files: `app/page.tsx`, `app/renter/marketplace/page.tsx`, `app/docs/quickstart/page.tsx`, `app/lib/i18n.tsx`
- Change: single source-of-truth copy component with model family mentions and docs links.

5. Compress quickstart into one first-success lifecycle.
- Files: `app/docs/quickstart/page.tsx`, `app/docs/api/page.tsx`
- Change: above-the-fold sequence: authenticate -> submit -> monitor -> fetch output.

6. Normalize enterprise CTA label + destination.
- Files: `app/page.tsx`, `app/support/page.tsx`, `app/legal/privacy/page.tsx`, `app/terms/page.tsx`, `app/lib/i18n.tsx`
- Change: one enterprise assistance CTA phrase and one canonical target route.

### P2 (Retention lift)

7. Add post-output next-step rail for renter jobs.
- Files: `app/renter/jobs/[id]/page.tsx`, `app/renter/playground/page.tsx`, `app/lib/i18n.tsx`
- Change: after successful output, show retry/prefill/template actions.

8. Add provider stale-state confidence microcopy.
- Files: `app/provider/register/page.tsx`, `app/provider/download/page.tsx`, `app/lib/i18n.tsx`
- Change: explicit stale/offline recovery instructions tied to daemon heartbeat reality.

## Implementation Checklist

1. P0 — Landing commitment simplification
- Specific file paths to modify:
  - `app/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes needed:
  - Keep exactly two dominant first-fold CTAs (renter/provider).
  - Move `modeStripItems` and `pathChooserLanes` below proof/trust section.
  - Ensure differentiator copy order remains fixed.
- Acceptance criteria:
  - First fold contains two primary actions only.
  - No fabricated pricing/earnings/savings percentages.
  - No bare-metal claims.
- Suggested assignee role: Frontend Developer + Copywriter.

2. P0 — Provider onboarding single-next-action model
- Specific file paths to modify:
  - `app/provider/register/page.tsx`
  - `app/lib/provider-install.ts`
  - `app/lib/i18n.tsx`
- Exact changes needed:
  - Render one primary CTA per onboarding state.
  - Keep diagnostics/support links tertiary until error/stale paths.
- Acceptance criteria:
  - `waiting`, `heartbeat`, `stale`, `paused`, `ready` each have one dominant action.
  - State transitions align with `/api/providers/me` status fields.
- Suggested assignee role: Frontend Developer.

3. P0 — Login role outcome clarity
- Specific file paths to modify:
  - `app/login/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes needed:
  - Add short dynamic role-outcome line near primary auth action.
- Acceptance criteria:
  - Distinct truthful outcome for renter/provider/admin.
  - No auth API contract changes.
- Suggested assignee role: Frontend Developer + Copywriter.

4. P1 — Reusable Arabic AI proof module
- Specific file paths to modify:
  - `app/page.tsx`
  - `app/renter/marketplace/page.tsx`
  - `app/docs/quickstart/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes needed:
  - Standardize one proof block component/copy bundle and reuse across discovery/docs surfaces.
- Acceptance criteria:
  - Arabic AI support appears consistently on all key renter discovery pages.
  - No unsupported latency/accuracy claims.
- Suggested assignee role: Frontend Developer + Copywriter.

5. P1 — Quickstart first-success lifecycle strip
- Specific file paths to modify:
  - `app/docs/quickstart/page.tsx`
  - `app/docs/api/page.tsx`
- Exact changes needed:
  - Add top lifecycle strip with direct links to auth + submit + result retrieval steps.
- Acceptance criteria:
  - New user can execute first workload path without navigating more than one additional page.
- Suggested assignee role: Docs Engineer + Frontend Developer.

6. P1 — Enterprise CTA normalization
- Specific file paths to modify:
  - `app/page.tsx`
  - `app/support/page.tsx`
  - `app/legal/privacy/page.tsx`
  - `app/terms/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes needed:
  - Use one enterprise CTA label and one canonical destination.
- Acceptance criteria:
  - Enterprise CTA text and link are consistent across all listed trust surfaces.
- Suggested assignee role: Frontend Developer + Copywriter.

## Guardrails

- Do not invent or publish unapproved pricing/earnings/ROI figures.
- Do not claim bare-metal GPUs; execution is containerized (NVIDIA Container Toolkit).
- Keep top-level positioning order:
  1. Saudi energy-cost advantage
  2. Arabic AI model support
  3. Container-based execution reliability
