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

module.exports = router;
