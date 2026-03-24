'use strict';
/**
 * Tests for provider webhook HMAC-SHA256 signature validation (DCP-722).
 *
 * Mirrors the verifyWebhookHmac logic inline (same pattern as heartbeat-hmac.test.js)
 * to avoid loading better-sqlite3 in the test environment.
 *
 * Covers:
 *   - Valid signature accepted
 *   - Invalid/missing signature rejected (always enforced — no warn-only mode)
 *   - Missing/invalid timestamp
 *   - Replay attack prevention (stale/future timestamps)
 *   - Tampered body
 *   - Tolerance boundary conditions
 */

const crypto = require('crypto');

// ── Inline the validation logic (mirrors middleware/webhookHmac.js) ───────────

const TIMESTAMP_TOLERANCE_S = 300;

function verifyWebhookHmac({ rawBody, signatureHeader, timestampHeader, providerKey, nowSeconds }) {
  if (!timestampHeader) return { valid: false, reason: 'X-DCP-Timestamp header missing' };
  const tsNum = Number(timestampHeader);
  if (!Number.isFinite(tsNum) || tsNum <= 0) return { valid: false, reason: 'X-DCP-Timestamp is not a valid Unix timestamp' };
  const now = nowSeconds !== undefined ? nowSeconds : Math.floor(Date.now() / 1000);
  const age = now - tsNum;
  if (age > TIMESTAMP_TOLERANCE_S) return { valid: false, reason: `Request timestamp too old (${age}s > ${TIMESTAMP_TOLERANCE_S}s tolerance)` };
  if (age < -TIMESTAMP_TOLERANCE_S) return { valid: false, reason: 'Request timestamp is too far in the future' };

  if (!signatureHeader) return { valid: false, reason: 'X-DCP-Signature header missing' };
  const sigMatch = String(signatureHeader).trim().match(/^sha256=([a-f0-9]{64})$/i);
  if (!sigMatch) return { valid: false, reason: 'X-DCP-Signature format invalid (expected sha256=<64 hex chars>)' };
  if (!rawBody) return { valid: false, reason: 'Raw body unavailable for HMAC check' };

  const expected = crypto.createHmac('sha256', providerKey).update(rawBody).digest('hex');
  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sigMatch[1].toLowerCase(), 'hex'));
  } catch { return { valid: false, reason: 'HMAC comparison failed' }; }
  return { valid: isValid, reason: isValid ? null : 'HMAC mismatch' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROVIDER_KEY = 'dc1-provider-testkey1234567890ab';
const NOW_S = Math.floor(Date.now() / 1000);

function makeRawBody(obj = { event: 'job_done', job_id: 'j123' }) {
  return Buffer.from(JSON.stringify(obj));
}

function makeSignature(rawBody, key = PROVIDER_KEY) {
  return 'sha256=' + crypto.createHmac('sha256', key).update(rawBody).digest('hex');
}

function call({ body, key, ts, sig, nowSeconds } = {}) {
  const rawBody = body !== undefined ? body : makeRawBody();
  const providerKey = key || PROVIDER_KEY;
  const now = nowSeconds !== undefined ? nowSeconds : NOW_S;
  return {
    rawBody,
    signatureHeader: sig !== undefined ? sig : makeSignature(rawBody, providerKey),
    timestampHeader: ts !== undefined ? ts : String(now),
    providerKey,
    nowSeconds: now,
  };
}

// ── Valid cases ───────────────────────────────────────────────────────────────

describe('verifyWebhookHmac — valid cases', () => {
  test('accepts correctly signed payload', () => {
    const r = verifyWebhookHmac(call());
    expect(r.valid).toBe(true);
    expect(r.reason).toBeNull();
  });

  test('case-insensitive on hex digest', () => {
    const rawBody = makeRawBody();
    const sigUpper = makeSignature(rawBody).replace(/[a-f]/g, c => c.toUpperCase());
    const r = verifyWebhookHmac(call({ body: rawBody, sig: sigUpper }));
    expect(r.valid).toBe(true);
  });

  test('accepts timestamp exactly at tolerance boundary (oldest allowed)', () => {
    const ts = NOW_S - TIMESTAMP_TOLERANCE_S;
    const r = verifyWebhookHmac(call({ ts: String(ts) }));
    expect(r.valid).toBe(true);
  });

  test('accepts timestamp exactly at future tolerance boundary', () => {
    const ts = NOW_S + TIMESTAMP_TOLERANCE_S;
    const r = verifyWebhookHmac(call({ ts: String(ts) }));
    expect(r.valid).toBe(true);
  });
});

// ── Signature failures ────────────────────────────────────────────────────────

describe('verifyWebhookHmac — signature failures', () => {
  test('rejects missing X-DCP-Signature header', () => {
    const r = verifyWebhookHmac({ ...call(), signatureHeader: undefined });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/missing/i);
  });

  test('rejects malformed signature (no sha256= prefix)', () => {
    const r = verifyWebhookHmac(call({ sig: 'not-a-valid-signature' }));
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/format invalid/i);
  });

  test('rejects truncated hex digest', () => {
    const r = verifyWebhookHmac(call({ sig: 'sha256=deadbeef' }));
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/format invalid/i);
  });

  test('rejects wrong provider key', () => {
    const rawBody = makeRawBody();
    const sig = makeSignature(rawBody, 'dc1-provider-wrongkey0000000000');
    const r = verifyWebhookHmac(call({ body: rawBody, sig, key: PROVIDER_KEY }));
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/mismatch/i);
  });

  test('rejects tampered body', () => {
    const orig = makeRawBody({ event: 'job_done', job_id: 'j123' });
    const sig = makeSignature(orig);
    const tampered = makeRawBody({ event: 'job_done', job_id: 'j456' });
    const r = verifyWebhookHmac(call({ body: tampered, sig }));
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/mismatch/i);
  });

  test('rejects all-zero signature', () => {
    const r = verifyWebhookHmac(call({ sig: 'sha256=' + '0'.repeat(64) }));
    expect(r.valid).toBe(false);
  });

  test('rejects missing rawBody', () => {
    const rawBody = makeRawBody();
    const sig = makeSignature(rawBody);
    const r = verifyWebhookHmac({ ...call({ sig }), rawBody: null });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/unavailable/i);
  });
});

// ── Replay attack prevention ──────────────────────────────────────────────────

describe('verifyWebhookHmac — replay attack prevention', () => {
  test('rejects missing X-DCP-Timestamp header', () => {
    const r = verifyWebhookHmac({ ...call(), timestampHeader: undefined });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/timestamp.*missing/i);
  });

  test('rejects non-numeric timestamp', () => {
    const r = verifyWebhookHmac(call({ ts: 'not-a-number' }));
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/not a valid/i);
  });

  test('rejects zero timestamp', () => {
    const r = verifyWebhookHmac(call({ ts: '0' }));
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/not a valid/i);
  });

  test('rejects stale timestamp (replay attack)', () => {
    const ts = NOW_S - TIMESTAMP_TOLERANCE_S - 1;
    const r = verifyWebhookHmac(call({ ts: String(ts) }));
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/too old/i);
  });

  test('rejects timestamp too far in the future', () => {
    const ts = NOW_S + TIMESTAMP_TOLERANCE_S + 1;
    const r = verifyWebhookHmac(call({ ts: String(ts) }));
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/future/i);
  });

  test('rejects request 1 second past tolerance boundary', () => {
    const ts = NOW_S - TIMESTAMP_TOLERANCE_S - 1;
    const r = verifyWebhookHmac(call({ ts: String(ts) }));
    expect(r.valid).toBe(false);
  });
});

// ── Enforcement always on ─────────────────────────────────────────────────────

describe('verifyWebhookHmac — always-on enforcement (no warn-only mode)', () => {
  test('invalid sig always returns valid=false with a reason string', () => {
    const r = verifyWebhookHmac(call({ sig: 'sha256=' + 'a'.repeat(64) }));
    expect(r.valid).toBe(false);
    expect(typeof r.reason).toBe('string');
  });
});
