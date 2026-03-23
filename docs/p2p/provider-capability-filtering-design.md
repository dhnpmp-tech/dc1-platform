# Provider Capability Filtering — Backend Service Design

**Date**: 2026-03-23
**Sprint**: 27
**Status**: Implementation Design
**Scope**: Backend service + API for model-aware provider discovery

---

## Executive Summary

This document specifies the backend service architecture for **model-aware provider discovery**. Current provider listings return static GPU metadata without filtering by cached models, capabilities, or regional availability.

This design enables renters to query providers like:
```
"Find providers with llama3-8b pre-cached and ≥12 GB free VRAM in SA"
```

Rather than today's manual filtering of a flat provider list.

---

## Section 1: Current State

### 1.1 Provider Heartbeat Schema

```javascript
POST /api/providers/heartbeat
Body: {
  api_key: "dc1-provider-...",
  gpu_status: {
    gpu_name: "RTX 4090",
    gpu_vram_mib: 24576,
    gpu_util_pct: 45,
    free_vram_mib: 13500,
    gpu_count: 2,
    daemon_version: "3.3.0",
    temp_c: 62,
    power_w: 285
  },
  cached_models: ["llama3-8b", "mistral-7b", "qwen-2.5-7b"],
  resource_spec: {
    region: "sa",
    price_sar_per_hour: 15.50,
    tags: ["inference", "streaming"]
  }
}
```

**Problem**: No per-model load state, no capability flags, no Arabic optimization metadata.

### 1.2 Provider Query API (Current)

```javascript
GET /api/providers/available

Response: [
  {
    id: "provider-123",
    gpu_model: "RTX 4090",
    vram_gb: 24,
    cached_models: ["llama3-8b", "mistral-7b"],
    reliability_score: 95,
    location: "sa",
    is_live: true
  },
  ...
]
```

**Problem**: No filtering; returns all online providers (50+ at scale).

---

## Section 2: Backend Service Architecture

### 2.1 Data Model Extensions

#### Provider Table (SQLite)

**New columns** (small additions):
```sql
ALTER TABLE providers ADD COLUMN (
  p2p_peer_id TEXT,           -- Already exists (optional)
  arabic_optimized BOOLEAN,   -- TRUE if provider has Arabic models
  inference_capable BOOLEAN,  -- TRUE if supports inference
  fine_tuning_capable BOOLEAN,-- TRUE if supports LoRA/QLoRA
  batch_processing_capable BOOLEAN,
  streaming_capable BOOLEAN,
  last_capability_update DATETIME
);

-- New table: model_load_states (one row per provider per model)
CREATE TABLE provider_model_states (
  id INTEGER PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES providers(id),
  model_id TEXT NOT NULL,
  is_loaded BOOLEAN,
  vram_used_mib INTEGER,
  load_time_ms INTEGER,        -- Estimated time to load if not in memory
  last_updated DATETIME NOT NULL,
  UNIQUE(provider_id, model_id)
);

-- New table: provider_cache_catalog (denormalized for fast queries)
CREATE TABLE provider_cache_catalog (
  id INTEGER PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES providers(id),
  model_id TEXT NOT NULL,
  model_family TEXT,            -- "llama", "mistral", "arabic", "embedding", etc.
  is_loaded BOOLEAN,
  vram_used_mib INTEGER,
  load_time_ms INTEGER,
  last_updated DATETIME NOT NULL,
  UNIQUE(provider_id, model_id)
);
```

#### Provider Discovery Schema (P2P / GossipSub)

When providers announce to the P2P DHT, they include:
```json
{
  "version": 1,
  "peer_id": "12D3KooXXXX",
  "announced_at": "2026-03-23T15:30:00Z",
  "provider_id": "provider-123",
  "gpu": {
    "model": "RTX 4090",
    "vram_gb": 24,
    "compute_capability": "8.9",
    "cuda_version": "12.4",
    "driver_version": "550.120",
    "count": 2
  },
  "memory": {
    "total_vram_mb": 24576,
    "free_vram_mb": 13500,
    "allocated_for_models_mb": 11076
  },
  "models": {
    "loaded": [
      {
        "model_id": "llama3-8b",
        "family": "llama",
        "vram_used_mb": 6400,
        "load_time_ms": 0
      },
      {
        "model_id": "mistral-7b",
        "family": "mistral",
        "vram_used_mb": 4680,
        "load_time_ms": 0
      }
    ],
    "unloaded_but_cached": [
      {
        "model_id": "allam-7b",
        "family": "arabic",
        "estimated_vram_mb": 7200,
        "estimated_load_time_ms": 8500
      },
      {
        "model_id": "qwen-2.5-7b",
        "family": "qwen",
        "estimated_vram_mb": 6800,
        "estimated_load_time_ms": 7800
      }
    ]
  },
  "capabilities": {
    "inference": true,
    "streaming": true,
    "fine_tuning": false,
    "batch_processing": true,
    "arabic_optimized": true
  },
  "pricing": {
    "sar_per_hour": 15.50
  },
  "location": "sa",
  "reliability_score": 95
}
```

### 2.2 Provider Heartbeat Handler Enhancement

**File**: `backend/src/routes/providers.js` — `POST /api/providers/heartbeat`

```javascript
// NEW: Parse provider capability metadata from heartbeat
function parseModelLoadStates(gpuStatus = {}, heartbeatData = {}) {
  // Extract model load information from daemon (if available)
  const modelStates = heartbeatData.model_load_states || {};
  const cachedModels = heartbeatData.cached_models || [];

  // Build a map of { model_id: { loaded, vram_used_mib, load_time_ms } }
  const states = new Map();

  for (const [modelId, state] of Object.entries(modelStates)) {
    states.set(modelId, {
      model_id: modelId,
      is_loaded: Boolean(state.loaded),
      vram_used_mib: state.vram_used_mib || 0,
      load_time_ms: state.load_time_ms || null
    });
  }

  // For models in cached_models list but not in modelStates, mark as cached (assume unloaded)
  for (const modelId of cachedModels) {
    if (!states.has(modelId)) {
      states.set(modelId, {
        model_id: modelId,
        is_loaded: false,
        vram_used_mib: 0,
        load_time_ms: null  // Estimate unknown
      });
    }
  }

  return Array.from(states.values());
}

// NEW: Detect if provider is Arabic-optimized
function isArabicOptimized(cachedModels = [], resourceSpec = {}) {
  const arabicModelKeywords = [
    'arabic', 'allam', 'jais', 'bgem3', 'bgereranker', 'arabicqa'
  ];

  const hasArabicModel = cachedModels.some(modelId =>
    arabicModelKeywords.some(keyword => modelId.toLowerCase().includes(keyword))
  );

  const arabicTag = (resourceSpec.tags || []).some(tag =>
    tag.toLowerCase().includes('arabic')
  );

  return hasArabicModel || arabicTag;
}

// NEW: Build capability flags
function parseCapabilities(gpuStatus = {}, heartbeatData = {}, tags = []) {
  return {
    inference: true,  // All providers can do inference (for now)
    streaming: (tags || []).includes('streaming') || heartbeatData.streaming_capable !== false,
    fine_tuning: (tags || []).includes('fine-tuning'),
    batch_processing: (tags || []).includes('batch-processing'),
    arabic_optimized: isArabicOptimized(heartbeatData.cached_models || [], heartbeatData.resource_spec || {})
  };
}

// In heartbeat handler:
app.post('/api/providers/heartbeat', async (req, res) => {
  // ... existing heartbeat logic ...

  const modelStates = parseModelLoadStates(gpuStatus, req.body);
  const capabilities = parseCapabilities(gpuStatus, req.body, resourceSpec.tags);

  // Insert/update provider_model_states
  db.exec('DELETE FROM provider_model_states WHERE provider_id = ?', [provider.id]);
  for (const state of modelStates) {
    db.run(
      `INSERT INTO provider_model_states
       (provider_id, model_id, is_loaded, vram_used_mib, load_time_ms, last_updated)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [provider.id, state.model_id, state.is_loaded, state.vram_used_mib, state.load_time_ms]
    );
  }

  // Update capability flags on provider row
  db.run(
    `UPDATE providers SET
     arabic_optimized = ?,
     inference_capable = ?,
     streaming_capable = ?,
     fine_tuning_capable = ?,
     batch_processing_capable = ?,
     last_capability_update = datetime('now')
     WHERE id = ?`,
    [
      capabilities.arabic_optimized,
      capabilities.inference,
      capabilities.streaming,
      capabilities.fine_tuning,
      capabilities.batch_processing,
      provider.id
    ]
  );

  // Continue existing heartbeat response...
});
```

---

## Section 3: Backend Service — Model-Aware Provider Lookup

### 3.1 New Service: ProviderCapabilityFilter

**File**: `backend/src/services/provider-capability-filter.js`

```javascript
const db = require('../db');

class ProviderCapabilityFilter {
  /**
   * Query providers with optional filtering by model, VRAM, capability, region
   * @param {Object} query
   * @param {string[]} query.cached_models - Find providers with ANY of these models
   * @param {number} query.min_free_vram_gb - Minimum free VRAM required
   * @param {number} query.min_total_vram_gb - Minimum total VRAM
   * @param {string} query.gpu_model_prefix - GPU model substring (e.g., "RTX 4")
   * @param {boolean} query.arabic_optimized - Must be Arabic-optimized
   * @param {string[]} query.required_capabilities - ALL of these must be true
   * @param {string} query.region - Region preference ("sa", "eu", etc.)
   * @param {number} query.max_latency_ms - Max network latency (requires latency data)
   * @param {number} query.limit - Max results (default 50)
   * @returns {Array} Ranked provider list
   */
  queryProviders(query = {}) {
    const {
      cached_models = [],
      min_free_vram_gb = 0,
      min_total_vram_gb = 0,
      gpu_model_prefix = null,
      arabic_optimized = false,
      required_capabilities = [],
      region = null,
      max_latency_ms = null,
      limit = 50
    } = query;

    let sql = `
      SELECT DISTINCT p.*,
             GROUP_CONCAT(DISTINCT pms.model_id) as loaded_models
      FROM providers p
      LEFT JOIN provider_model_states pms ON p.id = pms.provider_id AND pms.is_loaded = 1
      WHERE p.status = 'online'
        AND p.is_paused = 0
    `;
    const params = [];

    // Filter by minimum VRAM
    if (min_free_vram_gb > 0) {
      sql += ` AND (p.gpu_vram_mib - COALESCE(p.gpu_util_pct * p.gpu_vram_mib / 100, 0)) / 1024 >= ?`;
      params.push(min_free_vram_gb);
    }
    if (min_total_vram_gb > 0) {
      sql += ` AND p.gpu_vram_mib / 1024 >= ?`;
      params.push(min_total_vram_gb);
    }

    // Filter by GPU model substring
    if (gpu_model_prefix) {
      sql += ` AND p.gpu_model LIKE ?`;
      params.push(`${gpu_model_prefix}%`);
    }

    // Filter by Arabic optimization
    if (arabic_optimized) {
      sql += ` AND p.arabic_optimized = 1`;
    }

    // Filter by region
    if (region) {
      sql += ` AND p.location = ?`;
      params.push(region);
    }

    // Filter by required capabilities
    for (const capability of required_capabilities) {
      const capColumn = `${capability}_capable`;
      sql += ` AND p.${capColumn} = 1`;
    }

    // Filter by cached models (provider must have at least one)
    if (cached_models.length > 0) {
      const placeholders = cached_models.map(() => '?').join(',');
      sql += ` AND EXISTS (
        SELECT 1 FROM provider_cache_catalog pcc
        WHERE pcc.provider_id = p.id AND pcc.model_id IN (${placeholders})
      )`;
      params.push(...cached_models);
    }

    sql += ` GROUP BY p.id ORDER BY p.reliability_score DESC, p.last_heartbeat DESC LIMIT ?`;
    params.push(limit);

    const rows = db.all(sql, params);
    return rows || [];
  }

  /**
   * Score providers for a specific inference request
   * Applies multi-criteria ranking: model cache hit + latency + VRAM
   */
  scoreProviders(providers = [], request = {}) {
    const {
      model_id = null,
      required_vram_gb = 0,
      max_latency_ms = 500
    } = request;

    return providers.map(provider => {
      let score = 0;

      // 1. Model cache hit (40%)
      const modelLoaded = provider.loaded_models?.split(',').includes(model_id);
      const modelCacheScore = modelLoaded ? 1.0 : 0.0;
      score += 0.40 * modelCacheScore;

      // 2. Latency (35%) — requires measured latency
      const latencyMs = provider.measured_latency_ms || 200;  // Default if not measured
      const maxLatency = max_latency_ms || 500;
      const latencyScore = Math.max(0, 1 - (latencyMs / maxLatency));
      score += 0.35 * latencyScore;

      // 3. VRAM capacity (25%)
      const freeVramGb = (provider.gpu_vram_mib - provider.gpu_util_pct * provider.gpu_vram_mib / 100) / 1024;
      const vramScore = Math.min(1.0, freeVramGb / Math.max(1, required_vram_gb));
      score += 0.25 * vramScore;

      return {
        provider,
        score,
        breakdown: {
          model_cache_hit: modelCacheScore,
          latency_score: latencyScore,
          vram_score: vramScore
        }
      };
    });
  }

  /**
   * Get model metadata (VRAM required, compute capability, etc.)
   * Used for routing decisions
   */
  getModelMetadata(model_id) {
    // In Phase 27, this is a hardcoded mapping
    // In Phase 28, this could be queried from a models database
    const modelCatalog = {
      'llama3-8b': {
        vram_required_gb: 14,
        compute_capability_min: 7.0,
        cuda_version_min: '11.8',
        streaming_capable: true
      },
      'mistral-7b': {
        vram_required_gb: 12,
        compute_capability_min: 7.0,
        cuda_version_min: '11.8',
        streaming_capable: true
      },
      'allam-7b': {
        vram_required_gb: 14,
        compute_capability_min: 7.0,
        cuda_version_min: '11.8',
        streaming_capable: true,
        arabic_optimized: true
      },
      'arabic-embeddings-bgem3': {
        vram_required_gb: 2,
        compute_capability_min: 6.1,
        cuda_version_min: '10.2',
        streaming_capable: false,
        arabic_optimized: true
      },
      'arabic-reranker': {
        vram_required_gb: 2,
        compute_capability_min: 6.1,
        cuda_version_min: '10.2',
        streaming_capable: false,
        arabic_optimized: true
      },
      'qwen-2.5-7b': {
        vram_required_gb: 12,
        compute_capability_min: 7.0,
        cuda_version_min: '11.8',
        streaming_capable: true
      },
      'sdxl': {
        vram_required_gb: 20,
        compute_capability_min: 7.0,
        cuda_version_min: '11.8',
        streaming_capable: false
      }
    };
    return modelCatalog[model_id] || null;
  }
}

module.exports = ProviderCapabilityFilter;
```

---

## Section 4: API Endpoints

### 4.1 New Route: Provider Search

**File**: `backend/src/routes/providers.js` (add new endpoint)

```javascript
const ProviderCapabilityFilter = require('../services/provider-capability-filter');
const filter = new ProviderCapabilityFilter();

/**
 * GET /api/providers/search
 * Query providers with capability filtering
 *
 * Query params:
 *   - cached_models=llama3-8b,mistral-7b (comma-separated)
 *   - min_free_vram_gb=12
 *   - min_total_vram_gb=16
 *   - gpu_model_prefix=RTX
 *   - arabic_optimized=true
 *   - capabilities=streaming,inference (comma-separated, all required)
 *   - region=sa
 *   - limit=50
 *
 * Example:
 *   GET /api/providers/search?cached_models=llama3-8b&min_free_vram_gb=12&region=sa
 *
 * Response:
 *   {
 *     "total": 15,
 *     "providers": [
 *       {
 *         "id": "provider-123",
 *         "gpu_model": "RTX 4090",
 *         "vram_gb": 24,
 *         "free_vram_gb": 12.5,
 *         "cached_models": ["llama3-8b", "mistral-7b"],
 *         "capabilities": {
 *           "inference": true,
 *           "streaming": true,
 *           "arabic_optimized": false
 *         },
 *         "reliability_score": 95,
 *         "location": "sa"
 *       },
 *       ...
 *     ]
 *   }
 */
app.get('/api/providers/search', (req, res) => {
  try {
    const cachedModels = (req.query.cached_models || '')
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);

    const capabilities = (req.query.capabilities || '')
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    const results = filter.queryProviders({
      cached_models: cachedModels,
      min_free_vram_gb: Number(req.query.min_free_vram_gb) || 0,
      min_total_vram_gb: Number(req.query.min_total_vram_gb) || 0,
      gpu_model_prefix: req.query.gpu_model_prefix,
      arabic_optimized: req.query.arabic_optimized === 'true',
      required_capabilities: capabilities,
      region: req.query.region,
      limit: Number(req.query.limit) || 50
    });

    const providers = results.map(row => ({
      id: row.id,
      peer_id: row.p2p_peer_id,
      name: row.name,
      gpu_model: row.gpu_model,
      vram_gb: Math.round(row.gpu_vram_mib / 1024),
      free_vram_gb: Math.round((row.gpu_vram_mib - row.gpu_util_pct * row.gpu_vram_mib / 100) / 1024),
      cached_models: (row.cached_models || '').split(',').filter(Boolean),
      capabilities: {
        inference: row.inference_capable,
        streaming: row.streaming_capable,
        fine_tuning: row.fine_tuning_capable,
        batch_processing: row.batch_processing_capable,
        arabic_optimized: row.arabic_optimized
      },
      reliability_score: row.reliability_score,
      location: row.location,
      is_live: row.status === 'online'
    }));

    return res.json({
      total: providers.length,
      query: req.query,
      providers
    });
  } catch (error) {
    console.error('[providers/search] error:', error.message);
    return res.status(500).json({ error: 'Provider search failed' });
  }
});

/**
 * GET /api/providers/search/:model_id
 * Find providers capable of running a specific model
 *
 * Example:
 *   GET /api/providers/search/llama3-8b?region=sa&strategy=distributed
 *
 * Query params:
 *   - region=sa
 *   - strategy=distributed|colocated|any
 *   - limit=10
 *
 * Response:
 *   {
 *     "model_id": "llama3-8b",
 *     "metadata": {
 *       "vram_required_gb": 14,
 *       "compute_capability_min": 7.0
 *     },
 *     "candidates": [
 *       {
 *         "provider_id": "provider-123",
 *         "score": 0.92,
 *         "reason": "Model pre-cached, low latency"
 *       }
 *     ]
 *   }
 */
app.get('/api/providers/search/:model_id', (req, res) => {
  try {
    const { model_id } = req.params;
    const metadata = filter.getModelMetadata(model_id);

    if (!metadata) {
      return res.status(404).json({ error: `Model ${model_id} not found` });
    }

    const candidates = filter.queryProviders({
      cached_models: [model_id],
      min_free_vram_gb: metadata.vram_required_gb,
      region: req.query.region || null,
      limit: Number(req.query.limit) || 10
    });

    const scored = filter.scoreProviders(candidates, {
      model_id,
      required_vram_gb: metadata.vram_required_gb
    });

    return res.json({
      model_id,
      metadata,
      candidates: scored
        .filter(item => item.score > 0.6)  // Only return high-quality matches
        .map(item => ({
          provider_id: item.provider.id,
          score: Math.round(item.score * 100) / 100,
          breakdown: item.breakdown
        }))
    });
  } catch (error) {
    console.error('[providers/search/:model_id] error:', error.message);
    return res.status(500).json({ error: 'Model search failed' });
  }
});
```

---

## Section 5: Integration with Inference Routing

### 5.1 Job Submission with Model-Aware Routing

**File**: `backend/src/routes/jobs.js` (modify `POST /api/jobs/submit`)

```javascript
const ProviderCapabilityFilter = require('../services/provider-capability-filter');
const InferenceRouter = require('../services/inference-router');  // TODO: Implement

app.post('/api/jobs/submit', async (req, res) => {
  // ... existing validation ...

  const {
    model_id,
    prompt,
    input_format,
    // ... other job fields
  } = req.body;

  // Use capability filter to find suitable providers
  const filter = new ProviderCapabilityFilter();
  const modelMetadata = filter.getModelMetadata(model_id);

  if (!modelMetadata) {
    return res.status(400).json({ error: `Model ${model_id} not supported` });
  }

  // Query for providers with this model
  const candidates = filter.queryProviders({
    cached_models: [model_id],
    min_free_vram_gb: modelMetadata.vram_required_gb,
    region: renter.preferred_region || 'sa'
  });

  if (candidates.length === 0) {
    return res.status(503).json({
      error: 'No suitable providers available',
      required: {
        model: model_id,
        vram_gb: modelMetadata.vram_required_gb
      }
    });
  }

  // Score candidates and select best
  const scored = filter.scoreProviders(candidates, {
    model_id,
    required_vram_gb: modelMetadata.vram_required_gb
  });

  const selected = scored
    .filter(item => item.score > 0.6)
    .sort((a, b) => b.score - a.score)[0];

  if (!selected) {
    return res.status(503).json({ error: 'No qualified providers found' });
  }

  // Create job assigned to selected provider
  const job = db.run(
    `INSERT INTO jobs (...) VALUES (...)`,
    [selected.provider.id, model_id, /* ... */]
  );

  // ... existing job response ...
});
```

---

## Section 6: Migration & Rollout

### Phase 27.1 (This heartbeat)
- [ ] Create `provider_model_states` and `provider_cache_catalog` tables
- [ ] Add capability columns to `providers` table
- [ ] Implement `ProviderCapabilityFilter` service
- [ ] Add `GET /api/providers/search` endpoint
- [ ] Extend heartbeat handler to parse model load states

### Phase 27.2 (Next heartbeat)
- [ ] Deploy to VPS
- [ ] Test capability filtering with live providers
- [ ] Verify Arabic model detection
- [ ] Integrate with job submission

### Phase 28 (Future)
- [ ] Extend to P2P DHT announcements
- [ ] Add latency measurement
- [ ] Support distributed Arabic RAG routing

---

## Appendix A: SQL Schema Changes

```sql
-- Add columns to providers table
ALTER TABLE providers ADD COLUMN (
  arabic_optimized BOOLEAN DEFAULT 0,
  inference_capable BOOLEAN DEFAULT 1,
  fine_tuning_capable BOOLEAN DEFAULT 0,
  batch_processing_capable BOOLEAN DEFAULT 0,
  streaming_capable BOOLEAN DEFAULT 1,
  last_capability_update DATETIME
);

-- Create model load state tracking
CREATE TABLE provider_model_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  is_loaded BOOLEAN NOT NULL,
  vram_used_mib INTEGER,
  load_time_ms INTEGER,
  last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, model_id)
);

-- Create denormalized cache catalog for fast queries
CREATE TABLE provider_cache_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  model_family TEXT,
  is_loaded BOOLEAN NOT NULL,
  vram_used_mib INTEGER,
  load_time_ms INTEGER,
  last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, model_id)
);

CREATE INDEX idx_provider_cache_model ON provider_cache_catalog(model_id);
CREATE INDEX idx_provider_arabic ON providers(arabic_optimized);
CREATE INDEX idx_provider_capabilities ON providers(inference_capable, streaming_capable);
```

---

## Success Criteria

- [ ] `GET /api/providers/search?cached_models=llama3-8b&min_free_vram_gb=12` returns filtered list
- [ ] Model metadata correctly identifies VRAM requirements
- [ ] Arabic optimization flag set for providers with Arabic models
- [ ] Scoring places model pre-cached providers at top (40% weight)
- [ ] Job submission routes to highest-scoring provider
- [ ] No performance regression (queries complete in <100 ms)

---

*Document version: 1.0*
*Last updated: 2026-03-23*
