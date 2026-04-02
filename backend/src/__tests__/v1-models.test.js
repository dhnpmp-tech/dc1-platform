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
    expect(res.body.data[0].pricing.prompt_tokens).toMatch(/^\d+\.\d{6}$/);
    expect(res.body.data[0].pricing.completion_tokens).toMatch(/^\d+\.\d{6}$/);
    expect(res.body.data[0].pricing.usd_per_minute).toMatch(/^\d+\.\d{6}$/);
    expect(res.body.data[0].pricing.usd_per_1m_input_tokens).toMatch(/^\d+\.\d{6}$/);
    expect(res.body.data[0].pricing.usd_per_1m_output_tokens).toMatch(/^\d+\.\d{6}$/);
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

  test('returns empty list when model_registry exists without model_id column', async () => {
    mockDb.all.mockImplementationOnce(() => ([
      { name: 'display_name' },
      { name: 'family' },
      { name: 'is_active' },
    ]));

    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.data).toEqual([]);
    expect(mockDb.all.mock.calls.some(([sql]) => String(sql).includes('FROM model_registry'))).toBe(false);
  });

  test('falls back to deterministic default token pricing when cost_rates schema is unavailable', async () => {
    mockDb.all
      .mockImplementationOnce(() => ([
        { name: 'model_id' },
        { name: 'display_name' },
        { name: 'is_active' },
      ]))
      .mockImplementationOnce(() => ([
        {
          model_id: 'missing-cost-rate-model',
          display_name: 'Missing Cost Rate Model',
          context_window: 8192,
          parameter_count: null,
        },
      ]))
      .mockImplementationOnce(() => {
        throw new Error('no such table: cost_rates');
      });

    const res = await request(app).get('/v1/models');
    const model = res.body.data[0];

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.data).toHaveLength(1);
    expect(model.pricing).toMatchObject({
      prompt_tokens: '0.002667',
      completion_tokens: '0.002667',
      usd_per_minute: expect.stringMatching(/^\d+\.\d{6}$/),
      usd_per_1m_input_tokens: expect.stringMatching(/^\d+\.\d{6}$/),
      usd_per_1m_output_tokens: expect.stringMatching(/^\d+\.\d{6}$/),
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

  test('chat completions routes low-VRAM Mistral requests to AWQ variant when compatible', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-awq',
        object: 'chat.completion',
        model: 'mistralai/Mistral-7B-Instruct-v0.2-AWQ',
        choices: [{ index: 0, message: { role: 'assistant', content: 'awq route works' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 6, completion_tokens: 5, total_tokens: 11 },
      }),
    });

    mockDb.all.mockImplementation((sql) => {
      if (String(sql).includes('PRAGMA table_info(model_registry)')) {
        return [{ name: 'model_id' }, { name: 'min_gpu_vram_gb' }, { name: 'context_window' }];
      }
      if (String(sql).includes('FROM providers')) {
        return [{
          id: 101,
          status: 'online',
          is_paused: 0,
          deleted_at: null,
          supported_compute_types: '["inference"]',
          vram_gb: 12,
          last_heartbeat: new Date().toISOString(),
          vllm_endpoint_url: 'http://provider.test',
          gpu_util_pct: 2,
        }];
      }
      return [];
    });

    mockDb.get.mockImplementation((sql) => {
      const query = String(sql);
      if (query.includes('FROM renter_api_keys')) return null;
      if (query.includes('FROM renters WHERE api_key')) {
        return { id: 18, api_key: 'test-key', balance_halala: 5000, status: 'active' };
      }
      if (query.includes('FROM model_registry WHERE model_id = ?')) {
        return { model_id: 'mistralai/Mistral-7B-Instruct-v0.2', min_gpu_vram_gb: 20, context_window: 32768 };
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
        model: 'mistralai/Mistral-7B-Instruct-v0.2',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 64,
      });

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [, fetchInit] = fetchSpy.mock.calls[0];
    const providerBody = JSON.parse(fetchInit.body);
    expect(providerBody.model).toBe('mistralai/Mistral-7B-Instruct-v0.2-AWQ');

    fetchSpy.mockRestore();
  });

  test('chat completions routes ALLaM preview alias to compatible 12GB variant', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-allam-alias',
        object: 'chat.completion',
        model: 'BOLT-IS/ALLaM-IT-7B',
        choices: [{ index: 0, message: { role: 'assistant', content: 'allam alias route works' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 6, completion_tokens: 5, total_tokens: 11 },
      }),
    });

    mockDb.all.mockImplementation((sql) => {
      if (String(sql).includes('PRAGMA table_info(model_registry)')) {
        return [{ name: 'model_id' }, { name: 'min_gpu_vram_gb' }, { name: 'context_window' }];
      }
      if (String(sql).includes('FROM providers')) {
        return [{
          id: 102,
          status: 'online',
          is_paused: 0,
          deleted_at: null,
          supported_compute_types: '["inference"]',
          vram_gb: 12,
          last_heartbeat: new Date().toISOString(),
          vllm_endpoint_url: 'http://provider.test',
          gpu_util_pct: 2,
        }];
      }
      return [];
    });

    mockDb.get.mockImplementation((sql) => {
      const query = String(sql);
      if (query.includes('FROM renter_api_keys')) return null;
      if (query.includes('FROM renters WHERE api_key')) {
        return { id: 19, api_key: 'test-key', balance_halala: 5000, status: 'active' };
      }
      if (query.includes('FROM model_registry WHERE model_id = ?')) {
        return { model_id: 'ALLaM-AI/ALLaM-7B-Instruct-preview', min_gpu_vram_gb: 24, context_window: 32768 };
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
        model: 'ALLaM-AI/ALLaM-7B-Instruct-preview',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 64,
      });

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [, fetchInit] = fetchSpy.mock.calls[0];
    const providerBody = JSON.parse(fetchInit.body);
    expect(providerBody.model).toBe('BOLT-IS/ALLaM-IT-7B');

    fetchSpy.mockRestore();
  });

  test('chat completions treats missing supported_compute_types as inference-capable', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-legacy-compute-types',
        object: 'chat.completion',
        model: 'legacy-compute-model',
        choices: [{ index: 0, message: { role: 'assistant', content: 'legacy provider accepted' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 8, completion_tokens: 6, total_tokens: 14 },
      }),
    });

    mockDb.all.mockImplementation((sql) => {
      if (String(sql).includes('PRAGMA table_info(model_registry)')) {
        return [{ name: 'model_id' }, { name: 'min_gpu_vram_gb' }, { name: 'context_window' }];
      }
      if (String(sql).includes('FROM providers')) {
        return [{
          id: 131,
          status: 'online',
          is_paused: 0,
          deleted_at: null,
          supported_compute_types: null,
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
      if (query.includes('FROM renters WHERE api_key')) {
        return { id: 31, api_key: 'test-key', balance_halala: 5000, status: 'active' };
      }
      if (query.includes('FROM model_registry WHERE model_id = ?')) {
        return { model_id: 'legacy-compute-model', min_gpu_vram_gb: 16, context_window: 8192 };
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
        model: 'legacy-compute-model',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 64,
      });

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
  });

  test('chat completions returns no_capacity_available when no providers can satisfy the request', async () => {
    mockDb.all.mockImplementation((sql) => {
      if (String(sql).includes('PRAGMA table_info(model_registry)')) {
        return [{ name: 'model_id' }, { name: 'min_gpu_vram_gb' }, { name: 'context_window' }];
      }
      if (String(sql).includes('FROM providers')) {
        return [];
      }
      return [];
    });

    mockDb.get.mockImplementation((sql) => {
      const query = String(sql);
      if (query.includes('FROM renter_api_keys')) return null;
      if (query.includes('FROM renters WHERE api_key')) {
        return { id: 45, api_key: 'test-key', balance_halala: 5000, status: 'active' };
      }
      if (query.includes('FROM model_registry WHERE model_id = ?')) {
        return { model_id: 'capacity-model', min_gpu_vram_gb: 16, context_window: 8192 };
      }
      return null;
    });

    const res = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-key')
      .send({
        model: 'capacity-model',
        messages: [{ role: 'user', content: 'hello' }],
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({
      type: 'server_error',
      code: 'no_capacity_available',
      status: 503,
      retryable: true,
    });
  });

  test('chat completions returns provider_unavailable when upstream provider HTTP fails', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'upstream unavailable' }),
    });

    mockDb.all.mockImplementation((sql) => {
      if (String(sql).includes('PRAGMA table_info(model_registry)')) {
        return [{ name: 'model_id' }, { name: 'min_gpu_vram_gb' }, { name: 'context_window' }];
      }
      if (String(sql).includes('FROM providers')) {
        return [{
          id: 146,
          status: 'online',
          is_paused: 0,
          deleted_at: null,
          supported_compute_types: '["inference"]',
          vram_gb: 24,
          last_heartbeat: new Date().toISOString(),
          vllm_endpoint_url: 'http://provider.test',
        }];
      }
      return [];
    });

    mockDb.get.mockImplementation((sql) => {
      const query = String(sql);
      if (query.includes('FROM renter_api_keys')) return null;
      if (query.includes('FROM renters WHERE api_key')) {
        return { id: 46, api_key: 'test-key', balance_halala: 5000, status: 'active' };
      }
      if (query.includes('FROM model_registry WHERE model_id = ?')) {
        return { model_id: 'provider-down-model', min_gpu_vram_gb: 4, context_window: 4096 };
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
        model: 'provider-down-model',
        messages: [{ role: 'user', content: 'hello' }],
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({
      type: 'upstream_error',
      code: 'provider_unavailable',
      status: 503,
      retryable: true,
    });

    fetchSpy.mockRestore();
  });

  test('chat completions returns upstream_timeout when upstream fetch times out', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(
      Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    );

    mockDb.all.mockImplementation((sql) => {
      if (String(sql).includes('PRAGMA table_info(model_registry)')) {
        return [{ name: 'model_id' }, { name: 'min_gpu_vram_gb' }, { name: 'context_window' }];
      }
      if (String(sql).includes('FROM providers')) {
        return [{
          id: 147,
          status: 'online',
          is_paused: 0,
          deleted_at: null,
          supported_compute_types: '["inference"]',
          vram_gb: 24,
          last_heartbeat: new Date().toISOString(),
          vllm_endpoint_url: 'http://provider-timeout.test',
        }];
      }
      return [];
    });

    mockDb.get.mockImplementation((sql) => {
      const query = String(sql);
      if (query.includes('FROM renter_api_keys')) return null;
      if (query.includes('FROM renters WHERE api_key')) {
        return { id: 47, api_key: 'test-key', balance_halala: 5000, status: 'active' };
      }
      if (query.includes('FROM model_registry WHERE model_id = ?')) {
        return { model_id: 'provider-timeout-model', min_gpu_vram_gb: 4, context_window: 4096 };
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
        model: 'provider-timeout-model',
        messages: [{ role: 'user', content: 'hello' }],
      });

    expect(res.status).toBe(504);
    expect(res.body.error).toMatchObject({
      type: 'timeout_error',
      code: 'upstream_timeout',
      status: 504,
      retryable: true,
    });

    fetchSpy.mockRestore();
  });

  test('models route returns provider_unavailable envelope when model query fails unexpectedly', async () => {
    mockDb.all.mockImplementation((sql) => {
      if (String(sql).includes('PRAGMA table_info(model_registry)')) {
        throw new Error('forced schema failure');
      }
      return [];
    });

    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({
      type: 'server_error',
      code: 'provider_unavailable',
      status: 503,
      retryable: true,
    });
  });

});
