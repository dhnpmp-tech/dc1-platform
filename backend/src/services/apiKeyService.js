// Provider API Key Service
// Issues and validates scoped long-lived credentials for GPU provider nodes.
// Keys are hashed (SHA-256) before storage — the raw key is returned once at issuance.
//
// Key format: dcp_prov_<32 base62 chars>
// Lookup prefix: dcp_prov_<first 8 base62 chars> — stored in plaintext for O(prefix) lookup

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const KEY_PREFIX = 'dcp_prov_';
const RANDOM_LENGTH = 32; // base62 chars of entropy
const PREFIX_DISPLAY_LENGTH = 8; // chars exposed in key_prefix column

// base62 alphabet: digits + uppercase + lowercase
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function toBase62(buffer) {
  let result = '';
  for (const byte of buffer) {
    result += BASE62[byte % 62];
  }
  return result;
}

function generateRandom() {
  return toBase62(crypto.randomBytes(RANDOM_LENGTH));
}

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Issue a new provider API key and persist a hashed copy.
 * Returns the raw key once — it is never stored in plaintext.
 *
 * @param {number} providerId
 * @param {string} [label]
 * @returns {{ key: string, keyId: string, prefix: string }}
 */
function generateProviderKey(providerId, label = '') {
  const random = generateRandom();
  const key = `${KEY_PREFIX}${random}`;
  const keyId = uuidv4();
  const prefix = `${KEY_PREFIX}${random.slice(0, PREFIX_DISPLAY_LENGTH)}`;
  const keyHash = hashKey(key);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO provider_api_keys (id, provider_id, key_hash, key_prefix, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(keyId, providerId, keyHash, prefix, label || null, now);

  return { key, keyId, prefix };
}

/**
 * Verify a raw provider API key. Updates last_used_at on success.
 *
 * @param {string} rawKey
 * @returns {number|null} providerId if valid, null otherwise
 */
function verifyProviderKey(rawKey) {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null;

  const random = rawKey.slice(KEY_PREFIX.length);
  if (random.length < PREFIX_DISPLAY_LENGTH) return null;

  const prefix = `${KEY_PREFIX}${random.slice(0, PREFIX_DISPLAY_LENGTH)}`;
  const rows = db.prepare(
    `SELECT id, provider_id, key_hash
     FROM provider_api_keys
     WHERE key_prefix = ? AND revoked_at IS NULL`
  ).all(prefix);

  if (!rows.length) return null;

  const candidateHash = hashKey(rawKey);
  const candidateHashBuf = Buffer.from(candidateHash);

  for (const row of rows) {
    const storedBuf = Buffer.from(row.key_hash);
    if (storedBuf.length !== candidateHashBuf.length) continue;
    if (crypto.timingSafeEqual(storedBuf, candidateHashBuf)) {
      db.prepare(`UPDATE provider_api_keys SET last_used_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), row.id);
      return row.provider_id;
    }
  }

  return null;
}

/**
 * List non-revoked key metadata for a provider. Never returns key_hash.
 *
 * @param {number} providerId
 * @returns {Array<{id, key_prefix, label, last_used_at, created_at}>}
 */
function listProviderKeys(providerId) {
  return db.prepare(
    `SELECT id, key_prefix, label, last_used_at, created_at
     FROM provider_api_keys
     WHERE provider_id = ? AND revoked_at IS NULL
     ORDER BY created_at DESC`
  ).all(providerId);
}

/**
 * Revoke a key by ID. Provider can only revoke their own keys.
 *
 * @param {string} keyId
 * @param {number} providerId
 * @returns {boolean} true if a key was revoked
 */
function revokeProviderKey(keyId, providerId) {
  const result = db.prepare(
    `UPDATE provider_api_keys
     SET revoked_at = ?
     WHERE id = ? AND provider_id = ? AND revoked_at IS NULL`
  ).run(new Date().toISOString(), keyId, providerId);
  return result.changes > 0;
}

module.exports = { generateProviderKey, verifyProviderKey, listProviderKeys, revokeProviderKey };
