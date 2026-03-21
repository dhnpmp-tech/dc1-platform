# Renter Identity Source of Truth

## Decision
SQLite `renters` is the runtime source of truth for authentication (`/api/renters/login-email`, API key checks, billing, and job ownership).

Supabase `users` (type `renter`/`both`) is an external identity feed and analytics projection. It is not authoritative for API auth until reconciled into SQLite.

## Why
- Runtime endpoints and billing invariants already depend on SQLite foreign keys (`jobs.renter_id`, payments, balance updates).
- Converting auth source of truth in a hotfix path would risk regressions in job accounting.
- Reconciliation gives deterministic, idempotent recovery when Supabase has renter records that SQLite lacks.

## Reconciliation Rules
- Normalize renter email to lowercase before matching/upsert.
- Match existing SQLite renter by `LOWER(email)` first.
- Preserve existing SQLite financial state (`balance_halala`, `total_spent_halala`, `total_jobs`) for matched rows.
- Ensure every reconciled renter has a unique API key; generate `dc1-renter-<hex>` when missing/colliding.
- For new inserts, initialize totals safely (`total_spent_halala=0`, `total_jobs=0`) and derive balance from wallet when available.
- Reconciliation is idempotent: reruns update/repair the same row instead of creating duplicates.

## Operational Paths
- One-time or scheduled repair: `npm run renters:backfill` (from `backend/`).
- Runtime self-heal: `POST /api/renters/login-email` now falls back to Supabase lookup and upserts into SQLite when email is missing locally.
- Verification: `npm run renters:verify-login-email` validates that all Supabase renter emails resolve via the login-email endpoint.
