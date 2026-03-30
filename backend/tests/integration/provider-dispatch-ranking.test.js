'use strict';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key-stub';

const request = require('supertest');
const express = require('express');
const db = require('../../src/db');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/renters', require('../../src/routes/renters'));
  return app;
}

function resetTables() {
  const safeDelete = (table) => {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch (_) {}
  };

  try { db.prepare('PRAGMA foreign_keys = OFF').run(); } catch (_) {}
  for (const table of ['jobs', 'provider_dispatch_samples', 'providers']) {
    safeDelete(table);
  }
  try { db.prepare('PRAGMA foreign_keys = ON').run(); } catch (_) {}
}

function insertProvider({
  name,
  dispatchScore,
  dispatchSuccessRate,
  dispatchP50,
  dispatchP95,
  dispatchSamples,
  vramMib,
}) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO providers (
      name, email, gpu_model, status, is_paused, last_heartbeat,
      gpu_vram_mib, reliability_score,
      dispatch_latency_p50_ms, dispatch_latency_p95_ms,
      dispatch_success_rate, dispatch_sample_count, dispatch_score,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'online', 0, ?, ?, 90, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name,
    `${name.toLowerCase()}@dc1.test`,
    'RTX 4090',
    now,
    vramMib,
    dispatchP50,
    dispatchP95,
    dispatchSuccessRate,
    dispatchSamples,
    dispatchScore,
    now,
    now
  );
}

describe('GET /api/renters/available-providers dispatch ranking', () => {
  const app = createApp();

  beforeEach(() => {
    resetTables();
  });

  afterAll(() => {
    resetTables();
  });

  test('orders providers by dispatch score and exposes ranking fields', async () => {
    insertProvider({
      name: 'slow-provider',
      dispatchScore: 61.2,
      dispatchSuccessRate: 0.93,
      dispatchP50: 1400,
      dispatchP95: 3900,
      dispatchSamples: 30,
      vramMib: 49152,
    });

    insertProvider({
      name: 'fast-provider',
      dispatchScore: 92.7,
      dispatchSuccessRate: 0.99,
      dispatchP50: 220,
      dispatchP95: 760,
      dispatchSamples: 45,
      vramMib: 24576,
    });

    insertProvider({
      name: 'mid-provider',
      dispatchScore: 80.5,
      dispatchSuccessRate: 0.97,
      dispatchP50: 540,
      dispatchP95: 1700,
      dispatchSamples: 38,
      vramMib: 49152,
    });

    const res = await request(app).get('/api/renters/available-providers?discovery=sqlite');
    expect(res.status).toBe(200);

    const providerNames = res.body.providers.map((provider) => provider.name);
    expect(providerNames).toEqual(['fast-provider', 'mid-provider', 'slow-provider']);

    const [first] = res.body.providers;
    expect(first.dispatch_ranking).toMatchObject({
      score: 92.7,
      success_rate: 0.99,
      latency_p50_ms: 220,
      latency_p95_ms: 760,
      sample_count: 45,
    });
  });
});
