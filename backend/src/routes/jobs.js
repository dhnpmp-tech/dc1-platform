const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

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

/**
 * Convert a deterministic seed string into a stable UUID v4-shaped hex string.
 * Same input always produces the same UUID — used as idempotency key for wallet ops.
 */
function deterministicUuid(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    (((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)) + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join('-');
}

// ── Lazy-load supabase client (avoids circular dependency at startup) ─────────
function getSupabase() {
  try {
    return require('../services/supabase-sync').getClient();
  } catch { return null; }
}

/**
 * Look up a Supabase user UUID by email.
 * Returns null if not found or if Supabase unavailable.
 */
async function resolveSupabaseUserId(supabase, email) {
  if (!supabase || !email) return null;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1);
    if (error || !data?.length) return null;
    return data[0].id;
  } catch { return null; }
}

/**
 * Fire-and-forget wallet debit (renter) + credit (provider) on job completion.
 * Errors are logged but NEVER block the HTTP response — billing is eventually
 * consistent via syncJobs() if the direct call fails here.
 */
async function applyWalletBilling({ jobId, actualCostHalala, providerEarned, renterEmail, providerEmail }) {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('[BILLING] Supabase client not available — wallet billing deferred to sync');
    return;
  }

  try {
    // ── Debit renter ──────────────────────────────────────────────────────────
    if (renterEmail && actualCostHalala > 0) {
      const renterUserId = await resolveSupabaseUserId(supabase, renterEmail);
      if (renterUserId) {
        const idemKey = deterministicUuid('dc1-renter-debit-' + jobId);
        const { error } = await supabase.rpc('debit_wallet_atomic', {
          p_user_id:         renterUserId,
          p_amount_halala:   actualCostHalala,
          p_reason:          'job_completion',
          p_job_id:          null,   // SQLite job_id is text, not UUID
          p_idempotency_key: idemKey,
        });
        if (error) {
          console.warn('[BILLING] Renter debit failed for ' + jobId + ': ' + error.message);
        } else {
          console.log('[BILLING] Renter debited ' + actualCostHalala + ' halala for job ' + jobId);
        }
      } else {
        console.warn('[BILLING] Renter user not found in Supabase for email: ' + renterEmail);
      }
    }
  } catch (e) {
    console.error('[BILLING] Renter debit error for ' + jobId + ':', e.message);
  }

  try {
    // ── Credit provider ───────────────────────────────────────────────────────
    if (providerEmail && providerEarned > 0) {
      const providerUserId = await resolveSupabaseUserId(supabase, providerEmail);
      if (providerUserId) {
        const idemKey = deterministicUuid('dc1-provider-credit-' + jobId);
        const { error } = await supabase.rpc('credit_wallet_atomic', {
          p_user_id:         providerUserId,
          p_amount_halala:   providerEarned,
          p_reason:          'provider_earning',
          p_idempotency_key: idemKey,
        });
        if (error) {
          // credit_wallet_atomic may not exist yet — fall back to direct insert
          const { error: insertErr } = await supabase
            .from('billing_transactions')
            .insert({
              id:            idemKey,
              user_id:       providerUserId,
              type:          'credit',
              amount_halala: providerEarned,
              reason:        'provider_earning',
              job_id:        null,
              created_at:    new Date().toISOString(),
            });
          if (insertErr && !insertErr.message.includes('duplicate')) {
            console.warn('[BILLING] Provider credit insert failed for ' + jobId + ': ' + insertErr.message);
          } else {
            console.log('[BILLING] Provider credited ' + providerEarned + ' halala for job ' + jobId + ' (direct insert)');
          }
        } else {
          console.log('[BILLING] Provider credited ' + providerEarned + ' halala for job ' + jobId);
        }
      } else {
        console.warn('[BILLING] Provider user not found in Supabase for email: ' + providerEmail);
      }
    }
  } catch (e) {
    console.error('[BILLING] Provider credit error for ' + jobId + ':', e.message);
  }
}

// POST /api/jobs/submit
router.post('/submit', (req, res) => {
  try {
    const { provider_id, job_type, duration_minutes, gpu_requirements, renter_email } = req.body;

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
      `INSERT INTO jobs (job_id, provider_id, job_type, status, submitted_at, duration_minutes, cost_halala, gpu_requirements, notes, renter_email, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
      job_id, provider_id, job_type, now, duration_minutes, cost_halala,
      gpu_requirements ? JSON.stringify(gpu_requirements) : null,
      null,
      renter_email || null,
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
        renter_email: job.renter_email || null,
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
    db.run(
      `UPDATE providers SET
        total_jobs = total_jobs + 1,
        total_earnings = total_earnings + ?
       WHERE id = ?`,
      provider_earned / 100, job.provider_id
    );

    // ── Async wallet billing ── fire-and-forget, errors are logged not thrown ──
    // Fetch provider email for Supabase user resolution
    const provider = db.get('SELECT email FROM providers WHERE id = ?', job.provider_id);
    const jobId = job.job_id || String(job.id);

    applyWalletBilling({
      jobId,
      actualCostHalala: actual_cost_halala,
      providerEarned:   provider_earned,
      renterEmail:      job.renter_email || null,
      providerEmail:    provider?.email   || null,
    }).catch(e => console.error('[BILLING] Unhandled wallet error for ' + jobId + ':', e.message));

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
    console.error('Job complete error:', error);
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
