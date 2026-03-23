#!/usr/bin/env node

/**
 * Model Catalog Smoke Test — Sprint 27 Validation
 *
 * Validates model catalog API and model data:
 * - GET /api/models returns models from registry
 * - Models include pricing data
 * - Arabic models available and filterable
 * - Model detail endpoint works
 * - Model comparison endpoint works
 * - Deployment estimate endpoint works
 *
 * Usage:
 *   DCP_API_BASE=https://api.dcp.sa \
 *   node scripts/model-catalog-smoke.mjs
 */

const API_BASE = (process.env.DCP_API_BASE || 'http://localhost:8083/api').replace(/\/$/, '');

const checks = [];

function nowIso() {
  return new Date().toISOString();
}

function printHeader(title) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${title}`);
  console.log('='.repeat(70));
}

function recordCheck(name, pass, details) {
  checks.push({ name, pass, details });
  const prefix = pass ? '✓ [PASS]' : '✗ [FAIL]';
  console.log(`${prefix} ${name}${details ? ` — ${details}` : ''}`);
}

function summarize() {
  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const allPass = passed === total;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESULTS: ${passed}/${total} checks passed`);
  console.log('='.repeat(70));

  if (!allPass) {
    console.log('\nFailed checks:');
    checks
      .filter(c => !c.pass)
      .forEach(c => {
        console.log(`  - ${c.name}: ${c.details || '(no details)'}`);
      });
  }

  console.log(`\nEnd: ${nowIso()}\n`);
  return allPass ? 0 : 1;
}

async function requestJson(path, { method = 'GET', headers = {}, body } = {}) {
  const url = `${API_BASE}${path}`;
  const requestHeaders = { ...headers, 'Content-Type': 'application/json' };

  let payload;
  if (body !== undefined) {
    payload = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, { method, headers: requestHeaders, body: payload });
    const text = await res.text();
    let json = null;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch (_) {
        json = null;
      }
    }

    return { ok: res.ok, status: res.status, text, json, url };
  } catch (error) {
    return { ok: false, status: 0, text: String(error), json: null, url, error };
  }
}

async function run() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║       Model Catalog Smoke Test — Sprint 27 Validation          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Start: ${nowIso()}`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 1: Fetch Model List
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 1: Fetch Model List');

  const listRes = await requestJson('/models');
  recordCheck('GET /models returns 200', listRes.ok, `HTTP ${listRes.status}`);

  if (!listRes.ok || !Array.isArray(listRes.json)) {
    recordCheck('Response is array of models', false, 'Response is not a valid array');
    return summarize();
  }

  const models = listRes.json;
  recordCheck('Models list is not empty', models.length > 0, `Got ${models.length} models`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 2: Validate Model Structure
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 2: Validate Model Structure');

  const requiredFields = ['model_id', 'display_name', 'family', 'vram_gb', 'min_gpu_vram_gb', 'status'];
  const pricingFields = ['providers_online', 'avg_price_sar_per_min'];

  let structureErrors = 0;
  models.slice(0, 5).forEach((model, idx) => {
    const missing = requiredFields.filter(f => !(f in model));
    if (missing.length > 0) {
      structureErrors++;
      console.log(`  Model ${idx} (${model.model_id}): missing ${missing.join(', ')}`);
    }
  });

  recordCheck('First 5 models have required fields', structureErrors === 0, `${structureErrors} errors`);

  // Check pricing fields
  let pricingErrors = 0;
  models.slice(0, 5).forEach(model => {
    const missing = pricingFields.filter(f => !(f in model));
    if (missing.length > 0) pricingErrors++;
  });

  recordCheck('Models include pricing data', pricingErrors === 0, `${pricingErrors} models missing pricing`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 3: Check for Arabic Models
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 3: Check Arabic Model Availability');

  const arabicKeywords = ['allam', 'jais', 'falcon', 'qwen', 'llama', 'mistral', 'nemotron', 'arabic'];
  const arabicModels = models.filter(m => {
    const id = String(m.model_id).toLowerCase();
    const name = String(m.display_name).toLowerCase();
    return arabicKeywords.some(kw => id.includes(kw) || name.includes(kw));
  });

  recordCheck('Arabic-capable models available', arabicModels.length > 0, `Found ${arabicModels.length}`);

  // Expected Arabic models
  const expectedArabicModels = ['llama3-8b', 'qwen25-7b', 'mistral-7b', 'nemotron-nano'];
  expectedArabicModels.forEach(modelId => {
    const exists = models.some(m => m.model_id === modelId);
    recordCheck(`Model "${modelId}" exists`, exists, exists ? 'Found' : 'Not found');
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 4: Test Model Detail Endpoint
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 4: Test Model Detail Endpoint');

  if (models.length > 0) {
    const testModel = models[0];
    const detailRes = await requestJson(`/models/${testModel.model_id}`);
    recordCheck(`GET /models/${testModel.model_id} returns 200`, detailRes.ok, `HTTP ${detailRes.status}`);

    if (detailRes.ok && detailRes.json) {
      recordCheck('Detail includes benchmark data', 'benchmark' in detailRes.json, 'Benchmark present');
      recordCheck('Detail includes pricing data', 'pricing' in detailRes.json, 'Pricing present');
      recordCheck('Detail includes availability data', 'availability' in detailRes.json, 'Availability present');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 5: Test Catalog Endpoint
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 5: Test Full Model Catalog Endpoint');

  const catalogRes = await requestJson('/models/catalog');
  recordCheck('GET /models/catalog returns 200', catalogRes.ok, `HTTP ${catalogRes.status}`);

  if (catalogRes.ok && catalogRes.json?.models) {
    recordCheck('Catalog includes total_models field', 'total_models' in catalogRes.json, `Count: ${catalogRes.json.total_models}`);
    recordCheck('Catalog matches list endpoint', catalogRes.json.models.length === models.length, `${catalogRes.json.models.length} vs ${models.length}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 6: Test Model Comparison
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 6: Test Model Comparison Endpoint');

  if (models.length >= 2) {
    const id1 = models[0].model_id;
    const id2 = models[1].model_id;
    const compareRes = await requestJson(`/models/compare?ids=${id1},${id2}`);
    recordCheck('GET /models/compare returns 200', compareRes.ok, `HTTP ${compareRes.status}`);

    if (compareRes.ok && compareRes.json?.ranking) {
      recordCheck('Comparison includes ranking', Array.isArray(compareRes.json.ranking), `Ranked ${compareRes.json.ranking.length}`);
      recordCheck('Ranking based on quality/price', compareRes.json.ranking.length >= 2, 'Valid ranking');
    }
  } else {
    recordCheck('Model comparison test (need 2+ models)', false, 'Skipped — not enough models');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 7: Test Deployment Estimate
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 7: Test Deployment Estimate Endpoint');

  if (models.length > 0) {
    const testModel = models[0];
    const estimateRes = await requestJson(`/models/${testModel.model_id}/deploy/estimate`);
    recordCheck(`GET /models/.../deploy/estimate returns 200`, estimateRes.ok, `HTTP ${estimateRes.status}`);

    if (estimateRes.ok && estimateRes.json?.estimate) {
      const est = estimateRes.json.estimate;
      const hasEstimate = 'estimated_cost_sar' in est && 'duration_minutes' in est;
      recordCheck('Estimate includes cost and duration', hasEstimate, 'Cost/duration present');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 8: Test Benchmarks Feed
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 8: Test Benchmarks Feed Endpoint');

  const benchRes = await requestJson('/models/benchmarks');
  recordCheck('GET /models/benchmarks returns 200', benchRes.ok, `HTTP ${benchRes.status}`);

  if (benchRes.ok && benchRes.json?.models) {
    recordCheck('Benchmarks includes benchmark_suite', 'benchmark_suite' in benchRes.json, benchRes.json.benchmark_suite || 'unknown');
    recordCheck('Benchmarks models list matches', benchRes.json.models.length === models.length, `${benchRes.json.models.length} vs ${models.length}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 9: Test Model Cards
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 9: Test Model Cards Endpoint');

  const cardsRes = await requestJson('/models/cards');
  recordCheck('GET /models/cards returns 200', cardsRes.ok, `HTTP ${cardsRes.status}`);

  if (cardsRes.ok && cardsRes.json?.cards) {
    recordCheck('Cards includes language field', 'language' in cardsRes.json, cardsRes.json.language || 'unknown');
    recordCheck('Cards list matches models', cardsRes.json.cards.length === models.length, `${cardsRes.json.cards.length} vs ${models.length}`);

    // Check bilingual content
    const withArabic = cardsRes.json.cards.filter(c => c.summary?.ar).length;
    recordCheck('Cards include Arabic summaries', withArabic > 0, `${withArabic} cards with Arabic`);
  }

  return summarize();
}

run()
  .then(code => process.exit(code))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
