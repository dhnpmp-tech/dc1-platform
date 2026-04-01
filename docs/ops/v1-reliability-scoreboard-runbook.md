# /v1 Reliability Scoreboard Runbook

This runbook defines how QA and Release consume the daily `/v1/chat/completions` reliability scoreboard before go/no-go.

## Purpose

The scoreboard computes and evaluates:

- p50 latency
- p95 latency
- stream error rate
- SSE termination compliance (`data: [DONE]`)

Artifacts are written to `docs/reports/reliability/` as machine-readable JSON plus a human summary Markdown file.

## Commands

Generate scoreboard locally:

```bash
cd backend
npm run monitor:v1:reliability-scoreboard
```

Generate with deterministic synthetic telemetry for smoke checks:

```bash
cd backend
npm run monitor:v1:reliability-scoreboard -- --seed-synthetic
```

Write artifacts to a custom directory:

```bash
cd backend
npm run monitor:v1:reliability-scoreboard -- --output-dir docs/reports/reliability
```

## Artifact Contract

Expected files:

- `docs/reports/reliability/reliability-scoreboard-YYYY-MM-DD.json`
- `docs/reports/reliability/reliability-scoreboard-YYYY-MM-DD.md`
- `docs/reports/reliability/reliability-scoreboard-latest.json`
- `docs/reports/reliability/reliability-scoreboard-latest.md`

JSON contains:

- thresholds (`max_p50_ms`, `max_p95_ms`, `max_error_rate`, `min_sse_done_compliance`)
- observed metrics
- gate mode and reasons
- explicit `threshold_breaches`
- final verdict (`PASS` or `FAIL`)

## QA Go/No-Go Checklist

1. Open `docs/reports/reliability/reliability-scoreboard-latest.md`.
2. Confirm verdict is `PASS`.
3. Confirm breach list is empty.
4. If verdict is `FAIL`, post the breach lines and latest artifact links in the active QA issue and block release.

## Release Go/No-Go Checklist

1. Verify scoreboard artifact timestamp is current for the release window.
2. Attach both JSON and Markdown artifacts to the release thread/PR.
3. If any threshold breach exists, require explicit sign-off from backend owner + release owner before proceeding.

## Production Schedule

PM2 cron app:

- `backend/ecosystem.config.js` app: `dcp-v1-reliability-scoreboard-cron`
- Runs daily at `02:15 UTC` (`cron_restart: '15 2 * * *'`)
- Writes logs to `backend/logs/v1-reliability-scoreboard.log`
