# Template Catalog Contract API

Canonical renter-facing template catalog contract sourced from `docker-templates/`.

## Endpoint

`GET /api/templates/catalog`

## Auth

No authentication required.

## Contract

Response includes only stable fields needed by renter marketplace deploy rails:

```json
{
  "contract": "dcp.template_catalog.v1",
  "version": "2026-04-02",
  "templates": [
    {
      "id": "llama3-8b",
      "model_name": "meta-llama/Meta-Llama-3-8B-Instruct",
      "min_vram_gb": 16,
      "tier_hint": {
        "tier": "cached",
        "notes": "Cached tier — HuggingFace weights pulled on first run and kept hot on provider disk."
      },
      "deploy_defaults": {
        "duration_minutes": 60,
        "pricing_class": "standard",
        "job_type": "llm-inference",
        "params": {
          "model": "meta-llama/Meta-Llama-3-8B-Instruct",
          "max_tokens": 512
        }
      }
    }
  ],
  "count": 1
}
```

Ordering is deterministic: `sort_order` ascending, then `id` ascending.

## Validation Rules

Every template JSON file must parse and include:

- `id` (non-empty string)
- `name` (non-empty string)
- `job_type` (non-empty string)
- `min_vram_gb` (positive number)
- `params` (object)
- model derivation source (`params.model` or `env_vars.MODEL_ID.default`)

If any file fails validation, the endpoint fails closed with `500` and explicit per-file errors.

## Error Shape

```json
{
  "error": "Template catalog contract validation failed",
  "contract": "dcp.template_catalog.v1",
  "details": [
    "broken-template.json: missing or invalid numeric field \"min_vram_gb\""
  ]
}
```
