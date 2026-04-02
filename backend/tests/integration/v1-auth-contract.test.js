'use strict';

const express = require('express');
const request = require('supertest');

process.env.DC1_DB_PATH = process.env.DC1_DB_PATH || ':memory:';

const db = require('../../src/db');
const v1Router = require('../../src/routes/v1');

function safeDelete(table) {
  try {
    db.prepare('DELETE FROM ' + table).run();
  } catch (_) {}
}

function resetDb() {
  [
    'renter_api_keys',
    'inference_stream_events',
    'benchmark_runs',
    'jobs',
    'model_registry',
    'providers',
    'renters',
  ].forEach(safeDelete);
}

function nowIso() {
  return new Date().toISOString();
}

function seedRenter(apiKey) {
  db.prepare(
    "INSERT INTO renters " +
    "(name, email, api_key, status, balance_halala, total_spent_halala, total_jobs, created_at) " +
    "VALUES (?, ?, ?, 'active', ?, 0, 0, ?)"
  ).run('V1 Auth Contract Renter', apiKey + '@dc1.test', apiKey, 100000, nowIso());
}

describe('/v1 renter auth contract', () => {
  let app;

  beforeEach(() => {
    resetDb();
    app = express();
    app.use(express.json());
    app.use('/v1', v1Router);
  });

  test('GET /v1/models returns deterministic missing/invalid/conflict auth errors', async () => {
    const validKey = 'v1-auth-contract-key';
    seedRenter(validKey);

    const missingAuthRes = await request(app).get('/v1/models');
    expect(missingAuthRes.status).toBe(401);
    expect(missingAuthRes.body?.error).toMatchObject({
      type: 'authentication_error',
      code: 'auth_missing',
    });

    const invalidAuthRes = await request(app)
      .get('/v1/models')
      .set('Authorization', 'Bearer v1-auth-contract-invalid');
    expect(invalidAuthRes.status).toBe(401);
    expect(invalidAuthRes.body?.error).toMatchObject({
      type: 'authentication_error',
      code: 'auth_invalid',
    });

    const conflictAuthRes = await request(app)
      .get('/v1/models')
      .set('Authorization', 'Bearer ' + validKey)
      .set('x-renter-key', 'different-key');
    expect(conflictAuthRes.status).toBe(401);
    expect(conflictAuthRes.body?.error).toMatchObject({
      type: 'authentication_error',
      code: 'auth_conflict',
    });

    const malformedAuthorizationRes = await request(app)
      .get('/v1/models')
      .set('Authorization', 'Basic dGVzdDp0ZXN0');
    expect(malformedAuthorizationRes.status).toBe(401);
    expect(malformedAuthorizationRes.body?.error).toMatchObject({
      type: 'authentication_error',
      code: 'auth_invalid',
    });

    const malformedRenterHeaderRes = await request(app)
      .get('/v1/models')
      .set('x-renter-key', '   ');
    expect(malformedRenterHeaderRes.status).toBe(401);
    expect(malformedRenterHeaderRes.body?.error).toMatchObject({
      type: 'authentication_error',
      code: 'auth_invalid',
    });
  });

  test('POST /v1/chat/completions accepts bearer and x-renter-key before downstream routing checks', async () => {
    const validKey = 'v1-chat-auth-contract-key';
    seedRenter(validKey);

    const bearerRes = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer ' + validKey)
      .send({
        model: 'non-existent-model',
        messages: [{ role: 'user', content: 'hello' }],
      });

    const headerRes = await request(app)
      .post('/v1/chat/completions')
      .set('x-renter-key', validKey)
      .send({
        model: 'non-existent-model',
        messages: [{ role: 'user', content: 'hello' }],
      });

    // These requests can fail downstream with 503 due to provider/model setup.
    // The auth contract assertion is that neither path fails as auth_missing/auth_invalid.
    expect([400, 402, 503]).toContain(bearerRes.status);
    expect([400, 402, 503]).toContain(headerRes.status);
    expect(bearerRes.body?.error?.type).not.toBe('authentication_error');
    expect(headerRes.body?.error?.type).not.toBe('authentication_error');

    const missingAuthRes = await request(app)
      .post('/v1/chat/completions')
      .send({ model: 'x', messages: [{ role: 'user', content: 'hello' }] });
    expect(missingAuthRes.status).toBe(401);
    expect(missingAuthRes.body?.error).toMatchObject({
      type: 'authentication_error',
      code: 'auth_missing',
    });
  });
});
