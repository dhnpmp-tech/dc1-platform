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
       VALUES (?, ?, ?, ?, 'active', 0, ?)`,
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
      `SELECT id, name, gpu_model, gpu_name_detected, gpu_vram_mib, status, location,
              run_mode, reliability_score
       FROM providers WHERE status = 'online' AND is_paused = 0
       ORDER BY gpu_vram_mib DESC`
    );

    res.json({
      providers: providers.map(p => ({
        id: p.id,
        name: p.name,
        gpu_model: p.gpu_name_detected || p.gpu_model,
        vram_gb: p.gpu_vram_mib ? Math.round(p.gpu_vram_mib / 1024) : null,
        vram_mib: p.gpu_vram_mib,
        status: p.status,
        location: p.location,
        reliability_score: p.reliability_score
      })),
      total: providers.length
    });
  } catch (error) {
    console.error('Available providers error:', error);
    res.status(500).json({ error: 'Failed to fetch available providers' });
  }
});

module.exports = router;
