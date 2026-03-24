# DCP Security Audit Queries

**Document:** Production Log Audit Queries
**Issue:** DCP-817
**Database:** SQLite — `/home/node/dc1-platform/backend/data/providers.db`

All queries are valid SQLite syntax. Run via:
```bash
sqlite3 /home/node/dc1-platform/backend/data/providers.db "<query here>"
# or interactively:
sqlite3 /home/node/dc1-platform/backend/data/providers.db
```

For PM2 log queries, run on VPS after founder approves SSH access.

---

## Query 1: Top 10 Renters by Spend Today

Identifies heavy hitters — useful for spotting billing anomalies, runaway clients, or fraud.

```sql
SELECT
  r.id            AS renter_id,
  r.email,
  r.name,
  r.organization,
  COUNT(j.id)     AS jobs_submitted,
  SUM(j.cost_halala) AS total_halala,
  ROUND(SUM(j.cost_halala) / 100.0, 2) AS total_sar,
  MIN(j.submitted_at) AS first_job_today,
  MAX(j.submitted_at) AS last_job_today
FROM renters r
JOIN jobs j ON j.renter_id = r.id
WHERE j.submitted_at >= datetime('now', 'start of day')
GROUP BY r.id
ORDER BY total_halala DESC
LIMIT 10;
```

**Alert if:** Any single renter's daily spend exceeds 5× their 7-day average, or exceeds 1,000,000 halala (≈ SAR 10,000).

---

## Query 2: Providers with No Heartbeat in the Last Hour

Detects providers that have gone offline — either a service outage or a potential security suspension.

```sql
SELECT
  p.id,
  p.name,
  p.email,
  p.gpu_model,
  p.status,
  p.ip_address,
  MAX(h.received_at) AS last_heartbeat,
  ROUND((julianday('now') - julianday(MAX(h.received_at))) * 24, 1) AS hours_since_heartbeat
FROM providers p
LEFT JOIN heartbeat_log h ON h.provider_id = p.id
WHERE p.status = 'active'
  AND p.deleted_at IS NULL
GROUP BY p.id
HAVING last_heartbeat IS NULL
    OR last_heartbeat < datetime('now', '-1 hour')
ORDER BY last_heartbeat ASC;
```

**Alert if:** Any active provider is absent for > 1 hour. All active providers offline = platform-level incident.

---

## Query 3: Jobs with Token Count > 10× the 7-Day Average

Identifies token-stuffing attacks, billing fraud, or runaway inference loops.

```sql
-- Step 1: Calculate the 7-day average total_tokens per job
WITH avg_tokens AS (
  SELECT AVG(total_tokens) AS avg_tok
  FROM serve_sessions
  WHERE started_at >= datetime('now', '-7 days')
    AND total_tokens > 0
),
-- Step 2: Find sessions exceeding 10× that average
outliers AS (
  SELECT
    s.id              AS session_id,
    s.job_id,
    s.model,
    s.total_tokens,
    s.total_billed_halala,
    s.started_at,
    s.status,
    r.email           AS renter_email,
    a.avg_tok,
    ROUND(s.total_tokens * 1.0 / NULLIF(a.avg_tok, 0), 1) AS times_above_avg
  FROM serve_sessions s
  JOIN jobs j ON j.job_id = s.job_id
  JOIN renters r ON r.id = j.renter_id
  CROSS JOIN avg_tokens a
  WHERE s.total_tokens > (a.avg_tok * 10)
    AND s.started_at >= datetime('now', '-7 days')
)
SELECT * FROM outliers
ORDER BY total_tokens DESC;
```

**Alert if:** Any session exceeds 10× the rolling average. Review before settling billing.

**Fallback (if serve_sessions is empty — pre-inference-activation):**
```sql
-- Use job cost as proxy
SELECT
  j.job_id,
  j.model,
  j.cost_halala,
  j.submitted_at,
  r.email
FROM jobs j
JOIN renters r ON r.id = j.renter_id
WHERE j.cost_halala > (
  SELECT AVG(cost_halala) * 10
  FROM jobs
  WHERE submitted_at >= datetime('now', '-7 days')
    AND cost_halala > 0
)
ORDER BY j.cost_halala DESC;
```

---

## Query 4: Failed Auth Attempts in Last 24 Hours

Surfaces brute-force attacks against provider keys, renter keys, or the admin token.

**From the database (rate limit log):**
```sql
SELECT
  action_key,
  actor_fingerprint,
  COUNT(*) AS attempts,
  MIN(created_at) AS first_attempt,
  MAX(created_at) AS last_attempt
FROM admin_rate_limit_log
WHERE created_at >= datetime('now', '-24 hours')
GROUP BY action_key, actor_fingerprint
ORDER BY attempts DESC;
```

**From PM2 logs (run on VPS, read-only):**
```bash
# 401 responses in last 24h, grouped by approximate source
pm2 logs dc1-provider-onboarding --nostream --lines 10000 \
  | grep '"status":401' \
  | grep -oP '"ip":"[^"]*"' \
  | sort | uniq -c | sort -rn | head -20
```

**From PM2 logs — 403 Forbidden:**
```bash
pm2 logs dc1-provider-onboarding --nostream --lines 10000 \
  | grep '"status":403' \
  | grep -oP '"url":"[^"]*"' \
  | sort | uniq -c | sort -rn | head -20
```

**Alert if:** > 10 failures from same IP in 10 minutes, or any 401 on `/api/admin/*` endpoints.

---

## Query 5: Admin Endpoint Accesses in Last 7 Days

Complete audit trail of all privileged admin actions. Every row was written by `requireAdminRbac` middleware.

```sql
SELECT
  timestamp,
  admin_user_id,
  action,
  target_type,
  target_id,
  details
FROM admin_audit_log
WHERE timestamp >= datetime('now', '-7 days')
ORDER BY timestamp DESC;
```

**Breakdown by action type:**
```sql
SELECT
  action,
  COUNT(*) AS occurrences,
  MIN(timestamp) AS first_seen,
  MAX(timestamp) AS last_seen
FROM admin_audit_log
WHERE timestamp >= datetime('now', '-7 days')
GROUP BY action
ORDER BY occurrences DESC;
```

**Credit grants specifically (high-value admin action):**
```sql
SELECT
  a.timestamp,
  a.admin_user_id,
  a.target_id AS renter_id,
  a.details,
  r.email AS renter_email
FROM admin_audit_log a
LEFT JOIN renters r ON CAST(r.id AS TEXT) = a.target_id
WHERE a.action = 'renter_credit_granted'
  AND a.timestamp >= datetime('now', '-7 days')
ORDER BY a.timestamp DESC;
```

**Alert if:** Any admin action from an unexpected time (outside business hours) or unusually high frequency of credit grants.

---

## Bonus: Provider Key Health Check

Spot provider API keys that have never been used (possible orphaned keys) or that haven't been used in 30+ days.

```sql
SELECT
  p.name,
  p.email,
  p.status,
  k.key_prefix,
  k.label,
  k.created_at,
  k.last_used_at,
  k.revoked_at,
  CASE
    WHEN k.revoked_at IS NOT NULL THEN 'revoked'
    WHEN k.last_used_at IS NULL THEN 'never-used'
    WHEN k.last_used_at < datetime('now', '-30 days') THEN 'stale'
    ELSE 'active'
  END AS key_health
FROM provider_api_keys k
JOIN providers p ON p.id = k.provider_id
ORDER BY key_health, k.last_used_at ASC;
```

---

## Bonus: PDPL Pending Requests

Track data subject rights requests that must be resolved within 30 days.

```sql
SELECT
  id,
  account_type,
  account_id,
  request_type,
  requested_at,
  ROUND(julianday('now') - julianday(requested_at), 0) AS days_pending,
  CASE
    WHEN julianday('now') - julianday(requested_at) > 20 THEN 'URGENT'
    WHEN julianday('now') - julianday(requested_at) > 10 THEN 'action needed'
    ELSE 'on track'
  END AS urgency
FROM pdpl_request_log
ORDER BY requested_at ASC;
```

---

## Running These Queries

**Interactive SQLite session:**
```bash
sqlite3 /home/node/dc1-platform/backend/data/providers.db
.headers on
.mode column
-- paste query here
```

**One-liner:**
```bash
sqlite3 -header -column /home/node/dc1-platform/backend/data/providers.db \
  "SELECT r.email, COUNT(*) as jobs FROM jobs j JOIN renters r ON r.id=j.renter_id WHERE j.submitted_at > datetime('now','start of day') GROUP BY r.id ORDER BY jobs DESC LIMIT 10;"
```

**Note:** All read-only queries (SELECT only) can be run without disrupting service. Never run UPDATE/DELETE on production without founder approval.
