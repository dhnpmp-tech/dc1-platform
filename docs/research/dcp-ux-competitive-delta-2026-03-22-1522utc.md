# DCP UX Competitive Delta (Post DCP-542) — 2026-03-22 15:22 UTC

Owner: UX Researcher / Competitive Analyst  
Scope: Vast.ai, RunPod, Lambda, Akash, Together.ai, Replit signal alignment after recent DCP UX updates  
Guardrails: no fabricated pricing claims, no bare-metal language, containerized GPU reality only

## What Was Re-Validated in Code

Implemented and present:
- Role-intent persistence + header switcher across landing/docs/support (`app/lib/role-intent.ts`, `app/components/layout/Header.tsx`, `app/page.tsx`, `app/docs/[[...slug]]/page.tsx`, `app/support/page.tsx`).
- Mode-first public IA (`Playground`, `Container/API Docs`, `Enterprise Support`) in `app/components/layout/Header.tsx`.
- First-run onboarding scaffolds in renter/provider flows (`app/renter/register/page.tsx`, `app/provider/register/page.tsx`).

## Remaining Conversion Gap (P1)

### Gap: Landing proof strip mixes live telemetry with hardcoded placeholder metrics

Current state in `app/page.tsx`:
- Live metric: providers online (fetched)
- Hardcoded values in same strip: `75%` and `7`

Why this matters:
- Competitor patterns (Vast.ai, RunPod, Lambda, Together.ai) keep trust/proof surfaces either clearly live or clearly descriptive.
- Mixed placeholder + live values creates credibility drag on first fold and weakens CTA confidence.

### Recommended fix

Replace placeholder numeric tiles with explicit descriptive trust badges, or source all displayed numbers from validated backend telemetry.

## Implementation Checklist

1. `P1` Normalize landing proof semantics
- File paths: `app/page.tsx`, `app/lib/i18n.tsx`
- Exact change:
  - Remove hardcoded numeric placeholders (`75%`, `7`) from stats row.
  - Keep live numeric telemetry only where backend-sourced (e.g., online providers).
  - Convert non-telemetry items to text badges (example: `75/25 settlement split`, `Containerized execution (Docker + NVIDIA toolkit)`, `Arabic model support: ALLaM/Falcon/JAIS/BGE-M3`).
- Acceptance criteria:
  - No hardcoded pseudo-metrics displayed as live performance stats.
  - First-fold proof strip is internally consistent: all numeric values are live, and static items are explicitly descriptive labels.
  - EN/AR copy parity for all changed labels.
- Suggested assignee role: Frontend Developer

## Evidence References

- https://vast.ai/
- https://www.runpod.io/pricing
- https://lambda.ai/pricing
- https://akash.network/docs/getting-started/quick-start/
- https://www.together.ai/pricing
- https://replit.com/pricing
