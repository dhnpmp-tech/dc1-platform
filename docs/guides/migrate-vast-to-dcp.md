# Migrate from Vast.ai to DCP

This guide helps teams convert Vast.ai marketplace workflows into DCP renter API flows.

DCP execution model: GPU jobs run in provider-hosted Docker containers via daemon orchestration, with API-based submit/poll/output loops.

## Why teams choose DCP

- Saudi-hosted market with structural energy-cost advantage.
- Arabic AI development positioning with Arabic-first model support.
- Unified renter API for registration, balance, provider discovery, submit, logs, and outputs.

## Concept mapping: Vast.ai -> DCP

| Vast.ai concept | DCP equivalent | Notes |
|---|---|---|
| Offer search/filter | `GET /api/dc1/renters/available-providers` | Select by GPU model, VRAM, live status, reliability. |
| Rent/create instance | `POST /api/dc1/jobs/submit` | In DCP, renter submits job against a provider ID. |
| Instance status | `GET /api/dc1/jobs/:job_id` | Job lifecycle: pending/queued/running/completed/failed/cancelled. |
| Instance logs | `GET /api/dc1/jobs/:job_id/logs` | Available per job, plus stream endpoint for live tailing. |
| API key usage | `x-renter-key` (or `?key=` where supported) | DCP auth is role-scoped; admin and provider keys are separate. |

## Auth migration

Use renter auth in each renter job call:

```bash
-H "x-renter-key: <RENTER_API_KEY>"
```

Do not reuse provider/admin auth for renter job APIs.

## First job migration (runnable)

### 1) Register renter account

```bash
curl -X POST https://dcp.sa/api/dc1/renters/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Vast Migrator","email":"vast-migrator@example.com"}'
```

### 2) Add balance

```bash
curl -X POST https://dcp.sa/api/dc1/renters/topup \
  -H "Content-Type: application/json" \
  -H "x-renter-key: <RENTER_API_KEY>" \
  -d '{"amount_sar": 50}'
```

### 3) Discover suitable GPU providers

```bash
curl https://dcp.sa/api/dc1/renters/available-providers
```

Pick a provider ID that satisfies your VRAM and model constraints.

### 4) Submit container workload

```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "Content-Type: application/json" \
  -H "x-renter-key: <RENTER_API_KEY>" \
  -d '{
    "provider_id": 3,
    "job_type": "custom_container",
    "duration_minutes": 20,
    "params": {
      "image_override": "python:3.11-slim",
      "script": "print(\"hello from DCP\")"
    }
  }'
```

### 5) Track and retrieve output

```bash
curl "https://dcp.sa/api/dc1/jobs/<JOB_ID>" \
  -H "x-renter-key: <RENTER_API_KEY>"

curl "https://dcp.sa/api/dc1/jobs/<JOB_ID>/output" \
  -H "x-renter-key: <RENTER_API_KEY>"
```

## Monitoring and operational equivalents

| Need | DCP route | Migration note |
|---|---|---|
| Account + recent jobs | `GET /api/dc1/renters/me` | Validate auth, balance, and recent execution history. |
| Full history export | `GET /api/dc1/jobs/history` | Use filters/pagination for fleet reporting. |
| Live logs during execution | `GET /api/dc1/jobs/:job_id/logs/stream` | Use for long-running debugging. |
| Cancel not-yet-running job | `POST /api/dc1/jobs/:job_id/cancel` | Pending/queued cancellation with refund semantics. |

## Common migration pitfalls

1. Assuming direct VM lifecycle controls; DCP renter flow is job-centric.
2. Skipping provider discovery and submitting against an incompatible GPU profile.
3. Sending raw scripts outside supported job template fields; use valid `job_type` and `params` shape.
4. Missing `x-renter-key` on status/output calls after submit.
5. Ignoring DCP error contract and retry logic (`{ "error": "..." }`).

## Migration checklist

- Validate renter auth flow and key storage.
- Port one `custom_container` workload end-to-end.
- Add job polling and output retrieval in your client.
- Add logs collection (`logs` or `logs/stream`) for incident triage.
- Validate DCP billing behavior against your prior instance-based assumptions.
