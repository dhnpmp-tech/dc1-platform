'use strict';

/**
 * HyperAgent Memory Store
 *
 * Persistent SQLite tables that give the agent long-term memory:
 *   • ha_strategies        — versioned heuristic parameter sets
 *   • ha_outcomes          — per-job outcome records for learning
 *   • ha_meta_log          — log of meta-agent improvement cycles
 *   • ha_gpu_profiles      — learned GPU performance profiles
 *
 * Follows the DGM-H pattern: strategies are immutable versions.
 * The meta-agent creates new versions; old ones are kept for rollback.
 */

const db = require('../../db');

const TAG = '[ha-memory]';

// ── Schema ──────────────────────────────────────────────────────────────────────

function ensureSchema() {
  const raw = db._db || db;

  raw.exec(`
    CREATE TABLE IF NOT EXISTS ha_strategies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL,
      gpu_model TEXT NOT NULL DEFAULT '*',
      job_type TEXT NOT NULL DEFAULT '*',

      -- Acceptance thresholds
      min_profit_margin REAL NOT NULL DEFAULT 0.15,
      max_queue_depth INTEGER NOT NULL DEFAULT 5,
      min_gpu_util_pct REAL NOT NULL DEFAULT 0.0,
      max_gpu_temp_c REAL NOT NULL DEFAULT 85.0,
      reject_below_halala INTEGER NOT NULL DEFAULT 10,

      -- Pricing adjustments
      price_multiplier REAL NOT NULL DEFAULT 1.0,
      demand_surge_threshold REAL NOT NULL DEFAULT 0.8,
      demand_surge_multiplier REAL NOT NULL DEFAULT 1.25,

      -- Scheduling preferences
      prefer_short_jobs INTEGER NOT NULL DEFAULT 0,
      max_duration_secs INTEGER NOT NULL DEFAULT 86400,
      prefer_cached_models INTEGER NOT NULL DEFAULT 1,
      cache_bonus_pct REAL NOT NULL DEFAULT 10.0,

      -- Meta
      is_active INTEGER NOT NULL DEFAULT 1,
      parent_version INTEGER,
      improvement_reason TEXT,
      performance_score REAL DEFAULT 0.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),

      UNIQUE(version, gpu_model, job_type)
    )
  `);

  // Index for fast active strategy lookup
  raw.exec(`
    CREATE INDEX IF NOT EXISTS idx_ha_strategies_active
    ON ha_strategies(is_active, gpu_model, job_type)
  `);

  raw.exec(`
    CREATE TABLE IF NOT EXISTS ha_outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      job_id TEXT NOT NULL,
      gpu_model TEXT,
      job_type TEXT,
      accepted INTEGER NOT NULL DEFAULT 1,
      strategy_version INTEGER,

      -- Outcome metrics
      earned_halala INTEGER DEFAULT 0,
      power_cost_halala INTEGER DEFAULT 0,
      duration_secs REAL DEFAULT 0,
      success INTEGER DEFAULT 0,
      queue_wait_secs REAL DEFAULT 0,
      gpu_util_avg REAL DEFAULT 0,

      -- Derived
      profit_halala INTEGER DEFAULT 0,
      profit_margin REAL DEFAULT 0,

      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (provider_id) REFERENCES providers(id)
    )
  `);

  raw.exec(`
    CREATE INDEX IF NOT EXISTS idx_ha_outcomes_provider
    ON ha_outcomes(provider_id, recorded_at DESC)
  `);
  raw.exec(`
    CREATE INDEX IF NOT EXISTS idx_ha_outcomes_gpu
    ON ha_outcomes(gpu_model, recorded_at DESC)
  `);

  raw.exec(`
    CREATE TABLE IF NOT EXISTS ha_meta_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_number INTEGER NOT NULL,
      old_version INTEGER,
      new_version INTEGER,
      outcomes_analysed INTEGER DEFAULT 0,
      improvements TEXT,
      performance_before REAL,
      performance_after REAL,
      reasoning TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  raw.exec(`
    CREATE TABLE IF NOT EXISTS ha_gpu_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gpu_model TEXT NOT NULL,
      job_type TEXT NOT NULL DEFAULT '*',
      avg_duration_secs REAL DEFAULT 0,
      avg_profit_margin REAL DEFAULT 0,
      success_rate REAL DEFAULT 0,
      avg_power_watts REAL DEFAULT 0,
      sample_count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(gpu_model, job_type)
    )
  `);

  // Seed default strategy if none exists
  const count = (raw.prepare || db.prepare).call(
    raw.prepare ? raw : db,
    'SELECT COUNT(*) as c FROM ha_strategies'
  ).get().c;

  if (count === 0) {
    seedDefaultStrategies(raw);
  }
}

function seedDefaultStrategies(raw) {
  const stmt = (raw.prepare || db.prepare).call(
    raw.prepare ? raw : db,
    `INSERT INTO ha_strategies
     (version, gpu_model, job_type, min_profit_margin, max_queue_depth,
      reject_below_halala, price_multiplier, demand_surge_threshold,
      demand_surge_multiplier, prefer_cached_models, cache_bonus_pct,
      is_active, improvement_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );

  const defaults = [
    // Global baseline
    [1, '*', '*', 0.15, 5, 10, 1.0, 0.8, 1.25, 1, 10.0, 'Initial baseline strategy'],
    // Enterprise GPUs — higher margins, prioritise large jobs
    [1, 'h100', '*', 0.20, 3, 500, 1.0, 0.7, 1.30, 1, 5.0, 'H100 enterprise default'],
    [1, 'h200', '*', 0.20, 3, 500, 1.0, 0.7, 1.30, 1, 5.0, 'H200 enterprise default'],
    [1, 'a100', '*', 0.18, 4, 200, 1.0, 0.75, 1.25, 1, 8.0, 'A100 high-tier default'],
    // Consumer GPUs — volume play, lower thresholds
    [1, 'rtx 4090', '*', 0.12, 8, 5, 1.0, 0.85, 1.20, 1, 15.0, 'RTX 4090 consumer default'],
    [1, 'rtx 3090', '*', 0.10, 10, 3, 1.0, 0.90, 1.15, 1, 20.0, 'RTX 3090 consumer default'],
  ];

  const txn = (raw.transaction || db.transaction).call(
    raw.transaction ? raw : db,
    () => {
      for (const d of defaults) {
        stmt.run(...d);
      }
    }
  );
  txn();
  console.log(`${TAG} Seeded ${defaults.length} default strategies (v1)`);
}

// ── Read helpers ────────────────────────────────────────────────────────────────

function getActiveStrategies() {
  return db.prepare(`
    SELECT * FROM ha_strategies WHERE is_active = 1 ORDER BY gpu_model, job_type
  `).all();
}

function getStrategyFor(gpuModel, jobType) {
  // Try exact match first, then gpu-only, then global fallback
  const candidates = [
    { gpu: gpuModel?.toLowerCase(), type: jobType },
    { gpu: gpuModel?.toLowerCase(), type: '*' },
    { gpu: '*', type: '*' },
  ];

  for (const c of candidates) {
    const row = db.prepare(`
      SELECT * FROM ha_strategies
      WHERE is_active = 1
        AND LOWER(gpu_model) = ?
        AND job_type = ?
      ORDER BY version DESC
      LIMIT 1
    `).get(c.gpu || '*', c.type || '*');
    if (row) return row;
  }

  // Absolute fallback — return sensible defaults
  return {
    version: 0,
    gpu_model: '*',
    job_type: '*',
    min_profit_margin: 0.15,
    max_queue_depth: 5,
    min_gpu_util_pct: 0,
    max_gpu_temp_c: 85,
    reject_below_halala: 10,
    price_multiplier: 1.0,
    demand_surge_threshold: 0.8,
    demand_surge_multiplier: 1.25,
    prefer_short_jobs: 0,
    max_duration_secs: 86400,
    prefer_cached_models: 1,
    cache_bonus_pct: 10.0,
    is_active: 1,
  };
}

function getRecentOutcomes(limit = 50) {
  return db.prepare(`
    SELECT * FROM ha_outcomes ORDER BY recorded_at DESC LIMIT ?
  `).all(limit);
}

function getMetaHistory(limit = 20) {
  return db.prepare(`
    SELECT * FROM ha_meta_log ORDER BY created_at DESC LIMIT ?
  `).all(limit);
}

function getPerformanceStats() {
  const overall = db.prepare(`
    SELECT
      COUNT(*) as total_decisions,
      SUM(CASE WHEN accepted = 1 THEN 1 ELSE 0 END) as accepted_count,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
      SUM(earned_halala) as total_earned,
      SUM(power_cost_halala) as total_power_cost,
      SUM(profit_halala) as total_profit,
      AVG(profit_margin) as avg_profit_margin,
      AVG(duration_secs) as avg_duration
    FROM ha_outcomes
    WHERE recorded_at >= datetime('now', '-7 days')
  `).get();

  const byGpu = db.prepare(`
    SELECT
      gpu_model,
      COUNT(*) as jobs,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
      SUM(profit_halala) as profit,
      AVG(profit_margin) as avg_margin,
      AVG(duration_secs) as avg_duration
    FROM ha_outcomes
    WHERE recorded_at >= datetime('now', '-7 days')
    GROUP BY gpu_model
  `).all();

  const byJobType = db.prepare(`
    SELECT
      job_type,
      COUNT(*) as jobs,
      AVG(profit_margin) as avg_margin,
      SUM(profit_halala) as profit
    FROM ha_outcomes
    WHERE recorded_at >= datetime('now', '-7 days')
    GROUP BY job_type
  `).all();

  return { overall, byGpu, byJobType };
}

// ── Write helpers ───────────────────────────────────────────────────────────────

function insertOutcome(outcome) {
  const profit = (outcome.earned_halala || 0) - (outcome.power_cost_halala || 0);
  const margin = outcome.earned_halala > 0
    ? profit / outcome.earned_halala
    : 0;

  return db.prepare(`
    INSERT INTO ha_outcomes
      (provider_id, job_id, gpu_model, job_type, accepted, strategy_version,
       earned_halala, power_cost_halala, duration_secs, success,
       queue_wait_secs, gpu_util_avg, profit_halala, profit_margin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    outcome.provider_id,
    outcome.job_id,
    outcome.gpu_model || null,
    outcome.job_type || null,
    outcome.accepted ? 1 : 0,
    outcome.strategy_version || null,
    outcome.earned_halala || 0,
    outcome.power_cost_halala || 0,
    outcome.duration_secs || 0,
    outcome.success ? 1 : 0,
    outcome.queue_wait_secs || 0,
    outcome.gpu_util_avg || 0,
    profit,
    margin
  );
}

function createNewStrategy(params) {
  return db.prepare(`
    INSERT INTO ha_strategies
      (version, gpu_model, job_type, min_profit_margin, max_queue_depth,
       min_gpu_util_pct, max_gpu_temp_c, reject_below_halala,
       price_multiplier, demand_surge_threshold, demand_surge_multiplier,
       prefer_short_jobs, max_duration_secs, prefer_cached_models, cache_bonus_pct,
       is_active, parent_version, improvement_reason, performance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
    params.version,
    params.gpu_model || '*',
    params.job_type || '*',
    params.min_profit_margin,
    params.max_queue_depth,
    params.min_gpu_util_pct || 0,
    params.max_gpu_temp_c || 85,
    params.reject_below_halala,
    params.price_multiplier,
    params.demand_surge_threshold,
    params.demand_surge_multiplier,
    params.prefer_short_jobs || 0,
    params.max_duration_secs || 86400,
    params.prefer_cached_models ?? 1,
    params.cache_bonus_pct || 10,
    params.parent_version,
    params.improvement_reason,
    params.performance_score || 0
  );
}

function deactivateStrategy(version, gpuModel, jobType) {
  return db.prepare(`
    UPDATE ha_strategies SET is_active = 0
    WHERE version = ? AND gpu_model = ? AND job_type = ?
  `).run(version, gpuModel, jobType);
}

function logMetaCycle(entry) {
  return db.prepare(`
    INSERT INTO ha_meta_log
      (cycle_number, old_version, new_version, outcomes_analysed,
       improvements, performance_before, performance_after, reasoning)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.cycle_number,
    entry.old_version,
    entry.new_version,
    entry.outcomes_analysed,
    JSON.stringify(entry.improvements),
    entry.performance_before,
    entry.performance_after,
    entry.reasoning
  );
}

function updateGpuProfile(gpuModel, jobType, stats) {
  return db.prepare(`
    INSERT INTO ha_gpu_profiles (gpu_model, job_type, avg_duration_secs,
      avg_profit_margin, success_rate, avg_power_watts, sample_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(gpu_model, job_type) DO UPDATE SET
      avg_duration_secs = ?,
      avg_profit_margin = ?,
      success_rate = ?,
      avg_power_watts = ?,
      sample_count = sample_count + ?,
      updated_at = datetime('now')
  `).run(
    gpuModel, jobType,
    stats.avg_duration, stats.avg_margin, stats.success_rate,
    stats.avg_power, stats.count,
    stats.avg_duration, stats.avg_margin, stats.success_rate,
    stats.avg_power, stats.count
  );
}

function getNextVersion() {
  const row = db.prepare('SELECT MAX(version) as v FROM ha_strategies').get();
  return (row?.v || 0) + 1;
}

function getOutcomesForAnalysis(sinceDays = 1) {
  return db.prepare(`
    SELECT * FROM ha_outcomes
    WHERE recorded_at >= datetime('now', '-' || ? || ' days')
    ORDER BY recorded_at ASC
  `).all(sinceDays);
}

function getNextCycleNumber() {
  const row = db.prepare('SELECT MAX(cycle_number) as c FROM ha_meta_log').get();
  return (row?.c || 0) + 1;
}

module.exports = {
  ensureSchema,
  getActiveStrategies,
  getStrategyFor,
  getRecentOutcomes,
  getMetaHistory,
  getPerformanceStats,
  insertOutcome,
  createNewStrategy,
  deactivateStrategy,
  logMetaCycle,
  updateGpuProfile,
  getNextVersion,
  getOutcomesForAnalysis,
  getNextCycleNumber,
};
