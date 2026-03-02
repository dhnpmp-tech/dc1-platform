const express = require('express');
const router = express.Router();
const db = require('../db');

// === GET /api/admin/providers - All providers with full status ===
router.get('/providers', async (req, res) => {
  try {
    const providers = await db.all(
      `SELECT id, name, email, gpu_model, gpu_count, vram_gb, os,
              status, api_key, gpu_status, provider_ip, provider_hostname,
              last_heartbeat, gpu_name_detected, gpu_vram_mib, gpu_driver,
              gpu_compute, total_earnings, total_jobs, uptime_percent,
              created_at, updated_at
       FROM providers ORDER BY
         CASE WHEN status = 'online' THEN 0 ELSE 1 END,
         last_heartbeat DESC NULLS LAST, created_at DESC`
    );

    // Parse gpu_status JSON and calculate online/offline
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
        minutes_since_heartbeat: minutesSinceHeartbeat ? Math.round(minutesSinceHeartbeat) : null,
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
router.get('/dashboard', async (req, res) => {
  try {
    const total = await db.get('SELECT COUNT(*) as count FROM providers');
    const now = new Date();
    const fiveMinAgo = new Date(now - 5 * 60000).toISOString();

    const online = await db.get(
      'SELECT COUNT(*) as count FROM providers WHERE last_heartbeat > ?', [fiveMinAgo]
    );

    const gpuModels = await db.all(
      `SELECT gpu_model, COUNT(*) as count FROM providers
       GROUP BY gpu_model ORDER BY count DESC`
    );

    const recentSignups = await db.all(
      `SELECT id, name, email, gpu_model, os, created_at
       FROM providers ORDER BY created_at DESC LIMIT 5`
    );

    const recentHeartbeats = await db.all(
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

module.exports = router;
