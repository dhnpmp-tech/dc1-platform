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
  app.use('/api/jobs', require('../../src/routes/jobs'));
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
  safeDelete('escrow_holds');
  safeDelete('job_executions');
  safeDelete('jobs');
  safeDelete('withdrawal_requests');
  safeDelete('withdrawals');
  safeDelete('heartbeat_log');
  safeDelete('renters');
  safeDelete('providers');
}

async function createProvider(overrides = {}) {
  const payload = {
    name: overrides.name || 'Withdrawal Test Provider',
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
  };
}

beforeEach(() => {
  cleanDb();
});

afterAll(() => {
  cleanDb();
});

describe('Provider withdrawal integration', () => {
  test('claimable ledger flow: me/withdraw appears in admin queue and paid transition debits claimable earnings', async () => {
    const provider = await createProvider();
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE providers
       SET approval_status = 'approved',
           status = 'online',
           last_heartbeat = ?,
           updated_at = ?,
           claimable_earnings_halala = 5000,
           total_earnings = 50
       WHERE id = ?`
    ).run(now, now, provider.id);

    const createRes = await request(app)
      .post(`/api/providers/me/withdraw?key=${provider.apiKey}`)
      .send({ amount_halala: 5000, iban: 'SA1234567890123456789012' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('pending');
    expect(createRes.body.withdrawal_request?.id).toBeDefined();

    const withdrawalId = createRes.body.withdrawal_request.id;

    const adminListRes = await request(app)
      .get('/api/admin/withdrawals?status=pending&limit=20&page=1')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(adminListRes.status).toBe(200);
    expect(Array.isArray(adminListRes.body.withdrawals)).toBe(true);
    expect(adminListRes.body.withdrawals.some((w) => w.id === withdrawalId)).toBe(true);

    const processingRes = await request(app)
      .patch(`/api/admin/withdrawals/${withdrawalId}`)
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ status: 'processing', admin_note: 'queued payout batch' });

    expect(processingRes.status).toBe(200);
    expect(processingRes.body.withdrawal_request?.status).toBe('processing');

    const paidRes = await request(app)
      .patch(`/api/admin/withdrawals/${withdrawalId}`)
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ status: 'paid', admin_note: 'wire completed' });

    expect(paidRes.status).toBe(200);
    expect(paidRes.body.withdrawal_request?.status).toBe('paid');

    const earningsRes = await request(app)
      .get('/api/providers/earnings')
      .set('x-provider-key', provider.apiKey);

    expect(earningsRes.status).toBe(200);
    expect(earningsRes.body.claimable_earnings_halala).toBe(0);
    expect(earningsRes.body.available_halala).toBe(0);
  });

  test('legacy compatibility flow: withdraw -> approve -> complete keeps admin route behavior and zeroes available legacy balance', async () => {
    const provider = await createProvider();

    db.prepare(
      `UPDATE providers
       SET claimable_earnings_halala = 0,
           total_earnings = 10,
           updated_at = ?
       WHERE id = ?`
    ).run(new Date().toISOString(), provider.id);

    const withdrawRes = await request(app)
      .post('/api/providers/withdraw')
      .send({
        api_key: provider.apiKey,
        amount_sar: 10,
        payout_method: 'bank_transfer',
        payout_details: { iban: 'SA4420000001234567891234', bank_name: 'Test Bank' },
      });

    expect(withdrawRes.status).toBe(201);
    expect(withdrawRes.body.success).toBe(true);
    expect(withdrawRes.body.status).toBe('pending');
    expect(withdrawRes.body.withdrawal_id).toMatch(/^wd-/);

    const approveRes = await request(app)
      .post(`/api/admin/withdrawals/${withdrawRes.body.withdrawal_id}/approve`)
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ notes: 'approved in test' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.new_status).toBe('approved');

    const completeRes = await request(app)
      .post(`/api/admin/withdrawals/${withdrawRes.body.withdrawal_id}/complete`)
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ notes: 'paid in test' });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.new_status).toBe('completed');

    const earningsRes = await request(app)
      .get('/api/providers/earnings')
      .set('x-provider-key', provider.apiKey);

    expect(earningsRes.status).toBe(200);
    expect(earningsRes.body.available_halala).toBe(0);

    const completed = db.prepare(
      `SELECT COALESCE(SUM(amount_sar), 0) AS total
       FROM withdrawals
       WHERE provider_id = ? AND status = 'completed'`
    ).get(provider.id);

    expect(Number(completed.total)).toBe(10);
  });
});
