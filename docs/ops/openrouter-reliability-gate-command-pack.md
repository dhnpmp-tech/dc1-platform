# OpenRouter Reliability Gate Command Pack

Owner: Backend Developer  
Related: [DCP-358](/DCP/issues/DCP-358), [DCP-227](/DCP/issues/DCP-227)

## Canonical Command

```bash
cd backend
npm run gate:openrouter-reliability
```

This command is the single source of truth for OpenRouter reliability closeout evidence.

## Companion Command

```bash
cd backend
npm run gate:openrouter-reliability:raw
```

Use the raw command only for local debugging; QA closeout should reference the canonical gate command above.

## Artifact Contract

Each canonical run writes:

- `docs/reports/openrouter/reliability/openrouter-reliability-gate-<timestamp>.json`
- `docs/reports/openrouter/reliability/openrouter-reliability-gate-<timestamp>.md`
- `docs/reports/openrouter/reliability/openrouter-reliability-gate-latest.json`
- `docs/reports/openrouter/reliability/openrouter-reliability-gate-latest.md`

Artifacts include:

- commit + branch metadata
- command metadata
- check summary (`passed`, `failed`, `blockingFailures`, `readiness`)
- full formatted harness report used by QA/release handoff

## Exit Behavior

- Exit code `0`: no blocking failures (`readiness=pass`)
- Exit code `1`: one or more blocking failures (`readiness=fail`)
