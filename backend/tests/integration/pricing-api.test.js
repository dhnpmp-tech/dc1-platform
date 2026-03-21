'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token-jest';

const request = require('supertest');
const express = require('express');
const db = require('../../src/db');

const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../../src/routes/admin'));
  return app;
}

const app = createApp();

function resetPricingTable() {
  db.prepare('DELETE FROM gpu_pricing').run();
  db.prepare(
    `INSERT INTO gpu_pricing (gpu_model, rate_halala, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`
  ).run('RTX 3060 Ti', 500);
}

beforeEach(() => {
  resetPricingTable();
});

describe('Admin Pricing API integration', () => {
  it('GET /api/admin/pricing returns 401 without x-admin-token', async () => {
    const res = await request(app).get('/api/admin/pricing');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('GET /api/admin/pricing returns 200 with prices array including RTX 3060 Ti', async () => {
    const res = await request(app)
      .get('/api/admin/pricing')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.prices)).toBe(true);
    expect(res.body.prices.some(p => p.gpu_model === 'RTX 3060 Ti')).toBe(true);
  });

  it('POST /api/admin/pricing creates a new model with valid admin token', async () => {
    const payload = { gpu_model: 'RTX 5090', rate_halala: 4500 };
    const res = await request(app)
      .post('/api/admin/pricing')
      .set('x-admin-token', ADMIN_TOKEN)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.price.gpu_model).toBe(payload.gpu_model);
    expect(res.body.price.rate_halala).toBe(payload.rate_halala);

    const row = db.prepare('SELECT gpu_model, rate_halala FROM gpu_pricing WHERE gpu_model = ?').get(payload.gpu_model);
    expect(row).toBeDefined();
    expect(row.rate_halala).toBe(payload.rate_halala);
    expect(Number.isInteger(row.rate_halala)).toBe(true);
  });

  it('POST /api/admin/pricing returns 409 for duplicate model', async () => {
    const payload = { gpu_model: 'RTX 4090', rate_halala: 3900 };

    const first = await request(app)
      .post('/api/admin/pricing')
      .set('x-admin-token', ADMIN_TOKEN)
      .send(payload);
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/admin/pricing')
      .set('x-admin-token', ADMIN_TOKEN)
      .send(payload);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toMatch(/already exists/i);
  });

  it('PATCH /api/admin/pricing/:model updates an existing model rate', async () => {
    db.prepare(
      `INSERT INTO gpu_pricing (gpu_model, rate_halala, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`
    ).run('L40S', 12000);

    const res = await request(app)
      .patch(`/api/admin/pricing/${encodeURIComponent('L40S')}`)
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ rate_halala: 12500 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.price.gpu_model).toBe('L40S');
    expect(res.body.price.rate_halala).toBe(12500);

    const row = db.prepare('SELECT rate_halala FROM gpu_pricing WHERE gpu_model = ?').get('L40S');
    expect(row.rate_halala).toBe(12500);
    expect(Number.isInteger(row.rate_halala)).toBe(true);
  });

  it('PATCH /api/admin/pricing/:model returns 404 for non-existent model', async () => {
    const res = await request(app)
      .patch(`/api/admin/pricing/${encodeURIComponent('Non Existent Model')}`)
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ rate_halala: 1500 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('rejects non-integer rate_halala to prevent SAR float storage', async () => {
    const res = await request(app)
      .post('/api/admin/pricing')
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ gpu_model: 'RTX 6000 Ada', rate_halala: 12.5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/integer/i);

    const row = db.prepare('SELECT rate_halala FROM gpu_pricing WHERE gpu_model = ?').get('RTX 6000 Ada');
    expect(row).toBeUndefined();
  });
});
