'use strict';

process.env.DC1_DB_PATH = process.env.DC1_DB_PATH || ':memory:';

const { runRuntimeRouteParityMonitor } = require('../services/runtimeRouteParityMonitor');

function makeResponse(status, jsonBody, contentType = 'application/json') {
  return {
    status,
    headers: {
      get(name) {
        if (String(name).toLowerCase() === 'content-type') return contentType;
        return null;
      },
    },
    async text() {
      return JSON.stringify(jsonBody);
    },
  };
}

describe('runtimeRouteParityMonitor', () => {
  test('passes when runtime responses satisfy route contracts', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(200, {
        object: 'list',
        data: [],
        total: 0,
        generated_at: new Date().toISOString(),
      }))
      .mockResolvedValueOnce(makeResponse(200, {
        object: 'list',
        data: [],
      }))
      .mockResolvedValueOnce(makeResponse(401, {
        error: { message: 'API key required', code: 401 },
      }));

    const result = await runRuntimeRouteParityMonitor({
      baseUrl: 'https://runtime.example',
      outputDir: 'backend/tmp/runtime-parity-tests/pass',
      fetchImpl: fetchMock,
      routeDefinitions: [
        {
          id: 'catalog',
          mountPath: '/api/providers',
          routePath: '/model-catalog',
          method: 'GET',
          runtimePath: '/api/providers/model-catalog',
          router: { stack: [{ route: { path: '/model-catalog', methods: { get: true } } }] },
          expectedStatus: 200,
          expectedContentTypeIncludes: 'application/json',
          requestBody: null,
          validateBody: (json) => {
            const mismatches = [];
            if (json.object !== 'list') mismatches.push('object mismatch');
            if (!Array.isArray(json.data)) mismatches.push('data mismatch');
            if (typeof json.total !== 'number') mismatches.push('total mismatch');
            if (typeof json.generated_at !== 'string') mismatches.push('generated_at mismatch');
            return mismatches;
          },
        },
        {
          id: 'models',
          mountPath: '/v1',
          routePath: '/models',
          method: 'GET',
          runtimePath: '/v1/models',
          router: { stack: [{ route: { path: '/models', methods: { get: true } } }] },
          expectedStatus: 200,
          expectedContentTypeIncludes: 'application/json',
          requestBody: null,
          validateBody: (json) => {
            const mismatches = [];
            if (json.object !== 'list') mismatches.push('object mismatch');
            if (!Array.isArray(json.data)) mismatches.push('data mismatch');
            return mismatches;
          },
        },
        {
          id: 'chat-auth',
          mountPath: '/v1',
          routePath: '/chat/completions',
          method: 'POST',
          runtimePath: '/v1/chat/completions',
          router: { stack: [{ route: { path: '/chat/completions', methods: { post: true } } }] },
          expectedStatus: 401,
          expectedContentTypeIncludes: 'application/json',
          requestBody: { model: 'x', messages: [{ role: 'user', content: 'x' }] },
          validateBody: (json) => {
            const mismatches = [];
            if (typeof json.error?.message !== 'string') mismatches.push('message mismatch');
            if (typeof json.error?.code !== 'number') mismatches.push('code mismatch');
            return mismatches;
          },
        },
      ],
    });

    expect(result.report.summary.failed).toBe(0);
    expect(result.report.summary.status).toBe('pass');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('fails when route is missing in code and runtime status mismatches', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(makeResponse(404, { error: 'not found' }));

    const result = await runRuntimeRouteParityMonitor({
      baseUrl: 'https://runtime.example',
      outputDir: 'backend/tmp/runtime-parity-tests/fail',
      fetchImpl: fetchMock,
      routeDefinitions: [
        {
          id: 'catalog',
          mountPath: '/api/providers',
          routePath: '/model-catalog',
          method: 'GET',
          runtimePath: '/api/providers/model-catalog',
          router: { stack: [] },
          expectedStatus: 200,
          expectedContentTypeIncludes: 'application/json',
          requestBody: null,
          validateBody: () => [],
        },
      ],
    });

    expect(result.report.summary.failed).toBe(1);
    expect(result.report.summary.status).toBe('fail');
    expect(result.report.routes[0].mismatches).toEqual(
      expect.arrayContaining([
        'route missing in code router stack',
        'status mismatch: expected 200, got 404',
      ])
    );
  });
});
