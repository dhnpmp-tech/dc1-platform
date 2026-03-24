'use strict';

/**
 * Settlement API Routes — DCP-745
 *
 * Provider earnings ledger and renter billing history.
 * All monetary values are returned in both halala (integer) and SAR (decimal).
 *
 * Auth model mirrors the rest of the backend:
 *   - Providers authenticate with X-Provider-Key header or `key` query param
 *   - Renters authenticate with X-Renter-Key header or `key` query param
 *   - Admin endpoints require DC1_ADMIN_TOKEN (Bearer or X-Admin-Token header)
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const {
  recordSettlement,
  getProviderEarnings,
  getRenterTransactions,
} = require('../services/settlementService');
const { isAdminRequest } = require('../middleware/auth');

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getProvider(req) {
  const key = req.headers['x-provider-key'] || req.query.key;
  if (!key) return null;
  return db.get('SELECT * FROM providers WHERE api_key = ? AND deleted_at IS NULL', key);
}

function getRenter(req) {
  const key = req.headers['x-renter-key'] || req.query.key;
  if (!key) return null;
  return db.get('SELECT * FROM renters WHERE api_key = ? AND status = ?', key, 'active');
}

// ── GET /api/settlement/providers/:providerId/earnings ────────────────────────
//
// Returns aggregate + paginated settlement history for a provider.
// Auth: provider's own api key OR admin token.
//
// Query params:
//   since    ISO datetime lower bound
//   until    ISO datetime upper bound
//   limit    max rows (default 50, max 200)
//   offset   pagination offset (default 0)
router.get('/providers/:providerId/earnings', (req, res) => {
  const { providerId } = req.params;

  const provider = db.get(
    'SELECT id, name, total_earnings_halala, claimable_earnings_halala FROM providers WHERE id = ?',
    providerId
  );
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  // Auth: must be this provider or admin
  if (!isAdminRequest(req)) {
    const caller = getProvider(req);
    if (!caller || String(caller.id) !== String(provider.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const { since, until, limit, offset } = req.query;
  const result = getProviderEarnings(db._db || db, provider.id, { since, until, limit, offset });

  return res.json({
    providerId: provider.id,
    providerName: provider.name,
    // Live balance from providers table (authoritative)
    claimableEarningsHalala: provider.claimable_earnings_halala || 0,
    claimableEarningsSar: Number(((provider.claimable_earnings_halala || 0) / 100).toFixed(2)),
    // Ledger-based analytics
    ledger: result,
  });
});

// ── GET /api/settlement/providers/:providerId/earnings/history ────────────────
//
// Paginated raw settlement rows for a provider (alias for the ledger sub-object).
router.get('/providers/:providerId/earnings/history', (req, res) => {
  const { providerId } = req.params;

  const provider = db.get('SELECT id FROM providers WHERE id = ?', providerId);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  if (!isAdminRequest(req)) {
    const caller = getProvider(req);
    if (!caller || String(caller.id) !== String(provider.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const { since, until, limit, offset } = req.query;
  const result = getProviderEarnings(db._db || db, provider.id, { since, until, limit, offset });
  return res.json(result);
});

// ── GET /api/settlement/renters/:renterId/balance ────────────────────────────
//
// Current renter balance + lifetime spend summary.
// Auth: renter's own api key OR admin token.
router.get('/renters/:renterId/balance', (req, res) => {
  const { renterId } = req.params;

  const renter = db.get(
    'SELECT id, name, email, balance_halala, total_spent_halala FROM renters WHERE id = ?',
    renterId
  );
  if (!renter) return res.status(404).json({ error: 'Renter not found' });

  if (!isAdminRequest(req)) {
    const caller = getRenter(req);
    if (!caller || String(caller.id) !== String(renter.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  return res.json({
    renterId: renter.id,
    renterName: renter.name,
    balanceHalala: renter.balance_halala || 0,
    balanceSar: Number(((renter.balance_halala || 0) / 100).toFixed(2)),
    totalSpentHalala: renter.total_spent_halala || 0,
    totalSpentSar: Number(((renter.total_spent_halala || 0) / 100).toFixed(2)),
  });
});

// ── GET /api/settlement/renters/:renterId/transactions ────────────────────────
//
// Paginated settlement ledger for a renter (charged jobs).
// Query params: limit, offset
router.get('/renters/:renterId/transactions', (req, res) => {
  const { renterId } = req.params;

  const renter = db.get('SELECT id FROM renters WHERE id = ?', renterId);
  if (!renter) return res.status(404).json({ error: 'Renter not found' });

  if (!isAdminRequest(req)) {
    const caller = getRenter(req);
    if (!caller || String(caller.id) !== String(renter.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const { limit, offset } = req.query;
  const result = getRenterTransactions(db._db || db, renter.id, { limit, offset });
  return res.json(result);
});

// ── POST /api/settlement/jobs/:jobId/settle (admin) ───────────────────────────
//
// Manually trigger settlement recording for a completed job.
// Normally settlement is triggered automatically by the job result endpoint
// in providers.js, but this admin endpoint allows backfilling / re-processing.
//
// Body: { status: "completed"|"failed"|"refunded" }
router.post('/jobs/:jobId/settle', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: 'Admin token required' });
  }

  const { jobId } = req.params;
  const job = db.get('SELECT * FROM jobs WHERE job_id = ? OR id = ?', jobId, jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const status = req.body?.status || (job.status === 'completed' ? 'completed' : 'failed');
  if (!['completed', 'failed', 'refunded'].includes(status)) {
    return res.status(400).json({ error: 'status must be completed, failed, or refunded' });
  }

  const durationSeconds = job.actual_duration_minutes
    ? job.actual_duration_minutes * 60
    : (job.duration_minutes ? job.duration_minutes * 60 : 0);

  const settlement = recordSettlement(db._db || db, {
    jobId: job.job_id,
    providerId: job.provider_id,
    renterId: job.renter_id,
    durationSeconds,
    jobType: job.job_type || 'default',
    status,
  });

  return res.json({ settlement });
});

module.exports = router;
