const http = require('http');
const crypto = require('crypto');
const request = require('supertest');

process.env.ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT = '1';
process.env.DISABLE_RATE_LIMIT = '0';

jest.mock('../../src/services/jobSweep', () => ({
  startJobSweep: jest.fn(),
  getSweepMetrics: jest.fn(() => ({})),
  startProviderOfflineSweep: jest.fn(),
}));
jest.mock('../../src/workers/providerHealthWorker', () => ({
  startProviderHealthWorker: jest.fn(),
}));
jest.mock('../../src/services/controlPlane', () => ({
  runControlPlaneCycle: jest.fn(),
}));
jest.mock('../../src/services/notifications', () => ({
  sendAlert: jest.fn(),
}));
jest.mock('../../src/services/recovery-engine', () => ({
  runRecoveryCycle: jest.fn(),
}));
jest.mock('../../src/services/fallback-loop', () => ({
  startLoop: jest.fn(),
}));
jest.mock('../../src/services/providerLivenessMonitor', () => ({
  start: jest.fn(),
}));
jest.mock('../../src/services/cleanup', () => ({
  schedule: jest.fn(),
}));

describe('/v1 limiter contract', () => {
  let db;
  let app;
  let providerServer;
  let intervalSpy;

  function startMockProvider(responseBody) {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'not found' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseBody));
      });
      server.listen(0, '127.0.0.1', () => resolve(server));
      server.on('error', reject);
    });
  }

  beforeEach(async () => {
    jest.resetModules();
    intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => 0);
    db = require('../../src/db');
    app = require('../../src/server');

    const renterKey = `rate-limit-renter-${crypto.randomBytes(8).toString('hex')}`;
    const providerResponse = {
      id: 'chatcmpl-rate-limit',
      object: 'chat.completion',
      model: 'rate-limit-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
    };
    providerServer = await startMockProvider(providerResponse);
    const { port } = providerServer.address();

    db.run(
      `INSERT INTO renters (name, email, api_key, status, balance_halala, total_spent_halala, total_jobs, created_at)
       VALUES (?, ?, ?, 'active', 9999999, 0, 0, datetime('now'))`,
      'Limiter Renter',
      'ratelimit@test.com',
      renterKey
    );

    db.run(
      `INSERT INTO providers (name, email, api_key, gpu_model, vram_gb, gpu_vram_mib,
         approval_status, status, supported_compute_types, vllm_endpoint_url, last_heartbeat, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'approved', 'online', '["inference"]', ?, datetime('now'), datetime('now'), datetime('now'))`,
      'Limiter Provider',
      'provider-ratelimit@test.com',
      `provider-${crypto.randomBytes(6).toString('hex')}`,
      'RTX 4090',
      24,
      24576,
      `http://127.0.0.1:${port}`
    );

    db.run(
      `INSERT OR REPLACE INTO model_registry
       (model_id, display_name, family, vram_gb, quantization, context_window, use_cases,
        min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      'rate-limit-model',
      'Rate Limit Model',
      'test',
      8,
      'fp16',
      4096,
      '[]',
      20,
      20
    );

    app.locals.renterKey = renterKey;
  });

  afterEach(async () => {
    intervalSpy.mockRestore();
    if (providerServer) {
      await new Promise((resolve) => providerServer.close(resolve));
    }
  });

  test('returns OpenAI-compatible 429 payload with stable retry metadata when threshold is exceeded', async () => {
    const renterKey = app.locals.renterKey;
    const payload = {
      model: 'rate-limit-model',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 16,
    };

    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${renterKey}`)
        .send(payload);
      expect(res.status).toBe(200);
    }

    const limited = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${renterKey}`)
      .send(payload);

    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({
      error: {
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded',
      },
    });
    expect(typeof limited.body.error.message).toBe('string');
    expect(Number.isInteger(limited.body.retry_after_seconds)).toBe(true);
    expect(limited.body.retry_after_seconds).toBeGreaterThan(0);
    expect(limited.body.retry_after_ms).toBe(limited.body.retry_after_seconds * 1000);
    expect(limited.headers['retry-after']).toBe(String(limited.body.retry_after_seconds));
  });
});
