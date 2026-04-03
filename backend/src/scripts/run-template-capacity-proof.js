#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API_BASE_URL = String(process.env.DCP_API_BASE_URL || process.env.DCP_BASE_URL || 'https://api.dcp.sa').replace(/\/+$/, '');
const TEMPLATES = ['allam-7b-instruct', 'jais-13b-chat'];
const OUTPUT_DIR = path.resolve(__dirname, '../../../docs/reports/reliability');
const FILE_PREFIX = 'template-capacity-proof';

function toStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input || '')).digest('hex');
}

async function fetchCapacityCheck(templateId) {
  const route = `/api/templates/${encodeURIComponent(templateId)}/deploy/check`;
  const startedAt = Date.now();
  const res = await fetch(`${API_BASE_URL}${route}`);
  const elapsedMs = Date.now() - startedAt;
  const bodyText = await res.text();
  let bodyJson = null;
  try {
    bodyJson = JSON.parse(bodyText);
  } catch (_) {}

  return {
    template_id: templateId,
    route,
    status: res.status,
    elapsed_ms: elapsedMs,
    response_hash: sha256(bodyText),
    capable_provider_count: Number(bodyJson?.capable_provider_count || 0),
    idle_provider_count: Number(bodyJson?.idle_provider_count || 0),
    required_vram_gb: Number(bodyJson?.required_vram_gb || 0),
    selected_provider: bodyJson?.selected_provider || null,
    error: res.ok ? null : (bodyJson?.error || bodyText.slice(0, 240) || 'request_failed'),
  };
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# Template Capacity Proof');
  lines.push('');
  lines.push(`- generated_at: \`${report.generated_at}\``);
  lines.push(`- base_url: \`${report.base_url}\``);
  lines.push(`- verdict: **${report.verdict}**`);
  lines.push(`- command: \`${report.command}\``);
  lines.push('');
  lines.push('| template_id | status | elapsed_ms | required_vram_gb | capable_provider_count | idle_provider_count | selected_provider_id |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const check of report.checks) {
    lines.push(`| ${check.template_id} | ${check.status} | ${check.elapsed_ms} | ${check.required_vram_gb} | ${check.capable_provider_count} | ${check.idle_provider_count} | ${check.selected_provider?.id || ''} |`);
  }
  if (report.failures.length > 0) {
    lines.push('');
    lines.push('## Failures');
    lines.push('');
    for (const failure of report.failures) {
      lines.push(`- \`${failure.template_id}\`: ${failure.reason}`);
    }
  }
  lines.push('');
  lines.push('## Artifacts');
  lines.push('');
  lines.push(`- json: \`${report.artifacts.json}\``);
  lines.push(`- markdown: \`${report.artifacts.markdown}\``);
  lines.push(`- latest_json: \`${report.artifacts.latest_json}\``);
  lines.push(`- latest_markdown: \`${report.artifacts.latest_markdown}\``);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const stamp = toStamp();
  const checks = [];
  for (const templateId of TEMPLATES) {
    // eslint-disable-next-line no-await-in-loop
    checks.push(await fetchCapacityCheck(templateId));
  }

  const failures = checks
    .filter((check) => check.status !== 200 || check.capable_provider_count < 1)
    .map((check) => ({
      template_id: check.template_id,
      reason: check.status !== 200
        ? `HTTP ${check.status}${check.error ? `: ${check.error}` : ''}`
        : `capable_provider_count=${check.capable_provider_count}`,
    }));

  const verdict = failures.length === 0 ? 'PASS' : 'FAIL';
  const jsonPath = path.join(OUTPUT_DIR, `${FILE_PREFIX}-${stamp}.json`);
  const mdPath = path.join(OUTPUT_DIR, `${FILE_PREFIX}-${stamp}.md`);
  const latestJson = path.join(OUTPUT_DIR, `${FILE_PREFIX}-latest.json`);
  const latestMd = path.join(OUTPUT_DIR, `${FILE_PREFIX}-latest.md`);
  const report = {
    generated_at: new Date().toISOString(),
    base_url: API_BASE_URL,
    command: 'node src/scripts/run-template-capacity-proof.js',
    verdict,
    checks,
    failures,
    artifacts: {
      json: path.relative(path.resolve(__dirname, '../../..'), jsonPath),
      markdown: path.relative(path.resolve(__dirname, '../../..'), mdPath),
      latest_json: path.relative(path.resolve(__dirname, '../../..'), latestJson),
      latest_markdown: path.relative(path.resolve(__dirname, '../../..'), latestMd),
    },
  };

  const markdown = buildMarkdown(report);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, markdown, 'utf8');
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestMd, markdown, 'utf8');

  process.stdout.write(`${JSON.stringify({
    verdict,
    artifacts: report.artifacts,
    failures,
  }, null, 2)}\n`);

  if (verdict !== 'PASS') process.exit(1);
}

run().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    message: error?.message || 'Unknown error',
  }, null, 2)}\n`);
  process.exit(1);
});

