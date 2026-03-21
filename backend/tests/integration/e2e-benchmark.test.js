/**
 * E2E Benchmark — simulate benchmark + leaderboard verification
 */
const request = require('supertest');
const { createApp } = require('./test-app');
const { cleanDb, registerProvider, bringOnline, db } = require('./helpers');

const app = createApp();

beforeEach(() => cleanDb());

describe('E2E Benchmark', () => {
  it('simulate benchmark → verify record + reliability + leaderboard', async () => {
    // 1. Register and bring online
    const { apiKey, providerId } = await registerProvider(request, app, {
      name: 'Benchmark Provider',
      email: 'bench@dc1.test',
    });
    await bringOnline(request, app, apiKey);

    // 2. POST /api/benchmark/simulate
    const simRes = await request(app).post('/api/benchmark/simulate').send({
      provider_id: providerId,
      benchmark_type: 'standard',
      score_gflops: 8500,
      temp_max_celsius: 72,
      vram_used_mib: 6144,
      latency_ms: 25,
    });
    expect(simRes.status).toBe(200);
    expect(simRes.body.success).toBe(true);
    const runId = simRes.body.run_id;

    // 3. Verify benchmark_runs record
    const run = db.get('SELECT * FROM benchmark_runs WHERE id = ?', runId);
    expect(run).toBeDefined();
    expect(run.provider_id).toBe(providerId);
    expect(run.status).toBe('completed');
    expect(run.score_gflops).toBe(8500);
    expect(run.benchmark_type).toBe('standard');

    // 4. Verify reliability_score updated
    const provider = db.get('SELECT * FROM providers WHERE id = ?', providerId);
    expect(provider.reliability_score).toBeGreaterThan(0);

    // 5. GET /api/benchmark/leaderboard — provider appears
    const lbRes = await request(app).get('/api/benchmark/leaderboard');
    expect(lbRes.status).toBe(200);
    expect(lbRes.body.leaderboard.length).toBeGreaterThanOrEqual(1);
    const entry = lbRes.body.leaderboard.find(e => e.provider_id === providerId);
    expect(entry).toBeDefined();
    expect(entry.best_score_gflops).toBe(8500);
    expect(entry.name).toBe('Benchmark Provider');
  });

  it('benchmark status endpoint returns correct data', async () => {
    const { apiKey, providerId } = await registerProvider(request, app, {
      name: 'Status Provider',
      email: 'status@dc1.test',
    });
    await bringOnline(request, app, apiKey);

    const simRes = await request(app).post('/api/benchmark/simulate').send({
      provider_id: providerId,
      score_gflops: 5000,
    });
    const runId = simRes.body.run_id;

    const statusRes = await request(app).get(`/api/benchmark/status/${runId}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.score_gflops).toBe(5000);
    expect(statusRes.body.status).toBe('completed');
  });
});
