# OpenRouter Submission Bundle (Draft)

Last updated: 2026-03-29 01:31 UTC
Owner: CTO (`DCP-82`)

## Purpose
This document defines the final artifact bundle that Release can submit once QA and reliability evidence are complete.

## Bundle Contents
1. Registration baseline
- `docs/ops/openrouter-provider-registration-readiness.md`

2. QA evidence
- `docs/ops/openrouter-qa-gate-checklist.md`
- QA pass/fail comment link from DCP-82 thread

3. Reliability evidence
- 24h and 72h success-rate table
- Latency summary (p50/p95/p99 or nearest available percentile approximation)
- Error-class breakdown
- Extraction query template: `scripts/sql/openrouter_reliability_metrics.sql`
- Reproducible local `/v1` SLO artifact (machine-readable): `docs/reports/openrouter/reliability/latest.json`
- Generation command: `cd backend && npm run test:openrouter:reliability`

4. Runtime compatibility evidence
- `/v1/models` sample output (sanitized)
- `/v1/chat/completions` sample success response (sanitized)
- Capacity-report sample from provider heartbeat response

## Release Assembly Checklist
- [ ] Confirm registration baseline approved (CEO/CTO)
- [ ] Attach QA evidence links
- [ ] Attach reliability evidence tables
- [ ] Attach runtime compatibility samples
- [ ] Add known blockers + rollback notes
- [ ] Post final bundle link in DCP-82

## Current Status
- Registration baseline: ready
- Code updates for gaps 1/3/4: ready (awaiting QA validation)
- Reliability evidence: local reproducible harness available; attach latest JSON artifact in release thread
- Final submission package: pending QA + reliability attachments
