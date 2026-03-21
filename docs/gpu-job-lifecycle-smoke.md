# GPU Job Lifecycle Smoke Harness

Run file: `scripts/gpu-job-lifecycle-smoke.mjs`

Purpose: validate demo-critical GPU lifecycle path against live APIs:
`submit -> run -> logs -> completion artifact`.

## Usage

```bash
DCP_API_BASE="http://76.13.179.86:8083/api" \
DCP_PROVIDER_KEY="dc1-live-provider-key" \
DCP_RENTER_KEY="dc1-live-renter-key" \
node scripts/gpu-job-lifecycle-smoke.mjs
```

Or via npm:

```bash
DCP_PROVIDER_KEY="dc1-live-provider-key" \
DCP_RENTER_KEY="dc1-live-renter-key" \
npm run smoke:gpu-job
```

## Required Environment Variables

- `DCP_PROVIDER_KEY` (or `PROVIDER_KEY`)
- `DCP_RENTER_KEY` (or `RENTER_KEY`)

Optional:

- `DCP_API_BASE` (default `http://76.13.179.86:8083/api`)
- `DCP_SMOKE_POLL_MS` (default `3000`)
- `DCP_SMOKE_TIMEOUT_MS` (default `180000`)
- `DCP_SMOKE_DURATION_MINUTES` (default `0.2`)
- `DCP_SMOKE_MODEL` (default `TinyLlama/TinyLlama-1.1B-Chat-v1.0`)

## Pass/Fail Criteria

The run exits `0` only if all checks pass:

1. Provider key valid and heartbeat accepted.
2. Renter key valid and renter profile fetch succeeds.
3. Job submit returns `201` with `job_id`.
4. Provider poll (`/api/providers/jobs/next`) claims that same `job_id`.
5. Provider logs patch is accepted and visible via renter logs endpoint.
6. Provider result marks job terminal as `completed`.
7. Renter fetches output artifact from `/api/jobs/:job_id/output`.

Any failed checkpoint exits `1` and prints the failing step and HTTP/body context.

## Demo Reliability Mapping

- `Checkpoint A` Auth + readiness: key validation and heartbeat path.
- `Checkpoint B` Scheduler handoff: renter submit to provider claim.
- `Checkpoint C` Runtime observability: daemon logs ingest and readback.
- `Checkpoint D` Settlement + artifact: completion write and output retrieval.
