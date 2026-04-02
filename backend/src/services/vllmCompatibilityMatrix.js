'use strict';

const fs = require('fs');
const path = require('path');

const MATRIX_PATH = path.resolve(__dirname, '../../../infra/vllm-configs/compatibility-matrix.json');

let cachedMatrix = null;
let cachedMtimeMs = null;

function normalizeModelId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function loadCompatibilityMatrix() {
  const stat = fs.statSync(MATRIX_PATH);
  if (cachedMatrix && cachedMtimeMs === stat.mtimeMs) return cachedMatrix;
  const parsed = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
  cachedMatrix = parsed;
  cachedMtimeMs = stat.mtimeMs;
  return parsed;
}

function collectAliases(modelEntry) {
  const aliases = new Set();
  const push = (value) => {
    const normalized = normalizeModelId(value);
    if (normalized) aliases.add(normalized);
  };
  push(modelEntry?.id);
  if (Array.isArray(modelEntry?.aliases)) modelEntry.aliases.forEach(push);
  const variants = modelEntry?.variants && typeof modelEntry.variants === 'object' ? modelEntry.variants : {};
  for (const variant of Object.values(variants)) {
    push(variant?.model_id);
    if (Array.isArray(variant?.aliases)) variant.aliases.forEach(push);
  }
  return aliases;
}

function findModelEntry(requestedModelId, matrix = loadCompatibilityMatrix()) {
  const normalized = normalizeModelId(requestedModelId);
  if (!normalized || !Array.isArray(matrix?.models)) return null;
  return matrix.models.find((entry) => collectAliases(entry).has(normalized)) || null;
}

function getVariant(entry, variantKey) {
  if (!entry || typeof entry !== 'object') return null;
  const variants = entry.variants && typeof entry.variants === 'object' ? entry.variants : {};
  const variant = variants[variantKey];
  if (!variant || typeof variant !== 'object') return null;
  const minVramMb = Number(variant.min_vram_mb || 0);
  return {
    key: variantKey,
    model_id: typeof variant.model_id === 'string' ? variant.model_id : null,
    min_vram_mb: Number.isFinite(minVramMb) && minVramMb > 0 ? minVramMb : 0,
    available: variant.available !== false,
    availability_note: typeof variant.availability_note === 'string' ? variant.availability_note : null,
    recommended_script: typeof variant.recommended_script === 'string' ? variant.recommended_script : null,
  };
}

function resolveVariantForProvider(entry, providerVramMb) {
  const vramMb = Number(providerVramMb || 0);
  const preferred = getVariant(entry, entry.default_variant);
  const fallback = getVariant(entry, entry.fallback_variant);
  const ordered = [];
  if (preferred) ordered.push(preferred);
  if (fallback && (!preferred || fallback.key !== preferred.key)) ordered.push(fallback);
  const variants = entry?.variants && typeof entry.variants === 'object' ? Object.keys(entry.variants) : [];
  for (const key of variants) {
    const candidate = getVariant(entry, key);
    if (!candidate) continue;
    if (ordered.some((existing) => existing.key === candidate.key)) continue;
    ordered.push(candidate);
  }

  let firstUnavailable = null;
  for (const candidate of ordered) {
    if (!candidate.available) {
      if (!firstUnavailable) firstUnavailable = candidate;
      continue;
    }
    if (candidate.min_vram_mb > 0 && vramMb < candidate.min_vram_mb) continue;
    return {
      supported: true,
      model_id: candidate.model_id,
      variant: candidate.key,
      min_vram_mb: candidate.min_vram_mb,
      recommended_script: candidate.recommended_script,
      fallback_used: Boolean(
        entry.fallback_variant
        && candidate.key === entry.fallback_variant
        && entry.default_variant
        && entry.default_variant !== entry.fallback_variant
      ),
      availability_note: candidate.availability_note,
    };
  }

  let minRequired = null;
  for (const candidate of ordered) {
    if (!candidate.available || !candidate.min_vram_mb) continue;
    if (minRequired == null || candidate.min_vram_mb < minRequired) minRequired = candidate.min_vram_mb;
  }

  return {
    supported: false,
    min_required_vram_mb: minRequired,
    unavailable_variant: firstUnavailable,
  };
}

function evaluateProviderModelCompatibility({ modelId, providerVramMb }) {
  const matrix = loadCompatibilityMatrix();
  const entry = findModelEntry(modelId, matrix);
  if (!entry) {
    return {
      known: false,
      supported: true,
      reason: 'Model not in compatibility matrix; falling back to baseline admission checks',
      matrix_version: matrix?.version || null,
      requested_model: modelId || null,
    };
  }

  const resolution = resolveVariantForProvider(entry, providerVramMb);
  if (!resolution.supported) {
    const minRequired = Number(resolution.min_required_vram_mb || 0);
    const unavailable = resolution.unavailable_variant;
    const detail = unavailable?.availability_note
      ? ` ${unavailable.availability_note}`
      : '';
    return {
      known: true,
      supported: false,
      reason: minRequired > 0
        ? `Model '${modelId}' requires >= ${minRequired} MiB VRAM on available variants.${detail}`
        : `No available variant for model '${modelId}'.${detail}`,
      matrix_version: matrix?.version || null,
      requested_model: modelId || null,
      min_required_vram_mb: minRequired > 0 ? minRequired : null,
      resolved_variant: unavailable?.key || null,
      recommended_script: unavailable?.recommended_script || null,
    };
  }

  return {
    known: true,
    supported: true,
    reason: resolution.fallback_used
      ? `Default variant unavailable; using fallback '${resolution.variant}'`
      : `Using '${resolution.variant}' variant`,
    matrix_version: matrix?.version || null,
    requested_model: modelId || null,
    resolved_model_id: resolution.model_id,
    resolved_variant: resolution.variant,
    min_required_vram_mb: resolution.min_vram_mb || null,
    recommended_script: resolution.recommended_script,
    fallback_used: resolution.fallback_used,
  };
}

module.exports = {
  MATRIX_PATH,
  loadCompatibilityMatrix,
  findModelEntry,
  evaluateProviderModelCompatibility,
};
