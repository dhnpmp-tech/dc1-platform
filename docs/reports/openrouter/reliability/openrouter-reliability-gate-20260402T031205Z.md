# OpenRouter Reliability Gate

- generated_at: `2026-04-02T03:12:05.606Z`
- commit: `dd34821`
- branch: `agent/backend-dev/dcp-358-openrouter-gate`
- command: `cd backend && npm run gate:openrouter-reliability`
- readiness: **PASS**
- checks: `8/8` passing
- blocking_failures: `0`
- non_blocking_failures: `0`

## Canonical QA Command

```bash
cd backend
npm run gate:openrouter-reliability
```

## Harness Report

```text
# OpenRouter Compliance Readiness Report

Generated: 2026-04-02T03:12:05.731Z
Readiness: PASS
Checks: 8/8 passing
Blocking failures: 0
Non-blocking failures: 0

## Check Results

- [PASS] models_contract (blocking) — GET /v1/models returns an OpenAI-compatible list payload
  Model catalog contract matches the OpenAI list shape expected by OpenRouter.
  evidence: status=200
  evidence: model_present=true
- [PASS] auth_required (blocking) — POST /v1/chat/completions rejects requests without a renter API key
  Auth guard correctly rejects anonymous requests with an OpenAI-style authentication error.
  evidence: status=401
  evidence: error_type=authentication_error
- [PASS] billing_guard (blocking) — POST /v1/chat/completions rejects renters without enough balance
  Billing guard correctly returns a 402 billing error before proxying the request.
  evidence: status=402
  evidence: error_type=billing_error
- [PASS] chat_completion_proxy (blocking) — POST /v1/chat/completions proxies a healthy completion response
  Healthy OpenRouter-style completion requests reach the provider proxy and return a standard chat completion payload.
  evidence: status=200
  evidence: content=mock provider response
- [PASS] stream_stability (blocking) — Streaming responses preserve SSE headers and emit a DONE terminator
  Healthy streaming requests keep the SSE content type and terminate cleanly with [DONE].
  evidence: status=200
  evidence: content_type=text/event-stream
  evidence: done_seen=true
- [PASS] tool_result_roundtrip (non_blocking) — Assistant tool_calls and tool result messages survive the proxy transform
  Conversation history with tool calls and tool outputs is preserved when the request is proxied.
  evidence: assistant_tool_calls=1
  evidence: tool_message_seen=true
- [PASS] tool_definition_passthrough (blocking) — Tool definitions and tool_choice are forwarded to the provider
  Tool definitions reach the provider proxy intact.
  evidence: tools_forwarded=1
  evidence: tool_choice_forwarded=true
- [PASS] mid_stream_failure_handling (blocking) — Mid-stream provider failures are surfaced cleanly to QA
  The harness observed a cleanly surfaced mid-stream failure mode.
  evidence: fetch_error=none
  evidence: done_seen=false
  evidence: body_prefix={"error":{"message":"Provider failover exhausted after initial error: connection

## Leadership Handoff

- Blocking: none
- Non-blocking: none
```

## Artifact Paths

- json: `docs/reports/openrouter/reliability/openrouter-reliability-gate-20260402T031205Z.json`
- markdown: `docs/reports/openrouter/reliability/openrouter-reliability-gate-20260402T031205Z.md`
- latest_json: `docs/reports/openrouter/reliability/openrouter-reliability-gate-latest.json`
- latest_markdown: `docs/reports/openrouter/reliability/openrouter-reliability-gate-latest.md`
