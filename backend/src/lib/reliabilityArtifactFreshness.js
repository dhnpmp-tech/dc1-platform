'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_AGE_HOURS = 24;

function isJsonFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.json';
}

function parseArtifactTimestamp(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw.generatedAt || raw.generated_at || raw.timestamp || null;
  if (typeof candidate !== 'string' || candidate.trim().length === 0) return null;
  const ms = Date.parse(candidate);
  if (Number.isNaN(ms)) return null;
  return { iso: new Date(ms).toISOString(), epochMs: ms };
}

function loadArtifact(filePath) {
  let rawContent;
  try {
    rawContent = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return { ok: false, code: 'artifact_read_failed', details: error.message, filePath };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    return { ok: false, code: 'artifact_parse_failed', details: error.message, filePath };
  }

  const timestamp = parseArtifactTimestamp(parsed);
  if (!timestamp) {
    return {
      ok: false,
      code: 'artifact_timestamp_missing',
      details: 'Artifact JSON must include a valid generatedAt timestamp.',
      filePath,
    };
  }

  return { ok: true, filePath, timestamp };
}

function listJsonFiles(dirPath) {
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    return { ok: false, code: 'artifact_dir_read_failed', details: error.message, dirPath };
  }

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dirPath, entry.name))
    .filter(isJsonFile);

  if (files.length === 0) {
    return {
      ok: false,
      code: 'artifact_not_found',
      details: `No JSON artifact files found in ${dirPath}.`,
      dirPath,
    };
  }

  return { ok: true, files };
}

function resolveLatestArtifact(options = {}) {
  if (options.artifactPath) {
    const loaded = loadArtifact(options.artifactPath);
    if (!loaded.ok) return loaded;
    return { ok: true, artifact: loaded };
  }

  const listed = listJsonFiles(options.artifactsDir);
  if (!listed.ok) return listed;

  const candidates = [];
  for (const filePath of listed.files) {
    const loaded = loadArtifact(filePath);
    if (loaded.ok) {
      candidates.push(loaded);
    }
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      code: 'artifact_timestamp_missing',
      details: 'No artifact JSON files with a valid generatedAt timestamp were found.',
      dirPath: options.artifactsDir,
    };
  }

  candidates.sort((a, b) => b.timestamp.epochMs - a.timestamp.epochMs);
  return { ok: true, artifact: candidates[0] };
}

function evaluateArtifactFreshness(options = {}) {
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const maxAgeHours = Number.isFinite(options.maxAgeHours) ? options.maxAgeHours : DEFAULT_MAX_AGE_HOURS;
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  const latest = resolveLatestArtifact(options);
  if (!latest.ok) {
    return {
      pass: false,
      status: 'FAIL',
      code: latest.code,
      message: latest.details,
      evaluatedAt: new Date(nowMs).toISOString(),
      maxAgeHours,
      artifactPath: options.artifactPath || null,
      artifactsDir: options.artifactsDir || null,
    };
  }

  const ageMs = nowMs - latest.artifact.timestamp.epochMs;
  const stale = ageMs > maxAgeMs;
  const ageHours = Number((ageMs / (60 * 60 * 1000)).toFixed(3));

  if (stale) {
    return {
      pass: false,
      status: 'FAIL',
      code: 'artifact_stale',
      message: `Latest reliability artifact is stale (${ageHours}h old, max ${maxAgeHours}h).`,
      evaluatedAt: new Date(nowMs).toISOString(),
      artifactPath: latest.artifact.filePath,
      artifactGeneratedAt: latest.artifact.timestamp.iso,
      artifactAgeHours: ageHours,
      maxAgeHours,
    };
  }

  return {
    pass: true,
    status: 'PASS',
    code: 'artifact_fresh',
    message: `Latest reliability artifact is fresh (${ageHours}h old, max ${maxAgeHours}h).`,
    evaluatedAt: new Date(nowMs).toISOString(),
    artifactPath: latest.artifact.filePath,
    artifactGeneratedAt: latest.artifact.timestamp.iso,
    artifactAgeHours: ageHours,
    maxAgeHours,
  };
}

module.exports = {
  DEFAULT_MAX_AGE_HOURS,
  evaluateArtifactFreshness,
};

