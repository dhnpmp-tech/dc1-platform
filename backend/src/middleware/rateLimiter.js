const rateLimit = require('express-rate-limit');

function createRateLimiter({ windowMs, max, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfterMs: windowMs,
      });
    },
  });
}

function getApiKey(req) {
  const renterKey = req.headers['x-renter-key'] || req.query.renter_key || req.query.key;
  if (renterKey) return `renter:${String(renterKey)}`;

  const providerKey = req.headers['x-provider-key'] || req.query.provider_key;
  if (providerKey) return `provider:${String(providerKey)}`;

  return null;
}

function getAdminToken(req) {
  const headerToken = req.headers['x-admin-token'];
  if (headerToken) return String(headerToken);

  const authHeader = String(req.headers.authorization || '');
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearer && bearer[1]) return bearer[1];

  return null;
}

const registerLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

const jobSubmitLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => getApiKey(req) || `ip:${req.ip || 'unknown'}`,
});

const marketplaceLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => getApiKey(req) || `ip:${req.ip || 'unknown'}`,
});

const adminLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `admin:${getAdminToken(req) || `ip:${req.ip || 'unknown'}`}`,
});

module.exports = {
  createRateLimiter,
  registerLimiter,
  jobSubmitLimiter,
  marketplaceLimiter,
  adminLimiter,
};
