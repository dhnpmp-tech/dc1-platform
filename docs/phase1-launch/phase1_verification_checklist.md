# Phase 1 Launch Verification Checklist

**Purpose:** Pre-launch validation ensuring all systems are operational and ready for production Phase 1 launch.

**Owner:** DevOps + QA Team
**Target Date:** 2026-03-26 (before Day 4 testing)
**Status:** In Preparation

---

## 🔧 Infrastructure & Deployment

- [ ] **API Server Health**
  - [ ] HTTPS/TLS active on api.dcp.sa (valid cert)
  - [ ] Backend PM2 services running (dc1-provider-onboarding, dc1-webhook)
  - [ ] All Sprint 25/26/27 commits deployed to VPS
  - [ ] Log aggregation active for debugging

- [ ] **Model Routing (Critical for QA)**
  - [ ] Model detail endpoint responds: `GET /api/models/ALLaM-AI/ALLaM-7B-Instruct-preview` → 200 OK
  - [ ] Deploy estimate endpoint works: `GET /api/models/{model_id}/deploy/estimate` → 200 OK
  - [ ] All 11 production models in catalog accessible
  - [ ] Regex routing supports HuggingFace model IDs with slashes

- [ ] **Database & Data**
  - [ ] Production database accessible and responsive
  - [ ] Model registry populated with all 11 models
  - [ ] Provider registry initialized (43 registered providers)
  - [ ] Renter test accounts created with API keys
  - [ ] Database backups automated

- [ ] **Rate Limiting & Auth**
  - [ ] publicEndpointLimiter active (non-auth endpoints)
  - [ ] modelDeployLimiter active (deploy endpoints)
  - [ ] Renter API key validation working
  - [ ] CORS headers properly configured

---

## 📊 API Endpoints Verification

### Template Catalog API
- [ ] `GET /api/templates` → 200 OK, 20+ templates returned
- [ ] All template fields present (image, job_type, env_vars, params)
- [ ] Template filtering works (category, VRAM, Arabic capability)
- [ ] Response time < 500ms

### Model Catalog API
- [ ] `GET /api/models` → 200 OK, 11 models returned
- [ ] Pricing data present (competitor_prices, savings_pct)
- [ ] Arabic capability detection working
- [ ] Availability status computed correctly
- [ ] Response time < 500ms

### Model Detail API (Critical - Unblocks QA)
- [ ] `GET /api/models/{model_id}` → 200 OK for all 11 models
- [ ] HuggingFace model IDs with slashes work: `ALLaM-AI/...`, `BAAI/...`
- [ ] Full model payload returned (benchmarks, provider info, pricing)
- [ ] Response time < 1s

### Deploy Estimate API (Critical - Enables Pricing Display)
- [ ] `GET /api/models/{model_id}/deploy/estimate` → 200 OK
- [ ] Estimate includes pricing, duration, availability
- [ ] Works for all model IDs with slashes
- [ ] Response time < 1s

### Deploy API
- [ ] `POST /api/models/{model_id}/deploy` requires renter authentication
- [ ] Job submission successful with valid provider + template
- [ ] Job tracking endpoint working
- [ ] Error handling for invalid inputs

### 🚨 Financial Dashboard KPIs (CRITICAL FOR COST CONTROL)
**Owner:** Backend Engineer + Frontend Developer
**Blocker Status:** NOT YET STARTED (see 2026-03-23-phase1-launch-blocker-financial-kpi.md)

#### GMV (Gross Merchandise Volume)
- [ ] `GET /api/admin/metrics/gmv?period=today|week|month|all_time` → 200 OK
- [ ] Returns: gmv_halala, gmv_sar, completed_jobs
- [ ] Displayed on admin finance dashboard
- [ ] Response time < 500ms

#### Break-Even Progress Bar ⭐ CRITICAL
- [ ] `GET /api/admin/metrics/break-even?period=today|week|month` → 200 OK
- [ ] Returns: ratio, percentage, status (green|amber|red)
- [ ] Progress bar displayed with color coding (≤100% green, 100-150% amber, >150% red)
- [ ] Linked to DCP-539 cost guardrails
- [ ] Response time < 500ms

#### MRR Trend (Monthly Recurring Revenue)
- [ ] `GET /api/admin/metrics/mrr?months=12` → 200 OK
- [ ] Returns: monthly_data array with revenue, jobs_count, growth_pct
- [ ] Line chart visible on dashboard
- [ ] Shows 3+ months of historical data
- [ ] Response time < 500ms

#### ARPU (Average Revenue Per Job)
- [ ] `GET /api/admin/metrics/arpu?period=today|week|month` → 200 OK
- [ ] Returns: current_arpu_sar, daily_data, trend_14d_pct_change
- [ ] Stat card displaying current ARPU visible
- [ ] 14-day trend chart displayed
- [ ] Alert triggered if >10% drop week-over-week
- [ ] Response time < 500ms

**Why Critical:**
- Without GMV/break-even: Can't monitor cost control during Week 1
- Without MRR: Can't track revenue vs. projections
- Without ARPU: Can't validate provider margin economics ($628–$638/mo baseline)

---

## 🧪 Functional Testing

### Template Deployment Flow
- [ ] Renter can list available templates
- [ ] Renter can get template details
- [ ] Renter can submit job with template (requires valid provider)
- [ ] Job status trackable
- [ ] Error handling for unavailable GPUs

### Model Pricing Flow
- [ ] Model pricing displayed from /api/models/cards endpoint
- [ ] Competitor pricing comparison shows (Vast.ai, RunPod, AWS)
- [ ] DCP pricing is lower than competitors (verified in strategic brief)
- [ ] Pricing display in frontend matches API data

### Provider Onboarding Flow
- [ ] New provider can register
- [ ] Provider daemon can connect and heartbeat
- [ ] Provider can accept jobs for available models
- [ ] Provider earnings computed correctly

### Renter Job Flow
- [ ] Renter can browse templates
- [ ] Renter can check model details
- [ ] Renter can estimate deployment cost
- [ ] Renter can submit job (requires provider available)
- [ ] Job completes successfully
- [ ] Metering records tokens/usage
- [ ] Billing computed correctly

---

## 📈 Performance & Load

- [ ] API response times acceptable (p95 < 1s, p99 < 2s)
- [ ] Database query times acceptable
- [ ] No memory leaks detected in PM2 services
- [ ] Concurrent connections handled (test with 10+ simultaneous requests)
- [ ] Rate limiting prevents abuse

---

## 🔐 Security & Compliance

- [ ] HTTPS enforced (no HTTP fallback)
- [ ] API keys not logged in plaintext
- [ ] SQL injection prevented (parameterized queries)
- [ ] CORS properly restricted
- [ ] No hardcoded secrets in code
- [ ] Renter authentication required for sensitive endpoints
- [ ] PDPL compliance verified (data stays in-country)

---

## 📋 Documentation & Runbooks

- [ ] VPS access procedure documented
- [ ] Emergency restart procedure documented
- [ ] Database recovery procedure documented
- [ ] Log location and access procedure documented
- [ ] Known issues and troubleshooting guide created
- [ ] Contact list for on-call support

---

## ✅ Go/No-Go Decision

**All items must be checked before Phase 1 launch decision**

- [ ] All infrastructure items complete
- [ ] All API endpoints verified
- [ ] All functional tests passing
- [ ] Performance targets met
- [ ] Security review complete
- [ ] Documentation complete
- [ ] Team sign-off obtained

**Decision:** ☐ GO / ☐ NO-GO (Date: __________)

**Approvers:**
- [ ] DevOps Lead: _________________ Date: _______
- [ ] QA Lead: _________________ Date: _______
- [ ] Backend Lead: _________________ Date: _______
- [ ] Founder: _________________ Date: _______

---

## 📝 Notes & Blockers

### 🔴 KNOWN BLOCKER: Financial KPI Dashboard (2026-03-23)

**Status:** NOT YET STARTED
**Severity:** CRITICAL for Phase 1 launch

The admin finance dashboard is missing 4 critical KPIs required for launch-week cost control:
1. **GMV** (Gross Merchandise Volume) — total compute billed
2. **Break-Even Progress Bar** — cost control status (DCP-539 guardrails)
3. **MRR Trend** — monthly revenue history
4. **ARPU** — average revenue per job (pricing health)

**Why Critical:**
- Without break-even visibility, team cannot trigger cost-down actions (P1–P3) if spend exceeds guardrails
- Without ARPU, cannot validate provider margin economics ($628–$638/mo break-even baseline)
- Without MRR, cannot track revenue vs. projections

**Implementation Ready:** Yes
- Detailed specs written: `docs/reports/2026-03-23-phase1-kpi-implementation-handoff.md`
- API schemas provided (request/response)
- Frontend component code snippets included
- Effort: 8–12 hours (backend 4–6 hrs, frontend 4–6 hrs, can run in parallel)

**Next Action:** Create Paperclip issues for Backend Engineer + Frontend Developer immediately

**Reference:** `docs/reports/2026-03-23-phase1-launch-blocker-financial-kpi.md`

---

```
[Add additional issues, blockers, or observations here]
```

---

**Created by:** ML Infrastructure Engineer
**Last Updated:** 2026-03-23
**Next Review:** 2026-03-26 (before Day 4 testing)
