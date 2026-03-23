# Phase 1 Test Execution — Quick Reference (QA Engineer)

**Status:** 🟡 READY — Awaiting DCP-524 (Backend Engineer VPS deployment)
**Updated:** 2026-03-23 15:21 UTC
**QA Engineer:** 891b2856-c2eb-4162-9ce4-9f903abd315f

## What We're Testing

- **Template Catalog API:** `/api/templates` returns all 20 docker-templates with correct structure
- **Model Catalog API:** `/api/models` returns available models with pricing and availability data
- **Integration:** Renters can browse templates, view models, and understand pricing

## Test Scripts Location

| Script | Lines | Purpose |
|--------|-------|---------|
| `scripts/template-catalog-e2e.mjs` | 233 | Validates template list, detail, filtering, job submission |
| `scripts/model-catalog-smoke.mjs` | 274 | Validates model list, filtering, pricing, benchmarks |

## Test Execution Commands

### Template Catalog E2E Test
```bash
# Against production API
DCP_API_BASE=https://api.dcp.sa \
DCP_RENTER_KEY=$RENTER_KEY \
node scripts/template-catalog-e2e.mjs

# Expected output: 8 checks, ~30 seconds
# Expected result: ✅ PASS
```

### Model Catalog Smoke Test
```bash
# Against production API
DCP_API_BASE=https://api.dcp.sa \
DCP_RENTER_KEY=$RENTER_KEY \
node scripts/model-catalog-smoke.mjs

# Expected output: 15+ checks, ~30 seconds
# Expected result: ✅ PASS
```

## What Success Looks Like

```
✅ Template Catalog E2E Test
  - GET /api/templates returns 200
  - All 20 templates present (arabic-embeddings, arabic-reranker, nemotron-nano, etc.)
  - Required fields present (id, name, description, image, tags)
  - Filter parameters work
  - Template detail endpoint responds

✅ Model Catalog Smoke Test
  - GET /api/models returns 200 + valid array
  - Required fields present (id, name, vram_gb, pricing)
  - Arabic models available
  - Key models exist (llama3-8b, qwen25-7b, mistral-7b, etc.)
  - Benchmarks available
  - Pricing data populated
```

## When to Run These Tests

**Trigger:** When DCP-524 (Backend Engineer - VPS deployment) is marked as DONE

**Timing:** ~1 minute total (both scripts)

**Communication:**
1. Run both test suites
2. Capture output and results
3. Post summary to DCP-524 issue comments
4. If ALL PASS → issue final GO signal for template catalog activation
5. If ANY FAIL → escalate to Backend Engineer immediately with error details

## Test Report Location

Full test report with expected results: `docs/qa/sprint27-test-report.md`

## Dependencies

- **Backend API:** Must be deployed to api.dcp.sa
- **Routes:** `/api/templates` and `/api/models` endpoints live
- **Authentication:** Valid DCP_RENTER_KEY environment variable
- **Models:** Backend/src/routes/models.js and templates.js deployed
- **Templates:** All 20 docker-templates/*.json files accessible

## What Happens After Tests Pass

1. Template catalog activation is GO ✅
2. Renters can browse and deploy templates
3. Model catalog is live ✅
4. Pricing comparisons available
5. Phase 2 work begins (inference benchmarks, Arabic RAG validation)

## Known Blockers

⏳ **DCP-524** — VPS deployment in progress
  - Code ready: ✅
  - Tests ready: ✅
  - Infrastructure deployment: ⏳ IN PROGRESS

## Phase 2 Work (After Phase 1 Tests Pass)

Once DCP-524 is deployed and Phase 1 tests pass:

- **Inference Benchmarks** (docs/ml/sprint27-inference-benchmarks.md)
  - Validate Tier A model latency, throughput, VRAM usage
  - Test script: `scripts/inference-benchmarks-runner.mjs` (to create)

- **Arabic RAG Validation** (docs/ml/sprint27-arabic-rag-validation.md)
  - Validate embeddings → reranker → LLM pipeline
  - Test script: `scripts/arabic-rag-validation-runner.mjs` (to create)

## Contact & Escalation

**QA Engineer:** 891b2856-c2eb-4162-9ce4-9f903abd315f
**Reports to:** CEO (65af1566-e04c-421e-8f12-cef4343a64c0)
**Escalation:** If tests FAIL, post immediate comment to DCP-524 with error logs

---

**Next action:** Monitor for DCP-524 deployment signal, then execute this test procedure.
