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

// Admin IP allowlist middleware factory. When ADMIN_IP_ALLOWLIST env var is set
// (comma-separated IPs), returns middleware that rejects any request whose source
// IP is not in the list with 403. Returns null when unset — no restriction applied.
function createAdminIpAllowlist() {
  const raw = (process.env.ADMIN_IP_ALLOWLIST || '').trim();
  if (!raw) return null;
  const allowed = new Set(raw.split(',').map((ip) => ip.trim()).filter(Boolean));
  return function adminIpAllowlist(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || '';
    if (allowed.has(ip)) return next();
    return res.status(403).json({ error: 'Access denied: IP not in allowlist' });
  };
}

const registerLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => ipFallbackKey(req),
});

// Job submission: 20 per renter key per minute (DCP-805 spec). Falls back to IP.
const jobSubmitLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => getRenterKey(req) || ipFallbackKey(req),
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
const heartbeatProviderLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => getProviderKey(req) || ipFallbackKey(req),
});

// Auth endpoints: 10 per IP per 15 minutes (strict — login, register, token exchange).
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => ipFallbackKey(req),
});

// Catalog/public browsing: 200 per IP per 15 minutes (spec: 200 req/15min per IP).
const catalogLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: (req) => ipFallbackKey(req),
});

// Public endpoint limiter: 200 requests per IP per 15 minutes.
const publicEndpointLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: (req) => ipFallbackKey(req),
});

// Authenticated endpoint limiter: 1000 requests per API key per minute.
const authenticatedEndpointLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 1000,
  keyGenerator: (req) => getApiKey(req) || ipFallbackKey(req),
});

// Model deploy limiter: 20 deploy requests per API key (or IP) per minute.
const modelDeployLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => getApiKey(req) || ipFallbackKey(req),
});

// Provider activation: 3 per provider key per hour (DCP-805). Prevents activation abuse.
const providerActivateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => getProviderKey(req) || ipFallbackKey(req),
});

module.exports = {
  createRateLimiter,
  createAdminIpAllowlist,
  registerLimiter,
  jobSubmitLimiter,
  marketplaceLimiter,
  publicProvidersLimiter,
  publicEndpointLimiter,
  catalogLimiter,
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
  providerActivateLimiter,
};
