const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');

// ============================================================================
// KNOWN NVIDIA GPU DATABASE — Expected specs for fraud detection
// Source: NVIDIA official specs. GFLOPS = FP32 theoretical peak.
// ============================================================================
const GPU_DATABASE = {
  // Consumer — GeForce RTX 40 series
  'RTX 4090':        { vram_mib: 24576, fp32_tflops: 82.6,  compute_cap: '8.9', min_gflops: 40000, max_gflops: 90000 },
  'RTX 4080 SUPER':  { vram_mib: 16384, fp32_tflops: 52.0,  compute_cap: '8.9', min_gflops: 25000, max_gflops: 58000 },
  'RTX 4080':        { vram_mib: 16384, fp32_tflops: 48.7,  compute_cap: '8.9', min_gflops: 23000, max_gflops: 54000 },
  'RTX 4070 Ti SUPER': { vram_mib: 16384, fp32_tflops: 44.1, compute_cap: '8.9', min_gflops: 20000, max_gflops: 49000 },
  'RTX 4070 Ti':     { vram_mib: 12288, fp32_tflops: 40.1,  compute_cap: '8.9', min_gflops: 18000, max_gflops: 45000 },
  'RTX 4070 SUPER':  { vram_mib: 12288, fp32_tflops: 35.5,  compute_cap: '8.9', min_gflops: 16000, max_gflops: 40000 },
  'RTX 4070':        { vram_mib: 12288, fp32_tflops: 29.1,  compute_cap: '8.9', min_gflops: 13000, max_gflops: 33000 },
  'RTX 4060 Ti':     { vram_mib: 8192,  fp32_tflops: 22.1,  compute_cap: '8.9', min_gflops: 10000, max_gflops: 25000 },
  'RTX 4060':        { vram_mib: 8192,  fp32_tflops: 15.1,  compute_cap: '8.9', min_gflops: 7000,  max_gflops: 17000 },

  // Consumer — GeForce RTX 30 series
  'RTX 3090 Ti':     { vram_mib: 24576, fp32_tflops: 40.0,  compute_cap: '8.6', min_gflops: 18000, max_gflops: 44000 },
  'RTX 3090':        { vram_mib: 24576, fp32_tflops: 35.6,  compute_cap: '8.6', min_gflops: 16000, max_gflops: 40000 },
  'RTX 3080 Ti':     { vram_mib: 12288, fp32_tflops: 34.1,  compute_cap: '8.6', min_gflops: 15000, max_gflops: 38000 },
  'RTX 3080':        { vram_mib: 10240, fp32_tflops: 29.8,  compute_cap: '8.6', min_gflops: 13000, max_gflops: 33000 },
  'RTX 3070 Ti':     { vram_mib: 8192,  fp32_tflops: 21.7,  compute_cap: '8.6', min_gflops: 10000, max_gflops: 24000 },
  'RTX 3070':        { vram_mib: 8192,  fp32_tflops: 20.3,  compute_cap: '8.6', min_gflops: 9000,  max_gflops: 23000 },
  'RTX 3060 Ti':     { vram_mib: 8192,  fp32_tflops: 16.2,  compute_cap: '8.6', min_gflops: 7000,  max_gflops: 18000 },
  'RTX 3060':        { vram_mib: 12288, fp32_tflops: 12.7,  compute_cap: '8.6', min_gflops: 5500,  max_gflops: 14000 },

  // Consumer — GeForce RTX 20 series
  'RTX 2080 Ti':     { vram_mib: 11264, fp32_tflops: 13.4,  compute_cap: '7.5', min_gflops: 6000,  max_gflops: 15000 },
  'RTX 2080 SUPER':  { vram_mib: 8192,  fp32_tflops: 11.2,  compute_cap: '7.5', min_gflops: 5000,  max_gflops: 12500 },
  'RTX 2080':        { vram_mib: 8192,  fp32_tflops: 10.1,  compute_cap: '7.5', min_gflops: 4500,  max_gflops: 11500 },
  'RTX 2070 SUPER':  { vram_mib: 8192,  fp32_tflops: 9.1,   compute_cap: '7.5', min_gflops: 4000,  max_gflops: 10000 },
  'RTX 2070':        { vram_mib: 8192,  fp32_tflops: 7.5,   compute_cap: '7.5', min_gflops: 3300,  max_gflops: 8500 },
  'RTX 2060 SUPER':  { vram_mib: 8192,  fp32_tflops: 7.2,   compute_cap: '7.5', min_gflops: 3200,  max_gflops: 8000 },
  'RTX 2060':        { vram_mib: 6144,  fp32_tflops: 6.5,   compute_cap: '7.5', min_gflops: 2800,  max_gflops: 7200 },

  // Data Center — A-series
  'A100':            { vram_mib: 81920, fp32_tflops: 19.5,  compute_cap: '8.0', min_gflops: 8500,  max_gflops: 22000 },
  'A100 80GB':       { vram_mib: 81920, fp32_tflops: 19.5,  compute_cap: '8.0', min_gflops: 8500,  max_gflops: 22000 },
  'A100 40GB':       { vram_mib: 40960, fp32_tflops: 19.5,  compute_cap: '8.0', min_gflops: 8500,  max_gflops: 22000 },
  'A10':             { vram_mib: 24576, fp32_tflops: 31.2,  compute_cap: '8.6', min_gflops: 14000, max_gflops: 35000 },
  'A6000':           { vram_mib: 49152, fp32_tflops: 38.7,  compute_cap: '8.6', min_gflops: 17000, max_gflops: 43000 },
  'A5000':           { vram_mib: 24576, fp32_tflops: 27.8,  compute_cap: '8.6', min_gflops: 12500, max_gflops: 31000 },
  'A4000':           { vram_mib: 16384, fp32_tflops: 19.2,  compute_cap: '8.6', min_gflops: 8500,  max_gflops: 22000 },

  // Data Center — H-series
  'H100':            { vram_mib: 81920, fp32_tflops: 51.2,  compute_cap: '9.0', min_gflops: 23000, max_gflops: 57000 },
  'H100 SXM':        { vram_mib: 81920, fp32_tflops: 66.9,  compute_cap: '9.0', min_gflops: 30000, max_gflops: 74000 },
  'H200':            { vram_mib: 143360, fp32_tflops: 66.9, compute_cap: '9.0', min_gflops: 30000, max_gflops: 74000 },

  // Older consumer
  'GTX 1080 Ti':     { vram_mib: 11264, fp32_tflops: 11.3,  compute_cap: '6.1', min_gflops: 5000,  max_gflops: 12500 },
  'GTX 1080':        { vram_mib: 8192,  fp32_tflops: 8.9,   compute_cap: '6.1', min_gflops: 4000,  max_gflops: 10000 },
  'GTX 1070':        { vram_mib: 8192,  fp32_tflops: 6.5,   compute_cap: '6.1', min_gflops: 2800,  max_gflops: 7200 },
  'GTX 1060':        { vram_mib: 6144,  fp32_tflops: 4.4,   compute_cap: '6.1', min_gflops: 1900,  max_gflops: 4900 },
};

// ============================================================================
// Helper: Match GPU name from nvidia-smi to our database
// ============================================================================
function matchGpu(reportedName) {
  if (!reportedName) return null;
  const normalized = reportedName.toUpperCase().replace(/NVIDIA\s*/gi, '').replace(/GEFORCE\s*/gi, '').trim();

  // Exact match first
  for (const [key, specs] of Object.entries(GPU_DATABASE)) {
    if (normalized === key.toUpperCase()) return { name: key, ...specs };
  }

  // Partial match (e.g. "NVIDIA GeForce RTX 3060 Ti" → "RTX 3060 Ti")
  // Sort by name length descending so "RTX 4080 SUPER" matches before "RTX 4080"
  const sorted = Object.entries(GPU_DATABASE).sort((a, b) => b[0].length - a[0].length);
  for (const [key, specs] of sorted) {
    if (normalized.includes(key.toUpperCase())) return { name: key, ...specs };
  }

  return null;
}

// ============================================================================
// Helper: Generate a verification challenge (deterministic benchmark params)
// ============================================================================
function generateChallenge() {
  const challenge_id = 'vrf-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
  // Fixed matrix size so GFLOPS are comparable across providers
  const matrix_size = 4096;
  const iterations = 5;
  // Random nonce to prevent replay
  const nonce = crypto.randomBytes(16).toString('hex');

  return { challenge_id, matrix_size, iterations, nonce };
}

// ============================================================================
// Helper: Analyze verification result and produce verdict
// ============================================================================
function analyzeVerification(provider, challenge, result) {
  const flags = [];
  let score = 100; // Start perfect, deduct for issues
  let verdict = 'verified'; // verified | suspect | failed

  const reportedGpu = result.gpu_name || provider.gpu_name_detected || provider.gpu_model;
  const knownGpu = matchGpu(reportedGpu);

  // 1. GPU Recognition
  if (!knownGpu) {
    flags.push({ type: 'unknown_gpu', severity: 'warning', detail: `GPU "${reportedGpu}" not in known database` });
    score -= 10;
  }

  // 2. VRAM check — compare reported vs known
  if (knownGpu && result.vram_total_mib) {
    const vramDelta = Math.abs(result.vram_total_mib - knownGpu.vram_mib);
    const vramPct = vramDelta / knownGpu.vram_mib;
    if (vramPct > 0.15) {
      flags.push({
        type: 'vram_mismatch',
        severity: 'critical',
        detail: `Reported ${result.vram_total_mib} MiB but ${knownGpu.name} should have ${knownGpu.vram_mib} MiB (${Math.round(vramPct * 100)}% off)`
      });
      score -= 30;
    } else if (vramPct > 0.05) {
      flags.push({
        type: 'vram_minor_diff',
        severity: 'info',
        detail: `VRAM ${result.vram_total_mib} MiB vs expected ${knownGpu.vram_mib} MiB (${Math.round(vramPct * 100)}% off — likely driver overhead)`
      });
      score -= 5;
    }
  }

  // 3. GFLOPS check — is performance in expected range?
  if (knownGpu && result.gflops) {
    if (result.gflops < knownGpu.min_gflops * 0.7) {
      flags.push({
        type: 'performance_too_low',
        severity: 'critical',
        detail: `${result.gflops.toFixed(0)} GFLOPS — far below ${knownGpu.name} expected range ${knownGpu.min_gflops}-${knownGpu.max_gflops} GFLOPS`
      });
      score -= 35;
    } else if (result.gflops < knownGpu.min_gflops) {
      flags.push({
        type: 'performance_low',
        severity: 'warning',
        detail: `${result.gflops.toFixed(0)} GFLOPS — below ${knownGpu.name} minimum ${knownGpu.min_gflops} GFLOPS (thermal throttling or driver issue?)`
      });
      score -= 15;
    } else if (result.gflops > knownGpu.max_gflops * 1.3) {
      flags.push({
        type: 'performance_impossible',
        severity: 'critical',
        detail: `${result.gflops.toFixed(0)} GFLOPS — exceeds ${knownGpu.name} theoretical max by >30%. Spoofed result?`
      });
      score -= 40;
    }
  }

  // 4. GPU name consistency — did they register as one GPU but report another?
  if (provider.gpu_model && reportedGpu) {
    const registeredMatch = matchGpu(provider.gpu_model);
    const reportedMatch = matchGpu(reportedGpu);
    if (registeredMatch && reportedMatch && registeredMatch.name !== reportedMatch.name) {
      flags.push({
        type: 'gpu_name_changed',
        severity: 'warning',
        detail: `Registered as "${provider.gpu_model}" but reporting as "${reportedGpu}"`
      });
      score -= 15;
    }
  }

  // 5. Nonce verification — did they return the correct nonce?
  if (result.nonce !== challenge.nonce) {
    flags.push({
      type: 'nonce_mismatch',
      severity: 'critical',
      detail: 'Verification nonce mismatch — possible replay attack'
    });
    score -= 50;
  }

  // 6. Timing check — benchmark should take at least a few seconds
  if (result.elapsed_seconds != null && result.elapsed_seconds < 0.5) {
    flags.push({
      type: 'too_fast',
      severity: 'critical',
      detail: `Benchmark completed in ${result.elapsed_seconds}s — suspiciously fast, possibly faked`
    });
    score -= 40;
  }

  // 7. Temperature sanity — GPU under load should be warm
  if (result.temp_c != null && result.temp_c < 25) {
    flags.push({
      type: 'temp_too_cold',
      severity: 'warning',
      detail: `GPU temp ${result.temp_c}°C during benchmark — unusually cold for GPU under load`
    });
    score -= 10;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine verdict
  if (score < 40) verdict = 'failed';
  else if (score < 70) verdict = 'suspect';
  else verdict = 'verified';

  return {
    verdict,
    score,
    flags,
    matched_gpu: knownGpu ? knownGpu.name : null,
    expected_vram_mib: knownGpu ? knownGpu.vram_mib : null,
    expected_gflops_range: knownGpu ? `${knownGpu.min_gflops}-${knownGpu.max_gflops}` : null,
  };
}

// ============================================================================
// POST /api/verification/challenge — Request a verification challenge for a provider
// ============================================================================
router.post('/challenge', (req, res) => {
  try {
    const adminToken = req.headers['x-admin-token'] || req.body.admin_token;
    const expectedToken = process.env.DC1_ADMIN_TOKEN || '9ca7c4f924374229b9c9f584758f055373878dfce3fea309ff192d638756342b';

    if (adminToken !== expectedToken) {
      return res.status(403).json({ error: 'Admin token required' });
    }

    const { provider_id } = req.body;
    if (!provider_id) return res.status(400).json({ error: 'provider_id required' });

    const provider = db.get('SELECT * FROM providers WHERE id = ?', provider_id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const challenge = generateChallenge();
    const now = new Date().toISOString();

    // Store challenge
    db.run(
      `INSERT INTO verification_runs (provider_id, challenge_id, challenge_params, status, requested_at)
       VALUES (?, ?, ?, 'pending', ?)`,
      provider_id, challenge.challenge_id, JSON.stringify(challenge), now
    );

    // Mark provider as needing verification — daemon picks this up on next poll
    db.run(
      `UPDATE providers SET verification_status = 'pending', verification_challenge = ? WHERE id = ?`,
      JSON.stringify(challenge), provider_id
    );

    res.json({
      success: true,
      challenge_id: challenge.challenge_id,
      provider_id,
      message: 'Challenge created. Daemon will pick it up on next heartbeat poll.'
    });
  } catch (error) {
    console.error('Verification challenge error:', error);
    res.status(500).json({ error: 'Failed to create verification challenge' });
  }
});

// ============================================================================
// POST /api/verification/submit — Daemon submits verification result
// ============================================================================
router.post('/submit', (req, res) => {
  try {
    const { api_key, challenge_id, result } = req.body;
    if (!api_key || !challenge_id || !result) {
      return res.status(400).json({ error: 'api_key, challenge_id, and result required' });
    }

    const provider = db.get('SELECT * FROM providers WHERE api_key = ?', api_key);
    if (!provider) return res.status(401).json({ error: 'Invalid API key' });

    // Find the challenge
    const run = db.get(
      `SELECT * FROM verification_runs WHERE challenge_id = ? AND provider_id = ?`,
      challenge_id, provider.id
    );
    if (!run) return res.status(404).json({ error: 'Verification challenge not found' });
    if (run.status === 'completed') return res.json({ success: true, message: 'Already submitted' });

    const challenge = JSON.parse(run.challenge_params);
    const analysis = analyzeVerification(provider, challenge, result);
    const now = new Date().toISOString();

    // Update verification run
    db.run(
      `UPDATE verification_runs SET
        status = 'completed', completed_at = ?,
        result_data = ?, verdict = ?, score = ?, flags = ?
       WHERE id = ?`,
      now,
      JSON.stringify(result),
      analysis.verdict,
      analysis.score,
      JSON.stringify(analysis.flags),
      run.id
    );

    // Update provider verification status
    db.run(
      `UPDATE providers SET
        verification_status = ?, verification_score = ?,
        verification_last_at = ?, verification_challenge = NULL,
        verified_gpu = ?
       WHERE id = ?`,
      analysis.verdict, analysis.score, now,
      analysis.matched_gpu || provider.gpu_name_detected || provider.gpu_model,
      provider.id
    );

    // If failed, suspend provider from receiving jobs
    if (analysis.verdict === 'failed') {
      db.run(`UPDATE providers SET status = 'suspended' WHERE id = ?`, provider.id);
      console.warn(`[verification] Provider ${provider.id} (${provider.name}) FAILED verification — suspended. Flags: ${JSON.stringify(analysis.flags)}`);
    }

    // Log security event if suspect or failed
    if (analysis.verdict !== 'verified') {
      console.warn(`[verification] Provider ${provider.id} verdict=${analysis.verdict} score=${analysis.score} flags=${analysis.flags.map(f => f.type).join(',')}`);
    }

    res.json({
      success: true,
      challenge_id,
      verdict: analysis.verdict,
      score: analysis.score,
      flags: analysis.flags,
      matched_gpu: analysis.matched_gpu,
      expected_gflops_range: analysis.expected_gflops_range,
    });
  } catch (error) {
    console.error('Verification submit error:', error);
    res.status(500).json({ error: 'Verification submission failed' });
  }
});

// ============================================================================
// GET /api/verification/status/:provider_id — Check provider verification status
// ============================================================================
router.get('/status/:provider_id', (req, res) => {
  try {
    const provider = db.get(
      `SELECT id, name, gpu_model, gpu_name_detected, gpu_vram_mib,
              verification_status, verification_score, verification_last_at, verified_gpu
       FROM providers WHERE id = ?`,
      req.params.provider_id
    );
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    // Get verification history
    const runs = db.all(
      `SELECT challenge_id, status, verdict, score, flags, requested_at, completed_at
       FROM verification_runs WHERE provider_id = ?
       ORDER BY requested_at DESC LIMIT 10`,
      provider.id
    );

    res.json({
      provider_id: provider.id,
      name: provider.name,
      registered_gpu: provider.gpu_model,
      detected_gpu: provider.gpu_name_detected,
      verified_gpu: provider.verified_gpu,
      vram_mib: provider.gpu_vram_mib,
      verification_status: provider.verification_status || 'unverified',
      verification_score: provider.verification_score || null,
      last_verified: provider.verification_last_at || null,
      history: runs.map(r => ({
        ...r,
        flags: r.flags ? JSON.parse(r.flags) : []
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

// ============================================================================
// GET /api/verification/pending — Daemon checks for pending verification (via heartbeat)
// ============================================================================
router.get('/pending', (req, res) => {
  try {
    const api_key = req.query.key;
    if (!api_key) return res.status(400).json({ error: 'API key required' });

    const provider = db.get(
      `SELECT id, verification_status, verification_challenge FROM providers WHERE api_key = ?`,
      api_key
    );
    if (!provider) return res.status(401).json({ error: 'Invalid API key' });

    if (provider.verification_status === 'pending' && provider.verification_challenge) {
      const challenge = JSON.parse(provider.verification_challenge);
      return res.json({ pending: true, challenge });
    }

    res.json({ pending: false });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check pending verification' });
  }
});

// ============================================================================
// POST /api/verification/auto — Auto-verify on first heartbeat (self-service)
// ============================================================================
router.post('/auto', (req, res) => {
  try {
    const { api_key } = req.body;
    if (!api_key) return res.status(400).json({ error: 'API key required' });

    const provider = db.get('SELECT * FROM providers WHERE api_key = ?', api_key);
    if (!provider) return res.status(401).json({ error: 'Invalid API key' });

    // Only auto-verify if never verified
    if (provider.verification_status && provider.verification_status !== 'unverified') {
      return res.json({ success: true, message: 'Already verified or pending', status: provider.verification_status });
    }

    const challenge = generateChallenge();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO verification_runs (provider_id, challenge_id, challenge_params, status, requested_at)
       VALUES (?, ?, ?, 'pending', ?)`,
      provider.id, challenge.challenge_id, JSON.stringify(challenge), now
    );

    db.run(
      `UPDATE providers SET verification_status = 'pending', verification_challenge = ? WHERE id = ?`,
      JSON.stringify(challenge), provider.id
    );

    res.json({ success: true, challenge });
  } catch (error) {
    console.error('Auto-verify error:', error);
    res.status(500).json({ error: 'Auto-verification failed' });
  }
});

// ============================================================================
// GET /api/verification/leaderboard — Verified providers ranked by score
// ============================================================================
router.get('/leaderboard', (req, res) => {
  try {
    const rows = db.all(`
      SELECT id, name, gpu_model, gpu_name_detected, verified_gpu, gpu_vram_mib,
             verification_status, verification_score, verification_last_at,
             reliability_score, total_jobs, total_earnings, status
      FROM providers
      WHERE verification_status IN ('verified', 'suspect')
      ORDER BY verification_score DESC, reliability_score DESC
    `);

    res.json({
      count: rows.length,
      providers: rows.map(p => ({
        provider_id: p.id,
        name: p.name,
        gpu: p.verified_gpu || p.gpu_name_detected || p.gpu_model,
        vram_mib: p.gpu_vram_mib,
        verification: {
          status: p.verification_status,
          score: p.verification_score,
          last_verified: p.verification_last_at,
        },
        reliability_score: p.reliability_score,
        total_jobs: p.total_jobs,
        status: p.status,
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============================================================================
// GET /api/verification/gpu-database — List all known GPUs (public reference)
// ============================================================================
router.get('/gpu-database', (req, res) => {
  const gpus = Object.entries(GPU_DATABASE).map(([name, specs]) => ({
    name,
    vram_mib: specs.vram_mib,
    vram_gb: Math.round(specs.vram_mib / 1024),
    fp32_tflops: specs.fp32_tflops,
    compute_capability: specs.compute_cap,
    expected_gflops_min: specs.min_gflops,
    expected_gflops_max: specs.max_gflops,
  }));

  res.json({ count: gpus.length, gpus });
});

module.exports = router;
module.exports.matchGpu = matchGpu;
module.exports.GPU_DATABASE = GPU_DATABASE;
