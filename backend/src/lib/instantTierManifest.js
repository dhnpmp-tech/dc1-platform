'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MANIFEST_PATH = path.join(__dirname, '../../../artifacts/instant-tier-images.json');

function resolveManifestPath() {
  const override = process.env.INSTANT_TIER_MANIFEST_PATH;
  if (typeof override === 'string' && override.trim()) {
    return path.resolve(override.trim());
  }
  return DEFAULT_MANIFEST_PATH;
}

function readInstantTierManifest() {
  const manifestPath = resolveManifestPath();
  try {
    if (!fs.existsSync(manifestPath)) return null;
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function listInstantTierImageRefs(manifest = readInstantTierManifest()) {
  const images = Array.isArray(manifest?.images) ? manifest.images : [];
  const refs = [];
  for (const image of images) {
    const published = image?.published_refs || {};
    if (typeof published.mutable === 'string' && published.mutable.trim()) refs.push(published.mutable.trim());
    if (typeof published.immutable === 'string' && published.immutable.trim()) refs.push(published.immutable.trim());
    if (typeof published.canonical === 'string' && published.canonical.trim()) refs.push(published.canonical.trim());
  }
  return [...new Set(refs)];
}

function buildTemplateImageRefMap(manifest = readInstantTierManifest()) {
  const images = Array.isArray(manifest?.images) ? manifest.images : [];
  const out = new Map();
  for (const image of images) {
    const templates = Array.isArray(image?.templates) ? image.templates : [];
    const canonical = typeof image?.published_refs?.canonical === 'string'
      ? image.published_refs.canonical.trim()
      : '';
    const fallback = typeof image?.published_refs?.immutable === 'string'
      ? image.published_refs.immutable.trim()
      : '';
    const resolved = canonical || fallback;
    if (!resolved) continue;
    for (const templateId of templates) {
      if (typeof templateId !== 'string' || !templateId.trim()) continue;
      out.set(templateId.trim(), resolved);
    }
  }
  return out;
}

function resolveTemplateImageRef(templateId, fallbackImage, manifest = readInstantTierManifest()) {
  const normalizedTemplateId = typeof templateId === 'string' ? templateId.trim() : '';
  const map = buildTemplateImageRefMap(manifest);
  return map.get(normalizedTemplateId) || fallbackImage;
}

module.exports = {
  resolveManifestPath,
  readInstantTierManifest,
  listInstantTierImageRefs,
  buildTemplateImageRefMap,
  resolveTemplateImageRef,
};
