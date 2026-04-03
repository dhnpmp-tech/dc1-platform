#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const request = require('supertest');

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'monitor-admin-token';
if (!process.env.DISABLE_RATE_LIMIT) process.env.DISABLE_RATE_LIMIT = '1';
if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = 'http://localhost:54321';
if (!process.env.SUPABASE_SERVICE_KEY) process.env.SUPABASE_SERVICE_KEY = 'local-dev-service-role-key';

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'backend', 'artifacts', 'provider-activation-monitor');
const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN;
const PLACEHOLDER_CODE_SET = new Set([
  'unknown',
  'unknown_reason',
  'none',
  'n/a',
  'not_available',
  'placeholder',
  'synthetic_placeholder',
  'empty_window_default',
]);

function stableNow() {
  return new Date().toISOString();
}

function toTimestamp(iso) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}z$/i, 'Z');
}

function buildMarkdown(report) {
  const lines = [
    '# Provider Activation Monitor',
    '',
    `- generated_at: ${report.generated_at}`,
    `- pass: ${report.pass ? 'true' : 'false'}`,
    '',
    '## Checks',
    '',
  ];
  for (const check of report.checks) {
    lines.push(`- ${check.id}: ${check.pass ? 'PASS' : 'FAIL'}${check.details ? ` — ${check.details}` : ''}`);
  }
  lines.push('');
  lines.push('## Windows');
  lines.push('');
  for (const [windowName, windowReport] of Object.entries(report.response.windows || {})) {
    lines.push(`### ${windowName}`);
    lines.push('');
    lines.push(`- sample_size: ${windowReport.sample_size}`);
    lines.push(`- stage_counts: \`${JSON.stringify(windowReport.stage_counts)}\``);
    lines.push(`- blocker_taxonomy_count: ${(windowReport.blocker_taxonomy || []).length}`);
    lines.push(`- admission_rejection_counts: ${(windowReport.admission_rejection_counts || []).length}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function ensureOutputDir(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function hasSyntheticPlaceholder(row) {
  if (!row || typeof row !== 'object') return false;
  const code = String(row.code || row.rejection_code || '').trim().toLowerCase();
  return code ? PLACEHOLDER_CODE_SET.has(code) : false;
}

function validateWindow(windowName, report) {
  const checks = [];
  const stageCounts = report?.stage_counts || {};
  const blockerTaxonomy = Array.isArray(report?.blocker_taxonomy) ? report.blocker_taxonomy : null;
  const admissionRejections = Array.isArray(report?.admission_rejection_counts)
    ? report.admission_rejection_counts
    : null;

  checks.push({
    id: `${windowName}:online_within_24h_present`,
    pass: Object.prototype.hasOwnProperty.call(stageCounts, 'online_within_24h'),
    details: 'stage_counts.online_within_24h is required',
  });

  checks.push({
    id: `${windowName}:blocker_taxonomy_array`,
    pass: Array.isArray(blockerTaxonomy),
    details: 'blocker_taxonomy must be an array',
  });

  checks.push({
    id: `${windowName}:admission_rejection_counts_array`,
    pass: Array.isArray(admissionRejections),
    details: 'admission_rejection_counts must be an array',
  });

  const placeholderFound = [
    ...(blockerTaxonomy || []),
    ...(admissionRejections || []),
  ].some((entry) => hasSyntheticPlaceholder(entry));
  checks.push({
    id: `${windowName}:no_synthetic_placeholders`,
    pass: !placeholderFound,
    details: placeholderFound ? 'found placeholder blocker/admission codes' : '',
  });

  const sampleSize = Number(report?.sample_size || 0);
  if (sampleSize === 0) {
    checks.push({
      id: `${windowName}:empty_window_has_no_placeholder_rows`,
      pass: (blockerTaxonomy || []).length === 0 && (admissionRejections || []).length === 0,
      details: 'empty windows must not inject synthetic blocker/admission rows',
    });
  }

  return checks;
}

async function run() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));

  const res = await request(app)
    .get('/api/admin/providers/activation-conversion')
    .set('x-admin-token', ADMIN_TOKEN);

  const checks = [];
  checks.push({
    id: 'http_status_200',
    pass: res.status === 200,
    details: `received status ${res.status}`,
  });

  const windows = res.body?.windows || {};
  checks.push({
    id: 'windows_last_24h_present',
    pass: Boolean(windows.last_24h),
    details: 'response.windows.last_24h must exist',
  });
  checks.push({
    id: 'windows_last_7d_present',
    pass: Boolean(windows.last_7d),
    details: 'response.windows.last_7d must exist',
  });

  if (windows.last_24h) checks.push(...validateWindow('last_24h', windows.last_24h));
  if (windows.last_7d) checks.push(...validateWindow('last_7d', windows.last_7d));

  const pass = checks.every((check) => check.pass);
  const generatedAt = stableNow();
  const report = {
    generated_at: generatedAt,
    pass,
    checks,
    response: res.body,
  };

  ensureOutputDir(OUTPUT_DIR);
  const stamp = toTimestamp(generatedAt);
  const jsonPath = path.join(OUTPUT_DIR, `provider-activation-monitor-${stamp}.json`);
  const mdPath = path.join(OUTPUT_DIR, `provider-activation-monitor-${stamp}.md`);
  const latestJsonPath = path.join(OUTPUT_DIR, 'latest.json');
  const latestMdPath = path.join(OUTPUT_DIR, 'latest.md');
  const markdown = buildMarkdown(report);

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, markdown, 'utf8');
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestMdPath, markdown, 'utf8');

  console.log(`[provider-activation-monitor] status=${pass ? 'pass' : 'fail'}`);
  console.log(`[provider-activation-monitor] json=${jsonPath}`);
  console.log(`[provider-activation-monitor] md=${mdPath}`);
  console.log(`[provider-activation-monitor] latest_json=${latestJsonPath}`);
  console.log(`[provider-activation-monitor] latest_md=${latestMdPath}`);

  if (!pass) process.exitCode = 1;
}

run().catch((error) => {
  console.error(`[provider-activation-monitor] fatal: ${error.message}`);
  process.exit(1);
});
