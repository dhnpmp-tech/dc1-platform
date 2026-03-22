# DCP PDPL Compliance Gap Analysis

**Date**: 2026-03-19 (UTC)
**Scope**: PDPL review for DCP provider/renter data handling across backend, frontend, and sync services.
**Method**: Static review of repository implementation and legal pages.
**Note**: This is an engineering compliance assessment, not formal legal advice.

## Executive Summary

DCP has meaningful PDPL groundwork already in place: privacy policy publication, front-end consent UX, retention cleanup automation, and account erasure endpoints. The main compliance risk is a **policy-to-implementation gap**: consent is not enforced server-side or recorded, cross-border transfer controls are largely documentary, and breach notification appears as policy text without an operational incident workflow.

## 1) PII Inventory

### Current state
- Provider/renter identity and account data are stored in SQLite (`providers`, `renters`), including name, email, phone/organization.
- Device/network telemetry is stored (`ip_address`, `provider_ip`, `provider_hostname`, GPU metrics in `heartbeat_log`).
- Financial data is stored (`payments`, `withdrawals`, renter balances, provider earnings).
- Job content can include user-submitted payload and outputs (`jobs.task_spec`, `jobs.result`).
- Supabase sync copies user profile and financial-linked records (`users`, `wallets`, `rentals`, `transactions`, `withdrawals`).

### Gap
- No formal, versioned Record of Processing Activities (RoPA)/data inventory document in-repo.
- Privacy page says Supabase is "anonymized aggregate data only", but sync code sends direct identifiers (name/email).
- API keys are persisted in plaintext columns (provider/renter tables), increasing impact if DB is exposed.

### Recommended fix
- Create and maintain `docs/compliance/pdpl-data-inventory.md` with field-level mapping: data category, lawful basis, storage location, transfer path, retention, owner.
- Align policy language with implementation immediately (or reduce synced identifiers to match policy claim).
- Move to hashed-at-rest API key model (store key hash; show raw key once at issuance), with rotation and revocation preserved.

### Priority
**High**

## 2) Data Retention

### Current state
- Automated cleanup exists (`backend/src/services/cleanup.js`) and is scheduled daily at 02:00 UTC.
- Enforced policies in code:
  - `heartbeat_log`: 30 days
  - `job_logs`: 90 days
  - `daemon_events`: 30 days (180 for critical)
  - `jobs.task_spec`/`jobs.result`: nulled after 90 days for completed/failed jobs
  - `payments`: never deleted (comment references 7-year requirement)
- Erasure endpoints anonymize provider/renter account records.

### Gap
- "Never delete" payments is not equivalent to explicit 7-year lifecycle control; missing archive/purge-at-7-years control.
- No explicit retention rules implemented for some sensitive financial/support artifacts (for example `withdrawals.payout_details`) beyond account deletion/anonymization behavior.
- No dedicated retention policy document that maps each table/field to legal basis + retention timer.

### Recommended fix
- Implement retention tiers in code and docs, including explicit 7-year timer actions (archive then purge) for financial records where legally permitted.
- Add cleanup jobs for `withdrawals` sensitive details with legal exceptions documented.
- Add `docs/compliance/pdpl-retention-schedule.md` and link it from privacy policy.

### Priority
**High**

## 3) Consent Flows

### Current state
- Provider and renter registration pages require a PDPL consent checkbox in frontend UI.
- Privacy and terms pages are published; cross-border transfer language is displayed at registration.

### Gap
- Backend registration endpoints (`POST /api/providers/register`, `POST /api/renters/register`) do not require or verify consent fields.
- No server-side persistence of consent evidence (timestamp, policy version, transfer consent scope, source IP/UA).
- API clients can bypass frontend and register directly without explicit consent records.

### Recommended fix
- Make consent mandatory server-side (`pdpl_consent=true`, `pdpl_consent_version`, `pdpl_consent_at`).
- Reject registrations missing consent; log immutable consent evidence.
- Add migration fields in `providers` and `renters` tables and expose admin/audit reporting endpoint.

### Priority
**Critical**

## 4) Cross-Border Transfers

### Current state
- Privacy policy explicitly discloses non-KSA hosting and cross-border transfer.
- Registration UX asks users to consent to transfer outside Saudi Arabia.
- Sync service transfers identity and financial-linked metadata into Supabase.

### Gap
- No technical transfer governance artifacts found (transfer register, DPA references, transfer impact assessment, destination-by-dataset controls).
- Policy claim about Supabase "anonymized aggregate data only" conflicts with actual sync behavior.
- No evidence in repo of region-based data segregation/minimization for PDPL-sensitive fields.

### Recommended fix
- Produce a PDPL transfer dossier: destination inventory, categories transferred, legal mechanism, safeguards, owner, review cadence.
- Either reduce Supabase payloads to anonymized aggregates or update legal disclosures to exactly match transferred fields.
- Add configuration-level guardrails for data localization and per-table sync allowlists.

### Priority
**Critical**

## 5) Data Subject Rights (Access/Correction/Deletion)

### Current state
- Right to erasure is implemented for both personas via `DELETE /api/providers/me` and `DELETE /api/renters/me`.
- Endpoints anonymize direct identifiers and revoke API keys.
- Support/privacy channels are publicly listed for rights requests.

### Gap
- No self-service "export my data" endpoint for access requests.
- No structured rights-request workflow/audit trail in code (ticket ID, SLA state, completion proof).
- Correction rights appear manual (email-based) without formalized API/admin workflow.

### Recommended fix
- Add rights APIs/admin tooling:
  - `GET /api/{role}/export-data`
  - `POST /api/privacy/requests` + tracked states
  - Admin queue for correction/erasure request fulfillment evidence
- Add request logging for accountability (request type, requester identity, timestamps, resolution).

### Priority
**High**

## 6) Breach Notification (72 Hours to SDAIA)

### Current state
- Privacy policy commits to notifying affected users and SDAIA within 72 hours.
- General security controls exist (headers, rate limits, sanitization, monitoring-related routes).

### Gap
- No explicit incident response/breach notification runbook discovered in repo.
- No codified trigger/escalation flow tied to PDPL deadlines (detection timestamp, legal review, SDAIA submission tracking).
- No breach-specific evidence templates or communications workflow linked to backend events.

### Recommended fix
- Add `docs/compliance/pdpl-breach-response-runbook.md` with RACI, 72-hour timer procedure, SDAIA contact process, and evidence checklist.
- Implement incident event taxonomy + mandatory audit records for security incidents.
- Add tabletop test cadence (quarterly) and store completion evidence.

### Priority
**Critical**

## Priority Roadmap (30/60/90)

### 0-30 days
- Enforce and persist server-side consent for provider/renter registration.
- Correct privacy policy mismatch on Supabase data scope.
- Publish breach response runbook with 72-hour SLA workflow.

### 31-60 days
- Launch rights-request tracking workflow and export endpoint.
- Publish formal data inventory and retention schedule docs.
- Implement transfer register + safeguard records.

### 61-90 days
- Deploy hashed API key storage model.
- Add retention expiry automation for all regulated tables/fields.
- Run first PDPL readiness drill and remediation review.

## Evidence References (Code/Docs Reviewed)

- `backend/src/db.js`
- `backend/src/routes/providers.js`
- `backend/src/routes/renters.js`
- `backend/src/services/cleanup.js`
- `backend/src/services/supabase-sync.js`
- `backend/src/server.js`
- `app/provider/register/page.tsx`
- `app/renter/register/page.tsx`
- `app/privacy/page.tsx`
- `app/support/page.tsx`
- `app/terms/page.tsx`
