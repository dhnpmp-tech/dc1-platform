const express = require('express');
const request = require('supertest');

const mockDb = {
  all: jest.fn(),
  get: jest.fn(),
  prepare: jest.fn(() => ({ run: jest.fn() })),
};
const mockRecordOpenRouterUsage = jest.fn(() => ({ id: 'oru_test' }));

jest.mock('../db', () => mockDb);
jest.mock('../middleware/rateLimiter', () => ({
  vllmCompleteLimiter: (req, res, next) => next(),
  vllmStreamLimiter: (req, res, next) => next(),
}));
jest.mock('../services/openrouterSettlementService', () => ({
  recordOpenRouterUsage: (...args) => mockRecordOpenRouterUsage(...args),
}));

describe('v1 models route', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    mockDb.all.mockReset();
    mockDb.get.mockReset();
    mockRecordOpenRouterUsage.mockReset();

    const router = require('../routes/v1');
    app = express();
    app.use(express.json());
    app.use('/v1', router);
  });

  test('returns model list when parameter_count column is missing', async () => {
    mockDb.all
      .mockImplementationOnce(() => ([
        { name: 'model_id' },
        { name: 'display_name' },
        { name: 'family' },
        { name: 'context_window' },
        { name: 'min_gpu_vram_gb' },
        { name: 'use_cases' },
        { name: 'is_active' },
      ]))
      .mockImplementationOnce(() => ([
        {
          model_id: 'fallback-model',
          display_name: 'Fallback Model',
          family: 'mistral',
          context_window: 4096,
          min_gpu_vram_gb: 8,
          use_cases: '[]',
        },
      ]))
      .mockImplementationOnce(() => ([
        { model: '__default__', token_rate_halala: 2 },
      ]));

    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('fallback-model');
    expect(res.body.data[0]).toHaveProperty('parameter_count', null);
    expect(res.body.data[0].pricing).toEqual({
      prompt_tokens: expect.any(String),
      completion_tokens: expect.any(String),
      usd_per_minute: expect.any(String),
      usd_per_1m_input_tokens: expect.any(String),
      usd_per_1m_output_tokens: expect.any(String),
    });
    expect(res.body.data[0].description).toEqual(expect.any(String));
    expect(res.body.data[0].architecture).toEqual({
      tokenizer: 'mistral',
      instruct_type: 'instruct',
      modality: 'text',
    });
    expect(res.body.data[0].endpoints).toEqual([
      { url: expect.stringMatching(/\/v1\/chat\/completions$/), type: 'chat' },
    ]);
    expect(res.body.data[0].provider_priority).toEqual(['dcp']);
    expect(typeof res.body.data[0].pricing.usd_per_minute).toBe('string');
    expect(mockDb.all).toHaveBeenCalledTimes(3);
  });

  test('fills safe defaults for legacy model_registry schemas', async () => {
    mockDb.all
      .mockImplementationOnce(() => ([
        { name: 'model_id' },
        { name: 'vram_gb' },
      ]))
      .mockImplementationOnce(() => ([
        {
          model_id: 'legacy-model',
          min_gpu_vram_gb: 24,
          display_name: 'legacy-model',
          context_window: 4096,
          parameter_count: null,
        },
      ]))
      .mockImplementationOnce(() => ([
        { model: '__default__', token_rate_halala: 1 },
      ]));

    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('legacy-model');
    expect(res.body.data[0].display_name).toBe('legacy-model');
    expect(res.body.data[0].context_window).toBe(4096);
    expect(res.body.data[0].parameter_count).toBeNull();
    expect(res.body.data[0].pricing).toEqual({
      prompt_tokens: expect.any(String),
      completion_tokens: expect.any(String),
      usd_per_minute: expect.any(String),
      usd_per_1m_input_tokens: expect.any(String),
      usd_per_1m_output_tokens: expect.any(String),
    });
    expect(res.body.data[0].architecture).toEqual({
      tokenizer: 'dcp',
      instruct_type: 'instruct',
      modality: 'text',
    });
  });

  test('returns empty list when model_registry table is missing', async () => {
    mockDb.all.mockImplementation((sql) => {
      if (String(sql).includes('PRAGMA table_info(model_registry)')) {
        const err = new Error('no such table: model_registry');
        throw err;
      }
      return [];
    });

    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.data).toEqual([]);
    expect(mockDb.all.mock.calls.some(([sql]) => String(sql).includes('FROM model_registry'))).toBe(false);
  });

  test('retries schema introspection after missing-table response and recovers', async () => {
    let pragmaCalls = 0;
    mockDb.all.mockImplementation((sql) => {
      const query = String(sql);
      if (query.includes('PRAGMA table_info(model_registry)')) {
        pragmaCalls += 1;
        if (pragmaCalls === 1) {
          const err = new Error('no such table: model_registry');
          throw err;
        }
        return [
          { name: 'model_id' },
          { name: 'display_name' },
          { name: 'parameter_count' },
          { name: 'is_active' },
        ];
      }
      if (query.includes('FROM model_registry')) {
        if (pragmaCalls === 1) {
          const err = new Error('no such table: model_registry');
          throw err;
        }
        return [{
          model_id: 'recovered-model',
          display_name: 'Recovered Model',
          context_window: 4096,
          parameter_count: 12345,
        }];
      }
      return [];
    });

    const first = await request(app).get('/v1/models');
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual([]);

    const second = await request(app).get('/v1/models');
    expect(second.status).toBe(200);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.data[0].id).toBe('recovered-model');
    expect(second.body.data[0].parameter_count).toBe(12345);
  });

  test('chat completions resolves legacy vram_gb-only model_registry schema', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-legacy',
        object: 'chat.completion',
        model: 'legacy-chat-model',
        choices: [{ index: 0, message: { role: 'assistant', content: 'legacy schema works' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 },
      }),
    });

    mockDb.all.mockImplementation((sql) => {
      if (String(sql).includes('PRAGMA table_info(model_registry)')) {
        return [{ name: 'model_id' }, { name: 'vram_gb' }];
      }
      if (String(sql).includes('FROM providers')) {
        return [{
          id: 99,
          status: 'online',
          is_paused: 0,
          deleted_at: null,
          supported_compute_types: '["inference"]',
          vram_gb: 24,
          last_heartbeat: new Date().toISOString(),
          vllm_endpoint_url: 'http://provider.test',
          gpu_util_pct: 10,
        }];
      }
      return [];
    });

    mockDb.get.mockImplementation((sql) => {
      const query = String(sql);
      if (query.includes('FROM renter_api_keys')) return null;
      if (query.includes('FROM renters WHERE api_key')) {
        return { id: 7, api_key: 'test-key', balance_halala: 5000, status: 'active' };
      }
      if (query.includes('FROM model_registry WHERE model_id = ?')) {
        return { model_id: 'legacy-chat-model', min_gpu_vram_gb: 20, context_window: 4096 };
      }
      if (query.includes('FROM cost_rates')) {
        return { token_rate_halala: 1 };
      }
      return null;
    });

    const res = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-key')
      .send({
        model: 'legacy-chat-model',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 64,
      });

    expect(res.status).toBe(200);
    expect(res.body.model).toBe('legacy-chat-model');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mockRecordOpenRouterUsage).toHaveBeenCalledTimes(1);
    expect(mockDb.get.mock.calls.some(([sql]) => String(sql).includes('vram_gb AS min_gpu_vram_gb'))).toBe(true);
    expect(res.body.usage.pricing).toEqual({
      currency: 'USD',
      usd_prompt: expect.any(String),
      usd_completion: expect.any(String),
      usd_total: expect.any(String),
    });
    expect(typeof res.body.usage.pricing.usd_total).toBe('string');

    fetchSpy.mockRestore();
  });

  test('chat completions falls back to requested model when model_registry table is missing', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-no-table',
        object: 'chat.completion',
        model: 'requested-model',
        choices: [{ index: 0, message: { role: 'assistant', content: 'fallback works' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
      }),
    });

    mockDb.all.mockImplementation((sql) => {
      if (String(sql).includes('PRAGMA table_info(model_registry)')) {
        const err = new Error('no such table: model_registry');
        throw err;
      }
      if (String(sql).includes('FROM providers')) {
        return [{
          id: 77,
          status: 'online',
          is_paused: 0,
          deleted_at: null,
          supported_compute_types: '["inference"]',
          vram_gb: 24,
          last_heartbeat: new Date().toISOString(),
          vllm_endpoint_url: 'http://provider.test',
          gpu_util_pct: 5,
        }];
      }
      return [];
    });

    mockDb.get.mockImplementation((sql) => {
      const query = String(sql);
      if (query.includes('FROM renter_api_keys')) return null;
      if (query.includes('FROM renters WHERE api_key')) {
        return { id: 8, api_key: 'test-key', balance_halala: 5000, status: 'active' };
      }
      if (query.includes('FROM model_registry WHERE model_id = ?')) {
        const err = new Error('no such table: model_registry');
        throw err;
      }
      if (query.includes('FROM cost_rates')) {
        return { token_rate_halala: 1 };
      }
      return null;
    });

    const res = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-key')
      .send({
        model: 'requested-model',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 64,
      });

    expect(res.status).toBe(200);
    expect(res.body.model).toBe('requested-model');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mockRecordOpenRouterUsage).toHaveBeenCalledTimes(1);
    expect(mockDb.get.mock.calls.some(([sql]) => String(sql).includes('FROM model_registry WHERE model_id = ?'))).toBe(false);
    expect(res.body.usage.pricing).toEqual({
      currency: 'USD',
      usd_prompt: expect.any(String),
      usd_completion: expect.any(String),
      usd_total: expect.any(String),
    });
    expect(typeof res.body.usage.pricing.usd_total).toBe('string');

    fetchSpy.mockRestore();
  });
});
