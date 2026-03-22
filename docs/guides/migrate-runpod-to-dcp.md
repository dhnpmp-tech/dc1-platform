# Migrate from RunPod to DCP

This guide helps teams move from RunPod workflows to DCP's API-first marketplace model.

DCP execution model: jobs run in GPU-accelerated Docker containers managed by provider daemons (not bare-metal tenancy).

## Why teams choose DCP

- Saudi-hosted GPU supply with structural energy-cost advantage.
- Arabic AI model portfolio support (for example ALLaM, Falcon, JAIS lanes in DCP docs/model catalog).
- API-first renter flow for job submit, status, logs, and output retrieval.

## Concept mapping: RunPod -> DCP

| RunPod concept | DCP equivalent | Notes |
|---|---|---|
| API key / bearer auth | `x-renter-key` header or `?key=` query auth | DCP separates renter/provider/admin auth roles. |
| Serverless endpoint call | `POST /api/dc1/jobs/submit` + poll output | Treat each request as a tracked job with billing settlement. |
| Pod / long-running serving | `job_type: vllm_serve` | Job output returns an OpenAI-compatible endpoint URL while running. |
| Worker logs | `GET /api/dc1/jobs/:job_id/logs` or `/logs/stream` | Use for runtime debugging and onboarding validation. |
| Marketplace/instance choice | `GET /api/dc1/renters/available-providers` | Pick `provider_id` by GPU model, VRAM, reliability, live status. |

## Auth mapping

RunPod-style `Authorization: Bearer ...` does not map directly.

Use DCP renter auth:

```bash
-H "x-renter-key: <RENTER_API_KEY>"
```

Or query form where documented:

```text
?key=<RENTER_API_KEY>
```

## First job migration (runnable)

### 1) Register renter and save key

```bash
curl -X POST https://dcp.sa/api/dc1/renters/register \
  -H "Content-Type: application/json" \
  -d '{"name":"RunPod Migrator","email":"migrator@example.com","organization":"Team"}'
```

### 2) Top up sandbox balance

```bash
curl -X POST https://dcp.sa/api/dc1/renters/topup \
  -H "Content-Type: application/json" \
  -H "x-renter-key: <RENTER_API_KEY>" \
  -d '{"amount_sar": 50}'
```

### 3) Find a target provider

```bash
curl https://dcp.sa/api/dc1/renters/available-providers
```

Choose a `provider_id` with matching VRAM/model fit.

### 4) Submit an inference job

```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "Content-Type: application/json" \
  -H "x-renter-key: <RENTER_API_KEY>" \
  -d '{
    "provider_id": 3,
    "job_type": "llm_inference",
    "duration_minutes": 5,
    "params": {
      "model": "mistralai/Mistral-7B-Instruct-v0.2",
      "prompt": "Summarize Vision 2030 in three bullets",
      "max_tokens": 256,
      "temperature": 0.4
    }
  }'
```

### 5) Poll status and fetch output

```bash
curl "https://dcp.sa/api/dc1/jobs/<JOB_ID>" \
  -H "x-renter-key: <RENTER_API_KEY>"

curl "https://dcp.sa/api/dc1/jobs/<JOB_ID>/output" \
  -H "x-renter-key: <RENTER_API_KEY>"
```

## Monitoring and operations mapping

| Need | DCP route | Migration note |
|---|---|---|
| Check renter/account state | `GET /api/dc1/renters/me` | Includes balance and recent jobs. |
| View logs for a job | `GET /api/dc1/jobs/:job_id/logs` | Use stream endpoint when tailing during active execution. |
| Cancel queued/pending work | `POST /api/dc1/jobs/:job_id/cancel` | Refund behavior follows DCP billing contract. |
| Validate fleet availability | `GET /api/dc1/renters/available-providers` | Re-query before burst submissions. |

## Common migration pitfalls

1. Sending bearer tokens instead of `x-renter-key`.
2. Assuming every workload is an always-on endpoint; use `vllm_serve` only when persistent serving is required.
3. Treating DCP as bare-metal host rental; DCP executes containerized jobs on provider GPUs.
4. Ignoring `cost_halala` hold/settlement behavior and reading only estimated runtime cost.
5. Not validating provider VRAM before submit (`available-providers` + `gpu_requirements`).

## Migration checklist

- Confirm API key flow uses DCP renter auth format.
- Port one inference workload using `jobs/submit` and `jobs/:id/output`.
- Verify logs path and error contract (`{ "error": "..." }`).
- Validate cost/settlement expectations in halala/SAR reporting.
- Move high-traffic serving endpoints to `vllm_serve` only where always-on behavior is required.
