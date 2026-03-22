# DCP UX Key Flows Audit — Prioritized Recommendations (2026-03-22 21:37 UTC)

Owner: UI/UX Specialist

## Scope
- Homepage (`app/page.tsx`)
- Onboarding (`app/renter/register/page.tsx`, `app/provider/register/page.tsx`, `app/provider/download/page.tsx`)
- Auth (`app/login/page.tsx`, `app/renter/page.tsx`)
- Job submission (`app/renter/playground/page.tsx`)
- Output retrieval (`app/renter/jobs/page.tsx`, `app/renter/jobs/[id]/page.tsx`, `backend/src/routes/jobs.js`)

Benchmark patterns used from prior verified competitor pass (`docs/research/dcp-489-competitor-ux-refresh-2026-03-21.md`):
- One canonical first-run path (RunPod/Vast style mode clarity)
- Strong trust continuity between submit -> monitor -> download
- Recovery-oriented errors (avoid exposing implementation detail)

## Findings (Prioritized)

### P0-1: Output retrieval "Download full log" links are missing renter auth and can fail with 403
Evidence:
- Frontend links omit key query param:
  - `app/renter/jobs/[id]/page.tsx:281`
  - `app/renter/jobs/[id]/page.tsx:395`
- Backend requires renter/provider/admin auth on logs endpoint:
  - `backend/src/routes/jobs.js:2910`
  - `backend/src/routes/jobs.js:423`

Why it matters:
- This is the final trust moment after job execution. Failed log export looks like "job finished but artifacts are inaccessible".

Recommendation:
- Append `?key=${encodeURIComponent(apiKey)}` (or `renter_key`) to download URLs in job detail/history output surfaces.
- Add a guarded disabled state when no renter key exists.

Impact hypothesis:
- Increase successful log export completion by 20-35% for authenticated renters.
- Reduce support tickets for "cannot download logs" by 30%+.

### P0-2: Renter auth model is still split between `/login` and inline API-key gate
Evidence:
- Dashboard still renders inline key form when unauthenticated:
  - `app/renter/page.tsx:243`
- Current gate bypasses canonical `/login` flow where OTP and restored intent already exist:
  - `app/login/page.tsx:58`

Why it matters:
- Two parallel login experiences create decision friction and inconsistent recovery behavior.

Recommendation:
- Replace inline renter auth form in `app/renter/page.tsx` with redirect to `/login?role=renter&redirect=/renter`.
- Keep API-key auth mode inside `/login` as the only fallback path.

Impact hypothesis:
- Improve renter sign-in completion by 8-15%.
- Reduce auth-related drop-offs on dashboard entry by 10%+.

### P1-1: Job submission model presets under-represent DCP's Arabic-first positioning
Evidence:
- Playground model/preset list currently emphasizes TinyLlama/Gemma/DeepSeek and does not foreground ALLaM/JAIS/Falcon/BGE:
  - `app/renter/playground/page.tsx:144`
  - `app/renter/playground/page.tsx:300`

Why it matters:
- DCP's differentiation is Saudi energy advantage + Arabic model support. Submission flow should reinforce this, not only docs/homepage.

Recommendation:
- Add an "Arabic Quick Launch" preset row in playground with ALLaM/Falcon/JAIS/BGE-M3-compatible starter prompts (only for models supported by current backend catalog).
- Keep container-based execution messaging explicit in the same panel.

Impact hypothesis:
- Increase first-job starts on Arabic-capability workloads by 15-25%.
- Improve message consistency from landing to submit flow.

### P1-2: Jobs list still includes hardcoded English strings and non-localized affordances
Evidence:
- Hardcoded copy in renter jobs page:
  - `app/renter/jobs/page.tsx:248` (`auto-refreshes every 30s`)
  - `app/renter/jobs/page.tsx:155` (`Failed to re-submit job`)
  - `app/renter/jobs/page.tsx:167` (`Network error. Please try again.`)
  - `app/renter/jobs/page.tsx:255` (`aria-label="Export job history as CSV"`)

Why it matters:
- Arabic parity breaks in monitoring/retry, a critical post-payment path.

Recommendation:
- Move remaining user-facing strings and accessibility labels into `app/lib/i18n.tsx` and consume via `t(...)`.

Impact hypothesis:
- Reduce Arabic-locale retry confusion and support touches by 10-20%.

### P2-1: Provider download UX has high hardcoded copy/style entropy and weak trust continuity
Evidence:
- Hardcoded labels and copy not routed through i18n/design tokens:
  - `app/provider/download/page.tsx:30`
  - `app/provider/download/page.tsx:161`
  - `app/provider/download/page.tsx:248`

Why it matters:
- This is a high-intent acquisition screen. Language/style inconsistency lowers confidence during daemon install.

Recommendation:
- Normalize strings to i18n keys and replace repeated inline styles with design-token classes.
- Keep canonical setup route messaging but make one primary action per state (waiting/heartbeat/ready/etc.).

Impact hypothesis:
- Improve provider install command copy success and reduce abandonment before first heartbeat.

## Implementation Checklist

1. P0 — Output retrieval auth continuity
- File paths:
  - `app/renter/jobs/[id]/page.tsx`
- Exact changes:
  - Add renter key query param to log download links.
  - Disable or hide download CTA when key unavailable.
- Acceptance criteria:
  - Clicking "Download full log" succeeds for authenticated renters.
  - No 403 due to missing auth in normal renter flow.
- Suggested assignee: Frontend Developer

2. P0 — Canonical renter auth entry
- File paths:
  - `app/renter/page.tsx`
  - `app/login/page.tsx` (optional redirect-context cleanup)
- Exact changes:
  - Replace inline API key gate with redirect to `/login` preserving destination.
- Acceptance criteria:
  - Unauthenticated renter access to `/renter` always routes through `/login`.
  - Post-login returns to renter dashboard or intended page.
- Suggested assignee: Frontend Developer

3. P1 — Arabic-first submission presets
- File paths:
  - `app/renter/playground/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Add Arabic quick-launch preset section aligned with supported model catalog.
- Acceptance criteria:
  - Arabic-focused preset options appear above generic presets.
  - Copy remains truthful to current backend-supported models.
- Suggested assignee: Frontend Developer + Backend Architect (catalog validation)

4. P1 — Jobs page localization cleanup
- File paths:
  - `app/renter/jobs/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Move hardcoded strings to i18n and use translated labels.
- Acceptance criteria:
  - No hardcoded user-facing English in renter jobs list/retry/export affordances.
- Suggested assignee: Frontend Developer

5. P2 — Provider download consistency pass
- File paths:
  - `app/provider/download/page.tsx`
  - `app/lib/i18n.tsx`
- Exact changes:
  - Convert hardcoded UI text to i18n keys and reduce inline style duplication.
- Acceptance criteria:
  - EN/AR parity on provider download page.
  - Visual language matches DCP design tokens.
- Suggested assignee: Frontend Developer
