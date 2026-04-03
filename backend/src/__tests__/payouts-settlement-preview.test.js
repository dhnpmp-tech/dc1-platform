'use strict';

const Database = require('better-sqlite3');
const express = require('express');
const request = require('supertest');

jest.mock('../db', () => ({
  get _db() {
    return global.__testDb;
  },
}));

jest.mock('../services/notifications', () => ({
  sendAlert: () => Promise.resolve(),
}));

jest.mock('../services/emailService', () => ({
  sendWithdrawalApprovedEmail: () => Promise.resolve(),
  sendWithdrawalRejectedEmail: () => Promise.resolve(),
}));

function buildDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE providers (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT,
      claimable_earnings_halala INTEGER DEFAULT 0,
      deleted_at TEXT
    );

    CREATE TABLE payout_requests (
      id TEXT PRIMARY KEY,
      provider_id INTEGER NOT NULL,
      amount_halala INTEGER NOT NULL,
      amount_sar REAL,
      amount_usd REAL,
      status TEXT NOT NULL,
      requested_at TEXT,
      processed_at TEXT,
      payment_ref TEXT
    );

    CREATE TABLE admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE job_settlements (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE,
      provider_id INTEGER,
      renter_id INTEGER NOT NULL,
      duration_seconds INTEGER,
      gpu_rate_per_second REAL,
      gross_amount_halala INTEGER NOT NULL,
      platform_fee_halala INTEGER NOT NULL,
      provider_payout_halala INTEGER NOT NULL,
      status TEXT NOT NULL,
      settled_at TEXT NOT NULL
    );
  `);
  return db;
}

function seedSettlement(db, { id, jobId, providerId, grossHalala, platformFeeHalala, providerNetHalala, settledAt }) {
  db.prepare(`
    INSERT INTO job_settlements
      (id, job_id, provider_id, renter_id, duration_seconds, gpu_rate_per_second, gross_amount_halala, platform_fee_halala, provider_payout_halala, status, settled_at)
    VALUES (?, ?, ?, 1, 300, 0.5, ?, ?, ?, 'completed', ?)
  `).run(id, jobId, providerId, grossHalala, platformFeeHalala, providerNetHalala, settledAt);
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', require('../routes/payouts'));
  return app;
}

describe('GET /api/admin/payouts/settlement-preview', () => {
  const ADMIN_TOKEN = 'test-admin-token';
  let app;

  beforeAll(() => {
    process.env.DC1_ADMIN_TOKEN = ADMIN_TOKEN;
  });

  afterAll(() => {
    delete process.env.DC1_ADMIN_TOKEN;
  });

  beforeEach(() => {
    global.__testDb = buildDb();
    app = buildApp();
  });

  afterEach(() => {
    if (global.__testDb && global.__testDb.open) {
      global.__testDb.close();
    }
    global.__testDb = null;
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('returns per-provider settlement preview and reconciliation totals', async () => {
    seedSettlement(global.__testDb, {
      id: 'sp-1',
      jobId: 'job-sp-1',
      providerId: 11,
      grossHalala: 101,
      platformFeeHalala: 15,
      providerNetHalala: 86,
      settledAt: '2026-03-31T01:00:00.000Z',
    });
    seedSettlement(global.__testDb, {
      id: 'sp-2',
      jobId: 'job-sp-2',
      providerId: 22,
      grossHalala: 205,
      platformFeeHalala: 30,
      providerNetHalala: 175,
      settledAt: '2026-03-31T02:00:00.000Z',
    });

    const res = await request(app)
      .get('/api/admin/payouts/settlement-preview')
      .set('x-admin-token', ADMIN_TOKEN)
      .query({
        window_start: '2026-03-31T00:00:00.000Z',
        window_end: '2026-03-31T23:59:59.999Z',
      });

    expect(res.status).toBe(200);
    expect(res.body.providers).toHaveLength(2);
    expect(res.body.providers[0]).toMatchObject({
      provider_id: 11,
      gross_halala: 101,
      gross_sar: '1.01',
      platform_fee_halala: 15,
      platform_fee_sar: '0.15',
      provider_net_halala: 86,
      provider_net_sar: '0.86',
      reconciliation_ok: true,
    });
    expect(res.body.totals).toMatchObject({
      providers_count: 2,
      gross_halala: 306,
      gross_sar: '3.06',
      platform_fee_halala: 45,
      platform_fee_sar: '0.45',
      provider_net_halala: 261,
      provider_net_sar: '2.61',
    });
    expect(res.body.reconciliation).toEqual({
      gross_equals_split: true,
      delta_halala: 0,
    });
  });

  test('validates required date window query params', async () => {
    const res = await request(app)
      .get('/api/admin/payouts/settlement-preview')
      .set('x-admin-token', ADMIN_TOKEN)
      .query({ window_start: '2026-03-31T00:00:00.000Z' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'window_start and window_end are required ISO timestamps',
    });
  });
});
