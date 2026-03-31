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
  `);
  return db;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', require('../routes/payouts'));
  return app;
}

describe('admin payout audit dedupe', () => {
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
    global.__testDb.close();
    jest.resetModules();
  });

  test('approve writes exactly one audit row for payout mutation', async () => {
    global.__testDb.prepare(
      'INSERT INTO providers (id, name, email, claimable_earnings_halala) VALUES (?,?,?,?)'
    ).run(1, 'Provider One', 'provider1@example.com', 100000);
    global.__testDb.prepare(
      `INSERT INTO payout_requests
         (id, provider_id, amount_halala, amount_sar, amount_usd, status, requested_at)
       VALUES (?,?,?,?,?,?,?)`
    ).run('payout-approve-1', 1, 7500, 75.0, 20.0, 'pending', new Date().toISOString());

    const res = await request(app)
      .post('/api/admin/payouts/payout-approve-1/approve')
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ payment_ref: 'BANK-123' });

    expect(res.status).toBe(200);

    const rows = global.__testDb.prepare(
      `SELECT * FROM admin_audit_log
       WHERE target_type = 'payout' AND target_id = ?`
    ).all('payout-approve-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('payout_approved');
    expect(JSON.parse(rows[0].details)).toMatchObject({
      provider_id: 1,
      amount_halala: 7500,
      status_from: 'pending',
      status_to: 'processing',
      payment_ref: 'BANK-123',
    });
  });

  test('reject writes exactly one audit row for payout mutation', async () => {
    global.__testDb.prepare(
      'INSERT INTO providers (id, name, email, claimable_earnings_halala) VALUES (?,?,?,?)'
    ).run(2, 'Provider Two', 'provider2@example.com', 0);
    global.__testDb.prepare(
      `INSERT INTO payout_requests
         (id, provider_id, amount_halala, amount_sar, amount_usd, status, requested_at)
       VALUES (?,?,?,?,?,?,?)`
    ).run('payout-reject-1', 2, 4200, 42.0, 11.2, 'pending', new Date().toISOString());

    const res = await request(app)
      .post('/api/admin/payouts/payout-reject-1/reject')
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ reason: 'iban_mismatch' });

    expect(res.status).toBe(200);

    const rows = global.__testDb.prepare(
      `SELECT * FROM admin_audit_log
       WHERE target_type = 'payout' AND target_id = ?`
    ).all('payout-reject-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('payout_rejected');
    expect(JSON.parse(rows[0].details)).toMatchObject({
      provider_id: 2,
      amount_halala: 4200,
      status_to: 'rejected',
      reason: 'iban_mismatch',
    });
  });
});
