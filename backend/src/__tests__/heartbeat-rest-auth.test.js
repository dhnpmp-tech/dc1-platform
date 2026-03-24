'use strict';

/**
 * Tests for REST heartbeat endpoint auth guard — DCP-912 / DCP-907
 *
 * Tests the auth logic extracted from POST /api/providers/:id/heartbeat.
 * Uses an in-memory SQLite DB to verify the provider key lookup — identical
 * to what the live endpoint does.
 *
 * Covers:
 *   - 401 when Authorization header and x-provider-key are both absent
 *   - 401 when API key does not match the provider record
 *   - 401 when the provider ID in the URL is unknown
 *   - 401 when using a Bearer token with the wrong key
 *   - 200 (auth passes) with valid x-provider-key matching provider record
 *   - 200 (auth passes) with valid Authorization: Bearer token
 */

const Database = require('better-sqlite3');

// ── Inline the auth decision logic under test ────────────────────────────────
// Mirrors the first-pass guard in routes/providers.js POST /:id/heartbeat
// (lines ~883-892) so we can unit-test it without the full Express stack.

function getBearerToken(headers) {
  const auth = headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/**
 * Simulate the heartbeat endpoint auth check.
 *
 * @param {object} opts
 * @param {object} opts.headers - request headers (lowercased)
 * @param {string} opts.providerId - :id from URL
 * @param {object} db - SQLite db with providers table
 * @returns {{ status: number, error?: string }}
 */
function checkHeartbeatAuth(headers, providerId, db) {
  // Step 1: extract key from x-provider-key or Bearer token
  const apiKey = (headers['x-provider-key'] || getBearerToken(headers) || '').trim().slice(0, 128) || null;
  if (!apiKey) return { status: 401, error: 'API key required' };

  // Step 2: validate provider ID matches key in the database
  const provider = db.prepare(
    'SELECT id, approval_status FROM providers WHERE id = ? AND api_key = ?'
  ).get(providerId, apiKey);

  if (!provider) return { status: 401, error: 'Invalid provider ID or API key' };

  // Step 3: check approval status
  if (provider.approval_status !== 'approved') {
    return { status: 403, error: 'Provider not approved' };
  }

  return { status: 200 };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROVIDER_ID = 'test-provider-001';
const VALID_KEY   = 'valid-api-key-abc123';
const OTHER_KEY   = 'wrong-api-key-xyz999';

function buildDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE providers (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      email            TEXT NOT NULL UNIQUE,
      api_key          TEXT,
      approval_status  TEXT NOT NULL DEFAULT 'approved',
      deleted_at       TEXT
    )
  `);
  db.prepare(
    "INSERT INTO providers (id, name, email, api_key, approval_status) VALUES (?, 'Test', 'p@t.com', ?, 'approved')"
  ).run(PROVIDER_ID, VALID_KEY);
  return db;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/providers/:id/heartbeat — auth guard (DCP-912)', () => {
  let db;

  beforeEach(() => { db = buildDb(); });
  afterEach(() => { try { db.close(); } catch {} });

  test('returns 401 when no auth header is present', () => {
    const result = checkHeartbeatAuth({}, PROVIDER_ID, db);
    expect(result.status).toBe(401);
    expect(result.error).toMatch(/api key required/i);
  });

  test('returns 401 when x-provider-key header is an empty string', () => {
    const result = checkHeartbeatAuth({ 'x-provider-key': '' }, PROVIDER_ID, db);
    expect(result.status).toBe(401);
  });

  test('returns 401 when API key does not match the provider record', () => {
    const result = checkHeartbeatAuth({ 'x-provider-key': OTHER_KEY }, PROVIDER_ID, db);
    expect(result.status).toBe(401);
    expect(result.error).toMatch(/invalid/i);
  });

  test('returns 401 when provider ID in the URL is unknown', () => {
    const result = checkHeartbeatAuth({ 'x-provider-key': VALID_KEY }, 'nonexistent-id', db);
    expect(result.status).toBe(401);
  });

  test('returns 401 when Bearer token uses the wrong key', () => {
    const result = checkHeartbeatAuth(
      { authorization: `Bearer ${OTHER_KEY}` },
      PROVIDER_ID,
      db
    );
    expect(result.status).toBe(401);
  });

  test('returns 401 when correct key is sent for a different provider ID', () => {
    const result = checkHeartbeatAuth({ 'x-provider-key': VALID_KEY }, 'other-provider', db);
    expect(result.status).toBe(401);
  });

  test('auth passes (200) with valid x-provider-key matching provider record', () => {
    const result = checkHeartbeatAuth({ 'x-provider-key': VALID_KEY }, PROVIDER_ID, db);
    expect(result.status).toBe(200);
  });

  test('auth passes (200) with valid Authorization: Bearer token', () => {
    const result = checkHeartbeatAuth(
      { authorization: `Bearer ${VALID_KEY}` },
      PROVIDER_ID,
      db
    );
    expect(result.status).toBe(200);
  });

  test('returns 403 for unapproved provider with valid key', () => {
    const db2 = buildDb();
    db2.prepare("INSERT INTO providers (id, name, email, api_key, approval_status) VALUES (?, 'P2', 'p2@t.com', 'key2', 'pending')").run('pending-provider');
    const result = checkHeartbeatAuth({ 'x-provider-key': 'key2' }, 'pending-provider', db2);
    expect(result.status).toBe(403);
    db2.close();
  });
});
