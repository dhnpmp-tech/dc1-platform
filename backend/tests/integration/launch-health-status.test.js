'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';

const express = require('express');
const request = require('supertest');
const db = require('../../src/db');
const { getSweepMetrics } = require('../../src/services/jobSweep');

function createLaunchCheckApp() {
  const app = express();
  app.use(express.json());

  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/sync', require('../../src/routes/sync'));
  app.use('/api/fallback', require('../../src/routes/fallback'));

  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      const sweep = getSweepMetrics();
      const providersTotal = db.prepare('SELECT COUNT(*) AS count FROM providers').get()?.count || 0;
      const providersOnline = db.prepare("SELECT COUNT(*) AS count FROM providers WHERE status = 'online'").get()?.count || 0;
      const jobsQueued = db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status = 'queued'").get()?.count || 0;
      const jobsRunning = db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status = 'running'").get()?.count || 0;

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        db: 'ok',
        providers: { total: providersTotal, online: providersOnline },
        jobs: { queued: jobsQueued, running: jobsRunning },
        sweepErrors: sweep.sweepErrors,
      });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Health check failed' });
    }
  });

  return app;
}

function cleanDb() {
  try { db.prepare('DELETE FROM jobs').run(); } catch (_) {}
  try { db.prepare('DELETE FROM providers').run(); } catch (_) {}
}

describe('Launch readiness health/status endpoints', () => {
  let app;

  beforeAll(() => {
    app = createLaunchCheckApp();
  });

  beforeEach(() => {
    cleanDb();
  });

  afterAll(() => {
    cleanDb();
  });

  test('GET /api/health returns status ok payload', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
    expect(res.body.providers).toBeDefined();
    expect(res.body.jobs).toBeDefined();
    expect(typeof res.body.providers.total).toBe('number');
    expect(typeof res.body.providers.online).toBe('number');
    expect(typeof res.body.jobs.queued).toBe('number');
    expect(typeof res.body.jobs.running).toBe('number');
    expect(typeof res.body.sweepErrors).toBe('number');
  });

  test('GET /api/health reflects provider/job counters from DB state', async () => {
    const nowIso = new Date().toISOString();
    db.prepare(
      `INSERT INTO providers (name, email, api_key, gpu_model, os, status, last_heartbeat, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('Health Provider 1', `health-p1-${Date.now()}@dcp.test`, `dc1-provider-health-1-${Date.now()}`, 'RTX 4090', 'linux', 'online', nowIso, nowIso, nowIso);
    db.prepare(
      `INSERT INTO providers (name, email, api_key, gpu_model, os, status, last_heartbeat, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('Health Provider 2', `health-p2-${Date.now()}@dcp.test`, `dc1-provider-health-2-${Date.now()}`, 'RTX 3090', 'linux', 'offline', nowIso, nowIso, nowIso);

    db.prepare(
      `INSERT INTO jobs (job_id, status, created_at)
       VALUES (?, ?, ?)`
    ).run(`job-health-queued-${Date.now()}`, 'queued', nowIso);
    db.prepare(
      `INSERT INTO jobs (job_id, status, created_at)
       VALUES (?, ?, ?)`
    ).run(`job-health-running-${Date.now()}`, 'running', nowIso);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.providers.total).toBe(2);
    expect(res.body.providers.online).toBe(1);
    expect(res.body.jobs.queued).toBe(1);
    expect(res.body.jobs.running).toBe(1);
  });

  test('GET /api/providers/available responds with JSON list', async () => {
    const res = await request(app).get('/api/providers/available');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.providers)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.online_count).toBe('number');
    expect(typeof res.body.degraded_count).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
    expect(res.body.total).toBe(res.body.providers.length);
  });

  test('GET /api/sync/status responds with JSON object', async () => {
    const res = await request(app).get('/api/sync/status');

    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
  });

  test('GET /api/fallback/status responds with JSON object', async () => {
    const res = await request(app).get('/api/fallback/status');

    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
  });
});
