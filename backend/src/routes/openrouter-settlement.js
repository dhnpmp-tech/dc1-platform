'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAdminRequest } = require('../middleware/auth');
const {
  computeDryRunSummary,
  executeOpenRouterSettlement,
} = require('../services/openrouterSettlementService');

function requireAdmin(req, res, next) {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: 'Admin token required' });
  }
  return next();
}

router.use(requireAdmin);

router.post('/settlements/dry-run', (req, res) => {
  try {
    const summary = computeDryRunSummary(db._db || db, {
      periodStart: req.body?.period_start,
      periodEnd: req.body?.period_end,
      expectedTotalHalala: req.body?.expected_total_halala,
    });
    return res.json({ dry_run: true, summary });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to compute OpenRouter dry run' });
  }
});

router.post('/settlements/run', (req, res) => {
  try {
    const result = executeOpenRouterSettlement(db._db || db, {
      periodStart: req.body?.period_start,
      periodEnd: req.body?.period_end,
      mode: req.body?.mode,
      cadence: req.body?.cadence,
      expectedTotalHalala: req.body?.expected_total_halala,
    });

    if (result.error) {
      return res.status(500).json({
        error: 'OpenRouter settlement failed',
        detail: result.error,
        settlement: result.settlement,
        alerts: result.alerts || [],
      });
    }

    return res.json({
      settlement: result.settlement,
      summary: result.summary,
      invoice: result.invoice,
      topup: result.topup,
      alerts: result.alerts || [],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to execute OpenRouter settlement' });
  }
});

router.get('/settlements', (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 20);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;
    const rows = db.all(
      `SELECT *
         FROM openrouter_settlements
        ORDER BY created_at DESC
        LIMIT ?`,
      limit
    );
    return res.json({ settlements: rows, count: rows.length });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to list OpenRouter settlements' });
  }
});

router.get('/settlements/:id', (req, res) => {
  try {
    const settlement = db.get('SELECT * FROM openrouter_settlements WHERE id = ?', req.params.id);
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });

    const items = db.all(
      `SELECT usage_id, renter_id, provider_id, cost_halala, created_at
         FROM openrouter_settlement_items
        WHERE settlement_id = ?
        ORDER BY created_at ASC`,
      settlement.id
    );
    const alerts = db.all(
      `SELECT severity, code, message, created_at
         FROM openrouter_settlement_alerts
        WHERE settlement_id = ?
        ORDER BY created_at ASC`,
      settlement.id
    );
    const invoice = db.get(
      'SELECT * FROM openrouter_settlement_invoices WHERE settlement_id = ?',
      settlement.id
    ) || null;
    const topup = db.get(
      'SELECT * FROM openrouter_settlement_topups WHERE settlement_id = ?',
      settlement.id
    ) || null;

    return res.json({ settlement, items, alerts, invoice, topup });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch OpenRouter settlement details' });
  }
});

module.exports = router;
