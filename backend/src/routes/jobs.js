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

// Floor-plus-remainder: guarantees provider + dc1 === total exactly
function splitBilling(totalHalala) {
  const provider = Math.floor(totalHalala * 0.75);
  return { provider, dc1: totalHalala - provider };
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

// GET /api/jobs/assigned?key=API_KEY
// Daemon polls this to check if it has a running job with a task to execute
router.get('/assigned', (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'API key required' });

    const provider = db.get('SELECT * FROM providers WHERE api_key = ?', [key]);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const job = db.get(
      `SELECT * FROM jobs WHERE provider_id = ? AND status = 'running' AND task_spec IS NOT NULL AND picked_up_at IS NULL ORDER BY started_at ASC LIMIT 1`,
      [provider.id]
    );

    if (!job) return res.json({ job: null });

    // Mark as picked up so daemon doesn't re-execute
    db.run(`UPDATE jobs SET picked_up_at = ? WHERE id = ?`, [new Date().toISOString(), job.id]);

    job.gpu_requirements = job.gpu_requirements ? JSON.parse(job.gpu_requirements) : null;
    res.json({ job });
  } catch (error) {
    console.error('Assigned job fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch assigned job' });
  }
});

// POST /api/jobs/:job_id/result
// Daemon posts execution result; auto-completes the job
router.post('/:job_id/result', (req, res) => {
  try {
    const job = db.get('SELECT * FROM jobs WHERE id = ?', [req.params.job_id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Guard against duplicate settlement — only settle a running job once
    if (job.status !== 'running') {
      return res.status(409).json({
        error: 'Job already settled',
        current_status: job.status,
        job_id: job.job_id
      });
    }

    const { result, error: jobError, duration_seconds, gpu_util_peak } = req.body;

    const now = new Date().toISOString();
    const actualMinutes = duration_seconds ? Math.ceil(duration_seconds / 60) : job.duration_minutes;
    const billingRate = job.job_type === 'training' ? 25 : job.job_type === 'rendering' ? 20 : 15;
    const actualCostHalala = billingRate * actualMinutes;
    const { provider: providerEarned, dc1: dc1Fee } = splitBilling(actualCostHalala);

    db.run(
      `UPDATE jobs SET
        status = 'completed',
        result = ?,
        error = ?,
        completed_at = ?,
        actual_duration_minutes = ?,
        actual_cost_halala = ?,
        provider_earned_halala = ?,
        dc1_fee_halala = ?
      WHERE id = ?`,
      [
        result || 'completed',
        jobError || null,
        now,
        actualMinutes,
        actualCostHalala,
        providerEarned,
        dc1Fee,
        job.id
      ]
    );

    db.run(
      `UPDATE providers SET total_earnings = total_earnings + ?, total_jobs = total_jobs + 1 WHERE id = ?`,
      [providerEarned / 100, job.provider_id]
    );

    const updated = db.get('SELECT * FROM jobs WHERE id = ?', [job.id]);
    res.json({
      success: true,
      job: updated,
      billing: {
        actual_cost_halala: actualCostHalala,
        provider_earned_halala: providerEarned,
        dc1_fee_halala: dc1Fee
      }
    });
  } catch (error) {
    console.error('Job result error:', error);
    res.status(500).json({ error: 'Failed to record job result' });
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

    // Calculate ACTUAL cost from real elapsed time, not the submitted estimate
    const startedAt = job.started_at || job.submitted_at;
    const actualMinutes = startedAt
      ? Math.max(1, Math.ceil((new Date(now) - new Date(startedAt)) / 60000))
      : (job.duration_minutes || 1);
    const rate = COST_RATES[job.job_type] || COST_RATES['default'];
    const actual_cost_halala = Math.round(rate * actualMinutes);
    const { provider: provider_earned, dc1: dc1_fee } = splitBilling(actual_cost_halala);

    db.run(
      `UPDATE jobs SET
        status = 'completed',
        completed_at = ?,
        actual_duration_minutes = ?,
        actual_cost_halala = ?,
        provider_earned_halala = ?,
        dc1_fee_halala = ?
       WHERE id = ?`,
      now, actualMinutes, actual_cost_halala, provider_earned, dc1_fee, job.id
    );

    // Provider earnings updated from actual billing — 75% floor split, not full renter charge
    // provider_earned = splitBilling(actual_cost_halala).provider (computed at line 147)
    db.run(
      `UPDATE providers SET
        total_jobs = total_jobs + 1,
        total_earnings = total_earnings + ?
       WHERE id = ?`,
      provider_earned / 100, job.provider_id
    );

    const updated = db.get('SELECT * FROM jobs WHERE id = ?', job.id);
    updated.gpu_requirements = updated.gpu_requirements ? JSON.parse(updated.gpu_requirements) : null;
    res.json({
      success: true,
      job: updated,
      billing: {
        estimated_cost_halala: job.cost_halala,
        actual_cost_halala,
        actual_duration_minutes: actualMinutes,
        provider_earned_halala: provider_earned,
        dc1_fee_halala: dc1_fee
      }
    });
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
