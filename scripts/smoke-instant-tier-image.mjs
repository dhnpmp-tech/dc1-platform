#!/usr/bin/env node

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args) {
  const res = spawnSync(command, args, { encoding: 'utf8', stdio: 'inherit' });
  if (res.error) fail(`${command} failed: ${res.error.message}`);
  if (res.status !== 0) fail(`${command} ${args.join(' ')} exited with status ${res.status}`);
}

function resolveImage(manifest, imageName) {
  const images = Array.isArray(manifest?.images) ? manifest.images : [];
  const match = images.find((item) => item?.name === imageName);
  if (!match) fail(`Image '${imageName}' not found in manifest`);
  const canonical = String(match?.published_refs?.canonical || '').trim();
  if (!canonical) fail(`Image '${imageName}' does not have published_refs.canonical`);
  return canonical;
}

function main() {
  const manifestPath = process.argv[2];
  const imageName = process.argv[3] || 'llm-worker';
  const bootCommand = process.argv[4] || 'import torch; print("instant-tier smoke ok")';
  if (!manifestPath) {
    fail('Usage: node scripts/smoke-instant-tier-image.mjs <manifest-path> [image-name] [python-command]');
  }
  if (!fs.existsSync(manifestPath)) {
    fail(`Manifest does not exist: ${manifestPath}`);
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  const canonicalRef = resolveImage(manifest, imageName);

  console.log(`[smoke] Pulling ${canonicalRef}`);
  run('docker', ['pull', canonicalRef]);

  console.log(`[smoke] Bootstrapping ${imageName}`);
  run('docker', ['run', '--rm', '--entrypoint', 'python', canonicalRef, '-c', bootCommand]);
}

main();
