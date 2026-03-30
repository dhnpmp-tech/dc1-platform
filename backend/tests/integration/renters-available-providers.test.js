'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../../src/routes/jobs', () => ({
  COST_RATES: {
    llm_inference: 15,
    training: 25,
    rendering: 20,
    default: 10,
  },
}));

jest.mock('../../src/services/p2p-discovery', () => ({
  getDiscoveryStatus: jest.fn(() => ({
    mode: 'shadow',
    announcement_enabled: false,
    bootstrap_configured: false,
  })),
  resolveProviders: jest.fn(async () => []),
  listProviders: jest.fn(async () => []),
  buildShadowCycleSummary: jest.fn(() => ({ decision: 'hold-shadow' })),
}));

const { cleanDb, db } = require('./helpers');
const discovery = require('../../src/services/p2p-discovery');

function createApp() {
  const app = express();
  app.use(express.json());

  const rentersPath = require.resolve('../../src/routes/renters');
  delete require.cache[rentersPath];
  app.use('/api/renters', require('../../src/routes/renters'));

  return app;
}

function insertProvider({
  id,
  name,
  email,
  gpuModel,
  gpuVramMib,
  location,
  status = 'online',
  isPaused = 0,
  lastHeartbeat,
}) {
  db.run(
    `INSERT INTO providers (
      id, name, email, gpu_model, gpu_name_detected, gpu_vram_mib,
      status, is_paused, location, api_key, created_at, updated_at, last_heartbeat
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    name,
    email,
    gpuModel,
    gpuModel,
    gpuVramMib,
    status,
    isPaused,
    location,
    `provider-key-${id}`,
    new Date().toISOString(),
    new Date().toISOString(),
    lastHeartbeat || new Date().toISOString()
  );
}

describe('GET /api/renters/available-providers filtering + pagination', () => {
  let app;

  beforeEach(() => {
    cleanDb();
    jest.clearAllMocks();
    app = createApp();
  });

  test('returns 400 for invalid query values', async () => {
    const res = await request(app)
      .get('/api/renters/available-providers')
      .query({ page: '0', limit: '-5', min_vram_gb: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  test('applies sqlite-mode filters and paginates results', async () => {
    insertProvider({
      id: 1001,
      name: 'Riyadh 4090',
      email: 'riyadh-4090@test.local',
      gpuModel: 'RTX 4090',
      gpuVramMib: 24576,
      location: 'Riyadh, SA',
    });
    insertProvider({
      id: 1002,
      name: 'Riyadh 4080',
      email: 'riyadh-4080@test.local',
      gpuModel: 'RTX 4080',
      gpuVramMib: 16384,
      location: 'Riyadh, SA',
    });
    insertProvider({
      id: 1003,
      name: 'Jeddah 3090',
      email: 'jeddah-3090@test.local',
      gpuModel: 'RTX 3090',
      gpuVramMib: 24576,
      location: 'Jeddah, SA',
    });

    const res = await request(app)
      .get('/api/renters/available-providers')
      .query({
        discovery: 'sqlite',
        gpu_model: 'rtx',
        location: 'riy',
        min_vram_gb: '20',
        page: '1',
        limit: '1',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      total: 1,
      page: 1,
      limit: 1,
      pages: 1,
      providers: expect.any(Array),
    }));
    expect(res.body.providers).toHaveLength(1);
    expect(res.body.providers[0]).toEqual(expect.objectContaining({
      id: 1001,
      gpu_model: 'RTX 4090',
      location: 'Riyadh, SA',
    }));
  });

  test('caps limit at 100 while preserving filtered total metadata', async () => {
    insertProvider({
      id: 1101,
      name: 'A',
      email: 'a@test.local',
      gpuModel: 'RTX 4090',
      gpuVramMib: 24576,
      location: 'Riyadh',
    });
    insertProvider({
      id: 1102,
      name: 'B',
      email: 'b@test.local',
      gpuModel: 'RTX 4080',
      gpuVramMib: 16384,
      location: 'Riyadh',
    });
    insertProvider({
      id: 1103,
      name: 'C',
      email: 'c@test.local',
      gpuModel: 'RTX 3090',
      gpuVramMib: 24576,
      location: 'Jeddah',
    });

    const res = await request(app)
      .get('/api/renters/available-providers')
      .query({ discovery: 'sqlite', limit: '999' });

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
    expect(res.body.total).toBe(3);
    expect(res.body.pages).toBe(1);
    expect(res.body.providers).toHaveLength(3);
  });

  test('applies the same filters/pagination in p2p-primary mode', async () => {
    discovery.listProviders.mockResolvedValue([
      {
        found: true,
        peer_id: 'peer-1',
        stale: false,
        provider: {
          peer_id: 'peer-1',
          announced_at: new Date().toISOString(),
          addrs: ['/ip4/127.0.0.1/tcp/4001'],
        },
        environment: {
          env: {
            gpu_model: 'A100 SXM',
            vram_gb: 80,
            available_slots: 1,
            region: 'Riyadh',
            reliability_score: 97,
            tags: ['llm'],
          },
        },
      },
      {
        found: true,
        peer_id: 'peer-2',
        stale: false,
        provider: {
          peer_id: 'peer-2',
          announced_at: new Date().toISOString(),
          addrs: ['/ip4/127.0.0.2/tcp/4001'],
        },
        environment: {
          env: {
            gpu_model: 'RTX 4090',
            vram_gb: 24,
            available_slots: 1,
            region: 'Dubai',
            reliability_score: 95,
            tags: ['render'],
          },
        },
      },
      { found: false, peer_id: 'peer-3' },
    ]);

    const res = await request(app)
      .get('/api/renters/available-providers')
      .query({
        discovery: 'p2p-primary',
        gpu_model: 'a100',
        location: 'riy',
        min_vram_gb: '40',
        page: '1',
        limit: '5',
      });

    expect(res.status).toBe(200);
    expect(discovery.listProviders).toHaveBeenCalledWith(expect.objectContaining({
      allowStale: false,
      maxAgeMs: 120000,
    }));
    expect(res.body).toEqual(expect.objectContaining({
      total: 1,
      page: 1,
      limit: 5,
      pages: 1,
    }));
    expect(res.body.providers).toHaveLength(1);
    expect(res.body.providers[0]).toEqual(expect.objectContaining({
      peer_id: 'peer-1',
      gpu_model: 'A100 SXM',
      location: 'Riyadh',
      discovery_source: 'dht',
    }));
  });
});
