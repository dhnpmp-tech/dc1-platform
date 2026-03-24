'use strict';
/**
 * Webhook HMAC-SHA256 middleware (DCP-722)
 *
 * Validates incoming /api/webhooks/* requests signed by providers.
 * Each provider signs the raw request body with their own provider API key:
 *
 *   X-DCP-Signature: sha256=<hex>
 *   X-DCP-Timestamp: <unix-epoch-seconds>
 *
 * Signature: HMAC-SHA256(rawBody, provider_api_key)
 *
 * Provider identity: X-Provider-Key header (must match a registered provider)
 *
 * Replay prevention: X-DCP-Timestamp must be within TIMESTAMP_TOLERANCE_S of
 * server time (default: 300 seconds / 5 minutes).
 */

const crypto = require('crypto');
const db = require('../db');

const TIMESTAMP_TOLERANCE_S = Number(process.env.DCP_WEBHOOK_TIMESTAMP_TOLERANCE_S || '300');

/**
 * Pure validation function (exported for unit testing without Express).
 *
 * @param {object} opts
 * @param {Buffer|null} opts.rawBody   - Raw request body bytes
 * @param {string|undefined} opts.signatureHeader  - X-DCP-Signature header value
 * @param {string|undefined} opts.timestampHeader  - X-DCP-Timestamp header value
 * @param {string}           opts.providerKey      - Provider API key from DB
 * @param {number}           [opts.nowSeconds]     - Current time (for testing)
 * @returns {{ valid: boolean, reason: string|null }}
 */
function verifyWebhookHmac({ rawBody, signatureHeader, timestampHeader, providerKey, nowSeconds }) {
  // Timestamp (replay prevention)
  if (!timestampHeader) {
    return { valid: false, reason: 'X-DCP-Timestamp header missing' };
  }
  const tsNum = Number(timestampHeader);
  if (!Number.isFinite(tsNum) || tsNum <= 0) {
    return { valid: false, reason: 'X-DCP-Timestamp is not a valid Unix timestamp' };
  }
  const now = nowSeconds !== undefined ? nowSeconds : Math.floor(Date.now() / 1000);
  const age = now - tsNum;
  if (age > TIMESTAMP_TOLERANCE_S) {
    return { valid: false, reason: `Request timestamp too old (${age}s > ${TIMESTAMP_TOLERANCE_S}s tolerance)` };
  }
  if (age < -TIMESTAMP_TOLERANCE_S) {
    return { valid: false, reason: 'Request timestamp is too far in the future' };
  }

  // Signature
  if (!signatureHeader) {
    return { valid: false, reason: 'X-DCP-Signature header missing' };
  }
  const sigMatch = String(signatureHeader).trim().match(/^sha256=([a-f0-9]{64})$/i);
  if (!sigMatch) {
    return { valid: false, reason: 'X-DCP-Signature format invalid (expected sha256=<64 hex chars>)' };
  }
  if (!rawBody) {
    return { valid: false, reason: 'Raw body unavailable for HMAC check' };
  }
  const expected = crypto.createHmac('sha256', providerKey).update(rawBody).digest('hex');
  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(sigMatch[1].toLowerCase(), 'hex')
    );
  } catch {
    return { valid: false, reason: 'HMAC comparison failed' };
  }
  return { valid: isValid, reason: isValid ? null : 'HMAC mismatch' };
}

/**
 * Express middleware: validates X-DCP-Signature on /api/webhooks/* routes.
 *
 * Requires:
 *   - req.rawBody (Buffer) set by the raw-body parser in server.js
 *   - X-Provider-Key header with a valid, active provider API key
 *   - X-DCP-Timestamp header (Unix epoch seconds)
 *   - X-DCP-Signature header (sha256=<hex>)
 *
 * On failure -> 401 JSON response.
 * On success -> sets req.webhookProvider = { id, api_key, name } and calls next().
 */
function webhookHmacMiddleware(req, res, next) {
  const providerKey = req.headers['x-provider-key'];
  if (!providerKey) {
    return res.status(401).json({ error: 'X-Provider-Key header required' });
  }

  const provider = db.get(
    'SELECT id, api_key, name, status FROM providers WHERE api_key = ?',
    providerKey
  );
  if (!provider) {
    return res.status(401).json({ error: 'Unknown provider key' });
  }

  const result = verifyWebhookHmac({
    rawBody: req.rawBody,
    signatureHeader: req.headers['x-dcp-signature'],
    timestampHeader: req.headers['x-dcp-timestamp'],
    providerKey: provider.api_key,
  });

  if (!result.valid) {
    console.warn(`[webhookHmac] Rejected provider ${provider.id}: ${result.reason}`);
    return res.status(401).json({ error: 'Invalid webhook signature', detail: result.reason });
  }

  req.webhookProvider = { id: provider.id, api_key: provider.api_key, name: provider.name };
  next();
}

module.exports = { webhookHmacMiddleware, verifyWebhookHmac, TIMESTAMP_TOLERANCE_S };
