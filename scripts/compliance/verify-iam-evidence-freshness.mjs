#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = path.resolve('artifacts/compliance/iam');
const DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const args = {};

  for (const token of argv) {
    if (!token.startsWith('--')) continue;

    const [rawKey, ...rest] = token.slice(2).split('=');
    const value = rest.length > 0 ? rest.join('=') : 'true';
    args[rawKey] = value;
  }

  return args;
}

function toDate(value, fieldName, filePath) {
  const parsed = new Date(value);

  if (!value || Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid or missing ${fieldName} in ${filePath}`);
  }

  return parsed;
}

function listEvidenceFiles(suffix) {
  if (!fs.existsSync(ARTIFACT_DIR)) return [];

  return fs
    .readdirSync(ARTIFACT_DIR)
    .filter((fileName) => fileName.endsWith(suffix))
    .map((fileName) => path.join(ARTIFACT_DIR, fileName));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertFields(payload, requiredFields, filePath) {
  for (const fieldName of requiredFields) {
    const value = payload[fieldName];

    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
    ) {
      throw new Error(`Missing required field ${fieldName} in ${filePath}`);
    }
  }
}

function newestEvidence(files, dateField) {
  if (files.length === 0) return null;

  const dated = files.map((filePath) => {
    const payload = readJson(filePath);
    const date = toDate(payload[dateField], dateField, filePath);
    return { filePath, payload, date };
  });

  dated.sort((a, b) => b.date.getTime() - a.date.getTime());
  return dated[0];
}

function formatAgeDays(date, now) {
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const maxAgeDays = Number(args.maxAgeDays || '90');

  if (!Number.isFinite(maxAgeDays) || maxAgeDays < 1) {
    throw new Error('Invalid --maxAgeDays value. It must be a positive integer.');
  }

  const accessFiles = listEvidenceFiles('-privileged-access-review.json');
  const rotationFiles = listEvidenceFiles('-key-rotation-attestation.json');

  if (accessFiles.length === 0 || rotationFiles.length === 0) {
    throw new Error(
      `Missing IAM evidence files in ${ARTIFACT_DIR}. Expected both privileged-access-review and key-rotation-attestation artifacts.`,
    );
  }

  const newestAccess = newestEvidence(accessFiles, 'reviewed_at');
  const newestRotation = newestEvidence(rotationFiles, 'attested_at');
  const now = new Date();

  assertFields(
    newestAccess.payload,
    ['reviewer', 'reviewed_principals_scope', 'decision_outcomes', 'next_review_date'],
    newestAccess.filePath,
  );

  assertFields(
    newestRotation.payload,
    ['reviewer', 'reviewed_secrets_scope', 'decision_outcomes', 'next_review_date'],
    newestRotation.filePath,
  );

  assertFields(newestAccess.payload.decision_outcomes, ['summary'], newestAccess.filePath);
  assertFields(newestRotation.payload.decision_outcomes, ['summary'], newestRotation.filePath);

  const accessAgeDays = formatAgeDays(newestAccess.date, now);
  const rotationAgeDays = formatAgeDays(newestRotation.date, now);

  const reportLines = [
    '# IAM Evidence Freshness Report',
    '',
    `- Checked at: ${now.toISOString()}`,
    `- Max age policy (days): ${maxAgeDays}`,
    `- Latest privileged access review: ${path.basename(newestAccess.filePath)} (${accessAgeDays} days old)`,
    `- Latest key rotation attestation: ${path.basename(newestRotation.filePath)} (${rotationAgeDays} days old)`,
    '',
  ];

  const violations = [];

  if (accessAgeDays > maxAgeDays) {
    violations.push(
      `Privileged access review evidence is ${accessAgeDays} days old (limit ${maxAgeDays}).`,
    );
  }

  if (rotationAgeDays > maxAgeDays) {
    violations.push(
      `Key rotation attestation evidence is ${rotationAgeDays} days old (limit ${maxAgeDays}).`,
    );
  }

  if (violations.length > 0) {
    reportLines.push('- Result: FAIL');
    reportLines.push('');
    for (const violation of violations) {
      reportLines.push(`  - ${violation}`);
    }

    console.error(reportLines.join('\n'));
    process.exit(1);
  }

  reportLines.push('- Result: PASS');

  console.log(reportLines.join('\n'));
}

main();
