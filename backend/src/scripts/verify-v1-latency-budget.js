#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../db');
const {
  selectProvidersWithLatencyGate,
  loadLatencyGateConfig,
} = require('../services/inferenceLatencyBudgetGate');

function parseArgs(argv) {
  const args = {
    providerIds: null,
    output: null,
    simulate: null,
    seedSynthetic: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--provider-ids') {
      args.providerIds = String(argv[i + 1] || '')
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);
      i += 1;
    } else if (arg === '--output') {
      args.output = String(argv[i + 1] || '').trim() || null;
      i += 1;
    } else if (arg === '--simulate') {
      args.simulate = String(argv[i + 1] || '').trim().toLowerCase() || null;
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
    '  node backend/src/scripts/verify-v1-latency-budget.js [--provider-ids 12,19] [--seed-synthetic] [--simulate p50-breach|stream-failure-breach] [--output backend/artifacts/v1-latency-gate.json]',
    '',
    'Output:',
    '  - Emits deterministic JSON with p50/p95 and stream completion stats grouped by provider tier.',
    '  - verdict=PASS/FAIL and threshold reasons are included in the payload.',
  ].join('\n'));
}

function resolveProviders(providerIds) {
  const filter = Array.isArray(providerIds) && providerIds.length > 0;
  if (filter) {
    const placeholders = providerIds.map(() => '?').join(', ');
    return db.all(
      `SELECT id, gpu_util_pct, gpu_tier, status
       FROM providers
       WHERE id IN (${placeholders})
       ORDER BY id ASC`,
      ...providerIds
    );
  }
  return db.all(
    `SELECT id, gpu_util_pct, gpu_tier, status
     FROM providers
     WHERE status = 'online' AND COALESCE(is_paused, 0) = 0
     ORDER BY id ASC`
  );
}

function ensureProviderColumns() {
  try { db.prepare('ALTER TABLE providers ADD COLUMN gpu_tier TEXT').run(); } catch (_) {}
  try { db.prepare('ALTER TABLE providers ADD COLUMN gpu_util_pct REAL').run(); } catch (_) {}
  try { db.prepare('ALTER TABLE providers ADD COLUMN is_paused INTEGER DEFAULT 0').run(); } catch (_) {}
}

function seedSyntheticProviders() {
  ensureProviderColumns();
  const now = new Date().toISOString();
  const providers = [
    { name: 'Synthetic Tier A', email: `tiera-${Date.now()}@dc1.test`, tier: 'A', util: 10, latencies: [180, 210, 240, 260, 280], streamFailures: 0, streamSuccesses: 10 },
    { name: 'Synthetic Tier B', email: `tierb-${Date.now()}@dc1.test`, tier: 'B', util: 25, latencies: [230, 260, 290, 310, 330], streamFailures: 0, streamSuccesses: 10 },
  ];
  const ids = [];
  for (const item of providers) {
    const inserted = db.prepare(
      `INSERT INTO providers
        (name, email, api_key, gpu_model, vram_gb, gpu_vram_mib, approval_status, status, supported_compute_types, gpu_tier, last_heartbeat, created_at, updated_at, gpu_util_pct)
       VALUES (?, ?, ?, 'Synthetic GPU', 24, 24576, 'approved', 'online', '["inference"]', ?, ?, ?, ?, ?)`
    ).run(
      item.name,
      item.email,
      `synthetic-${Math.random().toString(36).slice(2, 12)}`,
      item.tier,
      now,
      now,
      now,
      item.util
    );
    const providerId = Number(inserted.lastInsertRowid);
    ids.push(providerId);
    item.latencies.forEach((latencyMs) => {
      db.prepare(
        `INSERT INTO benchmark_runs
          (provider_id, benchmark_type, status, started_at, completed_at, latency_ms, notes)
         VALUES (?, 'standard', 'completed', ?, ?, ?, 'synthetic baseline')`
      ).run(providerId, now, now, latencyMs);
    });
    for (let i = 0; i < item.streamSuccesses; i += 1) {
      db.prepare(
        `INSERT INTO inference_stream_events
          (provider_id, model_id, provider_tier, stream_success, stream_error_code, duration_ms, created_at)
         VALUES (?, 'synthetic-model', ?, 1, NULL, 180, ?)`
      ).run(providerId, item.tier, now);
    }
    for (let i = 0; i < item.streamFailures; i += 1) {
      db.prepare(
        `INSERT INTO inference_stream_events
          (provider_id, model_id, provider_tier, stream_success, stream_error_code, duration_ms, created_at)
         VALUES (?, 'synthetic-model', ?, 0, 'synthetic_error', 190, ?)`
      ).run(providerId, item.tier, now);
    }
  }
  return ids;
}

function insertSimulationRows(simulate, providers) {
  if (!simulate || !Array.isArray(providers) || providers.length === 0) return;
  const now = new Date().toISOString();

  if (simulate === 'p50-breach') {
    const target = providers[0];
    const rows = [520, 540, 560, 610, 640];
    for (const latency of rows) {
      db.prepare(
        `INSERT INTO benchmark_runs
          (provider_id, benchmark_type, status, started_at, completed_at, latency_ms, notes)
         VALUES (?, 'standard', 'completed', ?, ?, ?, ?)`
      ).run(target.id, now, now, latency, 'latency-gate simulation: p50 breach');
    }
  } else if (simulate === 'stream-failure-breach') {
    const target = providers[0];
    for (let i = 0; i < 10; i += 1) {
      db.prepare(
        `INSERT INTO inference_stream_events
          (provider_id, model_id, provider_tier, stream_success, stream_error_code, duration_ms, created_at)
         VALUES (?, 'simulation-model', ?, ?, ?, ?, ?)`
      ).run(
        target.id,
        target.gpu_tier || 'tier_a',
        i < 4 ? 0 : 1,
        i < 4 ? 'simulated_failure' : null,
        200 + i,
        now
      );
    }
  }
}

function writeArtifact(report, outputPath) {
  if (!outputPath) return;
  const absolute = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }

  if (args.seedSynthetic) {
    args.providerIds = seedSyntheticProviders();
  }

  const providers = resolveProviders(args.providerIds);
  if (!providers.length) {
    console.error('error: no candidate providers found');
    process.exit(1);
  }

  insertSimulationRows(args.simulate, providers);

  const config = loadLatencyGateConfig();
  const gate = selectProvidersWithLatencyGate({ db, providers, config });
  const report = {
    generated_at: new Date().toISOString(),
    simulate: args.simulate || null,
    provider_count: providers.length,
    selected_provider_id: gate.selectedProviderId,
    fallback_provider_ids: gate.fallbackProviderIds,
    mode: gate.mode,
    verdict: gate.pass ? 'PASS' : 'FAIL',
    reasons: gate.reasons,
    thresholds: {
      max_p50_ms: config.maxP50Ms,
      baseline_p95_ms: config.baselineP95Ms,
      max_p95_regression_pct: config.maxP95RegressionPct,
      baseline_stream_failure_rate: config.baselineStreamFailureRate,
      max_stream_failure_regression_pct: config.maxStreamFailureRegressionPct,
      min_latency_samples: config.minLatencySamples,
      min_stream_samples: config.minStreamSamples,
      lookback_hours: config.lookbackHours,
    },
    tiers: gate.tiers,
    providers: gate.providers,
  };

  writeArtifact(report, args.output);
  console.log(JSON.stringify(report, null, 2));
  if (!gate.pass) process.exit(2);
}

main();
