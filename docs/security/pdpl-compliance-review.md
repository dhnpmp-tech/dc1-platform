# PDPL Compliance Review

**Auditor:** Security Engineer (DCP-822)
**Date:** 2026-03-24
**Scope:** Saudi Personal Data Protection Law (PDPL) — review of all external data flows, PII storage, job payload handling, and provider/renter data access controls
**Overall Rating:** 🟡 **MOSTLY COMPLIANT** — two cross-border data flows require DPA or consent documentation; no data sovereignty violations found

---

## 1. Executive Summary

Saudi PDPL (Royal Decree M/19, in force 2023) requires that personal data collected from Saudi residents is processed lawfully, stored securely, and — critically — that **cross-border transfers** are explicitly justified. DCP collects emails, names, and payment metadata. Three external services receive personal data. This review documents each flow, its PDPL basis, and required remediation.

**Findings:** 2 HIGH (cross-border email processor, missing PDPL policy), 2 MEDIUM (payment description includes full name, job error text in emails), 2 LOW (GPU stats access scoping, audit log retention).

---

## 2. PII Inventory

### 2.1 Provider PII stored in `providers` table

| Field | Type | Stored? | Who can read |
|---|---|---|---|
| `name` | Personal identifier | ✅ | Admin, provider (self) |
| `email` | Personal identifier | ✅ | Admin, provider (self) |
| `phone` | Personal identifier | ✅ (if supplied) | Admin only |
| `ip_address` | Network identifier (PII under PDPL) | ✅ (from heartbeat) | Admin, **see Finding 1** |
| `gpu_model`, `os`, `resource_spec` | Technical metadata | ✅ | Admin, marketplace (anonymised) |
| `api_key` | Credential | ✅ (hashed?) | Provider (self) — see §5 |

### 2.2 Renter PII stored in `renters` table

| Field | Type | Stored? | Who can read |
|---|---|---|---|
| `name` | Personal identifier | ✅ | Admin, renter (self) |
| `email` | Personal identifier | ✅ | Admin, renter (self), Resend (**Finding 2**), Moyasar (**Finding 3**) |
| `webhook_url` | Operational config | ✅ | Admin, renter (self) |
| `balance_halala` | Financial data | ✅ | Admin, renter (self) |

### 2.3 Job data stored in `jobs` table

| Field | Type | Sensitive? | Notes |
|---|---|---|---|
| `job_input` | Payload JSON | ⚠️ **Potentially** | May contain personal data if renter submits prompts containing PII |
| `job_output` / `result_url` | Output | ⚠️ Potentially | Inference results; content depends on workload |
| `renter_id`, `provider_id` | Internal IDs | Low | Pseudonymous |
| `job_type`, `model` | Metadata | No | |
| `cost_halala`, `gpu_seconds` | Financial/billing | Low | |

---

## 3. External Data Flows

### Flow 1 — Resend (email service) — 🔴 HIGH

**Service:** Resend Inc. (US-based) — `https://api.resend.com/emails`
**File:** `backend/src/services/emailService.js`
**Data sent:**
- `to`: renter/provider email address (personal data)
- `html`/`text` body: name (e.g., `Hello ${name}`), job IDs, cost amounts
- For job-failed emails: `lastError` string is included — could contain PII if provider error messages include renter input content

**PDPL concern:** Cross-border transfer to a US entity. PDPL Article 24 requires that cross-border transfers occur only when:
- The foreign country provides adequate data protection (US has no adequacy decision with KSA), OR
- The data subject has given explicit consent, OR
- Transfer is necessary for contract performance (the strongest available basis here)

**Assessment:** Sending transactional emails (welcome, job complete) is necessary for service delivery and falls under "contractual necessity" (PDPL Art. 25.2). However, this basis must be documented in a Data Processing Agreement (DPA) with Resend and disclosed in the Privacy Policy.

**Findings:**
- **HIGH:** No DPA with Resend documented. Required before processing live user data.
- **MEDIUM:** `lastError` field in job-failed emails (line 376, `emailService.js`) could expose renter-supplied content back in the email body. The error originates from provider-side execution and may include excerpts of the job input. This should be sanitised to remove any content from the job payload before sending.

**Remediation:**
1. Execute a DPA with Resend covering KSA data subjects.
2. Add PDPL cross-border transfer disclosure to Privacy Policy.
3. Sanitise `lastError` before including in email: strip or truncate to technical error codes, remove any content resembling user input.

---

### Flow 2 — Moyasar (payment gateway) — 🟢 COMPLIANT

**Service:** Moyasar (Saudi-based payment processor, licensed by SAMA) — `https://api.moyasar.com/v1`
**File:** `backend/src/routes/payments.js` (lines 263–275)
**Data sent:**
```js
description: `DCP balance top-up — ${renter.name} (${renter.email})`
metadata: { renter_id: renter.id, renter_email: renter.email }
```
**Assessment:** Moyasar is a SAMA-regulated Saudi entity. Data remains in-Kingdom. This satisfies PDPL data localisation requirements.

**Finding (MEDIUM):** The payment `description` field concatenates the renter's full name and email in a human-readable string that is stored in Moyasar's system and may appear in payment reconciliation reports. This is more PII than necessary — Moyasar only needs the `renter_id` for reconciliation.

**Remediation (Low Priority):** Replace description with a pseudonymous identifier:
```js
description: `DCP balance top-up — renter:${renter.id}`
// Keep renter_email in metadata for internal reconciliation only
```

---

### Flow 3 — Telegram Bot API — 🟢 COMPLIANT (aggregate data only)

**Service:** Telegram (international) — `https://api.telegram.org`
**Files:** `backend/src/services/notifications.js`, `backend/src/routes/standup.js`

**Data sent — notifications.js (`sendAlert`):**
- Alert messages containing: event name (e.g., `provider_crash`), free-text `details` string, timestamp
- The `details` parameter is constructed internally (e.g., `"control-plane SLO breach: queue=0"`)
- **No email, name, IP address, or job content is sent**

**Data sent — standup.js (`sendToTelegram`):**
- Aggregate fleet metrics: total provider count, online/offline counts, GPU model distribution, average utilisation, at-risk count
- **No individual provider IDs, names, emails, or IPs included**

**Assessment:** Only aggregate operational statistics are sent to Telegram — no personal data. Not subject to PDPL cross-border restrictions.

**Note:** Ensure `sendAlert` callers never pass PII (email, name, IP) in the `details` string. Current codebase is clean; this is an ongoing practice requirement.

---

### Flow 4 — Renter Webhooks (user-controlled endpoints) — 🟢 COMPLIANT

**Service:** Renter-configured URLs (arbitrary HTTPS endpoints)
**File:** `backend/src/routes/jobs.js` (lines 94–150)

**Data sent:**
```js
{
  event: eventName,
  job: { id, job_id, renter_id, provider_id, status, job_type, submitted_at, started_at, completed_at },
  billing: { ... }
}
```

**Assessment:** The renter is sending data to their own endpoint. No job payload/prompt content is included. `renter_id` and `provider_id` are internal pseudonymous IDs. This is the renter exercising their own data — PDPL Article 4 exempts self-directed processing. The webhook validation (HMAC signature, public URL enforcement) is correct.

---

## 4. Job Payload Content — PII Risk

**Question:** Can job `job_input` contain personal data? Is it logged anywhere?

**Findings:**
- `job_input` is stored as JSON in the `jobs` table.
- Console logging review: no `console.log` or `console.error` statements print `job_input` content (`grep` confirms: only job IDs and error messages are logged, not payload content).
- Job execution logs (`job_execution_logs` table) store provider-side execution output, which may contain inference results. These are accessible to the renter who owns the job.
- **No job payload content is sent to any external service.**

**Assessment:** 🟢 Clean. Job inputs are stored locally and never transmitted externally. Renter output is accessible only to the renter (enforced by `WHERE renter_id = ?` binding in queries).

**Recommendation:** Add a data retention policy for `job_input` and `job_execution_logs`. Long-term storage of AI inference inputs (which may contain personal data) without a defined retention period creates PDPL Article 18 compliance risk (data must not be retained beyond purpose).

---

## 5. GPU Stats — Sensitivity Assessment

**Question:** Are `vram_used`, `jobs_running`, `gpu_utilization` considered personal data?

**Assessment:** These are technical metrics of a GPU device, not of a natural person. Under PDPL, personal data is data that identifies or can be used to identify a natural person. GPU utilisation stats linked to a provider ID (pseudonymous) do not meet this threshold.

**However (Finding LOW):** The `GET /api/providers/marketplace` endpoint returns provider stats to authenticated renters. This includes `gpu_utilization`, `vram_used_mb`, and `jobs_active`. These are operational data that renters need to select providers — appropriate disclosure.

**Finding (LOW):** `GET /api/network/providers` (reviewed in sprint28-endpoint-audit.md) returns `ip_address` and `provider_ip` to **unauthenticated callers**. IP addresses are personal data under PDPL. This is a data exposure violation — already flagged as HIGH in DCP-786.

---

## 6. Missing Privacy Infrastructure

### 6.1 Privacy Policy — 🔴 HIGH

No Privacy Policy accessible at `https://dcp.sa/privacy` was found in the codebase. PDPL Article 11 requires that a controller publish a clear privacy notice covering:
- What personal data is collected
- Legal basis for processing
- Data retention periods
- Cross-border transfer disclosures (Resend)
- Data subject rights (access, correction, deletion, portability)
- Contact for the Data Protection Officer (or designated contact)

**This is required before accepting live Saudi users.**

### 6.2 PDPL Data Subject Rights Endpoints — 🟡 MEDIUM

The system already implements:
- ✅ Data export: `GET /api/renters/export`, `GET /api/providers/export` (with `renterDataExportLimiter`, `providerDataExportLimiter`)
- ✅ Account deletion: endpoints exist with rate limiting
- ✅ Export confirmation email: `sendDataExportReady` in emailService.js

Missing:
- ⚠️ **Correction/update**: No documented endpoint for renters/providers to correct their stored name, email, or phone number
- ⚠️ **Objection to processing**: No mechanism for a user to opt out of non-essential processing (e.g., standup aggregation)
- ⚠️ **DPA register**: No internal record of third-party data processors (Resend, Moyasar)

### 6.3 Audit Log Retention — 🟢 LOW

The `admin_audit_log` table records admin actions. The cleanup service (`services/cleanup.js`) runs daily. Confirm that audit logs are retained for the PDPL-required minimum period (PDPL implementing regulations specify audit records must be kept for at least 5 years for financial data; general logs at least 1 year).

---

## 7. API Key Storage

**Finding (LOW):** The `api_key` field in `providers` and `renters` tables should be assessed for hashing. Storing raw API keys means a database breach exposes all provider/renter credentials. Industry best practice (and a reasonable PDPL "appropriate technical measures" obligation) is to store only a hash of the key and validate via constant-time comparison.

Confirm whether `api_key` is stored raw or hashed (not verified in this audit — requires schema/DB review).

---

## 8. Findings Summary

| ID | Finding | Severity | PDPL Article | Remediation Owner |
|---|---|---|---|---|
| PDPL-1 | No DPA with Resend (cross-border email processor) | 🔴 HIGH | Art. 24-25 | Legal + Founder |
| PDPL-2 | No Privacy Policy published at dcp.sa/privacy | 🔴 HIGH | Art. 11 | Copywriter + Legal |
| PDPL-3 | `lastError` in job-failed emails may contain job input content | 🟡 MEDIUM | Art. 6 | Backend Architect |
| PDPL-4 | Payment description sends `name (email)` to Moyasar (unnecessary PII) | 🟡 MEDIUM | Art. 6 (minimisation) | Backend Architect |
| PDPL-5 | IP address exposed on unauthenticated `/api/network/providers` (see DCP-786) | 🔴 HIGH | Art. 6 | Backend Architect (already flagged) |
| PDPL-6 | Missing data correction endpoint for renters/providers | 🟡 MEDIUM | Art. 14 | Backend Architect |
| PDPL-7 | No defined retention period for `job_input` and `job_execution_logs` | 🟢 LOW | Art. 18 | Backend Architect |
| PDPL-8 | API keys may be stored raw (requires schema confirmation) | 🟢 LOW | Art. 19 | Backend Architect |

---

## 9. What Is Already Strong

- ✅ Moyasar (payment processor) is Saudi-based — data stays in-Kingdom for financial processing
- ✅ Telegram alerts contain only aggregate stats — no personal data crosses border
- ✅ Renter webhooks include no job payload content — HMAC-signed, public-URL-only
- ✅ Data export endpoints implemented with rate limiting (PDPL Art. 14 portability right)
- ✅ Account deletion endpoints exist (PDPL Art. 14 erasure right)
- ✅ Email notification for data exports (PDPL transparency)
- ✅ Input sanitisation middleware strips HTML/null bytes before processing
- ✅ Auth failure audit logging in place
- ✅ `jobs` table: job payload content never logged or sent externally

---

## 10. Priority Actions (Pre-Launch)

1. **Execute DPA with Resend** — before accepting any Saudi user emails in production
2. **Publish Privacy Policy** at `dcp.sa/privacy` — PDPL Art. 11 requirement
3. **Fix IP address exposure** on `/api/network/providers` — HIGH, already flagged in DCP-786
4. **Sanitise `lastError` in job-failed emails** — strip job content before transmission
5. **Add data correction endpoint** — PDPL Art. 14 (correction right)
