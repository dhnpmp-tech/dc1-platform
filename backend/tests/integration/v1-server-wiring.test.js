const http = require('http');
const crypto = require('crypto');
const request = require('supertest');

process.env.ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT = '1';

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

describe('server /v1 wiring', () => {
  let db;
  let app;
  let providerServer;
  let intervalSpy;
  let errorSpy;
  let renterKey;

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
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    db = require('../../src/db');
    app = require('../../src/server');

    renterKey = `plain-bearer-${crypto.randomBytes(6).toString('hex')}`;
    const providerResponse = {
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      model: 'server-wiring-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'mounted v1 router works' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    };

    providerServer = await startMockProvider(providerResponse);
    const { port } = providerServer.address();

    db.run(
      `INSERT INTO renters (name, email, api_key, status, balance_halala, total_spent_halala, total_jobs, created_at)
       VALUES (?, ?, ?, 'active', 9999999, 0, 0, datetime('now'))`,
      'Server Wiring Renter',
      'wiring@test.com',
      renterKey
    );

    db.run(
      `INSERT INTO providers (name, email, api_key, gpu_model, vram_gb, gpu_vram_mib,
         approval_status, status, supported_compute_types, vllm_endpoint_url, last_heartbeat, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'approved', 'online', '["inference"]', ?, datetime('now'), datetime('now'), datetime('now'))`,
      'Server Wiring Provider',
      'provider-wiring@test.com',
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
      'server-wiring-model',
      'Server Wiring Model',
      'test',
      8,
      'fp16',
      4096,
      '[]',
      4,
      20
    );
  });

  afterEach(async () => {
    intervalSpy.mockRestore();
    errorSpy.mockRestore();
    if (providerServer) {
      await new Promise((resolve) => providerServer.close(resolve));
    }
  });

  test('POST /v1/chat/completions accepts a plain bearer key through real server wiring', async () => {
    const res = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${renterKey}`)
      .send({
        model: 'server-wiring-model',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 32,
      });

    expect(res.status).toBe(200);
    expect(res.body.choices?.[0]?.message?.content).toBe('mounted v1 router works');

    const ipv6LimiterValidationLogged = errorSpy.mock.calls.some((call) =>
      call.some((entry) => String(entry).includes('ERR_ERL_KEY_GEN_IPV6'))
    );
    expect(ipv6LimiterValidationLogged).toBe(false);
  });
});
