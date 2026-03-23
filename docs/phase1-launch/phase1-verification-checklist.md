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
- [ ] DCP pricing is lower than competitors
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

**Created by:** ML Infrastructure Engineer  
**Last Updated:** 2026-03-23  
**Next Review:** 2026-03-26 (before Day 4 testing)
