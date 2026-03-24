# PDPL Compliance Audit — DCP Platform

**Auditor:** Security Engineer (DCP-800)
**Date:** 2026-03-24
**Regulation:** Saudi Personal Data Protection Law (PDPL), Regulation No. M/19, 1443H
**Scope:** DCP platform backend, frontend, third-party integrations, data flows

---

## Executive Summary

DCP has a meaningful compliance foundation: a published PDPL-aware privacy policy, soft-delete endpoints, an audit log table (`pdpl_request_log`), rate-limited registration, and timing-safe authentication. However, **three critical gaps must be resolved before enterprise and government sales conversations**:

1. **No affirmative consent at registration** — users are not required to accept the privacy policy or terms before creating an account.
2. **Supabase data residency unverified** — billing and identity data may be stored outside Saudi Arabia.
3. **Resend (email) has no documented DPA** — personal data is transmitted to a US-based third party without a documented data processing agreement.

The sections below rate each item as **COMPLIANT**, **GAP**, or **N/A**.

---

## PDPL Principles Assessment

### Principle 1 — Lawfulness, Fairness, and Transparency

| Check | Status | Notes |
|-------|--------|-------|
| Privacy policy published and accessible | **COMPLIANT** | `app/legal/privacy/page.tsx` — published 2026-03-20, bilingual EN/AR |
| Terms of service published | **COMPLIANT** | `app/terms/page.tsx` — governing law: Saudi Arabia, Riyadh courts |
| Purpose of processing disclosed | **COMPLIANT** | Privacy policy documents purpose: matching, billing, fraud prevention, security |
| Affirmative consent at registration | **GAP** | Registration endpoints (`/api/providers/register`, `/api/renters/register`) do not require acknowledgement of privacy policy or terms — no checkbox, no version tracking |
| Cookie consent mechanism | **COMPLIANT** | `app/components/ui/CookieConsent.tsx` — bilingual banner, essential cookies always on, analytics opt-in pending future activation |

**Required action:** Add `terms_accepted_at` and `privacy_accepted_at` columns to `providers` and `renters` tables. Require acceptance checkbox at registration. Log accepted version URL/timestamp.

---

### Principle 2 — Purpose Limitation

| Check | Status | Notes |
|-------|--------|-------|
| Data collected only for stated purposes | **COMPLIANT** | Provider: marketplace matching, GPU benchmarking, billing. Renter: job dispatch, billing, API access. Both align to stated purposes. |
| Wallet address purpose documented | **GAP** | `providers.wallet_address` is collected but the withdrawal/payout flow is incomplete (escrow deferred). Purpose should be disclosed in privacy policy or collection should be deferred. |
| Job `task_spec` and `result` payloads | **COMPLIANT** | Contents NULL'd after 90 days by cleanup service (`backend/src/services/cleanup.js`) |

---

### Principle 3 — Data Minimisation

| Check | Status | Notes |
|-------|--------|-------|
| Only necessary fields collected at registration | **COMPLIANT** | Name, email, GPU model, phone, organization — all operationally justified |
| Full Moyasar `gateway_response` stored | **GAP** | `payments.gateway_response` stores the entire JSON blob from Moyasar, which may include raw card tokens, device fingerprints, or other fields beyond what is needed for reconciliation. Extract and retain only: `payment_id`, `status`, `amount`, `method`, `created_at`. |
| IP address logging in server logs | **GAP** | Every API request logs `req.ip` via rate-limiter and auth failure logs. No documented retention policy or automated purge for server-level logs. |

---

### Principle 4 — Accuracy

| Check | Status | Notes |
|-------|--------|-------|
| Users can update their data | **COMPLIANT** | Update endpoints exist for providers and renters (name, email, phone, organization) |
| No stale data accumulation mechanism | **COMPLIANT** | Cleanup service removes log data on defined schedules |

---

### Principle 5 — Storage Limitation (Retention)

| Data Type | Retention | Status | Notes |
|-----------|-----------|--------|-------|
| Job logs | 90 days | **COMPLIANT** | Hard-deleted by cleanup service |
| Heartbeat logs | 30 days | **COMPLIANT** | Hard-deleted by cleanup service |
| Job task/result payloads | 90 days | **COMPLIANT** | NULL'd (not deleted) by cleanup service |
| Account profile (provider/renter) | 30-day grace after deletion request | **COMPLIANT** | Soft-delete with `deleted_at` + `deletion_scheduled_for` |
| Payment records | 7 years | **COMPLIANT** | Legal obligation (SAMA financial regulation) — compliant exception |
| Server/PM2 logs (VPS) | Not defined | **GAP** | No documented retention or rotation policy for server-level stdout/PM2 logs on VPS 76.13.179.86. These capture IP addresses and potentially email addresses from error logs. |
| `quota_log` table | Indefinite | **GAP** | Contains renter_id + job_id + enforcement decisions. No cleanup schedule defined. |
| Soft-delete finalization | Not automated | **GAP** | `deletion_scheduled_for` is set but no automated workflow completes the final purge after 30 days. Manual intervention required. |

---

### Principle 6 — Integrity and Confidentiality (Security)

| Check | Status | Notes |
|-------|--------|-------|
| HTTPS enforced (api.dcp.sa) | **COMPLIANT** | Let's Encrypt cert, nginx TLS termination |
| Rate limiting on auth endpoints | **COMPLIANT** | 5 registration attempts / 10 min per IP; 10 login attempts / 15 min per IP |
| Timing-safe token comparison | **COMPLIANT** | `crypto.timingSafeEqual()` used for admin token comparison |
| Input sanitization | **COMPLIANT** | `sanitize()` strips HTML tags and null bytes from user input |
| API keys stored in plaintext | **GAP** | `providers.api_key` and `renters.api_key` stored as plaintext in SQLite. Should be stored as bcrypt hash or AES-256 encrypted. Plaintext storage means any database read exposes all credentials. |
| HMAC for provider heartbeats | **COMPLIANT** | SHA256 HMAC (`DC1_HMAC_SECRET`) implemented (DCP-722). Currently warning-only mode — recommend enabling enforcement before production provider onboarding. |
| Security headers | **COMPLIANT** | `Permissions-Policy` disables camera, microphone, geolocation |
| API key in query params (deprecated) | **GAP** | Fallback path `?key=` / `?renter_key=` is still operational and only logs a warning. URL parameters appear in server access logs. This exposes credentials in log files. Should be disabled, not just warned. |

---

## Data Residency Assessment

### VPS (76.13.179.86)

| Item | Status | Notes |
|------|--------|-------|
| VPS hosting location | **NEEDS VERIFICATION** | IP 76.13.179.86 resolves to a US-based provider (Century Link / Lumen). If Saudi data subjects' PII is processed here, this constitutes cross-border processing. PDPL requires consent or a lawful basis for cross-border transfer. |

**Action required:** Confirm VPS hosting location with provider. If US-hosted, either migrate to AWS Bahrain (me-south-1), AWS UAE (me-central-1), or Saudi-based hosting, OR obtain explicit consent from users for cross-border processing and document the lawful basis.

### Supabase

| Item | Status | Notes |
|------|--------|-------|
| Data residency | **GAP** | `.env.example` references `https://fvvxqp-qqjszv6vweybvjfpc.supabase.co`. Supabase default region is US East. Data includes: billing transactions, wallet balances, machine registrations, user references. This is personal and financial data subject to PDPL. |
| Data Processing Agreement | **GAP** | No DPA with Supabase documented in codebase. PDPL Article 29 requires a written agreement with data processors. |
| Mitigation options | — | (1) Migrate to Supabase in AWS Bahrain if available, (2) Replace with self-hosted Postgres on Saudi VPS, (3) Obtain explicit cross-border transfer consent from users with documented lawful basis. |

### Resend (Email Service)

| Item | Status | Notes |
|------|--------|-------|
| Data residency | **GAP** | Resend is US-based. Email addresses (PII) and job metadata (financial data) are transmitted with each notification. |
| Data Processing Agreement | **GAP** | No DPA documented. |
| Personal data in emails | — | Recipient email, job ID, model name, cost, provider earnings, API key in welcome email. |
| Mitigation options | — | (1) Sign Resend DPA (available at resend.com/dpa), (2) Evaluate Brevo (EU-based, GDPR-compliant, Saudi-accessible alternative), (3) For API key emails: generate one-time link instead of embedding key in email body. |

### Moyasar (Payment Gateway)

| Item | Status | Notes |
|------|--------|-------|
| Data residency | **COMPLIANT** | Moyasar is Saudi Arabia-based, PCI-DSS Level 1 certified. Domestic processing. |
| Data Processing Agreement | **COMPLIANT** | Covered by Moyasar merchant agreement (standard for Saudi payment processors). |

---

## Data Flow Map

```
User (Browser)
    │
    ├─── HTTPS ──► api.dcp.sa (nginx) ──► Backend (port 8083, VPS 76.13.179.86)
    │                                           │
    │                                           ├─► SQLite DB (local, VPS)
    │                                           │   providers, renters, jobs, payments, logs
    │                                           │
    │                                           ├─► Supabase (cloud, region TBD) ⚠️
    │                                           │   billing_transactions, reservations,
    │                                           │   sessions, machines, wallets
    │                                           │
    │                                           ├─► Moyasar (Saudi Arabia) ✅
    │                                           │   payment processing
    │                                           │
    │                                           └─► Resend (US-based) ⚠️
    │                                               email (PII + financial data)
    │
    └─── HTTPS ──► Frontend (Next.js)
```

---

## PDPL Rights Implementation

| Right | Endpoint | Status | Gap |
|-------|----------|--------|-----|
| Right to access / export data | Not implemented | **GAP** | Privacy policy states right exists and "one request per 24 hours" but no `/api/providers/me/export` or `/api/renters/me/export` endpoint found in codebase. |
| Right to correction | Provider/Renter PATCH endpoints | **COMPLIANT** | Update endpoints functional. |
| Right to deletion | `DELETE /api/providers/me`, `DELETE /api/renters/me` | **COMPLIANT** | Soft-delete with 30-day grace. **Gap:** finalization not automated (see Principle 5). |
| Right to object to processing | Not implemented | **GAP** | No mechanism for users to object to specific processing activities (e.g., telemetry, analytics). |
| Right to portability | Not implemented | **GAP** | No structured export endpoint. |

---

## Third-Party Integration Summary

| Service | Purpose | Location | DPA Status | PDPL Risk |
|---------|---------|----------|------------|-----------|
| Supabase | Cloud database (billing, machines) | US East (default) | **Missing** | **HIGH** — PII + financial data |
| Resend | Transactional email | US-based | **Missing** | **MEDIUM** — email + job metadata |
| Moyasar | Payment processing | Saudi Arabia | Covered by merchant agreement | LOW |
| PM2 / VPS logs | Server logging | VPS (location TBD) | N/A (internal) | **MEDIUM** — IP addresses indefinitely retained |

---

## Prioritised Remediation Plan

### Critical (block enterprise sales)

1. **Consent at registration** — Add `terms_accepted_at` / `privacy_accepted_at` fields. Require checkbox at signup. Track accepted document version.
2. **Supabase DPA + residency** — Confirm hosting region; sign Supabase DPA; migrate to Bahrain/UAE region or self-host if needed.
3. **Data export endpoint** — Implement `GET /api/providers/me/export` and `GET /api/renters/me/export` returning structured JSON/CSV of all personal data held.

### High (address before Series A / government contracts)

4. **Resend DPA** — Sign data processing agreement with Resend or migrate to GDPR/PDPL-aligned alternative.
5. **Soft-delete automation** — Implement cron job to finalize account deletion after 30-day grace period.
6. **API key encryption at rest** — Store API keys hashed (bcrypt) or encrypted (AES-256). Migration requires token rotation.
7. **Log retention policy** — Define and automate PM2 log rotation (max 30 days). Add `quota_log` cleanup to the daily cleanup service.

### Medium (address within 90 days)

8. **Disable API key in query params** — Remove the `?key=` / `?renter_key=` fallback entirely. It has been deprecated; force headers-only.
9. **Minimize Moyasar stored data** — Extract only needed fields from `gateway_response` before storing.
10. **VPS hosting verification** — Confirm VPS datacenter location. If outside Saudi Arabia, document lawful basis for cross-border transfer.
11. **Wallet address purpose disclosure** — Add explicit disclosure in privacy policy for wallet address collection once escrow is activated.

---

## Positive Compliance Foundations

The following controls are already in place and represent genuine PDPL readiness:

- `pdpl_request_log` table provides an immutable audit trail for all PDPL-related requests
- Privacy policy explicitly cites PDPL regulation number (M/19, 1443H)
- Bilingual privacy policy and cookie consent (English + Arabic / RTL)
- Soft-delete endpoints with 30-day grace period
- Automated data lifecycle cleanup (heartbeat logs 30d, job logs 90d, task payloads NULLed)
- Payment records retained 7 years (SAMA compliance)
- Rate limiting prevents bulk data harvesting through registration/login
- Timing-safe authentication prevents credential enumeration
- HTML/null-byte sanitisation prevents injection-based data exfiltration
- HTTPS enforced with valid Let's Encrypt certificate
- `Permissions-Policy` header disabling browser sensors

---

*For questions or updates, contact: security@dcp.sa | DCP-800*
