/**
 * DCP-44: Rate Limiting Tests
 *
 * Tests that express-rate-limit middleware is correctly wired and returns 429
 * when limits are exceeded. Each test uses a minimal Express app with the
 * limiter applied at a very low threshold (max: 2) so we can trigger 429
 * without making hundreds of requests.
 *
 * Rate limiter config tested (mirroring server.js):
 *   - Provider registration: 5/hr → 429 on 6th request
 *   - Renter registration:   5/hr → same
 *   - Job submission:        20/min per renter key
 *   - Admin endpoints:       100/min → tested via low-max fixture
 */

'use strict';

if (!process.env.DC1_DB_PATH)     process.env.DC1_DB_PATH     = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token';

const rateLimit = require('express-rate-limit');
const request   = require('supertest');
const express   = require('express');
const db        = require('../../src/db');
const { jobSubmitLimiter } = require('../../src/middleware/rateLimiter');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build an Express app with one route and a custom rate limiter. */
function buildLimitedApp(method, path, limiter, handler) {
  const app = express();
  app.use(express.json());
  app.use(path, limiter);
  app[method](path, handler);
  return app;
}

function makeOkHandler() {
  return (req, res) => res.json({ ok: true });
}

/** Hit an endpoint `n` times and return array of status codes. */
async function hitNTimes(app, method, url, n, body = null) {
  const statuses = [];
  for (let i = 0; i < n; i++) {
    const req = request(app)[method](url);
    if (body) req.send(body);
    const res = await req;
    statuses.push(res.status);
  }
  return statuses;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Rate limiting — general enforcement', () => {
  it('returns 429 after exceeding max requests within window', async () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2, standardHeaders: true, legacyHeaders: false });
    const app = buildLimitedApp('get', '/test', limiter, makeOkHandler());

    const statuses = await hitNTimes(app, 'get', '/test', 3);
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBe(200);
    expect(statuses[2]).toBe(429);
  });

  it('returns RateLimit-* headers on responses', async () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false });
    const app = buildLimitedApp('get', '/headers', limiter, makeOkHandler());

    const res = await request(app).get('/headers');
    expect(res.status).toBe(200);
    // express-rate-limit v7 uses RateLimit-* (draft-7)
    expect(
      res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']
    ).toBeDefined();
  });

  it('returns 429 with error message body', async () => {
    const errorMsg = { error: 'Too many requests in test' };
    const limiter = rateLimit({
      windowMs: 60_000, max: 1,
      message: errorMsg,
      standardHeaders: true, legacyHeaders: false,
    });
    const app = buildLimitedApp('get', '/err', limiter, makeOkHandler());

    await request(app).get('/err'); // first → 200
    const res = await request(app).get('/err'); // second → 429
    expect(res.status).toBe(429);
    expect(res.body.error).toBe(errorMsg.error);
  });
});

describe('Rate limiting — provider registration (max: 5/hr)', () => {
  it('blocks 6th registration attempt from same IP (429)', async () => {
    // Use max:5 matching production config, but short windowMs so CI does not hang
    const limiter = rateLimit({
      windowMs: 60_000, max: 5,
      message: { error: 'Too many registration attempts. Try again in 1 hour.' },
      standardHeaders: true, legacyHeaders: false,
    });
    const app = buildLimitedApp('post', '/api/providers/register', limiter, makeOkHandler());
    const statuses = await hitNTimes(app, 'post', '/api/providers/register', 6, {});

    // First 5 succeed, 6th is rate limited
    expect(statuses.slice(0, 5).every(s => s === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

describe('Rate limiting — renter registration (max: 5/hr)', () => {
  it('blocks 6th renter registration from same IP (429)', async () => {
    const limiter = rateLimit({
      windowMs: 60_000, max: 5,
      message: { error: 'Too many registration attempts. Try again in 1 hour.' },
      standardHeaders: true, legacyHeaders: false,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/renters/register', limiter);
    const renterRoute = (() => { const p = require.resolve('../../src/routes/renters'); delete require.cache[p]; return require('../../src/routes/renters'); })();
    app.use('/api/renters', renterRoute);

    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app).post('/api/renters/register').send({
        name: `R${i}`, email: `renter-rl-${i}-${Date.now()}@dc1.test`,
      });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 5).every(s => s === 201)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

describe('Rate limiting — job submission (max: 30/min)', () => {
  it('limits job submissions and returns 429 + error message', async () => {
    const limiter = rateLimit({
      windowMs: 60_000, max: 3,
      message: { error: 'Too many job submissions. Slow down.' },
      standardHeaders: true, legacyHeaders: false,
    });
    const app = buildLimitedApp('post', '/api/jobs/submit', limiter, makeOkHandler());

    const statuses = await hitNTimes(app, 'post', '/api/jobs/submit', 4, {});
    expect(statuses[3]).toBe(429);
  });
});

describe('Rate limiting — per API key policy (DCP-270)', () => {
  it('enforces 20 requests/minute per renter key and returns retryAfterMs', async () => {
    const app = buildLimitedApp('post', '/api/jobs/submit', jobSubmitLimiter, makeOkHandler());
    const keyA = 'dc1-renter-key-a';
    const keyB = 'dc1-renter-key-b';

    for (let i = 0; i < 20; i++) {
      const res = await request(app)
        .post('/api/jobs/submit')
        .set('x-renter-key', keyA)
        .send({});
      expect(res.status).toBe(200);
    }

    const blocked = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', keyA)
      .send({});

    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      error: 'Rate limit exceeded',
      retryAfterMs: 60000,
    });
    expect(typeof blocked.body.retryAfterSeconds).toBe('number');

    const differentKey = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', keyB)
      .send({});

    expect(differentKey.status).toBe(200);
  });
});

describe('Rate limiting — admin endpoints (max: 100/min)', () => {
  it('limits admin API calls and returns 429 + error message', async () => {
    const limiter = rateLimit({
      windowMs: 60_000, max: 2,
      message: { error: 'Admin rate limit exceeded.' },
      standardHeaders: true, legacyHeaders: false,
    });
    const app = buildLimitedApp('get', '/api/admin/dashboard', limiter, makeOkHandler());

    const statuses = await hitNTimes(app, 'get', '/api/admin/dashboard', 3);
    expect(statuses[2]).toBe(429);
  });
});

describe('Rate limiting — providers available route (max: 60/min)', () => {
  it('returns 429 on the 61st request to /api/providers/available', async () => {
    const app = express();
    app.use(express.json());
    const providersRoute = (() => {
      const p = require.resolve('../../src/routes/providers');
      delete require.cache[p];
      return require('../../src/routes/providers');
    })();
    app.use('/api/providers', providersRoute);

    const statuses = await hitNTimes(app, 'get', '/api/providers/available', 61);
    expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true);
    expect(statuses[60]).toBe(429);
  });
});
