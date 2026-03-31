/**
 * Tests for rate limiting and admin IP allowlist middleware.
 */

const express = require('express');
const request = require('supertest');
const { ipKeyGenerator } = require('express-rate-limit');
const { createRateLimiter, createAdminIpAllowlist } = require('../middleware/rateLimiter');

jest.setTimeout(30_000);

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function makeApp({ max = 2, adminToken = 'test-token', allowlist = '' } = {}) {
  const app = express();
  app.set('trust proxy', false);
  app.use(express.json());

  const limiter = createRateLimiter({
    windowMs: 60000,
    max,
    keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1'),
  });

  const savedToken = process.env.DC1_ADMIN_TOKEN;
  const savedAllowlist = process.env.ADMIN_IP_ALLOWLIST;
  process.env.DC1_ADMIN_TOKEN = adminToken;
  process.env.ADMIN_IP_ALLOWLIST = allowlist;
  const ipAllowlist = createAdminIpAllowlist();
  process.env.DC1_ADMIN_TOKEN = savedToken || '';
  process.env.ADMIN_IP_ALLOWLIST = savedAllowlist || '';

  if (ipAllowlist) app.use('/api/admin', ipAllowlist);
  app.use('/api/limited', limiter);
  app.get('/api/limited', (req, res) => res.json({ ok: true }));

  app.use('/api/admin', (req, res, next) => {
    const token = req.headers['x-admin-token'] || '';
    if (token !== adminToken) return res.status(401).json({ error: 'Admin access denied' });
    next();
  });
  app.get('/api/admin/data', (req, res) => res.json({ secret: true }));

  return app;
}

describe('Rate limiting — 429 after limit', () => {
  test('returns 429 after max requests exceeded', async () => {
    const app = makeApp({ max: 2 });
    await request(app).get('/api/limited').expect(200);
    await request(app).get('/api/limited').expect(200);
    const res = await request(app).get('/api/limited');
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('error', 'Rate limit exceeded');
    expect(res.body).toHaveProperty('retryAfterSeconds');
    expect(res.headers['retry-after']).toBeDefined();
  });

  test('429 response includes retryAfterMs', async () => {
    const app = makeApp({ max: 1 });
    await request(app).get('/api/limited').expect(200);
    const res = await request(app).get('/api/limited');
    expect(res.status).toBe(429);
    expect(typeof res.body.retryAfterMs).toBe('number');
    expect(res.body.retryAfterMs).toBeGreaterThan(0);
  });
});

describe('Rate limiting — X-RateLimit headers', () => {
  test('sets RateLimit-Limit header on responses', async () => {
    const app = makeApp({ max: 5 });
    const res = await request(app).get('/api/limited').expect(200);
    const limitHeader = res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit'];
    expect(limitHeader).toBeDefined();
  });

  test('RateLimit-Remaining decrements on successive requests', async () => {
    const app = makeApp({ max: 5 });
    const res1 = await request(app).get('/api/limited').expect(200);
    const res2 = await request(app).get('/api/limited').expect(200);
    const r1 = parseInt(res1.headers['ratelimit-remaining'] || res1.headers['x-ratelimit-remaining'] || '5', 10);
    const r2 = parseInt(res2.headers['ratelimit-remaining'] || res2.headers['x-ratelimit-remaining'] || '5', 10);
    expect(r2).toBeLessThan(r1);
  });

  test('sets Retry-After header on 429', async () => {
    const app = makeApp({ max: 1 });
    await request(app).get('/api/limited').expect(200);
    const res = await request(app).get('/api/limited').expect(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(parseInt(res.headers['retry-after'], 10)).toBeGreaterThan(0);
  });
});

describe('Admin auth — 401 without valid token', () => {
  test('returns 401 when no token provided', async () => {
    const res = await request(makeApp({ adminToken: 'secret' })).get('/api/admin/data');
    expect(res.status).toBe(401);
  });

  test('returns 401 when wrong token provided', async () => {
    const res = await request(makeApp({ adminToken: 'secret' })).get('/api/admin/data').set('x-admin-token', 'wrong');
    expect(res.status).toBe(401);
  });

  test('returns 200 with correct admin token', async () => {
    const res = await request(makeApp({ adminToken: 'secret' })).get('/api/admin/data').set('x-admin-token', 'secret');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('secret', true);
  });
});

describe('Admin IP allowlist', () => {
  test('createAdminIpAllowlist returns null when ADMIN_IP_ALLOWLIST is empty', () => {
    const saved = process.env.ADMIN_IP_ALLOWLIST;
    process.env.ADMIN_IP_ALLOWLIST = '';
    const mw = createAdminIpAllowlist();
    process.env.ADMIN_IP_ALLOWLIST = saved || '';
    expect(mw).toBeNull();
  });

  test('createAdminIpAllowlist returns function when allowlist is configured', () => {
    const saved = process.env.ADMIN_IP_ALLOWLIST;
    process.env.ADMIN_IP_ALLOWLIST = '192.168.1.1';
    const mw = createAdminIpAllowlist();
    process.env.ADMIN_IP_ALLOWLIST = saved || '';
    expect(typeof mw).toBe('function');
  });

  test('allowlist blocks requests from non-allowlisted IPs with 403', async () => {
    const app = makeApp({ allowlist: '192.168.1.100', adminToken: 'tok' });
    const res = await request(app).get('/api/admin/data').set('x-admin-token', 'tok');
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});

describe('Rate limiter config validation', () => {
  test('jobSubmitLimiter is exported as a function', () => {
    const { jobSubmitLimiter } = require('../middleware/rateLimiter');
    expect(typeof jobSubmitLimiter).toBe('function');
  });

  test('catalogLimiter is exported', () => {
    const { catalogLimiter } = require('../middleware/rateLimiter');
    expect(typeof catalogLimiter).toBe('function');
  });

  test('authLimiter is exported', () => {
    const { authLimiter } = require('../middleware/rateLimiter');
    expect(typeof authLimiter).toBe('function');
  });

  test('createAdminIpAllowlist is exported and callable', () => {
    const { createAdminIpAllowlist } = require('../middleware/rateLimiter');
    expect(typeof createAdminIpAllowlist).toBe('function');
  });
});
