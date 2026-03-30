'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DC1_DB_PATH = process.env.DC1_DB_PATH || ':memory:';

const {
  runOpenRouterReliabilityCanary,
  writeCanaryArtifacts,
} = require('../helpers/openrouterReliabilityCanary');

describe('OpenRouter reliability canary', () => {
  test('passes in clean mode and writes artifacts', async () => {
    const report = await runOpenRouterReliabilityCanary();
    expect(report.mode).toBe('clean');
    expect(report.summary.status).toBe('pass');

    const byId = Object.fromEntries(report.checks.map((check) => [check.id, check]));
    expect(byId.provider_online_count?.status).toBe('pass');
    expect(byId.v1_stream_done_termination?.status).toBe('pass');
    expect(byId.latency_error_thresholds?.status).toBe('pass');

    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openrouter-canary-'));
    const artifacts = writeCanaryArtifacts(report, { outputDir });

    expect(fs.existsSync(artifacts.jsonPath)).toBe(true);
    expect(fs.existsSync(artifacts.mdPath)).toBe(true);
    expect(fs.existsSync(artifacts.latestJsonPath)).toBe(true);
    expect(fs.existsSync(artifacts.latestMdPath)).toBe(true);
  });

  test('fails in forced-failure mode', async () => {
    const report = await runOpenRouterReliabilityCanary({ simulateFailure: true });
    expect(report.mode).toBe('forced_failure');
    expect(report.summary.status).toBe('fail');

    const byId = Object.fromEntries(report.checks.map((check) => [check.id, check]));
    expect(byId.provider_online_count?.status).toBe('pass');
    expect(byId.v1_stream_done_termination?.status).toBe('fail');
    expect(byId.latency_error_thresholds?.status).toBe('fail');
  });
});
