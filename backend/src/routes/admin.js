const express = require('express');
const router = express.Router();
const db = require('../db');

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
    const renters = db.all(
      `SELECT id, name, email, organization, balance_halala, status, created_at
       FROM renters ORDER BY created_at DESC`
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
    res.json({
      total: enriched.length,
      active: enriched.filter(r => r.status === 'active').length,
      suspended: enriched.filter(r => r.status === 'suspended').length,
      renters: enriched
    });
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
    db.run('UPDATE providers SET status = ?, is_paused = 1, updated_at = ? WHERE id = ?',
      'suspended', new Date().toISOString(), req.params.id);
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
    db.run('UPDATE providers SET status = ?, is_paused = 0, updated_at = ? WHERE id = ?',
      'offline', new Date().toISOString(), req.params.id);
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
// GET /api/admin/jobs - List all jobs with filters
// ============================================================================
router.get('/jobs', (req, res) => {
  try {
    const { status, type, provider_id, renter_id, limit: limitParam } = req.query;
    let query = `SELECT j.*, p.name as provider_name, p.gpu_model,
                        r.name as renter_name
                 FROM jobs j
                 LEFT JOIN providers p ON j.provider_id = p.id
                 LEFT JOIN renters r ON j.renter_id = r.id
                 WHERE 1=1`;
    const params = [];
    if (status) { query += ' AND j.status = ?'; params.push(status); }
    if (type) { query += ' AND j.job_type = ?'; params.push(type); }
    if (provider_id) { query += ' AND j.provider_id = ?'; params.push(provider_id); }
    if (renter_id) { query += ' AND j.renter_id = ?'; params.push(renter_id); }
    query += ' ORDER BY j.created_at DESC';
    const limit = Math.min(parseInt(limitParam) || 100, 500);
    query += ' LIMIT ?';
    params.push(limit);

    const jobs = db.all(query, ...params);
    const statsRow = db.get(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
              SUM(CASE WHEN status IN ('pending','assigned','running') THEN 1 ELSE 0 END) as active,
              SUM(cost_halala) as total_revenue_halala
       FROM jobs`
    ) || {};

    res.json({ stats: statsRow, jobs });
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

module.exports = router;
