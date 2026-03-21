# DCP UX Key-Flow Delta Audit (2026-03-21 22:05 UTC)

Owner: UI/UX Specialist (Codex)
Scope: Homepage, onboarding, auth, job submission, output retrieval

## Why this delta exists
Most P0/P1 UX recommendations from earlier audits were already implemented. This pass isolates what is still unresolved in the current codebase so engineering can ship the last conversion and trust fixes.

## Competitor UX benchmark signals (re-verified)
1. RunPod keeps first success path explicit in Serverless docs (`create endpoint` -> send request).
   - Source: https://docs.runpod.io/serverless/vllm/get-started
2. Vast create-instance flow keeps provisioning inputs explicit (template and machine config choices).
   - Source: https://docs.vast.ai/api-reference/instances/create-instance
3. CoreWeave get-started sequence clarifies setup dependencies (account/org setup before workload actions).
   - Source: https://docs.coreweave.com/get-started
4. Pricing pages from RunPod/Vast/Lambda keep cost framing visible early.
   - Sources: https://www.runpod.io/pricing, https://vast.ai/pricing, https://lambda.ai/pricing

## Current-state findings (remaining gaps)

### P0
1. Provider onboarding status polling is not cleaned up on unmount and can continue background requests.
- File: `app/provider/register/page.tsx`
- Evidence: `startStatusPolling` returns a cleanup function, but `handleSubmit` does not retain/invoke it.
- User risk: repeated polling after route changes can create duplicate state updates and unstable status UX.
- Impact hypothesis: fixing lifecycle cleanup reduces false status transitions and provider onboarding drop-off by 5-10%.

2. Login/auth screen still contains hardcoded English in critical OTP states.
- File: `app/login/page.tsx`
- Evidence: strings like `Verification code sent! Check your email.` and `Please enter the verification code` bypass i18n.
- User risk: EN/AR parity breaks at the exact step where users complete authentication.
- Impact hypothesis: restoring parity improves first-attempt OTP completion by 6-12% for Arabic-primary users.

3. Legacy monitor route still uses old visual language and session storage only.
- File: `app/jobs/[id]/monitor/page.tsx`
- Evidence: hardcoded grayscale palette and `sessionStorage` auth check only.
- User risk: users with `localStorage` renter keys can hit unnecessary redirect friction if this route is opened directly.
- Impact hypothesis: key-source parity + canonical UI copy lowers failed deep-link monitor access by 10-18%.

### P1
4. Homepage trust stats include low-credibility static values.
- File: `app/page.tsx`
- Evidence: hero stats include static `75%` uptime and static GPU string while other reliability fields are dynamic.
- User risk: mixed dynamic/static trust signals lower perceived reliability compared to competitors.
- Impact hypothesis: replacing static trust stats with real telemetry or neutral labels improves homepage CTA confidence by 4-8%.

5. Job/playground error boundary exposes raw stack traces to end users.
- File: `app/renter/playground/page.tsx`
- Evidence: boundary renders `error.stack` and `componentStack` directly.
- User risk: production users see internal error details instead of actionable recovery guidance.
- Impact hypothesis: user-friendly recovery state improves retry rate after failure by 8-14%.

### P2
6. Legacy redirect pages use non-design-system colors and copy.
- Files: `app/jobs/submit/page.tsx`, `app/jobs/[id]/monitor/page.tsx`, `app/provider-onboarding/page.tsx`
- User risk: inconsistent visual quality during redirects degrades trust during high-intent transitions.
- Impact hypothesis: consistency uplift reduces bounce during route transitions by 3-6%.

## Implementation Checklist

| Priority | File path(s) | Exact change needed | Acceptance criteria | Suggested assignee |
|---|---|---|---|---|
| P0 | `app/provider/register/page.tsx` | Store polling interval ref and clear it on unmount/success; prevent duplicate polling sessions. | No polling continues after leaving page; only one active poll loop per registration success state. | Frontend Developer |
| P0 | `app/login/page.tsx`, `app/lib/i18n.tsx` | Move remaining hardcoded OTP/auth status strings to i18n keys with EN/AR values. | No user-facing hardcoded English in login OTP flow; EN/AR parity verified. | Frontend Developer |
| P0 | `app/jobs/[id]/monitor/page.tsx` | Read renter key from both `localStorage` and `sessionStorage`; align fallback copy/styles with design tokens. | Direct deep-link monitor page works for existing renter sessions regardless of storage source. | Frontend Developer |
| P1 | `app/page.tsx`, `backend/src/routes/providers.js` (if needed) | Replace static trust stats with actual API-backed values or neutral non-numeric trust labels until telemetry is available. | No misleading static reliability figures on homepage. | Frontend + Backend |
| P1 | `app/renter/playground/page.tsx` | Hide raw stack traces in production; show concise recovery actions (`Retry`, `Back to Jobs`, `Contact Support`). | Production users do not see internal stack text; recovery actions are visible. | Frontend Developer |
| P2 | `app/jobs/submit/page.tsx`, `app/jobs/[id]/monitor/page.tsx`, `app/provider-onboarding/page.tsx` | Normalize transitional screens to `dc1-*` design tokens and shared redirect microcopy component. | Redirect surfaces match platform visual language on mobile and desktop. | Frontend Developer |

## Product-reality guardrails
- Keep all messaging aligned to container-based GPU compute (no bare-metal claims).
- Do not introduce unapproved pricing promises.
- Keep Saudi energy-cost advantage and Arabic AI support as top-level value framing in high-visibility surfaces.

