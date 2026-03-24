/**
 * Tests for provider heartbeat HMAC-SHA256 signature validation (DCP-709).
 *
 * Tests the verifyHeartbeatHmac logic via a minimal express app
 * that doesn't require the full providers route (and its better-sqlite3 dep).
 *
 * Covers:
 *   - Valid signature accepted
 *   - Invalid signature rejected when DC1_REQUIRE_HEARTBEAT_HMAC=1
 *   - Missing signature passes in warn-only mode
 *   - Missing signature rejected when enforcement is enabled
 *   - Malformed signature header format validation
 *   - Timing-safe comparison for wrong-length inputs
 */

const crypto = require('crypto');

// ── Inline the HMAC logic under test ────────────────────────────────────────
// Mirror the implementation in routes/providers.js so we can unit-test it
// without the full Express + SQLite stack.

function verifyHeartbeatHmac(req, hmacSecret) {
  if (!hmacSecret) return { valid: false, reason: 'DC1_HMAC_SECRET not configured' };

  const signatureHeader = req.headers['x-dc1-signature'];
  if (!signatureHeader) return { valid: false, reason: 'X-DC1-Signature header missing' };

  const match = String(signatureHeader).trim().match(/^sha256=([a-f0-9]{64})$/i);
  if (!match) return { valid: false, reason: 'X-DC1-Signature format invalid (expected sha256=<64 hex chars>)' };

  const rawBody = req.rawBody;
  if (!rawBody) return { valid: false, reason: 'Raw body unavailable for HMAC check' };

  const expected = crypto.createHmac('sha256', hmacSecret).update(rawBody).digest('hex');
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(match[1].toLowerCase(), 'hex')
    );
    return { valid: isValid, reason: isValid ? null : 'HMAC mismatch' };
  } catch {
    return { valid: false, reason: 'HMAC comparison failed' };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const HMAC_SECRET = 'test-hmac-secret-abc123';

function makeSignature(body, secret = HMAC_SECRET) {
  const raw = typeof body === 'string' ? Buffer.from(body) : body;
  return 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

function fakeReq({ headers = {}, rawBody = null } = {}) {
  return { headers, rawBody };
}

// ── Unit tests ───────────────────────────────────────────────────────────────

describe('verifyHeartbeatHmac', () => {
  const body = Buffer.from('{"api_key":"test","gpu_status":{}}');

  test('returns valid=true for correct signature', () => {
    const sig = makeSignature(body);
    const req = fakeReq({ headers: { 'x-dc1-signature': sig }, rawBody: body });
    const result = verifyHeartbeatHmac(req, HMAC_SECRET);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeNull();
  });

  test('returns valid=false when secret is missing', () => {
    const sig = makeSignature(body);
    const req = fakeReq({ headers: { 'x-dc1-signature': sig }, rawBody: body });
    const result = verifyHeartbeatHmac(req, '');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not configured/i);
  });

  test('returns valid=false when X-DC1-Signature header is absent', () => {
    const req = fakeReq({ headers: {}, rawBody: body });
    const result = verifyHeartbeatHmac(req, HMAC_SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/missing/i);
  });

  test('returns valid=false for wrong secret', () => {
    const sig = makeSignature(body, 'wrong-secret');
    const req = fakeReq({ headers: { 'x-dc1-signature': sig }, rawBody: body });
    const result = verifyHeartbeatHmac(req, HMAC_SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/mismatch/i);
  });

  test('returns valid=false for tampered body', () => {
    const sig = makeSignature(body);
    const tamperedBody = Buffer.from('{"api_key":"test","gpu_status":{"tampered":true}}');
    const req = fakeReq({ headers: { 'x-dc1-signature': sig }, rawBody: tamperedBody });
    const result = verifyHeartbeatHmac(req, HMAC_SECRET);
    expect(result.valid).toBe(false);
  });

  test('returns valid=false for all-zero signature', () => {
    const req = fakeReq({
      headers: { 'x-dc1-signature': 'sha256=' + '0'.repeat(64) },
      rawBody: body,
    });
    const result = verifyHeartbeatHmac(req, HMAC_SECRET);
    expect(result.valid).toBe(false);
  });

  test('returns valid=false for malformed header (no sha256= prefix)', () => {
    const req = fakeReq({
      headers: { 'x-dc1-signature': 'not-a-valid-signature' },
      rawBody: body,
    });
    const result = verifyHeartbeatHmac(req, HMAC_SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/format invalid/i);
  });

  test('returns valid=false for sha256= prefix with short hex (truncated)', () => {
    const req = fakeReq({
      headers: { 'x-dc1-signature': 'sha256=deadbeef' },
      rawBody: body,
    });
    const result = verifyHeartbeatHmac(req, HMAC_SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/format invalid/i);
  });

  test('returns valid=false when rawBody is missing (body already parsed)', () => {
    const sig = makeSignature(body);
    const req = fakeReq({ headers: { 'x-dc1-signature': sig }, rawBody: null });
    const result = verifyHeartbeatHmac(req, HMAC_SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/unavailable/i);
  });

  test('is case-insensitive on hex digest in header', () => {
    const sig = makeSignature(body).toUpperCase(); // sha256= stays lower; hex uppercased
    const req = fakeReq({ headers: { 'x-dc1-signature': sig }, rawBody: body });
    const result = verifyHeartbeatHmac(req, HMAC_SECRET);
    // The regex allows upper-case hex, comparison normalises to lower
    expect(result.valid).toBe(true);
  });
});

// ── Enforcement mode integration tests (no SQLite required) ──────────────────

describe('heartbeat HMAC enforcement (middleware behaviour)', () => {
  // Simulate the middleware decision logic from providers.js router.post('/heartbeat')
  function runMiddleware(req, requireHmac, hmacSecret) {
    const result = verifyHeartbeatHmac(req, hmacSecret || '');
    if (!result.valid && requireHmac) {
      return { rejected: true, status: 401, body: { error: 'Invalid heartbeat signature', detail: result.reason } };
    }
    return { rejected: false };
  }

  const body = Buffer.from('{"api_key":"k","gpu_status":{}}');
  const validSig = makeSignature(body);

  test('enforcement OFF: passes valid signature', () => {
    const req = fakeReq({ headers: { 'x-dc1-signature': validSig }, rawBody: body });
    expect(runMiddleware(req, false, HMAC_SECRET).rejected).toBe(false);
  });

  test('enforcement OFF: passes missing signature', () => {
    const req = fakeReq({ headers: {}, rawBody: body });
    expect(runMiddleware(req, false, HMAC_SECRET).rejected).toBe(false);
  });

  test('enforcement OFF: passes invalid signature', () => {
    const req = fakeReq({ headers: { 'x-dc1-signature': 'sha256=' + 'a'.repeat(64) }, rawBody: body });
    expect(runMiddleware(req, false, HMAC_SECRET).rejected).toBe(false);
  });

  test('enforcement ON: accepts valid signature', () => {
    const req = fakeReq({ headers: { 'x-dc1-signature': validSig }, rawBody: body });
    expect(runMiddleware(req, true, HMAC_SECRET).rejected).toBe(false);
  });

  test('enforcement ON: rejects missing signature', () => {
    const req = fakeReq({ headers: {}, rawBody: body });
    const result = runMiddleware(req, true, HMAC_SECRET);
    expect(result.rejected).toBe(true);
    expect(result.status).toBe(401);
    expect(result.body.error).toMatch(/signature/i);
  });

  test('enforcement ON: rejects wrong secret', () => {
    const badSig = makeSignature(body, 'wrong-secret');
    const req = fakeReq({ headers: { 'x-dc1-signature': badSig }, rawBody: body });
    const result = runMiddleware(req, true, HMAC_SECRET);
    expect(result.rejected).toBe(true);
    expect(result.status).toBe(401);
  });

  test('enforcement ON: rejects when DC1_HMAC_SECRET not configured', () => {
    const req = fakeReq({ headers: { 'x-dc1-signature': validSig }, rawBody: body });
    const result = runMiddleware(req, true, ''); // no secret
    expect(result.rejected).toBe(true);
    expect(result.body.detail).toMatch(/not configured/i);
  });
});
