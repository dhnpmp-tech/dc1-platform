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
    if (global.__testDb && global.__testDb.open) {
      global.__testDb.close();
    }
    global.__testDb = null;
    jest.clearAllMocks();
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
       WHERE action LIKE 'payout_%'`
    ).all();
    const targetRows = rows.filter((row) => row.target_type === 'payout' && row.target_id === 'payout-approve-1');

    // Route guard: exactly one payout mutation audit row must be emitted.
    expect(rows).toHaveLength(1);
    expect(targetRows).toHaveLength(1);
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
       WHERE action LIKE 'payout_%'`
    ).all();
    const targetRows = rows.filter((row) => row.target_type === 'payout' && row.target_id === 'payout-reject-1');

    // Route guard: exactly one payout mutation audit row must be emitted.
    expect(rows).toHaveLength(1);
    expect(targetRows).toHaveLength(1);
    expect(rows[0].action).toBe('payout_rejected');
    expect(JSON.parse(rows[0].details)).toMatchObject({
      provider_id: 2,
      amount_halala: 4200,
      status_to: 'rejected',
      reason: 'iban_mismatch',
    });
  });

  test('approve failure does not emit payout mutation audit rows', async () => {
    global.__testDb.prepare(
      'INSERT INTO providers (id, name, email, claimable_earnings_halala) VALUES (?,?,?,?)'
    ).run(3, 'Provider Three', 'provider3@example.com', 200000);
    global.__testDb.prepare(
      `INSERT INTO payout_requests
         (id, provider_id, amount_halala, amount_sar, amount_usd, status, requested_at)
       VALUES (?,?,?,?,?,?,?)`
    ).run('payout-approve-locked', 3, 10000, 100.0, 26.67, 'processing', new Date().toISOString());

    const res = await request(app)
      .post('/api/admin/payouts/payout-approve-locked/approve')
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ payment_ref: 'BANK-ALREADY' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'NOT_APPROVABLE' });

    const rows = global.__testDb.prepare(
      `SELECT * FROM admin_audit_log
       WHERE action LIKE 'payout_%'`
    ).all();

    expect(rows).toHaveLength(0);
  });

  test('reject failure does not emit payout mutation audit rows', async () => {
    global.__testDb.prepare(
      'INSERT INTO providers (id, name, email, claimable_earnings_halala) VALUES (?,?,?,?)'
    ).run(4, 'Provider Four', 'provider4@example.com', 100000);
    global.__testDb.prepare(
      `INSERT INTO payout_requests
         (id, provider_id, amount_halala, amount_sar, amount_usd, status, requested_at, processed_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run('payout-reject-locked', 4, 5200, 52.0, 13.87, 'paid', new Date().toISOString(), new Date().toISOString());

    const res = await request(app)
      .post('/api/admin/payouts/payout-reject-locked/reject')
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ reason: 'late_reversal' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'NOT_REJECTABLE' });

    const rows = global.__testDb.prepare(
      `SELECT * FROM admin_audit_log
       WHERE action LIKE 'payout_%'`
    ).all();

    expect(rows).toHaveLength(0);
  });

  test('legacy PATCH paid writes exactly one payout mutation audit row', async () => {
    global.__testDb.prepare(
      'INSERT INTO providers (id, name, email, claimable_earnings_halala) VALUES (?,?,?,?)'
    ).run(5, 'Provider Five', 'provider5@example.com', 100000);
    global.__testDb.prepare(
      `INSERT INTO payout_requests
         (id, provider_id, amount_halala, amount_sar, amount_usd, status, requested_at)
       VALUES (?,?,?,?,?,?,?)`
    ).run('payout-patch-paid-1', 5, 8400, 84.0, 22.4, 'processing', new Date().toISOString());

    const res = await request(app)
      .patch('/api/admin/payouts/payout-patch-paid-1')
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ action: 'paid', payment_ref: 'WIRE-555' });

    expect(res.status).toBe(200);

    const payoutRows = global.__testDb.prepare(
      `SELECT * FROM admin_audit_log WHERE action LIKE 'payout_%'`
    ).all();
    const genericRows = global.__testDb.prepare(
      `SELECT * FROM admin_audit_log WHERE action = 'PATCH /admin/payouts/payout-patch-paid-1'`
    ).all();

    expect(payoutRows).toHaveLength(1);
    expect(genericRows).toHaveLength(0);
    expect(payoutRows[0].action).toBe('payout_marked_paid');
    expect(JSON.parse(payoutRows[0].details)).toMatchObject({
      provider_id: 5,
      amount_halala: 8400,
      status_to: 'paid',
      payment_ref: 'WIRE-555',
    });
  });

  test('legacy PATCH reject writes exactly one payout mutation audit row', async () => {
    global.__testDb.prepare(
      'INSERT INTO providers (id, name, email, claimable_earnings_halala) VALUES (?,?,?,?)'
    ).run(6, 'Provider Six', 'provider6@example.com', 100000);
    global.__testDb.prepare(
      `INSERT INTO payout_requests
         (id, provider_id, amount_halala, amount_sar, amount_usd, status, requested_at)
       VALUES (?,?,?,?,?,?,?)`
    ).run('payout-patch-reject-1', 6, 4300, 43.0, 11.47, 'processing', new Date().toISOString());

    const res = await request(app)
      .patch('/api/admin/payouts/payout-patch-reject-1')
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ action: 'reject', reason: 'policy_hold' });

    expect(res.status).toBe(200);

    const payoutRows = global.__testDb.prepare(
      `SELECT * FROM admin_audit_log WHERE action LIKE 'payout_%'`
    ).all();
    const genericRows = global.__testDb.prepare(
      `SELECT * FROM admin_audit_log WHERE action = 'PATCH /admin/payouts/payout-patch-reject-1'`
    ).all();

    expect(payoutRows).toHaveLength(1);
    expect(genericRows).toHaveLength(0);
    expect(payoutRows[0].action).toBe('payout_rejected');
    expect(JSON.parse(payoutRows[0].details)).toMatchObject({
      provider_id: 6,
      amount_halala: 4300,
      status_to: 'rejected',
      reason: 'policy_hold',
    });
  });

  test('legacy PATCH failure does not emit payout mutation audit rows', async () => {
    global.__testDb.prepare(
      'INSERT INTO providers (id, name, email, claimable_earnings_halala) VALUES (?,?,?,?)'
    ).run(7, 'Provider Seven', 'provider7@example.com', 100000);
    global.__testDb.prepare(
      `INSERT INTO payout_requests
         (id, provider_id, amount_halala, amount_sar, amount_usd, status, requested_at)
       VALUES (?,?,?,?,?,?,?)`
    ).run('payout-patch-fail-1', 7, 5100, 51.0, 13.6, 'paid', new Date().toISOString());

    const res = await request(app)
      .patch('/api/admin/payouts/payout-patch-fail-1')
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ action: 'paid', payment_ref: 'WIRE-FAIL' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'ALREADY_PAID' });

    const payoutRows = global.__testDb.prepare(
      `SELECT * FROM admin_audit_log WHERE action LIKE 'payout_%'`
    ).all();
    const genericRows = global.__testDb.prepare(
      `SELECT * FROM admin_audit_log WHERE action = 'PATCH /admin/payouts/payout-patch-fail-1'`
    ).all();

    expect(payoutRows).toHaveLength(0);
    expect(genericRows).toHaveLength(0);
  });
});
