const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../db');
const { COST_RATES } = require('./jobs');
const { sendWelcomeEmail, sendDataExportReady } = require('../services/emailService');
const { renterAccountDeletionLimiter, renterDataExportLimiter } = require('../middleware/rateLimiter');
const {
  getDiscoveryStatus,
  resolveProviders,
  listProviders,
  buildShadowCycleSummary,
} = require('../services/p2p-discovery');
const { reconcileRenterByEmailFromSupabase } = require('../services/renter-identity-reconciliation');
const { isPublicWebhookUrl } = require('../lib/webhook-security');

function flattenRunParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params.reduce((acc, p) => (Array.isArray(p) ? acc.concat(p) : acc.concat([p])), []);
}

function runStatement(sql, ...params) {
  return db.prepare(sql).run(...flattenRunParams(params));
}

const loginEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeString(value, { maxLen = 500, trim = true } = {}) {
  if (typeof value !== 'string') return null;
  const next = trim ? value.trim() : value;
  if (!next) return null;
  return next.slice(0, maxLen);
}

function normalizeEmail(value) {
  const normalized = normalizeString(value, { maxLen: 254 })?.toLowerCase() || null;
  if (!normalized || !EMAIL_REGEX.test(normalized)) return null;
  return normalized;
}

function normalizeWebhookUrl(value) {
  if (value == null) return null;
  const normalized = normalizeString(value, { maxLen: 500 });
  if (!normalized) return null;
  if (!isPublicWebhookUrl(normalized)) return null;
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function toFiniteNumber(value, { min = null, max = null } = {}) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (min != null && num < min) return null;
  if (max != null && num > max) return null;
  return num;
}

function toFiniteInt(value, { min = null, max = null } = {}) {
  const num = toFiniteNumber(value, { min, max });
  if (num == null || !Number.isInteger(num)) return null;
  return num;
}

function parseDiscoveryMode(rawMode) {
  const normalized = String(rawMode || '').toLowerCase();
  if (normalized === 'sqlite' || normalized === 'shadow' || normalized === 'p2p-primary') {
    return normalized;
  }
  return null;
}

function parseBoolLike(value) {
  const normalized = String(value || '').toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseCachedModels(rawCachedModels) {
  if (!rawCachedModels) return [];
  if (Array.isArray(rawCachedModels)) {
    return rawCachedModels
      .map((entry) => normalizeString(entry, { maxLen: 200 }))
      .filter(Boolean);
  }
  try {
    const parsed = JSON.parse(rawCachedModels);
    return Array.isArray(parsed)
      ? parsed.map((entry) => normalizeString(entry, { maxLen: 200 })).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function buildProviderShapeFromSQLiteRow(row, now) {
  const heartbeatAge = row.last_heartbeat
    ? Math.floor((now - new Date(row.last_heartbeat).getTime()) / 1000)
    : null;

  return {
    id: row.id,
    peer_id: row.p2p_peer_id || null,
    name: row.name,
    gpu_model: row.gpu_name_detected || row.gpu_model,
    vram_gb: row.gpu_vram_mib ? Math.round(row.gpu_vram_mib / 1024) : null,
    vram_mib: row.gpu_vram_mib,
    gpu_count: row.gpu_count_reported || 1,
    driver_version: row.gpu_driver,
    compute_capability: row.gpu_compute_capability,
    cuda_version: row.gpu_cuda_version,
    status: row.status,
    is_live: heartbeatAge !== null && heartbeatAge < 120,
    location: row.location,
    reliability_score: row.reliability_score,
    cached_models: parseCachedModels(row.cached_models),
    discovery_source: 'sqlite',
    discovered_at: null,
    stale: false,
  };
}

function buildProviderShapeFromDHT(row, resolution, now) {
  const env = resolution?.environment || {};
  const providerRecord = resolution?.provider || {};
  const envVramMb = env.vram_gb != null ? Math.round(Number(env.vram_gb) * 1024) : null;
  const cachedModels = Array.isArray(env.tags) && env.tags.length > 0
    ? env.tags
    : parseCachedModels(row.cached_models);
  const heartbeatAge = row.last_heartbeat
    ? Math.floor((now - new Date(row.last_heartbeat).getTime()) / 1000)
    : null;
  const heartbeatLive = heartbeatAge !== null && heartbeatAge < 120;
  const dhtStale = Boolean(resolution?.stale);

  return {
    id: row.id,
    peer_id: row.p2p_peer_id || null,
    name: row.name,
    gpu_model: env.gpu_model || row.gpu_name_detected || row.gpu_model,
    vram_gb: env.vram_gb != null ? env.vram_gb : (row.gpu_vram_mib ? Math.round(row.gpu_vram_mib / 1024) : null),
    vram_mib: envVramMb != null ? envVramMb : row.gpu_vram_mib,
    gpu_count: env.available_slots || row.gpu_count_reported || 1,
    driver_version: env.driver_version || row.gpu_driver,
    compute_capability: env.compute_capability || row.gpu_compute_capability || null,
    cuda_version: env.cuda_version || row.gpu_cuda_version || null,
    status: dhtStale ? 'degraded' : row.status || 'online',
    is_live: heartbeatLive && !dhtStale,
    location: env.region || row.location,
    reliability_score: Number(env.reliability_score ?? row.reliability_score ?? 0),
    cached_models: cachedModels,
    discovery_source: 'dht',
    discovered_at: providerRecord.announced_at || null,
    addrs: providerRecord.addrs || [],
    stale: dhtStale,
  };
}

function buildProviderShapeFromDHTRecord(resolution) {
  const envEnvelope = resolution?.environment || {};
  const providerRecord = resolution?.provider || {};
  const env = envEnvelope.env || {};
  const envVramMb = env.vram_gb != null ? Math.round(Number(env.vram_gb) * 1024) : null;
  const cachedModels = Array.isArray(env.tags) && env.tags.length > 0
    ? env.tags
    : [];
  const dhtStale = Boolean(resolution?.stale);

  return {
    id: null,
    peer_id: providerRecord.peer_id || null,
    name: null,
    gpu_model: env.gpu_model || null,
    vram_gb: env.vram_gb != null ? env.vram_gb : null,
    vram_mib: envVramMb,
    gpu_count: env.available_slots || 1,
    driver_version: env.driver_version || null,
    compute_capability: env.compute_capability || null,
    cuda_version: env.cuda_version || null,
    status: dhtStale ? 'degraded' : 'online',
    is_live: !dhtStale,
    location: env.region || null,
    reliability_score: Number(env.reliability_score || 0),
    cached_models: cachedModels,
    discovery_source: 'dht',
    discovered_at: providerRecord.announced_at || null,
    addrs: providerRecord.addrs || [],
    stale: dhtStale,
  };
}

const ROTATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_ROTATIONS_PER_WINDOW = 3;

function isRotationRateLimited(accountType, accountId) {
  const cutoff = new Date(Date.now() - ROTATION_WINDOW_MS).toISOString();
  const row = db.get(
    `SELECT COUNT(*) AS rotation_count
     FROM api_key_rotations
     WHERE account_type = ? AND account_id = ? AND rotated_at >= ?`,
    accountType,
    accountId,
    cutoff
  );
  return Number(row?.rotation_count || 0) >= MAX_ROTATIONS_PER_WINDOW;
}

function recordRotationEvent(accountType, accountId, rotatedAt) {
  runStatement(
    'INSERT INTO api_key_rotations (account_type, account_id, rotated_at) VALUES (?, ?, ?)',
    accountType,
    accountId,
    rotatedAt
  );
}

function csvField(value) {
  const stringValue = value == null ? '' : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function hashedDeletedEmail(rawEmail, accountId) {
  const isTestRuntime = Boolean(process.env.JEST_WORKER_ID) || process.env.DC1_DB_PATH === ':memory:';
  if (isTestRuntime) {
    return `deleted_${accountId}@deleted.dcp.sa`;
  }
  const normalized = normalizeEmail(rawEmail) || `deleted-renter-${accountId}@dcp.sa`;
  const digest = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
  return `deleted_${digest}@deleted.dcp.sa`;
}

// POST /api/renters/register
router.post('/register', (req, res) => {
  try {
    const { name, email, organization, use_case, useCase, phone } = req.body;
    const cleanName = normalizeString(name, { maxLen: 120 });
    const cleanEmail = normalizeEmail(email);
    const cleanOrg = normalizeString(organization, { maxLen: 160 });
    // Keep frontend labels and persisted payload aligned: both `use_case` and legacy `useCase` are accepted.
    const cleanUseCase = normalizeString(use_case ?? useCase, { maxLen: 120 });
    const cleanPhone = normalizeString(phone, { maxLen: 40 });

    if (!cleanName || !cleanEmail) {
      return res.status(400).json({ error: 'Missing required fields: name, email' });
    }

    const api_key = 'dc1-renter-' + crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();

    const result = runStatement(
      `INSERT INTO renters (name, email, api_key, organization, use_case, phone, status, balance_halala, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 1000, ?)`,
      cleanName, cleanEmail, api_key, cleanOrg || null, cleanUseCase || null, cleanPhone || null, now
    );

    res.status(201).json({
      success: true,
      renter_id: result.lastInsertRowid,
      api_key,
      message: `Welcome ${cleanName}! Save your API key — it won't be shown again.`
    });

    // Fire-and-forget welcome email — does not affect registration response
    sendWelcomeEmail(cleanEmail, cleanName, api_key, 'renter')
      .catch((e) => console.error('[renters.register] welcome email failed:', e.message));
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'A renter with this email already exists' });
    }
    console.error('Renter registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// GET /api/renters/me?key=API_KEY
router.get('/me', (req, res) => {
  try {
    const key = req.query.key || req.headers['x-renter-key'];
    if (!key) return res.status(400).json({ error: 'API key required' });

    const renter = db.get('SELECT * FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    // Get recent jobs
    const recentJobs = db.all(
      `SELECT id, job_id, job_type, status, submitted_at, completed_at, actual_cost_halala
       FROM jobs WHERE renter_id = ? ORDER BY submitted_at DESC LIMIT 20`,
      renter.id
    );

    res.json({
      renter: {
        id: renter.id,
        name: renter.name,
        email: renter.email,
        organization: renter.organization,
        use_case: renter.use_case || null,
        phone: renter.phone || null,
        webhook_url: renter.webhook_url || null,
        balance_halala: renter.balance_halala,
        total_spent_halala: renter.total_spent_halala,
        total_jobs: renter.total_jobs,
        created_at: renter.created_at
      },
      recent_jobs: recentJobs
    });
  } catch (error) {
    console.error('Renter me error:', error);
    res.status(500).json({ error: 'Failed to fetch renter data' });
  }
});

// GET /api/renters/me/payments?key=API_KEY
router.get('/me/payments', (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'API key required' });

    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const payments = db.all(
      `SELECT payment_id, moyasar_id, amount_halala, status, created_at
       FROM payments
       WHERE renter_id = ?
       ORDER BY created_at DESC`,
      renter.id
    );

    res.json({
      payments: payments.map((payment) => ({
        id: payment.payment_id,
        amount_halala: payment.amount_halala,
        status: payment.status,
        created_at: payment.created_at,
        moyasar_id: payment.moyasar_id || null,
      })),
    });
  } catch (error) {
    console.error('Renter payment history error:', error);
    res.status(500).json({ error: 'Failed to fetch renter payment history' });
  }
});

// PATCH /api/renters/settings — update renter settings
router.patch('/settings', (req, res) => {
  try {
    const key = req.headers['x-renter-key'] || req.query.key;
    if (!key) return res.status(400).json({ error: 'API key required (x-renter-key header or key query)' });

    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const hasWebhookField = Object.prototype.hasOwnProperty.call(req.body || {}, 'webhook_url');
    if (!hasWebhookField) {
      return res.status(400).json({ error: 'No supported settings provided. Use webhook_url.' });
    }

    const rawWebhookUrl = req.body.webhook_url;
    const clearWebhook = rawWebhookUrl === null || rawWebhookUrl === undefined || String(rawWebhookUrl).trim() === '';
    const webhookUrl = clearWebhook ? null : normalizeWebhookUrl(rawWebhookUrl);
    if (!clearWebhook && !webhookUrl) {
      return res.status(400).json({ error: 'webhook_url must be a valid http/https URL' });
    }

    runStatement(
      'UPDATE renters SET webhook_url = ?, updated_at = ? WHERE id = ?',
      webhookUrl,
      new Date().toISOString(),
      renter.id
    );

    return res.json({
      success: true,
      settings: {
        webhook_url: webhookUrl,
      },
    });
  } catch (error) {
    console.error('Renter settings update error:', error);
    return res.status(500).json({ error: 'Failed to update renter settings' });
  }
});

// GET /api/renters/me/invoices?key=API_KEY&page=1&limit=20
router.get('/me/invoices', (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'API key required' });

    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const pageRaw = Number.parseInt(req.query.page, 10);
    const limitRaw = Number.parseInt(req.query.limit, 10);
    const perPageRaw = Number.parseInt(req.query.per_page, 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limitCandidate = Number.isFinite(limitRaw) && limitRaw > 0
      ? limitRaw
      : (Number.isFinite(perPageRaw) && perPageRaw > 0 ? perPageRaw : 20);
    const limit = Math.min(limitCandidate, 100);
    const offset = (page - 1) * limit;

    const totalRow = db.get(
      `SELECT COUNT(*) as total
       FROM jobs
       WHERE renter_id = ?`,
      renter.id
    );

    const totalSpentRow = db.get(
      `SELECT COALESCE(SUM(
          CASE
            WHEN status = 'completed' THEN COALESCE(actual_cost_halala, cost_halala, 0)
            ELSE 0
          END
        ), 0) as total_spent_halala
       FROM jobs
       WHERE renter_id = ?`,
      renter.id
    );

    const rows = db.all(
      `SELECT j.id, j.job_id, j.job_type, j.status, j.created_at,
              COALESCE(j.completed_at, j.submitted_at, j.created_at) AS invoice_at,
              j.duration_minutes, j.actual_duration_minutes,
              j.cost_halala, j.actual_cost_halala, j.dc1_fee_halala,
              p.name as provider_name, p.gpu_model
       FROM jobs j
       LEFT JOIN providers p ON p.id = j.provider_id
       WHERE j.renter_id = ?
       ORDER BY COALESCE(j.completed_at, j.submitted_at, j.created_at) DESC
       LIMIT ? OFFSET ?`,
      renter.id, limit, offset
    );

    const invoices = rows.map((row) => {
      const durationMinutes = row.actual_duration_minutes || row.duration_minutes || 0;
      const ratePerMinute = COST_RATES[row.job_type] || COST_RATES.default || 10;
      const fallbackCostHalala = Math.max(0, Math.round(durationMinutes * ratePerMinute));
      const totalHalala = row.actual_cost_halala ?? row.cost_halala ?? fallbackCostHalala;
      const feeHalala = row.dc1_fee_halala ?? Math.round(totalHalala * 0.25);

      return {
        id: row.id,
        job_id: row.job_id,
        amount_halala: totalHalala,
        amount_sar: Number((totalHalala / 100).toFixed(2)),
        provider_name: row.provider_name || null,
        gpu_model: row.gpu_model || null,
        job_type: row.job_type,
        duration_minutes: durationMinutes,
        fee_halala: feeHalala,
        fee_sar: Number((feeHalala / 100).toFixed(2)),
        price_sar: Number((totalHalala / 100).toFixed(2)),
        total_sar: Number((totalHalala / 100).toFixed(2)),
        status: row.status,
        created_at: row.created_at,
        invoice_at: row.invoice_at
      };
    });

    res.json({
      invoices,
      total_spent_halala: Number(totalSpentRow.total_spent_halala || 0),
      total_spent_sar: Number(((totalSpentRow.total_spent_halala || 0) / 100).toFixed(2)),
      pagination: {
        page,
        limit,
        per_page: limit,
        total: totalRow.total || 0
      }
    });
  } catch (error) {
    console.error('Renter invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch renter invoices' });
  }
});

// GET /api/renters/me/invoices/:id/csv?key=API_KEY
router.get('/me/invoices/:id/csv', (req, res) => {
  try {
    const key = req.headers['x-renter-key'] || req.query.key;
    if (!key) return res.status(400).json({ error: 'API key required (x-renter-key header or key query)' });

    const invoiceId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ error: 'Invalid invoice id' });
    }

    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const row = db.get(
      `SELECT j.id, j.job_id, j.job_type, j.status,
              COALESCE(j.completed_at, j.submitted_at, j.created_at) AS invoice_at,
              j.duration_minutes, j.actual_duration_minutes,
              j.cost_halala, j.actual_cost_halala, j.dc1_fee_halala,
              p.name AS provider_name, p.gpu_model
       FROM jobs j
       LEFT JOIN providers p ON p.id = j.provider_id
       WHERE j.id = ? AND j.renter_id = ?`,
      invoiceId,
      renter.id
    );
    if (!row) return res.status(404).json({ error: 'Invoice not found' });

    const durationMinutes = row.actual_duration_minutes || row.duration_minutes || 0;
    const ratePerMinute = COST_RATES[row.job_type] || COST_RATES.default || 10;
    const fallbackCostHalala = Math.max(0, Math.round(durationMinutes * ratePerMinute));
    const amountHalala = row.actual_cost_halala ?? row.cost_halala ?? fallbackCostHalala;
    const feeHalala = row.dc1_fee_halala ?? Math.round(amountHalala * 0.25);

    const headers = [
      'invoice_id',
      'job_id',
      'status',
      'job_type',
      'provider_name',
      'gpu_model',
      'duration_minutes',
      'amount_halala',
      'amount_sar',
      'fee_halala',
      'fee_sar',
      'invoice_at',
    ];
    const values = [
      row.id,
      row.job_id,
      row.status,
      row.job_type,
      row.provider_name || '',
      row.gpu_model || '',
      durationMinutes,
      amountHalala,
      (amountHalala / 100).toFixed(2),
      feeHalala,
      (feeHalala / 100).toFixed(2),
      row.invoice_at || '',
    ];
    const csv = `${headers.join(',')}\n${values.map(csvField).join(',')}\n`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${row.id}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Renter invoice CSV error:', error);
    res.status(500).json({ error: 'Failed to generate invoice CSV' });
  }
});

// GET /api/renters/available-providers
// Public-ish endpoint for renters to see what GPUs are available
router.get('/available-providers', async (req, res) => {
  try {
    const discoveryStatus = getDiscoveryStatus();
    const requestedMode = parseDiscoveryMode(req.query.discovery || req.query.discovery_mode);
    const effectiveMode = requestedMode || discoveryStatus.mode;
    const strictP2pMode = effectiveMode === 'p2p-primary';
    const includeP2p = effectiveMode !== 'sqlite';
    const allowStale = parseBoolLike(req.query.allow_stale);
    const maxAgeMs = toFiniteInt(req.query.max_age_ms, { min: 1, max: 6 * 60 * 60 * 1000 }) || 120000;

    if (strictP2pMode) {
      const resolvedProviders = await listProviders({
        allowStale,
        maxAgeMs,
      });
      return res.json({
        providers: resolvedProviders
          .filter((entry) => entry?.found)
          .map((entry) => buildProviderShapeFromDHTRecord(entry)),
        total: resolvedProviders.filter((entry) => entry?.found).length,
        discovery_mode: effectiveMode,
        discovery_health: {
          mode: discoveryStatus.mode,
          enabled: includeP2p,
          announcement_enabled: discoveryStatus.announcement_enabled,
          bootstrap_configured: discoveryStatus.bootstrap_configured,
        },
      });
    }

    const providers = db.all(
      `SELECT id, name, gpu_model, gpu_name_detected, gpu_vram_mib, gpu_driver,
              gpu_compute_capability, gpu_cuda_version, gpu_count_reported,
              status, location, run_mode, reliability_score, cached_models, last_heartbeat, p2p_peer_id
       FROM providers WHERE status = 'online' AND is_paused = 0
       ORDER BY gpu_vram_mib DESC NULLS LAST`
    );

    let discoveryByPeerId = new Map();
    let discoveryLookupLatencyMs = null;
    let trackedPeerIds = [];
    if (includeP2p) {
      const peerIds = providers
        .map((provider) => normalizeString(provider.p2p_peer_id, { maxLen: 200 }))
        .filter(Boolean);
      trackedPeerIds = peerIds;
      if (peerIds.length > 0) {
        const lookupStartedAt = Date.now();
        const resolvedProviders = await resolveProviders(peerIds, {
          allowStale,
          maxAgeMs,
        });
        discoveryLookupLatencyMs = Date.now() - lookupStartedAt;
        for (const item of resolvedProviders) {
          if (!item?.peer_id) continue;
          discoveryByPeerId.set(String(item.peer_id), item);
        }
      }
    }

    const now = Date.now();
    res.json({
      providers: providers.map((provider) => {
        const discovery = discoveryByPeerId.get(String(provider.p2p_peer_id || ''));
        if (includeP2p && discovery?.found && discovery.provider) {
          return buildProviderShapeFromDHT(provider, discovery, now);
        }
        return buildProviderShapeFromSQLiteRow(provider, now);
      }),
      total: providers.length,
      discovery_mode: effectiveMode,
      discovery_health: {
        mode: discoveryStatus.mode,
        enabled: includeP2p,
        announcement_enabled: discoveryStatus.announcement_enabled,
        bootstrap_configured: discoveryStatus.bootstrap_configured,
        ...(effectiveMode === 'shadow' ? {
          shadow_cycle: buildShadowCycleSummary({
            trackedPeerIds,
            resolvedProviders: Array.from(discoveryByPeerId.values()),
            lookupLatencyMs: discoveryLookupLatencyMs,
          }),
        } : {}),
      },
    });
  } catch (error) {
    console.error('Available providers error:', error);
    res.status(500).json({ error: 'Failed to fetch available providers' });
  }
});

// POST /api/renters/topup — Add balance to renter account
// In production this would be connected to a payment gateway (Stripe/Tap).
// For Gate 1 we accept direct top-up with amount_halala.
router.post('/topup', (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SANDBOX_TOPUP !== 'true') {
      return res.status(403).json({ error: 'Direct top-up disabled in production. Use payment flow.' });
    }

    const key = req.headers['x-renter-key'] || req.query.key;
    if (!key) return res.status(400).json({ error: 'API key required (x-renter-key header or key query)' });

    const renter = db.get('SELECT * FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const { amount_halala, amount_sar } = req.body;
    // Accept either halala or SAR (convert SAR → halala)
    const topupFromHalala = toFiniteInt(amount_halala, { min: 1, max: 100000 });
    const amountSar = toFiniteNumber(amount_sar, { min: 0.01, max: 1000 });
    const topup = topupFromHalala != null
      ? topupFromHalala
      : (amountSar != null ? Math.round(amountSar * 100) : 0);

    if (!topup || topup <= 0) {
      return res.status(400).json({ error: 'Provide amount_halala (int) or amount_sar (float), must be > 0' });
    }

    if (topup > 100000) { // max 1000 SAR per top-up
      return res.status(400).json({ error: 'Max top-up is 1000 SAR (100000 halala) per transaction' });
    }

    const now = new Date().toISOString();
    runStatement(
      `UPDATE renters SET balance_halala = balance_halala + ?, updated_at = ? WHERE id = ?`,
      topup, now, renter.id
    );

    const updated = db.get('SELECT balance_halala FROM renters WHERE id = ?', renter.id);

    res.json({
      success: true,
      topped_up_halala: topup,
      topped_up_sar: topup / 100,
      new_balance_halala: updated.balance_halala,
      new_balance_sar: updated.balance_halala / 100
    });
  } catch (error) {
    console.error('Renter topup error:', error);
    res.status(500).json({ error: 'Top-up failed' });
  }
});

// GET /api/renters/balance — Quick balance check
router.get('/balance', (req, res) => {
  try {
    const key = req.headers['x-renter-key'] || req.query.key;
    if (!key) return res.status(400).json({ error: 'API key required' });

    const renter = db.get('SELECT id, balance_halala, total_spent_halala, total_jobs FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    // Calculate held amount (running jobs estimated cost)
    const held = db.get(
      `SELECT COALESCE(SUM(cost_halala), 0) as held_halala FROM jobs WHERE renter_id = ? AND status = 'running'`,
      renter.id
    );

    res.json({
      balance_halala: renter.balance_halala,
      balance_sar: renter.balance_halala / 100,
      held_halala: held.held_halala,
      held_sar: held.held_halala / 100,
      available_halala: renter.balance_halala,  // held already deducted at submit
      total_spent_halala: renter.total_spent_halala,
      total_spent_sar: renter.total_spent_halala / 100,
      total_jobs: renter.total_jobs
    });
  } catch (error) {
    console.error('Renter balance error:', error);
    res.status(500).json({ error: 'Balance check failed' });
  }
});

// POST /api/renters/login-email — Login with email instead of API key

// --- SUPABASE AUTH OTP (Real Magic Link) ---
const { sendOtp, verifyOtp } = require('../services/auth-otp');

// POST /api/renters/send-otp - Send magic link OTP code via Supabase Auth
router.post('/send-otp', loginEmailLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return res.status(400).json({ error: 'Valid email is required' });

    const result = await sendOtp(cleanEmail);
    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to send verification code' });
    }

    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('Renter OTP send error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// POST /api/renters/verify-otp - Verify OTP code and return API key
router.post('/verify-otp', loginEmailLimiter, async (req, res) => {
  try {
    const { email, token } = req.body;
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return res.status(400).json({ error: 'Valid email is required' });
    if (!token) return res.status(400).json({ error: 'Verification code is required' });

    const otpResult = await verifyOtp(cleanEmail, token);
    if (!otpResult.success) {
      return res.status(401).json({ error: otpResult.error || 'Invalid or expired verification code' });
    }

    // OTP verified via Supabase Auth - now find the renter in SQLite
    let renter = db.get('SELECT * FROM renters WHERE LOWER(email) = LOWER(?) AND status = ?', cleanEmail, 'active');

    if (!renter) {
      const reconciliation = await reconcileRenterByEmailFromSupabase({ db, email: cleanEmail });
      if (reconciliation.reconciled && reconciliation.renter && reconciliation.renter.status === 'active') {
        renter = reconciliation.renter;
      }
    }

    if (!renter) {
      return res.status(404).json({ error: 'No renter account found with this email. Register first at /renter/register' });
    }

    res.json({
      success: true,
      api_key: renter.api_key,
      renter: {
        id: renter.id,
        name: renter.name,
        email: renter.email,
        organization: renter.organization,
        balance_halala: renter.balance_halala,
        total_spent_halala: renter.total_spent_halala,
        total_jobs: renter.total_jobs,
      }
    });
  } catch (error) {
    console.error('Renter OTP verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/login-email', loginEmailLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return res.status(400).json({ error: 'Valid email is required' });

    let renter = db.get('SELECT * FROM renters WHERE email = ? AND status = ?', cleanEmail, 'active');
    if (!renter) {
      // Also try case-insensitive
      renter = db.get('SELECT * FROM renters WHERE LOWER(email) = LOWER(?) AND status = ?', cleanEmail, 'active');
    }

    // Runtime self-heal for Supabase-origin renters missing in SQLite.
    if (!renter) {
      const reconciliation = await reconcileRenterByEmailFromSupabase({ db, email: cleanEmail });
      if (reconciliation.reconciled && reconciliation.renter?.status === 'active') {
        renter = reconciliation.renter;
      }
    }

    if (!renter) {
      return res.status(404).json({ error: 'No renter account found with this email. Register first at /renter/register' });
    }

    res.json({
      success: true,
      api_key: renter.api_key,
      renter: {
        id: renter.id,
        name: renter.name,
        email: renter.email,
        organization: renter.organization,
        balance_halala: renter.balance_halala,
        total_spent_halala: renter.total_spent_halala,
        total_jobs: renter.total_jobs,
      }
    });
  } catch (error) {
    console.error('Renter email login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/renters/me/rotate-key — Rotate API key (renter self-service)
// Backwards-compatible alias retained: /api/renters/rotate-key
router.post(['/me/rotate-key', '/rotate-key'], (req, res) => {
  try {
    const key = req.headers['x-renter-key'] || req.query.key;
    if (!key) return res.status(400).json({ error: 'Current API key required (x-renter-key header or key query)' });

    const renter = db.get('SELECT * FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    if (isRotationRateLimited('renter', renter.id)) {
      return res.status(429).json({ error: 'Rate limit exceeded: max 3 key rotations per 24 hours' });
    }

    const newKey = `dc1-renter-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    runStatement(
      'UPDATE renters SET api_key = ?, rotated_at = ?, updated_at = ? WHERE id = ?',
      newKey,
      nowIso,
      nowIso,
      renter.id
    );
    recordRotationEvent('renter', renter.id, nowIso);

    res.json({
      success: true,
      message: 'API key rotated. Save the new key — the old one is now invalid.',
      new_key: newKey,
      api_key: newKey,
      renter_id: renter.id
    });
  } catch (error) {
    console.error('Renter key rotation error:', error);
    res.status(500).json({ error: 'Key rotation failed' });
  }
});

// ─── SCOPED API KEY MANAGEMENT — Sprint 25 Gap 2 ─────────────────────────────
// Master key (renters.api_key) always has full access.
// Sub-keys in renter_api_keys have explicit scope grants.
// Valid scopes: "inference" (submit vLLM jobs), "billing" (view balance), "admin" (all)
const VALID_KEY_SCOPES = new Set(['inference', 'billing', 'admin']);
const MAX_SCOPED_KEYS_PER_RENTER = 20;

// POST /api/renters/me/keys — create a scoped sub-key
router.post('/me/keys', (req, res) => {
  try {
    const masterKey = req.headers['x-renter-key'] || req.query.key;
    if (!masterKey) return res.status(401).json({ error: 'Master API key required' });
    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', masterKey, 'active');
    if (!renter) return res.status(403).json({ error: 'Invalid or inactive master API key' });

    const rawScopes = req.body?.scopes;
    const scopes = Array.isArray(rawScopes) ? rawScopes.filter(s => VALID_KEY_SCOPES.has(s)) : ['inference'];
    if (scopes.length === 0) {
      return res.status(400).json({ error: `Invalid scopes. Valid values: ${[...VALID_KEY_SCOPES].join(', ')}` });
    }

    const label = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 80) : null;
    const rawExpiry = req.body?.expires_at;
    const expiresAt = rawExpiry && !isNaN(Date.parse(rawExpiry)) ? new Date(rawExpiry).toISOString() : null;

    const activeCount = db.get(
      'SELECT COUNT(*) AS c FROM renter_api_keys WHERE renter_id = ? AND revoked_at IS NULL',
      renter.id
    );
    if (Number(activeCount?.c || 0) >= MAX_SCOPED_KEYS_PER_RENTER) {
      return res.status(429).json({ error: `Maximum ${MAX_SCOPED_KEYS_PER_RENTER} active sub-keys per account` });
    }

    const id = crypto.randomUUID();
    const key = `dc1-sk-${crypto.randomBytes(20).toString('hex')}`;
    const now = new Date().toISOString();
    runStatement(
      'INSERT INTO renter_api_keys (id, renter_id, key, label, scopes, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, renter.id, key, label, JSON.stringify(scopes), expiresAt, now
    );

    return res.status(201).json({ id, key, label, scopes, expires_at: expiresAt, created_at: now });
  } catch (error) {
    console.error('Scoped key create error:', error);
    return res.status(500).json({ error: 'Failed to create API key' });
  }
});

// GET /api/renters/me/keys — list active scoped sub-keys
router.get('/me/keys', (req, res) => {
  try {
    const masterKey = req.headers['x-renter-key'] || req.query.key;
    if (!masterKey) return res.status(401).json({ error: 'Master API key required' });
    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', masterKey, 'active');
    if (!renter) return res.status(403).json({ error: 'Invalid or inactive master API key' });

    const keys = db.all(
      `SELECT id, label, scopes, expires_at, last_used_at, created_at,
              CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END AS revoked
       FROM renter_api_keys
       WHERE renter_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      renter.id
    ).map(k => ({
      id: k.id,
      label: k.label,
      scopes: (() => { try { return JSON.parse(k.scopes); } catch (_) { return []; } })(),
      expires_at: k.expires_at,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
      revoked: Boolean(k.revoked),
    }));

    return res.json({ keys });
  } catch (error) {
    console.error('Scoped key list error:', error);
    return res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// DELETE /api/renters/me/keys/:keyId — revoke a scoped sub-key
router.delete('/me/keys/:keyId', (req, res) => {
  try {
    const masterKey = req.headers['x-renter-key'] || req.query.key;
    if (!masterKey) return res.status(401).json({ error: 'Master API key required' });
    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', masterKey, 'active');
    if (!renter) return res.status(403).json({ error: 'Invalid or inactive master API key' });

    const keyId = req.params.keyId;
    if (!keyId) return res.status(400).json({ error: 'Key ID required' });

    const now = new Date().toISOString();
    const result = runStatement(
      'UPDATE renter_api_keys SET revoked_at = ? WHERE id = ? AND renter_id = ? AND revoked_at IS NULL',
      now, keyId, renter.id
    );
    if ((result?.changes || 0) === 0) {
      return res.status(404).json({ error: 'Key not found or already revoked' });
    }
    return res.json({ success: true, revoked_at: now });
  } catch (error) {
    console.error('Scoped key revoke error:', error);
    return res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// GET /api/renters/me/data-export — PDPL right to access/export
// Alias kept for backwards compatibility: /api/renters/me/export
router.get(['/me/data-export', '/me/export'], renterDataExportLimiter, (req, res) => {
  try {
    const key = req.headers['x-renter-key'] || req.query.key;
    if (!key) return res.status(400).json({ error: 'API key required (x-renter-key header or key query)' });

    const renter = db.get(
      `SELECT id, name, email, organization, status, balance_halala, total_spent_halala, total_jobs, created_at, updated_at
       FROM renters WHERE api_key = ?`,
      key
    );
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const jobs = db.all(
      `SELECT id, job_id, job_type, status, model, provider_id,
              cost_halala, actual_cost_halala, duration_minutes, actual_duration_minutes,
              submitted_at, started_at, completed_at, created_at, updated_at,
              container_spec, gpu_requirements, notes
       FROM jobs
       WHERE renter_id = ?
       ORDER BY COALESCE(completed_at, submitted_at, created_at) DESC`,
      renter.id
    );

    const payments = db.all(
      `SELECT payment_id, amount_sar, amount_halala, status, source_type, description,
              created_at, confirmed_at, refunded_at, refund_amount_halala
       FROM payments
       WHERE renter_id = ?
       ORDER BY created_at DESC`,
      renter.id
    );

    const analytics = {
      status_counts: db.all(
        `SELECT status, COUNT(*) AS count
         FROM jobs
         WHERE renter_id = ?
         GROUP BY status
         ORDER BY count DESC`,
        renter.id
      ),
      daily_spend_last_30d: db.all(
        `SELECT DATE(COALESCE(completed_at, submitted_at, created_at)) AS day,
                COALESCE(SUM(COALESCE(actual_cost_halala, cost_halala, 0)), 0) AS total_halala,
                COUNT(*) AS job_count
         FROM jobs
         WHERE renter_id = ?
           AND DATE(COALESCE(completed_at, submitted_at, created_at)) >= DATE('now', '-30 day')
         GROUP BY DATE(COALESCE(completed_at, submitted_at, created_at))
         ORDER BY day DESC`,
        renter.id
      ),
      top_gpus: db.all(
        `SELECT COALESCE(p.gpu_model, 'Unknown GPU') AS gpu_model, COUNT(*) AS job_count
         FROM jobs j
         LEFT JOIN providers p ON p.id = j.provider_id
         WHERE j.renter_id = ?
         GROUP BY COALESCE(p.gpu_model, 'Unknown GPU')
         ORDER BY job_count DESC
         LIMIT 10`,
        renter.id
      ),
    };

    const nowIso = new Date().toISOString();
    runStatement(
      `INSERT INTO pdpl_request_log (account_type, account_id, request_type, requested_at, metadata_json)
       VALUES ('renter', ?, 'export', ?, ?)`,
      renter.id,
      nowIso,
      JSON.stringify({ mode: 'direct_json', endpoint: '/api/renters/me/export' })
    );

    sendDataExportReady(renter.email, {
      accountType: 'renter',
      requestedAt: nowIso,
      deliveryMode: 'direct',
    }).catch((e) => console.error('[renters.export] data export email failed:', e.message));

    return res.json({
      exported_at: nowIso,
      account: {
        id: renter.id,
        name: renter.name,
        email: renter.email,
        organization: renter.organization,
        status: renter.status,
        created_at: renter.created_at,
        updated_at: renter.updated_at || null,
        balance_halala: renter.balance_halala,
        total_spent_halala: renter.total_spent_halala,
        total_jobs: renter.total_jobs,
      },
      jobs,
      payments,
      withdrawals: [],
      analytics,
    });
  } catch (error) {
    console.error('Renter export error:', error);
    return res.status(500).json({ error: 'Failed to export renter data' });
  }
});

// DELETE /api/renters/me — PDPL right to erasure
// Soft-deletes and anonymizes renter account (audit trail preserved).
// Auth: x-renter-key header or key query param.
router.delete('/me', renterAccountDeletionLimiter, (req, res) => {
  try {
    const key = req.headers['x-renter-key'] || req.query.key;
    if (!key) return res.status(400).json({ error: 'API key required (x-renter-key header or key query)' });

    const renter = db.get('SELECT id, status, email FROM renters WHERE api_key = ?', key);
    if (!renter) return res.status(404).json({ error: 'Renter not found' });
    if (renter.status === 'deleted') return res.status(410).json({ error: 'Account already deleted' });

    const now = new Date().toISOString();
    const deletionScheduledFor = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString();
    const anonymizedEmail = hashedDeletedEmail(renter.email, renter.id);
    const tombstoneApiKey = `deleted-renter-${renter.id}-${crypto.randomUUID()}`;

    const cancelledJobs = runStatement(
      `UPDATE jobs SET
         status = 'cancelled',
         error = COALESCE(error, 'Cancelled: renter account deleted by PDPL request'),
         completed_at = COALESCE(completed_at, ?),
         updated_at = ?
       WHERE renter_id = ?
         AND status IN ('queued', 'pending', 'running', 'paused')`,
      now,
      now,
      renter.id
    );

    // Keep operational/audit records but remove renter-auth linkage.
    runStatement(
      `UPDATE jobs SET
         model = NULL,
         task_spec = NULL,
         updated_at = ?
       WHERE renter_id = ?`,
      now,
      renter.id
    );

    // Remove linkage from escrow holds that store renter API key.
    runStatement(
      `UPDATE escrow_holds SET renter_api_key = ? WHERE renter_api_key = ?`,
      `deleted-renter-${renter.id}`,
      key
    );

    // Remove user-generated templates/prompts and mutable quota rows.
    runStatement('DELETE FROM job_templates WHERE renter_id = ?', renter.id);
    runStatement('DELETE FROM renter_quota WHERE renter_id = ?', renter.id);
    runStatement('DELETE FROM quota_log WHERE renter_id = ?', renter.id);

    const updated = runStatement(
      `UPDATE renters SET
         name = '[deleted]',
         email = ?,
         organization = NULL,
         webhook_url = NULL,
         status = 'deleted',
         deleted_at = ?,
         deletion_scheduled_for = ?,
         api_key = ?,
         updated_at = ?
       WHERE id = ?`,
      anonymizedEmail,
      now,
      deletionScheduledFor,
      tombstoneApiKey,
      now,
      renter.id
    );
    if (!updated.changes) return res.status(500).json({ error: 'Account deletion failed' });

    runStatement(
      `INSERT INTO pdpl_request_log (account_type, account_id, request_type, requested_at, metadata_json)
       VALUES ('renter', ?, 'delete', ?, ?)`,
      renter.id,
      now,
      JSON.stringify({ cancelled_jobs: cancelledJobs.changes || 0, deletion_scheduled_for: deletionScheduledFor })
    );

    return res.status(200).json({
      cancelled_jobs: cancelledJobs.changes || 0,
      deletion_scheduled_for: deletionScheduledFor,
      message: 'Account scheduled for deletion in 30 days. Contact support to cancel.',
    });
  } catch (error) {
    console.error('Renter delete error:', error);
    return res.status(500).json({ error: 'Account deletion failed' });
  }
});

// GET /api/renters/me/jobs/export?key=&format=csv&from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&status=
router.get('/me/jobs/export', (req, res) => {
  try {
    const { key, from_date, to_date, status: statusFilter } = req.query;
    if (!key) return res.status(400).json({ error: 'API key required' });

    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const conditions = ['j.renter_id = ?'];
    const params = [renter.id];

    if (from_date && /^\d{4}-\d{2}-\d{2}$/.test(from_date)) {
      conditions.push("DATE(COALESCE(j.submitted_at, j.created_at)) >= ?");
      params.push(from_date);
    }
    if (to_date && /^\d{4}-\d{2}-\d{2}$/.test(to_date)) {
      conditions.push("DATE(COALESCE(j.submitted_at, j.created_at)) <= ?");
      params.push(to_date);
    }
    if (statusFilter && ['completed', 'failed', 'running', 'pending'].includes(statusFilter)) {
      conditions.push('j.status = ?');
      params.push(statusFilter);
    }

    const rows = db.all(
      `SELECT j.id, j.job_id, j.job_type, j.status,
              j.actual_cost_halala, j.cost_halala,
              j.provider_id, j.submitted_at, j.completed_at
       FROM jobs j
       WHERE ${conditions.join(' AND ')}
       ORDER BY COALESCE(j.submitted_at, j.created_at) DESC
       LIMIT 1000`,
      ...params
    );

    const headers = ['job_id', 'model', 'status', 'cost_halala', 'cost_sar', 'provider_id', 'started_at', 'completed_at', 'duration_seconds'];
    const csvRows = rows.map(r => {
      const costHalala = r.actual_cost_halala ?? r.cost_halala ?? 0;
      const startedAt = r.submitted_at || '';
      const completedAt = r.completed_at || '';
      const durationSec = (startedAt && completedAt)
        ? Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000)
        : '';
      return [
        r.job_id || r.id,
        r.job_type || '',
        r.status || '',
        costHalala,
        (costHalala / 100).toFixed(2),
        r.provider_id || '',
        startedAt,
        completedAt,
        durationSec,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...csvRows].join('\r\n');
    const today = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=dcp-jobs-${today}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Renter CSV export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ─── JOB TEMPLATES ─── (DCP-304)

// GET /api/renters/me/templates?key=
router.get('/me/templates', (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'API key required' });
    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });
    const templates = db.all(
      'SELECT id, name, job_type, model, system_prompt, max_tokens, resource_spec_json, created_at FROM job_templates WHERE renter_id = ? ORDER BY created_at DESC',
      renter.id
    );
    res.json({ templates });
  } catch (error) {
    console.error('Template list error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/renters/me/templates?key=
router.post('/me/templates', (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'API key required' });
    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const { name, job_type, model, system_prompt, max_tokens, resource_spec_json } = req.body;
    const cleanName = normalizeString(name, { maxLen: 120 });
    const cleanJobType = normalizeString(job_type, { maxLen: 60 });
    const cleanModel = normalizeString(model, { maxLen: 200 });
    if (!cleanName || !cleanJobType || !cleanModel) {
      return res.status(400).json({ error: 'name, job_type and model are required' });
    }

    // Cap templates per renter at 50
    const count = db.get('SELECT COUNT(*) AS n FROM job_templates WHERE renter_id = ?', renter.id);
    if (count && count.n >= 50) {
      return res.status(409).json({ error: 'Template limit reached (50). Delete one to save more.' });
    }

    const now = new Date().toISOString();
    const result = runStatement(
      `INSERT INTO job_templates (renter_id, name, job_type, model, system_prompt, max_tokens, resource_spec_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      renter.id, cleanName, cleanJobType, cleanModel,
      normalizeString(system_prompt, { maxLen: 2000 }) || null,
      toFiniteInt(max_tokens, { min: 1, max: 4096 }) || null,
      normalizeString(resource_spec_json, { maxLen: 2000 }) || null,
      now
    );
    res.status(201).json({ success: true, template_id: result.lastInsertRowid });
  } catch (error) {
    console.error('Template save error:', error);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

// DELETE /api/renters/me/templates/:id?key=
router.delete('/me/templates/:id', (req, res) => {
  try {
    const { key } = req.query;
    const { id } = req.params;
    if (!key) return res.status(400).json({ error: 'API key required' });
    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });
    const templateId = toFiniteInt(id, { min: 1 });
    if (!templateId) return res.status(400).json({ error: 'Invalid template ID' });
    const result = runStatement(
      'DELETE FROM job_templates WHERE id = ? AND renter_id = ?',
      templateId, renter.id
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Template delete error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// GET /api/renters/me/analytics?key=API_KEY&period=30d
router.get('/me/analytics', (req, res) => {
  try {
    const { key, period = '30d' } = req.query;
    if (!key) return res.status(400).json({ error: 'API key required' });

    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Daily spend for the period
    const dailySpend = db.all(
      `SELECT date(submitted_at) AS day,
              COALESCE(SUM(cost_halala), 0) AS total_halala,
              COUNT(*) AS job_count
       FROM jobs
       WHERE renter_id = ? AND submitted_at >= ?
       GROUP BY date(submitted_at)
       ORDER BY day ASC`,
      renter.id, cutoff
    );

    // Job counts by status (all time)
    const statusCounts = db.all(
      `SELECT status, COUNT(*) AS count
       FROM jobs
       WHERE renter_id = ?
       GROUP BY status`,
      renter.id
    );

    // Average job duration (completed jobs only)
    const durationRow = db.get(
      `SELECT ROUND(AVG(duration_minutes), 1) AS avg_duration,
              COUNT(*) AS completed_count
       FROM jobs
       WHERE renter_id = ? AND status = 'completed' AND duration_minutes IS NOT NULL`,
      renter.id
    );

    // Top GPU models used
    const topGpus = db.all(
      `SELECT p.gpu_model,
              COUNT(j.id) AS job_count,
              COALESCE(SUM(j.cost_halala), 0) AS total_halala
       FROM jobs j
       JOIN providers p ON j.provider_id = p.id
       WHERE j.renter_id = ? AND p.gpu_model IS NOT NULL
       GROUP BY p.gpu_model
       ORDER BY job_count DESC
       LIMIT 5`,
      renter.id
    );

    res.json({
      period: `${days}d`,
      daily_spend: dailySpend,
      status_counts: statusCounts,
      avg_duration_minutes: durationRow?.avg_duration ?? null,
      completed_job_count: durationRow?.completed_count ?? 0,
      top_gpus: topGpus,
    });
  } catch (error) {
    console.error('Renter analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
