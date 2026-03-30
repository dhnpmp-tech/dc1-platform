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

function buildImageRecord({ name, digest, shaTag, templates }) {
  const registry = requireEnv('IMAGE_REGISTRY');
  const namespace = requireEnv('IMAGE_NAMESPACE');
  const imageRef = `${registry}/${namespace}/${name}`;

  return {
    name,
    templates,
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

  const shaTag = requireEnv('LLM_WORKER_SHA_TAG');
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
    images: [
      buildImageRecord({
        name: 'base-worker',
        digest: requireEnv('BASE_WORKER_DIGEST'),
        shaTag: requireEnv('BASE_WORKER_SHA_TAG'),
        templates: ['runtime-base'],
      }),
      buildImageRecord({
        name: 'llm-worker',
        digest: requireEnv('LLM_WORKER_DIGEST'),
        shaTag,
        templates: parseTemplates(process.env.LLM_TEMPLATE_IDS),
      }),
      buildImageRecord({
        name: 'sd-worker',
        digest: requireEnv('SD_WORKER_DIGEST'),
        shaTag: requireEnv('SD_WORKER_SHA_TAG'),
        templates: parseTemplates(process.env.SD_TEMPLATE_IDS),
      }),
    ],
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

main();
