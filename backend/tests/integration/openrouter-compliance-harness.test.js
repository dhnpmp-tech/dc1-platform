'use strict';

process.env.DC1_DB_PATH = process.env.DC1_DB_PATH || ':memory:';

const {
  runOpenRouterComplianceHarness,
} = require('../helpers/openrouterComplianceHarness');

describe('OpenRouter compliance harness', () => {
  test('produces a structured readiness report and validates provider-facing tool-definition passthrough', async () => {
    const report = await runOpenRouterComplianceHarness();
    const byId = Object.fromEntries(report.checks.map((check) => [check.id, check]));
    const blockingFailures = report.checks
      .filter((check) => check.status === 'fail' && check.severity === 'blocking')
      .map((check) => check.id)
      .sort();

    expect(report.summary.total).toBeGreaterThanOrEqual(7);
    expect(byId.auth_required?.status).toBe('pass');
    expect(byId.billing_guard?.status).toBe('pass');
    expect(byId.chat_completion_proxy?.status).toBe('pass');
    expect(byId.stream_stability?.status).toBe('pass');
    expect(byId.tool_result_roundtrip?.status).toBe('pass');
    expect(byId.tool_definition_passthrough?.status).toBe('pass');
    expect(byId.models_contract).toBeDefined();
    expect(byId.mid_stream_failure_handling).toBeDefined();
    expect(blockingFailures).toEqual([]);
  });
});
