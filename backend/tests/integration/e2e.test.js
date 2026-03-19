/**
 * DCP-208: End-to-end integration tests
 * Covers:
 * 1) Provider registers -> heartbeat -> job assigned -> completed -> earnings credited
 * 2) Renter registers -> submits job -> billed
 * 3) Admin dashboard sees users + jobs
 */

'use strict';

const express = require('express');
const request = require('supertest');
const { cleanDb, registerProvider, registerRenter, bringOnline, db } = require('./helpers');

function createApp() {
  const app = express();
  app.use(express.json());

  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters', require('../../src/routes/renters'));
  app.use('/api/jobs', require('../../src/routes/jobs'));
  app.use('/api/admin', require('../../src/routes/admin'));

  return app;
}

const app = createApp();
const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN || 'test-admin-token-jest';

beforeEach(() => cleanDb());

describe('E2E integration: register -> job -> payment', () => {
  test('provider pipeline credits earnings after completion', async () => {
    const providerReg = await registerProvider(request, app, {
      name: 'E2E Provider',
      gpu_model: 'RTX 4090',
      os: 'Linux',
    });
    expect(providerReg.status).toBe(200);
    expect(providerReg.apiKey).toMatch(/^dc1-provider-/);

    const heartbeatRes = await bringOnline(request, app, providerReg.apiKey);
    expect(heartbeatRes.status).toBe(200);
    expect(heartbeatRes.body.success).toBe(true);

    const renterReg = await registerRenter(request, app, { balanceHalala: 50_000 });
    expect(renterReg.status).toBe(201);

    const submitRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterReg.apiKey)
      .send({
        provider_id: providerReg.providerId,
        job_type: 'training',
        duration_minutes: 60,
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.job.status).toBe('pending');
    expect(submitRes.body.job.cost_halala).toBe(1500); // 25 halala/min * 60

    const jobId = submitRes.body.job.job_id;

    const assignedRes = await request(app).get(`/api/jobs/assigned?key=${providerReg.apiKey}`);
    expect(assignedRes.status).toBe(200);
    expect(assignedRes.body.job.job_id).toBe(jobId);
    expect(assignedRes.body.job.status).toBe('assigned');

    const resultRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerReg.apiKey)
      .send({
        result: 'training complete',
        duration_seconds: 3600,
      });

    expect(resultRes.status).toBe(200);
    expect(resultRes.body.success).toBe(true);
    expect(resultRes.body.billing.actual_cost_halala).toBe(1500);
    expect(resultRes.body.billing.provider_earned_halala).toBe(1125);
    expect(resultRes.body.billing.dc1_fee_halala).toBe(375);

    const provider = db.get(
      'SELECT total_jobs, claimable_earnings_halala, total_earnings_halala FROM providers WHERE id = ?',
      providerReg.providerId
    );
    expect(provider.total_jobs).toBe(1);
    expect(provider.claimable_earnings_halala).toBe(1125);
    expect(provider.total_earnings_halala).toBe(1125);
  });

  test('renter registration + submit charges renter balance', async () => {
    const providerReg = await registerProvider(request, app, {
      name: 'Billing Provider',
      gpu_model: 'RTX 4090',
      os: 'Linux',
    });
    await bringOnline(request, app, providerReg.apiKey);

    const renterReg = await registerRenter(request, app, { balanceHalala: 10_000 });
    expect(renterReg.status).toBe(201);

    const before = db.get('SELECT balance_halala FROM renters WHERE id = ?', renterReg.renterId);

    const submitRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterReg.apiKey)
      .send({
        provider_id: providerReg.providerId,
        job_type: 'llm_inference',
        duration_minutes: 10,
        params: { prompt: 'hello', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.success).toBe(true);

    const billed = submitRes.body.job.cost_halala;
    const after = db.get('SELECT balance_halala, total_jobs FROM renters WHERE id = ?', renterReg.renterId);

    expect(billed).toBe(150); // 15 halala/min * 10
    expect(after.balance_halala).toBe(before.balance_halala - billed);
    expect(after.total_jobs).toBeGreaterThanOrEqual(1);
  });

  test('admin dashboard reflects users and jobs', async () => {
    const providerReg = await registerProvider(request, app, {
      name: 'Admin Seen Provider',
      gpu_model: 'RTX 3090',
      os: 'Linux',
    });
    await bringOnline(request, app, providerReg.apiKey);

    const renterReg = await registerRenter(request, app, { balanceHalala: 50_000 });

    const submitRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterReg.apiKey)
      .send({
        provider_id: providerReg.providerId,
        job_type: 'training',
        duration_minutes: 5,
      });
    expect(submitRes.status).toBe(201);

    const dashboardRes = await request(app)
      .get('/api/admin/dashboard')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.body.stats).toBeDefined();
    expect(dashboardRes.body.stats.total_providers).toBeGreaterThanOrEqual(1);
    expect(dashboardRes.body.stats.total_renters).toBeGreaterThanOrEqual(1);
    expect(dashboardRes.body.stats.total_jobs).toBeGreaterThanOrEqual(1);

    const hasProvider = dashboardRes.body.recent_signups.some((p) => p.id === providerReg.providerId);
    expect(hasProvider).toBe(true);
  });
});
