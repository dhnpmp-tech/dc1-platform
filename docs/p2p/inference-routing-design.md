# P2P Inference-Optimized Routing Design

**Date**: 2026-03-23
**Sprint**: 27
**Status**: Design Document (Implementation pending Phase 1 bootstrap)
**Author**: P2P Network Engineer

---

## Executive Summary

This document specifies routing optimization for model inference workloads in DCP's P2P network. Unlike traditional file-transfer P2P networks, inference workloads have distinct latency and throughput requirements:

- **First-token latency**: Must be < 500 ms (end-to-end: renter → provider → first token)
- **Streaming throughput**: 20-50 tokens/second (continuous data flow during generation)
- **Model affinity**: Pre-cached models reduce cold-start latency by 5-10 seconds

Current centralized routing (heartbeat-based provider selection) cannot optimize for these factors. This design proposes **capability-aware routing** that routes requests to providers matching the inference workload profile.

---

## Section 1: Current Routing Model (Baseline)

### 1.1 Centralized Pull Model

```
Renter                 DCP API (VPS)            Provider
  │                        │                        │
  ├─ Submit job ──────────>│                        │
  │                        │                        │
  │                        ├─ Query available ─────>│
  │                        │  (cached list)         │
  │                        │                        │
  │ (poll every 30s) <─────┤ Assign to provider    │
  │                        │                        │
  │                        ├─ Poll for jobs ───────>│
  │                        │                        │
  │ (poll every 30s) <─────┤ Job ready               │
  │ ← Download result      │                        │
```

**Latency breakdown** (from job submit to first token):
- Renter → VPS: 20–150 ms
- VPS processes: 5 ms
- Daemon polling cycle: 0–30 s (dominant)
- VPS → Daemon: 20–150 ms
- **Total worst case: ~30 s**

**Provider selection factors**:
- GPU availability (binary: free or not)
- Reputation score (historical uptime)
- Status (online, degraded, offline)
- Region (location hint)

**Missing factors**:
- Model pre-caching status
- Network latency to renter (ping)
- Sustained throughput capacity (vs burst)
- Inference-specific GPU state (vRAM utilization, temperature)
- Model-specific requirements (VRAM needed, compute capability)

### 1.2 Latency Bottleneck

The 30-second daemon polling window is fundamental to the centralized model. It cannot be eliminated without:
1. Push-based job notification (GossipSub or direct connection), or
2. Real-time job-dispatch through P2P

---

## Section 2: Inference-Optimized Routing Architecture

### 2.1 Core Design: Multi-Criteria Provider Selection

Instead of simple availability checks, the routing engine evaluates providers against **three primary criteria**:

| Criterion | Weight | Rationale | Measurement |
|-----------|--------|-----------|-------------|
| **Model pre-cache hit** | 40% | Eliminates 5-10s model load time | Provider advertises cached models (via DHT or heartbeat) |
| **Network latency** | 35% | Reduces renter-to-first-token time | ICMP ping or TCP handshake latency |
| **GPU capacity** | 25% | Avoids throttling during streaming | Free VRAM + GPU utilization % |

**Selection formula**:
```
score = (
  0.40 * model_cache_hit_pct +
  0.35 * (1 - (latency_ms / max_latency_ms)) +
  0.25 * (free_vram_gb / required_vram_gb)
)
```

Score range: **0–1**. Select providers with score > 0.6; if none, fall back to any online provider.

### 2.2 Model Cache Hit Detection

Providers currently advertise `cached_models` as a simple list of model identifiers (e.g., `["llama3-8b", "mistral-7b"]`). This is sufficient for Phase 27.

**Provider heartbeat enhancement** (small change):
```json
{
  "api_key": "dc1-provider-...",
  "gpu_status": {
    "gpu_name": "RTX 4090",
    "gpu_vram_mib": 24576,
    "free_vram_mib": 18000,  // NEW: Current free VRAM
    "temp_c": 65,
    "power_w": 320
  },
  "cached_models": [           // EXISTING
    "llama3-8b",
    "mistral-7b",
    "arabic-embeddings-bgem3"
  ],
  "model_load_states": {       // NEW: Model-specific state
    "llama3-8b": {
      "loaded": true,
      "vram_used_mib": 6400,
      "load_time_ms": 0         // Time to load; 0 if already in memory
    },
    "mistral-7b": {
      "loaded": false,
      "vram_used_mib": 0,
      "load_time_ms": 8200
    }
  }
}
```

**Routing decision**:
- If `model_load_states[requested_model].loaded == true` and `free_vram_mib >= required_vram_mib`: **score += 40%**
- Else if `model_load_states[requested_model].load_time_ms` is known: subtract that from latency budget

### 2.3 Network Latency Measurement

**Approach**: Measure TCP handshake latency to the provider's advertised address.

```javascript
async function measureProviderLatency(providerMultiaddr, timeoutMs = 2000) {
  const start = Date.now();
  try {
    // Attempt TCP connection to provider's advertised address
    const socket = net.createConnection({
      host: providerMultiaddr.host,
      port: providerMultiaddr.port,
      timeout: timeoutMs
    });
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', reject);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('timeout'));
      });
    });
    return Date.now() - start;
  } catch (error) {
    return null;  // Unreachable or timeout
  }
}
```

**Caching**: Measure latency once per heartbeat cycle (every 30 s). Cache result for 30 s to avoid spamming probes.

**Fallback**: If latency cannot be measured (provider behind NAT), use a default penalty (e.g., +100 ms).

### 2.4 GPU Capacity (VRAM + Utilization)

The routing engine requests a specific model and VRAM requirement:
```javascript
selectProvider({
  model_id: "llama3-8b",
  required_vram_gb: 12,  // LLM weight + KV cache
  preferred_region: "sa"
})
```

Provider selection filters:
1. **VRAM check**: `free_vram_mib >= required_vram_gb * 1024`
2. **Thermal check**: Reject if `gpu_temp_c > 80` (avoiding thermal throttling)
3. **Utilization check**: Score down if `gpu_util_pct > 90` (concurrent inference load)

---

## Section 3: Provider Discovery — Model Capability Filtering

### 3.1 Current State

Providers advertise:
- `gpu_model` (string, e.g., "RTX 4090")
- `gpu_vram_mib` (number)
- `cached_models` (list of model IDs)
- `reliability_score` (0–100)
- `location` (region hint)

**Missing**: Explicit model capability metadata for filtering.

### 3.2 Extended Provider Advertisement Schema

When providers announce capabilities to the DHT (via P2P-discovery GossipSub), they should include:

```json
{
  "provider_id": "provider-123",
  "peer_id": "12D3KooXXXX",
  "announced_at": "2026-03-23T15:30:00Z",
  "gpu": {
    "model": "RTX 4090",
    "vram_gb": 24,
    "compute_capability": "8.9",
    "cuda_version": "12.4",
    "driver_version": "550.120",
    "count": 2
  },
  "cached_models": {
    "llama3-8b": {
      "status": "loaded",
      "vram_used_gb": 6.4
    },
    "mistral-7b": {
      "status": "loaded",
      "vram_used_gb": 5.8
    },
    "arabic-embeddings-bgem3": {
      "status": "not_loaded",
      "estimated_vram_gb": 1.2
    }
  },
  "capabilities": {
    "inference": true,
    "fine_tuning": false,
    "batch_processing": true,
    "streaming": true,
    "arabic_optimized": true    // NEW
  },
  "location": "sa",
  "pricing": {
    "sar_per_hour": 15.50
  }
}
```

**Renter query examples**:
```javascript
// Find providers with ALLaM 7B pre-cached and RTX 4090
findProviders({
  gpu_model: "RTX 4090",
  cached_models: ["allam-7b"],
  min_vram_gb: 16,
  required_capabilities: ["inference", "streaming"]
})

// Find Arabic-optimized providers with embedding capability
findProviders({
  arabic_optimized: true,
  cached_models: ["arabic-embeddings-bgem3"],
  min_vram_gb: 8
})

// Find any provider with 24+ GB VRAM
findProviders({
  min_vram_gb: 24
})
```

### 3.3 DHT Schema Extension

When DHT records are announced via `dht.provide(CID)`, the CID should encode the **provider capability profile**:

```javascript
const CID = hash(JSON.stringify({
  gpu_model: "RTX 4090",
  vram_gb: 24,
  cached_models: ["llama3-8b", "mistral-7b", "arabic-embeddings-bgem3"],
  capabilities: {
    inference: true,
    arabic_optimized: true
  }
}))
```

Renters can then query:
```javascript
// Find all providers with this capability signature
const providers = await dht.findProviders(CID)

// Or query the DHT for providers matching a predicate
const providers = await queryDHT({
  gpu_model_prefix: "RTX 4",
  min_vram_gb: 16,
  required_capabilities: ["inference"]
})
```

---

## Section 4: Arabic RAG Multi-Model Routing

### 4.1 Workload Profile

An Arabic RAG pipeline requires **three models running simultaneously**:
1. **Embedding Model**: Arabic text → embeddings (e.g., BGE-M3, 300 MB, ~1 GB VRAM)
2. **Reranker Model**: Score candidate documents (e.g., BGE-reranker, 400 MB, ~1 GB VRAM)
3. **LLM**: Generate final answer (e.g., ALLaM 7B, 14 GB VRAM)

**Total VRAM requirement**: ~16 GB

### 4.2 Deployment Topology Options

#### Option A: Co-Located (Same Provider)
```
Renter
  │
  ├─> Provider A (24 GB VRAM)
       ├─ BGE-M3 embeddings (1 GB)
       ├─ BGE-reranker (1 GB)
       ├─ ALLaM 7B LLM (14 GB)
       └─ Free: 8 GB
```

**Advantages**:
- Minimum network latency between stages
- No cross-provider data serialization
- Atomic failure domain (if provider goes down, whole pipeline fails)
- Simpler to orchestrate

**Disadvantages**:
- Requires single provider with ≥16 GB VRAM
- Provider selection becomes bottleneck (fewer candidates)
- VRAM overhead (may not use all 24 GB, but locked to single provider)

#### Option B: Distributed (Different Providers)
```
Renter
  │
  ├─> Provider A (8 GB VRAM) — BGE-M3 embeddings
  │      │ (embeddings output, ~200 KB per query)
  │
  ├─> Provider B (8 GB VRAM) — BGE-reranker
  │      │ (reranked scores, ~10 KB per document)
  │
  └─> Provider C (16 GB VRAM) — ALLaM 7B LLM
         │ (final answer output)
```

**Advantages**:
- Many more provider candidates (3 smaller providers vs 1 large)
- Better VRAM utilization (no locked unused capacity)
- Fault tolerance: if one provider fails, can retry with another
- Load balancing: distribute stages across network

**Disadvantages**:
- Network latency between stages (2× cross-provider round trips)
- Data serialization overhead (embeddings → reranker → LLM)
- Orchestration complexity (track 3 concurrent requests)
- Potential timeout risk if one stage is slow

### 4.3 Latency Comparison

**Scenario**: Query 1000 documents, return top 5 to LLM.

**Co-Located (Option A)**:
- Embedding: 1000 docs × 50 ms/doc = 50 s
- Reranking: 1000 docs × 10 ms/doc = 10 s (parallel with embedding)
- LLM: 5 docs × 200 ms = 1 s
- Network: 1× renter-to-provider = 100 ms
- **Total: ~60 s** (assuming pipeline stages can overlap)

**Distributed (Option B)**:
- Embedding: 1000 docs × 50 ms/doc = 50 s
- Network (embeddings → reranker): 100 ms
- Reranking: 1000 docs × 10 ms/doc = 10 s
- Network (reranker → LLM): 100 ms
- LLM: 5 docs × 200 ms = 1 s
- Network (LLM → renter): 100 ms
- **Total: ~60 s + 300 ms = ~60.3 s**

**Conclusion**: For large batch operations (1000+ docs), the network latency is **negligible** compared to compute time. Distributed routing is **recommended**.

### 4.4 Recommendation: Hybrid Routing

**Tier 1** (Prefer distributed):
- If 3 providers with ≥8 GB VRAM each are available in preferred region: distribute stages
- Reduces VRAM pressure; more provider candidates

**Tier 2** (Fall back to co-located):
- If no distributed option found: select single provider with ≥16 GB VRAM
- Guarantees execution; slightly faster for small queries

**Selection logic**:
```javascript
async function routeArabicRag(query) {
  // Try distributed first
  const embedProvider = selectProvider({
    model: "arabic-embeddings-bgem3",
    min_vram_gb: 2,
    region: "sa"
  })
  const rerankerProvider = selectProvider({
    model: "arabic-reranker",
    min_vram_gb: 2,
    region: "sa",
    exclude: [embedProvider.id]  // Different provider
  })
  const llmProvider = selectProvider({
    model: "allam-7b",
    min_vram_gb: 14,
    region: "sa",
    exclude: [embedProvider.id, rerankerProvider.id]
  })

  if (embedProvider && rerankerProvider && llmProvider) {
    // Execute distributed pipeline
    return executeDistributedRag(query, {
      embedProvider,
      rerankerProvider,
      llmProvider
    })
  }

  // Fall back to co-located
  const colocProvider = selectProvider({
    models: ["arabic-embeddings-bgem3", "arabic-reranker", "allam-7b"],
    min_vram_gb: 16,
    region: "sa"
  })
  if (colocProvider) {
    return executeColocatedRag(query, { provider: colocProvider })
  }

  // No suitable provider found
  throw new Error('No provider available for Arabic RAG')
}
```

---

## Section 5: Implementation Roadmap

### Phase 27 (Current Sprint)

**Deliverables**:
1. ✅ This design document (inference-routing-design.md)
2. **Provider capability metadata extension** — Update provider heartbeat schema + DHT announcements
3. **Routing engine prototype** — `backend/src/services/inference-router.js`
   - Multi-criteria provider selection (model cache + latency + VRAM)
   - Model capability filtering API
   - Arabic RAG routing logic (distributed vs co-located)
4. **Backend API endpoints** — Wire into job submission
   - `POST /api/jobs/submit` → uses inference router
   - `GET /api/providers/search?model=llama3-8b&min_vram_gb=12` → model-aware discovery
5. **Smoke test** — Once DCP-612 bootstrap completes, verify:
   - Provider discovery includes model metadata
   - Routing engine correctly ranks providers
   - Arabic RAG requests route to qualified providers

### Phase 28+ (Future)

- P2P push-based job notification (eliminate 30 s polling window)
- Real-time provider telemetry via GossipSub (latency + GPU state)
- Distributed job execution (cross-provider data flow)

---

## Section 6: Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Provider metadata staleness | High | Routing selects offline providers | Verify provider is online before routing; track last-heartbeat age |
| Network latency fluctuation | Medium | High-latency provider selected | Measure latency every 30 s; prefer providers with <200 ms ping |
| VRAM estimation error | Medium | Route to provider that can't fit model | Add 10% safety margin; require `free_vram_mib >= required_vram_gb * 1100` |
| Arabic RAG distributed timeout | Low | One stage slow, whole pipeline slow | Set per-stage timeout (e.g., 60 s); fall back to co-located if distributed fails |
| Model load state stale | High | Route to provider with unloaded model | Model load states are estimates; verify in provider heartbeat every 30 s |

---

## Section 7: Success Criteria

- [ ] Provider metadata schema extended (GPU, cached models, capabilities)
- [ ] Routing engine selects providers with model cache hit within 40% accuracy
- [ ] Network latency measurement working (median <20 ms overhead per selection)
- [ ] Arabic RAG queries route correctly (60%+ hit rate on first attempt)
- [ ] Bootstrap health validated (provider announcements flowing through P2P DHT)
- [ ] Performance: Provider selection < 100 ms (sub-heartbeat)

---

## Appendix A: Related Files

- `backend/src/routes/providers.js` — Provider API (registration, heartbeat, available)
- `backend/src/services/p2p-discovery.js` — DHT lookups, capability resolution
- `backend/src/routes/p2p.js` — P2P API endpoints
- `backend/src/routes/jobs.js` — Job submission (integrate with routing engine)
- `docs/p2p-architecture.md` — Phase A-D P2P roadmap
- `infra/config/arabic-portfolio.json` — Arabic model portfolio (models to route for)

---

## Appendix B: Model VRAM Requirements (Reference)

| Model | Family | Size | Approx VRAM (GB) | Example Use |
|-------|--------|------|------------------|-------------|
| Nemotron-Nano-4B | Nemotron | 4B | 6–8 | Lightweight inference |
| ALLaM 7B | ALLaM | 7B | 12–14 | Arabic LLM |
| Falcon H1 7B | Falcon | 7B | 12–14 | Multilingual |
| Qwen 2.5 7B | Qwen | 7B | 12–14 | Arabic-friendly |
| Llama 3 8B | Llama | 8B | 14–16 | Base LLM |
| Mistral 7B | Mistral | 7B | 12–14 | Efficient LLM |
| BGE-M3 (embeddings) | BGE | embeddings | 1–2 | Arabic embeddings |
| BGE-reranker | BGE | reranker | 1–2 | Cross-encoder ranking |
| JAIS 13B | JAIS | 13B | 24–28 | Large Arabic LLM |
| SDXL (image) | Stable Diffusion | image | 16–24 | Image generation |

---

*Document version: 1.0*
*Last updated: 2026-03-23*
