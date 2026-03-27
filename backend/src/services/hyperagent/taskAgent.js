'use strict';

/**
 * HyperAgent Task Agent — Job Acceptance, Pricing & Scheduling
 *
 * The "inner loop" of the DGM-H architecture. Makes real-time decisions about
 * whether a provider should accept a given job, at what price, and with what
 * scheduling priority. All decisions are governed by strategy parameters stored
 * in ha_strategies, which the meta agent periodically rewrites.
 *
 * Decision factors:
 *   1. Profitability — estimated earnings vs power cost, above min_profit_margin
 *   2. GPU fitness   — VRAM headroom, temperature, utilisation ceiling
 *   3. Queue depth   — don't overload the provider
 *   4. Model cache   — prefer jobs whose model is already cached (faster startup)
 *   5. Demand surge  — raise price when utilisation exceeds threshold
 *   6. Duration fit  — prefer jobs that match the provider's availability window
 */

const memory = require('./memory');

const TAG = '[ha-task]';

// ── GPU TDP reference (watts) — used to estimate power cost when not in heartbeat ─
const GPU_TDP_MAP = {
  'h200': 700, 'h100': 700, 'a100': 400,
  'rtx 4090': 450, 'rtx 4080': 320, 'rtx 3090': 350,
  'rtx 3080': 320, 'rtx 4070': 200, 'default': 300,
};

// Saudi average electricity cost in SAR/kWh
const DEFAULT_ELECTRICITY_SAR_KWH = 0.18;
const SYSTEM_OVERHEAD_MULTIPLIER = 1.3;

/**
 * Evaluate whether a provider should accept a job.
 *
 * @param {object} provider — { id, gpu_model, vram_gb, gpu_count, status, ... }
 * @param {object} job      — { job_id, job_type, model, cost_halala, vram_required,
 *                              max_duration_seconds, gpu_requirements, ... }
 * @param {object} ctx      — runtime context from heartbeat:
 *                             { gpu_util_pct, gpu_temp_c, power_watts, queue_depth,
 *                               cached_models, electricity_sar_kwh }
 * @returns {{ accept: boolean, reason: string, score: number,
 *             suggested_price_halala?: number, strategy_version: number }}
 */
function evaluate(provider, job, ctx = {}) {
  const gpuModel = normaliseGpuModel(provider.gpu_model);
  const strategy = memory.getStrategyFor(gpuModel, job.job_type);

  const result = {
    accept: true,
    reason: '',
    score: 100,          // starts at 100, deductions/bonuses applied
    suggested_price_halala: null,
    strategy_version: strategy.version,
    factors: {},
  };

  // ── 1. Profitability check ──────────────────────────────────────────────────
  const profitability = estimateProfitability(provider, job, ctx, strategy);
  result.factors.profitability = profitability;

  if (profitability.margin < strategy.min_profit_margin) {
    result.accept = false;
    result.reason = `Profit margin ${(profitability.margin * 100).toFixed(1)}% below threshold ${(strategy.min_profit_margin * 100).toFixed(1)}%`;
    result.score -= 50;
    return result;
  }

  // Bonus for high-margin jobs
  if (profitability.margin > 0.5) result.score += 20;
  else if (profitability.margin > 0.3) result.score += 10;

  // ── 2. GPU fitness ──────────────────────────────────────────────────────────
  const gpuTemp = ctx.gpu_temp_c || 0;
  if (gpuTemp > 0 && gpuTemp > strategy.max_gpu_temp_c) {
    result.accept = false;
    result.reason = `GPU temperature ${gpuTemp}°C exceeds limit ${strategy.max_gpu_temp_c}°C`;
    result.score -= 30;
    return result;
  }

  const gpuUtil = ctx.gpu_util_pct || 0;
  if (gpuUtil > 0 && strategy.min_gpu_util_pct > 0 && gpuUtil < strategy.min_gpu_util_pct) {
    // GPU is too idle — might indicate hardware issues
    result.score -= 5;
    result.factors.gpu_idle_warning = true;
  }

  // ── 3. Queue depth ──────────────────────────────────────────────────────────
  const queueDepth = ctx.queue_depth || 0;
  if (queueDepth >= strategy.max_queue_depth) {
    result.accept = false;
    result.reason = `Queue depth ${queueDepth} at limit ${strategy.max_queue_depth}`;
    result.score -= 25;
    return result;
  }

  // Penalise near-capacity providers
  if (queueDepth > 0) {
    result.score -= Math.min(15, queueDepth * 3);
  }

  // ── 4. Minimum job value ────────────────────────────────────────────────────
  const jobValue = job.cost_halala || 0;
  if (jobValue > 0 && jobValue < strategy.reject_below_halala) {
    result.accept = false;
    result.reason = `Job value ${jobValue}h below minimum ${strategy.reject_below_halala}h`;
    result.score -= 20;
    return result;
  }

  // ── 5. Model cache bonus ────────────────────────────────────────────────────
  if (strategy.prefer_cached_models && ctx.cached_models && job.model) {
    const cachedList = Array.isArray(ctx.cached_models)
      ? ctx.cached_models
      : String(ctx.cached_models).split(',');

    const modelCached = cachedList.some(m =>
      m.trim().toLowerCase() === job.model.toLowerCase()
    );

    if (modelCached) {
      result.score += strategy.cache_bonus_pct || 10;
      result.factors.model_cached = true;
    } else {
      result.factors.model_cached = false;
    }
  }

  // ── 6. Duration preference ──────────────────────────────────────────────────
  const maxDuration = job.max_duration_seconds || 0;
  if (maxDuration > 0 && maxDuration > strategy.max_duration_secs) {
    result.accept = false;
    result.reason = `Job duration ${maxDuration}s exceeds provider limit ${strategy.max_duration_secs}s`;
    return result;
  }

  if (strategy.prefer_short_jobs && maxDuration > 0 && maxDuration < 300) {
    result.score += 5; // bonus for short jobs
  }

  // ── 7. Demand surge pricing ─────────────────────────────────────────────────
  if (gpuUtil > strategy.demand_surge_threshold * 100) {
    const surgeMultiplier = strategy.demand_surge_multiplier || 1.25;
    result.suggested_price_halala = Math.ceil(
      (jobValue || profitability.estimated_revenue_halala) * surgeMultiplier
    );
    result.factors.demand_surge = true;
    result.score += 5;
  } else {
    const priceMultiplier = strategy.price_multiplier || 1.0;
    if (priceMultiplier !== 1.0) {
      result.suggested_price_halala = Math.ceil(
        (jobValue || profitability.estimated_revenue_halala) * priceMultiplier
      );
    }
  }

  // ── Final ───────────────────────────────────────────────────────────────────
  result.score = Math.max(0, Math.min(150, result.score));
  result.reason = result.accept
    ? `Accepted: score=${result.score}, margin=${(profitability.margin * 100).toFixed(1)}%`
    : result.reason;

  return result;
}

/**
 * Estimate job profitability (revenue vs power cost).
 * Mirrors the daemon's estimate_job_profitability() logic.
 */
function estimateProfitability(provider, job, ctx, strategy) {
  const gpuModel = normaliseGpuModel(provider.gpu_model);
  const tdp = GPU_TDP_MAP[gpuModel] || GPU_TDP_MAP['default'];
  const powerWatts = ctx.power_watts || tdp;
  const electricityCost = ctx.electricity_sar_kwh || DEFAULT_ELECTRICITY_SAR_KWH;

  // Estimate duration from job type or default 10 minutes
  const estDuration = job.max_duration_seconds || estimateJobDuration(job.job_type);
  const estHours = estDuration / 3600;

  // Power cost in halala
  const kw = powerWatts / 1000;
  const powerCostSar = kw * estHours * electricityCost * SYSTEM_OVERHEAD_MULTIPLIER;
  const powerCostHalala = Math.ceil(powerCostSar * 100);

  // Revenue
  const revenueHalala = job.cost_halala || job.provider_earned_halala || 0;

  const profit = revenueHalala - powerCostHalala;
  const margin = revenueHalala > 0 ? profit / revenueHalala : 0;

  return {
    estimated_revenue_halala: revenueHalala,
    estimated_power_cost_halala: powerCostHalala,
    estimated_profit_halala: profit,
    margin,
    est_duration_secs: estDuration,
    power_watts: powerWatts,
  };
}

/**
 * Estimate job duration by type when not explicitly provided.
 */
function estimateJobDuration(jobType) {
  const estimates = {
    'llm-inference': 60,
    'llm_inference': 60,
    'image_generation': 120,
    'training': 3600,
    'rendering': 600,
    'vllm_serve': 1800,
    'rag-pipeline': 300,
    'custom_container': 600,
  };
  return estimates[jobType] || 600; // default 10 minutes
}

/**
 * Get the active strategy for a specific GPU model.
 * Used by external callers (daemon integration).
 */
function getStrategyForGpu(gpuModel) {
  const normalised = normaliseGpuModel(gpuModel);
  const strategy = memory.getStrategyFor(normalised, '*');
  return {
    version: strategy.version,
    min_profit_margin: strategy.min_profit_margin,
    max_queue_depth: strategy.max_queue_depth,
    price_multiplier: strategy.price_multiplier,
    demand_surge_threshold: strategy.demand_surge_threshold,
    demand_surge_multiplier: strategy.demand_surge_multiplier,
    prefer_cached_models: strategy.prefer_cached_models,
    cache_bonus_pct: strategy.cache_bonus_pct,
    reject_below_halala: strategy.reject_below_halala,
    max_gpu_temp_c: strategy.max_gpu_temp_c,
  };
}

/**
 * Normalise GPU model string for consistent matching.
 */
function normaliseGpuModel(gpuModel) {
  if (!gpuModel) return 'default';
  const lower = gpuModel.toLowerCase().trim();
  // Strip 'nvidia ' and 'geforce ' prefixes
  return lower
    .replace(/^nvidia\s+/i, '')
    .replace(/^geforce\s+/i, '')
    .trim();
}

module.exports = {
  evaluate,
  getStrategyForGpu,
  estimateProfitability,
  normaliseGpuModel,
};
