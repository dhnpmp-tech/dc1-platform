# DCP Incident Response Runbook

**Document:** Production Incident Response Procedures
**Issue:** DCP-817
**Infrastructure:** VPS 76.13.179.86 | api.dcp.sa | SQLite + Express + PM2
**PDPL Contact:** SDAIA notification required within 72 hours of confirmed data breach

---

## Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| **P1 — Critical** | Active data breach, all providers offline, billing fraud in progress | Immediate | Founder (Peter) via Telegram + email |
| **P2 — High** | Single provider compromised, renter key abuse, DoS degrading service | < 30 minutes | Founder via Telegram |
| **P3 — Medium** | Suspicious pattern detected, anomaly not yet confirmed | < 2 hours | Log and monitor; notify founder if escalates |
| **P4 — Low** | Single failed access attempt, configuration warning | Next business day | Internal log only |

---

## Incident 1: Renter Key Abuse (Shared Key / Billing Fraud)

**Symptoms:**
- Same API key used from multiple IP addresses
- Renter spend far exceeds historical pattern (> 5× daily average)
- `quota_log` shows allowed=0 repeatedly being bypassed (would indicate a quota enforcement bug)
- Renter denies submitting jobs that appear in their billing

**Detection queries:**
```sql
-- Renter jobs submitted from distinct source contexts today
SELECT r.email, j.renter_id, COUNT(j.id) as jobs, SUM(j.cost_halala) as total_halala,
       MIN(j.submitted_at) as first_job, MAX(j.submitted_at) as last_job
FROM jobs j
JOIN renters r ON j.renter_id = r.id
WHERE j.submitted_at > datetime('now', 'start of day')
GROUP BY j.renter_id
ORDER BY total_halala DESC;

-- Renter API keys and last usage
SELECT k.label, k.scopes, k.last_used_at, k.revoked_at, r.email
FROM renter_api_keys k
JOIN renters r ON k.renter_id = r.id
WHERE k.revoked_at IS NULL
ORDER BY k.last_used_at DESC;
```

**Response steps:**

1. **Contain (immediate):**
   ```sql
   -- Revoke the compromised key
   UPDATE renter_api_keys
   SET revoked_at = datetime('now')
   WHERE key = '<compromised_key>';

   -- Suspend renter account pending investigation
   UPDATE renters SET status = 'suspended' WHERE email = '<renter_email>';
   ```

2. **Preserve evidence:**
   ```bash
   pm2 logs dc1-provider-onboarding --nostream --lines 5000 > /tmp/incident-renter-$(date +%Y%m%d).txt
   ```
   Take a SQLite snapshot:
   ```bash
   sqlite3 /home/node/dc1-platform/backend/data/providers.db ".backup /tmp/db-snapshot-$(date +%Y%m%d-%H%M%S).db"
   ```

3. **Assess billing impact:**
   ```sql
   SELECT SUM(cost_halala) as disputed_halala, COUNT(*) as job_count
   FROM jobs
   WHERE renter_id = <renter_id>
     AND submitted_at BETWEEN '<incident_start>' AND '<incident_end>';
   ```

4. **Refund if warranted:**
   - Use admin credit grant endpoint: `POST /api/admin/renters/:id/credit`
   - Document reason in grant: `"Security incident <date>: unauthorized key usage refund"`
   - Log the credit grant in `admin_audit_log` (automatic via middleware)

5. **Notify renter:** Email explaining the incident, steps taken, and instructions to generate a new API key via `POST /api/renters/rotate-key`.

6. **Post-incident:**
   - Review all jobs submitted during the window
   - If fraud involved, assess whether provider payouts for those jobs should be held
   - Rotate `DC1_HMAC_SECRET` if job signatures may be compromised

---

## Incident 2: Provider Impersonation (Fake Provider Stealing Jobs)

**Symptoms:**
- Jobs assigned to a provider that denies receiving them
- Provider heartbeat IP differs significantly from registration IP
- Job `status = completed` but provider reports no execution
- Provider API key seen from unexpected IP ranges

**Detection queries:**
```sql
-- Provider heartbeat IPs in last 7 days
SELECT p.name, p.email, p.ip_address as registered_ip,
       h.provider_ip as heartbeat_ip, h.received_at
FROM heartbeat_log h
JOIN providers p ON h.provider_id = p.id
WHERE h.received_at > datetime('now', '-7 days')
  AND h.provider_ip != p.ip_address
ORDER BY h.received_at DESC;

-- Jobs assigned to a specific provider with completion times
SELECT j.job_id, j.status, j.submitted_at, j.started_at, j.completed_at, j.cost_halala
FROM jobs j
WHERE j.provider_id = <provider_id>
ORDER BY j.submitted_at DESC
LIMIT 50;
```

**Response steps:**

1. **Suspend provider immediately:**
   ```sql
   UPDATE providers SET status = 'suspended' WHERE id = <provider_id>;
   ```

2. **Revoke all provider API keys:**
   ```sql
   UPDATE provider_api_keys
   SET revoked_at = datetime('now')
   WHERE provider_id = <provider_id> AND revoked_at IS NULL;
   ```

3. **Halt in-flight jobs:**
   - Any jobs currently `status = 'running'` assigned to this provider should be marked failed and re-queued
   ```sql
   UPDATE jobs SET status = 'failed', notes = 'Provider suspended: security incident'
   WHERE provider_id = <provider_id> AND status IN ('running', 'pending');
   ```

4. **Preserve evidence:** Same as Incident 1 — logs + DB snapshot.

5. **Assess renter impact:**
   - Renters whose jobs ran on the compromised provider may have had inference data exposed
   - If sensitive data was processed: escalate to **PDPL breach assessment** (see Incident 4)

6. **Re-register provider:**
   - Require provider to re-submit registration with fresh API key and verified IP
   - Admin approval required before reactivation

---

## Incident 3: DoS Attack / Rate Limiting Bypass

**Symptoms:**
- High volume of 429 responses OR service degraded without 429s (bypass)
- PM2 process showing high CPU, backend logs flooding
- Legitimate renters reporting timeout or 503 errors

**Detection:**
```bash
# Rate of requests in last 5 minutes from backend logs
pm2 logs dc1-provider-onboarding --nostream --lines 2000 | \
  grep -oP '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' | sort | uniq -c | tail -20

# 429 rate
pm2 logs dc1-provider-onboarding --nostream --lines 2000 | grep '"status":429' | wc -l
```

```sql
-- Admin rate limit events (last 30 min)
SELECT actor_fingerprint, action_key, COUNT(*) as hits
FROM admin_rate_limit_log
WHERE created_at > datetime('now', '-30 minutes')
GROUP BY actor_fingerprint, action_key
ORDER BY hits DESC
LIMIT 20;
```

**Response steps:**

1. **Identify attacking IP(s):**
   ```bash
   pm2 logs dc1-provider-onboarding --nostream --lines 5000 | \
     grep -oP '"ip":"[^"]*"' | sort | uniq -c | sort -rn | head -20
   ```

2. **Block at nginx level** (requires founder approval per MANDATORY RULE):
   - Create a `DEPLOY REQUEST` issue with the specific nginx `deny` directive and IP list
   - Founder must approve before applying

3. **Temporary mitigation without deployment:**
   - Rate limiting is already in place via `backend/src/middleware/rateLimiter.js`
   - If bypass is found, document the bypass mechanism as a P1 issue

4. **Escalation path:**
   - If attack persists > 15 minutes and service is degraded: call founder directly
   - If origin is a cloud provider, file abuse report with that provider

5. **Post-incident:**
   - Review rate limiter configuration for the exploited endpoint
   - Create DCP issue for tightening limits if warranted

---

## Incident 4: Data Leak / PDPL Breach

**What constitutes a PDPL breach:**
- Unauthorized access to personal data (renter PII: name, email, organization, phone)
- Unauthorized access to provider PII (name, email, IP address, wallet address)
- Exposure of job content containing user data
- Database backup or export copied without authorization

**PDPL regulatory requirement:** Article 35 requires notification to **SDAIA (Saudi Data & AI Authority)** within **72 hours** of becoming aware of a personal data breach.

**Detection:**
```sql
-- Recent PDPL data subject requests (export or delete)
SELECT * FROM pdpl_request_log ORDER BY requested_at DESC LIMIT 20;

-- Admin actions involving data export
SELECT * FROM admin_audit_log
WHERE action LIKE '%export%' OR action LIKE '%dump%'
ORDER BY timestamp DESC LIMIT 20;
```

**Response steps:**

1. **Contain immediately:**
   - If breach is via API: suspend affected renter/provider accounts
   - If breach is via DB access: change `DC1_ADMIN_TOKEN` and database path (requires founder approval)
   - Preserve all logs before any changes

2. **Assess scope (within 4 hours of discovery):**
   - What data was exposed? (PII fields: name, email, phone, wallet_address, ip_address)
   - How many individuals? (count distinct provider + renter IDs in affected data set)
   - Was it read-only or was data modified/deleted?
   - Was data extracted from the system?

3. **Document incident timeline:**
   Create `/tmp/pdpl-breach-<date>.md` with:
   - Discovery time (UTC)
   - Estimated breach start time
   - Data categories affected
   - Number of data subjects
   - Cause (vulnerability, misconfiguration, insider)
   - Containment actions taken

4. **Notify SDAIA within 72 hours:**
   - Portal: [https://pdpl.sdaia.gov.sa](https://pdpl.sdaia.gov.sa) (breach notification form)
   - Required fields: company name, DPO contact, breach description, affected individuals count, data categories, measures taken
   - **Company:** DC1 / DCP Platform
   - **DPO:** Peter (setup@oida.ae) — founder acts as DPO until one is formally appointed

5. **Notify affected individuals:**
   - PDPL requires individual notification if breach likely results in harm
   - Send email to affected renters/providers within 72 hours of SDAIA notification
   - Include: what happened, what data, what DC1 is doing, how to protect themselves

6. **Post-breach:**
   - Full security audit of authentication and authorization paths
   - Create DCP issue for any code-level fixes required
   - Update `docs/security/pre-launch-security-checklist.md` with lesson learned

---

## General Incident Communication Template

**Founder notification (Telegram/email):**
```
[DC1 SECURITY] Incident: <type>
Time: <UTC>
Severity: P<1-4>
Status: <Detected | Contained | Resolved>
Summary: <1-2 sentences>
Action taken: <what was done>
Next step: <what is needed from founder>
```

**Renter notification (email):**
```
Subject: DC1 Security Notice — Action Required

We detected unusual activity related to your DC1 account on <date UTC>.

What happened: <brief description>
What was affected: <API key / account access / billing>
What we did: <key revoked, account reviewed, etc.>
What you should do: <generate new API key at api.dcp.sa/dashboard>

If you have questions, reply to this email or contact setup@oida.ae.

DC1 Platform Security Team
```

---

## Contacts

| Role | Contact |
|------|---------|
| Founder / DPO | Peter — setup@oida.ae |
| SDAIA Breach Portal | pdpl.sdaia.gov.sa |
| VPS hosting (OVH/Hetzner) | Check invoice for abuse contact |
| Telegram escalation | Founder Telegram (direct) |

---

## Post-Incident Checklist

- [ ] Incident timeline documented
- [ ] Evidence preserved (logs + DB snapshot)
- [ ] Root cause identified
- [ ] Affected accounts notified
- [ ] SDAIA notified if PDPL breach (within 72h)
- [ ] DCP issue created for any code fixes
- [ ] Monitoring checklist updated if new signal identified
- [ ] Founder sign-off on incident closure
