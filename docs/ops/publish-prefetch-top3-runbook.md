# Prefetch Top-3 Startup SLA Runbook

Owner: Backend Developer  
Related: [DCP-289](/DCP/issues/DCP-289), [DCP-296](/DCP/issues/DCP-296)

## Purpose

Run one command that deploys the top-3 Arabic templates and records deploy->startup SLA evidence (`<60s`) for:

- `allam-7b-instruct`
- `falcon-h1-arabic-7b`
- `jais-13b-chat`

## Canonical Command

```bash
cd /paperclip/instances/default/workspaces/fe54d572-3cb6-408c-8e95-e3da583c5663/work
DCP_RENTER_KEY='<production-renter-key>' \
./infra/scripts/publish-prefetch-top3.sh --api-base https://api.dcp.sa/api
```

## Required Environment

- `DCP_RENTER_KEY` (required): active renter API key with balance.
- `DCP_API_BASE` (optional): defaults to `https://api.dcp.sa/api`.

## Output Artifacts

Each run writes:

- `docs/reports/reliability/prefetch-top3-sla-<timestamp>.json`
- `docs/reports/reliability/prefetch-top3-sla-<timestamp>.md`
- `docs/reports/reliability/prefetch-top3-sla-latest.json`
- `docs/reports/reliability/prefetch-top3-sla-latest.md`

## Pass/Fail Contract

Pass requires all template results to meet both conditions:

- Deploy request succeeds (`HTTP 200/201`) and returns `jobId`.
- Startup time is measured and `<60s`.

The command exits:

- `0` if all templates pass.
- `1` if any template fails.
- `2` for usage/config errors (for example missing `DCP_RENTER_KEY`).

## Notes

- Startup is measured from `job.submitted_at` (fallback `job.created_at`) to `job.started_at` (fallback `job.first_token_at`) from `GET /api/renters/me/jobs/:jobId`.
- Use `--templates` to override IDs for ad-hoc checks; DCP-296 evidence should keep the default top-3 set.
