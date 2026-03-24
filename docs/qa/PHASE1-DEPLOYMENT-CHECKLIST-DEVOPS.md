# Phase 1 Deployment Checklist for DevOps

**Purpose:** Ensure production deployment to VPS 76.13.179.86 is configured correctly for Phase 1 QA testing

**Owner:** DevOps (upon founder approval)
**Timeline:** Execute 2026-03-25 18:00 — 2026-03-26 06:00 UTC
**QA Verification:** 2026-03-26 07:45 UTC (15 min pre-test window)

---

## 🚀 PRE-DEPLOYMENT (Before Pulling Code)

- [ ] **VPS Health Check**
  ```bash
  ssh dc1@76.13.179.86 "uptime && df -h && free -h"
  ```
  - Disk space: > 50GB free in /home/node
  - Memory: > 8GB available
  - Load average: < 2.0

- [ ] **Services Status**
  ```bash
  ssh dc1@76.13.179.86 "pm2 list"
  ```
  - dc1-provider-onboarding: online
  - dc1-webhook: online
  - Restart if needed: `pm2 restart all`

- [ ] **Database Connectivity**
  ```bash
  ssh dc1@76.13.179.86 "curl -s http://localhost:5432/health"
  ```
  - PostgreSQL responding on port 5432
  - Database initialized and migrations applied

- [ ] **SSL Certificate Valid**
  ```bash
  ssh dc1@76.13.179.86 "certbot certificates | grep api.dcp.sa"
  ```
  - Expected: Valid until ~2026-06-21 (Let's Encrypt)
  - If expired: Run `certbot renew`

---

## 📥 CODE DEPLOYMENT

- [ ] **Pull Latest Code**
  ```bash
  ssh dc1@76.13.179.86
  cd /home/node/dc1-platform
  git fetch origin
  git log --oneline origin/main | head -5
  # Verify latest commit is 1cbfc42 or later
  git checkout origin/main
  ```

- [ ] **Verify Routing Fix is Present**
  ```bash
  grep -n "router.get(/\^/\(\[a-zA-Z0-9._/-\]\+\)\$/" backend/src/routes/models.js
  # Should show 3 matches (lines 847, 868, 926)
  ```

- [ ] **Install/Update Dependencies**
  ```bash
  npm ci --production
  # or: npm install --production
  ```

- [ ] **Build Frontend (if needed)**
  ```bash
  npm run build
  # Verify no errors
  ```

---

## 🔧 SERVICE CONFIGURATION

- [ ] **Environment Variables Set**
  ```bash
  ssh dc1@76.13.179.86 "cat /etc/systemd/system/dc1-provider-onboarding.service | grep Env"
  ```
  Required variables:
  - NODE_ENV=production
  - PORT=8083
  - DATABASE_URL=[set]
  - ADMIN_JWT_SECRET=[set]
  - API_BASE_URL=https://api.dcp.sa
  - DCP_ARABIC_PORTFOLIO_FILE=/home/node/dc1-platform/infra/config/arabic-portfolio.json

- [ ] **Database Migrations Applied**
  ```bash
  ssh dc1@76.13.179.86
  cd /home/node/dc1-platform
  npm run migrate
  # No errors expected
  ```

- [ ] **Arabic Portfolio Loaded**
  ```bash
  ssh dc1@76.13.179.86 "ls -lh /home/node/dc1-platform/infra/config/arabic-portfolio.json"
  # File exists and > 100KB (contains 20+ models)
  ```

---

## 🚀 SERVICE START/RESTART

- [ ] **Stop Current Services**
  ```bash
  ssh dc1@76.13.179.86 "pm2 stop all"
  ```

- [ ] **Clear PM2 Logs (optional)**
  ```bash
  ssh dc1@76.13.179.86 "pm2 flush"
  ```

- [ ] **Start Services**
  ```bash
  ssh dc1@76.13.179.86 "pm2 start ecosystem.config.js"
  # or: pm2 start dc1-provider-onboarding
  ```

- [ ] **Verify Services Running**
  ```bash
  ssh dc1@76.13.179.86 "pm2 list"
  # Both services should show "online" status
  # Wait 30 seconds for initialization
  ```

- [ ] **Check Service Logs**
  ```bash
  ssh dc1@76.13.179.86 "pm2 logs dc1-provider-onboarding | head -20"
  # Should show successful startup, no ENOENT or EADDRINUSE errors
  ```

---

## ✅ POST-DEPLOYMENT VERIFICATION (DevOps)

- [ ] **API Health Endpoint**
  ```bash
  curl -v https://api.dcp.sa/api/health
  # Expected: 200 OK with {"status":"healthy","timestamp":"..."}
  ```

- [ ] **Model Catalog Endpoint**
  ```bash
  curl -s https://api.dcp.sa/api/models | jq '.length'
  # Expected: 20+ models
  ```

- [ ] **Model Detail Endpoints (Fixed by DCP-641)**
  ```bash
  curl -s https://api.dcp.sa/api/models/ALLaM-AI/ALLaM-7B-Instruct-preview | jq '.id'
  # Expected: 200 OK with model details (NOT 404)
  ```

- [ ] **Provider Onboarding Endpoint**
  ```bash
  curl -s https://api.dcp.sa/api/providers/status | jq '.total_registered'
  # Expected: 43+ registered providers
  ```

- [ ] **Admin Endpoints Responding**
  ```bash
  curl -H "Authorization: Bearer $DCP_ADMIN_TOKEN" \
    https://api.dcp.sa/api/admin/metrics | jq '.active_jobs'
  # Expected: 200 OK with metrics data
  ```

- [ ] **Nginx/Reverse Proxy Working**
  ```bash
  ssh dc1@76.13.179.86 "curl -I http://localhost:8083/api/health"
  # Expected: 200 (backend directly)
  curl -I https://api.dcp.sa/api/health
  # Expected: 200 (via nginx reverse proxy)
  ```

---

## 🔐 TEST CREDENTIALS PROVISIONING

Before notifying QA, ensure test credentials are available:

- [ ] **Renter Test Key Created**
  ```bash
  ssh dc1@76.13.179.86
  # Create via admin endpoint or database insert
  # Store in: /tmp/test_renter_key.txt
  cat /tmp/test_renter_key.txt
  export DCP_RENTER_KEY=[key]
  ```

- [ ] **Admin Token Created**
  ```bash
  # Generate JWT with admin scope
  # Store in: /tmp/test_admin_token.txt
  export DCP_ADMIN_TOKEN=[token]
  ```

- [ ] **Credentials Shared with QA**
  ```bash
  # Post comment on DCP-641 with:
  # - DCP_RENTER_KEY=[key]
  # - DCP_ADMIN_TOKEN=[token]
  # - api.dcp.sa base URL
  # - Backend port (8083, if direct access needed)
  ```

---

## 📊 ROLLBACK PLAN (If Issues Found)

If Phase 1 deployment fails:

- [ ] **Rollback to Previous Version**
  ```bash
  ssh dc1@76.13.179.86
  cd /home/node/dc1-platform
  git log --oneline | head -5
  # Identify last stable commit
  git checkout [previous-stable-commit]
  npm ci --production
  pm2 restart all
  ```

- [ ] **Verify Rollback**
  ```bash
  curl -s https://api.dcp.sa/api/health | jq '.status'
  ```

- [ ] **Notify QA/Founder**
  Post comment on DCP-641 with rollback details and reason

---

## 🎯 SUCCESS CRITERIA

✅ All verification checks pass (POST-DEPLOYMENT VERIFICATION section)
✅ api.dcp.sa responds to all test endpoints
✅ Model routing endpoints (DCP-641 fix) verified working
✅ Test credentials provisioned and shared with QA
✅ PM2 logs show no errors or warnings
✅ Deployment completed by 2026-03-26 06:00 UTC

---

## 📞 ESCALATION

**If Deployment Fails:**
1. Document error in /tmp/deployment-error.log
2. Post comment on DCP-641 with error and rollback status
3. @Notify Backend Architect and Founder
4. QA will defer Day 4 testing until resolved

**If Deployment Succeeds But Tests Fail:**
1. Provide full deployment logs to QA
2. QA will investigate and determine if issue is code or environment
3. Post findings on DCP-641

---

## 📋 SIGN-OFF

**DevOps:** _____________________ Date: ___________

**Deployment Status:** ☐ SUCCESS ☐ ROLLBACK (specify reason)

**QA Ready to Test:** ☐ YES ☐ NO (date/time for Day 4)

---

**Last Updated:** 2026-03-24 00:20 UTC
**Created by:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
**For:** Phase 1 deployment and testing
