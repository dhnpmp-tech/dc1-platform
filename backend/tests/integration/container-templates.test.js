/**
 * DCP-44: Container Template Integration Tests (DCP-33)
 *
 * Tests GET /api/templates, GET /api/templates/whitelist, and GET /api/templates/:id
 * Routes are defined in backend/src/routes/templates.js.
 * Templates live in /docker-templates/*.json at the repo root.
 *
 * Tests cover:
 *   1. GET /api/templates returns array with count (even when dir is empty)
 *   2. approved_images field is stripped from list response (security)
 *   3. GET /api/templates/whitelist returns approved_images array
 *   4. Whitelist always includes built-in DC1 images
 *   5. GET /api/templates?tag= filters by tag
 *   6. GET /api/templates/:id returns 404 for unknown id
 */

'use strict';

const request = require('supertest');
const express = require('express');
const path    = require('path');

// ── App factory ──────────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  const p = require.resolve('../../src/routes/templates');
  delete require.cache[p];
  app.use('/api/templates', require('../../src/routes/templates'));
  return app;
}

const app = createApp();

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/templates — list all templates', () => {
  it('returns 200 with templates array and count', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(typeof res.body.count).toBe('number');
    expect(res.body.count).toBe(res.body.templates.length);
  });

  it('does NOT expose approved_images in list response (security)', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    res.body.templates.forEach(t => {
      expect(t.approved_images).toBeUndefined();
    });
  });

  it('returns empty array (not 500) when docker-templates dir has no files', async () => {
    // Since templates dir may not exist in test env, the route should still return 200
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
  });

  it('includes vllm-serve template in list', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    const ids = (res.body.templates || []).map(t => t.id);
    expect(ids).toContain('vllm-serve');
  });
});

describe('GET /api/templates?tag= — tag filtering', () => {
  it('returns subset (or empty) when filtering by tag', async () => {
    const all = await request(app).get('/api/templates');
    const tagged = await request(app).get('/api/templates?tag=llm');

    expect(tagged.status).toBe(200);
    expect(Array.isArray(tagged.body.templates)).toBe(true);
    // Tagged count must be <= total count
    expect(tagged.body.count).toBeLessThanOrEqual(all.body.count);
  });

  it('returns empty array for non-existent tag (not 404)', async () => {
    const res = await request(app).get('/api/templates?tag=nonexistent-tag-xyz');
    expect(res.status).toBe(200);
    expect(res.body.templates).toEqual([]);
    expect(res.body.count).toBe(0);
  });
});

describe('GET /api/templates/whitelist — Docker image whitelist', () => {
  it('returns 200 with approved_images array', async () => {
    const res = await request(app).get('/api/templates/whitelist');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.approved_images)).toBe(true);
  });

  it('always includes built-in DC1 images', async () => {
    const res = await request(app).get('/api/templates/whitelist');
    const images = res.body.approved_images;

    // These are hardcoded in templates.js APPROVED_IMAGES_EXTRA
    expect(images).toContain('dc1/general-worker:latest');
    expect(images).toContain('dc1/llm-worker:latest');
    expect(images).toContain('dc1/sd-worker:latest');
  });

  it('whitelist contains no duplicate images', async () => {
    const res = await request(app).get('/api/templates/whitelist');
    const images = res.body.approved_images;
    const unique = [...new Set(images)];
    expect(unique.length).toBe(images.length);
  });

  it('does not expose approved_images in /whitelist route name collision (distinct from /:id)', async () => {
    // GET /api/templates/whitelist must return the whitelist, not 404 as /:id
    const res = await request(app).get('/api/templates/whitelist');
    expect(res.status).toBe(200);
    expect(res.body.approved_images).toBeDefined();
    // Should NOT return template-like shape
    expect(res.body.id).toBeUndefined();
  });
});

describe('GET /api/templates/:id — single template detail', () => {
  it('returns 404 for unknown template id', async () => {
    const res = await request(app).get('/api/templates/nonexistent-template-id-xyz');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('does not expose approved_images in single template response (security)', async () => {
    // If templates exist, check the first one does not expose approved_images
    const listRes = await request(app).get('/api/templates');
    if (listRes.body.count > 0) {
      const firstId = listRes.body.templates[0].id;
      const res = await request(app).get(`/api/templates/${firstId}`);
      expect(res.status).toBe(200);
      expect(res.body.approved_images).toBeUndefined();
    } else {
      // No templates in test env — verify 404 behavior
      const res = await request(app).get('/api/templates/any-id');
      expect(res.status).toBe(404);
    }
  });
});
