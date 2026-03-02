/**
 * Shared test helpers — DB cleanup, provider registration, etc.
 */
const db = require('../../src/db');

// Fix jobs table schema — db.js has two conflicting CREATE TABLE IF NOT EXISTS.
// The first one wins and lacks columns jobs.js needs. Drop and recreate with the correct schema.
try {
  db._db.exec('DROP TABLE IF EXISTS jobs');
  db._db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT,
      provider_id INTEGER NOT NULL,
      job_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      vram_required INTEGER DEFAULT 0,
      submitted_at DATETIME,
      started_at DATETIME,
      completed_at DATETIME,
      duration_minutes INTEGER,
      cost_halala INTEGER DEFAULT 0,
      gpu_requirements TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    )
  `);
  // Also fix recovery_events — db.js has two conflicting schemas
  db._db.exec('DROP TABLE IF EXISTS recovery_events');
  db._db.exec(`
    CREATE TABLE IF NOT EXISTS recovery_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT,
      from_provider_id INTEGER,
      to_provider_id INTEGER,
      reason TEXT,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      notes TEXT
    )
  `);
} catch (e) { /* ignore */ }

function cleanDb() {
  db.run('DELETE FROM benchmark_runs');
  db.run('DELETE FROM recovery_events');
  db.run('DELETE FROM jobs');
  db.run('DELETE FROM providers');
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

module.exports = { cleanDb, registerProvider, bringOnline, db };
