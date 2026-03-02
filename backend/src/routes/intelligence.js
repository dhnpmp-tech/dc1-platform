const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper: extract GPU utilization from gpu_status JSON blob
function extractUtilization(gpuStatusStr) {
  if (!gpuStatusStr) return null;
  try {
    const s = typeof gpuStatusStr === 'string' ? JSON.parse(gpuStatusStr) : gpuStatusStr;
    if (s.gpu_util_pct !== undefined) return Number(s.gpu_util_pct);
    if (s.utilization !== undefined) return Number(s.utilization);
    if (s.gpu_utilization !== undefined) return Number(s.gpu_utilization);
  } catch { /* ignore */ }
  return null;
}

// Helper: get effective GPU model name
function getGpuModel(row) {
  return row.gpu_name_detected || row.gpu_model || 'Unknown';
}

// Helper: get VRAM in GiB (prefer gpu_vram_mib, fallback to vram_gb)
function getVramGib(row) {
  if (row.gpu_vram_mib && row.gpu_vram_mib > 0) {
    return Math.round(row.gpu_vram_mib / 1024);
  }
  return row.vram_gb || 0;
}

// ============================================================================
// GET /api/intelligence/fleet — Full fleet summary
// ============================================================================
router.get('/fleet', (req, res) => {
  try {
    const providers = db.all('SELECT * FROM providers');

    const totalProviders = providers.length;
    const onlineProviders = providers.filter(p => p.status === 'online').length;

    // GPU distribution grouped by model
    const distMap = {};
    let totalVram = 0;
    let totalGpus = 0;

    for (const p of providers) {
      const model = getGpuModel(p);
      const count = p.gpu_count || 1;
      const vram = getVramGib(p) * count;
      const util = extractUtilization(p.gpu_status);

      totalGpus += count;
      totalVram += vram;

      if (!distMap[model]) {
        distMap[model] = { model, count: 0, total_vram_gib: 0, utils: [] };
      }
      distMap[model].count += count;
      distMap[model].total_vram_gib += vram;
      if (util !== null && p.status === 'online') {
        distMap[model].utils.push(util);
      }
    }

    const gpuDistribution = Object.values(distMap).map(d => ({
      model: d.model,
      count: d.count,
      total_vram_gib: d.total_vram_gib,
      avg_util_pct: d.utils.length > 0
        ? Math.round(d.utils.reduce((a, b) => a + b, 0) / d.utils.length)
        : 0,
    }));

    // Average utilization (online only)
    const onlineUtils = providers
      .filter(p => p.status === 'online')
      .map(p => extractUtilization(p.gpu_status))
      .filter(u => u !== null);
    const avgUtil = onlineUtils.length > 0
      ? Math.round(onlineUtils.reduce((a, b) => a + b, 0) / onlineUtils.length)
      : 0;

    // Peak GPU = model with highest total count
    const peakGpu = gpuDistribution.length > 0
      ? gpuDistribution.sort((a, b) => b.count - a.count)[0].model
      : null;

    res.json({
      total_providers: totalProviders,
      online_providers: onlineProviders,
      total_gpus: totalGpus,
      total_vram_gib: totalVram,
      gpu_distribution: gpuDistribution,
      avg_utilization_pct: avgUtil,
      peak_gpu: peakGpu,
      total_compute_tflops: null,
    });
  } catch (error) {
    console.error('Intelligence fleet error:', error);
    res.status(500).json({ error: 'Failed to fetch fleet data' });
  }
});

// ============================================================================
// GET /api/intelligence/providers — Per-provider GPU breakdown
// ============================================================================
router.get('/providers', (req, res) => {
  try {
    const providers = db.all('SELECT * FROM providers');

    const result = providers.map(p => ({
      id: p.id,
      name: p.name || p.email,
      status: p.status,
      gpu_model: getGpuModel(p),
      gpu_count: p.gpu_count || 1,
      vram_gib: getVramGib(p),
      utilization_pct: extractUtilization(p.gpu_status) ?? 0,
      driver: p.gpu_driver || null,
      compute_cap: p.gpu_compute || null,
      last_heartbeat: p.last_heartbeat || null,
      uptime_pct: p.uptime_percent || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error('Intelligence providers error:', error);
    res.status(500).json({ error: 'Failed to fetch provider data' });
  }
});

// ============================================================================
// GET /api/intelligence/utilization — Utilization trend (last 24h hourly)
// ============================================================================
router.get('/utilization', (req, res) => {
  try {
    // Check if provider_status_log table exists and has data
    let hasLog = false;
    try {
      const check = db.get("SELECT COUNT(*) as c FROM provider_status_log");
      hasLog = check && check.c > 0;
    } catch { /* table may not exist */ }

    if (hasLog) {
      // Real data from status log — aggregate by hour
      const rows = db.all(`
        SELECT strftime('%H:00', changed_at) as hour,
               COUNT(DISTINCT provider_id) as online_count
        FROM provider_status_log
        WHERE datetime(changed_at) > datetime('now', '-24 hours')
          AND new_status = 'online'
        GROUP BY hour
        ORDER BY hour
      `);

      const trend = rows.map(r => ({
        hour: r.hour,
        avg_util: 0, // status_log doesn't store utilization
        online_count: r.online_count,
      }));

      return res.json({ trend, source: 'provider_status_log' });
    }

    // Mock trend data for Gate 0
    const now = new Date();
    const trend = [];
    for (let i = 23; i >= 0; i--) {
      const h = new Date(now.getTime() - i * 3600000);
      const hour = h.toISOString().slice(11, 16).replace(/:\d\d$/, ':00');
      trend.push({
        hour,
        avg_util: Math.floor(Math.random() * 40 + 20),
        online_count: Math.floor(Math.random() * 3 + 1),
      });
    }

    res.json({ trend, source: 'mock', note: 'No historical data yet — showing sample trend' });
  } catch (error) {
    console.error('Intelligence utilization error:', error);
    res.status(500).json({ error: 'Failed to fetch utilization data' });
  }
});

// Export helpers for testing
router._extractUtilization = extractUtilization;
router._getGpuModel = getGpuModel;
router._getVramGib = getVramGib;

module.exports = router;
