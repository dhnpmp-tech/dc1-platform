'use strict';

/**
 * Payout Routes — DCP-763
 *
 * Off-chain payout request queue for provider earnings withdrawal.
 * DCP admin processes payouts manually via bank transfer.
 *
 * Routes (mounted at /api):
 *   POST  /providers/:id/payouts   — request payout (provider auth)
 *   GET   /providers/:id/payouts   — payout history (provider auth)
 *   GET   /providers/:id/earnings  — balance summary (provider auth)
 *   PATCH /admin/payouts/:id       — mark paid or reject (admin token)
 *
 * Provider auth: x-provider-key header, ?key query param, or Bearer dcp_prov_* token.
 * Admin auth: DC1_ADMIN_TOKEN via X-Admin-Token header or Bearer token.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdminAuth, getBearerToken } = require('../middleware/auth');
const { requireAdminRbac } = require('../middleware/adminAuth');
const { verifyProviderKey } = require('../services/apiKeyService');
const {
  requestPayout,
  getPayoutHistory,
  getEarningsSummary,
  markPayoutPaid,
  rejectPayout,
} = require('../services/payoutService');

// ── Auth helper ───────────────────────────────────────────────────────────────

/**
 * Resolve the authenticated provider from the request.
 *
 * Accepts (in priority order):
 *   1. Bearer dcp_prov_* token  (new hashed API keys — DCP-760)
 *   2. X-Provider-Key header    (legacy plain api_key)
 *   3. ?key query parameter     (legacy plain api_key)
 */
function resolveProvider(req) {
  const bearer = getBearerToken(req);
  if (bearer && bearer.startsWith('dcp_prov_')) {
    const providerId = verifyProviderKey(bearer);
    if (!providerId) return null;
    return db.get('SELECT * FROM providers WHERE id = ? AND deleted_at IS NULL', [providerId]);
  }

  const legacyKey = req.headers['x-provider-key'] || req.query.key;
  if (!legacyKey) return null;
  return db.get('SELECT * FROM providers WHERE api_key = ? AND deleted_at IS NULL', [legacyKey]);
}

// ── POST /api/providers/:id/payouts ──────────────────────────────────────────
router.post('/providers/:id/payouts', (req, res) => {
  try {
    const provider = resolveProvider(req);
    if (!provider) {
      return res.status(401).json({ error: 'Provider authentication required' });
    }
    if (String(provider.id) !== String(req.params.id)) {
      return res.status(403).json({ error: 'Forbidden: cannot request payout for another provider' });
    }

    const amountUsd = parseFloat(req.body.amount_usd);
    if (!isFinite(amountUsd)) {
      return res.status(400).json({ error: 'amount_usd is required and must be a positive number' });
    }

    const result = requestPayout(db._db || db, provider.id, amountUsd);

    if (result.error) {
      const statusMap = {
        INVALID_AMOUNT:       400,
        BELOW_MINIMUM:        400,
        PROVIDER_NOT_FOUND:   404,
        INSUFFICIENT_BALANCE: 402,
      };
      return res.status(statusMap[result.error] || 400).json(result);
    }

    return res.status(201).json(result);
  } catch (err) {
    console.error('[payouts] POST /providers/:id/payouts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/providers/:id/payouts ───────────────────────────────────────────
router.get('/providers/:id/payouts', (req, res) => {
  try {
    const provider = resolveProvider(req);
    if (!provider) {
      return res.status(401).json({ error: 'Provider authentication required' });
    }
    if (String(provider.id) !== String(req.params.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { limit, offset } = req.query;
    const result = getPayoutHistory(db._db || db, provider.id, { limit, offset });
    return res.json(result);
  } catch (err) {
    console.error('[payouts] GET /providers/:id/payouts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/providers/:id/earnings ──────────────────────────────────────────
router.get('/providers/:id/earnings', (req, res) => {
  try {
    const provider = resolveProvider(req);
    if (!provider) {
      return res.status(401).json({ error: 'Provider authentication required' });
    }
    if (String(provider.id) !== String(req.params.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const summary = getEarningsSummary(db._db || db, provider.id);
    if (!summary) return res.status(404).json({ error: 'Provider not found' });
    return res.json(summary);
  } catch (err) {
    console.error('[payouts] GET /providers/:id/earnings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/admin/payouts/:id ─────────────────────────────────────────────
//
// Admin marks a payout as paid (default) or rejects it.
// Body: { action?: 'paid'|'reject', payment_ref?: string, reason?: string }
//
// DCP-768: requireAdminRbac = token auth + RBAC role check + audit log
router.patch('/admin/payouts/:id', requireAdminRbac, (req, res) => {
  try {
    const { action = 'paid', payment_ref, reason } = req.body;

    if (action === 'reject') {
      const result = rejectPayout(db._db || db, req.params.id, reason || null);
      if (result.error) {
        const statusMap = { NOT_FOUND: 404, NOT_REJECTABLE: 409 };
        return res.status(statusMap[result.error] || 400).json(result);
      }
      return res.json(result);
    }

    const result = markPayoutPaid(db._db || db, req.params.id, payment_ref || null);
    if (result.error) {
      const statusMap = { NOT_FOUND: 404, ALREADY_PAID: 409, REJECTED: 409 };
      return res.status(statusMap[result.error] || 400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('[payouts] PATCH /admin/payouts/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
