// Tests for the provider API key system (DCP-760)
// Covers: key generation, auth success, auth failure (wrong key, revoked key)

const crypto = require('crypto');
const Database = require('better-sqlite3');

function mockFlatParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params.reduce((a, p) => (Array.isArray(p) ? a.concat(p) : a.concat([p])), []);
}

jest.mock('../db', () => ({
  get run() { return (sql, ...params) => global.__testDb.prepare(sql).run(...mockFlatParams(params)); },
  get get() { return (sql, ...params) => global.__testDb.prepare(sql).get(...mockFlatParams(params)); },
  get all() { return (sql, ...params) => global.__testDb.prepare(sql).all(...mockFlatParams(params)); },
  get prepare() { return (sql) => global.__testDb.prepare(sql); },
  get _db() { return global.__testDb; },
  close: () => {},
}));

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS provider_api_keys (
    id TEXT PRIMARY KEY,
    provider_id INTEGER NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    label TEXT,
    last_used_at TEXT,
    created_at TEXT NOT NULL,
    revoked_at TEXT
  )
`;

function freshDb() {
  const d = new Database(':memory:');
  d.pragma('journal_mode = WAL');
  d.exec(SCHEMA);
  return d;
}

beforeEach(() => {
  global.__testDb = freshDb();
});

afterEach(() => {
  try { global.__testDb.close(); } catch {}
  delete global.__testDb;
  delete require.cache[require.resolve('../services/apiKeyService')];
});

function getService() {
  return require('../services/apiKeyService');
}

// ── generateProviderKey ───────────────────────────────────────────────────────

describe('generateProviderKey', () => {
  test('returns key with dcp_prov_ prefix and 32 base62 chars', () => {
    const { key } = getService().generateProviderKey(1);
    expect(key).toMatch(/^dcp_prov_[0-9A-Za-z]{32}$/);
  });

  test('returns a UUID keyId and 8-char display prefix', () => {
    const { keyId, prefix } = getService().generateProviderKey(1);
    expect(keyId).toMatch(/^[0-9a-f-]{36}$/);
    expect(prefix).toMatch(/^dcp_prov_[0-9A-Za-z]{8}$/);
  });

  test('stores SHA-256 hash — raw key absent from DB', () => {
    const { key } = getService().generateProviderKey(1);
    const row = global.__testDb.prepare('SELECT key_hash FROM provider_api_keys').get();
    expect(row.key_hash).not.toBe(key);
    expect(row.key_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('hash in DB matches SHA-256 of the returned key', () => {
    const { key } = getService().generateProviderKey(1);
    const expected = crypto.createHash('sha256').update(key).digest('hex');
    const row = global.__testDb.prepare('SELECT key_hash FROM provider_api_keys').get();
    expect(row.key_hash).toBe(expected);
  });

  test('stores label when provided', () => {
    getService().generateProviderKey(1, 'gpu-node-1');
    const row = global.__testDb.prepare('SELECT label FROM provider_api_keys').get();
    expect(row.label).toBe('gpu-node-1');
  });

  test('each call produces a unique key and keyId', () => {
    const a = getService().generateProviderKey(1);
    const b = getService().generateProviderKey(1);
    expect(a.key).not.toBe(b.key);
    expect(a.keyId).not.toBe(b.keyId);
  });
});

// ── verifyProviderKey ─────────────────────────────────────────────────────────

describe('verifyProviderKey', () => {
  test('returns providerId for a valid key', () => {
    const { key } = getService().generateProviderKey(42);
    expect(getService().verifyProviderKey(key)).toBe(42);
  });

  test('returns null for a syntactically valid but wrong key', () => {
    getService().generateProviderKey(42);
    const wrong = 'dcp_prov_' + '0'.repeat(32);
    expect(getService().verifyProviderKey(wrong)).toBeNull();
  });

  test('returns null for non-provider tokens', () => {
    expect(getService().verifyProviderKey('dc1-provider-legacy-key')).toBeNull();
    expect(getService().verifyProviderKey(null)).toBeNull();
    expect(getService().verifyProviderKey('')).toBeNull();
    expect(getService().verifyProviderKey('Bearer dcp_prov_abc')).toBeNull();
  });

  test('returns null for a revoked key', () => {
    const { key } = getService().generateProviderKey(7);
    global.__testDb.prepare('UPDATE provider_api_keys SET revoked_at = ? WHERE provider_id = 7')
      .run(new Date().toISOString());
    expect(getService().verifyProviderKey(key)).toBeNull();
  });

  test('updates last_used_at on successful verification', () => {
    const { key } = getService().generateProviderKey(1);
    const before = global.__testDb.prepare('SELECT last_used_at FROM provider_api_keys').get();
    expect(before.last_used_at).toBeNull();

    getService().verifyProviderKey(key);

    const after = global.__testDb.prepare('SELECT last_used_at FROM provider_api_keys').get();
    expect(after.last_used_at).not.toBeNull();
  });
});

// ── listProviderKeys ──────────────────────────────────────────────────────────

describe('listProviderKeys', () => {
  test('returns only non-revoked keys for the provider', () => {
    const svc = getService();
    svc.generateProviderKey(1, 'active-key');
    const { keyId } = svc.generateProviderKey(1, 'to-revoke');
    svc.revokeProviderKey(keyId, 1);

    const keys = svc.listProviderKeys(1);
    expect(keys).toHaveLength(1);
    expect(keys[0].label).toBe('active-key');
  });

  test('never returns key_hash in the list', () => {
    getService().generateProviderKey(1);
    const [k] = getService().listProviderKeys(1);
    expect(k).not.toHaveProperty('key_hash');
  });

  test('returns empty array when provider has no active keys', () => {
    expect(getService().listProviderKeys(999)).toEqual([]);
  });

  test('does not leak keys belonging to other providers', () => {
    getService().generateProviderKey(1);
    getService().generateProviderKey(2);
    expect(getService().listProviderKeys(1)).toHaveLength(1);
  });
});

// ── revokeProviderKey ─────────────────────────────────────────────────────────

describe('revokeProviderKey', () => {
  test('revokes an active key and sets revoked_at', () => {
    const { keyId } = getService().generateProviderKey(1);
    expect(getService().revokeProviderKey(keyId, 1)).toBe(true);
    const row = global.__testDb.prepare('SELECT revoked_at FROM provider_api_keys WHERE id = ?').get(keyId);
    expect(row.revoked_at).not.toBeNull();
  });

  test('returns false for a non-existent keyId', () => {
    expect(getService().revokeProviderKey('no-such-id', 1)).toBe(false);
  });

  test('returns false when key belongs to a different provider', () => {
    const { keyId } = getService().generateProviderKey(1);
    expect(getService().revokeProviderKey(keyId, 99)).toBe(false);
  });

  test('returns false when key is already revoked', () => {
    const { keyId } = getService().generateProviderKey(1);
    getService().revokeProviderKey(keyId, 1);
    expect(getService().revokeProviderKey(keyId, 1)).toBe(false);
  });
});
