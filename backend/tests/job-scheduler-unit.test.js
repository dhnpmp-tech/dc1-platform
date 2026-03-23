/**
 * job-scheduler-unit.test.js — Pure unit tests for jobScheduler (no database)
 *
 * Tests the core scheduling algorithms without database dependency.
 * This allows testing the pure logic of GPU matching, scoring, and provider ranking.
 */

'use strict';

const assert = require('assert');
const test = require('node:test');

// Import just the utility functions we need (not db-dependent functions)
const scheduler = require('../src/services/jobScheduler');

// ─── GPU TYPE MATCHING ───

test('matchGpuType - exact match', () => {
  const match = scheduler.matchGpuType('A100', 'A100');
  assert.strictEqual(match.matched, true);
  assert.strictEqual(match.exactMatch, true);
});

test('matchGpuType - case insensitive', () => {
  const match = scheduler.matchGpuType('a100', 'A100');
  assert.strictEqual(match.matched, true);
  assert.strictEqual(match.exactMatch, true);
});

test('matchGpuType - no requirement accepts any GPU', () => {
  const match = scheduler.matchGpuType(null, 'A100');
  assert.strictEqual(match.matched, true);
  assert.strictEqual(match.exactMatch, true);
  assert.strictEqual(match.reason, 'no_requirement');
});

test('matchGpuType - incompatible GPU type', () => {
  const match = scheduler.matchGpuType('A100', 'CPU');
  assert.strictEqual(match.matched, false);
  assert.strictEqual(match.exactMatch, false);
  assert.strictEqual(match.reason, 'no_match');
});

test('matchGpuType - compatibility fallback chain', () => {
  // H100 should be compatible with A100 requirement
  const match = scheduler.matchGpuType('A100', 'H100');
  assert.strictEqual(match.matched, true);
  assert.strictEqual(match.exactMatch, false);
  assert.strictEqual(match.reason, 'compatible_fallback');
});

test('matchGpuType - unknown provider GPU', () => {
  const match = scheduler.matchGpuType('A100', null);
  assert.strictEqual(match.matched, false);
  assert.strictEqual(match.reason, 'provider_gpu_unknown');
});

test('matchGpuType - whitespace handling', () => {
  const match = scheduler.matchGpuType(' A100 ', '  A100  ');
  assert.strictEqual(match.matched, true);
  assert.strictEqual(match.exactMatch, true);
});

test('matchGpuType - RTX model compatibility', () => {
  // RTX4090 should fallback to A100 if needed
  const match = scheduler.matchGpuType('A100', 'RTX4090');
  assert.strictEqual(match.matched, true);
});

// ─── MEMORY MATCHING ───

test('matchMemoryRequirement - exact match', () => {
  const match = scheduler.matchMemoryRequirement(8, 8);
  assert.strictEqual(match.satisfied, true);
});

test('matchMemoryRequirement - provider has more', () => {
  const match = scheduler.matchMemoryRequirement(8, 16);
  assert.strictEqual(match.satisfied, true);
});

test('matchMemoryRequirement - provider has less', () => {
  const match = scheduler.matchMemoryRequirement(16, 8);
  assert.strictEqual(match.satisfied, false);
});

test('matchMemoryRequirement - zero requirement', () => {
  const match = scheduler.matchMemoryRequirement(0, 8);
  assert.strictEqual(match.satisfied, true);
});

test('matchMemoryRequirement - null requirement', () => {
  const match = scheduler.matchMemoryRequirement(null, 8);
  assert.strictEqual(match.satisfied, true);
});

test('matchMemoryRequirement - null provider VRAM', () => {
  const match = scheduler.matchMemoryRequirement(8, null);
  assert.strictEqual(match.satisfied, false);
});

test('matchMemoryRequirement - both null', () => {
  const match = scheduler.matchMemoryRequirement(null, null);
  assert.strictEqual(match.satisfied, true);
});

test('matchMemoryRequirement - returns provider VRAM info', () => {
  const match = scheduler.matchMemoryRequirement(8, 40);
  assert.strictEqual(match.providerVramGb, 40);
  assert.strictEqual(match.requiredVramGb, 8);
});

// ─── PROVIDER STATUS ───

test('computeProviderStatus - online threshold', () => {
  const now = Date.now();
  const oneMinAgo = new Date(now - 60 * 1000).toISOString();
  const status = scheduler.computeProviderStatus(oneMinAgo, now);
  assert.strictEqual(status.status, 'online');
  assert(status.ageSecs < 120);
});

test('computeProviderStatus - degraded threshold', () => {
  const now = Date.now();
  const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString();
  const status = scheduler.computeProviderStatus(fiveMinAgo, now);
  assert.strictEqual(status.status, 'degraded');
  assert(status.ageSecs >= 120);
  assert(status.ageSecs < 600);
});

test('computeProviderStatus - offline threshold', () => {
  const now = Date.now();
  const fifteenMinAgo = new Date(now - 15 * 60 * 1000).toISOString();
  const status = scheduler.computeProviderStatus(fifteenMinAgo, now);
  assert.strictEqual(status.status, 'offline');
  assert(status.ageSecs >= 600);
});

test('computeProviderStatus - no heartbeat', () => {
  const status = scheduler.computeProviderStatus(null);
  assert.strictEqual(status.status, 'offline');
  assert.strictEqual(status.ageSecs, Infinity);
});

test('computeProviderStatus - boundary at 2 min', () => {
  const now = Date.now();
  const exactly2MinAgo = new Date(now - 120 * 1000).toISOString();
  const status = scheduler.computeProviderStatus(exactly2MinAgo, now);
  // At exactly 120 seconds, should transition from online to degraded
  assert.strictEqual(status.status, 'degraded');
});

test('computeProviderStatus - boundary at 10 min', () => {
  const now = Date.now();
  const exactly10MinAgo = new Date(now - 600 * 1000).toISOString();
  const status = scheduler.computeProviderStatus(exactly10MinAgo, now);
  // At exactly 600 seconds, should transition from degraded to offline
  assert.strictEqual(status.status, 'offline');
});

// ─── PROVIDER SCORING ───

test('scoreProvider - online status', () => {
  const now = Date.now();
  const provider = {
    id: 1,
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };
  const score = scheduler.scoreProvider(provider, jobReq);

  assert(score > 0, 'Online provider should have positive score');
});

test('scoreProvider - online scores higher than degraded', () => {
  const now = Date.now();

  const onlineProvider = {
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const degradedProvider = {
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 5 * 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };
  const onlineScore = scheduler.scoreProvider(onlineProvider, jobReq);
  const degradedScore = scheduler.scoreProvider(degradedProvider, jobReq);

  assert(onlineScore > degradedScore, 'Online should score higher than degraded');
  assert(degradedScore > 0, 'Degraded should still have positive score');
});

test('scoreProvider - offline returns zero', () => {
  const offlineProvider = {
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };
  const score = scheduler.scoreProvider(offlineProvider, jobReq);

  assert.strictEqual(score, 0, 'Offline provider should score zero');
});

test('scoreProvider - insufficient VRAM returns zero', () => {
  const provider = {
    gpu_model: 'A100',
    vram_gb: 8,
    last_heartbeat: new Date().toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const jobReq = { min_vram_gb: 40, gpu_type: 'A100' };
  const score = scheduler.scoreProvider(provider, jobReq);

  assert.strictEqual(score, 0, 'Insufficient VRAM should return zero score');
});

test('scoreProvider - GPU mismatch returns zero', () => {
  const provider = {
    gpu_model: 'CPU',
    vram_gb: 40,
    last_heartbeat: new Date().toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };
  const score = scheduler.scoreProvider(provider, jobReq);

  assert.strictEqual(score, 0, 'GPU mismatch should return zero score');
});

test('scoreProvider - cheaper provider scores higher', () => {
  const now = Date.now();
  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };

  const cheapProvider = {
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 5,
  };

  const expensiveProvider = {
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 20,
  };

  const cheapScore = scheduler.scoreProvider(cheapProvider, jobReq);
  const expensiveScore = scheduler.scoreProvider(expensiveProvider, jobReq);

  assert(cheapScore > expensiveScore, 'Cheaper provider should score higher');
});

test('scoreProvider - higher uptime scores higher', () => {
  const now = Date.now();
  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };

  const reliableProvider = {
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 99,
    price_per_min_halala: 10,
  };

  const unreliableProvider = {
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 50,
    price_per_min_halala: 10,
  };

  const reliableScore = scheduler.scoreProvider(reliableProvider, jobReq);
  const unreliableScore = scheduler.scoreProvider(unreliableProvider, jobReq);

  assert(reliableScore > unreliableScore, 'Higher uptime should score higher');
});

test('scoreProvider - VRAM headroom bonus', () => {
  const now = Date.now();
  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };

  const tightVramProvider = {
    gpu_model: 'A100',
    vram_gb: 8,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const looseVramProvider = {
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const tightScore = scheduler.scoreProvider(tightVramProvider, jobReq);
  const looseScore = scheduler.scoreProvider(looseVramProvider, jobReq);

  assert(looseScore > tightScore, 'Provider with more VRAM headroom should score higher');
});

test('scoreProvider - exact GPU match vs compatible fallback', () => {
  const now = Date.now();
  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };

  const exactMatchProvider = {
    gpu_model: 'A100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const compatibleProvider = {
    gpu_model: 'H100',
    vram_gb: 40,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 95,
    price_per_min_halala: 10,
  };

  const exactScore = scheduler.scoreProvider(exactMatchProvider, jobReq);
  const compatibleScore = scheduler.scoreProvider(compatibleProvider, jobReq);

  assert(exactScore > compatibleScore, 'Exact GPU match should score higher than fallback');
});

// ─── UTILITY FUNCTIONS ───

test('normalizeGpuModel - uppercase conversion', () => {
  const normalized = scheduler.normalizeGpuModel('a100');
  assert.strictEqual(normalized, 'A100');
});

test('normalizeGpuModel - whitespace trimming', () => {
  const normalized = scheduler.normalizeGpuModel('  A100  ');
  assert.strictEqual(normalized, 'A100');
});

test('normalizeGpuModel - special characters preserved', () => {
  const normalized = scheduler.normalizeGpuModel('rtx-4090');
  assert.strictEqual(normalized, 'RTX-4090');
});

test('normalizeGpuModel - null input', () => {
  const normalized = scheduler.normalizeGpuModel(null);
  assert.strictEqual(normalized, null);
});

test('normalizeGpuModel - empty string becomes null', () => {
  const normalized = scheduler.normalizeGpuModel('');
  // Empty string after trim is falsy, returns null
  assert.strictEqual(normalized, null);
});

// ─── CONSTANTS ───

test('exports GPU compatibility map', () => {
  assert.ok(scheduler.GPU_COMPATIBILITY);
  assert.ok(scheduler.GPU_COMPATIBILITY['A100']);
  assert.ok(Array.isArray(scheduler.GPU_COMPATIBILITY['A100']));
});

test('exports heartbeat thresholds', () => {
  assert.strictEqual(scheduler.HEARTBEAT_ONLINE_THRESHOLD_S, 120);
  assert.strictEqual(scheduler.HEARTBEAT_DEGRADED_THRESHOLD_S, 600);
});

// ─── GPU TYPE REGRESSION GUARDS ───

test('matchGpuType - ML model name as gpu_type never matches real GPU (regression 66a4c60)', () => {
  // HuggingFace model names (e.g. "meta-llama/Llama-3-8b-instruct") must NOT be
  // used as gpu_type — they will never match any real provider GPU, causing all
  // providers to be silently disqualified. jobs.js now uses gpu_requirements.gpu_type
  // (hardware filter) instead of normalizeModelField(requestedModel) (ML model name).
  const match = scheduler.matchGpuType('meta-llama/Llama-3-8b-instruct', 'RTX 4090');
  assert.strictEqual(match.matched, false);
  assert.strictEqual(match.reason, 'no_match');
});

test('matchGpuType - null gpu_type accepts any provider GPU (no hardware filter)', () => {
  // When callers omit gpu_requirements.gpu_type, jobs.js passes null, meaning
  // any provider with sufficient VRAM is acceptable — hardware-agnostic job.
  const match = scheduler.matchGpuType(null, 'RTX 4090');
  assert.strictEqual(match.matched, true);
  assert.strictEqual(match.reason, 'no_requirement');
});

test('matchGpuType - another ML model name with slashes does not match GPU', () => {
  const match = scheduler.matchGpuType('mistralai/Mistral-7B-Instruct-v0.3', 'A100');
  assert.strictEqual(match.matched, false);
});

// ─── COMPLEX SCORING SCENARIOS ───

test('scoring scenario - multiple factors combined', () => {
  const now = Date.now();

  // Ideal provider: online, high uptime, cheap, exact GPU match, lots of VRAM
  const idealProvider = {
    gpu_model: 'A100',
    vram_gb: 80,
    last_heartbeat: new Date(now - 30 * 1000).toISOString(),
    uptime_percent: 99,
    price_per_min_halala: 5,
  };

  // Marginal provider: degraded, medium uptime, expensive, compatible GPU, tight VRAM
  const marginalProvider = {
    gpu_model: 'H100',
    vram_gb: 8,
    last_heartbeat: new Date(now - 5 * 60 * 1000).toISOString(),
    uptime_percent: 70,
    price_per_min_halala: 30,
  };

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };
  const idealScore = scheduler.scoreProvider(idealProvider, jobReq);
  const marginalScore = scheduler.scoreProvider(marginalProvider, jobReq);

  assert(idealScore > marginalScore, 'Ideal provider should score higher than marginal');
  assert(idealScore > 5000, 'Ideal provider should score quite well');
  assert(marginalScore > 0, 'Marginal provider should still have positive score');
  // Marginal is degraded (not offline) so it can still score reasonably well
  assert(idealScore > marginalScore * 1.5, 'Ideal should score significantly higher');
});
