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

  test('falls back when model_registry.parameter_count column is missing', async () => {
    mockDb.all
      .mockImplementationOnce(() => {
        const err = new Error('no such column: parameter_count');
        throw err;
      })
      .mockImplementationOnce(() => ([
        {
          id: 1,
          model_id: 'fallback-model',
          display_name: 'Fallback Model',
          context_window: 4096,
          min_gpu_vram_gb: 8,
          use_cases: '[]',
        },
      ]));

    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('fallback-model');
    expect(res.body.data[0]).toHaveProperty('parameter_count', null);
    expect(mockDb.all).toHaveBeenCalledTimes(2);
  });
});
