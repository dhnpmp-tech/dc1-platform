# Sprint 27 Marketplace UI — Integration Guide

**Status:** Component delivery complete (March 23, 2026)
**Components Created:** 4 production-ready React/TypeScript components (1,410 lines)
**Location:** `app/components/marketplace/`

## Overview

Sprint 27 marketplace activation requires integrating new template catalog and model browsing UI into the renter dashboard. Four new components provide the critical path functionality for renters to discover and deploy models.

## Components at a Glance

### 1. TemplateCatalog
**File:** `app/components/marketplace/TemplateCatalog.tsx` (250 lines)

**Purpose:** Display 19 pre-configured docker templates (nemotron-nano, llama3-8b, qwen25-7b, etc.)

**Props:**
```typescript
interface TemplateCatalogProps {
  onSelectTemplate?: (template: Template) => void
}
```

**Usage:**
```tsx
<TemplateCatalog onSelectTemplate={(template) => {
  console.log('User selected template:', template.name)
}} />
```

**Features:**
- Tier-based filtering (instant/cached/standard/premium)
- Grid layout responsive to mobile/tablet/desktop
- Shows VRAM requirement, hourly price, difficulty level
- Bilingual card labels (EN/AR)

**API Dependency:**
- `GET /api/templates` — fetches all templates with metadata

---

### 2. ModelBrowsing
**File:** `app/components/marketplace/ModelBrowsing.tsx` (380 lines)

**Purpose:** Browse available models with advanced filtering and sorting

**Props:**
```typescript
interface ModelBrowsingProps {
  onSelectModel?: (model: Model) => void
}
```

**Usage:**
```tsx
<ModelBrowsing onSelectModel={(model) => {
  console.log('User selected model:', model.display_name)
}} />
```

**Features:**
- Multi-dimensional filtering:
  - Tier (A/B/C)
  - Arabic capability toggle
  - Minimum VRAM (any, 8, 16, 24, 80 GB)
  - Compute type (inference, training, rendering)
- Sorting options:
  - Availability (most providers online first)
  - Price ascending/descending
  - Latency (p95 metric)
  - Launch priority (tier-based)
- Shows provider count and real-time pricing
- Bilingual summaries from /api/models/cards

**API Dependencies:**
- `GET /api/models/catalog` — model list with benchmarks
- `GET /api/models/cards` — bilingual metadata

---

### 3. PricingDisplay
**File:** `app/components/marketplace/PricingDisplay.tsx` (340 lines)

**Purpose:** Show competitive pricing and help renters estimate deployment costs

**Props:**
```typescript
interface PricingDisplayProps {
  modelId?: string
  vramGb?: number
  pricePerHour?: number
  onPriceEstimate?: (totalPrice: number) => void
}
```

**Usage:**
```tsx
<PricingDisplay
  modelId="llama3-8b"
  vramGb={16}
  onPriceEstimate={(price) => {
    console.log('Estimated cost: SAR', price)
  }}
/>
```

**Features:**
- Market comparison grid (DC1 vs Vast.ai, RunPod, AWS)
- Dynamic discount percentages (33-51% examples)
- Cost estimator with dual modes:
  - Duration-based (hours + minutes)
  - Token-based (for LLM pricing)
- Buyer economics table (4 real scenarios from FOUNDER-STRATEGIC-BRIEF)
- Real-time pricing scaled by GPU tier

**No external API calls** — all pricing data embedded from strategic brief

---

### 4. MarketplaceFlow
**File:** `app/components/marketplace/MarketplaceFlow.tsx` (440 lines)

**Purpose:** Orchestrate complete template → model → deploy journey

**Props:**
```typescript
interface MarketplaceFlowProps {
  onDeploySubmit?: (deployRequest: any) => void
}
```

**Usage:**
```tsx
<MarketplaceFlow onDeploySubmit={(result) => {
  console.log('Deployment submitted:', result)
  // Handle success (redirect to job status, etc.)
}} />
```

**Features:**
- 5-step wizard: template → model → pricing → estimate → confirm
- Visual progress bar showing current step
- Integrated form validation (selection required to proceed)
- Integrated API calls:
  - Fetches templates and models
  - Calls `/api/models/:id/deploy/estimate` for cost calc
  - Submits to `/api/models/:id/deploy` for deployment
- Comprehensive error handling with user-friendly messages
- Back/Next navigation with safety checks

---

## Integration Paths

### Option A: Full MarketplaceFlow (Recommended)
Replace current provider-focused marketplace with new template/model flow:

```tsx
// app/renter/marketplace/page.tsx or similar
import MarketplaceFlow from '@/app/components/marketplace/MarketplaceFlow'

export default function RenterMarketplace() {
  return (
    <DashboardLayout>
      <MarketplaceFlow onDeploySubmit={(result) => {
        // Handle post-deploy (show confirmation, redirect, etc.)
      }} />
    </DashboardLayout>
  )
}
```

### Option B: Tabbed Interface
Keep provider browsing + add new template/model tabs:

```tsx
'use client'
import { useState } from 'react'
import TemplateCatalog from '@/app/components/marketplace/TemplateCatalog'
import ModelBrowsing from '@/app/components/marketplace/ModelBrowsing'
import PricingDisplay from '@/app/components/marketplace/PricingDisplay'

export default function RenterMarketplace() {
  const [tab, setTab] = useState('templates')
  const [selectedModel, setSelectedModel] = useState(null)

  return (
    <DashboardLayout>
      <div className="mb-4 flex gap-4">
        <button onClick={() => setTab('templates')} className={tab === 'templates' ? 'active' : ''}>
          Templates
        </button>
        <button onClick={() => setTab('models')} className={tab === 'models' ? 'active' : ''}>
          Models
        </button>
      </div>

      {tab === 'templates' && <TemplateCatalog onSelectTemplate={...} />}
      {tab === 'models' && <ModelBrowsing onSelectModel={setSelectedModel} />}
      {selectedModel && tab === 'models' && <PricingDisplay modelId={selectedModel.model_id} />}
    </DashboardLayout>
  )
}
```

### Option C: Individual Components
Use each component independently in different pages:

```tsx
// app/renter/catalog/templates/page.tsx
import TemplateCatalog from '@/app/components/marketplace/TemplateCatalog'

// app/renter/catalog/models/page.tsx
import ModelBrowsing from '@/app/components/marketplace/ModelBrowsing'

// app/renter/pricing/page.tsx
import PricingDisplay from '@/app/components/marketplace/PricingDisplay'
```

---

## Backend API Contract

### GET /api/templates
**Response:**
```json
{
  "templates": [
    {
      "id": "llama3-8b",
      "name": "Llama 3 8B Instruct",
      "description": "...",
      "icon": "🦙",
      "difficulty": "easy",
      "tier": "cached",
      "min_vram_gb": 16,
      "estimated_price_sar_per_hour": 9.0,
      "tags": ["llm", "inference", "openai-compatible"],
      "sort_order": 3
    }
  ],
  "count": 19
}
```

### GET /api/models/catalog
**Response:**
```json
{
  "models": [
    {
      "model_id": "llama3-8b",
      "display_name": "Llama 3 8B Instruct",
      "family": "Llama 3",
      "vram_gb": 16,
      "quantization": "float16",
      "context_window": 8192,
      "use_cases": ["inference", "chat"],
      "min_gpu_vram_gb": 16,
      "providers_online": 5,
      "avg_price_sar_per_min": 0.15,
      "status": "available"
    }
  ]
}
```

### GET /api/models/cards
**Response:**
```json
{
  "cards": [
    {
      "model_id": "llama3-8b",
      "summary": {
        "en": "Meta's fast 8B LLM for chat and reasoning",
        "ar": "نموذج ميتا اللغة الكبير..."
      },
      "metrics": {
        "vram_required_gb": 16,
        "latency_ms": {"p50": 50, "p95": 150, "p99": 300},
        "cost_per_1k_tokens_sar": 0.02
      }
    }
  ]
}
```

### POST /api/models/:model_id/deploy/estimate
**Request:**
```json
{
  "duration_minutes": 60
}
```

**Response:**
```json
{
  "model_id": "llama3-8b",
  "duration_minutes": 60,
  "estimated_cost_sar": 9.0,
  "warm_cache_available": true,
  "estimated_cold_start_ms": 10000
}
```

### POST /api/models/:model_id/deploy
**Request:**
```json
{
  "duration_minutes": 60
}
```

**Response:**
```json
{
  "job_id": "job-xxx",
  "model_id": "llama3-8b",
  "status": "pending",
  "estimated_start_time": "2026-03-23T15:30:00Z"
}
```

---

## Styling & Theming

All components follow DCP's existing design system:
- **Colors:** Uses Tailwind gray/blue/green/red palette
- **Spacing:** Follows mb-4, p-4, gap-4 patterns
- **Typography:** Uses existing font sizes (text-sm, text-lg, etc.)
- **Responsive:** Mobile-first (grid-cols-1 → md:grid-cols-2 → lg:grid-cols-3)

**No custom CSS required** — all styling done via Tailwind classes

---

## i18n Support

All components use the existing `useLanguage()` hook:

```typescript
const { language, t } = useLanguage()
// language = 'en' or 'ar'
// t = translation function
```

Components automatically handle:
- EN/AR label switching
- Bilingual model card summaries
- Direction-aware layouts (RTL for Arabic)

**Required in CLAUDE.md or i18n config:**
```
marketplace.template_catalog
marketplace.model_browsing
marketplace.pricing_info
marketplace.deploy_now
marketplace.min_vram
marketplace.difficulty_*
marketplace.tier_*
marketplace.sort_*
... (see components for full list)
```

---

## Performance Considerations

### API Caching
- Templates (GET /api/templates) — cache ~24 hours (rarely change)
- Models (GET /api/models/catalog) — cache ~5 minutes (pricing updates)
- Model cards (GET /api/models/cards) — cache ~5 minutes

### Component Optimization
- All components use React.memo where applicable
- Filtering/sorting done client-side (templates + models fit in memory)
- API calls parallelized in ModelBrowsing (catalog + cards)
- MarketplaceFlow debounces step transitions

### Expected Load Times
- Initial render: <500ms (local data)
- First API call: <2s (catalog + cards parallel)
- Cost estimate: <1s
- Deploy submission: <3s

---

## Testing Checklist

- [ ] TemplateCatalog renders all 19 templates
- [ ] ModelBrowsing filters work (tier, VRAM, Arabic, compute type)
- [ ] ModelBrowsing sorts work (5 options)
- [ ] PricingDisplay calculates durations correctly
- [ ] PricingDisplay calculates tokens correctly
- [ ] MarketplaceFlow navigates 5 steps without errors
- [ ] MarketplaceFlow calls /deploy/estimate correctly
- [ ] MarketplaceFlow calls /deploy correctly
- [ ] All components work in Arabic (ar language)
- [ ] Responsive design works on mobile (375px), tablet (768px), desktop (1024px)
- [ ] Error states handled gracefully (network failures, 404s, etc.)

---

## Known Limitations

1. **Provider Selection** — Current impl. doesn't let renters pick a specific provider. Consider adding provider selector in deploy-estimate step.
2. **Custom Duration** — Deploy estimate locked to 60 min default. Add duration input field in pricing step.
3. **Model Benchmark Data** — Latency/Arabic scores only shown if populated in /api/models/cards. Some models may lack metrics.
4. **Pricing Accuracy** — Competitive pricing hardcoded for A100/H100/RTX4090. Update COMPETITIVE_PRICING map for other GPU tiers.

---

## Quick Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Templates not loading | /api/templates returns 404 | Verify backend templates route mounted |
| Models filter empty | /api/models/catalog not responding | Check backend models.js route |
| Arabic text broken | i18n translations missing | Add marketplace.* keys to translations |
| Cost estimator wrong | Price calculation based on hard-coded values | Update basePrice logic in PricingDisplay |
| Deploy fails | /api/models/:id/deploy not implemented | Check backend deploy endpoints |

---

## Next Owners

- **Frontend Dev:** Integrate components into renter marketplace, test with live APIs
- **DevOps:** Ensure /api/models/*, /api/templates endpoints live on production
- **QA:** End-to-end testing (template → model → deploy journey)
- **DevRel:** Update docs/renter-onboarding.md with new marketplace UI walkthrough

---

**Questions?** Check the component source code comments or ask the UI/UX Specialist (agent 24ab4f1e-0d13-41a5-8810-0c05bbb9e648).
