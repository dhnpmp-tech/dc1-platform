'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
process.env.ALLOW_SANDBOX_TOPUP = 'true';

const express = require('express');
const request = require('supertest');

const db = require('../../src/db');
const { registerRenter } = require('./helpers');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/renters', require('../../src/routes/renters'));
  return app;
}

function resetTables() {
  const tables = [
    'org_audit_log',
    'renter_api_keys',
    'renter_credit_ledger',
    'renters',
  ];
  for (const table of tables) {
    try { db.run(`DELETE FROM ${table}`); } catch (_) {}
  }
}

function latestAudit(actionPrefix) {
  return db.get(
    `SELECT org_id, actor_type, actor_role, action, outcome, reason, metadata_json
     FROM org_audit_log
     WHERE action LIKE ?
     ORDER BY id DESC
     LIMIT 1`,
    `${actionPrefix}%`
  );
}

describe('DCP-320 renter RBAC + org audit', () => {
  let app;
  let renter;

  beforeEach(async () => {
    resetTables();
    app = createApp();
    renter = await registerRenter(request, app, {
      name: 'RBAC Renter',
      email: `rbac-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
    });
  });

  it('allows read-only scoped key on balance and writes allow audit event', async () => {
    const createKey = await request(app)
      .post('/api/renters/me/keys')
      .set('x-renter-key', renter.apiKey)
      .send({
        label: 'read-only-balance',
        scopes: ['billing'],
        org_role: 'read-only',
      });

    expect(createKey.status).toBe(201);
    expect(createKey.body.org_role).toBe('read-only');

    const balanceRes = await request(app)
      .get(`/api/renters/${renter.renterId}/balance`)
      .set('x-renter-key', createKey.body.key);

    expect(balanceRes.status).toBe(200);
    const audit = latestAudit('GET /api/renters/');
    expect(audit).toEqual(expect.objectContaining({
      actor_type: 'scoped_key',
      actor_role: 'read-only',
      outcome: 'allow',
      reason: 'min_role_read-only',
    }));
    expect(audit.action).toContain(`/balance`);
  });

  it('denies read-only scoped key on topup and writes deny audit event', async () => {
    const createKey = await request(app)
      .post('/api/renters/me/keys')
      .set('x-renter-key', renter.apiKey)
      .send({
        label: 'read-only-topup-deny',
        scopes: ['billing'],
        org_role: 'read-only',
      });

    expect(createKey.status).toBe(201);

    const topupRes = await request(app)
      .post(`/api/renters/${renter.renterId}/topup`)
      .set('x-renter-key', createKey.body.key)
      .send({ amount_sar: 10 });

    expect(topupRes.status).toBe(403);
    expect(topupRes.body.error).toContain('admin role required');

    const audit = latestAudit('POST /api/renters/');
    expect(audit).toEqual(expect.objectContaining({
      actor_type: 'scoped_key',
      actor_role: 'read-only',
      outcome: 'deny',
      reason: 'requires_admin',
    }));
    expect(audit.action).toContain('/topup');
  });

  it('allows admin scoped key on topup and writes allow audit event', async () => {
    const createKey = await request(app)
      .post('/api/renters/me/keys')
      .set('x-renter-key', renter.apiKey)
      .send({
        label: 'admin-topup-allow',
        scopes: ['admin'],
        org_role: 'admin',
      });

    expect(createKey.status).toBe(201);
    expect(createKey.body.org_role).toBe('admin');

    const topupRes = await request(app)
      .post(`/api/renters/${renter.renterId}/topup`)
      .set('x-renter-key', createKey.body.key)
      .send({ amount_sar: 25 });

    expect(topupRes.status).toBe(200);
    expect(topupRes.body).toEqual(expect.objectContaining({
      success: true,
      amount_sar: 25,
      amount_halala: 2500,
    }));

    const audit = latestAudit('POST /api/renters/');
    expect(audit).toEqual(expect.objectContaining({
      actor_type: 'scoped_key',
      actor_role: 'admin',
      outcome: 'allow',
      reason: 'min_role_admin',
    }));
    expect(audit.action).toContain('/topup');
  });
});
