# Phase 1 Pre-Test Verification Checklist (QA Engineer)

**Execute:** 2026-03-26 07:45 UTC (15 minutes before Day 4 testing starts)
**Duration:** ~15 minutes
**Owner:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
**Status:** Ready to execute upon DevOps completion of deployment

---

## 📋 ENVIRONMENT READINESS (5 min)

- [ ] **API Health Endpoint Responding**
  ```bash
  curl -v https://api.dcp.sa/api/health
  ```
  Expected output:
  ```json
  {"status":"healthy","timestamp":"2026-03-26T07:45:00Z"}
  ```
  HTTP Status: **200 OK**
  Action if fail: POST blocker comment on DCP-641, contact DevOps

- [ ] **SSL Certificate Valid**
  ```bash
  curl -I https://api.dcp.sa/api/health | grep "SSL certificate"
  # Or in browser: https://api.dcp.sa (should not show warning)
  ```
  Expected: Valid certificate, no warnings
  Action if fail: Contact DevOps re: Let's Encrypt cert

- [ ] **DNS Resolves**
  ```bash
  nslookup api.dcp.sa
  # Or: dig api.dcp.sa
  ```
  Expected: Resolves to 76.13.179.86 (or correct IP)
  Action if fail: Check DNS records at registrar

---

## 🔌 BACKEND CONNECTIVITY (3 min)

- [ ] **Model List Endpoint**
  ```bash
  curl -s https://api.dcp.sa/api/models | jq '.length'
  ```
  Expected: **20 or more** models listed
  Action if fail: Check backend service status, review logs

- [ ] **Model Detail Endpoint (DCP-641 Fix)**
  ```bash
  curl -s https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview | jq '.id'
  ```
  Expected: Returns model details (NOT 404)
  Action if fail: Verify routing fix (commit 1cbfc42) deployed, restart backend

- [ ] **Pricing Endpoint**
  ```bash
  curl -s https://api.dcp.sa/api/models/compare | jq '.models[0].dcp_price'
  ```
  Expected: Numeric price (e.g., 0.267)
  Action if fail: Check pricing configuration in backend

---

## 🔐 AUTHENTICATION (3 min)

- [ ] **Renter Test Key Works**
  ```bash
  curl -X GET https://api.dcp.sa/api/renter/dashboard \
    -H "Authorization: Bearer $DCP_RENTER_KEY"
  ```
  Expected: **200 OK** with dashboard data
  Action if fail: Request new test credentials from DevOps

- [ ] **Admin Token Works**
  ```bash
  curl -X GET https://api.dcp.sa/api/admin/metrics \
    -H "Authorization: Bearer $DCP_ADMIN_TOKEN"
  ```
  Expected: **200 OK** with metrics data
  Action if fail: Request new admin token from DevOps

- [ ] **Invalid Token Rejected**
  ```bash
  curl -X GET https://api.dcp.sa/api/renter/dashboard \
    -H "Authorization: Bearer invalid_token_12345"
  ```
  Expected: **401 Unauthorized**
  Action if fail: Auth configuration issue, escalate to Backend Architect

---

## 📊 DATABASE STATE (2 min)

- [ ] **Provider Count Verified**
  ```bash
  curl -s https://api.dcp.sa/api/providers/status | jq '.total_registered'
  ```
  Expected: **43 or more** registered providers
  Action if fail: Database migration issue, check logs

- [ ] **Template Catalog Loaded**
  ```bash
  curl -s https://api.dcp.sa/api/models/catalog | jq '.templates | length'
  ```
  Expected: **20** templates
  Action if fail: Arabic portfolio not loaded, check env vars

---

## 🖥️ MONITORING SETUP (2 min)

- [ ] **Three Terminal Windows Open**
  - Window 1: `ssh dc1@76.13.179.86 "tail -f /var/log/dcp-backend.log"` (backend logs)
  - Window 2: https://api.dcp.sa/admin/metrics (metrics dashboard, refresh every 30s)
  - Window 3: QA command terminal (`cd /home/node/dc1-platform`)

  Action if fail: Open windows now, verify SSH access

- [ ] **Monitoring Dashboard Accessible**
  ```bash
  # Browser: https://api.dcp.sa/admin/metrics
  # Should show real-time graphs and metrics
  ```
  Expected: Dashboard loads, shows current requests/errors
  Action if fail: Check admin dashboard configuration

---

## ✅ GO/NO-GO DECISION (Before 08:00 UTC)

After completing all checks, determine testing readiness:

| Check | Pass | Fail |
|-------|------|------|
| API Health | ☐ | ☐ |
| SSL Certificate | ☐ | ☐ |
| DNS Resolution | ☐ | ☐ |
| Model List | ☐ | ☐ |
| Model Detail (DCP-641) | ☐ | ☐ |
| Pricing | ☐ | ☐ |
| Renter Auth | ☐ | ☐ |
| Admin Auth | ☐ | ☐ |
| Auth Rejection | ☐ | ☐ |
| Provider Count | ☐ | ☐ |
| Template Catalog | ☐ | ☐ |
| Monitoring Setup | ☐ | ☐ |

**Total Checks:** 12
**Pass Threshold:** 11/12 (one non-critical item can fail)
**Fail Threshold:** 2+ failures = **NO-GO** for testing

### Decision

**GO FOR TESTING** ☐ All 12 checks pass, ready to execute Day 4 validation

**CONDITIONAL GO** ☐ 11/12 pass (1 non-critical failure), ready with workaround

**NO-GO** ☐ 2+ failures, testing deferred, blockers must be resolved

---

## 📞 ESCALATION PROCEDURE

If any check fails:

1. **Document Failure**
   ```
   Check: [Name]
   Expected: [What should happen]
   Actual: [What happened]
   Error: [Error message if applicable]
   Timestamp: 2026-03-26 HH:MM UTC
   ```

2. **Post on DCP-641**
   ```markdown
   🔴 **Pre-Test Verification Failed**

   Check: [Name]
   Expected: [Expected result]
   Actual: [Actual result]
   Timestamp: 2026-03-26 07:45 UTC

   Impact: Testing cannot begin until resolved

   @[Relevant Engineer] — needs immediate investigation
   ```

3. **Notify Contacts**
   - Backend Architect: API/auth issues
   - DevOps: Infrastructure/VPS issues
   - Founder: Critical blockers

4. **Decision**
   - If < 2 hours to resolve: Fix and re-verify
   - If > 2 hours to resolve: Defer testing to next available window

---

## 🎯 SUCCESS CRITERIA

✅ All 12 verification checks pass
✅ Test credentials provisioned and working
✅ Monitoring dashboard accessible
✅ No blocking issues identified
✅ Ready to begin Day 4 pre-test validation at 08:00 UTC

---

## 📋 SIGN-OFF

**QA Engineer Verification:** _____________________ Date: 2026-03-26 Time: _______

**Status:** ☐ GO ☐ CONDITIONAL GO ☐ NO-GO

**Notes:**
```
[Any issues found, workarounds, or notes for Day 4 execution]
```

---

**Last Updated:** 2026-03-24 00:27 UTC
**Owner:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
**Purpose:** Ensure production VPS is ready for Phase 1 testing
**Execution:** 2026-03-26 07:45 UTC (15 min before Day 4 testing)
