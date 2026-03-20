'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token-jest';

const request = require('supertest');
const express = require('express');
const db = require('../../src/db');

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN;

function createApp() {
  const app = express();
  app.use(express.json());

  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters', require('../../src/routes/renters'));
  app.use('/api/admin', require('../../src/routes/admin'));

  return app;
}

const app = createApp();

function safeDelete(table) {
  try {
    db.prepare(`DELETE FROM ${table}`).run();
  } catch (_) {
    // Table may not exist in older schema snapshots.
  }
}

function cleanDb() {
  safeDelete('api_key_rotations');
  safeDelete('provider_gpu_telemetry');
  safeDelete('payments');
  safeDelete('heartbeat_log');
  safeDelete('jobs');
  safeDelete('renters');
  safeDelete('providers');
}

async function createRenter(overrides = {}) {
  const payload = {
    name: overrides.name || 'Smoke Renter',
    email: overrides.email || `renter-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
    organization: overrides.organization || 'DCP QA',
  };

  const res = await request(app).post('/api/renters/register').send(payload);
  if (res.status !== 201 || !res.body?.api_key) {
    throw new Error(`Renter registration failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    id: res.body.renter_id,
    apiKey: res.body.api_key,
    email: payload.email,
    organization: payload.organization,
  };
}

async function createProvider(overrides = {}) {
  const payload = {
    name: overrides.name || 'Smoke Provider',
    email: overrides.email || `provider-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
    gpu_model: overrides.gpu_model || 'RTX 4090',
    os: overrides.os || 'linux',
  };

  const res = await request(app).post('/api/providers/register').send(payload);
  if (res.status !== 200 || !res.body?.api_key) {
    throw new Error(`Provider registration failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    id: res.body.provider_id,
    apiKey: res.body.api_key,
    email: payload.email,
  };
}

beforeEach(() => {
  cleanDb();
});

afterAll(() => {
  cleanDb();
});

describe('Sprint 21 smoke: PDPL renter flows', () => {
  test('GET /api/renters/me/data-export returns required account export fields', async () => {
    const renter = await createRenter({ organization: 'PDPL Org' });

    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(
      `INSERT INTO payments (
        payment_id, renter_id, amount_sar, amount_halala, status,
        source_type, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      paymentId,
      renter.id,
      25,
      2500,
      'paid',
      'mada',
      'test topup',
      new Date().toISOString()
    );

    const exportRes = await request(app)
      .get('/api/renters/me/data-export')
      .set('x-renter-key', renter.apiKey);

    expect(exportRes.status).toBe(200);
    expect(exportRes.body).toHaveProperty('exported_at');
    expect(exportRes.body).toHaveProperty('account');
    expect(exportRes.body).toHaveProperty('jobs');
    expect(exportRes.body).toHaveProperty('payments');
    expect(exportRes.body).toHaveProperty('withdrawals');

    expect(exportRes.body.account).toMatchObject({
      id: renter.id,
      email: renter.email,
      organization: 'PDPL Org',
    });

    expect(exportRes.body.account).toHaveProperty('name');
    expect(exportRes.body.account).toHaveProperty('status');
    expect(exportRes.body.account).toHaveProperty('created_at');
    expect(exportRes.body.account).toHaveProperty('updated_at');
    expect(exportRes.body.account).toHaveProperty('balance_halala');
    expect(exportRes.body.account).toHaveProperty('total_spent_halala');
    expect(exportRes.body.account).toHaveProperty('total_jobs');

    expect(Array.isArray(exportRes.body.jobs)).toBe(true);
    expect(Array.isArray(exportRes.body.payments)).toBe(true);
    expect(Array.isArray(exportRes.body.withdrawals)).toBe(true);

    expect(exportRes.body.payments.length).toBe(1);
    expect(exportRes.body.payments[0]).toMatchObject({
      payment_id: paymentId,
      amount_halala: 2500,
      status: 'paid',
    });
  });

  test('DELETE /api/renters/me anonymizes renter email and invalidates old key', async () => {
    const renter = await createRenter();

    const deleteRes = await request(app)
      .delete('/api/renters/me')
      .set('x-renter-key', renter.apiKey);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toMatch(/account scheduled for deletion/i);

    const deletedRow = db.prepare('SELECT id, email, status FROM renters WHERE id = ?').get(renter.id);
    expect(deletedRow.status).toBe('deleted');
    expect(deletedRow.email).toBe(`deleted_${renter.id}@deleted.dcp.sa`);

    const oldKeyRes = await request(app)
      .get('/api/renters/me')
      .query({ key: renter.apiKey });

    expect(oldKeyRes.status).toBe(404);
    expect(oldKeyRes.body.error).toMatch(/renter not found/i);
  });
});

describe('Sprint 21 smoke: renter API key rotation', () => {
  test('POST /api/renters/me/rotate-key returns a new key and invalidates old key', async () => {
    const renter = await createRenter();

    const rotateRes = await request(app)
      .post('/api/renters/me/rotate-key')
      .set('x-renter-key', renter.apiKey)
      .send({});

    expect(rotateRes.status).toBe(200);
    expect(rotateRes.body.success).toBe(true);
    expect(rotateRes.body.renter_id).toBe(renter.id);
    expect(typeof rotateRes.body.new_key).toBe('string');
    expect(rotateRes.body.new_key).not.toBe(renter.apiKey);

    const oldKeyRes = await request(app)
      .get('/api/renters/me')
      .query({ key: renter.apiKey });

    expect(oldKeyRes.status).toBe(404);

    const newKeyRes = await request(app)
      .get('/api/renters/me')
      .query({ key: rotateRes.body.new_key });

    expect(newKeyRes.status).toBe(200);
    expect(newKeyRes.body.renter.id).toBe(renter.id);
  });
});

describe('Sprint 21 smoke: admin fleet health contract', () => {
  test('GET /api/admin/providers/health includes online_count and avg_gpu_util_pct', async () => {
    const provider = await createProvider();
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE providers
       SET status = 'online', approval_status = 'approved', last_heartbeat = ?, updated_at = ?
       WHERE id = ?`
    ).run(now, now, provider.id);

    db.prepare(
      `INSERT INTO provider_gpu_telemetry (provider_id, recorded_at, gpu_util_pct)
       VALUES (?, ?, ?)`
    ).run(provider.id, now, 66.5);

    const healthRes = await request(app)
      .get('/api/admin/providers/health')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(healthRes.status).toBe(200);
    expect(healthRes.body).toHaveProperty('online_count');
    expect(healthRes.body).toHaveProperty('avg_gpu_util_pct');
    expect(typeof healthRes.body.online_count).toBe('number');
    expect(typeof healthRes.body.avg_gpu_util_pct).toBe('number');

    expect(healthRes.body.online_count).toBeGreaterThanOrEqual(1);
    expect(healthRes.body.avg_gpu_util_pct).toBeGreaterThan(0);
  });
});
