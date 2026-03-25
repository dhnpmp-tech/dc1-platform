#!/usr/bin/env node

/**
 * DCP-958: Model Catalog API Smoke Test
 *
 * Validates all deliverables from DCP-958:
 *   1. GET /api/models - full list with required fields
 *   2. GET /api/models?arabic=true - Arabic capability filter
 *   3. GET /api/models?vram_min=N - VRAM filter
 *   4. GET /api/templates - template list with required fields
 *   5. GET /api/pricing/tiers - floor prices per GPU tier
 *
 * Usage:
 *   DCP_API_BASE=https://api.dcp.sa node scripts/dcp-958-catalog-api-smoke.mjs
 *   DCP_API_BASE=http://localhost:8083/api node scripts/dcp-958-catalog-api-smoke.mjs
 */

const API_BASE = (process.env.DCP_API_BASE || 'http://localhost:8083/api').replace(/\/$/, '');

const checks = [];

function recordCheck(name, pass, details) {
  checks.push({ name, pass, details });
  const prefix = pass ? '✓ [PASS]' : '✗ [FAIL]';
  console.log(`  ${prefix} ${name}${details ? ` — ${details}` : ''}`);
}

async function get(path) {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url);
    let json = null;
    const text = await res.text();
    try { json = JSON.parse(text); } catch (_) {}
    return { ok: res.ok, status: res.status, json, url };
  } catch (err) {
    return { ok: false, status: 0, json: null, url, error: String(err) };
  }
}

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     DCP-958: Model Catalog API Smoke Test                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Run at:  ${new Date().toISOString()}\n`);

  // ── 1. GET /api/models ──────────────────────────────────────────────────────
  console.log('[ 1 ] GET /api/models — full list');
  const listRes = await get('/models');
  recordCheck('GET /models 200', listRes.ok, `HTTP ${listRes.status}`);

  const models = Array.isArray(listRes.json) ? listRes.json : [];
  recordCheck('Returns array', Array.isArray(listRes.json), `${models.length} models`);
  recordCheck('At least 1 model', models.length >= 1, `${models.length}`);

  const requiredFields = ['model_id', 'display_name', 'arabic_capability', 'vram_gb', 'pricing_per_hour', 'tier', 'status'];
  if (models.length > 0) {
    const missing = requiredFields.filter(f => !(f in models[0]));
    recordCheck('Required fields present (first model)', missing.length === 0,
      missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'All present');
  }

  // ── 2. GET /api/models?arabic=true ──────────────────────────────────────────
  console.log('\n[ 2 ] GET /api/models?arabic=true — Arabic capability filter');
  const arabicRes = await get('/models?arabic=true');
  recordCheck('GET /models?arabic=true 200', arabicRes.ok, `HTTP ${arabicRes.status}`);

  const arabicModels = Array.isArray(arabicRes.json) ? arabicRes.json : [];
  recordCheck('Returns filtered array', Array.isArray(arabicRes.json), `${arabicModels.length} models`);

  if (arabicModels.length > 0) {
    const allArabic = arabicModels.every(m => m.arabic_capability === true);
    recordCheck('All results have arabic_capability=true', allArabic,
      allArabic ? 'Correct' : 'Some models lack arabic_capability=true');
    recordCheck('arabic=true returns fewer than full list', arabicModels.length <= models.length,
      `${arabicModels.length} vs ${models.length}`);
  }

  // ── 3. GET /api/models?vram_min=N ───────────────────────────────────────────
  console.log('\n[ 3 ] GET /api/models?vram_min=24 — VRAM filter');
  const vramRes = await get('/models?vram_min=24');
  recordCheck('GET /models?vram_min=24 200', vramRes.ok, `HTTP ${vramRes.status}`);

  const vramModels = Array.isArray(vramRes.json) ? vramRes.json : [];
  recordCheck('VRAM filter returns array', Array.isArray(vramRes.json), `${vramModels.length} models`);

  if (vramModels.length > 0) {
    const allFit = vramModels.every(m => (m.min_gpu_vram_gb || 0) <= 24);
    recordCheck('All results fit within 24 GB VRAM', allFit,
      allFit ? 'Correct' : 'Some models exceed 24 GB');
  }

  // ── 4. GET /api/templates ───────────────────────────────────────────────────
  console.log('\n[ 4 ] GET /api/templates — template catalog');
  const tmplRes = await get('/templates');
  recordCheck('GET /templates 200', tmplRes.ok, `HTTP ${tmplRes.status}`);

  const templates = tmplRes.json?.templates;
  recordCheck('Returns templates array', Array.isArray(templates), `${Array.isArray(templates) ? templates.length : 0} templates`);
  recordCheck('At least 1 template', Array.isArray(templates) && templates.length >= 1,
    `${Array.isArray(templates) ? templates.length : 0}`);

  if (Array.isArray(templates) && templates.length > 0) {
    const tmpl = templates[0];
    const tmplFields = ['id', 'name', 'description', 'min_vram_gb'];
    const tmplMissing = tmplFields.filter(f => !(f in tmpl));
    recordCheck('Template has required fields (id, name, description, min_vram_gb)', tmplMissing.length === 0,
      tmplMissing.length > 0 ? `Missing: ${tmplMissing.join(', ')}` : 'All present');
    recordCheck('Templates include pricing block', 'pricing' in tmpl,
      'pricing' in tmpl ? 'Present' : 'Missing');
  }

  // ── 5. GET /api/pricing/tiers ───────────────────────────────────────────────
  console.log('\n[ 5 ] GET /api/pricing/tiers — floor pricing per GPU tier');
  const priceRes = await get('/pricing/tiers');
  recordCheck('GET /pricing/tiers 200', priceRes.ok, `HTTP ${priceRes.status}`);

  const pricingData = priceRes.json;
  recordCheck('Returns tiers array', Array.isArray(pricingData?.tiers), `${pricingData?.tiers?.length || 0} tiers`);
  recordCheck('Includes SAR/USD rate', typeof pricingData?.sar_usd_rate === 'number',
    `Rate: ${pricingData?.sar_usd_rate}`);
  recordCheck('Includes anchor GPU', pricingData?.anchor_gpu === 'rtx 4090',
    `Anchor: ${pricingData?.anchor_gpu}`);

  if (Array.isArray(pricingData?.tiers) && pricingData.tiers.length > 0) {
    const rtx4090 = pricingData.tiers.find(t => t.gpu_model === 'rtx 4090');
    recordCheck('RTX 4090 tier present', !!rtx4090, rtx4090 ? `$${rtx4090.pricing?.rate_per_hour_usd}/hr` : 'Not found');
    if (rtx4090) {
      recordCheck('RTX 4090 rate is $0.267/hr', rtx4090.pricing?.rate_per_hour_usd === 0.267,
        `Got $${rtx4090.pricing?.rate_per_hour_usd}`);
      recordCheck('Competitor prices included', typeof rtx4090.competitor_prices?.vast_ai_usd === 'number',
        `Vast.ai: $${rtx4090.competitor_prices?.vast_ai_usd}`);
      recordCheck('Savings percentage computed', typeof rtx4090.savings_vs_vast_ai_pct === 'number',
        `${rtx4090.savings_vs_vast_ai_pct}% below Vast.ai`);
    }

    const tierFields = ['gpu_model', 'display_name', 'tier', 'min_vram_gb', 'pricing', 'competitor_prices'];
    const firstMissing = tierFields.filter(f => !(f in pricingData.tiers[0]));
    recordCheck('Tier entries have required fields', firstMissing.length === 0,
      firstMissing.length > 0 ? `Missing: ${firstMissing.join(', ')}` : 'All present');
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const allPass = passed === total;

  console.log('\n' + '='.repeat(62));
  console.log(`RESULT: ${passed}/${total} checks passed${allPass ? ' ✓ ALL PASS' : ''}`);
  console.log('='.repeat(62));

  if (!allPass) {
    console.log('\nFailed:');
    checks.filter(c => !c.pass).forEach(c => console.log(`  - ${c.name}: ${c.details || '(no details)'}`));
  }

  console.log();
  process.exit(allPass ? 0 : 1);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
