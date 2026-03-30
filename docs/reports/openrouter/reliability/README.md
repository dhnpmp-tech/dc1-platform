# OpenRouter Reliability Canary Artifacts

This directory stores generated canary artifacts for OpenRouter reliability runs.

## Command

Run from `backend/`:

```bash
npm run test:openrouter:canary
npm run test:openrouter:canary -- --simulate-failure
```

## Outputs

Each invocation writes:

- Timestamped JSON report (`canary-<mode>-<timestamp>.json`)
- Timestamped markdown summary (`canary-<mode>-<timestamp>.md`)
- Latest JSON snapshot (`canary-<mode>-latest.json`)
- Latest markdown snapshot (`canary-<mode>-latest.md`)

`<mode>` is `clean` or `forced_failure`.
