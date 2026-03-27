'use strict';

/**
 * HyperAgent Meta Agent — LLM-Powered Self-Improvement Engine
 *
 * The "outer loop" of the DGM-H architecture. Uses MiniMax M2.7 to reason
 * about job outcomes and generate improved strategy parameters.
 *
 * Instead of hard-coded hill-climbing rules, the meta-agent:
 *   1. Aggregates outcome data from SQLite into a concise metrics snapshot
 *   2. Sends the snapshot + current strategies + recent meta-history to M2.7
 *   3. M2.7 reasons about patterns, diagnoses problems, and proposes changes
 *   4. Response is parsed, bounded (max ±20% per param), and versioned
 *   5. If M2.7 is unreachable, falls back to gradient-free hill climbing
 *
 * Key DGM-H principles:
 *   • The LLM sees its own previous reasoning (meta-history) — self-referential
 *   • Strategies are immutable versions — rollback always possible
 *   • Changes bounded for safety even when LLM suggests larger moves
 *   • Transfer learning: LLM can reason across GPU types simultaneously
 */

const memory = require('./memory');
const db = require('../../db');
const https = require('https');
const http = require('http');

const TAG = '[ha-meta]';

// ── Configuration ───────────────────────────────────────────────────────────
const MINIMAX_API_URL = process.env.MINIMAX_API_URL || 'https://api.minimax.io/v1/text/chatcompletion_v2';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

const MAX_ADJUSTMENT_PCT = 0.20;
const MIN_OUTCOMES_FOR_IMPROVEMENT = 10;

// Performance scoring weights (used for both LLM context and fallback scoring)
const WEIGHTS = {
  profit_margin: 0.35,
  success_rate: 0.30,
  utilisation: 0.15,
  acceptance_rate: 0.10,
  revenue: 0.10,
};

// ── Main improvement cycle ──────────────────────────────────────────────────

/**
 * Run a full meta-agent improvement cycle.
 * @returns {{ improved: boolean, changes: string[], cycle: number, reasoning: string }}
 */
async function improve() {
  const cycleNum = memory.getNextCycleNumber();
  console.log(`${TAG} Starting meta-cycle #${cycleNum}`);

  // 1. Gather recent outcomes
  const outcomes = memory.getOutcomesForAnalysis(7);

  if (outcomes.length < MIN_OUTCOMES_FOR_IMPROVEMENT) {
    console.log(`${TAG} Only ${outcomes.length} outcomes (need ${MIN_OUTCOMES_FOR_IMPROVEMENT}). Skipping.`);
    memory.logMetaCycle({
      cycle_number: cycleNum,
      old_version: null,
      new_version: null,
      outcomes_analysed: outcomes.length,
      improvements: [],
      performance_before: null,
      performance_after: null,
      reasoning: `Insufficient data: ${outcomes.length}/${MIN_OUTCOMES_FOR_IMPROVEMENT} outcomes`,
    });
    return { improved: false, changes: [], cycle: cycleNum, reasoning: 'Insufficient data' };
  }

  // 2. Group and compute metrics
  const groups = groupOutcomes(outcomes);
  const activeStrategies = memory.getActiveStrategies();
  const currentMaxVersion = activeStrategies.reduce((max, s) => Math.max(max, s.version), 0);
  const recentMeta = memory.getMetaHistory(5);

  // 3. Build context snapshot for the LLM
  const metricsSnapshot = buildMetricsSnapshot(groups, activeStrategies, recentMeta);

  // 4. Call M2.7 for reasoning and adjustments (fallback to hill climbing)
  let llmResult;
  if (MINIMAX_API_KEY) {
    try {
      llmResult = await callMinimax(metricsSnapshot, cycleNum);
      console.log(`${TAG} M2.7 returned ${llmResult.adjustments?.length || 0} GPU adjustments`);
    } catch (err) {
      console.error(`${TAG} M2.7 call failed, falling back to hill climbing:`, err.message);
      llmResult = null;
    }
  } else {
    console.log(`${TAG} No MINIMAX_API_KEY configured — using hill climbing fallback`);
  }

  // 5. Apply adjustments (from LLM or fallback)
  const newVersion = currentMaxVersion + 1;
  let allChanges = [];
  let anyImproved = false;
  let reasoning = '';

  if (llmResult && llmResult.adjustments && llmResult.adjustments.length > 0) {
    // ── LLM-driven adjustments ────────────────────────────────────────
    reasoning = llmResult.reasoning || '';

    for (const adj of llmResult.adjustments) {
      const gpuModel = (adj.gpu_model || '*').toLowerCase();
      const currentStrategy = memory.getStrategyFor(gpuModel, '*');

      const newParams = { ...currentStrategy };
      delete newParams.id;
      delete newParams.created_at;
      delete newParams.is_active;

      // Apply each proposed change with safety bounds
      const changes = [];
      for (const [key, value] of Object.entries(adj.params || {})) {
        if (!(key in newParams) || typeof newParams[key] !== 'number') continue;

        const original = currentStrategy[key];
        if (original === 0) {
          newParams[key] = value;
        } else {
          const maxDelta = Math.abs(original * MAX_ADJUSTMENT_PCT);
          const delta = value - original;
          const boundedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta));
          newParams[key] = parseFloat((original + boundedDelta).toFixed(4));
        }

        if (newParams[key] !== original) {
          changes.push(`${key}: ${original} → ${newParams[key]}`);
        }
      }

      if (changes.length === 0) continue;

      newParams.version = newVersion;
      newParams.gpu_model = currentStrategy.gpu_model;
      newParams.job_type = currentStrategy.job_type;
      newParams.parent_version = currentStrategy.version;
      newParams.improvement_reason = adj.reason || reasoning.slice(0, 200);
      newParams.performance_score = computePerformanceScore(
        computeMetrics(groups[gpuModel] || outcomes)
      );

      memory.createNewStrategy(newParams);
      memory.deactivateStrategy(currentStrategy.version, currentStrategy.gpu_model, currentStrategy.job_type);

      allChanges.push(...changes.map(c => `${gpuModel}: ${c}`));
      anyImproved = true;

      console.log(`${TAG}   v${newVersion} for ${gpuModel}: ${changes.length} LLM-driven changes`);

      // Update GPU profile
      const gpuOutcomes = groups[gpuModel] || [];
      if (gpuOutcomes.length >= 3) {
        const metrics = computeMetrics(gpuOutcomes);
        memory.updateGpuProfile(gpuModel, '*', {
          avg_duration: metrics.avg_duration,
          avg_margin: metrics.avg_margin,
          success_rate: metrics.success_rate,
          avg_power: metrics.avg_power,
          count: gpuOutcomes.length,
        });
      }
    }
  } else {
    // ── Fallback: gradient-free hill climbing ─────────────────────────
    reasoning = 'Fallback hill climbing (no LLM available)';

    for (const [gpuModel, gpuOutcomes] of Object.entries(groups)) {
      if (gpuOutcomes.length < 3) continue;

      const metrics = computeMetrics(gpuOutcomes);
      const currentStrategy = memory.getStrategyFor(gpuModel, '*');
      const adjustments = generateHillClimbAdjustments(metrics, currentStrategy);

      if (adjustments.changes.length === 0) continue;

      const newParams = applyBoundedAdjustments(currentStrategy, adjustments);
      newParams.version = newVersion;
      newParams.gpu_model = currentStrategy.gpu_model;
      newParams.job_type = currentStrategy.job_type;
      newParams.parent_version = currentStrategy.version;
      newParams.improvement_reason = adjustments.reasoning;
      newParams.performance_score = computePerformanceScore(metrics);

      memory.createNewStrategy(newParams);
      memory.deactivateStrategy(currentStrategy.version, currentStrategy.gpu_model, currentStrategy.job_type);

      allChanges.push(...adjustments.changes.map(c => `${gpuModel}: ${c}`));
      anyImproved = true;

      memory.updateGpuProfile(gpuModel, '*', {
        avg_duration: metrics.avg_duration,
        avg_margin: metrics.avg_margin,
        success_rate: metrics.success_rate,
        avg_power: metrics.avg_power,
        count: gpuOutcomes.length,
      });
    }
  }

  // 6. Log the cycle
  const stats = memory.getPerformanceStats();
  memory.logMetaCycle({
    cycle_number: cycleNum,
    old_version: currentMaxVersion,
    new_version: anyImproved ? newVersion : currentMaxVersion,
    outcomes_analysed: outcomes.length,
    improvements: allChanges,
    performance_before: stats.overall?.avg_profit_margin || 0,
    performance_after: null,
    reasoning: reasoning.slice(0, 2000),
  });

  console.log(
    `${TAG} Meta-cycle #${cycleNum} complete. ` +
    `Improved: ${anyImproved}. Changes: ${allChanges.length}. ` +
    `Source: ${llmResult ? 'M2.7' : 'hill-climbing'}`
  );

  return { improved: anyImproved, changes: allChanges, cycle: cycleNum, reasoning };
}

// ── LLM Integration ─────────────────────────────────────────────────────────

/**
 * Build a compact metrics snapshot for the LLM prompt.
 */
function buildMetricsSnapshot(groups, strategies, recentMeta) {
  const snapshot = {
    period: 'last 7 days',
    gpu_groups: {},
    current_strategies: {},
    recent_meta_history: [],
  };

  for (const [gpu, outcomes] of Object.entries(groups)) {
    const m = computeMetrics(outcomes);
    snapshot.gpu_groups[gpu] = {
      total_jobs: m.total_outcomes,
      accepted: m.accepted_count,
      successful: m.success_count,
      acceptance_rate: pct(m.acceptance_rate),
      success_rate: pct(m.success_rate),
      avg_profit_margin: pct(m.avg_margin),
      failure_rate: pct(m.failure_rate),
      avg_duration_secs: Math.round(m.avg_duration),
      avg_gpu_util: pct(m.avg_gpu_util / 100),
      total_earned_halala: m.total_earned,
      total_profit_halala: m.total_profit,
      avg_queue_wait_secs: Math.round(m.avg_queue_wait),
    };
  }

  for (const s of strategies) {
    const key = `${s.gpu_model}/${s.job_type}`;
    snapshot.current_strategies[key] = {
      version: s.version,
      min_profit_margin: s.min_profit_margin,
      max_queue_depth: s.max_queue_depth,
      reject_below_halala: s.reject_below_halala,
      price_multiplier: s.price_multiplier,
      demand_surge_threshold: s.demand_surge_threshold,
      demand_surge_multiplier: s.demand_surge_multiplier,
      max_gpu_temp_c: s.max_gpu_temp_c,
      prefer_cached_models: s.prefer_cached_models,
      cache_bonus_pct: s.cache_bonus_pct,
    };
  }

  for (const m of recentMeta.slice(0, 3)) {
    snapshot.recent_meta_history.push({
      cycle: m.cycle_number,
      improved: m.new_version > m.old_version,
      changes: m.improvements ? JSON.parse(m.improvements) : [],
      reasoning: (m.reasoning || '').slice(0, 300),
    });
  }

  return snapshot;
}

function pct(v) { return `${(v * 100).toFixed(1)}%`; }

/**
 * Call MiniMax M2.7 API with the metrics snapshot.
 * Returns { reasoning: string, adjustments: [{ gpu_model, params, reason }] }
 */
function callMinimax(snapshot, cycleNum) {
  const systemPrompt = `You are the Meta Agent of a self-improving HyperAgent system (DGM-H architecture) that optimises GPU compute job scheduling for a marketplace called DCP (DC1 Compute Platform).

Your job: analyse the performance metrics from the last 7 days, identify problems or opportunities, and propose concrete parameter adjustments to improve provider profitability, job success rates, and marketplace efficiency.

STRATEGY PARAMETERS YOU CAN ADJUST:
- min_profit_margin (float 0.0-1.0): minimum acceptable profit margin to accept a job
- max_queue_depth (int 1-20): maximum concurrent jobs per provider
- reject_below_halala (int 1-10000): minimum job value to accept
- price_multiplier (float 0.5-2.0): base price adjustment factor
- demand_surge_threshold (float 0.3-0.95): GPU utilisation level that triggers surge pricing
- demand_surge_multiplier (float 1.0-2.5): price multiplier during demand surge
- max_gpu_temp_c (float 70-95): maximum GPU temperature to accept jobs
- cache_bonus_pct (float 0-50): score bonus for jobs using cached models

CONSTRAINTS:
- Each parameter change will be bounded to ±20% of current value (safety)
- You should be conservative — small improvements compound over time
- Consider trade-offs: tightening margins improves per-job profit but may reduce volume
- If a GPU group has very few outcomes (<10), uncertainty is high — be cautious

RESPOND WITH VALID JSON ONLY. Format:
{
  "reasoning": "Your analysis of the current state and why you're making these changes (2-5 sentences)",
  "adjustments": [
    {
      "gpu_model": "rtx 4090",
      "params": { "min_profit_margin": 0.18, "max_queue_depth": 6 },
      "reason": "Brief reason for this GPU's changes"
    }
  ]
}

If no changes are warranted, return: { "reasoning": "...", "adjustments": [] }`;

  const userMessage = `Meta-cycle #${cycleNum}. Here is the current state of the marketplace:

${JSON.stringify(snapshot, null, 2)}

Analyse the metrics and propose strategy adjustments. Remember: respond with valid JSON only.`;

  const payload = JSON.stringify({
    model: MINIMAX_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return new Promise((resolve, reject) => {
    const url = new URL(MINIMAX_API_URL);
    const transport = url.protocol === 'https:' ? https : http;

    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            return reject(new Error(`M2.7 API returned ${res.statusCode}: ${data.slice(0, 500)}`));
          }

          const response = JSON.parse(data);
          const content = response.choices?.[0]?.message?.content || '';

          // Parse the JSON response from the LLM
          // Try to extract JSON from the response (it might have markdown code fences)
          let jsonStr = content;
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1];

          // Also try to find raw JSON object
          const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (braceMatch) jsonStr = braceMatch[0];

          const result = JSON.parse(jsonStr);

          console.log(`${TAG} M2.7 reasoning: ${(result.reasoning || '').slice(0, 200)}`);
          resolve(result);
        } catch (parseErr) {
          reject(new Error(`Failed to parse M2.7 response: ${parseErr.message}. Raw: ${data.slice(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('M2.7 API request timed out (60s)'));
    });

    req.write(payload);
    req.end();
  });
}

// ── Fallback Hill Climbing ──────────────────────────────────────────────────

function generateHillClimbAdjustments(metrics, strategy) {
  const changes = [];
  const adjustments = {};
  const reasons = [];

  if (metrics.avg_margin < strategy.min_profit_margin * 0.8) {
    const bump = Math.min(MAX_ADJUSTMENT_PCT, 0.05);
    adjustments.reject_below_halala = Math.ceil(strategy.reject_below_halala * (1 + bump));
    changes.push(`Raised reject_below_halala: ${strategy.reject_below_halala} → ${adjustments.reject_below_halala}`);
    reasons.push('Avg margin below target');
  } else if (metrics.avg_margin > strategy.min_profit_margin * 1.5) {
    const drop = Math.min(MAX_ADJUSTMENT_PCT, 0.1);
    adjustments.reject_below_halala = Math.max(1, Math.floor(strategy.reject_below_halala * (1 - drop)));
    if (adjustments.reject_below_halala < strategy.reject_below_halala) {
      changes.push(`Lowered reject_below_halala: ${strategy.reject_below_halala} → ${adjustments.reject_below_halala}`);
      reasons.push('High margins allow volume growth');
    }
  }

  if (metrics.failure_rate > 0.2) {
    adjustments.max_queue_depth = Math.max(1, strategy.max_queue_depth - 1);
    if (adjustments.max_queue_depth < strategy.max_queue_depth) {
      changes.push(`Reduced max_queue_depth: ${strategy.max_queue_depth} → ${adjustments.max_queue_depth}`);
      reasons.push(`High failure rate ${(metrics.failure_rate * 100).toFixed(1)}%`);
    }
  } else if (metrics.failure_rate < 0.05 && metrics.acceptance_rate < 0.7) {
    adjustments.max_queue_depth = strategy.max_queue_depth + 1;
    changes.push(`Increased max_queue_depth: ${strategy.max_queue_depth} → ${adjustments.max_queue_depth}`);
    reasons.push('Low failure rate, room to accept more');
  }

  if (metrics.avg_gpu_util > 0 && metrics.avg_gpu_util < 40) {
    const newThreshold = Math.max(0.5, strategy.demand_surge_threshold - 0.05);
    if (newThreshold < strategy.demand_surge_threshold) {
      adjustments.demand_surge_threshold = newThreshold;
      changes.push(`Lowered demand_surge_threshold: ${strategy.demand_surge_threshold} → ${newThreshold}`);
      reasons.push('Low GPU utilisation');
    }
  }

  if (metrics.avg_gpu_util > 80) {
    const newMultiplier = Math.min(2.0, strategy.demand_surge_multiplier + 0.05);
    if (newMultiplier > strategy.demand_surge_multiplier) {
      adjustments.demand_surge_multiplier = newMultiplier;
      changes.push(`Raised demand_surge_multiplier: ${strategy.demand_surge_multiplier} → ${newMultiplier}`);
      reasons.push('High GPU utilisation');
    }
  }

  if (metrics.avg_margin > 0.4 && metrics.acceptance_rate < 0.5) {
    const newMargin = Math.max(0.05, strategy.min_profit_margin - 0.02);
    if (newMargin < strategy.min_profit_margin) {
      adjustments.min_profit_margin = newMargin;
      changes.push(`Lowered min_profit_margin: ${(strategy.min_profit_margin * 100).toFixed(1)}% → ${(newMargin * 100).toFixed(1)}%`);
      reasons.push('High margins but low acceptance');
    }
  } else if (metrics.avg_margin < 0.1 && metrics.avg_margin > 0) {
    const newMargin = Math.min(0.5, strategy.min_profit_margin + 0.02);
    adjustments.min_profit_margin = newMargin;
    changes.push(`Raised min_profit_margin: ${(strategy.min_profit_margin * 100).toFixed(1)}% → ${(newMargin * 100).toFixed(1)}%`);
    reasons.push('Very low margins');
  }

  return {
    changes,
    adjustments,
    reasoning: reasons.join('; ') || 'No adjustments needed',
  };
}

function applyBoundedAdjustments(strategy, { adjustments }) {
  const newParams = { ...strategy };
  delete newParams.id;
  delete newParams.created_at;
  delete newParams.is_active;

  for (const [key, value] of Object.entries(adjustments)) {
    if (key in newParams) {
      const original = strategy[key];
      if (typeof original === 'number' && original !== 0) {
        const maxDelta = Math.abs(original * MAX_ADJUSTMENT_PCT);
        const delta = value - original;
        const boundedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta));
        newParams[key] = original + boundedDelta;
      } else {
        newParams[key] = value;
      }
    }
  }

  return newParams;
}

// ── Analysis Helpers ────────────────────────────────────────────────────────

function groupOutcomes(outcomes) {
  const groups = {};
  for (const o of outcomes) {
    const key = (o.gpu_model || 'unknown').toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  }
  return groups;
}

function computeMetrics(outcomes) {
  const accepted = outcomes.filter(o => o.accepted);
  const successful = outcomes.filter(o => o.success);

  const totalEarned = outcomes.reduce((s, o) => s + (o.earned_halala || 0), 0);
  const totalProfit = outcomes.reduce((s, o) => s + (o.profit_halala || 0), 0);

  return {
    total_outcomes: outcomes.length,
    accepted_count: accepted.length,
    success_count: successful.length,
    acceptance_rate: outcomes.length > 0 ? accepted.length / outcomes.length : 0,
    success_rate: accepted.length > 0 ? successful.length / accepted.length : 0,
    avg_margin: accepted.length > 0
      ? accepted.reduce((s, o) => s + (o.profit_margin || 0), 0) / accepted.length
      : 0,
    avg_duration: accepted.length > 0
      ? accepted.reduce((s, o) => s + (o.duration_secs || 0), 0) / accepted.length
      : 0,
    avg_gpu_util: accepted.length > 0
      ? accepted.reduce((s, o) => s + (o.gpu_util_avg || 0), 0) / accepted.length
      : 0,
    avg_power: 300,
    total_earned: totalEarned,
    total_profit: totalProfit,
    failure_rate: accepted.length > 0
      ? 1 - (successful.length / accepted.length)
      : 0,
    avg_queue_wait: accepted.length > 0
      ? accepted.reduce((s, o) => s + (o.queue_wait_secs || 0), 0) / accepted.length
      : 0,
  };
}

function computePerformanceScore(metrics) {
  const normMargin = Math.min(1, Math.max(0, metrics.avg_margin / 0.5));
  const normSuccess = metrics.success_rate;
  const normUtil = Math.min(1, metrics.avg_gpu_util / 100);
  const normAccept = metrics.acceptance_rate;
  const normRevenue = Math.min(1, metrics.total_earned / 100000);

  return (
    WEIGHTS.profit_margin * normMargin +
    WEIGHTS.success_rate * normSuccess +
    WEIGHTS.utilisation * normUtil +
    WEIGHTS.acceptance_rate * normAccept +
    WEIGHTS.revenue * normRevenue
  );
}

module.exports = {
  improve,
  computeMetrics,
  computePerformanceScore,
};
