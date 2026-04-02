# Arabic RAG Pipeline Test Plan

**Document Owner:** QA Engineer
**Created:** 2026-03-25 03:47 UTC
**Status:** 🟢 Preparation (execution post-Phase 1)
**Target Completion:** 2026-03-28
**Execution Timeline:** Sprint 27 (after DCP-943 template deployment)

---

## 1. Overview

Comprehensive test plan for the **Arabic RAG (Retrieval-Augmented Generation) pipeline**, which combines:
- **Embedding Model:** BGE-M3 (Arabic document embeddings)
- **Reranker:** BGE-reranker (relevance scoring)
- **LLM Models:** ALLaM-7B, Falcon H1-7B, JAIS-13B (Arabic question answering)

This test suite validates the complete workflow: document upload → embedding → reranking → LLM inference → Arabic response generation.

**Test Coverage:** 15+ integration test cases across 5 core scenarios
**Models Tested:** Tier A (ALLaM, Falcon) + Tier B (JAIS) + embeddings stack
**Blockers:** DCP-951 (Arabic RAG template) and DCP-790 (DevRel tutorial)

---

## 2. Test Scenarios

### Scenario 1: Embedding Generation (Arabic Text Input)

**Purpose:** Validate BGE-M3 embedding model processes Arabic text correctly

**Test Cases:**

| # | Test Case | Input | Expected Behavior | Pass Criteria |
|---|-----------|-------|-------------------|---------------|
| 1.1 | Standard Arabic text | 256-token Arabic paragraph | Embeddings generated | 768-dim vector, normalized |
| 1.2 | Mixed language (Arabic + English) | Half Arabic, half English | Process only Arabic portion | Correct embedding dimension |
| 1.3 | Arabic with diacritics | Text with tashkeel marks | Full embedding, diacritic-aware | Vector quality unaffected |
| 1.4 | Short Arabic query | 5-10 token Arabic query | Fast embedding (<500ms) | Embedding latency <500ms |
| 1.5 | Long Arabic document | 2000+ tokens (max context) | Handle without truncation | Full document embedded |
| 1.6 | Empty/whitespace input | Empty string or spaces only | Graceful error handling | HTTP 400, error message |
| 1.7 | Non-Arabic Unicode | Hebrew, Persian, Urdu text | Reject or fallback gracefully | Clear error response |

**Test Fixture Location:** `backend/tests/fixtures/arabic-rag/documents/`

**Fixtures Needed:**
- `standard_paragraph_ar.txt` — 256-token Arabic paragraph from current events
- `mixed_ar_en.txt` — Bilingual text (50/50 split)
- `with_diacritics_ar.txt` — Arabic with full tashkeel marks
- `short_query_ar.txt` — 5-10 token Arabic query
- `long_document_ar.txt` — 2000+ token Arabic article
- `empty.txt` — Empty file for error case
- `non_arabic.txt` — Hebrew/Persian text for boundary test

---

### Scenario 2: Relevance Reranking (BGE-Reranker)

**Purpose:** Validate reranker correctly scores document relevance to queries

**Test Cases:**

| # | Test Case | Input | Expected Behavior | Pass Criteria |
|---|-----------|-------|-------------------|---|
| 2.1 | Perfect match | Query + 1 highly relevant doc | Score >0.9 | Score ≥0.85 |
| 2.2 | Partial match | Query + mixed relevance docs | Correct ranking order | Top 3 ranked by relevance |
| 2.3 | No relevant documents | Query + unrelated docs | All scores <0.5 | Lowest score ranked last |
| 2.4 | Multiple queries | 5 queries × 10 docs | Consistent ranking | Reproducible across runs |
| 2.5 | Arabic domain-specific | Medical/legal query + docs | Correct domain understanding | Expert validation ±10% |

**Test Fixture Location:** `backend/tests/fixtures/arabic-rag/queries/`

**Fixtures Needed:**
- `medical_query_ar.txt` — Arabic medical question
- `legal_query_ar.txt` — Arabic legal query
- `general_query_ar.txt` — General knowledge question
- `corpus_mixed_relevance.json` — 20-doc corpus with known relevance scores

---

### Scenario 3: LLM Inference (Arabic QA)

**Purpose:** Validate LLM models generate accurate Arabic responses

**Test Cases:**

| # | Test Case | Model | Input | Expected Output | Pass Criteria |
|---|-----------|-------|-------|-----------------|---|
| 3.1 | ALLaM-7B simple QA | ALLaM-7B | Simple Arabic Q + context | Arabic answer, <2s latency | Quality score ≥7/10 |
| 3.2 | Falcon-H1 complex reasoning | Falcon H1-7B | Complex reasoning Q | Multi-sentence reasoning | Quality score ≥7/10 |
| 3.3 | JAIS-13B specialized domain | JAIS-13B | Domain-specific Q (legal) | Specialized terminology | Domain-appropriate response |
| 3.4 | Model output format | All models | JSON request format | Properly formatted JSON | Valid JSON, required fields |
| 3.5 | Token limit behavior | All models | Query exceeding max tokens | Truncate/error gracefully | No crashes, clear error |
| 3.6 | Arabic diacritics in output | All models | Query with diacritics | Output preserves diacritics | Correct Unicode handling |

**Test Fixture Location:** `backend/tests/fixtures/arabic-rag/qa_pairs/`

**Fixtures Needed:**
- `simple_qa_ar.json` — 5 simple QA pairs
- `complex_reasoning_ar.json` — 3-5 complex reasoning pairs
- `domain_specific_ar.json` — Legal/medical domain QA pairs
- `edge_case_qa_ar.json` — Token limit, special chars cases

---

### Scenario 4: End-to-End Pipeline (Document → Query → Answer)

**Purpose:** Validate complete RAG workflow in realistic conditions

**Test Cases:**

| # | Test Case | Steps | Success Criteria |
|---|-----------|-------|---|
| 4.1 | Full pipeline: upload → embed → query → rerank → answer | (1) Upload Arabic doc (2) Query (3) Retrieve + rerank (4) LLM generates answer | Answer is relevant and fluent Arabic |
| 4.2 | Multi-document RAG | Upload 5 documents, query retrieves top 3 | Retrieved documents ranked correctly, answer cites top result |
| 4.3 | Context preservation | Same query with/without document context | With context: more specific; without: generic response |
| 4.4 | Long query, large corpus | 2000+ token doc, complex multi-sentence query | Complete response, no truncation errors |
| 4.5 | Repeated queries | Same query, 3 separate runs | Consistent response, deterministic output |
| 4.6 | Different models, same data | Run pipeline with ALLaM, Falcon, JAIS | All generate valid responses (quality may vary) |

**Example Workflow:**
```
1. POST /api/documents/upload → Document ID + embeddings
2. POST /api/search/rerank → (doc_id, query) → ranked results
3. POST /api/models/infer → (query, top_doc) → Arabic answer
4. Validate response quality (fluency, relevance, accuracy)
```

---

### Scenario 5: Error Handling & Edge Cases

**Purpose:** Ensure graceful handling of failures and boundary conditions

**Test Cases:**

| # | Test Case | Failure Mode | Expected Behavior |
|---|-----------|--------------|---|
| 5.1 | OOM during embedding | Very large document (>10K tokens) | Graceful OOM error, no crash |
| 5.2 | Timeout on slow model | Query takes >30s to process | Timeout error, clear message |
| 5.3 | Invalid input format | Malformed JSON, wrong field types | HTTP 400, validation error |
| 5.4 | Model not available | LLM service down | HTTP 503, retry suggestion |
| 5.5 | Embedding service failure | BGE-M3 returns error | Pipeline fails gracefully, error propagated |
| 5.6 | Empty corpus | Zero documents uploaded | Clear "no results" response |
| 5.7 | Concurrent requests | 10 simultaneous queries | All complete without race conditions |
| 5.8 | Database connection loss | DB unavailable during query | Graceful failover or clear error |

---

## 3. Test Data Preparation

### Document Fixtures (`backend/tests/fixtures/arabic-rag/documents/`)

**Create 10-20 KB Arabic corpus:**

1. **General domain:**
   - Wikipedia-style article (technology, history, or science)
   - News article snippet
   - Blog post or opinion piece

2. **Specialized domain:**
   - Medical/health article (Arabic terminology)
   - Legal document excerpt (Arabic legal terms)
   - Business/finance article

3. **Edge cases:**
   - Text with diacritics (tashkeel marks)
   - Mixed Arabic + English
   - Short snippets (2-3 sentences)
   - Long documents (1000+ tokens)

**File Format:** Plain text, UTF-8 encoding, `.txt` extension

### Query Fixtures (`backend/tests/fixtures/arabic-rag/queries/`)

**Create 10-15 test queries:**

1. **Simple queries:** "What is...?", "Who is...?" (5 queries)
2. **Complex queries:** Multi-part reasoning, domain-specific (3-5 queries)
3. **Edge cases:** Ambiguous, very short, very long (3-5 queries)

**File Format:** JSON array of query strings

Example:
```json
{
  "queries": [
    "ما هي عاصمة السعودية؟",
    "اشرح الفرق بين الذكاء الاصطناعي والتعلم الآلي",
    "أين يعيش الفيلة البرية؟"
  ]
}
```

### Expected Output Fixtures (`backend/tests/fixtures/arabic-rag/expected_outputs/`)

**Document these baseline expectations:**

1. **Embedding dimensions:** 768 (BGE-M3 standard)
2. **Reranker scores:** 0.0-1.0 range, normalized
3. **Response characteristics:**
   - LLM responses should be 2-10 sentences in Arabic
   - Grammatically correct Modern Standard Arabic (MSA)
   - No hallucinations or off-topic content

---

## 4. Test Coverage Matrix

| Scenario | Models | Test Cases | Total | Status |
|----------|--------|-----------|-------|--------|
| 1. Embeddings | BGE-M3 | 7 cases | 7 | 🟡 Prep |
| 2. Reranking | BGE-reranker | 5 cases | 5 | 🟡 Prep |
| 3. LLM QA | ALLaM, Falcon, JAIS | 6 cases | 18 | 🟡 Prep |
| 4. End-to-End | All (3 models) | 6 cases | 18 | 🟡 Prep |
| 5. Error Handling | All | 8 cases | 8 | 🟡 Prep |
| **TOTAL** | **5 components** | **32 test cases** | **56 total runs** | **🟡 Prep** |

**Pass Criteria:** 50/56 passing (89%+ pass rate)
**Critical Path:** All Scenario 4 (end-to-end) + Scenario 5 (error handling) must PASS for GO decision

---

## 5. Test Script Skeleton

**Location:** `backend/tests/integration/arabic-rag-pipeline.test.js`

```javascript
/**
 * Arabic RAG Pipeline Integration Tests
 * Tests the complete workflow: embedding → reranking → LLM inference
 *
 * Dependencies:
 * - DCP-951: Arabic RAG template (implementation required)
 * - Test fixtures in backend/tests/fixtures/arabic-rag/
 *
 * Timeline:
 * - Skeleton created: 2026-03-25 (QA)
 * - Implementation: 2026-03-28+ (Feature team after DCP-951)
 * - Execution: Sprint 27 (2026-03-28 - 2026-04-02)
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Test configuration
const MODELS = ['allam-7b-instruct', 'falcon-h1-arabic-7b', 'jais-13b-chat'];
const FIXTURE_DIR = path.join(__dirname, '../fixtures/arabic-rag');
const API_BASE_URL = process.env.API_URL || 'http://localhost:8083';

describe('Arabic RAG Pipeline Integration Tests', () => {

  // ===== Scenario 1: Embedding Generation =====
  describe('Scenario 1: Embedding Generation (BGE-M3)', () => {
    test('1.1 - Standard Arabic text embedding', async () => {
      // TODO: Load standard_paragraph_ar.txt
      // TODO: POST /api/embed with Arabic text
      // TODO: Verify 768-dim embedding vector
      // TODO: Assert vector is normalized
    });

    test('1.2 - Mixed language (Arabic + English)', async () => {
      // TODO: Load mixed_ar_en.txt
      // TODO: POST /api/embed
      // TODO: Verify Arabic portion is embedded correctly
    });

    test('1.3 - Arabic with diacritics', async () => {
      // TODO: Load with_diacritics_ar.txt
      // TODO: POST /api/embed
      // TODO: Verify diacritic-aware embedding
    });

    test('1.4 - Short Arabic query performance', async () => {
      // TODO: Load short_query_ar.txt
      // TODO: Time the embedding request
      // TODO: Assert latency <500ms
    });

    test('1.5 - Long document (max tokens)', async () => {
      // TODO: Load long_document_ar.txt (2000+ tokens)
      // TODO: POST /api/embed
      // TODO: Verify no truncation
    });

    test('1.6 - Error: Empty input', async () => {
      // TODO: POST /api/embed with empty string
      // TODO: Verify HTTP 400 response
      // TODO: Check error message
    });

    test('1.7 - Error: Non-Arabic Unicode', async () => {
      // TODO: Load non_arabic.txt (Hebrew, Persian)
      // TODO: POST /api/embed
      // TODO: Verify rejection or graceful fallback
    });
  });

  // ===== Scenario 2: Reranking =====
  describe('Scenario 2: Relevance Reranking (BGE-Reranker)', () => {
    test('2.1 - Perfect match (high relevance)', async () => {
      // TODO: Load test corpus and query
      // TODO: POST /api/rerank
      // TODO: Verify top result score >0.85
    });

    test('2.2 - Mixed relevance ranking', async () => {
      // TODO: Load corpus_mixed_relevance.json
      // TODO: Rerank against query
      // TODO: Verify correct rank order
    });

    test('2.3 - No relevant documents', async () => {
      // TODO: Query with unrelated documents
      // TODO: Verify all scores <0.5
    });

    test('2.4 - Reproducible ranking', async () => {
      // TODO: Run same rerank 3× times
      // TODO: Verify identical results
    });

    test('2.5 - Domain-specific ranking (medical)', async () => {
      // TODO: Load medical_query_ar.txt
      // TODO: Rerank medical corpus
      // TODO: Verify domain understanding
    });
  });

  // ===== Scenario 3: LLM Inference =====
  describe('Scenario 3: LLM Inference (Arabic QA)', () => {
    const testLLMInference = (modelId) => {
      return describe(`Model: ${modelId}`, () => {
        test('3.1 - Simple QA', async () => {
          // TODO: Load simple_qa_ar.json
          // TODO: POST /api/models/${modelId}/infer
          // TODO: Verify <2s latency
          // TODO: Validate Arabic response quality (≥7/10)
        });

        test('3.2 - Complex reasoning', async () => {
          // TODO: Load complex_reasoning_ar.json
          // TODO: POST /api/infer
          // TODO: Verify multi-sentence output
        });

        test('3.3 - Domain-specific output', async () => {
          // TODO: Load domain_specific_ar.json
          // TODO: Verify domain-appropriate terminology
        });

        test('3.4 - Output format validation', async () => {
          // TODO: POST /api/infer with valid JSON
          // TODO: Verify response is valid JSON
          // TODO: Check required fields present
        });

        test('3.5 - Token limit handling', async () => {
          // TODO: Query exceeding max_model_len
          // TODO: Verify graceful error (no crash)
        });

        test('3.6 - Diacritics preservation', async () => {
          // TODO: Query with diacritics
          // TODO: Verify output preserves diacritics
        });
      });
    };

    // Run tests for each model
    MODELS.forEach(modelId => testLLMInference(modelId));
  });

  // ===== Scenario 4: End-to-End Pipeline =====
  describe('Scenario 4: End-to-End RAG Pipeline', () => {
    test('4.1 - Full pipeline: upload → embed → query → rerank → answer', async () => {
      // TODO: 1. Load document
      // TODO: 2. POST /api/documents/upload
      // TODO: 3. POST /api/search/rerank with query
      // TODO: 4. POST /api/models/infer with top doc
      // TODO: 5. Verify final answer is relevant Arabic
    });

    test('4.2 - Multi-document RAG (top-k retrieval)', async () => {
      // TODO: Upload 5 documents
      // TODO: Query, retrieve top-3
      // TODO: Verify correct ranking
      // TODO: Verify answer cites best source
    });

    test('4.3 - Context preservation', async () => {
      // TODO: Query WITH document context
      // TODO: Query WITHOUT context
      // TODO: Verify WITH is more specific than WITHOUT
    });

    test('4.4 - Large corpus + complex query', async () => {
      // TODO: 2000+ token document
      // TODO: Multi-sentence query
      // TODO: Verify complete response (no truncation)
    });

    test('4.5 - Deterministic output (repeated queries)', async () => {
      // TODO: Run same query 3× times
      // TODO: Verify identical or near-identical responses
    });

    test('4.6 - Multi-model consistency', async () => {
      // TODO: Run pipeline with ALLaM, Falcon, JAIS
      // TODO: Verify all generate valid responses
      // TODO: Document quality differences
    });
  });

  // ===== Scenario 5: Error Handling =====
  describe('Scenario 5: Error Handling & Edge Cases', () => {
    test('5.1 - OOM handling (very large document)', async () => {
      // TODO: Create >10K token document
      // TODO: POST /api/embed
      // TODO: Verify graceful OOM error (not crash)
    });

    test('5.2 - Timeout handling', async () => {
      // TODO: Trigger slow inference (stress test)
      // TODO: Verify timeout error after 30s
      // TODO: Check error message clarity
    });

    test('5.3 - Malformed JSON input', async () => {
      // TODO: POST invalid JSON
      // TODO: Verify HTTP 400
      // TODO: Check validation error message
    });

    test('5.4 - Service unavailability', async () => {
      // TODO: Stop LLM service
      // TODO: POST /api/infer
      // TODO: Verify HTTP 503 (not timeout)
      // TODO: Check retry suggestion in response
    });

    test('5.5 - Embedding service failure', async () => {
      // TODO: Mock BGE-M3 service error
      // TODO: POST /api/embed
      // TODO: Verify error propagation
    });

    test('5.6 - Empty corpus handling', async () => {
      // TODO: Query with zero documents
      // TODO: Verify "no results" response (not error)
    });

    test('5.7 - Concurrent request handling', async () => {
      // TODO: Send 10 simultaneous queries
      // TODO: Verify all complete without race conditions
    });

    test('5.8 - Database connection loss', async () => {
      // TODO: Close DB connection
      // TODO: POST /api/search
      // TODO: Verify graceful failover or clear error
    });
  });
});

// ===== Helper Functions =====

/**
 * Load test fixture file
 */
function loadFixture(filename) {
  const filepath = path.join(FIXTURE_DIR, filename);
  return fs.readFileSync(filepath, 'utf-8');
}

/**
 * Validate Arabic response quality
 * Returns score 1-10
 */
function validateArabicQuality(text) {
  // TODO: Implement quality checks:
  // - Grammatical correctness (MSA)
  // - Relevance to query
  // - Absence of hallucinations
  // - Proper Unicode/diacritics
  return 0; // Placeholder
}

/**
 * Assert embedding vector is normalized
 */
function assertNormalizedVector(vector) {
  // TODO: Verify L2 norm ≈ 1.0
}

module.exports = { validateArabicQuality, assertNormalizedVector };
```

---

## 6. Execution Timeline

| When | What | Blocking | Owner |
|------|------|----------|-------|
| 2026-03-25 03:47 UTC | Create test plan & skeleton | No | QA Engineer ✅ |
| 2026-03-28 after DCP-943 | Implement test fixtures + script | DCP-951 complete | Feature team |
| 2026-03-28 - 2026-04-01 | Execute tests against DCP-951 | DCP-951 live | QA Engineer |
| 2026-04-02 09:00 UTC | Go/No-Go decision | Test execution complete | QA Engineer |

---

## 7. Success Criteria

- ✅ All 56 test runs execute without crashes
- ✅ 50+ test cases pass (89%+ pass rate)
- ✅ No critical issues found (0 critical severity)
- ✅ Max 3 medium issues (all with documented workarounds)
- ✅ Performance targets met:
  - Embedding latency: <500ms
  - Reranking: <1s for 20 documents
  - LLM inference: <2s for simple queries (ALLaM, Falcon), <3s for JAIS
- ✅ All error handling cases produce clear, actionable errors

---

## 8. Dependencies & Blockers

- **DCP-951:** Arabic RAG template implementation (required before execution)
- **DCP-790:** DevRel tutorial (test cases inform tutorial content)
- **API Service:** Backend `/api/embed`, `/api/rerank`, `/api/models/{model_id}/infer` endpoints

---

## 9. Escalation Paths

**Test Failure Categories:**

1. **Model Quality Issues** → Escalate to ML Infra Engineer
2. **API/Backend Issues** → Escalate to Backend Architect
3. **Performance Degradation** → Escalate to DevOps
4. **Data Quality Issues** → Document as known limitation, note for Phase 2

---

## Appendix A: Arabic Test Data Standards

- **Character Set:** Modern Standard Arabic (MSA), UTF-8 encoding
- **Diacritics:** Include samples with full tashkeel marks (Fatha, Damma, Kasra, etc.)
- **Domain Coverage:** General knowledge, medical, legal, business
- **Query Types:** Factual, reasoning, multi-part, domain-specific

---

**Document Version:** 1.0
**Last Updated:** 2026-03-25 03:47 UTC
**Status:** 🟡 Preparation Phase
