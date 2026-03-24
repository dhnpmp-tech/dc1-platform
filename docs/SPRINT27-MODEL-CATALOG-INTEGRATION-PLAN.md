# Sprint 27: Model Catalog API Frontend Integration Plan

**Issue:** DCP-XXX (UI/UX Specialist)
**Status:** in_progress
**Branch:** ui-ux/sprint27-model-catalog-integration
**Owner:** UI/UX Specialist
**Timeline:** 2026-03-24 → 2026-03-26 (Phase 1 Day 4)

---

## Executive Summary

The backend model catalog APIs are complete and verified live. The frontend components are built and ready. This task ensures end-to-end integration, tests all filtering/sorting/pricing flows, and prepares the marketplace for Phase 1 renter testing.

---

## Current State

### ✅ Backend (Complete)
- `/api/models` — Main model list with filters (arabic_capable, min_vram_gb, category, tier)
- `/api/models/catalog` — Full catalog payload with all model details
- `/api/models/cards` — Model card feed with benchmarks and use case summaries
- `/api/models/:id` — Single model detail endpoint
- `/api/models/:id/deploy/estimate` — Deployment estimation with pricing
- `/api/models/compare` — Side-by-side model comparison
- `/api/models/bundles/arabic-rag` — Arabic RAG bundle endpoint
- `/api/templates` — Docker template catalog (20 templates)

**Pricing Data:** All models have SAR pricing, competitor pricing (Vast.ai/RunPod/AWS), and savings percentages

**Data Verified:** api.dcp.sa responding correctly with 11 models live, Arabic models visible

### ✅ Frontend (Ready)
- `app/components/marketplace/ModelBrowsing.tsx` — Main browsing component with filters, sorting, card display
- `app/components/marketplace/PricingDisplay.tsx` — Pricing comparison widget
- `app/components/marketplace/FeaturedArabicModels.tsx` — Arabic model hero section
- `app/renter/models/page.tsx` — Renter model browsing page (filters by task, tier, VRAM, Arabic, price)
- `app/marketplace/models/page.tsx` — Public marketplace model view
- `next.config.js` — API routing configured (`/api/dc1/*` → backend, `/api/models/*` → backend)

### 🟢 Routing (Verified)
- `/api/dc1/:path*` rewrites to `{BACKEND_URL}/api/:path*`
- `/api/models/:path*` rewrites to `{BACKEND_URL}/api/models/:path*`
- Both patterns work; frontend can use either `/api/dc1/models` or `/api/models`

---

## Integration Test Checklist

### Phase 1: API Response Validation
**Goal:** Verify all endpoints return expected data structure

#### 1.1 GET `/api/models/catalog`
- [ ] Returns `{ generated_at, total_models, models[] }`
- [ ] Each model has: `model_id`, `display_name`, `family`, `vram_gb`, `min_gpu_vram_gb`, `quantization`, `context_window`, `use_cases`, `providers_online`, `avg_price_sar_per_hr`, `competitor_prices`, `savings_pct`, `tier`, `arabic_capability`, `cold_start_ms`
- [ ] At least 11 models returned
- [ ] Arabic models correctly marked (`arabic_capability: true`)
- [ ] Tier A + Tier B models present

#### 1.2 GET `/api/models/cards`
- [ ] Returns `{ cards[] }`
- [ ] Each card has: `model_id`, `summary`, `metrics` (vram, latency, arabic_quality, cost_per_1k_tokens_sar, cold_start_ms)
- [ ] Summaries available in English and Arabic (`ar`/`en` keys)
- [ ] Cold-start latency values present for RTL calculation

#### 1.3 GET `/api/models/:id`
- [ ] Single model returns full detail structure
- [ ] Model ID with slashes supported (e.g., `ALLaM-AI/ALLaM-7B-Instruct`)
- [ ] No 404s for valid model IDs

#### 1.4 GET `/api/models/:id/deploy/estimate`
- [ ] Requires renter API key (`?key=` or `x-renter-key` header)
- [ ] Returns estimated monthly cost in SAR (based on 70% utilization assumption)
- [ ] Returns deployment duration (default 60 minutes)

---

### Phase 2: Frontend Component Testing

#### 2.1 ModelBrowsing Component (`app/components/marketplace/ModelBrowsing.tsx`)
- [ ] Loads from `/api/models/catalog` without error
- [ ] Displays all 11+ models in card grid
- [ ] **Filtering:**
  - [ ] Tier filter (All / Tier A / Tier B / Tier C) works
  - [ ] Arabic Capability filter shows 4-6 Arabic models
  - [ ] Min VRAM filter (8, 16, 24, 80 GB) correctly filters
  - [ ] Compute type filter (inference, training, rendering) works
- [ ] **Sorting:**
  - [ ] Price ascending (RTX 4090 cheaper first)
  - [ ] Price descending (H100 expensive first)
  - [ ] Latency ascending (TTFT low first)
  - [ ] Launch priority (Tier A first)
  - [ ] Availability (most providers first)
- [ ] Each card shows tier/prewarm badges ⭐/✦/🔥/♨
- [ ] Pricing displayed in SAR/hr with competitive comparison
- [ ] 33-51% savings badge appears for DCP vs Vast.ai

#### 2.2 Renter Models Page (`app/renter/models/page.tsx`)
- [ ] Page loads with authentication (renter API key required)
- [ ] Fetch from `/api/dc1/models` succeeds (via rewrite to `/api/models`)
- [ ] **Filters:**
  - [ ] Search by name/ID/family/use-cases works
  - [ ] Task filter (chat / embedding / reranking / image) works
  - [ ] Arabic filter shows Arabic models only
  - [ ] VRAM filter works (>=)
  - [ ] Max price filter works (<=)
  - [ ] Tier filter works
- [ ] Each model card displays:
  - [ ] Name + model ID
  - [ ] Tier badge (⭐/✦)
  - [ ] Prewarm badge (🔥/♨)
  - [ ] Task type badge
  - [ ] Quantization badge (if present)
  - [ ] Use cases (first 3)
  - [ ] VRAM, context window, providers online, price in SAR/hr
  - [ ] Savings % vs Vast.ai
- [ ] Deploy button opens modal with:
  - [ ] Model specs summary
  - [ ] "You save X%" box if applicable
  - [ ] Warning if no providers available (with waitlist CTA)
  - [ ] Warning if insufficient balance (with topup CTA)
  - [ ] Deploy Now button that calls `/api/dc1/models/:id/deploy`

#### 2.3 Model Detail Page (if separate page needed)
- [ ] Single model view with hero, benchmarks, cost estimator
- [ ] Shows competitor comparison table (DCP vs Vast.ai/RunPod/AWS in SAR)
- [ ] Interactive cost estimator (utilization slider 10-100%)
- [ ] Live provider availability count
- [ ] 7-day uptime % metric
- [ ] Deploy CTA button

#### 2.4 Arabic RTL Support
- [ ] ModelBrowsing component respects `dir="rtl"` for Arabic users
- [ ] All filter labels translated or RTL-friendly
- [ ] Card layout mirrors correctly (badges on left for RTL)
- [ ] Arabic model summaries display correctly
- [ ] Pricing labels (SAR) align properly in RTL

---

### Phase 3: End-to-End User Flows

#### 3.1 Renter Browsing Flow
1. [ ] Renter logs in → Dashboard redirects to `/renter/models`
2. [ ] Models page loads, shows 11+ models
3. [ ] Renter filters Arabic models only → 4-6 results
4. [ ] Renter filters Tier A + Arabic → 2-3 results
5. [ ] Renter clicks "Deploy Model" on ALLaM-7B
6. [ ] Deploy modal opens with specs (7B params, 15GB VRAM, etc.)
7. [ ] Modal shows "Save 40% vs Vast.ai"
8. [ ] Renter clicks "Deploy Now" → job submitted
9. [ ] Modal redirects to job detail page

#### 3.2 Marketplace Browsing Flow
1. [ ] Public visits `/marketplace/models`
2. [ ] ModelBrowsing component displays (no auth required)
3. [ ] Public filters by compute type (embedding) → shows embeddings
4. [ ] Public sorts by price ascending → RTX 4090 first
5. [ ] Public clicks model → (depends on app: detail page or CTA to login)

#### 3.3 Cost Estimation Flow
1. [ ] Renter goes to `/renter/models` with API key
2. [ ] Renter filters models (e.g., min 16GB VRAM)
3. [ ] Each model card shows "2.50 SAR/hr" (or computed from avg_price_sar_per_hr)
4. [ ] Renter clicks Deploy → modal calls `/api/models/:id/deploy/estimate`
5. [ ] Modal updates with more precise cost estimate if available
6. [ ] Estimated monthly SAR and warnings for budget display

---

## Data Validation Checklist

### Model Data Fields
**Per model, verify:**
- [ ] `model_id` — HuggingFace format (e.g., `ALLaM-AI/ALLaM-7B-Instruct`)
- [ ] `display_name` — Human-readable (e.g., "ALLaM 7B Instruct")
- [ ] `family` — Model family (e.g., "ALLaM", "Falcon H1")
- [ ] `vram_gb` — VRAM capacity (8, 15, 40, 80, etc.)
- [ ] `min_gpu_vram_gb` — Minimum GPU VRAM to run (often ≤ vram_gb)
- [ ] `quantization` — Precision (e.g., "Q4_K_M", "FP8", "BF16")
- [ ] `context_window` — Max tokens (e.g., 2048, 4096, 8192)
- [ ] `use_cases` — Task array (["chat", "rag", "instruct"] or ["embed"] or ["rerank"])
- [ ] `providers_online` — Live provider count (0-100+)
- [ ] `avg_price_sar_per_hr` — Hourly rate in SAR (1-10 range for RTX 4090, higher for H100)
- [ ] `avg_price_sar_per_min` — Minute rate (price_per_hr / 60)
- [ ] `competitor_prices` — Object with Vast.ai/RunPod/AWS in SAR
- [ ] `savings_pct` — DCP discount vs Vast.ai (25-50% range)
- [ ] `tier` — Deployment tier ("tier_a", "tier_b", "tier_c", null)
- [ ] `arabic_capability` — Boolean (true for ALLaM, JAIS, Falcon-H1, Qwen, etc.)
- [ ] `cold_start_ms` — TTFT latency estimate (1000-5000 ms typical)
- [ ] `prewarm_class` — Pre-fetch status ("hot", "warm", null)

### Arabic Models (Critical)
**Tier A models must include:**
- [ ] ALLaM 7B / 13B (ALLaM-AI/ALLaM-7B-Instruct, etc.)
- [ ] Falcon H1 7B
- [ ] Qwen 2.5 7B
- [ ] Llama 3 8B (not Arabic-specific but multilingual)
- [ ] Mistral 7B (not Arabic but high performance baseline)

**Tier B models (embedding + reranking):**
- [ ] BGE-M3 (Arabic embeddings)
- [ ] BGE Reranker v2-m3 (Arabic reranking)

**All Arabic models must have:**
- [ ] `arabic_capability: true`
- [ ] Arabic-capable badge in UI ("🌙 Arabic")
- [ ] PDPL compliance mention in deploy modal

---

## Pricing Verification

### Price Points (SAR/hr, based on FOUNDER-STRATEGIC-BRIEF.md)
| Model | VRAM | DCP | Vast.ai | Savings |
|-------|------|-----|---------|---------|
| RTX 4090 | 24GB | 1.00 | 1.31 | 24% |
| RTX 4080 | 16GB | 0.70 | 1.00 | 30% |
| H100 | 80GB | 6.00 | 8.00 | 25% |
| A100 | 40GB | 3.00 | 5.00 | 40% |

**Verification:**
- [ ] Each model shows correct SAR/hr price
- [ ] Competitor prices match strategic brief (within 5% variance)
- [ ] Savings % calculated correctly: `(competitor - dcp) / competitor * 100`
- [ ] No model shows negative savings
- [ ] SAR/USD conversion consistent (verify rate in code)

---

## Deployment Readiness

### Frontend Deployment
- [ ] No console errors in browser DevTools
- [ ] No TypeScript errors (run `npm run build`)
- [ ] API rewrite rules working (check Network tab in DevTools)
- [ ] Load time <2s for model catalog fetch

### Production Checks
- [ ] Models visible on production (`api.dcp.sa`)
- [ ] Arabic RTL rendering works on production
- [ ] Deploy button triggers correct API endpoint
- [ ] Phase 1 renters can browse and deploy

---

## Known Gaps / Future Work

### Not in Sprint 27 (deferred to Sprint 28+)
- [ ] Model comparison view (/api/models/compare wired to UI)
- [ ] Arabic RAG bundle one-click deploy (/api/models/bundles/arabic-rag)
- [ ] Provider-specific model availability (shows Tier A providers by region)
- [ ] Model benchmarks dashboard (detailed latency, throughput graphs)

### Documented in Phase 1 Testing
- [ ] User feedback on model discovery (UX researcher sessions)
- [ ] Provider activation flow (monitored during Phase 1 Day 5-6)

---

## Sign-Off Criteria

✅ **Integration Complete When:**
1. All API endpoints return correct data
2. Frontend components fetch and display without errors
3. All filters + sorting work end-to-end
4. Pricing shows correctly (DCP SAR + competitor + savings %)
5. Arabic models prominent + correct capabilities
6. Deploy flow triggered successfully
7. Phase 1 renter can sign up, browse models, and deploy
8. No critical bugs in browser console

---

## Timeline

| Date | Milestone |
|------|-----------|
| 2026-03-24 (today) | Integration testing, gap fix |
| 2026-03-25 | Final testing, minor UI tweaks if needed |
| 2026-03-26 08:00 UTC | Phase 1 Day 4 begins — Pre-test validation |
| 2026-03-26 → 2026-03-28 | Phase 1 Days 4-6 — Live renter testing |

---

## Related Work

- **Backend:** DCP-832 (benchmarks), DCP-770 (earnings calculator), DCP-871 (template catalog)
- **Frontend:** DCP-665 (template UI), DCP-857 (deploy modal), DCP-643 (model detail spec)
- **Testing:** DCP-773-DCP-775 (Phase 1 Days 4-6)
- **DevOps:** VPS deployment (pull commits to production)

---

**Document Owner:** UI/UX Specialist
**Last Updated:** 2026-03-24 08:XX UTC
**Status:** in_progress → ready_for_testing
