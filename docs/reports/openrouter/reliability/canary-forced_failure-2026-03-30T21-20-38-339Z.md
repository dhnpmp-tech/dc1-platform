# OpenRouter Reliability Canary

Generated: 2026-03-30T21:20:38.339Z
Mode: forced_failure
Overall: FAIL (1/3 checks passing)

## Thresholds

- minProvidersOnline: 1
- maxStreamLatencyMs: 1500
- maxErrorRate: 0

## Checks

- [PASS] provider_online_count - Online provider count meets threshold
  evidence: {"status":200,"providersOnline":1,"minProvidersOnline":1}
- [FAIL] v1_stream_done_termination - V1 streaming returns DONE termination
  evidence: {"status":502,"doneSeen":false,"fetchError":null}
- [FAIL] latency_error_thresholds - Stream latency and error rate stay within thresholds
  evidence: {"streamLatencyMs":24,"maxStreamLatencyMs":1500,"errorRate":1,"maxErrorRate":0}
