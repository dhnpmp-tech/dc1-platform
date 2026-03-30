const express = require('express');
const request = require('supertest');

const mockDb = {
  all: jest.fn(),
  get: jest.fn(),
  prepare: jest.fn(() => ({ run: jest.fn() })),
};

jest.mock('../db', () => mockDb);
jest.mock('../middleware/rateLimiter', () => ({
  vllmCompleteLimiter: (req, res, next) => next(),
  vllmStreamLimiter: (req, res, next) => next(),
}));

describe('v1 models route', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    mockDb.all.mockReset();
    mockDb.get.mockReset();

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
        { name: 'context_window' },
        { name: 'min_gpu_vram_gb' },
        { name: 'use_cases' },
        { name: 'is_active' },
      ]))
      .mockImplementationOnce(() => ([
        {
          model_id: 'fallback-model',
          display_name: 'Fallback Model',
          context_window: 4096,
          min_gpu_vram_gb: 8,
          default_price_halala_per_min: 20,
          created_at: '2026-03-30T00:00:00.000Z',
          use_cases: '[]',
        },
      ]));

    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('fallback-model');
    expect(res.body.data[0].root).toBe('fallback-model');
    expect(res.body.data[0].name).toBe('Fallback Model');
    expect(res.body.data[0].created).toBe(1774828800);
    expect(res.body.data[0].pricing).toEqual({
      usd_per_minute: '0.053333',
      usd_per_1m_input_tokens: '0.053333',
      usd_per_1m_output_tokens: '0.053333',
    });
    expect(res.body.data[0]).toHaveProperty('parameter_count', null);
    expect(mockDb.all).toHaveBeenCalledTimes(2);
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
          default_price_halala_per_min: null,
          created_at: null,
        },
      ]));

    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('legacy-model');
    expect(res.body.data[0].display_name).toBe('legacy-model');
    expect(res.body.data[0].context_window).toBe(4096);
    expect(res.body.data[0].parameter_count).toBeNull();
    expect(res.body.data[0].created).toBe(0);
    expect(res.body.data[0].pricing).toEqual({
      usd_per_minute: '0.000000',
      usd_per_1m_input_tokens: '0.000000',
      usd_per_1m_output_tokens: '0.000000',
    });
  });

  test('returns empty list when model_registry table is missing', async () => {
    mockDb.all.mockImplementation((sql) => {
      if (String(sql).includes('PRAGMA table_info(model_registry)')) {
        const err = new Error('no such table: model_registry');
        throw err;
      }
      if (String(sql).includes('FROM model_registry')) {
        const err = new Error('no such table: model_registry');
        throw err;
      }
      return [];
    });

    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.data).toEqual([]);
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
    expect(mockDb.get.mock.calls.some(([sql]) => String(sql).includes('vram_gb AS min_gpu_vram_gb'))).toBe(true);

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

    fetchSpy.mockRestore();
  });
});
