'use strict';

const Database = require('better-sqlite3');
const express = require('express');
const request = require('supertest');

const mockRejectPayout = jest.fn();
const mockSendAlert = jest.fn(() => Promise.resolve());
const mockSendWithdrawalRejectedEmail = jest.fn(() => Promise.resolve({ ok: true }));

jest.mock('../db', () => ({
  get _db() {
    return global.__testDb;
  },
}));

jest.mock('../middleware/auth', () => ({
  requireAdminAuth: (req, res, next) => next(),
  getBearerToken: () => null,
}));

jest.mock('../middleware/adminAuth', () => ({
  requireAdminRbac: (req, res, next) => next(),
  logAdminAction: jest.fn(),
}));

jest.mock('../services/apiKeyService', () => ({
  verifyProviderKey: () => null,
}));

jest.mock('../services/payoutService', () => ({
  requestPayout: jest.fn(),
  getPayoutHistory: jest.fn(),
  getEarningsSummary: jest.fn(),
  markPayoutPaid: jest.fn(),
  rejectPayout: (...args) => mockRejectPayout(...args),
}));

jest.mock('../services/notifications', () => ({
  sendAlert: (...args) => mockSendAlert(...args),
}));

jest.mock('../services/emailService', () => ({
  sendWithdrawalApprovedEmail: jest.fn(),
  sendWithdrawalRejectedEmail: (...args) => mockSendWithdrawalRejectedEmail(...args),
}));

function buildDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE providers (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT
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

describe('POST /api/admin/payouts/:id/reject reject-email behavior', () => {
  let app;
  let consoleErrorSpy;

  beforeEach(() => {
    global.__testDb = buildDb();
    app = buildApp();
    mockRejectPayout.mockReset();
    mockSendAlert.mockClear();
    mockSendWithdrawalRejectedEmail.mockClear();
    mockSendWithdrawalRejectedEmail.mockResolvedValue({ ok: true });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    global.__testDb.close();
  });

  test('sends rejection email when provider email exists', async () => {
    global.__testDb
      .prepare('INSERT INTO providers (id, name, email) VALUES (?, ?, ?)')
      .run(41, 'Provider One', 'provider@example.com');

    mockRejectPayout.mockReturnValue({
      id: 77,
      provider_id: 41,
      amount_halala: 12345,
      status: 'rejected',
      reason: 'Invalid bank account',
    });

    const res = await request(app)
      .post('/api/admin/payouts/77/reject')
      .send({ reason: 'Invalid bank account' });

    expect(res.status).toBe(200);
    expect(mockSendWithdrawalRejectedEmail).toHaveBeenCalledWith(
      'provider@example.com',
      123.45,
      'Invalid bank account'
    );
  });

  test('does not send rejection email when provider email is missing', async () => {
    global.__testDb
      .prepare('INSERT INTO providers (id, name, email) VALUES (?, ?, ?)')
      .run(42, 'No Email Provider', null);

    mockRejectPayout.mockReturnValue({
      id: 78,
      provider_id: 42,
      amount_halala: 5000,
      status: 'rejected',
      reason: null,
    });

    const res = await request(app)
      .post('/api/admin/payouts/78/reject')
      .send({ reason: null });

    expect(res.status).toBe(200);
    expect(mockSendWithdrawalRejectedEmail).not.toHaveBeenCalled();
  });

  test('logs reject-email failures without breaking API response', async () => {
    global.__testDb
      .prepare('INSERT INTO providers (id, name, email) VALUES (?, ?, ?)')
      .run(43, 'Provider Two', 'broken-mail@example.com');

    mockRejectPayout.mockReturnValue({
      id: 79,
      provider_id: 43,
      amount_halala: 9900,
      status: 'rejected',
      reason: 'KYC mismatch',
    });

    mockSendWithdrawalRejectedEmail.mockRejectedValue(new Error('smtp down'));

    const res = await request(app)
      .post('/api/admin/payouts/79/reject')
      .send({ reason: 'KYC mismatch' });

    expect(res.status).toBe(200);

    await new Promise((resolve) => setImmediate(resolve));

    expect(consoleErrorSpy).toHaveBeenCalledWith('[payouts] reject email failed:', 'smtp down');
  });
});
