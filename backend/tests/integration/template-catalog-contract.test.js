const express = require('express');
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

function writeTemplate(dir, filename, payload) {
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(payload, null, 2), 'utf8');
}

describe('GET /api/templates/catalog', () => {
  let app;
  let tempDir;

  beforeEach(() => {
    process.env.DISABLE_RATE_LIMIT = '1';
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcp-template-catalog-'));
    process.env.DCP_TEMPLATES_DIR = tempDir;

    app = express();
    app.use(express.json());
    app.use('/api/templates', require('../../src/routes/templates'));
  });

  afterEach(() => {
    delete process.env.DISABLE_RATE_LIMIT;
    delete process.env.DCP_TEMPLATES_DIR;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  test('returns stable contract payload with deterministic ordering', async () => {
    writeTemplate(tempDir, 'b-model.json', {
      id: 'b-model',
      name: 'Model B',
      job_type: 'llm-inference',
      min_vram_gb: 24,
      params: { model: 'meta/B-24B' },
      tier: 'cached',
      tier_notes: 'cached tier',
      default_duration_minutes: 45,
      default_pricing_class: 'priority',
      sort_order: 20,
    });

    writeTemplate(tempDir, 'a-model.json', {
      id: 'a-model',
      name: 'Model A',
      job_type: 'llm-inference',
      min_vram_gb: 8,
      params: { model: 'meta/A-8B' },
      sort_order: 10,
    });

    const res = await request(app).get('/api/templates/catalog');
    expect(res.status).toBe(200);
    expect(res.body.contract).toBe('dcp.template_catalog.v1');
    expect(res.body.version).toBe('2026-04-02');
    expect(res.body.count).toBe(2);
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(res.body.templates.map((t) => t.id)).toEqual(['a-model', 'b-model']);
    expect(res.body.templates[0]).toMatchObject({
      id: 'a-model',
      model_name: 'meta/A-8B',
      min_vram_gb: 8,
      tier_hint: {
        tier: 'standard',
        notes: '',
      },
      deploy_defaults: {
        duration_minutes: 60,
        pricing_class: 'standard',
        job_type: 'llm-inference',
        params: { model: 'meta/A-8B' },
      },
    });
    expect(res.body.templates[1].deploy_defaults.duration_minutes).toBe(45);
    expect(res.body.templates[1].deploy_defaults.pricing_class).toBe('priority');
  });

  test('fails with explicit validation errors when template files are malformed', async () => {
    writeTemplate(tempDir, 'ok-template.json', {
      id: 'ok-template',
      name: 'OK Template',
      job_type: 'custom_container',
      min_vram_gb: 16,
      params: { model: 'example/ok-model' },
    });

    writeTemplate(tempDir, 'broken-template.json', {
      id: 'broken-template',
      name: 'Broken Template',
      job_type: 'custom_container',
      params: { model: 'example/broken-model' },
    });

    const res = await request(app).get('/api/templates/catalog');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Template catalog contract validation failed');
    expect(res.body.contract).toBe('dcp.template_catalog.v1');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.join('\n')).toMatch(/broken-template\.json: missing or invalid numeric field "min_vram_gb"/);
  });
});
