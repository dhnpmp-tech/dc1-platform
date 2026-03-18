const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const { getConfig: getNotifConfig, sendAlert, sendTelegram } = require('../services/notifications');

// ─── Auth middleware ───────────────────────────────────────────────────────────
// Requires DC1_ADMIN_TOKEN env var.
router.use((req, res, next) => {
  const adminToken = process.env.DC1_ADMIN_TOKEN;
  const provided =
    req.headers['x-admin-token'] ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!adminToken) {
    return res.status(503).json({ error: 'Admin token not configured' });
  }
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
    const page = Math.max(parseInt(req.query.page) || 0, 0); // 0 = all (legacy), 1+ = paginated
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const search = (req.query.search || '').trim().toLowerCase();
    const statusFilter = req.query.status || '';

    let where = '1=1';
    const wParams = [];
    if (search) {
      where += ` AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(gpu_model) LIKE ?)`;
      wParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (statusFilter === 'online') { where += ` AND last_heartbeat > datetime('now', '-5 minutes')`; }
    else if (statusFilter === 'offline') { where += ` AND last_heartbeat IS NOT NULL AND last_heartbeat <= datetime('now', '-5 minutes')`; }
    else if (statusFilter === 'registered') { where += ` AND last_heartbeat IS NULL`; }
    else if (statusFilter === 'suspended') { where += ` AND status = 'suspended'`; }

    const countRow = db.get(`SELECT COUNT(*) as total FROM providers WHERE ${where}`, ...wParams);
    const total = countRow?.total || 0;

    let paginationSql = '';
    if (page > 0) {
      const offset = (page - 1) * limit;
      paginationSql = `LIMIT ${limit} OFFSET ${offset}`;
    }

    // api_key omitted from SELECT — never expose raw credentials in admin responses
    const providers = db.all(
      `SELECT id, name, email, gpu_model, gpu_count, vram_gb, os,
              status, gpu_status, provider_ip, provider_hostname,
              last_heartbeat, gpu_name_detected, gpu_vram_mib, gpu_driver,
              gpu_compute, total_earnings, total_jobs, uptime_percent,
              run_mode, is_paused, created_at, updated_at
       FROM providers WHERE ${where} ORDER BY
         CASE WHEN status = 'online' THEN 0 ELSE 1 END,
         last_heartbeat DESC, created_at DESC ${paginationSql}`,
      ...wParams
    );

    const now = new Date();
    const since24h = new Date(Date.now() - 24*60*60*1000).toISOString();
    const expectedIn24h = (24 * 60 * 60) / 30; // 2880 heartbeats at 30s interval

    const enriched = providers.map(p => {
      let gpu_status_parsed = null;
      try { gpu_status_parsed = p.gpu_status ? JSON.parse(p.gpu_status) : null; } catch(e) {}

      const lastBeat = p.last_heartbeat ? new Date(p.last_heartbeat) : null;
      const minutesSinceHeartbeat = lastBeat ? (now - lastBeat) / 60000 : null;
      const isOnline = minutesSinceHeartbeat !== null && minutesSinceHeartbeat < 5;

      // Calculate 24h uptime from heartbeat_log
      let uptime_24h = null;
      try {
        const hbRow = db.get('SELECT COUNT(*) as cnt FROM heartbeat_log WHERE provider_id = ? AND received_at > ?', p.id, since24h);
        if (hbRow && hbRow.cnt > 0) {
          uptime_24h = Math.min(100, Math.round((hbRow.cnt / expectedIn24h) * 100));
        }
      } catch(e) {}

      return {
        ...p,
        gpu_status: gpu_status_parsed,
        is_online: isOnline,
        minutes_since_heartbeat: minutesSinceHeartbeat !== null ? Math.round(minutesSinceHeartbeat) : null,
        status: isOnline ? 'online' : (p.last_heartbeat ? 'offline' : 'registered'),
        uptime_24h
      };
    });

    const response = {
      total,
      online: enriched.filter(p => p.is_online).length,
      offline: enriched.filter(p => !p.is_online && p.last_heartbeat).length,
      registered: enriched.filter(p => !p.last_heartbeat).length,
      providers: enriched
    };
    if (page > 0) {
      response.pagination = { page, limit, total, total_pages: Math.ceil(total / limit) };
    }
    res.json(response);
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

    // Renter stats
    const renterStats = db.get('SELECT COUNT(*) as total, SUM(CASE WHEN status = \'active\' THEN 1 ELSE 0 END) as active, COALESCE(SUM(balance_halala), 0) as total_balance FROM renters') || {};

    // Job + revenue stats
    const todayStart = new Date(now); todayStart.setUTCHours(0,0,0,0);
    const jobStats = db.get(`
      SELECT COUNT(*) as total_jobs,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
             SUM(CASE WHEN status IN ('pending','running','queued') THEN 1 ELSE 0 END) as active_jobs,
             COALESCE(SUM(CASE WHEN status = 'completed' THEN actual_cost_halala ELSE 0 END), 0) as total_revenue,
             COALESCE(SUM(CASE WHEN status = 'completed' THEN dc1_fee_halala ELSE 0 END), 0) as total_dc1_fees
      FROM jobs
    `) || {};
    const todayRevenue = db.get(`SELECT COALESCE(SUM(actual_cost_halala), 0) as revenue, COALESCE(SUM(dc1_fee_halala), 0) as dc1_fees, COUNT(*) as jobs FROM jobs WHERE status = 'completed' AND completed_at >= ?`, todayStart.toISOString()) || {};

    res.json({
      stats: {
        total_providers: total.count,
        online_now: online.count,
        offline: total.count - online.count,
        total_renters: renterStats.total || 0,
        active_renters: renterStats.active || 0,
        total_renter_balance_halala: renterStats.total_balance || 0,
        total_jobs: jobStats.total_jobs || 0,
        completed_jobs: jobStats.completed || 0,
        failed_jobs: jobStats.failed || 0,
        active_jobs: jobStats.active_jobs || 0,
        total_revenue_halala: jobStats.total_revenue || 0,
        total_dc1_fees_halala: jobStats.total_dc1_fees || 0,
        today_revenue_halala: todayRevenue.revenue || 0,
        today_dc1_fees_halala: todayRevenue.dc1_fees || 0,
        today_jobs: todayRevenue.jobs || 0,
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

// ============================================================================
// GET /api/admin/daemon-health - Daemon fleet health dashboard
// ============================================================================
router.get('/daemon-health', (req, res) => {
  try {
    const hoursRaw = parseInt(req.query.hours, 10) || 24;
    const hours = Math.min(Math.max(hoursRaw, 1), 720);  // Clamp 1h - 30 days
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    // Validate provider_id if provided
    let providerFilter = null;
    if (req.query.provider_id) {
      providerFilter = parseInt(req.query.provider_id, 10);
      if (isNaN(providerFilter) || providerFilter <= 0) {
        return res.status(400).json({ error: 'Invalid provider_id — must be a positive integer' });
      }
    }

    // 1. Recent events (last N hours)
    let eventsQuery = `SELECT * FROM daemon_events WHERE received_at > ? `;
    const eventsParams = [since];
    if (providerFilter) {
      eventsQuery += `AND provider_id = ? `;
      eventsParams.push(providerFilter);
    }
    eventsQuery += `ORDER BY received_at DESC LIMIT 200`;
    const events = db.all(eventsQuery, ...eventsParams);

    // 2. Crash summary per provider
    const crashes = db.all(`
      SELECT provider_id, COUNT(*) as crash_count,
             MAX(event_timestamp) as last_crash,
             GROUP_CONCAT(DISTINCT daemon_version) as versions_seen
      FROM daemon_events
      WHERE event_type IN ('daemon_crash', 'watchdog_restart', 'watchdog_givingup')
        AND received_at > ?
      GROUP BY provider_id
      ORDER BY crash_count DESC
    `, since);

    // 3. Version distribution across providers
    const versions = db.all(`
      SELECT daemon_version, COUNT(DISTINCT provider_id) as provider_count,
             MAX(event_timestamp) as last_seen
      FROM daemon_events
      WHERE event_type = 'daemon_start'
        AND received_at > ?
      GROUP BY daemon_version
      ORDER BY daemon_version DESC
    `, since);

    // 4. Job success/failure rates
    const jobStats = db.all(`
      SELECT event_type, COUNT(*) as count
      FROM daemon_events
      WHERE event_type IN ('job_success', 'job_failure')
        AND received_at > ?
      GROUP BY event_type
    `, since);

    // 5. Event type breakdown
    const eventBreakdown = db.all(`
      SELECT event_type, severity, COUNT(*) as count
      FROM daemon_events
      WHERE received_at > ?
      GROUP BY event_type, severity
      ORDER BY count DESC
    `, since);

    // 6. Bandwidth reports (latest per provider)
    const bandwidth = db.all(`
      SELECT d.provider_id, d.details, d.event_timestamp
      FROM daemon_events d
      INNER JOIN (
        SELECT provider_id, MAX(event_timestamp) as max_ts
        FROM daemon_events
        WHERE event_type = 'bandwidth_report' AND received_at > ?
        GROUP BY provider_id
      ) latest ON d.provider_id = latest.provider_id AND d.event_timestamp = latest.max_ts
      WHERE d.event_type = 'bandwidth_report'
      ORDER BY d.provider_id
    `, since);

    // 7. Provider online status (from providers table)
    const providers = db.all(`
      SELECT id, name, gpu_model, status, daemon_version,
             last_heartbeat, gpu_name_detected
      FROM providers
      ORDER BY last_heartbeat DESC
    `);

    const successCount = jobStats.find(s => s.event_type === 'job_success')?.count || 0;
    const failCount = jobStats.find(s => s.event_type === 'job_failure')?.count || 0;
    const totalJobs = successCount + failCount;

    res.json({
      period_hours: parseInt(hours),
      generated_at: new Date().toISOString(),
      summary: {
        total_events: events.length,
        total_crashes: crashes.reduce((sum, c) => sum + c.crash_count, 0),
        total_jobs: totalJobs,
        job_success_rate: totalJobs > 0 ? `${((successCount / totalJobs) * 100).toFixed(1)}%` : 'N/A',
        providers_online: providers.filter(p => p.status === 'online').length,
        providers_total: providers.length,
      },
      crashes,
      versions,
      job_stats: { success: successCount, failure: failCount, total: totalJobs },
      event_breakdown: eventBreakdown,
      bandwidth,
      providers,
      recent_events: events.slice(0, 50),  // Only return first 50 in list
    });

  } catch (error) {
    console.error('Daemon health dashboard error:', error);
    res.status(500).json({ error: 'Dashboard query failed' });
  }
});

// ============================================================================
// GET /api/admin/renters - List all renters with stats
// ============================================================================
router.get('/renters', (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 0, 0);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const search = (req.query.search || '').trim().toLowerCase();
    const statusFilter = req.query.status || '';

    let where = '1=1';
    const wParams = [];
    if (search) {
      where += ` AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(organization) LIKE ?)`;
      wParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (statusFilter) { where += ` AND status = ?`; wParams.push(statusFilter); }

    const countRow = db.get(`SELECT COUNT(*) as total FROM renters WHERE ${where}`, ...wParams);
    const total = countRow?.total || 0;

    let paginationSql = '';
    if (page > 0) { paginationSql = `LIMIT ${limit} OFFSET ${(page - 1) * limit}`; }

    const renters = db.all(
      `SELECT id, name, email, organization, balance_halala, status, created_at
       FROM renters WHERE ${where} ORDER BY created_at DESC ${paginationSql}`,
      ...wParams
    );
    const enriched = renters.map(r => {
      const jobStats = db.get(
        `SELECT COUNT(*) as total_jobs,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
                SUM(cost_halala) as total_spent_halala
         FROM jobs WHERE renter_id = ?`, r.id
      ) || {};
      return { ...r, ...jobStats };
    });
    const response = {
      total,
      active: enriched.filter(r => r.status === 'active').length,
      suspended: enriched.filter(r => r.status === 'suspended').length,
      renters: enriched
    };
    if (page > 0) { response.pagination = { page, limit, total, total_pages: Math.ceil(total / limit) }; }
    res.json(response);
  } catch (error) {
    console.error('Admin renters error:', error);
    res.status(500).json({ error: 'Failed to fetch renters' });
  }
});

// ============================================================================
// GET /api/admin/renters/:id - Renter detail
// ============================================================================
router.get('/renters/:id', (req, res) => {
  try {
    const renter = db.get(
      'SELECT id, name, email, organization, balance_halala, status, created_at FROM renters WHERE id = ?',
      req.params.id
    );
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const jobs = db.all(
      'SELECT * FROM jobs WHERE renter_id = ? ORDER BY created_at DESC LIMIT 50',
      req.params.id
    );
    const jobStats = db.get(
      `SELECT COUNT(*) as total_jobs,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
              SUM(cost_halala) as total_spent_halala
       FROM jobs WHERE renter_id = ?`, req.params.id
    ) || {};

    res.json({ renter, jobs, stats: jobStats });
  } catch (error) {
    console.error('Admin renter detail error:', error);
    res.status(500).json({ error: 'Failed to fetch renter detail' });
  }
});

// ============================================================================
// POST /api/admin/providers/:id/suspend - Suspend provider
// ============================================================================
router.post('/providers/:id/suspend', (req, res) => {
  try {
    const provider = db.get('SELECT id, name, status FROM providers WHERE id = ?', req.params.id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    const now = new Date().toISOString();
    db.run('UPDATE providers SET status = ?, is_paused = 1, updated_at = ? WHERE id = ?', 'suspended', now, req.params.id);
    try { db.run('INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp) VALUES (?,?,?,?,?)', 'provider_suspended', 'provider', provider.id, `Suspended provider "${provider.name}"`, now); } catch(e) {}
    res.json({ success: true, message: `Provider ${provider.name} suspended` });
  } catch (error) {
    console.error('Suspend provider error:', error);
    res.status(500).json({ error: 'Failed to suspend provider' });
  }
});

// ============================================================================
// POST /api/admin/providers/:id/unsuspend - Unsuspend provider
// ============================================================================
router.post('/providers/:id/unsuspend', (req, res) => {
  try {
    const provider = db.get('SELECT id, name, status FROM providers WHERE id = ?', req.params.id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    const now = new Date().toISOString();
    db.run('UPDATE providers SET status = ?, is_paused = 0, updated_at = ? WHERE id = ?', 'offline', now, req.params.id);
    try { db.run('INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp) VALUES (?,?,?,?,?)', 'provider_unsuspended', 'provider', provider.id, `Unsuspended provider "${provider.name}"`, now); } catch(e) {}
    res.json({ success: true, message: `Provider ${provider.name} unsuspended` });
  } catch (error) {
    console.error('Unsuspend provider error:', error);
    res.status(500).json({ error: 'Failed to unsuspend provider' });
  }
});

// ============================================================================
// POST /api/admin/renters/:id/suspend - Suspend renter
// ============================================================================
router.post('/renters/:id/suspend', (req, res) => {
  try {
    const renter = db.get('SELECT id, name, status FROM renters WHERE id = ?', req.params.id);
    if (!renter) return res.status(404).json({ error: 'Renter not found' });
    db.run('UPDATE renters SET status = ? WHERE id = ?', 'suspended', req.params.id);
    try { db.run('INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp) VALUES (?,?,?,?,?)', 'renter_suspended', 'renter', renter.id, `Suspended renter "${renter.name}"`, new Date().toISOString()); } catch(e) {}
    res.json({ success: true, message: `Renter ${renter.name} suspended` });
  } catch (error) {
    console.error('Suspend renter error:', error);
    res.status(500).json({ error: 'Failed to suspend renter' });
  }
});

// ============================================================================
// POST /api/admin/renters/:id/unsuspend - Unsuspend renter
// ============================================================================
router.post('/renters/:id/unsuspend', (req, res) => {
  try {
    const renter = db.get('SELECT id, name, status FROM renters WHERE id = ?', req.params.id);
    if (!renter) return res.status(404).json({ error: 'Renter not found' });
    db.run('UPDATE renters SET status = ? WHERE id = ?', 'active', req.params.id);
    try { db.run('INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp) VALUES (?,?,?,?,?)', 'renter_unsuspended', 'renter', renter.id, `Reactivated renter "${renter.name}"`, new Date().toISOString()); } catch(e) {}
    res.json({ success: true, message: `Renter ${renter.name} reactivated` });
  } catch (error) {
    console.error('Unsuspend renter error:', error);
    res.status(500).json({ error: 'Failed to unsuspend renter' });
  }
});

// ============================================================================
// POST /api/admin/renters/:id/balance - Admin balance adjustment
// ============================================================================
router.post('/renters/:id/balance', (req, res) => {
  try {
    const { amount_halala, reason } = req.body;
    if (!amount_halala || typeof amount_halala !== 'number') {
      return res.status(400).json({ error: 'amount_halala (number) is required' });
    }
    const renter = db.get('SELECT id, name, balance_halala FROM renters WHERE id = ?', req.params.id);
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const newBalance = renter.balance_halala + amount_halala;
    if (newBalance < 0) return res.status(400).json({ error: 'Balance cannot go below 0' });

    db.run('UPDATE renters SET balance_halala = ? WHERE id = ?', newBalance, req.params.id);
    try { db.run('INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp) VALUES (?,?,?,?,?)', 'balance_adjusted', 'renter', renter.id, `Adjusted balance by ${amount_halala} halala for "${renter.name}": ${reason || 'No reason'}`, new Date().toISOString()); } catch(e) {}
    res.json({
      success: true,
      renter_id: renter.id,
      name: renter.name,
      previous_balance: renter.balance_halala,
      adjustment: amount_halala,
      new_balance: newBalance,
      reason: reason || 'Admin adjustment'
    });
  } catch (error) {
    console.error('Balance adjustment error:', error);
    res.status(500).json({ error: 'Failed to adjust balance' });
  }
});

// ============================================================================
// POST /api/admin/bulk/providers - Bulk actions on providers
// ============================================================================
router.post('/bulk/providers', (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (!['suspend', 'unsuspend'].includes(action)) return res.status(400).json({ error: 'action must be suspend or unsuspend' });

    const now = new Date().toISOString();
    let success = 0, failed = 0;

    for (const id of ids) {
      try {
        const provider = db.get('SELECT id, name, status FROM providers WHERE id = ?', id);
        if (!provider) { failed++; continue; }
        if (action === 'suspend') {
          db.run('UPDATE providers SET status = ?, is_paused = 1, updated_at = ? WHERE id = ?', 'suspended', now, id);
        } else {
          db.run('UPDATE providers SET status = ?, is_paused = 0, updated_at = ? WHERE id = ?', 'offline', now, id);
        }
        try { db.run('INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp) VALUES (?,?,?,?,?)',
          `bulk_provider_${action}`, 'provider', id, `Bulk ${action}: "${provider.name}"`, now); } catch(e) {}
        success++;
      } catch (e) { failed++; }
    }

    res.json({ success: true, action, processed: success, failed, total: ids.length });
  } catch (error) {
    console.error('Bulk provider action error:', error);
    res.status(500).json({ error: 'Bulk action failed' });
  }
});

// ============================================================================
// POST /api/admin/bulk/renters - Bulk actions on renters
// ============================================================================
router.post('/bulk/renters', (req, res) => {
  try {
    const { ids, action, amount_halala, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (!['suspend', 'unsuspend', 'credit'].includes(action)) return res.status(400).json({ error: 'action must be suspend, unsuspend, or credit' });
    if (action === 'credit' && (!amount_halala || typeof amount_halala !== 'number')) return res.status(400).json({ error: 'amount_halala required for credit' });

    const now = new Date().toISOString();
    let success = 0, failed = 0;

    for (const id of ids) {
      try {
        const renter = db.get('SELECT id, name, status, balance_halala FROM renters WHERE id = ?', id);
        if (!renter) { failed++; continue; }
        if (action === 'suspend') {
          db.run('UPDATE renters SET status = ? WHERE id = ?', 'suspended', id);
        } else if (action === 'unsuspend') {
          db.run('UPDATE renters SET status = ? WHERE id = ?', 'active', id);
        } else if (action === 'credit') {
          db.run('UPDATE renters SET balance_halala = balance_halala + ? WHERE id = ?', amount_halala, id);
        }
        try { db.run('INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp) VALUES (?,?,?,?,?)',
          `bulk_renter_${action}`, 'renter', id, `Bulk ${action}: "${renter.name}"${action === 'credit' ? ` +${amount_halala} halala: ${reason || 'bulk credit'}` : ''}`, now); } catch(e) {}
        success++;
      } catch (e) { failed++; }
    }

    res.json({ success: true, action, processed: success, failed, total: ids.length });
  } catch (error) {
    console.error('Bulk renter action error:', error);
    res.status(500).json({ error: 'Bulk action failed' });
  }
});

// ============================================================================
// GET /api/admin/jobs - List all jobs with filters
// ============================================================================
router.get('/jobs', (req, res) => {
  try {
    const { status, type, provider_id, renter_id } = req.query;
    const page = Math.max(parseInt(req.query.page) || 0, 0);
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const search = (req.query.search || '').trim().toLowerCase();

    let where = '1=1';
    const params = [];
    if (status) { where += ' AND j.status = ?'; params.push(status); }
    if (type) { where += ' AND j.job_type = ?'; params.push(type); }
    if (provider_id) { where += ' AND j.provider_id = ?'; params.push(provider_id); }
    if (renter_id) { where += ' AND j.renter_id = ?'; params.push(renter_id); }
    if (search) {
      where += ` AND (LOWER(j.job_id) LIKE ? OR LOWER(p.name) LIKE ? OR LOWER(r.name) LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countRow = db.get(`SELECT COUNT(*) as total FROM jobs j LEFT JOIN providers p ON j.provider_id = p.id LEFT JOIN renters r ON j.renter_id = r.id WHERE ${where}`, ...params);
    const total = countRow?.total || 0;

    let paginationSql = '';
    if (page > 0) { paginationSql = `LIMIT ${limit} OFFSET ${(page - 1) * limit}`; }
    else { paginationSql = `LIMIT ${limit}`; }

    const jobs = db.all(`SELECT j.*, p.name as provider_name, p.gpu_model, r.name as renter_name FROM jobs j LEFT JOIN providers p ON j.provider_id = p.id LEFT JOIN renters r ON j.renter_id = r.id WHERE ${where} ORDER BY j.created_at DESC ${paginationSql}`, ...params);

    const statsRow = db.get(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
              SUM(CASE WHEN status IN ('pending','assigned','running','queued') THEN 1 ELSE 0 END) as active,
              SUM(cost_halala) as total_revenue_halala
       FROM jobs`
    ) || {};

    const response = { stats: statsRow, jobs };
    if (page > 0) { response.pagination = { page, limit, total, total_pages: Math.ceil(total / limit) }; }
    res.json(response);
  } catch (error) {
    console.error('Admin jobs list error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// ============================================================================
// POST /api/admin/jobs/:id/cancel - Force cancel a job with refund
// ============================================================================
router.post('/jobs/:id/cancel', (req, res) => {
  try {
    const job = db.get('SELECT * FROM jobs WHERE id = ? OR job_id = ?', req.params.id, req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status === 'completed' || job.status === 'cancelled') {
      return res.status(400).json({ error: `Job already ${job.status}` });
    }

    db.run('UPDATE jobs SET status = ?, completed_at = ? WHERE id = ?',
      'cancelled', new Date().toISOString(), job.id);

    // Refund renter if job had a cost
    let refunded = 0;
    if (job.cost_halala && job.cost_halala > 0 && job.renter_id) {
      db.run('UPDATE renters SET balance_halala = balance_halala + ? WHERE id = ?',
        job.cost_halala, job.renter_id);
      refunded = job.cost_halala;
    }

    res.json({
      success: true,
      job_id: job.job_id || job.id,
      previous_status: job.status,
      new_status: 'cancelled',
      refunded_halala: refunded
    });
  } catch (error) {
    console.error('Admin cancel job error:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// ============================================================================
// GET /api/admin/security/events - Security & audit events
// ============================================================================
router.get('/security/events', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const events = [];

    // 1. Failed/timed-out jobs (high severity)
    const failedJobs = db.all(
      `SELECT j.id, j.job_id, j.status, j.error, j.completed_at as timestamp,
              j.provider_id, p.name as provider_name, j.renter_id, r.name as renter_name
       FROM jobs j
       LEFT JOIN providers p ON j.provider_id = p.id
       LEFT JOIN renters r ON j.renter_id = r.id
       WHERE j.status = 'failed'
       ORDER BY j.completed_at DESC LIMIT ?`, limit
    );
    failedJobs.forEach(j => {
      events.push({
        id: j.id,
        timestamp: j.timestamp,
        event_type: 'job_failure',
        severity: j.error?.includes('timed out') ? 'medium' : 'high',
        provider_id: j.provider_id,
        provider_name: j.provider_name,
        details: `Job ${j.job_id} failed: ${j.error || 'Unknown error'} (Renter: ${j.renter_name || 'Unknown'})`
      });
    });

    // 2. Provider disconnections (medium severity)
    const disconnected = db.all(
      `SELECT id, name, last_heartbeat, provider_ip
       FROM providers
       WHERE last_heartbeat IS NOT NULL
         AND datetime(last_heartbeat) < datetime('now', '-5 minutes')
       ORDER BY last_heartbeat DESC LIMIT ?`, limit
    );
    disconnected.forEach(p => {
      events.push({
        id: 10000 + p.id,
        timestamp: p.last_heartbeat,
        event_type: 'provider_disconnect',
        severity: 'medium',
        provider_id: p.id,
        provider_name: p.name,
        details: `Provider went offline. Last heartbeat: ${p.last_heartbeat}. IP: ${p.provider_ip || 'Unknown'}`
      });
    });

    // 3. Daemon crash events (high severity)
    try {
      const crashes = db.all(
        `SELECT de.id, de.event_timestamp as timestamp, de.provider_id, de.details, de.severity,
                p.name as provider_name
         FROM daemon_events de
         LEFT JOIN providers p ON de.provider_id = p.id
         WHERE de.event_type IN ('daemon_crash', 'watchdog_restart', 'watchdog_givingup')
         ORDER BY de.event_timestamp DESC LIMIT ?`, limit
      );
      crashes.forEach(c => {
        events.push({
          id: 20000 + c.id,
          timestamp: c.timestamp,
          event_type: c.details?.includes('watchdog') ? 'watchdog_restart' : 'daemon_crash',
          severity: c.severity || 'high',
          provider_id: c.provider_id,
          provider_name: c.provider_name,
          details: c.details || 'Daemon crash detected'
        });
      });
    } catch(e) { /* daemon_events table may not exist yet */ }

    // 4. Suspended accounts (low severity, informational)
    const suspended = db.all(
      `SELECT id, name, 'provider' as account_type, updated_at as timestamp FROM providers WHERE status = 'suspended'
       UNION ALL
       SELECT id, name, 'renter' as account_type, created_at as timestamp FROM renters WHERE status = 'suspended'`
    );
    suspended.forEach(s => {
      events.push({
        id: 30000 + s.id,
        timestamp: s.timestamp,
        event_type: 'account_suspended',
        severity: 'low',
        provider_id: s.account_type === 'provider' ? s.id : null,
        provider_name: s.name,
        details: `${s.account_type.charAt(0).toUpperCase() + s.account_type.slice(1)} "${s.name}" is suspended`
      });
    });

    // 5. Refunded jobs (medium severity)
    const refunded = db.all(
      `SELECT j.id, j.job_id, j.refunded_at as timestamp, j.cost_halala,
              j.provider_id, p.name as provider_name, r.name as renter_name
       FROM jobs j
       LEFT JOIN providers p ON j.provider_id = p.id
       LEFT JOIN renters r ON j.renter_id = r.id
       WHERE j.refunded_at IS NOT NULL
       ORDER BY j.refunded_at DESC LIMIT ?`, limit
    );
    refunded.forEach(j => {
      events.push({
        id: 40000 + j.id,
        timestamp: j.timestamp,
        event_type: 'job_refunded',
        severity: 'medium',
        provider_id: j.provider_id,
        provider_name: j.provider_name,
        details: `Refunded ${j.cost_halala} halala (${(j.cost_halala/100).toFixed(2)} SAR) for job ${j.job_id} to ${j.renter_name}`
      });
    });

    // Sort all events by timestamp descending, limit
    events.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    res.json({ events: events.slice(0, limit) });
  } catch (error) {
    console.error('Security events error:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

// ============================================================================
// GET /api/admin/security/summary - Security summary stats
// ============================================================================
router.get('/security/summary', (req, res) => {
  try {
    const failedJobs = db.get('SELECT COUNT(*) as cnt FROM jobs WHERE status = ?', 'failed') || { cnt: 0 };

    let crashCount = 0;
    try {
      const cc = db.get(
        `SELECT COUNT(*) as cnt FROM daemon_events WHERE event_type IN ('daemon_crash', 'watchdog_restart', 'watchdog_givingup')`
      );
      crashCount = cc?.cnt || 0;
    } catch(e) {}

    const disconnectedProviders = db.get(
      `SELECT COUNT(*) as cnt FROM providers
       WHERE last_heartbeat IS NOT NULL AND datetime(last_heartbeat) < datetime('now', '-5 minutes')`
    ) || { cnt: 0 };

    const suspendedAccounts = db.get(
      `SELECT
        (SELECT COUNT(*) FROM providers WHERE status = 'suspended') +
        (SELECT COUNT(*) FROM renters WHERE status = 'suspended') as cnt`
    ) || { cnt: 0 };

    const totalEvents = failedJobs.cnt + crashCount + disconnectedProviders.cnt + suspendedAccounts.cnt;

    res.json({
      total_events: totalEvents,
      high_severity: failedJobs.cnt + crashCount,
      medium_severity: disconnectedProviders.cnt,
      flagged_providers: disconnectedProviders.cnt + (db.get("SELECT COUNT(*) as cnt FROM providers WHERE status = 'suspended'") || { cnt: 0 }).cnt
    });
  } catch (error) {
    console.error('Security summary error:', error);
    res.status(500).json({ error: 'Failed to fetch security summary' });
  }
});

// ============================================================================
// POST /api/admin/providers/:id/rotate-key - Force-rotate provider API key
// ============================================================================
router.post('/providers/:id/rotate-key', (req, res) => {
  try {
    const provider = db.get('SELECT id, name FROM providers WHERE id = ?', req.params.id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const newKey = 'dc1-provider-' + crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    db.run('UPDATE providers SET api_key = ?, updated_at = ? WHERE id = ?', newKey, now, provider.id);
    try { db.run('INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp) VALUES (?,?,?,?,?)', 'key_rotated', 'provider', provider.id, `Force-rotated API key for "${provider.name}"`, now); } catch(e) {}

    res.json({ success: true, provider_id: provider.id, name: provider.name, new_api_key: newKey });
  } catch (error) {
    console.error('Admin rotate provider key error:', error);
    res.status(500).json({ error: 'Key rotation failed' });
  }
});

// ============================================================================
// POST /api/admin/renters/:id/rotate-key - Force-rotate renter API key
// ============================================================================
router.post('/renters/:id/rotate-key', (req, res) => {
  try {
    const renter = db.get('SELECT id, name FROM renters WHERE id = ?', req.params.id);
    if (!renter) return res.status(404).json({ error: 'Renter not found' });

    const newKey = 'dc1-renter-' + crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    db.run('UPDATE renters SET api_key = ?, updated_at = ? WHERE id = ?', newKey, now, renter.id);
    try { db.run('INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp) VALUES (?,?,?,?,?)', 'key_rotated', 'renter', renter.id, `Force-rotated API key for "${renter.name}"`, now); } catch(e) {}

    res.json({ success: true, renter_id: renter.id, name: renter.name, new_api_key: newKey });
  } catch (error) {
    console.error('Admin rotate renter key error:', error);
    res.status(500).json({ error: 'Key rotation failed' });
  }
});

// ============================================================================
// GET /api/admin/withdrawals - List all withdrawal requests
// ============================================================================
router.get('/withdrawals', (req, res) => {
  try {
    const statusFilter = req.query.status || '';
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let where = '1=1';
    const params = [];
    if (statusFilter) { where += ' AND w.status = ?'; params.push(statusFilter); }

    const countRow = db.get(`SELECT COUNT(*) as total FROM withdrawals w WHERE ${where}`, ...params);
    const total = countRow?.total || 0;

    const withdrawals = db.all(`
      SELECT w.*, p.name as provider_name, p.email as provider_email,
             p.total_earnings as provider_total_earnings
      FROM withdrawals w
      LEFT JOIN providers p ON w.provider_id = p.id
      WHERE ${where}
      ORDER BY CASE WHEN w.status = 'pending' THEN 0 ELSE 1 END, w.requested_at DESC
      LIMIT ? OFFSET ?
    `, ...params, limit, offset);

    const summary = db.get(`
      SELECT COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
             COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_sar ELSE 0 END), 0) as pending_total,
             COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_sar ELSE 0 END), 0) as approved_total,
             COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_sar ELSE 0 END), 0) as paid_total,
             COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount_sar ELSE 0 END), 0) as rejected_total
      FROM withdrawals
    `) || {};

    res.json({
      withdrawals,
      summary,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Admin withdrawals error:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// ============================================================================
// POST /api/admin/withdrawals/:id/approve - Approve withdrawal
// ============================================================================
router.post('/withdrawals/:id/approve', (req, res) => {
  try {
    const w = db.get('SELECT * FROM withdrawals WHERE id = ? OR withdrawal_id = ?', req.params.id, req.params.id);
    if (!w) return res.status(404).json({ error: 'Withdrawal not found' });
    if (w.status !== 'pending') return res.status(400).json({ error: `Cannot approve — status is ${w.status}` });

    const now = new Date().toISOString();
    db.run('UPDATE withdrawals SET status = ?, processed_at = ?, notes = ? WHERE id = ?',
      'approved', now, req.body.notes || 'Approved by admin', w.id);

    // Log to audit
    try {
      db.run(`INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp)
              VALUES (?, ?, ?, ?, ?)`,
        'withdrawal_approved', 'withdrawal', w.id,
        `Approved ${w.amount_sar} SAR for provider ${w.provider_id}`, now);
    } catch(e) { /* audit table may not exist yet */ }

    res.json({ success: true, withdrawal_id: w.withdrawal_id, new_status: 'approved', amount_sar: w.amount_sar });
  } catch (error) {
    console.error('Approve withdrawal error:', error);
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
});

// ============================================================================
// POST /api/admin/withdrawals/:id/reject - Reject withdrawal
// ============================================================================
router.post('/withdrawals/:id/reject', (req, res) => {
  try {
    const w = db.get('SELECT * FROM withdrawals WHERE id = ? OR withdrawal_id = ?', req.params.id, req.params.id);
    if (!w) return res.status(404).json({ error: 'Withdrawal not found' });
    if (w.status !== 'pending') return res.status(400).json({ error: `Cannot reject — status is ${w.status}` });

    const now = new Date().toISOString();
    db.run('UPDATE withdrawals SET status = ?, processed_at = ?, notes = ? WHERE id = ?',
      'rejected', now, req.body.reason || 'Rejected by admin', w.id);

    try {
      db.run(`INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp)
              VALUES (?, ?, ?, ?, ?)`,
        'withdrawal_rejected', 'withdrawal', w.id,
        `Rejected ${w.amount_sar} SAR for provider ${w.provider_id}: ${req.body.reason || 'No reason'}`, now);
    } catch(e) {}

    res.json({ success: true, withdrawal_id: w.withdrawal_id, new_status: 'rejected', reason: req.body.reason || '' });
  } catch (error) {
    console.error('Reject withdrawal error:', error);
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
});

// ============================================================================
// POST /api/admin/withdrawals/:id/complete - Mark withdrawal as paid
// ============================================================================
router.post('/withdrawals/:id/complete', (req, res) => {
  try {
    const w = db.get('SELECT * FROM withdrawals WHERE id = ? OR withdrawal_id = ?', req.params.id, req.params.id);
    if (!w) return res.status(404).json({ error: 'Withdrawal not found' });
    if (w.status !== 'approved') return res.status(400).json({ error: `Can only complete approved withdrawals — status is ${w.status}` });

    const now = new Date().toISOString();
    db.run('UPDATE withdrawals SET status = ?, processed_at = ?, notes = ? WHERE id = ?',
      'completed', now, req.body.notes || 'Payment sent', w.id);

    try {
      db.run(`INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp)
              VALUES (?, ?, ?, ?, ?)`,
        'withdrawal_completed', 'withdrawal', w.id,
        `Paid ${w.amount_sar} SAR to provider ${w.provider_id}`, now);
    } catch(e) {}

    res.json({ success: true, withdrawal_id: w.withdrawal_id, new_status: 'completed', amount_sar: w.amount_sar });
  } catch (error) {
    console.error('Complete withdrawal error:', error);
    res.status(500).json({ error: 'Failed to complete withdrawal' });
  }
});

// ============================================================================
// GET /api/admin/audit - Audit log
// ============================================================================
router.get('/audit', (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;

    let entries = [];
    let total = 0;
    try {
      const countRow = db.get('SELECT COUNT(*) as total FROM admin_audit_log');
      total = countRow?.total || 0;
      entries = db.all('SELECT * FROM admin_audit_log ORDER BY timestamp DESC LIMIT ? OFFSET ?', limit, offset);
    } catch(e) { /* table may not exist yet */ }

    res.json({ entries, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ============================================================================
// GET /api/admin/finance/summary - Financial overview
// ============================================================================
router.get('/finance/summary', (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setUTCHours(0,0,0,0);
    const weekStart = new Date(todayStart.getTime() - 7*24*60*60*1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // All-time totals
    const allTime = db.get(`
      SELECT COALESCE(SUM(actual_cost_halala), 0) as total_revenue,
             COALESCE(SUM(provider_earned_halala), 0) as total_provider_payouts,
             COALESCE(SUM(dc1_fee_halala), 0) as total_dc1_fees,
             COUNT(*) as total_jobs,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs
      FROM jobs WHERE status = 'completed'
    `) || {};

    // Today
    const today = db.get(`
      SELECT COALESCE(SUM(actual_cost_halala), 0) as revenue,
             COALESCE(SUM(dc1_fee_halala), 0) as dc1_fees,
             COUNT(*) as jobs
      FROM jobs WHERE status = 'completed' AND completed_at >= ?
    `, todayStart.toISOString()) || {};

    // This week
    const week = db.get(`
      SELECT COALESCE(SUM(actual_cost_halala), 0) as revenue,
             COALESCE(SUM(dc1_fee_halala), 0) as dc1_fees,
             COUNT(*) as jobs
      FROM jobs WHERE status = 'completed' AND completed_at >= ?
    `, weekStart.toISOString()) || {};

    // This month
    const month = db.get(`
      SELECT COALESCE(SUM(actual_cost_halala), 0) as revenue,
             COALESCE(SUM(dc1_fee_halala), 0) as dc1_fees,
             COUNT(*) as jobs
      FROM jobs WHERE status = 'completed' AND completed_at >= ?
    `, monthStart.toISOString()) || {};

    // Renter balances (money held)
    const renterBalances = db.get(`
      SELECT COALESCE(SUM(balance_halala), 0) as total_held,
             COUNT(*) as total_renters,
             SUM(CASE WHEN balance_halala > 0 THEN 1 ELSE 0 END) as funded_renters
      FROM renters WHERE status = 'active'
    `) || {};

    // Pending withdrawals
    const withdrawals = db.get(`
      SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_sar ELSE 0 END), 0) as pending_sar,
             COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_sar ELSE 0 END), 0) as approved_sar,
             COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_sar ELSE 0 END), 0) as paid_sar,
             COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
      FROM withdrawals
    `) || {};

    // Top 5 providers by earnings
    const topProviders = db.all(`
      SELECT p.id, p.name, p.gpu_model,
             COALESCE(SUM(j.provider_earned_halala), 0) as total_earned,
             COUNT(j.id) as job_count
      FROM providers p
      LEFT JOIN jobs j ON j.provider_id = p.id AND j.status = 'completed'
      GROUP BY p.id
      HAVING total_earned > 0
      ORDER BY total_earned DESC LIMIT 5
    `);

    // Top 5 renters by spend
    const topRenters = db.all(`
      SELECT r.id, r.name, r.email, r.balance_halala,
             COALESCE(SUM(j.actual_cost_halala), 0) as total_spent,
             COUNT(j.id) as job_count
      FROM renters r
      LEFT JOIN jobs j ON j.renter_id = r.id AND j.status = 'completed'
      GROUP BY r.id
      HAVING total_spent > 0
      ORDER BY total_spent DESC LIMIT 5
    `);

    // Daily revenue for last 14 days
    const dailyRevenue = db.all(`
      SELECT DATE(completed_at) as day,
             COALESCE(SUM(actual_cost_halala), 0) as revenue,
             COALESCE(SUM(dc1_fee_halala), 0) as dc1_fees,
             COALESCE(SUM(provider_earned_halala), 0) as provider_payouts,
             COUNT(*) as jobs
      FROM jobs
      WHERE status = 'completed' AND completed_at >= DATE('now', '-14 days')
      GROUP BY DATE(completed_at)
      ORDER BY day ASC
    `);

    // Reconciliation check — jobs where split doesn't add up
    const discrepancies = db.all(`
      SELECT id, job_id, actual_cost_halala, provider_earned_halala, dc1_fee_halala
      FROM jobs
      WHERE status = 'completed'
        AND actual_cost_halala IS NOT NULL
        AND (provider_earned_halala + dc1_fee_halala) != actual_cost_halala
      LIMIT 10
    `);

    res.json({
      all_time: allTime,
      today,
      this_week: week,
      this_month: month,
      renter_balances: renterBalances,
      withdrawals,
      top_providers: topProviders,
      top_renters: topRenters,
      daily_revenue: dailyRevenue,
      discrepancies,
      generated_at: now.toISOString()
    });
  } catch (error) {
    console.error('Finance summary error:', error);
    res.status(500).json({ error: 'Failed to fetch finance summary' });
  }
});

// ============================================================================
// GET /api/admin/finance/transactions - Paginated billing transactions
// ============================================================================
router.get('/finance/transactions', (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { type, renter_id, provider_id } = req.query;

    let where = "WHERE j.status = 'completed' AND j.actual_cost_halala > 0";
    const params = [];
    if (type) { where += ' AND j.job_type = ?'; params.push(type); }
    if (renter_id) { where += ' AND j.renter_id = ?'; params.push(renter_id); }
    if (provider_id) { where += ' AND j.provider_id = ?'; params.push(provider_id); }

    const countRow = db.get(`SELECT COUNT(*) as total FROM jobs j ${where}`, ...params);
    const total = countRow?.total || 0;

    const transactions = db.all(`
      SELECT j.id, j.job_id, j.job_type, j.completed_at, j.actual_cost_halala,
             j.provider_earned_halala, j.dc1_fee_halala, j.actual_duration_minutes,
             p.name as provider_name, r.name as renter_name
      FROM jobs j
      LEFT JOIN providers p ON j.provider_id = p.id
      LEFT JOIN renters r ON j.renter_id = r.id
      ${where}
      ORDER BY j.completed_at DESC
      LIMIT ? OFFSET ?
    `, ...params, limit, offset);

    res.json({
      transactions,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Finance transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ── Health Monitoring ─────────────────────────────────────────────────
router.get('/health', (req, res) => {
  try {
    // DB check
    const dbCheck = db.get("SELECT COUNT(*) as count FROM providers");
    const dbOk = dbCheck !== undefined;

    // Provider stats
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const onlineProviders = db.get(
      "SELECT COUNT(*) as count FROM providers WHERE last_heartbeat > ? AND status = 'active'",
      fiveMinAgo
    )?.count || 0;
    const totalProviders = db.get("SELECT COUNT(*) as count FROM providers WHERE status = 'active'")?.count || 0;

    // Active jobs
    const activeJobs = db.get(
      "SELECT COUNT(*) as count FROM jobs WHERE status IN ('queued', 'pending', 'running')"
    )?.count || 0;
    const stuckJobs = db.get(
      "SELECT COUNT(*) as count FROM jobs WHERE status = 'running' AND started_at < ?",
      new Date(Date.now() - 30 * 60 * 1000).toISOString()
    )?.count || 0;

    // Recent errors (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentErrors = db.get(
      "SELECT COUNT(*) as count FROM jobs WHERE status = 'failed' AND completed_at > ?",
      oneHourAgo
    )?.count || 0;

    // Daemon events (critical/error in last hour)
    let criticalEvents = 0;
    try {
      criticalEvents = db.get(
        "SELECT COUNT(*) as count FROM daemon_events WHERE severity IN ('critical', 'error') AND event_timestamp > ?",
        oneHourAgo
      )?.count || 0;
    } catch (e) { /* daemon_events may not exist */ }

    // Withdrawal backlog
    const pendingWithdrawals = db.get(
      "SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'"
    )?.count || 0;

    const healthy = dbOk && stuckJobs === 0 && criticalEvents === 0;

    res.json({
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'ok' : 'error',
        providers: { online: onlineProviders, total: totalProviders },
        jobs: { active: activeJobs, stuck: stuckJobs },
        errors: { failed_last_hour: recentErrors, critical_events: criticalEvents },
        withdrawals: { pending: pendingWithdrawals }
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// ── Financial Reconciliation ─────────────────────────────────────────
router.get('/finance/reconciliation', (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // 1. Jobs where provider_earned + dc1_fee != actual_cost
    const splitMismatches = db.all(`
      SELECT j.id, j.job_id, j.job_type, j.actual_cost_halala,
             j.provider_earned_halala, j.dc1_fee_halala, j.completed_at,
             p.name as provider_name, r.name as renter_name,
             (j.provider_earned_halala + j.dc1_fee_halala) as computed_total,
             (j.actual_cost_halala - j.provider_earned_halala - j.dc1_fee_halala) as discrepancy
      FROM jobs j
      LEFT JOIN providers p ON j.provider_id = p.id
      LEFT JOIN renters r ON j.renter_id = r.id
      WHERE j.status = 'completed'
        AND j.actual_cost_halala > 0
        AND j.completed_at > ?
        AND (j.provider_earned_halala + j.dc1_fee_halala) != j.actual_cost_halala
      ORDER BY j.completed_at DESC
      LIMIT 100
    `, since);

    // 2. Jobs with missing billing data
    const missingBilling = db.all(`
      SELECT j.id, j.job_id, j.job_type, j.completed_at,
             j.actual_cost_halala, j.provider_earned_halala, j.dc1_fee_halala,
             p.name as provider_name
      FROM jobs j
      LEFT JOIN providers p ON j.provider_id = p.id
      WHERE j.status = 'completed'
        AND j.completed_at > ?
        AND (j.actual_cost_halala IS NULL OR j.actual_cost_halala = 0
             OR j.provider_earned_halala IS NULL OR j.dc1_fee_halala IS NULL)
      ORDER BY j.completed_at DESC
      LIMIT 100
    `, since);

    // 3. Provider earnings vs job totals
    const providerMismatches = db.all(`
      SELECT p.id, p.name, p.email,
             ROUND(p.total_earnings * 100) as recorded_earnings_halala,
             COALESCE(SUM(j.provider_earned_halala), 0) as computed_earnings_halala,
             ROUND(p.total_earnings * 100) - COALESCE(SUM(j.provider_earned_halala), 0) as drift
      FROM providers p
      LEFT JOIN jobs j ON j.provider_id = p.id AND j.status = 'completed' AND j.provider_earned_halala > 0
      GROUP BY p.id
      HAVING ABS(drift) > 1
      ORDER BY ABS(drift) DESC
      LIMIT 50
    `);

    // 4. Renter spend vs job totals
    const renterMismatches = db.all(`
      SELECT r.id, r.name, r.email,
             r.total_spent_halala as recorded_spent,
             COALESCE(SUM(j.actual_cost_halala), 0) as computed_spent,
             r.total_spent_halala - COALESCE(SUM(j.actual_cost_halala), 0) as drift
      FROM renters r
      LEFT JOIN jobs j ON j.renter_id = r.id AND j.status = 'completed' AND j.actual_cost_halala > 0
      GROUP BY r.id
      HAVING ABS(drift) > 1
      ORDER BY ABS(drift) DESC
      LIMIT 50
    `);

    // 5. Summary stats
    const totalCompleted = db.get(
      "SELECT COUNT(*) as count, SUM(actual_cost_halala) as total_billed FROM jobs WHERE status = 'completed' AND completed_at > ?",
      since
    );

    res.json({
      period_days: days,
      since,
      summary: {
        total_completed_jobs: totalCompleted?.count || 0,
        total_billed_halala: totalCompleted?.total_billed || 0,
        split_mismatches: splitMismatches.length,
        missing_billing: missingBilling.length,
        provider_drift_count: providerMismatches.length,
        renter_drift_count: renterMismatches.length
      },
      issues: {
        split_mismatches: splitMismatches,
        missing_billing: missingBilling,
        provider_earnings_drift: providerMismatches,
        renter_spend_drift: renterMismatches
      }
    });
  } catch (error) {
    console.error('Reconciliation error:', error);
    res.status(500).json({ error: 'Failed to run reconciliation' });
  }
});

// ── Notification Config ──────────────────────────────────────────────────
router.get('/notifications/config', (req, res) => {
  try {
    const config = getNotifConfig();
    if (!config) return res.json({ enabled: false });
    // Don't expose full tokens
    res.json({
      enabled: !!config.enabled,
      webhook_url: config.webhook_url || '',
      telegram_configured: !!(config.telegram_bot_token && config.telegram_chat_id),
      telegram_chat_id: config.telegram_chat_id || '',
      updated_at: config.updated_at,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get notification config' });
  }
});

router.post('/notifications/config', (req, res) => {
  try {
    const { webhook_url, telegram_bot_token, telegram_chat_id, enabled } = req.body;
    const now = new Date().toISOString();
    getNotifConfig(); // ensure table + row exists
    const updates = [];
    const params = [];
    if (webhook_url !== undefined) { updates.push('webhook_url = ?'); params.push(webhook_url || null); }
    if (telegram_bot_token !== undefined) { updates.push('telegram_bot_token = ?'); params.push(telegram_bot_token || null); }
    if (telegram_chat_id !== undefined) { updates.push('telegram_chat_id = ?'); params.push(telegram_chat_id || null); }
    if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
    updates.push('updated_at = ?'); params.push(now);
    if (updates.length > 1) {
      db.run(`UPDATE notification_config SET ${updates.join(', ')} WHERE id = 1`, ...params);
    }
    try { db.run('INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp) VALUES (?,?,?,?,?)',
      'notification_config_updated', 'system', 0, `Updated notification config: enabled=${enabled}`, now); } catch(e) {}
    res.json({ success: true, message: 'Notification config updated' });
  } catch (error) {
    console.error('Notification config error:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

router.post('/notifications/test', (req, res) => {
  (async () => {
    try {
      const result = await sendAlert('test_alert', 'This is a test alert from DC1 Admin Panel. If you see this, notifications are working!');
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Test notification error:', error);
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  })();
});

// ─── Admin: Payments (DCP-31) ─────────────────────────────────────────────────

// GET /api/admin/payments — All payments with filters
router.get('/payments', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const statusFilter = req.query.status || '';
    const search = (req.query.search || '').trim().toLowerCase();

    let where = '1=1';
    const wParams = [];
    if (statusFilter) {
      where += ' AND p.status = ?';
      wParams.push(statusFilter);
    }
    if (search) {
      where += ' AND (LOWER(r.email) LIKE ? OR LOWER(r.name) LIKE ? OR p.payment_id LIKE ?)';
      wParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const payments = db.all(
      `SELECT p.id, p.payment_id, p.amount_sar, p.amount_halala, p.status,
              p.source_type, p.description, p.created_at, p.confirmed_at,
              p.refunded_at, p.refund_amount_halala,
              r.id as renter_id, r.name as renter_name, r.email as renter_email
       FROM payments p
       JOIN renters r ON r.id = p.renter_id
       WHERE ${where}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      ...wParams, limit, offset
    );

    const total = db.get(
      `SELECT COUNT(*) as count FROM payments p JOIN renters r ON r.id = p.renter_id WHERE ${where}`,
      ...wParams
    );

    // Summary stats
    const summary = db.get(
      `SELECT
         COUNT(*) as total_payments,
         COALESCE(SUM(CASE WHEN status='paid' THEN amount_halala ELSE 0 END), 0) as total_revenue_halala,
         COALESCE(SUM(CASE WHEN status='refunded' THEN refund_amount_halala ELSE 0 END), 0) as total_refunded_halala,
         COUNT(CASE WHEN status='initiated' THEN 1 END) as pending_count,
         COUNT(CASE WHEN status='paid' THEN 1 END) as paid_count,
         COUNT(CASE WHEN status='failed' THEN 1 END) as failed_count,
         COUNT(CASE WHEN status='refunded' THEN 1 END) as refunded_count
       FROM payments`
    );

    res.json({
      payments,
      pagination: { limit, offset, total: total.count },
      summary: {
        ...summary,
        total_revenue_sar: summary.total_revenue_halala / 100,
        total_refunded_sar: summary.total_refunded_halala / 100,
      },
    });
  } catch (error) {
    console.error('Admin payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// GET /api/admin/payments/revenue — Revenue breakdown by day/month
router.get('/payments/revenue', (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const daily = db.all(
      `SELECT DATE(confirmed_at) as date,
              COUNT(*) as transactions,
              COALESCE(SUM(amount_halala), 0) as revenue_halala
       FROM payments
       WHERE status = 'paid' AND confirmed_at >= ?
       GROUP BY DATE(confirmed_at)
       ORDER BY date DESC`,
      since
    );

    const totals = db.get(
      `SELECT COALESCE(SUM(amount_halala), 0) as total_halala, COUNT(*) as total_transactions
       FROM payments WHERE status = 'paid' AND confirmed_at >= ?`,
      since
    );

    res.json({
      period_days: days,
      total_revenue_halala: totals.total_halala,
      total_revenue_sar: totals.total_halala / 100,
      total_transactions: totals.total_transactions,
      daily: daily.map(d => ({ ...d, revenue_sar: d.revenue_halala / 100 })),
    });
  } catch (error) {
    console.error('Admin revenue error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// POST /api/admin/payments/:paymentId/refund — Initiate Moyasar refund
router.post('/payments/:paymentId/refund', (req, res) => {
  const { paymentId } = req.params;
  const { amount_halala, reason } = req.body;

  const payment = db.get('SELECT * FROM payments WHERE payment_id = ?', paymentId);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status !== 'paid') {
    return res.status(400).json({ error: `Cannot refund payment with status: ${payment.status}` });
  }
  if (payment.refunded_at) {
    return res.status(400).json({ error: 'Payment already refunded' });
  }

  const refundAmount = amount_halala || payment.amount_halala;
  if (refundAmount > payment.amount_halala) {
    return res.status(400).json({ error: 'Refund amount exceeds original payment' });
  }

  // If no Moyasar key, do a manual/internal refund
  const MOYASAR_SECRET = process.env.MOYASAR_SECRET_KEY || '';
  if (!MOYASAR_SECRET || payment.payment_id.startsWith('sandbox-')) {
    const now = new Date().toISOString();
    db.run(
      `UPDATE payments SET status = 'refunded', refunded_at = ?, refund_amount_halala = ? WHERE payment_id = ?`,
      now, refundAmount, paymentId
    );
    db.run(
      `UPDATE renters SET balance_halala = MAX(0, balance_halala - ?), updated_at = ? WHERE id = ?`,
      refundAmount, now, payment.renter_id
    );
    return res.json({
      success: true,
      type: 'manual',
      payment_id: paymentId,
      refunded_halala: refundAmount,
      refunded_sar: refundAmount / 100,
      note: reason || 'Admin-initiated refund',
    });
  }

  // Call Moyasar refund API
  const https = require('https');
  const auth = Buffer.from(`${MOYASAR_SECRET}:`).toString('base64');
  const bodyStr = JSON.stringify({ amount: refundAmount });
  const options = {
    hostname: 'api.moyasar.com',
    path: `/v1/payments/${paymentId}/refund`,
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
    },
  };

  const apiReq = https.request(options, apiRes => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (apiRes.statusCode >= 400) {
          return res.status(502).json({ error: 'Moyasar refund failed', details: result });
        }
        const now = new Date().toISOString();
        db.run(
          `UPDATE payments SET status = 'refunded', refunded_at = ?, refund_amount_halala = ?, gateway_response = ? WHERE payment_id = ?`,
          now, refundAmount, JSON.stringify(result), paymentId
        );
        db.run(
          `UPDATE renters SET balance_halala = MAX(0, balance_halala - ?), updated_at = ? WHERE id = ?`,
          refundAmount, now, payment.renter_id
        );
        res.json({ success: true, type: 'moyasar', payment_id: paymentId, refunded_halala: refundAmount, refunded_sar: refundAmount / 100 });
      } catch {
        res.status(502).json({ error: 'Invalid Moyasar refund response' });
      }
    });
  });
  apiReq.on('error', err => res.status(502).json({ error: 'Moyasar API unreachable', details: err.message }));
  apiReq.write(bodyStr);
  apiReq.end();
});

// ============================================================================
// GET /api/admin/escrow — Escrow holds overview (DCP-32)
// ============================================================================
router.get('/escrow', requireAdmin, (req, res) => {
  try {
    const { status, provider_id } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND e.status = ?'; params.push(status); }
    if (provider_id) { where += ' AND e.provider_id = ?'; params.push(parseInt(provider_id)); }

    const holds = db.all(
      `SELECT e.id, e.job_id, e.renter_api_key, e.provider_id, e.amount_halala, e.status,
              e.created_at, e.expires_at, e.resolved_at,
              p.name as provider_name,
              r.name as renter_name
       FROM escrow_holds e
       LEFT JOIN providers p ON e.provider_id = p.id
       LEFT JOIN renters r ON r.api_key = e.renter_api_key
       ${where}
       ORDER BY e.created_at DESC LIMIT ?`,
      ...params, limit
    );

    const summary = db.get(
      `SELECT
         COUNT(*) as total,
         COALESCE(SUM(CASE WHEN status = 'held' THEN amount_halala END), 0) as held_halala,
         COALESCE(SUM(CASE WHEN status = 'locked' THEN amount_halala END), 0) as locked_halala,
         COALESCE(SUM(CASE WHEN status = 'released_provider' THEN amount_halala END), 0) as released_provider_halala,
         COALESCE(SUM(CASE WHEN status = 'released_renter' THEN amount_halala END), 0) as released_renter_halala,
         COALESCE(SUM(CASE WHEN status = 'expired' THEN amount_halala END), 0) as expired_halala,
         COUNT(CASE WHEN status = 'held' THEN 1 END) as held_count,
         COUNT(CASE WHEN status = 'locked' THEN 1 END) as locked_count
       FROM escrow_holds`
    );

    res.json({
      summary: {
        ...summary,
        held_sar: ((summary.held_halala || 0) / 100).toFixed(2),
        locked_sar: ((summary.locked_halala || 0) / 100).toFixed(2),
        released_provider_sar: ((summary.released_provider_halala || 0) / 100).toFixed(2),
        released_renter_sar: ((summary.released_renter_halala || 0) / 100).toFixed(2),
      },
      holds: holds.map(h => ({
        ...h,
        amount_sar: (h.amount_halala / 100).toFixed(2),
        renter_api_key: h.renter_api_key ? h.renter_api_key.slice(0, 16) + '...' : null,
      }))
    });
  } catch (error) {
    console.error('Admin escrow error:', error);
    res.status(500).json({ error: 'Failed to fetch escrow data' });
  }
});

module.exports = router;
