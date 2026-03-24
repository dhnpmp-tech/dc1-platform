/**
 * Provider Reputation Scoring Service
 * Calculates provider quality scores based on historical performance metrics.
 *
 * Score = weighted average of:
 *  - uptime_pct (40%): percentage of time provider was available
 *  - job_completion_rate (40%): percentage of accepted jobs completed successfully
 *  - avg_tokens_per_sec (20%): throughput efficiency (tokens/sec avg across jobs)
 *
 * Score range: 0-100, updated after each job completion
 */

const db = require('../db');

class ProviderReputation {
  /**
   * Calculate reputation score for a provider
   * @param {string} providerId - Provider ID
   * @returns {Promise<Object>} - { score, components: { uptime_pct, job_completion_rate, avg_tokens_per_sec } }
   */
  static async calculateScore(providerId) {
    // Fetch provider metrics
    const provider = await db.query(
      `SELECT
        reputation_score,
        uptime_pct,
        job_completion_rate,
        avg_tokens_per_sec,
        updated_at
      FROM providers WHERE id = $1`,
      [providerId]
    );

    if (!provider.rows.length) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const metrics = provider.rows[0];

    // Handle missing or invalid metrics (new provider)
    const uptime = metrics.uptime_pct ?? 100; // Default to 100% for new providers
    const completionRate = metrics.job_completion_rate ?? 100; // Default to 100% for new providers
    const tokensPerSec = metrics.avg_tokens_per_sec ?? 50; // Default baseline (tokens/sec)

    // Apply weighted formula: 40% uptime + 40% completion + 20% efficiency
    const normalizedTokensPerSec = Math.min(tokensPerSec / 100, 1) * 100; // Normalize to 0-100
    const score = (uptime * 0.4) + (completionRate * 0.4) + (normalizedTokensPerSec * 0.2);

    // Clamp to 0-100 range
    const finalScore = Math.max(0, Math.min(100, Math.round(score * 10) / 10));

    return {
      score: finalScore,
      components: {
        uptime_pct: uptime,
        job_completion_rate: completionRate,
        avg_tokens_per_sec: tokensPerSec,
      },
      updatedAt: metrics.updated_at,
    };
  }

  /**
   * Update provider reputation after job completion
   * Recalculates metrics from job_completions table and updates score
   * @param {string} providerId - Provider ID
   * @returns {Promise<Object>} - Updated reputation data
   */
  static async updateReputation(providerId) {
    // Calculate uptime: jobs completed / jobs assigned
    const jobStats = await db.query(
      `SELECT
        COUNT(*) as total_assigned,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        AVG(CAST(tokens_generated AS FLOAT) / NULLIF(CAST(duration_seconds AS FLOAT), 0)) as avg_tokens_per_sec
      FROM jobs
      WHERE provider_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [providerId]
    );

    const stats = jobStats.rows[0];
    const totalJobs = parseInt(stats.total_assigned) || 0;
    const completedJobs = parseInt(stats.completed) || 0;
    const failedJobs = parseInt(stats.failed) || 0;

    // Calculate metrics
    const jobCompletionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 100;
    const avgTokensPerSec = stats.avg_tokens_per_sec ? Math.max(0, stats.avg_tokens_per_sec) : 50;

    // Uptime: inverse of failure rate, but also consider recent history
    const failureRate = totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0;
    const uptimePct = Math.max(0, 100 - failureRate);

    // Update provider record with new metrics
    const updateResult = await db.query(
      `UPDATE providers
      SET
        uptime_pct = $1,
        job_completion_rate = $2,
        avg_tokens_per_sec = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING reputation_score`,
      [uptimePct, jobCompletionRate, avgTokensPerSec, providerId]
    );

    if (!updateResult.rows.length) {
      throw new Error(`Failed to update provider ${providerId}`);
    }

    // Recalculate and store new score
    const newScore = this.calculateScore(providerId);

    await db.query(
      `UPDATE providers
      SET reputation_score = $1, updated_at = NOW()
      WHERE id = $2`,
      [newScore.score, providerId]
    );

    return newScore;
  }

  /**
   * Get reputation details for a provider
   * @param {string} providerId - Provider ID
   * @returns {Promise<Object>} - Full reputation details
   */
  static async getReputation(providerId) {
    const reputation = await this.calculateScore(providerId);
    return {
      providerId,
      ...reputation,
    };
  }

  /**
   * Rank providers by reputation score
   * Useful for job dispatch to prefer higher-reputation providers
   * @param {Array<string>} providerIds - List of provider IDs to rank
   * @returns {Promise<Array>} - Providers ranked by reputation (highest first)
   */
  static async rankProviders(providerIds) {
    if (!providerIds.length) return [];

    const placeholders = providerIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await db.query(
      `SELECT id, reputation_score, uptime_pct, job_completion_rate
      FROM providers
      WHERE id IN (${placeholders})
      ORDER BY reputation_score DESC`,
      providerIds
    );

    return result.rows;
  }

  /**
   * Get top N providers by reputation
   * @param {number} limit - Number of providers to return
   * @returns {Promise<Array>} - Top providers by reputation score
   */
  static async getTopProviders(limit = 10) {
    const result = await db.query(
      `SELECT
        id, name, reputation_score, uptime_pct, job_completion_rate, avg_tokens_per_sec
      FROM providers
      WHERE reputation_score IS NOT NULL
      ORDER BY reputation_score DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Batch update reputation for multiple providers
   * Call after a batch of jobs complete
   * @param {Array<string>} providerIds - List of provider IDs to update
   * @returns {Promise<Array>} - Updated reputation data for all providers
   */
  static async batchUpdate(providerIds) {
    const results = [];
    for (const providerId of providerIds) {
      try {
        const reputation = await this.updateReputation(providerId);
        results.push({ providerId, success: true, data: reputation });
      } catch (error) {
        results.push({ providerId, success: false, error: error.message });
      }
    }
    return results;
  }
}

module.exports = ProviderReputation;
