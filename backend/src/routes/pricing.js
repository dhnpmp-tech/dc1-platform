'use strict';

const express = require('express');
const router = express.Router();
const { publicEndpointLimiter } = require('../middleware/rateLimiter');
const { GPU_RATE_TABLE, PRICING_CLASS_MULTIPLIERS, SAR_USD_RATE } = require('../config/pricing');

// GET /api/pricing/tiers
// Returns floor prices per GPU tier with competitor comparison.
// Anchor: RTX 4090 at $0.267/hr (23.7% below Vast.ai).
router.get('/tiers', publicEndpointLimiter, (req, res) => {
  const tiers = GPU_RATE_TABLE
    .filter(entry => entry.models[0] !== 'default')
    .map(entry => {
      const dcpSarPerHour = parseFloat((entry.rate_per_hour_usd * SAR_USD_RATE).toFixed(2));
      const vastSar = parseFloat((entry.competitor_prices.vast_ai * SAR_USD_RATE).toFixed(2));
      const savingsPct = vastSar > 0
        ? Math.max(0, Math.round(((vastSar - dcpSarPerHour) / vastSar) * 100))
        : 0;

      return {
        gpu_model: entry.models[0],
        display_name: entry.display_name,
        tier: entry.tier,
        min_vram_gb: entry.min_vram_gb,
        pricing: {
          rate_per_hour_usd: entry.rate_per_hour_usd,
          rate_per_hour_sar: dcpSarPerHour,
          rate_per_second_usd: entry.rate_per_second_usd,
        },
        competitor_prices: {
          vast_ai_usd: entry.competitor_prices.vast_ai,
          runpod_usd: entry.competitor_prices.runpod,
          aws_usd: entry.competitor_prices.aws,
          vast_ai_sar: vastSar,
          runpod_sar: parseFloat((entry.competitor_prices.runpod * SAR_USD_RATE).toFixed(2)),
          aws_sar: parseFloat((entry.competitor_prices.aws * SAR_USD_RATE).toFixed(2)),
        },
        savings_vs_vast_ai_pct: savingsPct,
      };
    });

  return res.json({
    generated_at: new Date().toISOString(),
    sar_usd_rate: SAR_USD_RATE,
    anchor_gpu: 'rtx 4090',
    anchor_rate_usd: 0.267,
    pricing_classes: PRICING_CLASS_MULTIPLIERS,
    tiers,
  });
});

module.exports = router;
