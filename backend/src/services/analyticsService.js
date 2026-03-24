/**
 * DCP Analytics Service — Segment HTTP API
 *
 * Server-side event tracking for Phase 1 real-user research.
 * Uses Segment's HTTP Tracking API directly (no SDK dependency).
 * Falls back gracefully when SEGMENT_WRITE_KEY is not configured.
 *
 * Events → Segment → Mixpanel dashboard
 */

const https = require('https');

const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY || '';
const SEGMENT_API_URL = 'https://api.segment.io';
const SERVICE_NAME = 'dc1-backend';

// Warn once at startup if analytics is unconfigured
if (!SEGMENT_WRITE_KEY) {
  console.warn('[analytics] SEGMENT_WRITE_KEY not set — analytics events will be no-ops');
}

/**
 * Send a raw Segment HTTP API request.
 * @param {string} path - e.g. '/v1/track' or '/v1/identify'
 * @param {object} payload
 * @returns {Promise<void>}
 */
function segmentRequest(path, payload) {
  if (!SEGMENT_WRITE_KEY) return Promise.resolve();

  return new Promise((resolve) => {
    const body = JSON.stringify({
      ...payload,
      sentAt: new Date().toISOString(),
      context: {
        library: { name: SERVICE_NAME, version: '1.0.0' },
        ...(payload.context || {}),
      },
    });

    const credentials = Buffer.from(`${SEGMENT_WRITE_KEY}:`).toString('base64');
    const options = {
      hostname: 'api.segment.io',
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `Basic ${credentials}`,
      },
    };

    const req = https.request(options, (res) => {
      res.resume(); // consume response to free socket
      if (res.statusCode >= 400) {
        console.warn(`[analytics] Segment ${path} returned ${res.statusCode}`);
      }
      resolve();
    });

    req.on('error', (err) => {
      // Never throw — analytics must never break the main request path
      console.warn('[analytics] Segment request error:', err.message);
      resolve();
    });

    req.setTimeout(3000, () => {
      req.destroy();
      resolve();
    });

    req.write(body);
    req.end();
  });
}

/**
 * Track an event for a known user.
 * @param {string} userId - Renter/provider ID
 * @param {string} event - Event name (see event schema below)
 * @param {object} [properties] - Additional event properties
 * @param {object} [context] - Segment context overrides
 */
async function track(userId, event, properties = {}, context = {}) {
  if (!SEGMENT_WRITE_KEY) return;
  try {
    await segmentRequest('/v1/track', {
      userId: String(userId),
      event,
      properties: {
        platform: 'dcp',
        ...properties,
      },
      context,
    });
  } catch (err) {
    console.warn('[analytics] track error:', err.message);
  }
}

/**
 * Track an anonymous event (for pre-auth funnel steps).
 * @param {string} anonymousId
 * @param {string} event
 * @param {object} [properties]
 */
async function trackAnonymous(anonymousId, event, properties = {}) {
  if (!SEGMENT_WRITE_KEY) return;
  try {
    await segmentRequest('/v1/track', {
      anonymousId: String(anonymousId),
      event,
      properties: {
        platform: 'dcp',
        ...properties,
      },
    });
  } catch (err) {
    console.warn('[analytics] trackAnonymous error:', err.message);
  }
}

/**
 * Identify a user (set traits for Mixpanel people profiles).
 * @param {string} userId
 * @param {object} traits
 */
async function identify(userId, traits = {}) {
  if (!SEGMENT_WRITE_KEY) return;
  try {
    await segmentRequest('/v1/identify', {
      userId: String(userId),
      traits: {
        platform: 'dcp',
        ...traits,
      },
    });
  } catch (err) {
    console.warn('[analytics] identify error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed event helpers — one function per event schema entry
// ─────────────────────────────────────────────────────────────────────────────

// ── Renter Onboarding ────────────────────────────────────────────────────────

const renter = {
  signupStart: (anonymousId, props = {}) =>
    trackAnonymous(anonymousId, 'renter_signup_start', props),

  signupComplete: (renterId, props = {}) =>
    track(renterId, 'renter_signup_complete', props),

  login: (renterId, props = {}) =>
    track(renterId, 'renter_login', { method: 'email_otp', ...props }),

  profileSetup: (renterId, props = {}) =>
    track(renterId, 'renter_profile_setup', props),

  firstModelView: (renterId, props = {}) =>
    track(renterId, 'renter_first_model_view', props),

  modelDetailView: (renterId, modelId, modelName, props = {}) =>
    track(renterId, 'renter_model_detail_view', { model_id: modelId, model_name: modelName, ...props }),

  deploymentStart: (renterId, jobId, modelId, props = {}) =>
    track(renterId, 'renter_deployment_start', { job_id: jobId, model_id: modelId, ...props }),

  deploymentComplete: (renterId, jobId, modelId, durationMs, props = {}) =>
    track(renterId, 'renter_deployment_complete', {
      job_id: jobId,
      model_id: modelId,
      duration_ms: durationMs,
      ...props,
    }),

  deploymentError: (renterId, jobId, errorCode, errorMessage, props = {}) =>
    track(renterId, 'renter_deployment_error', {
      job_id: jobId,
      error_code: errorCode,
      error_message: errorMessage,
      ...props,
    }),

  inferenceRequest: (renterId, jobId, modelId, tokenCount, props = {}) =>
    track(renterId, 'renter_inference_request', {
      job_id: jobId,
      model_id: modelId,
      token_count: tokenCount,
      ...props,
    }),

  invoiceView: (renterId, invoiceId, props = {}) =>
    track(renterId, 'renter_invoice_view', { invoice_id: invoiceId, ...props }),
};

// ── Provider Onboarding ──────────────────────────────────────────────────────

const provider = {
  signupStart: (anonymousId, props = {}) =>
    trackAnonymous(anonymousId, 'provider_signup_start', props),

  signupComplete: (providerId, props = {}) =>
    track(providerId, 'provider_signup_complete', props),

  profileSetup: (providerId, props = {}) =>
    track(providerId, 'provider_profile_setup', props),

  hardwareRegistration: (providerId, gpuModel, gpuCount, props = {}) =>
    track(providerId, 'provider_hardware_registration', {
      gpu_model: gpuModel,
      gpu_count: gpuCount,
      ...props,
    }),

  modelDeployment: (providerId, modelId, modelName, props = {}) =>
    track(providerId, 'provider_model_deployment', {
      model_id: modelId,
      model_name: modelName,
      ...props,
    }),

  earningsView: (providerId, props = {}) =>
    track(providerId, 'provider_earnings_view', props),
};

// ── Session / Performance Metrics ────────────────────────────────────────────

const session = {
  duration: (userId, durationMs, pageCount, props = {}) =>
    track(userId, 'session_duration', {
      duration_ms: durationMs,
      page_count: pageCount,
      ...props,
    }),

  pageLoad: (userId, route, durationMs, props = {}) =>
    track(userId, 'page_load_time', {
      route,
      duration_ms: durationMs,
      ...props,
    }),

  apiLatency: (userId, endpoint, method, statusCode, durationMs, props = {}) =>
    track(userId, 'api_latency', {
      endpoint,
      method,
      status_code: statusCode,
      duration_ms: durationMs,
      ...props,
    }),

  errorRate: (userId, endpoint, errorCode, props = {}) =>
    track(userId, 'error_rate', {
      endpoint,
      error_code: errorCode,
      ...props,
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Express middleware — API latency tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Express middleware that records API latency events for authenticated requests.
 * Attach after auth middleware so req.renterId / req.providerId is available.
 *
 * Usage: app.use(analyticsService.latencyMiddleware)
 */
function latencyMiddleware(req, res, next) {
  if (!SEGMENT_WRITE_KEY) return next();

  const start = Date.now();
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    const durationMs = Date.now() - start;
    const userId = req.renterId || req.providerId;
    const route = req.route ? req.route.path : req.path;

    if (userId) {
      // Fire-and-forget — don't await
      session.apiLatency(userId, route, req.method, res.statusCode, durationMs).catch(() => {});

      if (res.statusCode >= 400) {
        session.errorRate(userId, route, res.statusCode).catch(() => {});
      }
    }

    return originalJson(body);
  };

  next();
}

module.exports = {
  // Low-level
  track,
  trackAnonymous,
  identify,
  // Typed helpers
  renter,
  provider,
  session,
  // Middleware
  latencyMiddleware,
};
