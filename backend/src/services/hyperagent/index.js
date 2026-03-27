'use strict';

/**
 * HyperAgent Job Optimizer — DCP-HA
 *
 * A self-improving agent system inspired by the Darwin Gödel Machine / HyperAgents
 * architecture (arxiv 2603.19461). Consists of:
 *
 *   1. Task Agent   — makes real-time job acceptance, pricing, and scheduling decisions
 *   2. Meta Agent   — analyses outcomes and rewrites the task agent's heuristics
 *   3. Memory Store — persistent SQLite tables for strategies, outcomes, and meta-learnings
 *
 * The system runs in two modes:
 *   • Real-time advisory:  called by the job router for accept/reject/price decisions
 *   • Periodic self-improvement:  PM2 cron triggers meta-agent every 6 hours
 *
 * Integration points:
 *   • providers.js  buildNextPendingJob() — consults task agent before assignment
 *   • daemon        estimate_job_profitability() — receives strategy parameters
 *   • heartbeat     POST /heartbeat — feeds GPU telemetry into memory
 */

const memory = require('./memory');
const taskAgent = require('./taskAgent');
const metaAgent = require('./metaAgent');

const TAG = '[hyperagent]';

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Initialise the HyperAgent system. Called once at server boot.
 */
function init() {
  memory.ensureSchema();
  console.log(`${TAG} Initialised — strategy store ready`);
}

/**
 * Advisory call: should this provider accept this job?
 * Returns { accept: bool, reason: string, suggested_price_halala?: number }
 *
 * @param {object} provider — row from providers table (id, gpu_model, vram_gb, etc.)
 * @param {object} job      — row from jobs table (job_id, job_type, model, cost_halala, etc.)
 * @param {object} context  — runtime context { gpu_utilisation, power_watts, queue_depth }
 */
function advise(provider, job, context = {}) {
  return taskAgent.evaluate(provider, job, context);
}

/**
 * Record the outcome of a job for the meta agent to learn from.
 *
 * @param {object} outcome — { provider_id, job_id, accepted, earned_halala,
 *                             duration_secs, success, gpu_model, job_type,
 *                             power_cost_halala, strategy_version }
 */
function recordOutcome(outcome) {
  memory.insertOutcome(outcome);
}

/**
 * Run the meta-agent self-improvement cycle.
 * Called by PM2 cron every 6 hours or on-demand via admin API.
 * Returns { improved: bool, changes: string[], reasoning: string }
 */
async function runMetaCycle() {
  return metaAgent.improve();
}

/**
 * Get the current active strategy for a given GPU model.
 * Used by the daemon to tune its profitability calculation.
 *
 * @param {string} gpuModel — e.g. 'RTX 4090'
 * @returns {object} strategy parameters
 */
function getStrategy(gpuModel) {
  return taskAgent.getStrategyForGpu(gpuModel);
}

/**
 * Get performance dashboard data.
 */
function getDashboard() {
  return {
    strategies: memory.getActiveStrategies(),
    recentOutcomes: memory.getRecentOutcomes(50),
    metaHistory: memory.getMetaHistory(20),
    stats: memory.getPerformanceStats(),
  };
}

module.exports = {
  init,
  advise,
  recordOutcome,
  runMetaCycle,
  getStrategy,
  getDashboard,
};
