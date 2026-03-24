'use strict';

/**
 * Earnings Calculator Service — DCP-770
 *
 * Calculates provider earnings estimates based on GPU tier, utilization %, and DCP pricing.
 * Data sourced from FOUNDER-STRATEGIC-BRIEF.md (section 4: Provider Economics).
 *
 * Pricing Model:
 * - Provider revenue = GPU hourly rate × hours per month × utilization %
 * - Electricity cost = GPU power draw × Saudi electricity rate
 * - Net margin = Revenue - Electricity - Platform fees
 * - Payback period = GPU cost / monthly net margin
 *
 * USD/SAR: 3.75 (Saudi riyal is pegged to USD)
 */

// GPU Tier Configuration — from FOUNDER-STRATEGIC-BRIEF.md Section 4
const GPU_TIERS = {
  RTX_4090: {
    model: 'RTX 4090',
    tier: 'B',
    hourlyRateDCP: 0.267, // 23.7% below Vast.ai ($0.35/hr), derived from energy arbitrage
    monthlyRevenueLow: 180,
    monthlyRevenueHigh: 350,
    electricityCostLow: 25,
    electricityCostHigh: 35,
    utilizationLow: 0.60,
    utilizationHigh: 0.80,
    powerDrawKW: 450 / 1000, // watts to kW
    costUSD: 1500,
  },
  RTX_4080: {
    model: 'RTX 4080',
    tier: 'B',
    hourlyRateDCP: 0.18,
    monthlyRevenueLow: 120,
    monthlyRevenueHigh: 250,
    electricityCostLow: 20,
    electricityCostHigh: 30,
    utilizationLow: 0.60,
    utilizationHigh: 0.80,
    powerDrawKW: 320 / 1000,
    costUSD: 1200,
  },
  H100: {
    model: 'H100',
    tier: 'A',
    hourlyRateDCP: 2.80,
    monthlyRevenueLow: 1800,
    monthlyRevenueHigh: 3500,
    electricityCostLow: 150,
    electricityCostHigh: 250,
    utilizationLow: 0.70,
    utilizationHigh: 0.90,
    powerDrawKW: 700 / 1000,
    costUSD: 40000,
  },
  H200: {
    model: 'H200',
    tier: 'A',
    hourlyRateDCP: 3.50,
    monthlyRevenueLow: 2500,
    monthlyRevenueHigh: 4500,
    electricityCostLow: 180,
    electricityCostHigh: 300,
    utilizationLow: 0.70,
    utilizationHigh: 0.90,
    powerDrawKW: 900 / 1000,
    costUSD: 50000,
  },
  L40S: {
    model: 'L40S',
    tier: 'B',
    hourlyRateDCP: 0.45,
    monthlyRevenueLow: 250,
    monthlyRevenueHigh: 500,
    electricityCostLow: 30,
    electricityCostHigh: 45,
    utilizationLow: 0.65,
    utilizationHigh: 0.85,
    powerDrawKW: 500 / 1000,
    costUSD: 6000,
  },
  A100: {
    model: 'A100',
    tier: 'A',
    hourlyRateDCP: 1.50,
    monthlyRevenueLow: 900,
    monthlyRevenueHigh: 1800,
    electricityCostLow: 120,
    electricityCostHigh: 180,
    utilizationLow: 0.70,
    utilizationHigh: 0.90,
    powerDrawKW: 600 / 1000,
    costUSD: 15000,
  },
};

const PLATFORM_TAKE_RATE = 0.15; // 15% platform fee
const SAUDI_ELECTRICITY_RATE_KWHR = 0.05; // USD per kWh (mid-range of 0.048-0.053)
const HOURS_PER_MONTH = 730; // 24 × 30.42

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get all available GPU tiers.
 *
 * @returns {array} list of GPU models available for earning calculations
 */
function getAvailableGPUs() {
  return Object.entries(GPU_TIERS).map(([key, config]) => ({
    id: key,
    model: config.model,
    tier: config.tier,
  }));
}

/**
 * Calculate earnings estimate for a given GPU and utilization %.
 *
 * @param {string} gpuId         - GPU model identifier (e.g., 'RTX_4090')
 * @param {number} utilization   - Utilization % (0.0-1.0, default 0.70)
 * @returns {object|{error}} result with earnings breakdown or error
 */
function calculateEarnings(gpuId, utilization = 0.70) {
  const gpu = GPU_TIERS[gpuId];
  if (!gpu) {
    return {
      error: 'UNKNOWN_GPU',
      message: `GPU model "${gpuId}" not found`,
      availableGPUs: getAvailableGPUs(),
    };
  }

  if (typeof utilization !== 'number' || utilization < 0 || utilization > 1) {
    return {
      error: 'INVALID_UTILIZATION',
      message: 'Utilization must be a number between 0.0 and 1.0',
    };
  }

  // Monthly revenue (before platform fees)
  const monthlyRevenueGross = gpu.hourlyRateDCP * HOURS_PER_MONTH * utilization;

  // Platform fees
  const platformFees = monthlyRevenueGross * PLATFORM_TAKE_RATE;

  // Provider revenue (after platform fees)
  const monthlyRevenueNet = monthlyRevenueGross - platformFees;

  // Electricity cost
  const electricityCost = gpu.powerDrawKW * HOURS_PER_MONTH * utilization * SAUDI_ELECTRICITY_RATE_KWHR;

  // Net margin (what provider actually keeps)
  const monthlyNetMargin = monthlyRevenueNet - electricityCost;

  // Annual earnings
  const annualEarnings = monthlyNetMargin * 12;

  // Payback period in months
  const paybackMonths = gpu.costUSD > 0 ? gpu.costUSD / monthlyNetMargin : null;

  return {
    success: true,
    gpu: {
      id: gpuId,
      model: gpu.model,
      tier: gpu.tier,
      costUSD: gpu.costUSD,
    },
    parameters: {
      utilization: (utilization * 100).toFixed(1),
      hoursPerMonth: HOURS_PER_MONTH,
      hourlyRateDCP: gpu.hourlyRateDCP,
      electricityRatePerKWh: SAUDI_ELECTRICITY_RATE_KWHR,
      platformTakeRate: (PLATFORM_TAKE_RATE * 100).toFixed(0),
    },
    monthlyEarnings: {
      revenueGross: parseFloat(monthlyRevenueGross.toFixed(2)),
      platformFees: parseFloat(platformFees.toFixed(2)),
      revenueNet: parseFloat(monthlyRevenueNet.toFixed(2)),
      electricityCost: parseFloat(electricityCost.toFixed(2)),
      netMargin: parseFloat(monthlyNetMargin.toFixed(2)),
    },
    annualEarnings: parseFloat(annualEarnings.toFixed(2)),
    paybackMonths: paybackMonths ? parseFloat(paybackMonths.toFixed(1)) : null,
    comparisonVsHyperscaler: {
      awsHourlyRate: gpu.hourlyRateDCP * 4, // AWS is ~4x more expensive (60-85% premium)
      dcpSavingsPercent: 70,
      dcpSavingsMonthly: parseFloat((monthlyRevenueGross * 0.70).toFixed(2)),
    },
  };
}

/**
 * Calculate earnings for multiple utilization levels (for charts).
 *
 * @param {string} gpuId - GPU model identifier
 * @param {number} [step=0.10] - utilization step (0.10 = 10%)
 * @returns {object} array of earnings at different utilization %
 */
function calculateEarningsRanges(gpuId, step = 0.10) {
  const gpu = GPU_TIERS[gpuId];
  if (!gpu) {
    return {
      error: 'UNKNOWN_GPU',
      message: `GPU model "${gpuId}" not found`,
    };
  }

  const ranges = [];
  for (let util = 0; util <= 1.0; util += step) {
    const earnResult = calculateEarnings(gpuId, util);
    if (earnResult.success) {
      ranges.push({
        utilization: parseFloat((util * 100).toFixed(0)),
        monthlyNetMargin: earnResult.monthlyEarnings.netMargin,
        annualEarnings: earnResult.annualEarnings,
        paybackMonths: earnResult.paybackMonths,
      });
    }
  }

  return {
    gpu: gpu.model,
    ranges,
  };
}

/**
 * Compare earnings across multiple GPUs at a given utilization.
 *
 * @param {number} utilization - utilization % (0.0-1.0)
 * @returns {array} sorted by earnings descending
 */
function compareGPUEarnings(utilization = 0.70) {
  const comparison = Object.entries(GPU_TIERS).map(([key, gpu]) => {
    const result = calculateEarnings(key, utilization);
    if (result.success) {
      return {
        gpuId: key,
        model: gpu.model,
        tier: gpu.tier,
        monthlyNetMargin: result.monthlyEarnings.netMargin,
        annualEarnings: result.annualEarnings,
        paybackMonths: result.paybackMonths,
        costUSD: gpu.costUSD,
      };
    }
    return null;
  }).filter(Boolean);

  return comparison.sort((a, b) => b.monthlyNetMargin - a.monthlyNetMargin);
}

module.exports = {
  getAvailableGPUs,
  calculateEarnings,
  calculateEarningsRanges,
  compareGPUEarnings,
};
