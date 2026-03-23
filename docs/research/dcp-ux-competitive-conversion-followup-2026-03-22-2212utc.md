# DCP UX Competitive Follow-up: Conversion Parity Gaps
Date: 2026-03-22 22:12 UTC
Owner: UX Researcher / Competitive Analyst

## Scope
- Validate remaining conversion-copy and IA friction against competitor UX patterns.
- Map implementation-ready changes to active DCP files.
- Keep claims aligned with DCP reality: containerized GPU execution (Docker + NVIDIA toolkit), no fabricated pricing claims, no bare-metal wording.

## Evidence Signals (Competitor-facing)
- Vast.ai keeps first action clear around renting GPUs and marketplace navigation. Source: https://vast.ai/
- RunPod foregrounds mode-first framing (serverless vs other compute modes). Source: https://www.runpod.io/product/serverless
- Together.ai packages inference/fine-tuning/clusters as explicit entry lanes. Source: https://www.together.ai/
- Lambda keeps pricing/procurement pathways highly visible from main navigation. Source: https://lambda.ai/pricing
- Akash leads with marketplace positioning. Source: https://akash.network/
- Replit emphasizes immediate “build and ship” outcomes in top-level messaging. Source: https://replit.com/

## Code-Verified DCP Gaps (2026-03-22)
1. Marketplace conversion microcopy is partially hardcoded in English
- File: `app/renter/marketplace/page.tsx`
- Observed strings in conversion-critical UI:
  - "Quick intent actions"
  - "Arabic model ready"
  - "Inference"
  - "Training"
  - "Lowest SAR/hr"
  - "Start here"
  - start-state helper sentences and CTA labels
- Impact: EN/AR parity breaks on a high-intent page.

2. Docs root mixes EN + AR copy in the same content blocks
- File: `app/docs/[[...slug]]/page.tsx`
- Observed pattern: duplicate EN paragraph + AR paragraph in hero, mode cards, and docs map cards.
- Impact: scanning friction versus competitor-style clean, mode-first entry.

3. Differentiator order is largely correct on landing
- File: `app/page.tsx`
- Positive check: Saudi energy-cost advantage + Arabic AI support + containerized execution language appears above fold.
- Impact: keep as-is; avoid regression during copy edits.

## Recommendations
### P0
1. Localize marketplace conversion chips and start-here block
- Files: `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Change: replace hardcoded conversion labels/sentences with i18n keys (EN/AR parity).
- Rationale: preserve conversion clarity and trust for both locales on the primary renter action surface.

2. Split docs-root copy by active locale
- File: `app/docs/[[...slug]]/page.tsx`
- Change: render EN-only copy in EN context and AR-only copy in AR context for `/docs` root sections.
- Rationale: cleaner first-scan IA and lower cognitive load.

### P1
3. Post-change funnel consistency check
- Files: `app/page.tsx`, `app/renter/register/page.tsx`, `app/renter/marketplace/page.tsx`
- Change: verify mode-choice and first-run event payload consistency (`role_intent`, `surface`, `destination`, `step`) after copy refactors.
- Rationale: maintain measurable conversion attribution across landing -> register -> marketplace.

## Implementation Checklist
- P0
- File paths: `app/renter/marketplace/page.tsx`, `app/lib/i18n.tsx`
- Exact changes needed: migrate all hardcoded conversion microcopy in quick-intent/start-here modules to i18n keys; provide EN and AR values.
- Acceptance criteria: no targeted hardcoded English conversion strings remain; AR locale receives equivalent labels and helper text.
- Suggested assignee role: Frontend Developer.

- P0
- File path: `app/docs/[[...slug]]/page.tsx`
- Exact changes needed: conditionally render locale-targeted copy on docs root (hero, mode cards, docs map cards) rather than mixed bilingual blocks.
- Acceptance criteria: EN locale shows EN-only copy; AR locale shows AR-only copy; mode-card destinations unchanged.
- Suggested assignee role: Frontend Developer.

- P1
- File paths: `app/page.tsx`, `app/renter/register/page.tsx`, `app/renter/marketplace/page.tsx`
- Exact changes needed: verify and normalize first-run conversion telemetry schema after copy/i18n updates.
- Acceptance criteria: consistent analytics keys across all three surfaces; no event-name regressions.
- Suggested assignee role: Frontend Developer + Analytics.

## Notes
- Attempted to create a Paperclip implementation issue from this report via `POST /api/companies/{companyId}/issues`; request returned `Internal server error` from this agent context.
