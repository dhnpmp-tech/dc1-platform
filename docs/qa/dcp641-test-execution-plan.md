# DCP-641 Phase 1 Integration Testing — Execution Plan

**Status:** DRAFT — Awaiting model detail endpoint deployment
**Last Updated:** 2026-03-23 20:26 UTC
**Test Window:** 2026-03-26 to 2026-03-28 (Days 4-6)
**Test Lead:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)

---

## Overview

Phase 1 integration testing validates the template catalog and model catalog APIs are production-ready for marketplace UI integration. Testing follows a 3-day schedule with escalating coverage.

### Current Status (2026-03-23)

- ✅ **Template Catalog API:** 20/20 PASS — all endpoints responding
- ⚠️ **Model Catalog API:** 18/24 PASS — list/compare/benchmarks work, detail endpoints at HTTP 404
- 🔴 **Blocker:** Model detail endpoints not yet deployed (commit 5d59273 pending deployment)

### Test Readiness

| Component | Status | Notes |
|-----------|--------|-------|
| Test scripts (template) | ✅ Ready | 233 LOC, executed successfully |
| Test scripts (model) | ✅ Ready | 274 LOC, 18/24 checks passing |
| Test documentation | ✅ Ready | Comprehensive report in docs/qa/sprint27-test-report.md |
| Environment setup | ✅ Ready | Production API at api.dcp.sa responding |
| Test data | ✅ Ready | 20 templates, 11 models live |

---

## Day 4 (2026-03-26): Pre-Test Validation & System Checks

**Duration:** ~12 minutes
**Goal:** Verify infrastructure health before full test execution

### 4.1 System Readiness Checks (5 min)

```bash
# API connectivity
curl -s https://api.dcp.sa/api/health -w "\nHTTP %{http_code}\n"

# Template catalog availability
curl -s https://api.dcp.sa/api/templates | jq '.length'

# Model catalog availability
curl -s https://api.dcp.sa/api/models | jq '.length'

# HTTPS certificate validity
openssl s_client -connect api.dcp.sa:443 -showcerts 2>/dev/null | grep "notAfter"
```

**Exit Criteria:**
- ✅ All endpoints returning HTTP 200
- ✅ HTTPS certificate valid (Let's Encrypt, valid through 2026-06-21)
- ✅ Data counts match expected (20 templates, 11+ models)

### 4.2 Template Catalog Validation (3 min)

```bash
# Run template tests
DCP_API_BASE=https://api.dcp.sa/api node scripts/template-catalog-e2e.mjs

# Expected output: 20/20 PASS
```

**Acceptance Criteria:**
- All 20 checks pass
- No HTTP errors
- All expected templates present

### 4.3 Model Catalog Preliminary Check (4 min)

```bash
# Run model catalog tests
DCP_API_BASE=https://api.dcp.sa/api node scripts/model-catalog-smoke.mjs

# Current expectation: 18/24 PASS (if detail endpoints still not deployed)
# After deployment: expect 24/24 PASS
```

**Acceptance Criteria:**
- If detail endpoints deployed: 24/24 PASS → proceed to Day 5 full testing
- If detail endpoints NOT deployed: 18/24 PASS → document blockers, escalate

---

## Day 5 (2026-03-27): Integration Testing & Coverage

**Duration:** ~30 minutes
**Goal:** Full integration testing with comprehensive coverage

### 5.1 Template Catalog Integration (8 min)

**Test Suite:** `scripts/template-catalog-e2e.mjs`

```bash
DCP_API_BASE=https://api.dcp.sa/api node scripts/template-catalog-e2e.mjs
```

**Checks:**
- ✅ List endpoint returns all 20 templates
- ✅ Field validation (id, name, description, image, tags, dockerfile)
- ✅ Tag filtering works (llm, embedding, image-generation, etc.)
- ✅ Detail endpoint returns complete template info
- ✅ Whitelist endpoint returns approved image registries
- ✅ Expected templates present: arabic-embeddings, arabic-reranker, nemotron-nano, vllm-serve, stable-diffusion, pytorch-single-gpu, ollama, custom-container

**Success Criteria:** 20/20 checks PASS

### 5.2 Model Catalog Integration (12 min)

**Test Suite:** `scripts/model-catalog-smoke.mjs`

```bash
DCP_API_BASE=https://api.dcp.sa/api node scripts/model-catalog-smoke.mjs
```

**Checks (Expected: 24/24 PASS after endpoint deployment):**

1. **Model List** (HTTP 200, 11+ models)
2. **Model Fields** (pricing, VRAM, quantization, status)
3. **Arabic Capability** (7 models support Arabic)
4. **Model Detail** (GET /api/models/{id}) — currently at HTTP 404
5. **Model Comparison** (ranking by quality/price)
6. **Deployment Estimate** (cost/duration projection) — currently at HTTP 404
7. **Benchmarks Feed** (performance metrics)
8. **Model Cards** (bilingual summaries)

**Success Criteria:** 24/24 checks PASS (unblocks marketplace UI integration)

### 5.3 API Response Validation (5 min)

Validate actual API response structure matches marketplace UI expectations:

```bash
# Model list structure
curl -s https://api.dcp.sa/api/models | jq '.[0]' | head -20

# Model detail structure (once endpoint deployed)
curl -s 'https://api.dcp.sa/api/models/meta-llama/Meta-Llama-3-8B-Instruct' | jq '.' | head -20

# Pricing display validation
curl -s https://api.dcp.sa/api/models | jq '.[0].competitor_prices, .[0].savings_pct'
```

**Validation Points:**
- ✅ Competitor prices flowing (DCP vs Vast.ai, RunPod, AWS)
- ✅ Savings percentage calculated
- ✅ Arabic capability flag present
- ✅ VRAM and GPU requirements clear

### 5.4 Documentation & Blocking Issue Resolution (5 min)

**If All Checks Pass:**
- Update issue DCP-641 with passing results
- Mark template catalog as READY for marketplace UI
- Mark model catalog as READY pending detail endpoint deployment
- Transition to in_progress

**If Blockers Remain:**
- Document exact failures and HTTP responses
- Create follow-up issues for blockers
- Provide timeline estimate for resolution

---

## Day 6 (2026-03-28): Load Testing & Security + Go/No-Go

**Duration:** ~20 minutes
**Goal:** Validate API stability and security, final recommendation

### 6.1 Load Testing (10 min)

Test API resilience under moderate concurrent load:

```bash
# Concurrent template list requests (20 parallel)
for i in {1..20}; do
  curl -s https://api.dcp.sa/api/templates > /dev/null &
done
wait

# Concurrent model list requests (20 parallel)
for i in {1..20}; do
  curl -s https://api.dcp.sa/api/models > /dev/null &
done
wait

# Response time baseline
time curl -s https://api.dcp.sa/api/templates | jq '.length'
time curl -s https://api.dcp.sa/api/models | jq '.length'
```

**Success Criteria:**
- No HTTP 5xx errors under concurrent load
- Response times < 500ms (p95)
- All responses valid JSON

### 6.2 Security Spot Checks (5 min)

```bash
# Verify CORS headers
curl -s -H "Origin: https://example.com" -H "Access-Control-Request-Method: GET" \
  https://api.dcp.sa/api/models -v 2>&1 | grep -i "access-control"

# Verify no sensitive data leakage
curl -s https://api.dcp.sa/api/models | jq 'keys'

# HTTPS enforcement check
curl -s -I http://api.dcp.sa/api/models 2>&1 | head -3
```

**Success Criteria:**
- HTTPS only (no HTTP redirect)
- CORS properly configured
- No API keys or secrets in responses

### 6.3 Final Test Report & Go/No-Go Decision (5 min)

**Pass Criteria for GO:**
- ✅ Template catalog: 20/20 PASS
- ✅ Model catalog: 24/24 PASS (all endpoints deployed)
- ✅ Load testing: no errors under concurrent requests
- ✅ Security: HTTPS, CORS, no data leakage

**Conditional GO (if detail endpoints still blocked):**
- ✅ Template catalog: 20/20 PASS → ready for marketplace UI
- ⚠️ Model catalog: 18/24 PASS → detail endpoints missing
- 📌 Action: Template deployment can proceed, model detail endpoints must be deployed before marketplace full launch

**Final Recommendation:**
- **GO:** Template catalog can be integrated into marketplace UI immediately
- **GO-CONDITIONAL:** Model catalog list/compare/benchmarks ready; detail endpoints must be deployed before full model discovery UI
- **NO-GO:** Only if unexpected failures occur in passing tests

---

## Test Data Reference

### Template Catalog (20 templates)
- `arabic-embeddings` — BGE-M3 Arabic embeddings
- `arabic-reranker` — BGE-M3 Arabic reranking
- `nemotron-nano` — NVIDIA Nemotron Nano 4B
- `vllm-serve` — vLLM inference server
- `stable-diffusion` — Stable Diffusion XL
- `pytorch-single-gpu` — PyTorch development
- `ollama` — Ollama LLM runtime
- `custom-container` — Custom Docker template
- (+ 12 more image generation, scientific compute, fine-tuning templates)

### Model Catalog (11 live models)
1. ALLaM 7B (Arabic, tier_a) — SAR 0.22/min
2. BGE-M3 Embeddings (Arabic, tier_b) — SAR 0.12/min
3. BGE-Reranker v2 (Arabic, tier_b) — SAR 0.14/min
4. DeepSeek R1 7B (tier_a) — SAR 0.18/min
5. Falcon H1 7B (Arabic, tier_a) — SAR 0.20/min
6. JAIS 13B (Arabic, tier_b) — SAR 0.27/min
7. LLaMA 3 8B (tier_a) — SAR 0.17/min
8. Mistral 7B (tier_a) — SAR 0.15/min
9. Phi-3 Mini (tier_a) — SAR 0.08/min
10. Qwen2 7B (tier_a) — SAR 0.14/min
11. Stable Diffusion XL (tier_b) — SAR 0.30/min

---

## Escalation & Blockers

### If Detail Endpoints Not Deployed by Day 5

**Escalation Path:**
1. Document exact endpoint status (HTTP 404 responses)
2. Reference commit `5d59273` with routing fix
3. Escalate to ML Infrastructure Engineer
4. Provide clear deadline: endpoints needed before marketplace full launch

**Action Items:**
- Template catalog deployment can proceed independently
- Model detail endpoints must be deployed before renter can browse individual model specs
- Estimated impact: 2-3 hours backend work

---

## Success Metrics

| Metric | Target | Current Status |
|--------|--------|---|
| Template catalog API health | 20/20 PASS | ✅ 20/20 PASS |
| Model catalog list API | HTTP 200 | ✅ HTTP 200 |
| Model detail endpoint | HTTP 200 (24/24 test pass) | ❌ HTTP 404 |
| API response time (p95) | < 500ms | TBD Day 5 |
| Concurrent request handling | no errors | TBD Day 6 |
| HTTPS certificate validity | valid through 2026-06-21 | ✅ Valid |

---

## Rollback Plan

If critical failures occur:

1. **Template API failures:** Revert to previous commit, investigate root cause
2. **Model API failures:** Disable model detail endpoints, deploy list-only version
3. **Infrastructure failures:** Failover to backup VPS if available
4. **Security issues:** Disable affected endpoints, patch, redeploy

---

## Sign-Off & Documentation

**Test Lead:** QA Engineer
**Test Period:** 2026-03-26 to 2026-03-28
**Documentation:** This file + live test results in DCP-641 comments

**Final Report:** Will be posted to [DCP-641](/DCP/issues/DCP-641) with:
- All test results (pass/fail breakdown)
- Performance metrics
- Security validation summary
- Go/No-Go recommendation for marketplace launch
