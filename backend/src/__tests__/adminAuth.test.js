'use strict';

/**
 * Tests for adminAuth middleware — DCP-768
 *
 * Verifies:
 *  1. 401 when no admin token is provided
 *  2. 401 when an incorrect admin token is provided
 *  3. 200 + req.adminUser set when the correct static token is provided
 *  4. 403 when a JWT user with non-admin role is on the request
 *  5. 200 + req.adminUser set when a JWT user with role=admin is on the request
 *  6. An audit log row is written to admin_audit_log on each admitted request
 *  7. logAdminAction() inserts a row and never throws on DB errors
 */

const Database = require('better-sqlite3');

// ── Build an isolated in-memory DB that mirrors the schema in db.js ──────────

function buildDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id   TEXT    NOT NULL DEFAULT 'system',
      action          TEXT    NOT NULL,
      target_type     TEXT,
      target_id       TEXT,
      details         TEXT,
      timestamp       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  return db;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    headers: {},
    query: {},
    params: {},
    path: '/admin/payouts/1',
    method: 'PATCH',
    ip: '127.0.0.1',
    ...overrides,
  };
}

function makeRes() {
  const res = {
    _status: null,
    _json: null,
    status(code) { res._status = code; return res; },
    json(body)   { res._json = body;  return res; },
  };
  return res;
}

// ── Module-level DB mock for middleware ───────────────────────────────────────
// adminAuth.js imports '../db' which opens a real SQLite file.
// We intercept require('../db') via Jest's module mocking and replace it with
// a db instance that delegates writes to our in-memory test db.

let testDb;

jest.mock('../db', () => {
  // Return a proxy that forwards prepare() calls to the test-controlled db
  const proxy = {
    _testDb: null,
    prepare(sql) {
      if (!proxy._testDb) throw new Error('testDb not set');
      return proxy._testDb.prepare(sql);
    },
    get _db() { return proxy._testDb; },
  };
  return proxy;
});

// Also mock ../middleware/auth to isolate static token logic
jest.mock('../middleware/auth', () => {
  const crypto = require('crypto');

  function normalizeCredential(value) {
    if (typeof value !== 'string') return null;
    const n = value.trim();
    return n || null;
  }

  function getBearerToken(req) {
    const auth = req.headers?.authorization;
    if (!auth || typeof auth !== 'string') return null;
    const m = auth.match(/^Bearer\s+(.+)$/i);
    return m ? normalizeCredential(m[1]) : null;
  }

  function getAdminTokenFromReq(req) {
    const header = req.headers?.['x-admin-token'];
    if (header && typeof header === 'string') return normalizeCredential(header);
    return getBearerToken(req);
  }

  function secureTokenEqual(provided, expected) {
    if (!provided || !expected) return false;
    const pb = Buffer.from(provided);
    const eb = Buffer.from(expected);
    if (pb.length !== eb.length) return false;
    return crypto.timingSafeEqual(pb, eb);
  }

  function requireAdminAuth(req, res, next) {
    const expected = normalizeCredential(process.env.DC1_ADMIN_TOKEN);
    if (!expected) return res.status(503).json({ error: 'Admin token not configured' });
    const provided = getAdminTokenFromReq(req);
    if (!secureTokenEqual(provided, expected)) return res.status(401).json({ error: 'Admin access denied' });
    next();
  }

  return { requireAdminAuth, getBearerToken, getAdminTokenFromReq, normalizeCredential };
});

// ── Load modules under test after mocks are set up ───────────────────────────

const dbProxy = require('../db');
const { requireAdminRbac, logAdminAction } = require('../middleware/adminAuth');

beforeEach(() => {
  testDb = buildDb();
  dbProxy._testDb = testDb;
  process.env.DC1_ADMIN_TOKEN = 'test-admin-secret-abc123';
});

afterEach(() => {
  jest.clearAllMocks();
  delete process.env.DC1_ADMIN_TOKEN;
  process.env.NODE_ENV = 'test';
});

// ── requireAdminRbac tests ────────────────────────────────────────────────────

describe('requireAdminRbac — static token auth', () => {
  test('returns 401 when no credentials are provided', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    requireAdminRbac(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when the wrong static token is provided', () => {
    const req = makeReq({ headers: { 'x-admin-token': 'wrong-token' } });
    const res = makeRes();
    const next = jest.fn();

    requireAdminRbac(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() and sets req.adminUser when the correct token is provided', () => {
    const req = makeReq({ headers: { 'x-admin-token': 'test-admin-secret-abc123' } });
    const res = makeRes();
    const next = jest.fn();

    requireAdminRbac(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.adminUser).toBeDefined();
    expect(req.adminUser.role).toBe('admin');
  });

  test('calls next() when the token is supplied as a Bearer header', () => {
    const req = makeReq({
      headers: { authorization: 'Bearer test-admin-secret-abc123' },
    });
    const res = makeRes();
    const next = jest.fn();

    requireAdminRbac(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.adminUser.role).toBe('admin');
  });
});

describe('requireAdminRbac — JWT role check', () => {
  test('returns 403 when req.user exists but role is not admin', () => {
    const req = makeReq({ user: { role: 'renter', sub: 'user-42' } });
    const res = makeRes();
    const next = jest.fn();

    requireAdminRbac(req, res, next);

    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 for provider role', () => {
    const req = makeReq({ user: { role: 'provider', sub: 'prov-99' } });
    const res = makeRes();
    const next = jest.fn();

    requireAdminRbac(req, res, next);

    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() and sets req.adminUser when JWT role is admin', () => {
    const req = makeReq({ user: { role: 'admin', sub: 'admin-user-1' } });
    const res = makeRes();
    const next = jest.fn();

    requireAdminRbac(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.adminUser.role).toBe('admin');
    expect(req.adminUser.id).toBe('admin-user-1');
  });
});

describe('requireAdminRbac — audit log', () => {
  function waitForAudit() {
    // Two ticks: one for the setImmediate in adminAuth, one to flush any
    // lingering setImmediate callbacks from preceding tests.
    return new Promise(resolve => setImmediate(() => setImmediate(resolve)));
  }

  beforeEach(async () => {
    // Flush any pending setImmediate callbacks from previous tests, then
    // truncate the log table so each test starts with a clean slate.
    await new Promise(resolve => setImmediate(() => setImmediate(resolve)));
    testDb.prepare('DELETE FROM admin_audit_log').run();
  });

  test('writes an audit row after a successful static-token request', async () => {
    const req = makeReq({
      headers: { 'x-admin-token': 'test-admin-secret-abc123' },
      path: '/admin/payouts/7',
      method: 'PATCH',
      params: { id: '7' },
    });
    const res = makeRes();
    const next = jest.fn();

    requireAdminRbac(req, res, next);
    await waitForAudit();

    const rows = testDb.prepare('SELECT * FROM admin_audit_log').all();
    expect(rows.length).toBe(1);
    expect(rows[0].action).toBe('PATCH /admin/payouts/7');
    expect(rows[0].target_type).toBe('payout');
    expect(rows[0].target_id).toBe('7');
    expect(rows[0].admin_user_id).toMatch(/^token:/);
  });

  test('writes an audit row with sub claim for JWT admin', async () => {
    const req = makeReq({
      user: { role: 'admin', sub: 'admin-abc' },
      path: '/admin/providers/3',
      method: 'GET',
      params: { id: '3' },
    });
    const res = makeRes();
    const next = jest.fn();

    requireAdminRbac(req, res, next);
    await waitForAudit();

    const rows = testDb.prepare('SELECT * FROM admin_audit_log').all();
    expect(rows.length).toBe(1);
    expect(rows[0].admin_user_id).toBe('admin-abc');
    expect(rows[0].target_type).toBe('provider');
  });

  test('does NOT write an audit row when auth fails', async () => {
    const req = makeReq({ headers: { 'x-admin-token': 'wrong' } });
    const res = makeRes();
    const next = jest.fn();

    requireAdminRbac(req, res, next);
    await waitForAudit();

    const rows = testDb.prepare('SELECT * FROM admin_audit_log').all();
    expect(rows.length).toBe(0);
  });
});

// ── logAdminAction tests ──────────────────────────────────────────────────────

describe('logAdminAction()', () => {
  test('inserts a row with all provided fields', () => {
    logAdminAction(
      testDb,
      'admin-user-5',
      'PATCH /admin/payouts/99',
      'payout',
      '99',
      { ip: '10.0.0.1' }
    );

    const row = testDb.prepare('SELECT * FROM admin_audit_log').get();
    expect(row).toBeDefined();
    expect(row.admin_user_id).toBe('admin-user-5');
    expect(row.action).toBe('PATCH /admin/payouts/99');
    expect(row.target_type).toBe('payout');
    expect(row.target_id).toBe('99');
    expect(JSON.parse(row.details)).toMatchObject({ ip: '10.0.0.1' });
  });

  test('inserts with null optional fields', () => {
    logAdminAction(testDb, 'admin-x', 'GET /admin/metrics', null, null, null);

    const row = testDb.prepare('SELECT * FROM admin_audit_log').get();
    expect(row.admin_user_id).toBe('admin-x');
    expect(row.target_type).toBeNull();
    expect(row.details).toBeNull();
  });

  test('falls back to "system" when adminUserId is null', () => {
    logAdminAction(testDb, null, 'GET /admin/metrics');

    const row = testDb.prepare('SELECT * FROM admin_audit_log').get();
    expect(row.admin_user_id).toBe('system');
  });

  test('never throws when DB is broken', () => {
    const brokenDb = { prepare: () => { throw new Error('DB error'); } };
    // Should not throw
    expect(() => {
      logAdminAction(brokenDb, 'admin', 'PATCH /admin/payouts/1', 'payout', '1', null);
    }).not.toThrow();
  });
});
