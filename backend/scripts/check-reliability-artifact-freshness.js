'use strict';

const path = require('path');
const {
  DEFAULT_MAX_AGE_HOURS,
  evaluateArtifactFreshness,
} = require('../src/lib/reliabilityArtifactFreshness');

function parseNumber(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function defaultArtifactsDir() {
  return path.resolve(__dirname, '../../docs/reports/openrouter/reliability');
}

function parseArgs(argv) {
  const args = { artifactsDir: defaultArtifactsDir(), artifactPath: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--artifact' && argv[i + 1]) {
      args.artifactPath = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--artifacts-dir' && argv[i + 1]) {
      args.artifactsDir = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
      continue;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const maxAgeHours = parseNumber(process.env.RELIABILITY_ARTIFACT_MAX_AGE_HOURS, DEFAULT_MAX_AGE_HOURS);
  const nowMs = parseNumber(process.env.RELIABILITY_FRESHNESS_NOW_MS, Date.now());

  const result = evaluateArtifactFreshness({
    artifactPath: args.artifactPath,
    artifactsDir: args.artifactsDir,
    maxAgeHours,
    nowMs,
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(result.pass ? 0 : 1);
}

main();

