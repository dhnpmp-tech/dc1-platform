/**
 * jobScheduler.js — Intelligent job scheduling with resource matching
 *
 * Provides sophisticated matching algorithms for assigning renter compute requests
 * to available provider resources based on GPU type, memory (VRAM), and cost efficiency.
 *
 * Key features:
 *   - GPU type matching (exact, compatible fallbacks)
 *   - VRAM requirement validation
 *   - Cost-aware provider selection
 *   - Batch scheduling for multiple jobs
 *   - Provider capacity awareness (online/degraded status)
 *   - Fairness and load balancing
 */

'use strict';

// Lazy-load db to allow pure unit testing of scoring functions
let _db;
function getDb() {
  if (!_db) _db = require('../db');
  return _db;
}

// Heartbeat thresholds (sync with DCP-183 constants from providers.js)
const HEARTBEAT_ONLINE_THRESHOLD_S = 120;   // 2 min
const HEARTBEAT_DEGRADED_THRESHOLD_S = 600; // 10 min

// GPU model compatibility map for fallback matching
// Maps requested GPU models to compatible alternatives (in preference order)
const GPU_COMPATIBILITY = {
  'A100': ['A100', 'H100', 'L40S', 'RTX4090'],
  'H100': ['H100', 'A100', 'L40S', 'RTX4090'],
  'L40S': ['L40S', 'A100', 'H100', 'RTX4090'],
  'RTX4090': ['RTX4090', 'A100', 'H100', 'L40S'],
  'RTX4080': ['RTX4080', 'A100', 'H100', 'L40S', 'RTX4090'],
  'RTX3090': ['RTX3090', 'A100', 'H100', 'L40S', 'RTX4090', 'RTX4080'],
};

/**
 * Compute provider status from last heartbeat timestamp.
 * @param {string|null} lastHeartbeat - ISO timestamp of last heartbeat
 * @param {number} [now=Date.now()] - Reference time in ms
 * @returns {{ status: 'online'|'degraded'|'offline', ageSecs: number }}
 */
function computeProviderStatus(lastHeartbeat, now = Date.now()) {
  if (!lastHeartbeat) {
    return { status: 'offline', ageSecs: Infinity };
  }
  const ageSecs = (now - new Date(lastHeartbeat).getTime()) / 1000;
  if (ageSecs < HEARTBEAT_ONLINE_THRESHOLD_S) {
    return { status: 'online', ageSecs };
  }
  if (ageSecs < HEARTBEAT_DEGRADED_THRESHOLD_S) {
    return { status: 'degraded', ageSecs };
  }
  return { status: 'offline', ageSecs };
}

/**
 * Normalize GPU model name for comparison.
 * @param {string} gpuModel - Raw GPU model string
 * @returns {string} Normalized model name
 */
function normalizeGpuModel(gpuModel) {
  if (!gpuModel) return null;
  return String(gpuModel).toUpperCase().trim();
}

/**
 * Check if provider's GPU type matches job requirements.
 * @param {string} jobRequiredGpu - GPU type required by job (or null for any)
 * @param {string} providerGpu - GPU model provided by provider
 * @returns {{ matched: boolean, exactMatch: boolean, reason: string }}
 */
function matchGpuType(jobRequiredGpu, providerGpu) {
  if (!jobRequiredGpu) {
    // No specific GPU required — any provider GPU is acceptable
    return { matched: true, exactMatch: true, reason: 'no_requirement' };
  }

  const jobGpu = normalizeGpuModel(jobRequiredGpu);
  const provGpu = normalizeGpuModel(providerGpu);

  if (!provGpu) {
    return { matched: false, exactMatch: false, reason: 'provider_gpu_unknown' };
  }

  if (jobGpu === provGpu) {
    return { matched: true, exactMatch: true, reason: 'exact_match' };
  }

  // Check compatibility fallback chain
  const compatibleModels = GPU_COMPATIBILITY[jobGpu];
  if (compatibleModels && compatibleModels.includes(provGpu)) {
    return { matched: true, exactMatch: false, reason: 'compatible_fallback' };
  }

  return { matched: false, exactMatch: false, reason: 'no_match' };
}

/**
 * Check if provider VRAM meets job requirements.
 * @param {number} [jobMinVramGb=0] - Minimum VRAM required (GB)
 * @param {number} [providerVramGb=0] - Provider's available VRAM (GB)
 * @returns {{ satisfied: boolean, providerVramGb: number }}
 */
function matchMemoryRequirement(jobMinVramGb = 0, providerVramGb = 0) {
  const minReq = Math.max(0, jobMinVramGb || 0);
  const available = Math.max(0, providerVramGb || 0);

  return {
    satisfied: available >= minReq,
    providerVramGb: available,
    requiredVramGb: minReq,
  };
}

/**
 * Score a provider for a given job (higher = better).
 * Considers status, uptime, price, GPU match quality, and VRAM headroom.
 *
 * @param {object} provider - Provider record from database
 * @param {object} jobRequirements - Job requirements { min_vram_gb, gpu_type, pricing_class, priority }
 * @param {number} [globalRateHalala=10] - Fallback cost rate (halala/min)
 * @returns {number} Composite score (0-10000)
 */
function scoreProvider(provider, jobRequirements, globalRateHalala = 10) {
  const {
    min_vram_gb: jobMinVram = 0,
    gpu_type: jobGpu = null,
    pricing_class: pricingClass = 'standard',
    priority: jobPriority = 2,
  } = jobRequirements;

  // Status score (0-3000)
  const { status: liveStatus } = computeProviderStatus(provider.last_heartbeat);
  let statusScore = 0;
  if (liveStatus === 'online') statusScore = 3000;
  else if (liveStatus === 'degraded') statusScore = 1500;
  else return 0; // offline providers cannot be used

  // GPU type match score (0-2000)
  const gpuMatch = matchGpuType(jobGpu, provider.gpu_model);
  let gpuScore = 0;
  if (!gpuMatch.matched) return 0; // GPU mismatch is disqualifying
  if (gpuMatch.exactMatch) gpuScore = 2000;
  else gpuScore = 1500; // compatible fallback

  // VRAM requirement match (0-1500)
  const providerVramGb = provider.gpu_vram_mib
    ? provider.gpu_vram_mib / 1024
    : (provider.vram_gb || 0);
  const memoryMatch = matchMemoryRequirement(jobMinVram, providerVramGb);
  if (!memoryMatch.satisfied) return 0; // Insufficient VRAM is disqualifying

  // Award bonus for VRAM headroom (providers with extra capacity preferred)
  let vramScore = 1000; // base memory score
  const headroom = providerVramGb - jobMinVram;
  if (headroom > 4) vramScore = 1500; // significant headroom bonus
  else if (headroom > 0) vramScore = 1200; // some headroom

  // Uptime score (0-1500)
  const uptime = Math.max(0, provider.uptime_percent || 0);
  const uptimeScore = (uptime / 100) * 1500; // linear: 0-1500

  // Price score (0-1000) — cheaper is better
  const effectivePrice = provider.price_per_min_halala != null
    ? provider.price_per_min_halala
    : globalRateHalala;

  // Normalize price: assume 1-100 halala/min range, inverse score
  const minPrice = 1;
  const maxPrice = 100;
  const normalizedPrice = Math.max(minPrice, Math.min(maxPrice, effectivePrice));
  const priceScore = ((maxPrice - normalizedPrice) / (maxPrice - minPrice)) * 1000;

  // Combine scores
  const totalScore = statusScore + gpuScore + vramScore + uptimeScore + priceScore;

  return Math.round(totalScore);
}

/**
 * Find providers matching job requirements, ranked by suitability.
 *
 * @param {object} jobRequirements - Job resource requirements
 * @param {number} [jobRequirements.min_vram_gb=0] - Minimum VRAM needed (GB)
 * @param {string} [jobRequirements.gpu_type] - Required GPU model (or null for any)
 * @param {string} [jobRequirements.pricing_class] - Pricing tier (priority/standard/economy)
 * @param {number} [jobRequirements.priority] - Job priority level
 * @param {number} [globalRateHalala=10] - Fallback cost rate
 * @returns {{ provider: object, score: number, matchDetails: object }[]}
 *   Array of matching providers, ranked highest to lowest score
 */
function findMatchingProviders(jobRequirements, globalRateHalala = 10) {
  const candidates = getDb().all(
    `SELECT id, name, gpu_model, gpu_vram_mib, vram_gb,
            last_heartbeat, uptime_percent, reputation_score,
            price_per_min_halala, status, is_paused
     FROM providers
     WHERE is_paused = 0 AND status NOT IN ('offline', 'banned', 'suspended', 'paused')`
  );

  const results = candidates
    .map(provider => {
      const score = scoreProvider(provider, jobRequirements, globalRateHalala);
      if (score <= 0) return null; // disqualified

      const gpuMatch = matchGpuType(jobRequirements.gpu_type, provider.gpu_model);
      const providerVramGb = provider.gpu_vram_mib
        ? provider.gpu_vram_mib / 1024
        : (provider.vram_gb || 0);
      const memoryMatch = matchMemoryRequirement(jobRequirements.min_vram_gb, providerVramGb);
      const { status: liveStatus } = computeProviderStatus(provider.last_heartbeat);

      return {
        provider,
        score,
        matchDetails: {
          gpu_match: gpuMatch,
          memory_match: memoryMatch,
          provider_status: liveStatus,
          effective_price_halala: provider.price_per_min_halala || globalRateHalala,
          provider_vram_gb: providerVramGb,
        },
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score); // descending score

  return results;
}

/**
 * Find the single best provider match for a job.
 *
 * @param {object} jobRequirements - Job resource requirements
 * @param {number} [globalRateHalala=10] - Fallback cost rate
 * @returns {{ provider: object, score: number, matchDetails: object }|null}
 */
function findBestProvider(jobRequirements, globalRateHalala = 10) {
  const matches = findMatchingProviders(jobRequirements, globalRateHalala);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Schedule multiple jobs across available providers.
 * Uses a greedy approach: assign each job to its best available provider.
 *
 * @param {array} jobs - Array of job requirement objects
 * @param {number} [globalRateHalala=10] - Fallback cost rate
 * @returns {{ job: object, assignment: object|null, reason: string }[]}
 */
function scheduleMultipleJobs(jobs, globalRateHalala = 10) {
  const results = [];

  // Track provider capacity (count of jobs assigned per provider)
  const providerLoad = new Map();

  for (const job of jobs) {
    const matches = findMatchingProviders(job, globalRateHalala);

    if (matches.length === 0) {
      results.push({
        job,
        assignment: null,
        reason: 'no_matching_providers',
      });
      continue;
    }

    // Find first provider not yet assigned a job in this batch
    let assigned = null;
    for (const match of matches) {
      const providerId = match.provider.id;
      const currentLoad = providerLoad.get(providerId) || 0;
      // Simple constraint: each provider gets at most 1 job in a batch
      if (currentLoad === 0) {
        assigned = match;
        providerLoad.set(providerId, currentLoad + 1);
        break;
      }
    }

    if (assigned) {
      results.push({
        job,
        assignment: {
          provider_id: assigned.provider.id,
          provider_name: assigned.provider.name,
          score: assigned.score,
          match_details: assigned.matchDetails,
        },
        reason: 'assigned',
      });
    } else {
      results.push({
        job,
        assignment: null,
        reason: 'no_available_capacity',
      });
    }
  }

  return results;
}

/**
 * Get detailed scheduling report for diagnostic/debugging purposes.
 *
 * @param {object} job - Job requirements
 * @param {number} [limit=5] - Max number of providers to include in report
 * @param {number} [globalRateHalala=10] - Fallback cost rate
 * @returns {object} Detailed scheduling analysis
 */
function getSchedulingReport(job, limit = 5, globalRateHalala = 10) {
  const allMatches = findMatchingProviders(job, globalRateHalala);
  const topMatches = allMatches.slice(0, limit);

  return {
    job_requirements: job,
    total_matching_providers: allMatches.length,
    top_candidates: topMatches.map(m => ({
      provider_id: m.provider.id,
      provider_name: m.provider.name,
      provider_gpu: m.provider.gpu_model,
      score: m.score,
      details: m.matchDetails,
    })),
    best_match: topMatches.length > 0 ? topMatches[0] : null,
  };
}

module.exports = {
  // Core functions
  findMatchingProviders,
  findBestProvider,
  scheduleMultipleJobs,
  getSchedulingReport,

  // Utility functions (exported for testing)
  computeProviderStatus,
  matchGpuType,
  matchMemoryRequirement,
  normalizeGpuModel,
  scoreProvider,

  // Constants
  HEARTBEAT_ONLINE_THRESHOLD_S,
  HEARTBEAT_DEGRADED_THRESHOLD_S,
  GPU_COMPATIBILITY,
};
