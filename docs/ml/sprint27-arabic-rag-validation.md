# Sprint 27: Arabic RAG Bundle Validation

**Date:** 2026-03-23
**Status:** VALIDATION PLAN READY (execution pending GPU access)

## Overview

This document specifies validation methodology for the Arabic RAG-as-a-Service complete bundle: BGE-M3 embeddings → BGE reranker → ALLaM 7B LLM. The validation ensures the end-to-end pipeline works for enterprise Arabic document retrieval and generation.

---

## Component Specifications

### 1. Embeddings: BAAI/bge-m3
- **Purpose:** Convert Arabic documents to 1024-dimensional dense vectors
- **Input:** Arabic text (documents, queries)
- **Output:** Float32 vector (1024 dims)
- **Model Size:** 7 GB
- **VRAM Requirement:** 8 GB
- **Latency Target:** 50-100ms per 512-token document
- **Batch Throughput:** 32 docs/sec (batch size 32)
- **Languages:** 110+ (including Modern Standard Arabic + regional dialects)

**Validation Tests:**
- [ ] Model downloads successfully via HuggingFace
- [ ] Embedding generation completes for 10 Arabic documents
- [ ] Output dimensionality is 1024
- [ ] Cosine similarity between identical queries ≈ 1.0
- [ ] Cosine similarity between unrelated queries < 0.3
- [ ] Latency < 100ms per document

---

### 2. Reranker: BAAI/bge-reranker-v2-m3
- **Purpose:** Re-rank retrieved documents by relevance to query
- **Input:** Query (Arabic) + Passages (10 Arabic documents)
- **Output:** Relevance scores (0.0-1.0) for each passage
- **Model Size:** 5 GB
- **VRAM Requirement:** 8 GB
- **Latency Target:** 30-50ms per 10 passages
- **Batch Throughput:** 40 queries/sec (batch size 4)

**Validation Tests:**
- [ ] Model downloads successfully
- [ ] Reranker scores 10 passages for a query
- [ ] Output shape is (10,) with scores in [0, 1]
- [ ] Relevant documents score higher than irrelevant ones
- [ ] Example: Query about "labor law" scores legal docs > tech docs
- [ ] Latency < 50ms per rerank operation

---

### 3. LLM: ALLaM 7B (ailang/ALLaM-7B-Instruct)
- **Purpose:** Generate coherent Arabic answers based on retrieved documents
- **Input:** System prompt + context (top-3 reranked docs) + user query
- **Output:** Arabic text (256 tokens max)
- **Model Size:** 24 GB
- **VRAM Requirement:** 24 GB
- **Latency Target:** 2-3 seconds per query (streaming)
- **Batch Throughput:** 15 queries/min (single model)

**Validation Tests:**
- [ ] Model downloads successfully
- [ ] LLM generates Arabic text for queries
- [ ] Output is fluent, grammatically correct Arabic
- [ ] Answer references specific documents
- [ ] Latency < 3 seconds per answer
- [ ] Arabic quality matches target (fluency ≥ 9/10, factuality ≥ 8/10)

---

## End-to-End Pipeline Architecture

### Docker Compose Stack
```yaml
services:
  embeddings:
    image: dc1/rag-worker:latest
    environment:
      COMPONENT: embeddings
      MODEL_ID: BAAI/bge-m3
    ports: [8001:8001]
    volumes: [/opt/dcp/model-cache:/opt/dcp/model-cache]
    healthcheck: curl -f http://localhost:8001/health

  reranker:
    image: dc1/rag-worker:latest
    environment:
      COMPONENT: reranker
      MODEL_ID: BAAI/bge-reranker-v2-m3
    ports: [8002:8002]
    volumes: [/opt/dcp/model-cache:/opt/dcp/model-cache]
    healthcheck: curl -f http://localhost:8002/health

  llm:
    image: dc1/llm-worker:latest
    environment:
      MODEL_ID: ailang/ALLaM-7B-Instruct
    ports: [8000:8000]
    volumes: [/opt/dcp/model-cache:/opt/dcp/model-cache]
    healthcheck: curl -f http://localhost:8000/health

  orchestrator:
    image: dc1/rag-orchestrator:latest
    environment:
      EMBEDDINGS_URL: http://embeddings:8001
      RERANKER_URL: http://reranker:8002
      LLM_URL: http://llm:8000
    ports: [9000:9000]
    depends_on: [embeddings, reranker, llm]
```

### Startup Timeline
| Component | Startup Time (sec) | Total Time (sec) |
|-----------|-------------------|-----------------|
| Embeddings server | 45 | 45 |
| Reranker server | 30 | 75 |
| LLM server | 120 | 195 |
| Orchestrator | 10 | 205 |

---

## Test Corpus: Arabic Legal Documents

### Document Set 1: Employment Law
**Source:** Saudi Ministry of Human Resources — Employment Contract Regulations

```json
{
  "id": "doc-001-employment",
  "title": "نظام العقود الوظيفية السعودي",
  "language": "ar",
  "content": "...يحق للموظف الأجنبي الحصول على إجازة سنوية... حقوق الموظف المالية يجب أن تتوافق مع العقد...",
  "length_tokens": 1200,
  "domain": "legal/employment"
}
```

### Document Set 2: Tax Compliance
**Source:** Saudi General Authority of Zakat and Tax (GAZT)

```json
{
  "id": "doc-002-tax",
  "title": "قانون الضريبة على الدخل 2024 للشركات الأجنبية",
  "language": "ar",
  "content": "...تحتاج الشركات الأجنبية إلى تسجيل لدى إدارة الضريبة... معدل الضريبة 20% على الأرباح...",
  "length_tokens": 1500,
  "domain": "legal/tax"
}
```

### Document Set 3: Data Protection (PDPL)
**Source:** Saudi Data and Artificial Intelligence Authority (SDAIA)

```json
{
  "id": "doc-003-pdpl",
  "title": "قانون حماية البيانات الشخصية (PDPL)",
  "language": "ar",
  "content": "...يجب حفظ البيانات الشخصية في الأراضي السعودية... موافقة صريحة مطلوبة للمعالجة...",
  "length_tokens": 1100,
  "domain": "legal/privacy"
}
```

### Document Set 4: Business Licensing
**source:** Saudi Ministry of Commerce

```json
{
  "id": "doc-004-licensing",
  "title": "إجراءات الترخيص التجاري للشركات الأجنبية",
  "language": "ar",
  "content": "...الشركة الأجنبية تحتاج إلى رخصة تجارية من الغرفة... المدة الزمنية: 15 يوم عمل...",
  "length_tokens": 800,
  "domain": "legal/licensing"
}
```

---

## Test Queries: Arabic RAG Scenarios

### Query 1: Employment Rights (Simple Retrieval)
**Query:** "ما هي حقوق الموظف الأجنبي في السعودية؟"
(What are the rights of a foreign employee in Saudi Arabia?)

**Expected Behavior:**
1. Embedder: Convert query to 1024-dim vector
2. Retriever: Find top-10 similar documents (doc-001-employment ranked first)
3. Reranker: Re-rank and keep top-3 (all from employment law)
4. LLM: Generate answer citing employment doc
5. Output: "الموظف الأجنبي يحق له الإجازة السنوية والراتب والتأمين..."

**Expected Latency:** 2.5 seconds (embedding 50ms + retrieval 100ms + rerank 50ms + LLM 2300ms)

---

### Query 2: Tax Compliance (Cross-Document)
**Query:** "كم نسبة الضريبة على الشركة الأجنبية وما متطلبات الامتثال؟"
(What is the tax rate for foreign companies and what are compliance requirements?)

**Expected Behavior:**
1. Embedder: Convert multi-topic query to vector
2. Retriever: Return docs from tax (doc-002) + licensing (doc-004)
3. Reranker: Rank tax doc first, licensing doc second
4. LLM: Generate answer synthesizing both: "نسبة الضريبة 20%... يجب التسجيل لدى الغرفة..."
5. Output: Composite answer with multiple citations

**Expected Latency:** 2.8 seconds (multi-doc synthesis)

---

### Query 3: Privacy & Data Protection (Regulatory)
**Query:** "هل بيانات عملائنا آمنة تحت قانون حماية البيانات السعودي؟"
(Are our customer data safe under Saudi data protection law?)

**Expected Behavior:**
1. Embedder: Convert complex regulatory query
2. Retriever: Return PDPL doc (doc-003)
3. Reranker: PDPL doc scores highest (highly relevant)
4. LLM: "نعم، البيانات محمية تحت PDPL... يجب الاحتفاظ بها في السعودية... موافقة صريحة مطلوبة..."
5. Output: Assured answer with legal basis

**Expected Latency:** 2.5 seconds

---

### Query 4: Unknown Domain (Graceful Degradation)
**Query:** "ما هي أفضل ممارسات التسويق الرقمي؟"
(What are best practices for digital marketing?)

**Expected Behavior:**
1. Embedder: Convert off-domain query
2. Retriever: Returns all docs but low similarity scores
3. Reranker: All docs score below 0.3 (low confidence)
4. LLM: Acknowledges low document relevance: "البيانات المتاحة لا تغطي التسويق الرقمي... اقترح مراجعة مصادر متخصصة..."
5. Output: Graceful "out of scope" response

**Expected Latency:** 2.5 seconds (still fast, but lower quality)

---

## Validation Checklist

### ✅ Component Validation (Local, No Multi-GPU Required)

- [ ] **Embeddings Service**
  - [ ] Service starts without error
  - [ ] HTTP health check returns 200
  - [ ] POST /embed accepts Arabic text
  - [ ] Returns 1024-dim vector
  - [ ] Latency < 100ms

- [ ] **Reranker Service**
  - [ ] Service starts
  - [ ] HTTP health check returns 200
  - [ ] POST /rerank accepts query + passages
  - [ ] Returns relevance scores in [0, 1]
  - [ ] Latency < 50ms

- [ ] **LLM Service**
  - [ ] Service starts (may take 2+ minutes)
  - [ ] HTTP health check returns 200
  - [ ] POST /complete accepts Arabic prompt
  - [ ] Returns fluent Arabic text
  - [ ] Latency < 3 seconds per query

- [ ] **Orchestrator**
  - [ ] Service starts
  - [ ] Connects to all three services
  - [ ] Exposes /api/rag endpoint
  - [ ] Accepts document + query payloads

### ✅ End-to-End Pipeline

- [ ] Full pipeline test with Query 1 (employment)
  - [ ] Embedding generated ✓
  - [ ] Documents retrieved ✓
  - [ ] Documents reranked ✓
  - [ ] Answer generated ✓
  - [ ] Answer references correct doc ✓
  - [ ] Latency < 4 seconds ✓

- [ ] Full pipeline test with Query 2 (tax + licensing)
  - [ ] Multi-document synthesis works ✓
  - [ ] Answer synthesizes both docs ✓

- [ ] Full pipeline test with Query 3 (privacy)
  - [ ] Regulatory question answered ✓
  - [ ] Citations are accurate ✓

- [ ] Graceful degradation with Query 4 (unknown domain)
  - [ ] Service doesn't crash ✓
  - [ ] Returns sensible "out of scope" message ✓

### ✅ Quality Metrics

- [ ] **Arabic Fluency:** Output reads naturally (≥9/10)
- [ ] **Factuality:** Answers match source documents (≥8/10)
- [ ] **Citation Accuracy:** Documents cited are actually used (≥95%)
- [ ] **Latency P95:** < 4 seconds per query
- [ ] **Error Rate:** < 1% (graceful failures only)

---

## Success Criteria

| Criterion | Target | Status |
|-----------|--------|--------|
| All components start without error | ✓ | Pending execution |
| Embeddings latency < 100ms | ✓ | Pending execution |
| Reranker latency < 50ms | ✓ | Pending execution |
| LLM latency < 3 sec | ✓ | Pending execution |
| Pipeline latency < 4 sec | ✓ | Pending execution |
| Arabic fluency ≥ 9/10 | ✓ | Pending execution |
| Factuality ≥ 8/10 | ✓ | Pending execution |
| End-to-end test passes | ✓ | Pending execution |

---

## Deployment Steps (After Validation)

1. **Prefetch Models** (if not already done)
   ```bash
   DCP_PREWARM_TIER=tier_a \
   DCP_PREWARM_POLICY=hot-warm \
   ./infra/docker/prefetch-models.sh
   ```

2. **Deploy Docker Compose Stack**
   ```bash
   docker-compose -f docker-compose.rag.yml up -d
   ```

3. **Verify Health**
   ```bash
   curl http://localhost:8001/health  # embeddings
   curl http://localhost:8002/health  # reranker
   curl http://localhost:8000/health  # llm
   curl http://localhost:9000/health  # orchestrator
   ```

4. **Run Smoke Test**
   ```bash
   curl -X POST http://localhost:9000/api/rag \
     -H "Content-Type: application/json" \
     -d '{"documents": [{"id": "doc-001", "text": "..."}], "query": "..."}'
   ```

---

## References

- **Template Spec:** `docker-templates/arabic-rag-complete.json`
- **Portfolio Config:** `infra/config/arabic-portfolio.json`
- **Prefetch Guide:** `docs/ml/PREFETCH-DEPLOYMENT-PROCEDURE-SPRINT27.md`
- **Model Cards:**
  - BGE-M3: https://huggingface.co/BAAI/bge-m3
  - BGE Reranker: https://huggingface.co/BAAI/bge-reranker-v2-m3
  - ALLaM: https://huggingface.co/ailang/ALLaM-7B-Instruct

---

**Document Version:** 1.0
**Status:** Ready for execution (pending GPU access)
**Last Updated:** 2026-03-23 15:30 UTC
