# DCP Security Incident Response Runbook

**Version:** 1.0
**Created:** 2026-03-24
**Author:** Security Engineer (DCP-919)
**Scope:** Security incidents for DCP platform (api.dcp.sa, VPS 76.13.179.86)
**Owner:** Founding Engineer (peter@oida.ae) — ultimate escalation target for all P1 incidents

---

## Severity Levels

| Level | Name | Response Time | Examples |
|---|---|---|---|
| P1 | Critical | Immediate (< 15 min) | Data breach, funds drained, contract exploit |
| P2 | High | < 1 hour | DDoS reducing availability, fraudulent billing |
| P3 | Medium | < 4 hours | Suspicious activity, single account compromise |
| P4 | Low | Next business day | Failed auth spikes, policy violations |

---

## General Incident Response Procedure

For all incidents, follow this sequence before applying a scenario-specific fix:

1. **Detect** — Identify the signal (log anomaly, monitoring alert, user report)
2. **Assess** — Classify severity (P1–P4) and affected scope
3. **Contain** — Take immediate containment action (do not delete evidence)
4. **Communicate** — Notify founder and relevant team lead within severity SLA
5. **Investigate** — Preserve evidence, identify root cause
6. **Remediate** — Apply the fix
7. **Recover** — Verify normal operation restored
8. **Post-mortem** — Document root cause and prevention within 24h

**Never delete logs during an active investigation.**

---

## Quarterly IAM Control Evidence (Preventive)

This runbook includes a quarterly preventive control for privileged-access review and key-rotation attestations.

- Runbook: `docs/compliance/iam-quarterly-evidence-runbook.md`
- Artifact directory: `artifacts/compliance/iam/`
- Current baseline linkage: `docs/compliance/pdpl-baseline-v1.md`

Generate evidence artifacts:

```bash
npm run compliance:iam:evidence -- \
  --reviewer="<reviewer name>" \
  --principals="<comma-separated privileged principal scope>" \
  --secrets="<comma-separated secret/key scope>"
```

Validate freshness policy (must be <= 90 days old):

```bash
npm run compliance:iam:verify | tee artifacts/compliance/iam/latest-verification.txt
```

The verifier exits non-zero if evidence is stale/missing, so it can be used as a CI/manual gate before release sign-off.

---

## Scenario A — Data Breach / Unauthorized Access

### Detection Signals

- Spike in `401` responses from `GET /api/providers/` or renter endpoints (check: `pm2 logs | grep " 401 "`)
- Unexpected SELECT queries on billing/user tables in SQLite WAL log
- Provider reports their API key is being used from an unknown IP
- `admin_audit_log` shows actions not matching any known admin session
- Log line: `"authentication bypass"` or `"timing-safe comparison failed"`

```bash
# Check for 401 spikes in last 10 minutes
pm2 logs dc1-provider-onboarding --lines 200 | grep " 401 " | wc -l
# Alert threshold: > 50 in 10 minutes from a single IP

# Check recent admin audit log entries
sqlite3 /home/node/dc1-platform/providers.db \
  "SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 20;"

# Check provider API key last-used timestamps for anomalies
sqlite3 /home/node/dc1-platform/providers.db \
  "SELECT id, provider_id, last_used_at, revoked_at FROM provider_api_keys ORDER BY last_used_at DESC LIMIT 10;"
```

### Immediate Actions (P1 — do in order)

1. **Rotate JWT_SECRET** — invalidates all active renter/admin sessions:
   ```bash
   # Generate new secret (32+ bytes)
   openssl rand -hex 32
   # Update DC1_JWT_SECRET in VPS environment, then restart backend
   # NOTE: requires founder approval per NO-DEPLOY rule — create DEPLOY REQUEST issue first
   ```

2. **Revoke all provider API keys** (if provider key compromise suspected):
   ```bash
   sqlite3 /home/node/dc1-platform/providers.db \
     "UPDATE provider_api_keys SET revoked_at = datetime('now') WHERE revoked_at IS NULL;"
   # Providers will be locked out — notify #dcp-provider-support immediately after
   ```

3. **Notify founder** — SMS/Telegram to peter@oida.ae with:
   - What was accessed
   - Estimated affected renter/provider IDs
   - Actions taken so far

4. **Freeze new provider registrations** (if breach vector is registration endpoint):
   - Create a DEPLOY REQUEST issue to add IP-based temporary block via nginx

### Investigation Steps

```bash
# 1. Identify affected renter IDs from billing records
sqlite3 /home/node/dc1-platform/providers.db \
  "SELECT DISTINCT renter_id FROM billing_records WHERE created_at > '<incident_start_time>';"

# 2. Check access logs for suspicious IPs
pm2 logs dc1-provider-onboarding --lines 1000 | grep -E "POST /api/(auth|providers/register|renter)" | \
  awk '{print $1}' | sort | uniq -c | sort -rn | head -20

# 3. Check for SQL anomalies (unexpected table scans)
# Review WAL file: /home/node/dc1-platform/providers.db-wal
# Look for reads on: billing_records, renter_api_keys, provider_api_keys

# 4. Preserve evidence
cp providers.db providers.db.incident-$(date +%Y%m%d-%H%M%S)
```

### PDPL (Saudi) Disclosure Requirements

The Saudi Personal Data Protection Law (PDPL) requires:

- **Notification to NDMO** (National Data Management Office) within **72 hours** of discovering a breach involving personal data
- **Notification to affected individuals** when breach is likely to result in serious harm
- Contact: ndmo.gov.sa — use the PDPL breach notification form
- Data considered personal: names, email addresses, phone numbers, national IDs, payment card tokens

**Documentation required for PDPL notification:**
- Date/time of breach discovery
- Nature of personal data affected
- Approximate number of affected data subjects
- Likely consequences of the breach
- Measures taken or proposed to address the breach

---

## Scenario B — Smart Contract Exploit

### Detection Signals

- Unexpected token transfers on Base Sepolia (or mainnet) Escrow contract
- Escrow contract balance near zero unexpectedly
- `PaymentReleased` events fired for jobs with no corresponding backend completion record
- Flood of `DisputeRaised` events (> 5 in 10 minutes)
- Backend logs: `"escrow balance insufficient"` or `"contract call reverted"`

```bash
# Check recent escrow events via backend bridge
pm2 logs dc1-provider-onboarding --lines 200 | grep -i "escrow\|PaymentReleased\|DisputeRaised"

# Check job settlement records for anomalies
sqlite3 /home/node/dc1-platform/providers.db \
  "SELECT * FROM job_settlements ORDER BY created_at DESC LIMIT 10;"

# Check for jobs settled without a completed backend record
sqlite3 /home/node/dc1-platform/providers.db \
  "SELECT js.* FROM job_settlements js
   LEFT JOIN jobs j ON js.job_id = j.id
   WHERE j.status != 'completed'
   ORDER BY js.created_at DESC LIMIT 10;"
```

### Immediate Actions (P1)

1. **Freeze backend job acceptance** — stop new jobs from being dispatched to providers:
   - Create DEPLOY REQUEST issue with: set env var `DC1_ACCEPT_JOBS=false` and restart backend
   - This prevents new escrow interactions while you investigate

2. **Pause smart contract** (if contract has `pause()` function):
   ```bash
   # Escrow.sol must have Pausable — check if deployed version is pausable
   # Call via backend admin endpoint (requires DC1_ADMIN_TOKEN):
   curl -X POST https://api.dcp.sa/api/admin/contract/pause \
     -H "Authorization: Bearer $DC1_ADMIN_TOKEN"
   # If no pause endpoint, contact founder to call pause() directly via wallet
   ```

3. **Notify founder immediately** — contract exploits require wallet intervention only the founder can perform

4. **Preserve chain state** — record the current block number and transaction hashes:
   ```bash
   # Log current contract state for post-mortem
   curl -s https://api.dcp.sa/api/admin/escrow/state \
     -H "Authorization: Bearer $DC1_ADMIN_TOKEN" > /tmp/escrow-state-$(date +%Y%m%d-%H%M%S).json
   ```

### Recovery

After exploit is confirmed and patched:

1. **Audit all settlements** since exploit start — identify over-released funds
2. **Deploy patched contract** to new address (requires founder wallet + deployment)
3. **Update `ESCROW_CONTRACT_ADDRESS`** env var in backend config
4. **Re-enable job acceptance** only after new contract is live and verified
5. **Notify affected providers/renters** of any balance discrepancies

### Emergency Owner Functions (Escrow.sol)

Review `contracts/src/Escrow.sol` for available emergency functions. As of Sprint 28:

| Function | Purpose | Who can call |
|---|---|---|
| `pause()` | Halt all deposits/releases | Contract owner (founder wallet) |
| `unpause()` | Resume normal operations | Contract owner |
| `emergencyWithdraw()` | Drain to owner wallet if available | Contract owner |

If no `pause()` exists, the only option is to stop the backend from sending new transactions.

---

## Scenario C — Provider Submitting Fraudulent Token Counts

### Detection Signals

- Token count reported by provider significantly exceeds model context window:
  - GPT-style 7B models: max context 4,096–8,192 tokens
  - If reported tokens > 2× model max context → suspicious
- Billing anomaly: renter balance depleted faster than request volume warrants
- Provider earning anomalously high (compare against peer providers with same GPU model)
- `serve_session` table shows `total_tokens` orders of magnitude above expected

```bash
# Find providers with anomalous token reporting (last 24 hours)
sqlite3 /home/node/dc1-platform/providers.db << EOF
SELECT
  br.provider_id,
  COUNT(*) as job_count,
  SUM(br.tokens_used) as total_tokens,
  AVG(br.tokens_used) as avg_tokens_per_job,
  SUM(br.amount_sar) as total_earnings_sar
FROM billing_records br
WHERE br.created_at > datetime('now', '-24 hours')
GROUP BY br.provider_id
ORDER BY avg_tokens_per_job DESC
LIMIT 10;
EOF

# Cross-reference with serve_session logs
sqlite3 /home/node/dc1-platform/providers.db << EOF
SELECT provider_id, model_id, total_tokens, created_at
FROM serve_sessions
WHERE total_tokens > 16384
ORDER BY total_tokens DESC
LIMIT 20;
EOF
```

### Response Steps

1. **Flag the provider** — mark them for investigation (do not delete data):
   ```bash
   sqlite3 /home/node/dc1-platform/providers.db \
     "UPDATE providers SET status = 'flagged', flag_reason = 'billing_anomaly' WHERE id = '<provider_id>';"
   ```

2. **Freeze their heartbeat auth key** — prevent new jobs from being dispatched:
   ```bash
   sqlite3 /home/node/dc1-platform/providers.db \
     "UPDATE provider_api_keys SET revoked_at = datetime('now')
      WHERE provider_id = '<provider_id>' AND revoked_at IS NULL;"
   ```

3. **Trigger dispute on affected jobs**:
   ```bash
   # Via admin API — create dispute records for jobs handled by this provider
   curl -X POST https://api.dcp.sa/api/admin/jobs/bulk-dispute \
     -H "Authorization: Bearer $DC1_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"provider_id": "<provider_id>", "reason": "fraudulent_token_count", "since": "<first_suspicious_timestamp>"}'
   ```

4. **Preserve evidence** — do NOT delete `serve_session` or `billing_records` rows:
   ```bash
   # Export affected records for dispute investigation
   sqlite3 /home/node/dc1-platform/providers.db << EOF
   .mode json
   .output /tmp/dispute-evidence-$(date +%Y%m%d).json
   SELECT ss.*, br.amount_sar, br.renter_id
   FROM serve_sessions ss
   JOIN billing_records br ON ss.job_id = br.job_id
   WHERE ss.provider_id = '<provider_id>'
   ORDER BY ss.created_at DESC;
   EOF
   ```

5. **Notify affected renters** — calculate overcharge and initiate refund process:
   - Overcharge = `billed_tokens - legitimate_tokens` × `token_rate`
   - Process refund via Moyasar or balance credit

### Prevention

- Add server-side token count validation against model context limits (raise issue for Backend Architect)
- Implement cross-provider token count comparison for statistical anomaly detection
- Require cryptographic attestation of token counts in provider daemon (roadmap item)

---

## Scenario D — DDoS / Rate Limit Bypass

### Detection Signals

- > 1,000 requests/min from a single IP to any endpoint
- Inference endpoint (`/api/vllm/*`) returning mass `429` responses
- Backend CPU consistently > 80% with no corresponding legitimate traffic
- PM2 process memory growing unbounded (memory leak under load)
- `express-rate-limit` log entries at high frequency from one IP range

```bash
# Check request rate by IP (last 100 log lines)
pm2 logs dc1-provider-onboarding --lines 500 | \
  grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | \
  sort | uniq -c | sort -rn | head -20

# Check current rate limit breach logs
pm2 logs dc1-provider-onboarding --lines 200 | grep "Too Many Requests\|rate.limit\|429"

# Check backend resource usage
top -b -n 1 | head -15
```

### Response Steps

1. **Tighten nginx rate limit** (requires DEPLOY REQUEST issue + founder approval):
   ```nginx
   # Add to nginx config for api.dcp.sa:
   limit_req_zone $binary_remote_addr zone=dcp_global:10m rate=30r/m;
   limit_req zone=dcp_global burst=10 nodelay;
   ```

2. **Block offending IP via ufw** (requires DEPLOY REQUEST issue):
   ```bash
   # Block single IP
   sudo ufw deny from <attacker_ip> to any
   sudo ufw reload

   # Block CIDR range if subnet attack
   sudo ufw deny from <attacker_cidr>/24 to any
   ```

3. **Enable CloudFlare protection** (if account available):
   - Set Security Level to "Under Attack" mode in CloudFlare dashboard
   - Enable "Bot Fight Mode"
   - Create a WAF rule to challenge or block the attacking ASN

4. **Escalation path** for sustained attacks:
   - Notify founder (peter@oida.ae) immediately
   - Contact VPS provider (check provider dashboard for DDoS mitigation tools)
   - VPS abuse contact: check your VPS provider's abuse reporting page
   - If > 10 Gbps attack: contact upstream provider for null-routing

### Monitoring During Attack

```bash
# Watch request rate in real time
watch -n 5 'pm2 logs dc1-provider-onboarding --lines 50 | grep -c "GET\|POST"'

# Monitor backend memory and CPU
watch -n 10 'pm2 list | grep dc1-provider'

# Check if inference endpoint is the target
pm2 logs dc1-provider-onboarding --lines 100 | grep "/api/vllm" | wc -l
```

### Recovery

After attack subsides:
1. Remove temporary IP blocks if they caused collateral blocking of legitimate users
2. Review rate limit configuration — tighten if attack revealed insufficient limits
3. Document the attack vector for future WAF rule creation
4. Consider adding CloudFlare as a permanent layer if attack repeats

---

## Contact Directory

| Role | Contact | When to Reach |
|---|---|---|
| Founder (Peter) | peter@oida.ae / Telegram | All P1 incidents, PDPL notifications, contract exploits |
| Founding Engineer | Available via Paperclip | Backend fixes, deployment decisions |
| Backend Architect | Available via Paperclip | Code-level hotfixes |
| DevOps | Available via Paperclip | Infrastructure/nginx changes |
| VPS Provider | Check provider control panel | DDoS mitigation, abuse reporting |
| NDMO (PDPL) | ndmo.gov.sa | Data breach notifications (72h deadline) |

---

## Post-Incident Report Template

After resolving any P1 or P2 incident, file a post-mortem within 24 hours:

```
## Incident Post-Mortem

**Date/Time:** [UTC]
**Duration:** [from detection to resolution]
**Severity:** [P1/P2]
**Scenario:** [A/B/C/D or describe]

**What happened:**
[Brief factual description]

**Root cause:**
[Technical root cause — not just symptoms]

**Impact:**
- Affected renters: [count or IDs]
- Affected providers: [count or IDs]
- Financial impact: [SAR amount if applicable]
- Data exposed: [if any — triggers PDPL]

**Detection:**
[How was it detected? Automated? User report?]

**Response timeline:**
- [HH:MM] Detection
- [HH:MM] Containment action taken
- [HH:MM] Founder notified
- [HH:MM] Resolution

**Actions taken:**
[Bullet list of steps taken]

**Prevention:**
[What changes prevent this from happening again?]
[Link to issue created for the fix]
```

---

*Runbook version: 1.0 — DCP-919*
*Next review: Sprint 30 or after any real incident*
