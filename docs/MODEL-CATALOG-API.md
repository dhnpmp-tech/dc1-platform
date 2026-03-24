# Model Catalog API — Frontend Integration Reference

> DCP-787 · Backend Architect · 2026-03-24

All endpoints are proxied by Next.js at `/api/dc1/*` → `http://backend:8083/api/*`.

---

## Endpoints

### `GET /api/dc1/models`

List endpoint for the marketplace model grid.

**Query params**

| Param | Type | Description |
|---|---|---|
| `arabic_capable` | `true` | Only Arabic-capable models |
| `category` | `arabic\|llm\|embedding\|image\|training` | `arabic` is an alias for `arabic_capable=true` |
| `min_vram_gb` or `vram_min` | integer | Models whose min VRAM ≤ N (i.e. fits on a GPU with N GB) |
| `capability` | `arabic_text\|embeddings\|reranker\|chat\|image` | Fine-grained task filter |

**Response** — array of `ModelListItem`:

```ts
interface ModelListItem {
  model_id: string           // e.g. "allam-7b-instruct"
  display_name: string       // e.g. "ALLaM 7B Instruct"
  family?: string
  vram_gb?: number
  min_gpu_vram_gb?: number   // minimum GPU VRAM to run this model
  quantization?: string      // e.g. "int4"
  context_window?: number    // token count
  use_cases?: string[]
  providers_online?: number  // live count of capable online providers
  avg_price_sar_per_min?: number
  status?: 'available' | 'no_providers'
  tier?: 'tier_a' | 'tier_b' | 'tier_c' | null
  prewarm_class?: 'hot' | 'warm' | null
  competitor_prices?: {
    vast_ai: number          // SAR/hr
    runpod: number           // SAR/hr
    aws: number              // SAR/hr
    vast_ai_usd: number
    runpod_usd: number
    aws_usd: number
  } | null
  savings_pct?: number       // % cheaper than Vast.ai (0-100)
}
```

---

### `GET /api/dc1/models/catalog`

Same filtering as `GET /models` but returns a richer envelope used for the compare/deploy UX.

**Response**

```ts
{
  generated_at: string       // ISO timestamp
  total_models: number
  models: ModelFull[]        // full payload (see below)
}
```

---

### `GET /api/dc1/models/:model_id`

Full single-model detail for a model detail page or deploy confirmation screen.

**Response** — `ModelFull`:

```ts
interface ModelFull {
  model_id: string
  display_name: string
  family?: string
  arabic: boolean            // true if model has Arabic capability
  arabic_capability: boolean // same as arabic
  task: string[]             // e.g. ['chat', 'instruct'] or ['embed'] or ['rerank']
  vram_gb: number
  min_gpu_vram_gb: number
  quantization?: string
  context_window: number
  use_cases: string[]

  availability: {
    providers_online: number
    providers_warm: number
    status: 'available' | 'no_providers'
  }

  pricing: {
    default_halala_per_min: number
    default_sar_per_min: number
    default_sar_per_hour: number
    avg_sar_per_min: number
    min_sar_per_min: number
    max_sar_per_min: number
    competitor_prices: {
      vast_ai: number        // SAR/hr
      runpod: number         // SAR/hr
      aws: number            // SAR/hr
      vast_ai_usd: number
      runpod_usd: number
      aws_usd: number
    }
    savings_pct: number      // % savings vs Vast.ai
  }

  benchmark: {
    benchmark_suite: string
    measured_at: string | null
    latency_ms: { p50: number | null, p95: number | null, p99: number | null }
    arabic_quality: { arabic_mmlu_score: number | null, arabicaqa_score: number | null }
    cost_per_1k_tokens_halala: number | null
    cost_per_1k_tokens_sar: number | null
    vram_required_gb: number
    cold_start_ms: number | null
    notes_en: string | null
    notes_ar: string | null
  }

  template_id: string | null          // e.g. "arabic-llm", "llama3-8b"
  template_available: boolean         // true if docker-templates/<template_id>.json exists on disk
  prefetch_status: 'available' | 'pending' | 'unavailable'
  estimated_cold_start_ms: number

  portfolio: {
    tier: 'tier_a' | 'tier_b' | 'tier_c'
    tier_rank: number
    launch_priority: number | null
    prewarm_class: 'hot' | 'warm' | 'cold'
    container_profile: string
    min_vram_gb: number | null
    source_id: string | null
    source_repo: string | null
  } | null

  updated_at: string | null
}
```

---

### `GET /api/dc1/models/:model_id/deploy/estimate`

Pre-flight cost estimate before submitting a deploy job.

**Query params**: `duration_minutes` (default 60)

**Response**

```ts
{
  model_id: string
  display_name: string
  availability: { providers_online, providers_warm, status }
  estimate: {
    duration_minutes: number
    rate_halala_per_min: number
    estimated_cost_halala: number
    estimated_cost_sar: number
    estimated_cold_start_ms: number
    providers_online: number
    providers_warm: number
  }
}
```

---

### `GET /api/dc1/models/bundles/arabic-rag`

Returns the Arabic RAG bundle (BGE-M3 + reranker + ALLaM/JAIS).

---

### `GET /api/dc1/models/compare?ids=id1,id2`

Side-by-side comparison for up to 8 models. Returns `ModelFull[]` plus a ranking array.

---

## Filter Examples

```bash
# Arabic-capable models only
GET /api/dc1/models?arabic_capable=true
GET /api/dc1/models?category=arabic

# Embedding models (for Arabic RAG pipeline display)
GET /api/dc1/models?capability=embeddings

# Reranker models
GET /api/dc1/models?capability=reranker

# Models fitting on a 24 GB GPU
GET /api/dc1/models?vram_min=24

# Arabic models fitting on 16 GB GPU
GET /api/dc1/models?category=arabic&vram_min=16
```

---

## Pricing Display Notes

- All SAR values: `pricing.default_sar_per_hour` = DCP price
- Competitor SAR: `pricing.competitor_prices.vast_ai` (SAR/hr), `runpod`, `aws`
- Savings: `pricing.savings_pct` = % cheaper than Vast.ai
- For the list view, use `avg_price_sar_per_min * 60` for display
- `template_available: true` means there is a one-click deploy template; show a "Deploy" CTA
- `template_available: false` means deploy requires manual configuration
