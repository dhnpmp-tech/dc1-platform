'use strict';

const Database = require('better-sqlite3');
const express = require('express');
const request = require('supertest');

jest.mock('../middleware/rateLimiter', () => ({
  vllmCompleteLimiter: (req, res, next) => next(),
  vllmStreamLimiter: (req, res, next) => next(),
}));

jest.mock('../db', () => ({
  get: (...args) => global.__testDb.prepare(args[0]).get(...args.slice(1)),
  all: (...args) => global.__testDb.prepare(args[0]).all(...args.slice(1)),
  prepare: (...args) => global.__testDb.prepare(...args),
}));

function buildDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE renters (
      id INTEGER PRIMARY KEY,
      api_key TEXT NOT NULL,
      balance_halala INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      updated_at TEXT
    );
    CREATE TABLE renter_api_keys (
      id INTEGER PRIMARY KEY,
      renter_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      scopes TEXT,
      expires_at TEXT,
      revoked_at TEXT
    );
    CREATE TABLE providers (
      id INTEGER PRIMARY KEY,
      status TEXT,
      is_paused INTEGER,
      deleted_at TEXT,
      last_heartbeat TEXT,
      supported_compute_types TEXT,
      vram_mb INTEGER,
      vram_gb REAL,
      gpu_util_pct REAL,
      vllm_endpoint_url TEXT
    );
    CREATE TABLE model_registry (
      id INTEGER PRIMARY KEY,
      model_id TEXT NOT NULL,
      min_gpu_vram_gb INTEGER DEFAULT 0,
      context_window INTEGER DEFAULT 4096,
      is_active INTEGER DEFAULT 1
    );
    CREATE TABLE cost_rates (
      id INTEGER PRIMARY KEY,
      model TEXT NOT NULL,
      token_rate_halala INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1
    );
    CREATE TABLE usage_metering_records (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL UNIQUE,
      renter_id INTEGER NOT NULL,
      provider_id INTEGER,
      model TEXT NOT NULL,
      usage_source TEXT NOT NULL DEFAULT 'openrouter_v1',
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      token_rate_halala INTEGER NOT NULL DEFAULT 0,
      billed_halala INTEGER NOT NULL DEFAULT 0,
      usage_unit TEXT NOT NULL DEFAULT 'token',
      currency TEXT NOT NULL DEFAULT 'SAR',
      raw_usage_json TEXT,
      normalized_usage_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();
  db.prepare('INSERT INTO renters (id, api_key, balance_halala, status) VALUES (?, ?, ?, ?)')
    .run(1, 'dc1-renter-test-key', 10000, 'active');
  db.prepare(
    `INSERT INTO providers
      (id, status, is_paused, deleted_at, last_heartbeat, supported_compute_types, vram_mb, gpu_util_pct, vllm_endpoint_url)
     VALUES (?, 'online', 0, NULL, ?, '["inference"]', 24576, 10, ?)`
  ).run(7, now, 'http://provider.local');
  db.prepare('INSERT INTO model_registry (model_id, min_gpu_vram_gb, context_window, is_active) VALUES (?, ?, ?, 1)')
    .run('meta-llama/Meta-Llama-3-8B-Instruct', 1, 8192);
  db.prepare('INSERT INTO cost_rates (model, token_rate_halala, is_active) VALUES (?, ?, 1)')
    .run('__default__', 3);

  return db;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/v1', require('../routes/v1'));
  return app;
}

describe('v1 usage metering normalization', () => {
  let app;

  beforeEach(() => {
    global.__testDb = buildDb();
    app = buildApp();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.__testDb.close();
    jest.restoreAllMocks();
    delete global.fetch;
  });

  test('persists normalized metering with provider/model and settlement-safe integers', async () => {
    global.__testDb
      .prepare('INSERT INTO cost_rates (model, token_rate_halala, is_active) VALUES (?, ?, 1)')
      .run('meta-llama/Meta-Llama-3-8B-Instruct', 2);

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-meter-001',
        choices: [{ message: { content: 'hi from provider' } }],
        usage: {
          prompt_tokens: '9',
          completion_tokens: 6,
          total_tokens: 15,
        },
      }),
    });

    const res = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer dc1-renter-test-key')
      .send({
        model: 'meta-llama/Meta-Llama-3-8B-Instruct',
        messages: [{ role: 'user', content: 'hello there' }],
        max_tokens: 64,
      });

    expect(res.status).toBe(200);

    const meter = global.__testDb.prepare('SELECT * FROM usage_metering_records WHERE request_id = ?')
      .get('chatcmpl-meter-001');
    expect(meter).toBeTruthy();
    expect(meter.provider_id).toBe(7);
    expect(meter.model).toBe('meta-llama/Meta-Llama-3-8B-Instruct');
    expect(meter.prompt_tokens).toBe(9);
    expect(meter.completion_tokens).toBe(6);
    expect(meter.total_tokens).toBe(15);
    expect(meter.token_rate_halala).toBe(2);
    expect(meter.billed_halala).toBe(30);
    expect(meter.usage_unit).toBe('token');
    expect(meter.currency).toBe('SAR');

    const renter = global.__testDb.prepare('SELECT balance_halala FROM renters WHERE id = 1').get();
    expect(renter.balance_halala).toBe(9970);
  });

  test('normalizes usage drift when provider only sends total_tokens', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'normalized completion path' } }],
        usage: {
          total_tokens: '20',
        },
      }),
    });

    const res = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer dc1-renter-test-key')
      .send({
        model: 'meta-llama/Meta-Llama-3-8B-Instruct',
        messages: [{ role: 'user', content: 'hello world' }],
        max_tokens: 32,
      });

    expect(res.status).toBe(200);

    const meter = global.__testDb.prepare('SELECT * FROM usage_metering_records LIMIT 1').get();
    expect(meter).toBeTruthy();
    expect(meter.total_tokens).toBe(20);
    expect(meter.prompt_tokens).toBeGreaterThan(0);
    expect(meter.completion_tokens).toBe(20 - meter.prompt_tokens);
    expect(meter.token_rate_halala).toBe(3);
    expect(meter.billed_halala).toBe(60);
  });
});
