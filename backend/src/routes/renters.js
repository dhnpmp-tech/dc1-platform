const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');

// POST /api/renters/register
router.post('/register', (req, res) => {
  try {
    const { name, email, organization } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Missing required fields: name, email' });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const api_key = 'dc1-renter-' + crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();

    const result = db.run(
      `INSERT INTO renters (name, email, api_key, organization, status, balance_halala, created_at)
       VALUES (?, ?, ?, ?, 'active', 1000, ?)`,
      name, email, api_key, organization || null, now
    );

    res.status(201).json({
      success: true,
      renter_id: result.lastInsertRowid,
      api_key,
      message: `Welcome ${name}! Save your API key — it won't be shown again.`
    });
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
    const key = req.headers['x-renter-key'] || req.query.key;
    if (!key) return res.status(400).json({ error: 'API key required (x-renter-key header or key query)' });

    const renter = db.get('SELECT * FROM renters WHERE api_key = ? AND status = ?', key, 'active');
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const { amount_halala, amount_sar } = req.body;
    // Accept either halala or SAR (convert SAR → halala)
    const topup = amount_halala || (amount_sar ? Math.round(amount_sar * 100) : 0);

    if (!topup || topup <= 0) {
      return res.status(400).json({ error: 'Provide amount_halala (int) or amount_sar (float), must be > 0' });
    }

    if (topup > 100000) { // max 1000 SAR per top-up
      return res.status(400).json({ error: 'Max top-up is 1000 SAR (100000 halala) per transaction' });
    }

    const now = new Date().toISOString();
    db.run(
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
router.post('/login-email', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const renter = db.get('SELECT * FROM renters WHERE email = ? AND status = ?', email.trim().toLowerCase(), 'active');
    if (!renter) {
      // Also try case-insensitive
      const renterCI = db.get('SELECT * FROM renters WHERE LOWER(email) = LOWER(?) AND status = ?', email.trim(), 'active');
      if (!renterCI) {
        return res.status(404).json({ error: 'No renter account found with this email. Register first at /renter/register' });
      }
      return res.json({
        success: true,
        api_key: renterCI.api_key,
        renter: {
          id: renterCI.id,
          name: renterCI.name,
          email: renterCI.email,
          organization: renterCI.organization,
          balance_halala: renterCI.balance_halala,
        }
      });
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
      }
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

    const newKey = 'dc1-renter-' + crypto.randomBytes(16).toString('hex');
    db.run('UPDATE renters SET api_key = ?, updated_at = ? WHERE id = ?',
      newKey, new Date().toISOString(), renter.id);

    res.json({
      success: true,
      message: 'API key rotated. Save the new key — the old one is now invalid.',
      api_key: newKey,
      renter_id: renter.id
    });
  } catch (error) {
    console.error('Renter key rotation error:', error);
    res.status(500).json({ error: 'Key rotation failed' });
  }
});

module.exports = router;
