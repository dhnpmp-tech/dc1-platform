#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  formatComplianceReport,
  runOpenRouterComplianceHarness,
} = require('../../tests/helpers/openrouterComplianceHarness');

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = path.resolve(REPO_ROOT, 'docs/reports/openrouter/reliability');
const PREFIX = 'openrouter-reliability-gate';

function utcStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function resolveGit(refCmd, fallback = 'unknown') {
  try {
    return execSync(refCmd, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback;
  } catch (_) {
    return fallback;
  }
}

function toMarkdown(gate) {
  const lines = [];
  lines.push('# OpenRouter Reliability Gate');
  lines.push('');
  lines.push(`- generated_at: \`${gate.generated_at}\``);
  lines.push(`- commit: \`${gate.commit}\``);
  lines.push(`- branch: \`${gate.branch}\``);
  lines.push(`- command: \`${gate.command}\``);
  lines.push(`- readiness: **${String(gate.summary.readiness || 'unknown').toUpperCase()}**`);
  lines.push(`- checks: \`${gate.summary.passed}/${gate.summary.total}\` passing`);
  lines.push(`- blocking_failures: \`${gate.summary.blockingFailures}\``);
  lines.push(`- non_blocking_failures: \`${gate.summary.nonBlockingFailures}\``);
  lines.push('');
  lines.push('## Canonical QA Command');
  lines.push('');
  lines.push('```bash');
  lines.push('cd backend');
  lines.push('npm run gate:openrouter-reliability');
  lines.push('```');
  lines.push('');
  lines.push('## Harness Report');
  lines.push('');
  lines.push('```text');
  lines.push(gate.formatted_report.trim());
  lines.push('```');
  lines.push('');
  lines.push('## Artifact Paths');
  lines.push('');
  lines.push(`- json: \`${gate.artifacts.json}\``);
  lines.push(`- markdown: \`${gate.artifacts.markdown}\``);
  lines.push(`- latest_json: \`${gate.artifacts.latest_json}\``);
  lines.push(`- latest_markdown: \`${gate.artifacts.latest_markdown}\``);
  return `${lines.join('\n')}\n`;
}

async function main() {
  const startedAt = new Date().toISOString();
  const stamp = utcStamp();
  const command = 'cd backend && npm run gate:openrouter-reliability';
  const commit = resolveGit('git rev-parse --short HEAD');
  const branch = resolveGit('git rev-parse --abbrev-ref HEAD');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const report = await runOpenRouterComplianceHarness();
  const gate = {
    generated_at: startedAt,
    commit,
    branch,
    command,
    summary: report.summary,
    checks: report.checks,
    formatted_report: formatComplianceReport(report),
    artifacts: {
      json: `docs/reports/openrouter/reliability/${PREFIX}-${stamp}.json`,
      markdown: `docs/reports/openrouter/reliability/${PREFIX}-${stamp}.md`,
      latest_json: `docs/reports/openrouter/reliability/${PREFIX}-latest.json`,
      latest_markdown: `docs/reports/openrouter/reliability/${PREFIX}-latest.md`,
    },
  };

  const jsonPath = path.resolve(REPO_ROOT, gate.artifacts.json);
  const mdPath = path.resolve(REPO_ROOT, gate.artifacts.markdown);
  const latestJsonPath = path.resolve(REPO_ROOT, gate.artifacts.latest_json);
  const latestMdPath = path.resolve(REPO_ROOT, gate.artifacts.latest_markdown);

  fs.writeFileSync(jsonPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, toMarkdown(gate), 'utf8');
  fs.copyFileSync(jsonPath, latestJsonPath);
  fs.copyFileSync(mdPath, latestMdPath);

  process.stdout.write(`${gate.formatted_report}\n\n`);
  process.stdout.write(`Artifacts:\n- ${gate.artifacts.json}\n- ${gate.artifacts.markdown}\n- ${gate.artifacts.latest_json}\n- ${gate.artifacts.latest_markdown}\n`);
  process.exit(gate.summary.blockingFailures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('OpenRouter reliability gate failed:', error);
  process.exit(1);
});
