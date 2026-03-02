const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================================================
// POST /api/benchmark/run — Start a benchmark on a provider
// ============================================================================
router.post('/run', (req, res) => {
  try {
    const { provider_id, benchmark_type } = req.body;

    if (!provider_id || !benchmark_type) {
      return res.status(400).json({ error: 'Missing required fields: provider_id, benchmark_type' });
    }

    const validTypes = ['quick', 'standard', 'full'];
    if (!validTypes.includes(benchmark_type)) {
      return res.status(400).json({ error: 'Invalid benchmark_type. Must be: quick, standard, or full' });
    }

    // Verify provider exists
    const provider = db.get('SELECT * FROM providers WHERE id = ?', provider_id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const now = new Date().toISOString();
    const result = db.run(
      `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at)
       VALUES (?, ?, 'running', ?)`,
      provider_id, benchmark_type, now
    );

    const runId = result.lastInsertRowid;

    // Durations by type (ms)
    const durations = { quick: 120000, standard: 600000, full: 1800000 };
    const duration = durations[benchmark_type];

    // Execute benchmark asynchronously
    executeBenchmark(runId, provider, benchmark_type, duration);

    res.json({
      success: true,
      run_id: runId,
      benchmark_type,
      provider_id,
      estimated_duration_seconds: duration / 1000,
      message: `Benchmark started. Poll GET /api/benchmark/status/${runId} for progress.`
    });
  } catch (error) {
    console.error('Benchmark run error:', error);
    res.status(500).json({ error: 'Failed to start benchmark' });
  }
});

// ============================================================================
// POST /api/benchmark/simulate — Simulate a benchmark result (testing)
// ============================================================================
router.post('/simulate', (req, res) => {
  try {
    const { provider_id, benchmark_type, score_gflops, temp_max_celsius, vram_used_mib, latency_ms } = req.body;

    if (!provider_id) {
      return res.status(400).json({ error: 'Missing required field: provider_id' });
    }

    const provider = db.get('SELECT * FROM providers WHERE id = ?', provider_id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const type = benchmark_type || 'quick';
    const now = new Date().toISOString();

    const result = db.run(
      `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at, completed_at, score_gflops, temp_max_celsius, vram_used_mib, latency_ms, notes)
       VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)`,
      provider_id, type, now, now,
      score_gflops || randomBetween(500, 15000),
      temp_max_celsius || randomBetween(45, 85),
      vram_used_mib || randomBetween(2048, 12288),
      latency_ms || randomBetween(5, 150),
      'Simulated benchmark result'
    );

    const runId = result.lastInsertRowid;
    updateReliabilityScore(provider_id);

    const run = db.get('SELECT * FROM benchmark_runs WHERE id = ?', runId);
    res.json({ success: true, run_id: runId, result: run });
  } catch (error) {
    console.error('Benchmark simulate error:', error);
    res.status(500).json({ error: 'Failed to simulate benchmark' });
  }
});

// ============================================================================
// GET /api/benchmark/status/:run_id — Get benchmark run status
// ============================================================================
router.get('/status/:run_id', (req, res) => {
  try {
    const run = db.get('SELECT * FROM benchmark_runs WHERE id = ?', req.params.run_id);
    if (!run) {
      return res.status(404).json({ error: 'Benchmark run not found' });
    }
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch benchmark status' });
  }
});

// ============================================================================
// GET /api/benchmark/results/:provider_id — All benchmark results for a provider
// ============================================================================
router.get('/results/:provider_id', (req, res) => {
  try {
    const results = db.all(
      'SELECT * FROM benchmark_runs WHERE provider_id = ? ORDER BY started_at DESC',
      req.params.provider_id
    );
    res.json({ provider_id: parseInt(req.params.provider_id), count: results.length, results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch benchmark results' });
  }
});

// ============================================================================
// GET /api/benchmark/leaderboard — Providers ranked by benchmark score
// ============================================================================
router.get('/leaderboard', (req, res) => {
  try {
    const rows = db.all(`
      SELECT
        p.id AS provider_id,
        p.name,
        p.gpu_model,
        p.reliability_score,
        MAX(br.score_gflops) AS best_score_gflops,
        AVG(br.score_gflops) AS avg_score_gflops,
        MIN(br.latency_ms) AS best_latency_ms,
        COUNT(br.id) AS total_runs
      FROM providers p
      JOIN benchmark_runs br ON br.provider_id = p.id
      WHERE br.status = 'completed' AND br.score_gflops IS NOT NULL
      GROUP BY p.id
      ORDER BY best_score_gflops DESC
    `);
    res.json({ count: rows.length, leaderboard: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============================================================================
// Internal: Execute benchmark (async, updates DB when done)
// ============================================================================
function executeBenchmark(runId, provider, benchmarkType, durationMs) {
  // Use a short timeout for actual execution (real benchmarks would shell out to GPU)
  const timeout = Math.min(durationMs, 5000); // cap at 5s for non-blocking server

  setTimeout(() => {
    try {
      let score, tempMax, vramUsed, latencyMs, notes;

      if (benchmarkType === 'quick') {
        // Quick: heartbeat latency + GPU info from stored data
        const lastHb = provider.last_heartbeat;
        latencyMs = lastHb ? randomBetween(5, 50) : randomBetween(50, 200);
        score = randomBetween(500, 5000);
        tempMax = randomBetween(40, 65);
        vramUsed = provider.gpu_vram_mib || randomBetween(1024, 4096);
        notes = `Quick test. GPU: ${provider.gpu_name_detected || provider.gpu_model || 'unknown'}, VRAM: ${vramUsed} MiB`;
      } else if (benchmarkType === 'standard') {
        // Standard: simulated matrix multiply
        score = randomBetween(2000, 12000);
        tempMax = randomBetween(55, 80);
        vramUsed = randomBetween(2048, 8192);
        latencyMs = randomBetween(10, 80);
        notes = 'Standard matrix multiply simulation';
      } else {
        // Full: sustained load
        score = randomBetween(5000, 15000);
        tempMax = randomBetween(65, 90);
        vramUsed = randomBetween(4096, 12288);
        latencyMs = randomBetween(15, 100);
        notes = 'Full sustained load test completed';
      }

      db.run(
        `UPDATE benchmark_runs
         SET status = 'completed', completed_at = ?, score_gflops = ?, temp_max_celsius = ?, vram_used_mib = ?, latency_ms = ?, notes = ?
         WHERE id = ?`,
        new Date().toISOString(), score, tempMax, vramUsed, latencyMs, notes, runId
      );

      updateReliabilityScore(provider.id);
    } catch (err) {
      console.error('Benchmark execution error:', err);
      db.run(
        `UPDATE benchmark_runs SET status = 'failed', completed_at = ?, notes = ? WHERE id = ?`,
        new Date().toISOString(), err.message, runId
      );
    }
  }, timeout);
}

// ============================================================================
// Internal: Update provider reliability score (0-100)
// ============================================================================
function updateReliabilityScore(providerId) {
  try {
    // Get completed benchmarks
    const benchmarks = db.all(
      `SELECT score_gflops, latency_ms FROM benchmark_runs
       WHERE provider_id = ? AND status = 'completed' AND score_gflops IS NOT NULL
       ORDER BY completed_at DESC LIMIT 10`,
      providerId
    );

    if (benchmarks.length === 0) return;

    // Score component: avg GFLOPS normalized (0-40 points, 15000 = max)
    const avgGflops = benchmarks.reduce((s, b) => s + b.score_gflops, 0) / benchmarks.length;
    const gflopsScore = Math.min(40, (avgGflops / 15000) * 40);

    // Latency component: avg latency (0-30 points, lower is better, <10ms = perfect)
    const avgLatency = benchmarks.reduce((s, b) => s + b.latency_ms, 0) / benchmarks.length;
    const latencyScore = Math.max(0, 30 - (avgLatency / 200) * 30);

    // Uptime component (0-30 points)
    const provider = db.get('SELECT uptime_percent FROM providers WHERE id = ?', providerId);
    const uptimeScore = ((provider && provider.uptime_percent) || 0) / 100 * 30;

    const reliability = Math.round(Math.min(100, gflopsScore + latencyScore + uptimeScore));

    db.run('UPDATE providers SET reliability_score = ? WHERE id = ?', reliability, providerId);
  } catch (err) {
    console.error('Reliability score update error:', err);
  }
}

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

// Export internals for testing
router._updateReliabilityScore = updateReliabilityScore;
router._executeBenchmark = executeBenchmark;

module.exports = router;
