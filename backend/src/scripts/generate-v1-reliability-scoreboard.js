#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const db = require('../db');
const {
  loadLatencyGateConfig,
  selectProvidersWithLatencyGate,
  summarizeLatencyMs,
} = require('../services/inferenceLatencyBudgetGate');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const BACKEND_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs/reports/reliability');

function parseArgs(argv) {
  const args = {
    outputDir: DEFAULT_OUTPUT_DIR,
    sampleRuns: 3,
    seedSynthetic: false,
    lookbackHours: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output-dir') {
      const value = String(argv[i + 1] || '').trim();
      if (value) {
        args.outputDir = path.isAbsolute(value) ? value : path.join(PROJECT_ROOT, value);
      }
      i += 1;
    } else if (arg === '--sample-runs') {
      const value = Number.parseInt(String(argv[i + 1] || ''), 10);
      if (Number.isInteger(value) && value > 0 && value <= 20) {
        args.sampleRuns = value;
      }
      i += 1;
    } else if (arg === '--lookback-hours') {
      const value = Number.parseInt(String(argv[i + 1] || ''), 10);
      if (Number.isInteger(value) && value > 0 && value <= 24 * 30) {
        args.lookbackHours = value;
      }
      i += 1;
    } else if (arg === '--seed-synthetic') {
      args.seedSynthetic = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

function usage() {
  console.log([
    'Usage:',
    '  node backend/src/scripts/generate-v1-reliability-scoreboard.js [--output-dir docs/reports/reliability] [--sample-runs 3] [--lookback-hours 168] [--seed-synthetic]',
    '',
    'Outputs:',
    '  - docs/reports/reliability/reliability-scoreboard-YYYY-MM-DD.json',
    '  - docs/reports/reliability/reliability-scoreboard-YYYY-MM-DD.md',
    '  - docs/reports/reliability/reliability-scoreboard-latest.{json,md}',
    '',
    'Exit code:',
    '  0 on PASS, 2 on threshold FAIL, 1 on execution error',
  ].join('\n'));
}

function percentile(sortedValues, p) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
  if (p <= 0) return sortedValues[0];
  if (p >= 100) return sortedValues[sortedValues.length - 1];
  const idx = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedValues[lower];
  const weight = idx - lower;
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * weight;
}

function ensureProviderColumns() {
  try { db.prepare('ALTER TABLE providers ADD COLUMN gpu_tier TEXT').run(); } catch (_) {}
  try { db.prepare('ALTER TABLE providers ADD COLUMN gpu_util_pct REAL').run(); } catch (_) {}
  try { db.prepare('ALTER TABLE providers ADD COLUMN is_paused INTEGER DEFAULT 0').run(); } catch (_) {}
}

function seedSyntheticTelemetry() {
  ensureProviderColumns();
  const now = new Date().toISOString();
  const seeds = [
    { tier: 'A', util: 12, latencies: [180, 195, 210, 225, 240], success: 12, failure: 0 },
    { tier: 'B', util: 25, latencies: [230, 250, 270, 295, 320], success: 10, failure: 0 },
  ];

  for (const seed of seeds) {
    const email = `reliability-${seed.tier.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`;
    const provider = db.prepare(
      `INSERT INTO providers
        (name, email, api_key, gpu_model, vram_gb, gpu_vram_mib, approval_status, status, supported_compute_types, gpu_tier, gpu_util_pct, last_heartbeat, created_at, updated_at)
       VALUES (?, ?, ?, 'Synthetic GPU', 24, 24576, 'approved', 'online', '["inference"]', ?, ?, ?, ?, ?)`
    ).run(
      `Synthetic Reliability ${seed.tier}`,
      email,
      `reliability-${Math.random().toString(36).slice(2, 14)}`,
      seed.tier,
      seed.util,
      now,
      now,
      now
    );
    const providerId = Number(provider.lastInsertRowid);

    for (const latencyMs of seed.latencies) {
      db.prepare(
        `INSERT INTO benchmark_runs
          (provider_id, benchmark_type, status, started_at, completed_at, latency_ms, notes)
         VALUES (?, 'standard', 'completed', ?, ?, ?, 'synthetic reliability scoreboard sample')`
      ).run(providerId, now, now, latencyMs);
    }

    for (let i = 0; i < seed.success; i += 1) {
      db.prepare(
        `INSERT INTO inference_stream_events
          (provider_id, model_id, provider_tier, stream_success, stream_error_code, duration_ms, created_at)
         VALUES (?, 'synthetic-model', ?, 1, NULL, 180, ?)`
      ).run(providerId, `tier_${seed.tier.toLowerCase()}`, now);
    }
    for (let i = 0; i < seed.failure; i += 1) {
      db.prepare(
        `INSERT INTO inference_stream_events
          (provider_id, model_id, provider_tier, stream_success, stream_error_code, duration_ms, created_at)
         VALUES (?, 'synthetic-model', ?, 0, 'synthetic_error', 220, ?)`
      ).run(providerId, `tier_${seed.tier.toLowerCase()}`, now);
    }
  }
}

function resolveCandidateProviders() {
  try {
    return db.all(
      `SELECT id, gpu_tier, gpu_util_pct, status
       FROM providers
       WHERE status = 'online' AND COALESCE(is_paused, 0) = 0
       ORDER BY id ASC`
    );
  } catch (_) {
    return db.all(
      `SELECT id, gpu_tier, gpu_util_pct, status
       FROM providers
       WHERE status = 'online'
       ORDER BY id ASC`
    );
  }
}

function readLatencySamples(providerIds, lookbackHours) {
  if (!providerIds.length) return [];
  const placeholders = providerIds.map(() => '?').join(', ');
  const rows = db.all(
    `SELECT latency_ms
     FROM benchmark_runs
     WHERE status = 'completed'
       AND latency_ms IS NOT NULL
       AND provider_id IN (${placeholders})
       AND (completed_at IS NULL OR datetime(completed_at) >= datetime('now', ?))`,
    ...providerIds,
    `-${Math.max(1, lookbackHours)} hours`
  );
  return rows
    .map((row) => Number(row.latency_ms))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
}

function readStreamSamples(providerIds, lookbackHours) {
  if (!providerIds.length) return { success: 0, failure: 0 };
  const placeholders = providerIds.map(() => '?').join(', ');
  const row = db.get(
    `SELECT
       COALESCE(SUM(CASE WHEN stream_success = 1 THEN 1 ELSE 0 END), 0) AS success_count,
       COALESCE(SUM(CASE WHEN stream_success = 0 THEN 1 ELSE 0 END), 0) AS failure_count
     FROM inference_stream_events
     WHERE provider_id IN (${placeholders})
       AND datetime(created_at) >= datetime('now', ?)`,
    ...providerIds,
    `-${Math.max(1, lookbackHours)} hours`
  );
  return {
    success: Number(row?.success_count || 0),
    failure: Number(row?.failure_count || 0),
  };
}

function parseEvidenceBoolean(evidence, key) {
  const prefix = `${key}=`;
  const item = (Array.isArray(evidence) ? evidence : []).find((entry) => String(entry).startsWith(prefix));
  if (!item) return null;
  const value = String(item).slice(prefix.length).trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function runOpenRouterHarnessSample() {
  const code = `
const { runOpenRouterComplianceHarness } = require('./tests/helpers/openrouterComplianceHarness');
(async () => {
  const report = await runOpenRouterComplianceHarness();
  process.stdout.write(JSON.stringify(report));
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
  `;

  const result = spawnSync(process.execPath, ['-e', code], {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DC1_DB_PATH: ':memory:' },
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10,
  });

  if (result.status !== 0) {
    return {
      ok: false,
      doneSeen: false,
      details: result.stderr ? result.stderr.trim().slice(0, 240) : 'harness execution failed',
    };
  }

  try {
    const report = JSON.parse(result.stdout || '{}');
    const streamCheck = (report.checks || []).find((check) => check.id === 'stream_stability');
    const doneSeen = parseEvidenceBoolean(streamCheck?.evidence, 'done_seen');
    return {
      ok: true,
      doneSeen: doneSeen === true,
      details: streamCheck?.status || 'unknown',
    };
  } catch (_) {
    return {
      ok: false,
      doneSeen: false,
      details: 'failed to parse harness output',
    };
  }
}

function computeSseDoneCompliance(sampleRuns) {
  const samples = [];
  for (let i = 0; i < sampleRuns; i += 1) {
    samples.push(runOpenRouterHarnessSample());
  }
  const total = samples.length;
  const successCount = samples.filter((item) => item.doneSeen).length;
  const harnessErrors = samples.filter((item) => !item.ok).length;
  const compliance = total > 0 ? (successCount / total) : 0;
  return {
    sample_runs: total,
    done_seen_count: successCount,
    compliance_rate: Number(compliance.toFixed(6)),
    drift_rate: Number((1 - compliance).toFixed(6)),
    harness_errors: harnessErrors,
    samples,
  };
}

function dayStamp(iso) {
  return String(iso || '').slice(0, 10);
}

function markdownTableRow(cols) {
  return `| ${cols.join(' | ')} |`;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# /v1 Reliability Scoreboard');
  lines.push('');
  lines.push(`Generated: ${report.generated_at}`);
  lines.push(`Verdict: **${report.verdict}**`);
  lines.push('');
  lines.push('## Threshold Status');
  lines.push('');
  lines.push(markdownTableRow(['Metric', 'Observed', 'Threshold', 'Status']));
  lines.push(markdownTableRow(['---', '---', '---', '---']));
  lines.push(markdownTableRow([
    'Latency p50 (ms)',
    String(report.metrics.latency.p50_ms ?? 'n/a'),
    `<= ${report.thresholds.max_p50_ms}`,
    report.metrics.latency.p50_ok ? 'PASS' : 'FAIL',
  ]));
  lines.push(markdownTableRow([
    'Latency p95 (ms)',
    String(report.metrics.latency.p95_ms ?? 'n/a'),
    `<= ${report.thresholds.max_p95_ms}`,
    report.metrics.latency.p95_ok ? 'PASS' : 'FAIL',
  ]));
  lines.push(markdownTableRow([
    'Error rate',
    `${(report.metrics.error_rate.value * 100).toFixed(2)}%`,
    `<= ${(report.thresholds.max_error_rate * 100).toFixed(2)}%`,
    report.metrics.error_rate.ok ? 'PASS' : 'FAIL',
  ]));
  lines.push(markdownTableRow([
    'SSE [DONE] compliance',
    `${(report.metrics.sse_done.compliance_rate * 100).toFixed(2)}%`,
    `>= ${(report.thresholds.min_sse_done_compliance * 100).toFixed(2)}%`,
    report.metrics.sse_done.ok ? 'PASS' : 'FAIL',
  ]));
  lines.push('');
  lines.push('## Gate Mode');
  lines.push('');
  lines.push(`- Mode: \`${report.gate.mode}\``);
  lines.push(`- Latency gate pass: \`${report.gate.pass}\``);
  lines.push(`- Selected provider: \`${report.gate.selected_provider_id ?? 'none'}\``);
  if (report.gate.reasons.length > 0) {
    lines.push('- Reasons:');
    report.gate.reasons.forEach((reason) => lines.push(`  - ${reason}`));
  }
  lines.push('');
  lines.push('## Breaches');
  lines.push('');
  if (report.threshold_breaches.length === 0) {
    lines.push('- none');
  } else {
    report.threshold_breaches.forEach((item) => lines.push(`- ${item}`));
  }
  lines.push('');
  lines.push('## Rerun');
  lines.push('');
  lines.push('```bash');
  lines.push('cd backend');
  lines.push('npm run monitor:v1:reliability-scoreboard');
  lines.push('```');
  return `${lines.join('\n')}\n`;
}

function writeArtifacts(report, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = dayStamp(report.generated_at);
  const jsonPath = path.join(outputDir, `reliability-scoreboard-${stamp}.json`);
  const mdPath = path.join(outputDir, `reliability-scoreboard-${stamp}.md`);
  const latestJsonPath = path.join(outputDir, 'reliability-scoreboard-latest.json');
  const latestMdPath = path.join(outputDir, 'reliability-scoreboard-latest.md');

  const markdown = buildMarkdown(report);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, markdown, 'utf8');
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestMdPath, markdown, 'utf8');

  return {
    jsonPath,
    mdPath,
    latestJsonPath,
    latestMdPath,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }

  if (args.seedSynthetic) {
    seedSyntheticTelemetry();
  }

  const config = loadLatencyGateConfig();
  const lookbackHours = args.lookbackHours || config.lookbackHours;
  const providers = resolveCandidateProviders();
  const providerIds = providers.map((provider) => Number(provider.id)).filter((id) => Number.isInteger(id) && id > 0);

  const latencySamples = readLatencySamples(providerIds, lookbackHours);
  const latencySummary = summarizeLatencyMs(latencySamples);
  const p95Raw = percentile(latencySamples, 95);
  const p95Ms = p95Raw == null ? null : Math.round(p95Raw);
  const stream = readStreamSamples(providerIds, lookbackHours);
  const streamTotal = stream.success + stream.failure;
  const errorRate = streamTotal > 0 ? stream.failure / streamTotal : 0;

  const maxP95Ms = Math.round(config.baselineP95Ms * (1 + config.maxP95RegressionPct));
  const maxErrorRate = Number((config.baselineStreamFailureRate * (1 + config.maxStreamFailureRegressionPct)).toFixed(6));
  const minSseDoneCompliance = Number(process.env.V1_RELIABILITY_MIN_SSE_DONE_COMPLIANCE || 0.99);

  const sseDone = computeSseDoneCompliance(args.sampleRuns);
  const gate = selectProvidersWithLatencyGate({ db, providers, config });

  const thresholdBreaches = [];
  if (latencySummary.sampleCount < config.minLatencySamples) {
    thresholdBreaches.push(`latency sample count ${latencySummary.sampleCount} < minimum ${config.minLatencySamples}`);
  }
  if (latencySummary.p50Ms == null || latencySummary.p50Ms > config.maxP50Ms) {
    thresholdBreaches.push(`p50 ${latencySummary.p50Ms == null ? 'n/a' : `${latencySummary.p50Ms}ms`} exceeds max ${config.maxP50Ms}ms`);
  }
  if (p95Ms == null || p95Ms > maxP95Ms) {
    thresholdBreaches.push(`p95 ${p95Ms == null ? 'n/a' : `${p95Ms}ms`} exceeds max ${maxP95Ms}ms`);
  }
  if (streamTotal < config.minStreamSamples) {
    thresholdBreaches.push(`stream sample count ${streamTotal} < minimum ${config.minStreamSamples}`);
  }
  if (errorRate > maxErrorRate) {
    thresholdBreaches.push(`error rate ${(errorRate * 100).toFixed(2)}% exceeds max ${(maxErrorRate * 100).toFixed(2)}%`);
  }
  if (sseDone.compliance_rate < minSseDoneCompliance) {
    thresholdBreaches.push(`SSE [DONE] compliance ${(sseDone.compliance_rate * 100).toFixed(2)}% below ${(minSseDoneCompliance * 100).toFixed(2)}%`);
  }
  if (!gate.pass) {
    thresholdBreaches.push(`latency gate blocked (${gate.mode})`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    lookback_hours: lookbackHours,
    verdict: thresholdBreaches.length === 0 ? 'PASS' : 'FAIL',
    threshold_breaches: thresholdBreaches,
    thresholds: {
      max_p50_ms: config.maxP50Ms,
      max_p95_ms: maxP95Ms,
      max_error_rate: maxErrorRate,
      min_sse_done_compliance: minSseDoneCompliance,
      min_latency_samples: config.minLatencySamples,
      min_stream_samples: config.minStreamSamples,
    },
    metrics: {
      latency: {
        sample_count: latencySummary.sampleCount,
        p50_ms: latencySummary.p50Ms,
        p95_ms: p95Ms,
        p50_ok: latencySummary.p50Ms != null && latencySummary.p50Ms <= config.maxP50Ms,
        p95_ok: p95Ms != null && p95Ms <= maxP95Ms,
      },
      error_rate: {
        success_count: stream.success,
        failure_count: stream.failure,
        sample_count: streamTotal,
        value: Number(errorRate.toFixed(6)),
        ok: errorRate <= maxErrorRate,
      },
      sse_done: {
        sample_runs: sseDone.sample_runs,
        done_seen_count: sseDone.done_seen_count,
        compliance_rate: sseDone.compliance_rate,
        drift_rate: sseDone.drift_rate,
        harness_errors: sseDone.harness_errors,
        ok: sseDone.compliance_rate >= minSseDoneCompliance,
      },
    },
    gate: {
      pass: gate.pass,
      mode: gate.mode,
      selected_provider_id: gate.selectedProviderId,
      fallback_provider_ids: gate.fallbackProviderIds,
      reasons: gate.reasons,
      tiers: gate.tiers,
    },
    providers_considered: providerIds.length,
  };

  const artifacts = writeArtifacts(report, args.outputDir);
  console.log(JSON.stringify({ verdict: report.verdict, artifacts, threshold_breaches: thresholdBreaches }, null, 2));

  if (report.verdict !== 'PASS') {
    process.exit(2);
  }
}

try {
  main();
} catch (error) {
  console.error(`[v1-reliability-scoreboard] fatal: ${error.message}`);
  process.exit(1);
}
