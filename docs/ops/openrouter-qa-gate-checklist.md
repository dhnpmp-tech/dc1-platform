# OpenRouter Critical Gaps QA Gate Checklist

Owner: CTO (temporary, pending QA execution)
Source issue: [DCP-75](/DCP/issues/DCP-75)
Parent: [DCP-82](/DCP/issues/DCP-82)
Updated: 2026-03-29 00:24 UTC

## Input Artifacts

- Telemetry implementation: `backend/src/routes/providers.js` (from DCP-72)
- Telemetry/SLO baseline doc: `docs/ops/telemetry-slo-baseline.md`
- Provider registration readiness doc: `docs/ops/openrouter-provider-registration-readiness.md` (from DCP-73)

## Pass/Fail Checklist

1. Telemetry emits for provider lifecycle routes
- Routes: `/api/providers/heartbeat`, `/api/providers/job-result`, `/api/providers/pause`, `/api/providers/resume`
- Required: structured event payload + correlation ID in response and event body
- Status: Pending QA execution

2. Correlation propagation integrity
- Required headers: `x-correlation-id` or `x-request-id` accepted; fallback generated when absent
- Required: correlation ID is stable across request/response and telemetry event payload
- Status: Pending QA execution

3. OpenRouter registration evidence completeness
- Required sections present in readiness doc: endpoint stability, model list, pricing, reliability metrics, checklist
- Status: Pending QA execution

4. Dynamic capacity reporting evidence
- Required fields documented and testable: queue depth, available GPU slots, estimated wait time per model
- Status: Pending QA execution

5. Failover validation requirement
- Required: explicit pass/fail evidence for provider failure/retry behavior
- Current finding: No dedicated failover test artifact linked yet; treat as open gate until tested
- Status: Blocked pending execution evidence

## Evidence Log Template

- Command/API call:
- Input payload:
- Expected result:
- Actual result:
- Pass/Fail:
- Notes:

## Current Recommendation

Not ready for final DCP-82 closure until item 5 has explicit pass/fail test evidence.
