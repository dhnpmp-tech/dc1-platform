const request = require('supertest');

process.env.ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT = '1';

jest.mock('../../src/services/jobSweep', () => ({
  startJobSweep: jest.fn(),
  getSweepMetrics: jest.fn(() => ({})),
  startProviderOfflineSweep: jest.fn(),
}));
jest.mock('../../src/workers/providerHealthWorker', () => ({
  startProviderHealthWorker: jest.fn(),
}));
jest.mock('../../src/services/controlPlane', () => ({
  runControlPlaneCycle: jest.fn(),
}));
jest.mock('../../src/services/notifications', () => ({
  sendAlert: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../src/services/recovery-engine', () => ({
  runRecoveryCycle: jest.fn(),
}));
jest.mock('../../src/services/fallback-loop', () => ({
  startLoop: jest.fn(),
}));
jest.mock('../../src/services/providerLivenessMonitor', () => ({
  start: jest.fn(),
}));
jest.mock('../../src/services/cleanup', () => ({
  schedule: jest.fn(),
}));
jest.mock('../../src/services/emailService', () => ({
  sendWithdrawalApprovedEmail: jest.fn(() => Promise.resolve()),
  sendWithdrawalRejectedEmail: jest.fn(() => Promise.resolve()),
  sendJobQueued: jest.fn(() => Promise.resolve()),
  sendJobStarted: jest.fn(() => Promise.resolve()),
  sendJobCompleted: jest.fn(() => Promise.resolve()),
  sendJobFailed: jest.fn(() => Promise.resolve()),
}));

describe('sensitive audit runtime wiring', () => {
  let db;
  let app;
  let intervalSpy;
  const adminToken = 'audit-runtime-admin-token';

  beforeEach(() => {
    jest.resetModules();
    process.env.DC1_ADMIN_TOKEN = adminToken;
    process.env.DC1_HMAC_SECRET = 'audit-runtime-hmac-secret';
    intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => 0);

    db = require('../../src/db');
    app = require('../../src/server');

    db.run('DELETE FROM security_audit_events');
    db.run('DELETE FROM payout_requests');
    db.run('DELETE FROM jobs');
    db.run('DELETE FROM providers');
  });

  afterEach(() => {
    intervalSpy.mockRestore();
  });

  test('POST /api/admin/payouts/:id/approve emits exactly one classified security audit row', async () => {
    db.run(
      `INSERT INTO providers (id, name, email, status, approval_status, created_at, updated_at)
       VALUES (?, ?, ?, 'online', 'approved', datetime('now'), datetime('now'))`,
      9201,
      'Audit Provider',
      'audit-provider@example.com'
    );
    db.run(
      `INSERT INTO payout_requests
         (id, provider_id, amount_usd, amount_sar, amount_halala, status, requested_at)
       VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`,
      'audit-payout-approve-1',
      9201,
      20.0,
      75.0,
      7500
    );

    const res = await request(app)
      .post('/api/admin/payouts/audit-payout-approve-1/approve')
      .set('x-admin-token', adminToken)
      .send({ payment_ref: 'WIRE-AUDIT-1' });

    expect(res.status).toBe(200);

    const rows = db.all(
      `SELECT action, resource_type, resource_id, status_code
       FROM security_audit_events
       WHERE resource_type = 'payout' AND resource_id = ?
       ORDER BY id ASC`,
      'audit-payout-approve-1'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        action: 'admin.payout.approve',
        resource_type: 'payout',
        resource_id: 'audit-payout-approve-1',
        status_code: 200,
      })
    );
  });

  test('PATCH /api/admin/payouts/:id (paid) emits exactly one deterministic legacy action', async () => {
    db.run(
      `INSERT INTO providers (id, name, email, status, approval_status, created_at, updated_at)
       VALUES (?, ?, ?, 'online', 'approved', datetime('now'), datetime('now'))`,
      9202,
      'Audit Provider Legacy',
      'audit-provider-legacy@example.com'
    );
    db.run(
      `INSERT INTO payout_requests
         (id, provider_id, amount_usd, amount_sar, amount_halala, status, requested_at)
       VALUES (?, ?, ?, ?, ?, 'processing', datetime('now'))`,
      'audit-payout-legacy-1',
      9202,
      12.0,
      45.0,
      4500
    );

    const res = await request(app)
      .patch('/api/admin/payouts/audit-payout-legacy-1')
      .set('x-admin-token', adminToken)
      .send({ action: 'paid', payment_ref: 'WIRE-LEGACY-1' });

    expect(res.status).toBe(200);

    const rows = db.all(
      `SELECT action, resource_type, resource_id, status_code
       FROM security_audit_events
       WHERE resource_type = 'payout' AND resource_id = ?
       ORDER BY id ASC`,
      'audit-payout-legacy-1'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        action: 'admin.payout.mark_paid',
        resource_type: 'payout',
        resource_id: 'audit-payout-legacy-1',
        status_code: 200,
      })
    );
  });

  test('GET /api/jobs/:job_id/output emits exactly one classified job-result audit row', async () => {
    db.run(
      `INSERT INTO jobs
         (job_id, status, result, created_at, updated_at, submitted_at, completed_at)
       VALUES (?, 'completed', ?, datetime('now'), datetime('now'), datetime('now'), datetime('now'))`,
      'audit-job-output-1',
      'DC1_RESULT_JSON:{"type":"text","response":"ok"}'
    );

    const res = await request(app)
      .get('/api/jobs/audit-job-output-1/output')
      .set('x-admin-token', adminToken);

    expect(res.status).toBe(200);

    const rows = db.all(
      `SELECT action, resource_type, resource_id, status_code
       FROM security_audit_events
       WHERE resource_type = 'job' AND resource_id = ?
       ORDER BY id ASC`,
      'audit-job-output-1'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        action: 'job.result.read',
        resource_type: 'job',
        resource_id: 'audit-job-output-1',
        status_code: 200,
      })
    );
  });
});
