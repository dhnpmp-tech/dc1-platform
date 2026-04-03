'use strict';

const Database = require('better-sqlite3');
const express = require('express');
const request = require('supertest');

jest.mock('../db', () => {
  function flattenParams(params) {
    if (params.length === 1 && Array.isArray(params[0])) return params[0];
    return params;
  }

  return {
    get get() {
      return (sql, ...params) => global.__testDb.prepare(sql).get(...flattenParams(params));
    },
    get all() {
      return (sql, ...params) => global.__testDb.prepare(sql).all(...flattenParams(params));
    },
    get run() {
      return (sql, ...params) => global.__testDb.prepare(sql).run(...flattenParams(params));
    },
    get prepare() {
      return (sql) => global.__testDb.prepare(sql);
    },
    get exec() {
      return (sql) => global.__testDb.exec(sql);
    },
    get _db() {
      return global.__testDb;
    },
  };
});

jest.mock('../middleware/adminAuth', () => ({
  requireAdminRbac: (_req, _res, next) => next(),
  logAdminAction: () => {},
}));

jest.mock('../middleware/auth', () => ({
  requireAdminAuth: (_req, _res, next) => next(),
  getAdminTokenFromReq: (req) => req.get('x-admin-token') || 'test-admin',
}));

jest.mock('../services/notifications', () => ({
  getConfig: () => ({}),
  sendAlert: () => {},
  sendTelegram: () => {},
}));

jest.mock('../services/emailService', () => ({
  sendWithdrawalApprovedEmail: () => {},
}));

jest.mock('../services/job-execution-logs', () => ({
  resolveAttemptLogPath: () => '/tmp/fake.log',
}));

jest.mock('../services/controlPlane', () => ({
  listPolicies: () => [],
  updatePolicy: () => {},
  getRecentSignals: () => [],
  calculateControlPlaneSignals: () => ({}),
  listTopDemandModels: () => [],
  runDemandDrivenPrewarm: () => {},
  runControlPlaneCycle: () => {},
  listCapacityPolicies: () => [],
  updateCapacityPolicy: () => {},
  PRICING_CLASS_ORDER: [],
  CAPACITY_CLASS_ORDER: [],
}));

jest.mock('../lib/container-registry', () => ({
  normalizeImageRef: (value) => value,
  validateAndNormalizeImageRef: (value) => value,
  isDockerHubImageRef: () => true,
}));

function buildDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE providers (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT,
      approval_status TEXT DEFAULT 'pending',
      approved_at TEXT,
      rejected_reason TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id TEXT NOT NULL DEFAULT 'system',
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  return db;
}

function seedProvider(db, {
  id,
  approval_status = 'pending',
  created_at = '2026-04-02T10:00:00.000Z',
  updated_at = '2026-04-02T10:00:00.000Z',
  rejected_reason = null,
} = {}) {
  db.prepare(
    `INSERT INTO providers (id, name, email, approval_status, approved_at, rejected_reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`
  ).run(id, `Provider ${id}`, `provider${id}@example.com`, approval_status, rejected_reason, created_at, updated_at);
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const adminRouter = require('../routes/admin');
  app.use('/api/admin', adminRouter);
  return app;
}

let app;

beforeAll(() => {
  global.__testDb = buildDb();
  app = buildApp();
});

beforeEach(() => {
  global.__testDb.close();
  global.__testDb = buildDb();
});

afterAll(() => {
  global.__testDb.close();
});

describe('provider approval queue api', () => {
  test('GET /api/admin/providers/approval-queue returns pending providers with SLA metadata', async () => {
    seedProvider(global.__testDb, { id: 1, approval_status: 'pending' });
    seedProvider(global.__testDb, { id: 2, approval_status: 'approved' });

    const response = await request(app).get('/api/admin/providers/approval-queue');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.providers).toHaveLength(1);
    expect(response.body.providers[0].provider_id).toBe(1);
    expect(response.body.providers[0].created_at).toBe('2026-04-02T10:00:00.000Z');
    expect(response.body.providers[0].pending_duration_seconds).toBeGreaterThan(0);
    expect(response.body.providers[0].pending_duration).toMatch(/s$/);
    expect(response.body.providers[0].reason).toBe('awaiting_manual_review');
    expect(response.body.providers[0].sla_deadline_at).toBeTruthy();
    expect(typeof response.body.providers[0].sla_breached).toBe('boolean');
  });

  test('PATCH /api/admin/providers/:id/approval-decision approve updates provider and writes immutable audit row', async () => {
    seedProvider(global.__testDb, { id: 10, approval_status: 'pending' });

    const response = await request(app)
      .patch('/api/admin/providers/10/approval-decision')
      .set('x-admin-token', 'admin-token-1')
      .send({ decision: 'approve' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.provider_id).toBe(10);
    expect(response.body.approval_status).toBe('approved');
    expect(response.body.approved_at).toBeTruthy();
    expect(response.body.rejected_reason).toBeNull();
    expect(response.body.audit_entry).toBeTruthy();
    expect(response.body.audit_entry.action).toBe('provider_approved');
    expect(response.body.audit_entry.admin_user_id).toBe('admin-token-1');

    const provider = global.__testDb.prepare('SELECT approval_status, approved_at, rejected_reason FROM providers WHERE id = 10').get();
    expect(provider.approval_status).toBe('approved');
    expect(provider.approved_at).toBeTruthy();
    expect(provider.rejected_reason).toBeNull();

    const auditRows = global.__testDb.prepare(
      `SELECT action, target_type, target_id FROM admin_audit_log WHERE target_type = 'provider' AND target_id = '10'`
    ).all();
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].action).toBe('provider_approved');
  });

  test('PATCH /api/admin/providers/:id/approval-decision reject requires reason and returns contract error', async () => {
    seedProvider(global.__testDb, { id: 11, approval_status: 'pending' });

    const response = await request(app)
      .patch('/api/admin/providers/11/approval-decision')
      .send({ decision: 'reject' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'reason is required when decision is reject' });
  });

  test('reject decision is readable via GET /api/admin/providers/:id/approval-audit', async () => {
    seedProvider(global.__testDb, { id: 12, approval_status: 'pending' });

    const mutateResponse = await request(app)
      .patch('/api/admin/providers/12/approval-decision')
      .set('x-admin-token', 'admin-token-2')
      .send({ decision: 'reject', reason: 'invalid gpu telemetry sample' });

    expect(mutateResponse.status).toBe(200);
    expect(mutateResponse.body.approval_status).toBe('rejected');

    const auditResponse = await request(app).get('/api/admin/providers/12/approval-audit');

    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body.provider_id).toBe(12);
    expect(auditResponse.body.approval_status).toBe('rejected');
    expect(auditResponse.body.rejected_reason).toBe('invalid gpu telemetry sample');
    expect(auditResponse.body.count).toBe(1);
    expect(auditResponse.body.entries[0].action).toBe('provider_rejected');
    expect(auditResponse.body.entries[0].admin_user_id).toBe('admin-token-2');
  });
});
