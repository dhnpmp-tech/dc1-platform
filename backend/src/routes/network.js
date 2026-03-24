const express = require('express');
const db = require('../db');
const { requireAdminAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/network/providers?available=true
 *
 * HTTP fallback for provider discovery when P2P bootstrap is unavailable.
 * Returns providers with active heartbeat (last_seen_at < 90s ago).
 *
 * Query params:
 *   available=true  — filter to only available providers
 *   gpu_model       — filter by GPU model
 *   min_vram_gb     — filter by minimum VRAM
 *   limit           — max results (default: 100, max: 500)
 */
router.get('/providers', (req, res) => {
  try {
    const available = req.query.available === 'true' || req.query.available === '1';
    const gpuModel = req.query.gpu_model;
    const minVramGb = req.query.min_vram_gb ? parseInt(req.query.min_vram_gb, 10) : null;

    // Safely parse limit to avoid NaN when Math.min receives invalid input
    const rawLimit = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const limit = Math.min(
      (rawLimit !== null && Number.isFinite(rawLimit) && rawLimit > 0) ? rawLimit : 100,
      500
    );

    // Build dynamic query
    let sql = `
      SELECT
        id,
        p2p_peer_id AS peer_id,
        name,
        gpu_model,
        gpu_name_detected,
        gpu_count,
        gpu_count_reported,
        vram_gb,
        gpu_vram_mib AS vram_mib,
        gpu_driver,
        gpu_compute_capability,
        gpu_cuda_version,
        location,
        status,
        reliability_score,
        last_heartbeat,
        created_at
      FROM providers
      WHERE is_paused = 0
    `;

    const params = [];

    // If available filter requested, check heartbeat age (< 90 seconds)
    if (available) {
      sql += ` AND (
        last_heartbeat IS NOT NULL
        AND datetime(last_heartbeat) > datetime('now', '-90 seconds')
      )`;
    }

    // Optional GPU model filter
    if (gpuModel) {
      sql += ` AND (
        gpu_model = ? OR gpu_name_detected = ?
      )`;
      params.push(gpuModel, gpuModel);
    }

    // Optional minimum VRAM filter
    if (minVramGb != null && minVramGb > 0) {
      sql += ` AND vram_gb >= ?`;
      params.push(minVramGb);
    }

    sql += ` ORDER BY reliability_score DESC, vram_mib DESC NULLS LAST LIMIT ?`;
    params.push(limit);

    const rows = db.all(sql, params);

    // Transform to standard provider shape
    const providers = rows.map((row) => {
      const heartbeatMs = row.last_heartbeat
        ? Date.now() - new Date(row.last_heartbeat).getTime()
        : null;
      const heartbeatSec = heartbeatMs ? Math.floor(heartbeatMs / 1000) : null;

      return {
        id: row.id,
        peer_id: row.peer_id,
        name: row.name,
        gpu_model: row.gpu_name_detected || row.gpu_model,
        vram_gb: row.vram_gb,
        vram_mib: row.vram_mib,
        gpu_count: row.gpu_count_reported || row.gpu_count || 1,
        driver_version: row.gpu_driver,
        compute_capability: row.gpu_compute_capability,
        cuda_version: row.gpu_cuda_version,
        location: row.location,
        status: row.status,
        reliability_score: row.reliability_score,
        last_heartbeat: row.last_heartbeat,
        last_heartbeat_sec_ago: heartbeatSec,
        created_at: row.created_at,
      };
    });

    return res.json({
      source: 'http-fallback',
      available_filter: available,
      total: providers.length,
      providers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[network] providers error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch providers',
      detail: error.message,
    });
  }
});

/**
 * GET /api/network/topology
 *
 * Network topology health endpoint for admin dashboard (requires admin auth).
 * Returns aggregated network statistics:
 *   - total_registered: total providers in system
 *   - total_online: providers with heartbeat < 2 min
 *   - total_degraded: providers with heartbeat 2-10 min
 *   - total_offline: providers with heartbeat > 10 min or null
 *   - total_stale: providers with heartbeat > 120 sec
 *   - available_count: providers with heartbeat < 90 sec
 *   - avg_gpu_utilization: average GPU util % from recent heartbeats
 *   - avg_reliability_score: average provider reliability
 *   - provider_status_breakdown: detailed breakdown by status
 *   - recent_heartbeat_count: providers with heartbeat in last 5 min
 */
router.get('/topology', requireAdminAuth, (req, res) => {
  try {
    // Total registered providers (not paused)
    const totalReg = db.get(
      'SELECT COUNT(*) AS cnt FROM providers WHERE is_paused = 0'
    );
    const totalRegistered = totalReg?.cnt || 0;

    // Online: heartbeat < 2 min (120 sec)
    const totalOnline = db.get(
      `SELECT COUNT(*) AS cnt FROM providers
       WHERE is_paused = 0
       AND last_heartbeat IS NOT NULL
       AND datetime(last_heartbeat) > datetime('now', '-120 seconds')`,
    );

    // Degraded: heartbeat 2-10 min (120-600 sec)
    const totalDegraded = db.get(
      `SELECT COUNT(*) AS cnt FROM providers
       WHERE is_paused = 0
       AND last_heartbeat IS NOT NULL
       AND datetime(last_heartbeat) <= datetime('now', '-120 seconds')
       AND datetime(last_heartbeat) > datetime('now', '-600 seconds')`,
    );

    // Offline: heartbeat > 10 min (600 sec) or null
    const totalOffline = db.get(
      `SELECT COUNT(*) AS cnt FROM providers
       WHERE is_paused = 0
       AND (last_heartbeat IS NULL
            OR datetime(last_heartbeat) <= datetime('now', '-600 seconds'))`,
    );

    // Stale: heartbeat > 120 sec
    const totalStale = db.get(
      `SELECT COUNT(*) AS cnt FROM providers
       WHERE is_paused = 0
       AND (last_heartbeat IS NULL
            OR datetime(last_heartbeat) <= datetime('now', '-120 seconds'))`,
    );

    // Available: heartbeat < 90 sec
    const availableCount = db.get(
      `SELECT COUNT(*) AS cnt FROM providers
       WHERE is_paused = 0
       AND last_heartbeat IS NOT NULL
       AND datetime(last_heartbeat) > datetime('now', '-90 seconds')`,
    );

    // Average GPU utilization from recent heartbeats
    const avgUtil = db.get(
      `SELECT AVG(CAST(gpu_util_pct AS FLOAT)) AS avg_util
       FROM heartbeat_log
       WHERE received_at > datetime('now', '-1 hours')`,
    );

    // Average reliability score
    const avgReliability = db.get(
      `SELECT AVG(reliability_score) AS avg_score
       FROM providers
       WHERE is_paused = 0 AND reliability_score > 0`,
    );

    // Provider status breakdown
    const statusBreakdown = db.all(
      `SELECT status, COUNT(*) AS count
       FROM providers
       WHERE is_paused = 0
       GROUP BY status
       ORDER BY count DESC`,
    );

    // Recent heartbeat count (last 5 min)
    const recentHeartbeat = db.get(
      `SELECT COUNT(DISTINCT provider_id) AS cnt
       FROM heartbeat_log
       WHERE received_at > datetime('now', '-300 seconds')`,
    );

    return res.json({
      network_health: {
        total_registered: totalRegistered,
        total_online: totalOnline?.cnt || 0,
        total_degraded: totalDegraded?.cnt || 0,
        total_offline: totalOffline?.cnt || 0,
        total_stale: totalStale?.cnt || 0,
        available_count: availableCount?.cnt || 0,
      },
      metrics: {
        avg_gpu_utilization: avgUtil?.avg_util ? parseFloat(avgUtil.avg_util).toFixed(1) : null,
        avg_reliability_score: avgReliability?.avg_score ? parseFloat(avgReliability.avg_score).toFixed(2) : null,
        recent_heartbeat_count: recentHeartbeat?.cnt || 0,
      },
      provider_status_breakdown: statusBreakdown.map((row) => ({
        status: row.status,
        count: row.count,
        percentage: totalRegistered > 0 ? ((row.count / totalRegistered) * 100).toFixed(1) : '0',
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[network] topology error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch network topology',
      detail: error.message,
    });
  }
});

module.exports = router;
