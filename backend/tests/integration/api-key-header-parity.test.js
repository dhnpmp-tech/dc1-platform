'use strict';

const request = require('supertest');
const express = require('express');

const providerFixture = {
  id: 101,
  name: 'Header Provider',
  status: 'online',
  gpu_model: 'RTX 4090',
  gpu_vram_mib: 24576,
  run_mode: 'always-on',
  scheduled_start: '23:00',
  scheduled_end: '07:00',
  total_earnings: 0,
  total_jobs: 0,
  is_paused: 0,
  api_key: 'dc1-provider-header-test',
};

const renterFixture = {
  id: 201,
  name: 'Header Renter',
  email: 'renter-header@dcp.test',
  organization: 'QA',
  status: 'active',
  balance_halala: 1000,
  total_spent_halala: 0,
  total_jobs: 0,
  created_at: new Date().toISOString(),
  api_key: 'dc1-renter-header-test',
};

const mockDb = {
  all: jest.fn((sql) => {
    const q = String(sql || '');
    if (q.includes('PRAGMA table_info')) return [];
    if (q.includes('FROM jobs WHERE provider_id')) return [];
    if (q.includes('FROM jobs WHERE renter_id')) return [];
    return [];
  }),
  get: jest.fn((sql, ...params) => {
    const q = String(sql || '');
    const key = Array.isArray(params[0]) ? params[0][0] : params[0];

    if (q.includes('FROM providers WHERE api_key')) {
      return key === providerFixture.api_key ? providerFixture : null;
    }

    if (q.includes('SUM(provider_earned_halala)')) return { total: 0 };
    if (q.includes("FROM jobs WHERE provider_id = ? AND status = 'running'")) return null;

    if (q.includes('FROM renters WHERE api_key = ? AND status = ?')) {
      return key === renterFixture.api_key ? renterFixture : null;
    }

    return null;
  }),
  run: jest.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  prepare: jest.fn((sql) => ({
    run: (...args) => mockDb.run(sql, ...args),
    get: (...args) => mockDb.get(sql, ...args),
    all: (...args) => mockDb.all(sql, ...args),
  })),
};

jest.mock('../../src/db', () => mockDb);
jest.mock('../../src/routes/jobs', () => ({
  COST_RATES: {
    llm_inference: 15,
    training: 25,
    rendering: 20,
    default: 10,
  },
}));
jest.mock('../../src/services/notifications', () => ({ sendAlert: jest.fn() }));
jest.mock('../../src/services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendJobStarted: jest.fn().mockResolvedValue(undefined),
  sendJobCompleted: jest.fn().mockResolvedValue(undefined),
  sendJobFailed: jest.fn().mockResolvedValue(undefined),
  sendDataExportReady: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/p2p-discovery', () => ({
  announceFromProviderHeartbeat: jest.fn().mockResolvedValue(undefined),
  getDiscoveryStatus: jest.fn(() => ({ mode: 'sqlite' })),
  resolveProviders: jest.fn(() => []),
  listProviders: jest.fn(() => []),
}));
jest.mock('../../src/services/benchmarkRunner', () => ({ getBenchmarkResult: jest.fn(() => null) }));
jest.mock('../../src/services/job-execution-logs', () => ({
  appendAttemptLogLines: jest.fn(),
  appendAttemptRawText: jest.fn(),
  getAttemptLogPath: jest.fn(() => '/tmp/job.log'),
}));
jest.mock('../../src/services/escrow-chain', () => ({ getChainEscrow: jest.fn(() => null) }));
jest.mock('../../src/services/renter-identity-reconciliation', () => ({
  reconcileRenterByEmailFromSupabase: jest.fn().mockResolvedValue(null),
}));

function createApp() {
  const app = express();
  app.use(express.json());

  const providersPath = require.resolve('../../src/routes/providers');
  const rentersPath = require.resolve('../../src/routes/renters');
  delete require.cache[providersPath];
  delete require.cache[rentersPath];

  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters', require('../../src/routes/renters'));
  return app;
}

describe('API key auth parity — query and header support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/providers/me accepts x-provider-key header', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/providers/me')
      .set('x-provider-key', providerFixture.api_key);

    expect(res.status).toBe(200);
    expect(res.body.provider).toEqual(expect.objectContaining({
      id: providerFixture.id,
      name: providerFixture.name,
      gpu_model: providerFixture.gpu_model,
    }));
  });

  test('GET /api/providers/me still accepts key query param', async () => {
    const app = createApp();
    const res = await request(app).get(`/api/providers/me?key=${providerFixture.api_key}`);

    expect(res.status).toBe(200);
    expect(res.body.provider.id).toBe(providerFixture.id);
  });

  test('GET /api/renters/me accepts x-renter-key header', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/renters/me')
      .set('x-renter-key', renterFixture.api_key);

    expect(res.status).toBe(200);
    expect(res.body.renter).toEqual(expect.objectContaining({
      id: renterFixture.id,
      name: renterFixture.name,
      email: renterFixture.email,
    }));
  });

  test('GET /api/renters/me still accepts key query param', async () => {
    const app = createApp();
    const res = await request(app).get(`/api/renters/me?key=${renterFixture.api_key}`);

    expect(res.status).toBe(200);
    expect(res.body.renter.id).toBe(renterFixture.id);
  });
});
