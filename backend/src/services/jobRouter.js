/**
 * jobRouter.js - GPU-fit provider selection for DCP job routing (DCP-205 + DCP-920)
 *
 * Algorithm:
 *   1. Fetch all non-paused providers with a heartbeat
 *   2. Filter: status must be 'online' or 'degraded'
 *   3. Filter: VRAM >= job.min_vram_gb
 *   4. Filter: stake_status not 'insufficient'/'slashed' when REQUIRE_STAKE=true (DCP-920)
 *   5. Sort: uptime DESC, then price ASC
 *   6. Return top match or null (caller sends 503)
 *
 * Heartbeat thresholds (DCP-183): < 2min=online, 2-10min=degraded, >10min=offline
 *
 * Stake gate (DCP-920): When REQUIRE_STAKE=true, providers with stake_status
 * 'insufficient' or 'slashed' are excluded. The stake_status column is kept
 * current by stakeEventListener.js via ProviderStake.sol events. Default: false.
 */

'use strict';

const db = require('../db');

const HEARTBEAT_ONLINE_THRESHOLD_S   = 120;
const HEARTBEAT_DEGRADED_THRESHOLD_S = 600;

function computeStatus(lastHeartbeat, now) {
  if (!lastHeartbeat) return { status: 'offline', ageSecs: Infinity };
  const ageSecs = (now - new Date(lastHeartbeat).getTime()) / 1000;
  if (ageSecs < HEARTBEAT_ONLINE_THRESHOLD_S)   return { status: 'online',   ageSecs };
  if (ageSecs < HEARTBEAT_DEGRADED_THRESHOLD_S) return { status: 'degraded', ageSecs };
  return { status: 'offline', ageSecs };
}

function findBestProvider({ job_type, min_vram_gb = 0, globalRateHalala = 10, pricing_class = 'standard' }) {
  const candidates = db.all(
    `SELECT id, name, gpu_model, gpu_name_detected, gpu_vram_mib, vram_gb,
            last_heartbeat, uptime_percent, reputation_score, price_per_min_halala,
            model_preload_status, status, is_paused,
            stake_status, evm_wallet_address, gpu_tier
     FROM providers
     WHERE is_paused = 0 AND last_heartbeat IS NOT NULL`
  );

  const requireStake = process.env.REQUIRE_STAKE === 'true';
  const now = Date.now();

  const qualified = candidates
    .map(p => {
      const { status: liveStatus } = computeStatus(p.last_heartbeat, now);
      if (liveStatus === 'offline') return null;

      const providerVramGb = p.gpu_vram_mib
        ? p.gpu_vram_mib / 1024
        : (p.vram_gb || 0);
      if (min_vram_gb > 0 && providerVramGb < min_vram_gb) return null;

      // DCP-920: exclude providers with insufficient/slashed stake when required
      if (requireStake) {
        const stakeStatus = p.stake_status || 'none';
        if (stakeStatus === 'insufficient' || stakeStatus === 'slashed') {
          console.warn(`[jobRouter] Excluding provider #${p.id} (${p.name}): stake_status=${stakeStatus}`);
          return null;
        }
      }

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
        stake_verified: requireStake ? (p.stake_status === 'active') : null,
      };
    })
    .filter(Boolean);

  if (qualified.length === 0) return null;

  qualified.sort((a, b) => {
    if (a.live_status !== b.live_status) return a.live_status === 'online' ? -1 : 1;
    if (String(pricing_class).toLowerCase() === 'priority' && a.preload_ready !== b.preload_ready) {
      return a.preload_ready ? -1 : 1;
    }
    const uptimeDiff = b.uptime_percent - a.uptime_percent;
    if (uptimeDiff !== 0) return uptimeDiff;
    return a.effective_price - b.effective_price;
  });

  const winner = qualified[0];
  console.log(
    `[jobRouter] job_type=${job_type} pricing_class=${pricing_class} min_vram=${min_vram_gb}GB -> ` +
    `provider #${winner.id} (${winner.name}) status=${winner.live_status} ` +
    `uptime=${winner.uptime_percent}% price=${winner.effective_price}h/min ` +
    `vram=${winner.vram_gb_resolved.toFixed(1)}GB`
  );

  return { provider: winner, effective_price_halala: winner.effective_price };
}

module.exports = { findBestProvider };
