// Provider API Key Authentication Middleware
// Validates dcp_prov_* Bearer tokens issued by apiKeyService.
// Sets req.provider on success, returns 401 on failure.

const { getBearerToken } = require('./auth');
const { verifyProviderKey } = require('../services/apiKeyService');
const db = require('../db');

/**
 * Express middleware: require a valid dcp_prov_* API key.
 * Attaches req.provider (full provider row) on success.
 */
function apiKeyAuth(req, res, next) {
  const rawKey = getBearerToken(req);
  if (!rawKey || !rawKey.startsWith('dcp_prov_')) {
    return res.status(401).json({ error: 'Provider API key required (Authorization: Bearer dcp_prov_...)' });
  }

  const providerId = verifyProviderKey(rawKey);
  if (!providerId) {
    return res.status(401).json({ error: 'Invalid or revoked provider API key' });
  }

  const provider = db.get('SELECT * FROM providers WHERE id = ? AND deleted_at IS NULL', [providerId]);
  if (!provider) {
    return res.status(401).json({ error: 'Provider account not found or deactivated' });
  }

  req.provider = provider;
  return next();
}

module.exports = { apiKeyAuth };
