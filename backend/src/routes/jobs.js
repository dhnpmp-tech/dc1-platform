const express = require('express');
const router = express.Router();
const db = require('../db');

// Cost rates in halala per minute by job type
const COST_RATES = {
  'llm-inference': 15,    // 15 halala/min
  'training': 25,         // 25 halala/min
  'rendering': 20,        // 20 halala/min
  'default': 10           // 10 halala/min
};

function calculateCostHalala(jobType, durationMinutes) {
  const rate = COST_RATES[jobType] || COST_RATES['default'];
  return Math.round(rate * durationMinutes);
}

// POST /api/jobs/submit
router.post('/submit', (req, res) => {
  try {
    const { provider_id, job_type, duration_minutes, gpu_requirements } = req.body;

    if (!provider_id || !job_type || !duration_minutes) {
      return res.status(400).json({ error: 'Missing required fields: provider_id, job_type, duration_minutes' });
    }

    if (typeof duration_minutes !== 'number' || duration_minutes <= 0) {
      return res.status(400).json({ error: 'duration_minutes must be a positive number' });
    }

    // Check provider exists and is online
    const provider = db.get('SELECT * FROM providers WHERE id = ?', provider_id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    if (provider.status !== 'online') {
      return res.status(400).json({ error: 'Provider is not online', provider_status: provider.status });
    }

    // Validate GPU requirements if specified
    if (gpu_requirements) {
      const req_vram = gpu_requirements.min_vram_gb;
      if (req_vram && provider.vram_gb && provider.vram_gb < req_vram) {
        return res.status(400).json({
          error: 'Provider does not meet GPU requirements',
          required_vram_gb: req_vram,
          provider_vram_gb: provider.vram_gb
        });
      }
    }

    const cost_halala = calculateCostHalala(job_type, duration_minutes);
    const now = new Date().toISOString();
    const job_id = 'job-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    const result = db.run(
      `INSERT INTO jobs (job_id, provider_id, job_type, status, submitted_at, duration_minutes, cost_halala, gpu_requirements, notes, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
      job_id, provider_id, job_type, now, duration_minutes, cost_halala,
      gpu_requirements ? JSON.stringify(gpu_requirements) : null,
      null,
      now
    );

    // Auto-transition to running
    db.run(
      `UPDATE jobs SET status = 'running', started_at = ? WHERE id = ?`,
      now, result.lastInsertRowid
    );

    const job = db.get('SELECT * FROM jobs WHERE id = ?', result.lastInsertRowid);

    res.status(201).json({
      success: true,
      job: {
        id: job.id,
        job_id: job.job_id,
        provider_id: job.provider_id,
        job_type: job.job_type,
        status: job.status,
        submitted_at: job.submitted_at,
        started_at: job.started_at,
        duration_minutes: job.duration_minutes,
        cost_halala: job.cost_halala,
        gpu_requirements: job.gpu_requirements ? JSON.parse(job.gpu_requirements) : null
      }
    });
  } catch (error) {
    console.error('Job submit error:', error);
    res.status(500).json({ error: 'Job submission failed' });
  }
});

// GET /api/jobs/active
router.get('/active', (req, res) => {
  try {
    const jobs = db.all(
      `SELECT * FROM jobs WHERE status IN ('pending', 'running') ORDER BY submitted_at DESC`
    );
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active jobs' });
  }
});

// GET /api/jobs/:job_id
router.get('/:job_id', (req, res) => {
  try {
    const job = db.get('SELECT * FROM jobs WHERE id = ?', req.params.job_id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    job.gpu_requirements = job.gpu_requirements ? JSON.parse(job.gpu_requirements) : null;
    res.json({ job });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// POST /api/jobs/:job_id/complete
router.post('/:job_id/complete', (req, res) => {
  try {
    const job = db.get('SELECT * FROM jobs WHERE id = ?', req.params.job_id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status !== 'running') {
      return res.status(400).json({ error: 'Job is not running', current_status: job.status });
    }

    const now = new Date().toISOString();
    db.run(
      `UPDATE jobs SET status = 'completed', completed_at = ? WHERE id = ?`,
      now, job.id
    );

    // Update provider stats — provider gets 75% floor split, not full renter charge
    const providerEarnedHalala = Math.floor((job.cost_halala * 75) / 100);
    db.run(
      `UPDATE providers SET total_jobs = total_jobs + 1, total_earnings = total_earnings + ? WHERE id = ?`,
      providerEarnedHalala / 100, job.provider_id
    );

    const updated = db.get('SELECT * FROM jobs WHERE id = ?', job.id);
    updated.gpu_requirements = updated.gpu_requirements ? JSON.parse(updated.gpu_requirements) : null;
    res.json({ success: true, job: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// POST /api/jobs/:job_id/cancel
router.post('/:job_id/cancel', (req, res) => {
  try {
    const job = db.get('SELECT * FROM jobs WHERE id = ?', req.params.job_id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status === 'completed' || job.status === 'cancelled') {
      return res.status(400).json({ error: `Cannot cancel job with status: ${job.status}` });
    }

    const now = new Date().toISOString();
    db.run(
      `UPDATE jobs SET status = 'cancelled', completed_at = ? WHERE id = ?`,
      now, job.id
    );

    const updated = db.get('SELECT * FROM jobs WHERE id = ?', job.id);
    res.json({ success: true, job: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

module.exports = router;
module.exports.calculateCostHalala = calculateCostHalala;
module.exports.COST_RATES = COST_RATES;
