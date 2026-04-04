#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseTemplates(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseJsonEnv(name) {
  const raw = requireEnv(name);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${name}: ${error.message}`);
  }
}

function normalizeSpecs(rawSpecs) {
  if (!Array.isArray(rawSpecs) || rawSpecs.length === 0) {
    throw new Error('INSTANT_TIER_IMAGE_SPECS must be a non-empty JSON array');
  }
  return rawSpecs.map((spec, index) => {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      throw new Error(`INSTANT_TIER_IMAGE_SPECS[${index}] must be an object`);
    }
    const name = String(spec.name || '').trim();
    const digest = String(spec.digest || '').trim();
    const shaTag = String(spec.sha_tag || '').trim();
    const templateId = String(spec.template_id || '').trim();
    const templates = Array.isArray(spec.templates)
      ? spec.templates.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    const modelId = String(spec.model_id || '').trim();
    if (!name || !digest || !shaTag || (!templateId && templates.length === 0)) {
      throw new Error(`INSTANT_TIER_IMAGE_SPECS[${index}] requires name, digest, sha_tag, and template_id or templates`);
    }
    return {
      name,
      digest,
      shaTag,
      templateId: templateId || templates[0],
      templates: templates.length > 0 ? templates : [templateId],
      modelId,
    };
  });
}

function buildImageRecord({ name, digest, shaTag, templateId, templates, modelId }) {
  const registry = requireEnv('IMAGE_REGISTRY');
  const namespace = requireEnv('IMAGE_NAMESPACE');
  const imageRef = `${registry}/${namespace}/${name}`;

  return {
    name,
    templates: Array.isArray(templates) && templates.length > 0 ? templates : [templateId],
    model_id: modelId || null,
    published_refs: {
      mutable: `${imageRef}:latest`,
      immutable: `${imageRef}:${shaTag}`,
      canonical: `${imageRef}@${digest}`,
    },
    digest,
  };
}

function main() {
  const outputPath = process.argv[2];
  if (!outputPath) {
    throw new Error('Usage: node scripts/emit-instant-tier-manifest.mjs <output-path>');
  }

  const specs = process.env.INSTANT_TIER_IMAGE_SPECS
    ? normalizeSpecs(parseJsonEnv('INSTANT_TIER_IMAGE_SPECS'))
    : null;
  const manifest = {
    generated_at: new Date().toISOString(),
    source: {
      repository: process.env.GITHUB_REPOSITORY || null,
      revision: process.env.GITHUB_SHA || null,
      ref: process.env.GITHUB_REF || null,
      workflow: process.env.GITHUB_WORKFLOW || null,
      run_id: process.env.GITHUB_RUN_ID || null,
      event_name: process.env.GITHUB_EVENT_NAME || null,
    },
    registry: {
      host: requireEnv('IMAGE_REGISTRY'),
      namespace: requireEnv('IMAGE_NAMESPACE'),
    },
    images: specs
      ? specs.map((spec) => buildImageRecord(spec))
      : [
          buildImageRecord({
            name: 'base-worker',
            digest: requireEnv('BASE_WORKER_DIGEST'),
            shaTag: requireEnv('BASE_WORKER_SHA_TAG'),
            templateId: 'runtime-base',
            modelId: null,
          }),
          buildImageRecord({
            name: 'llm-worker',
            digest: requireEnv('LLM_WORKER_DIGEST'),
            shaTag: requireEnv('LLM_WORKER_SHA_TAG'),
            templateId: parseTemplates(process.env.LLM_TEMPLATE_IDS)[0] || 'llm-worker',
            modelId: process.env.LLM_MODEL_ID || null,
          }),
          buildImageRecord({
            name: 'sd-worker',
            digest: requireEnv('SD_WORKER_DIGEST'),
            shaTag: requireEnv('SD_WORKER_SHA_TAG'),
            templateId: parseTemplates(process.env.SD_TEMPLATE_IDS)[0] || 'sd-worker',
            modelId: process.env.SD_MODEL_ID || null,
          }),
        ],
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

main();
