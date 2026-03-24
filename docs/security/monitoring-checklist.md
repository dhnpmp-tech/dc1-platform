# DCP Security Monitoring Checklist

**Document:** Post-Launch Production Security Monitoring
**Issue:** DCP-817
**Status:** Operational — review quarterly or after any security incident

---

## Overview

This checklist defines what to monitor in production once real providers and renters are active. Each item includes the alert threshold, the underlying data source, and the first-response action.

The backend uses SQLite (`providers.db`) on VPS 76.13.179.86. Monitoring is currently manual SQL + log inspection. Automated alerting should be wired to the notification system in `backend/src/services/notifications.js` when volume justifies it.

---

## 1. Authentication Failures

| Signal | Threshold | Action |
|--------|-----------|--------|
| Requests rejected with 401 over 10-minute window | > 10 from same IP | Investigate IP, check if brute-forcing provider or renter API key |
| Admin endpoint 401s | > 3 in 10 minutes | Notify founder immediately — possible admin token leak |
| Provider API key used from new IP (first-seen IP) | Any occurrence | Log and flag — possible key theft |

**Data source:** Backend stdout logs (`pm2 logs dc1-provider-onboarding`), `provider_api_keys.last_used_at`, `heartbeat_log.provider_ip`

**Check command:**
```bash
pm2 logs dc1-provider-onboarding --nostream --lines 500 | grep '"status":401'
```

---

## 2. Rate Limit 429 Responses

| Signal | Threshold | Action |
|--------|-----------|--------|
| 429 responses per minute | > 50 sustained | Investigate renter IDs; check if single actor is causing it |
| 429s on `/api/jobs/submit` | > 20 in 5 minutes from one renter | Possible automated abuse or broken client loop |
| 429s on admin endpoints (`/api/admin/*`) | Any | Review `admin_rate_limit_log` immediately |

**Data source:** `admin_rate_limit_log` table, backend logs

**Check command:**
```bash
pm2 logs dc1-provider-onboarding --nostream --lines 1000 | grep '"status":429' | wc -l
```

```sql
-- Admin rate limit events in last hour
SELECT action_key, actor_fingerprint, COUNT(*) as hits
FROM admin_rate_limit_log
WHERE created_at > datetime('now', '-1 hour')
GROUP BY action_key, actor_fingerprint
ORDER BY hits DESC;
```

---

## 3. Admin Endpoint Access

Every request to `/api/admin/*` is logged to `admin_audit_log` by `requireAdminRbac` middleware. Every access must be accountable.

| Signal | Threshold | Action |
|--------|-----------|--------|
| Admin access from unexpected IP | Any | Confirm with founder; rotate `DC1_ADMIN_TOKEN` if unrecognized |
| Bulk operations (mass approve/reject/credit) | > 10 records in 1 minute | Confirm legitimate batch operation; check `details` column |
| Credit grants > 10,000 halala | Any single grant | Founder must confirm manually |

**Check command:**
```sql
-- All admin actions in last 24 hours
SELECT timestamp, admin_user_id, action, target_type, target_id, details
FROM admin_audit_log
WHERE timestamp > datetime('now', '-24 hours')
ORDER BY timestamp DESC;
```

---

## 4. Job Submission Anomalies

Unusual job submissions may indicate billing fraud, token stuffing, or a renter misconfiguration causing runaway cost.

| Signal | Threshold | Action |
|--------|-----------|--------|
| Single job token count > 10× the 7-day average | Any | Hold job, notify renter, investigate before billing |
| Renter submits > 50 jobs in 1 hour | Any | Check quota_log; may need manual rate cap |
| Job `cost_halala` > 1,000,000 (≈ SAR 10) in single job | Any | Review before settling; confirm with renter |
| Jobs with status `failed` > 30% of submissions for a provider | > 30% | Provider health issue; flag for investigation |

**Data source:** `jobs`, `quota_log`, `serve_sessions`

**Check command:**
```sql
-- Renters with > 20 job submissions today
SELECT r.email, COUNT(j.id) as jobs_today, SUM(j.cost_halala) as total_halala
FROM jobs j
JOIN renters r ON j.renter_id = r.id
WHERE j.submitted_at > datetime('now', 'start of day')
GROUP BY r.id
HAVING jobs_today > 20
ORDER BY jobs_today DESC;
```

---

## 5. Provider Key Reuse from Multiple IPs

A provider API key appearing from multiple distinct IPs within a short window indicates a shared or leaked key.

| Signal | Threshold | Action |
|--------|-----------|--------|
| Same provider key seen from > 1 IP in 1 hour | Any | Suspend provider key, notify provider email, require re-registration |
| Provider heartbeat IP differs from job-acceptance IP | Consistent mismatch | Investigate; may be NAT/proxy or key theft |

**Data source:** `heartbeat_log.provider_ip`, `provider_api_keys`

**Check command:**
```sql
-- Providers with multiple distinct heartbeat IPs today
SELECT p.id, p.name, p.email, COUNT(DISTINCT h.provider_ip) as distinct_ips
FROM heartbeat_log h
JOIN providers p ON h.provider_id = p.id
WHERE h.received_at > datetime('now', '-24 hours')
GROUP BY p.id
HAVING distinct_ips > 1
ORDER BY distinct_ips DESC;
```

---

## 6. Provider Offline / No Heartbeat

Providers that stop sending heartbeats are either down or have been compromised and taken offline.

| Signal | Threshold | Action |
|--------|-----------|--------|
| Active provider with no heartbeat | > 60 minutes | Alert provider via email; pause job routing to that provider |
| All providers offline simultaneously | Any | Platform-wide incident; check VPS network and backend health |

**Check command:**
```sql
-- Active providers with no heartbeat in the last hour
SELECT p.id, p.name, p.email, p.gpu_model, MAX(h.received_at) as last_heartbeat
FROM providers p
LEFT JOIN heartbeat_log h ON h.provider_id = p.id
WHERE p.status = 'active'
GROUP BY p.id
HAVING last_heartbeat IS NULL OR last_heartbeat < datetime('now', '-1 hour')
ORDER BY last_heartbeat ASC;
```

---

## 7. Wallet and Payout Anomalies

| Signal | Threshold | Action |
|--------|-----------|--------|
| Wallet address changed for active provider | Any | Confirm with provider via email before processing next payout |
| Payout request > 500,000 halala (≈ SAR 5,000) | Any | Founder manual review before release |
| Multiple payout requests from same provider in < 24 hours | > 2 | Hold until first settles; possible duplicate submission |

**Data source:** `providers.wallet_address`, `providers.wallet_address_updated_at`, `payout_requests`

---

## 8. PDPL Data Subject Requests

| Signal | Threshold | Action |
|--------|-----------|--------|
| Export or deletion request submitted | Any | Must be processed within 30 days (PDPL Article 9); log to `pdpl_request_log` |
| No response to PDPL request within 20 days | Any | Escalate immediately — 72-hour breach notification requirement may be triggered |

**Check command:**
```sql
-- Pending PDPL requests older than 20 days
SELECT *
FROM pdpl_request_log
WHERE requested_at < datetime('now', '-20 days')
ORDER BY requested_at ASC;
```

---

## Monitoring Cadence

| Frequency | Check |
|-----------|-------|
| **Daily** | Admin audit log, 429 counts, offline providers |
| **Weekly** | Job anomalies, token averages, payout requests |
| **On incident** | Auth failures, multi-IP key reuse, PDPL requests |
| **On any alert** | Full thread review, preserve logs before any restart |

---

## Log Preservation

Before restarting PM2 or rotating logs, always save:
```bash
pm2 logs dc1-provider-onboarding --nostream --lines 10000 > /tmp/dc1-logs-$(date +%Y%m%d-%H%M%S).txt
```

SQLite database is the primary audit trail. Do not `DROP`, `DELETE FROM`, or `VACUUM` production tables without founder approval.
