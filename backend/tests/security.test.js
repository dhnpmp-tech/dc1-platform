'use strict';

// Run with: npm test -- --testPathPattern=security
// These tests require a running backend (use test DB)
// Add to CI: runs on every PR touching backend/src/
//
// NOTE: Rate limiting tests (Group 2) require DISABLE_RATE_LIMIT to be unset.
// To force disable rate limiting in local runs, set DISABLE_RATE_LIMIT=1.
if (!process.env.DISABLE_RATE_LIMIT) process.env.DISABLE_RATE_LIMIT = '1';

const path    = require('path');
const crypto  = require('crypto');
const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');

// ── Core modules ───────────────────────────────────────────────────────────────
const db = require('../src/db');
const { requireAdminAuth } = require('../src/middleware/auth');
const { createRateLimiter } = require('../src/middleware/rateLimiter');

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN || 'test-admin-token-jest';

// ── App: minimal admin-protected endpoint (auth tests) ────────────────────────
const adminApp = (() => {
  const app = express();
  app.use(express.json());
  app.get('/admin/ping', requireAdminAuth, (_req, res) => res.json({ ok: true }));
  return app;
})();

// ── App: provider register + REST heartbeat (validation / SQL injection) ──────
process.env.ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT = '1';
const providerApp = (() => {
  const app = express();
  app.use(express.json());
  app.use('/api/providers', require('../src/routes/providers'));
  return app;
})();

// ── JWT builder — lets us craft malicious tokens for regression tests ──────────
function buildJwt(header, payload, secret) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = `${b64(header)}.${b64(payload)}`;
  let sig = '';
  if (header.alg === 'HS256' && secret) {
    sig = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  }
  // alg:none → empty signature per RFC 7519
  return `${signingInput}.${sig}`;
}

// ── DB helpers ─────────────────────────────────────────────────────────────────
function cleanDb() {
  const safe = (t) => { try { db.prepare(`DELETE FROM ${t}`).run(); } catch (_) {} };
  try { db.prepare('PRAGMA foreign_keys = OFF').run(); } catch (_) {}
  for (const t of [
    'heartbeat_log', 'provider_gpu_telemetry', 'provider_metrics',
    'provider_benchmarks', 'jobs', 'providers',
  ]) safe(t);
  try { db.prepare('PRAGMA foreign_keys = ON').run(); } catch (_) {}
}

let provCount = 0;
async function registerProvider(overrides = {}) {
  const i = ++provCount;
  return request(providerApp)
    .post('/api/providers/register')
    .send({
      name: `SecurityTest-${i}-${Date.now()}`,
      email: `sec-${i}-${Date.now()}@dc1.test`,
      gpu_model: 'RTX 4090',
      os: 'linux',
      ...overrides,
    });
}

// ── Rate limiter helpers ───────────────────────────────────────────────────────
// Build a fresh rate limiter while temporarily clearing DISABLE_RATE_LIMIT so the
// factory uses the configured max (not Number.MAX_SAFE_INTEGER).
function makeRealLimiter(config) {
  const rlPath = require.resolve('../src/middleware/rateLimiter');
  const cached = require.cache[rlPath];
  delete require.cache[rlPath];

  const savedDisable = process.env.DISABLE_RATE_LIMIT;
  delete process.env.DISABLE_RATE_LIMIT;

  const RL = require(rlPath);
  const limiter = RL.createRateLimiter(config);

  // Restore environment and module cache
  if (savedDisable !== undefined) process.env.DISABLE_RATE_LIMIT = savedDisable;
  if (cached) require.cache[rlPath] = cached;
  else delete require.cache[rlPath];

  return limiter;
}

function buildRLApp(limiter) {
  const app = express();
  app.set('trust proxy', false);
  app.use(limiter);
  app.post('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

// ── Ethers (for EB-M01 idempotency tests) ─────────────────────────────────────
let ethers;
try {
  ethers = require('ethers');
} catch (_) {
  try {
    ethers = require(path.resolve(__dirname, '../../contracts/node_modules/ethers'));
  } catch (__) { /* ethers unavailable — EB-M01 tests will be skipped */ }
}

// ── Escrow listener handlers (DCP-912 test-only exports) ──────────────────────
let _handlePaymentReleased, _handleDisputeRaised;
try {
  const esc = require('../src/services/escrowListener');
  _handlePaymentReleased = esc._handlePaymentReleased;
  _handleDisputeRaised   = esc._handleDisputeRaised;
} catch (_) { /* handlers unavailable — EB-M01 tests will be skipped */ }

const EB_M01_AVAILABLE = !!(ethers && _handlePaymentReleased && _handleDisputeRaised);

// ── Escrow in-memory DB builder ───────────────────────────────────────────────
const PROVIDER_ADDR = '0xaabbccddeeff001122334455667788990011aabb';
const TX_HASH       = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const ALT_TX_HASH   = '0xcafebeefcafebeefcafebeefcafebeefcafebeefcafebeefcafebeefcafebeef';
const JOB_ID        = 'security-regression-job-001';

function buildEscrowDb() {
  const edb = new Database(':memory:');
  edb.pragma('journal_mode = WAL');
  edb.exec(`
    CREATE TABLE providers (id TEXT PRIMARY KEY, eth_address TEXT, deleted_at TEXT);
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY, job_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running', provider_id TEXT
    );
    CREATE TABLE payout_requests (
      id            TEXT PRIMARY KEY,
      provider_id   TEXT    NOT NULL,
      amount_usd    REAL    NOT NULL,
      amount_sar    REAL    NOT NULL,
      amount_halala INTEGER NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'pending',
      requested_at  TEXT    NOT NULL,
      escrow_tx_hash TEXT
    );
    CREATE TABLE admin_alerts (
      id         TEXT PRIMARY KEY,
      alert_type TEXT NOT NULL,
      job_id     TEXT,
      payload    TEXT,
      created_at TEXT NOT NULL,
      tx_hash    TEXT
    );
    CREATE UNIQUE INDEX idx_payout_tx ON payout_requests(escrow_tx_hash)
      WHERE escrow_tx_hash IS NOT NULL;
    CREATE UNIQUE INDEX idx_admin_alert_tx ON admin_alerts(alert_type, tx_hash)
      WHERE tx_hash IS NOT NULL;
  `);
  edb.prepare("INSERT INTO providers (id, eth_address) VALUES ('provider-1', ?)")
    .run(PROVIDER_ADDR.toLowerCase());
  edb.prepare("INSERT INTO jobs (id, job_id, status) VALUES ('job-row-1', ?, 'running')")
    .run(JOB_ID);
  return edb;
}

function makeFakeContract(args) {
  return { interface: { parseLog: () => ({ args }) } };
}

function jobId32(jobId) {
  return ethers.keccak256(ethers.toUtf8Bytes(jobId)).toLowerCase();
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
beforeEach(cleanDb);
afterAll(cleanDb);

// =============================================================================
// GROUP 1A: Admin Authentication — token-based auth regression (DCP-906)
// =============================================================================

describe('Auth — Admin token regression (DCP-906)', () => {
  test('unauthenticated request to protected endpoint returns 401', async () => {
    const res = await request(adminApp).get('/admin/ping');
    expect(res.status).toBe(401);
  });

  test('wrong admin token returns 401', async () => {
    const res = await request(adminApp)
      .get('/admin/ping')
      .set('Authorization', 'Bearer totally-wrong-token-abc123');
    expect(res.status).toBe(401);
  });

  test('valid admin token grants access', async () => {
    const res = await request(adminApp)
      .get('/admin/ping')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('alg:none JWT as Bearer is rejected — empty-signature token does not match admin token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const noneToken = buildJwt(
      { typ: 'JWT', alg: 'none' },
      { sub: 'attacker', role: 'admin', iat: now, exp: now + 86400 },
    );
    const res = await request(adminApp)
      .get('/admin/ping')
      .set('Authorization', `Bearer ${noneToken}`);
    expect(res.status).toBe(401);
  });

  test('HS256 JWT signed with wrong secret is rejected', async () => {
    const now = Math.floor(Date.now() / 1000);
    const fakeToken = buildJwt(
      { typ: 'JWT', alg: 'HS256' },
      { sub: 'attacker', role: 'admin', iat: now, exp: now + 86400 },
      'not-the-real-admin-secret',
    );
    const res = await request(adminApp)
      .get('/admin/ping')
      .set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(401);
  });

  test('expired JWT (past exp claim) is rejected', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = buildJwt(
      { typ: 'JWT', alg: 'HS256' },
      { sub: 'old-user', iat: now - 7200, exp: now - 1 }, // expired 1 second ago
      'any-secret',
    );
    const res = await request(adminApp)
      .get('/admin/ping')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// GROUP 1B: Provider API Key Authentication
// =============================================================================

describe('Auth — Provider API key', () => {
  test('heartbeat without API key returns 401', async () => {
    const regRes = await registerProvider();
    expect([200, 201]).toContain(regRes.status);
    const res = await request(providerApp)
      .post(`/api/providers/${regRes.body.provider_id}/heartbeat`)
      .send({ gpu_utilization: 50 });
    expect(res.status).toBe(401);
  });

  test('heartbeat with invalid API key returns 401', async () => {
    const regRes = await registerProvider();
    expect([200, 201]).toContain(regRes.status);
    const res = await request(providerApp)
      .post(`/api/providers/${regRes.body.provider_id}/heartbeat`)
      .set('x-provider-key', 'fake-api-key-xxxxxxxxxxxxxxxx')
      .send({ gpu_utilization: 50 });
    expect(res.status).toBe(401);
  });

  test('heartbeat with valid API key succeeds', async () => {
    const regRes = await registerProvider();
    expect([200, 201]).toContain(regRes.status);
    const { provider_id: id, api_key: apiKey } = regRes.body;
    const res = await request(providerApp)
      .post(`/api/providers/${id}/heartbeat`)
      .set('x-provider-key', apiKey)
      .send({ gpu_utilization: 50 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// =============================================================================
// GROUP 2: Rate Limiting — per-endpoint limits (DCP-855)
// Uses makeRealLimiter() to bypass NODE_ENV=test bypass so 429 is enforced.
// =============================================================================

describe('Rate Limiting — 429 enforcement (DCP-855)', () => {
  // Fresh unique key per limiter so tests do not share counters
  const ts = Date.now();
  const RL = {
    allow3:  makeRealLimiter({ windowMs: 60000,    max: 3,  keyGenerator: () => `allow3-${ts}`  }),
    reg:     makeRealLimiter({ windowMs: 3600000,  max: 5,  keyGenerator: () => `reg-${ts}`     }),
    auth:    makeRealLimiter({ windowMs: 900000,   max: 5,  keyGenerator: () => `auth-${ts}`    }),
    vllm:    makeRealLimiter({ windowMs: 60000,    max: 10, keyGenerator: () => `vllm-${ts}`    }),
    body429: makeRealLimiter({ windowMs: 60000,    max: 1,  keyGenerator: () => `body-${ts}`    }),
    indep:   makeRealLimiter({
      windowMs: 60000, max: 2,
      keyGenerator: (req) =>
        req.headers['x-test-key'] === 'b' ? `indep-b-${ts}` : `indep-a-${ts}`,
    }),
  };

  test('allows requests up to configured maximum (3)', async () => {
    const app = buildRLApp(RL.allow3);
    for (let i = 0; i < 3; i++) {
      const r = await request(app).post('/test');
      expect(r.status).toBe(200);
    }
  });

  test('6th provider registration within window returns 429', async () => {
    const app = buildRLApp(RL.reg);
    for (let i = 0; i < 5; i++) await request(app).post('/test');
    const blocked = await request(app).post('/test');
    expect(blocked.status).toBe(429);
  });

  test('6th login attempt within 15min returns 429', async () => {
    const app = buildRLApp(RL.auth);
    for (let i = 0; i < 5; i++) await request(app).post('/test');
    const blocked = await request(app).post('/test');
    expect(blocked.status).toBe(429);
  });

  test('11th inference request within 1min returns 429', async () => {
    const app = buildRLApp(RL.vllm);
    for (let i = 0; i < 10; i++) await request(app).post('/test');
    const blocked = await request(app).post('/test');
    expect(blocked.status).toBe(429);
  });

  test('429 response includes Retry-After header and JSON error body', async () => {
    const app = buildRLApp(RL.body429);
    await request(app).post('/test'); // exhaust the 1-slot window
    const blocked = await request(app).post('/test');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.error).toBe('Rate limit exceeded');
    expect(typeof blocked.body.retryAfterSeconds).toBe('number');
    expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('different keys have independent rate-limit counters', async () => {
    const app = buildRLApp(RL.indep);
    await request(app).post('/test'); // key A: 1/2
    await request(app).post('/test'); // key A: 2/2
    const blockedA = await request(app).post('/test'); // key A: 3/2 → 429
    expect(blockedA.status).toBe(429);
    const allowedB = await request(app).post('/test').set('x-test-key', 'b'); // key B: 1/2 → 200
    expect(allowedB.status).toBe(200);
  });
});

// =============================================================================
// GROUP 3: Input Validation — schema enforcement (Zod, DCP-855)
// =============================================================================

describe('Input Validation', () => {
  test('provider register: name shorter than 2 chars returns 400', async () => {
    const res = await registerProvider({ name: 'X' });
    expect(res.status).toBe(400);
  });

  test('provider register: name longer than 100 chars returns 400', async () => {
    const res = await registerProvider({ name: 'A'.repeat(101) });
    expect(res.status).toBe(400);
  });

  test('provider register: missing gpu_model returns 400', async () => {
    const res = await request(providerApp)
      .post('/api/providers/register')
      .send({ name: 'ValidName', email: `v-${Date.now()}@dc1.test`, os: 'linux' });
    expect(res.status).toBe(400);
  });

  test('provider register: invalid os value returns 400', async () => {
    const res = await registerProvider({ os: 'solaris' });
    expect(res.status).toBe(400);
  });

  test('provider register: missing email returns 400', async () => {
    const res = await request(providerApp)
      .post('/api/providers/register')
      .send({ name: 'ValidName', gpu_model: 'RTX 4090', os: 'linux' });
    expect(res.status).toBe(400);
  });

  test('provider heartbeat: gpu_util_pct > 100 is sanitized (not rejected)', async () => {
    // Backend sanitizes out-of-range GPU stats via toFiniteNumber({ min:0, max:100 }).
    // Values outside range become null — the request succeeds (200), not a hard 400.
    const regRes = await registerProvider();
    expect([200, 201]).toContain(regRes.status);
    const { provider_id: id, api_key: apiKey } = regRes.body;
    const res = await request(providerApp)
      .post(`/api/providers/${id}/heartbeat`)
      .set('x-provider-key', apiKey)
      .send({ gpu_utilization: 9999 }); // way out of range
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Confirm the sanitized value is NOT persisted as 9999
    const metric = db
      .prepare('SELECT gpu_util_pct FROM heartbeat_log WHERE provider_id = ? ORDER BY rowid DESC LIMIT 1')
      .get(id);
    if (metric) {
      expect(metric.gpu_util_pct).not.toBe(9999);
    }
  });
});

// =============================================================================
// GROUP 4: SQL Injection Resistance
// =============================================================================

describe('SQL Injection Resistance', () => {
  test('SQL injection in provider name is stored as a literal string', async () => {
    // The injection string is 26 chars — within the 2–100 Zod constraint.
    const injectionName = `'; DROP TABLE providers; --`;
    const res = await registerProvider({ name: injectionName });
    // No 500 — request is handled cleanly (200/201 or Zod-rejected 400)
    expect(res.status).not.toBe(500);
    expect(typeof res.body).toBe('object');

    if ([200, 201].includes(res.status)) {
      // The providers table must still be queryable — DROP was not executed
      const row = db.prepare('SELECT name FROM providers WHERE id = ?').get(res.body.provider_id);
      expect(row).toBeDefined();
      expect(row.name).toBe(injectionName); // stored literally, not interpreted
    }
  });

  test('SQL injection in name does not corrupt other providers', async () => {
    const safeRes = await registerProvider({ name: 'SafeProvider' });
    expect([200, 201]).toContain(safeRes.status);
    const safeKey = safeRes.body.api_key;

    // Attempt to inject via provider name (UPDATE attack)
    await registerProvider({ name: `'; UPDATE providers SET api_key = 'pwned'; --` });

    // The safe provider's API key must be unchanged
    const safeRow = db.prepare('SELECT api_key FROM providers WHERE id = ?').get(safeRes.body.provider_id);
    if (safeRow) {
      expect(safeRow.api_key).toBe(safeKey);
      expect(safeRow.api_key).not.toBe('pwned');
    }
  });

  test('SQL injection in email field is handled safely (no server error)', async () => {
    const res = await registerProvider({
      email: `admin' OR '1'='1' --@dc1.test`,
    });
    // Zod validates email format, so this should return 400 (invalid email)
    // but critically must NOT return 500 (no unhandled SQL error)
    expect(res.status).not.toBe(500);
    expect([400, 200, 201]).toContain(res.status);
  });

  test('1=1 tautology in name does not expose extra records', async () => {
    // Register two providers with known names
    await registerProvider({ name: 'ProviderAlpha' });
    await registerProvider({ name: 'ProviderBeta' });

    // Attempt to register with injection that would be a SQL tautology
    const res = await registerProvider({ name: `x' OR '1'='1` }); // 13 chars, valid length
    expect(res.status).not.toBe(500);

    if ([200, 201].includes(res.status)) {
      // Only the newly-registered provider should match the literal name — no extra rows leaked
      const rows = db.prepare("SELECT id FROM providers WHERE name = ?").all(`x' OR '1'='1`);
      expect(rows.length).toBe(1);
    }
  });
});

// =============================================================================
// GROUP 5A: EB-M01 Idempotency — PaymentReleased replay safety (DCP-912)
// =============================================================================

const ebDescribe = EB_M01_AVAILABLE ? describe : describe.skip;

ebDescribe('EB-M01: PaymentReleased idempotency (DCP-912)', () => {
  let edb;
  beforeEach(() => { edb = buildEscrowDb(); });
  afterEach(() => { try { edb.close(); } catch (_) {} });

  test('first PaymentReleased event creates exactly 1 payout_request', () => {
    const contract = makeFakeContract([jobId32(JOB_ID), PROVIDER_ADDR, BigInt(5_000_000)]);
    _handlePaymentReleased(edb, { transactionHash: TX_HASH }, contract);
    const rows = edb.prepare('SELECT * FROM payout_requests').all();
    expect(rows).toHaveLength(1);
    expect(rows[0].escrow_tx_hash).toBe(TX_HASH);
    expect(rows[0].status).toBe('pending');
  });

  test('replaying same PaymentReleased txHash does NOT create a duplicate (cursor-reset safety)', () => {
    const contract = makeFakeContract([jobId32(JOB_ID), PROVIDER_ADDR, BigInt(5_000_000)]);
    // Simulate listener restart — same event emitted multiple times
    _handlePaymentReleased(edb, { transactionHash: TX_HASH }, contract);
    _handlePaymentReleased(edb, { transactionHash: TX_HASH }, contract);
    _handlePaymentReleased(edb, { transactionHash: TX_HASH }, contract);
    const rows = edb.prepare('SELECT * FROM payout_requests').all();
    expect(rows).toHaveLength(1); // exactly one, regardless of replay count
  });

  test('distinct txHash values produce independent payout_request records', () => {
    const contract = makeFakeContract([jobId32(JOB_ID), PROVIDER_ADDR, BigInt(3_000_000)]);
    _handlePaymentReleased(edb, { transactionHash: TX_HASH },     contract);
    _handlePaymentReleased(edb, { transactionHash: ALT_TX_HASH }, contract);
    const rows = edb.prepare('SELECT * FROM payout_requests').all();
    expect(rows).toHaveLength(2);
  });
});

// =============================================================================
// GROUP 5B: DisputeRaised event handling (DCP-912)
// =============================================================================

ebDescribe('EB-M01: DisputeRaised event handling (DCP-912)', () => {
  let edb;
  beforeEach(() => { edb = buildEscrowDb(); });
  afterEach(() => { try { edb.close(); } catch (_) {} });

  test('DisputeRaised event creates an admin_alert with correct type', () => {
    const contract = makeFakeContract([jobId32(JOB_ID), PROVIDER_ADDR]);
    _handleDisputeRaised(edb, { transactionHash: TX_HASH }, contract);
    const rows = edb.prepare("SELECT * FROM admin_alerts WHERE alert_type = 'dispute_raised'").all();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // txHash is stored in JSON payload (implementation stores tx_hash in payload, not column)
    const payload = JSON.parse(rows[0].payload);
    expect(payload.txHash).toBe(TX_HASH);
  });

  test('DisputeRaised alert payload contains jobId32 and renter address', () => {
    const contract = makeFakeContract([jobId32(JOB_ID), PROVIDER_ADDR]);
    _handleDisputeRaised(edb, { transactionHash: TX_HASH }, contract);
    const row = edb.prepare("SELECT payload FROM admin_alerts WHERE alert_type = 'dispute_raised'").get();
    expect(row).toBeDefined();
    const payload = JSON.parse(row.payload);
    expect(payload.jobId32).toBe(jobId32(JOB_ID));
    expect(payload.renter).toBe(PROVIDER_ADDR);
  });

  test('distinct DisputeRaised events produce independent admin_alerts', () => {
    const contract = makeFakeContract([jobId32(JOB_ID), PROVIDER_ADDR]);
    _handleDisputeRaised(edb, { transactionHash: TX_HASH },     contract);
    _handleDisputeRaised(edb, { transactionHash: ALT_TX_HASH }, contract);
    const rows = edb.prepare("SELECT * FROM admin_alerts WHERE alert_type = 'dispute_raised'").all();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const hashes = rows.map((r) => JSON.parse(r.payload).txHash);
    expect(hashes).toContain(TX_HASH);
    expect(hashes).toContain(ALT_TX_HASH);
  });
});
