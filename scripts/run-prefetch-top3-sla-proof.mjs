#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const ensureScript = path.join(repoRoot, 'backend/tests/ensure-inference-smoke-principal.js');
const publishScript = path.join(repoRoot, 'infra/scripts/publish-prefetch-top3.sh');

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });
}

function runBash(args, options = {}) {
  return spawnSync('bash', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });
}

function parseKeyFromEnsureOutput(text) {
  try {
    const payload = JSON.parse(String(text || '{}'));
    const inferenceKey = String(payload.inference_key || '').trim() || null;
    const renterEmail = String(payload.renter_email || '').trim().toLowerCase() || null;
    return {
      inferenceKey,
      renterEmail,
    };
  } catch {
    return null;
  }
}

async function recoverMasterRenterKey({ baseUrl, renterEmail }) {
  if (!renterEmail) return null;
  const url = `${String(baseUrl || '').replace(/\/+$/, '')}/api/renters/login-email`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: renterEmail }),
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const key = String(payload?.api_key || '').trim();
  return key || null;
}

async function main() {
  const apiBase = String(process.env.DCP_API_BASE || 'https://api.dcp.sa/api').replace(/\/+$/, '');
  const appBase = String(process.env.DCP_API_BASE_URL || 'https://api.dcp.sa').replace(/\/+$/, '');
  const artifactDir = process.env.DCP_TOP3_ARTIFACT_DIR || path.join(repoRoot, 'docs/reports/reliability');
  const templates = process.env.DCP_TOP3_TEMPLATES || 'allam-7b-instruct,falcon-h1-arabic-7b,jais-13b-chat';
  const target = process.env.DCP_TOP3_STARTUP_SLA_SECONDS || '60';

  process.stdout.write(`[dcp-top3-proof] ensure principal via ${ensureScript}\n`);
  const ensure = runNode([ensureScript, '--emit-key'], {
    env: {
      ...process.env,
      DCP_API_BASE_URL: appBase,
    },
  });

  if (ensure.status !== 0) {
    process.stderr.write(ensure.stdout || '');
    process.stderr.write(ensure.stderr || '');
    process.stderr.write(`[dcp-top3-proof] failed to mint scoped inference key (exit=${ensure.status})\n`);
    process.exit(1);
  }

  const ensured = parseKeyFromEnsureOutput(ensure.stdout);
  if (!ensured?.inferenceKey) {
    process.stderr.write(ensure.stdout || '');
    process.stderr.write('[dcp-top3-proof] ensure script did not return inference_key\n');
    process.exit(1);
  }
  const recoveredMasterKey = await recoverMasterRenterKey({
    baseUrl: appBase,
    renterEmail: ensured.renterEmail,
  });

  const renterKey = recoveredMasterKey || process.env.DCP_RENTER_KEY || ensured.inferenceKey;
  process.stdout.write(`[dcp-top3-proof] auth_key_source=${recoveredMasterKey ? 'login-email(master)' : (process.env.DCP_RENTER_KEY ? 'env(master)' : 'inference_scoped_fallback')}\n`);

  process.stdout.write('[dcp-top3-proof] execute publish-prefetch-top3.sh\n');
  process.stdout.write(`[dcp-top3-proof] api_base=${apiBase} templates=${templates} target=<${target}s\n`);

  const publish = runBash([
    publishScript,
    '--api-base', apiBase,
    '--templates', templates,
    '--target-seconds', target,
    '--output-dir', artifactDir,
    '--renter-key', renterKey,
  ], {
    env: {
      ...process.env,
      DCP_RENTER_KEY: renterKey,
    },
  });

  process.stdout.write(publish.stdout || '');
  process.stderr.write(publish.stderr || '');
  process.exit(Number.isInteger(publish.status) ? publish.status : 1);
}

main().catch((error) => {
  process.stderr.write(`[dcp-top3-proof] fatal error: ${error?.message || error}\n`);
  process.exit(1);
});
