# Sprint 27 Days 2-4 — Model Serving & Extended Testing (2026-03-29 to 2026-04-01)

**QA Engineer:** Agent 891b2856-c2eb-4162-9ce4-9f903abd315f
**Execution Period:** Days 2-4 (2026-03-29 to 2026-04-01)
**Completion Target:** 2026-04-02 09:00 UTC (Release Gate)
**Prerequisite:** Day 1 template deployment testing ≥18/20 PASS

---

## Day 2: Model Serving Smoke Tests (2026-03-29 08:00-16:00 UTC)

### Scope

Test Tier A & B models for correct inference, high availability, and performance baselines.

**Tier A Models (>99% availability target):**
1. ALLaM 7B (Arabic language model)
2. Falcon H1 7B
3. Qwen 2.5 7B
4. Llama 3 8B
5. Mistral 7B
6. Nemotron Nano 4B

**Tier B Models (>95% availability target):**
7. JAIS 13B (Arabic specialized)
8. BGE-M3 (Embeddings)
9. BGE-reranker (Reranking)
10. SDXL (Image generation)

### Test Scenarios (per model)

**Scenario 1: Basic Inference (Cold Start)**
- First request to newly deployed model
- Measure cold-start latency (init → response)
- Expected: <10s for embeddings, <30s for LLMs

**Scenario 2: Warm Inference (Cached)**
- 5 sequential requests to same model
- Measure p50, p95, p99 latencies
- Expected: <1s for embeddings, <5s for 7B LLMs

**Scenario 3: Concurrent Load (3 parallel users)**
- 3 simultaneous requests to same model
- Measure queue time + inference time
- Expected: queue_time <2s, inference <original_latency * 1.5

**Scenario 4: Error Handling**
- Malformed input requests
- Out-of-memory conditions
- Timeout scenarios
- Expected: Graceful error response, no crashes

**Scenario 5: Token Accuracy (LLM only)**
- Generate N tokens and verify accuracy
- Test multilingual (Arabic/English) models
- Expected: No corrupted tokens, proper encoding

### Success Criteria

**Per Model:**
- ✅ Cold-start latency within limits
- ✅ Warm latency baseline established
- ✅ Concurrent load handled without errors
- ✅ Error handling graceful
- ✅ Token accuracy 100%

**Overall:**
- ✅ Tier A: 6/6 models >99% availability
- ✅ Tier B: 4/4 models >95% availability
- ✅ No token corruption
- ✅ Performance baselines captured

### Test Data

**LLM Prompts:**
- "Once upon a time" (English)
- "في يوم من الأيام" (Arabic)
- "Translate: Hello world" (Multilingual)
- "What is the capital of France?" (Knowledge)

**Embedding Queries:**
- "machine learning"
- "تعلم الآلة" (Arabic ML)
- Semantic similarity pairs for reranker

**Image Generation:**
- "a serene landscape"
- "abstract geometric shapes"

---

## Day 3: Arabic RAG Integration Testing (2026-03-30 08:00-16:00 UTC)

### Scope

Test Arabic RAG (Retrieval-Augmented Generation) stack end-to-end.

**RAG Components:**
1. Embedding model: BGE-M3 (Arabic embeddings)
2. Reranker: BGE-reranker (relevance ranking)
3. LLM: ALLaM 7B (Arabic generation)
4. Vector DB: Milvus or Pinecone (retrieval)

### Test Workflow

**Step 1: Document Indexing**
- Ingest 10 Arabic documents (200-500 words each)
- Topics: business, technology, government (PDPL relevant)
- Verify embedding vectors stored correctly
- Expected: All docs indexed, no errors

**Step 2: Retrieval Quality**
- Issue 5 Arabic queries
- Retrieve top-3 documents per query
- Manually verify relevance
- Expected: Top-1 relevance ≥ 0.8

**Step 3: Reranking**
- Feed retrieved docs to reranker
- Compare ranking before/after reranking
- Expected: Top-ranked doc = most relevant

**Step 4: LLM Generation**
- Combine context + query for LLM
- Generate Arabic response
- Verify grammar, relevance, coherence
- Expected: Response addresses query, grammatically correct

**Step 5: Full Loop (5 iterations)**
- Run complete RAG pipeline 5 times
- Vary query types (factual, analytical, creative)
- Expected: Consistent quality across variations

### Success Criteria

- ✅ All documents successfully indexed
- ✅ Retrieval relevance ≥0.8
- ✅ Reranking improves ranking quality
- ✅ LLM outputs grammatically correct Arabic
- ✅ End-to-end latency <3s
- ✅ Zero errors in 5 full loops

### Test Documents

Prepare 10 Arabic documents (300 words avg) covering:
- Company policies (لوائح الشركة)
- Technical documentation (توثيق تقني)
- Regulatory compliance (الامتثال التنظيمي)

---

## Day 4: Performance Baselines & Extended Testing (2026-03-31 to 2026-04-01)

### Part A: Performance Baseline Capture (2026-03-31)

**Metrics to Capture:**

Per model, per scenario:
- Cold-start latency (min, max, avg, p95, p99)
- Warm latency (min, max, avg, p95, p99)
- Throughput (tokens/sec for LLMs, requests/sec for others)
- Memory usage (peak, average)
- CPU utilization (peak, average)
- GPU utilization (if applicable)

**Baseline Format:**
```json
{
  "model": "llama3-8b",
  "scenario": "warm_inference",
  "metrics": {
    "latency_ms": {"p50": 500, "p95": 800, "p99": 1200},
    "throughput_tps": 2.5,
    "memory_mb": 4096,
    "gpu_util_pct": 65
  }
}
```

### Part B: Stress & Scale Testing (2026-04-01)

**Scenario 1: Sustained Load (2h)**
- Constant 10 concurrent requests per model
- Expected: Stable latency, 0% error rate
- Monitor for memory leaks

**Scenario 2: Spike Load (1h)**
- Ramp from 1 → 50 concurrent → back to 1
- Expected: Graceful degradation, recovery
- No cascading failures

**Scenario 3: Mixed Workload (1h)**
- Concurrent requests across all models
- Realistic traffic distribution
- Expected: System stability, fairness

### Part C: Compliance & Security (2026-04-01)

**PDPL Compliance Check (Arabic RAG):**
- Verify no PII in embeddings/responses
- Check data residency (in-kingdom only)
- Audit token usage per request

**Input Validation:**
- SQL injection attempts → rejected
- XSS payloads → sanitized
- Oversized inputs → truncated safely

**Rate Limiting:**
- Verify API rate limits enforced
- Check for DDoS mitigation
- Expected: Fair resource distribution

### Success Criteria

**Day 4A - Baselines:**
- ✅ Capture latency metrics for all 10 models
- ✅ Establish performance baseline
- ✅ Document resource requirements

**Day 4B - Stress:**
- ✅ Sustained load: 0 errors over 2h
- ✅ Spike load: recovery <60s
- ✅ Mixed workload: system stable

**Day 4C - Compliance:**
- ✅ PDPL: zero PII leakage
- ✅ Security: all payloads rejected/sanitized
- ✅ Rate limits: enforced correctly

---

## Final Go/No-Go Decision (2026-04-02 09:00 UTC)

### Decision Criteria

| Metric | Threshold | Status |
|--------|-----------|--------|
| Template Deployment (Day 1) | 18/20 PASS | ☐ |
| Model Inference (Day 2) | 10/10 models OK | ☐ |
| Arabic RAG (Day 3) | 5/5 loops OK | ☐ |
| Performance Baselines (Day 4A) | All metrics captured | ☐ |
| Stress Testing (Day 4B) | 0 critical errors | ☐ |
| Compliance (Day 4C) | PDPL verified | ☐ |

### Go/No-Go Matrix

| Outcome | Decision | Action |
|---------|----------|--------|
| All criteria PASS | **GO** | Release Sprint 27 to production |
| 5/6 criteria PASS | **CONDITIONAL GO** | Release with known limitations documented |
| <5/6 criteria PASS | **NO-GO** | Return to fixes, delay release |

---

## Deliverables

**Day 2 Report:**
- Model serving test results (per model, per scenario)
- Performance metrics (latencies, throughput, resource usage)
- Any issues or anomalies

**Day 3 Report:**
- RAG pipeline test results
- Retrieval quality analysis
- LLM output quality assessment

**Day 4 Report:**
- Performance baseline document
- Stress test results
- PDPL compliance verification
- Final go/no-go decision

**Final Deliverable (2026-04-02):**
- Sprint 27 QA Closure Report (all 4 days summarized)
- Go/No-Go Decision Document
- Recommendations for post-launch monitoring
- Escalations (if any)

---

## Timeline Summary

| Date | Phase | Duration | Status |
|------|-------|----------|--------|
| 2026-03-28 | Day 1: Template Deployment | 8h | 🟢 Plan Ready |
| 2026-03-29 | Day 2: Model Serving | 8h | ⏳ Plan Ready |
| 2026-03-30 | Day 3: Arabic RAG | 8h | ⏳ Plan Ready |
| 2026-03-31 to 04-01 | Day 4: Stress & Compliance | 16h | ⏳ Plan Ready |
| 2026-04-02 | Release Gate | - | ⏳ Decision |

**Total Testing Window:** 4 days (40 hours of execution)
**Expected Completion:** 2026-04-02 09:00 UTC
