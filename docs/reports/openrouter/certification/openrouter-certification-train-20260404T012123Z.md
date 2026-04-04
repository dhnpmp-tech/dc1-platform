# OpenRouter Certification Train

- generated_at: `2026-04-04T01:21:23.644Z`
- commit_sha: `2ce499a634641dba7ec3d7ed74d8e87c77da52e2`
- commit_short: `2ce499a`
- branch: `agent/backend-dev/dcp-555-openrouter-cert-train`
- command: `cd backend && npm run certify:openrouter:train`
- overall_status: **FAIL**
- contracts_passed: `1/4`
- runtime_blockers: `1`

## Contract Matrix

- models_contract: **PASS** (models_contract)
  - severity: blocking
  - details: Model catalog contract matches the OpenAI list shape expected by OpenRouter.
- stream_done_contract: **FAIL** (stream_stability)
  - severity: blocking
  - details: Streaming requests did not preserve the expected SSE contract.
- tools_passthrough_contract: **FAIL** (tool_definition_passthrough)
  - severity: blocking
  - details: Tool definitions/tool_choice are currently stripped before the provider request, which blocks OpenRouter tool-calling parity.
- failover_behavior_contract: **FAIL** (mid_stream_failure_handling)
  - severity: blocking
  - details: Mid-stream provider disconnects currently terminate the stream without a clean OpenRouter-style error or DONE terminator.

## Runtime Proof

- verdict: **FAIL**
- failure_code: ``
- capacity_snapshot: `{}`

## Blockers

- [contract] stream_done_contract: stream_stability: Streaming requests did not preserve the expected SSE contract.
- [contract] tools_passthrough_contract: tool_definition_passthrough: Tool definitions/tool_choice are currently stripped before the provider request, which blocks OpenRouter tool-calling parity.
- [contract] failover_behavior_contract: mid_stream_failure_handling: Mid-stream provider disconnects currently terminate the stream without a clean OpenRouter-style error or DONE terminator.
- [runtime] runtime_failure: {
  "ok": false,
  "message": "Cannot recover existing smoke principal master key via /api/renters/login-email",
  "details": {
    "baseUrl": "https://api.dcp.sa",
    "email": "inference-smoke-d7e7983d4161@dcp.local",
    "registerStatus": 429,
    "loginStatus": 429,
    "loginBody": {
      "error": "Rate limit exceeded",
      "retryAfterSeconds": 64,
      "retryAfterMs": 64000
    }
  }
}

## Artifacts

- json: `docs/reports/openrouter/certification/openrouter-certification-train-20260404T012123Z.json`
- markdown: `docs/reports/openrouter/certification/openrouter-certification-train-20260404T012123Z.md`
- latest_json: `docs/reports/openrouter/certification/openrouter-certification-train-latest.json`
- latest_markdown: `docs/reports/openrouter/certification/openrouter-certification-train-latest.md`

## Commands

```bash
cd backend
npm run certify:openrouter:train
```

