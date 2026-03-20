const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/models
// Public model registry with live provider availability and averaged pricing.
router.get('/', (req, res) => {
  try {
    const models = db.all(
      `SELECT
         m.model_id,
         m.display_name,
         m.family,
         m.vram_gb,
         m.quantization,
         m.context_window,
         m.use_cases,
         m.min_gpu_vram_gb,
         COUNT(p.id) AS providers_online,
         COALESCE(
           ROUND(AVG(COALESCE(p.price_per_min_halala, m.default_price_halala_per_min)) / 100.0, 2),
           ROUND(m.default_price_halala_per_min / 100.0, 2)
         ) AS avg_price_sar_per_min
       FROM model_registry m
       LEFT JOIN providers p
         ON p.status = 'online'
        AND COALESCE(
              p.vram_gb,
              CAST(ROUND(COALESCE(p.gpu_vram_mb, p.gpu_vram_mib, 0) / 1024.0) AS INTEGER),
              0
            ) >= m.min_gpu_vram_gb
       WHERE m.is_active = 1
       GROUP BY m.id
       ORDER BY m.display_name ASC`
    );

    const payload = models.map((row) => {
      let useCases = [];
      try {
        const parsed = JSON.parse(row.use_cases || '[]');
        useCases = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        useCases = [];
      }

      const providersOnline = Number(row.providers_online || 0);
      const avgSarPerMin = Number(row.avg_price_sar_per_min || 0);

      return {
        model_id: row.model_id,
        display_name: row.display_name,
        family: row.family,
        vram_gb: Number(row.vram_gb || 0),
        quantization: row.quantization,
        context_window: Number(row.context_window || 0),
        use_cases: useCases,
        min_gpu_vram_gb: Number(row.min_gpu_vram_gb || 0),
        providers_online: providersOnline,
        avg_price_sar_per_min: Number.isFinite(avgSarPerMin) ? avgSarPerMin : 0,
        status: providersOnline > 0 ? 'available' : 'no_providers',
      };
    });

    return res.json(payload);
  } catch (error) {
    console.error('Model registry error:', error);
    return res.status(500).json({ error: 'Failed to fetch model registry' });
  }
});

module.exports = router;
