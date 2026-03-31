'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  evaluateArtifactFreshness,
} = require('../lib/reliabilityArtifactFreshness');

function writeArtifact(dir, name, generatedAt) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        generatedAt,
        summary: { status: 'pass' },
      },
      null,
      2
    )
  );
  return filePath;
}

describe('reliability artifact freshness gate', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reliability-artifact-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('passes when latest artifact is fresh', () => {
    const now = Date.parse('2026-03-31T00:00:00.000Z');
    writeArtifact(tempDir, 'canary-old.json', '2026-03-29T23:00:00.000Z');
    writeArtifact(tempDir, 'canary-fresh.json', '2026-03-30T23:30:00.000Z');

    const result = evaluateArtifactFreshness({
      artifactsDir: tempDir,
      maxAgeHours: 24,
      nowMs: now,
    });

    expect(result.pass).toBe(true);
    expect(result.status).toBe('PASS');
    expect(result.code).toBe('artifact_fresh');
    expect(result.artifactPath).toBe(path.join(tempDir, 'canary-fresh.json'));
  });

  test('fails when latest artifact is stale', () => {
    const now = Date.parse('2026-03-31T00:00:00.000Z');
    writeArtifact(tempDir, 'canary-latest.json', '2026-03-29T22:00:00.000Z');

    const result = evaluateArtifactFreshness({
      artifactsDir: tempDir,
      maxAgeHours: 24,
      nowMs: now,
    });

    expect(result.pass).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.code).toBe('artifact_stale');
    expect(result.artifactAgeHours).toBeGreaterThan(24);
  });

  test('fails when no valid timestamp exists', () => {
    fs.writeFileSync(
      path.join(tempDir, 'invalid.json'),
      JSON.stringify({ generatedAt: 'not-a-date' }, null, 2)
    );

    const result = evaluateArtifactFreshness({
      artifactsDir: tempDir,
      maxAgeHours: 24,
      nowMs: Date.parse('2026-03-31T00:00:00.000Z'),
    });

    expect(result.pass).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.code).toBe('artifact_timestamp_missing');
  });
});

