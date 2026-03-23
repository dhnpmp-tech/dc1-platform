/**
 * job-scheduler.test.js — Unit tests for jobScheduler resource matching
 *
 * Tests the intelligent scheduling algorithms including:
 * - GPU type matching (exact and compatibility fallbacks)
 * - VRAM requirement validation
 * - Cost-aware provider ranking
 * - Provider status awareness
 * - Batch scheduling
 */

'use strict';

const assert = require('assert');
const test = require('node:test');

const db = require('../src/db');
const scheduler = require('../src/services/jobScheduler');

// Helper to insert test provider
function createTestProvider(overrides = {}) {
  const defaults = {
    name: 'TestProvider1',
    email: `provider-${Math.random()}@test.com`,
    gpu_model: 'A100',
    vram_gb: 40,
    gpu_vram_mib: 40960,
    status: 'active',
    approval_status: 'approved',
    price_per_min_halala: 10,
    uptime_percent: 95,
    last_heartbeat: new Date().toISOString(),
    is_paused: 0,
  };

  const values = { ...defaults, ...overrides };
  const result = db.prepare(
    `INSERT INTO providers (name, email, gpu_model, vram_gb, gpu_vram_mib, status, approval_status,
                            price_per_min_halala, uptime_percent, last_heartbeat, is_paused)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    values.name, values.email, values.gpu_model, values.vram_gb, values.gpu_vram_mib,
    values.status, values.approval_status, values.price_per_min_halala, values.uptime_percent,
    values.last_heartbeat, values.is_paused
  );

  return { ...values, id: result.lastInsertRowid };
}

// Helper to reset database
function resetDb() {
  db.prepare('DELETE FROM providers').run();
  db.prepare('DELETE FROM jobs').run();
}

// ─── GPU TYPE MATCHING ───

test('GPU matching - exact match', () => {
  const match = scheduler.matchGpuType('A100', 'A100');
  assert.strictEqual(match.matched, true);
  assert.strictEqual(match.exactMatch, true);
});

test('GPU matching - case insensitive', () => {
  const match = scheduler.matchGpuType('a100', 'A100');
  assert.strictEqual(match.matched, true);
  assert.strictEqual(match.exactMatch, true);
});

test('GPU matching - no requirement accepts any', () => {
  const match = scheduler.matchGpuType(null, 'A100');
  assert.strictEqual(match.matched, true);
  assert.strictEqual(match.exactMatch, true);
});

test('GPU matching - incompatible rejects', () => {
  const match = scheduler.matchGpuType('A100', 'CPU');
  assert.strictEqual(match.matched, false);
});

test('GPU matching - compatibility fallback', () => {
  const match = scheduler.matchGpuType('A100', 'H100');
  assert.strictEqual(match.matched, true);
  assert.strictEqual(match.exactMatch, false);
  assert.strictEqual(match.reason, 'compatible_fallback');
});

test('GPU matching - unknown provider GPU', () => {
  const match = scheduler.matchGpuType('A100', null);
  assert.strictEqual(match.matched, false);
});

// ─── MEMORY MATCHING ───

test('Memory matching - satisfied', () => {
  const match = scheduler.matchMemoryRequirement(8, 16);
  assert.strictEqual(match.satisfied, true);
});

test('Memory matching - insufficient', () => {
  const match = scheduler.matchMemoryRequirement(16, 8);
  assert.strictEqual(match.satisfied, false);
});

test('Memory matching - zero requirements', () => {
  const match = scheduler.matchMemoryRequirement(0, 8);
  assert.strictEqual(match.satisfied, true);
});

test('Memory matching - missing values', () => {
  const match = scheduler.matchMemoryRequirement(null, null);
  assert.strictEqual(match.satisfied, true);
});

// ─── PROVIDER STATUS ───

test('Provider status - online when recent heartbeat', () => {
  const now = Date.now();
  const recent = new Date(now - 60 * 1000).toISOString();
  const status = scheduler.computeProviderStatus(recent, now);
  assert.strictEqual(status.status, 'online');
});

test('Provider status - degraded when 2-10 min ago', () => {
  const now = Date.now();
  const degraded = new Date(now - 5 * 60 * 1000).toISOString();
  const status = scheduler.computeProviderStatus(degraded, now);
  assert.strictEqual(status.status, 'degraded');
});

test('Provider status - offline when > 10 min ago', () => {
  const now = Date.now();
  const old = new Date(now - 15 * 60 * 1000).toISOString();
  const status = scheduler.computeProviderStatus(old, now);
  assert.strictEqual(status.status, 'offline');
});

test('Provider status - offline when no heartbeat', () => {
  const status = scheduler.computeProviderStatus(null);
  assert.strictEqual(status.status, 'offline');
});

// ─── PROVIDER SCORING ───

test('Provider scoring - online > degraded', () => {
  const now = Date.now();
  const onlineProvider = {
    id: 1,
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const degradedProvider = {
    id: 2,
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 5 * 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };
  const onlineScore = scheduler.scoreProvider(onlineProvider, jobReq);
  const degradedScore = scheduler.scoreProvider(degradedProvider, jobReq);

  assert(onlineScore > degradedScore);
});

test('Provider scoring - zero for offline', () => {
  const offlineProvider = {
    id: 1,
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };
  const score = scheduler.scoreProvider(offlineProvider, jobReq);
  assert.strictEqual(score, 0);
});

test('Provider scoring - zero for insufficient VRAM', () => {
  const provider = {
    id: 1,
    gpu_model: 'A100',
    vram_gb: 8,
    last_heartbeat: new Date().toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const jobReq = { min_vram_gb: 40, gpu_type: 'A100' };
  const score = scheduler.scoreProvider(provider, jobReq);
  assert.strictEqual(score, 0);
});

test('Provider scoring - zero for GPU mismatch', () => {
  const provider = {
    id: 1,
    gpu_model: 'CPU',
    vram_gb: 40,
    last_heartbeat: new Date().toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };
  const score = scheduler.scoreProvider(provider, jobReq);
  assert.strictEqual(score, 0);
});

test('Provider scoring - cheaper provider scores higher', () => {
  const now = Date.now();
  const baseProvider = {
    id: 1,
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 5,
  };

  const expensiveProvider = {
    id: 2,
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 20,
  };

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };
  const cheapScore = scheduler.scoreProvider(baseProvider, jobReq);
  const expensiveScore = scheduler.scoreProvider(expensiveProvider, jobReq);

  assert(cheapScore > expensiveScore);
});

// ─── FINDING PROVIDERS ───

test('Find matching providers - single match', () => {
  resetDb();
  createTestProvider({ name: 'ProviderA', gpu_model: 'A100' });
  createTestProvider({ name: 'ProviderB', gpu_model: 'H100' });

  const matches = scheduler.findMatchingProviders({ gpu_type: 'A100', min_vram_gb: 8 });

  assert(matches.length > 0);
  assert.strictEqual(matches[0].provider.gpu_model, 'A100');
});

test('Find matching providers - no matches', () => {
  resetDb();
  createTestProvider({ gpu_model: 'CPU' });

  const matches = scheduler.findMatchingProviders({ gpu_type: 'A100', min_vram_gb: 8 });
  assert.strictEqual(matches.length, 0);
});

test('Find matching providers - ranked by score', () => {
  resetDb();
  const now = Date.now();

  createTestProvider({
    name: 'SlowProvider',
    gpu_model: 'A100',
    last_heartbeat: new Date(now - 20 * 60 * 1000).toISOString(),
    uptime_percent: 50,
  });
  createTestProvider({
    name: 'FastProvider',
    gpu_model: 'A100',
    last_heartbeat: new Date(now - 30 * 1000).toISOString(),
    uptime_percent: 99,
  });

  const matches = scheduler.findMatchingProviders({ gpu_type: 'A100', min_vram_gb: 8 });

  assert(matches.length >= 1);
  assert.strictEqual(matches[0].provider.name, 'FastProvider');
});

test('Find best provider - success', () => {
  resetDb();
  createTestProvider({ name: 'Provider1', gpu_model: 'A100' });
  createTestProvider({ name: 'Provider2', gpu_model: 'H100' });

  const best = scheduler.findBestProvider({ gpu_type: 'A100', min_vram_gb: 8 });

  assert.ok(best);
  assert.strictEqual(best.provider.gpu_model, 'A100');
});

test('Find best provider - no match', () => {
  resetDb();
  const best = scheduler.findBestProvider({ gpu_type: 'A100', min_vram_gb: 8 });
  assert.strictEqual(best, null);
});

// ─── BATCH SCHEDULING ───

test('Batch scheduling - multiple jobs', () => {
  resetDb();
  createTestProvider({ name: 'Provider1' });
  createTestProvider({ name: 'Provider2' });

  const jobs = [
    { min_vram_gb: 8, gpu_type: 'A100' },
    { min_vram_gb: 8, gpu_type: 'A100' },
  ];

  const results = scheduler.scheduleMultipleJobs(jobs);

  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].reason, 'assigned');
});

test('Batch scheduling - impossible requirements', () => {
  resetDb();
  createTestProvider({ gpu_model: 'A100' });

  const jobs = [
    { min_vram_gb: 8, gpu_type: 'A100' },
    { min_vram_gb: 100, gpu_type: 'A100' },
  ];

  const results = scheduler.scheduleMultipleJobs(jobs);

  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].reason, 'assigned');
  assert.strictEqual(results[1].reason, 'no_matching_providers');
});

// ─── DIAGNOSTIC REPORTS ───

test('Scheduling report - generation', () => {
  resetDb();
  createTestProvider({ name: 'Provider1' });

  const report = scheduler.getSchedulingReport({ gpu_type: 'A100', min_vram_gb: 8 });

  assert.ok(report.job_requirements);
  assert.ok(typeof report.total_matching_providers === 'number');
  assert.ok(Array.isArray(report.top_candidates));
});

// ─── EDGE CASES ───

test('Edge case - normalize GPU model', () => {
  const normalized = scheduler.normalizeGpuModel('rtx-4090');
  assert.strictEqual(normalized, 'RTX-4090');
});

test('Edge case - null GPU model', () => {
  const normalized = scheduler.normalizeGpuModel(null);
  assert.strictEqual(normalized, null);
});

test('Edge case - mib-based VRAM', () => {
  resetDb();
  createTestProvider({
    gpu_vram_mib: 40960,
    vram_gb: null,
  });

  const matches = scheduler.findMatchingProviders({ min_vram_gb: 8 });
  assert(matches.length > 0);
  assert.ok(matches[0].matchDetails.provider_vram_gb > 0);
});

test('Edge case - fallback cost rate', () => {
  resetDb();
  createTestProvider({ price_per_min_halala: null });

  const matches = scheduler.findMatchingProviders({}, 15);
  assert(matches.length > 0);
  assert.strictEqual(matches[0].matchDetails.effective_price_halala, 15);
});
