'use strict';

/**
 * DCP Pricing Service
 *
 * Provides GPU-model-aware cost estimation using floor prices from the
 * strategic brief. Falls back to job-type rates when no gpu_model is given.
 */

const {
  SAR_USD_RATE,
  GPU_RATE_TABLE,
  PRICING_CLASS_MULTIPLIERS,
  JOB_TYPE_RATES_HALALA_PER_MIN,
  STORAGE_RATE_HALALA_PER_GB_MONTH,
  BANDWIDTH_RATE_HALALA_PER_GB,
} = require('../config/pricing');

/**
 * Resolve a GPU model string to its rate entry.
 * Performs case-insensitive prefix/substring match against the model list.
 * Returns the 'default' entry when no match is found.
 *
 * @param {string|null|undefined} gpuModel
 * @returns {object} rate entry from GPU_RATE_TABLE
 */
function resolveGpuRate(gpuModel) {
  if (!gpuModel) return GPU_RATE_TABLE[GPU_RATE_TABLE.length - 1]; // default

  const lower = String(gpuModel).toLowerCase().trim();

  for (const entry of GPU_RATE_TABLE) {
    if (entry.models[0] === 'default') continue;
    for (const pattern of entry.models) {
      if (lower.includes(pattern)) return entry;
    }
  }

  return GPU_RATE_TABLE[GPU_RATE_TABLE.length - 1]; // fallback → default entry
}

/**
 * Get the rate object for a GPU model.
 *
 * Returns:
 *   display_name, tier, min_vram_gb,
 *   rate_per_hour_usd, rate_per_second_usd,
 *   rate_per_hour_sar, rate_per_min_halala,
 *   competitor_prices (USD/hr), savings_pct (vs Vast.ai)
 */
function getRate(gpuModel) {
  const entry = resolveGpuRate(gpuModel);
  const rate_per_hour_sar = parseFloat((entry.rate_per_hour_usd * SAR_USD_RATE).toFixed(4));
  const rate_per_min_halala = Math.ceil((rate_per_hour_sar * 100) / 60);

  const vastAi = entry.competitor_prices.vast_ai;
  const savings_pct = vastAi > 0
    ? parseFloat(((vastAi - entry.rate_per_hour_usd) / vastAi * 100).toFixed(1))
    : 0;

  // Competitor prices in both USD and SAR for display
  const competitor_prices = {
    vast_ai_usd: entry.competitor_prices.vast_ai,
    runpod_usd: entry.competitor_prices.runpod,
    aws_usd: entry.competitor_prices.aws,
    vast_ai_sar: parseFloat((entry.competitor_prices.vast_ai * SAR_USD_RATE).toFixed(2)),
    runpod_sar: parseFloat((entry.competitor_prices.runpod * SAR_USD_RATE).toFixed(2)),
    aws_sar: parseFloat((entry.competitor_prices.aws * SAR_USD_RATE).toFixed(2)),
  };

  return {
    display_name: entry.display_name,
    tier: entry.tier,
    min_vram_gb: entry.min_vram_gb,
    rate_per_hour_usd: entry.rate_per_hour_usd,
    rate_per_second_usd: entry.rate_per_second_usd,
    rate_per_hour_sar,
    rate_per_min_halala,
    competitor_prices,
    savings_pct,
  };
}

/**
 * Estimate job cost in halala and SAR.
 *
 * @param {string|null} gpuModel     - provider gpu_model string (may be null)
 * @param {number} durationSeconds   - requested duration in seconds
 * @param {string} [pricingClass]    - 'priority' | 'standard' | 'economy'
 * @param {string} [jobType]         - fallback job type for legacy path
 * @returns {{ estimated_halala, estimated_sar, estimated_usd, gpu_rate_snapshot }}
 */
function estimateCost(gpuModel, durationSeconds, pricingClass = 'standard', jobType = null) {
  const multiplier = PRICING_CLASS_MULTIPLIERS[pricingClass] || 1.0;

  if (gpuModel) {
    // GPU-model-aware path (preferred)
    const rate = getRate(gpuModel);
    const raw_halala = rate.rate_per_second_usd * durationSeconds * SAR_USD_RATE * 100 * multiplier;
    const estimated_halala = Math.ceil(raw_halala);
    const estimated_sar = parseFloat((estimated_halala / 100).toFixed(2));
    const estimated_usd = parseFloat((estimated_halala / 100 / SAR_USD_RATE).toFixed(4));

    return {
      estimated_halala,
      estimated_sar,
      estimated_usd,
      gpu_rate_snapshot: {
        gpu_model: gpuModel,
        display_name: rate.display_name,
        tier: rate.tier,
        rate_per_hour_usd: rate.rate_per_hour_usd,
        rate_per_hour_sar: rate.rate_per_hour_sar,
        pricing_class: pricingClass,
        multiplier,
        sar_usd_rate: SAR_USD_RATE,
      },
    };
  }

  // Legacy job-type fallback
  const durationMinutes = durationSeconds / 60;
  const baseRate = JOB_TYPE_RATES_HALALA_PER_MIN[jobType] || JOB_TYPE_RATES_HALALA_PER_MIN['default'];
  const estimated_halala = Math.ceil(baseRate * durationMinutes * multiplier);
  const estimated_sar = parseFloat((estimated_halala / 100).toFixed(2));
  const estimated_usd = parseFloat((estimated_halala / 100 / SAR_USD_RATE).toFixed(4));

  return {
    estimated_halala,
    estimated_sar,
    estimated_usd,
    gpu_rate_snapshot: {
      gpu_model: null,
      job_type: jobType,
      rate_per_min_halala: baseRate,
      pricing_class: pricingClass,
      multiplier,
      sar_usd_rate: SAR_USD_RATE,
    },
  };
}

/**
 * Calculate halala cost from duration in minutes (backward-compatible helper).
 * Used by routes that still pass durationMinutes directly.
 *
 * @param {string|null} gpuModel
 * @param {number} durationMinutes
 * @param {string} [pricingClass]
 * @param {string} [jobType]
 * @returns {number} halala (integer, ceiling)
 */
function calculateCostHalala(gpuModel, durationMinutes, pricingClass = 'standard', jobType = null) {
  return estimateCost(gpuModel, durationMinutes * 60, pricingClass, jobType).estimated_halala;
}

/**
 * Estimate 3-component billing for a job with per-second compute + storage + bandwidth.
 *
 * @param {object} options
 * @param {string|null} options.gpuModel
 * @param {number} options.durationSeconds - actual GPU active seconds
 * @param {number} [options.storageGbSeconds=0] - GB-seconds of persistent storage
 * @param {number} [options.bandwidthBytesOut=0] - egress bytes
 * @param {string} [options.pricingClass='standard']
 * @param {string} [options.jobType=null]
 * @returns {{ compute_halala, storage_halala, bandwidth_halala, total_halala, total_sar, gpu_rate_snapshot }}
 */
function estimateThreeComponentCost({ gpuModel, durationSeconds, storageGbSeconds = 0, bandwidthBytesOut = 0, pricingClass = 'standard', jobType = null }) {
  const multiplier = PRICING_CLASS_MULTIPLIERS[pricingClass] || 1.0;

  let compute_halala = 0;
  let gpu_rate_snapshot = null;

  if (gpuModel) {
    const rate = getRate(gpuModel);
    const raw = rate.rate_per_second_usd * durationSeconds * SAR_USD_RATE * 100 * multiplier;
    compute_halala = Math.ceil(raw);
    gpu_rate_snapshot = {
      gpu_model: gpuModel,
      display_name: rate.display_name,
      tier: rate.tier,
      rate_per_hour_usd: rate.rate_per_hour_usd,
      rate_per_second_usd: rate.rate_per_second_usd,
      rate_per_hour_sar: rate.rate_per_hour_usd * SAR_USD_RATE,
      pricing_class: pricingClass,
      multiplier,
      sar_usd_rate: SAR_USD_RATE,
    };
  } else {
    const durationMinutes = durationSeconds / 60;
    const baseRate = JOB_TYPE_RATES_HALALA_PER_MIN[jobType] || JOB_TYPE_RATES_HALALA_PER_MIN['default'];
    compute_halala = Math.ceil(baseRate * durationMinutes * multiplier);
    gpu_rate_snapshot = {
      gpu_model: null,
      job_type: jobType,
      rate_per_min_halala: baseRate,
      pricing_class: pricingClass,
      multiplier,
      sar_usd_rate: SAR_USD_RATE,
    };
  }

  const storage_gb_month = storageGbSeconds / (30 * 24 * 3600);
  const storage_halala = Math.ceil(storage_gb_month * STORAGE_RATE_HALALA_PER_GB_MONTH);

  const bandwidth_gb_out = bandwidthBytesOut / (1024 * 1024 * 1024);
  const bandwidth_halala = Math.ceil(bandwidth_gb_out * BANDWIDTH_RATE_HALALA_PER_GB);

  const total_halala = compute_halala + storage_halala + bandwidth_halala;
  const total_sar = parseFloat((total_halala / 100).toFixed(2));

  return { compute_halala, storage_halala, bandwidth_halala, total_halala, total_sar, gpu_rate_snapshot };
}

/**
 * Calculate total halala from 3 components (backward-compatible helper).
 */
function calculateThreeComponentCost(gpuModel, durationSeconds, storageGbSeconds = 0, bandwidthBytesOut = 0, pricingClass = 'standard', jobType = null) {
  return estimateThreeComponentCost({ gpuModel, durationSeconds, storageGbSeconds, bandwidthBytesOut, pricingClass, jobType }).total_halala;
}

module.exports = { getRate, estimateCost, calculateCostHalala, resolveGpuRate, estimateThreeComponentCost, calculateThreeComponentCost, STORAGE_RATE_HALALA_PER_GB_MONTH, BANDWIDTH_RATE_HALALA_PER_GB };
