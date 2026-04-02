'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token';
if (!process.env.DISABLE_RATE_LIMIT) process.env.DISABLE_RATE_LIMIT = '1';

const express = require('express');
const cors = require('cors');
const request = require('supertest');
const { cleanDb, registerProvider, registerRenter, bringOnline, db } = require('./helpers');

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN;

function createAppWithAdmin() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters', require('../../src/routes/renters'));
  app.use('/api/jobs', require('../../src/routes/jobs'));
  app.use('/api/admin', require('../../src/routes/admin'));

  return app;
}

describe('DCP-357 conversion funnel contract', () => {
  let app;

  beforeAll(() => {
    app = createAppWithAdmin();
  });

  beforeEach(() => {
    cleanDb();
  });

  afterAll(() => {
    cleanDb();
  });

  test('captures provider and renter register stages with EN/AR locale + source attribution', async () => {
    const providerRes = await request(app)
      .post('/api/providers/register?utm_source=google&utm_medium=cpc&locale=ar-SA')
      .set('x-source-surface', 'provider_register_page')
      .send({
        name: 'Provider Contract Test',
        email: 'provider-contract@dc1.test',
        gpu_model: 'RTX 4090',
        os: 'Linux',
      });
    expect(providerRes.status).toBe(200);

    const renterRes = await request(app)
      .post('/api/renters/register?locale=en-US&utm_source=newsletter&utm_medium=email')
      .set('x-source-surface', 'renter_register_page')
      .send({
        name: 'Renter Contract Test',
        email: 'renter-contract@dc1.test',
      });
    expect(renterRes.status).toBe(201);

    const rows = db.prepare(
      `SELECT journey, stage, actor_id, locale, source_surface, utm_source, utm_medium
       FROM conversion_funnel_events
       WHERE stage IN ('view', 'register')
       ORDER BY journey, stage`
    ).all();

    const providerRegister = rows.find((row) => row.journey === 'provider' && row.stage === 'register');
    const providerView = rows.find((row) => row.journey === 'provider' && row.stage === 'view');
    const renterRegister = rows.find((row) => row.journey === 'renter' && row.stage === 'register');
    const renterView = rows.find((row) => row.journey === 'renter' && row.stage === 'view');

    expect(providerRegister).toBeTruthy();
    expect(providerView).toBeTruthy();
    expect(providerRegister.locale).toBe('ar');
    expect(providerRegister.source_surface).toBe('provider_register_page');
    expect(providerRegister.utm_source).toBe('google');
    expect(providerRegister.utm_medium).toBe('cpc');

    expect(renterRegister).toBeTruthy();
    expect(renterView).toBeTruthy();
    expect(renterRegister.locale).toBe('en');
    expect(renterRegister.source_surface).toBe('renter_register_page');
    expect(renterRegister.utm_source).toBe('newsletter');
    expect(renterRegister.utm_medium).toBe('email');
  });

  test('tracks provider/renter first_action and first_success transitions end-to-end', async () => {
    const { providerId, apiKey: providerKey } = await registerProvider(request, app, {
      name: 'Flow Provider',
      email: 'flow-provider@dc1.test',
      gpu_model: 'RTX 4090',
    });

    const hb = await bringOnline(request, app, providerKey);
    expect(hb.status).toBe(200);

    db.prepare('UPDATE providers SET approval_status = ? WHERE id = ?').run('approved', providerId);
    const bench = await request(app)
      .post(`/api/providers/${providerId}/benchmark-submit`)
      .set('x-provider-key', providerKey)
      .send({
        gpu_model: 'RTX 4090',
        vram_gb: 24,
        tflops: 950,
      });
    expect(bench.status).toBe(200);

    const { renterId, apiKey: renterKey } = await registerRenter(request, app, {
      name: 'Flow Renter',
      email: 'flow-renter@dc1.test',
      balanceHalala: 50_000,
    });

    const submit = await request(app)
      .post('/api/jobs/submit?utm_source=landing&utm_medium=organic&source_surface=renter_dashboard')
      .set('x-renter-key', renterKey)
      .set('accept-language', 'en-US,en;q=0.8')
      .send({
        provider_id: providerId,
        job_type: 'llm_inference',
        duration_minutes: 5,
        params: { prompt: 'hello', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
      });
    expect(submit.status).toBe(201);
    const jobId = submit.body.job.job_id;

    const assigned = await request(app).get(`/api/jobs/assigned?key=${providerKey}`);
    expect(assigned.status).toBe(200);

    const result = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'ok', duration_seconds: 60 });
    expect(result.status).toBe(200);

    const stageRows = db.prepare(
      `SELECT journey, stage, actor_id
       FROM conversion_funnel_events
       WHERE stage IN ('first_action', 'first_success')`
    ).all();

    expect(stageRows.some((row) => row.journey === 'provider' && row.stage === 'first_action' && row.actor_id === providerId)).toBe(true);
    expect(stageRows.some((row) => row.journey === 'provider' && row.stage === 'first_success' && row.actor_id === providerId)).toBe(true);
    expect(stageRows.some((row) => row.journey === 'renter' && row.stage === 'first_action' && row.actor_id === renterId)).toBe(true);
    expect(stageRows.some((row) => row.journey === 'renter' && row.stage === 'first_success' && row.actor_id === renterId)).toBe(true);
  });

  test('exposes unified conversion funnel report endpoint for operators', async () => {
    const { providerId } = await registerProvider(request, app, {
      name: 'Report Provider',
      email: 'report-provider@dc1.test',
      gpu_model: 'RTX 3090',
    });
    const { renterId } = await registerRenter(request, app, {
      name: 'Report Renter',
      email: 'report-renter@dc1.test',
    });

    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO conversion_funnel_events (
        event_id, occurred_at, journey, stage, actor_type, actor_id, actor_key,
        locale, language, source_surface, source_channel, success, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    );
    insert.run('seed-provider-register', now, 'provider', 'register', 'provider', providerId, `p:${providerId}`, 'ar', 'ar', 'provider_register_page', 'organic', now);
    insert.run('seed-provider-first-action', now, 'provider', 'first_action', 'provider', providerId, `p:${providerId}`, 'ar', 'ar', 'provider_register_page', 'organic', now);
    insert.run('seed-renter-register', now, 'renter', 'register', 'renter', renterId, `r:${renterId}`, 'en', 'en', 'renter_register_page', 'email', now);

    const report = await request(app)
      .get('/api/admin/analytics/conversion-funnel?since_days=30')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(report.status).toBe(200);
    expect(report.body.window_days).toBe(30);
    expect(Array.isArray(report.body.journeys)).toBe(true);
    expect(Array.isArray(report.body.attribution)).toBe(true);
    expect(Array.isArray(report.body.locale_source_segments)).toBe(true);

    const providerJourney = report.body.journeys.find((item) => item.journey === 'provider');
    expect(providerJourney).toBeTruthy();
    expect(providerJourney.stages.register).toBeGreaterThanOrEqual(1);
    expect(providerJourney.stages.first_action).toBeGreaterThanOrEqual(1);
  });
});
