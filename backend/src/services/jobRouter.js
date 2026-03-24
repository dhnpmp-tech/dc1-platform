/**
 * jobRouter.js — GPU-fit provider selection for DCP job routing
 *
 * Algorithm (DCP-205):
 *   1. Fetch all non-paused providers that have sent a heartbeat recently
 *   2. Filter: computed status must be 'online' or 'degraded' (not offline)
 *   3. Filter: provider VRAM >= job.min_vram_gb (if specified)
 *   4. Sort:   uptime_percent DESC  →  prefer highest-reliability provider
 *              price_per_min_halala ASC  →  break ties by cheapest price
 *   5. Return top match, or null when no provider qualifies (→ caller sends 503)
 *
 * Heartbeat thresholds mirror DCP-183 graduated status:
 *   < 2 min  → online   (preferred)
 *   2–10 min → degraded (still bookable, lower preference)
 *   > 10 min → offline  (excluded)
 */

'use strict';

const db = require('../db');

// Mirror of DCP-183 constants (providers.js) — keep in sync
const HEARTBEAT_ONLINE_THRESHOLD_S   = 120;   // 2 min
const HEARTBEAT_DEGRADED_THRESHOLD_S = 600;   // 10 min

/**
 * Compute graduated heartbeat status from last_heartbeat timestamp.
 * @param {string|null} lastHeartbeat - ISO timestamp of last heartbeat
 * @param {number} now - Date.now() reference (ms)
 * @returns {{ status: 'online'|'degraded'|'offline', ageSecs: number }}
 */
function computeStatus(lastHeartbeat, now) {
  if (!lastHeartbeat) return { status: 'offline', ageSecs: Infinity };
  const ageSecs = (now - new Date(lastHeartbeat).getTime()) / 1000;
  if (ageSecs < HEARTBEAT_ONLINE_THRESHOLD_S)   return { status: 'online',   ageSecs };
  if (ageSecs < HEARTBEAT_DEGRADED_THRESHOLD_S) return { status: 'degraded', ageSecs };
  return { status: 'offline', ageSecs };
}

/**
 * Find the best available provider for a job.
 *
 * @param {object} opts
 * @param {string} opts.job_type           - Job type (used for logging; pricing is global)
 * @param {number} [opts.min_vram_gb]      - Minimum VRAM required in GB (0 = no requirement)
 * @param {number} [opts.globalRateHalala] - Fallback cost rate (halala/min) when provider has no
 *                                           custom price_per_min_halala set (from COST_RATES)
 * @returns {{ provider: object, effective_price_halala: number }|null}
 *   Returns null when no provider is available (caller should respond 503).
 */
function findBestProvider({ job_type, min_vram_gb = 0, globalRateHalala = 10, pricing_class = 'standard' }) {
  // Pull all active providers that have ever sent a heartbeat
  const candidates = db.all(
    `SELECT id, name, gpu_model, gpu_name_detected, gpu_vram_mib, vram_gb,
            last_heartbeat, uptime_percent, reputation_score, price_per_min_halala,
            model_preload_status, status, is_paused
     FROM providers
     WHERE is_paused = 0 AND last_heartbeat IS NOT NULL`
  );

  const now = Date.now();

  const qualified = candidates
    .map(p => {
      const { status: liveStatus } = computeStatus(p.last_heartbeat, now);

      // Exclude offline providers
      if (liveStatus === 'offline') return null;

      // VRAM check — use detected VRAM first, then registration value
      const providerVramGb = p.gpu_vram_mib
        ? p.gpu_vram_mib / 1024
        : (p.vram_gb || 0);

      if (min_vram_gb > 0 && providerVramGb < min_vram_gb) return null;

      // Effective per-minute price: provider custom rate or global fallback
      const effective_price = (p.price_per_min_halala != null)
        ? p.price_per_min_halala
        : globalRateHalala;

      return {
        ...p,
        live_status: liveStatus,
        effective_price,
        vram_gb_resolved: providerVramGb,
        uptime_percent: p.uptime_percent || 0,
        preload_ready: String(p.model_preload_status || '').toLowerCase() === 'ready',
      };
    })
    .filter(Boolean);

  if (qualified.length === 0) return null;

  // Sort: online before degraded, then reputation DESC, then uptime DESC, then price ASC
  // DCP-867: Reputation scoring integrated into provider dispatch selection
  qualified.sort((a, b) => {
    // Online providers are preferred over degraded
    if (a.live_status !== b.live_status) {
      return a.live_status === 'online' ? -1 : 1;
    }
    // Priority class favors already pre-warmed providers to minimize cold starts.
    if (String(pricing_class).toLowerCase() === 'priority' && a.preload_ready !== b.preload_ready) {
      return a.preload_ready ? -1 : 1;
    }
    // Higher reputation first (DCP-867: provider quality scoring, default 50 for new providers)
    const repDiff = (b.reputation_score || 50) - (a.reputation_score || 50);
    if (repDiff !== 0) return repDiff;
    // Higher uptime first
    const uptimeDiff = b.uptime_percent - a.uptime_percent;
    if (uptimeDiff !== 0) return uptimeDiff;
    // Cheaper price first (tie-break)
    return a.effective_price - b.effective_price;
  });

  const winner = qualified[0];
  console.log(
    `[jobRouter] job_type=${job_type} pricing_class=${pricing_class} min_vram=${min_vram_gb}GB → ` +
    `provider #${winner.id} (${winner.name}) status=${winner.live_status} ` +
    `uptime=${winner.uptime_percent}% price=${winner.effective_price}h/min ` +
    `vram=${winner.vram_gb_resolved.toFixed(1)}GB`
  );

  return { provider: winner, effective_price_halala: winner.effective_price };
}

module.exports = { findBestProvider };
