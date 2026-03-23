/**
 * DCP-100: Full provider lifecycle E2E
 * register -> heartbeat -> job submit -> assigned -> result -> earnings -> withdraw
 */
const request = require('supertest');
const { createApp } = require('./test-app');
const { cleanDb, registerProvider, registerRenter, bringOnline, db } = require('./helpers');

const app = createApp();

beforeEach(() => cleanDb());

describe('Provider lifecycle E2E', () => {
  it('covers provider journey from registration to withdrawal request', async () => {
    // 1) Register provider
    const providerReg = await registerProvider(request, app, {
      name: 'Lifecycle Provider',
      gpu_model: 'RTX 4090',
      os: 'Linux',
    });
    expect(providerReg.status).toBe(200);
    expect(providerReg.apiKey).toMatch(/^dc1-provider-/);
    const providerKey = providerReg.apiKey;
    const providerId = providerReg.providerId;

    // 2) Send daemon heartbeat
    const heartbeatRes = await bringOnline(request, app, providerKey);
    expect(heartbeatRes.status).toBe(200);
    expect(heartbeatRes.body.success).toBe(true);

    const providerAfterHeartbeat = db.get('SELECT status FROM providers WHERE id = ?', providerId);
    expect(providerAfterHeartbeat.status).toBe('online');

    // 3) Submit job as renter
    const renterReg = await registerRenter(request, app, {
      balanceHalala: 500_000, // 5,000 SAR so balance is not a blocker
    });
    expect(renterReg.status).toBe(201);
    const renterKey = renterReg.apiKey;

    const submitRes = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({
        provider_id: providerId,
        job_type: 'training',
        duration_minutes: 60, // 7 halala/min = 420 halala total
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.job.status).toBe('pending');
    expect(submitRes.body.job.cost_halala).toBe(420);
    const jobId = submitRes.body.job.job_id;

    // 4) Daemon picks up assigned job
    const assignedRes = await request(app).get(`/api/jobs/assigned?key=${providerKey}`);
    expect(assignedRes.status).toBe(200);
    expect(assignedRes.body.job.job_id).toBe(jobId);
    expect(assignedRes.body.job.status).toBe('assigned');

    // 5) Daemon reports job result
    const resultRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({
        result: 'training complete',
        duration_seconds: 3600, // 60 min actual
      });

    expect(resultRes.status).toBe(200);
    expect(resultRes.body.success).toBe(true);
    expect(resultRes.body.billing.actual_cost_halala).toBe(420);
    expect(resultRes.body.billing.provider_earned_halala).toBe(315);
    expect(resultRes.body.billing.dc1_fee_halala).toBe(105);

    const completedJob = db.get('SELECT status, provider_earned_halala FROM jobs WHERE job_id = ?', jobId);
    expect(completedJob.status).toBe('completed');
    expect(completedJob.provider_earned_halala).toBe(315);

    // 6) Verify provider earnings are now claimable
    const meRes = await request(app).get(`/api/providers/me?key=${providerKey}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.provider.total_jobs).toBe(1);
    expect(meRes.body.provider.total_earnings_halala).toBeGreaterThan(0);

    const earningsRes = await request(app)
      .get('/api/providers/earnings')
      .set('x-provider-key', providerKey);
    expect(earningsRes.status).toBe(200);
    expect(earningsRes.body.claimable_earnings_halala).toBe(315);
    expect(earningsRes.body.available_halala).toBeGreaterThanOrEqual(315);

    // 7) Provider requests withdrawal
    const withdrawRes = await request(app)
      .post('/api/providers/withdraw')
      .send({
        api_key: providerKey,
        amount_sar: 3,
        payout_method: 'bank_transfer',
        payout_details: { iban: 'SA4420000001234567891234', bank_name: 'Test Bank' },
      });

    expect(withdrawRes.status).toBe(201);
    expect(withdrawRes.body.success).toBe(true);
    expect(withdrawRes.body.status).toBe('pending');
    expect(withdrawRes.body.withdrawal_id).toMatch(/^wd-/);

    const wd = db.get('SELECT amount_sar, status FROM withdrawals WHERE withdrawal_id = ?', withdrawRes.body.withdrawal_id);
    expect(wd).toBeDefined();
    expect(wd.amount_sar).toBe(3);
    expect(wd.status).toBe('pending');
  });
});

