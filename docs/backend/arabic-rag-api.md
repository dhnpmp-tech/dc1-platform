# Arabic RAG Pipeline API

**Base path:** `/api/rag`
**Auth:** Renter API key via `x-renter-key` header or `?key=` query param
**Pipeline:** BGE-M3 (embed) → BGE Reranker v2-M3 (rerank) → ALLaM 7B / JAIS 13B (generate)

---

## Overview

The Arabic RAG (Retrieval-Augmented Generation) API provides a complete pipeline for Arabic and bilingual document Q&A:

1. **Ingest** — embed documents using BGE-M3 and store in a named collection
2. **Query** — embed the question, retrieve relevant chunks, rerank, and generate an answer
3. **Status** — inspect pipeline health and which model stages are live vs. stub

The pipeline **degrades gracefully** when providers are offline: stub embeddings and a placeholder answer are returned with the same schema, so downstream services can be built and tested without live GPU providers.

---

## POST /api/rag/ingest

Embed a batch of documents into a persistent collection for later retrieval.

### Request

```json
{
  "documents": ["text string 1", "text string 2", "..."],
  "collection_id": "optional-uuid"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `documents` | `string[]` | ✅ | Up to 500 text documents to embed |
| `collection_id` | `string` | ❌ | Reuse an existing collection (appends). Auto-generated if omitted. |

### Response `200`

```json
{
  "collection_id": "550e8400-e29b-41d4-a716-446655440000",
  "documents_indexed": 10,
  "total_documents_in_collection": 10,
  "token_usage": {
    "embedding_tokens": 1024,
    "cost_halala": 2
  },
  "pipeline": {
    "embedding_model": "bge-m3-embedding",
    "embedding_source": "live"
  }
}
```

`embedding_source` is `"live"` when a BGE-M3 provider is online, otherwise `"stub"`.

---

## POST /api/rag/query

Run the full RAG pipeline: embed query → retrieve top-K chunks → rerank → generate answer.

### Request

```json
{
  "query": "ما هو الحكم في حالة تأخر تسليم البضاعة؟",
  "collection_id": "550e8400-e29b-41d4-a716-446655440000",
  "model": "allam-7b-instruct",
  "top_k": 5
}
```

**Alternative:** Pass `documents` array directly instead of `collection_id` for stateless queries.

```json
{
  "query": "What is the penalty for late delivery?",
  "documents": ["Article 45: ...", "Article 46: ..."],
  "model": "allam-7b-instruct",
  "top_k": 3
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | ✅ | Question in Arabic or English (max 4 000 chars) |
| `collection_id` | `string` | ✅ * | Named collection from a prior `/ingest` call |
| `documents` | `string[]` | ✅ * | Inline corpus (max 200 docs). Alternative to `collection_id`. |
| `model` | `string` | ❌ | `allam-7b-instruct` (default) or `jais-13b-chat` |
| `top_k` | `integer` | ❌ | Number of source chunks to include (1–20, default 5) |

\* Exactly one of `collection_id` or `documents` is required.

### Response `200`

```json
{
  "answer": "وفقاً للمادة 45، يحق للمشتري...",
  "source_chunks": [
    {
      "rank": 1,
      "text": "Article 45: In case of delayed delivery...",
      "relevance_score": 0.9213
    }
  ],
  "model": "allam-7b-instruct",
  "token_usage": {
    "embedding_tokens": 32,
    "reranking_tokens": 240,
    "generation_tokens": 187,
    "total_tokens": 459,
    "cost_halala": 3
  },
  "pipeline": {
    "embedding_model": "bge-m3-embedding",
    "reranker_model": "reranker-v2-m3",
    "generation_model": "allam-7b-instruct",
    "embedding_source": "live",
    "reranker_source": "stub",
    "generation_source": "live"
  }
}
```

`*_source` fields show whether each stage used a live provider or the fallback stub.

---

## GET /api/rag/status

Returns pipeline health without requiring authentication.

### Response `200`

```json
{
  "pipeline_ready": false,
  "mode": "stub",
  "arabic_rag_available": true,
  "generation_models": ["allam-7b-instruct", "jais-13b-chat"],
  "embedding_model": "bge-m3-embedding",
  "reranker_model": "reranker-v2-m3",
  "models": [
    {
      "model_id": "bge-m3-embedding",
      "role": "embedding",
      "status": "stub",
      "provider_id": null,
      "min_vram_gb": 1
    },
    {
      "model_id": "reranker-v2-m3",
      "role": "reranking",
      "status": "stub",
      "provider_id": null,
      "min_vram_gb": 1
    },
    {
      "model_id": "allam-7b-instruct",
      "role": "generation",
      "status": "stub",
      "provider_id": null,
      "min_vram_gb": 16
    },
    {
      "model_id": "jais-13b-chat",
      "role": "generation",
      "status": "stub",
      "provider_id": null,
      "min_vram_gb": 28
    }
  ],
  "portfolio_version": "2026-03-23",
  "collections_in_memory": 0
}
```

| Field | Value | Meaning |
|---|---|---|
| `pipeline_ready` | `true` | All 4 model stages have live providers |
| `mode` | `"live"` / `"partial"` / `"stub"` | Overall pipeline mode |
| `arabic_rag_available` | `true` | Always true — stub mode is always available |

---

## Billing

Costs are deducted from the renter's balance in **halala** (1 SAR = 100 halala):

| Stage | Rate |
|---|---|
| Embedding (BGE-M3) | 1 halala / 1 000 tokens |
| Reranking (BGE reranker) | 1 halala / 1 000 tokens |
| Generation (ALLaM / JAIS) | 5 halala / 1 000 tokens |

---

## Supported Arabic Models

| Model | ID | VRAM | Use case |
|---|---|---|---|
| ALLaM 7B Instruct | `allam-7b-instruct` | 16 GB | Saudi legal, government, finance |
| JAIS 13B Chat | `jais-13b-chat` | 28 GB | Long-context Arabic Q&A |

For embeddings and reranking, BGE-M3 and BGE reranker v2-M3 are used automatically — no model selection needed.

---

## Example: Saudi Legal Document Q&A

```bash
# 1. Ingest contract clauses
curl -X POST https://api.dcp.sa/api/rag/ingest \
  -H "x-renter-key: rk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      "المادة الأولى: يلتزم البائع بتسليم البضاعة خلال 30 يوماً من تاريخ العقد.",
      "المادة الثانية: في حال التأخر، يحق للمشتري المطالبة بتعويض يعادل 0.5% من قيمة العقد لكل يوم تأخير.",
      "المادة الثالثة: لا يُعدّ البائع مسؤولاً عن التأخر الناجم عن ظروف قاهرة."
    ],
    "collection_id": "contract-2026-001"
  }'

# 2. Query the collection
curl -X POST https://api.dcp.sa/api/rag/query \
  -H "x-renter-key: rk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ما هو التعويض المستحق في حال تأخر البائع 10 أيام؟",
    "collection_id": "contract-2026-001",
    "model": "allam-7b-instruct",
    "top_k": 3
  }'
```

---

## Deployment Notes

- **Collections** are currently stored in-memory (lost on restart). A SQLite migration with `rag_collections` and `rag_documents` tables will persist them across restarts.
- **Stub mode** is production-safe: it returns correctly-shaped responses for integration testing.
- **Live mode** activates automatically as soon as a provider registers with the embedding/reranker/LLM containers running. No config change required.
- The route is registered at `app.use('/api/rag', ragRouter)` in `backend/src/server.js`.
