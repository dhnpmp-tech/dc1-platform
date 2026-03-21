const db = require('../db');

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function readPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function firstNumberFromPaths(obj, paths) {
  for (const path of paths) {
    const value = readPath(obj, path);
    const num = toNumber(value);
    if (num !== null) return num;
  }
  return null;
}

function parseStructuredResult(rawResult) {
  if (!rawResult) return null;

  if (typeof rawResult === 'object') return rawResult;
  if (typeof rawResult !== 'string') return null;

  const trimmed = rawResult.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  const structuredMatch = trimmed.match(/DC1_RESULT_JSON:({[\s\S]+})\s*$/);
  if (structuredMatch) {
    try {
      return JSON.parse(structuredMatch[1]);
    } catch (_) {}
  }

  return null;
}

function parseMetricFromText(text, regex) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(regex);
  if (!match) return null;
  return toNumber(match[1]);
}

function parseMetrics(rawResult) {
  const structured = parseStructuredResult(rawResult);
  const root = structured && typeof structured === 'object'
    ? (structured.benchmark || structured.metrics || structured)
    : null;

  let tokensPerSec = null;
  let imagesPerSec = null;
  let flopsEstimate = null;
  let vramGb = null;
  let gpuModel = null;

  if (root) {
    tokensPerSec = firstNumberFromPaths(root, [
      'tokens_per_sec',
      'tokens_per_second',
      'llama_7b.tokens_per_sec',
      'llm.tokens_per_sec',
      'throughput.tokens_per_sec',
    ]);
    imagesPerSec = firstNumberFromPaths(root, [
      'images_per_sec',
      'images_per_second',
      'stable_diffusion.images_per_sec',
      'sd.images_per_sec',
    ]);
    flopsEstimate = firstNumberFromPaths(root, [
      'flops_estimate',
      'flops',
      'gflops',
      'score_gflops',
    ]);
    vramGb = firstNumberFromPaths(root, [
      'vram_gb',
      'gpu.vram_gb',
      'memory.vram_gb',
    ]);

    gpuModel =
      readPath(root, 'gpu_model') ||
      readPath(root, 'gpu.model') ||
      readPath(root, 'hardware.gpu_model') ||
      null;
  }

  if (typeof rawResult === 'string') {
    if (tokensPerSec === null) {
      tokensPerSec = parseMetricFromText(rawResult, /tokens?\s*\/\s*s(?:ec(?:ond)?)?\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i) ??
        parseMetricFromText(rawResult, /tokens?_per_(?:sec|second)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i);
    }
    if (imagesPerSec === null) {
      imagesPerSec = parseMetricFromText(rawResult, /images?\s*\/\s*s(?:ec(?:ond)?)?\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i) ??
        parseMetricFromText(rawResult, /images?_per_(?:sec|second)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i);
    }
    if (flopsEstimate === null) {
      flopsEstimate = parseMetricFromText(rawResult, /gflops\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i) ??
        parseMetricFromText(rawResult, /flops(?:_estimate)?\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i);
    }
    if (!gpuModel) {
      const gpuMatch = rawResult.match(/gpu(?:_model)?\s*[:=]\s*([^\n,]+)/i);
      if (gpuMatch) gpuModel = gpuMatch[1].trim();
    }
    if (vramGb === null) {
      vramGb = parseMetricFromText(rawResult, /vram(?:_gb)?\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i);
    }
  }

  return {
    gpu_model: gpuModel,
    tokens_per_sec: tokensPerSec,
    images_per_sec: imagesPerSec,
    flops_estimate: flopsEstimate,
    vram_gb: vramGb,
  };
}

function getBenchmarkResult(jobId) {
  const row = db.get(
    `SELECT
       j.job_id,
       j.result,
       j.completed_at,
       j.submitted_at,
       p.gpu_name_detected,
       p.gpu_model,
       p.gpu_vram_mib
     FROM jobs j
     LEFT JOIN providers p ON p.id = j.provider_id
     WHERE j.job_id = ? AND j.job_type = 'benchmark'
     LIMIT 1`,
    jobId
  );

  if (!row) return null;

  const parsed = parseMetrics(row.result);
  const fallbackVramGb = row.gpu_vram_mib ? Math.round((row.gpu_vram_mib / 1024) * 10) / 10 : null;

  return {
    gpu_model: parsed.gpu_model || row.gpu_name_detected || row.gpu_model || 'Unknown GPU',
    tokens_per_sec: parsed.tokens_per_sec,
    images_per_sec: parsed.images_per_sec,
    flops_estimate: parsed.flops_estimate,
    vram_gb: parsed.vram_gb !== null ? parsed.vram_gb : fallbackVramGb,
    benchmark_at: row.completed_at || row.submitted_at || null,
  };
}

module.exports = {
  getBenchmarkResult,
  _parseMetrics: parseMetrics,
};
