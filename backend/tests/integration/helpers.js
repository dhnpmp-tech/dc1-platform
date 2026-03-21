/**
 * Shared test helpers — DB cleanup, provider registration, etc.
 */
const db = require('../../src/db');

// db.js handles the full schema including all migrations.
// Do not drop/recreate tables here — that would lose migration-added columns.

function cleanDb() {
  // Make cleanup resilient to schema drift and FK relationships across suites.
  try { db.run('PRAGMA foreign_keys = OFF'); } catch (_) {}
  const tables = [
    'benchmark_runs',
    'recovery_events',
    'job_lifecycle_events',
    'job_logs',
    'job_executions',
    'escrow_holds',
    'heartbeat_log',
    'withdrawal_requests',
    'approved_container_images',
    'image_scans',
    'allowed_images',
    'quota_log',
    'renter_quota',
    'jobs',
    'renters',
    'providers',
  ];
  for (const table of tables) {
    try { db.run(`DELETE FROM ${table}`); } catch (_) {}
  }
  try { db.run('PRAGMA foreign_keys = ON'); } catch (_) {}
}

/** Register a provider via API and return { body, apiKey, providerId } */
async function registerProvider(request, app, overrides = {}) {
  const payload = {
    name: overrides.name || 'Test Provider',
    email: overrides.email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
    gpu_model: overrides.gpu_model || 'RTX 4090',
    os: overrides.os || 'Linux',
  };
  const res = await request(app).post('/api/providers/register').send(payload);
  return {
    body: res.body,
    apiKey: res.body.api_key,
    providerId: res.body.provider_id,
    status: res.status,
  };
}

/** Send heartbeat to bring provider online */
async function bringOnline(request, app, apiKey) {
  const res = await request(app).post('/api/providers/heartbeat').send({
    api_key: apiKey,
    gpu_status: { temp: 45, utilization: 0 },
    uptime: 3600,
    provider_ip: '10.0.0.1',
    provider_hostname: 'test-node',
  });
  return res;
}

/** Register a renter via API and return { body, apiKey, renterId } */
async function registerRenter(request, app, overrides = {}) {
  const res = await request(app).post('/api/renters/register').send({
    name:  overrides.name  || `Renter-${Date.now()}`,
    email: overrides.email || `renter-${Date.now()}-${Math.random().toString(36).slice(2)}@dc1.test`,
  });
  if (overrides.balanceHalala) {
    db.run('UPDATE renters SET balance_halala = ? WHERE id = ?', overrides.balanceHalala, res.body.renter_id);
  }
  return {
    body:     res.body,
    apiKey:   res.body.api_key,
    renterId: res.body.renter_id,
    status:   res.status,
  };
}

module.exports = { cleanDb, registerProvider, registerRenter, bringOnline, db };
