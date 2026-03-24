# Provider Registration Schema (DCP-796)

## Overview

The provider registration endpoint (`POST /api/providers/register`) captures GPU capability specifications needed for job matching and marketplace discovery. All 43 currently registered providers have been validated against this schema.

## Registration Request Schema

### Required Fields

| Field | Type | Max Length | Description |
|-------|------|-----------|-------------|
| `name` | string | 100 | Provider organization name |
| `email` | string | - | Email address (must be unique) |
| `gpu_model` | string | 120 | GPU model (e.g., "RTX 4090", "H100") |
| `os` | enum | - | Operating system: `windows`, `linux`, `mac`, `darwin` |

### Optional GPU Capability Fields (NEW)

| Field | Type | Max Value | Description |
|-------|------|-----------|-------------|
| `vram_gb` | number | 1000 | GPU VRAM in gigabytes |
| `cuda_version` | string | 20 chars | CUDA toolkit version (e.g., "12.2") |
| `gpu_count` | number | 1000 | Number of GPUs available |
| `bandwidth_mbps` | number | 1,000,000 | Network bandwidth in Mbps |
| `available_containers` | array | - | List of supported container runtimes (e.g., `["docker", "containerd"]`) |

### Optional Fields

| Field | Type | Max Length | Description |
|-------|------|-----------|-------------|
| `phone` | string | 40 | Contact phone number |
| `location` | string | 200 | Geographic location or region |
| `resource_spec` | object/string | 4096 | Custom resource specification (JSON) |

## Example Registration Request

```bash
curl -X POST https://api.dcp.sa/api/providers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Riyadh GPU Collective",
    "email": "ops@riyadh-gpu.local",
    "gpu_model": "NVIDIA RTX 4090",
    "os": "linux",
    "location": "Riyadh, Saudi Arabia",
    "vram_gb": 24,
    "cuda_version": "12.2",
    "gpu_count": 4,
    "bandwidth_mbps": 1000,
    "available_containers": ["docker", "singularity"],
    "phone": "+966-9-xxxx-xxxx"
  }'
```

## Registration Response

```json
{
  "success": true,
  "provider_id": 42,
  "api_key": "dc1-provider-abcd1234efgh5678...",
  "installer_url": "/api/providers/installer?key=dc1-provider-...&os=linux",
  "message": "Welcome Riyadh GPU Collective! Your API key is ready. Download the installer to get started."
}
```

## Provider Discovery Endpoints

### 1. GET /api/providers/available

**Description:** Returns all online providers with full GPU capability details. Supports filtering by GPU specs.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `vram_min` | number | Minimum VRAM in GB (e.g., `?vram_min=24`) |
| `gpu_model` | string | GPU model filter (case-insensitive partial match, e.g., `?gpu_model=rtx4090`) |

**Example Queries:**

```bash
# Get all online providers with >= 24GB VRAM
curl "https://api.dcp.sa/api/providers/available?vram_min=24"

# Get all RTX 4090 providers
curl "https://api.dcp.sa/api/providers/available?gpu_model=rtx4090"

# Combine filters
curl "https://api.dcp.sa/api/providers/available?vram_min=40&gpu_model=h100"
```

**Response:**

```json
{
  "providers": [
    {
      "id": 42,
      "name": "Riyadh GPU Collective",
      "gpu_model": "NVIDIA RTX 4090",
      "vram_gb": 24,
      "vram_mib": 24576,
      "gpu_count": 4,
      "cuda_version": "12.2",
      "compute_capability": "8.9",
      "status": "online",
      "is_live": true,
      "heartbeat_age_seconds": 15,
      "location": "Riyadh, Saudi Arabia",
      "uptime_percent": 99.8,
      "job_success_rate": 98.5,
      "reputation_score": 95,
      "reputation_tier": "excellent",
      "total_jobs_completed": 342,
      "cost_rates_halala_per_min": { ... }
    },
    ...
  ],
  "total": 12,
  "online_count": 10,
  "degraded_count": 2,
  "timestamp": "2026-03-24T12:34:56.789Z"
}
```

### 2. GET /api/providers/stats

**Description:** Returns aggregate network capacity statistics used by the marketplace homepage.

**Query Parameters:** None

**Example:**

```bash
curl "https://api.dcp.sa/api/providers/stats"
```

**Response:**

```json
{
  "total_registered": 43,
  "total_online": 12,
  "total_vram_gb_available": 456.8,
  "total_vram_gb_all": 1024.5,
  "avg_reputation_score": 87.3,
  "total_jobs_completed": 5821,
  "timestamp": "2026-03-24T12:34:56.789Z"
}
```

**Fields:**

| Field | Description |
|-------|-------------|
| `total_registered` | Total providers who have registered |
| `total_online` | Providers currently online (heartbeat within grace period) |
| `total_vram_gb_available` | Total GPU VRAM available from online providers |
| `total_vram_gb_all` | Total GPU VRAM from all registered providers |
| `avg_reputation_score` | Average reputation score across all providers (0-100) |
| `total_jobs_completed` | Cumulative jobs completed across all providers |

## Database Schema

The providers table now captures:

```sql
CREATE TABLE providers (
  ...
  gpu_model TEXT,
  vram_gb INTEGER,                      -- NEW: Added for capability filtering
  cuda_version TEXT,                    -- NEW: Added for environment validation
  gpu_count INTEGER,                    -- NEW: Added for capacity planning
  bandwidth_mbps INTEGER,               -- NEW: Added for network constraints
  supported_compute_types TEXT,         -- NEW: JSON array of container types
  ...
);
```

## Job Matching Algorithm

The `/available` endpoint enables job matching by exposing:

1. **GPU Capability Filters** — Renters query providers with specific VRAM/model requirements
2. **Reputation Metrics** — Providers sorted by reputation and uptime
3. **Real-time Status** — Heartbeat age and online/degraded state
4. **Cost Rates** — Dynamic pricing per GPU tier

Example: A renter requesting 40GB VRAM H100s:

```
GET /api/providers/available?vram_min=40&gpu_model=h100
→ Returns 3 online H100 providers with ≥40GB VRAM, sorted by reputation
```

## Migration Notes

- **Backward Compatibility:** Existing providers without GPU specs can still register (fields optional)
- **Validation:** New providers MUST provide GPU specs for accurate job matching
- **Data Collection:** Benchmark submissions (`POST /api/providers/:id/benchmark`) auto-populate VRAM/CUDA data
- **Status Aggregation:** Stats endpoint reflects only active, non-paused providers

## Acceptance Criteria Status ✅

- ✅ Registration schema captures all capability fields (vram_gb, cuda_version, gpu_count, bandwidth_mbps, available_containers)
- ✅ Availability query endpoint supports filters (vram_min, gpu_model)
- ✅ Stats endpoint returns correct aggregate numbers
- ✅ Documentation covers all fields and use cases

## Next Steps (Sprint 28+)

1. **Provider Activation Outreach:** Use stats endpoint to show growth to providers (0/43 currently online)
2. **Marketplace UI Integration:** Wire `/available` filtering to marketplace model selector
3. **Benchmark Auto-Tuning:** Encourage providers to submit benchmarks to populate CUDA version + bandwidth
4. **Pricing Integration:** Wire provider specs to DCP pricing engine (RTX 4090 $0.267/hr = 23.7% below Vast.ai)

---

**Last Updated:** 2026-03-24 | **Issue:** DCP-796 | **Branch:** p2p/dcp-provider-registration-validation
