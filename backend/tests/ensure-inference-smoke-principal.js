#!/usr/bin/env node
'use strict';

const crypto = require('crypto');

function toIso(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function keyHint(secret) {
  if (!secret || typeof secret !== 'string') return null;
  if (secret.length <= 12) return secret;
  return `${secret.slice(0, 8)}...${secret.slice(-4)}`;
}

function parseJsonBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), options);
  const text = await response.text();
  const json = parseJsonBody(text);
  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    text,
    json,
  };
}

function buildPrincipalEmail(baseUrl) {
  const digest = crypto.createHash('sha1').update(String(baseUrl || '')).digest('hex').slice(0, 12);
  return `inference-smoke-${digest}@dcp.local`;
}

async function ensureInferenceSmokePrincipal(opts = {}) {
  const baseUrl = String(opts.baseUrl || process.env.DCP_API_BASE_URL || process.env.DCP_BASE_URL || 'https://api.dcp.sa').replace(/\/+$/, '');
  const email = String(opts.email || process.env.DCP_SMOKE_PRINCIPAL_EMAIL || buildPrincipalEmail(baseUrl)).toLowerCase();
  const name = String(opts.name || process.env.DCP_SMOKE_PRINCIPAL_NAME || 'DCP Inference Smoke Principal');
  const organization = String(opts.organization || process.env.DCP_SMOKE_PRINCIPAL_ORG || 'DCP Smoke');
  const useCase = String(opts.useCase || process.env.DCP_SMOKE_PRINCIPAL_USE_CASE || 'inference_smoke');
  const labelPrefix = String(opts.labelPrefix || process.env.DCP_SMOKE_KEY_LABEL_PREFIX || 'dcp-smoke-proof');
  const expiresInHoursRaw = Number.parseInt(process.env.DCP_SMOKE_KEY_TTL_HOURS || String(opts.expiresInHours || 6), 10);
  const expiresInHours = Number.isFinite(expiresInHoursRaw) && expiresInHoursRaw > 0 ? Math.min(expiresInHoursRaw, 72) : 6;
  const minBalanceRaw = Number.parseInt(process.env.DCP_SMOKE_MIN_BALANCE_HALALA || String(opts.minBalanceHalala || 1), 10);
  const minBalanceHalala = Number.isFinite(minBalanceRaw) && minBalanceRaw > 0 ? minBalanceRaw : 1;

  let masterApiKey = null;
  const registerBody = {
    name,
    email,
    organization,
    use_case: useCase,
  };

  const registerRes = await requestJson(baseUrl, '/api/renters/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(registerBody),
  });

  if (registerRes.status === 201 && registerRes.json?.api_key) {
    masterApiKey = registerRes.json.api_key;
  } else if (registerRes.status === 409) {
    const loginRes = await requestJson(baseUrl, '/api/renters/login-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!loginRes.ok || !loginRes.json?.api_key) {
      const error = new Error('Cannot recover existing smoke principal master key via /api/renters/login-email');
      error.code = 'SMOKE_PRINCIPAL_LOGIN_FAILED';
      error.details = {
        baseUrl,
        email,
        registerStatus: registerRes.status,
        loginStatus: loginRes.status,
        loginBody: loginRes.json || loginRes.text,
      };
      throw error;
    }
    masterApiKey = loginRes.json.api_key;
  } else {
    const error = new Error('Smoke principal registration failed');
    error.code = 'SMOKE_PRINCIPAL_REGISTER_FAILED';
    error.details = {
      baseUrl,
      email,
      status: registerRes.status,
      body: registerRes.json || registerRes.text,
    };
    throw error;
  }

  const meRes = await requestJson(baseUrl, `/api/renters/me?key=${encodeURIComponent(masterApiKey)}`);
  if (!meRes.ok || !meRes.json?.renter?.id) {
    const error = new Error('Smoke principal exists but renter profile lookup failed');
    error.code = 'SMOKE_PRINCIPAL_PROFILE_FAILED';
    error.details = {
      baseUrl,
      email,
      status: meRes.status,
      body: meRes.json || meRes.text,
    };
    throw error;
  }

  const renter = meRes.json.renter;
  const balanceHalala = Number(renter.balance_halala || 0);
  if (balanceHalala < minBalanceHalala) {
    const error = new Error(`Smoke principal balance below minimum threshold (${balanceHalala} < ${minBalanceHalala})`);
    error.code = 'SMOKE_PRINCIPAL_INSUFFICIENT_BALANCE';
    error.details = {
      baseUrl,
      renter_id: renter.id,
      balance_halala: balanceHalala,
      min_balance_halala: minBalanceHalala,
      action: 'Top up renter balance or lower DCP_SMOKE_MIN_BALANCE_HALALA for non-billing smoke runs.',
    };
    throw error;
  }

  const listRes = await requestJson(baseUrl, '/api/renters/me/keys', {
    method: 'GET',
    headers: { 'x-renter-key': masterApiKey },
  });
  if (listRes.ok && Array.isArray(listRes.json?.keys)) {
    const stale = listRes.json.keys.filter((entry) => String(entry.label || '').startsWith(labelPrefix) && !entry.revoked);
    for (const entry of stale) {
      await requestJson(baseUrl, `/api/renters/me/keys/${encodeURIComponent(entry.id)}`, {
        method: 'DELETE',
        headers: { 'x-renter-key': masterApiKey },
      });
    }
  }

  const label = `${labelPrefix}:${new Date().toISOString().slice(0, 16)}`;
  const createRes = await requestJson(baseUrl, '/api/renters/me/keys', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-renter-key': masterApiKey,
    },
    body: JSON.stringify({
      label,
      scopes: ['inference'],
      expires_at: toIso(expiresInHours),
    }),
  });

  if (!createRes.ok || !createRes.json?.key) {
    const error = new Error('Failed to mint scoped inference key for smoke principal');
    error.code = 'SMOKE_PRINCIPAL_SCOPED_KEY_FAILED';
    error.details = {
      baseUrl,
      renter_id: renter.id,
      status: createRes.status,
      body: createRes.json || createRes.text,
    };
    throw error;
  }

  return {
    baseUrl,
    renterId: renter.id,
    renterEmail: email,
    balanceHalala,
    masterApiKey,
    inferenceKey: createRes.json.key,
    inferenceKeyId: createRes.json.id || null,
    inferenceKeyLabel: createRes.json.label || label,
    inferenceKeyExpiresAt: createRes.json.expires_at || null,
    keyHint: keyHint(createRes.json.key),
  };
}

async function main() {
  const emitKey = process.argv.includes('--emit-key');
  const emitEnv = process.argv.includes('--emit-env');
  const result = await ensureInferenceSmokePrincipal();
  const output = {
    ok: true,
    base_url: result.baseUrl,
    renter_id: result.renterId,
    renter_email: result.renterEmail,
    balance_halala: result.balanceHalala,
    inference_key_id: result.inferenceKeyId,
    inference_key_label: result.inferenceKeyLabel,
    inference_key_expires_at: result.inferenceKeyExpiresAt,
    inference_key_hint: result.keyHint,
  };
  if (emitKey) output.inference_key = result.inferenceKey;
  if (emitEnv) output.export = `export DCP_SMOKE_RENTER_KEY=${result.inferenceKey}`;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    const failure = {
      ok: false,
      code: error?.code || 'SMOKE_PRINCIPAL_ERROR',
      message: error?.message || 'Unknown error',
      details: error?.details || null,
    };
    process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exit(1);
  });
}

module.exports = {
  ensureInferenceSmokePrincipal,
};
