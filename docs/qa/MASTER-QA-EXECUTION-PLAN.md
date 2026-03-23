# Master QA Execution Plan — Complete DCP Launch Validation
**Status:** 🟢 READY FOR EXECUTION
**Date:** 2026-03-23 15:45 UTC
**Agent:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
**Critical Path:** DCP-524 VPS Deployment → Phase 1 Tests → Phase 2 Tests

---

## Executive Summary

Complete end-to-end QA strategy for DCP Phase 1 and Phase 2 launch, including:
1. **Phase 1 API Testing** (1 minute) — Template & Model Catalog validation
2. **Post-Deploy Smoke Checklist** (8 minutes) — Infrastructure verification
3. **Phase 2 Infrastructure Testing** (50-70 minutes) — Performance & RAG validation

**Total Expected Duration:** ~60-80 minutes from DCP-524 deployment completion
**Current Status:** All test infrastructure ready and committed
**Blocker:** DCP-524 VPS deployment (IN PROGRESS)

---

## Phase 1: New Feature Validation (Upon DCP-524)

### 1.1 Template Catalog E2E Test
**File:** `scripts/template-catalog-e2e.mjs`
**Duration:** ~30 seconds
**Status:** ✅ Ready

**Validates:**
- GET /api/templates returns 200 + valid JSON
- All 20 templates present with required fields
- Field types correct (string, array, object)
- Tag-based filtering works (?tag=llm, ?tag=embedding, etc.)
- Category filtering works (?category=llm, ?category=image, etc.)
- Template detail endpoint: GET /api/templates/{id}
- Whitelist endpoint: GET /api/templates/whitelist

**Success Criteria:** All 8 checks pass
**Failure Action:** Escalate to Backend Engineer immediately

### 1.2 Model Catalog Smoke Test
**File:** `scripts/model-catalog-smoke.mjs`
**Duration:** ~30 seconds
**Status:** ✅ Ready

**Validates:**
- GET /api/models returns 200 + valid array
- Models list not empty
- Required fields present (id, name, vram_gb, pricing)
- Arabic-capable models available
- Key models exist (llama3-8b, qwen25-7b, mistral-7b, nemotron-nano)
- Model detail endpoint works
- Pricing data populated
- Benchmarks available

**Success Criteria:** All 15+ checks pass
**Failure Action:** Escalate to Backend Engineer immediately

### 1.3 Phase 1 Results
**Combined Duration:** ~1 minute
**Reports:**
- Test output in console
- Consolidated results in sprint27-test-report.md

**Phase 1 Decision:**
- ✅ **GO** if both test suites pass
- ❌ **NO-GO** if any check fails

---

## Phase 1B: Post-Deploy Infrastructure Smoke Checklist

### 2.1 Post-Deploy Verification Script
**File:** `infra/scripts/post-deploy-verify.sh`
**Duration:** ~8 minutes
**Status:** ✅ Ready (referenced in post-deploy-checklist.md)

**Batch Items to Execute (in order):**

#### DCP-172: API Endpoints & Auth
**Validates:**
- [ ] API documentation page renders (GET /docs/api → 200, no 404/500)
- [ ] Benchmarks endpoint enforces auth (GET /api/providers/:id/benchmarks without auth → 401/403)
- [ ] Benchmarks endpoint works with auth (GET /api/providers/:id/benchmarks with auth → 200)
- [ ] Rate limiting enforced (burst traffic → 429 after threshold)
- [ ] Rate limiting recovers (normal traffic after window → 200)
- [ ] Monitoring process running (pm2/service health check)

**Pass Criteria:** All checks green
**Rollback Signal:** Public benchmarks access, global rate-limit block, monitoring crash loop

#### DCP-216: Marketplace & Billing
**Validates:**
- [ ] Marketplace UI loads (GET /marketplace → 200, cards visible)
- [ ] Search/filter interactions work (no crashes, list updates)
- [ ] Billing confirmation page renders (GET /renter/billing/confirm → 200)
- [ ] Renter guide loads (GET /docs/renter-guide → 200)
- [ ] Marketplace API returns valid data (GET /api/dc1/providers/marketplace → valid JSON)

**Pass Criteria:** All checks green
**Rollback Signal:** Marketplace or billing broken in production

#### DCP-234: Admin & VS Code Integration
**Validates:**
- [ ] Admin dashboard accessible (authentication verified)
- [ ] VS Code extension connectivity working
- [ ] Installer scripts functional
- [ ] Legal/compliance pages accessible

**Pass Criteria:** All checks green
**Rollback Signal:** Admin features broken, extension not connecting

#### DCP-241: Infrastructure Monitoring
**Validates:**
- [ ] Monitoring dashboard accessible
- [ ] Alerting system functional
- [ ] Log aggregation working
- [ ] Metrics collection active

**Pass Criteria:** All checks green
**Rollback Signal:** Monitoring blackout, no metrics/logs

#### DCP-254: Payment Processing
**Validates:**
- [ ] Payment endpoints responsive (status 200, no 500)
- [ ] Billing integration functional
- [ ] Transaction logging working
- [ ] Fund tracking accurate

**Pass Criteria:** All checks green
**Rollback Signal:** Payment errors, transaction loss

### 2.2 Post-Deploy Results
**Combined Duration:** ~8 minutes
**Reports:**
- Summary artifact: `infra/artifacts/post-deploy/<run_id>/summary.txt`
- Evidence captured in Paperclip comments

**Post-Deploy Decision:**
- ✅ **GO** if all 5 batches pass
- ❌ **ROLLBACK** if any critical failure
- 🟡 **CONDITIONAL GO** if non-critical issues found

---

## Phase 1 Complete Gate

**Phase 1 GO Decision Criteria:**
```
✅ Phase 1 GO when:
  ✓ Template Catalog test: PASS (8/8 checks)
  ✓ Model Catalog test: PASS (15+/15+ checks)
  ✓ Post-Deploy Checklist: PASS (all 5 batches green)
  ✓ No 401/403/404/429/500 errors on core endpoints
  ✓ Monitoring systems healthy
  ✓ No rollback signals triggered

❌ Phase 1 NO-GO when:
  ✗ Any test suite fails (scaffolding or runtime errors)
  ✗ Post-deploy checklist has critical failures
  ✗ Public benchmarks access (auth bypass)
  ✗ Global rate-limiting block on normal traffic
  ✗ Monitoring enters crash loop
  ✗ Marketplace/billing broken in production
```

**Phase 1 Impact:**
- Renters can browse 20+ templates
- Renters can view models with pricing
- Competitive pricing displayed
- Provider marketplace active

---

## Phase 2: Performance & Feature Validation

### 3.1 Inference Benchmarks (Upon Provider Activation)
**File:** `scripts/inference-benchmarks-runner.mjs`
**Duration:** ~40 minutes
**Status:** ✅ Ready

**Models Tested (Tier A):**
1. ALLaM 7B (16 GB VRAM)
2. Falcon H1 7B (16 GB VRAM)
3. Qwen 2.5 7B (16 GB VRAM)
4. Llama 3 8B (16 GB VRAM)
5. Mistral 7B (16 GB VRAM)
6. Nemotron Nano 4B (8 GB VRAM)

**Validation Checks:**
- ✅ Model Availability: All 6 models deploy and respond
- ✅ Latency Benchmarking: Single-request latency (batch size 1)
- ✅ Arabic vs English: Performance comparison on identical semantic content
- ✅ Batch Throughput: Tokens/sec at batch size 32

**Metrics Collected:**
- End-to-end latency (p50, p75, p95, p99)
- Batch throughput (tokens/sec)
- Arabic language overhead
- Cold-start vs warm-start behavior
- VRAM utilization

**SLA Targets:**
- Single-request latency: < 3000ms
- Batch throughput: > 50 tokens/sec
- Arabic overhead: < 20%
- Cold-start: < 30 seconds

**Success Criteria:** All metrics within SLA targets
**Failure Action:** Escalate to ML Infra Engineer for optimization
**Report:** `docs/qa/sprint27-inference-benchmarks-report.md` (auto-generated)

### 3.2 Arabic RAG Validation (Upon Provider Activation)
**File:** `scripts/arabic-rag-validation-runner.mjs`
**Duration:** ~30 minutes
**Status:** ✅ Ready

**Components Validated:**
1. **BGE-M3 Embeddings** (7 GB, 8 GB VRAM)
   - Generates 1024-dimensional vectors
   - Latency target: 50-100ms per 512-token doc

2. **BGE Reranker v2-m3** (5 GB, 8 GB VRAM)
   - Produces relevance scores (0.0-1.0)
   - Latency target: 30-50ms per 10-passage batch

3. **ALLaM 7B LLM** (24 GB, 24 GB VRAM)
   - Generates Arabic answers from retrieved context
   - Latency target: 2-3 seconds per query

**Validation Checks:**
- ✅ Component Availability: All 3 components deploy and respond
- ✅ Embedding Generation: 1024-dim vectors, proper cosine similarity
- ✅ Reranking: Valid scores, proper ordering
- ✅ E2E RAG Pipeline: Complete query→embed→rerank→generate flow

**Test Corpus (Arabic Legal Documents):**
- Labor Law: Work regulations and employee rights
- Commercial Contract: Contract terms and conditions
- Government Regulation: Implementation requirements
- Insurance Policy: Coverage and terms

**SLA Targets:**
- Embeddings latency: < 100ms
- Reranking latency: < 50ms
- RAG generation: 2-3 seconds
- Embedding dimensions: 1024
- Relevance scores: [0.0, 1.0], properly ordered

**Success Criteria:** All metrics within SLA targets, answers coherent and relevant
**Failure Action:** Escalate to ML Infra Engineer + request human quality review
**Report:** `docs/qa/sprint27-arabic-rag-validation-report.md` (auto-generated)

### 3.3 Phase 2 Results
**Combined Duration:** ~70 minutes
**Reports:**
- Inference benchmarks report (auto-generated)
- Arabic RAG validation report (auto-generated)
- Human quality assessment (manual review)

**Phase 2 Decision:**
- ✅ **GO** if all benchmarks pass + RAG quality validated
- 🟡 **CONDITIONAL GO** if minor latency issues found
- ❌ **NO-GO** if significant performance gaps or quality issues

---

## Complete Timeline Estimate

### Execution Sequence
```
DCP-524 Deployment Completion
    ↓
Phase 1 Test Execution (~1 minute)
    ├─ Template Catalog E2E: 30 seconds
    └─ Model Catalog Smoke: 30 seconds
    ↓
Phase 1 GO Decision
    ↓
Post-Deploy Checklist (~8 minutes)
    ├─ DCP-172: API & Auth checks
    ├─ DCP-216: Marketplace & Billing
    ├─ DCP-234: Admin & VS Code
    ├─ DCP-241: Monitoring
    └─ DCP-254: Payment Processing
    ↓
Phase 1 Complete + Provider Activation Signal
    ↓
Phase 2 Testing (~70 minutes, parallel where possible)
    ├─ Inference Benchmarks: 40 minutes
    ├─ Arabic RAG Validation: 30 minutes
    └─ Human Quality Review: Concurrent with testing
    ↓
Phase 2 GO Decision + Production Readiness Report
```

**Total Duration:** ~80 minutes from DCP-524 completion
**Parallel Opportunities:** Phase 2 tests can run concurrently (~50 minutes total)

---

## Test Infrastructure Inventory

### Committed Test Scripts
- `scripts/template-catalog-e2e.mjs` (233 lines) ✅
- `scripts/model-catalog-smoke.mjs` (274 lines) ✅
- `scripts/inference-benchmarks-runner.mjs` (400+ lines) ✅
- `scripts/arabic-rag-validation-runner.mjs` (500+ lines) ✅
- `infra/scripts/post-deploy-verify.sh` (referenced) ✅

### Committed Documentation
- `docs/qa/PHASE1-GO-READINESS-CHECKPOINT.md` ✅
- `docs/qa/PHASE1-TEST-EXECUTION-QUICKREF.md` ✅
- `docs/qa/PHASE2-IMPLEMENTATION-STATUS.md` ✅
- `docs/qa/post-deploy-checklist.md` ✅
- `docs/qa/sprint27-test-report.md` ✅
- `docs/p2p-resilience-test.md` (reference) ✅

### Auto-Generated Reports
- `sprint27-test-report.md` (Phase 1 results)
- `sprint27-inference-benchmarks-report.md` (Phase 2 benchmarks)
- `sprint27-arabic-rag-validation-report.md` (Phase 2 RAG validation)
- `infra/artifacts/post-deploy/<run_id>/summary.txt` (post-deploy results)

---

## Execution Procedures

### Phase 1 Execution (Upon DCP-524)
```bash
# Set environment variables
export DCP_API_BASE=https://api.dcp.sa
export DCP_RENTER_KEY=$YOUR_TEST_KEY

# Execute Phase 1 tests
node scripts/template-catalog-e2e.mjs
node scripts/model-catalog-smoke.mjs

# Execute post-deploy checklist
./infra/scripts/post-deploy-verify.sh --batch phase1-launch --api-base https://api.dcp.sa
```

### Phase 2 Execution (Upon Provider Activation)
```bash
# Set environment variables
export DCP_API_BASE=https://api.dcp.sa
export DCP_RENTER_KEY=$YOUR_TEST_KEY

# Execute Phase 2 tests (can run in parallel)
node scripts/inference-benchmarks-runner.mjs &
node scripts/arabic-rag-validation-runner.mjs &

# Wait for both to complete and collect results
wait

# Review reports
cat docs/qa/sprint27-inference-benchmarks-report.md
cat docs/qa/sprint27-arabic-rag-validation-report.md
```

---

## Escalation & Communication

### Standing Orders
1. **Phase 1 Failure** → Escalate to Backend Engineer within 5 minutes
2. **Phase 2 Failure** → Escalate to ML Infra Engineer within 5 minutes
3. **Human Quality Issues (RAG)** → Request domain expert review
4. **Post-Deploy Rollback Signal** → Immediate rollback recommendation

### Paperclip Communication
- **During execution:** Post status update every 15 minutes
- **Upon completion:** Comprehensive results with GO/NO-GO recommendation
- **Upon failure:** Immediate escalation with diagnostics

### Success Criteria for Full Launch
```
✅ LAUNCH READY when:
  ✓ Phase 1 All tests PASS
  ✓ Phase 2 All benchmarks meet SLA
  ✓ Phase 2 RAG quality validated by domain expert
  ✓ Post-deploy checklist all green
  ✓ No critical infrastructure issues
  ✓ Monitoring systems operational
  ✓ No security vulnerabilities flagged
```

---

## Risk Mitigation

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| API endpoint mismatch | Low | High | Backend routes verified ✓ |
| Missing template files | Very Low | High | Directory structure confirmed ✓ |
| Latency SLA miss | Medium | Medium | Benchmarks will identify early |
| Authentication bypass | Low | Critical | Post-deploy checklist validates |
| Rate limiting malfunction | Low | High | Explicit test in Phase 1 |
| Monitoring crash | Low | Critical | Health check in Phase 1 |
| RAG answer quality issues | Medium | Medium | Human review + metrics |
| Network/SSL errors | Low | Medium | Staging fallback available |

---

## Resource Requirements

**Personnel:**
- QA Engineer (primary, continuous monitoring)
- Backend Engineer (on-call for Phase 1 failures)
- ML Infra Engineer (on-call for Phase 2 failures)
- Product Manager (approval for GO decisions)

**Infrastructure:**
- Access to api.dcp.sa (production API)
- Access to provider VPS (Phase 2 GPU testing)
- Node.js runtime environment
- Storage for test reports and artifacts

**Time:**
- Phase 1: ~10 minutes (immediate upon DCP-524)
- Phase 2: ~70 minutes (upon provider activation)
- Total: ~80 minutes from deployment start to completion

---

## Next Steps

1. ✅ All QA infrastructure created and committed
2. ⏳ Waiting for DCP-524 deployment completion signal
3. ⏳ Waiting for provider activation signal
4. ➜ **Upon DCP-524:** Execute Phase 1 tests immediately
5. ➜ **Upon provider activation:** Execute Phase 2 tests
6. ➜ **Upon completion:** Issue final GO decision and production readiness report

---

**Master Plan Created:** 2026-03-23 15:45 UTC
**Status:** 🟢 ALL INFRASTRUCTURE READY
**Next Milestone:** DCP-524 Deployment Completion
**Expected Full Launch Window:** 2026-03-24 (pending deployment timing)
