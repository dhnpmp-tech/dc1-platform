'use strict';

const fs = require('fs');
const path = require('path');

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';

const {
  runOpenRouterComplianceHarness,
} = require('./helpers/openrouterComplianceHarness');

const DEFAULT_THRESHOLDS = {
  latencyP50MsMax: 1200,
  latencyP95MsMax: 2000,
  errorRatePctMax: 0,
  streamCompletionRatePctMin: 100,
  uptimePctMin: 100,
};

function nowIso() {
  return new Date().toISOString();
}

function timestampForFile(inputIso) {
  return String(inputIso || nowIso()).replace(/[:]/g, '-').replace(/[.]/g, '_');
}

function evaluateThresholds(telemetry, thresholds) {
  const checks = {
    latency_p50: telemetry.latencyMs.p50 <= thresholds.latencyP50MsMax,
    latency_p95: telemetry.latencyMs.p95 <= thresholds.latencyP95MsMax,
    error_rate: telemetry.errorRatePct <= thresholds.errorRatePctMax,
    stream_completion_rate: telemetry.streamCompletionRatePct >= thresholds.streamCompletionRatePctMin,
    uptime: telemetry.uptimePct >= thresholds.uptimePctMin,
  };
  const failing = Object.keys(checks).filter((key) => !checks[key]);
  return {
    checks,
    overall: failing.length === 0 ? 'PASS' : 'FAIL',
    failingChecks: failing,
  };
}

function resolveReportsDir() {
  return path.resolve(__dirname, '..', '..', 'docs', 'reports', 'openrouter', 'reliability');
}

async function main() {
  const generatedAt = nowIso();
  const thresholds = { ...DEFAULT_THRESHOLDS };
  const report = await runOpenRouterComplianceHarness();
  const evaluation = evaluateThresholds(report.telemetry, thresholds);

  const artifact = {
    generatedAt,
    command: 'NODE_ENV=test node backend/tests/openrouter-reliability-telemetry.js',
    source: {
      harness: 'backend/tests/helpers/openrouterComplianceHarness.js',
      db: process.env.DC1_DB_PATH || ':memory:',
      requiresProductionAccess: false,
    },
    metrics: {
      latencyMs: report.telemetry.latencyMs,
      errorRatePct: report.telemetry.errorRatePct,
      streamCompletionRatePct: report.telemetry.streamCompletionRatePct,
      uptimePct: report.telemetry.uptimePct,
      uptimeWindow: report.telemetry.window,
      sampleCount: report.telemetry.sampleCount,
    },
    thresholds,
    evaluation,
    complianceSummary: report.summary,
    checkResults: report.checks.map((check) => ({
      id: check.id,
      title: check.title,
      severity: check.severity,
      status: check.status,
      latencyMs: check.latencyMs || 0,
      details: check.details,
      evidence: check.evidence,
    })),
  };

  const reportsDir = resolveReportsDir();
  fs.mkdirSync(reportsDir, { recursive: true });
  const stamp = timestampForFile(generatedAt);
  const artifactPath = path.join(reportsDir, `openrouter-reliability-${stamp}.json`);
  const latestPath = path.join(reportsDir, 'latest.json');

  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  console.log(`# OpenRouter /v1 Reliability Telemetry`);
  console.log(`Generated: ${generatedAt}`);
  console.log(`Overall: ${evaluation.overall}`);
  console.log(`Artifact: ${artifactPath}`);
  console.log(`Latest: ${latestPath}`);
  console.log(`p50/p95 latency (ms): ${artifact.metrics.latencyMs.p50}/${artifact.metrics.latencyMs.p95}`);
  console.log(`error rate (%): ${artifact.metrics.errorRatePct}`);
  console.log(`stream completion rate (%): ${artifact.metrics.streamCompletionRatePct}`);
  console.log(`uptime (%): ${artifact.metrics.uptimePct}`);

  process.exit(evaluation.overall === 'PASS' ? 0 : 1);
}

main().catch((error) => {
  console.error('OpenRouter reliability telemetry script failed:', error);
  process.exit(1);
});
