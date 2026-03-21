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
  try { db.run('DELETE FROM jobs'); } catch (_) {}
  try { db.run('DELETE FROM providers'); } catch (_) {}
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
    expect(res.body.providers).toBeDefined();
    expect(res.body.jobs).toBeDefined();
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
