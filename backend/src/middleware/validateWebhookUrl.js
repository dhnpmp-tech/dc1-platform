'use strict';
/**
 * validateWebhookUrl middleware (DCP-863)
 *
 * Validates a webhook URL against SSRF attack vectors before it is stored.
 * Enforces:
 *   - HTTPS protocol only (http is rejected)
 *   - Standard HTTPS port only (443 or default — non-443 explicit ports are rejected)
 *   - No RFC-1918, loopback, or link-local addresses (127.x, 10.x, 192.168.x, 169.254.x, etc.)
 *   - DNS resolution check — every resolved IP must be a public address
 */
const { isPublicWebhookUrl, isResolvablePublicWebhookUrl } = require('../lib/webhook-security');

/**
 * Validate a webhook URL value.
 * Exported for direct use in route handlers or unit tests without middleware wrapping.
 *
 * @param {string} urlValue
 * @returns {Promise<{valid: true, url: string} | {valid: false, error: string}>}
 */
async function validateWebhookUrlValue(urlValue) {
  if (typeof urlValue !== 'string' || !urlValue.trim()) {
    return { valid: false, error: 'webhook URL is required and must be a string' };
  }

  let parsed;
  try {
    parsed = new URL(urlValue.trim());
  } catch {
    return { valid: false, error: 'webhook URL must be a valid URL' };
  }

  // HTTPS-only: reject plain HTTP
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'webhook URL must use HTTPS (http:// is not allowed)' };
  }

  // Port restriction: only 443 or default (empty string means default 443 for HTTPS)
  if (parsed.port !== '' && parsed.port !== '443') {
    return {
      valid: false,
      error: `webhook URL must use the standard HTTPS port (443). Port ${parsed.port} is not allowed`,
    };
  }

  // RFC-1918 / loopback / link-local / internal hostname check (synchronous)
  if (!isPublicWebhookUrl(urlValue)) {
    return {
      valid: false,
      error: 'webhook URL must point to a publicly accessible host (private, loopback, and internal addresses are not allowed)',
    };
  }

  // DNS resolution check: every IP the hostname resolves to must be public
  const resolvesToPublic = await isResolvablePublicWebhookUrl(urlValue);
  if (!resolvesToPublic) {
    return {
      valid: false,
      error: 'webhook URL hostname does not resolve to a public IP address',
    };
  }

  return { valid: true, url: parsed.toString() };
}

/**
 * Express middleware factory.
 * Reads the URL from `req.body[fieldName]`, validates it, and if valid stores
 * the normalised URL on `req.validatedWebhookUrl` before calling next().
 *
 * Returns HTTP 400 if the URL fails any check.
 * Calls next() immediately (without setting req.validatedWebhookUrl) when the
 * field is absent — the route handler is responsible for requiring it.
 *
 * @param {string} [fieldName='url'] - Body field containing the webhook URL.
 */
function validateWebhookUrl(fieldName = 'url') {
  return async (req, res, next) => {
    const urlValue = req.body?.[fieldName];
    if (urlValue == null) {
      return next(); // absent field — let route handler require it
    }

    let result;
    try {
      result = await validateWebhookUrlValue(urlValue);
    } catch (err) {
      console.error('[validateWebhookUrl] unexpected error:', err.message);
      return res.status(500).json({ error: 'webhook URL validation failed unexpectedly' });
    }

    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }

    req.validatedWebhookUrl = result.url;
    return next();
  };
}

module.exports = { validateWebhookUrl, validateWebhookUrlValue };
