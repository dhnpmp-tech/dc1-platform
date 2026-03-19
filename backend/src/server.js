// DC1 Provider Onboarding Backend Server
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const paymentsRouter = require('./routes/payments');

const app = express();
const PORT = process.env.DC1_PROVIDER_PORT || 8083;

// ── CORS Lockdown ─────────────────────────────────────────────────────
// Additional origins can be injected via CORS_ORIGINS (comma-separated)
const _extraOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];
const _frontendOrigin = (process.env.FRONTEND_URL || '').trim();
const ALLOWED_ORIGINS = [
  'https://dcp.sa',
  'https://www.dcp.sa',
  ...(_frontendOrigin ? [_frontendOrigin] : []),
  ..._extraOrigins,
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (daemon, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow exact matches
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn(`[cors] Blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Webhook raw parser must run before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' }));  // Large limit for base64 image results (512x512 PNG ~ 500KB base64)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Security Headers ────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Headless API: strict CSP — no scripts/styles needed
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  next();
});

// ── Input Sanitization ──────────────────────────────────────────────────
// Strip HTML tags and null bytes from all string inputs
function sanitize(obj) {
  if (typeof obj === 'string') return obj.replace(/\0/g, '').replace(/<[^>]*>/g, '').trim();
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj && typeof obj === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) clean[k] = sanitize(v);
    return clean;
  }
  return obj;
}
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') req.body = sanitize(req.body);
  if (req.query && typeof req.query === 'object') req.query = sanitize(req.query);
  next();
});

// ── Rate Limiting ───────────────────────────────────────────────────────
// Registration: 5 attempts per IP per hour (prevents spam)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts. Try again in 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/providers/register', registerLimiter);

// Heartbeat: 4 per minute per IP (daemon sends every 30s = 2/min normally)
const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 4,
  message: { error: 'Heartbeat rate limit exceeded. Normal interval is 30s.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/providers/heartbeat', heartbeatLimiter);

// Job submission: 30 per IP per minute
const jobSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many job submissions. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/jobs/submit', jobSubmitLimiter);

// Admin endpoints: 100 per IP per minute
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Admin rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/admin', adminLimiter);

// Login endpoints: 10 attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/providers/login', loginLimiter);
app.use('/api/renters/login', loginLimiter);
app.use('/api/providers/login-email', loginLimiter);
app.use('/api/renters/login-email', loginLimiter);
app.use('/api/admin/login', loginLimiter);

// Renter registration: 5 per IP per hour (same policy as provider registration)
const renterRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts. Try again in 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/renters/register', renterRegisterLimiter);

// Balance top-up: 10 per IP per minute (financial operation — prevent abuse)
const topupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many top-up requests. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/renters/topup', topupLimiter);

// Payment initiation (Moyasar): 10 per IP per minute
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many payment requests. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/payments/topup', paymentLimiter);
app.use('/api/payments/topup-sandbox', paymentLimiter);

// General API: 300 per IP per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: 'Rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Phase 4 Final: VPS is headless API only — no HTML serving
// Static HTML files (provider-onboarding.html, admin.html, docs.html) removed.
// All frontend is served by Next.js on Vercel (dcp.sa).

// Serve installer files for download (daemon binaries — still needed)
app.use('/installers', express.static(path.join(__dirname, '..', 'installers')));

// API Routes
const providersRouter = require('./routes/providers');
app.use('/api/providers', providersRouter);

const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);

const benchmarkRouter = require('./routes/benchmark');
app.use('/api/benchmark', benchmarkRouter);

const recoveryRouter = require('./routes/recovery');
app.use('/api/recovery', recoveryRouter);

const jobsRouter = require('./routes/jobs');
app.use('/api/jobs', jobsRouter);

const standupRouter = require('./routes/standup');
app.use('/api/standup', standupRouter);
const reconciliationRouter = require('./routes/reconciliation');
app.use('/api/reconciliation', reconciliationRouter);
const securityRouter = require('./routes/security');
app.use('/api/security', securityRouter);
const intelligenceRouter = require('./routes/intelligence');
app.use('/api/intelligence', intelligenceRouter);

const syncRouter = require('./routes/sync');
app.use('/api/sync', syncRouter);

const rentersRouter = require('./routes/renters');
app.use('/api/renters', rentersRouter);

const verificationRouter = require('./routes/verification');
app.use('/api/verification', verificationRouter);

app.use('/api/payments', paymentsRouter);

const templatesRouter = require('./routes/templates');
app.use('/api/templates', templatesRouter);

// Initialize Supabase sync bridge
const supabaseSync = require('./services/supabase-sync');
if (supabaseSync.init()) { supabaseSync.startPeriodicSync(); }

const fallbackRouter = require('./routes/fallback');
app.use('/api/fallback', fallbackRouter);

const db = require('./db');

// Health check
app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();

    const providersTotal = db.prepare(
      `SELECT COUNT(*) AS count FROM providers`
    ).get()?.count || 0;

    const providersOnline = db.prepare(
      `SELECT COUNT(*) AS count FROM providers WHERE status = 'online'`
    ).get()?.count || 0;

    const jobsQueued = db.prepare(
      `SELECT COUNT(*) AS count FROM jobs WHERE status = 'queued'`
    ).get()?.count || 0;

    const jobsRunning = db.prepare(
      `SELECT COUNT(*) AS count FROM jobs WHERE status = 'running'`
    ).get()?.count || 0;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: 'ok',
      providers: { total: providersTotal, online: providersOnline },
      jobs: { queued: jobsQueued, running: jobsRunning },
    });
  } catch (err) {
    console.error('[health] Failed to run health checks:', err?.message || err);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// OpenAPI spec — GET /api/docs
const OPENAPI_PATH = path.join(__dirname, '../../docs/openapi.yaml');
app.get('/api/docs', (req, res) => {
  if (!fs.existsSync(OPENAPI_PATH)) {
    return res.status(404).json({ error: 'OpenAPI spec not found' });
  }
  res.setHeader('Content-Type', 'application/yaml');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(OPENAPI_PATH);
});

// Swagger UI — GET /api/docs/ui (CDN-hosted, no npm package required)
app.get('/api/docs/ui', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DCP API — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #07070E; }
    .topbar { background: #07070E !important; }
    .topbar-wrapper img { display: none; }
    .topbar-wrapper::before {
      content: 'DCP API';
      color: #F5A524;
      font-size: 1.4rem;
      font-weight: 700;
      font-family: Inter, sans-serif;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/api/docs',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
        deepLinking: true,
        tryItOutEnabled: true,
      });
    };
  </script>
</body>
</html>`);
});

// Default route -> API info (headless mode)
app.get('/', (req, res) => {
  res.json({
    service: 'dc1-platform-api',
    version: '4.0.0',
    status: 'ok',
    frontend: 'https://dcp.sa',
    docs: 'https://dcp.sa/docs',
    timestamp: new Date().toISOString(),
  });
});

// Start recovery cycle every 30 seconds
const { runRecoveryCycle } = require('./services/recovery-engine');
setInterval(runRecoveryCycle, 30 * 1000);
console.log('[recovery] Recovery cycle started (every 30s)');

// Start job timeout enforcement every 30 seconds
const { enforceJobTimeouts } = require('./routes/jobs');
setInterval(enforceJobTimeouts, 30 * 1000);
console.log('[timeout] Job timeout enforcement started (every 30s)');

// Start fallback loop (bottleneck detection + disconnect recovery) every 15 seconds
const { startLoop: startFallbackLoop } = require('./services/fallback-loop');
startFallbackLoop();

// Start data retention cleanup (runs daily at 2:00 AM UTC — DCP-59)
const cleanup = require('./services/cleanup');
cleanup.schedule();

app.listen(PORT, () => {
  console.log(`DC1 Platform API (headless) running on port ${PORT}`);
  console.log(`API:  http://localhost:${PORT}/api`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
});
