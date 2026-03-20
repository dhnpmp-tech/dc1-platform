const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../db');
const { COST_RATES } = require('./jobs');
const { sendWelcomeEmail } = require('../services/email');

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

const ROTATION_WINDOW_MS = 60 * 60 * 1000;
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

// POST /api/renters/register
router.post('/register', (req, res) => {
  try {
    const { name, email, organization } = req.body;
    const cleanName = normalizeString(name, { maxLen: 120 });
    const cleanEmail = normalizeEmail(email);
    const cleanOrg = normalizeString(organization, { maxLen: 160 });

    if (!cleanName || !cleanEmail) {
      return res.status(400).json({ error: 'Missing required fields: name, email' });
    }

    const api_key = 'dc1-renter-' + crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();

    const result = runStatement(
      `INSERT INTO renters (name, email, api_key, organization, status, balance_halala, created_at)
       VALUES (?, ?, ?, ?, 'active', 1000, ?)`,
      cleanName, cleanEmail, api_key, cleanOrg || null, now
    );

    res.status(201).json({
      success: true,
      renter_id: result.lastInsertRowid,
      api_key,
      message: `Welcome ${cleanName}! Save your API key — it won't be shown again.`
    });

    // Fire-and-forget welcome email — does not affect registration response
    sendWelcomeEmail('renter', { name: cleanName, email: cleanEmail, apiKey: api_key });
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
    const { key } = req.query;
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

// GET /api/renters/me/invoices?key=API_KEY&page=1&per_page=20
router.get('/me/invoices', (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'API key required' });

    const renter = db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const pageRaw = Number.parseInt(req.query.page, 10);
    const perPageRaw = Number.parseInt(req.query.per_page, 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const per_page = Number.isFinite(perPageRaw) && perPageRaw > 0 ? Math.min(perPageRaw, 100) : 20;
    const offset = (page - 1) * per_page;

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
              j.duration_minutes, j.actual_duration_minutes,
              j.cost_halala, j.actual_cost_halala, j.dc1_fee_halala,
              p.name as provider_name, p.gpu_model
       FROM jobs j
       LEFT JOIN providers p ON p.id = j.provider_id
       WHERE j.renter_id = ?
       ORDER BY COALESCE(j.completed_at, j.submitted_at, j.created_at) DESC
       LIMIT ? OFFSET ?`,
      renter.id, per_page, offset
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
        provider_name: row.provider_name || null,
        gpu_model: row.gpu_model || null,
        job_type: row.job_type,
        duration_minutes: durationMinutes,
        price_sar: Number((totalHalala / 100).toFixed(2)),
        fee_sar: Number((feeHalala / 100).toFixed(3)),
        total_sar: Number((totalHalala / 100).toFixed(2)),
        status: row.status,
        created_at: row.created_at
      };
    });

    res.json({
      invoices,
      total_spent_sar: Number(((totalSpentRow.total_spent_halala || 0) / 100).toFixed(2)),
      pagination: {
        page,
        per_page,
        total: totalRow.total || 0
      }
    });
  } catch (error) {
    console.error('Renter invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch renter invoices' });
  }
});

// GET /api/renters/available-providers
// Public-ish endpoint for renters to see what GPUs are available
router.get('/available-providers', (req, res) => {
  try {
    const providers = db.all(
      `SELECT id, name, gpu_model, gpu_name_detected, gpu_vram_mib, gpu_driver,
              gpu_compute_capability, gpu_cuda_version, gpu_count_reported,
              status, location, run_mode, reliability_score, cached_models, last_heartbeat
       FROM providers WHERE status = 'online' AND is_paused = 0
       ORDER BY gpu_vram_mib DESC NULLS LAST`
    );

    const now = Date.now();
    res.json({
      providers: providers.map(p => {
        let parsedCachedModels = [];
        if (p.cached_models) {
          try { parsedCachedModels = JSON.parse(p.cached_models); } catch {}
        }
        const heartbeatAge = p.last_heartbeat
          ? Math.floor((now - new Date(p.last_heartbeat).getTime()) / 1000)
          : null;

        return {
          id: p.id,
          name: p.name,
          gpu_model: p.gpu_name_detected || p.gpu_model,
          vram_gb: p.gpu_vram_mib ? Math.round(p.gpu_vram_mib / 1024) : null,
          vram_mib: p.gpu_vram_mib,
          gpu_count: p.gpu_count_reported || 1,
          driver_version: p.gpu_driver,
          compute_capability: p.gpu_compute_capability,
          cuda_version: p.gpu_cuda_version,
          status: p.status,
          is_live: heartbeatAge !== null && heartbeatAge < 120,
          location: p.location,
          reliability_score: p.reliability_score,
          cached_models: parsedCachedModels
        };
      }),
      total: providers.length
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
router.post('/login-email', loginEmailLimiter, (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return res.status(400).json({ error: 'Valid email is required' });

    const renter = db.get('SELECT * FROM renters WHERE email = ? AND status = ?', cleanEmail, 'active');
    if (!renter) {
      // Also try case-insensitive
      const renterCI = db.get('SELECT * FROM renters WHERE LOWER(email) = LOWER(?) AND status = ?', cleanEmail, 'active');
      if (!renterCI) {
        return res.status(404).json({ error: 'No renter account found with this email. Register first at /renter/register' });
      }
      return res.json({
        success: true,
        message: 'Account found. Log in via your dashboard to retrieve your key.'
      });
    }

    res.json({
      success: true,
      message: 'Account found. Log in via your dashboard to retrieve your key.'
    });
  } catch (error) {
    console.error('Renter email login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/renters/rotate-key — Rotate API key (renter self-service)
router.post('/rotate-key', (req, res) => {
  try {
    const key = req.headers['x-renter-key'] || req.query.key;
    if (!key) return res.status(400).json({ error: 'Current API key required (x-renter-key header or key query)' });

    const renter = db.get('SELECT * FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    if (isRotationRateLimited('renter', renter.id)) {
      return res.status(429).json({ error: 'Rate limit exceeded: max 3 key rotations per hour' });
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

// DELETE /api/renters/me — PDPL right to erasure (soft delete)
// Anonymizes PII while preserving job records for financial audit trail.
// Auth: x-renter-key header or key query param
router.delete('/me', (req, res) => {
  try {
    const key = req.headers['x-renter-key'] || req.query.key;
    if (!key) return res.status(400).json({ error: 'API key required (x-renter-key header or key query)' });

    const renter = db.get('SELECT id, status FROM renters WHERE api_key = ?', key);
    if (!renter) return res.status(404).json({ error: 'Renter not found' });
    if (renter.status === 'deleted') return res.status(410).json({ error: 'Account already deleted' });

    const now = new Date().toISOString();
    const anonId = 'deleted-' + renter.id;

    // Soft delete: anonymize PII, invalidate key, mark deleted
    runStatement(
      `UPDATE renters SET
         name         = ?,
         email        = ?,
         organization = NULL,
         api_key      = ?,
         status       = 'deleted',
         updated_at   = ?
       WHERE id = ?`,
      anonId,
      anonId + '@deleted.invalid',
      'revoked-' + crypto.randomBytes(8).toString('hex'),
      now,
      renter.id
    );

    // Job and payment records are retained with renter_id for financial audit (SAMA 7-year req)
    console.log(`[pdpl] Renter ${renter.id} account deleted and PII anonymized`);

    res.json({
      success: true,
      message: 'Your account has been deleted and personal data anonymized in accordance with PDPL. Financial records are retained for 7 years as required by SAMA regulations.',
      deleted_at: now,
    });
  } catch (error) {
    console.error('Renter delete error:', error);
    res.status(500).json({ error: 'Account deletion failed' });
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

module.exports = router;
