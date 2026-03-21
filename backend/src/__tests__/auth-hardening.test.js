const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');

jest.mock('../db', () => {
  function mockFlatParams(params) {
    if (params.length === 1 && Array.isArray(params[0])) return params[0];
    return params.reduce((acc, p) => (Array.isArray(p) ? acc.concat(p) : acc.concat([p])), []);
  }

  return {
    get run() { return (sql, ...params) => global.__testDb.prepare(sql).run(...mockFlatParams(params)); },
    get get() { return (sql, ...params) => global.__testDb.prepare(sql).get(...mockFlatParams(params)); },
    get all() { return (sql, ...params) => global.__testDb.prepare(sql).all(...mockFlatParams(params)); },
    get prepare() { return (sql) => global.__testDb.prepare(sql); },
    get _db() { return global.__testDb; },
    close: () => {},
  };
});

describe('auth hardening', () => {
  const ADMIN_TOKEN = 'test-admin-token';

  beforeEach(() => {
    process.env.DC1_ADMIN_TOKEN = ADMIN_TOKEN;
    global.__testDb = new Database(':memory:');
    global.__testDb.exec(`
      CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        gpu_model TEXT,
        api_key TEXT,
        status TEXT DEFAULT 'online',
        verification_status TEXT,
        verification_challenge TEXT,
        gpu_name_detected TEXT,
        gpu_vram_mib INTEGER,
        verified_gpu TEXT,
        verification_score INTEGER,
        verification_last_at DATETIME,
        reliability_score INTEGER,
        total_jobs INTEGER,
        total_earnings INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    global.__testDb.exec(`
      CREATE TABLE IF NOT EXISTS verification_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER,
        challenge_id TEXT,
        challenge_params TEXT,
        status TEXT,
        requested_at DATETIME,
        completed_at DATETIME,
        result_data TEXT,
        verdict TEXT,
        score INTEGER,
        flags TEXT
      )
    `);
  });

  afterEach(() => {
    delete process.env.DC1_ADMIN_TOKEN;
    try { global.__testDb.close(); } catch {}
  });

  test('security route accepts Authorization: Bearer token', async () => {
    const secPath = require.resolve('../routes/security');
    delete require.cache[secPath];
    const securityRouter = require('../routes/security');

    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    const res = await request(app)
      .get('/api/security/summary')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
  });

  test('security route fails closed when admin token is missing from env', async () => {
    delete process.env.DC1_ADMIN_TOKEN;
    const secPath = require.resolve('../routes/security');
    delete require.cache[secPath];
    const securityRouter = require('../routes/security');

    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    const res = await request(app)
      .get('/api/security/summary')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });

  test('verification challenge rejects legacy body token and requires header token', async () => {
    global.__testDb.prepare(
      `INSERT INTO providers (name, email, gpu_model, api_key, status)
       VALUES (?, ?, ?, ?, ?)`
    ).run('P1', 'p1@test.com', 'RTX 4090', 'provider-key', 'online');

    const verPath = require.resolve('../routes/verification');
    delete require.cache[verPath];
    const verificationRouter = require('../routes/verification');

    const app = express();
    app.use(express.json());
    app.use('/api/verification', verificationRouter);

    const noHeaderRes = await request(app)
      .post('/api/verification/challenge')
      .send({ provider_id: 1, admin_token: ADMIN_TOKEN });
    expect(noHeaderRes.status).toBe(401);

    const okRes = await request(app)
      .post('/api/verification/challenge')
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ provider_id: 1 });
    expect(okRes.status).toBe(200);
    expect(okRes.body.success).toBe(true);
  });
});
