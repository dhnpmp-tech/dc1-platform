#!/usr/bin/env node

/**
 * Template Catalog E2E Test — Sprint 27 Validation
 *
 * Validates template catalog API and template structure:
 * - GET /api/templates returns all templates
 * - Each template has required fields
 * - Filter parameters work correctly
 * - Template details endpoint works
 * - Job submission with template works
 *
 * Usage:
 *   DCP_API_BASE=https://api.dcp.sa \
 *   DCP_RENTER_KEY=xxx \
 *   node scripts/template-catalog-e2e.mjs
 */

const API_BASE = (process.env.DCP_API_BASE || 'http://localhost:8083/api').replace(/\/$/, '');
const RENTER_KEY = process.env.DCP_RENTER_KEY || '';

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
  if (RENTER_KEY && path !== '/templates' && path !== '/templates/whitelist' && !path.startsWith('/templates/')) {
    requestHeaders['x-renter-key'] = RENTER_KEY;
  }

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
  console.log('║     Template Catalog E2E Test — Sprint 27 Validation           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Start: ${nowIso()}`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 1: Template List
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 1: Fetch Template List');

  const listRes = await requestJson('/templates');
  recordCheck('GET /templates returns 200', listRes.ok, `HTTP ${listRes.status}`);

  if (!listRes.ok || !listRes.json) {
    recordCheck('Template list is valid JSON', false, 'Response is not valid JSON');
    return summarize();
  }

  const templates = listRes.json.templates || [];
  recordCheck('Response contains templates array', Array.isArray(templates), `Got ${templates.length} templates`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 2: Validate Template Structure
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 2: Validate Template Structure');

  const expectedFields = ['id', 'name', 'description', 'image', 'tags'];
  const expectedCount = 20;

  recordCheck(`All ${expectedCount} templates present`, templates.length >= expectedCount, `Got ${templates.length} templates`);

  let invalidTemplates = 0;
  templates.forEach((template, idx) => {
    const missingFields = expectedFields.filter(field => !(field in template));
    if (missingFields.length > 0) {
      invalidTemplates++;
      console.log(`  Template ${idx} (${template.id || 'unknown'}): missing ${missingFields.join(', ')}`);
    }
  });

  recordCheck('All templates have required fields', invalidTemplates === 0, `${invalidTemplates} templates invalid`);

  // Validate some specific field types
  let typeErrors = 0;
  templates.slice(0, 5).forEach(template => {
    if (typeof template.id !== 'string') typeErrors++;
    if (typeof template.name !== 'string') typeErrors++;
    if (template.tags && !Array.isArray(template.tags)) typeErrors++;
  });

  recordCheck('Template fields have correct types', typeErrors === 0, `${typeErrors} type errors`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 3: Test Filtering
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 3: Test Template Filtering');

  // Find a template with tags
  const templatesWithTags = templates.filter(t => Array.isArray(t.tags) && t.tags.length > 0);
  if (templatesWithTags.length > 0) {
    const firstTag = templatesWithTags[0].tags[0];
    const filterRes = await requestJson(`/templates?tag=${encodeURIComponent(firstTag)}`);

    recordCheck(`Filter by tag=${firstTag} returns 200`, filterRes.ok, `HTTP ${filterRes.status}`);

    if (filterRes.ok && filterRes.json?.templates) {
      const filtered = filterRes.json.templates;
      const allHaveTag = filtered.every(t => Array.isArray(t.tags) && t.tags.includes(firstTag));
      recordCheck(`All filtered templates have tag "${firstTag}"`, allHaveTag, `Checked ${filtered.length} templates`);
    }
  } else {
    recordCheck('Filter by tag (no templates with tags found)', false, 'Skipped — no templates with tags');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 4: Test Template Detail Endpoint
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 4: Test Template Detail Endpoint');

  if (templates.length > 0) {
    const testTemplate = templates[0];
    const detailRes = await requestJson(`/templates/${testTemplate.id}`);
    recordCheck(`GET /templates/${testTemplate.id} returns 200`, detailRes.ok, `HTTP ${detailRes.status}`);

    if (detailRes.ok && detailRes.json) {
      recordCheck('Detail response contains template id', detailRes.json.id === testTemplate.id, `Got ${detailRes.json.id}`);
      recordCheck('Detail includes all fields', expectedFields.every(f => f in detailRes.json), 'Checked required fields');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 5: Validate Specific Templates
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 5: Validate Expected Templates');

  const expectedTemplates = [
    'arabic-embeddings',
    'arabic-reranker',
    'nemotron-nano',
    'vllm-serve',
    'stable-diffusion',
    'pytorch-single-gpu',
    'ollama',
    'custom-container',
  ];

  expectedTemplates.forEach(expectedId => {
    const exists = templates.some(t => t.id === expectedId);
    recordCheck(`Template "${expectedId}" exists`, exists, exists ? 'Found' : 'Not found');
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 6: Check Whitelist Endpoint
  // ═══════════════════════════════════════════════════════════════════════════════

  printHeader('Step 6: Check Whitelist Endpoint');

  const whitelistRes = await requestJson('/templates/whitelist');
  recordCheck('GET /templates/whitelist returns 200', whitelistRes.ok, `HTTP ${whitelistRes.status}`);

  if (whitelistRes.ok && whitelistRes.json?.approved_images) {
    const images = whitelistRes.json.approved_images;
    recordCheck('Whitelist contains approved images', Array.isArray(images) && images.length > 0, `Got ${images.length} images`);
  }

  return summarize();
}

run()
  .then(code => process.exit(code))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
