const express = require('express');
const request = require('supertest');
const { Readable } = require('stream');

const mockDb = {
  all: jest.fn(),
  get: jest.fn(),
  prepare: jest.fn(() => ({ run: jest.fn() })),
};
const mockRecordOpenRouterUsage = jest.fn(() => ({ id: 'oru_stream_test' }));

jest.mock('../db', () => mockDb);
jest.mock('../middleware/rateLimiter', () => ({
  vllmCompleteLimiter: (req, res, next) => next(),
  vllmStreamLimiter: (req, res, next) => next(),
}));
jest.mock('../services/openrouterSettlementService', () => ({
  recordOpenRouterUsage: (...args) => mockRecordOpenRouterUsage(...args),
}));

describe('v1 chat metering ledger persistence', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    mockDb.all.mockReset();
    mockDb.get.mockReset();
    mockDb.prepare.mockReset().mockReturnValue({ run: jest.fn() });
    mockRecordOpenRouterUsage.mockReset();

    const router = require('../routes/v1');
    app = express();
    app.use(express.json());
    app.use('/v1', router);
  });

  test('persists streamed completion usage exactly once with request id', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: Readable.from([
        'data: {"id":"chatcmpl-stream-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"}}]}\n\n',
        'data: {"id":"chatcmpl-stream-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":11,"completion_tokens":7,"total_tokens":18}}\n\n',
        'data: [DONE]\n\n',
      ]),
    });

    mockDb.all.mockImplementation((sql) => {
      const query = String(sql);
      if (query.includes('PRAGMA table_info(model_registry)')) {
        return [{ name: 'model_id' }, { name: 'min_gpu_vram_gb' }, { name: 'context_window' }];
      }
      if (query.includes('FROM providers')) {
        return [{
          id: 55,
          status: 'online',
          is_paused: 0,
          deleted_at: null,
          supported_compute_types: '["inference"]',
          vram_gb: 24,
          last_heartbeat: new Date().toISOString(),
          vllm_endpoint_url: 'http://provider.test',
          gpu_util_pct: 1,
        }];
      }
      return [];
    });

    mockDb.get.mockImplementation((sql) => {
      const query = String(sql);
      if (query.includes('FROM renter_api_keys')) return null;
      if (query.includes('FROM renters WHERE api_key')) return { id: 7, api_key: 'test-key', balance_halala: 50000, status: 'active' };
      if (query.includes('FROM model_registry WHERE model_id = ?')) return { model_id: 'stream-model', min_gpu_vram_gb: 8, context_window: 4096 };
      if (query.includes('FROM cost_rates')) return { token_rate_halala: 2 };
      return null;
    });

    const res = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-key')
      .set('Idempotency-Key', 'req-stream-123')
      .send({
        model: 'stream-model',
        stream: true,
        messages: [{ role: 'user', content: 'hello stream' }],
      });

    expect(res.status).toBe(200);
    expect(res.text).toContain('data: [DONE]');
    expect(res.text).toContain('"pricing":{"currency":"USD","usd_prompt":"0.058667","usd_completion":"0.037333","usd_total":"0.096000"}');
    expect(mockRecordOpenRouterUsage).toHaveBeenCalledTimes(1);
    const payload = mockRecordOpenRouterUsage.mock.calls[0][1];
    expect(payload.requestId).toBe('req-stream-123');
    expect(payload.providerId).toBe(55);
    expect(payload.providerResponseId).toBe('chatcmpl-stream-1');
    expect(payload.promptTokens).toBe(11);
    expect(payload.completionTokens).toBe(7);
    expect(payload.totalTokens).toBe(18);
    expect(payload.costHalala).toBe(36);

    fetchSpy.mockRestore();
  });
});
