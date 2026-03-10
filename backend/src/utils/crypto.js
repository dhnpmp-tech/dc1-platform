// DC1 Shared Crypto Utilities
const crypto = require('crypto');

/**
 * Convert a deterministic seed string into a stable UUID v4-shaped hex string.
 * Same input ALWAYS produces the same UUID — used as idempotency key for wallet ops.
 */
function deterministicUuid(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    (((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)) + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join('-');
}

module.exports = { deterministicUuid };
