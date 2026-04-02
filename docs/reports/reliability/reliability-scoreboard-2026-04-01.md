# /v1 Reliability Scoreboard

Generated: 2026-04-01T16:31:32.951Z
Verdict: **PASS**

## Threshold Status

| Metric | Observed | Threshold | Status |
| --- | --- | --- | --- |
| Latency p50 (ms) | 235 | <= 300 | PASS |
| Latency p95 (ms) | 320 | <= 1080 | PASS |
| Error rate | 2.22% | <= 3.00% | PASS |
| SSE [DONE] compliance | 100.00% | >= 99.00% | PASS |

## Gate Mode

- Mode: `strict`
- Latency gate pass: `true`
- Selected provider: `1`

## Breaches

- none

## Rerun

```bash
cd backend
npm run monitor:v1:reliability-scoreboard
```
