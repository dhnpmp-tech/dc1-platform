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

  test('handles legacy schema that does not include parameter_count', async () => {
    mockDb.all
      .mockImplementationOnce(() => ([
        { name: 'id' },
        { name: 'model_id' },
        { name: 'display_name' },
        { name: 'context_window' },
        { name: 'min_gpu_vram_gb' },
        { name: 'use_cases' },
        { name: 'is_active' },
      ]))
      .mockImplementationOnce(() => ([
        {
          model_id: 'legacy-model',
          display_name: 'Legacy Model',
          context_window: 4096,
          min_gpu_vram_gb: 8,
          use_cases: '[]',
          parameter_count: null,
        },
      ]));

    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('legacy-model');
    expect(res.body.data[0]).toHaveProperty('parameter_count', null);
    expect(mockDb.all).toHaveBeenCalledTimes(2);
    expect(mockDb.all.mock.calls[1][0]).toContain('NULL AS parameter_count');
  });

  test('returns 500 when schema is missing required model_id', async () => {
    mockDb.all.mockImplementationOnce(() => ([{ name: 'display_name' }]));

    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Failed to fetch model list');
  });
});
