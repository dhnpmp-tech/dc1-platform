#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const {
  formatComplianceReport,
  runOpenRouterComplianceHarness,
} = require('../../tests/helpers/openrouterComplianceHarness');

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = path.resolve(REPO_ROOT, 'docs/reports/openrouter/certification');
const PREFIX = 'openrouter-certification-train';
const CONTRACT_CHECKS = {
  models_contract: 'models_contract',
  stream_done_contract: 'stream_stability',
  tools_passthrough_contract: 'tool_definition_passthrough',
  failover_behavior_contract: 'mid_stream_failure_handling',
};

function utcStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function resolveGit(refCmd, fallback = 'unknown') {
  try {
    return execSync(refCmd, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback;
  } catch (_) {
    return fallback;
  }
}

function runFirstLiveProof() {
  const command = ['node', 'tests/first-live-inference-proof-package.js'];
  const result = spawnSync(command[0], command.slice(1), {
    cwd: path.resolve(REPO_ROOT, 'backend'),
    encoding: 'utf8',
    timeout: Number.parseInt(process.env.DCP_CERT_TRAIN_RUNTIME_TIMEOUT_MS || '120000', 10),
    maxBuffer: 10 * 1024 * 1024,
  });

  let parsedStdout = null;
  try {
    parsedStdout = JSON.parse(String(result.stdout || '').trim() || '{}');
  } catch (_) {
    parsedStdout = null;
  }

  return {
    exit_code: Number.isFinite(result.status) ? result.status : 1,
    command: 'cd backend && node tests/first-live-inference-proof-package.js',
    verdict: result.error?.code === 'ETIMEDOUT'
      ? 'FAIL'
      : (parsedStdout?.verdict || (result.status === 0 ? 'PASS' : 'FAIL')),
    failure_code: result.error?.code === 'ETIMEDOUT'
      ? 'runtime_proof_timeout'
      : (parsedStdout?.failure_code || null),
    capacity_snapshot: parsedStdout?.capacity_snapshot || null,
    artifacts: parsedStdout?.artifacts || null,
    stdout: String(result.stdout || '').trim() || null,
    stderr: result.error?.code === 'ETIMEDOUT'
      ? `runtime proof timed out after ${process.env.DCP_CERT_TRAIN_RUNTIME_TIMEOUT_MS || '120000'}ms`
      : (String(result.stderr || '').trim() || null),
  };
}

function buildContractMatrix(complianceChecks) {
  const byId = new Map(complianceChecks.map((check) => [check.id, check]));
  const matrix = {};
  for (const [contractName, checkId] of Object.entries(CONTRACT_CHECKS)) {
    const check = byId.get(checkId);
    matrix[contractName] = {
      check_id: checkId,
      status: check?.status || 'unknown',
      severity: check?.severity || 'unknown',
      details: check?.details || 'Check missing from compliance harness output',
      evidence: Array.isArray(check?.evidence) ? check.evidence : [],
    };
  }
  return matrix;
}

function toMarkdown(bundle) {
  const lines = [];
  lines.push('# OpenRouter Certification Train');
  lines.push('');
  lines.push(`- generated_at: \`${bundle.generated_at}\``);
  lines.push(`- commit_sha: \`${bundle.commit.sha}\``);
  lines.push(`- commit_short: \`${bundle.commit.short}\``);
  lines.push(`- branch: \`${bundle.commit.branch}\``);
  lines.push(`- command: \`${bundle.command}\``);
  lines.push(`- overall_status: **${bundle.summary.overall_status}**`);
  lines.push(`- contracts_passed: \`${bundle.summary.contracts_passed}/${bundle.summary.contracts_total}\``);
  lines.push(`- runtime_blockers: \`${bundle.summary.runtime_blockers}\``);
  lines.push('');
  lines.push('## Contract Matrix');
  lines.push('');
  for (const [name, contract] of Object.entries(bundle.contracts)) {
    lines.push(`- ${name}: **${String(contract.status).toUpperCase()}** (${contract.check_id})`);
    lines.push(`  - severity: ${contract.severity}`);
    lines.push(`  - details: ${contract.details}`);
  }
  lines.push('');
  lines.push('## Runtime Proof');
  lines.push('');
  lines.push(`- verdict: **${bundle.runtime_proof.verdict}**`);
  lines.push(`- failure_code: \`${bundle.runtime_proof.failure_code || ''}\``);
  lines.push(`- capacity_snapshot: \`${JSON.stringify(bundle.runtime_proof.capacity_snapshot || {})}\``);
  lines.push('');
  lines.push('## Blockers');
  lines.push('');
  if (bundle.blockers.length === 0) {
    lines.push('- none');
  } else {
    for (const blocker of bundle.blockers) {
      lines.push(`- [${blocker.type}] ${blocker.id}: ${blocker.details}`);
    }
  }
  lines.push('');
  lines.push('## Artifacts');
  lines.push('');
  lines.push(`- json: \`${bundle.artifacts.json}\``);
  lines.push(`- markdown: \`${bundle.artifacts.markdown}\``);
  lines.push(`- latest_json: \`${bundle.artifacts.latest_json}\``);
  lines.push(`- latest_markdown: \`${bundle.artifacts.latest_markdown}\``);
  if (bundle.runtime_proof.artifacts) {
    lines.push(`- runtime_json: \`${bundle.runtime_proof.artifacts.json || ''}\``);
    lines.push(`- runtime_markdown: \`${bundle.runtime_proof.artifacts.markdown || ''}\``);
  }
  lines.push('');
  lines.push('## Commands');
  lines.push('');
  lines.push('```bash');
  lines.push('cd backend');
  lines.push('npm run certify:openrouter:train');
  lines.push('```');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const stamp = utcStamp();
  const commitSha = resolveGit('git rev-parse HEAD');
  const commitShort = resolveGit('git rev-parse --short HEAD');
  const commitBranch = resolveGit('git rev-parse --abbrev-ref HEAD');
  const command = 'cd backend && npm run certify:openrouter:train';

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const compliance = await runOpenRouterComplianceHarness();
  const contracts = buildContractMatrix(compliance.checks);
  const runtimeProof = runFirstLiveProof();

  const contractFailures = Object.entries(contracts)
    .filter(([, entry]) => entry.status !== 'pass')
    .map(([contractName, entry]) => ({
      type: 'contract',
      id: contractName,
      details: `${entry.check_id}: ${entry.details}`,
    }));

  const runtimeBlockers = runtimeProof.verdict === 'PASS' ? [] : [{
    type: 'runtime',
    id: runtimeProof.failure_code || 'runtime_failure',
    details: runtimeProof.capacity_snapshot
      ? JSON.stringify(runtimeProof.capacity_snapshot)
      : (runtimeProof.stderr || runtimeProof.stdout || 'runtime proof failed'),
  }];

  const blockers = [...contractFailures, ...runtimeBlockers];
  const contractsPassed = Object.values(contracts).filter((entry) => entry.status === 'pass').length;
  const contractsTotal = Object.keys(contracts).length;

  const bundle = {
    generated_at: generatedAt,
    command,
    commit: {
      sha: commitSha,
      short: commitShort,
      branch: commitBranch,
    },
    contracts,
    compliance_summary: compliance.summary,
    compliance_report: formatComplianceReport(compliance),
    runtime_proof: runtimeProof,
    blockers,
    summary: {
      contracts_passed: contractsPassed,
      contracts_total: contractsTotal,
      runtime_blockers: runtimeBlockers.length,
      contract_blockers: contractFailures.length,
      overall_status: blockers.length === 0 ? 'PASS' : 'FAIL',
    },
    artifacts: {
      json: `docs/reports/openrouter/certification/${PREFIX}-${stamp}.json`,
      markdown: `docs/reports/openrouter/certification/${PREFIX}-${stamp}.md`,
      latest_json: `docs/reports/openrouter/certification/${PREFIX}-latest.json`,
      latest_markdown: `docs/reports/openrouter/certification/${PREFIX}-latest.md`,
    },
  };

  const jsonPath = path.resolve(REPO_ROOT, bundle.artifacts.json);
  const markdownPath = path.resolve(REPO_ROOT, bundle.artifacts.markdown);
  const latestJsonPath = path.resolve(REPO_ROOT, bundle.artifacts.latest_json);
  const latestMarkdownPath = path.resolve(REPO_ROOT, bundle.artifacts.latest_markdown);

  fs.writeFileSync(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, toMarkdown(bundle), 'utf8');
  fs.copyFileSync(jsonPath, latestJsonPath);
  fs.copyFileSync(markdownPath, latestMarkdownPath);

  process.stdout.write(`${JSON.stringify({
    overall_status: bundle.summary.overall_status,
    contracts: bundle.summary.contracts_passed,
    contracts_total: bundle.summary.contracts_total,
    runtime_blockers: bundle.summary.runtime_blockers,
    contract_blockers: bundle.summary.contract_blockers,
    artifacts: bundle.artifacts,
  }, null, 2)}\n`);

  process.exit(blockers.length === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`openrouter certification train failed: ${error?.message || String(error)}\n`);
  process.exit(1);
});
