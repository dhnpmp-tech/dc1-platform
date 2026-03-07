// DC1 Provider Onboarding Backend Server
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.DC1_PROVIDER_PORT || 8083;

// ── CORS Lockdown ─────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://dc1-platform.vercel.app',
  'https://dc1-platform-dc11.vercel.app',
  'https://dc1-platform-git-main-dc11.vercel.app',
  'http://76.13.179.86:8083',
  'http://76.13.179.86:8084',
  'http://localhost:3000',
  'http://localhost:8083',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (daemon, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow exact matches
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Allow Vercel preview deploys (*.vercel.app)
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return callback(null, true);
    console.warn(`[cors] Blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));  // Increased for base64 image results
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// General API: 300 per IP per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: 'Rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Serve static files (provider-onboarding.html etc)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Clean URL route for provider onboarding
app.get('/provider-onboarding', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/provider-onboarding.html'));
});

// Serve installer files for download
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

// Initialize Supabase sync bridge
const supabaseSync = require('./services/supabase-sync');
if (supabaseSync.init()) { supabaseSync.startPeriodicSync(); }

const fallbackRouter = require('./routes/fallback');
app.use('/api/fallback', fallbackRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'dc1-provider-onboarding', timestamp: new Date().toISOString() });
});

// Default route -> onboarding form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'provider-onboarding.html'));
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

app.listen(PORT, () => {
  console.log(`DC1 Provider Onboarding server running on port ${PORT}`);
  console.log(`Form: http://localhost:${PORT}/provider-onboarding.html`);
  console.log(`API:  http://localhost:${PORT}/api/providers`);
});

// Audit & Operations documentation page
app.get('/docs', (req, res) => {
    res.sendFile(require('path').join(__dirname, '../public/docs.html'));
});
