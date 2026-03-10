const express = require('express');
const router = express.Router();
const db = require('../db');

// ─── Auth middleware ───────────────────────────────────────────────────────────
// Requires DC1_ADMIN_TOKEN env var when set. Falls back to open if not configured
// (backwards-compatible for local dev). Set in production before public launch.
router.use((req, res, next) => {
  const adminToken = process.env.DC1_ADMIN_TOKEN;
  if (!adminToken) return next(); // not configured — allow (dev/Gate 0)
  const provided =
    req.headers['x-admin-token'] ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (provided !== adminToken) {
    return res.status(401).json({ error: 'Admin access denied' });
  }
  next();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Floor-plus-remainder split: guarantees provider_cut + dc1_cut === total exactly
function splitBilling(totalHalala) {
  const provider_cut = Math.floor(totalHalala * 0.75);
  const dc1_cut = totalHalala - provider_cut; // remainder, never diverges
  return { provider_cut, dc1_cut };
}

// === GET /api/admin/providers - All providers (api_key intentionally excluded) ===
router.get('/providers', (req, res) => {
  try {
    // api_key omitted from SELECT — never expose raw credentials in admin responses
    const providers = db.all(
      `SELECT id, name, email, gpu_model, gpu_count, vram_gb, os,
              status, gpu_status, provider_ip, provider_hostname,
              last_heartbeat, gpu_name_detected, gpu_vram_mib, gpu_driver,
              gpu_compute, total_earnings, total_jobs, uptime_percent,
              run_mode, is_paused, created_at, updated_at
       FROM providers ORDER BY
         CASE WHEN status = 'online' THEN 0 ELSE 1 END,
         last_heartbeat DESC, created_at DESC`
    );

    const now = new Date();
    const enriched = providers.map(p => {
      let gpu_status_parsed = null;
      try { gpu_status_parsed = p.gpu_status ? JSON.parse(p.gpu_status) : null; } catch(e) {}

      const lastBeat = p.last_heartbeat ? new Date(p.last_heartbeat) : null;
      const minutesSinceHeartbeat = lastBeat ? (now - lastBeat) / 60000 : null;
      const isOnline = minutesSinceHeartbeat !== null && minutesSinceHeartbeat < 5;

      return {
        ...p,
        gpu_status: gpu_status_parsed,
        is_online: isOnline,
        minutes_since_heartbeat: minutesSinceHeartbeat !== null ? Math.round(minutesSinceHeartbeat) : null,
        status: isOnline ? 'online' : (p.last_heartbeat ? 'offline' : 'registered')
      };
    });

    res.json({
      total: enriched.length,
      online: enriched.filter(p => p.is_online).length,
      offline: enriched.filter(p => !p.is_online && p.last_heartbeat).length,
      registered: enriched.filter(p => !p.last_heartbeat).length,
      providers: enriched
    });
  } catch (error) {
    console.error('Admin providers error:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// === GET /api/admin/dashboard - Summary stats ===
router.get('/dashboard', (req, res) => {
  try {
    const total = db.get('SELECT COUNT(*) as count FROM providers');
    const now = new Date();
    const fiveMinAgo = new Date(now - 5 * 60000).toISOString();

    const online = db.get(
      'SELECT COUNT(*) as count FROM providers WHERE last_heartbeat > ?', fiveMinAgo
    );

    const gpuModels = db.all(
      `SELECT gpu_model, COUNT(*) as count FROM providers
       GROUP BY gpu_model ORDER BY count DESC`
    );

    // api_key excluded from signups and heartbeat responses
    const recentSignups = db.all(
      `SELECT id, name, email, gpu_model, os, created_at
       FROM providers ORDER BY created_at DESC LIMIT 5`
    );

    const recentHeartbeats = db.all(
      `SELECT id, name, gpu_model, provider_ip, provider_hostname, last_heartbeat, gpu_status
       FROM providers WHERE last_heartbeat IS NOT NULL
       ORDER BY last_heartbeat DESC LIMIT 10`
    );

    res.json({
      stats: {
        total_providers: total.count,
        online_now: online.count,
        offline: total.count - online.count,
        timestamp: now.toISOString()
      },
      gpu_breakdown: gpuModels,
      recent_signups: recentSignups,
      recent_heartbeats: recentHeartbeats.map(h => {
        let gpu = null;
        try { gpu = h.gpu_status ? JSON.parse(h.gpu_status) : null; } catch(e) {}
        return { ...h, gpu_status: gpu };
      })
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// GET /api/admin/providers/:id - Full provider detail (api_key excluded)
router.get('/providers/:id', (req, res) => {
  try {
    // Explicit column list — api_key never returned
    const provider = db.get(
      `SELECT id, name, email, gpu_model, gpu_count, vram_gb, os,
              status, gpu_status, provider_ip, provider_hostname,
              last_heartbeat, gpu_name_detected, gpu_vram_mib, gpu_driver,
              gpu_compute, total_earnings, total_jobs, uptime_percent,
              run_mode, scheduled_start, scheduled_end,
              gpu_usage_cap_pct, vram_reserve_gb, temp_limit_c, is_paused,
              created_at, updated_at
       FROM providers WHERE id = ?`,
      req.params.id
    );
    if (!provider) return res.status(404).json({ error: 'Not found' });

    let gpuStatus = null;
    try { gpuStatus = provider.gpu_status ? JSON.parse(provider.gpu_status) : null; } catch(e) {}

    const since24h = new Date(Date.now() - 24*60*60*1000).toISOString();
    const since7d = new Date(Date.now() - 7*24*60*60*1000).toISOString();

    const hb24h = db.get('SELECT COUNT(*) as cnt FROM heartbeat_log WHERE provider_id = ? AND received_at > ?', req.params.id, since24h) || { cnt: 0 };
    const hb7d = db.get('SELECT COUNT(*) as cnt FROM heartbeat_log WHERE provider_id = ? AND received_at > ?', req.params.id, since7d) || { cnt: 0 };
    const expectedIn24h = (24 * 60 * 60) / 30; // 2880 heartbeats at 30s interval
    const expectedIn7d = 7 * expectedIn24h;
    const uptime24h = Math.min(100, Math.round((hb24h.cnt / expectedIn24h) * 100));
    const uptime7d = Math.min(100, Math.round((hb7d.cnt / expectedIn7d) * 100));

    const metrics24h = db.get(
      `SELECT AVG(gpu_util_pct) as avg_util, AVG(gpu_temp_c) as avg_temp,
              AVG(gpu_power_w) as avg_power, MAX(gpu_temp_c) as max_temp
       FROM heartbeat_log WHERE provider_id = ? AND received_at > ?`,
      req.params.id, since24h
    );

    const recentHb = db.all('SELECT * FROM heartbeat_log WHERE provider_id = ? ORDER BY received_at DESC LIMIT 20', req.params.id);
    const jobs = db.all('SELECT * FROM jobs WHERE provider_id = ? ORDER BY created_at DESC LIMIT 20', req.params.id);

    let disconnects = [];
    try { disconnects = db.all('SELECT * FROM recovery_events WHERE provider_id = ? ORDER BY timestamp DESC LIMIT 10', req.params.id); } catch(e) {}

    const now = new Date();
    const lastBeat = provider.last_heartbeat ? new Date(provider.last_heartbeat) : null;
    const minSince = lastBeat ? Math.round((now - lastBeat) / 60000) : null;

    res.json({
      provider: {
        ...provider,
        gpu_status: gpuStatus,
        is_online: minSince !== null && minSince < 5,
        minutes_since_heartbeat: minSince
      },
      uptime: { hours_24: uptime24h, days_7: uptime7d, heartbeats_24h: hb24h.cnt },
      metrics_24h: metrics24h || {},
      heartbeat_log: recentHb,
      jobs,
      disconnects
    });
  } catch (error) {
    console.error('Admin provider detail error:', error);
    res.status(500).json({ error: 'Failed to fetch provider detail' });
  }
});

// GET /api/admin/jobs/:id - Full job detail with exact billing split
router.get('/jobs/:id', (req, res) => {
  try {
    const job = db.get('SELECT * FROM jobs WHERE id = ? OR job_id = ?', req.params.id, req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });

    const provider = job.provider_id
      ? db.get(
          `SELECT id, name, email, gpu_name_detected, gpu_model, gpu_vram_mib,
                  vram_gb, provider_hostname, provider_ip
           FROM providers WHERE id = ?`,
          job.provider_id
        )
      : null;

    let recovery = [];
    try { recovery = db.all('SELECT * FROM recovery_events WHERE job_id = ? ORDER BY timestamp DESC', String(job.job_id || job.id)); } catch(e) {}

    let gpuReq = null;
    try { gpuReq = job.gpu_requirements ? JSON.parse(job.gpu_requirements) : null; } catch(e) {}

    const elapsed = job.started_at
      ? Math.floor((new Date(job.completed_at || new Date()) - new Date(job.started_at)) / 60000)
      : (job.duration_minutes || 0);

    const totalHalala = job.cost_halala || 0;
    const { provider_cut, dc1_cut } = splitBilling(totalHalala);

    res.json({
      job: { ...job, gpu_requirements: gpuReq },
      provider,
      recovery_events: recovery,
      billing: {
        duration_minutes: elapsed,
        cost_halala: totalHalala,
        cost_sar: (totalHalala / 100).toFixed(2),
        provider_cut_halala: provider_cut,
        dc1_cut_halala: dc1_cut
      }
    });
  } catch (error) {
    console.error('Admin job detail error:', error);
    res.status(500).json({ error: 'Failed to fetch job detail' });
  }
});

// ── Wallet helpers ────────────────────────────────────────────────────────────

const { createClient: _createClient } = require('@supabase/supabase-js');
const _crypto = require('crypto');

function _getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return _createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function _sarToHalala(sar) {
  return Math.round(parseFloat(sar) * 100);
}

async function _getWalletBalance(supabase, userId) {
  const { data: credits } = await supabase
    .from('billing_transactions').select('amount_halala')
    .eq('user_id', userId).eq('type', 'credit');
  const { data: debits } = await supabase
    .from('billing_transactions').select('amount_halala')
    .eq('user_id', userId).eq('type', 'debit');
  const { data: reservations } = await supabase
    .from('billing_reservations').select('amount_halala')
    .eq('user_id', userId).eq('status', 'held');

  const total    = (credits ?? []).reduce((s, r) => s + r.amount_halala, 0)
                 - (debits  ?? []).reduce((s, r) => s + r.amount_halala, 0);
  const reserved = (reservations ?? []).reduce((s, r) => s + r.amount_halala, 0);
  return { total, reserved, available: total - reserved };
}

// POST /api/admin/wallet/credit
// Body: { email: string, amount_sar: number, reason?: string }
// Auth: x-admin-token (handled by router-level middleware above)
router.post('/wallet/credit', async (req, res) => {
  try {
    const { email, amount_sar, reason } = req.body;

    if (!email || !amount_sar) {
      return res.status(400).json({ error: 'Missing required fields: email, amount_sar' });
    }

    const amountSar = parseFloat(amount_sar);
    if (isNaN(amountSar) || amountSar <= 0) {
      return res.status(400).json({ error: 'amount_sar must be a positive number' });
    }

    const supabase = _getSupabaseAdmin();
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' });
    }

    // Look up user by email in Supabase
    const { data: users, error: userErr } = await supabase
      .from('users')
      .select('id, email, name, type')
      .eq('email', email)
      .limit(1);

    if (userErr) {
      return res.status(500).json({ error: 'User lookup failed: ' + userErr.message });
    }
    if (!users || !users.length) {
      return res.status(404).json({ error: 'User not found in Supabase for email: ' + email });
    }

    const user = users[0];
    const amountHalala = _sarToHalala(amountSar);
    const txId = _crypto.randomUUID();

    // Insert credit transaction (idempotent via unique txId)
    const { error: creditErr } = await supabase
      .from('billing_transactions')
      .insert({
        id:            txId,
        user_id:       user.id,
        type:          'credit',
        amount_halala: amountHalala,
        reason:        reason || 'admin_credit',
        job_id:        null,
        created_at:    new Date().toISOString(),
      });

    if (creditErr) {
      return res.status(500).json({ error: 'Credit failed: ' + creditErr.message });
    }

    // Fetch updated balance
    const balance = await _getWalletBalance(supabase, user.id);

    console.log('[ADMIN] Wallet credit: ' + amountSar + ' SAR (' + amountHalala + ' halala) → ' + email + ' (reason: ' + (reason || 'admin_credit') + ')');

    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      credit: {
        amount_sar: amountSar,
        amount_halala: amountHalala,
        reason: reason || 'admin_credit',
        transaction_id: txId,
      },
      balance: {
        total_halala:     balance.total,
        reserved_halala:  balance.reserved,
        available_halala: balance.available,
        total_sar:        (balance.total    / 100).toFixed(2),
        available_sar:    (balance.available / 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error('Admin wallet credit error:', error);
    res.status(500).json({ error: 'Wallet credit failed' });
  }
});

// GET /api/admin/wallet/:email — Check wallet balance for any user by email
router.get('/wallet/:email', async (req, res) => {
  try {
    const supabase = _getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

    const { data: users, error } = await supabase
      .from('users').select('id, email, name').eq('email', req.params.email).limit(1);
    if (error) return res.status(500).json({ error: error.message });
    if (!users?.length) return res.status(404).json({ error: 'User not found: ' + req.params.email });

    const user = users[0];
    const balance = await _getWalletBalance(supabase, user.id);

    res.json({
      user,
      balance: {
        total_halala:     balance.total,
        reserved_halala:  balance.reserved,
        available_halala: balance.available,
        total_sar:        (balance.total    / 100).toFixed(2),
        available_sar:    (balance.available / 100).toFixed(2),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Balance lookup failed' });
  }
});

module.exports = router;
