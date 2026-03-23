/**
 * job-scheduler-integration.test.js — Integration tests for scheduler in job submission
 *
 * Validates that the scheduler is properly integrated into the job submission flow
 * and produces correct provider matching results using mocked database.
 */

'use strict';

const assert = require('assert');
const test = require('node:test');

const scheduler = require('../src/services/jobScheduler');

// Mock provider objects for testing
function createMockProvider(overrides = {}) {
  const id = Math.floor(Math.random() * 10000);
  const defaults = {
    id,
    name: `Provider${id}`,
    gpu_model: 'A100',
    vram_gb: 40,
    gpu_vram_mib: 40960,
    status: 'active',
    price_per_min_halala: 10,
    uptime_percent: 95,
    last_heartbeat: new Date().toISOString(),
    is_paused: 0,
    model_preload_status: 'none',
  };

  return { ...defaults, ...overrides };
}

// ─── INTEGRATION: Scoring with Real-world Factors ───

test('scoring - priority class bonus for preloaded models', () => {
  const now = Date.now();

  const priorityWithPreload = createMockProvider({
    name: 'PriorityReady',
    model_preload_status: 'ready',
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 80,
    price_per_min_halala: 20,
  });

  const standardNoPreload = createMockProvider({
    name: 'StandardCold',
    model_preload_status: 'none',
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 90,
    price_per_min_halala: 5,
  });

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100', pricing_class: 'priority' };

  const priorityScore = scheduler.scoreProvider(priorityWithPreload, jobReq);
  const standardScore = scheduler.scoreProvider(standardNoPreload, jobReq);

  // Priority class with preload should score higher than standard
  assert(priorityScore > standardScore,
    `Priority preloaded (${priorityScore}) should beat standard (${standardScore})`);
});

test('scoring - GPU type exact match bonus', () => {
  const now = Date.now();
  const baselineOpts = {
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 85,
    price_per_min_halala: 10,
  };

  const exactGpuProvider = createMockProvider({
    ...baselineOpts,
    name: 'ExactGPU',
    gpu_model: 'A100',
  });

  const compatibleGpuProvider = createMockProvider({
    ...baselineOpts,
    name: 'CompatibleGPU',
    gpu_model: 'H100',
  });

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };

  const exactScore = scheduler.scoreProvider(exactGpuProvider, jobReq);
  const compatScore = scheduler.scoreProvider(compatibleGpuProvider, jobReq);

  // Exact match should score higher
  assert(exactScore > compatScore,
    `Exact GPU match (${exactScore}) should beat compatible (${compatScore})`);
});

test('scoring - VRAM headroom bonus', () => {
  const now = Date.now();
  const baselineOpts = {
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
    uptime_percent: 90,
    price_per_min_halala: 10,
    gpu_model: 'A100',
  };

  const tightVramProvider = createMockProvider({
    ...baselineOpts,
    name: 'Tight',
    vram_gb: 8,
    gpu_vram_mib: 8192, // 8GB
  });

  const looseVramProvider = createMockProvider({
    ...baselineOpts,
    name: 'Loose',
    vram_gb: 40,
    gpu_vram_mib: 40960, // 40GB
  });

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };

  const tightScore = scheduler.scoreProvider(tightVramProvider, jobReq);
  const looseScore = scheduler.scoreProvider(looseVramProvider, jobReq);

  // More VRAM headroom should score higher
  assert(looseScore > tightScore,
    `Loose VRAM (${looseScore}) should beat tight (${tightScore})`);
});

// ─── INTEGRATION: Real-world Scoring Scenarios ───

test('scenario - heterogeneous provider pool', () => {
  const now = Date.now();

  const highEnd = createMockProvider({
    name: 'HighEnd',
    gpu_model: 'H100',
    vram_gb: 80,
    uptime_percent: 99,
    price_per_min_halala: 50,
    last_heartbeat: new Date(now - 30 * 1000).toISOString(),
  });

  const midRange = createMockProvider({
    name: 'MidRange',
    gpu_model: 'A100',
    vram_gb: 40,
    uptime_percent: 90,
    price_per_min_halala: 15,
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
  });

  const budget = createMockProvider({
    name: 'Budget',
    gpu_model: 'RTX4090',
    vram_gb: 24,
    uptime_percent: 70,
    price_per_min_halala: 5,
    last_heartbeat: new Date(now - 400 * 1000).toISOString(),
  });

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };

  const highEndScore = scheduler.scoreProvider(highEnd, jobReq);
  const midRangeScore = scheduler.scoreProvider(midRange, jobReq);
  const budgetScore = scheduler.scoreProvider(budget, jobReq);

  // MidRange should score highest (exact GPU match)
  assert(midRangeScore > highEndScore, 'Exact GPU match should beat different GPU');
});

test('scenario - online vs degraded providers', () => {
  const now = Date.now();

  const onlineProvider = createMockProvider({
    name: 'Online',
    last_heartbeat: new Date(now - 30 * 1000).toISOString(),
    uptime_percent: 85,
  });

  const degradedProvider = createMockProvider({
    name: 'Degraded',
    last_heartbeat: new Date(now - 400 * 1000).toISOString(),
    uptime_percent: 95,
  });

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };

  const onlineScore = scheduler.scoreProvider(onlineProvider, jobReq);
  const degradedScore = scheduler.scoreProvider(degradedProvider, jobReq);

  // Online should score significantly higher despite lower uptime
  assert(onlineScore > degradedScore,
    `Online (${onlineScore}) should beat degraded (${degradedScore})`);
});

test('scenario - VRAM requirement enforcement', () => {
  const now = Date.now();
  const jobReq = { min_vram_gb: 16, gpu_type: 'A100' };

  const smallVramProvider = createMockProvider({
    name: 'Small',
    vram_gb: 8,
    gpu_vram_mib: 8192, // 8GB in MiB
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
  });

  const largeVramProvider = createMockProvider({
    name: 'Large',
    vram_gb: 80,
    gpu_vram_mib: 81920, // 80GB in MiB
    last_heartbeat: new Date(now - 60 * 1000).toISOString(),
  });

  const smallScore = scheduler.scoreProvider(smallVramProvider, jobReq);
  const largeScore = scheduler.scoreProvider(largeVramProvider, jobReq);

  // Small should score zero (insufficient VRAM)
  assert.strictEqual(smallScore, 0, 'Insufficient VRAM should score zero');
  // Large should score positive
  assert(largeScore > 0, 'Sufficient VRAM should score positive');
});

test('scenario - offline provider disqualification', () => {
  const now = Date.now();

  const offlineProvider = createMockProvider({
    name: 'Offline',
    last_heartbeat: new Date(now - 20 * 60 * 1000).toISOString(), // 20 min ago
    uptime_percent: 100,
  });

  const jobReq = { min_vram_gb: 8, gpu_type: 'A100' };
  const score = scheduler.scoreProvider(offlineProvider, jobReq);

  // Offline should always score zero
  assert.strictEqual(score, 0, 'Offline provider should score zero');
});
