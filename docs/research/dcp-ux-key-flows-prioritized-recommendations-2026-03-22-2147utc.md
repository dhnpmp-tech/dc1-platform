# DCP UX Key Flows Delta Audit — Prioritized Recommendations (2026-03-22 21:47 UTC)

Owner: UI/UX Specialist  
Scope: homepage, onboarding, auth, job submission, output retrieval

## What changed since the last pass
- Previously flagged P0 issues are now fixed in code:
  - Renter dashboard now redirects unauthenticated users to canonical `/login` flow (`app/renter/page.tsx`).
  - Job log download links now include renter auth context and track blocked clicks (`app/renter/jobs/[id]/page.tsx`).

This report captures the **next** highest-impact UX gaps for conversion, trust, and Arabic-market positioning.

## Competitor benchmark patterns used
- **RunPod / Together.ai**: single primary action per screen, reduced decision load on first run.
- **Vast.ai**: clear mode distinction between marketplace selection and task execution.
- **Lambda / Modal docs patterns**: strong model/task quickstart rails in the submit flow.

Applied to DCP constraints:
- Keep claims aligned with current reality: containerized NVIDIA runtime, no bare-metal claim.
- Do not introduce unapproved financial or pricing promises.

## Findings (prioritized)

### P0-1: Provider onboarding still shows hardcoded earnings estimates (policy/compliance risk)
Evidence:
- `GPU_EARNINGS` table and SAR output math are hardcoded in provider registration flow:
  - `app/provider/register/page.tsx:35`
  - `app/provider/register/page.tsx:1076`
  - `app/provider/register/page.tsx:1082`
  - `app/provider/register/page.tsx:1088`
  - `app/provider/register/page.tsx:1094`

Why this matters:
- Current platform guidance requires avoiding unapproved pricing/financial claims. Hardcoded forecast numbers can drift from real economics and weaken trust.

Recommendation:
- Replace numeric earnings projection card with scenario-neutral messaging tied to actual settled jobs and uptime factors.
- If calculator is retained, source rates from an approved backend config endpoint with governance ownership.

Impact hypothesis:
- Reduce provider onboarding confusion/dispute tickets by 20-35%.
- Reduce risk of trust breakage from expectation mismatch in first-week provider activation.

---

### P1-1: Renter jobs list still leaks non-localized English in critical post-payment flow
Evidence:
- Hardcoded retry/export/status copy remains:
  - `app/renter/jobs/page.tsx:155`
  - `app/renter/jobs/page.tsx:167`
  - `app/renter/jobs/page.tsx:248`
  - `app/renter/jobs/page.tsx:255`

Why this matters:
- Monitoring and retry are high-stress moments after a paid action. Mixed language states increase recovery friction for Arabic users.

Recommendation:
- Move all remaining user-facing and accessibility strings in this file to `app/lib/i18n.tsx`.
- Ensure parity for retry errors, refresh hints, and export labels.

Impact hypothesis:
- Improve Arabic-locale task recovery completion by 10-18%.
- Reduce support touches for “what happened to my job?” flows by 10%+.

---

### P1-2: Provider download page has hardcoded UI copy and placeholder drift (`dc1-` vs DCP branding)
Evidence:
- Hardcoded labels and placeholders bypass translation tokens:
  - `app/provider/download/page.tsx:30`
  - `app/provider/download/page.tsx:161`
  - `app/provider/download/page.tsx:166`

Why this matters:
- This page is the install-critical trust moment. Brand/token inconsistency looks unfinished and can lower install completion.

Recommendation:
- Localize static labels (`Provider API Key`, copy button labels, requirements labels, placeholder text).
- Align placeholder prefix and helper text with canonical DCP naming conventions used elsewhere.

Impact hypothesis:
- Increase provider install command copy completion by 8-15%.
- Reduce onboarding drop-off before first heartbeat by 8-12%.

---

### P2-1: Submission presets underplay Arabic-first model positioning in the first-run launcher
Evidence:
- Default preset/model emphasis remains generic with a single Arabic-support preset:
  - `app/renter/playground/page.tsx:287`
  - `app/renter/playground/page.tsx:308`
- Landing already highlights Arabic model differentiators:
  - `app/page.tsx:817`

Why this matters:
- DCP differentiation is strongest at “first job” moment. If the playground defaults do not echo Arabic-first positioning, conversion intent decays between marketing and product.

Recommendation:
- Add an explicit “Arabic quick launch” preset group in playground using only currently supported catalog options.
- Keep runtime messaging explicit: containerized execution on provider GPUs.

Impact hypothesis:
- Increase first-job starts for Arabic workloads by 12-22%.
- Improve landing-to-submit message continuity and reduce “where are Arabic options?” confusion.

## Implementation Checklist

### P0
1. **Provider earnings claim hardening**
- Files: `app/provider/register/page.tsx`, optional backend config endpoint in `backend/src/routes/*`
- Changes:
  - Remove or gate hardcoded earnings calculator.
  - Replace with policy-safe explanatory block, or server-driven approved values.
- Acceptance criteria:
  - No unapproved numeric earnings claims in provider registration flow.
  - Provider value messaging remains clear without fixed forecast promises.
- Suggested assignee: Frontend Developer + Founding Engineer

### P1
2. **Renter jobs localization completion**
- Files: `app/renter/jobs/page.tsx`, `app/lib/i18n.tsx`
- Changes:
  - Extract all remaining hardcoded strings and aria labels to i18n keys.
- Acceptance criteria:
  - No hardcoded English user-facing text remains in renter jobs list/retry/export path.
- Suggested assignee: Frontend Developer

3. **Provider download consistency pass**
- Files: `app/provider/download/page.tsx`, `app/lib/i18n.tsx`
- Changes:
  - Localize static labels and placeholders; align naming tokens with DCP branding.
- Acceptance criteria:
  - EN/AR parity on provider download page with no hardcoded UI copy.
- Suggested assignee: Frontend Developer

### P2
4. **Arabic quick-launch preset rail in playground**
- Files: `app/renter/playground/page.tsx`, `app/lib/i18n.tsx`
- Changes:
  - Add dedicated Arabic quick-launch preset group and preserve truthful model/runtime copy.
- Acceptance criteria:
  - Arabic-first presets appear as an explicit first-run option without over-claiming support.
- Suggested assignee: Frontend Developer + Backend Architect (catalog validation)
