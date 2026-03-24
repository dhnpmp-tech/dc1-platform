const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { getAdminTokenFromReq } = require('./auth');

function ipFallbackKey(req) {
  return `ip:${ipKeyGenerator(req.ip || '0.0.0.0')}`;
}

function retryAfterSeconds(req, windowMs) {
  const resetTime = req?.rateLimit?.resetTime;
  if (resetTime instanceof Date) {
    const seconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  return Math.max(1, Math.ceil(windowMs / 1000));
}

function createRateLimiter({ windowMs, max, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfter = retryAfterSeconds(req, windowMs);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfterSeconds: retryAfter,
        retryAfterMs: retryAfter * 1000,
      });
    },
  });
}

function getRenterKey(req) {
  const renterKey = req.headers['x-renter-key'] || req.query.renter_key || req.query.key;
  if (renterKey) return `renter:${String(renterKey)}`;
  return null;
}

function getProviderKey(req) {
  const providerKey = req.headers['x-provider-key'] || req.query.provider_key || req.query.key;
  if (providerKey) return `provider:${String(providerKey)}`;
  return null;
}

function getApiKey(req) {
  return getRenterKey(req) || getProviderKey(req);
}

function getAdminToken(req) {
  return getAdminTokenFromReq(req);
}

const registerLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => ipFallbackKey(req),
});

const jobSubmitLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => getApiKey(req) || ipFallbackKey(req),
});

const marketplaceLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => getApiKey(req) || ipFallbackKey(req),
});

const publicProvidersLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => ipFallbackKey(req),
});

const containerRegistryLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => ipFallbackKey(req),
});

const vllmCompleteLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => getRenterKey(req) || ipFallbackKey(req),
});

const vllmStreamLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => getRenterKey(req) || ipFallbackKey(req),
});

const retryJobLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 3,
  keyGenerator: (req) => {
    const actor = getRenterKey(req) || ipFallbackKey(req);
    const jobId = String(req.params?.job_id || 'unknown-job');
    return `retry:${actor}:job:${jobId}`;
  },
});

const renterAccountDeletionLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => getRenterKey(req) || ipFallbackKey(req),
});

const providerAccountDeletionLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => getProviderKey(req) || ipFallbackKey(req),
});

const renterDataExportLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => getRenterKey(req) || ipFallbackKey(req),
});

const providerDataExportLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => getProviderKey(req) || ipFallbackKey(req),
});

const adminLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `admin:${getAdminToken(req) || ipFallbackKey(req)}`,
});

// Provider heartbeat: 60 per provider key per minute (daemon sends every 30s = 2/min normally).
// Keyed by provider key so each provider has its own bucket; falls back to IP.
const heartbeatProviderLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => getProviderKey(req) || ipFallbackKey(req),
});

// Auth endpoints: 10 per IP per minute.
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => ipFallbackKey(req),
});

// Public endpoint limiter: 100 requests per IP per minute.
// Applied to unauthenticated access on /api/providers, /api/jobs, /api/models.
const publicEndpointLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => ipFallbackKey(req),
});

// Authenticated endpoint limiter: 1000 requests per API key per minute.
// Applied when a valid API key (renter, provider, or bearer token) is present.
const authenticatedEndpointLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 1000,
  keyGenerator: (req) => getApiKey(req) || ipFallbackKey(req),
});

// Model deploy limiter: 20 deploy requests per API key (or IP) per minute.
// Applied to POST /api/models/:model_id/deploy to prevent deploy spam.
const modelDeployLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => getApiKey(req) || ipFallbackKey(req),
});

module.exports = {
  createRateLimiter,
  registerLimiter,
  jobSubmitLimiter,
  marketplaceLimiter,
  publicProvidersLimiter,
  publicEndpointLimiter,
  authenticatedEndpointLimiter,
  modelDeployLimiter,
  containerRegistryLimiter,
  vllmCompleteLimiter,
  vllmStreamLimiter,
  retryJobLimiter,
  renterAccountDeletionLimiter,
  providerAccountDeletionLimiter,
  renterDataExportLimiter,
  providerDataExportLimiter,
  adminLimiter,
  heartbeatProviderLimiter,
  authLimiter,
};
